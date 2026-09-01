import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_URLS,
  buildBreadcrumbSchema,
  buildFaqSchema,
  campaignRobots,
  formatCampaignEvent,
} from './campaign-content';

describe('campaign content contracts', () => {
  it('keeps previews out of search unless the production flag is exact', () => {
    expect(campaignRobots(undefined)).toEqual({ index: false, follow: false });
    expect(campaignRobots('false')).toEqual({ index: false, follow: false });
    expect(campaignRobots('TRUE')).toEqual({ index: false, follow: false });
    expect(campaignRobots('true')).toEqual({ index: true, follow: true });
  });

  it('keeps the approved campaign and alpha-access destinations exact', () => {
    expect(CAMPAIGN_URLS).toMatchObject({
      alphaDownload: 'https://videoclaw.com/alpha/download',
      useCasePath: '/use-cases/demo-day-founder-content',
      guidePath: '/guides/founder-story-after-demo-day',
      sourcePackPath: '/#source-pack',
    });
  });

  it('builds FAQ schema from the same visible answer data', () => {
    expect(
      buildFaqSchema([
        {
          question: 'Can I use a prototype?',
          answer: 'Yes, when it is labeled accurately.',
        },
      ]),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Can I use a prototype?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes, when it is labeled accurately.',
          },
        },
      ],
    });
  });

  it('builds ordered breadcrumbs and retains the final item URL', () => {
    expect(
      buildBreadcrumbSchema([
        { name: 'VideoClaw', url: 'https://videoclaw.com/' },
        {
          name: 'Demo Day founder content',
          url: 'https://videoclaw.com/use-cases/demo-day-founder-content',
        },
      ]),
    ).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { position: 1, name: 'VideoClaw', item: 'https://videoclaw.com/' },
        {
          position: 2,
          name: 'Demo Day founder content',
          item: 'https://videoclaw.com/use-cases/demo-day-founder-content',
        },
      ],
    });
  });

  it('formats an anonymous page event without optional fields', () => {
    expect(
      formatCampaignEvent({
        event: 'page_view',
        pagePath: '/use-cases/demo-day-founder-content',
        timestamp: '2026-09-01T00:00:00.000Z',
      }),
    ).toEqual({
      event: 'page_view',
      page_path: '/use-cases/demo-day-founder-content',
      timestamp: '2026-09-01T00:00:00.000Z',
    });
  });

  it('includes the required stable context for video events', () => {
    expect(
      formatCampaignEvent({
        event: 'video_play',
        pagePath: '/use-cases/demo-day-founder-content',
        timestamp: '2026-09-01T00:00:00.000Z',
        videoId: 'investor-cut',
      }),
    ).toEqual({
      event: 'video_play',
      page_path: '/use-cases/demo-day-founder-content',
      timestamp: '2026-09-01T00:00:00.000Z',
      video_id: 'investor-cut',
    });
  });

  it('strips query strings and fragments from event paths', () => {
    expect(
      formatCampaignEvent({
        event: 'alpha_download_click',
        pagePath: '/use-cases/demo-day-founder-content?email=founder@example.com#cta',
        timestamp: '2026-09-01T00:00:00.000Z',
        href: 'https://videoclaw.com/alpha/download?email=founder@example.com#form',
      }),
    ).toEqual({
      event: 'alpha_download_click',
      page_path: '/use-cases/demo-day-founder-content',
      timestamp: '2026-09-01T00:00:00.000Z',
      href: 'https://videoclaw.com/alpha/download',
    });
  });

  it('drops non-VideoClaw link destinations from analytics', () => {
    expect(
      formatCampaignEvent({
        event: 'article_click',
        pagePath: '/guides/founder-story-after-demo-day',
        timestamp: '2026-09-01T00:00:00.000Z',
        href: 'https://example.com/founder/private-id?email=founder@example.com',
      }),
    ).toEqual({
      event: 'article_click',
      page_path: '/guides/founder-story-after-demo-day',
      timestamp: '2026-09-01T00:00:00.000Z',
    });
  });

  if (false) {
    // @ts-expect-error Video events require a stable videoId.
    formatCampaignEvent({
      event: 'video_complete',
      pagePath: '/use-cases/demo-day-founder-content',
      timestamp: '2026-09-01T00:00:00.000Z',
    });
  }
});
