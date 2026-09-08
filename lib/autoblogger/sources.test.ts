import { describe, expect, it } from 'vitest';
import { faqBodyMatches } from './faq-evidence';

import {
  createSafeSourceChecker,
  type DnsResolver,
} from './sources';
import type {
  SourceHttpRequest,
  SourceHttpTransport,
} from './http';

const publicResolver: DnsResolver = async () => ['93.184.216.34'];

async function* byteStream(...chunks: string[]) {
  for (const chunk of chunks) yield new TextEncoder().encode(chunk);
}

function bodyWithCleanup(
  cleanup: () => Promise<IteratorResult<Uint8Array>>,
): AsyncIterable<Uint8Array> {
  return {
    [Symbol.asyncIterator]() {
      return {
        next: async () => ({ done: true, value: undefined }),
        return: cleanup,
      };
    },
  };
}

function responseTransport(responses: Array<{
  status: number;
  headers?: Record<string, string | undefined>;
  body?: unknown;
  redirected?: boolean;
  url?: string;
  peerAddress?: string;
}>) {
  const requests: SourceHttpRequest[] = [];
  const transport: SourceHttpTransport = async (request) => {
    requests.push(request);
    const response = responses.shift();
    if (!response) throw new Error('Unexpected source request');
    const body = response.body != null && Symbol.asyncIterator in Object(response.body)
      ? response.body as AsyncIterable<Uint8Array>
      : byteStream(String(response.body ?? ''));
    return {
      headers: {},
      redirected: false,
      url: request.url,
      peerAddress: request.allowedPeerAddresses[0],
      ...response,
      body,
    };
  };
  return { requests, transport };
}

