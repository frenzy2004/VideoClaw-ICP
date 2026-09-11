import { createHash } from 'node:crypto';
import matter from 'gray-matter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { z } from 'zod';

import {
  DraftBundleSchema,
  CampaignIdSchema,
  candidateFingerprints,
  normalizeKeyword,
  type CampaignId,
  type Candidate,
  type DraftBundle,
  type EvidenceBundle,
  type KeywordMetrics,
} from './domain';
import { isStrictIsoDateTime, isoDateTimeToDateOnly } from './date-time';
import { containsSecretLikeValue } from './secrets';
import type { CheckedSource } from './sources';
import type { FaqEvidencePlan } from './faq-preparation';

const claimLocationPattern = /^\/(?:description|competitorGap|directAnswer|sections\/\d+\/(?:heading|markdown)|faqAnswers\/\d+\/answer|editorialGraphic\/(?:title|alt)|editorialGraphic\/steps\/\d+\/(?:label|detail))$/;

function isXml10Text(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) as number;
    if (
      codePoint !== 0x9
      && codePoint !== 0xA
      && codePoint !== 0xD
      && !(codePoint >= 0x20 && codePoint <= 0xD7FF)
      && !(codePoint >= 0xE000 && codePoint <= 0xFFFD)
      && !(codePoint >= 0x10000 && codePoint <= 0x10FFFF)
    ) return false;
  }
  return true;
}

function isFormatControlFree(value: string): boolean {
  return !/\p{Cf}/u.test(value);
}

const rawFormatControlFreeString = z.string().refine(
  isFormatControlFree,
  'Unicode format controls are not allowed.',
);
const nonBlankString = rawFormatControlFreeString.pipe(z.string().trim().min(1));
const singleLineControlFreeString = rawFormatControlFreeString.pipe(
  z.string().trim().min(1).refine((value) => (
    !/[\u0000-\u001F\u007F-\u009F\u2028\u2029]/u.test(value)
  )),
);
const xmlVisibleString = (maximum: number) => z.string()
  .refine(isXml10Text)
  .refine(isFormatControlFree, 'Unicode format controls are not allowed.')
  .pipe(z.string().trim().min(1).max(maximum));

export const GeneratedDraftV2Schema = z.object({
  schemaVersion: z.literal(2),
  description: nonBlankString,
  // Preserve the caller-owned value verbatim for the exact campaign check.
  customerTrigger: rawFormatControlFreeString.refine((value) => value.trim().length > 0),
  competitorGap: nonBlankString,
  directAnswer: nonBlankString,
  sections: z.array(z.object({
    heading: nonBlankString,
    markdown: nonBlankString,
  }).strict()).min(2),
  faqAnswers: z.array(z.object({
    question: nonBlankString,
    answer: nonBlankString,
  }).strict()).length(3),
  sourceReferences: z.array(z.object({
    sourceId: nonBlankString,
  }).strict()).min(2),
  claimBindings: z.array(z.object({
    location: z.string().regex(claimLocationPattern),
    span: nonBlankString,
    sourceFactIds: z.array(nonBlankString).min(1),
    productClaimId: nonBlankString.nullable(),
  }).strict()),
  editorialGraphic: z.object({
    title: xmlVisibleString(100),
    alt: xmlVisibleString(240),
    steps: z.array(z.object({
      label: xmlVisibleString(40),
      detail: xmlVisibleString(120),
    }).strict()).min(3).max(6),
  }).strict(),
}).strict();

export type GeneratedDraftV2 = z.infer<typeof GeneratedDraftV2Schema>;

export const ProductReferenceReviewSchema = z.object({
  bindingIndex: z.number().int().nonnegative(),
  bindingHash: z.string().regex(/^[a-f0-9]{64}$/u),
  contextHash: z.string().regex(/^[a-f0-9]{64}$/u),
  classification: z.enum(['non_product', 'product', 'ambiguous']),
  subject: z.string().trim().min(1).max(160),
  rationale: z.string().trim().min(1).max(800),
}).strict();
export type ProductReferenceReview = z.infer<typeof ProductReferenceReviewSchema>;

export const GENERATED_DRAFT_V2_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    schemaVersion: { type: 'integer', const: 2 },
    description: { type: 'string', pattern: '.*\\S.*' },
    customerTrigger: { type: 'string', pattern: '.*\\S.*' },
    competitorGap: { type: 'string', pattern: '.*\\S.*' },
    directAnswer: { type: 'string', pattern: '.*\\S.*' },
    sections: {
      type: 'array',
      minItems: 2,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          heading: { type: 'string', pattern: '.*\\S.*' },
          markdown: { type: 'string', pattern: '.*\\S.*' },
        },
        required: ['heading', 'markdown'],
      },
    },
    faqAnswers: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          question: { type: 'string', pattern: '.*\\S.*' },
          answer: { type: 'string', pattern: '.*\\S.*' },
        },
        required: ['question', 'answer'],
      },
    },
    sourceReferences: {
      type: 'array',
      minItems: 2,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { sourceId: { type: 'string', pattern: '.*\\S.*' } },
        required: ['sourceId'],
      },
    },
    claimBindings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          location: { type: 'string', pattern: claimLocationPattern.source },
          span: { type: 'string', pattern: '.*\\S.*' },
          sourceFactIds: {
            type: 'array',
            minItems: 1,
            items: { type: 'string', pattern: '.*\\S.*' },
          },
          productClaimId: { type: ['string', 'null'], pattern: '.*\\S.*' },
        },
        required: ['location', 'span', 'sourceFactIds', 'productClaimId'],
      },
    },
    editorialGraphic: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string', pattern: '.*\\S.*', maxLength: 100 },
        alt: { type: 'string', pattern: '.*\\S.*', maxLength: 240 },
        steps: {
          type: 'array',
          minItems: 3,
          maxItems: 6,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              label: { type: 'string', pattern: '.*\\S.*', maxLength: 40 },
              detail: { type: 'string', pattern: '.*\\S.*', maxLength: 120 },
            },
            required: ['label', 'detail'],
          },
        },
      },
      required: ['title', 'alt', 'steps'],
    },
  },
  required: [
    'schemaVersion',
    'description',
    'customerTrigger',
    'competitorGap',
    'directAnswer',
    'sections',
    'faqAnswers',
    'sourceReferences',
    'claimBindings',
    'editorialGraphic',
  ],
} as const;

export type SourceFact = {
  id: string;
  label: string;
  url: string;
  checkedAt: string;
  facts: Array<{
    id: string;
    text: string;
    /** Omitted legacy facts are conservatively treated as search titles/snippets by the critic. */
    evidenceKind?: 'serp_title' | 'serp_snippet' | 'body';
    /** Extractor-provided UTF-16 offset into unchanged text; absent on legacy facts. */
    bodyStart?: number;
  }>;
  /** Used for copied-passage comparison. Excluded from model input, Git and compact reports; a private ignored local replay may retain it. */
  excerpt?: string;
};

const SourceFactInputSchema: z.ZodType<SourceFact> = z.object({
  id: singleLineControlFreeString,
  label: singleLineControlFreeString,
  url: singleLineControlFreeString.refine((value) => normalizeHttpUrl(value) !== undefined),
  checkedAt: z.string().refine(isStrictIsoDateTime),
  facts: z.array(z.object({
    id: singleLineControlFreeString,
    text: singleLineControlFreeString,
    evidenceKind: z.enum(['serp_title', 'serp_snippet', 'body']).optional(),
    bodyStart: z.number().int().min(0).optional(),
  }).strict().refine(({ text, bodyStart }) => bodyStart === undefined || bodyStart <= text.length)).min(1),
  excerpt: z.string().optional(),
}).strict();

export function assertSourceFacts(sourceFacts: SourceFact[]): void {
  if (sourceFacts.some(({ checkedAt }) => !isStrictIsoDateTime(checkedAt))) {
    throw new Error('Every source checkedAt must be a strict ISO date-time.');
  }
  if (!z.array(SourceFactInputSchema).min(2).safeParse(sourceFacts).success) {
    throw new Error('Invalid source fact input.');
  }
}

export function assertSourceFactsMatchCheckedSources(context: Pick<
DraftingContext,
'evidence' | 'checkedSources' | 'sourceFacts'
>): Set<string> {
  const evidenceByUrl = new Map(context.evidence.sources.flatMap((source) => {
    const normalized = normalizeHttpUrl(source.originalUrl);
    return normalized ? [[normalized, source] as const] : [];
  }));
  const reachableFinalUrls = new Set<string>();
  for (const checked of context.checkedSources) {
    const checkedUrl = normalizeHttpUrl(checked.url);
    const finalUrl = normalizeHttpUrl(checked.finalUrl);
    const evidenceSource = checkedUrl ? evidenceByUrl.get(checkedUrl) : undefined;
    if (
      evidenceSource
      && finalUrl
      && finalUrl === normalizeHttpUrl(evidenceSource.finalUrl)
      && checked.reachable
      && checked.status >= 200
      && checked.status < 400
      && evidenceSource.authoritative === checked.authoritative
    ) {
      reachableFinalUrls.add(finalUrl);
    }
  }
  if (reachableFinalUrls.size < 2) {
    throw new Error('Drafting requires at least two distinct normalized checked final URLs from checked sources.');
  }
  const sourceFactFinalUrls = context.sourceFacts.flatMap(({ url }) => {
    const normalized = normalizeHttpUrl(url);
    return normalized ? [normalized] : [];
  });
  if (new Set(sourceFactFinalUrls).size < 2) {
    throw new Error('Source facts require at least two distinct normalized checked final URLs.');
  }
  if (
    sourceFactFinalUrls.length !== context.sourceFacts.length
    || sourceFactFinalUrls.some((url) => !reachableFinalUrls.has(url))
  ) {
    throw new Error('Each source fact must bind to a reachable checked source final URL.');
  }
  return reachableFinalUrls;
}

export type ProductClaim = {
  id: string;
  text: string;
  allowedSourceFactIds: string[];
  subjectAliases: string[];
};

export type DraftProvenance = {
  apifyRunId: string;
  apifyDatasetId: string;
  query: string;
  locale: string;
  capturedAt: string;
};

export type DraftingContext = {
  candidate: Candidate;
  evidence: EvidenceBundle;
  keywordMetrics: KeywordMetrics;
  checkedSources: CheckedSource[];
  provenance: DraftProvenance;
  sourceFacts: SourceFact[];
  productClaims: ProductClaim[];
  generatedAt: string;
  faqEvidencePlan?: FaqEvidencePlan;
};

export type AllowlistedProductMedia = {
  id: string;
  candidateFingerprints?: string[];
  campaignIds?: CampaignId[];
  keywordIncludes?: string[];
  src: string;
  poster: string;
  alt: string;
  caption: string;
  width: number;
  height: number;
};

