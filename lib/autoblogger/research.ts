import {
  normalizeAutocompleteItem,
  normalizeSerpItem,
} from '../keywords/apify-evidence.mjs';
import type { ApifyClient, ApifyRun } from './apify-client';
import {
  EvidenceBundleSchema,
  candidateFingerprints,
  normalizeKeyword,
  type Candidate,
  type EvidenceBundle,
} from './domain';
import { redactSensitive } from './http';
import {
  RUN_LIMITS,
  limitDeepInspections,
  limitCandidatesForScan,
} from './policies';
import type { SafeSourceChecker, SourceDocument, SourceSelectionWithContent } from './sources';
import { PAA_ACTOR_ID, normalizePaaRows, type PaaObservation } from './paa';
import { isDiscoverySourceUrl, sourceDiscoveryQueries } from './source-policy';
import { faqQuestionKey } from './faq-evidence';
import { containsSecretLikeValue } from './secrets';
import type { SourceRelevanceReceipt } from './source-admission';

export const AUTOCOMPLETE_ACTOR_ID = 'automation-lab/google-autocomplete-scraper';
export const SERP_ACTOR_ID = 'apify/google-search-scraper';

export type ApifyObservationProvenance = {
  actorId: string;
  runId: string;
  datasetId: string;
  observedAt: string;
};

export type ApifyActorResult = {
  items: unknown[];
  provenance: ApifyObservationProvenance;
};

export type ApifyExecutionOptions = {
  maxPolls: number;
  maxAttempts: number;
  pollIntervalMs: number;
  timeoutMs: number;
  nowMs: () => number;
  sleep: (milliseconds: number) => Promise<void>;
};

export type ResearchResult = {
  candidate: Candidate;
  evidence: EvidenceBundle;
  sourceDocuments?: SourceDocument[];
  sourceRelevanceReceipt?: SourceRelevanceReceipt;
  paaObservations?: PaaObservation[];
  provenance: {
    discovery: ApifyObservationProvenance;
    serp: ApifyObservationProvenance;
    serpAttempts?: ApifyObservationProvenance[];
    paa?: ApifyObservationProvenance;
    paaAttempts?: ApifyObservationProvenance[];
    supportSearches?: ApifyObservationProvenance[];
  };
};

export type ShallowResearchResult = {
  candidate: Candidate;
  suggestions: string[];
  organicResults: Array<{
    url: string;
    title: string;
    snippet: string;
    resultType: string;
  }>;
  peopleAlsoAsk: string[];
  relatedQueries: string[];
  serpCollectionError?: string;
  paaObservations?: PaaObservation[];
  paaCollectionError?: string;
  paaCacheReused?: boolean;
  provenance: ResearchResult['provenance'];
};

export type ShallowResearchBatch = {
  scannedCount: number;
  results: ShallowResearchResult[];
};

export type ResearchBatch = {
  scannedCount: number;
  deepInspectionCount: number;
  results: ResearchResult[];
};

/** Carries completed collection receipts, never retrieved page bodies. */
export class ResearchInspectionError extends Error {
  constructor(error: unknown, readonly provenance: ResearchResult['provenance']) {
    super(redactSensitive(error instanceof Error ? error.message : String(error)).slice(0, 500));
    this.name = 'ResearchInspectionError';
  }
}

type ResearcherOptions = {
  apify: ApifyClient;
  sourceChecker: Pick<SafeSourceChecker, 'select' | 'selectWithContent'>;
  execution?: Partial<ApifyExecutionOptions>;
};

const TERMINAL_FAILURES = new Set(['FAILED', 'ABORTED', 'TIMED-OUT']);
const DEFAULT_EXECUTION: ApifyExecutionOptions = {
  maxPolls: 150,
  maxAttempts: 3,
  pollIntervalMs: 1_000,
  // Permit the server's bounded 120-second job plus final status/dataset reads.
  timeoutMs: 150_000,
  nowMs: () => Date.now(),
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
};

async function retry<T>(operation: () => Promise<T>, maxAttempts: number, beforeRetry: (failedAttempt: number) => Promise<void>): Promise<T> {
  let latestError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      latestError = error;
      if (attempt < maxAttempts) await beforeRetry(attempt);
    }
  }
  throw latestError;
}

