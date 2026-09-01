#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  normalizeAutocompleteItem,
  normalizeSerpItem,
  rankObservedOpportunity,
  selectObservedArticleQuery,
} from '../../lib/keywords/apify-evidence.mjs';

const AUTOCOMPLETE_ACTOR = 'automation-lab/google-autocomplete-scraper';
const SERP_ACTOR = 'apify/google-search-scraper';
const DEFAULT_MANIFEST = 'data/research/apify/run-manifest.json';
const MVP_INTENT_REVIEW_RATIONALES = new Map([
  [
    'vc-c2-001',
    'The retained primary SERP connects Demo Day founder preparation with video and product-demo planning, supporting an MVP checklist draft.',
  ],
  [
    'vc-c2-003',
    'The retained primary SERP directly includes Demo Day pitch mistakes and startup video mistakes, matching the proposed corrective guide.',
  ],
  [
    'vc-c2-006',
    'The retained primary SERP contains startup investor-pitch video examples and founder discussions, matching the startup pitch-video intent.',
  ],
  [
    'vc-c2-007',
    'The retained primary SERP contains video-pitch guidance and pitch-format comparisons, matching the application-video comparison draft.',
  ],
  [
    'vc-c2-008',
    'The retained primary SERP contains founder pitch-video guidance and investor-pitch video tools, matching the how-to draft.',
  ],
  [
    'vc-c2-009',
    'The retained primary SERP contains a 60-second startup pitch guide and investor pitch-video results, matching the script-template draft.',
  ],
  [
    'vc-c2-013',
    'The retained primary SERP directly covers live product-demo failures and recovery discussion, matching the failure-response draft.',
  ],
  [
    'vc-c2-021',
    'The retained primary SERP contains post-Demo-Day founder guidance and Demo Day discussion, matching the post-event action draft.',
  ],
  [
    'vc-c2-026',
    'The retained primary SERP contains after-Demo-Day guidance and investor follow-up context, matching the investor asset-send draft.',
  ],
  [
    'vc-c2-027',
    'The retained primary SERP directly includes Demo Day follow-up structure and timing guidance, matching the investor timeline draft.',
  ],
]);

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) throw new Error(`Unexpected argument: ${argument}`);
    const name = argument.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${name}`);
    options[name] = value;
    index += 1;
  }

  for (const required of ['campaign', 'matrix', 'out']) {
    if (!options[required]) throw new Error(`Missing required --${required}`);
  }

  return options;
}

function normalizeSpaces(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeKeyword(value) {
  return normalizeSpaces(value.replaceAll('`', ''));
}

