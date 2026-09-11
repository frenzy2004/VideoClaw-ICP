import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import { containsSecretLikeValue } from './secrets';
import type { StructuredOutputClient } from './openai-responses';
import type { SafeSourceChecker, SourceRetrievalMetadata } from './sources';
import type { SourceRelevanceReviewer } from './source-admission';
import type { AutobloggerWorkerOptions } from './worker';
import type { HttpTransport } from './http';

type Session = { runId: string; id: string; sequence: number; operation: number; active: boolean; omittedRecords: number; integrityError?: Error };

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value) ?? 'undefined').digest('hex');
}

const forbiddenKey = /^(?:headers?|authorization|proxy-authorization|cookies?|set-cookie|api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)$/iu;
const containers = new Set(['issues', 'newIssues', 'evaluations', 'supportEvaluations', 'referenceReviews',
  'editorialReview', 'instructionConsistency', 'sectionUsefulness', 'readerFacingProse', 'selections', 'anchors', 'findings', 'decisions']);
const flags = new Set(['approved', 'resolved', 'supported', 'passed', 'relevant', 'repaired']);
const identifiers = new Set(['id', 'issueId', 'code', 'kind', 'classification', 'status', 'sourceFactId', 'documentId']);
const hashes = new Set(['contextHash', 'draftHash', 'bindingHash']);
const indices = new Set(['bindingIndex', 'passageIndex', 'reportedPassageIndex']);
const prose = new Set(['message', 'repairInstruction', 'rationale', 'reason', 'question', 'intent', 'excerpt']);

// Only decision structure survives. Prose (which may quote source bodies) and
// selected excerpts are represented by hashes, never copied into these receipts.
function verdict(value: unknown, depth = 0): unknown {
  if (depth > 16) throw new Error('Audit decision exceeds structural limit.');
  if (Array.isArray(value)) {
    if (value.length > 1024) throw new Error('Audit decision exceeds array limit.');
    return value.map(item => verdict(item, depth + 1));
  }
  if (!value || typeof value !== 'object') return {};
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (containers.has(key)) result[key] = verdict(entry, depth + 1);
    else if (flags.has(key) && typeof entry === 'boolean') result[key] = entry;
    else if (hashes.has(key) && typeof entry === 'string' && /^[a-f0-9]{64}$/u.test(entry)) result[key] = entry;
    else if (indices.has(key) && Number.isInteger(entry) && (entry as number) >= 0) result[key] = entry;
    else if (identifiers.has(key) && typeof entry === 'string') {
      if (!/^[A-Za-z0-9_./:-]{1,160}$/u.test(entry)) throw new Error('Unsafe audit decision identifier.');
      result[key] = entry;
    } else if (['issueIds', 'locations'].includes(key) && Array.isArray(entry)) {
      if (entry.length > 1024 || entry.some(item => typeof item !== 'string' || !/^[A-Za-z0-9_./:-]{1,160}$/u.test(item))) throw new Error('Unsafe audit decision references.');
      result[key] = [...entry];
    } else if (prose.has(key) && typeof entry === 'string') result[`${key}Sha256`] = hash(entry);
  }
  return result;
}

function sourceMetadata(documents: SourceRetrievalMetadata[]) {
  return documents.map(({ finalUrl, checkedAt, bodySha256 }) => {
    const url = new URL(finalUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
      || [...url.searchParams.keys()].some(key => forbiddenKey.test(key) || /token|credential|signature/iu.test(key))) {
      throw new Error('Unsafe audit source URL.');
    }
    return { finalUrl, checkedAt, bodySha256 };
  });
}

/** Private, compact receipts in the Actions artifact tree (existing seven-day
 * retention). Missing receipts fail execution before success can be returned.
 * The wrapped operations still receive/return their original objects; recording
 * failures never replace an original operation error. */
