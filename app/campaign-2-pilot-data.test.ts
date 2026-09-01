import { describe, expect, it } from 'vitest';
import {
  DREAM_PILOT_PATH,
  PHYSICAL_AI_GUIDE_PATH,
  dreamPilot,
  physicalAiGuide,
  privateRobots,
} from './campaign-2-pilot-data';

describe('Campaign 2 pilot data contracts', () => {
  it('keeps both review routes and their metadata permanently private', () => {
    expect(DREAM_PILOT_PATH).toBe('/pilots/dream-demo-day');
    expect(PHYSICAL_AI_GUIDE_PATH).toBe('/guides/physical-ai-product-demo-before-demo-day');
    expect(privateRobots()).toEqual({ index: false, follow: false });
  });

  it('keeps every public account fact dated, sourced, and claim-bounded', () => {
    expect(dreamPilot.publicFacts.length).toBeGreaterThan(0);

    for (const fact of dreamPilot.publicFacts) {
      expect(fact).toMatchObject({
        sourceUrl: expect.stringMatching(/^https:\/\//),
        checkedAt: '2026-09-01',
        safeUse: expect.any(String),
        notSupported: expect.any(String),
      });
    }
  });

  it('keeps approved claims disjoint from prohibited claims', () => {
    const approvedClaims = dreamPilot.claimLedger
      .filter((claim) => claim.state === 'approved')
      .map((claim) => claim.copy);
    const prohibitedClaims = new Set<string>(
      dreamPilot.claimLedger
        .filter((claim) => claim.state === 'prohibited')
        .map((claim) => claim.copy),
    );
    const overlappingClaims = approvedClaims.filter((claim) => prohibitedClaims.has(claim));

    expect(overlappingClaims).toEqual([]);
  });

  it('provides immutable templates for the private dossier and generic guide', () => {
    expect(dreamPilot.storyboard).toHaveLength(7);
    expect(dreamPilot.sourcePackFields.length).toBeGreaterThan(0);
    expect(dreamPilot.searchTerms.length).toBeGreaterThan(0);
    expect(dreamPilot.answerPrompts.length).toBeGreaterThan(0);
    expect(physicalAiGuide.sections.length).toBeGreaterThan(0);
    expect(Object.isFrozen(dreamPilot.publicFacts)).toBe(true);
    expect(Object.isFrozen(physicalAiGuide.sections)).toBe(true);
  });
});
