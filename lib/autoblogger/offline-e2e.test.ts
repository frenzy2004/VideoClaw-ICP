// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import type { DraftingContext, GeneratedDraftV2 } from './content-bundle';
import { CandidateSchema, candidateFingerprints, type Candidate } from './domain';
import { createStructuredDrafter } from './drafting';
import { createApifyClient } from './apify-client';
import { createFileStateStore } from './local-state';
import { createPendingKeywordProvider, createSemrushKeywordProvider } from './keyword-providers';
import type { StructuredOutputClient, StructuredOutputRequest } from './openai-responses';
import { createResearcher } from './research';
import { createSafeSourceChecker } from './sources';
import { buildDraftingContextFromResearch, writeAutobloggerArtifacts } from './runtime';
import { consumePreparedManualPilot } from './recovery';
import { createAutobloggerWorker, type AutobloggerRunReport } from './worker';
import { createOfflineNetwork } from './fixtures/offline-network';
import { createOfflineLander, findNativeLanderPath, LANDER_REF, PRODUCT_MEDIA } from './fixtures/offline-lander';

const directAnswer = 'Choose one audience, define one next step, record short founder-led takes, and show one current product action with evidence the viewer can verify. Review every factual statement against its cited source, add accurate captions, check pacing and sound, then test the complete playback path before sharing the final video.';

function candidates(): Candidate[] {
  return Array.from({ length: 50 }, (_unused, index) => {
    // The top three share an ICP: selecting the third must skip rank 3 for rank 4.
    const campaignNumber = index >= 47 ? 1 : 2;
    const campaignId = campaignNumber === 1 ? 'newly-funded-founder' : 'accelerator-demo-day-founder';
    return CandidateSchema.parse({
      schemaVersion: 1,
      articleId: `vc-c${campaignNumber}-${index + 100}`,
      campaignId,
      icp: campaignId,
      primaryKeyword: `founder video product demo workflow ${index}`,
      secondaryKeywords: [`founder video workflow ${index} checklist`],
      title: `Founder Video Workflow ${index}`,
      slug: `founder-video-workflow-${index}`,
      intent: 'informational',
      funnelStage: 'middle',
    });
  });
}

const visibleSpans = {
  initialDescription: 'This checked founder video workflow connects audience, evidence, recording, review, and playback.',
  repairedDescription: 'This source-backed founder video workflow connects audience, evidence, recording, review, and playback.',
  customerTrigger: 'Use this workflow when a founder video needs checked evidence.',
  competitorGap: 'Address the gap between recording advice and evidence review.',
  answerOne: 'Choose one audience, define one next step, record short founder-led takes, and show one current product action with evidence the viewer can verify.',
  answerTwo: 'Review every factual statement against its cited source, add accurate captions, check pacing and sound, then test the complete playback path before sharing the final video.',
  headingOne: 'Plan the evidence',
  sectionOne: 'Use the first checked source before recording.',
  headingTwo: 'Test the playback path',
  sectionTwo: 'Use the second checked source before sharing.',
  faq: 'Use the checked sources and test the final playback path.',
  graphicTitle: 'Founder video evidence map',
  graphicAlt: 'Three-step founder video evidence map',
  labelOne: 'Audience', detailOne: 'Choose one viewer and one next step.',
  labelTwo: 'Evidence', detailTwo: 'Bind every factual statement to a source.',
  labelThree: 'Playback', detailThree: 'Test the complete final video.',
};

