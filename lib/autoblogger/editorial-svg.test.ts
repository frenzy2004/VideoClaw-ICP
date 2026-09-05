import { describe, expect, it } from 'vitest';

import { renderEditorialSvg, type GeneratedDraftV2 } from './content-bundle';

type Graphic = GeneratedDraftV2['editorialGraphic'];

const maximumGraphic: Graphic = {
  title: 'Prepare the recording and demonstration, rehearse delivery, then check playback before sharing.'.padEnd(100, '!'),
  alt: 'Six ordered preparation and review steps.',
  steps: Array.from({ length: 6 }, (_, index) => ({
    label: `${index + 1}. Prepare and review the recording`.padEnd(40, '!'),
    detail: 'Record a rehearsal, check the picture and sound, and confirm playback before sharing the video with the audience.'.padEnd(120, '!'),
  })),
};

function parse(graphic: Graphic) {
  const svg = renderEditorialSvg(graphic);
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  expect(document.querySelector('parsererror')).toBeNull();
  return { svg, document };
}

const visibleText = (element: Element | null) => element?.textContent?.replace(/\s+/gu, ' ').trim();

describe('deterministic editorial SVG readability', () => {
  it.each(['title', 'label', 'detail'] as const)('rejects an oversized single grapheme in %s instead of overflowing its box', (field) => {
    const graphic = structuredClone(maximumGraphic);
    if (field === 'title') graphic.title = '\u1100'.repeat(100);
    else graphic.steps[0][field] = '\u1100'.repeat(field === 'label' ? 40 : 120);
    expect(() => renderEditorialSvg(graphic)).toThrow(/grapheme.*fit/i);
  });

  it('lays six steps out in three columns and two rows inside the 1200 × 675 canvas', () => {
    const { document } = parse(maximumGraphic);
    expect(document.documentElement.getAttribute('viewBox')).toBe('0 0 1200 675');
    const cards = [...document.querySelectorAll('rect.card')];
    expect(cards).toHaveLength(6);
    expect(new Set(cards.map(card => card.getAttribute('x'))).size).toBe(3);
    expect(new Set(cards.map(card => card.getAttribute('y'))).size).toBe(2);
    for (const card of cards) {
      const [x, y, width, height] = ['x', 'y', 'width', 'height'].map(name => Number(card.getAttribute(name)));
      expect(x).toBeGreaterThanOrEqual(24);
      expect(y).toBeGreaterThanOrEqual(150);
      expect(x + width).toBeLessThanOrEqual(1176);
      expect(y + height).toBeLessThanOrEqual(655);
    }
  });

  it.each([
    ['prose at every field limit', maximumGraphic],
    ['unbroken wide letters', { ...maximumGraphic, title: 'W'.repeat(100), steps: maximumGraphic.steps.map(() => ({ label: 'W'.repeat(40), detail: 'W'.repeat(120) })) }],
    ['wide words that waste space at line breaks', { ...maximumGraphic, title: `${`${'W'.repeat(25)} `.repeat(3)}${'W'.repeat(22)}`, steps: maximumGraphic.steps.map(() => ({ label: 'W'.repeat(40), detail: `${'WWWWWWWWWWWWWWW '.repeat(6)}WWWWWWWWWWWW` })) }],
    ['wide Unicode characters', { ...maximumGraphic, title: '録'.repeat(100), steps: maximumGraphic.steps.map(() => ({ label: '録'.repeat(40), detail: '録'.repeat(120) })) }],
  ] satisfies Array<[string, Graphic]>)('wraps and visibly retains all %s without clipping or tiny text', (_name, graphic) => {
    const { svg, document } = parse(graphic);
    expect(visibleText(document.querySelector('text.title'))).toBe(graphic.title);
    const labels = [...document.querySelectorAll('text.label')];
    const details = [...document.querySelectorAll('text.detail')];
    expect(labels.map(visibleText)).toEqual(graphic.steps.map(step => step.label));
    expect(details.map(visibleText)).toEqual(graphic.steps.map(step => step.detail));
    expect(document.querySelectorAll('text.title tspan').length).toBeGreaterThan(1);
    const title = document.querySelector('text.title') as Element;
    expect(Number(title.getAttribute('font-size'))).toBeGreaterThanOrEqual(24);
    expect(Number(title.lastElementChild?.getAttribute('y')) + Number(title.getAttribute('font-size')) * 0.25).toBeLessThan(150);
    for (const [index, label] of labels.entries()) {
      const detail = details[index];
      const card = document.querySelectorAll('rect.card')[index];
      const top = Number(card.getAttribute('y'));
      const bottom = top + Number(card.getAttribute('height'));
      expect(label.querySelectorAll('tspan').length).toBeGreaterThan(1);
      expect(detail.querySelectorAll('tspan').length).toBeGreaterThan(1);
      expect(Number(label.getAttribute('font-size'))).toBeGreaterThanOrEqual(18);
      expect(Number(detail.getAttribute('font-size'))).toBeGreaterThanOrEqual(15);
      const labelEnd = Number(label.lastElementChild?.getAttribute('y'));
      const detailStart = Number(detail.firstElementChild?.getAttribute('y'));
      expect(detailStart - Number(detail.getAttribute('font-size'))).toBeGreaterThan(labelEnd + 4);
      for (const text of [label, detail]) {
        const size = Number(text.getAttribute('font-size'));
        for (const line of text.querySelectorAll('tspan')) {
          const baseline = Number(line.getAttribute('y'));
          expect(baseline - size).toBeGreaterThanOrEqual(top + 12);
          expect(baseline + size * 0.25).toBeLessThanOrEqual(bottom - 10);
        }
      }
    }
    expect(svg).not.toMatch(/foreignObject|clipPath|overflow\s*[:=]|textLength|lengthAdjust|ellipsis|display\s*:\s*none|visibility\s*:\s*hidden/iu);
  });

  it('uses the production paper, ink, mint and magenta palette without adding unsupported claims', () => {
    const { svg, document } = parse(maximumGraphic);
    const colors = new Set([...document.querySelectorAll('[fill], [stroke]')].flatMap(element => (
      [element.getAttribute('fill'), element.getAttribute('stroke')].filter(Boolean)
    )));
    expect(colors).toEqual(new Set(['#F1EDE1', '#14151A', '#CBF3D9', '#C33672']));
    expect(svg).not.toContain('SOURCE-CONTROLLED EDITORIAL WORKFLOW');
  });

  it('escapes markup in wrapped text and emits only passive SVG primitives', () => {
    const graphic = {
      ...maximumGraphic,
      title: 'Review <script>alert("x")</script> & playback',
      steps: maximumGraphic.steps.map(() => ({ label: 'Read <img> & review', detail: 'Keep <script> literal; use "quotes" & apostrophes safely.' })),
    };
    const { document } = parse(graphic);
    const allowed = new Set(['svg', 'title', 'desc', 'rect', 'circle', 'path', 'text', 'tspan', 'g']);
    for (const node of document.querySelectorAll('*')) {
      expect(allowed.has(node.localName)).toBe(true);
      for (const attribute of node.attributes) expect(attribute.name).not.toMatch(/^on|href|src/iu);
    }
    expect(visibleText(document.querySelector('text.title'))).toBe(graphic.title);
    expect([...document.querySelectorAll('text.detail')].map(visibleText)).toEqual(graphic.steps.map(step => step.detail));
  });

  it.each([3, 4, 5, 6])('retains exactly %i steps in their supplied order and renders deterministically', (count) => {
    const graphic = { ...maximumGraphic, steps: maximumGraphic.steps.slice(0, count) };
    const { svg, document } = parse(graphic);
    expect(renderEditorialSvg(graphic)).toBe(svg);
    expect([...document.querySelectorAll('text.label')].map(visibleText)).toEqual(graphic.steps.map(step => step.label));
  });
});
