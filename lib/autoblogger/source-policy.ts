import type { AuthorityPolicy } from './sources';

// First-party practitioner guidance is authoritative about its own workflow,
// not independent market evidence, a competitor comparison, or a guarantee.
// Restrict vendor sources to their editorial guides, not arbitrary host paths.
const DISCOVERY_SCOPES: AuthorityPolicy[] = [
  { hostname: 'ycombinator.com' },
  { hostname: 'techstars.com' },
  { hostname: 'techsmith.com', pathPrefix: '/blog/' },
  { hostname: 'descript.com', pathPrefix: '/blog/article/' },
];

export const PRODUCTION_SOURCE_AUTHORITY_POLICIES: readonly AuthorityPolicy[] = [
  ...DISCOVERY_SCOPES.flatMap(policy => [policy, { ...policy, hostname: `www.${policy.hostname}` }]),
  { hostname: 'www.nist.gov' },
  { hostname: 'www.ftc.gov' },
  { hostname: 'www.w3.org' },
  { hostname: 'developers.google.com', pathPrefix: '/search/' },
  { hostname: 'learn.microsoft.com' },
  { hostname: 'videoclaw.com' },
  { hostname: 'www.videoclaw.com' },
];

export function sourceDiscoveryQueries(keyword: string, observedQuestions: readonly string[]): string[] {
  const sites = DISCOVERY_SCOPES.map(policy => `site:${policy.hostname}${policy.pathPrefix ?? ''}`).join(' OR ');
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
