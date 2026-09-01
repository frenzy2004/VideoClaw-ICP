import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import GuidePage, { guideFaqs, guideSchemaNodes, metadata } from './page';

afterEach(cleanup);

describe('Demo Day video checklist guide', () => {
  it('opens with the exact search job and a complete direct answer', () => {
    render(<GuidePage />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Demo Day Video Checklist for Startup Founders' }),
    ).toBeVisible();
    expect(screen.getByText(/If Demo Day is 7–21 days away, do not ask one video to serve every purpose/i)).toBeVisible();
    expect(screen.getByText(/Your accelerator’s current instructions control what you may record/i)).toBeVisible();
  });

  it('renders the eight inputs, four formats, 72-hour preflight, 90-second template, and 14-day sequence', () => {
    const { container } = render(<GuidePage />);

    expect(container.querySelectorAll('.guide-source-list li')).toHaveLength(8);
    expect(container.querySelectorAll('.guide-format-grid article')).toHaveLength(4);
    expect(container.querySelectorAll('.guide-preflight-list li')).toHaveLength(8);
    expect(container.querySelectorAll('.guide-template-grid article')).toHaveLength(5);
    expect(container.querySelectorAll('.guide-followup-table tbody tr')).toHaveLength(5);

    for (const label of [
      'Accelerator application video',
      'Product demonstration',
      'Recorded Demo Day pitch',
      'Asynchronous follow-up video',
    ]) {
      expect(screen.getByRole('heading', { level: 3, name: label })).toBeVisible();
    }
  });

  it('keeps six FAQs visible and derives the public schema from the same records', () => {
    const { container } = render(<GuidePage />);
    const faqList = container.querySelector('.guide-faq-list');
    expect(faqList).not.toBeNull();
    expect(faqList?.querySelectorAll('details')).toHaveLength(6);

    for (const faq of guideFaqs) {
      expect(within(faqList as HTMLElement).getByText(faq.question)).toBeInTheDocument();
      expect(within(faqList as HTMLElement).getByText(faq.answer)).toBeInTheDocument();
    }

    const schemaText = JSON.stringify(guideSchemaNodes);
    expect(schemaText).toContain('WebPage');
    expect(schemaText).toContain('BreadcrumbList');
    expect(schemaText).toContain('FAQPage');
    expect(schemaText).not.toMatch(/Article|Product|Offer|Review|AggregateRating|VideoObject|HowTo/);
    const faqSchema = guideSchemaNodes.find((node) => node['@type'] === 'FAQPage');
    expect(faqSchema?.mainEntity).toHaveLength(6);
  });

  it('uses authoritative program links and the exact bounded product handoff', () => {
    const { container } = render(<GuidePage />);

    expect(screen.getByRole('link', { name: /YC application-video guidance/i })).toHaveAttribute(
      'href',
      'https://www.ycombinator.com/video/',
    );
    expect(screen.getByRole('link', { name: /Techstars application preview/i })).toHaveAttribute(
      'href',
      'https://www.techstars.com/application-preview',
    );
    const accessLinks = screen.getAllByRole('link', { name: /request private-alpha Mac access/i });
    expect(accessLinks.length).toBeGreaterThan(0);
    for (const link of accessLinks) expect(link).toHaveAttribute('href', 'https://videoclaw.com/alpha/download');
    expect(container.querySelector('form')).not.toBeInTheDocument();
  });

  it('exports fail-closed preview metadata and emits no preview JSON-LD', () => {
    const { container } = render(<GuidePage />);

    expect(metadata.title).toBe('Demo Day Video Checklist for Startup Founders | VideoClaw');
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates).toBeUndefined();
    expect(container.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(0);
  });
});
