/**
 * Shared PDF Utilities
 *
 * Common helpers for generating and downloading PDFs.
 * All PDF service files should use these instead of duplicating blob/download logic.
 */

import type { ReactElement } from 'react';

/**
 * Generate a PDF blob from a @react-pdf/renderer Document element.
 * Uses dynamic import so the renderer is never in the page's static bundle.
 */
export async function generatePDFBlob(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  document: ReactElement<any>
): Promise<Blob> {
  const { pdf } = await import('@react-pdf/renderer');
  return pdf(document).toBlob();
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
