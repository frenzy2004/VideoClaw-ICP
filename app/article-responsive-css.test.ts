import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

describe('article responsive layout', () => {
  it('allows both grid children to shrink within a mobile viewport', () => {
    expect(css).toMatch(
      /\.article-page \.article-markdown,\s*\.article-page \.article-attribution\s*\{[^}]*min-width:\s*0;/s,
    );
  });
});
