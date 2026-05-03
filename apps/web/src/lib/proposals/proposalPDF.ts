/**
 * Proposal PDF Generation Service
 *
 * Generates professional proposal PDFs with cost breakdowns,
 * scope of work, terms, and client information.
 * Supports saving PDFs to Firebase Storage for later retrieval.
 */

import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, updateDoc, Firestore, Timestamp } from 'firebase/firestore';
import type { Proposal } from '@vapour/types';
import { ProposalPDFDocument, type ProposalPDFCompany } from '@/components/pdf/ProposalPDFDocument';
import { generatePDFBlob, downloadBlob } from '@/lib/pdf/pdfUtils';
import { fetchLogoAsDataUri } from '@/lib/pdf/logoUtils';
import { getFirebase } from '@/lib/firebase';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'proposalPDF' });

export interface ProposalPDFOptions {
  includeTerms?: boolean;
  includeDeliverySchedule?: boolean;
  watermark?: string;
}

function formatAddress(addr?: {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}): string | undefined {
  if (!addr) return undefined;
  const lines: string[] = [];
  if (addr.street) lines.push(addr.street);
  const cityLine = [addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ');
  if (cityLine) lines.push(cityLine);
  if (addr.country) lines.push(addr.country);
  return lines.join('\n') || undefined;
}

/**
 * Format an entity billingAddress into a multi-line string. Filters out
 * null / undefined / empty parts so old broken `clientAddress` strings
 * (which contained literal "null"s) get superseded by a clean version
 * built from the live entity record.
 */
function formatEntityBillingAddress(addr: unknown): string | undefined {
  if (!addr || typeof addr !== 'object') return undefined;
  const a = addr as {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  };
  const clean = (v: string | null | undefined): string => (v ?? '').trim();
  const lines: string[] = [];
  if (clean(a.line1)) lines.push(clean(a.line1));
  if (clean(a.line2)) lines.push(clean(a.line2));
  const cityLine = [clean(a.city), clean(a.state), clean(a.postalCode)]
    .filter((p) => p.length > 0)
    .join(', ');
  if (cityLine) lines.push(cityLine);
  if (clean(a.country)) lines.push(clean(a.country));
  const out = lines.join('\n');
  return out || undefined;
}

/**
 * Pull the live client entity and rebuild the address string, so the PDF
 * always reflects the current entity record (per CLAUDE.md rule #13).
 * Falls back to the proposal's denormalised `clientAddress` if the entity
 * lookup fails. Also returns a contact-person override when the entity
 * has a primary contact configured.
 */
async function loadClientProfile(
  clientId?: string
): Promise<
  { address?: string; contactPerson?: string; email?: string; phone?: string } | undefined
> {
  if (!clientId) return undefined;
  try {
    const { db } = getFirebase();
    const snap = await getDoc(doc(db, 'entities', clientId));
    if (!snap.exists()) return undefined;
    const data = snap.data() as {
      billingAddress?: unknown;
      primaryContact?: { name?: string; email?: string; phone?: string };
      email?: string;
      phone?: string;
    };
    const address = formatEntityBillingAddress(data.billingAddress);
    return {
      ...(address && { address }),
      contactPerson: data.primaryContact?.name,
      email: data.primaryContact?.email || data.email,
      phone: data.primaryContact?.phone || data.phone,
    };
  } catch (err) {
    logger.warn('Failed to load client profile for proposal PDF', {
      clientId,
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

async function loadCompanyProfile(): Promise<ProposalPDFCompany | undefined> {
  try {
    const { db } = getFirebase();
    const snap = await getDoc(doc(db, 'company', 'settings'));
    if (!snap.exists()) return undefined;
    const data = snap.data() as {
      companyName?: string;
      legalName?: string;
      address?: Parameters<typeof formatAddress>[0];
      taxIds?: { gstin?: string; pan?: string };
      email?: string;
      phone?: string;
      website?: string;
    };
    const address = formatAddress(data.address);
    return {
      name: data.legalName || data.companyName || 'Vapour Desal Technologies Private Limited',
      ...(address && { address }),
      gstin: data.taxIds?.gstin,
      email: data.email,
      phone: data.phone,
      website: data.website,
    };
  } catch (err) {
    logger.warn('Failed to load company profile for proposal PDF', {
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
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
  const { includeTerms = true, includeDeliverySchedule = true, watermark } = options;

  const [company, logoDataUri, clientProfile] = await Promise.all([
    loadCompanyProfile(),
    fetchLogoAsDataUri().catch(() => undefined),
    loadClientProfile(proposal.clientId),
  ]);

  return generatePDFBlob(
    ProposalPDFDocument({
      proposal,
      includeTerms,
      includeDeliverySchedule,
      watermark,
      company,
      logoDataUri,
      clientProfile,
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
  const storagePath = `entities/${proposal.tenantId}/proposals/${proposal.id}/generated/${fileName}`;

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
