/**
 * Proposal PDF Generation Service
 *
 * Generates professional proposal PDFs with cost breakdowns,
 * scope of work, terms, and client information.
 * Supports saving PDFs to Firebase Storage for later retrieval.
 */

import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, Firestore, Timestamp } from 'firebase/firestore';
import type { Proposal } from '@vapour/types';
import { ProposalPDFDocument } from '@/components/pdf/ProposalPDFDocument';
import { generatePDFBlob, downloadBlob } from '@/lib/pdf/pdfUtils';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'proposalPDF' });

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

  return generatePDFBlob(
    ProposalPDFDocument({
      proposal,
      showCostBreakdown,
      showIndirectCosts,
      includeTerms,
      includeDeliverySchedule,
      watermark,
    })
  );
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
  downloadBlob(blob, `${proposal.proposalNumber}_Rev${proposal.revision}.pdf`);
}

export interface SaveProposalPDFResult {
  fileUrl: string;
  storagePath: string;
}

/**
 * Save generated PDF to Firebase Storage
 *
 * @param db Firestore instance
 * @param proposal Proposal data
 * @param options PDF generation options
 * @returns URL and storage path of the saved PDF
 */
export async function saveProposalPDF(
  db: Firestore,
  proposal: Proposal,
  options: ProposalPDFOptions = {}
): Promise<SaveProposalPDFResult> {
  logger.info('Generating and saving proposal PDF', {
    proposalId: proposal.id,
    proposalNumber: proposal.proposalNumber,
    revision: proposal.revision,
  });

  // Generate PDF blob
  const blob = await generateProposalPDF(proposal, options);

  // Generate filename and storage path
  const fileName = `${proposal.proposalNumber}_Rev${proposal.revision}.pdf`;
  const storagePath = `entities/${proposal.entityId}/proposals/${proposal.id}/generated/${fileName}`;

  // Upload to Firebase Storage
  const storage = getStorage();
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, blob, {
    contentType: 'application/pdf',
    customMetadata: {
      proposalNumber: proposal.proposalNumber,
      revision: proposal.revision.toString(),
      generatedAt: new Date().toISOString(),
    },
  });

  // Get download URL
  const fileUrl = await getDownloadURL(storageRef);

  // Update proposal document with PDF URL and path
  const proposalRef = doc(db, 'proposals', proposal.id);
  await updateDoc(proposalRef, {
    generatedPdfUrl: fileUrl,
    generatedPdfStoragePath: storagePath,
    updatedAt: Timestamp.now(),
  });

  logger.info('Proposal PDF saved successfully', {
    proposalId: proposal.id,
    storagePath,
  });

  return { fileUrl, storagePath };
}

/**
 * Generate and download PDF, optionally saving to storage
 *
 * @param db Firestore instance (optional, required for saving)
 * @param proposal Proposal data
 * @param options PDF generation options
 * @param saveToStorage Whether to save the PDF to storage
 * @returns The saved PDF URL and path if saveToStorage is true
 */
export async function generateAndDownloadProposalPDF(
  db: Firestore | null,
  proposal: Proposal,
  options: ProposalPDFOptions = {},
  saveToStorage: boolean = false
): Promise<SaveProposalPDFResult | void> {
  const blob = await generateProposalPDF(proposal, options);
  downloadBlob(blob, `${proposal.proposalNumber}_Rev${proposal.revision}.pdf`);

  // Optionally save to storage
  if (saveToStorage && db) {
    return saveProposalPDF(db, proposal, options);
  }
}
