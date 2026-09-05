import { describe, expect, it } from 'vitest';
import { CandidateSchema, candidateFingerprints } from './domain';
import { createPersistentWorkerState } from './github-runtime';
import { markCandidateFailure, markCandidateScanned, reserveCandidate, reserveManualPilot } from './recovery';
import { reconcileLocalPilotCandidate, createModelAuditTransport, inspectLocalPilotInventory, parseLocalPilotArguments } from './local-pilot';

const original = CandidateSchema.parse({
  schemaVersion: 1, articleId: 'vc-c2-001', campaignId: 'accelerator-demo-day-founder', icp: 'accelerator-demo-day-founder',
  primaryKeyword: 'Demo Day video planning checklist', secondaryKeywords: [], title: 'The Evergreen Demo Day Video Planning Checklist',
  slug: 'demo-day-video-checklist', intent: 'informational', funnelStage: 'top',
});
const refined = { ...original, primaryKeyword: 'demo day video checklist', title: 'Demo Day Video Checklist: Plan, Record and Rehearse' };
const other = { ...original, articleId: 'vc-c2-002', primaryKeyword: 'founder video preparation', title: 'Founder Video Preparation', slug: 'founder-video-preparation' };
const fingerprint = candidateFingerprints(refined).candidate;
const at = '2026-09-05T18:00:00.000Z';

function fixture() {
  let state = markCandidateScanned(createPersistentWorkerState(), refined, 'assisted-failure', at);
  state = reserveCandidate(state, refined, 'assisted-failure', 'manual_pilot', at);
  state = markCandidateFailure(state, refined, 'assisted-failure', 'assisted_pilot_failed', true, at);
  state.queuedCandidates = [original, other];
  state.runs['assisted-failure'] = { schemaVersion: 1, runId: 'assisted-failure', mode: 'manual_pilot', startedAt: at, selectedCandidateFingerprints: [fingerprint], status: 'failed' };
  state.failures.push({ runId: 'assisted-failure', code: 'candidate_failed', attempt: 1, observedAt: at, detail: 'Retained failure.' });
  return { state, backlog: [original, other], candidate: refined, runId: 'automated-attempt-2' };
}

describe('local artifact-only pilot preflight', () => {
  it('requires an explicit execution flag and a fresh bounded run-id argument', () => {
    expect(parseLocalPilotArguments(['--run-id', 'automated-attempt-2', '--execute'])).toEqual({ runId: 'automated-attempt-2' });
    for (const args of [[], ['--run-id', 'attempt'], ['--execute'], ['--run-id', '../escape', '--execute'], ['--run-id', 'attempt', '--execute', '--reset'], ['--run-id', 'attempt', '--execute', '--candidate-id', 'new']]) {
      expect(() => parseLocalPilotArguments(args)).toThrow();
    }
  });
  it('reconciles only the same-id unattempted row and preserves the prior attempt and all history', () => {
    const input = fixture();
    const before = structuredClone(input);
    const result = reconcileLocalPilotCandidate(input);
    expect(result.candidate).toEqual(refined);
    expect(result.backlog).toEqual([refined, other]);
    expect(result.state.queuedCandidates).toEqual([refined, other]);
    expect(result.state.decisions).toEqual(before.state.decisions);
    expect(result.state.runs).toEqual(before.state.runs);
    expect(result.state.failures).toEqual(before.state.failures);
    expect(result.state.candidateFingerprints).toEqual(before.state.candidateFingerprints);
    expect(result.state.dedupeHashes).toEqual(before.state.dedupeHashes);
    expect(result.state.manualPilot).toBeNull();
    expect(result.nextAttempt).toBe(2);
    expect(input).toEqual(before);
    const reserved = reserveCandidate(result.state, refined, input.runId, 'manual_pilot', at);
    expect(reserved.decisions[fingerprint].attempts).toBe(2);
  });

  it('accepts an already-reconciled queue without consuming another attempt', () => {
    const input = fixture();
    input.state.queuedCandidates[0] = refined;
    const result = reconcileLocalPilotCandidate(input);
    expect(result.state.decisions[fingerprint].attempts).toBe(1);
    expect(result.state.queuedCandidates).toEqual([refined, other]);
  });

  it.each(['new-candidate-id', 'changed-identity', 'missing-decision', 'terminal', 'exhausted', 'pilot-reserved', 'prior-run', 'attempted-original', 'duplicate-row', 'content-already-prepared'] as const)('fails closed on %s without resetting state', (problem) => {
    const input = fixture();
    if (problem === 'new-candidate-id') input.candidate = { ...refined, articleId: 'vc-c2-999' };
    if (problem === 'changed-identity') input.candidate = { ...refined, title: 'New unreviewed title' };
    if (problem === 'missing-decision') delete input.state.decisions[fingerprint];
    if (problem === 'terminal') input.state.decisions[fingerprint].status = 'terminal';
    if (problem === 'exhausted') input.state.decisions[fingerprint].attempts = 3;
    if (problem === 'pilot-reserved') input.state = reserveManualPilot(input.state, 'other-run', at);
    if (problem === 'prior-run') input.runId = 'assisted-failure';
    if (problem === 'attempted-original') input.state = reserveCandidate(input.state, original, 'old-attempt', 'manual_pilot', at);
    if (problem === 'duplicate-row') input.state.queuedCandidates.push({ ...other, articleId: refined.articleId });
    if (problem === 'content-already-prepared') input.state.contentHashes[fingerprint] = 'a'.repeat(64);
    const before = structuredClone(input);
    expect(() => reconcileLocalPilotCandidate(input)).toThrow();
    expect(input).toEqual(before);
  });
});

