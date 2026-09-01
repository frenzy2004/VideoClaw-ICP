import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CampaignVideo, { type Transcript } from './campaign-video';

const transcript: Transcript = [
  { time: '00:00–00:07', text: 'Scene one.' },
  { time: '00:07–00:16', text: 'Scene two.' },
  { time: '00:16–00:25', text: 'Scene three.' },
  { time: '00:25–00:34', text: 'For the investor: your traction.' },
  { time: '00:34–00:41', text: 'Scene five.' },
  { time: '00:41–00:45', text: 'Scene six.' },
];

describe('CampaignVideo', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/use-cases/demo-day-founder-content');
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: false });
    Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: '0' });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders an accessible native player under user control', () => {
    render(
      <CampaignVideo
        id="demo-day-investor-prototype"
        src="/media/demo-day/investor-16x9.mp4"
        poster="/media/demo-day/investor-poster.jpg"
        title="Investor proof sequence"
        caption="The investor version emphasizes cleared traction evidence."
        captionsSrc="/media/demo-day/investor.en.vtt"
        transcript={transcript}
        preload="metadata"
      />,
    );

    const video = screen.getByLabelText('Investor proof sequence');
    expect(video).toHaveAttribute('controls');
    expect(video).toHaveAttribute('playsinline');
    expect(video).toHaveAttribute('preload', 'metadata');
    expect(video).toHaveAttribute('poster', '/media/demo-day/investor-poster.jpg');
    expect(screen.getByText('The investor version emphasizes cleared traction evidence.')).toBeVisible();
    expect(
      screen.getByText(
        'Illustrative campaign prototype—not customer work, performance evidence, or a promise of VideoClaw output.',
      ),
    ).toBeVisible();
    expect(video).not.toHaveAttribute('autoplay');
    expect(video).not.toHaveAttribute('muted');
    expect(video).not.toHaveAttribute('loop');
    expect(video.querySelector('source')).toHaveAttribute('src', '/media/demo-day/investor-16x9.mp4');
    expect(video.querySelector('track')).toHaveAttribute('src', '/media/demo-day/investor.en.vtt');
    expect(video.querySelector('track')).toHaveAttribute('kind', 'captions');
    expect(video.querySelector('track')).toHaveAttribute('srclang', 'en');
    expect(video.querySelector('track')).toHaveAttribute('default');
    expect(screen.getByText('Read the 45-second transcript')).toBeVisible();
    expect(screen.getByText('For the investor: your traction.')).toBeInTheDocument();
  });

  it('emits play and one native-ended completion event with video context', () => {
    const details: unknown[] = [];
    const listener = (event: Event) => details.push((event as CustomEvent).detail);
    window.addEventListener('videoclaw:analytics', listener);

    render(
      <CampaignVideo
        id="demo-day-investor-prototype"
        src="/media/demo-day/investor-16x9.mp4"
        poster="/media/demo-day/investor-poster.jpg"
        title="Investor proof sequence"
        caption="Illustrative investor variant."
        captionsSrc="/media/demo-day/investor.en.vtt"
        transcript={transcript}
      />,
    );

    const video = screen.getByLabelText('Investor proof sequence');
    fireEvent.play(video);
    fireEvent.ended(video);
    fireEvent.ended(video);

    expect(details).toHaveLength(2);
    expect(details).toEqual([
      expect.objectContaining({
        event: 'video_play',
        page_path: '/use-cases/demo-day-founder-content',
        video_id: 'demo-day-investor-prototype',
      }),
      expect.objectContaining({
        event: 'video_complete',
        page_path: '/use-cases/demo-day-founder-content',
        video_id: 'demo-day-investor-prototype',
      }),
    ]);

    window.removeEventListener('videoclaw:analytics', listener);
  });

  it('resets exact-once guards when the media identity changes', () => {
    const details: Array<{ event: string; video_id: string }> = [];
    const listener = (event: Event) => details.push((event as CustomEvent).detail);
    window.addEventListener('videoclaw:analytics', listener);

    const { rerender } = render(
      <CampaignVideo
        id="demo-day-investor-prototype"
        src="/media/demo-day/investor-16x9.mp4"
        poster="/media/demo-day/investor-poster.jpg"
        captionsSrc="/media/demo-day/investor.en.vtt"
        title="Investor proof sequence"
        caption="Investor version."
        transcript={transcript}
      />,
    );

    fireEvent.play(screen.getByLabelText('Investor proof sequence'));
    fireEvent.ended(screen.getByLabelText('Investor proof sequence'));

    rerender(
      <CampaignVideo
        id="demo-day-customer-prototype"
        src="/media/demo-day/customer-16x9.mp4"
        poster="/media/demo-day/customer-poster.jpg"
        captionsSrc="/media/demo-day/customer.en.vtt"
        title="Customer proof sequence"
        caption="Customer version."
        transcript={transcript}
      />,
    );

    fireEvent.play(screen.getByLabelText('Customer proof sequence'));
    fireEvent.ended(screen.getByLabelText('Customer proof sequence'));

    expect(details.map(({ event, video_id: videoId }) => `${event}:${videoId}`)).toEqual([
      'video_play:demo-day-investor-prototype',
      'video_complete:demo-day-investor-prototype',
      'video_play:demo-day-customer-prototype',
      'video_complete:demo-day-customer-prototype',
    ]);

    window.removeEventListener('videoclaw:analytics', listener);
  });

  it('emits no video analytics when GPC is enabled', () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: true });
    const details: unknown[] = [];
    const listener = (event: Event) => details.push((event as CustomEvent).detail);
    window.addEventListener('videoclaw:analytics', listener);

    render(
      <CampaignVideo
        id="demo-day-investor-prototype"
        src="/media/demo-day/investor-16x9.mp4"
        poster="/media/demo-day/investor-poster.jpg"
        captionsSrc="/media/demo-day/investor.en.vtt"
        title="Investor proof sequence"
        caption="Investor version."
        transcript={transcript}
      />,
    );
    const video = screen.getByLabelText('Investor proof sequence');
    fireEvent.play(video);
    fireEvent.ended(video);

    expect(details).toEqual([]);
    window.removeEventListener('videoclaw:analytics', listener);
  });

  if (false) {
    // @ts-expect-error Meaningful campaign videos require local captions and a six-scene transcript.
    <CampaignVideo
      id="invalid"
      src="/media/demo-day/base-16x9.mp4"
      poster="/media/demo-day/base-poster.jpg"
      title="Invalid"
      caption="Missing required accessibility data."
    />;

    <CampaignVideo
      id="external"
      // @ts-expect-error Campaign video sources must stay under /media/demo-day/.
      src="https://example.com/external.mp4"
      poster="/media/demo-day/base-poster.jpg"
      captionsSrc="/media/demo-day/base.en.vtt"
      title="External"
      caption="External media is not allowed."
      transcript={transcript}
    />;
  }
});
