'use client';

import {
  formatCampaignEvent,
  isPermanentlyPrivateCampaignPath,
  sanitizeCampaignEvent,
  type CampaignEventInput,
} from './campaign-content';

declare global {
  interface Navigator {
    globalPrivacyControl?: boolean;
  }
}

export function campaignAnalyticsSuppressed(pagePath?: string) {
  return (
    navigator.globalPrivacyControl === true ||
    navigator.doNotTrack === '1' ||
    (typeof window !== 'undefined' && isPermanentlyPrivateCampaignPath(window.location.pathname)) ||
    (typeof pagePath === 'string' && isPermanentlyPrivateCampaignPath(pagePath))
  );
}

export function emitCampaignEvent(input: CampaignEventInput) {
  if (campaignAnalyticsSuppressed(input.pagePath)) return false;
  const event = sanitizeCampaignEvent(formatCampaignEvent(input));
  if (!event) return false;

  window.dispatchEvent(
    new CustomEvent('videoclaw:analytics', {
      detail: event,
    }),
  );
  return true;
}
