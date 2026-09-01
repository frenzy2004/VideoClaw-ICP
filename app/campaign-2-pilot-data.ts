import type { Metadata } from 'next';
import { CAMPAIGN_URLS } from './campaign-content';

export const DREAM_PILOT_PATH = CAMPAIGN_URLS.dreamPilotPath;
export const PHYSICAL_AI_GUIDE_PATH = CAMPAIGN_URLS.physicalAiGuidePath;

type PublicFact = Readonly<{
  label: string;
  copy: string;
  sourceUrl: string;
  checkedAt: '2026-09-01';
  safeUse: string;
  notSupported: string;
}>;

type SourcePackField = Readonly<{
  id: string;
  label: string;
  requirement: string;
}>;

type ClaimState = 'approved' | 'conditional' | 'prohibited';

type ClaimLedgerEntry = Readonly<{
  state: ClaimState;
  copy: string;
  condition?: string;
}>;

type StoryboardBeat = Readonly<{
  id: string;
  title: string;
  purpose: string;
}>;

type MeasurementDefinition = Readonly<{
  metric: string;
  evidence: string;
  owner: string;
}>;

const dreamPublicSourceUrl = 'https://www.ycombinator.com/companies/dream';

const sourcePackFields = Object.freeze([
  {
    id: 'rights',
    label: 'Rights and permissions',
    requirement: 'Record the owner, permitted use, scope, and expiry for every asset.',
  },
  {
    id: 'provenance',
    label: 'Source provenance',
    requirement: 'Keep the direct source URL, capture date, and reviewer with each public fact.',
  },
  {
    id: 'prototype',
    label: 'Prototype status',
    requirement: 'Label every simulated, staged, or prototype behavior before approval.',
  },
  {
    id: 'privacy',
    label: 'Privacy controls',
    requirement: 'Remove people, identifiers, and screen data that are not approved for use.',
  },
] as const satisfies readonly SourcePackField[]);

const measurementDefinitions = Object.freeze([
  { metric: 'Source-pack completion', evidence: 'Approved field checklist', owner: 'Production owner' },
  { metric: 'Claim review coverage', evidence: 'Claim ledger decision', owner: 'Editorial owner' },
  { metric: 'Evidence readiness', evidence: 'Approved proof attached to each beat', owner: 'Reviewer' },
] as const satisfies readonly MeasurementDefinition[]);

export const dreamPilot = Object.freeze({
  notice: 'PRIVATE ACCOUNT DOSSIER · NOINDEX · NON-AFFILIATED',
  selectionRationale: Object.freeze([
    'The public company profile describes a physical-world computer-vision workflow suitable for a source-controlled Demo Day qualification exercise.',
    'This dossier is internal planning material only and does not represent outreach, participation, or authorization by Dream.',
  ]),
  campaignJob: 'Review whether a source-controlled physical-AI product-demo method can be authorized without representing Dream product behavior.',
  exclusions: Object.freeze([
    'No Dream logos, founder images, launch-video embeds, copied screenshots, or contact details.',
    'No generated Dream product behavior, customer claim, case study, endorsement, partnership, or participation claim.',
  ]),
  qualificationGate: 'Authorize production only when every proposed statement is approved in the claim ledger and every visual has documented rights and provenance.',
  publicFacts: Object.freeze([
    {
      label: 'Product category',
      copy: 'Dream publicly describes pocket-sized, battery-powered AI cameras for automatically capturing assets and identifying damage.',
      sourceUrl: dreamPublicSourceUrl,
      checkedAt: '2026-09-01',
      safeUse: 'Use as dated public qualification context for the company’s stated product category.',
      notSupported: 'It does not support a claim about VideoClaw, campaign participation, product performance, customers, or a commercial relationship.',
    },
    {
      label: 'Market context',
      copy: 'Dream’s public profile identifies hardware, machine learning, computer vision, and B2B as its categories.',
      sourceUrl: dreamPublicSourceUrl,
      checkedAt: '2026-09-01',
      safeUse: 'Use only to frame a generic physical-AI and computer-vision review scenario.',
      notSupported: 'It does not support a claim that Dream approved, reviewed, endorsed, or will use this campaign.',
    },
  ] as const satisfies readonly PublicFact[]),
  sourcePackFields,
  claimLedger: Object.freeze([
    {
      state: 'approved',
      copy: 'Describe this page as an internal VideoClaw planning dossier using dated public sources.',
    },
    {
      state: 'approved',
      copy: 'Use the generic VideoClaw campaign method only as a non-Dream illustration.',
    },
    {
      state: 'conditional',
      copy: 'Use a public company fact beside its direct source link and checked date.',
      condition: 'The rendered copy must retain the fact’s safe-use and not-supported boundary.',
    },
    {
      state: 'prohibited',
      copy: 'Dream is a VideoClaw customer, participant, partner, or endorser.',
    },
    {
      state: 'prohibited',
      copy: 'A VideoClaw illustration is Dream footage, a Dream product demonstration, or evidence of Dream participation.',
    },
  ] as const satisfies readonly ClaimLedgerEntry[]),
  storyboard: Object.freeze([
    { id: 'qualification', title: 'Qualification frame', purpose: 'State the internal, non-affiliated review boundary.' },
    { id: 'job', title: 'Campaign job', purpose: 'Name the physical action and decision the story must clarify.' },
    { id: 'evidence', title: 'Approved evidence', purpose: 'Show only source-pack-approved generic evidence.' },
    { id: 'record', title: 'Software record', purpose: 'Connect the physical action to an accurately labeled record.' },
    { id: 'controls', title: 'Control check', purpose: 'Surface rights, privacy, prototype, and claim controls.' },
    { id: 'variant', title: 'Audience variant', purpose: 'Separate investor and customer proof priorities.' },
    { id: 'decision', title: 'Authorization decision', purpose: 'Record whether production is authorized, held, or declined.' },
  ] as const satisfies readonly StoryboardBeat[]),
  variants: Object.freeze([
    { audience: 'Investor', emphasis: 'Why the physical proof and evidence path make the opportunity legible.' },
    { audience: 'Customer', emphasis: 'What operating action, record, and approved proof address the buyer’s concern.' },
  ]),
  searchTerms: Object.freeze([
    'physical AI product demo evidence controls',
    'computer vision hardware Demo Day source pack',
    'prototype labeling and rights review',
  ]),
  answerPrompts: Object.freeze([
    'What real physical action is being shown?',
    'Which software record proves that action?',
    'What source and approval support each claim?',
  ]),
  measurementDefinitions,
  authorizationDecision: 'Hold for owner approval until the source pack, claim ledger, and storyboard are complete.',
});

