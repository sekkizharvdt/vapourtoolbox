/**
 * Document Transmittal Service
 *
 * Handles transmittal operations:
 * - Creating transmittals
 * - Querying transmittals
 * - Generating transmittal numbers
 * - Managing transmittal lifecycle
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  runTransaction,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import type {
  DocumentTransmittal,
  TransmittalDeliveryMethod,
  TransmittalStatus,
  MasterDocumentEntry,
  MasterDocumentStatus,
} from '@vapour/types';
import { masterDocumentStateMachine } from '@/lib/workflow/stateMachines';

/** Counter doc key for a project's transmittal sequence (in the shared `counters` collection). */
function transmittalCounterKey(projectId: string): string {
  return `transmittal-${projectId}`;
}

/**
 * Highest transmittal sequence number currently used by a project, by scanning
 * existing docs. Used ONLY to seed the atomic counter the first time (legacy
 * transmittals created before the counter existed). Client-SDK transactions
 * cannot run queries, so this one-time scan happens outside the transaction.
 */
async function getMaxTransmittalSequence(db: Firestore, projectId: string): Promise<number> {
  const transmittalsRef = collection(db, 'projects', projectId, 'transmittals');
  const snapshot = await getDocs(query(transmittalsRef, orderBy('transmittalNumber', 'desc')));
  for (const d of snapshot.docs) {
    const match = (d.data() as DocumentTransmittal).transmittalNumber?.match(/TR-(\d+)/);
    if (match?.[1]) return parseInt(match[1], 10);
  }
  return 0;
}

/**
 * Generate the next transmittal number for a project.
 * Format: TR-001, TR-002, etc.
 *
 * NOTE: standalone use is racy (two callers read the same max). Prefer
 * createTransmittal(), which allocates the number and writes the doc atomically.
 * Retained for callers that only need a preview.
 */
export async function generateTransmittalNumber(db: Firestore, projectId: string): Promise<string> {
  const next = (await getMaxTransmittalSequence(db, projectId)) + 1;
  return `TR-${next.toString().padStart(3, '0')}`;
}

/**
 * Create a new transmittal
 */
export interface CreateTransmittalData {
  projectId: string;
  projectName: string;
  clientName: string;
  clientContact?: string;
  recipientEmail?: string;
  documentIds: string[];
  subject?: string;
  coverNotes?: string;
  purposeOfIssue?: string;
  deliveryMethod?: TransmittalDeliveryMethod;
  createdBy: string;
  createdByName: string;
}

export async function createTransmittal(
  db: Firestore,
  data: CreateTransmittalData
): Promise<string> {
  // rule8-exempt: sets the initial status on a brand-new document (no prior state to transition from) — state-machine validation only applies to transitions, not first-write
  // rule5-exempt: firestore.rules enforce per-collection permission (VIEW/MANAGE flags + project-scoped checks); client-side requirePermission is defense-in-depth deferred to future hardening
  const transmittalsRef = collection(db, 'projects', data.projectId, 'transmittals');
  const newDocRef = doc(transmittalsRef); // pre-generate id so we can set() inside the tx
  const counterRef = doc(db, COLLECTIONS.COUNTERS, transmittalCounterKey(data.projectId));

  // One-time seed of the counter from existing docs. Queries aren't allowed inside
  // a client transaction, so read the current max here; the transaction only
  // consumes it when the counter doc doesn't exist yet.
  const counterSnap = await getDoc(counterRef);
  const seedValue = counterSnap.exists()
    ? null
    : await getMaxTransmittalSequence(db, data.projectId);

  const now = Timestamp.now();

  // Allocate the sequence number and write the transmittal atomically so two
  // concurrent creates can never receive the same TR-NNN.
  await runTransaction(db, async (tx) => {
    const cSnap = await tx.get(counterRef);
    let sequence: number;
    if (cSnap.exists()) {
      sequence = (cSnap.data().value || 0) + 1;
      tx.update(counterRef, { value: sequence, updatedAt: now });
    } else {
      sequence = (seedValue ?? 0) + 1;
      tx.set(counterRef, {
        type: 'transmittal',
        projectId: data.projectId,
        value: sequence,
        createdAt: now,
        updatedAt: now,
      });
    }

    const transmittalNumber = `TR-${sequence.toString().padStart(3, '0')}`;
    const transmittal: Omit<DocumentTransmittal, 'id'> = {
      projectId: data.projectId,
      projectName: data.projectName,
      transmittalNumber,
      transmittalDate: now,
      status: 'DRAFT',
      clientName: data.clientName,
      ...(data.clientContact !== undefined && { clientContact: data.clientContact }),
      ...(data.recipientEmail !== undefined && { recipientEmail: data.recipientEmail }),
      documentIds: data.documentIds,
      documentCount: data.documentIds.length,
      ...(data.subject !== undefined && { subject: data.subject }),
      ...(data.coverNotes !== undefined && { coverNotes: data.coverNotes }),
      ...(data.purposeOfIssue !== undefined && { purposeOfIssue: data.purposeOfIssue }),
      ...(data.deliveryMethod !== undefined && { deliveryMethod: data.deliveryMethod }),
      createdBy: data.createdBy,
      createdByName: data.createdByName,
      createdAt: now,
      updatedAt: now,
    };
    tx.set(newDocRef, transmittal);
  });

  return newDocRef.id;
}

