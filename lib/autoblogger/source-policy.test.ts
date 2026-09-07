import { describe, expect, it } from 'vitest';
import { createSafeSourceChecker } from './sources';
import { PRODUCTION_SOURCE_AUTHORITY_POLICIES, sourceDiscoveryQueries, isDiscoverySourceUrl } from './source-policy';

describe('production source discovery policy', () => {
  it.each([
    ['SaaS product demo checklists', 'saas product demo'],
    ['Kubernetes demo guide', 'kubernetes demo'],
    ['Windows demo examples', 'windows demo'],
    ['C++ demo checklist', 'c++ demo'],
  ])('preserves substantive names and syntax in source queries: %s', (keyword, topic) => {
    expect(sourceDiscoveryQueries(keyword, [], 'A practical demonstration')[0]).toBe(`${topic} site:ycombinator.com`);
  });
  it('uses separate short publisher queries while preserving substantive topic qualifiers', () => {
    const queries = sourceDiscoveryQueries('product demo checklist', ['How to run a good product demo?'], 'Product Demo Checklist: Plan, Record and Rehearse');
    expect(queries).toEqual([
      'product demo site:ycombinator.com', 'product demo site:techstars.com',
      'product demo site:techsmith.com/blog/', 'product demo site:descript.com/blog/article/',
    ]);
    expect(sourceDiscoveryQueries('product demo before launch checklist', [], 'Product Demo Before Launch')).toEqual([
      'product demo before launch site:ycombinator.com', 'product demo before launch site:techstars.com',
      'product demo before launch site:techsmith.com/blog/', 'product demo before launch site:descript.com/blog/article/',
    ]);
  });
  it('uses the exact topic and an observed question for two bounded practitioner/program searches', () => {
    const queries = sourceDiscoveryQueries('product demo checklist', ['How to structure a product demo?']);
    expect(queries).toHaveLength(2);
    expect(queries[0]).toMatch(/^product demo checklist \(/);
    expect(queries[1]).toMatch(/^How to structure a product demo\? \(/);
    for (const query of queries) {
      expect(query).toContain('site:ycombinator.com');
      expect(query).toContain('site:techstars.com');
      expect(query).toContain('site:techsmith.com/blog/');
      expect(query).toContain('site:descript.com/blog/article/');
    }
  });

  it.each([
    'https://www.techsmith.com/blog/product-demo-guide/',
    'https://techsmith.com/blog/how-to-video-examples/',
    'https://www.descript.com/blog/article/how-to-make-product-demo-video',
    'https://www.ycombinator.com/blog/demo-day/',
  ])('accepts only scoped discovery URLs: %s', url => expect(isDiscoverySourceUrl(url)).toBe(true));

  it.each([
    'https://techsmith.com.evil.example/blog/demo/',
    'https://www.descript.com/blog/article-spoof/demo',
    'https://www.techsmith.com/blog-spoof/demo/',
    'https://www.techsmith.com/account/',
    'https://www.descript.com/product/',
    'https://user:password@www.techsmith.com/blog/demo/',
    'https://www.techsmith.com:8443/blog/demo/',
    'file:///blog/demo', 'invalid',
  ])('rejects unscoped discovery URLs: %s', url => expect(isDiscoverySourceUrl(url)).toBe(false));

  it('requires fetched topical body content even for allowlisted publishers', async () => {
    const documents = new Map([
      ['https://www.techsmith.com/blog/demo/', '<article><h1>Product demo guide</h1><p>A product demo should explain one customer task through a recorded walkthrough.</p></article>'],
      ['https://www.descript.com/blog/article/demo', '<article><h1>Demo checklist</h1><p>Rehearse the product demo with a clear introduction and an observable outcome.</p></article>'],
      ['https://www.techsmith.com/blog/unrelated/', '<article><h1>Product demo checklist</h1><p>The cohort attends a networking event before fundraising season begins.</p></article>'],
    ]);
    const checker = createSafeSourceChecker({
      authorityPolicies: PRODUCTION_SOURCE_AUTHORITY_POLICIES,
      resolveHostname: async () => ['93.184.216.34'],
      transport: async request => ({
        status: 200, headers: { 'content-type': 'text/html' }, url: request.url,
        redirected: false, peerAddress: request.allowedPeerAddresses[0],
        body: (async function* () { yield new TextEncoder().encode(documents.get(request.url) ?? ''); })(),
      }),
    });
    const selected = await checker.selectWithContent([...documents.keys()], { query: 'product demo checklist' });
    expect(selected.sources.map(source => source.finalUrl)).toEqual([...documents.keys()].slice(0, 2));
    expect(selected.sources.every(source => source.authoritative)).toBe(true);
    expect(selected.sourceDocuments.every(document => document.passages.length > 0)).toBe(true);
    await expect(checker.selectWithContent([...documents.keys()].slice(1), { query: 'product demo checklist' }))
      .rejects.toThrow(/relevant|source/i);
  });
});
