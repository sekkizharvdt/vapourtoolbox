/**
 * Copy the pdf.js worker into public/ so it is served from our own origin.
 *
 * It used to be loaded from cdnjs. That never worked in production: for a
 * cross-origin workerSrc, pdf.js wraps the URL in a blob worker whose body is
 * `await import("<cdn url>")`, and that import is checked against the CSP's
 * script-src, which does not list cdnjs. Its fake-worker fallback re-imports the
 * same URL on the main thread, so it failed identically. Serving the worker from
 * our own origin is covered by `worker-src 'self'` with no CSP change at all.
 *
 * Copying at build time rather than committing the file keeps it pinned to
 * whatever pdfjs-dist version is installed — the previous hardcoded CDN URL went
 * stale on a version bump and 404'd.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

const src = join(dirname(require.resolve('pdfjs-dist/package.json')), 'build', 'pdf.worker.min.mjs');
const destDir = join(here, '..', 'public');
const dest = join(destDir, 'pdf.worker.min.mjs');

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`[copy-pdf-worker] ${src} -> ${dest}`);