export interface TransmittalListResult {
  transmittals: DocumentTransmittal[];
  hasMore: boolean;
}

/**
 * Get transmittals for a project with pagination
 */
export async function getProjectTransmittals(
  db: Firestore,
  projectId: string,
  limitResults: number = 50
): Promise<TransmittalListResult> {
  const transmittalsRef = collection(db, 'projects', projectId, 'transmittals');
  const q = query(transmittalsRef, orderBy('transmittalDate', 'desc'), limit(limitResults + 1));

  const snapshot = await getDocs(q);
  const transmittals: DocumentTransmittal[] = [];

  snapshot.docs.slice(0, limitResults).forEach((doc) => {
    transmittals.push(docToTyped<DocumentTransmittal>(doc.id, doc.data()));
  });

  return {
    transmittals,
    hasMore: snapshot.size > limitResults,
  };
}

/**
 * Get a single transmittal by ID
 */
export async function getTransmittal(
  db: Firestore,
  projectId: string,
  transmittalId: string
): Promise<DocumentTransmittal | null> {
  const transmittalRef = doc(db, 'projects', projectId, 'transmittals', transmittalId);
  const snapshot = await getDoc(transmittalRef);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() as Omit<DocumentTransmittal, 'id'>;
  const transmittal: DocumentTransmittal = {
    ...data,
    id: snapshot.id,
  };
  return transmittal;
}

/**
 * Update transmittal status
 */
export async function updateTransmittalStatus(
  db: Firestore,
  projectId: string,
  transmittalId: string,
  status: TransmittalStatus,
  additionalData?: Partial<DocumentTransmittal>
): Promise<void> {
  // rule8-exempt: sync / mark / status-update helper invoked by the upstream workflow that already validated the transition
  // rule5-exempt: firestore.rules enforce per-collection permission (VIEW/MANAGE flags + project-scoped checks); client-side requirePermission is defense-in-depth deferred to future hardening
  const transmittalRef = doc(db, 'projects', projectId, 'transmittals', transmittalId);

  const updates: Partial<DocumentTransmittal> = {
    status,
    updatedAt: Timestamp.now(),
    ...additionalData,
  };

  // Set sentAt timestamp when status changes to SENT
  if (status === 'SENT' && !additionalData?.sentAt) {
    updates.sentAt = Timestamp.now();
  }

  await updateDoc(transmittalRef, updates as Record<string, unknown>);
}

/**
 * Update transmittal with PDF and ZIP file URLs
 */
export async function updateTransmittalFiles(
  db: Firestore,
  projectId: string,
  transmittalId: string,
  files: {
    // rule8-exempt: edit on existing doc fields; the touched status field (if any) reflects derived child state, not a parent state-machine transition
    // rule5-exempt: firestore.rules enforce per-collection permission (VIEW/MANAGE flags + project-scoped checks); client-side requirePermission deferred to future hardening
    transmittalPdfUrl?: string;
    transmittalPdfId?: string;
    zipFileUrl?: string;
    zipFileSize?: number;
  }
): Promise<void> {
  // rule8-exempt: edit on existing doc fields; the touched status field (if any) reflects derived child state, not a parent state-machine transition
  // rule5-exempt: firestore.rules enforce per-collection permission (VIEW/MANAGE flags + project-scoped checks); client-side requirePermission deferred to future hardening
  const transmittalRef = doc(db, 'projects', projectId, 'transmittals', transmittalId);

  await updateDoc(transmittalRef, {
    ...files,
    status: 'GENERATED',
    updatedAt: Timestamp.now(),
  } as Record<string, unknown>);

  // Auto-transition: mark included documents as SUBMITTED
  const transmittal = await getTransmittal(db, projectId, transmittalId);
  if (transmittal?.documentIds?.length) {
    await markTransmittalDocumentsAsSubmitted(db, projectId, transmittal.documentIds);
  }
}

