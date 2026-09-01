import { describe, expect, it } from 'vitest';
import { normalizeKeywordImport, normalizeSearchConsoleImport } from './provider';

describe('keyword-provider import normalization', () => {
  it('normalizes an observed Semrush row to the provider-neutral contract', () => {
    expect(normalizeKeywordImport({
      provider: 'semrush',
      keyword: 'demo day video checklist',
      country: 'US',
      observed_at: '2026-09-01',
      volume: 90,
      difficulty: 31,
      cpc: 4.2,
      intent: 'informational',
    })).toEqual({
      provider: 'semrush',
      keyword: 'demo day video checklist',
      country: 'US',
      observedAt: '2026-09-01',
      volume: 90,
      difficulty: 31,
      cpc: 4.2,
      intent: 'informational',
      validationStatus: 'validated',
    });
  });

  it('keeps absent optional numeric values null when another observed metric is present', () => {
    expect(normalizeKeywordImport({
      provider: 'ahrefs',
      keyword: 'startup product demo video',
      country: 'US',
      observed_at: '2026-09-01',
      volume: 40,
      intent: 'commercial',
    })).toEqual({
      provider: 'ahrefs',
      keyword: 'startup product demo video',
      country: 'US',
      observedAt: '2026-09-01',
      volume: 40,
      difficulty: null,
      cpc: null,
      intent: 'commercial',
      validationStatus: 'validated',
    });
  });

  it.each([
    ['volume', { volume: -1 }],
    ['cpc', { cpc: -0.01 }],
  ])('rejects a negative %s', (_field, metric) => {
    expect(() => normalizeKeywordImport({
      provider: 'semrush',
      keyword: 'demo day video checklist',
      country: 'US',
      observed_at: '2026-09-01',
      difficulty: 31,
      intent: 'informational',
      ...metric,
    })).toThrow();
  });

  it.each([-0.01, 100.01])('rejects difficulty outside the inclusive 0–100 range', (difficulty) => {
    expect(() => normalizeKeywordImport({
      provider: 'similarweb',
      keyword: 'video repurposing platform',
      country: 'US',
      observed_at: '2026-09-01',
      volume: 20,
      difficulty,
      intent: 'commercial',
    })).toThrow(/difficulty/i);
  });

  it('rejects observations outside the US campaign market', () => {
    expect(() => normalizeKeywordImport({
      provider: 'semrush',
      keyword: 'demo day video checklist',
      country: 'GB',
      observed_at: '2026-09-01',
      volume: 90,
      intent: 'informational',
    })).toThrow(/US/i);
  });

  it('normalizes a pending row only when its date and numeric values are absent', () => {
    expect(normalizeKeywordImport({
      provider: 'pending',
      keyword: 'demo day video checklist',
      country: 'US',
      observed_at: null,
      intent: 'informational',
    })).toEqual({
      provider: 'pending',
      keyword: 'demo day video checklist',
      country: 'US',
      observedAt: null,
      volume: null,
      difficulty: null,
      cpc: null,
      intent: 'informational',
      validationStatus: 'pending_paid_provider',
    });
  });

  it.each([
    ['volume', { volume: 0 }],
    ['difficulty', { difficulty: 0 }],
    ['cpc', { cpc: 0 }],
  ])('rejects pending evidence with a numeric %s, including zero', (_field, metric) => {
    expect(() => normalizeKeywordImport({
      provider: 'pending',
      keyword: 'demo day video checklist',
      country: 'US',
      observed_at: null,
      intent: 'informational',
      ...metric,
    })).toThrow(/pending/i);
  });

  it('rejects pending evidence with an observation date', () => {
    expect(() => normalizeKeywordImport({
      provider: 'pending',
      keyword: 'demo day video checklist',
      country: 'US',
      observed_at: '2026-09-01',
      intent: 'informational',
    })).toThrow(/pending/i);
  });

  it('rejects a named provider without an observation date', () => {
    expect(() => normalizeKeywordImport({
      provider: 'semrush',
      keyword: 'demo day video checklist',
      country: 'US',
      observed_at: null,
      volume: 90,
      intent: 'informational',
    })).toThrow(/observation date/i);
  });

  it('rejects a named provider without any observed numeric metric', () => {
    expect(() => normalizeKeywordImport({
      provider: 'ahrefs',
      keyword: 'demo day video checklist',
      country: 'US',
      observed_at: '2026-09-01',
      intent: 'informational',
    })).toThrow(/at least one observed metric/i);
  });

  it('rejects Google Search Console rows from the proprietary pre-publication adapter', () => {
    expect(() => normalizeKeywordImport({
      provider: 'gsc',
      keyword: 'demo day video checklist',
      country: 'US',
      observed_at: '2026-09-01',
      volume: 90,
      intent: 'informational',
    })).toThrow(/post-publication/i);
  });
});

describe('Google Search Console post-publication normalization', () => {
  it('normalizes only first-party performance fields', () => {
    const observation = normalizeSearchConsoleImport({
      provider: 'gsc',
      keyword: 'demo day video checklist',
      country: 'US',
      observed_at: '2026-09-01',
      clicks: 12,
      impressions: 340,
      ctr: 0.035,
      position: 8.4,
    });

    expect(observation).toEqual({
      provider: 'gsc',
      keyword: 'demo day video checklist',
      country: 'US',
      observedAt: '2026-09-01',
      clicks: 12,
      impressions: 340,
      ctr: 0.035,
      position: 8.4,
      validationStatus: 'observed_post_publication',
    });
    expect(observation).not.toHaveProperty('volume');
    expect(observation).not.toHaveProperty('difficulty');
    expect(observation).not.toHaveProperty('cpc');
  });

  it('rejects proprietary keyword fields in a Search Console row', () => {
    const row = {
      provider: 'gsc',
      keyword: 'demo day video checklist',
      country: 'US',
      observed_at: '2026-09-01',
      clicks: 12,
      impressions: 340,
      ctr: 0.035,
      position: 8.4,
      volume: 90,
    };

    expect(() => normalizeSearchConsoleImport(row)).toThrow();
  });

  it.each([-0.01, 1.01])('rejects CTR outside the inclusive 0–1 range', (ctr) => {
    expect(() => normalizeSearchConsoleImport({
      provider: 'gsc',
      keyword: 'demo day video checklist',
      country: 'US',
      observed_at: '2026-09-01',
      clicks: 12,
      impressions: 340,
      ctr,
      position: 8.4,
    })).toThrow(/ctr/i);
  });
});