// Independently worded observed titles/snippets, never the generated article text.
// Order is the raw SERP fixture's title/description order, two facts per source.
const observedFacts: Record<string, string> = {
  description: 'Founder recording guidance covers viewers, substantiation, capture, quality review and watching the result.',
  'description-repaired': 'Source-led planning links the intended viewer to evidence collection, recording and final playback checks.',
  trigger: 'Before producing founder footage, decide which assertions require substantiation.',
  gap: 'Typical recording tips can omit the separate task of reviewing their supporting evidence.',
  'answer-1': 'Select a specific viewer and call to action; capture brief founder segments and a present-day product interaction with verifiable support.',
  'answer-2': 'Check factual assertions against citations, subtitle accuracy, timing and audio quality; watch the whole deliverable prior to distribution.',
  'heading-1': 'Prepare supporting material before a shoot',
  'section-1': 'Consult an initial supporting reference in advance of filming.',
  'heading-2': 'Review the viewing experience',
  'section-2': 'Consult another independent reference before distributing the recording.',
  faq: 'Consult verified references and watch the completed recording from start to finish.',
  'graphic-title': 'Map the relationship between a founder recording and its supporting material',
  'graphic-alt': 'A diagram groups audience choice, substantiation and final viewing into three stages.',
  'label-1': 'Intended viewer',
  'detail-1': 'Select a single target viewer and intended subsequent action.',
  'label-2': 'Substantiation',
  'detail-2': 'Associate each factual assertion with an identifiable reference.',
  'label-3': 'Final viewing',
  'detail-3': 'Watch the finished recording in its entirety.',
};

function generated(context: Pick<DraftingContext, 'sourceFacts' | 'evidence'>, repaired: boolean): GeneratedDraftV2 {
  const firstUrl = context.sourceFacts[0].url;
  const secondUrl = context.sourceFacts[1].url;
  const bindings = [
    [repaired ? 'description-repaired' : 'description', '/description', repaired ? visibleSpans.repairedDescription : visibleSpans.initialDescription],
    ['trigger', '/customerTrigger', visibleSpans.customerTrigger],
    ['gap', '/competitorGap', visibleSpans.competitorGap],
    ['answer-1', '/directAnswer', visibleSpans.answerOne],
    ['answer-2', '/directAnswer', visibleSpans.answerTwo],
    ['heading-1', '/sections/0/heading', visibleSpans.headingOne],
    ['section-1', '/sections/0/markdown', visibleSpans.sectionOne],
    ['heading-2', '/sections/1/heading', visibleSpans.headingTwo],
    ['section-2', '/sections/1/markdown', visibleSpans.sectionTwo],
    ['faq', '/faqAnswers/0/answer', visibleSpans.faq],
    ['faq', '/faqAnswers/1/answer', visibleSpans.faq],
    ['faq', '/faqAnswers/2/answer', visibleSpans.faq],
    ['graphic-title', '/editorialGraphic/title', visibleSpans.graphicTitle],
    ['graphic-alt', '/editorialGraphic/alt', visibleSpans.graphicAlt],
    ['label-1', '/editorialGraphic/steps/0/label', visibleSpans.labelOne],
    ['detail-1', '/editorialGraphic/steps/0/detail', visibleSpans.detailOne],
    ['label-2', '/editorialGraphic/steps/1/label', visibleSpans.labelTwo],
    ['detail-2', '/editorialGraphic/steps/1/detail', visibleSpans.detailTwo],
    ['label-3', '/editorialGraphic/steps/2/label', visibleSpans.labelThree],
    ['detail-3', '/editorialGraphic/steps/2/detail', visibleSpans.detailThree],
  ] as const;
  return {
    schemaVersion: 2,
    description: repaired ? visibleSpans.repairedDescription : visibleSpans.initialDescription,
    customerTrigger: visibleSpans.customerTrigger,
    competitorGap: visibleSpans.competitorGap,
    directAnswer,
    sections: [
      { heading: visibleSpans.headingOne, markdown: `Use the [first checked source](${firstUrl}) before recording.` },
      { heading: visibleSpans.headingTwo, markdown: `Use the [second checked source](${secondUrl}) before sharing.` },
    ],
    faqAnswers: context.evidence.faqQuestions.map((question) => ({ question, answer: visibleSpans.faq })),
    sourceReferences: context.sourceFacts.map(({ id }) => ({ sourceId: id })),
    claimBindings: bindings.map(([id, location, span]) => {
      const fact = context.sourceFacts.flatMap(({ facts }) => facts)[Object.keys(observedFacts).indexOf(id)];
      if (!fact) throw new Error(`Missing observed source fact for ${location}`);
      return { location, span, sourceFactIds: [fact.id], productClaimId: null };
    }),
    editorialGraphic: {
      title: visibleSpans.graphicTitle,
      alt: visibleSpans.graphicAlt,
      steps: [
        { label: visibleSpans.labelOne, detail: visibleSpans.detailOne },
        { label: visibleSpans.labelTwo, detail: visibleSpans.detailTwo },
        { label: visibleSpans.labelThree, detail: visibleSpans.detailThree },
      ],
    },
  };
}

