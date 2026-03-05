/**
 * Payment Batch PDF Generation Service
 *
 * Generates Payment Batch PDFs using @react-pdf/renderer on the client side.
 * Uses shared PDF utilities for blob generation and download.
 */

import type { PaymentBatch } from '@vapour/types';
import { PaymentBatchPDFDocument } from '@/components/pdf/PaymentBatchPDFDocument';
import { generatePDFBlob, downloadBlob } from '@/lib/pdf/pdfUtils';

/**
 * Generate Payment Batch PDF blob
 */
export async function generatePaymentBatchPDF(batch: PaymentBatch): Promise<Blob> {
  const pdfDocument = PaymentBatchPDFDocument({ batch });
  return generatePDFBlob(pdfDocument);
}

/**
 * Download Payment Batch PDF
 */
export async function downloadPaymentBatchPDF(batch: PaymentBatch): Promise<void> {
  const blob = await generatePaymentBatchPDF(batch);
  downloadBlob(blob, `${batch.batchNumber.replace(/\//g, '-')}.pdf`);
}
