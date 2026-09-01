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

export type FaqSchema = {
  '@context': 'https://schema.org';
  '@type': 'FAQPage';
  mainEntity: Array<{
    '@type': 'Question';
    name: string;
    acceptedAnswer: { '@type': 'Answer'; text: string };
  }>;
};

export type BreadcrumbSchema = {
  '@context': 'https://schema.org';
  '@type': 'BreadcrumbList';
  itemListElement: Array<{
    '@type': 'ListItem';
    position: number;
    name: string;
    item: string;
  }>;
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

export function buildFaqSchema(faqs: CampaignFaq[]): FaqSchema {
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

export function buildBreadcrumbSchema(items: BreadcrumbItem[]): BreadcrumbSchema {
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
  const videoId = 'videoId' in input ? sanitizeIdentifier(input.videoId) : undefined;

  return {
    event: input.event,
    page_path: normalizePagePath(input.pagePath),
    timestamp: input.timestamp,
    ...(href ? { href } : {}),
    ...(videoId ? { video_id: videoId } : {}),
    ...(context ? { context } : {}),
  };
}

export function sanitizeCampaignEvent(value: unknown): CampaignEvent | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (!isCampaignEventName(record.event)) return undefined;
  if (typeof record.page_path !== 'string' || typeof record.timestamp !== 'string') return undefined;

  const context =
    record.context && typeof record.context === 'object'
      ? (record.context as CampaignEventContext)
      : undefined;

  if (record.event === 'video_play' || record.event === 'video_complete') {
    if (typeof record.video_id !== 'string' || !sanitizeIdentifier(record.video_id)) return undefined;
    return formatCampaignEvent({
      event: record.event,
      pagePath: record.page_path,
      timestamp: record.timestamp,
      videoId: record.video_id,
      context,
    });
  }

  if (record.event === 'article_click' || record.event === 'alpha_download_click') {
    return formatCampaignEvent({
      event: record.event,
      pagePath: record.page_path,
      timestamp: record.timestamp,
      href: typeof record.href === 'string' ? record.href : undefined,
      context,
    });
  }

  return formatCampaignEvent({
    event: record.event,
    pagePath: record.page_path,
    timestamp: record.timestamp,
    context,
  });
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
    const value = context[key];
    if (typeof value === 'string' && sanitizeIdentifier(value)) sanitized[key] = value;
  }
  for (const key of numberKeys) {
    if (typeof context[key] === 'number' && Number.isFinite(context[key])) sanitized[key] = context[key];
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function normalizePagePath(value: string) {
  try {
    const pathname = new URL(value, SITE_URL).pathname;
    return SAFE_PAGE_PATHS.has(pathname) ? pathname : '/other';
  } catch {
    return '/other';
  }
}

function normalizeSameSiteHref(value: string | undefined) {
  if (!value) return undefined;

  try {
    const url = new URL(value, SITE_URL);
    if (url.origin !== SITE_URL) return undefined;
    if (!SAFE_HREF_PATHS.has(url.pathname)) return undefined;

    return /^https?:\/\//i.test(value) ? `${url.origin}${url.pathname}` : url.pathname;
  } catch {
    return undefined;
  }
}

const SAFE_PAGE_PATHS = new Set<string>(['/', CAMPAIGN_URLS.useCasePath, CAMPAIGN_URLS.guidePath]);
const SAFE_HREF_PATHS = new Set<string>([
  ...SAFE_PAGE_PATHS,
  new URL(CAMPAIGN_URLS.alphaDownload).pathname,
]);
const SAFE_IDENTIFIER = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function sanitizeIdentifier(value: string | undefined) {
  if (!value || value.length > 80 || !SAFE_IDENTIFIER.test(value)) return undefined;
  return value;
}

function isCampaignEventName(value: unknown): value is CampaignEventName {
  return (
    value === 'page_view' ||
    value === 'video_play' ||
    value === 'video_complete' ||
    value === 'article_click' ||
    value === 'source_pack_complete' ||
    value === 'alpha_download_click'
  );
}
