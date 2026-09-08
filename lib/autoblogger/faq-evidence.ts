import type { SourceFact } from './content-bundle';

const STOP = new Set('a an the of for to and or in on at with it you your i we they their my'.split(' '));
const normalize = (text: string) => text.normalize('NFKC').toLowerCase().replace(/artificial intelligence/gu, 'ai');
const words = (text: string) => normalize(text).match(/[\p{L}\p{N}]+/gu) ?? [];
const stem = (word: string) => word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word;
const subjectWords = (text: string) => words(text).filter(word => !STOP.has(word)).map(stem);

/** Conservative retrieval screen, NOT semantic entailment or permission to quote.
 * Require the complete question subject and an answer-shaped sentence in actual
 * body prose. Missing/ambiguous coverage blocks drafting; the independent critic
 * still verifies the generated answer and its exact fact bindings afterwards.
 */
export function faqBodyMatches(question: string, text: string, bodyStart = 0): boolean {
  if (!Number.isInteger(bodyStart) || bodyStart < 0 || bodyStart > text.length) return false;
  const query = normalize(question).trim().replace(/\?+$/u, '').trim();
  const mode = /^how long\b/u.test(query) ? 'duration'
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
  return sentences.some(sentence => {
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
    if (mode === 'cost') return /\b(?:costs?|budgets?|pric(?:e|es|ing)|expenses?|expensive)\b/u.test(sentence)
      && /\b(?:depends?|var(?:y|ies)|ranges?|from|includes?)\b|[$€£]\s*\d/u.test(sentence);
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
}

export function planFaqEvidence(questions: readonly string[], sources: SourceFact[]) {
  return questions.map(question => ({ question, sourceFactIds: sources.flatMap(s => s.facts
    .filter(f => f.evidenceKind === 'body' && faqBodyMatches(question, f.text, f.bodyStart))
    .map(f => f.id)) }));
}
