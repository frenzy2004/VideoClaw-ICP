import { describe, expect, it, vi } from 'vitest';
import type { ApifyClient } from './apify-client';
import { runApifyActor, SERP_ACTOR_ID } from './research';

describe('bounded observation recovery for the same Apify job', () => {
  const completed = { id: 'known-job', status: 'SUCCEEDED', defaultDatasetId: 'known-data', finishedAt: '2026-09-11T14:07:54.000Z' };

  it('spaces the same three read attempts so a temporarily unavailable observation can recover', async () => {
    let elapsed = 0, starts = 0, reads = 0, aborts = 0;
    const client: ApifyClient = {
      startActor: async () => { starts++; return { id: 'known-job', status: 'RUNNING' }; },
      getRun: async id => {
        expect(id).toBe('known-job');
        reads++;
        // Controlled reproduction of a 40-second observation outage: a read
        // takes up to the existing ten-second request limit, then times out.
        elapsed += Math.min(10_000, Math.max(0, 40_000 - elapsed));
        if (elapsed < 40_000) throw new Error('HTTP request timed out after 10000ms.');
        return completed;
      },
      getDatasetItems: async id => { expect(id).toBe('known-data'); return [{ observed: true }]; },
      abortRun: async id => { aborts++; return { id, status: 'ABORTED' }; },
    };
    const result = await runApifyActor(client, SERP_ACTOR_ID, {}, {
      nowMs: () => elapsed, sleep: async ms => { elapsed += ms; },
    });
    expect(result.items).toEqual([{ observed: true }]);
    expect(result.provenance.runId).toBe('known-job');
    expect(result.provenance.datasetId).toBe('known-data');
    expect({ starts, reads, aborts, elapsed }).toEqual({ starts: 1, reads: 3, aborts: 0, elapsed: 40_000 });
  });

  it('retains the three-read ceiling and identifies the failed observation stage', async () => {
    let elapsed = 0, starts = 0, reads = 0, aborts = 0;
    const client: ApifyClient = {
      startActor: async () => { starts++; return { id: 'known-job', status: 'RUNNING' }; },
      getRun: async () => { reads++; elapsed += 10_000; throw new Error('temporary read failure'); },
      getDatasetItems: async () => { throw new Error('Unobserved completion cannot yield evidence'); },
      abortRun: async id => { aborts++; return { id, status: 'ABORTING' }; },
    };
    await expect(runApifyActor(client, SERP_ACTOR_ID, {}, {
      nowMs: () => elapsed, sleep: async ms => { elapsed += ms; },
    })).rejects.toThrow(/known-job.*getRun poll.*temporary read failure/);
    expect({ starts, reads, aborts, elapsed }).toEqual({ starts: 1, reads: 3, aborts: 1, elapsed: 46_000 });
  });

  it('does not retry a paid start when its acknowledgement is lost', async () => {
    let starts = 0;
    const client: ApifyClient = {
      startActor: async () => { starts++; throw new Error('HTTP request timed out'); },
      getRun: async () => { throw new Error('No observed run ID'); },
      getDatasetItems: async () => [], abortRun: async id => ({ id, status: 'ABORTED' }),
    };
    await expect(runApifyActor(client, SERP_ACTOR_ID, {})).rejects.toThrow(/startActor.*HTTP request timed out/);
    expect(starts).toBe(1);
  });

  it('identifies a dataset read failure without aborting a completed job', async () => {
    let elapsed = 0, reads = 0, aborts = 0;
    const client: ApifyClient = {
      startActor: async () => completed,
      getRun: async () => completed,
      getDatasetItems: async () => { reads++; throw new Error('dataset unavailable'); },
      abortRun: async id => { aborts++; return { id, status: 'ABORTED' }; },
    };
    await expect(runApifyActor(client, SERP_ACTOR_ID, {}, {
      nowMs: () => elapsed, sleep: async ms => { elapsed += ms; },
    })).rejects.toThrow(/known-job.*dataset retrieval.*dataset unavailable/);
    expect({ reads, aborts, elapsed }).toEqual({ reads: 3, aborts: 0, elapsed: 15_000 });
  });

  it('ends a backoff at the original deadline without making another read', async () => {
    vi.useFakeTimers();
    try {
      let reads = 0, aborts = 0;
      const client: ApifyClient = {
        startActor: async () => ({ id: 'known-job', status: 'RUNNING' }),
        getRun: async () => { reads++; throw new Error('temporary read failure'); },
        getDatasetItems: async () => [],
        abortRun: async id => { aborts++; return { id, status: 'ABORTING' }; },
      };
      const check = expect(runApifyActor(client, SERP_ACTOR_ID, {}, { timeoutMs: 3_000 }))
        .rejects.toThrow(/known-job.*getRun poll.*timed out.*backoff/);
      await vi.advanceTimersByTimeAsync(3_000);
      await check;
      expect({ reads, aborts }).toEqual({ reads: 1, aborts: 1 });
      // A late sleep resolution must never trigger the abandoned read.
      await vi.advanceTimersByTimeAsync(10_000);
      expect(reads).toBe(1);
    } finally { vi.useRealTimers(); }
  });
});
