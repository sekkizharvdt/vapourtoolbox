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
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import type { DocumentTransmittal, TransmittalStatus } from '@vapour/types';

/**
 * Generate next transmittal number for a project
 * Format: TR-001, TR-002, etc.
 */
export async function generateTransmittalNumber(db: Firestore, projectId: string): Promise<string> {
  const transmittalsRef = collection(db, 'projects', projectId, 'transmittals');
  const q = query(transmittalsRef, orderBy('transmittalNumber', 'desc'));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return 'TR-001';
  }

  // Get the highest transmittal number
  const lastTransmittal = snapshot.docs[0]?.data() as DocumentTransmittal | undefined;
  if (!lastTransmittal) {
    return 'TR-001';
  }

  const lastNumber = lastTransmittal.transmittalNumber;

  // Extract number and increment
  const match = lastNumber.match(/TR-(\d+)/);
  if (!match || !match[1]) {
    return 'TR-001';
  }

  const nextNumber = parseInt(match[1], 10) + 1;
  return `TR-${nextNumber.toString().padStart(3, '0')}`;
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
  createdBy: string;
  createdByName: string;
}

export async function createTransmittal(
  db: Firestore,
  data: CreateTransmittalData
): Promise<string> {
  // Generate transmittal number
  const transmittalNumber = await generateTransmittalNumber(db, data.projectId);

  const now = Timestamp.now();

  const transmittal: Omit<DocumentTransmittal, 'id'> = {
    projectId: data.projectId,
    projectName: data.projectName,
    transmittalNumber,
    transmittalDate: now,
    status: 'DRAFT',
    clientName: data.clientName,
    clientContact: data.clientContact,
    recipientEmail: data.recipientEmail,
    documentIds: data.documentIds,
    documentCount: data.documentIds.length,
    subject: data.subject,
    coverNotes: data.coverNotes,
    purposeOfIssue: data.purposeOfIssue,
    createdBy: data.createdBy,
    createdByName: data.createdByName,
    createdAt: now,
    updatedAt: now,
  };

  const transmittalsRef = collection(db, 'projects', data.projectId, 'transmittals');
  const docRef = await addDoc(transmittalsRef, transmittal);

  console.warn('[TransmittalService] Created transmittal:', docRef.id, transmittalNumber);
  return docRef.id;
}

/**
 * Get transmittals for a project
 */
export async function getProjectTransmittals(
  db: Firestore,
  projectId: string
): Promise<DocumentTransmittal[]> {
  const transmittalsRef = collection(db, 'projects', projectId, 'transmittals');
  const q = query(transmittalsRef, orderBy('transmittalDate', 'desc'));

  const snapshot = await getDocs(q);
  const transmittals: DocumentTransmittal[] = [];

  snapshot.forEach((doc) => {
    transmittals.push(docToTyped<DocumentTransmittal>(doc.id, doc.data()));
  });

  return transmittals;
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
  console.warn('[TransmittalService] Updated transmittal status:', transmittalId, status);
}

/**
 * Update transmittal with PDF and ZIP file URLs
 */
export async function updateTransmittalFiles(
  db: Firestore,
  projectId: string,
  transmittalId: string,
  files: {
    transmittalPdfUrl?: string;
    transmittalPdfId?: string;
    zipFileUrl?: string;
    zipFileSize?: number;
  }
): Promise<void> {
  const transmittalRef = doc(db, 'projects', projectId, 'transmittals', transmittalId);

  await updateDoc(transmittalRef, {
    ...files,
    status: 'GENERATED',
    updatedAt: Timestamp.now(),
  } as Record<string, unknown>);

  console.warn('[TransmittalService] Updated transmittal files:', transmittalId);
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
  const transmittalRef = doc(db, 'projects', projectId, 'transmittals', transmittalId);

  await updateDoc(transmittalRef, {
    status: 'ACKNOWLEDGED',
    acknowledgedBy,
    acknowledgedByName,
    acknowledgedAt: Timestamp.now(),
    acknowledgmentNotes: notes,
    updatedAt: Timestamp.now(),
  } as Record<string, unknown>);

  console.warn('[TransmittalService] Acknowledged transmittal:', transmittalId);
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
