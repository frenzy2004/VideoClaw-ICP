import {describe, expect, it} from 'vitest';
import {scoreSourceTopic, sourceTopicQuery} from './source-relevance';
import {createSafeSourceChecker} from './sources';

describe('bounded topic word forms', () => {
  it.each(['automate', 'automated', 'automating', 'automation', 'automatic', 'automatically'])
  ('recognizes %s as the same automation topic without changing source prose', form => {
    const body = `Teams use ${form} video editing to remove pauses before reviewing the result.`;
    expect(scoreSourceTopic('automate video editing', body)).toBeGreaterThan(0);
    expect(body).toContain(form);
  });

  it.each(['edit', 'edited', 'editing'])('recognizes the bounded edit form %s', form => {
    expect(scoreSourceTopic('automate video editing', `Teams automatically ${form} video clips before the human reviewer checks the result.`)).toBeGreaterThan(0);
  });

  it('normalizes query and prose symmetrically, while preserving the discovery query', () => {
    expect(scoreSourceTopic('automated video editing', 'Teams automate video edits to remove pauses before reviewing the result.')).toBeGreaterThan(0);
    expect(sourceTopicQuery('How to automate video editing')).toBe('automate video editing');
  });

  it.each([
    ['automate video editing', 'Automotive video editing uses a different topic with extra descriptive words.'],
    ['automate video editing', 'Automatic video editorial coverage includes additional topic words for publication.'],
    ['automate video editing', 'Automatic video editors can be people reviewing footage inside a production company.'],
    ['automate video editing', 'We automate several database tasks before a review. Video editing requires different technical tools.'],
    ['automate video editing', 'Automate video editing.'],
    ['automate video editing', 'We discuss automatic editing for manuscripts with a separate review process.'],
    ['automate testimonial video editing', 'Automatic video editing removes pauses before reviewing the result.'],
    ['automate video editing', 'Automate video editing '+ 'padding '.repeat(50)],
  ])('does not broaden %s to unrelated, incomplete or oversized prose (%s)', (query, body) => {
    expect(scoreSourceTopic(query, body)).toBe(0);
  });

  it('does not combine a heading with unrelated body to manufacture a topic match', () => {
    const heading='Automatic video editing ';
    expect(scoreSourceTopic('automate video editing', heading+'Teams review a completely separate database export before uploading it.', heading.length)).toBe(0);
    expect(scoreSourceTopic('automate video editing', 'Automatic video editing removes pauses before review.', -1)).toBe(0);
  });

  it('selects real parsed bodies with these forms and retains their exact text', async () => {
    const bodies = new Map([
      ['https://authority.example/guide', 'A team can automate video editing by applying a repeatable sequence before human review.'],
      ['https://vendor.example/tool', 'Automated video editing removes pauses so the reviewer can focus on the message.'],
    ]);
    const checker=createSafeSourceChecker({
      authorityPolicies:[{hostname:'authority.example',pathPrefix:'/guide'}],
      resolveHostname:async()=>['93.184.216.34'],
      transport:async request=>({status:200,url:request.url,redirected:false,peerAddress:request.allowedPeerAddresses[0],
        headers:{'content-type':'text/html'},body:(async function*(){yield new TextEncoder().encode(`<article><p>${bodies.get(request.url)}</p></article>`);})()}),
    });
    const result=await checker.selectWithContent([...bodies.keys()],{query:'automate video editing'});
    expect(result.sourceDocuments).toHaveLength(2);
    for(const doc of result.sourceDocuments)expect(doc.passages.map(p=>p.text).join(' ')).toBe(bodies.get(doc.url));
    expect(result.sources.filter(s=>s.authoritative)).toHaveLength(1);
  });
});
