#!/usr/bin/env node
import { parseLocalPilotArguments, runLocalArtifactPilot } from './local-pilot';
import { redactSensitive } from './secrets';

try {
  const { runId } = parseLocalPilotArguments(process.argv.slice(2));
  const report = await runLocalArtifactPilot({ root: process.cwd(), runId });
  process.exitCode = report.status === 'validated' ? 0 : 1;
} catch (error) {
  process.stderr.write(`${JSON.stringify({ status: 'failed', error: redactSensitive(error).slice(0, 1_500) })}\n`);
  process.exitCode = 1;
}
