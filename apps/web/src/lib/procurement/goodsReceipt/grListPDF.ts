/**
 * Goods Receipt List PDF Generation Service
 */

import type { GoodsReceipt } from '@vapour/types';
import { GRListPDFDocument } from '@/components/pdf/GRListPDFDocument';
import { generatePDFBlob, downloadBlob } from '@/lib/pdf/pdfUtils';

export async function generateGRListPDF(grs: GoodsReceipt[]): Promise<Blob> {
  return generatePDFBlob(GRListPDFDocument({ grs }));
}

export async function downloadGRListPDF(grs: GoodsReceipt[]): Promise<void> {
  const blob = await generateGRListPDF(grs);
  downloadBlob(blob, `Goods_Receipts_${new Date().toISOString().slice(0, 10)}.pdf`);
}
