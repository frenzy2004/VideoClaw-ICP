import type { SourceFact } from './content-bundle';

const STOP = new Set('a an the of for to and or in on at with it you your i we they their my'.split(' '));
const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/artificial intelligence/gu, 'ai');
const words = (text: string) => normalize(text).match(/[\p{L}\p{N}]+/gu) ?? [];
const stem = (word: string) => word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word;
const subjectWords = (text: string) => words(text).filter(word => !STOP.has(word)).map(stem);
const normalizedQuestion = (text: string) => normalize(text.replace(/\s+/gu, ' ')).trim().replace(/\?+$/u, '').trim();
// Retain word order, punctuation and qualifiers (including "for"/"without").
// Only a leading article and the existing noun inflection are normalized.
const fullSubject = (text: string) => normalize(text).trim().replace(/^(?:a|an|the)\s+/u, '')
  .replace(/\s+/gu, ' ').replace(/[\p{L}\p{N}]+/gu, stem);

function costSubject(query: string): string | null {
  const match = /^how much does it cost to (?:make|create) (.+)$/u.exec(query)
    ?? /^how much (?:does|do) (.+?) cost$/u.exec(query);
  const subject = match ? fullSubject(match[1]) : '';
  return subject && !/^(?:it|this|that|these|those|you|we|they)$/u.test(subject) ? subject : null;
}

/** Deduplicate only the recognized cost grammar, using the matcher's full subject. */
export function faqQuestionKey(question: string): string {
  const query = normalizedQuestion(question);
  const subject = costSubject(query);
  return subject ? `cost:${subject}` : query;
}

