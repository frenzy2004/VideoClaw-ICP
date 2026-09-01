'use client';

import { useEffect, useRef } from 'react';
import {
  sanitizeCampaignEvent,
  type CampaignEvent,
  type CampaignEventContext,
} from './campaign-content';
import { campaignAnalyticsSuppressed, emitCampaignEvent } from './campaign-analytics';

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

function mirrorToDataLayer(event: CampaignEvent) {
  if (!Array.isArray(window.dataLayer)) return;
  window.dataLayer.push(event);
}

function contextFromElement(element: HTMLElement): CampaignEventContext {
  const context: CampaignEventContext = {};
  if (element.dataset.vcCtaId) context.cta_id = element.dataset.vcCtaId;
  if (element.dataset.vcPlacement) context.placement = element.dataset.vcPlacement;
  if (element.dataset.vcArticleId) context.article_id = element.dataset.vcArticleId;
  if (element.dataset.vcLinkId) context.link_id = element.dataset.vcLinkId;
  return context;
}

export default function CampaignEventTracker() {
  const pageViewSent = useRef(false);

  useEffect(() => {
    function handleAnalytics(event: Event) {
      if (campaignAnalyticsSuppressed()) return;
      const sanitized = sanitizeCampaignEvent((event as CustomEvent<unknown>).detail);
      if (sanitized) mirrorToDataLayer(sanitized);
    }

    function handleClick(event: MouseEvent) {
      const origin = event.target;
      if (!(origin instanceof Element)) return;
      const element = origin.closest<HTMLElement>('[data-vc-event]');
      if (!element) return;

      const eventName = element.dataset.vcEvent;
      if (eventName !== 'article_click' && eventName !== 'alpha_download_click') return;
      const href = element instanceof HTMLAnchorElement ? element.getAttribute('href') ?? undefined : undefined;

      emitCampaignEvent({
        event: eventName,
        pagePath: window.location.pathname,
        timestamp: new Date().toISOString(),
        href,
        context: contextFromElement(element),
      });
    }

    window.addEventListener('videoclaw:analytics', handleAnalytics);
    document.addEventListener('click', handleClick);

    if (!pageViewSent.current) {
      pageViewSent.current = emitCampaignEvent({
        event: 'page_view',
        pagePath: window.location.pathname,
        timestamp: new Date().toISOString(),
      });
    }

    return () => {
      window.removeEventListener('videoclaw:analytics', handleAnalytics);
      document.removeEventListener('click', handleClick);
    };
  }, []);

  return null;
}
