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

async function retry<T>(operation: () => Promise<T>, maxAttempts: number): Promise<T> {
  let latestError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      latestError = error;
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
      if (TERMINAL_FAILURES.has(run.status)) {
        throw new Error(`Apify run ${run.id} ended with ${run.status}.`);
      }
      if (polls >= options.maxPolls) throw new Error('Apify polling limit exceeded.');
      const elapsed = options.nowMs() - startedAt;
      if (elapsed >= options.timeoutMs) throw new Error('Apify run timed out.');
      await withinRunDeadline(
        () => options.sleep(Math.min(options.pollIntervalMs, options.timeoutMs - elapsed)),
        options,
        startedAt,
        'polling sleep',
      );
      run = await retry(
        () => withinRunDeadline(
          () => client.getRun(startedRun.id),
          options,
          startedAt,
          'getRun poll',
        ),
        options.maxAttempts,
      );
      if (run.id !== startedRun.id) throw new Error('Apify polling returned a different run id.');
      polls += 1;
    }
    runSucceeded = true;
    if (!run.defaultDatasetId) throw new Error(`Apify run ${run.id} has no default dataset.`);
    const items = await retry(
      () => withinRunDeadline(
        () => client.getDatasetItems(run.defaultDatasetId as string),
        options,
        startedAt,
        'dataset retrieval',
      ),
      options.maxAttempts,
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
    throw new Error(`Apify research failed: ${redactSensitive(error)}`);
  }
}

const QUESTION_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'do', 'does', 'for', 'how', 'in', 'is', 'of', 'on', 'the', 'to',
  'what', 'when', 'where', 'which', 'who', 'why', 'with', 'you', 'your',
]);
const GENERIC_QUESTION_TOKENS = new Set(['startup', 'startups', 'video', 'videos']);

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

export function selectRelevantPaaQuestions(keyword: string, questions: string[]): string[] {
  const keywordTokens = relevantTokens(keyword);
  const minimumOverlap = Math.min(2, keywordTokens.size);
  if (minimumOverlap === 0) {
    throw new Error('Research requires three relevant People Also Ask questions.');
  }
  const selected: string[] = [];
  const seen = new Set<string>();
  for (const question of questions) {
    const trimmed = question.trim();
    const normalized = normalizeKeyword(trimmed);
    if (!trimmed || seen.has(normalized)) continue;
    seen.add(normalized);
    const questionTokens = relevantTokens(trimmed);
    const overlap = [...questionTokens].filter((token) => keywordTokens.has(token)).length;
    if (overlap < minimumOverlap) continue;
    selected.push(trimmed);
    if (selected.length === 3) return selected;
  }
  throw new Error('Research requires three relevant People Also Ask questions.');
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
            let selectedQuestions: string[] = [];
            try { selectedQuestions = selectRelevantPaaQuestions(result.candidate.primaryKeyword, result.peopleAlsoAsk); } catch { /* Still incomplete; next attempt or cache may recover. */ }
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
        const faqQuestions = selectRelevantPaaQuestions(
          candidate.primaryKeyword,
          shallow.peopleAlsoAsk,
        );
        const sourceUrls = shallow.organicResults.map(({url}) => url);
        const provenance = {...shallow.provenance};
        let selection: SourceSelectionWithContent;
        const selectSources = async (urls: string[]): Promise<SourceSelectionWithContent> => options.sourceChecker.selectWithContent
          ? options.sourceChecker.selectWithContent(urls, {query:candidate.primaryKeyword,questions:faqQuestions})
          : {sources:await options.sourceChecker.select(urls),sourceDocuments:[]};
        try {
          selection = await selectSources(sourceUrls);
        } catch {
          // Discovery, not injected facts: two observed FAQ queries restricted
          // to primary startup-program publishers. Preserve their own run IDs;
          // these results never inflate the primary keyword's organic count.
          const queries = faqQuestions.slice(0, 2).map((question) => `${question} (site:ycombinator.com OR site:techstars.com)`);
          const support = await runApifyActor(options.apify, SERP_ACTOR_ID, {
            queries: `${queries.join('\n')}\n`, maxPagesPerQuery: 1,
            countryCode: 'us', languageCode: 'en', mobileResults: false,
            saveHtml: false, saveHtmlToKeyValueStore: false,
            websiteContentScraper: {enable: false},
          }, execution);
          const observations = support.items.map((item) => normalizeSerpItem(item, support.provenance) as NormalizedSerp);
          for (const observation of observations) {
            if (!queries.some((query) => normalizeKeyword(query) === normalizeKeyword(observation.query))
              || observation.country !== 'US' || observation.language !== 'en'
              || observation.device !== 'DESKTOP' || observation.page !== 1) continue;
            for (const result of observation.organicResults) {
              const hostname = new URL(result.url).hostname.replace(/^www\./u, '');
              if (hostname === 'ycombinator.com' || hostname === 'techstars.com') sourceUrls.push(result.url);
            }
          }
          provenance.supportSearches = [support.provenance];
          selection = await selectSources([...new Set(sourceUrls)].slice(0, 24));
        }
        const evidence = EvidenceBundleSchema.parse({
          schemaVersion: 2,
          candidateFingerprint: candidateFingerprints(candidate).candidate,
          signals: {
            autocomplete: shallow.suggestions,
            peopleAlsoAsk: shallow.peopleAlsoAsk,
            relatedSearches: shallow.relatedQueries,
          },
          serp: {
            organicResultCount: shallow.organicResults.length,
            peopleAlsoAsk: faqQuestions,
          },
          sources: selection.sources,
          faqQuestions,
        });
        results.push({ candidate, evidence, provenance, ...(selection.sourceDocuments.length ? {sourceDocuments:selection.sourceDocuments} : {}) });
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