function directAssertion(sentence: string): boolean {
  return !sentence.trim().endsWith('?')
    && !/\b(?:not|never|no|neither|nor|cannot|except|if|when|unless|provided|assuming|suppose|supposing|imagine|hypothetical|hypothetically|fictional|may|might|could|would|will|later|next|elsewhere|instead|rather|learn|discover|explain|cover|discuss|answer)\b|\b\w+n['’]t\b/u.test(sentence)
    && !/\b(?:under certain conditions|in theory|as an example)\b/u.test(sentence);
}

const COST_AMOUNT = String.raw`[$€£]\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?`;
const COST_VALUE = new RegExp(String.raw`^(?:(?:(?:is|are)\s+)?${COST_AMOUNT}|ranges? from ${COST_AMOUNT} to ${COST_AMOUNT})$`, 'u');
const COST_DRIVER = /^(?:the )?(?:(?:production )?crew|editing (?:time|budget|work required)|recording time|distribution budget|production scope|campaign scope|production budget|length|video type|complexity)$/u;

function costMatches(subject: string, sentence: string): boolean {
  if (!directAssertion(sentence)) return false;
  // Keep qualifications in scope BEFORE removing an attribution prefix. An
  // invented/example scenario is not evidence of an actual price or driver.
  if (/\b(?:examples?|illustrativ\w*|illustration|imaginary|invented|fabricated|mock|simulat\w*|scenario|placeholder)\b|\bmade[ -]up\b/u.test(sentence)) return false;
  // A bounded attribution may precede the saved price assertion. The entire
  // grammatical cost subject must still match, not words elsewhere in a claim.
  const statement = sentence.trim().replace(/[.!]$/u, '').replace(/^according to [^,]{1,100},\s*/u, '');
  const of = /^(?:the )?(?:average )?costs? of (.+?)\s+(is|are|depends?|varies|vary|ranges?)\s+(.+)$/u.exec(statement);
  const direct = /^(.+?)\s+costs?\s+(.+)$/u.exec(statement);
  const target = of?.[1] ?? direct?.[1];
  const predicate = of ? `${of[2]} ${of[3]}` : direct?.[2];
  if (!target || !predicate || fullSubject(target) !== subject) return false;
  // Consume the entire predicate. A price prefix cannot hide a disclaimer or
  // teaser, and a range must actually name both monetary endpoints.
  if (COST_VALUE.test(predicate)) return true;
  const dependency = /^(?:depends? on|var(?:y|ies) (?:with|by))\s+(.+)$/u.exec(predicate);
  if (!dependency) return false;
  // Only explicit, recognized production drivers count. Generic "factors",
  // unnamed dependencies and labels with trailing prose remain unsupported.
  const drivers = dependency[1].split(/,\s*(?:and\s+)?|\s+and\s+/u);
  return drivers.length <= 8 && drivers.every(driver => COST_DRIVER.test(driver));
}

function typesMatch(subject: string, sentence: string): boolean {
  if (!directAssertion(sentence)) return false;
  const statement = sentence.trim().replace(/[.!]$/u, '');
  const assertion = /^(?:the )?(?:(?:different|main) )?types of (.+?)\s+(?:include|are)\s+(.+)$/u.exec(statement)
    ?? /^you can use any type of (.+?),\s+including\s+(.+)$/u.exec(statement);
  if (!assertion || fullSubject(assertion[1]) !== subject) return false;
  // Complete short labels in one assertion; no headings, inferred antecedents,
  // count-only claims, continuations, or lists assembled across sentences.
  const labels = assertion[2].split(/,\s*(?:and\s+)?|\s+and\s+/u);
  return labels.length >= 2 && labels.length <= 8 && labels.every(label =>
    /^[\p{L}\p{N}]+(?:[ -][\p{L}\p{N}]+){0,3}$/u.test(label)
    && !/\b(?:is|are|can|should|must|to|for|with|without|that|which|we|you|they|something|anything|nothing|etc)\b/u.test(label));
}

/** A procedure heading may supply the purpose, never the requested operation
 * or its object. Those must occur together in an actual imperative body step.
 * Keep this within one extracted passage; do not pool words from unrelated
 * sentences, source facts or pages. Ambiguous question forms remain blocked.
 */
function scopedProcedureMatches(query: string, heading: string, sentences: string[]): boolean {
  const match = /^how\s+(?:(?:do|does|can|should)\s+(?:i|you|we|they)\s+|to\s+)?(record|edit|export)\s+(.+?)\s+for\s+(.+)$/u.exec(query);
  if (!match) return false;
  const [, operation, object, purpose] = match;
  const objectTokens = subjectWords(object);
  const purposeTokens = subjectWords(purpose);
  if (!objectTokens.length || !purposeTokens.length) return false;
  const operationForm = new RegExp(`^${operation}(?:s|ed|ing)?$`, 'u');
  const canonicalOperation = (token: string) => operationForm.test(token) ? operation : token;
  const headingTokens = subjectWords(normalize(heading).replace(/^(?:step\s+)?\d+[.)-]?\s*/u, '')).map(canonicalOperation);
  if (headingTokens.join(' ') !== [operation, ...purposeTokens].join(' ')) return false;
  return sentences.some(sentence => {
    const step = sentence.trim();
    if (step.endsWith('?')
      || /\b(?:not|never|without|cannot|can't|don't|for|instead|rather|but|however|off|disable\w*|deactivat\w*)\b/u.test(step)
      || /\b(?:learn|discover|find out|read about)\s+(?:how|what|why|whether)\b/u.test(step)) return false;
    // Whitespace tokenization deliberately retains internal punctuation. A
    // comma, colon or semicolon cannot turn separate clauses into a control.
    const tokens = step.replace(/^(?:first|next|then|finally),?\s+/u, '').replace(/[.!]$/u, '').split(/\s+/u);
    if (!tokens.every(token => /^[\p{L}\p{N}]+$/u.test(token))) return false;
    const verb = tokens.shift();
    if (!verb) return false;
    if (['the', 'your', 'my', 'our', 'a', 'an'].includes(tokens[0])) tokens.shift();
    // Require an actual verb–object instruction or a directly selected named
    // control such as "Screen Recording". Do not join independent actions or
    // flattened list items merely because their words share a sentence.
    const expected = verb === operation ? objectTokens
      : ['click', 'open', 'select', 'choose', 'press', 'use'].includes(verb) ? [...objectTokens, operation] : [];
    // Compare the original verb before normalizing noun forms: "Recording
    // your screen is unsupported" is not the imperative "Record your screen".
    const target = tokens.map(stem).map(canonicalOperation);
    return expected.length > 0 && target.length === expected.length
      && expected.every((token, index) => target[index] === token);
  });
}

