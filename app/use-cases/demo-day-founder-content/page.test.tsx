import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import UseCasePage, { metadata, useCaseFaqs, useCaseSchemaNodes } from './page';

afterEach(cleanup);

describe('Demo Day founder content use-case page', () => {
  it('renders the specific founder situation and both approved actions', () => {
    const { container } = render(<UseCasePage />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Your Demo Day story should keep working after the room clears.',
      }),
    ).toBeVisible();
    expect(screen.getByText(/Demo Day, launch, or showcase is 7–21 days away/i)).toBeVisible();
    expect(screen.getByText(/private-alpha Mac app/i)).toBeVisible();

    const accessLinks = screen.getAllByRole('link', { name: /request private-alpha Mac access/i });
    expect(accessLinks.length).toBeGreaterThan(1);
    for (const link of accessLinks) {
      expect(link).toHaveAttribute('href', 'https://videoclaw.com/alpha/download');
    }

    expect(screen.getAllByRole('link', { name: /source pack/i })[0]).toHaveAttribute(
      'href',
      '/#source-pack',
    );
    expect(container.querySelector('form')).not.toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).not.toBeInTheDocument();
  });

  it('shows four viewer jobs and four local campaign prototypes', () => {
    const { container } = render(<UseCasePage />);

    for (const viewer of ['Investor', 'Customer', 'Future hire', 'Partner or media']) {
      expect(screen.getByRole('heading', { level: 3, name: viewer })).toBeVisible();
    }

    const videos = container.querySelectorAll('video');
    expect(videos).toHaveLength(4);
    const sources = [...container.querySelectorAll('video source')].map((source) => source.getAttribute('src'));
    expect(sources).toEqual([
      '/media/demo-day/base-16x9.mp4',
      '/media/demo-day/investor-16x9.mp4',
      '/media/demo-day/customer-16x9.mp4',
      '/media/demo-day/recruiting-16x9.mp4',
    ]);
    expect(screen.getAllByText(/illustrative campaign prototype/i).length).toBeGreaterThanOrEqual(4);
  });

  it('keeps visible FAQ answers and JSON-LD in exact parity', () => {
    const { container } = render(<UseCasePage />);

    expect(container.querySelectorAll('.campaign-faq-list details')).toHaveLength(6);
    for (const faq of useCaseFaqs) {
      expect(screen.getByText(faq.question)).toBeInTheDocument();
      expect(screen.getByText(faq.answer)).toBeInTheDocument();
    }

    expect(container.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(0);
    const schemaText = JSON.stringify(useCaseSchemaNodes);
    expect(schemaText).toContain('WebPage');
    expect(schemaText).toContain('BreadcrumbList');
    expect(schemaText).toContain('FAQPage');
    expect(schemaText).not.toMatch(/Product|Offer|Review|AggregateRating|VideoObject|Article/);

    const faqSchema = useCaseSchemaNodes.find((node) => node['@type'] === 'FAQPage');
    expect(faqSchema.mainEntity).toHaveLength(6);
    expect(faqSchema.mainEntity.map((item: { name: string }) => item.name)).toEqual(
      useCaseFaqs.map((faq) => faq.question),
    );
  });

  it('exports fail-closed preview metadata without a public canonical', () => {
    expect(metadata.title).toBe('Demo Day Founder Content System | VideoClaw');
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
