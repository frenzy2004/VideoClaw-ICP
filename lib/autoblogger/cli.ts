import { z } from 'zod';

import type { AutobloggerCommand, AutobloggerRunReport } from './worker';
import { redactSensitive } from './secrets';
import { createGitHubReadOnlyAuth } from './github-runtime';

export type ParsedAutobloggerArguments =
  | { command: 'research' | 'pilot'; runId: string; artifactDir: string }
  | { command: 'run'; runId: string; artifactDir: string; phase: 'prepare' | 'publish'; preparedDir?: string; maxDrafts: 1 | 2 | 3 }
  | { command: 'validate'; bundlePath: string; artifactDir: string };

const SAFE_RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/;

function safePath(value: string, label: string): string {
  if (!value.trim() || value.includes('\0')) throw new Error(`${label} must be a non-empty path.`);
  return value;
}

export function parseAutobloggerArguments(argv: string[]): ParsedAutobloggerArguments {
  const [rawCommand, ...flags] = argv;
  if (!['research', 'pilot', 'run', 'validate'].includes(rawCommand ?? '')) {
    throw new Error('Command must be research, pilot, run, or validate.');
  }
  if (flags.length % 2 !== 0) throw new Error('Every CLI flag requires a value.');
  const values = new Map<string, string>();
  for (let index = 0; index < flags.length; index += 2) {
    const flag = flags[index];
    const value = flags[index + 1];
    if (!['--run-id', '--artifact-dir', '--bundle', '--phase', '--prepared-dir', '--max-drafts'].includes(flag)) throw new Error(`Unknown CLI flag: ${flag}`);
    if (values.has(flag)) throw new Error(`Duplicate CLI flag: ${flag}`);
    values.set(flag, value);
  }
  const command = rawCommand as AutobloggerCommand | 'validate';
  if (command !== 'run' && ['--phase', '--prepared-dir', '--max-drafts'].some((flag) => values.has(flag))) {
    throw new Error(`${command} does not accept run phase flags.`);
  }
  if (command === 'validate') {
    const bundlePath = values.get('--bundle');
    if (!bundlePath) throw new Error('validate requires --bundle.');
    if (values.has('--run-id')) throw new Error('validate does not accept --run-id.');
    return {
      command,
      bundlePath: safePath(bundlePath, 'bundle'),
      artifactDir: safePath(values.get('--artifact-dir') ?? 'artifacts/autoblogger/validate', 'artifact-dir'),
    };
  }
  if (values.has('--bundle')) throw new Error(`${command} does not accept --bundle.`);
  const runId = values.get('--run-id');
  if (!runId || !SAFE_RUN_ID.test(runId)) throw new Error(`${command} requires a safe --run-id.`);
  if (command === 'run') {
    const phase = values.get('--phase');
    if (phase !== 'prepare' && phase !== 'publish') throw new Error('run requires --phase prepare or publish.');
    const maximum = values.get('--max-drafts') ?? '1';
    if (!['1', '2', '3'].includes(maximum)) throw new Error('--max-drafts must be 1, 2, or 3.');
    const preparedDir = values.get('--prepared-dir');
    if (phase === 'publish' && !preparedDir) throw new Error('publish requires --prepared-dir.');
    if (phase === 'prepare' && preparedDir !== undefined) throw new Error('prepare does not accept --prepared-dir.');
    return {
      command, runId, phase, maxDrafts: Number(maximum) as 1 | 2 | 3,
      ...(preparedDir ? { preparedDir: safePath(preparedDir, 'prepared-dir') } : {}),
      artifactDir: safePath(values.get('--artifact-dir') ?? `artifacts/autoblogger/${runId}/${phase}`, 'artifact-dir'),
    };
  }
  return {
    command,
    runId,
    artifactDir: safePath(values.get('--artifact-dir') ?? `artifacts/autoblogger/${runId}`, 'artifact-dir'),
  };
}

