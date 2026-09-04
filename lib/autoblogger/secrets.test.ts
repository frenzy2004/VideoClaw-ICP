import { describe, expect, it } from 'vitest';

import { containsSecretLikeValue, redactSensitive } from './secrets';

describe('centralized secret handling', () => {
  it.each([
    'apify_api_synthetic_fixture_123456',
    'github_pat_synthetic_fixture_123456',
    'sk-proj-syntheticfixture1234567890',
    'ghp_syntheticfixture1234567890',
    'AKIAABCDEFGHIJKLMNOP',
    'API_KEY=syntheticfixture123456',
    'Bearer syntheticfixture123456',
  ])('detects and redacts a synthetic credential form', (secret) => {
    expect(containsSecretLikeValue({ nested: `prefix ${secret} suffix` })).toBe(true);
    expect(redactSensitive(new Error(`failure ${secret}`))).not.toContain(secret);
  });
});
