import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Home from './page';

afterEach(cleanup);

describe('private prototype handoff', () => {
  it('links the prototype to both final campaign routes', () => {
    const { container } = render(<Home />);
    expect(screen.getByText('PRIVATE REVIEW PROTOTYPE · NOT A LIVE OFFER')).toBeVisible();
    expect(screen.getByRole('link', { name: 'USE CASE' })).toHaveAttribute(
      'href',
      '/use-cases/demo-day-founder-content',
    );
    expect(screen.getByRole('link', { name: 'FOUNDER STORY GUIDE' })).toHaveAttribute(
      'href',
      '/guides/founder-story-after-demo-day',
    );

    const main = container.querySelector('main');
    expect(main).toHaveAttribute('data-vc-campaign-id', 'c2-demo-day');
    expect(main).toHaveAttribute('data-vc-page-id', 'c2-demo-day-prototype');
    expect(main).toHaveAttribute('data-vc-page-type', 'commercial');
  });

  it('uses only the approved request-access destination and canonical event names', () => {
    const { container } = render(<Home />);
    const accessLinks = screen.getAllByRole('link', { name: /request private-alpha Mac access/i });
    expect(accessLinks).toHaveLength(2);
    for (const link of accessLinks) {
      expect(link).toHaveAttribute('href', 'https://videoclaw.com/alpha/download');
      expect(link).toHaveAttribute('data-vc-event', 'alpha_download_click');
    }
    expect(container.querySelector('a[href="https://videoclaw.com/download"]')).not.toBeInTheDocument();

    const sourceLinks = screen.getAllByRole('link', { name: /source.pack check|check your source pack/i });
    expect(sourceLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of sourceLinks) expect(link).toHaveAttribute('data-vc-event', 'article_click');
    expect(container.querySelector('[data-event]')).not.toBeInTheDocument();
  });
});
