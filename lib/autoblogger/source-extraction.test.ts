import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { createSafeSourceChecker } from './sources';

function checkerFor(html: string, contentType = 'text/html; charset=utf-8') {
  return createSafeSourceChecker({
    resolveHostname: async () => ['93.184.216.34'],
    transport: async (request) => ({
      status: 200, url: request.url, redirected: false,
      peerAddress: request.allowedPeerAddresses[0],
      headers: { 'content-type': contentType },
      body: (async function* () { yield new TextEncoder().encode(html); })(),
    }),
  });
}

describe('verified source body extraction', () => {
  it('preserves a heading qualification and adjacent prose while distinguishing where body evidence starts', async () => {
    const html = '<h2>Current batch only</h2><p>A product demo should walk buyers through a realistic workflow.</p>'
      + '<p>Do not present unfinished features as available.</p>';
    const document = await checkerFor(html).read('https://publisher.example/qualified');
    expect(document.passages).toEqual([{
      text: 'Current batch only A product demo should walk buyers through a realistic workflow. Do not present unfinished features as available.',
      start: 0, end: document.text.length, bodyStart: 19,
    }]);
    expect(document.text.slice(document.passages[0].start, document.passages[0].end)).toBe(document.passages[0].text);
  });

  it('records an explicit body start for a passage without a heading', async () => {
    const document = await checkerFor('<p>A product demo should walk buyers through a realistic workflow.</p>').read('https://publisher.example/plain');
    expect(document.passages[0]).toMatchObject({ bodyStart: 0 });
  });

  it('omits a whole context group with invisible format controls before draft validation', async () => {
    const html = '<main><section><p>\u200d \u200d This source group contains invisible joiners in its prose.</p></section>'
      + '<section><p>Rehearse the founder video before sharing the final file.</p></section></main>';
    const document = await checkerFor(html).read('https://publisher.example/format', { query: 'founder video' });
    expect(document.passages.map(({ text }) => text)).toEqual([
      'Rehearse the founder video before sharing the final file.',
    ]);
    expect(document.text).not.toMatch(/\p{Cf}/u);
  });

  it.each([16, 30])('keeps a typical long section of %s sentences with its final qualification', async (sentences) => {
    const body = 'Review the script with the assigned reviewer. '.repeat(sentences).trim();
    const html = '<main><h2>Video script review</h2><p>' + body
      + '</p><p>These instructions apply to the current course cohort only.</p></main>';
    const document = await checkerFor(html).read('https://publisher.example/video', { query: 'video script' });
    expect(document.passages.map(({ text }) => text)).toEqual([
      `Video script review ${body} These instructions apply to the current course cohort only.`,
    ]);
    expect(document.text.length).toBeGreaterThan(700);
    expect(document.text.length).toBeLessThan(1_500);
  });

  it('selects the article inside main without unrelated sibling or outside articles', async () => {
    const html = '<article><p>An unrelated page teaser advertises another video.</p></article>'
      + '<main><section><p>Sidebar promotions offer video production discounts.</p></section>'
      + '<article><h2>Video planning</h2><p>Assign an owner to review the script before recording.</p></article>'
      + '<section><p>The page promotion offers video production discounts.</p></section></main>';
    const document = await checkerFor(html).read('https://publisher.example/video', { query: 'video planning' });
    expect(document.passages.map(({ text }) => text)).toEqual([
      'Video planning Assign an owner to review the script before recording.',
    ]);
  });

  it.each(['w-richtext', 'fl-rich-text', 'sl-markdown-content'])('selects the substantive %s body instead of surrounding page UI', async (className) => {
    const html = '<main><div class="' + className + '"><p>Video preview.</p></div>'
      + '<div class="' + className + '"><h2>Video planning</h2>'
      + '<p>Assign an owner to review the script before recording.</p></div>'
      + '<div><h2>Page tools</h2><p>Use the floating control to send us a message about this video.</p></div></main>';
    const document = await checkerFor(html).read('https://publisher.example/video', { query: 'video planning' });
    expect(document.passages.map(({ text }) => text)).toEqual([
      'Video planning Assign an owner to review the script before recording.',
    ]);
  });

  it.each([
    'class="w-richtext"',
    'class="fl-rich-text"',
    'class="sl-markdown-content"',
    'itemprop="articleBody"',
  ])('selects the substantive %s body over a smaller sibling article teaser', async (attributes) => {
    const html = '<main><div ' + attributes + '><h1>Demo Day video checklist</h1>'
      + '<p>Plan the investor presentation around one customer problem, preserve the organizer restrictions, and prepare a backup recording before the event.</p>'
      + '<p>Only invited founders in the current batch may present.</p></div>'
      + '<article class="post-card"><h2>More video planning</h2>'
      + '<p>Read our other video planning article for equipment discounts and recording offers.</p></article></main>';
    const document = await checkerFor(html).read('https://publisher.example/demo', { query: 'demo day video checklist' });
    expect(document.passages.map(({ text }) => text)).toEqual([
      'Plan the investor presentation around one customer problem, preserve the organizer restrictions, and prepare a backup recording before the event. Only invited founders in the current batch may present.',
    ]);
    for (const passage of document.passages) {
      expect(document.text.slice(passage.start, passage.end)).toBe(passage.text);
    }
  });

  it('keeps the substantive article over a smaller marked CMS teaser', async () => {
    const html = '<main><div class="w-richtext"><h2>More video planning</h2>'
      + '<p>Read our other video planning article for equipment discounts and recording offers.</p></div>'
      + '<article><h1>Demo Day video checklist</h1>'
      + '<p>Plan the investor presentation around one customer problem, preserve the organizer restrictions, and prepare a backup recording before the event.</p>'
      + '<p>Only invited founders in the current batch may present.</p></article></main>';
    const document = await checkerFor(html).read('https://publisher.example/demo', { query: 'demo day video checklist' });
    expect(document.passages.map(({ text }) => text)).toEqual([
      'Plan the investor presentation around one customer problem, preserve the organizer restrictions, and prepare a backup recording before the event. Only invited founders in the current batch may present.',
    ]);
  });

  it('removes structurally identified TOC and analytics UI without censoring article wording', async () => {
    const html = '<main><article><h2>Video planning</h2>'
      + '<div id="toc-generated-123"><p>Video planning navigation links are listed here.</p></div>'
      + '<p>Review video analytics and audience feedback when preparing the next recording.</p>'
      + '<div class="analytics-modal"><p>The page analytics panel lists your browsing history.</p></div>'
      + '<div class="page-feedback"><p>Rate this page using the controls provided here.</p></div>'
      + '<div class="privacy-notice"><p>This page tracks visits for anonymous analytics.</p></div>'
      + '<div class="not-content"><p>This floating assistant displays selected page text.</p></div></article></main>';
    const document = await checkerFor(html).read('https://publisher.example/video', { query: 'video planning' });
    expect(document.passages.map(({ text }) => text)).toEqual([
      'Video planning Review video analytics and audience feedback when preparing the next recording.',
    ]);
  });

  it('keeps an adjacent short qualification in the same fact as its claim', async () => {
    const html = '<main><h2>Who presents at Demo Day?</h2>'
      + '<p>All founders can present at Demo Day.</p><p>Current batch only.</p></main>';
    const document = await checkerFor(html).read('https://publisher.example/scope', {
      query: 'demo day',
    });
    expect(document.passages.map(({ text }) => text)).toEqual([
      'Who presents at Demo Day? All founders can present at Demo Day. Current batch only.',
    ]);
  });

  it('retains preceding context across layout wrappers without recognizing qualification keywords', async () => {
    const html = '<main><h2>Participation</h2><div><p>Registered participants.</p></div>'
      + '<div><p>Founders can present their companies at Demo Day.</p></div></main>';
    const document = await checkerFor(html).read('https://publisher.example/scope', { query: 'demo day' });
    expect(document.passages.map(({ text }) => text)).toEqual([
      'Participation Registered participants. Founders can present their companies at Demo Day.',
    ]);
  });

  it.each(['passage', 'character'])('keeps a low-scoring qualification with its claim under the %s cap', async (cap) => {
    const filler = cap === 'character' ? 'Review the recording with a colleague. '.repeat(12) : '';
    const html = '<main><section><p>All founders can present at Demo Day.</p>'
      + '<p>This applies to members of the current batch, not outside applicants.</p></section>'
      + Array.from({ length: 30 }, (_, index) => '<section><p>'
        + `Demo day video checklist item ${index}: ${filler}Follow the organizer instructions.`
        + '</p></section>').join('') + '</main>';
    const document = await checkerFor(html).read('https://publisher.example/scope', {
      query: 'demo day video checklist', questions: ['Who presents at Demo Day?'],
    });
    expect(document.passages.map(({ text }) => text)).toContain(
      'All founders can present at Demo Day. This applies to members of the current batch, not outside applicants.',
    );
    expect(document.passages.length).toBeLessThanOrEqual(20);
    expect(document.text.length).toBeLessThanOrEqual(8_000);
    for (const passage of document.passages) {
      expect(document.text.slice(passage.start, passage.end)).toBe(passage.text);
      expect(passage.text.length).toBeLessThanOrEqual(2_000);
    }
  });

  it('omits a claim when its complete adjacent context exceeds the passage budget', async () => {
    const html = '<main><h2>Demo Day participation</h2>'
      + '<p>All founders can present at Demo Day.</p><p>'
      + 'Review the applicable admission conditions carefully. '.repeat(45)
      + 'Current batch only.</p><h2>Preparation</h2>'
      + '<p>Check the current organizer instructions before preparing a video.</p></main>';
    const document = await checkerFor(html).read('https://publisher.example/scope', { query: 'demo day video' });
    expect(document.passages.map(({ text }) => text)).toEqual([
      'Preparation Check the current organizer instructions before preparing a video.',
    ]);
    expect(document.text).not.toContain('All founders');
  });

  it('rejects unrelated prose even when navigation repeats the topic', async () => {
    const checker = checkerFor('<nav>Demo day video checklist</nav><article>'
      + '<p>Payroll tax withholding depends on the employee earnings and tax code.</p></article>');
    await expect(checker.read('https://publisher.example/payroll', {
      query: 'demo day video checklist', questions: ['How does YC Demo Day work?'],
    })).rejects.toThrow(/relevant body evidence/i);
  });

  it('bounds text across twenty long passages without splitting a qualification', async () => {
    const html = '<main>' + Array.from({ length: 30 }, (_, index) => (
      `<section><p>Video planning item ${index}: ${'Review the recording with a colleague. '.repeat(12)}Follow organizer rules.</p></section>`
    )).join('') + '</main>';
    const document = await checkerFor(html).read('https://publisher.example/long', { query: 'video planning' });
    expect(document.passages.length).toBeGreaterThanOrEqual(12);
    expect(document.passages.length).toBeLessThanOrEqual(20);
    expect(document.text.length).toBeLessThanOrEqual(8_000);
    expect(document.passages.every(({ text }) => text.endsWith('Follow organizer rules.'))).toBe(true);
  });

  it('rejects pathological nesting without traversing an unbounded DOM', async () => {
    const html = '<div>'.repeat(100) + '<p>Read the final video instructions before recording.</p>' + '</div>'.repeat(100);
    await expect(checkerFor(html).read('https://publisher.example/nested')).rejects.toThrow(/structural limits/i);
  });

  it('returns exact decoded body passages and fetch provenance, not metadata or page chrome', async () => {
    const html = '<html><head><title>Unverified title claim</title></head><body>'
      + '<nav><p>Demo day video navigation has amazing investor outcomes.</p></nav>'
      + '<main><h1>Demo Day</h1><p>Founders present their companies to selected investors &amp; press.</p>'
      + '<p>Record <strong>rehearsals</strong> for feedback before the presentation.</p>'
      + '<script>globalThis.sourceScriptExecuted = true;</script>'
      + '<p hidden>Hidden attendance is guaranteed for all applicants.</p>'
      + '<div aria-hidden="true"><p>Invisible financial promise for founders.</p></div>'
      + '<footer><p>Subscribe for our video deals and promotions today.</p></footer></main></body></html>';
    const checker = checkerFor(html);
    expect(checker.read).toBeTypeOf('function');
    const document = await checker.read('https://publisher.example/demo', { query: 'demo day video' });
    expect(document.passages.map(({ text }) => text)).toEqual([
      'Founders present their companies to selected investors & press. Record rehearsals for feedback before the presentation.',
    ]);
    expect(document).toMatchObject({
      url: 'https://publisher.example/demo', finalUrl: 'https://publisher.example/demo',
      status: 200, reachable: true, contentType: 'text/html',
      bodySha256: createHash('sha256').update(html).digest('hex'),
    });
    expect(Number.isNaN(Date.parse(document.checkedAt))).toBe(false);
    for (const passage of document.passages) {
      expect(document.text.slice(passage.start, passage.end)).toBe(passage.text);
    }
    expect(document.text).not.toMatch(/claim|navigation|Hidden|Invisible|Subscribe|sourceScript/);
    expect(document).not.toHaveProperty('html');
  });

  it('prioritizes a late FAQ answer over generic paragraphs without losing its qualification', async () => {
    const html = '<main>' + Array.from({ length: 30 }, (_, index) => (
      `<p>Video production checklist item ${index} covers recording equipment and planning.</p>`
    )).join('') + '<h2>Can anyone attend YC Demo Day?</h2>'
      + '<p>Attendance is by invitation only. The event is not open to the general public.</p></main>';
    const checker = checkerFor(html);
    expect(checker.read).toBeTypeOf('function');
    const document = await checker.read('https://publisher.example/demo', {
      query: 'video production checklist', questions: ['Can anyone attend YC Demo Day?'],
    });
    expect(document.passages.map(({ text }) => text)).toContain(
      'Can anyone attend YC Demo Day? Attendance is by invitation only. The event is not open to the general public.',
    );
    expect(document.passages.length).toBeLessThanOrEqual(20);
    expect(document.text.length).toBeLessThanOrEqual(8_000);
  });

  it('does not truncate oversized paragraphs into misleading partial claims', async () => {
    const html = '<article><section><p>' + 'Video planning is straightforward. '.repeat(70)
      + 'Except when the organizer does not permit video.</p></section><section>'
      + '<p>Check the current organizer instructions before preparing a video.</p></section></article>';
    const checker = checkerFor(html);
    expect(checker.read).toBeTypeOf('function');
    const document = await checker.read('https://publisher.example/demo');
    expect(document.passages.map(({ text }) => text)).toEqual([
      'Check the current organizer instructions before preparing a video.',
    ]);
  });

  it.each([
    ['application/json', '<main><p>This is not verified HTML page content.</p></main>'],
    ['application/pdf', '%PDF document data'],
    ['text/html', '<main><nav>Home About Contact</nav><script>const x = "facts";</script></main>'],
  ])('fails closed when %s has no usable HTML body evidence', async (contentType, html) => {
    const checker = checkerFor(html, contentType);
    expect(checker.read).toBeTypeOf('function');
    await expect(checker.read('https://publisher.example/demo')).rejects.toThrow(/content type|body evidence/i);
  });
});
