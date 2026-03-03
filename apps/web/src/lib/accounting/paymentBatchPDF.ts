/**
 * Payment Batch PDF Generation Service
 *
 * Generates Payment Batch PDFs using @react-pdf/renderer on the client side.
 * Follows the same pattern as poPDF.ts.
 */

import { pdf } from '@react-pdf/renderer';
import type { PaymentBatch } from '@vapour/types';
import { PaymentBatchPDFDocument } from '@/components/pdf/PaymentBatchPDFDocument';

/**
 * Generate Payment Batch PDF blob
 */
export async function generatePaymentBatchPDF(batch: PaymentBatch): Promise<Blob> {
  const pdfDocument = PaymentBatchPDFDocument({ batch });
  return pdf(pdfDocument).toBlob();
}

/**
 * Download Payment Batch PDF
 */
export async function downloadPaymentBatchPDF(batch: PaymentBatch): Promise<void> {
  const blob = await generatePaymentBatchPDF(batch);

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${batch.batchNumber.replace(/\//g, '-')}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
