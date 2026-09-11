#!/usr/bin/env node
import { exportStateHandoff, parseStateHandoffArguments } from './state-handoff';

try {
  const args = parseStateHandoffArguments(process.argv.slice(2));
  const { directory, report } = await exportStateHandoff({ ...args, timestamp: new Date().toISOString() });
  process.stdout.write(`${JSON.stringify({ directory, ...report })}\n`);
} catch {
  // Parser, schema and filesystem errors may contain source values or sensitive paths.
  process.stderr.write(`${JSON.stringify({ status: 'failed', error:
    'Offline handoff failed. Use --state <file> --output <directory> with a valid, secret-free consumed successful pilot state.' })}\n`);
  process.exitCode = 1;
}
