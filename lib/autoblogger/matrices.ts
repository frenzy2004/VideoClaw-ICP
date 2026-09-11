import {
  CandidateSchema,
  type Candidate,
  type CampaignId,
  candidateFingerprints,
  normalizeIntent,
} from './domain';

type MatrixInput = { campaignId: CampaignId; markdown: string };

type MatrixRejection = {
  candidate: Candidate;
  reason: 'duplicate_keyword' | 'duplicate_title' | 'duplicate_slug';
};

type RawCandidate = {
  articleId: string;
  primaryKeyword: string;
  secondaryKeywords: string;
  title: string;
  slug: string;
  intent: string;
  funnelStage: string;
};

function clean(value: string): string {
  return value
    .replace(/`/g, '')
    .replace(/\*\*/g, '')
    .trim();
}

function keyFor(value: string): string {
  return clean(value).toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, '');
}

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\||\|$/g, '').split('|').map(clean);
}

function isDivider(cells: string[]): boolean {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function toCandidate(raw: RawCandidate, campaignId: CampaignId): Candidate {
  return CandidateSchema.parse({
    ...raw,
    schemaVersion: 1,
    campaignId,
    icp: campaignId,
    secondaryKeywords: raw.secondaryKeywords.split(';').map(clean).filter(Boolean),
    intent: normalizeIntent(raw.intent),
  });
}

function findRawValue(values: Record<string, string>, names: string[]): string | undefined {
  for (const name of names) {
    const value = values[keyFor(name)];
    if (value) return value;
  }
  return undefined;
}

function fromValues(values: Record<string, string>): RawCandidate | undefined {
  const articleId = findRawValue(values, ['article id', 'article_id']);
  const primaryKeyword = findRawValue(values, ['primary keyword', 'primary_keyword']);
  const title = findRawValue(values, ['title']);
  const slug = findRawValue(values, ['human readable slug', 'slug']);
  const intent = findRawValue(values, ['search intent', 'search_intent']);
  const funnelStage = findRawValue(values, ['funnel stage', 'funnel_stage']);
  const secondaryKeywords = findRawValue(values, ['secondary keywords', 'secondary_keywords']) ?? '';

  if (!articleId || !primaryKeyword || !title || !slug || !intent || !funnelStage) return undefined;
  return { articleId, primaryKeyword, secondaryKeywords, title, slug, intent, funnelStage };
}

function parseWideTables(markdown: string, campaignId: CampaignId): Candidate[] {
  const lines = markdown.split('\n');
  const candidates: Candidate[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].includes('|')) continue;
    const headers = splitTableRow(lines[index]);
    if (!headers.some((header) => keyFor(header) === 'articleid')) continue;
    const keys = headers.map(keyFor);

    for (let rowIndex = index + 1; rowIndex < lines.length && lines[rowIndex].includes('|'); rowIndex += 1) {
      const cells = splitTableRow(lines[rowIndex]);
      if (isDivider(cells)) continue;
      const values = Object.fromEntries(keys.map((key, cellIndex) => [key, cells[cellIndex] ?? '']));
      const raw = fromValues(values);
      if (raw) candidates.push(toCandidate(raw, campaignId));
    }
  }

  return candidates;
}

function parseSections(markdown: string, campaignId: CampaignId): Candidate[] {
  const sections = markdown.split(/^###\s+(?=vc-c[1-5]-\d{3}\b)/m).slice(1);
  return sections.flatMap((section) => {
    const articleId = section.match(/^(vc-c[1-5]-\d{3})\b/)?.[1];
    if (!articleId) return [];
    const values: Record<string, string> = { articleid: articleId };

    for (const line of section.split('\n')) {
      const table = line.match(/^\|\s*`?([a-z_ ]+)`?\s*\|\s*(.*?)\s*\|\s*$/i);
      const bullet = line.match(/^-\s+\*\*([^:]+):\*\*\s*(.+)$/);
      const pair = table?.slice(1) ?? bullet?.slice(1);
      if (pair) values[keyFor(pair[0])] = clean(pair[1]);
    }

    const raw = fromValues(values);
    return raw ? [toCandidate(raw, campaignId)] : [];
  });
}

export function intakeMatrixCandidates(markdown: string, campaignId: CampaignId): Candidate[] {
  const candidates = [...parseWideTables(markdown, campaignId), ...parseSections(markdown, campaignId)];
  const unique = new Map<string, Candidate>();
  for (const candidate of candidates) unique.set(candidate.articleId, candidate);
  return [...unique.values()];
}

export function intakeCampaignMatrices(inputs: MatrixInput[]): {
  candidates: Candidate[];
  rejections: MatrixRejection[];
} {
  const candidates: Candidate[] = [];
  const rejections: MatrixRejection[] = [];
  const seen = new Set<string>();

  for (const input of inputs) {
    for (const candidate of intakeMatrixCandidates(input.markdown, input.campaignId)) {
      const fingerprints = candidateFingerprints(candidate);
      const duplicate = (['keyword', 'title', 'slug'] as const).find((kind) => seen.has(fingerprints[kind]));
      if (duplicate) {
        rejections.push({ candidate, reason: `duplicate_${duplicate}` });
        continue;
      }
      seen.add(fingerprints.keyword);
      seen.add(fingerprints.title);
      seen.add(fingerprints.slug);
      candidates.push(candidate);
    }
  }

  return { candidates, rejections };
}
