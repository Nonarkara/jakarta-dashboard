/**
 * The Worker, as one importable module URL.
 *
 * `scripts/worker-bundle.mjs` does the work; this file only supplies the
 * TypeScript compiler and the source directory, so the contract tests can
 * say `await import(workerModuleUrl)` and get the Worker.
 */
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { bundleWorker } from './worker-bundle.mjs';

export const srcDir = fileURLToPath(new URL('../src/', import.meta.url));

/** The Worker, bundled. Importing this URL yields the default export. */
export const workerModuleUrl = bundleWorker(undefined, { ts, srcDir });
