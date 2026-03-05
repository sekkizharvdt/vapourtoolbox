import JSZip from 'jszip';
import type { TransmittalDocumentEntry } from '@vapour/types';
import { downloadBlob } from '@/lib/pdf/pdfUtils';

/**
 * File extensions considered "native" (editable source files).
 * Used to filter documents for SOFT_COPY delivery.
 */
const NATIVE_EXTENSIONS = new Set([
  'dwg',
  'dxf',
  'xlsx',
  'xls',
  'docx',
  'doc',
  'pptx',
  'ppt',
  'rvt',
  'ifc',
  'skp',
  'stp',
  'step',
  'iges',
  'igs',
  '3dm',
  'dgn',
  'csv',
]);

/**
 * PDF extensions for HARD_COPY delivery.
 */
const PDF_EXTENSIONS = new Set(['pdf']);

/**
 * Extract the file extension (lowercase, without dot) from a URL or filename.
 */
function getFileExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split('/').pop() || '';
    const ext = filename.split('.').pop() || '';
    return ext.toLowerCase();
  } catch {
    // Fallback for non-URL strings
    const ext = url.split('.').pop() || '';
    return ext.toLowerCase();
  }
}

/**
 * Extract a reasonable filename from a URL.
 */
function getFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const decoded = decodeURIComponent(pathname.split('/').pop() || 'document');
    return decoded;
  } catch {
    return 'document';
  }
}

/**
 * Determine whether a file URL should be included based on the delivery method.
 *
 * - HARD_COPY: PDF files only (for printing)
 * - SOFT_COPY: native/editable files only (DWG, XLSX, etc.)
 * - BOTH or undefined: all files
 */
function shouldIncludeFile(
  fileUrl: string,
  deliveryMethod?: 'HARD_COPY' | 'SOFT_COPY' | 'BOTH'
): boolean {
  if (!deliveryMethod || deliveryMethod === 'BOTH') {
    return true;
  }

  const ext = getFileExtension(fileUrl);

  if (deliveryMethod === 'HARD_COPY') {
    return PDF_EXTENSIONS.has(ext);
  }

  if (deliveryMethod === 'SOFT_COPY') {
    return NATIVE_EXTENSIONS.has(ext);
  }

  return true;
}

/**
 * Fetch a file as an ArrayBuffer, returning null if the request fails.
 * Handles CORS and network errors gracefully.
 */
async function fetchFileBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[transmittalZipService] Failed to fetch file (${response.status}): ${url}`);
      return null;
    }
    return await response.arrayBuffer();
  } catch (error) {
    console.warn(
      `[transmittalZipService] Could not fetch file (likely CORS or network error): ${url}`,
      error
    );
    return null;
  }
}

/**
 * Generate a ZIP file containing all documents in a transmittal.
 *
 * Files are organized into folders by document number and revision:
 *   {documentNumber}/{revision}/{filename}
 *
 * @param transmittalNumber - The transmittal identifier (used for naming)
 * @param documents - Array of document entries in the transmittal
 * @param deliveryMethod - Filter files by delivery type (HARD_COPY = PDFs, SOFT_COPY = native files, BOTH = all)
 * @param transmittalPdfBlob - Optional cover sheet PDF to include at the root of the ZIP
 * @returns A Blob containing the generated ZIP file
 */
export async function generateTransmittalZip(
  transmittalNumber: string,
  documents: TransmittalDocumentEntry[],
  deliveryMethod?: 'HARD_COPY' | 'SOFT_COPY' | 'BOTH',
  transmittalPdfBlob?: Blob
): Promise<Blob> {
  const zip = new JSZip();

  // Add cover sheet PDF if provided
  if (transmittalPdfBlob) {
    zip.file(`${transmittalNumber}_Cover_Sheet.pdf`, transmittalPdfBlob);
  }

  // Process each document
  // TODO: Support multi-file documents. Currently TransmittalDocumentEntry only has
  // a single `documentFileUrl`. When the type is extended to support multiple file
  // URLs per document (e.g., native + PDF pairs), update this loop to iterate over
  // all file URLs for each document entry.
  const fetchPromises = documents.map(async (doc) => {
    if (!doc.documentFileUrl) {
      return;
    }

    if (!shouldIncludeFile(doc.documentFileUrl, deliveryMethod)) {
      return;
    }

    const buffer = await fetchFileBuffer(doc.documentFileUrl);
    if (!buffer) {
      return;
    }

    const filename = getFilenameFromUrl(doc.documentFileUrl);
    const folderPath = `${doc.documentNumber}/${doc.revision}`;
    zip.file(`${folderPath}/${filename}`, buffer);
  });

  await Promise.all(fetchPromises);

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

/**
 * Generate and download a ZIP file containing all documents in a transmittal.
 *
 * @param transmittalNumber - The transmittal identifier (used for the downloaded filename)
 * @param documents - Array of document entries in the transmittal
 * @param deliveryMethod - Filter files by delivery type
 * @param transmittalPdfBlob - Optional cover sheet PDF to include
 */
export async function downloadTransmittalZip(
  transmittalNumber: string,
  documents: TransmittalDocumentEntry[],
  deliveryMethod?: 'HARD_COPY' | 'SOFT_COPY' | 'BOTH',
  transmittalPdfBlob?: Blob
): Promise<void> {
  const blob = await generateTransmittalZip(
    transmittalNumber,
    documents,
    deliveryMethod,
    transmittalPdfBlob
  );

  downloadBlob(blob, `${transmittalNumber}_Documents.zip`);
}
