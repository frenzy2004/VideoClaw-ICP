import type { Metadata } from 'next';

const SITE_URL = 'https://videoclaw.com';

export const CAMPAIGN_URLS = {
  siteHome: `${SITE_URL}/`,
  alphaDownload: `${SITE_URL}/alpha/download`,
  useCasePath: '/use-cases/demo-day-founder-content',
  useCase: `${SITE_URL}/use-cases/demo-day-founder-content`,
  guidePath: '/guides/founder-story-after-demo-day',
  guide: `${SITE_URL}/guides/founder-story-after-demo-day`,
  sourcePackPath: '/#source-pack',
} as const;

export type CampaignFaq = {
  question: string;
  answer: string;
};

export type BreadcrumbItem = {
  name: string;
  url: string;
};

export type CampaignEventName =
  | 'page_view'
  | 'video_play'
  | 'video_complete'
  | 'article_click'
  | 'source_pack_complete'
  | 'alpha_download_click';

type CampaignEventBaseInput = {
  pagePath: string;
  timestamp: string;
  context?: CampaignEventContext;
};

export type CampaignEventContext = Partial<{
  cta_id: string;
  placement: string;
  article_id: string;
  link_id: string;
  source_pack_id: string;
  source_type: string;
  items_total: number;
  items_completed: number;
}>;

export type CampaignEventInput =
  | (CampaignEventBaseInput & {
      event: 'page_view' | 'source_pack_complete';
      href?: never;
      videoId?: never;
    })
  | (CampaignEventBaseInput & {
      event: 'article_click' | 'alpha_download_click';
      href?: string;
      videoId?: never;
    })
  | (CampaignEventBaseInput & {
      event: 'video_play' | 'video_complete';
      href?: never;
      videoId: string;
    });

export type CampaignEvent = {
  event: CampaignEventName;
  page_path: string;
  timestamp: string;
  href?: string;
  video_id?: string;
  context?: CampaignEventContext;
};

export function isPublicIndexingEnabled(value = process.env.NEXT_PUBLIC_VIDEOCLAW_PUBLIC_INDEXING) {
  return value === 'true';
}

export function campaignRobots(value?: string): Metadata['robots'] {
  const publicIndexing = isPublicIndexingEnabled(value);

  return {
    index: publicIndexing,
    follow: publicIndexing,
  };
}

export function buildFaqSchema(faqs: CampaignFaq[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    })),
  };
}

export function buildBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(({ name, url }, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: url,
    })),
  };
}

export function formatCampaignEvent(input: CampaignEventInput): CampaignEvent {
  const href = 'href' in input ? normalizeSameSiteHref(input.href) : undefined;
  const context = sanitizeContext(input.context);

  return {
    event: input.event,
    page_path: normalizePagePath(input.pagePath),
    timestamp: input.timestamp,
    ...(href ? { href } : {}),
    ...('videoId' in input && input.videoId ? { video_id: input.videoId } : {}),
    ...(context ? { context } : {}),
  };
}

function sanitizeContext(context: CampaignEventContext | undefined) {
  if (!context) return undefined;

  const sanitized: CampaignEventContext = {};
  const stringKeys = [
    'cta_id',
    'placement',
    'article_id',
    'link_id',
    'source_pack_id',
    'source_type',
  ] as const;
  const numberKeys = ['items_total', 'items_completed'] as const;

  for (const key of stringKeys) {
    if (typeof context[key] === 'string' && context[key]) sanitized[key] = context[key];
  }
  for (const key of numberKeys) {
    if (typeof context[key] === 'number' && Number.isFinite(context[key])) sanitized[key] = context[key];
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function normalizePagePath(value: string) {
  try {
    return new URL(value, SITE_URL).pathname;
  } catch {
    return '/';
  }
}

function normalizeSameSiteHref(value: string | undefined) {
  if (!value) return undefined;

  try {
    const url = new URL(value, SITE_URL);
    if (url.origin !== SITE_URL) return undefined;

    return /^https?:\/\//i.test(value) ? `${url.origin}${url.pathname}` : url.pathname;
  } catch {
    return undefined;
  }
}
