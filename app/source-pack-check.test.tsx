import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import SourcePackCheck from './source-pack-check';

afterEach(cleanup);

describe('SourcePackCheck measurement', () => {
  it('emits one completion only on the first transition to eight of eight', () => {
    const analytics: unknown[] = [];
    const legacy: unknown[] = [];
    const analyticsListener = (event: Event) => analytics.push((event as CustomEvent).detail);
    const legacyListener = (event: Event) => legacy.push((event as CustomEvent).detail);
    window.addEventListener('videoclaw:analytics', analyticsListener);
    window.addEventListener('videoclaw:conversion', legacyListener);

    const { container } = render(<SourcePackCheck />);
    const checkboxes = screen.getAllByRole('checkbox');
    for (const checkbox of checkboxes.slice(0, 7)) fireEvent.click(checkbox);
    expect(analytics).toHaveLength(0);

    fireEvent.click(checkboxes[7]);
    expect(analytics).toEqual([
      expect.objectContaining({
        event: 'source_pack_complete',
        context: {
          source_pack_id: 'demo-day-source-pack',
          source_type: 'mixed',
          items_total: 8,
          items_completed: 8,
        },
      }),
    ]);

    fireEvent.click(checkboxes[7]);
    fireEvent.click(checkboxes[7]);
    expect(analytics).toHaveLength(1);
    expect(legacy).toHaveLength(0);

    const section = container.querySelector('#source-pack');
    expect(section).toHaveAttribute('data-vc-source-pack-id', 'demo-day-source-pack');
    expect(section).toHaveAttribute('data-vc-source-type', 'mixed');
    expect(section).toHaveAttribute('data-vc-items-total', '8');

    window.removeEventListener('videoclaw:analytics', analyticsListener);
    window.removeEventListener('videoclaw:conversion', legacyListener);
  });
});
