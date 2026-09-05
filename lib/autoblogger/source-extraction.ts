import { createRequire } from 'node:module';

export type SourceReadOptions = { query?: string; questions?: readonly string[] };
export type SourcePassage = { text: string; start: number; end: number };

export const SOURCE_TEXT_LIMIT = 8_000;
export const SOURCE_PASSAGE_LIMIT = 20;
export const SOURCE_PASSAGE_CHARACTER_LIMIT = 2_000;

type HtmlNode = {
  nodeType: number;
  tagName?: string;
  text: string;
  childNodes: HtmlNode[];
  getAttribute(name: string): string | undefined;
  hasAttribute(name: string): boolean;
  remove(): void;
};

// Use the inert parser shipped in our pinned production Next dependency, not
// dev-only jsdom or a browser capable of running scripts/loading subresources.
const { parse } = createRequire(import.meta.url)('next/dist/compiled/node-html-parser') as {
  parse(html: string, options: { comment: boolean }): HtmlNode;
};

const OMIT_TAGS = new Set(['HEAD', 'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'NAV', 'FOOTER',
  'ASIDE', 'FORM', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'SVG', 'CANVAS', 'IFRAME', 'OBJECT', 'EMBED']);
const BLOCKS = new Set(['P', 'LI', 'DD', 'DT', 'BLOCKQUOTE', 'DIV', 'SECTION']);
const STOP_WORDS = new Set(['a', 'an', 'the', 'is', 'are', 'of', 'for', 'to', 'and', 'or',
  'in', 'on', 'at', 'with', 'what', 'how', 'does', 'do', 'can', 'i', 'it', 'this']);

function normalizeText(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu, ' ')
    .replace(/\s+/gu, ' ').trim();
}