async function withinRunDeadline<T>(
  operation: () => Promise<T>,
  options: ApifyExecutionOptions,
  startedAt: number,
  stage: string,
): Promise<T> {
  const remainingMs = options.timeoutMs - (options.nowMs() - startedAt);
  if (remainingMs <= 0) throw new Error(`Apify run timed out during ${stage}.`);
  let timeout: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(
      () => reject(new Error(`Apify run timed out during ${stage}.`)),
      remainingMs,
    );
  });
  try {
    return await Promise.race([operation(), timeoutPromise]);
  } finally {
    clearTimeout(timeout!);
  }
}

function observationTime(run: ApifyRun): string {
  const value = run.finishedAt ?? run.startedAt;
  if (!value || Number.isNaN(Date.parse(value))) {
    throw new Error(`Apify run ${run.id} has no valid observation timestamp.`);
  }
  return value;
}

export async function runApifyActor(
  client: ApifyClient,
  actorId: string,
  input: Record<string, unknown>,
  overrides: Partial<ApifyExecutionOptions> = {},
): Promise<ApifyActorResult> {
  const options = { ...DEFAULT_EXECUTION, ...overrides };
  if (
    options.maxPolls < 1
    || options.maxAttempts < 1
    || options.pollIntervalMs < 0
    || options.timeoutMs <= 0
  ) {
    throw new Error('Apify execution bounds are invalid.');
  }
  const startedAt = options.nowMs();
  let startedRunId: string | undefined;
  let runSucceeded = false;
  let stage = 'startActor';
  const readBackoff = async (failedAttempt: number) => {
    // Space existing read attempts, never repeat the paid start. Delays consume
    // the same run deadline; request, attempt and polling ceilings are unchanged.
    const delay = Math.min(10_000, Math.min(5_000, options.pollIntervalMs * 5) * 2 ** (failedAttempt - 1));
    await withinRunDeadline(() => options.sleep(delay), options, startedAt, `${stage} backoff`);
  };
  try {
    const startedRun = await withinRunDeadline(
      () => client.startActor(actorId, input),
      options,
      startedAt,
      'startActor',
    );
    startedRunId = startedRun.id;
    let run = startedRun;
    let polls = 0;
    while (run.status !== 'SUCCEEDED') {
      stage = 'run status';
      if (TERMINAL_FAILURES.has(run.status)) {
        throw new Error(`Apify run ${run.id} ended with ${run.status}.`);
      }
      if (polls >= options.maxPolls) throw new Error('Apify polling limit exceeded.');
      const elapsed = options.nowMs() - startedAt;
      if (elapsed >= options.timeoutMs) throw new Error('Apify run timed out.');
      stage = 'polling sleep';
      await withinRunDeadline(
        () => options.sleep(Math.min(options.pollIntervalMs, options.timeoutMs - elapsed)),
        options,
        startedAt,
        'polling sleep',
      );
      stage = 'getRun poll';
      run = await retry(
        () => withinRunDeadline(
          () => client.getRun(startedRun.id),
          options,
          startedAt,
          'getRun poll',
        ),
        options.maxAttempts,
        readBackoff,
      );
      if (run.id !== startedRun.id) throw new Error('Apify polling returned a different run id.');
      polls += 1;
    }
    runSucceeded = true;
    stage = 'dataset retrieval';
    if (!run.defaultDatasetId) throw new Error(`Apify run ${run.id} has no default dataset.`);
    const items = await retry(
      () => withinRunDeadline(
        () => client.getDatasetItems(run.defaultDatasetId as string),
        options,
        startedAt,
        'dataset retrieval',
      ),
      options.maxAttempts,
      readBackoff,
    );
    return {
      items,
      provenance: {
        actorId,
        runId: run.id,
        datasetId: run.defaultDatasetId,
        observedAt: observationTime(run),
      },
    };
  } catch (error) {
    if (startedRunId && !runSucceeded) {
      let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          client.abortRun(startedRunId),
          new Promise<void>((resolve) => {
            cleanupTimer = setTimeout(resolve, Math.min(5_000, options.timeoutMs));
          }),
        ]);
      } catch {
        // Best-effort remote cost cleanup must not hide the original redacted failure.
      } finally {
        if (cleanupTimer) clearTimeout(cleanupTimer);
      }
    }
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(redactSensitive(`Apify research failed${startedRunId ? ` for run ${startedRunId}` : ''} during ${stage}: ${detail}`));
  }
}

