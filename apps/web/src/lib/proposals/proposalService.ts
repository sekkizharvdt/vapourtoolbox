/**
 * Proposal Service
 * Handles CRUD operations for proposals including revisions and approval workflow
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  Firestore,
  startAfter as firestoreStartAfter,
  runTransaction,
} from 'firebase/firestore';
import { createLogger } from '@vapour/logger';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import type {
  Proposal,
  CreateProposalInput,
  UpdateProposalInput,
  ListProposalsOptions,
  ProposalStatus,
  Enquiry,
} from '@vapour/types';

const logger = createLogger({ context: 'proposalService' });

const COLLECTIONS = {
  PROPOSALS: 'proposals',
  ENQUIRIES: 'enquiries',
  ENTITIES: 'entities',
};

/**
 * Generate next proposal number: PROP-YY-NN
 * Format: PROP-25-01, PROP-25-02, etc.
 */
async function generateProposalNumber(db: Firestore): Promise<string> {
  const year = new Date().getFullYear();
  const twoDigitYear = year.toString().slice(-2); // Get last 2 digits
  const prefix = `PROP-${twoDigitYear}-`;

  const q = query(
    collection(db, COLLECTIONS.PROPOSALS),
    where('proposalNumber', '>=', prefix),
    where(
      'proposalNumber',
      '<',
      `PROP-${(parseInt(twoDigitYear) + 1).toString().padStart(2, '0')}-`
    ),
    orderBy('proposalNumber', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);
  let nextNumber = 1;

  if (!snapshot.empty) {
    const firstDoc = snapshot.docs[0];
    if (firstDoc) {
      const lastProposalNumber = firstDoc.data().proposalNumber as string;
      if (lastProposalNumber) {
        const parts = lastProposalNumber.split('-');
        if (parts.length >= 3 && parts[2]) {
          const lastNumber = parseInt(parts[2], 10);
          if (!isNaN(lastNumber)) {
            nextNumber = lastNumber + 1;
          }
        }
      }
    }
  }

  return `${prefix}${nextNumber.toString().padStart(2, '0')}`;
}

/**
 * Create new proposal
 */
export async function createProposal(
  db: Firestore,
  input: CreateProposalInput,
  userId: string
): Promise<Proposal> {
  try {
    // Get enquiry details
    const enquiryDoc = await getDoc(doc(db, COLLECTIONS.ENQUIRIES, input.enquiryId));
    if (!enquiryDoc.exists()) {
      throw new Error('Enquiry not found');
    }
    const enquiryData = enquiryDoc.data() as Omit<Enquiry, 'id'>;
    const enquiry: Enquiry = { id: enquiryDoc.id, ...enquiryData };

    // Get client details
    const clientDoc = await getDoc(doc(db, COLLECTIONS.ENTITIES, input.clientId));
    if (!clientDoc.exists()) {
      throw new Error('Client not found');
    }
    const client = clientDoc.data();

    // Generate proposal number
    const proposalNumber = await generateProposalNumber(db);

    const now = Timestamp.now();
    const proposal: Omit<Proposal, 'id'> = {
      proposalNumber,
      revision: 1,
      enquiryId: input.enquiryId,
      enquiryNumber: enquiry.enquiryNumber,
      entityId: input.entityId,
      clientId: input.clientId,
      clientName: client.name || '',
      clientContactPerson: enquiry.clientContactPerson,
      clientEmail: enquiry.clientEmail,
      clientAddress: client.billingAddress
        ? `${client.billingAddress.line1}, ${client.billingAddress.city}, ${client.billingAddress.state} ${client.billingAddress.postalCode}`
        : '',
      title: input.title,
      validityDate: input.validityDate,
      preparationDate: now,
      scopeOfWork: input.scopeOfWork,
      scopeOfSupply: [],
      deliveryPeriod: input.deliveryPeriod,
      pricing: {
        currency: 'INR',
        lineItems: [],
        subtotal: { amount: 0, currency: 'INR' },
        taxItems: [],
        totalAmount: { amount: 0, currency: 'INR' },
        paymentTerms: input.paymentTerms,
      },
      terms: {},
      status: 'DRAFT',
      approvalHistory: [],
      attachments: [],
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
      isLatestRevision: true,
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.PROPOSALS), proposal);

    // Update enquiry status
    await updateDoc(doc(db, COLLECTIONS.ENQUIRIES, input.enquiryId), {
      status: 'PROPOSAL_IN_PROGRESS',
      proposalCreatedAt: now,
      updatedAt: now,
      updatedBy: userId,
    });

    logger.info('Proposal created', { proposalId: docRef.id, proposalNumber });

    return { id: docRef.id, ...proposal };
  } catch (error) {
    logger.error('Error creating proposal', { error });
    throw error;
  }
}

