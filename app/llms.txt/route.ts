import { CAMPAIGN_URLS, isPublicIndexingEnabled } from '../campaign-content';

export function llmsText(publicIndexing = isPublicIndexingEnabled()) {
  if (!publicIndexing) {
    return [
      '# VideoClaw private review build',
      '',
      'This campaign is under owner-only editorial review and is not approved for public indexing, model citation, or production use.',
      'Campaign route inventory is intentionally omitted.',
      '',
    ].join('\n');
  }

  return [
    '# VideoClaw',
    '',
    'VideoClaw publishes practical guidance for founder-led, source-controlled video workflows.',
    '',
    '## US Demo Day founder content',
    '',
    `- Use case: ${CAMPAIGN_URLS.useCase}`,
    `- Founder guide: ${CAMPAIGN_URLS.guide}`,
    '',
  ].join('\n');
}

export function GET() {
  return new Response(llmsText(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
