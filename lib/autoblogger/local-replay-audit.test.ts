import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createLocalReplayRecorder, createReplayAuditedClient, createReplayAuditedDrafter } from './local-replay-audit';
import type { DraftingContext } from './content-bundle';

async function fixture(ignored = true) {
  const root = await mkdtemp(join(tmpdir(), 'local-replay-audit-'));
  execFileSync('git', ['init', '--quiet', root]);
  if (ignored) await writeFile(join(root, '.gitignore'), '/artifacts/autoblogger/\n');
  const directory = join(root, 'artifacts/autoblogger/fixture/replay');
  return { root, directory, record: createLocalReplayRecorder({ root, directory, secrets: ['opaque-credential-fixture'] }) };
}

describe('private local replay records', () => {
  it('retains exact ordered facts, excerpts and provenance with a verifiable hash and private permissions', async () => {
    const f = await fixture();
    const payload = { context: { sourceFacts: [{ id: 'source-2', facts: [{ id: 'fact-9', text: 'Original supporting text.' }], excerpt: 'Exact original body passage for copy checking.' }], generatedAt: '2026-09-05T20:00:00.000Z' }, provenance: { paa: { runId: 'historical-run', observedAt: '2026-09-05T19:24:00.000Z' }, paaAttempts: [{ runId: 'current-empty-run' }] } };
    await f.record('draft-context', payload);
    const file = join(f.directory, 'draft-context/validation-report.json');
    const saved = JSON.parse(await readFile(file, 'utf8'));
    expect(saved.payload).toEqual(payload);
    expect(saved.payloadSha256).toBe(createHash('sha256').update(JSON.stringify(payload)).digest('hex'));
    expect((await stat(file)).mode & 0o777).toBe(0o600);
    expect((await stat(f.directory)).mode & 0o777).toBe(0o700);
    await expect(f.record('draft-context', { changed: true })).rejects.toThrow();
    expect(JSON.parse(await readFile(file, 'utf8')).payload).toEqual(payload);
  });

  it.each([
    { excerpt: 'opaque-credential-fixture' },
    { facts: [{ text: 'sk-proj-abcdefghijklmnopqrstuv' }] },
    { headers: { innocuous: 'value' } },
    { apiKey: 'short' },
    { requestBody: JSON.stringify({ input: [{ content: [{ text: JSON.stringify({ Authorization: 'short' }) }] }] }) },
  ])('rejects unsafe content without redaction or persistence: %#', async (payload) => {
    const f = await fixture();
    await expect(f.record('unsafe', payload)).rejects.toThrow(/unsafe/i);
    await expect(stat(join(f.directory, 'unsafe'))).rejects.toThrow();
  });

  it('refuses unignored, tracked, outside-root and symlink destinations', async () => {
    const f = await fixture(false);
    await expect(f.record('context', {})).rejects.toThrow();
    const allowed = await fixture();
    await allowed.record('context', {});
    const file = join(allowed.directory, 'context/validation-report.json');
    execFileSync('git', ['-C', allowed.root, 'add', '-f', file]);
    await expect(allowed.record('context', {})).rejects.toThrow();
    await expect(createLocalReplayRecorder({ root: allowed.root, directory: join(allowed.root, 'tracked-output') })('context', {})).rejects.toThrow();
    const outside = await mkdtemp(join(tmpdir(), 'replay-symlink-'));
    await symlink(outside, join(allowed.directory, 'escape'));
    await expect(allowed.record('escape', {})).rejects.toThrow();
    expect(await readdir(outside)).toEqual([]);
  });

  it('rejects oversized records without creating a truncated replay', async () => {
    const f = await fixture();
    await expect(f.record('large', { excerpt: 'x'.repeat(8_000_001) })).rejects.toThrow(/limit/i);
    await expect(stat(join(f.directory, 'large'))).rejects.toThrow();
  });
});

describe('local-only audit boundaries', () => {
  it('persists the exact structured input before delegating without altering the request or response', async () => {
    const f = await fixture();
    const request = { name: 'article_critique', system: 'Original instructions', schema: { type: 'object' }, input: { bindingManifest: [{ bindingIndex: 0, bindingHash: 'original-hash' }], sourceFacts: [{ facts: [{ id: 'f1', text: 'Original fact.' }] }] } };
    const response = { approved: false };
    const client = createReplayAuditedClient({ async generate(received) {
      const saved = JSON.parse(await readFile(join(f.directory, 'request-1-article_critique/validation-report.json'), 'utf8'));
      expect(saved.payload.request).toEqual(request);
      expect(received).toBe(request);
      return response;
    } }, f.record);
    expect(await client.generate(request)).toBe(response);
  });

  it('retains full gate context separately without changing the model projection or rejected outcome', async () => {
    const f = await fixture();
    const context = { sourceFacts: [{ id: 's1', facts: [{ id: 'f1', text: 'Exact fact' }], excerpt: 'Exact excerpt' }], provenance: { capturedAt: '2026-09-05' } } as DraftingContext;
    const outcome = { status: 'blocked' as const, reason: 'content_safety_failed' as const, findings: [] };
    const drafter = createReplayAuditedDrafter({ async draft(received) {
      const saved = JSON.parse(await readFile(join(f.directory, 'draft-context/validation-report.json'), 'utf8'));
      expect(saved.payload.context).toEqual(context);
      expect(saved.payload.research).toEqual({ paaCacheReused: true });
      expect(saved.payload.mediaAllowlist).toEqual([]);
      expect(received).toBe(context);
      return outcome;
    } }, f.record, [], () => ({ paaCacheReused: true }));
    expect(await drafter.draft(context)).toBe(outcome);
  });

  it('does not dispatch generation when its exact input is unsafe', async () => {
    const f = await fixture();
    let dispatched = false;
    const client = createReplayAuditedClient({ async generate() { dispatched = true; return {}; } }, f.record);
    await expect(client.generate({ name: 'article_draft', schema: {}, system: '', input: { text: 'opaque-credential-fixture' } })).rejects.toThrow(/unsafe/i);
    expect(dispatched).toBe(false);
  });
});
