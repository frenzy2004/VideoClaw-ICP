const VIDEO_OR_SOCIAL_DOMAINS = new Set([
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'tiktok.com',
  'twitter.com',
  'vimeo.com',
  'x.com',
  'youtube.com',
]);

const ARTICLE_PATH_PATTERN = /\/(article|articles|blog|blogs|guide|guides|insight|insights|news|resource|resources)(\/|$)/i;

function requireNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }

  return value.trim();
}

function requireObservedAt(value, field = 'observedAt') {
  const observedAt = requireNonEmptyString(value, field);
  if (Number.isNaN(Date.parse(observedAt))) {
    throw new TypeError(`${field} must be an ISO-compatible timestamp`);
  }

  return observedAt;
}

function requireUsCountry(value, field) {
  const country = requireNonEmptyString(value, field).toUpperCase();
  if (country !== 'US') {
    throw new RangeError(`${field} must identify the US campaign locale`);
  }

  return country;
}

function requireEnglishLanguage(value, field) {
  const language = requireNonEmptyString(value, field).toLocaleLowerCase('en-US');
  if (language !== 'en') {
    throw new RangeError(`${field} must identify the English campaign locale`);
  }

  return language;
}

function dedupeStrings(values) {
  const seen = new Set();
  const output = [];

  for (const value of values) {
    if (typeof value !== 'string' || value.trim() === '') continue;
    const trimmed = value.trim();
    const key = trimmed.toLocaleLowerCase('en-US');
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(trimmed);
  }

  return output;
}

function domainFromUrl(value) {
  const url = new URL(requireNonEmptyString(value, 'organic result URL'));
  return url.hostname.toLocaleLowerCase('en-US').replace(/^www\./, '');
}

function classifyResult(url, domain) {
  if (VIDEO_OR_SOCIAL_DOMAINS.has(domain)) return 'video_or_social';
  if (ARTICLE_PATH_PATTERN.test(new URL(url).pathname)) return 'article';
  return 'other';
}

