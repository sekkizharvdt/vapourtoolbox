/**
 * Proposal Revision Management Service
 *
 * Handles creating new revisions of proposals while preserving history.
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import type { Proposal } from '@vapour/types';

const logger = createLogger({ context: 'proposalRevision' });

/**
 * Create new revision of proposal
 *
 * Copies current proposal and increments revision number.
 * Original proposal is preserved for history.
 */
export async function createProposalRevision(
  db: Firestore,
  proposalId: string,
  userId: string,
  _userName: string,
  revisionReason?: string
): Promise<string> {
  try {
    logger.info('Creating proposal revision', { proposalId, userId });

    // Get current proposal
    const proposalRef = doc(db, COLLECTIONS.PROPOSALS, proposalId);
    const proposalSnap = await getDoc(proposalRef);

    if (!proposalSnap.exists()) {
      throw new Error('Proposal not found');
    }

    const proposalData = proposalSnap.data() as Omit<Proposal, 'id'>;
    const currentProposal: Proposal = {
      id: proposalSnap.id,
      ...proposalData,
    };

    // Create new revision
    const newRevision: Omit<Proposal, 'id'> = {
      ...currentProposal,
      revision: currentProposal.revision + 1,
      status: 'DRAFT',
      submittedAt: undefined,
      submittedByUserId: undefined,
      submittedByUserName: undefined,
      approvalHistory: [],
      revisionReason,
      previousRevisionId: currentProposal.id,
      createdAt: Timestamp.now(),
      createdBy: userId,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    // Remove undefined values before sending to Firestore
    const cleanedRevision = Object.fromEntries(
      Object.entries(newRevision).filter(([, value]) => value !== undefined)
    );

    // Add new revision document
    const newRevisionRef = await addDoc(collection(db, COLLECTIONS.PROPOSALS), cleanedRevision);

    logger.info('Proposal revision created', {
      originalId: proposalId,
      newId: newRevisionRef.id,
      revision: newRevision.revision,
    });

    return newRevisionRef.id;
  } catch (error) {
    logger.error('Error creating proposal revision', { proposalId, error });
    throw error;
  }
}

/**
 * Get all revisions of a proposal
 *
 * Returns all revisions ordered by revision number
 */
export async function getProposalRevisions(
  db: Firestore,
  proposalNumber: string
): Promise<Proposal[]> {
  try {
    const revisionsQuery = query(
      collection(db, COLLECTIONS.PROPOSALS),
      where('proposalNumber', '==', proposalNumber),
      orderBy('revision', 'desc')
    );

    const snapshot = await getDocs(revisionsQuery);
    const revisions: Proposal[] = [];

    snapshot.forEach((doc) => {
      revisions.push(docToTyped<Proposal>(doc.id, doc.data()));
    });

    logger.info('Fetched proposal revisions', {
      proposalNumber,
      count: revisions.length,
    });

    return revisions;
  } catch (error) {
    logger.error('Error fetching proposal revisions', { proposalNumber, error });
    throw error;
  }
}

/**
 * Get latest revision of a proposal
 *
 * Returns the most recent revision by revision number
 */
export async function getLatestRevision(
  db: Firestore,
  proposalNumber: string
): Promise<Proposal | null> {
  try {
    const revisions = await getProposalRevisions(db, proposalNumber);
    return revisions.length > 0 ? revisions[0]! : null;
  } catch (error) {
    logger.error('Error fetching latest revision', { proposalNumber, error });
    throw error;
  }
}

/**
 * Compare two proposal revisions
 *
 * Returns changes between revisions
 */
export function compareRevisions(
  oldRevision: Proposal,
  newRevision: Proposal
): {
  pricingChanged: boolean;
  scopeChanged: boolean;
  termsChanged: boolean;
  deliveryChanged: boolean;
  changes: string[];
} {
  const changes: string[] = [];

  // Check pricing changes
  const pricingChanged =
    oldRevision.pricing.totalAmount.amount !== newRevision.pricing.totalAmount.amount;
  if (pricingChanged) {
    changes.push(
      `Total amount changed from ${oldRevision.pricing.totalAmount.amount} to ${newRevision.pricing.totalAmount.amount}`
    );
  }

  // Check scope of supply changes
  const scopeChanged =
    JSON.stringify(oldRevision.scopeOfSupply) !== JSON.stringify(newRevision.scopeOfSupply);
  if (scopeChanged) {
    changes.push('Scope of supply modified');
  }

  // Check terms changes
  const termsChanged = JSON.stringify(oldRevision.terms) !== JSON.stringify(newRevision.terms);
  if (termsChanged) {
    changes.push('Terms and conditions updated');
  }

  // Check delivery changes
  const deliveryChanged =
    JSON.stringify(oldRevision.deliveryPeriod) !== JSON.stringify(newRevision.deliveryPeriod);
  if (deliveryChanged) {
    changes.push('Delivery schedule modified');
  }

  return {
    pricingChanged,
    scopeChanged,
    termsChanged,
    deliveryChanged,
    changes,
  };
}
