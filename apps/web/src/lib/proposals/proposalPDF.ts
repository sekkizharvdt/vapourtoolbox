/**
 * Proposal PDF Generation Service
 *
 * Generates professional proposal PDFs with cost breakdowns,
 * scope of work, terms, and client information.
 */

import { pdf } from '@react-pdf/renderer';
import type { Proposal } from '@vapour/types';
import { ProposalPDFDocument } from '@/components/pdf/ProposalPDFDocument';

export interface ProposalPDFOptions {
  showCostBreakdown?: boolean;
  showIndirectCosts?: boolean;
  includeTerms?: boolean;
  includeDeliverySchedule?: boolean;
  watermark?: string;
}

/**
 * Generate proposal PDF blob
 *
 * @param proposal Proposal data
 * @param options PDF generation options
 * @returns PDF blob ready for download
 */
export async function generateProposalPDF(
  proposal: Proposal,
  options: ProposalPDFOptions = {}
): Promise<Blob> {
  const {
    showCostBreakdown = true,
    showIndirectCosts = true,
    includeTerms = true,
    includeDeliverySchedule = true,
    watermark,
  } = options;

  // Create PDF document component
  const pdfDocument = ProposalPDFDocument({
    proposal,
    showCostBreakdown,
    showIndirectCosts,
    includeTerms,
    includeDeliverySchedule,
    watermark,
  });

  // Generate PDF blob
  const blob = await pdf(pdfDocument).toBlob();

  return blob;
}

/**
 * Download proposal PDF
 *
 * @param proposal Proposal data
 * @param options PDF generation options
 */
export async function downloadProposalPDF(
  proposal: Proposal,
  options: ProposalPDFOptions = {}
): Promise<void> {
  const blob = await generateProposalPDF(proposal, options);

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${proposal.proposalNumber}_Rev${proposal.revision}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