describe('unmodified production model transport auditing', () => {
  it('durably records exact credential-free wire input before dispatch, even when the provider fails', async () => {
    const records: unknown[] = [];
    const payload = { model: 'fixture-model', store: false, input: [{ role: 'user', content: [{ type: 'input_text', text: JSON.stringify({ sourceFacts: [{ id: 's1', facts: [{ id: 'f1', text: 'Original support.' }] }] }) }] }], text: { format: { name: 'article_draft' } } };
    const request = { method: 'POST' as const, url: 'https://api.openai.com/v1/responses', headers: { Authorization: 'Bearer never-record-this' }, signal: new AbortController().signal, body: JSON.stringify(payload) };
    let dispatched = false;
    const transport = createModelAuditTransport(async (received) => {
      expect(records).toHaveLength(1);
      expect(received).toBe(request);
      dispatched = true;
      throw new Error('offline provider failure');
    }, async () => {}, async (record) => { records.push(record); });
    await expect(transport(request)).rejects.toThrow('offline provider failure');
    expect(dispatched).toBe(true);
    expect(records).toEqual([expect.objectContaining({ call: 1, phase: 'article_draft', requestBody: request.body })]);
    expect(JSON.stringify(records)).not.toContain('never-record-this');
  });

  it('refuses dispatch when the pre-request audit cannot be retained', async () => {
    let dispatched = false;
    const transport = createModelAuditTransport(async () => { dispatched = true; return { status: 200, headers: {}, body: {} }; }, async () => {}, async () => { throw new Error('audit unavailable'); });
    await expect(transport({ method: 'POST', url: 'https://api.openai.com/v1/responses', headers: {}, signal: new AbortController().signal, body: JSON.stringify({ text: { format: { name: 'article_draft' } } }) })).rejects.toThrow('audit unavailable');
    expect(dispatched).toBe(false);
  });

  it('retains the full response while forwarding the exact original request and response', async () => {
    const request = { method: 'POST' as const, url: 'https://api.openai.com/v1/responses', headers: { Authorization: 'fixture' }, signal: new AbortController().signal, body: JSON.stringify({ text: { format: { name: 'article_draft' } }, max_output_tokens: 24000 }) };
    const response = { status: 200, headers: {}, body: { status: 'completed', output: [{ content: [{ type: 'output_text', text: 'complete raw model output' }] }], usage: { output_tokens: 50 } } };
    const records: unknown[] = [];
    const transport = createModelAuditTransport(async (received) => { expect(received).toBe(request); return response; }, async (record) => { records.push(record); });
    expect(await transport(request)).toBe(response);
    expect(records).toEqual([{ call: 1, phase: 'article_draft', httpStatus: 200, response: response.body }]);
  });

  it('does not retain raw answers from non-model provider responses', async () => {
    const records: unknown[] = [];
    const response = { status: 200, headers: {}, body: { answer: 'provider answer, not source evidence' } };
    const transport = createModelAuditTransport(async () => response, async (record) => { records.push(record); });
    await transport({ method: 'GET', url: 'https://api.apify.com/v2/datasets/example/items', headers: {}, signal: new AbortController().signal });
    expect(records).toEqual([]);
  });
});

