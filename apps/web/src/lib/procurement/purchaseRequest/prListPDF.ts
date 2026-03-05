/**
 * Purchase Request List PDF Generation Service
 */

import type { PurchaseRequest } from '@vapour/types';
import { PRListPDFDocument } from '@/components/pdf/PRListPDFDocument';
import { generatePDFBlob, downloadBlob } from '@/lib/pdf/pdfUtils';

export async function generatePRListPDF(requests: PurchaseRequest[]): Promise<Blob> {
  return generatePDFBlob(PRListPDFDocument({ requests }));
}

export async function downloadPRListPDF(requests: PurchaseRequest[]): Promise<void> {
  const blob = await generatePRListPDF(requests);
  downloadBlob(blob, `Purchase_Requests_${new Date().toISOString().slice(0, 10)}.pdf`);
}
