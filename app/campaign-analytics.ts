'use client';

import {
  formatCampaignEvent,
  sanitizeCampaignEvent,
  type CampaignEventInput,
} from './campaign-content';

declare global {
  interface Navigator {
    globalPrivacyControl?: boolean;
  }
}

export function campaignAnalyticsSuppressed() {
  return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
}

export function emitCampaignEvent(input: CampaignEventInput) {
  if (campaignAnalyticsSuppressed()) return false;
  const event = sanitizeCampaignEvent(formatCampaignEvent(input));
  if (!event) return false;

  window.dispatchEvent(
    new CustomEvent('videoclaw:analytics', {
      detail: event,
    }),
  );
  return true;
}