const RuntimeEnvironmentSchema = z.object({
  apifyToken: z.string().min(1).nullable(),
  openaiApiKey: z.string().nullable(),
  openaiModel: z.string().min(1),
  keywordProvider: z.enum(['pending', 'semrush', 'ahrefs']),
  keywordApiKey: z.string().nullable(),
  githubToken: z.string().min(1),
  githubRepository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  landerRepository: z.string().min(1),
  landerOwner: z.string().regex(/^[A-Za-z0-9_.-]+$/),
  landerName: z.string().regex(/^[A-Za-z0-9_.-]+$/),
  landerBaseRef: z.string().min(1),
  landerGitHubToken: z.string().nullable(),
  landerReadToken: z.string().nullable(),
  landerTokenExpiresAt: z.string().datetime().nullable(),
  phase: z.enum(['prepare', 'publish']),
  artifactDir: z.string(),
  preparedDir: z.string().nullable(),
  maxDrafts: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  scheduleEnabled: z.boolean(),
}).strict();

export type AutobloggerRuntimeEnvironment = z.infer<typeof RuntimeEnvironmentSchema>;

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

export function validateAutobloggerEnvironment(
  command: AutobloggerCommand,
  env: Record<string, string | undefined>,
  options: { phase?: 'prepare' | 'publish'; preparedDir?: string; artifactDir?: string; maxDrafts?: 1 | 2 | 3 } = {},
): AutobloggerRuntimeEnvironment {
  if (env.GITHUB_EVENT_NAME === 'schedule' && env.AUTOBLOG_SCHEDULE_ENABLED !== 'true') {
    throw new Error('Scheduled autoblogger execution is disabled.');
  }
  const phase = options.phase ?? 'prepare';
  if (phase === 'publish' && command !== 'run') throw new Error('Only run supports publication.');
  const landerBaseRef = required(env, 'LANDER_BASE_REF');
  const landerGitHubToken = phase === 'publish' ? required(env, 'LANDER_GITHUB_TOKEN') : null;
  if (phase === 'prepare' && env.LANDER_GITHUB_TOKEN?.trim()) throw new Error('Prepare must not receive the publication App token.');
  if (phase === 'publish') {
    if (landerBaseRef !== 'main') throw new Error('Publication requires LANDER_BASE_REF=main and merged PR #55.');
    if (!options.preparedDir) throw new Error('Publication requires a prepared directory.');
    if (['APIFY_TOKEN', 'OPENAI_API_KEY', 'SEMRUSH_API_KEY', 'AHREFS_API_KEY'].some((key) => env[key]?.trim())) {
      throw new Error('Publish must be isolated from model and paid provider secrets.');
    }
  }
  const keywordProvider = phase === 'publish' ? 'pending' : required(env, 'KEYWORD_PROVIDER');
  if (!['pending', 'semrush', 'ahrefs'].includes(keywordProvider)) throw new Error('KEYWORD_PROVIDER must be pending, semrush, or ahrefs.');
  if (command === 'run' && phase === 'prepare' && keywordProvider === 'pending') {
    throw new Error('Scheduled runs require Semrush or Ahrefs metrics.');
  }
  const keywordApiKey = keywordProvider === 'semrush'
    ? required(env, 'SEMRUSH_API_KEY')
    : keywordProvider === 'ahrefs' ? required(env, 'AHREFS_API_KEY') : null;
  const githubToken = required(env, 'GITHUB_TOKEN');
  const landerReadToken = phase === 'prepare'
    ? createGitHubReadOnlyAuth(required(env, 'LANDER_READ_TOKEN'), githubToken).token : null;
  return RuntimeEnvironmentSchema.parse({
    apifyToken: phase === 'publish' ? null : required(env, 'APIFY_TOKEN'),
    openaiApiKey: command === 'research' || phase === 'publish' ? null : required(env, 'OPENAI_API_KEY'),
    openaiModel: env.OPENAI_MODEL?.trim() || 'gpt-5.5',
    keywordProvider,
    keywordApiKey,
    githubToken,
    githubRepository: required(env, 'GITHUB_REPOSITORY'),
    landerRepository: required(env, 'LANDER_REPOSITORY'),
    landerOwner: required(env, 'LANDER_OWNER'),
    landerName: required(env, 'LANDER_NAME'),
    landerBaseRef,
    landerGitHubToken,
    landerReadToken,
    landerTokenExpiresAt: phase === 'publish' ? required(env, 'LANDER_TOKEN_EXPIRES_AT') : null,
    phase,
    maxDrafts: options.maxDrafts ?? 1,
    artifactDir: options.artifactDir ?? 'artifacts/autoblogger',
    preparedDir: options.preparedDir ?? null,
    scheduleEnabled: env.AUTOBLOG_SCHEDULE_ENABLED === 'true',
  });
}

