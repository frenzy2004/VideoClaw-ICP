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
import type { CheckedSource } from './sources';

export const GeneratedDraftV1Schema = z.object({
  schemaVersion: z.literal(1),
  description: z.string().trim().min(1),
  customerTrigger: z.string().trim().min(1),
  competitorGap: z.string().trim().min(1),
  directAnswer: z.string().trim().min(1),
  sections: z.array(z.object({
    heading: z.string().trim().min(1),
    markdown: z.string().trim().min(1),
  }).strict()).min(2),
  faqAnswers: z.array(z.object({
    question: z.string().trim().min(1),
    answer: z.string().trim().min(1),
  }).strict()).length(3),
  sourceReferences: z.array(z.object({
    sourceId: z.string().trim().min(1),
  }).strict()).min(2),
  claimReferences: z.array(z.object({
    claimId: z.string().trim().min(1),
    sourceFactIds: z.array(z.string().trim().min(1)).min(1),
  }).strict()),
  editorialGraphic: z.object({
    title: z.string().trim().min(1).max(100),
    alt: z.string().trim().min(1).max(240),
    steps: z.array(z.object({
      label: z.string().trim().min(1).max(40),
      detail: z.string().trim().min(1).max(120),
    }).strict()).min(3).max(6),
  }).strict(),
}).strict();

export type GeneratedDraftV1 = z.infer<typeof GeneratedDraftV1Schema>;

