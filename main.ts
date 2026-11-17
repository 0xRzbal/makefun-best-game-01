#!/usr/bin/env node
// Best-game-01 entrypoint — assembles the submitted bundle.
//
// Contract (unchanged): this program publishes the entry the judge reads. It copies this
// directory's game/ (and screenshots/ when present) into the output directory and writes the
// canonical dossier.json with the vendored make.fun library. The output directory comes from
// $MAKEFUN_OUTPUT_DIR, falling back to /output inside the grader's container.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// This file is intentionally small and dependency-free: Node's standard library plus the
// vendored scorer library, no build step, runs as-is under `node main.ts`.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const DEFAULT_OUTPUT_DIR = '/output';
const RETRY_ATTEMPTS = 4;
const RETRY_BASE_MS = 150;

/**
 * Caps mirror the scorer's own gate (reference/gate.json). Only text_max_bytes shapes the
 * bytes; the rest refuse an entry the scorer would refuse, so we mirror them exactly.
 */
const CAPS = Object.freeze({
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run an async op, retrying transient failures with exponential backoff.
 * Bounded: at most `attempts` tries, backoff doubling from `baseMs`; the final error rethrows.
 */
async function withRetries(fn, { attempts = RETRY_ATTEMPTS, baseMs = RETRY_BASE_MS } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < attempts - 1) await sleep(baseMs * 2 ** attempt);
    }
  }
  throw lastErr;
}

function sourceRoot() {
  return fileURLToPath(new URL('.', import.meta.url));
}

function outputDir() {
  return process.env.MAKEFUN_OUTPUT_DIR ?? DEFAULT_OUTPUT_DIR;
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

/** Recursively copy a tree; silently accept a missing source. */
function copyTree(src, dst) {
  if (!existsSync(src)) return;
  cpSync(src, dst, { recursive: true });
}

async function assembleBundle(here, out) {
  ensureDir(out);

  // Copy the playable game and its screenshots. Wrapped in a bounded retry so a transient
  // filesystem hiccup (e.g. EMFILE under load) doesn't fail the whole submission.
  await withRetries(() => {
    copyTree(join(here, 'game'), join(out, 'game'));
    ensureDir(join(out, 'screenshots'));
    copyTree(join(here, 'screenshots'), join(out, 'screenshots'));
  });

  const dossier = buildDossier(out, CAPS);
  writeFileSync(join(out, 'dossier.json'), dossier);
  return dossier.length;
}

async function main() {
  const out = outputDir();
  const bytes = await assembleBundle(sourceRoot(), out);
  console.log(`[heliopause] bundle written to ${out}: game/, screenshots/, dossier.json (${bytes} bytes)`);
}

main().catch((err) => {
  console.error('[heliopause] failed to assemble bundle:', err?.message ?? err);
  process.exitCode = 1;
});