describe('fresh local pilot inventory', () => {
  const sha = 'a'.repeat(40);
  const repo = 'repos/INFR-Organisation/videoclaw-lander';
  function inventoryFixture(problem?: string) {
    const requests: string[] = [];
    const input = { head: problem === 'stale-checkout' ? 'b'.repeat(40) : sha, branch: 'seo/founder-video-blog-launch', clean: problem !== 'dirty-checkout', localArticles: [], candidate: refined };
    const get = async (path: string) => {
      requests.push(path);
      if (path.startsWith(`${repo}/git/ref/heads/`)) return { object: { sha } };
      if (path.endsWith('/pulls/55')) return { state: 'open', merged: false };
      if (path.includes('/git/trees/')) return { truncated: problem === 'truncated-tree', tree: [] };
      if (path.includes('/pulls?')) return [{ number: 12, html_url: 'https://github.com/INFR-Organisation/videoclaw-lander/pull/12', body: '', head: { ref: 'editor/review' } }];
      if (path.includes('/pulls/12/files')) return problem === 'duplicate-pr' ? [{ filename: 'content/articles/demo-day-video-checklist.md', status: 'added', sha }] : [];
      if (path.includes('/git/blobs/')) return { encoding: 'base64', content: Buffer.from(`---\nid: vc-c2-001\nslug: demo-day-video-checklist\ntitle: Demo Day Video Checklist\nprimaryKeyword: demo day video checklist\n---\n`).toString('base64') };
      if (path === `${repo}/git/matching-refs/heads/`) return [{ ref: problem === 'reserved-branch' ? 'refs/heads/autoblog/2026-09-05-demo-day-video-checklist' : 'refs/heads/main' }];
      if (path.includes('VideoClaw-ICP/git/matching-refs/')) return problem === 'remote-state' ? [{ ref: 'refs/heads/autoblogger-state' }] : [];
      throw new Error(`Unexpected inventory path: ${path}`);
    };
    return { input, get, requests };
  }

  it('reads the immutable target tree, all PR files and branch/state reservations before allowing work', async () => {
    const f = inventoryFixture();
    const snapshot = await inspectLocalPilotInventory(f.input, f.get);
    expect(snapshot.baseSha).toBe(sha);
    expect(snapshot.branchRefs).toEqual(['main']);
    expect(f.requests).toContain(`${repo}/git/trees/${sha}?recursive=1`);
    expect(f.requests).toContain(`${repo}/pulls/12/files?per_page=100`);
    expect(f.requests).toContain('repos/frenzy2004/VideoClaw-ICP/git/matching-refs/heads/autoblogger-state');
  });

  it.each(['stale-checkout', 'dirty-checkout', 'truncated-tree', 'duplicate-pr', 'reserved-branch', 'remote-state'])('blocks %s without any fallback inventory', async (problem) => {
    const f = inventoryFixture(problem);
    await expect(inspectLocalPilotInventory(f.input, f.get)).rejects.toThrow();
  });
});
