import {describe, expect, it, vi} from 'vitest';
import {createSourceRelevanceReviewer, validateSourceRelevanceReceipt} from './source-admission';
import type {StructuredOutputRequest} from './openai-responses';
import type {SourceDocument} from './sources';
import {createSafeSourceChecker} from './sources';

function document(host = 'example.com'): SourceDocument {
  const heading = 'Choosing video editing software ';
  const body = 'These tools remove pauses and generate captions automatically. Compare the output against your original recording before choosing a tool.';
  const text = heading + body;
  return {url:`https://${host}/guide`, finalUrl:`https://${host}/guide`, status:200, reachable:true,
    authoritative:true, checkedAt:'2026-09-11T00:00:00.000Z', contentType:'text/html', bodySha256:'a'.repeat(64),
    text, passages:[{text, start:0, end:text.length, bodyStart:heading.length}]};
}
type Input = {contextHash:string; documents:Array<{id:string; passages:Array<{passageIndex:number; headingContext:string; bodyText:string}>}>};
function answer(request: StructuredOutputRequest) {
  const input = request.input as Input;
  return {schemaVersion:1 as const, contextHash:input.contextHash, decisions:input.documents.map(doc => ({
    documentId:doc.id, relevant:true, reason:'The body describes automated editing tasks and an output-comparison decision.',
    anchors:[{passageIndex:0, excerpt:doc.passages[0].bodyText}],
  }))};
}
const options = {query:'best automated video editor', articleTitle:'Choose an Automated Video Editor for Your GTM Team'};