/**
 * Get proposal by ID
 */
export async function getProposalById(db: Firestore, proposalId: string): Promise<Proposal | null> {
  try {
    const docSnap = await getDoc(doc(db, COLLECTIONS.PROPOSALS, proposalId));
    if (!docSnap.exists()) {
      logger.warn('Proposal not found', { proposalId });
      return null;
    }
    const proposalData = docSnap.data() as Omit<Proposal, 'id'>;
    const proposal: Proposal = { id: docSnap.id, ...proposalData };
    return proposal;
  } catch (error) {
    logger.error('Error fetching proposal', { proposalId, error });
    throw error;
  }
}

/**
 * Get proposal by number
 */
export async function getProposalByNumber(
  db: Firestore,
  proposalNumber: string,
  revision?: number
): Promise<Proposal | null> {
  try {
    let q = query(
      collection(db, COLLECTIONS.PROPOSALS),
      where('proposalNumber', '==', proposalNumber)
    );

    if (revision !== undefined) {
      q = query(q, where('revision', '==', revision));
    } else {
      // Get latest revision
      q = query(q, where('isLatestRevision', '==', true));
    }

    q = query(q, limit(1));

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const firstDoc = snapshot.docs[0];
    if (!firstDoc) {
      return null;
    }

    const proposalData = firstDoc.data() as Omit<Proposal, 'id'>;
    const proposal: Proposal = { id: firstDoc.id, ...proposalData };
    return proposal;
  } catch (error) {
    logger.error('Error fetching proposal by number', { proposalNumber, error });
    throw error;
  }
}

/**
 * List proposals with filters
 */
export async function listProposals(
  db: Firestore,
  options: ListProposalsOptions
): Promise<Proposal[]> {
  try {
    let q = query(collection(db, COLLECTIONS.PROPOSALS));

    // Entity filter (optional for Superadmin)
    if (options.entityId) {
      q = query(q, where('entityId', '==', options.entityId));
    }

    // Only latest revisions by default
    if (options.isLatestRevision !== false) {
      q = query(q, where('isLatestRevision', '==', true));
    }

    // Enquiry filter
    if (options.enquiryId) {
      q = query(q, where('enquiryId', '==', options.enquiryId));
    }

    // Status filter
    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      if (statuses.length > 0) {
        q = query(q, where('status', 'in', statuses));
      }
    }

    // Client filter
    if (options.clientId) {
      q = query(q, where('clientId', '==', options.clientId));
    }

    // Created by filter
    if (options.createdBy) {
      q = query(q, where('createdBy', '==', options.createdBy));
    }

    // Date range filter
    if (options.dateFrom) {
      q = query(q, where('createdAt', '>=', options.dateFrom));
    }
    if (options.dateTo) {
      q = query(q, where('createdAt', '<=', options.dateTo));
    }

    // Order by created date (most recent first)
    q = query(q, orderBy('createdAt', 'desc'));

    // Pagination
    if (options.startAfter) {
      const startDoc = await getDoc(doc(db, COLLECTIONS.PROPOSALS, options.startAfter));
      if (startDoc.exists()) {
        q = query(q, firestoreStartAfter(startDoc));
      }
    }

    if (options.limit) {
      q = query(q, limit(options.limit));
    }

    const snapshot = await getDocs(q);
    const proposals: Proposal[] = snapshot.docs.map((d) => docToTyped<Proposal>(d.id, d.data()));

    // Client-side search filter
    if (options.searchTerm) {
      const searchLower = options.searchTerm.toLowerCase();
      return proposals.filter(
        (p) =>
          p.proposalNumber.toLowerCase().includes(searchLower) ||
          p.title.toLowerCase().includes(searchLower) ||
          p.clientName.toLowerCase().includes(searchLower) ||
          p.enquiryNumber.toLowerCase().includes(searchLower)
      );
    }

    return proposals;
  } catch (error) {
    logger.error('Error listing proposals', { error });
    throw error;
  }
}

/**
 * Update proposal
 */
