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
    expect(physicalAiGuide.approvalBoundary).toBe(
      'AI can organize approved inputs; a named human owner approves claims, labels, rights, privacy, and release.',
    );
    expect(Object.isFrozen(dreamPilot.publicFacts)).toBe(true);
    expect(Object.isFrozen(physicalAiGuide.sections)).toBe(true);
  });

  it('uses the current official FTC advertising basics reference', () => {
    expect(physicalAiGuide.datedSources).toContainEqual({
      label: 'FTC Advertising and Marketing Basics',
      url: 'https://www.ftc.gov/business-guidance/advertising-marketing/advertising-marketing-basics',
      checkedAt: '2026-09-01',
    });
  });

  it('defines substantive ordered milestones for both activation windows', () => {
    expect(physicalAiGuide.activationClock).toEqual([
      {
        window: '48 hours',
        label: '48 hours before',
        dateTime: 'PT48H',
        action: 'Freeze the approved story, source pack, claim ledger, and final reviewer.',
      },
      {
        window: '48 hours',
        label: '24 hours before',
        dateTime: 'PT24H',
        action: 'Capture the physical action and software record; then verify labels, rights, and privacy.',
      },
      {
        window: '48 hours',
        label: '2 hours before',
        dateTime: 'PT2H',
        action: 'Run the final playback, caption, backup, and release check without adding new claims.',
      },
      {
        window: '14 days',
        label: 'Day 1',
        dateTime: 'P1D',
        action: 'Send the approved core demo to the primary audience with one next step.',
      },
      {
        window: '14 days',
        label: 'Day 7',
        dateTime: 'P7D',
        action: 'Review questions and reuse only the same approved evidence in audience-specific follow-up.',
      },
      {
        window: '14 days',
        label: 'Day 14',
        dateTime: 'P14D',
        action: 'Close the sequence by recording qualified actions, corrections, and evidence gaps.',
      },
    ]);
  });

  it('defines the shared review prompts in display order', () => {
    expect(physicalAiGuide.reviewPrompts).toEqual([
      'What must the audience see to understand the founder decision?',
      'Which approved record verifies the physical action?',
      'What should happen after the demonstration?',
    ]);
  });
});
