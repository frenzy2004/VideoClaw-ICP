import { z } from 'zod';

import type { AutobloggerCommand, AutobloggerRunReport } from './worker';
import { redactSensitive } from './secrets';

export type ParsedAutobloggerArguments =
  | { command: AutobloggerCommand; runId: string; artifactDir: string }
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
    if (!['--run-id', '--artifact-dir', '--bundle'].includes(flag)) throw new Error(`Unknown CLI flag: ${flag}`);
    if (values.has(flag)) throw new Error(`Duplicate CLI flag: ${flag}`);
    values.set(flag, value);
  }
  const command = rawCommand as AutobloggerCommand | 'validate';
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
  return {
    command,
    runId,
    artifactDir: safePath(values.get('--artifact-dir') ?? `artifacts/autoblogger/${runId}`, 'artifact-dir'),
  };
}

const RuntimeEnvironmentSchema = z.object({
  apifyToken: z.string().min(1),
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
): AutobloggerRuntimeEnvironment {
  if (env.GITHUB_EVENT_NAME === 'schedule' && env.AUTOBLOG_SCHEDULE_ENABLED !== 'true') {
    throw new Error('Scheduled autoblogger execution is disabled.');
  }
  const keywordProvider = required(env, 'KEYWORD_PROVIDER');
  if (!['pending', 'semrush', 'ahrefs'].includes(keywordProvider)) throw new Error('KEYWORD_PROVIDER must be pending, semrush, or ahrefs.');
  if (command === 'run' && keywordProvider === 'pending') {
    throw new Error('Scheduled runs require Semrush or Ahrefs metrics.');
  }
  const keywordApiKey = keywordProvider === 'semrush'
    ? required(env, 'SEMRUSH_API_KEY')
    : keywordProvider === 'ahrefs' ? required(env, 'AHREFS_API_KEY') : null;
  const landerBaseRef = required(env, 'LANDER_BASE_REF');
  const landerGitHubToken = env.LANDER_GITHUB_TOKEN?.trim() || null;
  if (command === 'run' && landerBaseRef === 'main' && !landerGitHubToken) {
    throw new Error('LANDER_GITHUB_TOKEN from the GitHub App is required for main-target draft PRs.');
  }
  return RuntimeEnvironmentSchema.parse({
    apifyToken: required(env, 'APIFY_TOKEN'),
    openaiApiKey: command === 'research' ? null : required(env, 'OPENAI_API_KEY'),
    openaiModel: env.OPENAI_MODEL?.trim() || 'gpt-5.5',
    keywordProvider,
    keywordApiKey,
    githubToken: required(env, 'GITHUB_TOKEN'),
    githubRepository: required(env, 'GITHUB_REPOSITORY'),
    landerRepository: required(env, 'LANDER_REPOSITORY'),
    landerOwner: required(env, 'LANDER_OWNER'),
    landerName: required(env, 'LANDER_NAME'),
    landerBaseRef,
    landerGitHubToken,
    scheduleEnabled: env.AUTOBLOG_SCHEDULE_ENABLED === 'true',
  });
}

export type AutobloggerCliRuntime = {
  execute(input: { command: AutobloggerCommand; runId: string }): Promise<AutobloggerRunReport>;
  validate(bundlePath: string): Promise<unknown>;
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
  skipEnvironmentValidationForTests?: boolean;
}): Promise<number> {
  try {
    const parsed = parseAutobloggerArguments(input.argv);
    const environment = parsed.command === 'validate'
      ? undefined
      : input.skipEnvironmentValidationForTests
        ? undefined
        : validateAutobloggerEnvironment(parsed.command, input.env);
    const runtime = input.runtime ?? (environment && input.createRuntime ? await input.createRuntime(environment) : undefined);
    if (!runtime) throw new Error('Autoblogger runtime is unavailable.');
    if (parsed.command === 'validate') {
      const validation = await runtime.validate(parsed.bundlePath);
      await input.io.writeArtifacts(validation, parsed.artifactDir);
      input.io.stdout(JSON.stringify({ schemaVersion: 1, command: 'validate', status: 'completed' }));
      return 0;
    }
    const report = await runtime.execute({ command: parsed.command, runId: parsed.runId });
    await input.io.writeArtifacts(report, parsed.artifactDir);
    input.io.stdout(JSON.stringify(summary(report)));
    return report.status === 'failed' ? 1 : 0;
  } catch (error) {
    input.io.stderr(JSON.stringify({ schemaVersion: 1, status: 'failed', error: redactSensitive(error).slice(0, 1_000) }));
    return 1;
  }
}
