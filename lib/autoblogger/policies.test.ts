import { describe, expect, it } from 'vitest';
import {
  CandidateSchema,
  EvidenceBundleSchema,
  KeywordMetricsSchema,
  candidateFingerprints,
  type Candidate,
} from './domain';
import {
  RUN_LIMITS,
  evaluateEligibility,
  limitCandidatesForScan,
  limitDeepInspections,
  screenDuplicate,
  selectOpportunities,
} from './policies';

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return CandidateSchema.parse({
    schemaVersion: 1,
    articleId: 'vc-c2-001',
    campaignId: 'accelerator-demo-day-founder',
    icp: 'accelerator founders',
    primaryKeyword: 'Demo Day video planning checklist',
    secondaryKeywords: ['startup Demo Day video plan'],
    title: 'The Evergreen Demo Day Video Planning Checklist',
    slug: 'demo-day-video-checklist',
    intent: 'informational',
    funnelStage: 'top',
    ...overrides,
  });
}

describe('duplicate screening', () => {
  it.each([
    ['backlog', { backlog: [candidate()] }],
    ['state', { stateCandidateFingerprints: [candidateFingerprints(candidate()).candidate] }],
    ['lander', { landerInventory: [{ slug: 'demo-day-video-checklist' }] }],
    ['open_pull_request', { openPullRequestInventory: [{ title: 'The Evergreen Demo Day Video Planning Checklist' }] }],
  ])('rejects a matching candidate already in %s', (origin, inventory) => {
    expect(screenDuplicate(candidate(), inventory)).toEqual({
      accepted: false,
      reason: `duplicate_${origin}`,
    });
  });
});

const completeEvidence = () => EvidenceBundleSchema.parse({
  schemaVersion: 1,
  candidateFingerprint: candidateFingerprints(candidate()).candidate,
  suggestions: ['Demo Day video planning checklist'],
  serp: {
    organicResultCount: 4,
    peopleAlsoAsk: [
      'What should a Demo Day video include?',
      'How long should a Demo Day video be?',
      'How do you prepare for Demo Day?',
    ],
  },
  sources: [
    { url: 'https://www.ycombinator.com/demoday', authoritative: true },
    { url: 'https://www.w3.org/WAI/media/av/', authoritative: true },
  ],
  faqQuestions: [
    'What should a Demo Day video include?',
    'How long should a Demo Day video be?',
    'How do you prepare for Demo Day?',
  ],
});

const observedMetrics = () => KeywordMetricsSchema.parse({
  schemaVersion: 1,
  provider: 'semrush',
  observedAt: '2026-09-04T00:00:00.000Z',
  volume: 90,
  difficulty: 31,
  cpc: 4.2,
  intent: 'informational',
});

describe('eligibility gates', () => {
  it.each([
    ['suggestions', { suggestions: [] }, 'missing_suggestions'],
    ['SERP', { serp: { organicResultCount: 0, peopleAlsoAsk: [] } }, 'missing_serp'],
    ['People Also Ask signals', { serp: { organicResultCount: 4, peopleAlsoAsk: ['What should a Demo Day video include?'] } }, 'missing_paa'],
    ['sources', { sources: [{ url: 'https://www.ycombinator.com/demoday', authoritative: true }] }, 'missing_sources'],
    ['authoritative source', { sources: [
      { url: 'https://example.com/one', authoritative: false },
      { url: 'https://example.com/two', authoritative: false },
    ] }, 'missing_authoritative_source'],
    ['FAQ signals', { faqQuestions: ['What should a Demo Day video include?'] }, 'missing_faqs'],
  ])('rejects evidence missing %s', (_signal, mutation, reason) => {
    const evidence = EvidenceBundleSchema.parse({ ...completeEvidence(), ...mutation });
    expect(evaluateEligibility(candidate(), evidence, observedMetrics(), 'scheduled')).toEqual({
      eligible: false,
      reasons: [reason],
    });
  });

  it('allows pending metrics only in a manual pilot', () => {
    const pending = KeywordMetricsSchema.parse({
      schemaVersion: 1,
      provider: 'pending',
      observedAt: null,
      volume: null,
      difficulty: null,
      cpc: null,
      intent: 'informational',
    });

    expect(evaluateEligibility(candidate(), completeEvidence(), pending, 'manual_pilot')).toEqual({ eligible: true, reasons: [] });
    expect(evaluateEligibility(candidate(), completeEvidence(), pending, 'scheduled')).toEqual({
      eligible: false,
      reasons: ['scheduled_requires_observed_volume_and_difficulty'],
    });
  });

  it('rejects a named provider with incomplete scheduled metrics', () => {
    const incomplete = KeywordMetricsSchema.parse({ ...observedMetrics(), difficulty: null });

    expect(evaluateEligibility(candidate(), completeEvidence(), incomplete, 'scheduled')).toEqual({
      eligible: false,
      reasons: ['scheduled_requires_observed_volume_and_difficulty'],
    });
  });
});

