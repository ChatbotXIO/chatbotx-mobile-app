#!/usr/bin/env -S pnpm exec tsx
/**
 * Regenerates the typed API client from the ChatbotX backend's OpenAPI spec.
 *
 * Usage:
 *   pnpm generate:api
 *   API_BASE_URL=https://staging.example.com pnpm generate:api
 *   API_SPEC_PATH=/api/public-spec.json pnpm generate:api
 *
 * Fetches `{API_BASE_URL}{API_SPEC_PATH}` (default `/api/spec.json`, the full oRPC router spec —
 * includes the bearer/session-authenticated routes the app needs, unlike `/api/public-spec.json`
 * which only covers the workspace-token surface) and runs it through openapi-typescript to
 * produce src/api/generated/schema.ts (a `paths` type consumed by src/api/client.ts via
 * openapi-fetch).
 *
 * This script is NOT wired into the build — the ChatbotX backend is not guaranteed to be running
 * locally, and this repo must be buildable without it. On any failure (spec unreachable, bad
 * response, generation error) it prints a clear message and exits non-zero without touching the
 * previously generated file.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_API_BASE_URL = 'http://localhost:3123';
const DEFAULT_SPEC_PATH = '/api/spec.json';
const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'api', 'generated', 'schema.ts');
const FETCH_TIMEOUT_MS = 5000;

function resolveApiBaseUrl(): string {
  return process.env.API_BASE_URL ?? DEFAULT_API_BASE_URL;
}

function resolveSpecPath(): string {
  return process.env.API_SPEC_PATH ?? DEFAULT_SPEC_PATH;
}

async function checkSpecIsReachable(specUrl: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(specUrl, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Received HTTP ${response.status} ${response.statusText}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function runOpenApiTypescript(specUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['exec', 'openapi-typescript', specUrl, '--output', OUTPUT_FILE], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`openapi-typescript exited with code ${code}`));
    });
  });
}

async function main(): Promise<void> {
  const apiBaseUrl = resolveApiBaseUrl();
  const specUrl = new URL(resolveSpecPath(), apiBaseUrl).toString();

  console.log(`[generate:api] Fetching OpenAPI spec from ${specUrl} ...`);

  try {
    await checkSpecIsReachable(specUrl);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`
[generate:api] Could not reach the OpenAPI spec at ${specUrl}.
[generate:api] Reason: ${reason}
[generate:api]
[generate:api] This is expected if the ChatbotX backend isn't running locally.
[generate:api] Start the backend locally and try again, or set
[generate:api] API_BASE_URL to point at a reachable environment.
[generate:api]
[generate:api] Leaving the previously generated client untouched (${
      existsSync(OUTPUT_FILE) ? 'exists' : 'does not exist yet — using the placeholder type'
    }).
`);
    process.exitCode = 1;
    return;
  }

  try {
    await runOpenApiTypescript(specUrl);
    console.log(`[generate:api] Wrote ${path.relative(process.cwd(), OUTPUT_FILE)}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(`[generate:api] Generation failed: ${reason}`);
    process.exitCode = 1;
  }
}

main();