const QUESTION_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'do', 'does', 'for', 'how', 'in', 'is', 'of', 'on', 'the', 'to',
  'what', 'when', 'where', 'which', 'who', 'why', 'with', 'you', 'your',
]);
const GENERIC_QUESTION_TOKENS = new Set(['startup', 'startups', 'video', 'videos']);
// Article formats can strengthen a topic match, but cannot stand in for it.
const QUESTION_FORMAT_TOKENS = new Set([
  'checklist', 'checklists', 'guide', 'guides', 'template', 'templates', 'example', 'examples',
]);
const QUESTION_PROCESS_MODIFIERS = new Set([
  'workflow', 'workflows', 'process', 'processes', 'plan', 'plans', 'planning',
]);

function relevantTokens(value: string): Set<string> {
  return new Set(
    normalizeKeyword(value)
      .split(' ')
      .filter((token) =>
        token.length > 1
        && !QUESTION_STOP_WORDS.has(token)
        && !GENERIC_QUESTION_TOKENS.has(token)),
  );
}

function rankPaaCandidates(keyword: string, questions: string[]): string[] {
  const keywordTokens = relevantTokens(keyword);
  // Normalize only this leading query framing, never verbs throughout a topic
  // (e.g. "record") or the observed questions. Keep the original keyword's
  // tokens for the overlap floor and ranking, and its exact query for collection.
  const topicKeyword = normalizeKeyword(keyword).replace(/^how to (?:make|create) /u, '');
  const topicTokens = [...relevantTokens(topicKeyword)].filter((token) => !QUESTION_FORMAT_TOKENS.has(token));
  // A trailing process label describes the article's treatment of its topic.
  // Keep at least two topic terms; retain interior terms such as "process" in
  // "business process automation". All modifiers still count toward ranking.
  while (topicTokens.length > 2 && QUESTION_PROCESS_MODIFIERS.has(topicTokens[topicTokens.length - 1])) {
    topicTokens.pop();
  }
  // In a short compound such as "video marketing", dropping the medium leaves
  // a different, overly broad topic. Longer topics ("founder pitch video")
  // already retain two distinguishing terms. This is lexical screening, not a
  // semantic endorsement of every selected question.
  const requiresVideo = topicTokens.length === 1 && /\bvideos?\b/u.test(normalizeKeyword(topicKeyword));
  if (requiresVideo) {
    topicTokens.push('video');
    keywordTokens.add('video');
  }
  const minimumOverlap = Math.min(2, keywordTokens.size);
  if (topicTokens.length === 0) {
    return [];
  }
  const selected: Array<{ question: string; overlap: number }> = [];
  const seen = new Set<string>();
  for (const question of questions) {
    const trimmed = question.trim();
    const normalized = normalizeKeyword(trimmed);
    const key = faqQuestionKey(trimmed);
    if (!trimmed || trimmed.length > 500 || /[\u0000-\u001f\u007f-\u009f\p{Cf}]/u.test(trimmed)
      || containsSecretLikeValue(trimmed) || seen.has(key)) continue;
    seen.add(key);
    const questionTokens = relevantTokens(trimmed);
    if (requiresVideo && /\bvideos?\b/u.test(normalized)) questionTokens.add('video');
    // Require the whole lexical topic: "product" + "checklist" is not
    // "product demo". Generic questions about that topic remain eligible.
    if (!topicTokens.every((token) => questionTokens.has(token))) continue;
    const overlap = [...questionTokens].filter((token) => keywordTokens.has(token)).length;
    if (overlap < minimumOverlap) continue;
    selected.push({ question: trimmed, overlap });
  }
  // Partial observations may seed one bounded discovery batch. They are not
  // eligible FAQs until the unchanged three-question gate below passes.
  return selected.sort((left, right) => right.overlap - left.overlap)
    .map(({ question }) => question);
}

export function rankRelevantPaaQuestions(keyword: string, questions: string[]): string[] {
  const selected = rankPaaCandidates(keyword, questions);
  if (selected.length < 3) throw new Error('Research requires three relevant People Also Ask questions.');
  return selected;
}

