/**
 * PDF Merge Utilities
 *
 * Utilities for merging PDF receipts with the summary PDF using pdf-lib
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { createLogger } from '@vapour/logger';
import { format } from 'date-fns';
import type { TravelExpenseCategory } from '@vapour/types';

const logger = createLogger({ context: 'pdfMergeUtils' });

/**
 * PDF receipt data for merging
 */
export interface PdfReceiptData {
  itemId: string;
  description: string;
  amount: number;
  category: TravelExpenseCategory;
  expenseDate: Date;
  vendorName?: string;
  fileName: string;
  pdfBytes: Uint8Array;
}

const CATEGORY_LABELS: Record<TravelExpenseCategory, string> = {
  TRAVEL: 'Travel',
  ACCOMMODATION: 'Accommodation',
  LOCAL_CONVEYANCE: 'Local Conveyance',
  FOOD: 'Food & Meals',
  OTHER: 'Other',
};

/**
 * Format currency in INR format
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Draw a separator page with receipt metadata before each PDF receipt
 */
async function addSeparatorPage(
  mergedPdf: PDFDocument,
  receipt: PdfReceiptData,
  receiptNumber: number,
  totalReceipts: number
): Promise<void> {
  const page = mergedPdf.addPage([595.28, 841.89]); // A4 size in points
  const font = await mergedPdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await mergedPdf.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  // Header
  page.drawText('RECEIPT ATTACHMENT', {
    x: margin,
    y,
    size: 18,
    font: boldFont,
    color: rgb(0.098, 0.463, 0.824), // #1976d2
  });
  y -= 30;

  page.drawText(`Receipt ${receiptNumber} of ${totalReceipts}`, {
    x: margin,
    y,
    size: 12,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 40;

  // Separator line
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.878, 0.878, 0.878), // #e0e0e0
  });
  y -= 30;

  // Receipt details
  const lineHeight = 24;
  const labelX = margin;
  const valueX = margin + 120;

  const details = [
    { label: 'Description:', value: receipt.description },
    { label: 'Category:', value: CATEGORY_LABELS[receipt.category] },
    { label: 'Amount:', value: formatCurrency(receipt.amount) },
    { label: 'Date:', value: format(receipt.expenseDate, 'dd MMM yyyy') },
    ...(receipt.vendorName ? [{ label: 'Vendor:', value: receipt.vendorName }] : []),
    { label: 'File:', value: receipt.fileName },
  ];

  for (const detail of details) {
    page.drawText(detail.label, {
      x: labelX,
      y,
      size: 10,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });

    // Truncate long values
    const maxValueWidth = width - valueX - margin;
    let value = detail.value;
    while (font.widthOfTextAtSize(value, 10) > maxValueWidth && value.length > 3) {
      value = value.slice(0, -4) + '...';
    }

    page.drawText(value, {
      x: valueX,
      y,
      size: 10,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    y -= lineHeight;
  }

  y -= 20;

  // Note about following pages
  page.drawText('The original receipt document follows on the next page(s).', {
    x: margin,
    y,
    size: 9,
    font,
    color: rgb(0.6, 0.6, 0.6),
  });
}

/**
 * Merge the summary PDF with PDF receipts
 *
 * Adds a separator page with metadata before each PDF receipt
 */
export async function mergePdfWithReceipts(
  summaryPdfBytes: Uint8Array,
  pdfReceipts: PdfReceiptData[]
): Promise<Uint8Array> {
  logger.info('Starting PDF merge', { receiptCount: pdfReceipts.length });

  // Create the merged document
  const mergedPdf = await PDFDocument.create();

  // Copy all pages from the summary PDF
  const summaryDoc = await PDFDocument.load(summaryPdfBytes);
  const summaryPages = await mergedPdf.copyPages(summaryDoc, summaryDoc.getPageIndices());
  summaryPages.forEach((page) => mergedPdf.addPage(page));

  // Add each PDF receipt with a separator page
  let receiptNumber = 0;
  for (const receipt of pdfReceipts) {
    receiptNumber++;

    try {
      // Add separator page with metadata
      await addSeparatorPage(mergedPdf, receipt, receiptNumber, pdfReceipts.length);

      // Load and copy receipt PDF pages
      const receiptDoc = await PDFDocument.load(receipt.pdfBytes, {
        ignoreEncryption: true,
      });
      const receiptPages = await mergedPdf.copyPages(receiptDoc, receiptDoc.getPageIndices());
      receiptPages.forEach((page) => mergedPdf.addPage(page));

      logger.debug('Added PDF receipt', {
        itemId: receipt.itemId,
        fileName: receipt.fileName,
        pageCount: receiptPages.length,
      });
    } catch (error) {
      // If a PDF is corrupted, add an error page instead
      logger.warn('Failed to merge PDF receipt', {
        itemId: receipt.itemId,
        fileName: receipt.fileName,
        error: error instanceof Error ? error.message : String(error),
      });

      // Add error page
      const errorPage = mergedPdf.addPage([595.28, 841.89]);
      const font = await mergedPdf.embedFont(StandardFonts.Helvetica);
      const { height } = errorPage.getSize();

      errorPage.drawText(`Failed to embed receipt: ${receipt.fileName}`, {
        x: 50,
        y: height - 100,
        size: 12,
        font,
        color: rgb(0.776, 0.157, 0.157), // #c62828
      });

      errorPage.drawText('The original file may be corrupted or password-protected.', {
        x: 50,
        y: height - 130,
        size: 10,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
  }

  // Save the merged PDF
  const mergedBytes = await mergedPdf.save();
  logger.info('PDF merge complete', {
    totalPages: mergedPdf.getPageCount(),
    fileSize: mergedBytes.length,
  });

  return mergedBytes;
}