function tokens(text: string): Set<string> {
  return new Set((text.toLocaleLowerCase('en-US').match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .map((word) => word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word));
}

function omitted(node: HtmlNode): boolean {
  if (OMIT_TAGS.has(node.tagName ?? '')) return true;
  if (node.nodeType !== 1) return false;
  return node.hasAttribute('hidden') || node.hasAttribute('inert')
    || node.getAttribute('aria-hidden')?.toLowerCase() === 'true'
    || /^(navigation|contentinfo|banner|complementary|dialog)$/i.test(node.getAttribute('role') ?? '')
    || /(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|opacity\s*:\s*0(?:\D|$))/i.test(node.getAttribute('style') ?? '')
    || /(?:^|[\s_-])(cookie|consent|newsletter|advertisement|breadcrumb|navigation|sidebar|footer|social|share|related|toc|table-of-contents|page-feedback|analytics-modal|privacy-notice|not-content)(?:$|[\s_-])/i
      .test(`${node.getAttribute('id') ?? ''} ${node.getAttribute('class') ?? ''}`);
}

function visibleText(node: HtmlNode): string {
  const pieces: string[] = [];
  const pending = [node];
  while (pending.length) {
    const current = pending.pop()!;
    if (current.nodeType === 3) pieces.push(current.text);
    else if (current.tagName === 'BR') pieces.push(' ');
    else pending.push(...current.childNodes.slice().reverse());
  }
  return normalizeText(pieces.join(''));
}

/** Exact excerpts of decoded, whitespace-normalized visible body text. No synthesis. */
export function extractSourceBody(html: string, options: SourceReadOptions = {}): {
  text: string;
  passages: SourcePassage[];
} {
  const root = parse(html, { comment: false });
  const nodes: HtmlNode[] = [];
  const pending = [{ node: root, depth: 0 }];
  while (pending.length) {
    const { node, depth } = pending.pop()!;
    if (depth > 80 || nodes.length >= 50_000) throw new Error('Source HTML exceeds structural limits.');
    if (omitted(node)) { node.remove(); continue; }
    nodes.push(node);
    pending.push(...node.childNodes.slice().reverse().map((child) => ({ node: child, depth: depth + 1 })));
  }
  const main = nodes.find((node) => node.tagName === 'MAIN' || node.getAttribute?.('role') === 'main');
  const withinMain: HtmlNode[] = [];
  const scopePending = main ? [main] : [];
  while (scopePending.length) {
    const node = scopePending.pop()!;
    withinMain.push(node);
    scopePending.push(...node.childNodes.slice().reverse());
  }
  const scopeNodes = main ? withinMain : nodes;
  const largest = (matches: HtmlNode[]) => matches.map((node) => ({ node, size: visibleText(node).length }))
    .sort((a, b) => b.size - a.size)[0]?.node;
  // Compare semantic articles and marked CMS bodies together so a small teaser
  // cannot win solely through its tag. No source-specific URLs or prose keywords
  // influence this choice; retain the main boundary and whole selected container.
  const bodyScope = largest(scopeNodes.filter((node) => (
    node.tagName === 'ARTICLE'
    || node.getAttribute?.('itemprop')?.split(/\s+/u).includes('articleBody')
    || /(?:^|\s)(?:w-richtext|fl-rich-text|sl-markdown-content)(?:$|\s)/u.test(node.getAttribute?.('class') ?? '')
  )));
  const scope = bodyScope ?? main ?? nodes.find((node) => node.tagName === 'BODY') ?? root;
  const candidates: Array<{ text: string; order: number; score: number }> = [];
  const queryTokens = tokens(options.query ?? '');
  const questionTokens = (options.questions ?? []).slice(0, 10).map(tokens);
  const topicTerms = new Set([...queryTokens, ...questionTokens.flatMap((terms) => [...terms])]);
  let headingMatchesTopic = false;
  const seen = new Set<string>();
  const bodyNodes: Array<{ node: HtmlNode; exit?: boolean; previousHeading?: string }> = [{ node: scope }];
  let heading = '';
  let paragraphs: string[] = [];
  const flushGroup = () => {
    const body = paragraphs.join(' ');
    paragraphs = [];
    const text = heading ? `${heading} ${body}` : body;
    // HTML paragraphs are not necessarily independent assertions. Keep all prose
    // in a heading/semantic section together, including short qualifications.
    // Rank/budget the entire group, never a selected claim without its context.
    // Do not change invisible joiners inside a source assertion and pretend its
    // meaning was verified. Omit the complete group; other safe groups may remain.
    if (/\p{Cf}/u.test(text) || body.length < 30 || text.length > SOURCE_PASSAGE_CHARACTER_LIMIT
      || (body.match(/[\p{L}\p{N}]+/gu)?.length ?? 0) < 4 || seen.has(text)) return;
    seen.add(text);
    const words = tokens(text);
    const overlap = (terms: Set<string>) => [...terms].filter((term) => words.has(term)).length;
    const score = overlap(queryTokens) * 2 + Math.max(0, ...questionTokens.map((terms) => overlap(terms) * 6));
    candidates.push({ text, order: candidates.length, score });
  };
  while (bodyNodes.length) {
    const { node, exit, previousHeading } = bodyNodes.pop()!;
    const tag = node.tagName ?? '';
    if (exit) {
      flushGroup();
      heading = previousHeading!;
      continue;
    }
    if (tag === 'SECTION' || tag === 'ARTICLE') {
      flushGroup();
      bodyNodes.push({ node, exit: true, previousHeading: heading });
    }
    if (tag === 'H1') {
      flushGroup();
      heading = '';
      headingMatchesTopic ||= [...tokens(visibleText(node))].some((term) => topicTerms.has(term));
    }
    if (/^H[2-6]$/.test(tag)) {
      flushGroup();
      heading = visibleText(node);
      if (heading.length > 160) heading = '';
    } else if (BLOCKS.has(tag)) {
      // Leaf prose blocks avoid double-counting div/p or li/p nested content.
      const descendants = [...node.childNodes];
      let nestedBlock = false;
      while (descendants.length && !nestedBlock) {
        const child = descendants.pop()!;
        nestedBlock = BLOCKS.has(child.tagName ?? '') || /^H[1-6]$/.test(child.tagName ?? '');
        descendants.push(...child.childNodes);
      }
      if (!nestedBlock) {
        const body = visibleText(node);
        if (body) paragraphs.push(body);
      }
    }
    bodyNodes.push(...node.childNodes.slice().reverse().map((child) => ({ node: child })));
  }
  flushGroup();

  if (topicTerms.size && !headingMatchesTopic && !candidates.some(({ score }) => score > 0)) {
    throw new Error('Source has no relevant body evidence.');
  }

  const selected: typeof candidates = [];
  let characters = 0;
  for (const candidate of candidates.sort((a, b) => b.score - a.score || a.order - b.order)) {
    const size = candidate.text.length + (selected.length ? 2 : 0);
    if (characters + size > SOURCE_TEXT_LIMIT) continue;
    selected.push(candidate);
    characters += size;
    if (selected.length === SOURCE_PASSAGE_LIMIT) break;
  }
  selected.sort((a, b) => a.order - b.order);
  let text = '';
  const passages = selected.map((candidate) => {
    if (text) text += '\n\n';
    const start = text.length;
    text += candidate.text;
    return { text: candidate.text, start, end: text.length };
  });
  if (!passages.length) throw new Error('Source has no usable body evidence.');
  return { text, passages };
}