describe('safe source checks', () => {
  it('transport contract rejects an automatically followed redirect', async () => {
    const transport: SourceHttpTransport = async () => ({
      status: 200,
      headers: {},
      body: byteStream('private response'),
      redirected: true,
      url: 'http://169.254.169.254/latest/meta-data',
      peerAddress: '169.254.169.254',
    });
    const checker = createSafeSourceChecker({ transport, resolveHostname: publicResolver });

    await expect(checker.check('https://safe.example/source')).rejects.toThrow(
      /automatic redirect|manual redirect/i,
    );
  });

  it('transport contract rejects a peer outside the validated DNS addresses', async () => {
    const transport: SourceHttpTransport = async (request) => ({
      status: 200,
      headers: {},
      body: byteStream('rebound response'),
      redirected: false,
      url: request.url,
      peerAddress: '10.0.0.8',
    });
    const checker = createSafeSourceChecker({ transport, resolveHostname: publicResolver });

    await expect(checker.check('https://rebind.example/source')).rejects.toThrow(
      /peer.*validated|address.*mismatch/i,
    );
  });

  it('transport contract streams and rejects a response crossing the byte cap', async () => {
    const requests: SourceHttpRequest[] = [];
    const transport: SourceHttpTransport = async (request) => {
      requests.push(request);
      return {
        status: 200,
        headers: {},
        body: byteStream('123', '456'),
        redirected: false,
        url: request.url,
        peerAddress: '93.184.216.34',
      };
    };
    const checker = createSafeSourceChecker({
      transport,
      resolveHostname: publicResolver,
      limits: { maxBodyBytes: 5 },
    });

    await expect(checker.check('https://stream.example/source')).rejects.toThrow(
      /body|bytes|large/i,
    );
    expect(requests[0]).toMatchObject({
      redirect: 'manual',
      allowedPeerAddresses: ['93.184.216.34'],
      maxResponseBytes: 5,
    });
  });

  it('rejects localhost and private literal or DNS-resolved targets before HTTP', async () => {
    const direct = responseTransport([]);
    const directChecker = createSafeSourceChecker({
      transport: direct.transport,
      resolveHostname: publicResolver,
    });
    const resolved = responseTransport([]);
    const resolvedChecker = createSafeSourceChecker({
      transport: resolved.transport,
      resolveHostname: async () => ['10.2.3.4'],
    });

    await expect(directChecker.check('http://127.0.0.1/admin')).rejects.toThrow(/https/i);
    await expect(directChecker.check('http://localhost/admin')).rejects.toThrow(/https/i);
    await expect(resolvedChecker.check('https://public-looking.example/data')).rejects.toThrow(
      /private|local/i,
    );
    expect(direct.requests).toHaveLength(0);
    expect(resolved.requests).toHaveLength(0);
  });

  it('revalidates every redirect target and blocks link-local destinations', async () => {
    const fixture = responseTransport([{
      status: 302,
      headers: { location: 'http://169.254.169.254/latest/meta-data' },
    }]);
    const checker = createSafeSourceChecker({
      transport: fixture.transport,
      resolveHostname: publicResolver,
    });

    await expect(checker.check('https://safe.example/source')).rejects.toThrow(/https/i);
    expect(fixture.requests).toHaveLength(1);
  });

  it('caps redirects and response bytes without retaining body text', async () => {
    const fixture = responseTransport([
      { status: 301, headers: { location: '/canonical' } },
      { status: 200, headers: { 'content-length': '12' }, body: 'hello source' },
    ]);
    const checker = createSafeSourceChecker({
      transport: fixture.transport,
      resolveHostname: publicResolver,
      limits: { maxRedirects: 1, maxBodyBytes: 12, timeoutMs: 50 },
    });

    const result = await checker.check('https://example.com/original');

    expect(result).toEqual({
      url: 'https://example.com/original',
      finalUrl: 'https://example.com/canonical',
      status: 200,
      reachable: true,
      authoritative: false,
    });
    expect(JSON.stringify(result)).not.toContain('hello source');

    const tooLarge = createSafeSourceChecker({
      transport: responseTransport([{ status: 200, body: '123456' }]).transport,
      resolveHostname: publicResolver,
      limits: { maxRedirects: 0, maxBodyBytes: 5, timeoutMs: 50 },
    });
    await expect(tooLarge.check('https://example.com/large')).rejects.toThrow(/body|bytes|large/i);
  });

  it('times out a slow source request', async () => {
    const transport: SourceHttpTransport = (request) => new Promise((_resolve, reject) => {
      request.signal.addEventListener('abort', () => reject(new Error('aborted')));
    });
    const checker = createSafeSourceChecker({
      transport,
      resolveHostname: publicResolver,
      limits: { maxRedirects: 0, maxBodyBytes: 100, timeoutMs: 5 },
    });

    await expect(checker.check('https://slow.example/source')).rejects.toThrow(/timed out/i);
  });

  it('enforces the timeout even when an injected transport ignores abort signals', async () => {
    const transport: SourceHttpTransport = async (request) => new Promise((resolve) => {
      setTimeout(() => resolve({
        status: 200,
        headers: {},
        body: byteStream('late'),
        redirected: false,
        url: request.url,
        peerAddress: request.allowedPeerAddresses[0],
      }), 25);
    });
    const checker = createSafeSourceChecker({
      transport,
      resolveHostname: publicResolver,
      limits: { maxRedirects: 0, maxBodyBytes: 100, timeoutMs: 5 },
    });

    await expect(checker.check('https://ignores-abort.example/source')).rejects.toThrow(/timed out/i);
  });

  it('enforces the timeout while DNS resolution is still pending', async () => {
    const checker = createSafeSourceChecker({
      transport: responseTransport([]).transport,
      resolveHostname: async () => new Promise(() => undefined),
      limits: { maxRedirects: 0, maxBodyBytes: 100, timeoutMs: 5 },
    });

    const outcome = await Promise.race([
      checker.check('https://pending-dns.example/source').then(
        () => 'resolved',
        (error) => String(error),
      ),
      new Promise<string>((resolve) => setTimeout(() => resolve('still pending'), 20)),
    ]);
    expect(outcome).toMatch(/timed out/i);
  });

  it('deadline-bounds cleanup when iterator.return never settles', async () => {
    const fixture = responseTransport([{
      status: 200,
      body: bodyWithCleanup(() => new Promise(() => undefined)),
    }]);
    const checker = createSafeSourceChecker({
      transport: fixture.transport,
      resolveHostname: publicResolver,
      limits: { maxRedirects: 0, maxBodyBytes: 100, timeoutMs: 5 },
    });

    const outcome = await Promise.race([
      checker.check('https://hanging-cleanup.example/source').then(
        () => 'resolved',
        (error) => String(error),
      ),
      new Promise<string>((resolve) => setTimeout(() => resolve('still pending'), 20)),
    ]);

    expect(outcome).toBe('resolved');
  });

  it('ignores redirect cleanup rejection and continues to the validated target', async () => {
    const fixture = responseTransport([
      {
        status: 302,
        headers: { location: '/canonical' },
        body: bodyWithCleanup(async () => {
          throw new Error('cleanup failed');
        }),
      },
      { status: 200, body: 'canonical source' },
    ]);
    const checker = createSafeSourceChecker({
      transport: fixture.transport,
      resolveHostname: publicResolver,
    });

    await expect(checker.check('https://example.com/original')).resolves.toMatchObject({
      finalUrl: 'https://example.com/canonical',
      reachable: true,
    });
  });

  it('cleans up an oversized response without replacing the byte-limit failure', async () => {
    let cleanupCalls = 0;
    const fixture = responseTransport([{
      status: 200,
      headers: { 'content-length': '101' },
      body: bodyWithCleanup(async () => {
        cleanupCalls += 1;
        throw new Error('cleanup failed');
      }),
    }]);
    const checker = createSafeSourceChecker({
      transport: fixture.transport,
      resolveHostname: publicResolver,
      limits: { maxBodyBytes: 100 },
    });

    await expect(checker.check('https://example.com/oversized')).rejects.toThrow(/byte limit/i);
    expect(cleanupCalls).toBe(1);
  });
});