describe('bounded deterministic selection', () => {
  it('ranks eligible candidates, limits one ICP to two, selects only three, and allows a one-artifact manual pilot', () => {
    const opportunity = (articleId: string, campaignId: Candidate['campaignId'], icp: string, volume: number) => ({
      candidate: candidate({
        articleId,
        campaignId,
        icp,
        primaryKeyword: `keyword ${articleId}`,
        title: `Title ${articleId}`,
        slug: `slug-${articleId.toLowerCase()}`,
      }),
      evidence: completeEvidence(),
      metrics: KeywordMetricsSchema.parse({ ...observedMetrics(), volume }),
    });

    const opportunities = [
      opportunity('vc-c2-001', 'accelerator-demo-day-founder', 'founders', 100),
      opportunity('vc-c2-002', 'accelerator-demo-day-founder', 'founders', 90),
      opportunity('vc-c2-003', 'accelerator-demo-day-founder', 'founders', 200),
      opportunity('vc-c3-001', 'video-production-comparison', 'operators', 80),
      opportunity('vc-c3-002', 'video-production-comparison', 'operators', 70),
    ];

    expect(selectOpportunities(opportunities, 'scheduled').map(({ candidate: selected }) => selected.articleId)).toEqual([
      'vc-c2-003',
      'vc-c2-001',
      'vc-c3-001',
    ]);
    expect(selectOpportunities(opportunities, 'manual_pilot').map(({ candidate: selected }) => selected.articleId)).toEqual([
      'vc-c2-003',
    ]);
    expect(limitCandidatesForScan(opportunities)).toHaveLength(5);
    expect(limitCandidatesForScan([...opportunities, ...opportunities, ...opportunities, ...opportunities, ...opportunities,
      ...opportunities, ...opportunities, ...opportunities, ...opportunities, ...opportunities, ...opportunities])).toHaveLength(RUN_LIMITS.maxCandidatesScanned);
    expect(limitDeepInspections(opportunities.concat(opportunities, opportunities))).toHaveLength(RUN_LIMITS.maxDeepInspections);
  });

  it('breaks equal scores by canonical candidate fingerprint rather than input order', () => {
    const first = {
      candidate: candidate({ articleId: 'vc-c2-010', primaryKeyword: 'alpha keyword', title: 'Alpha title', slug: 'alpha-title' }),
      evidence: completeEvidence(),
      metrics: observedMetrics(),
    };
    const second = {
      candidate: candidate({ articleId: 'vc-c2-011', primaryKeyword: 'beta keyword', title: 'Beta title', slug: 'beta-title' }),
      evidence: completeEvidence(),
      metrics: observedMetrics(),
    };

    expect(selectOpportunities([second, first], 'scheduled').map(({ candidate: selected }) => selected.articleId)).toEqual([
      'vc-c2-010',
      'vc-c2-011',
    ]);
  });
});