function isSafeLocalAssetPath(value: string): boolean {
  if (!/^\/(?!\/)[^\s?#]+$/.test(value) || value.includes('\\')) return false;
  return value.split('/').slice(1).every((rawSegment) => {
    if (!rawSegment) return false;
    let segment = rawSegment;
    let stable = false;
    try {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const decoded = decodeURIComponent(segment);
        if (decoded === segment) {
          stable = true;
          break;
        }
        segment = decoded;
      }
    } catch {
      return false;
    }
    return stable
      && segment !== '.'
      && segment !== '..'
      && !segment.includes('/')
      && !segment.includes('\\');
  });
}

const localAssetPath = rawFormatControlFreeString.pipe(z.string().refine(isSafeLocalAssetPath));
const AllowlistedProductMediaSchema = z.object({
  id: nonBlankString,
  candidateFingerprints: z.array(nonBlankString).min(1).optional(),
  campaignIds: z.array(CampaignIdSchema).min(1).optional(),
  keywordIncludes: z.array(nonBlankString).min(1).optional(),
  src: localAssetPath,
  poster: localAssetPath,
  alt: singleLineControlFreeString,
  caption: singleLineControlFreeString,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
}).strict().refine((media) => Boolean(
  media.candidateFingerprints?.length
  || media.campaignIds?.length
  || media.keywordIncludes?.length
)).refine((media) => [
  ...(media.candidateFingerprints ?? []),
  ...(media.keywordIncludes ?? []),
].every((selector) => normalizeKeyword(selector).length > 0));

export type DraftSafetyFinding = {
  code: string;
  message: string;
  issueId?: string;
  bindingIndex?: number;
  location?: string;
  span?: string;
  sourceFactIds?: string[];
  reason?: string;
  repairInstruction?: string;
};

export class DraftMaterializationError extends Error {
  constructor(readonly findings: DraftSafetyFinding[]) {
    super(`Unsafe final artifacts: ${findings.map(({ code }) => code).join(', ')}`);
    this.name = 'DraftMaterializationError';
  }
}

const rawHtmlPattern = /<(?:\/?[a-z][a-z0-9-]*(?=[\t\n\f\r />])|!--|\?|![a-z]|!\[CDATA\[)/i;
const researchBoilerplatePattern = /\b(?:debug research|research notes|SERP|people also ask|candidateFingerprint|sourceFactIds|claimReferences)\b/i;

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalizedWords(value: string): string[] {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .match(/[a-z0-9]+/g) ?? [];
}

type MarkdownNode = {
  type: string;
  depth?: number;
  ordered?: boolean;
  url?: string;
  value?: string;
  alt?: string;
  children?: MarkdownNode[];
  position?: {
    start: { offset?: number };
    end: { offset?: number };
  };
};

const markdownParser = unified().use(remarkParse).use(remarkGfm);

function parseMarkdown(markdown: string): MarkdownNode {
  return markdownParser.parse(markdown) as MarkdownNode;
}

function walkMarkdown(node: MarkdownNode, visit: (node: MarkdownNode) => void): void {
  visit(node);
  node.children?.forEach((child) => walkMarkdown(child, visit));
}

function markdownNodeText(node: MarkdownNode): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value ?? '';
  if (node.type === 'code') return '';
  if (node.type === 'image') return node.alt ?? '';
  if (node.type === 'html' || node.type === 'definition') return '';
  return node.children?.map(markdownNodeText).join(' ') ?? '';
}

function markdownNodeClaimText(node: MarkdownNode): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value ?? '';
  if (node.type === 'break') return '\n';
  if (node.type === 'code') return '';
  if (node.type === 'image') return node.alt ?? '';
  if (node.type === 'html' || node.type === 'definition') return '';
  const separator = ['root', 'blockquote', 'list', 'listItem'].includes(node.type) ? '\n' : '';
  return node.children?.map(markdownNodeClaimText).join(separator) ?? '';
}

function visibleWordCount(markdown: string): number {
  return normalizedWords(markdownNodeText(parseMarkdown(markdown))).length;
}

function copiedPassage(body: string, excerpt: string): string | undefined {
  const bodyWords = normalizedWords(body);
  if (bodyWords.length < 12) return undefined;
  const bodyText = ` ${bodyWords.join(' ')} `;
  const words = normalizedWords(excerpt);
  for (let index = 0; index <= words.length - 12; index += 1) {
    const span = words.slice(index, index + 12).join(' ');
    if (bodyText.includes(` ${span} `)) return span;
  }
  return undefined;
}

function containsCopiedPassage(body: string, excerpts: string[]): boolean {
  return excerpts.some((excerpt) => copiedPassage(body, excerpt) !== undefined);
}

function copiedDraftFindings(context: DraftingContext, draft: GeneratedDraftV2): DraftSafetyFinding[] {
  const claims = generatedClaimSentences(draft);
  const locations = unique(claims.map(({ location }) => location));
  const findings: DraftSafetyFinding[] = [];
  for (const location of locations) {
    const value = generatedLocationValue(draft, location) ?? '';
    for (const source of context.sourceFacts) {
      if (!source.excerpt) continue;
      const copied = copiedPassage(value, source.excerpt);
      if (!copied) continue;
      // Use a complete rendered sentence when possible. A cross-sentence match
      // retains the full field so repair cannot miss either half of the passage.
      const span = claims.find((claim) => claim.location === location
        && copiedPassage(claim.span, copied))?.span ?? value;
      const bindingIndex = draft.claimBindings.findIndex((binding) => binding.location === location && binding.span === span);
      findings.push({
        code: 'content.copied_passage', location, span,
        ...(bindingIndex >= 0 ? { bindingIndex } : {}),
        sourceFactIds: source.facts.filter(({ text }) => copiedPassage(text, copied)).map(({ id }) => id),
        reason: 'copied_source_passage',
        message: `Copied source passage at ${location} from ${source.id}: ${JSON.stringify(copied)}.`,
        repairInstruction: 'Remove or genuinely paraphrase this passage in original language without changing its supported meaning; check every occurrence and recompute exact bindings.',
      });
    }
  }
  return findings;
}

function hasMalformedMarkdown(markdown: string): boolean {
  let fence: { marker: '`' | '~'; length: number } | undefined;
  for (const line of markdown.split(/\r?\n/)) {
    if (fence) {
      const closing = new RegExp(`^\\s{0,3}${fence.marker}{${fence.length},}\\s*$`);
      if (closing.test(line)) fence = undefined;
      continue;
    }
    const opening = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (opening) {
      fence = { marker: opening[1][0] as '`' | '~', length: opening[1].length };
    }
  }
  if (fence) return true;
  const withoutValidLinks = markdown.replace(/!?\[[^\]\n]+\]\([^\s)]+\)/g, '');
  return /!?\[[^\]\n]*\]\([^\n)]*$/.test(withoutValidLinks);
}