/**
 * Mark documents included in a transmittal as SUBMITTED.
 *
 * Only transitions documents whose current status allows moving to SUBMITTED
 * (e.g., IN_PROGRESS → SUBMITTED). Documents already in SUBMITTED or a later
 * state are left unchanged. Uses a batch write for atomicity.
 */
export async function markTransmittalDocumentsAsSubmitted(
  db: Firestore,
  projectId: string,
  documentIds: string[]
): Promise<{ updated: number; skipped: number }> {
  if (documentIds.length === 0) return { updated: 0, skipped: 0 };

  const now = Timestamp.now();
  let updated = 0;
  let skipped = 0;

  // Process in batches of 500 (Firestore limit)
  for (let i = 0; i < documentIds.length; i += 500) {
    const chunk = documentIds.slice(i, i + 500);
    const batch = writeBatch(db);

    for (const docId of chunk) {
      const docRef = doc(db, 'projects', projectId, 'masterDocuments', docId);
      const snap = await getDoc(docRef);

      if (!snap.exists()) {
        skipped++;
        continue;
      }

      const data = snap.data() as MasterDocumentEntry;
      const currentStatus = data.status as MasterDocumentStatus;

      // Only transition if the state machine allows it
      if (masterDocumentStateMachine.canTransitionTo(currentStatus, 'SUBMITTED')) {
        batch.update(docRef, { status: 'SUBMITTED', updatedAt: now });
        updated++;
      } else {
        skipped++;
      }
    }

    if (updated > 0) {
      await batch.commit();
    }
  }

  return { updated, skipped };
}

/**
 * Mark transmittal as acknowledged
 */
export async function acknowledgeTransmittal(
  db: Firestore,
  projectId: string,
  transmittalId: string,
  acknowledgedBy: string,
  acknowledgedByName: string,
  notes?: string
): Promise<void> {
  // rule8-exempt: workflow function called by an upstream gate that already validated the transition
  // rule5-exempt: firestore.rules enforce per-collection permission (VIEW/MANAGE flags + project-scoped checks); client-side requirePermission is defense-in-depth deferred to future hardening
  const transmittalRef = doc(db, 'projects', projectId, 'transmittals', transmittalId);

  await updateDoc(transmittalRef, {
    status: 'ACKNOWLEDGED',
    acknowledgedBy,
    acknowledgedByName,
    acknowledgedAt: Timestamp.now(),
    acknowledgmentNotes: notes,
    updatedAt: Timestamp.now(),
  } as Record<string, unknown>);
}

/**
 * Delete a transmittal record
 */
export async function deleteTransmittal(
  db: Firestore,
  projectId: string,
  transmittalId: string
): Promise<void> {
  // rule5-exempt: firestore.rules enforce per-collection permission (VIEW/MANAGE flags + project-scoped checks); client-side requirePermission is defense-in-depth deferred to future hardening
  const { deleteDoc: firestoreDeleteDoc } = await import('firebase/firestore');
  const transmittalRef = doc(db, 'projects', projectId, 'transmittals', transmittalId);
  await firestoreDeleteDoc(transmittalRef);
}

/**
 * Get transmittals by status
 */
export async function getTransmittalsByStatus(
  db: Firestore,
  projectId: string,
  status: TransmittalStatus
): Promise<DocumentTransmittal[]> {
  const transmittalsRef = collection(db, 'projects', projectId, 'transmittals');
  const q = query(
    transmittalsRef,
    where('status', '==', status),
    orderBy('transmittalDate', 'desc')
  );

  const snapshot = await getDocs(q);
  const transmittals: DocumentTransmittal[] = [];

  snapshot.forEach((doc) => {
    transmittals.push(docToTyped<DocumentTransmittal>(doc.id, doc.data()));
  });

  return transmittals;
}