class RepairingFixtureClient implements StructuredOutputClient {
  requests: StructuredOutputRequest[] = [];
  rejectVerification = false;
  omitSupportEvaluation = false;

  async generate(request: StructuredOutputRequest): Promise<unknown> {
    this.requests.push(request);
    const input = request.input as DraftingContext & {
      draft?: GeneratedDraftV2; repairedDraft?: GeneratedDraftV2; originalIssues?: Array<{ id: string }>;
      bindingManifest?: Array<GeneratedDraftV2['claimBindings'][number] & { bindingIndex: number; bindingHash: string }>;
    };
    const context = input;
    if (request.name === 'videoclaw_article_draft_v2') return generated(context, false);
    const supportEvaluations = () => {
      expect(input.bindingManifest).toHaveLength(20);
      const evaluations = input.bindingManifest!.map(({ bindingIndex, bindingHash, sourceFactIds, span }) => {
        const facts = input.sourceFacts.flatMap(({ facts }) => facts).filter(({ id }) => sourceFactIds.includes(id));
        expect(facts).toHaveLength(1);
        expect(facts[0].text).not.toBe(span);
        return {
          bindingIndex, bindingHash, supported: true, kind: 'source_claim',
          rationale: `The supplied search title/snippet ${sourceFactIds[0]} supports this paraphrased guidance; it adds no numbers, product capability or claim about unseen page content.`,
        };
      });
      return this.omitSupportEvaluation ? evaluations.slice(1) : evaluations;
    };
    if (request.name === 'videoclaw_article_critique_v1') {
      return { schemaVersion: 1, approved: false, supportEvaluations: supportEvaluations(), issues: [{ id: 'editorial-1', code: 'editorial.specificity', message: 'Clarify the role of sources in the description.', repairInstruction: 'Paraphrase the source-led planning guidance in the description.' }] };
    }
    if (request.name === 'videoclaw_article_repair_v2') return generated(context, true);
    if (request.name === 'videoclaw_article_repair_verification_v1') {
      expect(input.originalIssues?.map(({ id }) => id)).toEqual(['editorial-1']);
      expect(input.repairedDraft?.description).toBe(visibleSpans.repairedDescription);
      return { schemaVersion: 1, approved: !this.rejectVerification, supportEvaluations: supportEvaluations(), evaluations: [{ issueId: 'editorial-1', resolved: !this.rejectVerification, message: 'Deterministic independent verification result.' }], newIssues: [] };
    }
    throw new Error(`Unexpected fixture request ${request.name}`);
  }

}

const temporaryRoots: string[] = [];
afterEach(async () => {
  for (const root of temporaryRoots.splice(0)) await rm(root, { recursive: true, force: true });
});

const nativeLanderPath = findNativeLanderPath();

