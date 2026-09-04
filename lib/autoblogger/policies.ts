import {
  candidateFingerprints,
  normalizeKeyword,
  normalizeSlug,
  normalizeTitle,
  type Candidate,
  type EvidenceBundle,
  type KeywordMetrics,
} from './domain';

type InventoryEntry = Partial<Pick<Candidate, 'primaryKeyword' | 'title' | 'slug'>>;

export type DuplicateInventory = {
  backlog?: Candidate[];
  stateCandidateFingerprints?: string[];
  landerInventory?: InventoryEntry[];
  openPullRequestInventory?: InventoryEntry[];
};

function hasMatchingIdentity(candidate: Candidate, entries: InventoryEntry[]): boolean {
  const fingerprints = candidateFingerprints(candidate);
  return entries.some((entry) =>
    (entry.primaryKeyword && `keyword:${normalizeKeyword(entry.primaryKeyword)}` === fingerprints.keyword)
    || (entry.title && `title:${normalizeTitle(entry.title)}` === fingerprints.title)
    || (entry.slug && `slug:${normalizeSlug(entry.slug)}` === fingerprints.slug),
  );
}

export function screenDuplicate(candidate: Candidate, inventory: DuplicateInventory): {
  accepted: boolean;
  reason?: 'duplicate_backlog' | 'duplicate_state' | 'duplicate_lander' | 'duplicate_open_pull_request';
} {
  if (hasMatchingIdentity(candidate, inventory.backlog ?? [])) {
    return { accepted: false, reason: 'duplicate_backlog' };
  }
  if ((inventory.stateCandidateFingerprints ?? []).includes(candidateFingerprints(candidate).candidate)) {
    return { accepted: false, reason: 'duplicate_state' };
  }
  if (hasMatchingIdentity(candidate, inventory.landerInventory ?? [])) {
    return { accepted: false, reason: 'duplicate_lander' };
  }
  if (hasMatchingIdentity(candidate, inventory.openPullRequestInventory ?? [])) {
    return { accepted: false, reason: 'duplicate_open_pull_request' };
  }
  return { accepted: true };
}

export type RunMode = 'manual_pilot' | 'scheduled';

export const RUN_LIMITS = {
  maxCandidatesScanned: 50,
  maxDeepInspections: 10,
  maxDrafts: 3,
  maxDraftsPerIcp: 2,
  manualPilotDrafts: 1,
} as const;

export function evaluateEligibility(
  candidate: Candidate,
  evidence: EvidenceBundle,
  metrics: KeywordMetrics,
  mode: RunMode,
): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (evidence.candidateFingerprint !== candidateFingerprints(candidate).candidate) {
    reasons.push('evidence_candidate_mismatch');
  }
  if (evidence.suggestions.length === 0) reasons.push('missing_suggestions');
  if (evidence.serp.organicResultCount === 0) reasons.push('missing_serp');
  if (evidence.serp.organicResultCount > 0 && evidence.serp.peopleAlsoAsk.length < 3) reasons.push('missing_paa');
  if (evidence.sources.length < 2) reasons.push('missing_sources');
  if (!evidence.sources.some((source) => source.authoritative)) reasons.push('missing_authoritative_source');
  if (evidence.faqQuestions.length < 3) reasons.push('missing_faqs');
  if (mode === 'scheduled' && (metrics.provider === 'pending' || metrics.volume === null || metrics.difficulty === null)) {
    reasons.push('scheduled_requires_observed_volume_and_difficulty');
  }
  return { eligible: reasons.length === 0, reasons };
}

export type Opportunity = {
  candidate: Candidate;
  evidence: EvidenceBundle;
  metrics: KeywordMetrics;
};

export function limitCandidatesForScan<T>(candidates: T[]): T[] {
  return candidates.slice(0, RUN_LIMITS.maxCandidatesScanned);
}

export function limitDeepInspections<T>(candidates: T[]): T[] {
  return candidates.slice(0, RUN_LIMITS.maxDeepInspections);
}

export function stageOpportunitiesForDeepInspection<T>(opportunities: T[]): T[] {
  return limitDeepInspections(limitCandidatesForScan(opportunities));
}

export function scoreOpportunity(opportunity: Opportunity): number {
  const evidenceScore = opportunity.evidence.suggestions.length
    + Math.min(opportunity.evidence.serp.organicResultCount, 10)
    + opportunity.evidence.serp.peopleAlsoAsk.length
    + opportunity.evidence.sources.length
    + opportunity.evidence.faqQuestions.length;
  const metricsScore = opportunity.metrics.volume === null || opportunity.metrics.difficulty === null
    ? 0
    : opportunity.metrics.volume - opportunity.metrics.difficulty;
  return evidenceScore + metricsScore;
}

export function selectOpportunities(opportunities: Opportunity[], mode: RunMode): Opportunity[] {
  const ranked = stageOpportunitiesForDeepInspection(opportunities)
    .filter((opportunity) => evaluateEligibility(opportunity.candidate, opportunity.evidence, opportunity.metrics, mode).eligible)
    .sort((left, right) => {
      const scoreDifference = scoreOpportunity(right) - scoreOpportunity(left);
      if (scoreDifference !== 0) return scoreDifference;
      return candidateFingerprints(left.candidate).candidate.localeCompare(candidateFingerprints(right.candidate).candidate);
    });
  const selected: Opportunity[] = [];
  const selectedPerIcp = new Map<string, number>();
  const maximum = mode === 'manual_pilot' ? RUN_LIMITS.manualPilotDrafts : RUN_LIMITS.maxDrafts;

  for (const opportunity of ranked) {
    if (selected.length === maximum) break;
    const count = selectedPerIcp.get(opportunity.candidate.icp) ?? 0;
    if (count >= RUN_LIMITS.maxDraftsPerIcp) continue;
    selected.push(opportunity);
    selectedPerIcp.set(opportunity.candidate.icp, count + 1);
  }
  return selected;
}