function externalUrls(markdown: string): string[] {
  return [...markdown.matchAll(/https?:\/\/[^\s)<>'"]+/g)]
    .map((match) => match[0].replace(/[.,;:!?]+$/, ''));
}

function generatedBody(draft: GeneratedDraftV2): string {
  return [
    draft.directAnswer,
    ...draft.sections.flatMap((section) => [section.heading, section.markdown]),
  ].join('\n\n');
}

function finding(code: string, message: string): DraftSafetyFinding {
  return { code, message };
}

function inspectReferences(
  context: DraftingContext,
  draft: GeneratedDraftV2,
  body: string,
): DraftSafetyFinding[] {
  const findings: DraftSafetyFinding[] = [];
  const sourceById = new Map(context.sourceFacts.map((source) => [source.id, source]));
  const sourceIds = draft.sourceReferences.map(({ sourceId }) => sourceId);
  const selectedNormalizedUrls = sourceIds.flatMap((id) => {
    const url = sourceById.get(id)?.url;
    const normalized = url ? normalizeHttpUrl(url) : undefined;
    return normalized ? [normalized] : [];
  });
  if (
    sourceIds.length < 2
    || unique(sourceIds).length !== sourceIds.length
    || sourceIds.some((id) => !sourceById.has(id))
    || new Set(selectedNormalizedUrls).size < 2
  ) {
    findings.push(finding('content.citation_mismatch', 'Source references must identify at least two distinct inventory sources.'));
  }
  const allowedUrls = new Set(context.sourceFacts.flatMap(({ url }) => {
    const normalized = normalizeHttpUrl(url);
    return normalized ? [normalized] : [];
  }));
  if (externalUrls(body).some((url) => {
    const normalized = normalizeHttpUrl(url);
    return !normalized || !allowedUrls.has(normalized);
  })) {
    findings.push(finding('content.unsupported_link', 'Every external Markdown link must match the supplied source inventory exactly.'));
  }

  findings.push(...inspectClaimBindings(context, draft, sourceIds));
  return findings;
}

function splitClaimSentences(value: string): string[] {
  const normalized = value
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ');
  return normalized.split(/\n+/u).flatMap(line => {
    const result: string[] = [];
    let start = 0;
    for (const match of line.matchAll(/[.!?]["'”’»)\]]*/gu)) {
      const index = match.index;
      // An internal dot belongs to the token (dotted names, domains, decimals).
      // Ambiguous no-space concatenations still require an exact whole-span
      // binding; a binding for just the first claim cannot cover the added text.
      if (line[index] === '.' && /[\p{L}\p{N}]/u.test(line[index - 1] ?? '')
        && /[\p{L}\p{N}]/u.test(line[index + 1] ?? '')) continue;
      const end = index + match[0].length;
      if (end < line.length && !/[\sA-Z]/u.test(line[end])) continue;
      result.push(line.slice(start, end).trim());
      start = end;
    }
    result.push(line.slice(start).trim());
    return result.filter(Boolean);
  });
}

function sentences(value: string): string[] {
  return splitClaimSentences(markdownNodeClaimText(parseMarkdown(value)));
}

function claimSpansAtLocation(value: string, location: string): string[] {
  // Headings are emitted into the body as ATX Markdown, not literal JSX. Parse
  // that exact context so inline formatting cannot hide a rendered product name.
  if (/^\/sections\/\d+\/heading$/.test(location)) return sentences(`## ${value}`);
  // Native text and metadata retain literal fences, definitions, tags and inline
  // markers; only actual Markdown body fields use Markdown sentence extraction.
  if (location === '/directAnswer' || /^\/sections\/\d+\/markdown$/.test(location)) return sentences(value);
  return splitClaimSentences(value);
}

function generatedLocationValue(draft: GeneratedDraftV2, location: string): string | undefined {
  if (location === '/description') return draft.description;
  if (location === '/competitorGap') return draft.competitorGap;
  if (location === '/directAnswer') return draft.directAnswer;
  const section = location.match(/^\/sections\/(\d+)\/(heading|markdown)$/);
  if (section) return draft.sections[Number(section[1])]?.[section[2] as 'heading' | 'markdown'];
  const faq = location.match(/^\/faqAnswers\/(\d+)\/answer$/);
  if (faq) return draft.faqAnswers[Number(faq[1])]?.answer;
  if (location === '/editorialGraphic/title') return draft.editorialGraphic.title;
  if (location === '/editorialGraphic/alt') return draft.editorialGraphic.alt;
  const step = location.match(/^\/editorialGraphic\/steps\/(\d+)\/(label|detail)$/);
  if (step) return draft.editorialGraphic.steps[Number(step[1])]?.[step[2] as 'label' | 'detail'];
  return undefined;
}

function generatedClaimSentences(draft: GeneratedDraftV2): Array<{ location: string; span: string }> {
  return [
    { location: '/description', value: draft.description },
    { location: '/competitorGap', value: draft.competitorGap },
    { location: '/directAnswer', value: draft.directAnswer },
    ...draft.sections.flatMap(({ heading, markdown }, index) => [
      { location: `/sections/${index}/heading`, value: heading },
      { location: `/sections/${index}/markdown`, value: markdown },
    ]),
    ...draft.faqAnswers.map(({ answer }, index) => ({ location: `/faqAnswers/${index}/answer`, value: answer })),
    { location: '/editorialGraphic/title', value: draft.editorialGraphic.title },
    { location: '/editorialGraphic/alt', value: draft.editorialGraphic.alt },
    ...draft.editorialGraphic.steps.flatMap(({ label, detail }, index) => [
      { location: `/editorialGraphic/steps/${index}/label`, value: label },
      { location: `/editorialGraphic/steps/${index}/detail`, value: detail },
    ]),
  ].flatMap(({ location, value }) => claimSpansAtLocation(value, location)
    .map((span) => ({ location, span })));
}

/** Compile exact compound metadata only; source relationships still require a
 * fresh independent review of every resulting sentence. Never change prose. */
export function canonicalizeCompoundClaimBindings(context: DraftingContext, draft: GeneratedDraftV2) {
  const unchanged = {draft, splitBindingIndices: [] as number[]};
  if (!GeneratedDraftV2Schema.safeParse(draft).success) return unchanged;
  // Reuse the coverage validator's canonical locations and rendered spans.
  const locations = new Map<string, string[]>();
  for (const {location, span} of generatedClaimSentences(draft)) {
    const spans = locations.get(location) ?? [];
    spans.push(span);
    locations.set(location, spans);
  }
  const selected = new Set(draft.sourceReferences.map(source => source.sourceId));
  const facts = new Set(context.sourceFacts.filter(source => selected.has(source.id)).flatMap(source => source.facts.map(fact => fact.id)));
  const splitBindingIndices: number[] = [];
  const claimBindings = draft.claimBindings.flatMap((binding, bindingIndex) => {
    const visible = locations.get(binding.location);
    if (!visible || binding.productClaimId !== null || visible.includes(binding.span)
      || new Set(binding.sourceFactIds).size !== binding.sourceFactIds.length
      || binding.sourceFactIds.some(id => !facts.has(id))) return [binding];
    const parts = splitClaimSentences(binding.span);
    if (parts.length < 2 || parts.join(' ') !== binding.span) return [binding];
    const starts = visible.flatMap((_span, start) => parts.every((span, offset) => visible[start + offset] === span) ? [start] : []);
    if (starts.length !== 1 || parts.some(span => visible.filter(text => text === span).length !== 1)) return [binding];
    const rendered = visible.join(' ');
    const start = visible.slice(0, starts[0]).reduce((offset, span) => offset + span.length + 1, 0);
    const end = start + binding.span.length;
    // Compare against the original inventory, so two overlapping compounds
    // cannot become eligible merely because one was already split. Partial
    // bindings also reserve their exact rendered occurrence and fail closed.
    const overlaps = draft.claimBindings.some((other, index) => {
      if (index === bindingIndex) return false;
      // Match generatedLocationValue's numeric index resolution. An aliased
      // binding at this field stays malformed and prevents canonicalization.
      const otherLocation = other.location.replace(/\/(\d+)(?=\/)/gu, (_match, index: string) => `/${Number(index)}`);
      if (otherLocation !== binding.location) return false;
      if (other.location !== binding.location) return true;
      // A whole rendered span such as "Review" occupies its own sentence, not
      // the same substring in "Review the recording.". Only partial/compound
      // metadata needs the conservative substring fallback below.
      if (visible.includes(other.span)) return parts.includes(other.span);
      for (let offset = rendered.indexOf(other.span); offset !== -1; offset = rendered.indexOf(other.span, offset + 1)) {
        if (offset < end && offset + other.span.length > start) return true;
      }
      return false;
    });
    if (overlaps) return [binding];
    splitBindingIndices.push(bindingIndex);
    return parts.map(span => ({...binding, span, sourceFactIds: [...binding.sourceFactIds]}));
  });
  if (!splitBindingIndices.length) return unchanged;
  const canonical = {...draft, claimBindings};
  if (!GeneratedDraftV2Schema.safeParse(canonical).success) return unchanged;
  return {draft: canonical, splitBindingIndices};
}

function referenceCheckContext(context: DraftingContext, draft: GeneratedDraftV2, bindingIndex: number) {
  const binding = draft.claimBindings[bindingIndex];
  // Visible prose order spans field boundaries: a heading, prior section or
  // graphic label can supply the actor. Private campaign metadata cannot.
  const visible = [
    { location: '/title', span: context.candidate.title },
    ...generatedClaimSentences(draft).filter(entry => entry.location !== '/competitorGap'),
  ];
  const position = visible.findIndex(entry => entry.location === binding.location && entry.span === binding.span);
  const section = binding.location.match(/^\/sections\/(\d+)\//);
  const faq = binding.location.match(/^\/faqAnswers\/(\d+)\//);
  const step = binding.location.match(/^\/editorialGraphic\/steps\/(\d+)\//);
  // Enclosing labels stay relevant even when an answer/body has several sentences.
  const labels = [
    ...(['/description', '/directAnswer'].includes(binding.location) ? [context.candidate.title] : []),
    ...(section && draft.sections[Number(section[1])] ? claimSpansAtLocation(draft.sections[Number(section[1])].heading, `/sections/${section[1]}/heading`) : []),
    ...(faq ? [draft.faqAnswers[Number(faq[1])]?.question] : []),
    ...(binding.location.startsWith('/editorialGraphic/') ? [draft.editorialGraphic.title] : []),
    ...(step ? [draft.editorialGraphic.steps[Number(step[1])]?.label] : []),
  ].filter((label): label is string => label !== undefined);
  // Each FAQ question establishes its own discourse; the final body section is
  // not the antecedent of a new question explicitly naming a human actor.
  const preceding = visible.slice(Math.max(0, position - 2), position + 1)
    .filter(entry => !faq || entry.location.startsWith(`/faqAnswers/${faq[1]}/`));
  const nearby = position < 0 ? [] : [...new Set([...labels, ...preceding.map(entry => entry.span)])];
  return {
    bindingIndex,
    bindingHash: createHash('sha256').update(JSON.stringify([binding.location, binding.span, binding.sourceFactIds, binding.productClaimId])).digest('hex'),
    // A changed heading or distant product context invalidates the whole review.
    contextHash: createHash('sha256').update(JSON.stringify([context.candidate.title, draft, context.productClaims])).digest('hex'),
    location: binding.location, span: binding.span, nearby,
    explicitProductContext: position < 0 || nearby.some(text => containsExplicitProductAlias(text, context.productClaims)
      || hasUnresolvedProductHead(text)),
  };
}

// "Product" may modify a human role or planning artifact instead of naming the
// software itself. Keep the conservative detector/review manifest unchanged;
// these compounds only permit a current, exact-anchor independent reference
// review. They do not establish claim support or grant a product capability.
function hasUnresolvedProductHead(text: string): boolean {
  for (const match of text.matchAll(/\b(?:the|this|our) product\b/giu)) {
    if (/^our\b/iu.test(match[0])) return true;
    const suffix = text.slice(match.index! + match[0].length);
    // A software head can precede the compound or follow several modifiers
    // ("demo review tools"). Keep the veto across the whole span; this
    // exception never resolves singular or plural software nouns.
    if (/\b(?:apps?|applications?|platforms?|tools?|software|services?|editors?|assistants?|agents?|automation|systems?|bots?)\b/iu.test(text)
      || /\bproducts?\b/iu.test(suffix)) return true;
    const compound = suffix.match(/^\s+(?:accuracy owner|lead|flow|demo(?: storyboard)?)\b/iu);
    // Require an actual noun-phrase boundary, not a prefix of an unknown head
    // such as "product demo creation software". Unrecognized continuations and
    // possessives stay unresolved instead of being guessed non-product.
    if (!compound || !/^(?:\s*$|[.,;:!?]|\s+(?:is|are|was|were|has|have|can|could|should|must|will|would|approves?|checks?|confirms?|clears?|changes?|reviews?|to|in|on|at|for|before|after|with|without|and|or|but|who|that|which)(?=\s|$))/iu
      .test(suffix.slice(compound[0].length))) return true;
  }
  return false;
}

/** Conservative detection requests review; it is not itself semantic resolution. */
export function productReferenceManifest(context: DraftingContext, value: unknown) {
  const draft = GeneratedDraftV2Schema.parse(value);
  return inspectGeneratedDraft(context, draft)
    .filter(finding => finding.reason === 'unapproved_product_reference' && finding.bindingIndex !== undefined)
    .map(finding => referenceCheckContext(context, draft, finding.bindingIndex!));
}

function applyReferenceReviews(context: DraftingContext, draft: GeneratedDraftV2, findings: DraftSafetyFinding[], input: unknown[]) {
  if (!input.length) return findings;
  const parsed = z.array(ProductReferenceReviewSchema).safeParse(input);
  if (!parsed.success || containsSecretLikeValue(input)) return [...findings, { code: 'content.reference_review', message: 'Invalid independent reference review.' }];
  const pending = new Map(findings.filter(f => f.reason === 'unapproved_product_reference' && f.bindingIndex !== undefined).map(f => [f.bindingIndex!, f]));
  const approved = new Set<number>();
  const counts = new Map<number, number>();
  for (const review of parsed.data) counts.set(review.bindingIndex, (counts.get(review.bindingIndex) ?? 0) + 1);
  for (const review of parsed.data) {
    if (!pending.has(review.bindingIndex)) {
      findings.push({ code: 'content.reference_review', message: 'Reference review names a binding outside the current review manifest.' });
      continue;
    }
    const current = referenceCheckContext(context, draft, review.bindingIndex);
    const subject = normalizeKeyword(review.subject);
    // Hashes prove receipt identity, not meaning. The independent reviewer must
    // resolve the subject AND separately support the assertion. A naked pronoun,
    // invented anchor or explicit nearby product context cannot grant an exception.
    if (counts.get(review.bindingIndex) !== 1 || review.bindingHash !== current.bindingHash
      || review.contextHash !== current.contextHash || review.classification !== 'non_product'
      || current.explicitProductContext || /^(?:it|its|this|that|they|them|their|the product|this product)$/u.test(subject)
      || !current.nearby.some(text => ` ${normalizeKeyword(text)} `.includes(` ${subject} `))) continue;
    approved.add(review.bindingIndex);
  }
  return findings.filter(f => f.reason !== 'unapproved_product_reference' || !approved.has(f.bindingIndex!));
}

function containsExplicitProductAlias(sentence: string, claims: ProductClaim[]): boolean {
  const normalized = normalizeKeyword(sentence);
  const aliases = ['VideoClaw', ...claims.flatMap(({ subjectAliases }) => subjectAliases)]
    .map(normalizeKeyword)
    .filter((alias) => !['it', 'the product', 'this product'].includes(alias));
  return aliases.some((alias) => alias && ` ${normalized} `.includes(` ${alias} `))
    || /\b(?:this app|this platform|this tool|the app|the platform|the tool|our app|our product)\b/iu.test(sentence);
}

// These identify visible non-software noun phrases, not factual support. A word
// used as a modifier ("the recording tool") is not an ordinary antecedent.
const ordinaryReferent = /\b(?:(?:a|an|the|this|that|each|your) (?:short )?(?:guide|scene|example|brief|buyer brief|prospect research|script|storyboard|row|presentation|recording|video|draft|outline|footage|transcript|checklist)|new content|demo day|watch time)\b(?![-\s]+(?:app|application|product|platform|tool|software|service|editor)\b)/iu;
const softwareReferent = /\b(?:app|application|platform|tool|software|service|editor)\b/iu;
// Qualified artifacts may resolve a grammatical subject or a closed editorial
// object command; merely mentioning one must not expand the legacy noun matcher.
const qualifiedArtifact = '(?:a|an|the|this|that|each|your) (?:(?:short|useful|demo|planning|review) ){1,2}(?:guide|scene|example|brief|script|storyboard|row|presentation|recording|video|draft|outline|footage|transcript|checklist)\\b(?![-\\s]+(?:app|application|product|platform|tool|software|service|editor)\\b)';
const qualifiedSubject = new RegExp(`^${qualifiedArtifact}\\s+(?:is|was|does|has|needs|keeps|contains|shows|remains|can|could|should|must|will|would)\\b`, 'iu');
const qualifiedObjectCommand = new RegExp(`^(?:(?:after|before) [a-z ]{1,60}, )?(?:review|check|revise) ${qualifiedArtifact} (?:(?:before|after) (?:sharing|recording|publishing|editing|sending|exporting)|and (?:review|check|revise))\\s+$`, 'iu');

function hasExplicitOrdinarySubject(prefix: string): boolean {
  const referent = ordinaryReferent.exec(prefix);
  // Only a sentence-leading noun phrase with its own predicate may override
  // prior product context. "After reviewing the recording, it ..." names an
  // object inside an introductory phrase, not the subject of the main clause.
  return referent?.index === 0 && /^\s+(?:is|was|does|has|needs|keeps|contains|shows|remains|can|could|should|must|will|would)\b/iu
    .test(prefix.slice(referent[0].length));
}

function hasExplicitImperativeObject(prefix: string, clause: string): boolean {
  // Resolve a short, unqualified common-noun object followed immediately by a
  // subordinate clause. A named subject ("Descript prepares ...") is not an
  // imperative, and a prepositional/relative clause can introduce another actor.
  const object = prefix.match(/^(?:prepare|review|revise|check|use|remove)\s+(.+?)\s+(?:only\s+)?(?:when|if|unless|before|after|because)\s+$/iu)?.[1];
  // Syntax cannot distinguish an unknown lowercase brand from a common noun.
  // Reuse the bounded ordinary-artifact vocabulary and explicit editorial
  // object categories. Unknown heads (including devices) fail closed; this is
  // reference resolution only, never evidence that the advice is supported.
  const ordinary = object ? ordinaryReferent.exec(object) : null;
  const knownArtifact = object && (/(?:^|\s)(?:material|appendix|collateral|handout|agenda|evidence)$/u.test(object)
    || /^(?:company|founder|customer) history$/u.test(object)
    || (ordinary?.index === 0 && ordinary[0].length === object.length));
  // A syntactic object alone does not establish a non-software referent. Require
  // the whole subordinate clause to describe an editorial relation: suitability,
  // audience delivery, or argumentative structure. Unknown predicates and added
  // clauses stay ambiguous, including capabilities of an unnamed instrument.
  const relation = clause.match(/^it (fits|answers|reaches|lacks|sets|supports|explains) ([a-z]+(?:\s+[a-z]+){0,7})[.!]?$/iu);
  const complement = relation?.[2] ?? '';
  const editorialComplements: Record<string, RegExp> = {
    fits: /\b(?:use case|purpose|scope)$/,
    answers: /\bquestions?$/,
    reaches: /\baudience$/,
    lacks: /\b(?:next step|structure|clarity)$/,
    sets: /\bexpectations$/,
    supports: /\b(?:argument|claim|point)$/,
    explains: /\b(?:buyer|customer) risk$/,
  };
  const editorialRelation = relation && editorialComplements[relation[1].toLowerCase()]?.test(complement.toLowerCase());
  // "Use" can select an instrument rather than an artifact. Only a qualified
  // object under a restrictive evidentiary condition is resolved here; a reason
  // to use an unknown thing must not become an approved capability assertion.
  if (/^use\b/iu.test(prefix) && (!object?.includes(' ')
    || !/\bonly if\s+$/iu.test(prefix) || relation?.[1].toLowerCase() !== 'supports')) return false;
  return Boolean(object && knownArtifact && editorialRelation
    && !/\b(?:and|or|but|for|from|with|without|of|to|in|on|by|as|that|which|who)\b/iu.test(complement)
    // Preserve case here: a proper name inside the object remains ambiguous.
    && /^[a-z]+(?:\s+[a-z]+){0,4}$/u.test(object)
    && !/\b(?:and|or|but|for|from|with|without|of|to|in|on|by|as|that|which|who|it|its|they|their)\b/iu.test(object));
}

function attributedNonProductSubject(prefix: string, factTexts: string[]): boolean {
  // Named third-party attribution must also be present as the subject of a
  // supplied fact. Neither that match nor pronoun resolution proves entailment.
  const subject = prefix.match(/^([\p{Lu}][\p{L}\d]*(?:[ -][\p{Lu}][\p{L}\d]*){0,3})\s+(?:also\s+)?(?:says|notes|explains|reports)\s+$/u)?.[1];
  return Boolean(subject && factTexts.some((text) => (
    normalizeKeyword(text).startsWith(`${normalizeKeyword(subject)} `)
  )));
}

function hasVerifiedPublisherHost(publisher: string, sourceUrls: string[]): boolean {
  const hosts: Record<string, string> = { descript: 'descript.com', cloudshare: 'cloudshare.com' };
  const expected = hosts[publisher.toLowerCase()];
  return Boolean(expected && sourceUrls.some(url => {
    try { return new URL(url).hostname.replace(/^www\./u, '') === expected; }
    catch { return false; }
  }));
}

function hasAttributedEditorialCoordination(sentence: string, sourceUrls: string[]): boolean {
  // A named publisher coordinates two advice predicates. Resolve its single
  // pronoun only when the cited page identifies that publisher; neither the
  // grammar nor the hostname establishes support for the advice itself.
  const subject = sentence.match(/^([\p{Lu}][\p{L}\d]*) (?:says|notes|explains) (?:a|the) (?:software )?demo video should include a (?:compelling|clear) (?:story|use case)(?: or use case)?, and it (?:also )?(?:advises|recommends) (?:concise|focused|short)(?:, (?:concise|focused|short))? demos[.!]?$/u)?.[1];
  return Boolean(subject && hasVerifiedPublisherHost(subject, sourceUrls));
}

function hasEditorialObjectRouting(sentence: string): boolean {
  // These whole-sentence grammars identify "it" as the object of a human
  // planning action, not a software capability subject. No added assertion or
  // named product inherits the exception. Factual support is still reviewed.
  if ([...sentence.matchAll(/\bit\b/giu)].length !== 1) return false;
  // The introduction is the explicit object of a human revision instruction.
  // Match the complete clause; another actor or capability cannot inherit it.
  if (/^if (?:the|this|your) (?:opening|introduction) feels (?:weak|unclear|generic), (?:rewrite|revise) it around (?:the|a) (?:buyer|customer)[’']s (?:current )?(?:obstacle|problem)(?: instead of (?:the|a) (?:founder|company)[’']s category label)?[.!]?$/iu.test(sentence)) return true;
  // Human planning goals and rehearsal instructions keep an explicit ordinary
  // object. Closed complements prevent an added capability from inheriting it.
  if (/^(?:your|the) goal is to make (?:one|a|the) (?:customer|buyer) (?:situation|problem) easy to understand, show the action that addresses it, and ask for a (?:specific|clear) next step[.!]?$/iu.test(sentence)
    || /^(?:(?:first|second|third|finally), )?(?:practice|rehearse) the (?:final|closing) (?:ask|request) until it sounds (?:specific|clear) and natural[.!]?$/iu.test(sentence)) return true;
  const purpose = '(?:the|a|your) (?:buyer problem|customer problem|value proposition|next step|argument)';
  const purposes = `${purpose}(?:, ${purpose})*(?:,? (?:or|and) ${purpose})?`;
  const destination = '(?:the |a )?(?:backup material|appendix|recap|follow-up list)';
  const decision = new RegExp(`^(?:(?:use|apply) (?:this|the|a) decision filter: )?if (?:a|the|this) (?:capability|feature|section|topic|detail|point) does not support ${purposes}, (?:move|defer|place|put) it (?:to|in|into) ${destination}[.!]?$`, 'iu');
  if (decision.test(sentence)) return true;
  // A lowercase question topic can be routed into a written recap. The fixed
  // human subject/predicates do not assert that any product supplies the answer.
  const question = new RegExp(`^If (?:the|a) (?:buyer|customer|prospect) asks about ([a-z]+(?: [a-z]+){0,5}), (?:the|a) (?:founder|presenter) (?:would|should|can) either show (?:a|the) prepared answer if (?:that|the) topic is part of the decision or (?:place|put|note) it in ${destination} if (?:the|that) topic is secondary[.!]?$`, 'u').exec(sentence);
  return Boolean(question && !/\b(?:it|its|they|their|them|we|our|this|that|which|who)\b/u.test(question[1]));
}

function hasEditorialListAntecedent(sentence: string, previousSentences: string[]): boolean {
  // Follow at most two adjacent parallel conditionals to a visible worksheet.
  // A paragraph-wide mention or an unrelated intervening sentence is not enough.
  // The conditional only describes entries on paper, followed by a human choice;
  // no arbitrary software predicates or appended pronouns inherit the referent.
  const choice = '(?:choose|select) the one (?:most likely to buy next|that makes the (?:clearest|strongest) case for a follow[ -]up decision)';
  const rehearsal = 'rehearse the objection that could stop the deal rather than the easiest one to answer';
  const conditional = new RegExp(`^if (it|(?:the|this|your) (?:worksheet|checklist|brief|outline)) lists (?:several|multiple) (?:customer segments|workflows|objections), (?:${choice}|${rehearsal})[.!]?$`, 'iu');
  if (conditional.exec(sentence)?.[1].toLowerCase() !== 'it') return false;
  for (const previous of previousSentences.slice(-2).reverse()) {
    const match = conditional.exec(previous);
    if (!match) return false;
    if (match[1].toLowerCase() !== 'it') return true;
  }
  return false;
}

function hasAttributedRecordingObject(sentence: string, sourceUrls: string[]): boolean {
  // Resolve a demonstrated object in publisher-attributed human instructions.
  // A matching source hostname establishes attribution identity only; the
  // independent critic still must verify the complete instructional claim.
  const publisher = /^(?:for software, )?([\p{Lu}][\p{L}\d]*) (?:says|notes|explains) (?:one|a) (?:straightforward|simple) approach is to record the screen while (?:walking through|demonstrating) the product(?: or feature)?, then add a voiceover that explains the steps shown[.!]?$/u.exec(sentence.replace(/^For software,/u, 'for software,'))?.[1];
  return Boolean(publisher && hasVerifiedPublisherHost(publisher, sourceUrls));
}

function hasOrdinaryExplanationAntecedent(sentence: string, previousSentence: string): boolean {
  // A small noun-phrase grammar admits editorial explanations, not arbitrary
  // predicates after "It". Match both sentences in full so an added capability
  // clause, second actor, or unknown modifier cannot inherit this exception.
  const clarification = /^it means (?:the|a|your) (?:viewer|audience|buyer|customer) should (?:be able to )?connect (?:the|a) (?:painful |customer |buyer )?(?:situation|problem) to (?:the|a) (?:demonstrated |proposed )?(?:response|solution)(?: without (?:needing|requiring) (?:a|an) (?:long |detailed )?(?:feature lecture|explanation|presentation))?[.!]?$/iu;
  if (clarification.test(sentence)) return /^(?:that|this) does not mean (?:every|each|the) (?:founder|presenter|team) (?:must|should) (?:produce|record|create) (?:a|an) (?:polished |professional |finished |short )?(?:advertisement|video|demo|recording)[.!]?$/iu.test(previousSentence);
  const modifier = '(?:checklist|planning|review|demo|buyer|customer|consistent|working|defined|clear|next|short|simple|editorial)';
  const head = '(?:principle|approach|sequence|structure|purpose|scope|path|problem|story|setup|steps?|questions?|argument)';
  const nounPhrase = `(?:the|a|an|this|that) (?:${modifier} ){0,3}${head}`;
  const nounList = `${nounPhrase}(?:, ${nounPhrase})*(?:,? and ${nounPhrase})?`;
  const explanation = new RegExp(`^it (?:illustrates|explains|summarizes|outlines) ${nounPhrase}(?: of (?:matching|linking|connecting|aligning) ${nounPhrase} (?:to|with) ${nounList})?[.!]?$`, 'iu');
  if (!explanation.test(sentence)) return false;

  const subject = '(?:this|that|the|a|an) (?:hypothetical |illustrative )?(?:example|worksheet)';
  const description = '(?:hypothetical|illustrative|(?:a|an) (?:planning|review|hypothetical|illustrative) (?:exercise|aid|example|worksheet))';
  // A negated, generic attribution is allowed only inside this closed clause.
  // Actual product names and affirmative capability assertions cannot match it.
  const disclaimer = ' and (?:is|was) not (?:a|an) (?:claim|assertion) that (?:any|a) named product (?:has|provides) (?:these|those) (?:capabilities|features|outcomes)(?: or (?:capabilities|features|outcomes))?';
  return new RegExp(`^${subject} (?:(?:is|was) ${description}(?:${disclaimer})?|(?:lists|outlines|summarizes) ${nounList})[.!]?$`, 'iu')
    .test(previousSentence);
}

function containsProductAlias(
  sentence: string,
  claims: ProductClaim[],
  localContext: string,
  priorProductContext: boolean,
  factTexts: string[],
  sourceUrls: string[],
  previousSentences: string[],
): boolean {
  if (containsExplicitProductAlias(sentence, claims)) return true;
  const productReferences = [...sentence.matchAll(/\b(?:the|this) product\b/giu)];
  const pronouns = [...sentence.matchAll(/\bit\b/giu)];
  const pronoun = pronouns[0];
  if (!pronoun && productReferences.length === 0) return false;
  const prefix = pronoun ? sentence.slice(0, pronoun.index) : '';
  // A dotted token is retained for exact text coverage, not proof that the
  // preceding ordinary noun governs a later assertion. If punctuation occurs
  // before this pronoun inside one span, keep reference resolution ambiguous.
  // This also protects concatenated clauses such as "ready.Once it ...";
  // lexical names/abbreviations alone must not grant a capability exception.
  // A later pronoun cannot inherit the first exemption for a new capability.
  // Preserve only a terminal editorial object or a closed example label; the
  // normal subject/context rules below still have to resolve the first pronoun.
  const additionalReferencesAreEditorial = pronouns.length <= 2 && pronouns.slice(1).every(reference => {
    const tail = sentence.slice(reference.index);
    return (/^it[.!]?$/iu.test(tail)
      && /\b(?:cut|defer|remove)(?: or (?:cut|defer|remove))?\s+$/iu.test(sentence.slice(0, reference.index)))
      || /^it is an (?:illustrative )?example structure[.!]?$/iu.test(tail);
  });
  if (!additionalReferencesAreEditorial || pronouns.some(reference => /[.!?]/u.test(sentence.slice(0, reference.index)))) return true;
  // A grammatical dummy subject ("it can be useful to decide") and the object
  // of an explicit problem-addressing instruction are not software subjects.
  // Keep these narrow: no prior product context, second pronoun or added claim.
  if (pronoun && !priorProductContext && productReferences.length === 0
    && [...sentence.matchAll(/\bit\b/giu)].length === 1) {
    const tail = sentence.slice(pronoun.index);
    if (!softwareReferent.test(sentence) && !/\bproduct\b/iu.test(sentence)
      && /^(?:original (?:editorial note|recommendation):\s*)?(?:for (?:a|the|your) (?:founder|team|presenter)[^,;:.!?]{0,160},\s*)?it (?:can|may) be useful to decide whether (?:the|your) (?:next )?(?:asset|video|demo|presentation) should (?:educate|persuade|explain|demonstrate)(?:,\s*(?:educate|persuade|explain|demonstrate))*(?: or (?:do both|educate|persuade|explain|demonstrate))?[.!]?$/iu.test(sentence)) return false;
    if (/(?:^|:\s*)(?:state|identify|describe) the (?:customer|buyer|user) problem,\s*show the software (?:path|workflow) that (?:addresses|solves) $/iu.test(prefix)
      && /^it(?: and (?:end|finish|close) with (?:one )?(?:concrete )?(?:next )?(?:action|step))?[.!]?$/iu.test(tail)) return false;
  }
  // A newly named ordinary subject in this very sentence can resolve its own
  // pronoun, even after a product paragraph. It never clears the product context
  // for later standalone pronouns, and software/product nouns remain ambiguous.
  if (pronoun && !softwareReferent.test(sentence) && !/\bproduct\b/iu.test(sentence)
    && (qualifiedSubject.test(prefix)
      || (!priorProductContext && [...sentence.matchAll(/\bit\b/giu)].length === 1
        && qualifiedObjectCommand.test(prefix) && /^it[.!]?$/iu.test(sentence.slice(pronoun.index))))) return false;
  if (pronoun && !softwareReferent.test(sentence) && !/\bproduct\b/iu.test(sentence)
    && ((ordinaryReferent.test(prefix) && (!priorProductContext || hasExplicitOrdinarySubject(prefix)))
      || attributedNonProductSubject(prefix, factTexts))) return false;
  // Do not let an intervening ordinary noun or a hypothetical label erase a
  // visible VideoClaw antecedent. This deliberately leaves ambiguity fail-closed.
  if (priorProductContext) return true;
  if (productReferences.length === 1 && pronouns.length === 0
    && hasAttributedRecordingObject(sentence, sourceUrls)) return false;
  if (productReferences.length > 0) {
    const genericContext = /\b(?:company|customer|hypothetical)\b/iu.test(sentence);
    const genericVideoSubject = /^a (?:software )?demo video\b/iu.test(sentence);
    const genericRolesOnly = productReferences.every((reference) => {
      const after = sentence.slice(reference.index! + reference[0].length).trimStart();
      if (genericContext && /^(?:response|screen|value|matters)\b/iu.test(after)) return true;
      // The category is a video, and the product is its demonstrated object,
      // not the subject of a capability assertion. Check every occurrence; an
      // added "the product adds captions" must not inherit this exception.
      return genericVideoSubject && reference[0].toLowerCase() === 'the product'
        && /\b(?:see|show|shows|showing)\s+$/iu.test(sentence.slice(0, reference.index))
        && /^in action\b/iu.test(after);
    });
    if (!genericRolesOnly) return true;
  }
  if (!pronoun) return false;
  if (hasAttributedEditorialCoordination(sentence, sourceUrls)) return false;
  if (softwareReferent.test(sentence)) return true;

  if (productReferences.length === 0 && hasEditorialListAntecedent(sentence, previousSentences)) return false;

  if (!/\bproduct\b/iu.test(sentence) && hasEditorialObjectRouting(sentence)) return false;

  // An imperative's local object can resolve its single subordinate pronoun
  // without adding nouns or complete sentences to the ordinary-referent list.
  // Prior product context has already failed closed above; this is not support
  // for the instruction's factual meaning or any subsequent capability claim.
  if (!/\bproduct\b/iu.test(sentence)
    && [...sentence.matchAll(/\bit\b/giu)].length === 1
    && hasExplicitImperativeObject(prefix, sentence.slice(pronoun.index))) return false;

  // Prior product context and explicit aliases have already failed closed.
  // This resolves only the adjacent ordinary subject, never factual support.
  if (!containsExplicitProductAlias(localContext, claims)
    && hasOrdinaryExplanationAntecedent(sentence, localContext)) return false;

  // The remaining cross-sentence exception is a simple editorial object command.
  // A standalone "It adds captions" still has no explicit ordinary referent.
  const ordinaryObjectInstruction = /^(?:review|read|watch|check|revise) it(?: carefully)?(?: (?:before|after) (?:sharing|recording|publishing|editing|sending|exporting))?[.!]?$/iu;
  return !ordinaryObjectInstruction.test(sentence)
    || !ordinaryReferent.test(localContext)
    || softwareReferent.test(localContext)
    || /\bproduct\b/iu.test(localContext)
    || containsExplicitProductAlias(localContext, claims);
}

function factExactlyMatchesSpan(span: string, factTexts: string[]): boolean {
  const normalizedSpan = normalizeKeyword(span);
  return normalizedSpan.length > 0
    && factTexts.some((text) => normalizeKeyword(text) === normalizedSpan);
}

function inspectClaimBindings(
  context: DraftingContext,
  draft: GeneratedDraftV2,
  visibleSourceIds: string[],
): DraftSafetyFinding[] {
  const factsById = new Map<string, { sourceId: string; text: string; url: string }>();
  for (const source of context.sourceFacts) {
    for (const fact of source.facts) factsById.set(fact.id, { sourceId: source.id, text: fact.text, url: source.url });
  }
  const claimById = new Map(context.productClaims.map((claim) => [claim.id, claim]));
  const expected = generatedClaimSentences(draft);
  const seen = new Set<string>();
  const findings: DraftSafetyFinding[] = [];
  // Visible draft order is authoritative, not the model's binding-array order.
  const productContext = new Map<string, boolean>();
  let priorProductContext = containsExplicitProductAlias(context.candidate.title, context.productClaims);
  for (const { location, span } of expected) {
    const key = `${location}\n${span}`;
    if (productContext.has(key)) findings.push({
      code: 'content.claim_binding', location, span, sourceFactIds: [], reason: 'repeated_span',
      message: `Repeated identical span at ${location}: ${JSON.stringify(span)}. Remove repetition so each visible sentence has one unambiguous binding.`,
    });
    productContext.set(key, priorProductContext);
    priorProductContext ||= containsExplicitProductAlias(span, context.productClaims);
  }
  for (const [bindingIndex, binding] of draft.claimBindings.entries()) {
    const reject = (reason: string, message: string) => findings.push({
      code: 'content.claim_binding', bindingIndex, location: binding.location,
      span: binding.span, sourceFactIds: binding.sourceFactIds, reason,
      message: `Binding ${bindingIndex} at ${binding.location}, span ${JSON.stringify(binding.span)}: ${message}`,
    });
    const key = `${binding.location}\n${binding.span}`;
    const locationValue = generatedLocationValue(draft, binding.location);
    const visibleSentences = locationValue ? claimSpansAtLocation(locationValue, binding.location) : [];
    const sentenceIndex = visibleSentences.indexOf(binding.span);
    const section = binding.location.match(/^\/sections\/(\d+)\/markdown$/);
    // Resolve against visible prose order, never the model's claimBindings order.
    const localContext = sentenceIndex > 0
      ? visibleSentences[sentenceIndex - 1]
      : section ? draft.sections[Number(section[1])]?.heading ?? '' : '';
    if (seen.has(key)) reject('duplicate_binding', 'Use exactly one binding for this location and span.');
    if (!visibleSentences.includes(binding.span)) reject('span_mismatch', 'Bind an exact rendered sentence at an existing location.');
    if (new Set(binding.sourceFactIds).size !== binding.sourceFactIds.length) reject('duplicate_fact', 'Do not repeat source fact IDs.');
    const unknownFacts = binding.sourceFactIds.filter((id) => !factsById.has(id));
    if (unknownFacts.length > 0) reject('unknown_fact', `Unknown source fact IDs: ${unknownFacts.join(', ')}.`);
    const unselectedFacts = binding.sourceFactIds.filter((id) => factsById.has(id) && !visibleSourceIds.includes(factsById.get(id)!.sourceId));
    if (unselectedFacts.length > 0) reject('unselected_source', `Select the parent source for facts: ${unselectedFacts.join(', ')}.`);
    seen.add(key);

    // General prose may paraphrase sources or offer labelled original guidance/examples.
    // This is only structural binding validation, never proof of factual support.
    // The independent critic in drafting.ts must evaluate EVERY binding; lexical
    // overlap cannot establish entailment. Model factual grading is inherently
    // probabilistic and provides no guarantee that a source supports a claim.
    const productClaim = binding.productClaimId === null
      ? undefined
      : claimById.get(binding.productClaimId);
    if (productClaim) {
      if (
        binding.span !== productClaim.text
        || binding.sourceFactIds.some((factId) => !productClaim.allowedSourceFactIds.includes(factId))
        || !factExactlyMatchesSpan(
          binding.span,
          binding.sourceFactIds.map((factId) => factsById.get(factId)?.text ?? ''),
        )
      ) reject('product_claim_mismatch', 'Use exact approved product wording, only its allowed fact IDs, and an exact supporting fact.');
    } else if (binding.productClaimId !== null) {
      reject('unknown_product_claim', `Unknown product claim ID: ${binding.productClaimId}.`);
    } else if (containsProductAlias(
      binding.span, context.productClaims, localContext, productContext.get(key) ?? true,
      binding.sourceFactIds.map((id) => factsById.get(id)?.text ?? ''),
      binding.sourceFactIds.map((id) => factsById.get(id)?.url ?? ''),
      visibleSentences.slice(Math.max(0, sentenceIndex - 2), sentenceIndex),
    )) {
      reject('unapproved_product_reference', 'Explicit or ambiguous VideoClaw reference requires an exact approved product claim; remove the unsupported assertion or make a genuinely non-product referent explicit.');
    }
  }
  for (const { location, span } of expected) {
    if (!seen.has(`${location}\n${span}`)) findings.push({
      code: 'content.claim_binding', location, span, sourceFactIds: [], reason: 'missing_binding',
      message: `Missing exact binding at ${location} for span ${JSON.stringify(span)}. Bind to relevant selected source facts.`,
    });
  }
  return findings;
}

function editorialFindings(context: DraftingContext, draft: GeneratedDraftV2): DraftSafetyFinding[] {
  const findings: DraftSafetyFinding[] = [];
  const add = (code: string, location: string, span: string, message: string) => {
    const bindingIndex = draft.claimBindings.findIndex(binding => binding.location === location && binding.span === span);
    findings.push({
      code, location, span, message, repairInstruction: message,
      ...(bindingIndex >= 0 ? { bindingIndex, sourceFactIds: draft.claimBindings[bindingIndex].sourceFactIds } : {}),
    });
  };
  // A worker editorial policy, not a Google ranking rule or a semantic-quality score.
  const descriptionLength = [...draft.description.trim().replace(/\s+/gu, ' ')].length;
  if (descriptionLength < 80 || descriptionLength > 200) {
    add('content.description_length', '/description', draft.description,
      'Write a specific 80–200 character description of what this article helps the reader do; aim for 120–160 without padding. Rebuild its exact supported bindings.');
  }
  if (normalizeKeyword(draft.description) === normalizeKeyword(context.candidate.title)) {
    add('content.description_duplicate', '/description', draft.description,
      'The description repeats the title. Summarize the practical reader outcome and article contents instead, without promising unsupported results; rebuild its exact bindings.');
  }
  const labels: Array<{ location: string; span: string }> = [];
  const locations = new Set(generatedClaimSentences(draft).map(({ location }) => location));
  for (const location of locations) {
    if (location === '/competitorGap') continue;
    const value = generatedLocationValue(draft, location)!;
    const checkBlock = (span: string) => {
      // Soft wraps and Markdown hard breaks do not change the visible label.
      // Inspect a rendered block but retain its original text for repair; never
      // rewrite the audited draft or change claim-binding segmentation.
      const matches = span.matchAll(/\b(?:original\s+(?:recommendation|editorial\s+note|guidance)|editorial\s+note)\s*:/giu);
      labels.push(...Array.from(matches, () => ({ location, span: span.trim() })));
    };
    if (location.startsWith('/editorialGraphic/')) checkBlock(value);
    else walkMarkdown(parseMarkdown(value), node => {
      if (['paragraph', 'heading', 'tableCell'].includes(node.type)) checkBlock(markdownNodeClaimText(node));
    });
  }
  if (labels.length > 1) {
    for (const { location, span } of labels) {
      add('content.editorial_scaffolding', location, span,
        'Repeated editorial process labels interrupt the article. Establish recommendation context once in a clear section heading or introduction and use natural instructions. Keep hypothetical examples explicit, source attribution accurate and all exact bindings current; do not merely strip labels from factual or product claims.');
    }
  }
  return findings;
}

export function inspectGeneratedDraft(
  context: DraftingContext,
  value: unknown,
  referenceReviews: unknown[] = [],
): DraftSafetyFinding[] {
  const parsed = GeneratedDraftV2Schema.safeParse(value);
  if (!parsed.success) {
    return [finding('content.dto_invalid', parsed.error.issues.map((issue) => issue.message).join('; '))];
  }
  const draft = parsed.data;
  const body = generatedBody(draft);
  const metadata = [
    draft.description,
    draft.customerTrigger,
    draft.competitorGap,
    ...draft.faqAnswers.flatMap(({ question, answer }) => [question, answer]),
  ].join('\n');
  const publishableProse = `${body}\n${metadata}`;
  const findings: DraftSafetyFinding[] = [];
  if (draft.customerTrigger !== context.candidate.icp) {
    findings.push({
      code: 'content.campaign_context', location: '/customerTrigger', span: draft.customerTrigger,
      message: 'customerTrigger must exactly equal the caller-configured candidate.icp; campaign audience metadata is not a source claim.',
      repairInstruction: 'Copy context.candidate.icp verbatim into customerTrigger and do not create a source binding for this field.',
    });
  }
  findings.push(...editorialFindings(context, draft));
  const directAnswerWords = visibleWordCount(draft.directAnswer);
  if (directAnswerWords < 40 || directAnswerWords > 60) {
    findings.push(finding('content.direct_answer_words', `Direct answer has ${directAnswerWords} visible words; expected 40–60.`));
  }
  if (rawHtmlPattern.test(publishableProse)) {
    findings.push(finding('content.raw_html', 'Raw HTML is not allowed in generated article content.'));
  }
  if (/^#\s+\S/m.test(body) || draft.sections.some(({ heading }) => /^#/.test(heading))) {
    findings.push(finding('content.body_h1', 'The generated body cannot contain a Markdown H1.'));
  }
  if (containsSecretLikeValue(draft)) {
    findings.push(finding('content.secret', 'Generated content contains a secret-like value.'));
  }
  if (hasMalformedMarkdown(body)) {
    findings.push(finding('content.markdown_malformed', 'Generated content contains malformed Markdown.'));
  }
  if (researchBoilerplatePattern.test(publishableProse)) {
    findings.push(finding('content.research_boilerplate', 'Public prose contains internal research or debug terminology.'));
  }
  const copyFindings = copiedDraftFindings(context, draft);
  findings.push(...copyFindings);
  if (copyFindings.length === 0 && containsCopiedPassage(publishableProse, context.sourceFacts.flatMap(({ excerpt }) => excerpt ? [excerpt] : []))) {
    findings.push(finding('content.copied_passage', 'Generated content contains a copied source passage.'));
  }
  const actualQuestions = draft.faqAnswers.map(({ question }) => question);
  if (
    actualQuestions.length !== 3
    || actualQuestions.some((question, index) => question !== context.evidence.faqQuestions[index])
  ) {
    findings.push(finding('content.faq_mismatch', 'FAQ questions must exactly match the three PAA-grounded evidence questions.'));
  }
  findings.push(...inspectReferences(context, draft, publishableProse));
  return uniqueFindings(applyReferenceReviews(context, draft, findings, referenceReviews));
}

export function selectProductMedia(
  candidate: Candidate,
  allowlist: AllowlistedProductMedia[],
): AllowlistedProductMedia | undefined {
  const fingerprint = candidateFingerprints(candidate).candidate;
  const keyword = normalizeKeyword(candidate.primaryKeyword);
  const validAllowlist = allowlist.flatMap((media) => {
    const parsed = AllowlistedProductMediaSchema.safeParse(media);
    return parsed.success ? [parsed.data] : [];
  });
  const matches = validAllowlist.filter((media) => {
    const exact = media.candidateFingerprints?.includes(fingerprint) ?? false;
    const campaign = media.campaignIds?.includes(candidate.campaignId) ?? false;
    const keywordMatch = media.keywordIncludes?.some((term) => keyword.includes(normalizeKeyword(term))) ?? false;
    const scoped = Boolean(media.candidateFingerprints?.length || media.campaignIds?.length || media.keywordIncludes?.length);
    return scoped && (exact || (campaign && (!media.keywordIncludes?.length || keywordMatch)) || (!media.campaignIds?.length && keywordMatch));
  });
  return matches.sort((left, right) => {
    const leftExact = left.candidateFingerprints?.includes(fingerprint) ? 1 : 0;
    const rightExact = right.candidateFingerprints?.includes(fingerprint) ? 1 : 0;
    return rightExact - leftExact || left.id.localeCompare(right.id);
  })[0];
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

// Conservative Arial/Helvetica advances in ems, with room for fallback glyphs.
// Layout never relies on a browser font load, canvas, or truncating a field.
function editorialGlyphWidth(grapheme: string): number {
  return [...grapheme].reduce((width, character) => {
    if (/\p{Mark}/u.test(character)) return width;
    if (character === ' ') return width + 0.3;
    if (/[ilI.,'`:;!|]/u.test(character)) return width + 0.35;
    if (/[MWmw@%&#]/u.test(character)) return width + 1;
    if (/[A-Z]/u.test(character)) return width + 0.8;
    if (/[a-z0-9]/u.test(character)) return width + 0.65;
    return width + 1.1;
  }, 0);
}

function wrapEditorialText(value: string, fontSize: number, width: number, preferWords = true): string[] {
  const segments = new Intl.Segmenter('en', { granularity: 'grapheme' })
    .segment(value.replace(/\s+/gu, ' ').trim());
  const lines: string[] = [];
  let line: string[] = [];
  const measure = (characters: string[]) => characters.reduce((sum, character) => sum + editorialGlyphWidth(character) * fontSize, 0);
  for (const { segment } of segments) {
    if (editorialGlyphWidth(segment) * fontSize > width) {
      throw new Error('Editorial graphic contains a grapheme that cannot fit safely.');
    }
    line.push(segment);
    if (measure(line) <= width) continue;
    const overflow = line.pop() as string;
    const space = preferWords ? line.lastIndexOf(' ') : -1;
    const carry = space < 0 ? [] : line.splice(space + 1);
    lines.push(line.join(''));
    line = [...carry, overflow];
  }
  if (line.length > 0) lines.push(line.join(''));
  return lines;
}

function editorialText(
  value: string, lines: string[], x: number, top: number, size: number,
  className: string, weight: number,
): string {
  // The accessible label preserves the original field; the tspans visibly render
  // every character. Keep whitespace at wrap boundaries for exact text recovery.
  return `<text class="${className}" aria-label="${escapeXml(value)}" xml:space="preserve" font-family="Arial,Helvetica,sans-serif" font-size="${size}" font-weight="${weight}" fill="#14151A">${lines.map((line, index) => (
    `<tspan x="${x}" y="${(top + size + index * size * 1.2).toFixed(2)}">${escapeXml(line)}</tspan>`
  )).join('')}</text>`;
}

export function renderEditorialSvg(graphic: GeneratedDraftV2['editorialGraphic']): string {
  const visibleFields = [
    graphic.title,
    graphic.alt,
    ...graphic.steps.flatMap(({ label, detail }) => [label, detail]),
  ];
  if (!visibleFields.every(isXml10Text)) {
    throw new Error('SVG-visible text contains XML-invalid code points.');
  }
  if (!visibleFields.every(isFormatControlFree)) {
    throw new Error('SVG-visible text contains a Unicode format control.');
  }
  GeneratedDraftV2Schema.shape.editorialGraphic.parse(graphic);
  let titleSize = 32;
  let titleLines = wrapEditorialText(graphic.title, titleSize, 1136);
  while (titleLines.length * titleSize * 1.2 > 90 && titleSize > 24) {
    titleSize -= 1;
    titleLines = wrapEditorialText(graphic.title, titleSize, 1136);
  }
  if (titleLines.length * titleSize * 1.2 > 90) {
    titleLines = wrapEditorialText(graphic.title, titleSize, 1136, false);
  }
  // Colors mirror app/blog/blog.css in the production lander.
  const cardWidth = 368;
  const cardHeight = 232;
  const cards = graphic.steps.map((step, index) => {
    const x = 32 + (index % 3) * (cardWidth + 16);
    const y = 174 + Math.floor(index / 3) * (cardHeight + 16);
    let layout: { labelSize: number; detailSize: number; labelLines: string[]; detailLines: string[] } | undefined;
    for (let labelSize = 20; labelSize >= 18 && !layout; labelSize -= 1) {
      const labelLines = wrapEditorialText(step.label, labelSize, cardWidth - 76);
      const available = cardHeight - 18 - labelLines.length * labelSize * 1.2 - 12 - 16;
      for (let detailSize = 18; detailSize >= 15; detailSize -= 1) {
        const detailLines = wrapEditorialText(step.detail, detailSize, cardWidth - 32);
        if (detailLines.length * detailSize * 1.2 <= available) {
          layout = { labelSize, detailSize, labelLines, detailLines };
          break;
        }
      }
    }
    // At the field limits, exceptionally wide words can waste most of each line.
    // Fall back to grapheme boundaries instead of hiding text or shrinking below
    // readable sizes. Whitespace remains part of the rendered text.
    layout ??= {
      labelSize: 18, detailSize: 15,
      labelLines: wrapEditorialText(step.label, 18, cardWidth - 76, false),
      detailLines: wrapEditorialText(step.detail, 15, cardWidth - 32, false),
    };
    const detailTop = y + 18 + layout.labelLines.length * layout.labelSize * 1.2 + 12;
    return [
      `<rect class="card" x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="16" fill="#F1EDE1" stroke="#14151A" stroke-width="2"/>`,
      `<circle cx="${x + 30}" cy="${y + 32}" r="14" fill="#CBF3D9" stroke="#14151A" stroke-width="1"/>`,
      `<text x="${x + 30}" y="${y + 38}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="17" font-weight="700" fill="#14151A">${index + 1}</text>`,
      editorialText(step.label, layout.labelLines, x + 60, y + 18, layout.labelSize, 'label', 700),
      editorialText(step.detail, layout.detailLines, x + 16, detailTop, layout.detailSize, 'detail', 400),
    ].join('');
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc"><title id="title">${escapeXml(graphic.title)}</title><desc id="desc">${escapeXml(graphic.alt)}</desc><rect width="1200" height="675" fill="#F1EDE1"/><text x="32" y="35" font-family="Arial,Helvetica,sans-serif" font-size="16" font-weight="700" letter-spacing="3" fill="#14151A">VIDEOCLAW</text><path d="M32 151 H1168" stroke="#C33672" stroke-width="3"/>${editorialText(graphic.title, titleLines, 32, 54, titleSize, 'title', 700)}${cards}</svg>`;
}

export function normalizeHttpUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    if (url.username || url.password) return undefined;
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}

export function inspectFinalMarkdown(
  markdown: string,
  expectedSources: Array<{ label: string; url: string; checkedAt: string }>,
): DraftSafetyFinding[] {
  const findings: DraftSafetyFinding[] = [];
  const { data: frontmatter, content: body } = matter(markdown);
  const tree = parseMarkdown(body);
  const first = tree.children?.[0];
  if (first?.type !== 'paragraph') {
    findings.push(finding('content.direct_answer_paragraph', 'The final direct answer must be the first top-level paragraph.'));
  } else {
    const wordCount = normalizedWords(markdownNodeText(first)).length;
    if (wordCount < 40 || wordCount > 60) {
      findings.push(finding('content.direct_answer_words', `Final direct answer has ${wordCount} visible words; expected 40–60.`));
    }
  }

  const allowed = new Set(expectedSources.flatMap(({ url }) => {
    const normalized = normalizeHttpUrl(url);
    return normalized ? [normalized] : [];
  }));
  const serializedSources = z.array(z.object({
    label: z.string().refine((value) => singleLineControlFreeString.safeParse(value).success),
    url: z.string().refine((value) => normalizeHttpUrl(value) !== undefined),
    checkedAt: z.string().refine((value) => isStrictIsoDateTime(`${value}T00:00:00.000Z`)),
  }).strict()).min(2).safeParse(frontmatter.sources);
  if (
    !serializedSources.success
    || allowed.size !== expectedSources.length
    || serializedSources.data.length !== expectedSources.length
    || serializedSources.data.some((source, index) => (
      source.label !== expectedSources[index].label
      || source.url !== expectedSources[index].url
      || source.checkedAt !== expectedSources[index].checkedAt
    ))
  ) {
    findings.push(finding(
      'content.sources_structure',
      'The final frontmatter.sources must exactly match the selected source labels, safe URLs, and checked dates.',
    ));
  }
  walkMarkdown(tree, (node) => {
    if (node.type === 'heading') {
      const heading = normalizeKeyword(markdownNodeClaimText(node));
      if (heading === 'source' || heading === 'sources') {
        findings.push(finding('content.body_sources', 'Sources must be rendered from frontmatter.sources, not a generated body section.'));
      }
      if (heading === 'faq' || heading === 'faqs' || heading === 'frequently asked questions') {
        findings.push(finding('content.body_faqs', 'FAQs must be rendered from frontmatter.faqs, not a generated body section.'));
      }
    }
    if (node.type === 'heading' && node.depth === 1) {
      findings.push(finding('content.body_h1', 'The final Markdown cannot contain an H1.'));
    }
    if (node.type === 'html') {
      findings.push(finding('content.raw_html', 'The final Markdown cannot contain raw HTML.'));
    }
    if (node.type === 'code') {
      findings.push(finding('content.code_fence', 'The final Markdown cannot contain fenced or indented code blocks.'));
    }
    if (node.type === 'linkReference' || node.type === 'imageReference' || node.type === 'definition') {
      findings.push(finding('content.reference_link', 'The final Markdown cannot contain reference-style links.'));
    }
    if (node.type !== 'link' && node.type !== 'image') return;
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    const source = start === undefined || end === undefined ? '' : body.slice(start, end);
    if (node.type === 'link' && !source.startsWith('[')) {
      findings.push(finding('content.autolink', 'The final Markdown cannot contain autolinks.'));
    }
    const normalized = node.url ? normalizeHttpUrl(node.url) : undefined;
    if (!normalized) {
      findings.push(finding('content.link_destination', 'Markdown links must use safe HTTP or HTTPS destinations.'));
    } else if (!allowed.has(normalized)) {
      findings.push(finding('content.unsupported_link', 'Every final Markdown link must match the supplied source inventory.'));
    }
  });

  return findings;
}

function inspectFinalSvg(
  svg: string,
  graphic: GeneratedDraftV2['editorialGraphic'],
): DraftSafetyFinding[] {
  const visibleFields = [
    graphic.title,
    graphic.alt,
    ...graphic.steps.flatMap(({ label, detail }) => [label, detail]),
  ];
  const fieldsAreEscaped = visibleFields.every((value) => svg.includes(escapeXml(value)));
  if (
    !/^<svg\b[^>]*\bwidth="1200"[^>]*\bheight="675"/u.test(svg)
    || /<script\b|\son[a-z]+\s*=|(?:href|src)\s*=|javascript:/iu.test(svg)
    || !fieldsAreEscaped
  ) {
    return [finding('content.svg_unsafe', 'The final SVG must be fixed-size, script-free, and contain only escaped visible fields.')];
  }
  return [];
}

function uniqueFindings(findings: DraftSafetyFinding[]): DraftSafetyFinding[] {
  const seen = new Set<string>();
  return findings.filter(({ code, bindingIndex, location, span, reason }) => {
    const key = JSON.stringify([code, bindingIndex, location, span, reason]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function yamlScalar(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null) return 'null';
  throw new Error('Unsupported frontmatter scalar.');
}

function yamlLines(value: unknown, indent = 0): string[] {
  const padding = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${padding}[]`];
    return value.flatMap((item) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const [first, ...rest] = yamlLines(item, indent + 2);
        return [`${padding}- ${first.trimStart()}`, ...rest];
      }
      return [`${padding}- ${yamlScalar(item)}`];
    });
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => {
      if (item === undefined) return [];
      if (item && typeof item === 'object') {
        return [`${padding}${key}:`, ...yamlLines(item, indent + 2)];
      }
      return [`${padding}${key}: ${yamlScalar(item)}`];
    });
  }
  return [`${padding}${yamlScalar(value)}`];
}

function searchMetrics(metrics: KeywordMetrics): Record<string, number | 'provider-pending'> {
  if (metrics.provider === 'pending') {
    return {
      volume: 'provider-pending',
      keywordDifficulty: 'provider-pending',
      cpc: 'provider-pending',
    };
  }
  return {
    ...(metrics.volume === null ? {} : { volume: metrics.volume }),
    ...(metrics.difficulty === null ? {} : { keywordDifficulty: metrics.difficulty }),
    ...(metrics.cpc === null ? {} : { cpc: metrics.cpc }),
  };
}

function funnelStage(stage: Candidate['funnelStage']): 'awareness' | 'consideration' | 'decision' {
  return { top: 'awareness', middle: 'consideration', bottom: 'decision' }[stage] as 'awareness' | 'consideration' | 'decision';
}

function secondaryKeywordsForArticle(context: DraftingContext, draft: GeneratedDraftV2): string[] {
  if (context.candidate.secondaryKeywords.length) return [...context.candidate.secondaryKeywords];
  const primary = normalizeKeyword(context.candidate.primaryKeyword);
  const framing = new Set(['a', 'an', 'the', 'how', 'to', 'make', 'create', 'for', 'of', 'in', 'on', 'and', 'with',
    'is', 'your', 'our', 'guide', 'guides', 'template', 'templates', 'example', 'examples', 'checklist', 'checklists']);
  const topic = primary.split(' ').filter(token => !framing.has(token));
  // An observed secondary phrase must actually be covered on the page. Do not
  // concatenate fields: that could invent a match across sentence boundaries.
  const publicSpans = [context.candidate.title, ...draft.faqAnswers.map(faq => faq.question),
    ...generatedClaimSentences(draft).filter(entry => entry.location !== '/competitorGap').map(entry => entry.span)]
    .map(span => ` ${normalizeKeyword(span)} `);
  for (const observed of [...context.evidence.signals.autocomplete, ...context.evidence.signals.relatedSearches]) {
    if (observed.length > 200 || containsSecretLikeValue(observed) || !isFormatControlFree(observed)) continue;
    const keyword = normalizeKeyword(observed);
    const tokens = new Set(keyword.split(' '));
    if (!keyword || keyword === primary || !topic.length || !topic.every(token => tokens.has(token))) continue;
    if (publicSpans.some(span => span.includes(` ${keyword} `))) return [keyword];
  }
  // Never duplicate the primary keyword or fabricate a query to satisfy the
  // native contract. Preserve candidate identity; this is evidence enrichment
  // in serialization, not a new candidate, demand claim, or publish approval.
  throw new DraftMaterializationError([finding('content.secondary_keyword_missing',
    'An observed, on-topic secondary keyword covered by the article is required; collect evidence rather than inventing metadata.')]);
}

export function materializeDraftBundle(
  context: DraftingContext,
  value: unknown,
  media: AllowlistedProductMedia,
  referenceReviews: unknown[] = [],
): DraftBundle {
  assertSourceFacts(context.sourceFacts);
  const checkedFinalUrls = assertSourceFactsMatchCheckedSources(context);
  isoDateTimeToDateOnly(context.generatedAt);
  const parsedMedia = AllowlistedProductMediaSchema.safeParse(media);
  if (!parsedMedia.success) throw new Error('Invalid media input.');
  const draft = GeneratedDraftV2Schema.parse(value);
  const findings = inspectGeneratedDraft(context, draft, referenceReviews);
  if (findings.length > 0) {
    throw new Error(`Unsafe generated draft: ${findings.map(({ code }) => code).join(', ')}`);
  }
  const sourceById = new Map(context.sourceFacts.map((source) => [source.id, source]));
  const sources = draft.sourceReferences.map(({ sourceId }) => sourceById.get(sourceId) as SourceFact);
  const selectedSourceUrls = sources.flatMap(({ url }) => {
    const normalized = normalizeHttpUrl(url);
    return normalized ? [normalized] : [];
  });
  if (
    selectedSourceUrls.length !== sources.length
    || new Set(selectedSourceUrls).size !== sources.length
    || selectedSourceUrls.some((url) => !checkedFinalUrls.has(url))
  ) {
    throw new Error('Selected visible sources must exactly match distinct reachable checked final URLs.');
  }
  const safeMedia = parsedMedia.data;
  const date = isoDateTimeToDateOnly(context.generatedAt);
  const article = {
    id: context.candidate.articleId,
    campaign: context.candidate.campaignId,
    icp: context.candidate.icp,
    customerTrigger: draft.customerTrigger,
    funnelStage: funnelStage(context.candidate.funnelStage),
    primaryKeyword: context.candidate.primaryKeyword,
    secondaryKeywords: secondaryKeywordsForArticle(context, draft),
    searchIntent: context.candidate.intent,
    competitorGap: draft.competitorGap,
    provenance: context.provenance,
    title: context.candidate.title,
    description: draft.description,
    slug: context.candidate.slug,
    canonicalPath: `/blog/${context.candidate.slug}`,
    sources: sources.map(({ label, url, checkedAt }) => ({
      label,
      url,
      checkedAt: isoDateTimeToDateOnly(checkedAt),
    })),
    faqs: draft.faqAnswers,
    productMedia: {
      src: safeMedia.src,
      poster: safeMedia.poster,
      alt: safeMedia.alt,
      caption: safeMedia.caption,
      width: safeMedia.width,
      height: safeMedia.height,
    },
    editorialGraphic: {
      src: `/media/blog/${context.candidate.slug}.svg`,
      alt: draft.editorialGraphic.alt,
      width: 1200,
      height: 675,
    },
    cta: { label: 'Download the desktop app', href: '/download' },
    status: 'review',
    approvals: { copy: false, factual: false, legal: false, visual: false },
    createdAt: date,
    updatedAt: date,
    searchMetrics: searchMetrics(context.keywordMetrics),
  };
  const body = [
    draft.directAnswer,
    ...draft.sections.map(({ heading, markdown }) => `## ${heading}\n\n${markdown}`),
  ].join('\n\n');
  const markdown = `---\n${yamlLines(article).join('\n')}\n---\n\n${body}\n`;
  const svg = renderEditorialSvg(draft.editorialGraphic);
  const finalFindings = uniqueFindings([
    ...inspectFinalMarkdown(markdown, sources.map(({ label, url, checkedAt }) => ({
      label, url, checkedAt: isoDateTimeToDateOnly(checkedAt),
    }))),
    ...inspectFinalSvg(svg, draft.editorialGraphic),
    ...(!isFormatControlFree(markdown) || !isFormatControlFree(svg)
      ? [finding('content.unicode_format_control', 'Final artifacts contain a Unicode format control.')]
      : []),
    ...(containsCopiedPassage(
      `${markdown}\n${svg}`,
      context.sourceFacts.flatMap(({ excerpt }) => excerpt ? [excerpt] : []),
    ) ? [finding('content.copied_passage', 'Final artifacts contain a copied source passage.')] : []),
    ...(containsSecretLikeValue({ markdown, svg })
      ? [finding('content.secret', 'Final artifacts contain a secret-like value.')]
      : []),
  ]);
  if (finalFindings.length > 0) {
    throw new DraftMaterializationError(finalFindings);
  }
  return DraftBundleSchema.parse({
    schemaVersion: 1,
    candidateFingerprint: candidateFingerprints(context.candidate).candidate,
    article,
    markdown,
    svg,
  });
}