async function setup(backlog = candidates(), pending = false, native = true) {
  const root = await mkdtemp(join(tmpdir(), 'videoclaw-offline-e2e-'));
  temporaryRoots.push(root);
  const lander = await createOfflineLander(root, native ? nativeLanderPath : undefined);
  const network = createOfflineNetwork(backlog, Object.values(observedFacts));
  const client = new RepairingFixtureClient();
  const statePath = join(root, 'worker-state.json');
  const researcher = createResearcher({
    apify: createApifyClient({ token: 'offline-apify', transport: network.json }),
    sourceChecker: createSafeSourceChecker({
      transport: network.source,
      resolveHostname: network.resolveHostname,
      authorityPolicies: [{ hostname: 'primary.example', pathPrefix: '/guides/' }],
    }),
    execution: { pollIntervalMs: 0 },
  });
  const keywordProvider = pending
    ? createPendingKeywordProvider()
    : createSemrushKeywordProvider({
      apiKey: 'offline-semrush',
      transport: network.json,
      now: () => '2026-09-05T00:01:00.000Z',
    });
  const contexts: DraftingContext[] = [];
  const restart = () => createAutobloggerWorker({
    backlog,
    stateStore: createFileStateStore(statePath),
    researcher,
    keywordProvider,
    drafter: createStructuredDrafter({
      client,
      mediaAllowlist: [{
        id: 'offline-product',
        campaignIds: ['newly-funded-founder', 'accelerator-demo-day-founder'],
        ...PRODUCT_MEDIA,
        alt: 'A founder-led product demonstration',
        caption: 'An existing product demonstration.',
        width: 1280,
        height: 720,
      }],
    }),
    buildDraftContext: (input) => {
      const context = buildDraftingContextFromResearch({ ...input, generatedAt: '2026-09-05T00:02:00.000Z' });
      contexts.push(context);
      return context;
    },
    publisher: lander.publisher,
    persistArtifact: (artifact, report) => writeAutobloggerArtifacts({ ...report, artifacts: [artifact] }, report.runId, root),
    landerRef: LANDER_REF,
    approvedMedia: { product: [PRODUCT_MEDIA], editorialGraphics: [] },
    now: () => new Date('2026-09-05T00:03:00.000Z'),
  });
  return { root, lander, network, client, contexts, statePath, restart, worker: restart() };
}

