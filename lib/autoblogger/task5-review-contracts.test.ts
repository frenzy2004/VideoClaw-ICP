import { describe, expect, it } from 'vitest';

import { candidateFingerprints, CandidateSchema } from './domain';
import { evaluateEligibility } from './policies';
import { runApifyActor, SERP_ACTOR_ID } from './research';
import { createSafeSourceChecker } from './sources';
import type { ApifyClient } from './apify-client';
import type { SourceHttpTransport } from './http';

const candidate = CandidateSchema.parse({
  schemaVersion: 1,
  articleId: 'vc-c1-001',
  campaignId: 'newly-funded-founder',
  icp: 'newly funded founder preparing launch media',
  primaryKeyword: 'founder launch video plan',
  secondaryKeywords: [],
  title: 'Founder Launch Video Plan',
  slug: 'founder-launch-video-plan',
  intent: 'informational',
  funnelStage: 'top',
});

describe('Task 5 review contracts', () => {
  it('includes article and distinct intent identities', () => {
    const identities = candidateFingerprints(candidate);
    expect(identities.articleId).toBe('article:vc-c1-001');
    expect(identities.intent).toMatch(/^intent:[0-9a-f]{64}$/u);
    expect(identities.intent).not.toBe(identities.candidate);
  });

  it('accepts collision-resistant discovered IDs while retaining legacy matrix IDs', () => {
    expect(CandidateSchema.safeParse({
      ...candidate,
      articleId: 'vc-c1-d-0123456789abcdef',
    }).success).toBe(true);
    expect(CandidateSchema.safeParse({ ...candidate, articleId: 'vc-c1-123' }).success).toBe(true);
    expect(CandidateSchema.safeParse({ ...candidate, articleId: 'vc-c1-d-123' }).success).toBe(false);
  });

  it('requires HTTPS for both initial and redirected source URLs', async () => {
    const transport: SourceHttpTransport = async () => {
      throw new Error('transport must not be reached');
    };
    const checker = createSafeSourceChecker({
      transport,
      resolveHostname: async () => ['203.0.113.10'],
      authorityPolicies: [{ hostname: 'authority.example', pathPrefix: '/docs/' }],
    });
    await expect(checker.check('http://authority.example/docs/a')).rejects.toThrow(/https/i);
  });

  it('uses exact host and path authority policies, never parent-domain suffixes', async () => {
    const transport: SourceHttpTransport = async (request) => ({
      status: 200,
      headers: {},
      body: { async *[Symbol.asyncIterator]() { yield new Uint8Array(); } },
      redirected: false,
      url: request.url,
      peerAddress: request.allowedPeerAddresses[0],
    });
    const checker = createSafeSourceChecker({
      transport,
      resolveHostname: async () => ['203.0.113.10'],
      authorityPolicies: [
        { hostname: 'developers.google.com', pathPrefix: '/search/' },
        { hostname: 'www.videoclaw.com' },
      ],
    });
    await expect(checker.check('https://developers.google.com/search/docs')).resolves.toMatchObject({ authoritative: true });
    await expect(checker.check('https://developers.google.com/maps')).resolves.toMatchObject({ authoritative: false });
    await expect(checker.check('https://evil.google.com/search/docs')).resolves.toMatchObject({ authoritative: false });
    await expect(checker.check('https://videoclaw.com/')).resolves.toMatchObject({ authoritative: false });
  });

  it('allows any explicit suggestion signal while preserving original and final source identity', () => {
    const evidence = {
      schemaVersion: 2 as const,
      candidateFingerprint: candidateFingerprints(candidate).candidate,
      signals: {
        autocomplete: [],
        peopleAlsoAsk: ['How should a founder plan a launch video?'],
        relatedSearches: [],
      },
      serp: { organicResultCount: 2, peopleAlsoAsk: ['q1', 'q2', 'q3'] },
      sources: [
        { originalUrl: 'https://example.com/old', finalUrl: 'https://example.com/new', authoritative: false },
        { originalUrl: 'https://authority.example/docs/a', finalUrl: 'https://authority.example/docs/a', authoritative: true },
      ],
      faqQuestions: ['q1', 'q2', 'q3'],
    };
    const metrics = {
      schemaVersion: 1 as const,
      provider: 'pending' as const,
      observedAt: null,
      volume: null,
      difficulty: null,
      cpc: null,
      intent: 'informational' as const,
    };
    expect(evaluateEligibility(candidate, evidence, metrics, 'manual_pilot')).toEqual({ eligible: true, reasons: [] });
  });

  it('best-effort aborts a started Apify run on failure but not after success', async () => {
    const aborted: string[] = [];
    const failing: ApifyClient = {
      startActor: async () => ({ id: 'run-fail', status: 'RUNNING' }),
      getRun: async () => ({ id: 'run-fail', status: 'FAILED' }),
      getDatasetItems: async () => [],
      abortRun: async (runId) => { aborted.push(runId); return { id: runId, status: 'ABORTING' }; },
    };
    await expect(runApifyActor(failing, SERP_ACTOR_ID, {}, {
      pollIntervalMs: 0,
      maxAttempts: 1,
      sleep: async () => undefined,
    })).rejects.toThrow(/failed/i);
    expect(aborted).toEqual(['run-fail']);

    const successful: ApifyClient = {
      ...failing,
      startActor: async () => ({
        id: 'run-ok', status: 'SUCCEEDED', defaultDatasetId: 'dataset-ok', finishedAt: '2026-09-04T08:01:00.000Z',
      }),
      abortRun: async (runId) => { aborted.push(runId); return { id: runId, status: 'ABORTING' }; },
    };
    await runApifyActor(successful, SERP_ACTOR_ID, {});
    expect(aborted).toEqual(['run-fail']);
  });
});
