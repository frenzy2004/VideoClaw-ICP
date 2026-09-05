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

const completeEvidence = (forCandidate = candidate()) => EvidenceBundleSchema.parse({
  schemaVersion: 2,
  candidateFingerprint: candidateFingerprints(forCandidate).candidate,
  signals: { autocomplete: ['Demo Day video planning checklist'], peopleAlsoAsk: [], relatedSearches: [] },
  serp: {
    organicResultCount: 4,
    peopleAlsoAsk: [
      'What should a Demo Day video include?',
      'How long should a Demo Day video be?',
      'How do you prepare for Demo Day?',
    ],
  },
  sources: [
    { originalUrl: 'https://www.ycombinator.com/demoday', finalUrl: 'https://www.ycombinator.com/demoday', authoritative: true },
    { originalUrl: 'https://www.w3.org/WAI/media/av/', finalUrl: 'https://www.w3.org/WAI/media/av/', authoritative: true },
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
    ['suggestions', { signals: { autocomplete: [], peopleAlsoAsk: [], relatedSearches: [] } }, 'missing_suggestion_signal'],
    ['SERP', { serp: { organicResultCount: 0, peopleAlsoAsk: [] } }, 'missing_serp'],
    ['People Also Ask signals', { serp: { organicResultCount: 4, peopleAlsoAsk: ['What should a Demo Day video include?'] } }, 'missing_paa'],
    ['sources', { sources: [{ originalUrl: 'https://www.ycombinator.com/demoday', finalUrl: 'https://www.ycombinator.com/demoday', authoritative: true }] }, 'missing_sources'],
    ['authoritative source', { sources: [
      { originalUrl: 'https://example.com/one', finalUrl: 'https://example.com/one', authoritative: false },
      { originalUrl: 'https://example.com/two', finalUrl: 'https://example.com/two', authoritative: false },
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

  it('rejects evidence bound to a different candidate fingerprint', () => {
    const otherCandidate = candidate({
      articleId: 'vc-c2-002',
      primaryKeyword: 'Demo Day video mistakes',
      title: 'Demo Day Video Mistakes',
      slug: 'demo-day-video-mistakes',
    });

    expect(evaluateEligibility(candidate(), completeEvidence(otherCandidate), observedMetrics(), 'scheduled')).toEqual({
      eligible: false,
      reasons: ['evidence_candidate_mismatch'],
    });
  });
});

describe('bounded deterministic selection', () => {
  it('ranks eligible candidates, limits one ICP to two, selects only three, and allows a one-artifact manual pilot', () => {
    const opportunity = (articleId: string, campaignId: Candidate['campaignId'], icp: string, volume: number) => {
      const selectedCandidate = candidate({
        articleId,
        campaignId,
        icp,
        primaryKeyword: campaignId === 'video-production-comparison' ? `video agency comparison ${articleId}` : `demo day pitch video ${articleId}`,
        title: campaignId === 'video-production-comparison' ? `Video Agency Comparison ${articleId}` : `Demo Day Pitch Video ${articleId}`,
        slug: `slug-${articleId.toLowerCase()}`,
      });
      return {
        candidate: selectedCandidate,
        evidence: completeEvidence(selectedCandidate),
        metrics: KeywordMetricsSchema.parse({ ...observedMetrics(), volume }),
      };
    };

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
    const firstCandidate = candidate({ articleId: 'vc-c2-010', primaryKeyword: 'demo day pitch video alpha', title: 'Demo Day Pitch Video Alpha', slug: 'alpha-title' });
    const first = {
      candidate: firstCandidate,
      evidence: completeEvidence(firstCandidate),
      metrics: observedMetrics(),
    };
    const secondCandidate = candidate({ articleId: 'vc-c2-011', primaryKeyword: 'demo day pitch video beta', title: 'Demo Day Pitch Video Beta', slug: 'beta-title' });
    const second = {
      candidate: secondCandidate,
      evidence: completeEvidence(secondCandidate),
      metrics: observedMetrics(),
    };

    expect(selectOpportunities([second, first], 'scheduled').map(({ candidate: selected }) => selected.articleId)).toEqual([
      'vc-c2-010',
      'vc-c2-011',
    ]);
  });

  it('does not evaluate or select deep evidence beyond the first ten staged candidates', () => {
    const opportunities = Array.from({ length: 11 }, (_unused, index) => {
      const articleId = `vc-c2-${String(index + 1).padStart(3, '0')}`;
      const selectedCandidate = candidate({
        articleId,
        icp: `icp-${articleId}`,
        primaryKeyword: `demo day pitch video ${articleId}`,
        title: `Demo Day Pitch Video ${articleId}`,
        slug: `slug-${articleId.toLowerCase()}`,
      });
      return {
        candidate: selectedCandidate,
        evidence: completeEvidence(selectedCandidate),
        metrics: KeywordMetricsSchema.parse({ ...observedMetrics(), volume: index === 10 ? 1_000 : index }),
      };
    });

    expect(selectOpportunities(opportunities, 'scheduled').map(({ candidate: selected }) => selected.articleId)).toEqual([
      'vc-c2-010',
      'vc-c2-009',
      'vc-c2-008',
    ]);
  });
});
