'use client';

import { useEffect, useRef } from 'react';
import { formatCampaignEvent } from './campaign-content';

export type TranscriptCue = {
  time: string;
  text: string;
};

export type Transcript = readonly [
  TranscriptCue,
  TranscriptCue,
  TranscriptCue,
  TranscriptCue,
  TranscriptCue,
  TranscriptCue,
];

type DemoDayMediaPath = `/media/demo-day/${string}`;

type CampaignVideoProps = {
  id: string;
  src: DemoDayMediaPath;
  poster: DemoDayMediaPath;
  title: string;
  caption: string;
  captionsSrc: DemoDayMediaPath;
  transcript: Transcript;
  preload?: 'none' | 'metadata';
};

export default function CampaignVideo({
  id,
  src,
  poster,
  title,
  caption,
  captionsSrc,
  transcript,
  preload = 'none',
}: CampaignVideoProps) {
  const played = useRef(false);
  const completed = useRef(false);

  useEffect(() => {
    played.current = false;
    completed.current = false;
  }, [id, src]);

  function emit(event: 'video_play' | 'video_complete') {
    window.dispatchEvent(
      new CustomEvent('videoclaw:analytics', {
        detail: formatCampaignEvent({
          event,
          pagePath: window.location.pathname,
          timestamp: new Date().toISOString(),
          videoId: id,
        }),
      }),
    );
  }

  function handlePlay() {
    if (played.current) return;
    played.current = true;
    emit('video_play');
  }

  function handleEnded() {
    if (completed.current) return;
    completed.current = true;
    emit('video_complete');
  }

  return (
    <figure className="campaign-video-shell">
      <video
        aria-describedby={`${id}-caption`}
        aria-label={title}
        controls
        onEnded={handleEnded}
        onPlay={handlePlay}
        playsInline
        poster={poster}
        preload={preload}
      >
        <source src={src} type="video/mp4" />
        <track default kind="captions" label="English captions" src={captionsSrc} srcLang="en" />
        Your browser does not support HTML video. <a href={src}>Open the MP4 file.</a>
      </video>
      <figcaption id={`${id}-caption`}>
        <strong>{title}</strong>
        <span>{caption}</span>
        <span className="campaign-video-status">
          Illustrative campaign prototype—not customer work, performance evidence, or a promise of VideoClaw output.
        </span>
      </figcaption>
      <details className="video-transcript">
        <summary>Read the 45-second transcript</summary>
        <p>This typography-led video has no spoken dialogue.</p>
        <ol>
          {transcript.map((cue) => (
            <li key={`${cue.time}-${cue.text}`}>
              <time>{cue.time}</time>
              <span>{cue.text}</span>
            </li>
          ))}
        </ol>
      </details>
    </figure>
  );
}
