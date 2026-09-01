'use client';

import { useEffect, useRef } from 'react';
import {
  formatCampaignEvent,
  type CampaignEvent,
  type CampaignEventContext,
} from './campaign-content';

declare global {
  interface Window {
    dataLayer?: unknown[];
  }

  interface Navigator {
    globalPrivacyControl?: boolean;
  }
}

function analyticsSuppressed() {
  return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
}

function mirrorToDataLayer(event: CampaignEvent) {
  if (!Array.isArray(window.dataLayer)) return;
  window.dataLayer.push(event);
}

function emit(event: CampaignEvent) {
  window.dispatchEvent(new CustomEvent('videoclaw:analytics', { detail: event }));
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
    const suppressed = analyticsSuppressed();

    function handleAnalytics(event: Event) {
      if (suppressed) return;
      mirrorToDataLayer((event as CustomEvent<CampaignEvent>).detail);
    }

    function handleClick(event: MouseEvent) {
      if (suppressed) return;
      const origin = event.target;
      if (!(origin instanceof Element)) return;
      const element = origin.closest<HTMLElement>('[data-vc-event]');
      if (!element) return;

      const eventName = element.dataset.vcEvent;
      if (eventName !== 'article_click' && eventName !== 'alpha_download_click') return;
      const href = element instanceof HTMLAnchorElement ? element.getAttribute('href') ?? undefined : undefined;

      emit(
        formatCampaignEvent({
          event: eventName,
          pagePath: window.location.pathname,
          timestamp: new Date().toISOString(),
          href,
          context: contextFromElement(element),
        }),
      );
    }

    window.addEventListener('videoclaw:analytics', handleAnalytics);
    document.addEventListener('click', handleClick);

    if (!suppressed && !pageViewSent.current) {
      pageViewSent.current = true;
      emit(
        formatCampaignEvent({
          event: 'page_view',
          pagePath: window.location.pathname,
          timestamp: new Date().toISOString(),
        }),
      );
    }

    return () => {
      window.removeEventListener('videoclaw:analytics', handleAnalytics);
      document.removeEventListener('click', handleClick);
    };
  }, []);

  return null;
}
