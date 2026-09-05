import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import {
  PersistentWorkerStateSchema,
  compactPersistentWorkerState,
  createPersistentWorkerState,
  type GitHubStateStore,
} from './github-runtime';
import { containsSecretLikeValue } from './secrets';

function versionOf(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function createFileStateStore(pathInput: string): GitHubStateStore {
  const path = resolve(pathInput);
  const temporary = `${path}.tmp`;
  const load: GitHubStateStore['load'] = async () => {
    try {
      const metadata = await lstat(path);
      if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error('Local state path must be a regular file.');
      const content = await readFile(path, 'utf8');
      if (containsSecretLikeValue(content)) throw new Error('Local state contains a secret-like value.');
      return { state: PersistentWorkerStateSchema.parse(JSON.parse(content)), version: versionOf(content) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return { state: createPersistentWorkerState(), version: null };
    }
  };
  return {
    load,
    async save(input, expectedVersion) {
      const current = await load();
      if (current.version !== expectedVersion) throw new Error('Persistent state update conflict; rerun after reloading state.');
      const state = compactPersistentWorkerState(input);
      if (containsSecretLikeValue(state)) throw new Error('Local state contains a secret-like value.');
      const content = `${JSON.stringify(state)}\n`;
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      await writeFile(temporary, content, { mode: 0o600, flag: 'w' });
      await rename(temporary, path);
      return { version: versionOf(content) };
    },
  };
}
