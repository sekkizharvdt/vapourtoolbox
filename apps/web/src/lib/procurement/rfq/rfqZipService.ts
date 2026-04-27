/**
 * RFQ ZIP Bundle Service
 *
 * Packages an RFQ for vendor handoff: the latest RFQ PDF plus every PR
 * attachment associated with the source PRs, in a single downloadable ZIP.
 *
 * The PDF itself does NOT carry hyperlinks to the attachments — they're
 * delivered as files alongside it inside the ZIP, so the document stays
 * self-consistent regardless of how it's shared (and we don't leak signed
 * Storage URLs that outlive the RFQ).
 */

import JSZip from 'jszip';
import { collection, query, where, getDocs, type Firestore } from 'firebase/firestore';
import { ref, getDownloadURL, type FirebaseStorage } from 'firebase/storage';
import { downloadBlob } from '@/lib/pdf/pdfUtils';

interface PRAttachmentForZip {
  fileName: string;
  storagePath: string;
}

/**
 * Fetch every attachment record across the RFQ's source PRs.
 *
 * The PR-attachment doc carries `fileUrl` as a `gs://` reference plus a
 * `storagePath` we hand to Firebase Storage to mint an HTTPS download URL.
 */
async function fetchRFQSupportingFiles(
  db: Firestore,
  purchaseRequestIds: string[]
): Promise<PRAttachmentForZip[]> {
  const files: PRAttachmentForZip[] = [];
  for (const prId of purchaseRequestIds) {
    const snap = await getDocs(
      query(collection(db, 'purchaseRequestAttachments'), where('purchaseRequestId', '==', prId))
    );
    for (const d of snap.docs) {
      const data = d.data();
      if (data.storagePath) {
        files.push({
          fileName: data.fileName || 'attachment',
          storagePath: data.storagePath,
        });
      }
    }
  }
  return files;
}

/**
 * Fetch a URL and return its bytes. Logs and returns null on failure so a
 * single broken file doesn't sink the whole bundle.
 */
async function fetchAsArrayBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[rfqZipService] Failed to fetch ${response.status}: ${url}`);
      return null;
    }
    return await response.arrayBuffer();
  } catch (error) {
    console.warn(`[rfqZipService] Network/CORS error fetching ${url}`, error);
    return null;
  }
}

/**
 * Build a ZIP blob containing:
 *   {rfqNumber}.pdf                (the latest RFQ PDF)
 *   Supporting Documents/{file...} (every PR attachment)
 */
export async function generateRFQZip(
  db: Firestore,
  storage: FirebaseStorage,
  args: { rfqNumber: string; pdfUrl: string; purchaseRequestIds: string[] }
): Promise<Blob> {
  const safeNumber = args.rfqNumber.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const zip = new JSZip();

  const [pdfBuffer, attachments] = await Promise.all([
    fetchAsArrayBuffer(args.pdfUrl),
    fetchRFQSupportingFiles(db, args.purchaseRequestIds),
  ]);

  if (pdfBuffer) {
    zip.file(`${safeNumber}.pdf`, pdfBuffer);
  }

  if (attachments.length > 0) {
    const folder = zip.folder('Supporting Documents');
    if (folder) {
      // De-duplicate filenames so two PRs each carrying "spec.pdf" don't
      // collide and silently overwrite one another inside the ZIP.
      const seen = new Map<string, number>();
      const fetched = await Promise.all(
        attachments.map(async (a) => {
          try {
            const httpsUrl = await getDownloadURL(ref(storage, a.storagePath));
            return { fileName: a.fileName, buffer: await fetchAsArrayBuffer(httpsUrl) };
          } catch (err) {
            console.warn(`[rfqZipService] Could not resolve URL for ${a.storagePath}`, err);
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
export async function downloadRFQZip(
  db: Firestore,
  storage: FirebaseStorage,
  args: { rfqNumber: string; pdfUrl: string; purchaseRequestIds: string[] }
): Promise<void> {
  const blob = await generateRFQZip(db, storage, args);
  const safeNumber = args.rfqNumber.replace(/[^a-zA-Z0-9_.-]/g, '_');
  downloadBlob(blob, `${safeNumber}.zip`);
}
