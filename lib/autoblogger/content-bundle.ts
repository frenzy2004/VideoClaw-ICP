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

const claimLocationPattern = /^\/(?:description|customerTrigger|competitorGap|directAnswer|sections\/\d+\/(?:heading|markdown)|faqAnswers\/\d+\/answer|editorialGraphic\/(?:title|alt)|editorialGraphic\/steps\/\d+\/(?:label|detail))$/;

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
  customerTrigger: nonBlankString,
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
  facts: Array<{ id: string; text: string }>;
  /** Used only for copied-passage comparison. Never included in model input or artifacts. */
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
  }).strict()).min(1),
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
    const normalized = normalizeHttpUrl(source.url);
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
};

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

function containsCopiedPassage(body: string, excerpts: string[]): boolean {
  const bodyWords = normalizedWords(body);
  if (bodyWords.length < 12) return false;
  const bodyText = bodyWords.join(' ');
  return excerpts.some((excerpt) => {
    const words = normalizedWords(excerpt);
    for (let index = 0; index <= words.length - 12; index += 1) {
      if (bodyText.includes(words.slice(index, index + 12).join(' '))) return true;
    }
    return false;
  });
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

  if (!claimBindingsAreValid(context, draft, sourceIds)) {
    findings.push(finding('content.claim_binding', 'Every objective claim must bind its exact location and span to visible allowed source facts.'));
  }
  return findings;
}