export function selectRelevantPaaQuestions(keyword: string, questions: string[]): string[] {
  return rankRelevantPaaQuestions(keyword, questions).slice(0, 3);
}

/** Collection hints are not semantic acceptance. Retain real question variants
 * for the body-anchored preparer instead of requiring every keyword noun in each
 * FAQ. Neither ranking nor a successful source fetch approves an answer. */
function observedPaaCandidates(keyword: string, questions: string[]): string[] {
  const strong = new Map(rankPaaCandidates(keyword, questions).map((question, index) => [faqQuestionKey(question), index]));
  // Light inflection folding affects ranking only: never question identity,
  // exact observation membership, source matching or tool-name equivalence.
  const hintTokens = (value: string) => normalizeKeyword(value).split(' ')
    .filter(token => token.length > 1 && !QUESTION_STOP_WORDS.has(token))
    .map(token => token.length > 4 && token.endsWith('s') ? token.slice(0, -1) : token);
  const tokens = new Set(hintTokens(keyword));
  const seen = new Set<string>();
  return questions.filter(question => {
    const key = faqQuestionKey(question);
    if (!question.trim() || question.length > 500
      || /[\u0000-\u001f\u007f-\u009f\p{Cf}]/u.test(question)
      || containsSecretLikeValue(question) || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((question, position) => ({
    question, position, strong: strong.get(faqQuestionKey(question)),
    overlap: new Set(hintTokens(question).filter(token => tokens.has(token))).size,
  })).sort((a, b) => (a.strong ?? Number.MAX_SAFE_INTEGER) - (b.strong ?? Number.MAX_SAFE_INTEGER)
    || b.overlap - a.overlap || a.position - b.position).map(item => item.question);
}

export function rankObservedPaaQuestions(keyword: string, questions: string[]): string[] {
  const candidates = observedPaaCandidates(keyword, questions);
  if (candidates.length < 3) throw new Error('Research requires three distinct observed People Also Ask questions before semantic review.');
  return candidates;
}

type NormalizedAutocomplete = {
  keyword: string;
  suggestion: string;
};

type NormalizedSerp = {
  query: string;
  country: string;
  language: string;
  device: string;
  page: number;
  organicResults: Array<{ url: string; title: string; snippet: string; resultType: string }>;
  peopleAlsoAsk: string[];
  relatedQueries: string[];
};

export function createResearcher(options: ResearcherOptions) {
  const execution = { ...DEFAULT_EXECUTION, ...options.execution };
  const currentPaa = (row: PaaObservation, provenance: ApifyObservationProvenance) => {
    const rowTime = Date.parse(row.observedAt);
    const runTime = Date.parse(provenance.observedAt);
    const now = execution.nowMs();
    return now - rowTime >= 0 && now - rowTime <= 60 * 60_000
      && now - runTime >= 0 && now - runTime <= 60 * 60_000
      && Math.abs(rowTime - runTime) <= 5 * 60_000;
  };
  async function scan(allCandidates: Candidate[]): Promise<ShallowResearchBatch> {
      const scannedCandidates = limitCandidatesForScan(allCandidates);
      if (scannedCandidates.length > RUN_LIMITS.maxCandidatesScanned) {
        throw new Error('Research staging exceeded the configured scan or deep-inspection cap.');
      }
      if (scannedCandidates.length === 0) {
        return { scannedCount: 0, results: [] };
      }

      const discovery = await runApifyActor(options.apify, AUTOCOMPLETE_ACTOR_ID, {
        keywords: scannedCandidates.map(({ primaryKeyword }) => primaryKeyword),
        language: 'en',
        country: 'us',
        maxDepth: 1,
        maxSuggestionsPerKeyword: 10,
        // Validate the seed queries first; alphabet expansion multiplies this
        // bounded 50-candidate scan into up to 1,350 provider queries.
        appendAlphabet: false,
        maxRequestRetries: 3,
      }, execution);
      const autocomplete = discovery.items.map(
        (item) => normalizeAutocompleteItem(item) as NormalizedAutocomplete,
      );

      const serpInput = {
        queries: `${scannedCandidates.map(({ primaryKeyword }) => primaryKeyword).join('\n')}\n`,
        maxPagesPerQuery: 1,
        countryCode: 'us',
        languageCode: 'en',
        // English interface, not lr=lang_en: that extra page-language filter
        // reproduced empty Google pages for otherwise populated US queries.
        mobileResults: false,
        includeUnfilteredResults: false,
        saveHtml: false,
        saveHtmlToKeyValueStore: false,
        websiteContentScraper: { enable: false },
      };
      const serp = await runApifyActor(options.apify, SERP_ACTOR_ID, serpInput, execution);
      const serpItems = serp.items.map(
        (item) => normalizeSerpItem(item, serp.provenance) as NormalizedSerp,
      );

      const results = scannedCandidates.map((candidate): ShallowResearchResult => {
        const normalizedKeyword = normalizeKeyword(candidate.primaryKeyword);
        const observedSerp = serpItems.find(
          ({ query }) => normalizeKeyword(query) === normalizedKeyword,
        );
        if (!observedSerp) throw new Error(`No SERP observation found for ${candidate.primaryKeyword}.`);
        if (
          observedSerp.country !== 'US'
          || observedSerp.language !== 'en'
          || observedSerp.device !== 'DESKTOP'
          || observedSerp.page !== 1
        ) {
          throw new Error('SERP research must use US/en desktop first-page observations.');
        }
        const suggestions = autocomplete
          .filter(({ keyword }) => normalizeKeyword(keyword) === normalizedKeyword)
          .map(({ suggestion }) => suggestion);
        return {
          candidate,
          suggestions,
          organicResults: observedSerp.organicResults,
          peopleAlsoAsk: observedSerp.peopleAlsoAsk,
          relatedQueries: observedSerp.relatedQueries,
          provenance: { discovery: discovery.provenance, serp: serp.provenance },
        };
      });
      // Successful provider jobs can still return empty organic rows. Retry only
      // those exact queries once, without changing locale or expanding the scan.
      // Replace a row atomically so its organic/PAA/related fields share the
      // selected SERP provenance; keep both completed observations for audit.
      const missingOrganic = results.filter((result) => result.organicResults.length === 0);
      if (missingOrganic.length) {
        for (const result of missingOrganic) result.provenance.serpAttempts = [serp.provenance];
        const retryQueries = [...new Map(missingOrganic.map(({ candidate }) =>
          [normalizeKeyword(candidate.primaryKeyword), candidate.primaryKeyword])).values()];
        try {
          const retried = await runApifyActor(options.apify, SERP_ACTOR_ID, {
            ...serpInput, queries: `${retryQueries.join('\n')}\n`,
          }, execution);
          for (const result of missingOrganic) {
            result.provenance.serpAttempts!.push(retried.provenance);
            try {
              const matching = retried.items.filter((item) => {
                const query = (item as { searchQuery?: { term?: unknown } } | null)?.searchQuery?.term;
                return typeof query === 'string'
                  && normalizeKeyword(query) === normalizeKeyword(result.candidate.primaryKeyword);
              });
              if (matching.length !== 1) throw new Error('SERP retry requires one exact-query observation.');
              const observation = normalizeSerpItem(matching[0], retried.provenance) as NormalizedSerp;
              if (observation.country !== 'US' || observation.language !== 'en'
                || observation.device !== 'DESKTOP' || observation.page !== 1) {
                throw new Error('SERP retry requires US/en desktop first-page observations.');
              }
              result.organicResults = observation.organicResults;
              result.peopleAlsoAsk = observation.peopleAlsoAsk;
              result.relatedQueries = observation.relatedQueries;
              result.provenance.serp = retried.provenance;
              if (!observation.organicResults.length) result.serpCollectionError = 'SERP retry returned no organic results.';
            } catch (error) {
              result.serpCollectionError = redactSensitive(error).slice(0, 500);
            }
          }
        } catch (error) {
          for (const result of missingOrganic) result.serpCollectionError = redactSensitive(error).slice(0, 500);
        }
      }
      // The organic collector can return a valid SERP without its dynamic PAA
      // component. One bounded batch uses a purpose-built collector; its answers
      // are never promoted to verified source facts (many are AI overviews).
      const needsPaa = (result: ShallowResearchResult) => {
        if (!result.organicResults.length) return false;
        try { selectRelevantPaaQuestions(result.candidate.primaryKeyword, result.peopleAlsoAsk); return false; }
        catch { return true; }
      };
      for (let attempt = 0; attempt < 2; attempt++) {
        const missingQuestions = results.filter(needsPaa);
        if (!missingQuestions.length) break;
        try {
          const paa = await runApifyActor(options.apify, PAA_ACTOR_ID, {
            keywords: missingQuestions.map(({candidate}) => candidate.primaryKeyword),
            countryCode: 'us', languageCode: 'en', includeRelatedSearches: true,
          }, execution);
          for (const result of missingQuestions) {
            const observed = normalizePaaRows(paa.items, result.candidate.primaryKeyword, paa.provenance);
            const current = observed.observations.filter(row => currentPaa(row, paa.provenance));
            result.peopleAlsoAsk = [...new Set([...result.peopleAlsoAsk, ...current.map(({question}) => question)])];
            result.relatedQueries = [...new Set([...result.relatedQueries, ...observed.relatedSearches])];
            const prior = result.paaObservations ?? [];
            const seen = new Set(prior.map(({question}) => normalizeKeyword(question)));
            // Preserve the later semantic candidate pool before truncation,
            // including nonliteral variants and incomplete collections.
            const selectedQuestions = observedPaaCandidates(result.candidate.primaryKeyword, result.peopleAlsoAsk).slice(0, 9);
            const selected = new Set(selectedQuestions.map(normalizeKeyword));
            result.paaObservations = [...prior, ...current.filter(({question}) => !seen.has(normalizeKeyword(question)))]
              .sort((left,right) => Number(selected.has(normalizeKeyword(right.question))) - Number(selected.has(normalizeKeyword(left.question))))
              .slice(0, 30);
            result.provenance.paa = paa.provenance;
            result.provenance.paaAttempts = [...(result.provenance.paaAttempts ?? []), paa.provenance];
            delete result.paaCollectionError;
          }
        } catch (error) {
          for (const result of missingQuestions) result.paaCollectionError = redactSensitive(error).slice(0, 500);
        }
      }
      // Google features are intermittent. Reuse only exact-query observations
      // from this actor's own recent datasets, never a caller-supplied question
      // list. Keep their ORIGINAL time/run, not the current organic SERP's time.
      // One-hour freshness and a ten-dataset/30-second bound prevent stale or
      // unbounded recovery. Live organic rankings above are always recollected.
      if (results.some(needsPaa) && options.apify.getRecentActorRuns) {
        const cacheStarted = execution.nowMs();
        const cacheBounds = {...execution, timeoutMs:30_000};
        try {
          const runs = await withinRunDeadline(() => options.apify.getRecentActorRuns!(PAA_ACTOR_ID), cacheBounds, cacheStarted, 'recent PAA runs');
          for (const run of runs.slice(0, 10)) {
            const missing = results.filter(needsPaa);
            if (!missing.length) break;
            if (run.status !== 'SUCCEEDED' || !run.defaultDatasetId || !run.finishedAt) continue;
            const age = execution.nowMs() - Date.parse(run.finishedAt);
            if (!Number.isFinite(age) || age < 0 || age > 60 * 60_000) continue;
            const items = await withinRunDeadline(() => options.apify.getDatasetItems(run.defaultDatasetId!), cacheBounds, cacheStarted, 'recent PAA dataset');
            const provenance = {actorId:PAA_ACTOR_ID,runId:run.id,datasetId:run.defaultDatasetId,observedAt:run.finishedAt};
            for (const result of missing) {
              const observed = normalizePaaRows(items, result.candidate.primaryKeyword, provenance);
              const observations = observed.observations.filter(row => currentPaa(row, provenance));
              const questions = observations.map(({question}) => question);
              try { selectRelevantPaaQuestions(result.candidate.primaryKeyword, questions); } catch { continue; }
              result.peopleAlsoAsk = questions;
              result.paaObservations = observations;
              result.provenance.paa = provenance;
              result.paaCacheReused = true;
              delete result.paaCollectionError;
            }
          }
        } catch (error) {
          for (const result of results.filter(needsPaa)) result.paaCollectionError = redactSensitive(error).slice(0, 500);
        }
      }
      return { scannedCount: scannedCandidates.length, results };
  }

  async function inspect(shallowInput: ShallowResearchResult[]): Promise<ResearchBatch> {
      const deepCandidates = limitDeepInspections(shallowInput);
      const results: ResearchResult[] = [];
      for (const shallow of deepCandidates) {
        const { candidate } = shallow;
        // Retain bounded observations for semantic preparation. Lexical matches
        // rank first, but wording differences are not evidence of irrelevance.
        let faqPool = observedPaaCandidates(
          candidate.primaryKeyword,
          shallow.peopleAlsoAsk,
        ).slice(0, 9);
        let faqQuestions = faqPool.slice(0, 3);
        const observedQuestions = [...shallow.peopleAlsoAsk];
        const supplementaryPaa: PaaObservation[] = [];
        const sourceUrls = shallow.organicResults.map(({url}) => url);
        const provenance = {...shallow.provenance};
        let selection: SourceSelectionWithContent;
        const selectSources = async (urls: string[]): Promise<SourceSelectionWithContent> => options.sourceChecker.selectWithContent
          ? options.sourceChecker.selectWithContent(urls, {query:candidate.primaryKeyword,questions:faqPool,articleTitle:candidate.title})
          : {sources:await options.sourceChecker.select(urls),sourceDocuments:[]};
        const discoverSupport = async (articleTitle?: string) => {
          // Discovery, not injected facts. Body research covers the fixed title
          // as well as the keyword before drafting; a topical company profile
          // alone does not prove coverage of a promised practical workflow.
          const queries = sourceDiscoveryQueries(candidate.primaryKeyword, faqQuestions, articleTitle);
          const support = await runApifyActor(options.apify, SERP_ACTOR_ID, {
            queries: `${queries.join('\n')}\n`, maxPagesPerQuery: 1,
            countryCode: 'us', languageCode: 'en', mobileResults: false,
            saveHtml: false, saveHtmlToKeyValueStore: false,
            websiteContentScraper: {enable: false},
          }, execution);
          // Preserve the completed paid-search receipt even if its rows cannot
          // complete the FAQ pool or subsequent source verification fails.
          provenance.supportSearches = [support.provenance];
          // A malformed/out-of-market support row contributes nothing; it must
          // neither poison the other observations nor become accepted evidence.
          const observations = support.items.flatMap((item) => {
            try {
              const observation = normalizeSerpItem(item, support.provenance) as NormalizedSerp;
              const rawQuestions = (item as {peopleAlsoAsk?: unknown}).peopleAlsoAsk;
              // Capture the raw ordinal before normalization removes empty or
              // duplicate entries. Retain question text only, never answers.
              const questions = Array.isArray(rawQuestions) ? rawQuestions.slice(0, 30).flatMap((entry: unknown, index: number) => {
                const record = entry && typeof entry === 'object' ? entry as {question?: unknown; title?: unknown} : null;
                const question = typeof entry === 'string' ? entry : record?.question ?? record?.title;
                return typeof question === 'string' ? [{question: question.trim(), position: index + 1}] : [];
              }) : [];
              return [{observation, questions}];
            }
            catch { return []; }
          });
          const groups = [sourceUrls.slice(), ...queries.map(() => [] as string[])];
          // Keyword fingerprints intentionally discard punctuation, but search
          // operators and quotes are meaningful in a provider query identity.
          const queryKey = (query: string) => query.trim().toLocaleLowerCase('en-US');
          for (const {observation, questions} of observations) {
            const queryIndex = queries.findIndex((query) => queryKey(query) === queryKey(observation.query));
            if (queryIndex < 0
              || observation.country !== 'US' || observation.language !== 'en'
              || observation.device !== 'DESKTOP' || observation.page !== 1) continue;
            const questionSearch = faqQuestions.some(question => queryKey(question) === queryKey(queries[queryIndex]));
            // These questions belong to the actual support query, NOT the
            // target keyword SERP. Preserve that relationship and never retain
            // the provider's answer text as a verified source fact.
            for (const {question, position} of questions) {
              if (supplementaryPaa.length >= 30) break;
              const existing = new Set(observedQuestions.map(faqQuestionKey));
              if (existing.has(faqQuestionKey(question))) continue;
              const ranked = observedPaaCandidates(candidate.primaryKeyword, [...observedQuestions, question]);
              if (!ranked.includes(question)) continue;
              observedQuestions.push(question);
              supplementaryPaa.push({ ...support.provenance, query: observation.query, question,
                // A search seed is not evidence of a PAA expansion parent.
                parentQuestion: null, country: 'US', language: 'en', position });
            }
            for (const result of observation.organicResults) {
              // Exact FAQ results have the same trust as ordinary keyword
              // results: candidates for the safe body reader, not authorities.
              // Publisher-scoped searches still reject out-of-scope results.
              if (questionSearch || isDiscoverySourceUrl(result.url)) groups[queryIndex + 1].push(result.url);
            }
          }
          // Share the existing 24-fetch budget across organic and all support
          // result sets. Appending then truncating would discard later publishers.
          const balanced = new Set<string>();
          for (let i = 0; i < Math.max(...groups.map(group => group.length)) && balanced.size < 24; i++) {
            for (const group of groups) {
              if (group[i]) balanced.add(group[i]);
              if (balanced.size === 24) break;
            }
          }
          sourceUrls.splice(0, sourceUrls.length, ...balanced);
          faqPool = rankObservedPaaQuestions(candidate.primaryKeyword, observedQuestions).slice(0, 9);
        };
        try {
          if (options.sourceChecker.selectWithContent || faqPool.length < 3) {
            await discoverSupport(candidate.title);
            selection = await selectSources([...new Set(sourceUrls)].slice(0, 24));
          } else {
            try { selection = await selectSources(sourceUrls); }
            catch {
              await discoverSupport();
              selection = await selectSources([...new Set(sourceUrls)].slice(0, 24));
            }
          }
          // These are provisional observed choices. Body-anchored preparation
          // and independent review must establish three relevant answerable FAQs.
          faqPool = rankObservedPaaQuestions(candidate.primaryKeyword, observedQuestions).slice(0, 9);
          faqQuestions = faqPool.slice(0, 3);
          const evidence = EvidenceBundleSchema.parse({
            schemaVersion: 2,
            candidateFingerprint: candidateFingerprints(candidate).candidate,
            signals: {
              autocomplete: shallow.suggestions,
              peopleAlsoAsk: observedQuestions,
              relatedSearches: shallow.relatedQueries,
            },
            serp: {
              organicResultCount: shallow.organicResults.length,
              peopleAlsoAsk: faqQuestions,
            },
            sources: selection.sources,
            faqQuestions,
          });
          // Preparation may select any of the nine retained candidates, not
          // just the provisional three. Preserve their observation receipts.
          const selectedQuestions = new Set(faqPool.map(faqQuestionKey));
          const paaObservations = [...(shallow.paaObservations ?? []), ...supplementaryPaa]
            .sort((left, right) => Number(selectedQuestions.has(faqQuestionKey(right.question)))
              - Number(selectedQuestions.has(faqQuestionKey(left.question))))
            .slice(0, 30);
          results.push({ candidate, evidence, provenance,
            ...(selection.sourceRelevanceReceipt ? {sourceRelevanceReceipt:selection.sourceRelevanceReceipt} : {}),
            ...(paaObservations.length ? {paaObservations} : {}),
            ...(selection.sourceDocuments.length ? {sourceDocuments:selection.sourceDocuments} : {}) });
        } catch (error) {
          throw new ResearchInspectionError(error, provenance);
        }
      }
      return {
        scannedCount: shallowInput.length,
        deepInspectionCount: deepCandidates.length,
        results,
      };
  }

  return {
    scan,
    inspect,
    async research(allCandidates: Candidate[]): Promise<ResearchBatch> {
      const shallow = await scan(allCandidates);
      const ranked = shallow.results.sort((left, right) => (
        (
          right.suggestions.length
          + right.relatedQueries.length
          + right.organicResults.length
          + right.peopleAlsoAsk.length
        ) - (
          left.suggestions.length
          + left.relatedQueries.length
          + left.organicResults.length
          + left.peopleAlsoAsk.length
        )
        || candidateFingerprints(left.candidate).candidate.localeCompare(
          candidateFingerprints(right.candidate).candidate,
        )
      ));
      const inspected = await inspect(ranked);
      return { ...inspected, scannedCount: shallow.scannedCount };
    },
  };
}