/** Conservative retrieval screen, NOT semantic entailment or permission to quote.
 * Require an answer-shaped body sentence, optionally scoped by an explicit
 * procedure heading. Missing/ambiguous coverage blocks drafting; the independent
 * critic still verifies the generated answer and exact fact bindings afterwards.
 */
export function faqBodyMatches(question: string, text: string, bodyStart = 0): boolean {
  if (!Number.isInteger(bodyStart) || bodyStart < 0 || bodyStart > text.length) return false;
  const query = normalizedQuestion(question);
  // This lexical screen cannot establish comparative superiority.
  if (/\b(?:best|worst|top|most|least|cheapest|priciest|greatest|easiest|fastest)\b/u.test(query)) return false;
  const naming = /^what (?:is|are) (.+?) called$/u.exec(query);
  const mode = naming ? 'naming' : /^how long\b/u.test(query) ? 'duration'
    : /^how much\b/u.test(query) ? 'cost'
      : /^what are (?:the )?benefits\b/u.test(query) ? 'benefits'
        : /^what (?:is|are)\b/u.test(query) ? 'definition'
          : /^how\b/u.test(query) ? 'procedure'
            : /^why\b/u.test(query) ? 'reason'
              : /^what (?:belongs|should|do|does|can)\b/u.test(query) ? 'contents' : null;
  if (!mode) return false;
  // Strip grammar at its position, not subject nouns such as a marketing plan.
  let subjectText = query.replace(/^(?:how long|how much|what (?:is|are|belongs|should|do|does|can)|how|why)\b\s*/u, '');
  if (mode !== 'definition' && mode !== 'benefits') {
    subjectText = subjectText.replace(/^(?:do|does|should|would|can|could|is|are)\s+/u, '')
      .replace(/^(?:you|i|we|they)\s+/u, '');
    if (mode === 'procedure') subjectText = subjectText.replace(/^(?:to\s+)?(?:plan|make|create)\s+/u, '');
    if (mode === 'duration') subjectText = subjectText.replace(/\s+be$/u, '');
    if (mode === 'cost') subjectText = subjectText.replace(/\s+costs?$/u, '');
    if (mode === 'reason') subjectText = subjectText.replace(/\s+matters?$/u, '');
    if (mode === 'contents') subjectText = subjectText.replace(/(?:^includes?\s+|\s+includes?$)/u, '');
  }
  const subject = subjectWords(subjectText);
  if (!subject.length) return false;
  // A decimal point stays inside its sentence; ordinary punctuation still separates claims.
  const sentences = normalize(text.slice(bodyStart)).match(/(?:[^.!?]|(?<=\d)\.(?=\d))+[.!?]?/gu) ?? [];
  if (mode === 'cost') {
    const target = costSubject(query);
    return !!target && sentences.some(sentence => costMatches(target, sentence));
  }
  const types = /^what are (?:the )?(?:(?:different|main) )?types of (.+)$/u.exec(query);
  if (types) return sentences.some(sentence => typesMatch(fullSubject(types[1]), sentence));
  if (naming) {
    // A naming question requires an explicit alias assertion, not just a
    // definition or a conditional subtype such as "if this is a screencast".
    // Match the complete grammatical subject; never pool topic words.
    const nameSubject = (value: string) => words(value.trim().replace(/^(?:a|an|the)\s+/u, '')).map(stem).join(' ');
    return sentences.some(sentence => {
      const statement = sentence.trim().replace(/[.!]$/u, '');
      if (/\b(?:not|never|no|neither|nor|if|when|unless|provided|providing|assuming|only|some|sometimes|may|might|could|would|however|but|instead)\b/u.test(statement)) return false;
      const assertion = /^(.+?)\s+(?:is|are)\s+(?:also\s+)?(?:called|known as|referred to as)\s+(.+)$/u.exec(statement)
        ?? /^(.+?),\s+(?:also\s+)?(?:known|referred to) as\s+([^,]+),\s+.+$/u.exec(statement);
      if (!assertion || nameSubject(assertion[1]) !== nameSubject(naming[1])) return false;
      const alias = assertion[2];
      // Admit a short explicit name, not an idiom or a trailing instruction.
      return /^(?:an? |the )?[\p{L}\p{N}]+(?:[ -][\p{L}\p{N}]+){0,7}$/u.test(alias)
        && !/\b(?:into|out|upon|on|to|for|under|by|because|after|before|is|are|something|anything|nothing|someone|we|you|they|it|this|that|which|who|where)\b/u.test(alias.replace(/how-to/gu, 'howto'));
    });
  }
  const directMatch = sentences.some(sentence => {
    if (sentence.trim().endsWith('?')) return false;
    // Repeating a question or promising a later explanation is not answer-shaped prose.
    if (/^\s*(?:what|how|why|which|when|where)\b/u.test(sentence)
      || /\b(?:learn|discover|find out|read about)\s+(?:how|what|why|whether)\b/u.test(sentence)
      || /\b(?:will|going to)\s+(?:\w+\s+)?(?:explain|cover|discuss|show|teach|learn|define|describe|answer)\b/u.test(sentence)
      || /\b(?:guide|article|page|post|section|tutorial)\s+(?:explains?|covers?|discusses?|shows?|teaches?|answers?)\b/u.test(sentence)) return false;
    const tokens = new Set(words(sentence).map(stem));
    if (!subject.every(term => tokens.has(term))) return false;
    if (/\b(?:not|never)\s+(?:defined|covered|explained|discussed)|\b(?:does not|doesn't)\s+(?:define|cover|explain)/u.test(sentence)) return false;
    if (mode === 'duration') return /\b(?:\d+(?:\.\d+)?|one|two|three|five|ten|sixty)\s*(?:[-–]\s*\d+(?:\.\d+)?\s*)?(?:second|minute|hour)s?\b/u.test(sentence);
    if (mode === 'benefits') {
      const listing = /\bincludes?\b/u.exec(sentence);
      if (!listing) return false;
      const before = new Set(subjectWords(sentence.slice(0, listing.index)));
      return subject.every(term => before.has(term)) && words(sentence.slice(listing.index + listing[0].length)).length >= 4;
    }
    if (mode === 'definition') {
      // A copula about some other subject in the same paragraph is not a definition.
      const copula = /\b(is|are|means?|refers? to|describes?)\b/u.exec(sentence);
      if (!copula) return false;
      const before = subjectWords(sentence.slice(0, copula.index));
      const after = sentence.slice(copula.index + copula[0].length).trim();
      return before.slice(-subject.length).join(' ') === subject.join(' ')
        && words(after).length >= 4
        && (!/^(?:is|are)$/u.test(copula[0]) || /^(?:an? |the (?:use|process|practice|act|method)|using |when )/u.test(after));
    }
    if (mode === 'procedure' || mode === 'contents') return /\b(?:plan|choose|select|start|record|write|use|prepare|include|introduce|rehearse|show|check|test|define|review|explain|speaking)\b/u.test(sentence);
    return /\b(?:because|helps?|allows?|enables?|important|benefits?|so that|in order to)\b/u.test(sentence);
  });
  return directMatch || (mode === 'procedure' && bodyStart > 0
    && scopedProcedureMatches(query, text.slice(0, bodyStart).trim(), sentences));
}

export function planFaqEvidence(questions: readonly string[], sources: SourceFact[]) {
  return questions.map(question => ({ question, sourceFactIds: sources.flatMap(s => s.facts
    .filter(f => f.evidenceKind === 'body' && faqBodyMatches(question, f.text, f.bodyStart))
    .map(f => f.id)) }));
}
