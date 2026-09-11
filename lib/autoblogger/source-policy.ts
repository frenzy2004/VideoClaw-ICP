import type { AuthorityPolicy } from './sources';
import { sourceTopicQuery } from './source-relevance';

// First-party practitioner guidance is authoritative about its own workflow,
// not independent market evidence, a competitor comparison, or a guarantee.
// Restrict vendor sources to their editorial guides, not arbitrary host paths.
const VIDEO_GUIDE_SCOPES: readonly AuthorityPolicy[] = [
  { hostname: 'techsmith.com', pathPrefix: '/blog/' },
  { hostname: 'descript.com', pathPrefix: '/blog/article/' },
];
const FOUNDER_SCOPES: readonly AuthorityPolicy[] = [
  { hostname: 'ycombinator.com' },
  { hostname: 'techstars.com' },
  ...VIDEO_GUIDE_SCOPES,
];
const CONTENT_GUIDE_SCOPES: readonly AuthorityPolicy[] = [
  { hostname: 'buffer.com', pathPrefix: '/resources/' },
  { hostname: 'optimizely.com', pathPrefix: '/optimization-glossary/' },
];
const CONTENT_SCOPES = [...CONTENT_GUIDE_SCOPES, ...VIDEO_GUIDE_SCOPES];
const DISCOVERY_SCOPES = [...FOUNDER_SCOPES, ...CONTENT_GUIDE_SCOPES];

// Retrieval routing only, never proof of relevance or a replacement keyword.
// Use complete words from the keyword, not arbitrary text in a title or FAQ.
function discoveryScopes(keyword: string): readonly AuthorityPolicy[] {
  const words = new Set(keyword.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
  const repurposing = ['repurpose', 'repurposes', 'repurposed', 'repurposing'].some(word => words.has(word))
    && ['content', 'video', 'videos', 'webinar', 'webinars', 'podcast', 'podcasts', 'social'].some(word => words.has(word));
  const contentOperations = words.has('content')
    && ['operations', 'workflow', 'workflows', 'approval', 'queue', 'queues', 'calendar', 'distribution'].some(word => words.has(word));
  return repurposing || contentOperations ? CONTENT_SCOPES : FOUNDER_SCOPES;
}

export const PRODUCTION_SOURCE_AUTHORITY_POLICIES: readonly AuthorityPolicy[] = [
  ...DISCOVERY_SCOPES.flatMap(policy => [policy, { ...policy, hostname: `www.${policy.hostname}` }]),
  // First-party technical workflow guidance, not independent market evidence or
  // an endorsement/correctness guarantee. Authority only; no discovery expansion.
  { hostname: 'shotstack.io', pathPrefix: '/learn/' },
  { hostname: 'www.shotstack.io', pathPrefix: '/learn/' },
  // Primary documentation of Sendible's own queue controls only. No authority
  // for comparative claims, advertised ROI, other paths or VideoClaw features.
  { hostname: 'www.sendible.com', exactPath: '/features/smart-queues' },
  { hostname: 'www.nist.gov' },
  { hostname: 'www.ftc.gov' },
  { hostname: 'www.w3.org' },
  { hostname: 'developers.google.com', pathPrefix: '/search/' },
  { hostname: 'learn.microsoft.com' },
  { hostname: 'videoclaw.com' },
  { hostname: 'www.videoclaw.com' },
];

export function sourceDiscoveryQueries(keyword: string, observedQuestions: readonly string[], articleTitle?: string): string[] {
  const scopes = discoveryScopes(keyword);
  const sites = scopes.map(policy => `site:${policy.hostname}${policy.pathPrefix ?? ''}`).join(' OR ');
  if (articleTitle?.trim()) {
    // Full editorial titles plus long OR lists caused query relaxation and
    // unrelated results in the live collector. Use one short topic query per
    // publisher instead; title coverage is enforced in selection and review.
    const topic = sourceTopicQuery(keyword);
    if (!topic) throw new Error('Supporting source discovery requires a substantive topic.');
    const queries = scopes.map(policy => `${topic} site:${policy.hostname}${policy.pathPrefix ?? ''}`);
    const seen = new Set(queries.map(query => query.toLowerCase()));
    // Search the actual selected questions, not inferred synonyms. Avoid the
    // long OR restriction here too; question results still require the safe
    // body reader and do not gain authority. One batch: four topic + at most three
    // FAQ queries, sharing the existing 24-page fetch budget.
    for (const question of observedQuestions) {
      const query = question.normalize('NFKC').replace(/[\p{Cc}\p{Cf}\s]+/gu, ' ').trim();
      if (!query || seen.has(query.toLowerCase())) continue;
      seen.add(query.toLowerCase());
      queries.push(query);
      if (queries.length === scopes.length + 3) break;
    }
    return queries;
  }
  return [...new Set([keyword, ...observedQuestions])].slice(0, 2).map(query => `${query} (${sites})`);
}

export function isDiscoverySourceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    return DISCOVERY_SCOPES.some(policy =>
      url.hostname.replace(/^www\./u, '') === policy.hostname
      && (!policy.pathPrefix || url.pathname.startsWith(policy.pathPrefix)));
  } catch { return false; }
}