async function assertArtifactsOnDisk(fixture: Awaited<ReturnType<typeof setup>>, report: AutobloggerRunReport) {
  await writeAutobloggerArtifacts(report, report.runId, fixture.root);
  const directory = join(fixture.root, report.runId);
  for (const artifact of report.artifacts) {
    const markdown = await readFile(join(directory, artifact.slug + '.md'), 'utf8');
    const svg = await readFile(join(directory, artifact.slug + '.svg'), 'utf8');
    expect(markdown).toBe(artifact.bundle.markdown);
    expect(markdown).toContain(visibleSpans.repairedDescription);
    expect(markdown).not.toContain(visibleSpans.initialDescription);
    expect(markdown).toContain(directAnswer);
    expect(markdown).toContain('https://primary.example/guides/');
    expect(svg).toBe(artifact.bundle.svg);
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="675"');
    expect(svg).toContain(visibleSpans.graphicTitle);
    expect(svg).toContain(visibleSpans.detailThree);
    expect(JSON.parse(await readFile(join(directory, artifact.slug + '.bundle.json'), 'utf8'))).toEqual(artifact.bundle);
    expect(JSON.parse(await readFile(join(directory, artifact.slug + '.publication.json'), 'utf8')).origin).toEqual(artifact.publicationOrigin);
    expect((await stat(join(directory, artifact.slug + '.md'))).mode & 0o777).toBe(0o600);
    expect(artifact.bundle.article).toMatchObject({
      status: 'review', approvals: { copy: false, factual: false, legal: false, visual: false },
      cta: { href: '/download' }, description: visibleSpans.repairedDescription,
    });
    expect(artifact.bundle.article).not.toHaveProperty('publishedAt');
    expect(artifact.publication).toBe('artifact_only');
    expect(artifact.pullRequest).toBeUndefined();
    const validation = artifact.validation;
    expect(validation).toMatchObject({
      status: 'passed', cleanup: 'completed', packageManager: 'npm', landerRef: LANDER_REF,
      checkedOutHeadSha: fixture.lander.head,
      articlePath: 'content/articles/' + artifact.slug + '.md',
      svgPath: 'public/media/blog/' + artifact.slug + '.svg',
    });
    expect(validation.bundleHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(validation.commands.map(({ label }) => label)).toEqual([
      'clone', 'checkout', 'resolve-head', 'isolate-checkout', 'install',
      'check:blog', 'lint', 'build', 'workspace-integrity',
    ]);
    expect(validation.commands.every(({ exitCode, timedOut }) => exitCode === 0 && !timedOut)).toBe(true);
    expect(validation.commands.find(({ label }) => label === 'check:blog')?.stdout).toContain('Native lander contract accepted 1 review article');
    expect(validation.commands.find(({ label }) => label === 'build')?.stdout).toContain('Built 1 preview page; 0 public article routes');
    const rendered = fixture.lander.rendered.find(({ slug }) => slug === artifact.slug);
    expect(rendered?.markdown).toBe(markdown);
    expect(rendered?.svg).toBe(svg);
    expect(rendered?.html).toContain('<h2>Plan the evidence</h2>');
    expect(rendered?.html).toContain('<a href="https://primary.example/guides/');
    expect(rendered?.publicRoutes).toEqual([]);
  }
  expect(await readdir(fixture.lander.validationRoot)).toEqual([]);
  expect(fixture.lander.githubCalls).toEqual([]);
  const persistedReport = JSON.parse(await readFile(join(directory, 'run-report.json'), 'utf8'));
  expect(persistedReport.counts).toEqual(report.counts);
}

describe.skipIf(nativeLanderPath === undefined)('native lander offline integration (requires AUTOBLOG_NATIVE_LANDER_PATH or local sibling checkout)', () => {
  it('researches all 50, deeply checks the best 10, validates 3 repaired artifacts with a 2-per-ICP cap, and survives restart', async () => {
    const fixture = await setup();
    const first = await fixture.worker.execute({ command: 'run', runId: 'offline-e2e-1' });
    expect(first.failures, fixture.lander.commandFailures.join('\n')).toEqual([]);
    expect(first.status).toBe('validated');
    expect(first.counts).toEqual({
      queued: 50, scanned: 50, shallowValidated: 50, metricsEnriched: 50,
      deepInspected: 10, eligible: 10, drafted: 3, validated: 3, pullRequestsOpened: 0,
    });
    expect(fixture.network.autocompleteKeywords).toEqual(candidates().map(({ primaryKeyword }) => primaryKeyword));
    expect(fixture.network.serpKeywords).toEqual(fixture.network.autocompleteKeywords);
    expect(fixture.network.metricKeywords).toEqual(fixture.network.autocompleteKeywords);
    // Increasing volume with otherwise equal signals makes this ranking independent of worker helpers.
    expect([...new Set(fixture.network.sourceRequests.map(({ url }) => new URL(url).pathname.split('/')[2]))]).toEqual(
      [49, 48, 47, 46, 45, 44, 43, 42, 41, 40].map((index) => 'founder-video-workflow-' + index),
    );
    expect(fixture.network.sourceRequests).toHaveLength(110); // Ten sources + one manual redirect per candidate.
    expect(first.artifacts.map(({ slug }) => slug)).toEqual([
      'founder-video-workflow-49', 'founder-video-workflow-48', 'founder-video-workflow-46',
    ]);
    expect(first.artifacts.filter(({ icp }) => icp === 'newly-funded-founder')).toHaveLength(2);
    expect(first.artifacts.filter(({ icp }) => icp === 'accelerator-demo-day-founder')).toHaveLength(1);
    for (const [index, artifact] of first.artifacts.entries()) {
      expect(artifact.metrics).toMatchObject({
        provider: 'semrush', volume: [5_000, 4_900, 4_700][index], difficulty: 20, cpc: 1.25,
        observedAt: '2026-09-05T00:01:00.000Z',
      });
      expect(artifact.keywordProvenance).toMatchObject({
        provider: 'semrush', endpoint: 'https://api.semrush.com/apis/v4/keywords/v1/metrics',
        sourceObservedAt: '2026-09',
      });
      expect(artifact.publicationOrigin.evidence).toMatchObject({
        schemaVersion: 2, candidateFingerprint: artifact.candidateFingerprint,
        serp: { organicResultCount: 10 },
      });
      expect(artifact.publicationOrigin.evidence.sources[0]).toEqual({
        originalUrl: 'https://primary.example/guides/' + artifact.slug + '/redirect',
        finalUrl: 'https://primary.example/guides/' + artifact.slug + '/0',
        authoritative: true,
      });
      expect(artifact.publicationOrigin.evidence.sources[1].authoritative).toBe(false);
      // The real publisher independently enforces premerge artifact-only authorization.
      expect(await fixture.lander.publisher.openDraftPullRequest({
        bundle: artifact.bundle, validation: artifact.validation, mode: 'scheduled',
        keywordMetrics: artifact.metrics, origin: artifact.publicationOrigin,
      })).toEqual({ status: 'artifact_only', reason: 'lander_base_not_ready' });
    }
    expect(fixture.client.requests.map(({ name }) => name)).toEqual(Array.from({ length: 3 }, () => [
      'videoclaw_article_draft_v2', 'videoclaw_article_critique_v1',
      'videoclaw_article_repair_v2', 'videoclaw_article_repair_verification_v1',
    ]).flat());
    await assertArtifactsOnDisk(fixture, first);
    const saved = await createFileStateStore(fixture.statePath).load();
    expect(saved.state.runs['offline-e2e-1'].status).toBe('validated');
    expect(Object.keys(saved.state.contentHashes)).toHaveLength(3);
    expect(saved.state.pullRequests).toEqual({});
    for (const artifact of first.artifacts) {
      expect(saved.state.decisions[artifact.candidateFingerprint]).toMatchObject({ status: 'completed', reason: 'artifact_prepared', attempts: 1 });
      expect(saved.state.contentHashes[artifact.candidateFingerprint]).toBe(createHash('sha256').update(JSON.stringify(artifact.bundle)).digest('hex'));
    }
    expect(saved.state.decisions[candidateFingerprints(candidates()[47]).candidate]).toMatchObject({
      status: 'retryable', reason: 'eligible_deferred_by_run_cap', attempts: 0,
    });
    const activity = [fixture.network.requests.length, fixture.client.requests.length, fixture.lander.commands.length];
    expect((await fixture.restart().execute({ command: 'run', runId: 'offline-e2e-1' })).status).toBe('already_recorded');
    expect([fixture.network.requests.length, fixture.client.requests.length, fixture.lander.commands.length]).toEqual(activity);
    expect((await createFileStateStore(fixture.statePath).load()).version).toBe(saved.version);

    // Negative control: changing only Markdown bypasses worker-envelope checks, but must fail articles.ts.
    const valid = first.artifacts[0].bundle;
    const invalid = await fixture.lander.publisher.validateBundle({
      ...valid, markdown: valid.markdown.replace(directAnswer, 'Too short.'),
    });
    expect(invalid).toMatchObject({ status: 'failed', cleanup: 'completed', failure: expect.stringContaining('check:blog failed.') });
    expect(invalid.commands.at(-1)).toMatchObject({ label: 'check:blog', exitCode: 1 });
    expect(invalid.commands.at(-1)?.stderr).toContain('expected 40–60 words');
    expect(invalid.commands.some(({ label }) => label === 'lint' || label === 'build')).toBe(false);
    expect(await readdir(fixture.lander.validationRoot)).toEqual([]);
    await fixture.lander.assertReadOnly();
    // Opt-in handoff for a separate CLI validation against the full native app.
    // Keep one real generated bundle; the production writer also exports its origin.
    const outputDirectory = process.env.AUTOBLOG_E2E_OUTPUT_DIR;
    if (outputDirectory !== undefined) {
      expect(outputDirectory.trim()).not.toBe('');
      const outputRoot = resolve(outputDirectory);
      await mkdir(outputRoot, { recursive: true });
      await writeAutobloggerArtifacts({ ...first, artifacts: [first.artifacts[0]] }, '.', outputRoot);
    }
  }, 120_000);

  it('persists one pending-metrics pilot as prepared, writes actual files, then finalizes consumption exactly once', async () => {
    const fixture = await setup(candidates(), true);
    const report = await fixture.worker.execute({ command: 'pilot', runId: 'offline-pilot' });
    expect(report.failures, fixture.lander.commandFailures.join('\n')).toEqual([]);
    expect(report.counts).toMatchObject({ scanned: 50, deepInspected: 10, drafted: 1, validated: 1, pullRequestsOpened: 0 });
    expect(report.artifacts).toHaveLength(1);
    const [artifact] = report.artifacts;
    expect(artifact.metrics).toMatchObject({ provider: 'pending', observedAt: null, volume: null, difficulty: null, cpc: null });
    expect(artifact.bundle.article.searchMetrics).toEqual({
      volume: 'provider-pending', keywordDifficulty: 'provider-pending', cpc: 'provider-pending',
    });
    expect(fixture.network.metricKeywords).toEqual([]);
    const store = createFileStateStore(fixture.statePath);
    const prepared = await store.load();
    const hash = createHash('sha256').update(JSON.stringify(artifact.bundle)).digest('hex');
    expect(prepared.state.manualPilot).toMatchObject({ status: 'prepared', runId: 'offline-pilot', artifactHash: hash, consumedAt: null });
    await expect(consumePreparedManualPilot(store, report.runId, '0'.repeat(64), '2026-09-05T00:04:00.000Z')).rejects.toThrow('acknowledgement');
    await expect(fixture.restart().execute({ command: 'pilot', runId: 'other-pilot-before-finalization' })).rejects.toThrow('one manual');
    expect((await store.load()).version).toBe(prepared.version);
    await assertArtifactsOnDisk(fixture, report);
    const diskBundle = await readFile(join(fixture.root, report.runId, artifact.slug + '.bundle.json'), 'utf8');
    expect(createHash('sha256').update(JSON.stringify(JSON.parse(diskBundle))).digest('hex')).toBe(hash);
    await consumePreparedManualPilot(createFileStateStore(fixture.statePath), report.runId, hash, '2026-09-05T00:04:00.000Z');
    const finalized = await store.load();
    expect(finalized.state.manualPilot).toMatchObject({ status: 'consumed', artifactHash: hash, consumedAt: '2026-09-05T00:04:00.000Z' });
    await consumePreparedManualPilot(createFileStateStore(fixture.statePath), report.runId, hash, '2026-09-05T00:05:00.000Z');
    expect((await store.load()).version).toBe(finalized.version);
    const activity = [fixture.network.requests.length, fixture.client.requests.length, fixture.lander.commands.length];
    expect((await fixture.restart().execute({ command: 'pilot', runId: 'offline-pilot' })).status).toBe('already_recorded');
    await expect(fixture.restart().execute({ command: 'pilot', runId: 'other-pilot-after-finalization' })).rejects.toThrow('one manual');
    expect([fixture.network.requests.length, fixture.client.requests.length, fixture.lander.commands.length]).toEqual(activity);
    expect(await fixture.lander.publisher.openDraftPullRequest({
      bundle: artifact.bundle, validation: artifact.validation, mode: 'manual_pilot',
      keywordMetrics: artifact.metrics, origin: artifact.publicationOrigin,
    })).toEqual({ status: 'artifact_only', reason: 'manual_pilot_cannot_publish' });
    await fixture.lander.assertReadOnly();
  }, 120_000);

});

describe('offline drafting rejection integration (no lander required)', () => {
  it.each([
    { problem: 'an unresolved repair', code: 'editorial.specificity', omitSupport: false },
    { problem: 'missing per-binding support coverage', code: 'critique.support_incomplete', omitSupport: true },
  ])('blocks $problem before any lander command or artifact can be produced', async ({ code, omitSupport }) => {
    const fixture = await setup([candidates()[49]], false, false);
    fixture.client.rejectVerification = !omitSupport;
    fixture.client.omitSupportEvaluation = omitSupport;
    const report = await fixture.worker.execute({ command: 'run', runId: 'offline-rejected-repair' });
    expect(report.status).toBe('failed');
    expect(report.counts).toMatchObject({ deepInspected: 1, drafted: 0, validated: 0 });
    expect(report.artifacts).toEqual([]);
    expect(report.failures).toEqual([expect.objectContaining({
      code: 'candidate_failed', detail: expect.stringContaining(code),
    })]);
    expect(fixture.client.requests.at(-1)?.name).toBe('videoclaw_article_repair_verification_v1');
    expect(fixture.lander.commands).toEqual([]);
    expect((await createFileStateStore(fixture.statePath).load()).state.contentHashes).toEqual({});
    await fixture.lander.assertReadOnly();
  }, 120_000);
});
