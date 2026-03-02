/**
 * Three-Way Match List PDF Generation Service
 *
 * Generates a PDF of the filtered match list using @react-pdf/renderer.
 * Follows the same pattern as prListPDF.ts.
 */

import { pdf } from '@react-pdf/renderer';
import type { ThreeWayMatch } from '@vapour/types';
import { MatchListPDFDocument } from '@/components/pdf/MatchListPDFDocument';

export async function generateMatchListPDF(matches: ThreeWayMatch[]): Promise<Blob> {
  const pdfDocument = MatchListPDFDocument({ matches });
  return pdf(pdfDocument).toBlob();
}

export async function downloadMatchListPDF(matches: ThreeWayMatch[]): Promise<void> {
  const blob = await generateMatchListPDF(matches);

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Three_Way_Matches_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
