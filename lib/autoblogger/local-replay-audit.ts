import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, open } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import type { AllowlistedProductMedia, DraftingContext } from './content-bundle';
import type { DraftingOutcome } from './drafting';
import type { StructuredOutputClient } from './openai-responses';
import { containsSecretLikeValue } from './secrets';

export type LocalReplayRecorder = (name: string, payload: unknown) => Promise<void>;

// Reject rather than redact: changed facts or prompts cannot be called an exact replay.
function safePayload(payload: unknown, secrets: string[]): string {
  let serialized: string;
  try { serialized = JSON.stringify(payload); } catch { throw new Error('Unsafe replay payload.'); }
  if (typeof serialized !== 'string' || Buffer.byteLength(serialized) > 8_000_000) throw new Error('Replay record exceeds the byte limit.');
  const pending: unknown[] = [JSON.parse(serialized)];
  let nodes = 0;
  while (pending.length) {
    if (++nodes > 200_000) throw new Error('Replay record exceeds the structural limit.');
    const value = pending.pop();
    if (typeof value === 'string') {
      if (containsSecretLikeValue(value) || secrets.some((secret) => secret && value.includes(secret))) throw new Error('Unsafe replay payload.');
      // Wire bodies and user input are nested JSON strings. Inspect their keys too.
      if (/^\s*[\[{]/u.test(value)) {
        let decoded: unknown;
        try { decoded = JSON.parse(value); } catch { continue; }
        pending.push(decoded);
      }
    } else if (Array.isArray(value)) pending.push(...value);
    else if (value && typeof value === 'object') {
      for (const [key, entry] of Object.entries(value)) {
        if (/^(?:headers?|authorization|proxy-authorization|cookies?|set-cookie|api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)$/iu.test(key)) throw new Error('Unsafe replay payload.');
        pending.push(key, entry);
      }
    }
  }
  return serialized;
}

/** Private local receipts only; never pass these payloads to compact reports/state. */
export function createLocalReplayRecorder(options: { root: string; directory: string; secrets?: string[] }): LocalReplayRecorder {
  return async (name, payload) => {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/u.test(name)) throw new Error('Unsafe replay record name.');
    const serialized = safePayload(payload, options.secrets ?? []);
    const root = resolve(options.root);
    const directory = resolve(options.directory, name);
    const suffix = relative(root, directory);
    if (!suffix.startsWith(`artifacts${sep}autoblogger${sep}`)) throw new Error('Replay records must stay in local autoblogger artifacts.');
    const path = resolve(directory, 'validation-report.json');
    const environment: Record<string, string | undefined> = { PATH: process.env.PATH, HOME: process.env.HOME, GIT_OPTIONAL_LOCKS: '0' };
    try {
      // No --no-index: a force-tracked artifact must also fail this check.
      execFileSync('git', ['-C', root, 'check-ignore', '--quiet', '--', path], { env: environment as NodeJS.ProcessEnv, stdio: 'ignore', timeout: 10_000 });
    } catch { throw new Error('Replay destination must be Git-ignored and untracked.'); }
    let current = root;
    for (const segment of ['', ...suffix.split(sep)]) {
      if (segment) current = resolve(current, segment);
      try { await mkdir(current, { mode: 0o700 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
      const info = await lstat(current);
      if (info.isSymbolicLink() || !info.isDirectory()) throw new Error('Replay destination must use real directories.');
    }
    const file = await open(path, 'wx', 0o600);
    try {
      await file.writeFile(JSON.stringify({ schemaVersion: 1, recordedAt: new Date().toISOString(), payloadSha256: createHash('sha256').update(serialized).digest('hex'), payload: JSON.parse(serialized) }) + '\n', 'utf8');
      await file.sync();
    } finally { await file.close(); }
    const parent = await open(directory, 'r');
    try { await parent.sync(); } finally { await parent.close(); }
  };
}

export function createReplayAuditedClient(client: StructuredOutputClient, record: LocalReplayRecorder): StructuredOutputClient {
  let call = 0;
  return { async generate(request) {
    await record(`request-${++call}-${request.name}`, { call, request });
    return client.generate(request);
  } };
}

export function createReplayAuditedDrafter(
  drafter: { prepareEvidence?(context: DraftingContext): Promise<DraftingContext>; draft(context: DraftingContext): Promise<DraftingOutcome> },
  record: LocalReplayRecorder,
  mediaAllowlist: AllowlistedProductMedia[],
  research: () => unknown,
) {
  return {
    ...(drafter.prepareEvidence ? { async prepareEvidence(context: DraftingContext) {
      await record('faq-preparation-input', {context, research: research()});
      const prepared = await drafter.prepareEvidence!(context);
      await record('faq-preparation-output', {context: prepared});
      return prepared;
    }} : {}),
    async draft(context: DraftingContext) {
      await record('draft-context', { context, mediaAllowlist, research: research() });
      return drafter.draft(context);
    },
  };
}
