// This is a conservative English lexical screen, not semantic verification.
// Format words may rank already-topical evidence, but cannot establish a topic.
const FRAMING = new Set('a an the of in for with and or on at is are what when your you from this that should do can how to it its be by as does has have i my we our make create making creating'.split(' '));
const FORMATS = new Set('checklist template guide example tip step practice best overview introduction'.split(' '));
const GENERIC = new Set('product content business tool solution service process system'.split(' '));

function words(text: string): string[] {
  return (text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    // Limited plural normalization; no synonyms or inferred subject expansion.
    // Preserve framing words before stemming: "does" must not become "doe".
    .map(word => !FRAMING.has(word) && word.length > 3 && word.endsWith('s') && !/(ss|us|is)$/.test(word) ? word.slice(0, -1) : word);
}

// Broader support discovery only, never a replacement for the exact demand
// query. Retain substantive topic qualifiers while omitting format/framing words.
export function sourceTopicQuery(query: string): string {
  return query.normalize('NFKC').toLowerCase().trim().split(/\s+/u).filter(token => {
    const word = token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    return word && !FRAMING.has(word) && !FORMATS.has(word)
      && !(word.endsWith('s') && FORMATS.has(word.slice(0, -1)));
  }).join(' ');
}

/** Ranking only, after the unchanged core-topic gate. Preserve complementary
 * title-task passages; lexical overlap is never semantic approval of a claim.
 * Limited workflow inflections avoid losing "record" to "recording". */
export function matchSourceTitleTasks(query: string, title: string, body: string): Set<string> {
  const taskForm = (word: string) => {
    if (['record', 'recording', 'recorded'].includes(word)) return 'record';
    if (['rehearse', 'rehearsal', 'rehearsed', 'rehearsing'].includes(word)) return 'rehearse';
    if (['plan', 'planned', 'planning'].includes(word)) return 'plan';
    return word;
  };
  const queryTerms = new Set(words(query).map(taskForm));
  const titleTerms = new Set(words(title).filter(word => !FRAMING.has(word) && !FORMATS.has(word))
    .map(taskForm).filter(word => !queryTerms.has(word)));
  const bodyTerms = new Set(words(body).map(taskForm));
  return new Set([...titleTerms].filter(word => bodyTerms.has(word)));
}

/** All non-format query terms (including qualifiers) must occur in one bounded
 * sentence with additional prose. Do not combine unrelated sentences/FAQ terms.
 * Return only a lexical ranking score: it does not certify a claim's support.
 * bodyStart is the extractor's documented offset, never inferred from prose.
 * Legacy text without it has only this limited screen: flattened headings cannot
 * be distinguished from prose. New extracted evidence always carries an offset.
 */
export function scoreSourceTopic(query: string, text: string, bodyStart = 0): number {
  if (!Number.isInteger(bodyStart) || bodyStart < 0 || bodyStart > text.length) return 0;
  const queryTerms = new Set(words(query).filter(word => !FRAMING.has(word)));
  const core = [...queryTerms].filter(word => !FORMATS.has(word));
  if (!core.some(word => !GENERIC.has(word))) return 0;
  const seen = new Set<string>();
  let score = 0;
  for (const sentence of text.slice(bodyStart).split(/[.!?\n]+/u)) {
    const tokens = words(sentence);
    const key = tokens.join(' ');
    if (tokens.length < 6 || tokens.length > 48 || seen.has(key)) continue;
    seen.add(key);
    const terms = new Set(tokens);
    if (!core.every(term => terms.has(term))) continue;
    const additional = [...terms].filter(term => !queryTerms.has(term) && !FRAMING.has(term) && !FORMATS.has(term) && !GENERIC.has(term));
    if (additional.length < 2) continue;
    score += 1 + [...queryTerms].filter(term => FORMATS.has(term) && terms.has(term)).length / (queryTerms.size + 1);
  }
  return score;
}

/** Conservative selection/budget grouping only, not a canonical URL claim.
 * Query/www/slash variants cannot earn an additional evidence slot or allowance.
 * Authority always belongs to the actual fetched final URL, never this key.
 */
export function sourcePageIdentity(value: string): string {
  const url = new URL(value);
  return `${url.hostname.replace(/^www\./, '')}${url.port ? `:${url.port}` : ''}${url.pathname.replace(/\/+$/, '')}`;
}
