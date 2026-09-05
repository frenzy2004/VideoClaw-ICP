#!/usr/bin/env node
import { parseAutobloggerArguments, runAutobloggerCli } from './cli';
import {
  createProductionAutobloggerRuntime,
  createProductionValidationRuntime,
  writeAutobloggerArtifacts,
} from './runtime';
import { redactSensitive } from './secrets';

async function main(): Promise<number> {
  try {
    const argv = process.argv.slice(2);
    const parsed = parseAutobloggerArguments(argv);
    const runtime = parsed.command === 'validate'
      ? createProductionValidationRuntime(process.env)
      : undefined;
    return await runAutobloggerCli({
      argv,
      env: process.env,
      ...(runtime ? { runtime } : { createRuntime: (config) => createProductionAutobloggerRuntime(config) }),
      io: {
        stdout: (line) => process.stdout.write(`${line}\n`),
        stderr: (line) => process.stderr.write(`${line}\n`),
        writeArtifacts: (report, directory) => writeAutobloggerArtifacts(report, directory),
      },
    });
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ schemaVersion: 1, status: 'failed', error: redactSensitive(error).slice(0, 1_000) })}\n`);
    return 1;
  }
}

process.exitCode = await main();
