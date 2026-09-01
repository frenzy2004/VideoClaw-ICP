'use client';

import { formatCampaignEvent, type CampaignEventInput } from './campaign-content';

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

  window.dispatchEvent(
    new CustomEvent('videoclaw:analytics', {
      detail: formatCampaignEvent(input),
    }),
  );
  return true;
}
