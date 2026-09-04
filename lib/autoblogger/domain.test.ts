import { describe, expect, it } from 'vitest';
import {
  CandidateSchema,
  DraftBundleSchema,
  EvidenceBundleSchema,
  KeywordMetricsSchema,
  RunRecordSchema,
  candidateFingerprints,
  normalizeIntent,
  normalizeKeyword,
  normalizeSlug,
  normalizeTitle,
} from './domain';

describe('autoblogger canonical identities', () => {
  it('collapses case, punctuation, whitespace, and diacritics into stable identities', () => {
    expect(normalizeKeyword('  Démo-Day: Video   Plan  ')).toBe('demo day video plan');
    expect(normalizeTitle('Démo-Day: Video Plan!')).toBe('demo day video plan');
    expect(normalizeSlug(' Démo Day: Vídeo Plan! ')).toBe('demo-day-video-plan');
    expect(normalizeIntent('Informational — direct answer')).toBe('informational');

    expect(candidateFingerprints({
      campaignId: 'accelerator-demo-day-founder',
      primaryKeyword: 'Demo Day Video Plan',
      title: 'Demo Day: Video Plan',
      slug: 'demo-day-video-plan',
      intent: 'informational',
    })).toEqual({
      keyword: 'keyword:demo day video plan',
      title: 'title:demo day video plan',
      slug: 'slug:demo-day-video-plan',
      candidate: 'candidate:accelerator-demo-day-founder:demo day video plan',
    });
  });
});

describe('versioned autoblogger contracts', () => {
  it('keeps candidate, evidence, metrics, draft, and run contracts versioned without validating publication fields', () => {
    const candidate = CandidateSchema.parse({
      schemaVersion: 1,
      articleId: 'vc-c2-001',
      campaignId: 'accelerator-demo-day-founder',
      icp: 'accelerator founder',
      primaryKeyword: 'Demo Day video planning checklist',
      secondaryKeywords: ['startup Demo Day video plan'],
      title: 'The Evergreen Demo Day Video Planning Checklist',
      slug: 'demo-day-video-checklist',
      intent: 'informational',
      funnelStage: 'top',
    });
    const evidence = EvidenceBundleSchema.parse({
      schemaVersion: 1,
      candidateFingerprint: 'candidate:accelerator-demo-day-founder:demo day video planning checklist',
      suggestions: ['Demo Day video planning checklist'],
      serp: { organicResultCount: 4, peopleAlsoAsk: ['What should a Demo Day video include?'] },
      sources: [{ url: 'https://www.ycombinator.com/demoday', authoritative: true }],
      faqQuestions: ['What should a Demo Day video include?'],
    });
    const metrics = KeywordMetricsSchema.parse({
      schemaVersion: 1,
      provider: 'pending',
      observedAt: null,
      volume: null,
      difficulty: null,
      cpc: null,
      intent: 'informational',
    });
    const draft = DraftBundleSchema.parse({
      schemaVersion: 1,
      candidateFingerprint: evidence.candidateFingerprint,
      article: { title: candidate.title, slug: candidate.slug, unexpectedLanderField: true },
      markdown: '# Draft',
      svg: null,
    });
    const run = RunRecordSchema.parse({
      schemaVersion: 1,
      runId: 'run-2026-09-04-a',
      mode: 'manual_pilot',
      startedAt: '2026-09-04T00:00:00.000Z',
      selectedCandidateFingerprints: [evidence.candidateFingerprint],
      status: 'selected',
    });

    expect(candidate.primaryKeyword).toBe('Demo Day video planning checklist');
    expect(candidate.icp).toBe('accelerator founder');
    expect(metrics.provider).toBe('pending');
    expect(draft.article).toHaveProperty('unexpectedLanderField', true);
    expect(run.selectedCandidateFingerprints).toHaveLength(1);
  });
});
