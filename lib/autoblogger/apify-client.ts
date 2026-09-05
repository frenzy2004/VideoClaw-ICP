import { z } from 'zod';

import {
  redactSensitive,
  requestWithTimeout,
  type HttpTransport,
} from './http';

const APIFY_API_BASE = 'https://api.apify.com/v2';
const DEFAULT_TIMEOUT_MS = 10_000;

export type ApifyRun = {
  id: string;
  status: string;
  defaultDatasetId?: string;
  startedAt?: string;
  finishedAt?: string;
};

export interface ApifyClient {
  startActor(actorId: string, input: Record<string, unknown>): Promise<ApifyRun>;
  getRun(runId: string): Promise<ApifyRun>;
  getDatasetItems(datasetId: string): Promise<unknown[]>;
  abortRun(runId: string): Promise<ApifyRun>;
}

type ApifyClientOptions = {
  token: string;
  transport: HttpTransport;
  timeoutMs?: number;
  runTimeoutSeconds?: number;
  maxTotalChargeUsd?: number;
};

const ApifyRunSchema = z.object({
  id: z.string().trim().min(1),
  status: z.string().trim().min(1),
  defaultDatasetId: z.string().trim().min(1).optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
}).passthrough();

async function requestApify(
  options: ApifyClientOptions,
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  let response;
  try {
    response = await requestWithTimeout(options.transport, {
      method,
      url: `${APIFY_API_BASE}${path}`,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${options.token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  } catch (error) {
    throw new Error(`Apify request failed: ${redactSensitive(error, [options.token])}`);
  }
  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      `Apify request failed (${response.status}): ${redactSensitive(response.body, [options.token]).slice(0, 1_000)}`,
    );
  }
  return response.body;
}

function parseRunEnvelope(value: unknown): ApifyRun {
  const envelope = z.object({ data: ApifyRunSchema }).passthrough().parse(value);
  return envelope.data;
}

export function createApifyClient(options: ApifyClientOptions): ApifyClient {
  if (!options.token) throw new Error('An Apify token is required.');
  const runTimeout = options.runTimeoutSeconds ?? 120;
  const chargeLimit = options.maxTotalChargeUsd ?? 2;
  if (!Number.isInteger(runTimeout) || runTimeout < 1 || runTimeout > 600 || !Number.isFinite(chargeLimit) || chargeLimit <= 0 || chargeLimit > 10) {
    throw new Error('Apify run limits must be bounded: 1–600 seconds and greater than zero to 10 USD per actor.');
  }
  return {
    async startActor(actorId, input) {
      const actorPath = encodeURIComponent(actorId.replace('/', '~'));
      // Server-side timeout also applies if the response containing the run ID is lost.
      // maxTotalChargeUsd applies to pay-per-event actor charges, not all account costs.
      const limits = new URLSearchParams({ timeout: String(runTimeout), maxTotalChargeUsd: String(chargeLimit) });
      return parseRunEnvelope(await requestApify(options, 'POST', `/acts/${actorPath}/runs?${limits}`, input));
    },
    async getRun(runId) {
      return parseRunEnvelope(await requestApify(options, 'GET', `/actor-runs/${runId}`));
    },
    async getDatasetItems(datasetId) {
      const value = await requestApify(
        options,
        'GET',
        `/datasets/${datasetId}/items?clean=true&format=json&limit=1000`,
      );
      if (!Array.isArray(value)) throw new Error('Apify dataset response must be an array.');
      return value;
    },
    async abortRun(runId) {
      return parseRunEnvelope(await requestApify(
        options,
        'POST',
        `/actor-runs/${encodeURIComponent(runId)}/abort?gracefully=true`,
      ));
    },
  };
}
