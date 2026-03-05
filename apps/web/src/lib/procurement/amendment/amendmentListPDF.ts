/**
 * PO Amendment List PDF Generation Service
 */

import type { PurchaseOrderAmendment } from '@vapour/types';
import { AmendmentListPDFDocument } from '@/components/pdf/AmendmentListPDFDocument';
import { generatePDFBlob, downloadBlob } from '@/lib/pdf/pdfUtils';

export async function generateAmendmentListPDF(
  amendments: PurchaseOrderAmendment[]
): Promise<Blob> {
  return generatePDFBlob(AmendmentListPDFDocument({ amendments }));
}

export async function downloadAmendmentListPDF(
  amendments: PurchaseOrderAmendment[]
): Promise<void> {
  const blob = await generateAmendmentListPDF(amendments);
  downloadBlob(blob, `PO_Amendments_${new Date().toISOString().slice(0, 10)}.pdf`);
}