describe('source authority and evidence selection', () => {
  it('selects a feasible combined FAQ and title cover rather than a redundant FAQ-only page', async () => {
    const definition = 'Video marketing is the use of videos to promote products or services.';
    const ai = 'AI video marketing refers to using artificial intelligence to produce marketing videos.';
    const cost = 'Video marketing costs depend on crew and editing budget.';
    const urls = ['faq-only', 'record', 'rehearse', 'edit', 'export'].map(path => `https://authority.example/${path}`);
    const fixture = responseTransport([
      `${definition} ${ai} ${cost}`,
      `${definition} Record a video marketing example for the chosen audience.`,
      `${ai} Rehearse the video marketing example before the buyer meeting.`,
      `${cost} Edit the video marketing footage for clarity.`,
      'Export the video marketing file after checking the final playback.',
    ].map(body => ({ status: 200, headers: { 'content-type': 'text/html' }, body: `<p>${body}</p>` })));
    const checker = createSafeSourceChecker({ transport: fixture.transport, resolveHostname: publicResolver, authorityPolicies: [{ hostname: 'authority.example' }] });
    const selection = await checker.selectWithContent(urls, { query: 'video marketing', articleTitle: 'Video Marketing: Record, Rehearse, Edit and Export',
      questions: ['What is video marketing?', 'What is AI video marketing?', 'How much does video marketing cost?'] });
    expect(selection.sources.map(s => s.finalUrl).sort()).toEqual(urls.slice(1).sort());
  });

  it('reserves missing FAQ answer coverage instead of filling all slots with generic topic pages', async () => {
    const generic = 'Video marketing is a promotional technique. Video marketing helps explain products. Plan a video marketing campaign for a chosen audience.';
    const fixture = responseTransport([
      ...Array(4).fill(`<p>${generic}</p>`),
      '<h2>What is AI video marketing?</h2><p>Video marketing is a promotional technique with no discussion of artificial intelligence.</p>',
      '<p>AI video marketing refers to using artificial intelligence to create or adapt marketing videos.</p>',
      '<p>Video marketing costs depend on production crew and editing budget.</p>',
    ].map(body => ({ status: 200, headers: { 'content-type': 'text/html' }, body })));
    const urls = ['generic1', 'generic2', 'generic3', 'generic4', 'heading-only', 'ai', 'cost'].map(path => `https://authority.example/${path}`);
    const checker = createSafeSourceChecker({ transport: fixture.transport, resolveHostname: publicResolver, authorityPolicies: [{ hostname: 'authority.example' }] });
    const selection = await checker.selectWithContent(urls, { query: 'video marketing', questions: ['What is video marketing?', 'What is AI video marketing?', 'How much does video marketing cost?'] });
    expect(selection.sources.map(s => s.finalUrl)).toEqual(expect.arrayContaining([urls[5], urls[6]]));
    expect(selection.sources.map(s => s.finalUrl)).not.toContain(urls[4]);
    expect(selection.sources).toHaveLength(4);
  });

  it('retains a later procedure body whose relevant purpose is in its heading', async () => {
    const generic = '<p>A tutorial video explains a task. Plan a tutorial video for the product audience. A tutorial video should stay focused.</p>';
    const fixture = responseTransport([
      ...Array(4).fill(generic),
      '<p>A tutorial video explains a product workflow.</p><h2>Record your tutorial video</h2><p>Open the capture panel. Click Screen Recording. Select the desired window.</p>',
    ].map(body => ({status: 200, headers: {'content-type': 'text/html'}, body})));
    const urls = ['general1', 'general2', 'general3', 'general4', 'recording'].map(path => `https://authority.example/${path}`);
    const checker = createSafeSourceChecker({transport: fixture.transport, resolveHostname: publicResolver, authorityPolicies: [{hostname: 'authority.example'}]});
    const selection = await checker.selectWithContent(urls, {query: 'tutorial video', questions: ['How do I record my screen for a tutorial video?']});
    expect(selection.sources.map(s => s.finalUrl)).toContain(urls[4]);
    expect(selection.sources).toHaveLength(4);
    const procedure = selection.sourceDocuments.find(s => s.finalUrl === urls[4])!.passages.find(p => p.text.includes('Click Screen Recording.'))!;
    expect(procedure.text.slice(procedure.bodyStart)).toContain('Click Screen Recording.');
    expect(procedure.text.slice(0, procedure.bodyStart)).toContain('Record your tutorial video');
  });

  it.each([
    '<p>Click Help to learn how to record your screen.</p>',
    '<ul><li>Select a screen layout</li><li>Record your webcam</li></ul>',
    '<p>Open the capture panel. Turn off Screen Recording.</p>',
    '<p>Recording your screen is currently unsupported.</p>',
    '<p>Click Screen Recording Help to read the instructions.</p>',
    '<p>Click Screen; recording your webcam starts automatically.</p>',
  ])('keeps non-answer instructions rejected after actual HTML extraction: %s', async body => {
    const fixture = responseTransport([{status: 200, headers: {'content-type': 'text/html'},
      body: `<article><p>A tutorial video explains a product task to a viewer.</p><h2>Record your tutorial video</h2>${body}</article>`}]);
    const checker = createSafeSourceChecker({transport: fixture.transport, resolveHostname: publicResolver, authorityPolicies: [{hostname: 'authority.example'}]});
    const document = await checker.read('https://authority.example/recording', {query: 'tutorial video'});
    expect(document.passages.some(p => p.text.includes('Record your tutorial video'))).toBe(true);
    expect(document.passages.some(p => faqBodyMatches('How do I record my screen for a tutorial video?', p.text, p.bodyStart))).toBe(false);
  });

  it.each([2, 3, 4, 5, 6])('does not let an H%s topic heading qualify unrelated body prose', async level => {
    const html = `<h${level}>Product demo checklist</h${level}><p>The cafeteria serves lunch daily and closes early on Fridays.</p>`;
    const fixture = responseTransport(Array.from({ length: 2 }, () => ({ status: 200, headers: { 'content-type': 'text/html' }, body: html })));
    const checker = createSafeSourceChecker({ transport: fixture.transport, resolveHostname: publicResolver, authorityPolicies: [{ hostname: 'authority.example' }] });
    await expect(checker.selectWithContent(['https://authority.example/guide', 'https://publisher.example/guide'], { query: 'product demo checklist' }))
      .rejects.toThrow(/two.*relevant.*body.*authoritative/i);
  });

  it.each(['How does a product demo work?', 'How do product demos work?'])('accepts topical body evidence with equivalent framing: %s', async query => {
    const fixture = responseTransport([
      'A product demo works by walking buyers through a realistic workflow.',
      'Product demos work by showing buyers how a task is completed in the application.',
    ].map(body => ({ status: 200, headers: { 'content-type': 'text/html' }, body: `<p>${body}</p>` })));
    const checker = createSafeSourceChecker({ transport: fixture.transport, resolveHostname: publicResolver, authorityPolicies: [{ hostname: 'authority.example' }] });
    expect((await checker.selectWithContent(['https://authority.example/guide', 'https://publisher.example/guide'], { query })).sourceDocuments).toHaveLength(2);
  });

  it('skips adjacent and pitch-only bodies even when four usable pages include an authority', async () => {
    const names = ['launch', 'content', 'onboarding', 'pitch', 'demo', 'authority'];
    const bodies = [
      'The product launch checklist covers pricing, distribution and launch announcements.',
      'A product content checklist identifies stale descriptions and inconsistent terminology.',
      'The sales onboarding checklist introduces new hires to the product catalog.',
      'Demo Day pitches introduce investors to the team and the market opportunity.',
      'A product demo should connect a buyer problem to the workflow being demonstrated.',
      'Rehearse the product demo with a realistic scenario and allow time for buyer questions.',
    ];
    const fixture = responseTransport(bodies.map(body => ({ status: 200, headers: { 'content-type': 'text/html' }, body: `<p>${body}</p>` })));
    const checker = createSafeSourceChecker({ transport: fixture.transport, resolveHostname: publicResolver,
      authorityPolicies: [{ hostname: 'pitch.example' }, { hostname: 'authority.example' }] });
    const selection = await checker.selectWithContent(names.map(name => `https://${name}.example/guide`), {
      query: 'product demo checklist', questions: ['How do founders pitch investors on Demo Day?'],
    });
    expect(selection.sources.map(source => source.originalUrl)).toEqual(['https://demo.example/guide', 'https://authority.example/guide']);
  });

  it.each([
    ['one topical page', 'Product content health checks should identify stale copy and incorrect terminology.', 'A product demo should explain a buyer workflow and leave room for questions.'],
    ['only off-topic authority', 'The product launch checklist defines launch milestones and launch owners.', 'A product demo should explain a buyer workflow and leave room for questions.'],
    ['only generic overlap', 'The product launch checklist defines launch milestones and launch owners.', 'The onboarding checklist introduces sales hires to the product catalog.'],
  ])('refuses %s before drafting', async (_name, authority, other) => {
    const fixture = responseTransport([authority, other].map(body => ({ status: 200, headers: { 'content-type': 'text/html' }, body: `<p>${body}</p>` })));
    const checker = createSafeSourceChecker({ transport: fixture.transport, resolveHostname: publicResolver, authorityPolicies: [{ hostname: 'authority.example' }] });
    await expect(checker.selectWithContent(['https://authority.example/guide', 'https://publisher.example/guide'], { query: 'product demo checklist' }))
      .rejects.toThrow(/two.*relevant.*body.*authoritative/i);
  });

  it('does not count query, www, fragment or trailing-slash aliases as two relevant documents', async () => {
    const fixture = responseTransport(Array.from({ length: 2 }, () => ({ status: 200, headers: { 'content-type': 'text/html' },
      body: '<p>A product demo should explain the buyer workflow and allow time for questions.</p>' })));
    const checker = createSafeSourceChecker({ transport: fixture.transport, resolveHostname: publicResolver, authorityPolicies: [{ hostname: 'authority.example' }] });
    await expect(checker.selectWithContent(['https://authority.example/guide', 'https://www.authority.example/guide/?ref=x#intro'], { query: 'product demo checklist' }))
      .rejects.toThrow(/two.*relevant.*body.*authoritative/i);
  });

  it('requires a core topic instead of selecting by a missing query or generic format words', async () => {
    for (const query of [undefined, 'product checklist template']) {
      const fixture = responseTransport(Array.from({ length: 2 }, () => ({ status: 200, headers: { 'content-type': 'text/html' }, body: '<p>The product checklist template includes several steps for the reader to follow.</p>' })));
      const checker = createSafeSourceChecker({ transport: fixture.transport, resolveHostname: publicResolver, authorityPolicies: [{ hostname: 'authority.example' }] });
      await expect(checker.selectWithContent(['https://authority.example/guide', 'https://publisher.example/guide'], { query }))
        .rejects.toThrow(/two.*relevant.*body.*authoritative/i);
    }
  });

  it('cannot qualify a source using metadata, navigation, headings or repeated query-only prose', async () => {
    const fixture = responseTransport([
      '<head><title>Product demo checklist</title><meta name="description" content="Product demo checklist" /></head><nav>Product demo checklist</nav><h1>Product demo checklist</h1><p>The product launch checklist describes pricing and distribution decisions.</p>',
      '<p>Product demo checklist product demo checklist product demo checklist.</p>',
      '<p>A product demo should connect the buyer problem to a realistic workflow.</p>',
    ].map(body => ({ status: 200, headers: { 'content-type': 'text/html' }, body })));
    const checker = createSafeSourceChecker({ transport: fixture.transport, resolveHostname: publicResolver, authorityPolicies: [{ hostname: 'authority.example' }] });
    await expect(checker.selectWithContent(['https://authority.example/metadata', 'https://authority.example/spam', 'https://publisher.example/demo'], { query: 'product demo checklist' }))
      .rejects.toThrow(/two.*relevant.*body.*authoritative/i);
  });

  it('does not evict a main-workflow page to collect more answers than the three output FAQs', async () => {
    const bodies = [
      'A tutorial video is a recording that teaches a task through a sequence of visible actions.',
      'Tutorial video costs depend on recording time and the editing work required.',
      'A tutorial video should last three minutes for this particular exercise.',
      'A tutorial video is called an instructional video.',
      'Record and export a tutorial video to prepare a version for local playback.',
    ];
    const urls = ['definition', 'cost', 'duration', 'unused-name', 'workflow'].map(name => `https://authority.example/${name}`);
    const fixture = responseTransport(bodies.map(body => ({status: 200, headers: {'content-type': 'text/html'}, body: `<article><p>${body}</p></article>`})));
    const checker = createSafeSourceChecker({transport: fixture.transport, resolveHostname: publicResolver, authorityPolicies: [{hostname: 'authority.example'}]});
    const selection = await checker.selectWithContent(urls, {query: 'tutorial video', articleTitle: 'Tutorial Video: Record and Export',
      questions: ['What is a tutorial video?', 'How much does a tutorial video cost?', 'How long should a tutorial video be?', 'What is a tutorial video called?']});
    expect(selection.sources.map(source => source.finalUrl)).toEqual([urls[0], urls[1], urls[2], urls[4]]);
    expect(fixture.requests).toHaveLength(5);
  });

  it('retains title-task coverage instead of replacing practical sources with higher-frequency topic pages', async () => {
    const generic = 'A product demo explains the buyer problem through a realistic workflow. The product demo introduces a useful business scenario to customers. Every product demo should leave time for questions from the buyer.';
    const fixture = responseTransport([
      'A product demo recording should show one complete workflow. Record a short audio sample and listen before capturing the full walkthrough.',
      'Rehearse the product demo from the beginning before the buyer meeting.',
      ...Array(4).fill(generic),
      'Recording and rehearsal matter for the classroom lecture, not a product demonstration.',
    ].map(body => ({ status: 200, headers: { 'content-type': 'text/html' }, body: `<p>${body}</p>` })));
    const urls = ['record', 'rehearse', 'program1', 'program2', 'program3', 'program4', 'unrelated'].map(name => `https://authority.example/${name}`);
    const checker = createSafeSourceChecker({ transport: fixture.transport, resolveHostname: publicResolver, authorityPolicies: [{ hostname: 'authority.example' }] });
    const result = await checker.selectWithContent(urls, { query: 'product demo checklist', articleTitle: 'Product Demo Checklist: Plan, Record and Rehearse' });
    expect(result.sourceDocuments).toHaveLength(4);
    expect(result.sources.map(source => source.finalUrl)).toEqual(expect.arrayContaining(urls.slice(0, 2)));
    expect(result.sources.map(source => source.finalUrl)).not.toContain(urls[6]);
  });
  it('ranks a later stronger topical body above earlier topical pages without inflating repeated prose', async () => {
    const topical = 'A product demo should connect the buyer problem to a realistic workflow.';
    const strong = `${topical} Rehearse the product demo with a buyer scenario and leave time for questions.`;
    const fixture = responseTransport([topical.repeat(8), topical, topical, topical, strong].map(body => ({ status: 200, headers: { 'content-type': 'text/html' }, body: `<p>${body}</p>` })));
    const checker = createSafeSourceChecker({ transport: fixture.transport, resolveHostname: publicResolver, authorityPolicies: [{ hostname: 'authority.example' }] });
    const selection = await checker.selectWithContent(['https://repeat.example/guide', 'https://authority.example/guide', 'https://third.example/guide', 'https://fourth.example/guide', 'https://strong.example/guide'], { query: 'product demo checklist' });
    expect(selection.sources.map(source => source.originalUrl)).toEqual(['https://strong.example/guide', 'https://repeat.example/guide', 'https://authority.example/guide', 'https://third.example/guide']);
  });

  it('applies topic qualifiers beyond demos while retaining the whole qualified passage', async () => {
    const body = 'Remote employee onboarding should explain where to obtain equipment and support. This applies only to employees in the regional pilot, not contractors.';
    const fixture = responseTransport([
      'Employee onboarding should explain the reporting structure and the team responsibilities.', body,
      'Remote employee onboarding should cover equipment access and the support process.',
    ].map(text => ({ status: 200, headers: { 'content-type': 'text/html' }, body: `<p>${text}</p>` })));
    const checker = createSafeSourceChecker({ transport: fixture.transport, resolveHostname: publicResolver, authorityPolicies: [{ hostname: 'authority.example' }] });
    const selection = await checker.selectWithContent(['https://nearby.example/guide', 'https://authority.example/guide', 'https://publisher.example/guide'], { query: 'how to create a remote employee onboarding checklist' });
    expect(selection.sources.map(source => source.originalUrl)).toEqual(['https://authority.example/guide', 'https://publisher.example/guide']);
    expect(selection.sourceDocuments[0].passages[0].text).toBe(body);
  });

  it('keeps relevant organic pages while making room for a later authority within four pages', async () => {
    const urls = ['payroll', 'organic', 'second', 'third', 'fourth', 'authority'].map((name) => (
      `https://${name}.example/guide`
    ));
    const fixture = responseTransport(urls.map((_, index) => ({
      status: 200, headers: { 'content-type': 'text/html' },
      body: index === 0 ? '<p>Payroll tax withholding depends on the employee earnings.</p>'
        : `<p>Demo day video planning guidance from source ${index} includes time for review.</p>`,
    })));
    const checker = createSafeSourceChecker({
      transport: fixture.transport, resolveHostname: publicResolver,
      authorityPolicies: [{ hostname: 'authority.example' }],
    });
    const selection = await checker.selectWithContent(urls, { query: 'demo day video checklist' });
    expect(selection.sources.map(({ originalUrl }) => originalUrl)).toEqual([
      'https://organic.example/guide', 'https://second.example/guide',
      'https://third.example/guide', 'https://authority.example/guide',
    ]);
    expect(selection.sourceDocuments).toHaveLength(4);
  });

  it('fetches duplicate normalized inputs once and ignores non-successful body content', async () => {
    const fixture = responseTransport([
      { status: 503, headers: { 'content-type': 'text/html' }, body: '<p>Video claim on a temporary error page must not become evidence.</p>' },
      { status: 200, headers: { 'content-type': 'text/html' }, body: '<p>Video preparation includes reviewing recordings before the presentation.</p>' },
      { status: 200, headers: { 'content-type': 'text/html' }, body: '<p>Video preparation includes a final check of the exported file.</p>' },
    ]);
    const checker = createSafeSourceChecker({
      transport: fixture.transport, resolveHostname: publicResolver,
      authorityPolicies: [{ hostname: 'authority.example' }],
    });
    const selection = await checker.selectWithContent([
      'https://authority.example/unavailable', 'https://authority.example/guide#a',
      'https://authority.example/guide#b', 'https://publisher.example/guide',
    ], { query: 'video preparation' });
    expect(selection.sources.map(({ originalUrl }) => originalUrl)).toEqual([
      'https://authority.example/guide', 'https://publisher.example/guide',
    ]);
    expect(fixture.requests).toHaveLength(3);
  });

  it.each([
    { headers: { 'content-type': 'text/html' }, body: 'x'.repeat(101), error: /byte limit/i },
    { headers: { 'content-type': 'text/html' }, redirected: true, error: /manual redirect/i },
    { headers: { 'content-type': 'text/html' }, peerAddress: '10.0.0.1', error: /validated address/i },
    { status: 302, headers: { location: 'https://127.0.0.1/private' }, error: /private|local/i },
  ])('read enforces byte, redirect and peer safeguards: $error', async ({ error, ...response }) => {
    const checker = createSafeSourceChecker({
      transport: responseTransport([{ status: 200, ...response }]).transport,
      resolveHostname: publicResolver, limits: { maxBodyBytes: 100 },
    });
    await expect(checker.read('https://publisher.example/guide')).rejects.toThrow(error);
  });

  it('selects body documents from the validated final resource without a second fetch', async () => {
    const fixture = responseTransport([
      { status: 302, headers: { location: 'https://authority.example/canonical' } },
      { status: 200, headers: { 'content-type': 'text/html' }, body: '<main><p>Founder video planning includes rehearsing the presentation with candid feedback.</p></main>' },
      { status: 200, headers: { 'content-type': 'text/html' }, body: '<article><p>Founder video planning works backward from the release date to leave time for review.</p></article>' },
    ]);
    const checker = createSafeSourceChecker({
      transport: fixture.transport, resolveHostname: publicResolver,
      authorityPolicies: [{ hostname: 'authority.example' }],
    });
    expect(checker.selectWithContent).toBeTypeOf('function');
    const selection = await checker.selectWithContent([
      'https://publisher.example/original', 'https://publisher.example/planning',
    ], { query: 'founder video planning' });
    expect(selection.sources).toEqual([
      { originalUrl: 'https://publisher.example/original', finalUrl: 'https://authority.example/canonical', authoritative: true },
      { originalUrl: 'https://publisher.example/planning', finalUrl: 'https://publisher.example/planning', authoritative: false },
    ]);
    expect(selection.sourceDocuments[0].text).toBe('Founder video planning includes rehearsing the presentation with candid feedback.');
    expect(selection.sourceDocuments[0].finalUrl).toBe('https://authority.example/canonical');
    expect(fixture.requests.map(({ url }) => url)).toEqual([
      'https://publisher.example/original', 'https://authority.example/canonical', 'https://publisher.example/planning',
    ]);
  });

  it('does not count an authoritative empty page as usable body evidence', async () => {
    const fixture = responseTransport([
      { status: 200, headers: { 'content-type': 'text/html' }, body: '<html><nav>Home</nav></html>' },
      { status: 200, headers: { 'content-type': 'text/html' }, body: '<p>Review the final video before sharing it with an investor.</p>' },
    ]);
    const checker = createSafeSourceChecker({
      transport: fixture.transport, resolveHostname: publicResolver,
      authorityPolicies: [{ hostname: 'authority.example' }],
    });
    expect(checker.selectWithContent).toBeTypeOf('function');
    await expect(checker.selectWithContent([
      'https://authority.example/empty', 'https://publisher.example/source',
    ])).rejects.toThrow(/two.*body.*authoritative/i);
  });

  it('canonicalizes fragments before deciding whether final resources are distinct', async () => {
    const fixture = responseTransport([
      { status: 200, body: 'same page' },
      { status: 200, body: 'same page' },
    ]);
    const checker = createSafeSourceChecker({
      transport: fixture.transport,
      resolveHostname: publicResolver,
      authorityPolicies: [{ hostname: 'authority.example' }],
    });

    await expect(checker.select([
      'https://authority.example/reference#introduction',
      'https://authority.example/reference#details',
    ])).rejects.toThrow(/two reachable.*authoritative/i);
    expect(fixture.requests.every(({ url }) => !url.includes('#'))).toBe(true);
  });

  it('continues after an unsafe candidate and uses later reachable sources', async () => {
    const fixture = responseTransport([
      { status: 200, body: 'authority' },
      { status: 200, body: 'publisher' },
    ]);
    const checker = createSafeSourceChecker({
      transport: fixture.transport,
      resolveHostname: publicResolver,
      authorityPolicies: [{ hostname: 'authority.example' }],
    });

    await expect(checker.select([
      'http://127.0.0.1/private',
      'https://authority.example/reference',
      'https://publisher.example/guide',
    ])).resolves.toEqual([
      { originalUrl: 'https://authority.example/reference', finalUrl: 'https://authority.example/reference', authoritative: true },
      { originalUrl: 'https://publisher.example/guide', finalUrl: 'https://publisher.example/guide', authoritative: false },
    ]);
  });

  it('uses only exact caller-supplied authority hosts and path prefixes', async () => {
    const fixture = responseTransport([
      { status: 200, body: 'standard' },
      { status: 200, body: 'primary documentation' },
      { status: 200, body: 'encyclopedia' },
    ]);
    const checker = createSafeSourceChecker({
      transport: fixture.transport,
      resolveHostname: publicResolver,
      authorityPolicies: [
        { hostname: 'standards.example' },
        { hostname: 'product.example', pathPrefix: '/docs/' },
      ],
    });

    await expect(checker.check('https://standards.example/spec')).resolves.toMatchObject({
      authoritative: true,
    });
    await expect(checker.check('https://product.example/press/facts')).resolves.toMatchObject({
      authoritative: false,
    });
    await expect(checker.check('https://wikipedia.org/wiki/Video')).resolves.toMatchObject({
      authoritative: false,
    });
  });

  it('requires two distinct reachable sources including one authoritative source', async () => {
    const passing = createSafeSourceChecker({
      transport: responseTransport([
        { status: 200, body: 'first' },
        { status: 200, body: 'second' },
      ]).transport,
      resolveHostname: publicResolver,
      authorityPolicies: [{ hostname: 'authority.example' }],
    });
    const selected = await passing.select([
      'https://authority.example/reference',
      'https://publisher.example/guide',
    ]);
    expect(selected).toEqual([
      { originalUrl: 'https://authority.example/reference', finalUrl: 'https://authority.example/reference', authoritative: true },
      { originalUrl: 'https://publisher.example/guide', finalUrl: 'https://publisher.example/guide', authoritative: false },
    ]);

    const failing = createSafeSourceChecker({
      transport: responseTransport([
        { status: 200, body: 'first' },
        { status: 404, body: 'missing' },
      ]).transport,
      resolveHostname: publicResolver,
    });
    await expect(failing.select([
      'https://one.example/reference',
      'https://two.example/missing',
    ])).rejects.toThrow(/two reachable.*authoritative/i);
  });
});