export const GENERATED_DRAFT_V1_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    schemaVersion: { type: 'integer', const: 1 },
    description: { type: 'string', minLength: 1 },
    customerTrigger: { type: 'string', minLength: 1 },
    competitorGap: { type: 'string', minLength: 1 },
    directAnswer: { type: 'string', minLength: 1 },
    sections: {
      type: 'array',
      minItems: 2,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          heading: { type: 'string', minLength: 1 },
          markdown: { type: 'string', minLength: 1 },
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
          question: { type: 'string', minLength: 1 },
          answer: { type: 'string', minLength: 1 },
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
        properties: { sourceId: { type: 'string', minLength: 1 } },
        required: ['sourceId'],
      },
    },
    claimReferences: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          claimId: { type: 'string', minLength: 1 },
          sourceFactIds: {
            type: 'array',
            minItems: 1,
            items: { type: 'string', minLength: 1 },
          },
        },
        required: ['claimId', 'sourceFactIds'],
      },
    },
    editorialGraphic: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string', minLength: 1, maxLength: 100 },
        alt: { type: 'string', minLength: 1, maxLength: 240 },
        steps: {
          type: 'array',
          minItems: 3,
          maxItems: 6,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              label: { type: 'string', minLength: 1, maxLength: 40 },
              detail: { type: 'string', minLength: 1, maxLength: 120 },
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
    'claimReferences',
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

export type ProductClaim = {
  id: string;
  text: string;
  allowedSourceFactIds: string[];
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

const localAssetPath = z.string().regex(/^\/(?!\/)[^\s?#]+$/);
const AllowlistedProductMediaSchema = z.object({
  id: z.string().trim().min(1),
  candidateFingerprints: z.array(z.string().trim().min(1)).min(1).optional(),
  campaignIds: z.array(CampaignIdSchema).min(1).optional(),
  keywordIncludes: z.array(z.string().trim().min(1)).min(1).optional(),
  src: localAssetPath,
  poster: localAssetPath,
  alt: z.string().trim().min(1),
  caption: z.string().trim().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
}).strict().refine((media) => Boolean(
  media.candidateFingerprints?.length
  || media.campaignIds?.length
  || media.keywordIncludes?.length
));

export type DraftSafetyFinding = {
  code: string;
  message: string;
};

const secretPatterns = [
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/i,
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/i,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(?:APIFY(?:_API)?_(?:TOKEN|KEY)|API[_-]?KEY|TOKEN|SECRET|PASSWORD)\s*[:=]\s*["']?[A-Za-z0-9_./-]{12,}/i,
];
const rawHtmlPattern = /<(?:\/?[a-z][a-z0-9-]*(?=[\t\n\f\r />])|!--|\?|![a-z]|!\[CDATA\[)/i;
const researchBoilerplatePattern = /\b(?:debug research|research notes|SERP|people also ask|candidateFingerprint|sourceFactIds|claimReferences)\b/i;

export function hasSecretLikeValue(value: unknown): boolean {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  return secretPatterns.some((pattern) => pattern.test(serialized));
}

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

function visibleWordCount(markdown: string): number {
  return normalizedWords(
    markdown
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[`*_~>#|]/g, ' '),
  ).length;
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

function generatedBody(draft: GeneratedDraftV1): string {
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
  draft: GeneratedDraftV1,
  body: string,
): DraftSafetyFinding[] {
  const findings: DraftSafetyFinding[] = [];
  const sourceById = new Map(context.sourceFacts.map((source) => [source.id, source]));
  const sourceIds = draft.sourceReferences.map(({ sourceId }) => sourceId);
  if (sourceIds.length < 2 || unique(sourceIds).length !== sourceIds.length || sourceIds.some((id) => !sourceById.has(id))) {
    findings.push(finding('content.citation_mismatch', 'Source references must identify at least two distinct inventory sources.'));
  }
  const allowedUrls = new Set(context.sourceFacts.map(({ url }) => url));
  if (externalUrls(body).some((url) => !allowedUrls.has(url))) {
    findings.push(finding('content.unsupported_link', 'Every external Markdown link must match the supplied source inventory exactly.'));
  }

  const factSource = new Map<string, string>();
  for (const source of context.sourceFacts) {
    for (const fact of source.facts) factSource.set(fact.id, source.id);
  }
  const claimById = new Map(context.productClaims.map((claim) => [claim.id, claim]));
  const validReferencedClaims = new Set<string>();
  for (const reference of draft.claimReferences) {
    const claim = claimById.get(reference.claimId);
    const valid = claim
      && reference.sourceFactIds.length > 0
      && reference.sourceFactIds.every((factId) => (
        claim.allowedSourceFactIds.includes(factId)
        && factSource.has(factId)
        && sourceIds.includes(factSource.get(factId) as string)
      ));
    if (!valid || !body.includes(claim?.text ?? '')) {
      findings.push(finding('content.claim_reference', 'Product claim references must bind used claims to allowed visible source facts.'));
    } else {
      validReferencedClaims.add(reference.claimId);
    }
  }
  for (const claim of context.productClaims) {
    if (body.includes(claim.text) && !validReferencedClaims.has(claim.id)) {
      findings.push(finding('content.claim_reference', 'Every used product claim must have an allowed source-fact reference.'));
    }
  }
  const productSentences = body.split(/(?<=[.!?])\s+/).filter((sentence) => /\bVideoClaw\b/i.test(sentence));
  if (productSentences.some((sentence) => !context.productClaims.some((claim) => sentence.includes(claim.text)))) {
    findings.push(finding('content.claim_reference', 'Generated VideoClaw claims must use caller-supplied claim text.'));
  }
  return findings;
}

export function inspectGeneratedDraft(
  context: DraftingContext,
  value: unknown,
): DraftSafetyFinding[] {
  const parsed = GeneratedDraftV1Schema.safeParse(value);
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
  if (hasSecretLikeValue(draft)) {
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

export function renderEditorialSvg(graphic: GeneratedDraftV1['editorialGraphic']): string {
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
  const draft = GeneratedDraftV1Schema.parse(value);
  const findings = inspectGeneratedDraft(context, draft);
  if (findings.length > 0) {
    throw new Error(`Unsafe generated draft: ${findings.map(({ code }) => code).join(', ')}`);
  }
  const sourceById = new Map(context.sourceFacts.map((source) => [source.id, source]));
  const sources = draft.sourceReferences.map(({ sourceId }) => sourceById.get(sourceId) as SourceFact);
  const date = context.generatedAt.slice(0, 10);
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
    sources: sources.map(({ label, url, checkedAt }) => ({ label, url, checkedAt })),
    faqs: draft.faqAnswers,
    productMedia: {
      src: media.src,
      poster: media.poster,
      alt: media.alt,
      caption: media.caption,
      width: media.width,
      height: media.height,
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
    `## Sources\n\n${sources.map(({ label, url }) => `- [${label}](${url})`).join('\n')}`,
  ].join('\n\n');
  const markdown = `---\n${yamlLines(article).join('\n')}\n---\n\n${body}\n`;
  return DraftBundleSchema.parse({
    schemaVersion: 1,
    candidateFingerprint: candidateFingerprints(context.candidate).candidate,
    article,
    markdown,
    svg: renderEditorialSvg(draft.editorialGraphic),
  });
}
