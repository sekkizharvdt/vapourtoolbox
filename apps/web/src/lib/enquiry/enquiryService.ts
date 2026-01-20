/**
 * Enquiry Service
 * Handles CRUD operations for enquiries
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
} from 'firebase/firestore';
import { createLogger } from '@vapour/logger';
import { docToTyped, removeUndefinedValues } from '@/lib/firebase/typeHelpers';
import type {
  Enquiry,
  CreateEnquiryInput,
  UpdateEnquiryInput,
  ListEnquiriesOptions,
  EnquiryStatus,
  EnquiryDocument,
  BidDecision,
  BidEvaluationCriteria,
  BidDecisionRecord,
} from '@vapour/types';
import { PermissionFlag } from '@vapour/types';
import { ref, uploadBytes, getDownloadURL, deleteObject, FirebaseStorage } from 'firebase/storage';
import { requireOwnerOrPermission } from '@/lib/auth';

const logger = createLogger({ context: 'enquiryService' });

const COLLECTIONS = {
  ENQUIRIES: 'enquiries',
  ENTITIES: 'entities',
  PROPOSALS: 'proposals',
};

/**
 * Generate next enquiry number: ENQ-YY-NN
 * Format: ENQ-25-01, ENQ-25-02, etc.
 */
async function generateEnquiryNumber(db: Firestore): Promise<string> {
  const year = new Date().getFullYear();
  const twoDigitYear = year.toString().slice(-2); // Get last 2 digits
  const prefix = `ENQ-${twoDigitYear}-`;

  const q = query(
    collection(db, COLLECTIONS.ENQUIRIES),
    where('enquiryNumber', '>=', prefix),
    where('enquiryNumber', '<', `ENQ-${(parseInt(twoDigitYear) + 1).toString().padStart(2, '0')}-`),
    orderBy('enquiryNumber', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);
  let nextNumber = 1;

  if (!snapshot.empty) {
    const firstDoc = snapshot.docs[0];
    if (firstDoc) {
      const lastEnquiryNumber = firstDoc.data().enquiryNumber as string;
      if (lastEnquiryNumber) {
        const parts = lastEnquiryNumber.split('-');
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
 * Create new enquiry
 */
export async function createEnquiry(
  db: Firestore,
  input: CreateEnquiryInput,
  userId: string
): Promise<Enquiry> {
  try {
    // Get client details
    const clientDoc = await getDoc(doc(db, COLLECTIONS.ENTITIES, input.clientId));
    if (!clientDoc.exists()) {
      throw new Error('Client not found');
    }
    const client = clientDoc.data();

    // Generate enquiry number
    const enquiryNumber = await generateEnquiryNumber(db);

    const now = Timestamp.now();
    const enquiry: Omit<Enquiry, 'id'> = {
      enquiryNumber,
      entityId: input.entityId,
      clientId: input.clientId,
      clientName: client.name || '',
      clientContactPerson: input.clientContactPerson,
      clientEmail: input.clientEmail,
      clientPhone: input.clientPhone,
      clientReferenceNumber: input.clientReferenceNumber,
      title: input.title,
      description: input.description,
      receivedDate: input.receivedDate,
      receivedVia: input.receivedVia,
      referenceSource: input.referenceSource,
      projectType: input.projectType,
      industry: input.industry,
      location: input.location,
      urgency: input.urgency,
      estimatedBudget: input.estimatedBudget,
      status: 'NEW',
      assignedToUserId: input.assignedToUserId,
      assignedToUserName: undefined, // Can be populated separately via user lookup
      attachedDocuments: [],
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    };

    // Remove undefined values before sending to Firestore (Firestore doesn't accept undefined)
    const cleanedEnquiry = Object.fromEntries(
      Object.entries(enquiry).filter(([, value]) => value !== undefined)
    );

    const docRef = await addDoc(collection(db, COLLECTIONS.ENQUIRIES), cleanedEnquiry);

    logger.info('Enquiry created', { enquiryId: docRef.id, enquiryNumber });

    return { id: docRef.id, ...enquiry };
  } catch (error) {
    logger.error('Error creating enquiry', { error });
    throw error;
  }
}

/**
 * Get enquiry by ID
 */
export async function getEnquiryById(db: Firestore, enquiryId: string): Promise<Enquiry | null> {
  try {
    const docSnap = await getDoc(doc(db, COLLECTIONS.ENQUIRIES, enquiryId));
    if (!docSnap.exists()) {
      logger.warn('Enquiry not found', { enquiryId });
      return null;
    }
    const enquiry = { id: docSnap.id, ...docSnap.data() } as Enquiry;
    return enquiry;
  } catch (error) {
    logger.error('Error fetching enquiry', { enquiryId, error });
    throw error;
  }
}

/**
 * Get enquiry by number
 */
export async function getEnquiryByNumber(
  db: Firestore,
  enquiryNumber: string
): Promise<Enquiry | null> {
  try {
    const q = query(
      collection(db, COLLECTIONS.ENQUIRIES),
      where('enquiryNumber', '==', enquiryNumber),
      limit(1)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const firstDoc = snapshot.docs[0];
    if (!firstDoc) {
      return null;
    }

    const enquiry = { id: firstDoc.id, ...firstDoc.data() } as Enquiry;
    return enquiry;
  } catch (error) {
    logger.error('Error fetching enquiry by number', { enquiryNumber, error });
    throw error;
  }
}

/**
 * List enquiries with filters
 */
export async function listEnquiries(
  db: Firestore,
  options: ListEnquiriesOptions
): Promise<Enquiry[]> {
  try {
    let q = query(collection(db, COLLECTIONS.ENQUIRIES), where('entityId', '==', options.entityId));

    // Status filter
    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      if (statuses.length > 0) {
        q = query(q, where('status', 'in', statuses));
      }
    }

    // Assigned user filter
    if (options.assignedToUserId) {
      q = query(q, where('assignedToUserId', '==', options.assignedToUserId));
    }

    // Client filter
    if (options.clientId) {
      q = query(q, where('clientId', '==', options.clientId));
    }

    // Urgency filter
    if (options.urgency) {
      q = query(q, where('urgency', '==', options.urgency));
    }

    // Date range filter
    if (options.dateFrom) {
      q = query(q, where('receivedDate', '>=', options.dateFrom));
    }
    if (options.dateTo) {
      q = query(q, where('receivedDate', '<=', options.dateTo));
    }

    // Order by created date (most recent first)
    q = query(q, orderBy('createdAt', 'desc'));

    // Pagination
    if (options.startAfter) {
      const startDoc = await getDoc(doc(db, COLLECTIONS.ENQUIRIES, options.startAfter));
      if (startDoc.exists()) {
        q = query(q, firestoreStartAfter(startDoc));
      }
    }

    if (options.limit) {
      q = query(q, limit(options.limit));
    }

    const snapshot = await getDocs(q);
    const enquiries: Enquiry[] = snapshot.docs.map((d) => docToTyped<Enquiry>(d.id, d.data()));

    // Client-side search filter (for search term)
    if (options.searchTerm) {
      const searchLower = options.searchTerm.toLowerCase();
      return enquiries.filter(
        (e) =>
          e.enquiryNumber.toLowerCase().includes(searchLower) ||
          e.title.toLowerCase().includes(searchLower) ||
          e.clientName.toLowerCase().includes(searchLower) ||
          e.description.toLowerCase().includes(searchLower)
      );
    }

    return enquiries;
  } catch (error) {
    logger.error('Error listing enquiries', { error });
    throw error;
  }
}

/**
 * Update enquiry
 */
export async function updateEnquiry(
  db: Firestore,
  enquiryId: string,
  input: UpdateEnquiryInput,
  userId: string
): Promise<void> {
  try {
    // Remove undefined values - Firestore doesn't accept them
    const updates = removeUndefinedValues({
      ...input,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    await updateDoc(doc(db, COLLECTIONS.ENQUIRIES, enquiryId), updates);

    logger.info('Enquiry updated', { enquiryId });
  } catch (error) {
    logger.error('Error updating enquiry', { enquiryId, error });
    throw error;
  }
}

/**
 * Update enquiry status
 */
export async function updateEnquiryStatus(
  db: Firestore,
  enquiryId: string,
  status: EnquiryStatus,
  userId: string,
  outcomeReason?: string
): Promise<void> {
  try {
    const updates: Record<string, unknown> = {
      status,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    // Track outcome for terminal statuses
    if (['WON', 'LOST', 'CANCELLED'].includes(status)) {
      updates.outcomeDate = Timestamp.now();
      if (outcomeReason) {
        updates.outcomeReason = outcomeReason;
      }
    }

    // Track proposal submission
    if (status === 'PROPOSAL_SUBMITTED') {
      updates.proposalSubmittedAt = Timestamp.now();
    }

    await updateDoc(doc(db, COLLECTIONS.ENQUIRIES, enquiryId), updates);

    logger.info('Enquiry status updated', { enquiryId, status });
  } catch (error) {
    logger.error('Error updating enquiry status', { enquiryId, status, error });
    throw error;
  }
}

/**
 * Mark enquiry as proposal created
 */
export async function markProposalCreated(
  db: Firestore,
  enquiryId: string,
  userId: string
): Promise<void> {
  try {
    await updateDoc(doc(db, COLLECTIONS.ENQUIRIES, enquiryId), {
      status: 'PROPOSAL_IN_PROGRESS',
      proposalCreatedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    logger.info('Enquiry marked as proposal created', { enquiryId });
  } catch (error) {
    logger.error('Error marking proposal created', { enquiryId, error });
    throw error;
  }
}

/**
 * Delete enquiry (soft delete by setting status to CANCELLED)
 *
 * Authorization: User must be the creator OR have MANAGE_ENTITIES permission
 *
 * @param db - Firestore instance
 * @param enquiryId - Enquiry ID to delete
 * @param userId - User performing the deletion
 * @param userPermissions - User's permission flags
 */
export async function deleteEnquiry(
  db: Firestore,
  enquiryId: string,
  userId: string,
  userPermissions: number
): Promise<void> {
  try {
    // Get enquiry to check ownership
    const enquiry = await getEnquiryById(db, enquiryId);
    if (!enquiry) {
      throw new Error('Enquiry not found');
    }

    // Authorization: Require ownership or MANAGE_ENTITIES permission
    requireOwnerOrPermission(
      userId,
      enquiry.createdBy,
      userPermissions,
      PermissionFlag.MANAGE_ENTITIES,
      'delete enquiry'
    );

    await updateEnquiryStatus(db, enquiryId, 'CANCELLED', userId, 'Deleted by user');
    logger.info('Enquiry deleted (soft)', { enquiryId });
  } catch (error) {
    logger.error('Error deleting enquiry', { enquiryId, error });
    throw error;
  }
}

/**
 * Get enquiries count by status (for dashboard)
 */
export async function getEnquiriesCountByStatus(
  db: Firestore,
  entityId: string
): Promise<Record<EnquiryStatus, number>> {
  try {
    const q = query(collection(db, COLLECTIONS.ENQUIRIES), where('entityId', '==', entityId));
    const snapshot = await getDocs(q);

    const counts: Record<string, number> = {};
    snapshot.docs.forEach((doc) => {
      const status = doc.data().status as EnquiryStatus;
      counts[status] = (counts[status] || 0) + 1;
    });

    return counts as Record<EnquiryStatus, number>;
  } catch (error) {
    logger.error('Error getting enquiry counts', { error });
    throw error;
  }
}

/**
 * Upload enquiry document
 */
export async function uploadEnquiryDocument(
  db: Firestore,
  storage: FirebaseStorage,
  enquiryId: string,
  file: File,
  userId: string
): Promise<EnquiryDocument> {
  try {
    // 1. Upload file to Storage
    const fileName = `${Date.now()}_${file.name}`;
    const storagePath = `enquiries/${enquiryId}/${fileName}`;
    const storageRef = ref(storage, storagePath);

    const snapshot = await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(snapshot.ref);

    // 2. Create document object
    const document: EnquiryDocument = {
      id: fileName, // Use filename as ID for simplicity
      fileName: file.name,
      fileUrl: downloadUrl,
      fileSize: file.size,
      fileType: file.type,
      uploadedAt: Timestamp.now(),
      uploadedBy: userId,
    };

    // 3. Update enquiry document
    const enquiryRef = doc(db, COLLECTIONS.ENQUIRIES, enquiryId);
    const enquiryDoc = await getDoc(enquiryRef);

    if (!enquiryDoc.exists()) {
      throw new Error('Enquiry not found');
    }

    const currentDocs = (enquiryDoc.data().attachedDocuments as EnquiryDocument[]) || [];

    await updateDoc(enquiryRef, {
      attachedDocuments: [...currentDocs, document],
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    logger.info('Enquiry document uploaded', { enquiryId, fileName });
    return document;
  } catch (error) {
    logger.error('Error uploading enquiry document', { enquiryId, error });
    throw error;
  }
}

/**
 * Record bid/no-bid decision for an enquiry
 *
 * @param db - Firestore instance
 * @param enquiryId - Enquiry ID
 * @param decision - BID or NO_BID
 * @param evaluation - Evaluation criteria ratings
 * @param rationale - Decision rationale text
 * @param userId - User making the decision
 * @param userName - User's display name (denormalized)
 * @returns Updated enquiry
 */
export async function recordBidDecision(
  db: Firestore,
  enquiryId: string,
  decision: BidDecision,
  evaluation: BidEvaluationCriteria,
  rationale: string,
  userId: string,
  userName: string
): Promise<Enquiry> {
  try {
    // Get current enquiry
    const enquiry = await getEnquiryById(db, enquiryId);
    if (!enquiry) {
      throw new Error('Enquiry not found');
    }

    // Validate current status allows bid decision
    const allowedStatuses: EnquiryStatus[] = ['NEW', 'UNDER_REVIEW', 'BID_DECISION_PENDING'];
    if (!allowedStatuses.includes(enquiry.status)) {
      throw new Error(
        `Cannot record bid decision for enquiry in ${enquiry.status} status. ` +
          `Allowed statuses: ${allowedStatuses.join(', ')}`
      );
    }

    // Clean evaluation to remove undefined notes
    const cleanedEvaluation: BidEvaluationCriteria = {
      strategicAlignment: {
        rating: evaluation.strategicAlignment.rating,
        ...(evaluation.strategicAlignment.notes && { notes: evaluation.strategicAlignment.notes }),
      },
      winProbability: {
        rating: evaluation.winProbability.rating,
        ...(evaluation.winProbability.notes && { notes: evaluation.winProbability.notes }),
      },
      commercialViability: {
        rating: evaluation.commercialViability.rating,
        ...(evaluation.commercialViability.notes && { notes: evaluation.commercialViability.notes }),
      },
      riskExposure: {
        rating: evaluation.riskExposure.rating,
        ...(evaluation.riskExposure.notes && { notes: evaluation.riskExposure.notes }),
      },
      capacityCapability: {
        rating: evaluation.capacityCapability.rating,
        ...(evaluation.capacityCapability.notes && { notes: evaluation.capacityCapability.notes }),
      },
    };

    const bidDecisionRecord: BidDecisionRecord = {
      decision,
      evaluation: cleanedEvaluation,
      rationale,
      decidedBy: userId,
      decidedByName: userName,
      decidedAt: Timestamp.now(),
    };

    // Determine new status based on decision
    const newStatus: EnquiryStatus = decision === 'BID' ? 'PROPOSAL_IN_PROGRESS' : 'NO_BID';

    const updates = {
      bidDecision: bidDecisionRecord,
      status: newStatus,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
      // For NO_BID, also set outcome tracking
      ...(decision === 'NO_BID' && {
        outcomeDate: Timestamp.now(),
        outcomeReason: `No Bid Decision: ${rationale}`,
      }),
    };

    await updateDoc(doc(db, COLLECTIONS.ENQUIRIES, enquiryId), updates);

    logger.info('Bid decision recorded', {
      enquiryId,
      decision,
      newStatus,
      userId,
    });

    // Return updated enquiry
    return {
      ...enquiry,
      bidDecision: bidDecisionRecord,
      status: newStatus,
      ...(decision === 'NO_BID' && {
        outcomeDate: Timestamp.now(),
        outcomeReason: `No Bid Decision: ${rationale}`,
      }),
    };
  } catch (error) {
    logger.error('Error recording bid decision', { enquiryId, decision, error });
    throw error;
  }
}

/**
 * Revise an existing bid decision
 *
 * Allows changing a bid decision before a proposal is created.
 * Cannot revise if proposal already exists or enquiry is in terminal state.
 *
 * @param db - Firestore instance
 * @param enquiryId - ID of the enquiry
 * @param decision - New BID or NO_BID decision
 * @param evaluation - New evaluation criteria
 * @param rationale - New decision rationale text
 * @param userId - User making the revision
 * @param userName - User's display name (denormalized)
 * @returns Updated enquiry
 */
export async function reviseBidDecision(
  db: Firestore,
  enquiryId: string,
  decision: BidDecision,
  evaluation: BidEvaluationCriteria,
  rationale: string,
  userId: string,
  userName: string
): Promise<Enquiry> {
  try {
    // Get current enquiry
    const enquiry = await getEnquiryById(db, enquiryId);
    if (!enquiry) {
      throw new Error('Enquiry not found');
    }

    // Must have an existing bid decision to revise
    if (!enquiry.bidDecision) {
      throw new Error('No existing bid decision to revise');
    }

    // Cannot revise if in terminal state
    const terminalStatuses: EnquiryStatus[] = ['WON', 'LOST', 'CANCELLED'];
    if (terminalStatuses.includes(enquiry.status)) {
      throw new Error(
        `Cannot revise bid decision for enquiry in ${enquiry.status} status`
      );
    }

    // Check if a proposal already exists for this enquiry
    const proposalsRef = collection(db, COLLECTIONS.PROPOSALS);
    const proposalQuery = query(proposalsRef, where('enquiryId', '==', enquiryId));
    const proposalSnapshot = await getDocs(proposalQuery);

    if (!proposalSnapshot.empty) {
      throw new Error(
        'Cannot revise bid decision after a proposal has been created. Please void or delete the proposal first.'
      );
    }

    // Store previous decision for audit trail
    const previousDecision = enquiry.bidDecision;

    // Clean evaluation to remove undefined notes
    const cleanedEvaluation: BidEvaluationCriteria = {
      strategicAlignment: {
        rating: evaluation.strategicAlignment.rating,
        ...(evaluation.strategicAlignment.notes && { notes: evaluation.strategicAlignment.notes }),
      },
      winProbability: {
        rating: evaluation.winProbability.rating,
        ...(evaluation.winProbability.notes && { notes: evaluation.winProbability.notes }),
      },
      commercialViability: {
        rating: evaluation.commercialViability.rating,
        ...(evaluation.commercialViability.notes && { notes: evaluation.commercialViability.notes }),
      },
      riskExposure: {
        rating: evaluation.riskExposure.rating,
        ...(evaluation.riskExposure.notes && { notes: evaluation.riskExposure.notes }),
      },
      capacityCapability: {
        rating: evaluation.capacityCapability.rating,
        ...(evaluation.capacityCapability.notes && { notes: evaluation.capacityCapability.notes }),
      },
    };

    const bidDecisionRecord: BidDecisionRecord = {
      decision,
      evaluation: cleanedEvaluation,
      rationale,
      decidedBy: userId,
      decidedByName: userName,
      decidedAt: Timestamp.now(),
      // Track revision history
      previousDecision: {
        decision: previousDecision.decision,
        decidedBy: previousDecision.decidedBy,
        decidedByName: previousDecision.decidedByName,
        decidedAt: previousDecision.decidedAt,
        rationale: previousDecision.rationale,
      },
    };

    // Determine new status based on decision
    const newStatus: EnquiryStatus = decision === 'BID' ? 'PROPOSAL_IN_PROGRESS' : 'NO_BID';

    const updates: Record<string, unknown> = {
      bidDecision: bidDecisionRecord,
      status: newStatus,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    // For NO_BID, also set outcome tracking
    if (decision === 'NO_BID') {
      updates.outcomeDate = Timestamp.now();
      updates.outcomeReason = `No Bid Decision (Revised): ${rationale}`;
    } else {
      // If changing from NO_BID to BID, clear outcome fields
      updates.outcomeDate = null;
      updates.outcomeReason = null;
    }

    await updateDoc(doc(db, COLLECTIONS.ENQUIRIES, enquiryId), updates);

    logger.info('Bid decision revised', {
      enquiryId,
      previousDecision: previousDecision.decision,
      newDecision: decision,
      newStatus,
      userId,
    });

    // Return updated enquiry
    return {
      ...enquiry,
      bidDecision: bidDecisionRecord,
      status: newStatus,
      ...(decision === 'NO_BID' && {
        outcomeDate: Timestamp.now(),
        outcomeReason: `No Bid Decision (Revised): ${rationale}`,
      }),
    };
  } catch (error) {
    logger.error('Error revising bid decision', { enquiryId, decision, error });
    throw error;
  }
}

/**
 * Delete enquiry document
 */
export async function deleteEnquiryDocument(
  db: Firestore,
  storage: FirebaseStorage,
  enquiryId: string,
  documentId: string,
  userId: string
): Promise<void> {
  try {
    // 1. Get enquiry to find file path
    const enquiryRef = doc(db, COLLECTIONS.ENQUIRIES, enquiryId);
    const enquiryDoc = await getDoc(enquiryRef);

    if (!enquiryDoc.exists()) {
      throw new Error('Enquiry not found');
    }

    const currentDocs = (enquiryDoc.data().attachedDocuments as EnquiryDocument[]) || [];
    const docToDelete = currentDocs.find((d) => d.id === documentId);

    if (!docToDelete) {
      throw new Error('Document not found');
    }

    // 2. Delete from Storage
    // Assuming ID is the filename as set in upload
    const storagePath = `enquiries/${enquiryId}/${docToDelete.id}`;
    const storageRef = ref(storage, storagePath);

    try {
      await deleteObject(storageRef);
    } catch {
      logger.warn('File not found in storage, removing from db only', { storagePath });
    }

    // 3. Update enquiry document
    const updatedDocs = currentDocs.filter((d) => d.id !== documentId);

    await updateDoc(enquiryRef, {
      attachedDocuments: updatedDocs,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    logger.info('Enquiry document deleted', { enquiryId, documentId });
  } catch (error) {
    logger.error('Error deleting enquiry document', { enquiryId, documentId, error });
    throw error;
  }
}