export type AutobloggerCliRuntime = {
  execute(input: { command: AutobloggerCommand; runId: string }): Promise<AutobloggerRunReport>;
  validate(bundlePath: string): Promise<unknown>;
  finalizeArtifacts?(report: AutobloggerRunReport): Promise<void>;
};

export type AutobloggerCliIo = {
  stdout(line: string): void;
  stderr(line: string): void;
  writeArtifacts(report: unknown, directory: string): Promise<void>;
};

function summary(report: AutobloggerRunReport) {
  return {
    schemaVersion: 1,
    command: report.command,
    runId: report.runId,
    mode: report.mode,
    status: report.status,
    startedAt: report.startedAt,
    completedAt: report.completedAt,
    limits: report.limits,
    counts: report.counts,
    artifacts: report.artifacts.map(({ articleId, slug, icp, publication, pullRequest }) => ({
      articleId,
      slug,
      icp,
      publication,
      ...(pullRequest ? { pullRequest } : {}),
    })),
    failures: report.failures,
  };
}

export async function runAutobloggerCli(input: {
  argv: string[];
  env: Record<string, string | undefined>;
  io: AutobloggerCliIo;
  runtime?: AutobloggerCliRuntime;
  createRuntime?: (config: AutobloggerRuntimeEnvironment) => Promise<AutobloggerCliRuntime>;
  createValidationRuntime?: () => AutobloggerCliRuntime;
  skipEnvironmentValidationForTests?: boolean;
}): Promise<number> {
  let failureArtifactDir = 'artifacts/autoblogger/failure';
  try {
    const artifactFlag = input.argv.indexOf('--artifact-dir');
    if (artifactFlag >= 0 && input.argv[artifactFlag + 1]) failureArtifactDir = safePath(input.argv[artifactFlag + 1], 'artifact-dir');
    const parsed = parseAutobloggerArguments(input.argv);
    failureArtifactDir = parsed.artifactDir;
    const environment = parsed.command === 'validate'
      ? undefined
      : input.skipEnvironmentValidationForTests
        ? undefined
        : validateAutobloggerEnvironment(parsed.command, input.env, parsed);
    const runtime = input.runtime ?? (parsed.command === 'validate'
      ? input.createValidationRuntime?.()
      : environment && input.createRuntime ? await input.createRuntime(environment) : undefined);
    if (!runtime) throw new Error('Autoblogger runtime is unavailable.');
    if (parsed.command === 'validate') {
      const validation = await runtime.validate(parsed.bundlePath);
      await input.io.writeArtifacts(validation, parsed.artifactDir);
      const failed = (validation as { status?: string })?.status === 'failed';
      input.io.stdout(JSON.stringify({ schemaVersion: 1, command: 'validate', status: failed ? 'failed' : 'completed' }));
      return failed ? 1 : 0;
    }
    const report = await runtime.execute({ command: parsed.command, runId: parsed.runId });
    await input.io.writeArtifacts(report, parsed.artifactDir);
    await runtime.finalizeArtifacts?.(report);
    input.io.stdout(JSON.stringify(summary(report)));
    return report.status === 'failed' ? 1 : 0;
  } catch (error) {
    const failure = { schemaVersion: 1, status: 'failed', error: redactSensitive(error).slice(0, 1_000) };
    if (failureArtifactDir) {
      try {
        await input.io.writeArtifacts(failure, failureArtifactDir);
      } catch {
        // The machine-readable stderr record remains the final fallback.
      }
    }
    input.io.stderr(JSON.stringify(failure));
    return 1;
  }
}
