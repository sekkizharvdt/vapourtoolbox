/**
 * PO ZIP Bundle Service
 *
 * Packages a Purchase Order for handoff: the generated PO PDF plus every PO
 * attachment, in a single downloadable ZIP — the PO equivalent of the RFQ ZIP
 * (feedback iZqGGOesnv4fNLpq4VCi).
 *
 * The PDF does NOT carry hyperlinks to the attachments — they are delivered as
 * files alongside it inside the ZIP, so the document stays self-consistent
 * regardless of how it's shared (and we don't leak signed Storage URLs).
 *
 * Unlike the RFQ bundle, PO attachments live directly on `po.attachments[]`
 * (no cross-collection query), and the PO PDF is generated client-side rather
 * than read from a stored URL.
 */

import JSZip from 'jszip';
import { ref, getDownloadURL } from 'firebase/storage';
import type { PurchaseOrder, PurchaseOrderItem } from '@vapour/types';
import { generatePOPDF } from '@/lib/procurement/poPDF';
import { downloadBlob } from '@/lib/pdf/pdfUtils';
import { getFirebase } from '@/lib/firebase';

/**
 * Fetch a URL and return its bytes. Logs and returns null on failure so a
 * single broken file doesn't sink the whole bundle.
 */
async function fetchAsArrayBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[poZipService] Failed to fetch ${response.status}: ${url}`);
      return null;
    }
    return await response.arrayBuffer();
  } catch (error) {
    console.warn(`[poZipService] Network/CORS error fetching ${url}`, error);
    return null;
  }
}

/**
 * Build a ZIP blob containing:
 *   {poNumber}.pdf                 (the generated PO PDF)
 *   Supporting Documents/{file...} (every PO attachment)
 */
export async function generatePOZip(po: PurchaseOrder, items: PurchaseOrderItem[]): Promise<Blob> {
  const { storage } = getFirebase();
  const safeNumber = po.number.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const zip = new JSZip();

  const pdfBlob = await generatePOPDF(po, items);
  zip.file(`${safeNumber}.pdf`, await pdfBlob.arrayBuffer());

  const attachments = po.attachments ?? [];
  if (attachments.length > 0) {
    const folder = zip.folder('Supporting Documents');
    if (folder) {
      // De-duplicate filenames so two attachments named "spec.pdf" don't
      // collide and silently overwrite one another inside the ZIP.
      const seen = new Map<string, number>();
      const fetched = await Promise.all(
        attachments.map(async (a) => {
          try {
            const httpsUrl = await getDownloadURL(ref(storage, a.storagePath));
            return { fileName: a.fileName, buffer: await fetchAsArrayBuffer(httpsUrl) };
          } catch (err) {
            console.warn(`[poZipService] Could not resolve URL for ${a.storagePath}`, err);
            return { fileName: a.fileName, buffer: null as ArrayBuffer | null };
          }
        })
      );
      for (const f of fetched) {
        if (!f.buffer) continue;
        const count = seen.get(f.fileName) ?? 0;
        seen.set(f.fileName, count + 1);
        const finalName =
          count === 0
            ? f.fileName
            : (() => {
                const dot = f.fileName.lastIndexOf('.');
                return dot > 0
                  ? `${f.fileName.slice(0, dot)} (${count})${f.fileName.slice(dot)}`
                  : `${f.fileName} (${count})`;
              })();
        folder.file(finalName, f.buffer);
      }
    }
  }

  return zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

/**
 * Generate the bundle and trigger a browser download.
 */
export async function downloadPOZip(po: PurchaseOrder, items: PurchaseOrderItem[]): Promise<void> {
  const blob = await generatePOZip(po, items);
  downloadBlob(blob, `${po.number.replace(/\//g, '-')}.zip`);
}
