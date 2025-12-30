/**
 * PDF Merge Utilities
 *
 * Utilities for merging PDF receipts with the summary PDF using pdf-lib
 * Includes fallback to render problematic PDFs as images using pdfjs-dist
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { createLogger } from '@vapour/logger';
import { format } from 'date-fns';
import type { TravelExpenseCategory } from '@vapour/types';

const logger = createLogger({ context: 'pdfMergeUtils' });

// Configure PDF.js worker
// In Next.js, we need to use the legacy build and configure the worker path
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

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
 * Render PDF pages as PNG images using pdfjs-dist
 * This is used as a fallback when pdf-lib cannot handle a PDF
 */
async function renderPdfAsImages(pdfBytes: Uint8Array): Promise<Uint8Array[]> {
  const images: Uint8Array[] = [];

  try {
    // Load PDF using pdfjs-dist
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdfDoc = await loadingTask.promise;

    // Render each page as an image
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);

      // Use a scale that gives good quality (2x for high DPI)
      const scale = 2;
      const viewport = page.getViewport({ scale });

      // Create canvas
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Could not get canvas context');
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Render page to canvas
      // pdfjs-dist types don't match DOM canvas context perfectly
      const renderContext = {
        canvasContext: context,
        viewport,
      };
      await page.render(renderContext as Parameters<typeof page.render>[0]).promise;

      // Convert canvas to PNG bytes
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error('Failed to convert canvas to blob'));
          },
          'image/png',
          0.95
        );
      });

      const arrayBuffer = await blob.arrayBuffer();
      images.push(new Uint8Array(arrayBuffer));
    }

    return images;
  } catch (error) {
    logger.error('Failed to render PDF as images', { error });
    throw error;
  }
}

/**
 * Embed images into a PDF document as new pages
 */
async function embedImagesAsPdfPages(
  mergedPdf: PDFDocument,
  imageBytes: Uint8Array[]
): Promise<void> {
  for (const imgBytes of imageBytes) {
    // Embed the PNG image
    const image = await mergedPdf.embedPng(imgBytes);

    // Calculate page size to fit the image (A4 with margins)
    const maxWidth = 595.28 - 50; // A4 width minus margins
    const maxHeight = 841.89 - 50; // A4 height minus margins

    // Scale image to fit within page
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const scaledWidth = image.width * scale;
    const scaledHeight = image.height * scale;

    // Create page sized to fit the image
    const pageWidth = scaledWidth + 50;
    const pageHeight = scaledHeight + 50;
    const page = mergedPdf.addPage([pageWidth, pageHeight]);

    // Center the image on the page
    const x = (pageWidth - scaledWidth) / 2;
    const y = (pageHeight - scaledHeight) / 2;

    page.drawImage(image, {
      x,
      y,
      width: scaledWidth,
      height: scaledHeight,
    });
  }
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

      // Load and copy receipt PDF pages with multiple fallback options
      // Some PDFs (especially from mobile apps/scanners) have non-standard features
      let receiptDoc: PDFDocument;
      try {
        // First attempt: standard loading with encryption ignored
        receiptDoc = await PDFDocument.load(receipt.pdfBytes, {
          ignoreEncryption: true,
        });
      } catch (loadError) {
        logger.debug('First PDF load attempt failed, trying permissive options', {
          fileName: receipt.fileName,
          error: loadError instanceof Error ? loadError.message : String(loadError),
        });
        try {
          // Second attempt: ignore invalid objects (helps with malformed PDFs)
          receiptDoc = await PDFDocument.load(receipt.pdfBytes, {
            ignoreEncryption: true,
            throwOnInvalidObject: false,
          });
        } catch (secondError) {
          // Third attempt: all permissive options
          logger.debug('Second PDF load attempt failed, trying all permissive options', {
            fileName: receipt.fileName,
            error: secondError instanceof Error ? secondError.message : String(secondError),
          });
          receiptDoc = await PDFDocument.load(receipt.pdfBytes, {
            ignoreEncryption: true,
            throwOnInvalidObject: false,
            updateMetadata: false,
          });
        }
      }

      const receiptPages = await mergedPdf.copyPages(receiptDoc, receiptDoc.getPageIndices());
      receiptPages.forEach((page) => mergedPdf.addPage(page));

      logger.debug('Added PDF receipt', {
        itemId: receipt.itemId,
        fileName: receipt.fileName,
        pageCount: receiptPages.length,
      });
    } catch (error) {
      // pdf-lib failed - try fallback: render PDF as images using pdfjs-dist
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('pdf-lib failed to merge PDF, trying image fallback', {
        itemId: receipt.itemId,
        fileName: receipt.fileName,
        error: errorMessage,
      });

      try {
        // Render PDF pages as images using pdfjs-dist
        const imagePages = await renderPdfAsImages(receipt.pdfBytes);

        // Embed the images as PDF pages
        await embedImagesAsPdfPages(mergedPdf, imagePages);

        logger.info('Added PDF receipt as images (fallback)', {
          itemId: receipt.itemId,
          fileName: receipt.fileName,
          pageCount: imagePages.length,
        });
      } catch (fallbackError) {
        // If even the fallback fails, add an error page
        const fallbackErrorMsg =
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        logger.error('Image fallback also failed', {
          itemId: receipt.itemId,
          fileName: receipt.fileName,
          pdfLibError: errorMessage,
          fallbackError: fallbackErrorMsg,
        });

        // Add error page with more details
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

        errorPage.drawText('The original file could not be merged into this document.', {
          x: 50,
          y: height - 130,
          size: 10,
          font,
          color: rgb(0.4, 0.4, 0.4),
        });

        errorPage.drawText(
          'Possible reasons: unsupported PDF features, encryption, or corruption.',
          {
            x: 50,
            y: height - 150,
            size: 10,
            font,
            color: rgb(0.4, 0.4, 0.4),
          }
        );

        errorPage.drawText(
          'You can view the original receipt separately using the View Receipt button.',
          {
            x: 50,
            y: height - 180,
            size: 10,
            font,
            color: rgb(0.4, 0.4, 0.4),
          }
        );
      }
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