function sentences(value: string): string[] {
  return markdownNodeClaimText(parseMarkdown(value))
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .split(/(?<=[.!?])(?:[^\S\n]+|(?=[A-Z]))|\n+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function generatedLocationValue(draft: GeneratedDraftV2, location: string): string | undefined {
  if (location === '/description') return draft.description;
  if (location === '/customerTrigger') return draft.customerTrigger;
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

function usesProseClaimBoundaries(location: string): boolean {
  return /^\/(?:description|customerTrigger|competitorGap|directAnswer|sections\/\d+\/markdown|faqAnswers\/\d+\/answer|editorialGraphic\/steps\/\d+\/detail)$/u.test(location);
}

function generatedClaimSentences(
  context: DraftingContext,
  draft: GeneratedDraftV2,
): Array<{ location: string; span: string }> {
  return [
    { location: '/description', value: draft.description },
    { location: '/customerTrigger', value: draft.customerTrigger },
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
  ].flatMap(({ location, value }) => sentences(value)
    .filter((span) => requiresClaimBinding(
      span,
      context.productClaims,
      usesProseClaimBoundaries(location),
    ))
    .map((span) => ({ location, span })));
}

function containsProductAlias(sentence: string, claims: ProductClaim[]): boolean {
  const normalized = normalizeKeyword(sentence);
  const aliases = ['VideoClaw', ...claims.flatMap(({ subjectAliases }) => subjectAliases)].map(normalizeKeyword);
  return aliases.some((alias) => alias && ` ${normalized} `.includes(` ${alias} `))
    || /\b(?:it|this app|this product|this platform|this tool|the app|the product|the platform|the tool|our app|our product)\b/iu.test(sentence);
}

const pureImperativeOpeningWords = new Set([
  'address', 'bind', 'build', 'capture', 'check', 'choose', 'create', 'define', 'edit',
  'follow', 'include', 'keep', 'make', 'plan', 'record', 'reduce', 'review', 'show', 'start',
  'test', 'then', 'use', 'verify',
]);

function requiresClaimBinding(
  sentence: string,
  claims: ProductClaim[],
  endsAtProseBoundary = false,
): boolean {
  const hasExplicitClaimSignal = containsProductAlias(sentence, claims)
    || /\b(?:can|could|may|might|will|would|shall|should|must|ought\s+to)\b/iu.test(sentence)
    || /\b(?:because|therefore|thereby|thus|so\s+that|causes|caused|leads\s+to|led\s+to|results\s+in|resulted\s+in|enables|enabled|ensures|ensured|allows|allowed|guarantees|guaranteed|protects|protected|prevents|prevented|preserves|preserved|delivers|delivered|achieves|achieved|drives|drove|driven|cuts|cutting|reduces|reduced|increases|increased|improves|improved|boosts|boosted|saves|saved|doubles|doubled|triples|tripled|converts|converted|conversion|revenue|growth|outcome|faster|slower|higher|lower|shorter|shortest|longer|longest|better|worse|more|less|fewer|most|least|best|half|twice|need|needs|require|requires)\b/iu.test(sentence)
    || /\b(?:am|is|are|was|were|be|been|being|has|have|had|does|do|did|prefers?|costs?)\b/iu.test(sentence)
    || /\bto\s+(?:protect|prevent|preserve|deliver|achieve|drive|cut|reduce|increase|improve|boost|save|convert)\b/iu.test(sentence)
    || /\b\d+(?:\.\d+)?(?:\s?(?:%|x)|\s+(?:times?|minutes?|hours?|days?|weeks?|months?))?\b/iu.test(sentence);
  if (hasExplicitClaimSignal) return true;
  if (sentence.endsWith('?')) return false;
  const firstWord = sentence.toLocaleLowerCase('en-US').match(/^[a-z]+/)?.[0] ?? '';
  if (pureImperativeOpeningWords.has(firstWord)) return false;
  return endsAtProseBoundary || /[.!]$/u.test(sentence);
}

function factExactlyMatchesSpan(span: string, factTexts: string[]): boolean {
  const normalizedSpan = normalizeKeyword(span);
  return normalizedSpan.length > 0
    && factTexts.some((text) => normalizeKeyword(text) === normalizedSpan);
}

function claimBindingsAreValid(
  context: DraftingContext,
  draft: GeneratedDraftV2,
  visibleSourceIds: string[],
): boolean {
  const factsById = new Map<string, { sourceId: string; text: string }>();
  for (const source of context.sourceFacts) {
    for (const fact of source.facts) factsById.set(fact.id, { sourceId: source.id, text: fact.text });
  }
  const claimById = new Map(context.productClaims.map((claim) => [claim.id, claim]));
  const expected = generatedClaimSentences(context, draft);
  const seen = new Set<string>();
  for (const binding of draft.claimBindings) {
    const key = `${binding.location}\n${binding.span}`;
    const locationValue = generatedLocationValue(draft, binding.location);
    const visibleSentences = locationValue ? sentences(locationValue) : [];
    if (
      seen.has(key)
      || !visibleSentences.includes(binding.span)
      || !requiresClaimBinding(
        binding.span,
        context.productClaims,
        usesProseClaimBoundaries(binding.location),
      )
      || new Set(binding.sourceFactIds).size !== binding.sourceFactIds.length
      || binding.sourceFactIds.some((factId) => (
        !factsById.has(factId)
        || !visibleSourceIds.includes(factsById.get(factId)?.sourceId as string)
      ))
      || !factExactlyMatchesSpan(
        binding.span,
        binding.sourceFactIds.map((factId) => factsById.get(factId)?.text ?? ''),
      )
    ) return false;
    seen.add(key);

    const productClaim = binding.productClaimId === null
      ? undefined
      : claimById.get(binding.productClaimId);
    if (productClaim) {
      if (
        binding.span !== productClaim.text
        || binding.sourceFactIds.some((factId) => !productClaim.allowedSourceFactIds.includes(factId))
      ) return false;
    } else if (binding.productClaimId !== null || containsProductAlias(binding.span, context.productClaims)) {
      return false;
    }
  }
  return expected.length === draft.claimBindings.length
    && expected.every(({ location, span }) => seen.has(`${location}\n${span}`));
}

export function inspectGeneratedDraft(
  context: DraftingContext,
  value: unknown,
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
  if (containsCopiedPassage(publishableProse, context.sourceFacts.flatMap(({ excerpt }) => excerpt ? [excerpt] : []))) {
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
  return unique(findings.map(({ code }) => code)).map((code) => findings.find((item) => item.code === code) as DraftSafetyFinding);
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
  const cardWidth = 1040 / graphic.steps.length;
  const cards = graphic.steps.map((step, index) => {
    const x = 80 + (index * cardWidth);
    const center = x + (cardWidth - 16) / 2;
    return [
      `<rect x="${x.toFixed(2)}" y="235" width="${(cardWidth - 16).toFixed(2)}" height="250" rx="22" fill="#172554" stroke="#60a5fa" stroke-width="2"/>`,
      `<circle cx="${center.toFixed(2)}" cy="285" r="24" fill="#38bdf8"/>`,
      `<text x="${center.toFixed(2)}" y="294" text-anchor="middle" class="number">${index + 1}</text>`,
      `<text x="${center.toFixed(2)}" y="348" text-anchor="middle" class="label">${escapeXml(step.label)}</text>`,
      `<foreignObject x="${(x + 14).toFixed(2)}" y="372" width="${(cardWidth - 44).toFixed(2)}" height="92"><div xmlns="http://www.w3.org/1999/xhtml" class="detail">${escapeXml(step.detail)}</div></foreignObject>`,
    ].join('');
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc"><title id="title">${escapeXml(graphic.title)}</title><desc id="desc">${escapeXml(graphic.alt)}</desc><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#020617"/><stop offset="1" stop-color="#1e3a8a"/></linearGradient><style>.title{font:700 42px system-ui,sans-serif;fill:#f8fafc}.brand{font:700 18px system-ui,sans-serif;letter-spacing:4px;fill:#7dd3fc}.number{font:700 20px system-ui,sans-serif;fill:#082f49}.label{font:700 19px system-ui,sans-serif;fill:#f8fafc}.detail{font:400 15px/1.45 system-ui,sans-serif;color:#cbd5e1;text-align:center;overflow:hidden}</style></defs><rect width="1200" height="675" fill="url(#bg)"/><text x="80" y="92" class="brand">VIDEOCLAW</text><text x="80" y="158" class="title">${escapeXml(graphic.title)}</text>${cards}<path d="M80 550 H1120" stroke="#38bdf8" stroke-width="3"/><text x="80" y="600" class="brand">SOURCE-CONTROLLED EDITORIAL WORKFLOW</text></svg>`;
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

function inspectFinalMarkdown(
  markdown: string,
  expectedSources: Array<{ label: string; url: string }>,
): DraftSafetyFinding[] {
  const findings: DraftSafetyFinding[] = [];
  const body = matter(markdown).content;
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
  walkMarkdown(tree, (node) => {
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

  const sourceHeadingIndexes = tree.children?.flatMap((node, index) => (
    node.type === 'heading'
    && node.depth === 2
    && markdownNodeText(node).trim() === 'Sources'
      ? [index]
      : []
  )) ?? [];
  const sourceHeadingIndex = sourceHeadingIndexes[0] ?? -1;
  const trailingNodes = sourceHeadingIndex < 0 ? [] : tree.children?.slice(sourceHeadingIndex + 1) ?? [];
  const sourceList = trailingNodes[0];
  const sourceItems = sourceList?.children ?? [];
  const exactSourcesStructure = sourceHeadingIndexes.length === 1
    && trailingNodes.length === 1
    && sourceList?.type === 'list'
    && sourceList.ordered === false
    && sourceItems.length === expectedSources.length
    && sourceItems.every((item, index) => {
      const expected = expectedSources[index];
      const paragraph = item.type === 'listItem' && item.children?.length === 1
        ? item.children[0]
        : undefined;
      const link = paragraph?.type === 'paragraph' && paragraph.children?.length === 1
        ? paragraph.children[0]
        : undefined;
      const normalizedDestination = link?.url ? normalizeHttpUrl(link.url) : undefined;
      return link?.type === 'link'
        && link.children?.length === 1
        && link.children[0].type === 'text'
        && link.children[0].value === expected?.label
        && normalizedDestination === normalizeHttpUrl(expected?.url ?? '');
    });
  if (!exactSourcesStructure) {
    findings.push(finding(
      'content.sources_structure',
      'The final Sources section must be exactly one link-only list matching the selected source labels and URLs.',
    ));
  }
  return findings;
}

function escapeMarkdownLabel(value: string): string {
  const escapable = new Set('\\`*_{}[]()#+-.!<>|~'.split(''));
  return [...value].map((character) => escapable.has(character) ? `\\${character}` : character).join('');
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
  return unique(findings.map(({ code }) => code))
    .map((code) => findings.find((item) => item.code === code) as DraftSafetyFinding);
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

export function materializeDraftBundle(
  context: DraftingContext,
  value: unknown,
  media: AllowlistedProductMedia,
): DraftBundle {
  assertSourceFacts(context.sourceFacts);
  const checkedFinalUrls = assertSourceFactsMatchCheckedSources(context);
  isoDateTimeToDateOnly(context.generatedAt);
  const parsedMedia = AllowlistedProductMediaSchema.safeParse(media);
  if (!parsedMedia.success) throw new Error('Invalid media input.');
  const draft = GeneratedDraftV2Schema.parse(value);
  const findings = inspectGeneratedDraft(context, draft);
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
    secondaryKeywords: context.candidate.secondaryKeywords,
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
    `## Sources\n\n${sources.map(({ label, url }) => `- [${escapeMarkdownLabel(label)}](${url})`).join('\n')}`,
  ].join('\n\n');
  const markdown = `---\n${yamlLines(article).join('\n')}\n---\n\n${body}\n`;
  const svg = renderEditorialSvg(draft.editorialGraphic);
  const finalFindings = uniqueFindings([
    ...inspectFinalMarkdown(markdown, sources.map(({ label, url }) => ({ label, url }))),
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
    throw new Error(`Unsafe final artifacts: ${finalFindings.map(({ code }) => code).join(', ')}`);
  }
  return DraftBundleSchema.parse({
    schemaVersion: 1,
    candidateFingerprint: candidateFingerprints(context.candidate).candidate,
    article,
    markdown,
    svg,
  });
}
