import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const mediaDirectory = join(process.cwd(), 'public/media/demo-day');

const variants = [
  ['base', 'Your traction. Your team. Your proof.'],
  ['investor', 'For the investor who wants to see it after the pitch.', 'Your traction.', '[Traction highlighted]'],
  ['customer', 'For the customer deciding whether to try you.', 'Your proof.', '[Proof highlighted]'],
  ['recruiting', 'For the person you want on the team.', 'Your team.', '[Team highlighted]'],
] as const;

describe('Demo Day campaign media assets', () => {
  it.each(variants)('%s captions cover six scenes and the full 45-second timeline', (variant, ...phrases) => {
    const captions = readFileSync(join(mediaDirectory, `${variant}.en.vtt`), 'utf8');
    expect(captions.match(/-->/g)).toHaveLength(6);
    expect(captions).toContain('00:00.000 --> 00:07.000');
    expect(captions).toContain('00:41.000 --> 00:45.000');
    expect(captions).toContain('ONE SHOT · 90 SECONDS');
    for (const phrase of phrases) expect(captions).toContain(phrase);
  });

  it.each(['base', 'investor', 'customer', 'recruiting'])('%s has a local MP4, poster, and captions file', (variant) => {
    expect(readFileSync(join(mediaDirectory, `${variant}-16x9.mp4`)).byteLength).toBeGreaterThan(1_000_000);
    expect(readFileSync(join(mediaDirectory, `${variant}-poster.jpg`)).byteLength).toBeGreaterThan(10_000);
    expect(readFileSync(join(mediaDirectory, `${variant}.en.vtt`), 'utf8')).toMatch(/^WEBVTT/);
  });
});
