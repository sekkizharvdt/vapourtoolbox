/**
 * Packing List PDF Generation Service
 */

import type { PackingList } from '@vapour/types';
import { PLListPDFDocument } from '@/components/pdf/PLListPDFDocument';
import { generatePDFBlob, downloadBlob } from '@/lib/pdf/pdfUtils';

export async function generatePLListPDF(pls: PackingList[]): Promise<Blob> {
  return generatePDFBlob(PLListPDFDocument({ pls }));
}

export async function downloadPLListPDF(pls: PackingList[]): Promise<void> {
  const blob = await generatePLListPDF(pls);
  downloadBlob(blob, `Packing_Lists_${new Date().toISOString().slice(0, 10)}.pdf`);
}