function splitOptionList(value) {
  return String(value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function splitKeywords(value) {
  return value
    .replaceAll('`', '')
    .replaceAll('<br>', ';')
    .split(';')
    .map(normalizeSpaces)
    .filter(Boolean);
}

export function parseResearchMatrix(markdown) {
  const articles = [];
  const blockPattern = /^### (vc-c[1-5]-\d{3})(?:[^\n]*)\n([\s\S]*?)(?=^### vc-c[1-5]-\d{3}|^## Cluster|(?![\s\S]))/gm;

  for (const match of markdown.matchAll(blockPattern)) {
    const [, articleId, block] = match;
    const tablePrimary = block.match(/^\| `primary_keyword` \| `([^`]+)` \|/m)?.[1];
    const tableSecondary = block.match(/^\| `secondary_keywords` \| (.+?) \|$/m)?.[1];
    const bulletPrimary = block.match(/^- \*\*Primary keyword:\*\* (.+)$/m)?.[1];
    const bulletSecondary = block.match(/^- \*\*Secondary keywords:\*\* (.+)$/m)?.[1];
    const primary = normalizeKeyword(tablePrimary ?? bulletPrimary ?? '');
    const secondary = splitKeywords(tableSecondary ?? bulletSecondary ?? '');
    if (primary) articles.push({ articleId, primary, secondary });
  }

  for (const line of markdown.split('\n')) {
    if (!/^\| vc-c[1-5]-\d{3} \|/.test(line)) continue;
    const columns = line
      .split('|')
      .slice(1, -1)
      .map(normalizeSpaces);
    const [articleId, , , , primary, secondary] = columns;
    if (!primary || !secondary) continue;
    articles.push({ articleId, primary: normalizeKeyword(primary), secondary: splitKeywords(secondary) });
  }

  const byId = new Map(articles.map((article) => [article.articleId, article]));
  const uniqueArticles = [...byId.values()].sort((left, right) =>
    left.articleId.localeCompare(right.articleId),
  );
  if (uniqueArticles.length !== 50) {
    throw new Error(`Expected 50 article specifications; parsed ${uniqueArticles.length}`);
  }

  return uniqueArticles;
}

export function uniqueResearchQueries(articles) {
  const seen = new Set();
  const output = [];
  for (const article of articles) {
    for (const query of [article.primary, ...article.secondary]) {
      const normalized = normalizeSpaces(query).toLocaleLowerCase('en-US');
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      output.push(query);
    }
  }
  return output.slice(0, 200);
}

export function resolveVerifiedDatasetIds(runs, requestedDatasetIds, label) {
  if (requestedDatasetIds.length && requestedDatasetIds.length !== runs.length) {
    throw new Error(`Comma-separated ${label} run and dataset ID counts must match`);
  }

  return runs.map((run, index) => {
    const requestedDatasetId = requestedDatasetIds[index];
    if (requestedDatasetId && requestedDatasetId !== run.defaultDatasetId) {
      throw new Error(
        `${label} run ${run.id} default dataset ${run.defaultDatasetId} does not match requested dataset ${requestedDatasetId}`,
      );
    }
    return requestedDatasetId ?? run.defaultDatasetId;
  });
}

export function intentReviewForSelection(articleId, selection) {
  const rationale = MVP_INTENT_REVIEW_RATIONALES.get(articleId);
  if (
    rationale
    && selection.selectionDecision === 'retained_observed_primary'
    && selection.evidence.organicResults.length > 0
  ) {
    return { status: 'approved_for_mvp_draft', rationale };
  }

  return {
    status: 'pending_editorial_intent_review',
    rationale:
      'This is a SERP-observed research shortlist entry; editorial ICP and intent fit have not yet been reviewed.',
  };
}

function redact(value, token) {
  return String(value)
    .replaceAll(token, '[REDACTED]')
    .replace(/apify_api_[A-Za-z0-9_-]+/g, '[REDACTED]')
    .replace(/Authorization:\s*Bearer\s+\S+/gi, 'Authorization: Bearer [REDACTED]');
}

async function apifyRequest(path, token, init = {}) {
  const response = await fetch(`https://api.apify.com/v2${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Apify ${response.status}: ${redact(text, token).slice(0, 1_000)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function startActor(actor, input, token) {
  const actorPath = actor.replace('/', '~');
  const payload = await apifyRequest(`/acts/${actorPath}/runs`, token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return payload.data;
}

async function waitForRun(runId, token) {
  for (;;) {
    const payload = await apifyRequest(`/actor-runs/${runId}`, token);
    const run = payload.data;
    if (run.status === 'SUCCEEDED') return run;
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(run.status)) {
      throw new Error(`Apify run ${runId} ended with ${run.status}`);
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000));
  }
}

async function getRun(runId, token) {
  const payload = await apifyRequest(`/actor-runs/${runId}`, token);
  if (payload.data.status !== 'SUCCEEDED') {
    throw new Error(`Apify run ${runId} is ${payload.data.status}, not SUCCEEDED`);
  }
  return payload.data;
}

async function getDatasetItems(datasetId, token) {
  const payload = await apifyRequest(
    `/datasets/${datasetId}/items?clean=true&format=json&limit=1000`,
    token,
  );
  if (!Array.isArray(payload)) throw new Error(`Dataset ${datasetId} did not return an array`);
  return payload;
}

async function collectAutocomplete(seedQueries, token) {
  const run = await startActor(
    AUTOCOMPLETE_ACTOR,
    {
      keywords: seedQueries,
      language: 'en',
      country: 'us',
      maxDepth: 1,
      maxSuggestionsPerKeyword: 10,
      appendAlphabet: true,
      maxRequestRetries: 3,
    },
    token,
  );
  const completeRun = await waitForRun(run.id, token);
  return { run: completeRun, items: await getDatasetItems(completeRun.defaultDatasetId, token) };
}

async function collectSerps(queries, token) {
  const run = await startActor(
    SERP_ACTOR,
    {
      queries: `${queries.join('\n')}\n`,
      maxPagesPerQuery: 1,
      countryCode: 'us',
      languageCode: 'en',
      searchLanguage: 'en',
      mobileResults: false,
      includeUnfilteredResults: false,
      focusOnPaidAds: false,
      maximumLeadsEnrichmentRecords: 0,
      aiOverview: { scrapeFullAiOverview: false },
      aiModeSearch: { enableAiMode: false },
      geminiSearch: { enableGemini: false },
      perplexitySearch: {
        enablePerplexity: false,
        returnImages: false,
        returnRelatedQuestions: false,
      },
      chatGptSearch: { enableChatGpt: false },
      copilotSearch: { enableCopilot: false },
      websiteContentScraper: { enable: false },
      verifyLeadsEnrichmentEmails: false,
      forceExactMatch: false,
      wordsInTitle: [],
      wordsInText: [],
      wordsInUrl: [],
      saveHtml: false,
      saveHtmlToKeyValueStore: true,
      includeIcons: false,
    },
    token,
  );
  const completeRun = await waitForRun(run.id, token);
  return { run: completeRun, items: await getDatasetItems(completeRun.defaultDatasetId, token) };
}

function observationTimestamp(run) {
  return run.finishedAt ?? run.startedAt;
}

async function readManifest(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return { schemaVersion: 1, campaigns: {} };
    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error('APIFY_TOKEN is required in the process environment');

  const matrixPath = resolve(options.matrix);
  const outPath = resolve(options.out);
  const manifestPath = resolve(options.manifest ?? DEFAULT_MANIFEST);
  const articles = parseResearchMatrix(await readFile(matrixPath, 'utf8'));
  const matrixQueries = uniqueResearchQueries(articles);
  if (matrixQueries.length < 100 || matrixQueries.length > 200) {
    throw new Error(`Expected 100–200 unique matrix queries; found ${matrixQueries.length}`);
  }

  const seedQueries = articles.filter((_, index) => index % 5 === 0).map((article) => article.primary);
  const requestedAutocompleteRunIds = splitOptionList(options['autocomplete-run-id']);
  const autocompleteRuns = requestedAutocompleteRunIds.length
    ? await Promise.all(requestedAutocompleteRunIds.map((runId) => getRun(runId, token)))
    : [(await collectAutocomplete(seedQueries, token)).run];
  const requestedAutocompleteDatasetIds = splitOptionList(options['autocomplete-dataset-id']);
  const autocompleteDatasetIds = resolveVerifiedDatasetIds(
    autocompleteRuns,
    requestedAutocompleteDatasetIds,
    'autocomplete',
  );
  const autocompleteItems = (
    await Promise.all(
      autocompleteDatasetIds.map((datasetId) => getDatasetItems(datasetId, token)),
    )
  ).flat();

  const requestedSerpRunIds = splitOptionList(options['serp-run-id']);
  const serpRuns = requestedSerpRunIds.length
    ? await Promise.all(requestedSerpRunIds.map((runId) => getRun(runId, token)))
    : [(await collectSerps(matrixQueries, token)).run];
  const requestedSerpDatasetIds = splitOptionList(options['serp-dataset-id']);
  const serpDatasetIds = resolveVerifiedDatasetIds(
    serpRuns,
    requestedSerpDatasetIds,
    'SERP',
  );
  const serpEvidenceGroups = await Promise.all(
    serpRuns.map(async (run, index) => {
      const datasetId = serpDatasetIds[index];
      const provenance = {
        actorId: SERP_ACTOR,
        runId: run.id,
        datasetId,
        observedAt: observationTimestamp(run),
      };
      const items = await getDatasetItems(datasetId, token);
      return items.map((item) => normalizeSerpItem(item, provenance));
    }),
  );
  const serpEvidence = [...serpEvidenceGroups.flat()];
  const selected = articles.map((article) => {
    const selection = selectObservedArticleQuery(
      [article.primary, ...article.secondary],
      serpEvidence,
    );
    if (!selection) {
      throw new Error(
        `No article candidate has organic SERP evidence for ${article.articleId}: ${article.primary}`,
      );
    }
    const { evidence } = selection;
    const intentReview = intentReviewForSelection(article.articleId, selection);
    return {
      articleId: article.articleId,
      matrixPrimaryKeyword: article.primary,
      primaryKeyword: selection.selectedKeyword,
      selectionDecision: selection.selectionDecision,
      metricValidation: {
        provider: 'pending',
        volume: null,
        difficulty: null,
        cpc: null,
      },
      intentReview,
      score: rankObservedOpportunity({ ...evidence, intentReview }),
      evidence,
    };
  });

  const output = {
    schemaVersion: 1,
    campaign: options.campaign,
    state: 'serp_observed_research_shortlist',
    locale: { country: 'US', language: 'en', device: 'DESKTOP' },
    matrix: options.matrix,
    candidatePool: {
      matrixQueryCount: matrixQueries.length,
      queries: matrixQueries,
      autocomplete: autocompleteItems.map(normalizeAutocompleteItem),
      autocompleteReview: autocompleteItems.map((item) => ({
        suggestion: item.suggestion,
        status: matrixQueries.some(
          (query) => query.toLocaleLowerCase('en-US') === item.suggestion.toLocaleLowerCase('en-US'),
        )
          ? 'duplicate_of_matrix_candidate'
          : 'not_promoted',
        reason: matrixQueries.some(
          (query) => query.toLocaleLowerCase('en-US') === item.suggestion.toLocaleLowerCase('en-US'),
        )
          ? 'The suggestion is already present in the 200-query matrix pool.'
          : 'The curated matrix already reached the 200-query validation cap; retain this suggestion for the next expansion round.',
      })),
    },
    selection: {
      classification: 'serp_observed_research_shortlist',
      demandValidationStatus: 'pending_authenticated_keyword_provider',
      count: selected.length,
      rationale:
        'Each article keeps its matrix primary only when first-page organic evidence exists. Empty primaries are replaced by the secondary with the densest observed SERP features from the same article specification; this automatic choice does not imply editorial ICP fit. Intent review is recorded separately, and proprietary demand and difficulty metrics remain pending.',
      selected,
      notSelected: matrixQueries
        .filter(
          (query) =>
            !selected.some(
              (article) =>
                article.primaryKeyword.toLocaleLowerCase('en-US')
                === query.toLocaleLowerCase('en-US'),
            ),
        )
        .map((query) => ({
          query,
          reason:
            'Retained as a supporting secondary query; the article primary query carries the canonical evidence chain.',
        })),
    },
    serpEvidence,
  };

  const manifest = await readManifest(manifestPath);
  manifest.updatedAt = new Date().toISOString();
  manifest.campaigns[options.campaign] = {
    autocomplete: {
      actorId: AUTOCOMPLETE_ACTOR,
      country: 'US',
      language: 'en',
      itemCount: autocompleteItems.length,
      runs: autocompleteRuns.map((run, index) => ({
        runId: run.id,
        datasetId: autocompleteDatasetIds[index],
        observedAt: observationTimestamp(run),
      })),
    },
    serp: {
      actorId: SERP_ACTOR,
      country: 'US',
      language: 'en',
      device: 'DESKTOP',
      queryCount: serpEvidence.length,
      runs: serpRuns.map((run, index) => ({
        runId: run.id,
        datasetId: serpDatasetIds[index],
        observedAt: observationTimestamp(run),
      })),
    },
  };

  await mkdir(dirname(outPath), { recursive: true });
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `${JSON.stringify({ campaign: options.campaign, candidates: matrixQueries.length, selected: selected.length, serpEvidence: serpEvidence.length, out: options.out })}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    const token = process.env.APIFY_TOKEN ?? '';
    process.stderr.write(`${redact(error?.stack ?? error, token)}\n`);
    process.exitCode = 1;
  });
}