describe('contextual source admission', () => {
  it('presents selectable body text separately from heading context without asking the reviewer to count offsets', async () => {
    const doc = document();
    const heading = '🎬 Pre-production steps: ';
    const body = 'Record a clean example before the shoot. Keep the original words, punctuation, and spacing.';
    doc.text = heading + body;
    doc.passages = [{text:doc.text, start:0, end:doc.text.length, bodyStart:heading.length}];
    const original = structuredClone(doc);
    const receipt = await createSourceRelevanceReviewer({generate:async request => {
      const input = request.input as {contextHash:string; documents:Array<{id:string; passages:Array<{passageIndex:number; headingContext:string; bodyText:string}>}>};
      const passage = input.documents[0].passages[0];
      expect(passage).toEqual({passageIndex:0, headingContext:'🎬 Pre-production steps: ', bodyText:'Record a clean example before the shoot. Keep the original words, punctuation, and spacing.'});
      return {schemaVersion:1, contextHash:input.contextHash, decisions:[{documentId:input.documents[0].id,
        relevant:true, reason:'The body provides preparation instructions.', anchors:[{passageIndex:passage.passageIndex, excerpt:passage.bodyText}]}]};
    }})([doc], options);
    expect(receipt.decisions[0].anchors).toEqual([{passageIndex:0, excerpt:body}]);
    expect(validateSourceRelevanceReceipt([doc], options, receipt)).toEqual(receipt);
    expect(doc).toEqual(original);
  });

  it('requests one context-bound review of exact retrieved passages, not keyword stuffing', async () => {
    const docs = [document()]; const before = structuredClone(docs);
    const generate = vi.fn(async (request: StructuredOutputRequest) => {
      expect(request.name).toBe('videoclaw_source_relevance_v1');
      expect(request.system).toMatch(/untrusted/i);
      const passage = (request.input as Input).documents[0].passages[0];
      expect(passage.headingContext + passage.bodyText).toBe(docs[0].text);
      expect((request.input as Input).documents[0].passages[0]).toHaveProperty('passageIndex', 0);
      return answer(request);
    });
    const receipt = await createSourceRelevanceReviewer({generate})(docs, options);
    expect(receipt.decisions[0].relevant).toBe(true);
    expect(receipt.contextHash).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.documents).toEqual([{documentId:'source-1', url:docs[0].finalUrl, bodySha256:docs[0].bodySha256, checkedAt:docs[0].checkedAt}]);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(docs).toEqual(before);
  });

  it('keeps an explicit negative decision and never manufactures a positive fallback', async () => {
    const generate = vi.fn(async (request: StructuredOutputRequest) => {
      const response = answer(request);
      response.decisions[0] = {...response.decisions[0], relevant:false, reason:'The body is unrelated to the reader task.', anchors:[]};
      return response;
    });
    const receipt = await createSourceRelevanceReviewer({generate})([document()], options);
    expect(receipt.decisions[0].relevant).toBe(false);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it.each(['stale', 'unknown', 'missing', 'duplicate', 'heading', 'heading-and-body', 'invented', 'wrong-passage', 'no-anchor', 'negative-anchor', 'extra-field', 'blank-reason', 'secret'])
  ('rejects %s output without retry or acceptance', async mode => {
    const generate = vi.fn(async (request: StructuredOutputRequest) => {
      const response = answer(request); const decision = response.decisions[0];
      if (mode === 'stale') response.contextHash = 'b'.repeat(64);
      if (mode === 'unknown') decision.documentId = 'source-999';
      if (mode === 'missing') response.decisions = [];
      if (mode === 'duplicate') response.decisions.push({...decision});
      if (mode === 'heading') decision.anchors[0].excerpt = 'Choosing video editing software';
      if (mode === 'heading-and-body') decision.anchors[0].excerpt = 'Choosing video editing software ' + decision.anchors[0].excerpt;
      if (mode === 'invented') decision.anchors[0].excerpt = 'This fabricated claim was not retrieved from the actual source body.';
      if (mode === 'wrong-passage') decision.anchors[0].passageIndex = 2;
      if (mode === 'no-anchor') decision.anchors = [];
      if (mode === 'negative-anchor') decision.relevant = false;
      if (mode === 'extra-field') Object.assign(response, {approved:true});
      if (mode === 'blank-reason') decision.reason = '   ';
      if (mode === 'secret') decision.reason = 'sk-proj-' + 'A'.repeat(80);
      return response;
    });
    await expect(createSourceRelevanceReviewer({generate})([document()], options)).rejects.toThrow();
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('rejects body mutation during review even if the old receipt is valid', async () => {
    const docs = [document()];
    await expect(createSourceRelevanceReviewer({generate:async request => {
      const response = answer(request); docs[0].text += ' Changed'; return response;
    }})(docs, options)).rejects.toThrow();
  });

  it.each(['empty', 'too-many', 'oversized', 'bad-offset', 'missing-heading-boundary', 'duplicate-url', 'unreachable', 'unsafe-query'])
  ('rejects %s input before any paid call', async mode => {
    const docs = [document()]; const readOptions = {...options};
    if (mode === 'empty') docs.pop();
    if (mode === 'too-many') docs.push(...Array.from({length:24}, (_, i) => document(`s${i}.example.com`)));
    if (mode === 'oversized') docs[0].text = 'a'.repeat(8001);
    if (mode === 'bad-offset') docs[0].passages[0].start = 1;
    if (mode === 'missing-heading-boundary') delete docs[0].passages[0].bodyStart;
    if (mode === 'duplicate-url') docs.push(document());
    if (mode === 'unreachable') docs[0].reachable = false;
    if (mode === 'unsafe-query') readOptions.query = 'apify_api_' + 'A'.repeat(40);
    const generate = vi.fn(async request => answer(request));
    await expect(createSourceRelevanceReviewer({generate})(docs, readOptions)).rejects.toThrow();
    expect(generate).not.toHaveBeenCalled();
  });

  it('propagates model unavailability without another call or a lexical fallback', async () => {
    const generate = vi.fn(async () => {throw new Error('Model unavailable');});
    await expect(createSourceRelevanceReviewer({generate})([document()], options)).rejects.toThrow('Model unavailable');
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it('resolves a valid but wrong paragraph index only from one exact body match on the same page', async () => {
    const docs = [document()];
    const extra = 'A second unrelated paragraph describes team planning and the ownership of source recordings.';
    const start = docs[0].text.length + 1;
    docs[0].text += ' ' + extra;
    docs[0].passages.push({text:extra, start, end:docs[0].text.length, bodyStart:0});
    const receipt = await createSourceRelevanceReviewer({generate:async request => {
      const response = answer(request); response.decisions[0].anchors[0].passageIndex = 1; return response;
    }})(docs, options);
    expect(receipt.decisions[0].anchors[0]).toMatchObject({passageIndex:0, reportedPassageIndex:1});
    expect(validateSourceRelevanceReceipt(docs, options, receipt)).toEqual(receipt);
  });

  it('does not resolve ambiguous quotes or move evidence across pages', async () => {
    for (const mode of ['ambiguous', 'cross-page']) {
      const doc = document(); const body = doc.passages[0].text.slice(doc.passages[0].bodyStart);
      const extra = 'Another paragraph contains unrelated planning advice and does not support the quoted text.';
      const bodies = mode === 'ambiguous' ? [body, body, extra] : [extra, extra];
      doc.text = bodies.join(' '); let start = 0;
      doc.passages = bodies.map(text => {const p = {text, start, end:start + text.length, bodyStart:0}; start = p.end + 1; return p;});
      const docs = mode === 'cross-page' ? [doc, document('other.example')] : [doc];
      const generate = vi.fn(async (request:StructuredOutputRequest) => {
        const response = answer(request);
        response.decisions[0].anchors[0] = {passageIndex:bodies.length - 1, excerpt:body};
        return response;
      });
      await expect(createSourceRelevanceReviewer({generate})(docs, options)).rejects.toThrow(/exact body/);
      expect(generate).toHaveBeenCalledTimes(1);
    }
  });

  it('does not accept correction metadata invented by the model', async () => {
    await expect(createSourceRelevanceReviewer({generate:async request => {
      const response = answer(request); Object.assign(response.decisions[0].anchors[0], {reportedPassageIndex:1}); return response;
    }})([document()], options)).rejects.toThrow(/Invalid source relevance/);
  });

  it('rejects duplicate canonical anchors and altered correction provenance', async () => {
    const docs = [document()]; const extra = 'A second paragraph provides separate editorial planning guidance for the team.';
    const start = docs[0].text.length + 1; docs[0].text += ' ' + extra;
    docs[0].passages.push({text:extra, start, end:docs[0].text.length, bodyStart:0});
    const reviewer = (duplicate:boolean) => createSourceRelevanceReviewer({generate:async request => {
      const response = answer(request); response.decisions[0].anchors[0].passageIndex = 1;
      if (duplicate) response.decisions[0].anchors.push({...response.decisions[0].anchors[0], passageIndex:0});
      return response;
    }});
    await expect(reviewer(true)(docs, options)).rejects.toThrow(/distinct exact body/);
    const receipt = await reviewer(false)(docs, options);
    receipt.decisions[0].anchors[0].reportedPassageIndex = 0;
    expect(() => validateSourceRelevanceReceipt(docs, options, receipt)).toThrow(/reference correction/);
  });
  it('retains and revalidates the complete document-ID mapping without relying on the selected page order', async () => {
    const docs = [document('first.example'), document('second.example')];
    const receipt = await createSourceRelevanceReviewer({generate:async request => answer(request)})(docs, options);
    expect(validateSourceRelevanceReceipt(docs, options, receipt)).toEqual(receipt);
    receipt.documents.reverse();
    expect(() => validateSourceRelevanceReceipt(docs, options, receipt)).toThrow(/provenance/);
  });
  it.each(['url', 'finalUrl'] as const)('rejects an oversized %s before generating', async field => {
    const docs = [document()]; docs[0][field] += '?padding=' + 'x'.repeat(10000);
    const generate = vi.fn(async (request:StructuredOutputRequest) => answer(request));
    await expect(createSourceRelevanceReviewer({generate})(docs, options)).rejects.toThrow(/bounded/);
    expect(generate).not.toHaveBeenCalled();
  });
  it('bounds the aggregate UTF-8 request size, not only individual character counts', async () => {
    const docs = Array.from({length:24}, (_, index) => {
      const doc = document(`s${index}.example.com`);
      doc.text = '文'.repeat(8000);
      doc.passages = Array.from({length:4}, (_, i) => ({start:i * 2000, end:(i+1) * 2000, text:'文'.repeat(2000), bodyStart:0}));
      return doc;
    });
    const generate = vi.fn(async (request:StructuredOutputRequest) => answer(request));
    await expect(createSourceRelevanceReviewer({generate})(docs, options)).rejects.toThrow(/request budget/);
    expect(generate).not.toHaveBeenCalled();
  });
});

describe('retrieval and contextual admission integration', () => {
  const bodies = new Map([
    ['https://authority.example/guide', '<article><h2>Video editing software</h2><p>These tools remove pauses and generate captions automatically. Compare the output against the original recording before choosing a tool.</p></article>'],
    ['https://vendor.example/guide', '<article><h2>Automated video editors</h2><p>Review the caption timing on a sample clip before using this tool for a client delivery.</p></article>'],
    ['https://other.example/guide', '<article><h2>Automated video editors</h2><p>This unrelated networking event welcomes everyone to an evening of fundraising speeches and cocktails.</p></article>'],
  ]);
  function checker(generate: (request:StructuredOutputRequest) => Promise<unknown>, authority = true) {
    return createSafeSourceChecker({authorityPolicies:authority ? [{hostname:'authority.example'}] : [],
      relevanceReviewer:createSourceRelevanceReviewer({generate}),
      resolveHostname:async () => ['93.184.216.34'],
      transport:async request => ({status:200, url:request.url, redirected:false, peerAddress:request.allowedPeerAddresses[0],
        headers:{'content-type':'text/html'}, body:(async function*() {yield new TextEncoder().encode(bodies.get(request.url));})()}),
    });
  }
  it('admits contextual bodies, retains exact passages and receipt, and excludes a negative page', async () => {
    const generate = vi.fn(async (request:StructuredOutputRequest) => {
      const response = answer(request);
      response.decisions[2] = {...response.decisions[2], relevant:false, reason:'Unrelated fundraising event.', anchors:[]};
      return response;
    });
    const result = await checker(generate).selectWithContent([...bodies.keys()], options);
    expect(result.sources.map(source => source.finalUrl)).toEqual([...bodies.keys()].slice(0, 2));
    expect(result.sourceDocuments[0].passages[0].text).toContain('These tools remove pauses');
    expect(result.sourceRelevanceReceipt?.decisions).toHaveLength(3);
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it('does not use positive lexical scores after configured reviewer failure', async () => {
    const generate = vi.fn(async () => {throw new Error('Review unavailable');});
    await expect(checker(generate).selectWithContent([...bodies.keys()], {query:'caption timing'})).rejects.toThrow('Review unavailable');
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it('keeps the authority requirement and avoids a paid review when none was retrieved', async () => {
    const generate = vi.fn(async (request:StructuredOutputRequest) => answer(request));
    await expect(checker(generate, false).selectWithContent([...bodies.keys()], options)).rejects.toThrow(/authoritative/);
    expect(generate).not.toHaveBeenCalled();
  });
  it('requires two admitted bodies, not just two fetched pages', async () => {
    const generate = vi.fn(async (request:StructuredOutputRequest) => {
      const response = answer(request);
      for (const decision of response.decisions.slice(1)) Object.assign(decision, {relevant:false, anchors:[]});
      return response;
    });
    await expect(checker(generate).selectWithContent([...bodies.keys()], options)).rejects.toThrow(/two directly relevant/);
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
