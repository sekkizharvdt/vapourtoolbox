/**
 * Shared PDF Utilities
 *
 * Common helpers for generating and downloading PDFs.
 * All PDF service files should use these instead of duplicating blob/download logic.
 */

import type { ReactElement } from 'react';

/**
 * How long to wait for @react-pdf/renderer before giving up.
 *
 * `toBlob()` can hang forever rather than reject: PNGs with an alpha channel go
 * through png-js -> fflate, whose async inflate runs in a blob-URL Worker. If
 * anything stops that Worker starting (a CSP without `worker-src blob:`, say),
 * the decode callback never fires, the document never finalises, and the promise
 * never settles — the user sees a spinner that only a page refresh clears.
 * Failing loudly is always better than that.
 */
const PDF_GENERATION_TIMEOUT_MS = 60_000;

/**
 * Generate a PDF blob from a @react-pdf/renderer Document element.
 * Uses dynamic import so the renderer is never in the page's static bundle.
 */
export async function generatePDFBlob(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  document: ReactElement<any>
): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            `PDF generation timed out after ${PDF_GENERATION_TIMEOUT_MS / 1000}s. ` +
              'Please try again, and report this if it keeps happening.'
          )
        ),
      PDF_GENERATION_TIMEOUT_MS
    );
  });

  try {
    return await Promise.race([pdf(document).toBlob(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Download a blob as a file in the browser.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate and download a PDF in one step.
 */
export async function downloadPDF(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  document: ReactElement<any>,
  filename: string
): Promise<void> {
  const blob = await generatePDFBlob(document);
  downloadBlob(blob, filename);
}

/**
 * Sanitise a string for use as a filename (replace unsafe chars with underscores).
 */
export function sanitiseFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}
