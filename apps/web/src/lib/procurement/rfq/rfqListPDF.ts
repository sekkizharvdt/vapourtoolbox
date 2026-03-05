/**
 * RFQ List PDF Generation Service
 */

import type { RFQ } from '@vapour/types';
import { RFQListPDFDocument } from '@/components/pdf/RFQListPDFDocument';
import { generatePDFBlob, downloadBlob } from '@/lib/pdf/pdfUtils';

export async function generateRFQListPDF(rfqs: RFQ[]): Promise<Blob> {
  return generatePDFBlob(RFQListPDFDocument({ rfqs }));
}

export async function downloadRFQListPDF(rfqs: RFQ[]): Promise<void> {
  const blob = await generateRFQListPDF(rfqs);
  downloadBlob(blob, `RFQs_${new Date().toISOString().slice(0, 10)}.pdf`);
}