export const physicalAiGuide = Object.freeze({
  directAnswer: 'A physical-AI product demo earns trust when it connects a real founder decision to a visible physical action, a reliable software record, approved evidence, and a clear next step. Before Demo Day, founders should document rights and controls, label prototypes honestly, and review every claim with a human owner.',
  approvalBoundary: 'AI can organize approved inputs; a named human owner approves claims, labels, rights, privacy, and release.',
  storyStructure: Object.freeze([
    'Founder decision',
    'Physical action',
    'Software record',
    'Approved evidence',
    'Next step',
  ]),
  sourcePackFields,
  claimLedger: Object.freeze([
    { state: 'approved', copy: 'State only what the approved evidence demonstrates.' },
    { state: 'conditional', copy: 'Describe a prototype when its status is visible to the audience.', condition: 'A human owner approves the label.' },
    { state: 'prohibited', copy: 'Represent a simulation, reconstruction, or illustration as unqualified production behavior.' },
  ] as const satisfies readonly ClaimLedgerEntry[]),
  controls: Object.freeze([
    'Rights and permissions',
    'Privacy and personal data',
    'Prototype and simulation labels',
    'Facility access and operating restrictions',
    'Identifier removal',
    'Screen-data review',
  ]),
  audienceVariants: Object.freeze([
    { audience: 'Investor', question: 'Why does this proof reduce execution uncertainty?' },
    { audience: 'Customer', question: 'What approved evidence shows the workflow is relevant to my operation?' },
  ]),
  activationClock: Object.freeze([
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
  ]),
  reviewPrompts: Object.freeze([
    'What must the audience see to understand the founder decision?',
    'Which approved record verifies the physical action?',
    'What should happen after the demonstration?',
  ]),
  measurementDefinitions,
  limitations: Object.freeze([
    'A compelling sequence does not prove unshown performance.',
    'An approved source pack does not replace legal, safety, or customer review.',
  ]),
  datedSources: Object.freeze([
    { label: 'NIST AI Risk Management Framework', url: 'https://www.nist.gov/itl/ai-risk-management-framework', checkedAt: '2026-09-01' },
    { label: 'FTC Advertising and Marketing Basics', url: 'https://www.ftc.gov/business-guidance/advertising-marketing/advertising-marketing-basics', checkedAt: '2026-09-01' },
  ]),
  sections: Object.freeze([
    'Answer first',
    'Founder-to-evidence story',
    'Source pack and claim ledger',
    'Audience variants and activation clock',
    'Approval boundaries, measurement, and limitations',
    'Dated sources and change log',
  ]),
  changeLog: Object.freeze([{ date: '2026-09-01', change: 'Initial private-review guide template.' }]),
});

export function privateRobots(): Metadata['robots'] {
  return { index: false, follow: false };
}
