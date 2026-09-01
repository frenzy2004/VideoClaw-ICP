import type { Metadata } from 'next';

const SITE_URL = 'https://videoclaw.com';

export const CAMPAIGN_URLS = {
  siteHome: `${SITE_URL}/`,
  alphaDownload: `${SITE_URL}/alpha/download`,
  useCasePath: '/use-cases/demo-day-founder-content',
  useCase: `${SITE_URL}/use-cases/demo-day-founder-content`,
  guidePath: '/guides/founder-story-after-demo-day',
  guide: `${SITE_URL}/guides/founder-story-after-demo-day`,
  dreamPilotPath: '/pilots/dream-demo-day',
  dreamPilot: `${SITE_URL}/pilots/dream-demo-day`,
  physicalAiGuidePath: '/guides/physical-ai-product-demo-before-demo-day',
  physicalAiGuide: `${SITE_URL}/guides/physical-ai-product-demo-before-demo-day`,
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
  const context = sanitizeContext(input.context, input.event).value;
  const videoId =
    'videoId' in input && typeof input.videoId === 'string' && SAFE_VIDEO_IDS.has(input.videoId)
      ? input.videoId
      : undefined;

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
  const timestamp = sanitizeTimestamp(record.timestamp);
  if (!timestamp) return undefined;

  if (record.context !== undefined && (!record.context || typeof record.context !== 'object' || Array.isArray(record.context))) {
    return undefined;
  }
  const contextResult = sanitizeContext(record.context as CampaignEventContext | undefined, record.event);
  if (!contextResult.valid) return undefined;
  const context = contextResult.value;

  if (record.event === 'video_play' || record.event === 'video_complete') {
    if (typeof record.video_id !== 'string' || !SAFE_VIDEO_IDS.has(record.video_id)) return undefined;
    return formatCampaignEvent({
      event: record.event,
      pagePath: record.page_path,
      timestamp,
      videoId: record.video_id,
      context,
    });
  }

  if (record.event === 'article_click' || record.event === 'alpha_download_click') {
    return formatCampaignEvent({
      event: record.event,
      pagePath: record.page_path,
      timestamp,
      href: typeof record.href === 'string' ? record.href : undefined,
      context,
    });
  }

  return formatCampaignEvent({
    event: record.event,
    pagePath: record.page_path,
    timestamp,
    context,
  });
}

function sanitizeContext(context: CampaignEventContext | undefined, event: CampaignEventName) {
  if (!context) {
    return { valid: event !== 'source_pack_complete', value: undefined };
  }

  const sanitized: CampaignEventContext = {};
  const allowedKeys = CONTEXT_KEYS_BY_EVENT[event];
  let valid = true;

  for (const rawKey of Object.keys(context)) {
    if (!allowedKeys.has(rawKey as keyof CampaignEventContext)) {
      valid = false;
      continue;
    }

    const key = rawKey as keyof CampaignEventContext;
    const value = context[key];
    if (key === 'items_total' || key === 'items_completed') {
      if (value === 8) sanitized[key] = value;
      else valid = false;
      continue;
    }

    if (typeof value === 'string' && SAFE_CONTEXT_VALUES[key]?.has(value)) {
      sanitized[key] = value;
    } else {
      valid = false;
    }
  }

  if (
    event === 'source_pack_complete' &&
    (sanitized.source_pack_id !== 'demo-day-source-pack' ||
      sanitized.source_type !== 'mixed' ||
      sanitized.items_total !== 8 ||
      sanitized.items_completed !== 8)
  ) {
    valid = false;
  }

  return {
    valid,
    value: Object.keys(sanitized).length > 0 ? sanitized : undefined,
  };
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

const SAFE_PAGE_PATHS = new Set<string>([
  '/',
  CAMPAIGN_URLS.useCasePath,
  CAMPAIGN_URLS.guidePath,
  CAMPAIGN_URLS.dreamPilotPath,
  CAMPAIGN_URLS.physicalAiGuidePath,
]);
const SAFE_HREF_PATHS = new Set<string>([
  ...SAFE_PAGE_PATHS,
  new URL(CAMPAIGN_URLS.alphaDownload).pathname,
]);
const SAFE_VIDEO_IDS = new Set([
  'demo-day-core-prototype',
  'demo-day-investor-prototype',
  'demo-day-customer-prototype',
  'demo-day-recruiting-prototype',
]);

const SAFE_CONTEXT_VALUES: Partial<Record<keyof CampaignEventContext, Set<string>>> = {
  cta_id: new Set(['masthead-alpha-access', 'hero-alpha-access', 'closing-alpha-access', 'guide-alpha-access']),
  placement: new Set(['masthead', 'hero', 'closing', 'guide-body', 'guide-handoff', 'source-controls']),
  article_id: new Set([
    'demo-day-founder-content',
    'founder-story-after-demo-day',
    'demo-day-source-pack',
    'demo-day-use-case',
    'pilot-account-dossier',
    'physical-ai-demo-day-guide',
  ]),
  link_id: new Set([
    'home-use-case-nav',
    'home-guide-nav',
    'home-source-pack-hero',
    'home-source-pack-closing',
    'guide-use-case-nav',
    'guide-use-case-header',
    'guide-source-pack',
    'guide-use-case',
    'use-case-guide-nav',
    'hero-source-pack',
    'source-controls-check',
    'closing-source-pack',
    'pilot-physical-ai-guide',
    'physical-ai-guide-download',
    'physical-ai-guide-use-case',
    'use-case-physical-ai-guide',
  ]),
  source_pack_id: new Set(['demo-day-source-pack']),
  source_type: new Set(['mixed']),
};

const CONTEXT_KEYS_BY_EVENT: Record<CampaignEventName, Set<keyof CampaignEventContext>> = {
  page_view: new Set(),
  video_play: new Set(),
  video_complete: new Set(),
  article_click: new Set(['placement', 'article_id', 'link_id']),
  alpha_download_click: new Set(['placement', 'cta_id']),
  source_pack_complete: new Set(['source_pack_id', 'source_type', 'items_total', 'items_completed']),
};

function sanitizeTimestamp(value: string) {
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime()) || timestamp.toISOString() !== value) return undefined;
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