function normalizeComparableText(value) {
  return value
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Normalize one result from automation-lab/google-autocomplete-scraper.
 * The function deliberately retains only fields observed by the Actor.
 */
export function normalizeAutocompleteItem(item) {
  if (!item || typeof item !== 'object') {
    throw new TypeError('autocomplete item must be an object');
  }

  const depth = Number(item.depth ?? 0);
  if (!Number.isInteger(depth) || depth < 0) {
    throw new RangeError('depth must be a non-negative integer');
  }

  return {
    keyword: requireNonEmptyString(item.keyword, 'keyword'),
    suggestion: requireNonEmptyString(item.suggestion, 'suggestion'),
    parentKeyword:
      item.parentKeyword == null
        ? null
        : requireNonEmptyString(item.parentKeyword, 'parentKeyword'),
    depth,
    country: requireUsCountry(item.country, 'country'),
    language: requireEnglishLanguage(item.language, 'language'),
    scrapedAt: requireObservedAt(item.scrapedAt, 'scrapedAt'),
  };
}

/**
 * Normalize one first-page item from apify/google-search-scraper.
 */
export function normalizeSerpItem(item, provenance) {
  if (!item || typeof item !== 'object') {
    throw new TypeError('SERP item must be an object');
  }
  if (!provenance || typeof provenance !== 'object') {
    throw new TypeError('SERP provenance must be an object');
  }

  const query = item.searchQuery;
  if (!query || typeof query !== 'object') {
    throw new TypeError('searchQuery must be present');
  }

  const page = Number(query.page);
  if (page !== 1) {
    throw new RangeError('SERP evidence must come from the first page');
  }

  const organicResults = Array.isArray(item.organicResults)
    ? item.organicResults.slice(0, 10).map((result, index) => {
        const url = requireNonEmptyString(result.url, `organicResults[${index}].url`);
        const domain = domainFromUrl(url);
        const position = Number(result.position);
        if (!Number.isInteger(position) || position < 1) {
          throw new RangeError(`organicResults[${index}].position must be positive`);
        }

        return {
          position,
          title: requireNonEmptyString(result.title, `organicResults[${index}].title`),
          url,
          domain,
          snippet: typeof result.description === 'string' ? result.description.trim() : '',
          resultType: classifyResult(url, domain),
        };
      })
    : [];

  const peopleAlsoAsk = dedupeStrings(
    Array.isArray(item.peopleAlsoAsk)
      ? item.peopleAlsoAsk.map((entry) =>
          typeof entry === 'string' ? entry : entry?.question ?? entry?.title,
        )
      : [],
  );
  const relatedQueries = dedupeStrings(
    Array.isArray(item.relatedQueries)
      ? item.relatedQueries.map((entry) =>
          typeof entry === 'string' ? entry : entry?.title ?? entry?.query,
        )
      : [],
  );

  return {
    query: requireNonEmptyString(query.term, 'searchQuery.term'),
    country: requireUsCountry(query.countryCode, 'searchQuery.countryCode'),
    language: requireEnglishLanguage(query.languageCode, 'searchQuery.languageCode'),
    device: requireNonEmptyString(query.device, 'searchQuery.device').toUpperCase(),
    page,
    observedAt: requireObservedAt(provenance.observedAt),
    actorId: requireNonEmptyString(provenance.actorId, 'actorId'),
    runId: requireNonEmptyString(provenance.runId, 'runId'),
    datasetId: requireNonEmptyString(provenance.datasetId, 'datasetId'),
    organicResults,
    peopleAlsoAsk,
    relatedQueries,
  };
}

/**
 * Score observed evidence density without claiming demand, difficulty, rank
 * potential, or editorial ICP fit. Explicit editorial review is recorded as a
 * separate status and never contributes to the evidence score.
 */
export function rankObservedOpportunity(record) {
  if (!record || typeof record !== 'object') {
    throw new TypeError('observed opportunity must be an object');
  }

  const query = requireNonEmptyString(record.query, 'query');
  const relevanceStatus =
    record.intentReview?.status === 'approved_for_mvp_draft'
      ? 'approved_for_mvp_draft'
      : 'pending_editorial_intent_review';
  const organicResults = Array.isArray(record.organicResults) ? record.organicResults : [];
  const peopleAlsoAskCount = Math.min(
    4,
    Array.isArray(record.peopleAlsoAsk) ? new Set(record.peopleAlsoAsk).size : 0,
  );
  const relatedQueryCount = Math.min(
    8,
    Array.isArray(record.relatedQueries) ? new Set(record.relatedQueries).size : 0,
  );
  const normalizedQuery = normalizeComparableText(query);
  const exactTitleMatches = Math.min(
    10,
    organicResults.filter(
      (result) => normalizeComparableText(String(result?.title ?? '')) === normalizedQuery,
    ).length,
  );
  const articleResults = organicResults.filter((result) => result?.resultType === 'article').length;
  const videoOrSocialResults = organicResults.filter(
    (result) => result?.resultType === 'video_or_social',
  ).length;
  const evidenceScore = Math.max(
    0,
    peopleAlsoAskCount + relatedQueryCount - exactTitleMatches,
  );

  return {
    query,
    relevance: null,
    relevanceStatus,
    exactTitleMatches,
    articleResults,
    videoOrSocialResults,
    peopleAlsoAskCount,
    relatedQueryCount,
    evidenceScore,
    scoreExplanation: [
      relevanceStatus === 'approved_for_mvp_draft'
        ? 'Editorial ICP relevance: approved for MVP draft and excluded from evidence score'
        : 'Editorial ICP relevance: pending review and excluded from evidence score',
      `Exact-title saturation: ${exactTitleMatches}/10`,
      `People Also Ask questions: ${peopleAlsoAskCount}`,
      `Related queries: ${relatedQueryCount}`,
    ],
  };
}

/**
 * Prefer the most complete observation when the same query was retried.
 * Ties keep the later observation so provenance reflects the retry.
 */
export function selectBestSerpEvidence(records, query) {
  const comparableQuery = requireNonEmptyString(query, 'query').toLocaleLowerCase('en-US');
  const matches = records.filter(
    (record) =>
      typeof record?.query === 'string'
      && record.query.toLocaleLowerCase('en-US') === comparableQuery,
  );
  if (matches.length === 0) return undefined;

  return matches.reduce((best, candidate) => {
    const bestCount = Array.isArray(best.organicResults) ? best.organicResults.length : 0;
    const candidateCount = Array.isArray(candidate.organicResults)
      ? candidate.organicResults.length
      : 0;
    if (candidateCount > bestCount) return candidate;
    if (candidateCount < bestCount) return best;
    return Date.parse(candidate.observedAt ?? 0) >= Date.parse(best.observedAt ?? 0)
      ? candidate
      : best;
  });
}

/**
 * Keep the matrix primary when it has organic evidence; otherwise choose the
 * secondary with the densest observed SERP features. This automatic fallback
 * is not an editorial ICP-fit decision and remains pending intent review.
 */
export function selectObservedArticleQuery(candidateQueries, records) {
  if (!Array.isArray(candidateQueries) || candidateQueries.length === 0) {
    throw new TypeError('candidateQueries must contain a primary query');
  }

  const [matrixPrimaryKeyword, ...secondaryKeywords] = candidateQueries.map((query) =>
    requireNonEmptyString(query, 'candidate query'),
  );
  const primaryEvidence = selectBestSerpEvidence(records, matrixPrimaryKeyword);
  if (primaryEvidence?.organicResults?.length > 0) {
    return {
      matrixPrimaryKeyword,
      selectedKeyword: primaryEvidence.query,
      selectionDecision: 'retained_observed_primary',
      evidence: primaryEvidence,
    };
  }

  const fallbacks = secondaryKeywords
    .map((query) => selectBestSerpEvidence(records, query))
    .filter((evidence) => evidence?.organicResults?.length > 0)
    .map((evidence) => ({ evidence, score: rankObservedOpportunity(evidence) }))
    .sort((left, right) => right.score.evidenceScore - left.score.evidenceScore);
  const fallback = fallbacks[0]?.evidence;
  if (!fallback) return undefined;

  return {
    matrixPrimaryKeyword,
    selectedKeyword: fallback.query,
    selectionDecision:
      'replaced_empty_primary_with_serp_observed_secondary_pending_intent_review',
    evidence: fallback,
  };
}
