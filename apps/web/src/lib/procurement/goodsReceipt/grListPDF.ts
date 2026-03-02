/**
 * Goods Receipt List PDF Generation Service
 *
 * Generates a PDF of the filtered GR list using @react-pdf/renderer.
 */

import { pdf } from '@react-pdf/renderer';
import type { GoodsReceipt } from '@vapour/types';
import { GRListPDFDocument } from '@/components/pdf/GRListPDFDocument';

export async function generateGRListPDF(grs: GoodsReceipt[]): Promise<Blob> {
  const pdfDocument = GRListPDFDocument({ grs });
  return pdf(pdfDocument).toBlob();
}

export async function downloadGRListPDF(grs: GoodsReceipt[]): Promise<void> {
  const blob = await generateGRListPDF(grs);

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Goods_Receipts_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
