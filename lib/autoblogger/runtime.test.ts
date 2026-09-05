import { mkdir, mkdtemp, readFile, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CandidateSchema, EvidenceBundleSchema, KeywordMetricsSchema, candidateFingerprints } from './domain';
import { writeAutobloggerArtifacts, buildDraftingContextFromResearch, loadBacklogCandidates } from './runtime';
import type { ResearchResult, ShallowResearchResult } from './research';

describe('runtime context and artifacts', () => {
  it('loads the incremental matrix backlog without enforcing an exact library gate', async () => {
    const candidates = await loadBacklogCandidates(process.cwd());
    expect(candidates.length).toBeGreaterThanOrEqual(250);
    expect(new Set(candidates.map(({ articleId }) => articleId)).size).toBe(candidates.length);
  });

  it('builds exact transient source facts only from checked SERP observations', () => {
    const candidate = CandidateSchema.parse({
      schemaVersion: 1, articleId: 'vc-c2-901', campaignId: 'accelerator-demo-day-founder', icp: 'demo day founder',
      primaryKeyword: 'founder video proof workflow', secondaryKeywords: [], title: 'Founder Video Proof Workflow',
      slug: 'founder-video-proof-workflow', intent: 'informational', funnelStage: 'middle',
    });
    const shallow: ShallowResearchResult = {
      candidate,
      suggestions: ['founder video proof workflow guide'],
      organicResults: [
        { url: 'https://primary.example/guide', title: 'Primary founder guide', snippet: 'A founder workflow should connect the customer problem to visible product proof.', resultType: 'article' },
        { url: 'https://secondary.example/checklist', title: 'Independent checklist', snippet: 'A final playback check catches avoidable presentation failures.', resultType: 'article' },
      ],
      peopleAlsoAsk: ['What is founder video proof?', 'How do founders show video proof?', 'Why does founder video proof matter?'],
      relatedQueries: [],
      provenance: {
        discovery: { actorId: 'autocomplete', runId: 'run-a', datasetId: 'data-a', observedAt: '2026-09-05T00:00:00.000Z' },
        serp: { actorId: 'serp', runId: 'run-s', datasetId: 'data-s', observedAt: '2026-09-05T00:01:00.000Z' },
      },
    };
    const evidence = EvidenceBundleSchema.parse({
      schemaVersion: 1,
      candidateFingerprint: candidateFingerprints(candidate).candidate,
      suggestions: shallow.suggestions,
      serp: { organicResultCount: 2, peopleAlsoAsk: shallow.peopleAlsoAsk },
      sources: [
        { url: shallow.organicResults[0].url, authoritative: true },
        { url: shallow.organicResults[1].url, authoritative: false },
      ],
      faqQuestions: shallow.peopleAlsoAsk,
    });
    const result: ResearchResult = { candidate, evidence, provenance: shallow.provenance };
    const metrics = KeywordMetricsSchema.parse({ schemaVersion: 1, provider: 'pending', observedAt: null, volume: null, difficulty: null, cpc: null, intent: 'informational' });

    const context = buildDraftingContextFromResearch({ result, shallow, metrics, generatedAt: '2026-09-05T00:02:00.000Z' });
    expect(context.sourceFacts).toHaveLength(2);
    expect(context.sourceFacts[0]).toMatchObject({
      url: 'https://primary.example/guide',
      facts: [
        { text: 'Primary founder guide' },
        { text: 'A founder workflow should connect the customer problem to visible product proof.' },
      ],
    });
    expect(context.checkedSources.every(({ reachable, status }) => reachable && status === 200)).toBe(true);
    expect(context.provenance).toEqual({ apifyRunId: 'run-s', apifyDatasetId: 'data-s', query: candidate.primaryKeyword, locale: 'en-US', capturedAt: '2026-09-05' });
  });

  it('bounds SERP-derived source facts before they enter the model context', () => {
    const candidate = CandidateSchema.parse({
      schemaVersion: 1, articleId: 'vc-c2-902', campaignId: 'accelerator-demo-day-founder', icp: 'demo day founder',
      primaryKeyword: 'bounded founder video workflow', secondaryKeywords: [], title: 'Bounded Founder Video Workflow',
      slug: 'bounded-founder-video-workflow', intent: 'informational', funnelStage: 'middle',
    });
    const shallow: ShallowResearchResult = {
      candidate,
      suggestions: ['bounded founder video workflow guide'],
      organicResults: [
        { url: 'https://primary.example/bounded', title: 'Primary source', snippet: 'x'.repeat(20_000), resultType: 'article' },
        { url: 'https://secondary.example/bounded', title: 'Secondary source', snippet: 'Short checked fact.', resultType: 'article' },
      ],
      peopleAlsoAsk: ['What is bounded founder video?', 'How is bounded founder video planned?', 'Why is bounded founder video useful?'],
      relatedQueries: [],
      provenance: {
        discovery: { actorId: 'autocomplete', runId: 'run-a', datasetId: 'data-a', observedAt: '2026-09-05T00:00:00.000Z' },
        serp: { actorId: 'serp', runId: 'run-s', datasetId: 'data-s', observedAt: '2026-09-05T00:01:00.000Z' },
      },
    };
    const evidence = EvidenceBundleSchema.parse({
      schemaVersion: 1,
      candidateFingerprint: candidateFingerprints(candidate).candidate,
      suggestions: shallow.suggestions,
      serp: { organicResultCount: 2, peopleAlsoAsk: shallow.peopleAlsoAsk },
      sources: [
        { url: shallow.organicResults[0].url, authoritative: true },
        { url: shallow.organicResults[1].url, authoritative: false },
      ],
      faqQuestions: shallow.peopleAlsoAsk,
    });
    const metrics = KeywordMetricsSchema.parse({ schemaVersion: 1, provider: 'pending', observedAt: null, volume: null, difficulty: null, cpc: null, intent: 'informational' });
    const context = buildDraftingContextFromResearch({
      result: { candidate, evidence, provenance: shallow.provenance },
      shallow,
      metrics,
      generatedAt: '2026-09-05T00:02:00.000Z',
    });

    expect(context.sourceFacts[0].facts[1].text.length).toBeLessThanOrEqual(600);
  });

  it('writes Markdown, SVG, and a compact report without overwriting outside the artifact directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoblogger-artifacts-'));
    const report = {
      schemaVersion: 1,
      command: 'pilot',
      runId: 'pilot-artifact',
      mode: 'manual_pilot',
      status: 'validated',
      startedAt: '2026-09-05T00:00:00.000Z',
      completedAt: '2026-09-05T00:01:00.000Z',
      limits: { maxCandidatesScanned: 50, maxDeepInspections: 10, maxDrafts: 3, maxDraftsPerIcp: 2, manualPilotDrafts: 1 },
      counts: { queued: 50, scanned: 50, shallowValidated: 50, metricsEnriched: 50, deepInspected: 10, eligible: 1, drafted: 1, validated: 1, pullRequestsOpened: 0 },
      failures: [],
      artifacts: [{
        candidateFingerprint: 'candidate:x', articleId: 'vc-c1-101', slug: 'fixture-article', icp: 'founder', publication: 'artifact_only',
        bundle: { schemaVersion: 1, candidateFingerprint: 'candidate:x', article: { slug: 'fixture-article' }, markdown: '---\nstatus: review\n---\nArticle', svg: '<svg xmlns="http://www.w3.org/2000/svg"/>' },
        validation: { status: 'passed', cleanup: 'completed', bundleHash: 'a'.repeat(64), landerRef: 'feature', commands: [] },
      }],
    };
    await writeAutobloggerArtifacts(report, root, root);
    await expect(readFile(join(root, 'fixture-article.md'), 'utf8')).resolves.toContain('status: review');
    await expect(readFile(join(root, 'fixture-article.svg'), 'utf8')).resolves.toContain('<svg');
    const compact = await readFile(join(root, 'run-report.json'), 'utf8');
    expect(compact).not.toContain('Article');
    expect(compact).not.toContain('<svg');
    await expect(stat(join(root, 'fixture-article.bundle.json'))).resolves.toBeTruthy();
    await expect(writeAutobloggerArtifacts(report, '../escape', root)).rejects.toThrow(/artifact directory/i);
  });

  it('rejects a symlinked artifact directory before writing outside the configured root', async () => {
    const fixture = await mkdtemp(join(tmpdir(), 'autoblogger-artifact-symlink-'));
    const root = join(fixture, 'root');
    const outside = join(fixture, 'outside');
    await mkdir(root);
    await mkdir(outside);
    await symlink(outside, join(root, 'escape'), 'dir');

    await expect(writeAutobloggerArtifacts({ status: 'safe' }, 'escape', root)).rejects.toThrow(/symlink|artifact directory/i);
    await expect(stat(join(outside, 'validation-report.json'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
