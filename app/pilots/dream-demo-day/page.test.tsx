import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import DossierPage, { metadata } from './page';

afterEach(cleanup);

const genericVideoCaption =
  'VideoClaw campaign-method illustration only. This is not Dream footage, a Dream product demonstration, or evidence of Dream participation.';

describe('Private Dream pilot dossier', () => {
  it('exports static private metadata without a canonical or schema', () => {
    const { container } = render(<DossierPage />);

    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates).toBeUndefined();
    expect(container.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(0);
  });

  it('renders the source-controlled qualification dossier', () => {
    const { container } = render(<DossierPage />);

    expect(screen.getByText('PRIVATE ACCOUNT DOSSIER · NOINDEX · NON-AFFILIATED')).toBeVisible();
    const sourceLinks = screen.getAllByRole('link', { name: 'Dream public company profile' });
    expect(sourceLinks).toHaveLength(3);
    for (const sourceLink of sourceLinks) {
      expect(sourceLink).toHaveAttribute('href', 'https://www.ycombinator.com/companies/dream');
    }
    expect(screen.getAllByText('Checked 2026-09-01')).toHaveLength(3);

    expect(screen.getByRole('heading', { name: 'Selection rationale' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Exclusions' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Qualification gate' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Seven-beat storyboard' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Source-pack matrix' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Claim ledger' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Prohibited implications' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Audience variants' })).toBeVisible();
    expect(screen.getByText('Research queries')).toBeVisible();
    expect(screen.getByText('Answer prompts')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Measurement table' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Production authorization decision' })).toBeVisible();

    expect(container.querySelectorAll('.dream-storyboard li')).toHaveLength(7);
    expect(container.querySelectorAll('.dream-source-pack tbody tr')).toHaveLength(4);
    expect(container.querySelectorAll('.dream-claim-ledger tbody tr')).toHaveLength(5);
    expect(container.querySelectorAll('.dream-measurement tbody tr')).toHaveLength(3);
    expect(container.querySelectorAll('.dream-panel details')).toHaveLength(2);
  });

  it('keeps the factual selection rationale source-linked and dated in place', () => {
    render(<DossierPage />);

    const selectionRationale = screen.getByRole('region', { name: 'Selection rationale' });
    const factualClaim = within(selectionRationale).getByText(
      'The public company profile describes a physical-world computer-vision workflow suitable for a source-controlled Demo Day qualification exercise.',
    );
    const factualClaimItem = factualClaim.closest('li');

    expect(factualClaimItem).not.toBeNull();
    expect(within(factualClaimItem as HTMLElement).getByRole('link', { name: 'Dream public company profile' })).toHaveAttribute(
      'href',
      'https://www.ycombinator.com/companies/dream',
    );
    expect(within(factualClaimItem as HTMLElement).getByText('Checked 2026-09-01')).toBeVisible();
  });

  it('uses only the generic VideoClaw master with the exact non-affiliation boundary', () => {
    const { container } = render(<DossierPage />);

    expect(screen.getByText(genericVideoCaption)).toBeVisible();
    expect(container.querySelectorAll('video')).toHaveLength(1);
    expect(container.querySelector('video source')).toHaveAttribute('src', '/media/demo-day/base-16x9.mp4');
    expect(container.querySelectorAll('img, iframe, embed, object')).toHaveLength(0);
    expect(container.querySelectorAll('a[href^="mailto:"], a[href^="tel:"]')).toHaveLength(0);
    expect(container.textContent).not.toMatch(/@|\+\d[\d\s()-]{6,}/);
  });
});
