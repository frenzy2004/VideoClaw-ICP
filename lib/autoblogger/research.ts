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
  limitCandidatesForScan,
  stageOpportunitiesForDeepInspection,
} from './policies';
import type { SafeSourceChecker } from './sources';

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
  provenance: {
    discovery: ApifyObservationProvenance;
    serp: ApifyObservationProvenance;
  };
};

export type ResearchBatch = {
  scannedCount: number;
  deepInspectionCount: number;
  results: ResearchResult[];
};

type ResearcherOptions = {
  apify: ApifyClient;
  sourceChecker: Pick<SafeSourceChecker, 'select'>;
  execution?: Partial<ApifyExecutionOptions>;
};

const TERMINAL_FAILURES = new Set(['FAILED', 'ABORTED', 'TIMED-OUT']);
const DEFAULT_EXECUTION: ApifyExecutionOptions = {
  maxPolls: 30,
  maxAttempts: 3,
  pollIntervalMs: 1_000,
  timeoutMs: 60_000,
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
  try {
    const startedRun = await client.startActor(actorId, input);
    let run = startedRun;
    let polls = 0;
    while (run.status !== 'SUCCEEDED') {
      if (TERMINAL_FAILURES.has(run.status)) {
        throw new Error(`Apify run ${run.id} ended with ${run.status}.`);
      }
      if (polls >= options.maxPolls) throw new Error('Apify polling limit exceeded.');
      const elapsed = options.nowMs() - startedAt;
      if (elapsed >= options.timeoutMs) throw new Error('Apify run timed out.');
      await options.sleep(Math.min(options.pollIntervalMs, options.timeoutMs - elapsed));
      run = await retry(() => client.getRun(startedRun.id), options.maxAttempts);
      if (run.id !== startedRun.id) throw new Error('Apify polling returned a different run id.');
      polls += 1;
    }
    if (!run.defaultDatasetId) throw new Error(`Apify run ${run.id} has no default dataset.`);
    const items = await retry(
      () => client.getDatasetItems(run.defaultDatasetId as string),
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
    throw new Error(`Apify research failed: ${redactSensitive(error)}`);
  }
}

const QUESTION_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'do', 'does', 'for', 'how', 'in', 'is', 'of', 'on', 'the', 'to',
  'what', 'when', 'where', 'which', 'who', 'why', 'with', 'you', 'your',
]);

function relevantTokens(value: string): Set<string> {
  return new Set(
    normalizeKeyword(value)
      .split(' ')
      .filter((token) => token.length > 1 && !QUESTION_STOP_WORDS.has(token)),
  );
}

export function selectRelevantPaaQuestions(keyword: string, questions: string[]): string[] {
  const keywordTokens = relevantTokens(keyword);
  const selected: string[] = [];
  const seen = new Set<string>();
  for (const question of questions) {
    const trimmed = question.trim();
    const normalized = normalizeKeyword(trimmed);
    if (!trimmed || seen.has(normalized)) continue;
    seen.add(normalized);
    const questionTokens = relevantTokens(trimmed);
    if (![...questionTokens].some((token) => keywordTokens.has(token))) continue;
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
  organicResults: Array<{ url: string }>;
  peopleAlsoAsk: string[];
};

export function createResearcher(options: ResearcherOptions) {
  const execution = { ...DEFAULT_EXECUTION, ...options.execution };
  return {
    async research(allCandidates: Candidate[]): Promise<ResearchBatch> {
      const scannedCandidates = limitCandidatesForScan(allCandidates);
      const deepCandidates = stageOpportunitiesForDeepInspection(scannedCandidates);
      if (
        scannedCandidates.length > RUN_LIMITS.maxCandidatesScanned
        || deepCandidates.length > RUN_LIMITS.maxDeepInspections
      ) {
        throw new Error('Research staging exceeded the configured scan or deep-inspection cap.');
      }
      if (scannedCandidates.length === 0) {
        return { scannedCount: 0, deepInspectionCount: 0, results: [] };
      }

      const discovery = await runApifyActor(options.apify, AUTOCOMPLETE_ACTOR_ID, {
        keywords: scannedCandidates.map(({ primaryKeyword }) => primaryKeyword),
        language: 'en',
        country: 'us',
        maxDepth: 1,
        maxSuggestionsPerKeyword: 10,
        appendAlphabet: true,
        maxRequestRetries: 3,
      }, execution);
      const autocomplete = discovery.items.map(
        (item) => normalizeAutocompleteItem(item) as NormalizedAutocomplete,
      );

      const serp = await runApifyActor(options.apify, SERP_ACTOR_ID, {
        queries: `${deepCandidates.map(({ primaryKeyword }) => primaryKeyword).join('\n')}\n`,
        maxPagesPerQuery: 1,
        countryCode: 'us',
        languageCode: 'en',
        searchLanguage: 'en',
        mobileResults: false,
        includeUnfilteredResults: false,
        saveHtml: false,
        saveHtmlToKeyValueStore: false,
        websiteContentScraper: { enable: false },
      }, execution);
      const serpItems = serp.items.map(
        (item) => normalizeSerpItem(item, serp.provenance) as NormalizedSerp,
      );

      const results: ResearchResult[] = [];
      for (const candidate of deepCandidates) {
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
        const sources = await options.sourceChecker.select(
          observedSerp.organicResults.map(({ url }) => url),
        );
        const faqQuestions = selectRelevantPaaQuestions(
          candidate.primaryKeyword,
          observedSerp.peopleAlsoAsk,
        );
        const evidence = EvidenceBundleSchema.parse({
          schemaVersion: 1,
          candidateFingerprint: candidateFingerprints(candidate).candidate,
          suggestions: autocomplete
            .filter(({ keyword }) => normalizeKeyword(keyword) === normalizedKeyword)
            .map(({ suggestion }) => suggestion),
          serp: {
            organicResultCount: observedSerp.organicResults.length,
            peopleAlsoAsk: faqQuestions,
          },
          sources,
          faqQuestions,
        });
        results.push({
          candidate,
          evidence,
          provenance: { discovery: discovery.provenance, serp: serp.provenance },
        });
      }

      return {
        scannedCount: scannedCandidates.length,
        deepInspectionCount: deepCandidates.length,
        results,
      };
    },
  };
}
