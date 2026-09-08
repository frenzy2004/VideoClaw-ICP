import assert from 'node:assert/strict';

import type { Candidate } from '../domain';
import type { HttpRequest, HttpTransport, SourceHttpRequest, SourceHttpTransport } from '../http';
import { AUTOCOMPLETE_ACTOR_ID, SERP_ACTOR_ID } from '../research';

const OBSERVED_AT = '2026-09-05T00:01:00.000Z';
const PUBLIC_PEER = '93.184.216.34';
const escapeHtml = (text: string) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** Only external I/O is replaced. Actor envelopes, normalization, metrics and source checking stay real. */
export function createOfflineNetwork(backlog: Candidate[], sourceFacts: string[]) {
  const byKeyword = new Map(backlog.map((candidate) => [candidate.primaryKeyword, candidate]));
  const allowedSupportQueries = new Set(backlog.flatMap(candidate => [
    `${candidate.primaryKeyword} site:ycombinator.com`, `${candidate.primaryKeyword} site:techstars.com`,
    `${candidate.primaryKeyword} site:techsmith.com/blog/`, `${candidate.primaryKeyword} site:descript.com/blog/article/`,
    `What is ${candidate.primaryKeyword}?`, `How do you plan ${candidate.primaryKeyword}?`, `Why does ${candidate.primaryKeyword} matter?`,
  ]));
  const requests: HttpRequest[] = [];
  const sourceRequests: SourceHttpRequest[] = [];
  const autocompleteKeywords: string[] = [];
  const serpKeywords: string[] = [];
  const supportQueries: string[] = [];
  const metricKeywords: string[] = [];
  const runs = new Map<string, { dataset: string; items: unknown[] }>();
  const pages = new Map<string, { status: number; body: string; location?: string }>();
  const candidateFor = (keyword: string) => {
    const candidate = byKeyword.get(keyword);
    assert.ok(candidate, `Unexpected offline keyword: ${keyword}`);
    return candidate;
  };

  const json: HttpTransport = async (request) => {
    requests.push(request);
    assert.equal(request.signal.aborted, false);
    const url = new URL(request.url);
    const response = (body: unknown) => ({ status: 200, headers: {}, body });
    if (url.origin === 'https://api.semrush.com') {
      assert.equal(request.method, 'GET');
      assert.equal(url.pathname, '/apis/v4/keywords/v1/metrics');
      assert.equal(url.searchParams.get('country'), 'US');
      assert.equal(url.searchParams.get('format'), 'json');
      assert.equal(request.headers.Authorization, 'Apikey offline-semrush');
      const keyword = candidateFor(url.searchParams.get('keyword') ?? '').primaryKeyword;
      metricKeywords.push(keyword);
      const index = Number(keyword.split(' ').at(-1));
      return response({
        meta: { country: 'US', keyword, month: '2026-09', request_id: 'metrics-' + index, success: true },
        data: { search_volume: String((index + 1) * 100), keyword_difficulty: '20', cpc: '125', intents: ['informational'] },
      });
    }
    assert.equal(url.origin, 'https://api.apify.com', 'Offline fixture refuses every unexpected network origin');
    assert.equal(request.headers.Authorization, 'Bearer offline-apify');
    const actor = url.pathname.match(/^\/v2\/acts\/(.+)\/runs$/u)?.[1]?.replace('~', '/');
    if (actor) {
      assert.equal(request.method, 'POST');
      const input = JSON.parse(request.body ?? '{}');
      const id = 'run-' + (runs.size + 1);
      const dataset = 'dataset-' + (runs.size + 1);
      let items: unknown[];
      if (actor === AUTOCOMPLETE_ACTOR_ID) {
        assert.equal(input.country, 'us');
        assert.equal(input.language, 'en');
        assert.equal(input.maxDepth, 1);
        const keywords = input.keywords as string[];
        autocompleteKeywords.push(...keywords);
        items = keywords.map((keyword) => ({
          keyword: candidateFor(keyword).primaryKeyword, suggestion: keyword + ' checklist',
          parentKeyword: keyword, depth: 0, country: 'US', language: 'en', scrapedAt: OBSERVED_AT,
        }));
      } else {
        assert.equal(actor, SERP_ACTOR_ID);
        assert.equal(input.countryCode, 'us');
        assert.equal(input.languageCode, 'en');
        assert.equal(input.mobileResults, false);
        assert.equal(input.maxPagesPerQuery, 1);
        const keywords = (input.queries as string).trim().split('\n');
        items = keywords.map((keyword) => {
          if (allowedSupportQueries.has(keyword)) {
            supportQueries.push(keyword);
            return { searchQuery: { term: keyword, countryCode: 'US', languageCode: 'en', device: 'DESKTOP', page: 1 },
              organicResults: [], peopleAlsoAsk: [], relatedQueries: [] };
          }
          const candidate = candidateFor(keyword);
          serpKeywords.push(keyword);
          const organicResults = Array.from({ length: 10 }, (_, index) => {
            const hostname = index % 2 === 0 ? 'primary.example' : 'secondary.example';
            const finalUrl = 'https://' + hostname + '/guides/' + candidate.slug + '/' + index;
            const url = index === 0 ? finalUrl.replace(/\/0$/u, '/redirect') : finalUrl;
            // Search metadata deliberately contains none of the fact catalog. A
            // regression to snippets cannot satisfy the drafting fixture below.
            const title = `Founder video reference ${index + 1}`;
            const description = 'Search summary for a founder video planning reference.';
            const split = Math.ceil(sourceFacts.length / 2);
            // These numbered workflows are synthetic test topics, not live
            // source observations. Give each body substantive topic support;
            // a matching search title or generic recording advice is insufficient.
            const workflow = candidate.primaryKeyword.split(' ').at(-1);
            const topic = `Workflow ${workflow} for a founder product demo video starts with choosing the intended viewer and verifying the claims shown on screen.`;
            // Independently authored synthetic FAQ body evidence, not search
            // snippets or facts injected by the worker/context builder.
            const faqBodies = [
              `${candidate.primaryKeyword} is a sequence for preparing and checking a founder product recording.`,
              `Plan ${candidate.primaryKeyword} by choosing the viewer and preparing the example before recording.`,
              `${candidate.primaryKeyword} helps a team review the complete recording before sharing it.`,
            ];
            const paragraphs = index < 2 ? [topic, ...faqBodies, ...sourceFacts.slice(index * split, (index + 1) * split)]
              : [`Workflow ${workflow} for a founder product demo video includes reviewing the completed recording before distribution.`];
            // Each catalog entry is an independent topic, not a qualification of
            // its neighbor. Make those boundaries explicit in the source HTML.
            pages.set(finalUrl, { status: 200, body: '<article><h1>Founder video preparation</h1>'
              + paragraphs.map((text) => '<section><p>' + escapeHtml(text) + '</p></section>').join('') + '</article>' });
            if (url !== finalUrl) pages.set(url, { status: 302, body: '', location: finalUrl });
            return { position: index + 1, url, title, description };
          });
          return {
            searchQuery: { term: keyword, countryCode: 'US', languageCode: 'en', device: 'DESKTOP', page: 1 },
            organicResults,
            peopleAlsoAsk: [
              { question: 'What is ' + keyword + '?' },
              { question: 'How do you plan ' + keyword + '?' },
              { question: 'Why does ' + keyword + ' matter?' },
            ],
            relatedQueries: [{ title: keyword + ' template' }],
          };
        });
      }
      runs.set(id, { dataset, items });
      return response({ data: { id, status: 'RUNNING', defaultDatasetId: dataset, startedAt: OBSERVED_AT } });
    }
    assert.equal(request.method, 'GET');
    const runId = url.pathname.match(/^\/v2\/actor-runs\/(.+)$/u)?.[1];
    if (runId) {
      const run = runs.get(runId);
      assert.ok(run);
      return response({ data: { id: runId, status: 'SUCCEEDED', defaultDatasetId: run.dataset, startedAt: OBSERVED_AT, finishedAt: OBSERVED_AT } });
    }
    const dataset = url.pathname.match(/^\/v2\/datasets\/(.+)\/items$/u)?.[1];
    assert.equal(url.searchParams.get('clean'), 'true');
    assert.equal(url.searchParams.get('format'), 'json');
    const run = [...runs.values()].find((entry) => entry.dataset === dataset);
    assert.ok(run, 'Unexpected offline Apify endpoint: ' + url.pathname);
    return response(run.items);
  };

  const resolveHostname = async (hostname: string) => {
    assert.ok(['primary.example', 'secondary.example'].includes(hostname));
    return [PUBLIC_PEER];
  };
  const source: SourceHttpTransport = async (request) => {
    sourceRequests.push(request);
    assert.equal(request.method, 'GET');
    assert.equal(request.redirect, 'manual');
    assert.deepEqual(request.allowedPeerAddresses, [PUBLIC_PEER]);
    assert.ok(request.maxResponseBytes > 0);
    assert.equal(request.signal.aborted, false);
    const page = pages.get(request.url);
    assert.ok(page, 'Unexpected offline source: ' + request.url);
    return {
      status: page.status,
      headers: { 'content-type': 'text/html', ...(page.location ? { location: page.location } : {}) },
      url: request.url,
      redirected: false,
      peerAddress: PUBLIC_PEER,
      body: (async function* () {
        const bytes = Buffer.from(page.body);
        yield bytes.subarray(0, Math.floor(bytes.length / 2));
        yield bytes.subarray(Math.floor(bytes.length / 2));
      })(),
    };
  };
  return { json, source, resolveHostname, requests, sourceRequests, autocompleteKeywords, serpKeywords, supportQueries, metricKeywords };
}
