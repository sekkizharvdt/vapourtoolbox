/**
 * Three-Way Match List PDF Generation Service
 */

import type { ThreeWayMatch } from '@vapour/types';
import { MatchListPDFDocument } from '@/components/pdf/MatchListPDFDocument';
import { generatePDFBlob, downloadBlob } from '@/lib/pdf/pdfUtils';

export async function generateMatchListPDF(matches: ThreeWayMatch[]): Promise<Blob> {
  return generatePDFBlob(MatchListPDFDocument({ matches }));
}

export async function downloadMatchListPDF(matches: ThreeWayMatch[]): Promise<void> {
  const blob = await generateMatchListPDF(matches);
  downloadBlob(blob, `Three_Way_Matches_${new Date().toISOString().slice(0, 10)}.pdf`);
}
