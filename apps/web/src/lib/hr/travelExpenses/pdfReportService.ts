/**
 * Travel Expense PDF Report Service
 *
 * Generates and downloads PDF reports for travel expenses.
 */

import { pdf } from '@react-pdf/renderer';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { TravelExpenseReportPDF } from '@/components/pdf/TravelExpenseReportPDF';
import type { TravelExpenseReport } from '@vapour/types';

const logger = createLogger({ context: 'pdfReportService' });

/**
 * Generate PDF blob for a travel expense report
 */
export async function generateTravelExpenseReportPDF(
  report: TravelExpenseReport,
  options?: {
    companyName?: string;
    showSignatures?: boolean;
  }
): Promise<Blob> {
  try {
    const document = TravelExpenseReportPDF({
      report,
      companyName: options?.companyName,
      showSignatures: options?.showSignatures ?? true,
    });

    const blob = await pdf(document).toBlob();
    return blob;
  } catch (error) {
    logger.error('Failed to generate PDF', { reportId: report.id, error });
    throw new Error('Failed to generate PDF report');
  }
}

/**
 * Download PDF report directly to browser
 */
export async function downloadTravelExpenseReportPDF(
  report: TravelExpenseReport,
  options?: {
    companyName?: string;
    showSignatures?: boolean;
  }
): Promise<void> {
  try {
    const blob = await generateTravelExpenseReportPDF(report, options);

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.reportNumber}_Travel_Expense_Report.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logger.info('Downloaded travel expense PDF', { reportId: report.id });
  } catch (error) {
    logger.error('Failed to download PDF', { reportId: report.id, error });
    throw new Error('Failed to download PDF report');
  }
}

/**
 * Save PDF report to Firebase Storage and update report with URL
 */
export async function saveTravelExpenseReportPDF(
  report: TravelExpenseReport,
  userId: string,
  options?: {
    companyName?: string;
    showSignatures?: boolean;
  }
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
