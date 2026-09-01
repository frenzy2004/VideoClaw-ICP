import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import GuidePage, { metadata } from './page';
import { physicalAiGuide } from '../../campaign-2-pilot-data';
import { GET } from './download/route';

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
    expect(screen.getByRole('link', { name: 'FTC Advertising and Marketing Basics' })).toHaveAttribute(
      'href',
      'https://www.ftc.gov/business-guidance/advertising-marketing/advertising-marketing-basics',
    );
    expect(screen.getByRole('heading', { name: 'Change log' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Download the Markdown preflight' })).toHaveAttribute(
      'href',
      '/guides/physical-ai-product-demo-before-demo-day/download',
    );

    expect(container.querySelectorAll('script[type="application/ld+json"], img, video, iframe, embed, object')).toHaveLength(0);
    expect(container.textContent).not.toMatch(/dream/i);
  });

  it('uses the shared approval boundary in both the HTML guide and Markdown download', async () => {
    const sharedBoundary = physicalAiGuide.approvalBoundary ?? 'Shared approval boundary is missing.';
    render(<GuidePage />);

    expect(screen.getByText(sharedBoundary)).toBeVisible();
    expect(await GET().text()).toContain(sharedBoundary);
  });

  it('renders both activation windows in exact milestone order with ISO time values', () => {
    const { container } = render(<GuidePage />);
    const clockArticles = container.querySelectorAll('.physical-ai-clock-grid article');

    expect([...clockArticles[0].querySelectorAll('li')].map((item) => item.textContent)).toEqual([
      '48 hours beforeFreeze the approved story, source pack, claim ledger, and final reviewer.',
      '24 hours beforeCapture the physical action and software record; then verify labels, rights, and privacy.',
      '2 hours beforeRun the final playback, caption, backup, and release check without adding new claims.',
    ]);
    expect([...clockArticles[1].querySelectorAll('li')].map((item) => item.textContent)).toEqual([
      'Day 1Send the approved core demo to the primary audience with one next step.',
      'Day 7Review questions and reuse only the same approved evidence in audience-specific follow-up.',
      'Day 14Close the sequence by recording qualified actions, corrections, and evidence gaps.',
    ]);
    expect([...container.querySelectorAll('time')].map((time) => [time.textContent, time.getAttribute('datetime')])).toEqual([
      ['48 hours before', 'PT48H'],
      ['24 hours before', 'PT24H'],
      ['2 hours before', 'PT2H'],
      ['Day 1', 'P1D'],
      ['Day 7', 'P7D'],
      ['Day 14', 'P14D'],
      ['Checked 2026-09-01', '2026-09-01'],
      ['Checked 2026-09-01', '2026-09-01'],
      ['2026-09-01', '2026-09-01'],
    ]);
  });

  it('keeps HTML and Markdown review prompts in shared-data parity', async () => {
    const { container } = render(<GuidePage />);
    const htmlPrompts = [...container.querySelectorAll('.physical-ai-prompt-list p')].map((prompt) => prompt.textContent);
    const markdown = await GET().text();
    const markdownPromptSection = markdown
      .split('## Review prompts\n')[1]
      ?.split('\n\n## ')[0]
      .split('\n')
      .filter(Boolean);

    expect(htmlPrompts).toEqual(physicalAiGuide.reviewPrompts);
    expect(markdownPromptSection).toEqual(physicalAiGuide.reviewPrompts.map((prompt) => `- ${prompt}`));
  });
});