export function createRuntimeAudit(options: {
  write(record: unknown, name: string): Promise<void>;
  secrets?: readonly (string | null | undefined)[];
}) {
  const sessions = new AsyncLocalStorage<Session>();
  let writes = Promise.resolve();

  function assertIntegrity(): void {
    const session = sessions.getStore();
    if (session?.active && session.integrityError) throw session.integrityError;
  }

  function assertSafe(value: unknown): void {
    if (containsSecretLikeValue(value)) throw new Error('Unsafe audit content.');
    const pending = [value];
    const seen = new WeakSet<object>();
    let nodes = 0;
    while (pending.length) {
      if (++nodes > 200_000) throw new Error('Audit content exceeds structural limit.');
      const item = pending.pop();
      if (typeof item === 'string') {
        if (containsSecretLikeValue(item) || options.secrets?.some(secret => secret && item.includes(secret))) throw new Error('Unsafe audit content.');
        if (/%[a-f0-9]{2}/iu.test(item)) {
          try { const decoded = decodeURIComponent(item); if (decoded !== item) pending.push(decoded); }
          catch { /* Non-URL prose can contain literal percent signs. */ }
        }
        if (/^\s*[\[{]/u.test(item)) {
          try { pending.push(JSON.parse(item)); } catch { /* Not nested JSON. */ }
        }
      } else if (item && typeof item === 'object' && !seen.has(item)) {
        seen.add(item);
        for (const [key, child] of Object.entries(item)) {
          if (forbiddenKey.test(key)) throw new Error('Unsafe audit content.');
          pending.push(key, child);
        }
      }
    }
  }

  async function record(phase: string, status: string, fields: () => object = () => ({})) {
    const session = sessions.getStore();
    if (!session?.active) return;
    const sequence = ++session.sequence;
    try {
      const entry = { schemaVersion: 1, runId: session.runId, executionId: session.id,
        sequence, recordedAt: new Date().toISOString(), phase, status, ...fields() };
      const serialized = JSON.stringify(entry);
      if (Buffer.byteLength(serialized) > 128_000) throw new Error('Audit record exceeds byte limit.');
      assertSafe(entry);
      // No user/model text is used as a path component. Each event has its own
      // destination, including repeated or concurrent invocations of a run ID.
      const writing = writes.then(() => options.write(entry, `${session.id}-${String(sequence).padStart(6, '0')}`));
      writes = writing.catch(() => {});
      await writing;
    } catch {
      session.omittedRecords++;
      session.integrityError ??= new Error('Required runtime audit evidence could not be safely retained.');
    }
  }

  async function observe<T>(phase: string, input: unknown, operation: () => Promise<T>, summarize: (value: T) => object = value => ({ verdict: verdict(value) })): Promise<T> {
    const session = sessions.getStore();
    if (!session?.active) return operation();
    assertIntegrity();
    const operationId = ++session.operation;
    await record(phase, 'started', () => {
      assertSafe(input);
      return { operationId, inputSha256: hash(input) };
    });
    assertIntegrity();
    let result: T;
    try {
      result = await operation();
    } catch (error) {
      await record(phase, 'failed', () => ({ operationId, errorSha256: hash(String(error)) }));
      throw error;
    }
    await record(phase, 'completed', () => {
      assertSafe(result);
      return { operationId, resultSha256: hash(result), ...summarize(result) };
    });
    assertIntegrity();
    return result;
  }

  return {
    paidTransport(transport: HttpTransport): HttpTransport {
      // Guard only. Never inspect or record transport headers, bodies or keys.
      return async request => { assertIntegrity(); return transport(request); };
    },
    async retrievedSource(metadata: SourceRetrievalMetadata): Promise<void> {
      assertIntegrity();
      await record('source_retrieval', 'observed', () => ({ sources: sourceMetadata([metadata]) }));
      assertIntegrity();
    },
    client(client: StructuredOutputClient): StructuredOutputClient {
      return { generate: request => observe(request.name, request, () => client.generate(request)) };
    },
    drafter<T extends AutobloggerWorkerOptions['drafter']>(drafter: T): T {
      return { ...drafter,
        ...(drafter.prepareEvidence ? { prepareEvidence: (context: Parameters<NonNullable<T['prepareEvidence']>>[0]) =>
          observe('faq_evidence_gate', context, () => drafter.prepareEvidence!(context), prepared => ({ verdict: verdict(prepared.faqEvidencePlan) })) } : {}),
        draft: context => observe('draft_gate', context, () => drafter.draft(context)),
      };
    },
    sourceReviewer(reviewer: SourceRelevanceReviewer): SourceRelevanceReviewer {
      return async (documents, options) => {
        await record('source_documents', 'observed', () => ({ sources: sourceMetadata(documents) }));
        assertIntegrity();
        return observe('source_relevance_gate', { documents, options }, () => reviewer(documents, options));
      };
    },
    sourceChecker<T extends SafeSourceChecker>(checker: T): T {
      return { ...checker,
        ...(checker.read ? { read: (url: string, options?: Parameters<NonNullable<T['read']>>[1]) =>
          observe('source_read', { url, options }, () => checker.read!(url, options), doc => ({ sources: sourceMetadata([doc]) })) } : {}),
        ...(checker.selectWithContent ? { selectWithContent: (urls: string[], options?: Parameters<NonNullable<T['selectWithContent']>>[1]) =>
          observe('source_selection', { urls, options }, () => checker.selectWithContent!(urls, options), result => ({
            sources: sourceMetadata(result.sourceDocuments), verdict: verdict(result.sourceRelevanceReceipt),
          })) } : {}),
      };
    },
    async execute<T>(input: { runId: string }, operation: () => Promise<T>): Promise<T> {
      const session: Session = { runId: input.runId, id: randomUUID(), sequence: 0, operation: 0, active: true, omittedRecords: 0 };
      return sessions.run(session, async () => {
        try {
          await record('execution', 'started');
          assertIntegrity();
          let result: T;
          try { result = await operation(); }
          catch (error) {
            await record('execution', 'failed', () => ({ errorSha256: hash(String(error)), omittedRecords: session.omittedRecords }));
            throw error;
          }
          await record('execution', session.integrityError ? 'failed' : 'completed', () => ({
            verdict: { status: session.integrityError ? 'audit_integrity_failed' : (result as { status?: unknown })?.status },
            omittedRecords: session.omittedRecords,
          }));
          if (session.integrityError) throw session.integrityError;
          return result;
        } finally {
          session.active = false;
        }
      });
    },
  };
}
