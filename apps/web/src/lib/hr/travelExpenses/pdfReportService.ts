/**
 * Travel Expense PDF Report Service
 *
 * Generates and downloads PDF reports for travel expenses.
 * Supports including attached receipts in the PDF.
 */

import { pdf } from '@react-pdf/renderer';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { TravelExpenseReportPDF } from '@/components/pdf/TravelExpenseReportPDF';
import type { ReceiptImageData } from '@/components/pdf/TravelExpenseReportPDF';
import type { TravelExpenseReport } from '@vapour/types';
import { fetchAllReceipts } from './receiptUtils';
import { mergePdfWithReceipts } from './pdfMergeUtils';

const logger = createLogger({ context: 'pdfReportService' });

// Cache the logo data URI to avoid repeated fetches
let cachedLogoDataUri: string | null = null;

/**
 * Fetch the company logo as a base64 data URI
 */
async function fetchLogoAsDataUri(): Promise<string | undefined> {
  if (cachedLogoDataUri) {
    return cachedLogoDataUri;
  }

  try {
    const response = await fetch('/logo.png');
    if (!response.ok) {
      logger.warn('Failed to fetch logo', { status: response.status });
      return undefined;
    }

    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedLogoDataUri = reader.result as string;
        resolve(cachedLogoDataUri);
      };
      reader.onerror = () => {
        logger.warn('Failed to read logo as data URI');
        resolve(undefined);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    logger.warn('Error fetching logo', { error });
    return undefined;
  }
}

/**
 * Options for PDF generation
 */
export interface GeneratePDFOptions {
  companyName?: string;
  showSignatures?: boolean;
  includeReceipts?: boolean;
  logoDataUri?: string;
}

/**
 * Generate PDF blob for a travel expense report
 *
 * @param report - The travel expense report
 * @param options - Generation options including whether to include receipts
 * @returns PDF blob
 */
export async function generateTravelExpenseReportPDF(
  report: TravelExpenseReport,
  options?: GeneratePDFOptions
): Promise<Blob> {
  const { companyName, showSignatures = true, includeReceipts = true, logoDataUri } = options || {};

  try {
    // Fetch logo if not provided
    const logo = logoDataUri ?? (await fetchLogoAsDataUri());

    // Check if we need to include receipts
    const hasReceipts = report.items.some((item) => item.hasReceipt && item.receiptUrl);

    if (!includeReceipts || !hasReceipts) {
      // Original behavior - just generate summary
      const document = TravelExpenseReportPDF({
        report,
        companyName,
        showSignatures,
        logoDataUri: logo,
      });
      return pdf(document).toBlob();
    }

    // Fetch all receipts
    logger.info('Generating PDF with receipts', { reportId: report.id });
    const { imageReceipts, pdfReceipts, errors } = await fetchAllReceipts(report);

    // Log any fetch errors
    if (errors.length > 0) {
      logger.warn('Some receipts could not be fetched', {
        reportId: report.id,
        errorCount: errors.length,
        errors,
      });
    }

    // Convert image receipts to the format expected by the PDF component
    const receiptImages: ReceiptImageData[] = imageReceipts.map((r) => ({
      itemId: r.itemId,
      description: r.description,
      amount: r.amount,
      category: r.category,
      expenseDate: r.expenseDate,
      vendorName: r.vendorName,
      fileName: r.fileName,
      imageDataUri: r.dataUri!,
    }));

    // Generate summary PDF with embedded image receipts
    const document = TravelExpenseReportPDF({
      report,
      companyName,
      showSignatures,
      receiptImages,
      logoDataUri: logo,
    });

    const summaryBlob = await pdf(document).toBlob();

    // If no PDF receipts, return the summary with embedded images
    if (pdfReceipts.length === 0) {
      logger.info('Generated PDF with image receipts', {
        reportId: report.id,
        imageReceiptCount: imageReceipts.length,
      });
      return summaryBlob;
    }

    // Merge with PDF receipts
    const summaryBytes = new Uint8Array(await summaryBlob.arrayBuffer());
    const mergedBytes = await mergePdfWithReceipts(
      summaryBytes,
      pdfReceipts.map((r) => ({
        itemId: r.itemId,
        description: r.description,
        amount: r.amount,
        category: r.category,
        expenseDate: r.expenseDate,
        vendorName: r.vendorName,
        fileName: r.fileName,
        pdfBytes: r.pdfBytes!,
      }))
    );

    logger.info('Generated PDF with all receipts', {
      reportId: report.id,
      imageReceiptCount: imageReceipts.length,
      pdfReceiptCount: pdfReceipts.length,
    });

    // Convert Uint8Array to ArrayBuffer for Blob constructor
    const arrayBuffer = mergedBytes.buffer.slice(
      mergedBytes.byteOffset,
      mergedBytes.byteOffset + mergedBytes.byteLength
    ) as ArrayBuffer;
    return new Blob([arrayBuffer], { type: 'application/pdf' });
  } catch (error) {
    logger.error('Failed to generate PDF', { reportId: report.id, error });
    throw new Error('Failed to generate PDF report');
  }
}

/**
 * Download PDF report directly to browser
 *
 * By default, includes all attached receipts in the PDF.
 */
export async function downloadTravelExpenseReportPDF(
  report: TravelExpenseReport,
  options?: GeneratePDFOptions
): Promise<void> {
  try {
    // Default to including receipts
    const blob = await generateTravelExpenseReportPDF(report, {
      includeReceipts: true,
      ...options,
    });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.reportNumber}_Travel_Expense_Report.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    const receiptCount = report.items.filter((i) => i.hasReceipt).length;
    logger.info('Downloaded travel expense PDF', {
      reportId: report.id,
      includesReceipts: options?.includeReceipts !== false,
      receiptCount,
    });
  } catch (error) {
    logger.error('Failed to download PDF', { reportId: report.id, error });
    throw new Error('Failed to download PDF report');
  }
}

/**
 * Save PDF report to Firebase Storage and update report with URL
 *
 * By default, includes all attached receipts in the PDF.
 */
export async function saveTravelExpenseReportPDF(
  report: TravelExpenseReport,
  userId: string,
  options?: GeneratePDFOptions
): Promise<string> {
  const { db, storage } = getFirebase();

  try {
    // Generate PDF
    const blob = await generateTravelExpenseReportPDF(report, options);

    // Upload to Firebase Storage
    const fileName = `${report.reportNumber}_${Date.now()}.pdf`;
    const storagePath = `hr/travel-expenses/${report.id}/reports/${fileName}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, blob, {
      contentType: 'application/pdf',
    });

    const downloadUrl = await getDownloadURL(storageRef);

    // Update report with PDF URL
    const reportRef = doc(db, COLLECTIONS.HR_TRAVEL_EXPENSES, report.id);
    await updateDoc(reportRef, {
      pdfUrl: downloadUrl,
      pdfGeneratedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    logger.info('Saved travel expense PDF to storage', {
      reportId: report.id,
      storagePath,
    });

    return downloadUrl;
  } catch (error) {
    logger.error('Failed to save PDF to storage', { reportId: report.id, error });
    throw new Error('Failed to save PDF report');
  }
}
