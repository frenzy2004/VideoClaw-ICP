import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CampaignEventTracker from './campaign-event-tracker';

describe('CampaignEventTracker', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/use-cases/demo-day-founder-content?email=founder@example.com');
    Object.defineProperty(window, 'dataLayer', { configurable: true, value: [] });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('emits one page view and one sanitized CTA click without network or storage', () => {
    const events: unknown[] = [];
    const listener = (event: Event) => events.push((event as CustomEvent).detail);
    window.addEventListener('videoclaw:analytics', listener);
    const fetchSpy = vi.spyOn(window, 'fetch').mockResolvedValue(new Response());
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
    const beacon = vi.fn();
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: beacon });

    render(
      <StrictMode>
        <CampaignEventTracker />
        <a
          href="https://videoclaw.com/alpha/download?email=founder@example.com#form"
          onClick={(event) => event.preventDefault()}
          data-vc-cta-id="hero-alpha-access"
          data-vc-event="alpha_download_click"
          data-vc-placement="hero"
        >
          Request private-alpha Mac access
        </a>
      </StrictMode>,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Request private-alpha Mac access' }));

    expect(events).toEqual([
      expect.objectContaining({
        event: 'page_view',
        page_path: '/use-cases/demo-day-founder-content',
      }),
      expect.objectContaining({
        event: 'alpha_download_click',
        page_path: '/use-cases/demo-day-founder-content',
        href: 'https://videoclaw.com/alpha/download',
        context: { cta_id: 'hero-alpha-access', placement: 'hero' },
      }),
    ]);
    expect((window as Window & { dataLayer: unknown[] }).dataLayer).toEqual(events);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(beacon).not.toHaveBeenCalled();
    expect(storageSpy).not.toHaveBeenCalled();

    window.removeEventListener('videoclaw:analytics', listener);
  });

  it('mirrors direct video events once without redispatching them', () => {
    render(<CampaignEventTracker />);
    const dataLayer = (window as Window & { dataLayer: unknown[] }).dataLayer;
    dataLayer.length = 0;

    const event = {
      event: 'video_play',
      page_path: '/use-cases/demo-day-founder-content',
      timestamp: '2026-09-01T00:00:00.000Z',
      video_id: 'demo-day-core-prototype',
    };
    window.dispatchEvent(new CustomEvent('videoclaw:analytics', { detail: event }));

    expect(dataLayer).toEqual([event]);
  });
});