export async function updateProposal(
  db: Firestore,
  proposalId: string,
  input: UpdateProposalInput,
  userId: string
): Promise<void> {
  try {
    const updates: Record<string, unknown> = {
      ...input,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    // Remove undefined values before sending to Firestore (Firestore doesn't accept undefined)
    const cleanedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );

    await updateDoc(doc(db, COLLECTIONS.PROPOSALS, proposalId), cleanedUpdates);

    logger.info('Proposal updated', { proposalId });
  } catch (error) {
    logger.error('Error updating proposal', { proposalId, error });
    throw error;
  }
}

/**
 * Create proposal revision
 */
export async function createProposalRevision(
  db: Firestore,
  proposalId: string,
  revisionReason: string,
  userId: string
): Promise<Proposal> {
  try {
    // Get current proposal
    const currentProposal = await getProposalById(db, proposalId);
    if (!currentProposal) {
      throw new Error('Proposal not found');
    }

    // Use transaction to ensure atomicity
    const newProposal = await runTransaction(db, async (transaction) => {
      // Mark current proposal as not latest
      transaction.update(doc(db, COLLECTIONS.PROPOSALS, proposalId), {
        isLatestRevision: false,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      // Create new revision
      const now = Timestamp.now();
      const newRevision: Omit<Proposal, 'id'> = {
        ...currentProposal,
        revision: currentProposal.revision + 1,
        status: 'DRAFT',
        previousRevisionId: proposalId,
        revisionReason,
        submittedAt: undefined,
        submittedByUserId: undefined,
        submittedByUserName: undefined,
        acceptedAt: undefined,
        rejectedAt: undefined,
        rejectionReason: undefined,
        generatedPdfUrl: undefined,
        approvalHistory: [],
        updatedAt: now,
        updatedBy: userId,
        isLatestRevision: true,
      };

      // Remove undefined values before sending to Firestore (Firestore doesn't accept undefined)
      const cleanedRevision = Object.fromEntries(
        Object.entries(newRevision).filter(([, value]) => value !== undefined)
      );

      const docRef = doc(collection(db, COLLECTIONS.PROPOSALS));
      transaction.set(docRef, cleanedRevision);

      return { id: docRef.id, ...newRevision };
    });

    logger.info('Proposal revision created', {
      originalId: proposalId,
      newId: newProposal.id,
      revision: newProposal.revision,
    });

    return newProposal;
  } catch (error) {
    logger.error('Error creating proposal revision', { proposalId, error });
    throw error;
  }
}

/**
 * Submit proposal for approval
 */
export async function submitProposalForApproval(
  db: Firestore,
  proposalId: string,
  userId: string
): Promise<void> {
  try {
    await updateDoc(doc(db, COLLECTIONS.PROPOSALS, proposalId), {
      status: 'PENDING_APPROVAL',
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    logger.info('Proposal submitted for approval', { proposalId });
  } catch (error) {
    logger.error('Error submitting proposal for approval', { proposalId, error });
    throw error;
  }
}

// NOTE: recordApprovalAction, submitProposalToClient, acceptProposal, and rejectProposal
// were removed as dead code - they duplicated functionality in
// @/lib/proposals/approvalWorkflow.ts which is the actual implementation used

/**
 * Get all revisions of a proposal
 */
export async function getProposalRevisions(
  db: Firestore,
  proposalNumber: string
): Promise<Proposal[]> {
  try {
    const q = query(
      collection(db, COLLECTIONS.PROPOSALS),
      where('proposalNumber', '==', proposalNumber),
      orderBy('revision', 'desc')
    );

    const snapshot = await getDocs(q);
    const proposals: Proposal[] = snapshot.docs.map((d) => docToTyped<Proposal>(d.id, d.data()));
    return proposals;
  } catch (error) {
    logger.error('Error fetching proposal revisions', { proposalNumber, error });
    throw error;
  }
}

/**
 * Get proposals count by status (for dashboard)
 */
export async function getProposalsCountByStatus(
  db: Firestore,
  entityId: string
): Promise<Record<ProposalStatus, number>> {
  try {
    const q = query(
      collection(db, COLLECTIONS.PROPOSALS),
      where('entityId', '==', entityId),
      where('isLatestRevision', '==', true)
    );
    const snapshot = await getDocs(q);

    const counts: Record<string, number> = {};
    snapshot.docs.forEach((doc) => {
      const status = doc.data().status as ProposalStatus;
      counts[status] = (counts[status] || 0) + 1;
    });

    return counts as Record<ProposalStatus, number>;
  } catch (error) {
    logger.error('Error getting proposal counts', { error });
    throw error;
  }
}
