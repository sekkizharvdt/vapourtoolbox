/**
 * Receipt Fetching Utilities
 *
 * Utilities for fetching and preparing receipts for PDF embedding
 */

import { createLogger } from '@vapour/logger';
import type { TravelExpenseReport, TravelExpenseItem, TravelExpenseCategory } from '@vapour/types';

const logger = createLogger({ context: 'receiptUtils' });

/**
 * Receipt data prepared for PDF embedding
 */
export interface ReceiptData {
  itemId: string;
  description: string;
  amount: number;
  category: TravelExpenseCategory;
  expenseDate: Date;
  vendorName?: string;
  fileName: string;
  fileType: 'image' | 'pdf';
  dataUri?: string; // For images: base64 data URI
  pdfBytes?: Uint8Array; // For PDFs: raw bytes
}

/**
 * Result of fetching all receipts from a report
 */
export interface FetchedReceipts {
  imageReceipts: ReceiptData[];
  pdfReceipts: ReceiptData[];
  errors: Array<{ itemId: string; fileName: string; error: string }>;
}

/**
 * Determine file type from URL or filename
 */
function getFileType(url: string, fileName?: string): 'image' | 'pdf' | 'unknown' {
  const name = fileName?.toLowerCase() || url.toLowerCase();

  if (name.includes('.pdf')) {
    return 'pdf';
  }

  if (
    name.includes('.jpg') ||
    name.includes('.jpeg') ||
    name.includes('.png') ||
    name.includes('.webp')
  ) {
    return 'image';
  }

  // Try to detect from URL path or query params
  if (url.includes('image/') || url.includes('contentType=image')) {
    return 'image';
  }

  if (url.includes('application/pdf') || url.includes('contentType=application%2Fpdf')) {
    return 'pdf';
  }

  return 'unknown';
}

/**
 * Convert a Blob to a base64 data URI
 */
async function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to data URI'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Fetch a receipt from Firebase Storage URL
 */
async function fetchReceipt(
  url: string,
  fileName: string,
  timeout = 30000
): Promise<{ blob: Blob; fileType: 'image' | 'pdf' }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const blob = await response.blob();
    clearTimeout(timeoutId);

    // Determine file type from content-type or filename
    const contentType = response.headers.get('content-type') || '';
    let fileType: 'image' | 'pdf';

    if (contentType.includes('application/pdf')) {
      fileType = 'pdf';
    } else if (contentType.includes('image/')) {
      fileType = 'image';
    } else {
      // Fall back to filename detection
      const detectedType = getFileType(url, fileName);
      if (detectedType === 'unknown') {
        throw new Error(`Unknown file type: ${contentType}`);
      }
      fileType = detectedType;
    }

    return { blob, fileType };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Convert expense date to Date object
 */
function toDate(date: Date | { toDate: () => Date }): Date {
  return 'toDate' in date ? date.toDate() : date;
}

/**
 * Fetch all receipts from a travel expense report
 *
 * Separates receipts into image and PDF categories for different handling
 */
export async function fetchAllReceipts(report: TravelExpenseReport): Promise<FetchedReceipts> {
  const imageReceipts: ReceiptData[] = [];
  const pdfReceipts: ReceiptData[] = [];
  const errors: Array<{ itemId: string; fileName: string; error: string }> = [];

  // Filter items that have receipts
  const itemsWithReceipts = report.items.filter(
    (item): item is TravelExpenseItem & { receiptUrl: string; receiptFileName: string } =>
      item.hasReceipt && !!item.receiptUrl && !!item.receiptFileName
  );

  if (itemsWithReceipts.length === 0) {
    return { imageReceipts, pdfReceipts, errors };
  }

  logger.info('Fetching receipts for PDF', {
    reportId: report.id,
    receiptCount: itemsWithReceipts.length,
  });

  // Fetch receipts in parallel with concurrency limit
  const concurrencyLimit = 5;
  const chunks: (typeof itemsWithReceipts)[] = [];

  for (let i = 0; i < itemsWithReceipts.length; i += concurrencyLimit) {
    chunks.push(itemsWithReceipts.slice(i, i + concurrencyLimit));
  }

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map(async (item) => {
        const { blob, fileType } = await fetchReceipt(item.receiptUrl, item.receiptFileName);

        const baseData: Omit<ReceiptData, 'dataUri' | 'pdfBytes'> = {
          itemId: item.id,
          description: item.description,
          amount: item.amount,
          category: item.category,
          expenseDate: toDate(item.expenseDate),
          vendorName: item.vendorName,
          fileName: item.receiptFileName,
          fileType,
        };

        if (fileType === 'image') {
          const dataUri = await blobToDataUri(blob);
          const imageReceipt: ReceiptData = { ...baseData, dataUri };
          return imageReceipt;
        } else {
          const arrayBuffer = await blob.arrayBuffer();
          const pdfBytes = new Uint8Array(arrayBuffer);
          const pdfReceipt: ReceiptData = { ...baseData, pdfBytes };
          return pdfReceipt;
        }
      })
    );

    results.forEach((result, i) => {
      const item = chunk[i]!;

      if (result.status === 'fulfilled') {
        const receipt = result.value;
        if (receipt.fileType === 'image') {
          imageReceipts.push(receipt);
        } else {
          pdfReceipts.push(receipt);
        }
      } else {
        const errorMessage =
          result.reason instanceof Error ? result.reason.message : String(result.reason);
        errors.push({
          itemId: item.id,
          fileName: item.receiptFileName,
          error: errorMessage,
        });
        logger.warn('Failed to fetch receipt', {
          itemId: item.id,
          fileName: item.receiptFileName,
          error: errorMessage,
        });
      }
    });
  }

  logger.info('Receipts fetched', {
    reportId: report.id,
    imageCount: imageReceipts.length,
    pdfCount: pdfReceipts.length,
    errorCount: errors.length,
  });

  return { imageReceipts, pdfReceipts, errors };
}
