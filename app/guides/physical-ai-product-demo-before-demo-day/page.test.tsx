import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import GuidePage, { metadata } from './page';
import { physicalAiGuide } from '../../campaign-2-pilot-data';

afterEach(cleanup);

describe('Physical-AI Demo Day guide', () => {
  it('keeps the guide permanently private and answer-first', () => {
    render(<GuidePage />);

    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(screen.getByRole('heading', { level: 1, name: /physical-AI product demo before Demo Day/i })).toBeVisible();

    const answer = screen.getByRole('region', { name: 'Direct answer' }).textContent ?? '';
    expect(answer.trim().split(/\s+/).length).toBeGreaterThanOrEqual(40);
    expect(answer.trim().split(/\s+/).length).toBeLessThanOrEqual(70);
    expect(answer).toBe(physicalAiGuide.directAnswer);
  });

  it('renders the founder-to-evidence structure, controls, templates, and review boundaries', () => {
    const { container } = render(<GuidePage />);

    expect(screen.getByRole('heading', { name: 'Founder-to-evidence story' })).toBeVisible();
    expect(within(screen.getByRole('list', { name: 'Five-step story structure' })).getAllByRole('listitem').map((item) => item.textContent?.replace(/^\d+/, ''))).toEqual(
      ['Founder decision', 'Physical action', 'Software record', 'Approved evidence', 'Next step'],
    );
    expect(within(screen.getByRole('list', { name: 'Demo controls' })).getAllByRole('listitem').map((item) => item.textContent)).toEqual(
      ['Rights and permissions', 'Privacy and personal data', 'Prototype and simulation labels', 'Facility access and operating restrictions', 'Identifier removal', 'Screen-data review'],
    );

    const variants = screen.getByRole('table', { name: 'Investor and customer review matrix' });
    expect(within(variants).getByRole('row', { name: /Investor/ })).toBeVisible();
    expect(within(variants).getByRole('row', { name: /Customer/ })).toBeVisible();

    expect(screen.getByRole('heading', { name: '48-hour clock' })).toBeVisible();
    expect(screen.getByRole('heading', { name: '14-day sequence' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Source-pack template' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Claim-ledger template' })).toBeVisible();
    expect(screen.getByText('AI can organize approved inputs; a named human owner approves claims, labels, rights, privacy, and release.')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Measurement' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Limitations' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Dated sources' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Change log' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Download the Markdown preflight' })).toHaveAttribute(
      'href',
      '/guides/physical-ai-product-demo-before-demo-day/download',
    );

    expect(container.querySelectorAll('script[type="application/ld+json"], img, video, iframe, embed, object')).toHaveLength(0);
    expect(container.textContent).not.toMatch(/dream/i);
  });
});
