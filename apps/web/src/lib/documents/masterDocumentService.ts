/**
 * Master Document Service
 *
 * Manages the Master Document List for projects
 * Handles document lifecycle, assignments, and status tracking
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
  Timestamp,
  type QueryConstraint,
  type Firestore,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import type {
  MasterDocumentEntry,
  MasterDocumentStatus,
  DocumentLink,
  DocumentReference,
} from '@vapour/types';

// Helper to get database instance
const getDb = () => getFirebase().db;

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * Create a new master document entry
 */
export async function createMasterDocument(
  data: Omit<MasterDocumentEntry, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = Timestamp.now();

  const masterDocumentData: Omit<MasterDocumentEntry, 'id'> = {
    ...data,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(
    collection(getDb(), 'projects', data.projectId, 'masterDocuments'),
    masterDocumentData
  );

  return docRef.id;
}

/**
 * Get master document by ID
 */
export async function getMasterDocumentById(
  projectId: string,
  masterDocumentId: string
): Promise<MasterDocumentEntry | null> {
  const docRef = doc(getDb(), 'projects', projectId, 'masterDocuments', masterDocumentId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const docData = docSnap.data() as Omit<MasterDocumentEntry, 'id'>;
  const data: MasterDocumentEntry = {
    id: docSnap.id,
    ...docData,
  };

  return data;
}

/**
 * Get all master documents for a project
 */
export async function getMasterDocumentsByProject(
  db: Firestore,
  projectId: string,
  filters?: {
    status?: MasterDocumentStatus;
    assignedTo?: string;
    disciplineCode?: string;
    visibility?: 'CLIENT_VISIBLE' | 'INTERNAL_ONLY';
    onlyDeleted?: boolean;
  }
): Promise<MasterDocumentEntry[]> {
  console.log('[getMasterDocumentsByProject] Called with projectId:', projectId);
  console.log('[getMasterDocumentsByProject] Filters:', filters);

  try {
    console.log('[getMasterDocumentsByProject] Database instance received');

    const constraints: QueryConstraint[] = [];

    // Apply filters
    if (filters?.status) {
      constraints.push(where('status', '==', filters.status));
    }
    if (filters?.assignedTo) {
      constraints.push(where('assignedTo', 'array-contains', filters.assignedTo));
    }
    if (filters?.disciplineCode) {
      constraints.push(where('disciplineCode', '==', filters.disciplineCode));
    }
    if (filters?.visibility) {
      constraints.push(where('visibility', '==', filters.visibility));
    }
    if (filters?.onlyDeleted !== undefined) {
      constraints.push(where('isDeleted', '==', filters.onlyDeleted));
    } else {
      // By default, exclude deleted documents
      constraints.push(where('isDeleted', '==', false));
    }

    console.log(
      '[getMasterDocumentsByProject] Building query with constraints:',
      constraints.length
    );

    // Note: Removed orderBy from query to avoid complex index requirements
    // Sorting is done in memory instead
    const collectionPath = `projects/${projectId}/masterDocuments`;
    console.log('[getMasterDocumentsByProject] Collection path:', collectionPath);

    const q = query(collection(db, 'projects', projectId, 'masterDocuments'), ...constraints);
    console.log('[getMasterDocumentsByProject] Query built, executing getDocs...');

    const querySnapshot = await getDocs(q);
    console.log(
      '[getMasterDocumentsByProject] Query completed, documents found:',
      querySnapshot.size
    );

    const documents = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as MasterDocumentEntry[];

    console.log('[getMasterDocumentsByProject] Mapped documents:', documents.length);

    // Sort by document number in memory
    const sorted = documents.sort((a, b) => a.documentNumber.localeCompare(b.documentNumber));
    console.log('[getMasterDocumentsByProject] Documents sorted, returning');

    return sorted;
  } catch (error) {
    console.error('[getMasterDocumentsByProject] Error occurred:', error);
    console.error(
      '[getMasterDocumentsByProject] Error stack:',
      error instanceof Error ? error.stack : 'No stack'
    );
    throw error;
  }
}

/**
 * Get master documents assigned to a user
 */
export async function getMasterDocumentsByAssignee(
  userId: string,
  filters?: {
    status?: MasterDocumentStatus;
    projectId?: string;
  }
): Promise<MasterDocumentEntry[]> {
  // Note: This requires a composite index on assignedTo (array) + status
  const constraints: QueryConstraint[] = [
    where('assignedTo', 'array-contains', userId),
    where('isDeleted', '==', false),
  ];

  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }
  if (filters?.projectId) {
    constraints.push(where('projectId', '==', filters.projectId));
  }

  constraints.push(orderBy('dueDate', 'asc'));

  const q = query(collection(getDb(), 'masterDocuments'), ...constraints);

  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as MasterDocumentEntry[];
}

/**
 * Update master document
 */
export async function updateMasterDocument(
  projectId: string,
  masterDocumentId: string,
  updates: Partial<Omit<MasterDocumentEntry, 'id' | 'createdAt' | 'projectId'>>
): Promise<void> {
  const docRef = doc(getDb(), 'projects', projectId, 'masterDocuments', masterDocumentId);

  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Update document status
 */
export async function updateDocumentStatus(
  projectId: string,
  masterDocumentId: string,
  status: MasterDocumentStatus,
  _updatedBy: string
): Promise<void> {
  const updates: Partial<MasterDocumentEntry> = {
    status,
    updatedAt: Timestamp.now(),
  };

  // Track actual start/completion dates
  if (status === 'IN_PROGRESS') {
    const doc = await getMasterDocumentById(projectId, masterDocumentId);
    if (doc && !doc.actualStartDate) {
      updates.actualStartDate = Timestamp.now();
    }
  } else if (status === 'ACCEPTED') {
    updates.actualCompletionDate = Timestamp.now();
  }

  await updateMasterDocument(projectId, masterDocumentId, updates);
}

/**
 * Soft delete master document
 */
export async function deleteMasterDocument(
  projectId: string,
  masterDocumentId: string,
  deletedBy: string
): Promise<void> {
  await updateMasterDocument(projectId, masterDocumentId, {
    isDeleted: true,
    deletedBy,
    deletedAt: Timestamp.now(),
  });
}

// ============================================================================
// DOCUMENT LINKING (Predecessors/Successors)
// ============================================================================

/**
 * Add a predecessor to a document
 */
export async function addPredecessor(
  projectId: string,
  masterDocumentId: string,
  predecessorId: string
): Promise<void> {
  const doc = await getMasterDocumentById(projectId, masterDocumentId);
  const predecessor = await getMasterDocumentById(projectId, predecessorId);

  if (!doc || !predecessor) {
    throw new Error('Document or predecessor not found');
  }

  const link: DocumentLink = {
    masterDocumentId: predecessorId,
    documentNumber: predecessor.documentNumber,
    documentTitle: predecessor.documentTitle,
    linkType: 'PREREQUISITE',
    status: predecessor.status,
    currentRevision: predecessor.currentRevision,
    assignedToNames: predecessor.assignedToNames,
    createdAt: Timestamp.now(),
  };

  const updatedPredecessors = [...doc.predecessors, link];

  await updateMasterDocument(projectId, masterDocumentId, {
    predecessors: updatedPredecessors,
  });

  // Also add to successor's successors list
  const successorLink: DocumentLink = {
    masterDocumentId: masterDocumentId,
    documentNumber: doc.documentNumber,
    documentTitle: doc.documentTitle,
    linkType: 'SUCCESSOR',
    status: doc.status,
    currentRevision: doc.currentRevision,
    assignedToNames: doc.assignedToNames,
    createdAt: Timestamp.now(),
  };

  const updatedSuccessors = [...predecessor.successors, successorLink];

  await updateMasterDocument(projectId, predecessorId, {
    successors: updatedSuccessors,
  });
}

/**
 * Remove a predecessor
 */
export async function removePredecessor(
  projectId: string,
  masterDocumentId: string,
  predecessorId: string
): Promise<void> {
  const doc = await getMasterDocumentById(projectId, masterDocumentId);
  const predecessor = await getMasterDocumentById(projectId, predecessorId);

  if (!doc || !predecessor) {
    throw new Error('Document or predecessor not found');
  }

  // Remove from document's predecessors
  const updatedPredecessors = doc.predecessors.filter((p) => p.masterDocumentId !== predecessorId);

  await updateMasterDocument(projectId, masterDocumentId, {
    predecessors: updatedPredecessors,
  });

  // Remove from predecessor's successors
  const updatedSuccessors = predecessor.successors.filter(
    (s) => s.masterDocumentId !== masterDocumentId
  );

  await updateMasterDocument(projectId, predecessorId, {
    successors: updatedSuccessors,
  });
}

/**
 * Check if all predecessors are completed
 * Returns true if all predecessors are in APPROVED or ACCEPTED status
 */
export async function checkPredecessorsCompleted(
  projectId: string,
  masterDocumentId: string
): Promise<{ allCompleted: boolean; pendingPredecessors: DocumentLink[] }> {
  const doc = await getMasterDocumentById(projectId, masterDocumentId);

  if (!doc) {
    throw new Error('Document not found');
  }

  // If no predecessors, return true
  if (doc.predecessors.length === 0) {
    return { allCompleted: true, pendingPredecessors: [] };
  }

  // Check each predecessor's current status
  const pendingPredecessors: DocumentLink[] = [];

  for (const predecessor of doc.predecessors) {
    const predecessorDoc = await getMasterDocumentById(projectId, predecessor.masterDocumentId);

    if (
      predecessorDoc &&
      predecessorDoc.status !== 'APPROVED' &&
      predecessorDoc.status !== 'ACCEPTED'
    ) {
      pendingPredecessors.push({
        ...predecessor,
        status: predecessorDoc.status,
      });
    }
  }

  return {
    allCompleted: pendingPredecessors.length === 0,
    pendingPredecessors,
  };
}

/**
 * Get successors that can be started
 * (for notification after a document is approved)
 */
export async function getSuccessorsReadyToStart(
  projectId: string,
  masterDocumentId: string
): Promise<MasterDocumentEntry[]> {
  const doc = await getMasterDocumentById(projectId, masterDocumentId);

  if (!doc) {
    throw new Error('Document not found');
  }

  const readySuccessors: MasterDocumentEntry[] = [];

  for (const successor of doc.successors) {
    const successorDoc = await getMasterDocumentById(projectId, successor.masterDocumentId);

    if (successorDoc && successorDoc.status === 'NOT_STARTED') {
      // Check if all predecessors are completed
      const { allCompleted } = await checkPredecessorsCompleted(
        projectId,
        successor.masterDocumentId
      );

      if (allCompleted) {
        readySuccessors.push(successorDoc);
      }
    }
  }

  return readySuccessors;
}

// ============================================================================
// INPUT FILES MANAGEMENT
// ============================================================================

/**
 * Add input file to master document
 */
export async function addInputFile(
  projectId: string,
  masterDocumentId: string,
  inputFile: DocumentReference
): Promise<void> {
  const doc = await getMasterDocumentById(projectId, masterDocumentId);

  if (!doc) {
    throw new Error('Document not found');
  }

  const updatedInputFiles = [...doc.inputFiles, inputFile];

  await updateMasterDocument(projectId, masterDocumentId, {
    inputFiles: updatedInputFiles,
  });
}

/**
 * Remove input file
 */
export async function removeInputFile(
  projectId: string,
  masterDocumentId: string,
  fileName: string
): Promise<void> {
  const doc = await getMasterDocumentById(projectId, masterDocumentId);

  if (!doc) {
    throw new Error('Document not found');
  }

  const updatedInputFiles = doc.inputFiles.filter((f) => f.fileName !== fileName);

  await updateMasterDocument(projectId, masterDocumentId, {
    inputFiles: updatedInputFiles,
  });
}

// ============================================================================
// STATISTICS & REPORTS
// ============================================================================

/**
 * Get document statistics for a project
 */
export async function getDocumentStatistics(
  db: Firestore,
  projectId: string
): Promise<{
  total: number;
  byStatus: Record<MasterDocumentStatus, number>;
  byDiscipline: Record<string, number>;
  overdue: number;
  completionRate: number;
}> {
  const documents = await getMasterDocumentsByProject(db, projectId);

  const byStatus: Record<string, number> = {};
  const byDiscipline: Record<string, number> = {};
  let overdue = 0;
  let completed = 0;

  const now = new Date();

  documents.forEach((doc) => {
    // Count by status
    byStatus[doc.status] = (byStatus[doc.status] || 0) + 1;

    // Count by discipline
    byDiscipline[doc.disciplineCode] = (byDiscipline[doc.disciplineCode] || 0) + 1;

    // Count overdue
    if (
      doc.dueDate &&
      doc.dueDate.toDate() < now &&
      doc.status !== 'APPROVED' &&
      doc.status !== 'ACCEPTED'
    ) {
      overdue++;
    }

    // Count completed
    if (doc.status === 'APPROVED' || doc.status === 'ACCEPTED') {
      completed++;
    }
  });

  const completionRate = documents.length > 0 ? (completed / documents.length) * 100 : 0;

  return {
    total: documents.length,
    byStatus: byStatus as Record<MasterDocumentStatus, number>,
    byDiscipline,
    overdue,
    completionRate,
  };
}
