/**
 * Document Link Service
 *
 * Handles document link operations:
 * - Creating links between documents (predecessor/successor/related)
 * - Removing links
 * - Circular dependency detection
 * - Reciprocal link management
 */

import {
  doc,
  getDoc,
  updateDoc,
  Timestamp,
  writeBatch,
  type Firestore,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import type { DocumentLink, MasterDocumentEntry } from '@vapour/types';

/**
 * Create a document link
 */
export interface CreateLinkRequest {
  projectId: string;
  sourceDocumentId: string; // The document we're adding the link to
  targetDocumentId: string; // The document being linked
  linkType: 'PREREQUISITE' | 'SUCCESSOR' | 'RELATED';
}

/**
 * Check for circular dependencies
 * Returns true if creating this link would create a circular dependency
 */
async function hasCircularDependency(
  db: Firestore,
  projectId: string,
  sourceId: string,
  targetId: string,
  visited: Set<string> = new Set()
): Promise<boolean> {
  // If we've already visited this document, we have a cycle
  if (visited.has(targetId)) {
    return targetId === sourceId;
  }

  visited.add(targetId);

  // Get the target document
  const targetDocRef = doc(db, 'projects', projectId, 'masterDocuments', targetId);
  const targetSnapshot = await getDoc(targetDocRef);

  if (!targetSnapshot.exists()) {
    return false;
  }

  const targetDoc = targetSnapshot.data() as MasterDocumentEntry;

  // Check all successors of the target
  for (const successor of targetDoc.successors) {
    if (await hasCircularDependency(db, projectId, sourceId, successor.masterDocumentId, visited)) {
      return true;
    }
  }

  return false;
}

/**
 * Create a document link
 */
export async function createDocumentLink(db: Firestore, request: CreateLinkRequest): Promise<void> {
  // Get both documents
  const sourceDocRef = doc(
    db,
    'projects',
    request.projectId,
    'masterDocuments',
    request.sourceDocumentId
  );
  const targetDocRef = doc(
    db,
    'projects',
    request.projectId,
    'masterDocuments',
    request.targetDocumentId
  );

  const [sourceSnapshot, targetSnapshot] = await Promise.all([
    getDoc(sourceDocRef),
    getDoc(targetDocRef),
  ]);

  if (!sourceSnapshot.exists() || !targetSnapshot.exists()) {
    throw new Error('One or both documents not found');
  }

  const sourceDoc = sourceSnapshot.data() as MasterDocumentEntry;
  const targetDoc = targetSnapshot.data() as MasterDocumentEntry;

  // Check for circular dependencies for PREREQUISITE and SUCCESSOR links
  if (request.linkType === 'PREREQUISITE') {
    // Adding a prerequisite means target becomes a predecessor of source
    // This would create a cycle if source is already a predecessor of target
    const hasCycle = await hasCircularDependency(
      db,
      request.projectId,
      request.targetDocumentId,
      request.sourceDocumentId
    );
    if (hasCycle) {
      throw new Error(
        'Cannot create this link: it would create a circular dependency. A document cannot depend on itself.'
      );
    }
  } else if (request.linkType === 'SUCCESSOR') {
    // Adding a successor means source becomes a predecessor of target
    // This would create a cycle if target is already a predecessor of source
    const hasCycle = await hasCircularDependency(
      db,
      request.projectId,
      request.sourceDocumentId,
      request.targetDocumentId
    );
    if (hasCycle) {
      throw new Error(
        'Cannot create this link: it would create a circular dependency. A document cannot depend on itself.'
      );
    }
  }

  // Create link objects
  const sourceLinkToTarget: DocumentLink = {
    masterDocumentId: targetDoc.id,
    documentNumber: targetDoc.documentNumber,
    documentTitle: targetDoc.documentTitle,
    linkType: request.linkType,
    status: targetDoc.status,
    currentRevision: targetDoc.currentRevision,
    createdAt: Timestamp.now(),
  };

  const targetLinkToSource: DocumentLink = {
    masterDocumentId: sourceDoc.id,
    documentNumber: sourceDoc.documentNumber,
    documentTitle: sourceDoc.documentTitle,
    linkType:
      request.linkType === 'PREREQUISITE'
        ? 'SUCCESSOR'
        : request.linkType === 'SUCCESSOR'
          ? 'PREREQUISITE'
          : 'RELATED',
    status: sourceDoc.status,
    currentRevision: sourceDoc.currentRevision,
    createdAt: Timestamp.now(),
  };

  // Update documents based on link type
  if (request.linkType === 'PREREQUISITE') {
    // Source document gets a predecessor
    // Target document gets a successor
    await Promise.all([
      updateDoc(sourceDocRef, {
        predecessors: arrayUnion(sourceLinkToTarget),
        updatedAt: Timestamp.now(),
      }),
      updateDoc(targetDocRef, {
        successors: arrayUnion(targetLinkToSource),
        updatedAt: Timestamp.now(),
      }),
    ]);
  } else if (request.linkType === 'SUCCESSOR') {
    // Source document gets a successor
    // Target document gets a predecessor
    await Promise.all([
      updateDoc(sourceDocRef, {
        successors: arrayUnion(sourceLinkToTarget),
        updatedAt: Timestamp.now(),
      }),
      updateDoc(targetDocRef, {
        predecessors: arrayUnion(targetLinkToSource),
        updatedAt: Timestamp.now(),
      }),
    ]);
  } else if (request.linkType === 'RELATED') {
    // Both documents get related links
    await Promise.all([
      updateDoc(sourceDocRef, {
        relatedDocuments: arrayUnion(sourceLinkToTarget),
        updatedAt: Timestamp.now(),
      }),
      updateDoc(targetDocRef, {
        relatedDocuments: arrayUnion(targetLinkToSource),
        updatedAt: Timestamp.now(),
      }),
    ]);
  }
}

/**
 * Remove a document link
 */
export interface RemoveLinkRequest {
  projectId: string;
  sourceDocumentId: string; // The document we're removing the link from
  targetDocumentId: string; // The document being unlinked
  linkType: 'PREREQUISITE' | 'SUCCESSOR' | 'RELATED';
}

export async function removeDocumentLink(db: Firestore, request: RemoveLinkRequest): Promise<void> {
  // Get both documents
  const sourceDocRef = doc(
    db,
    'projects',
    request.projectId,
    'masterDocuments',
    request.sourceDocumentId
  );
  const targetDocRef = doc(
    db,
    'projects',
    request.projectId,
    'masterDocuments',
    request.targetDocumentId
  );

  const [sourceSnapshot, targetSnapshot] = await Promise.all([
    getDoc(sourceDocRef),
    getDoc(targetDocRef),
  ]);

  if (!sourceSnapshot.exists() || !targetSnapshot.exists()) {
    throw new Error('One or both documents not found');
  }

  const sourceDoc = sourceSnapshot.data() as MasterDocumentEntry;
  const targetDoc = targetSnapshot.data() as MasterDocumentEntry;

  // Find the exact link objects to remove
  let sourceLinkToRemove: DocumentLink | undefined;
  let targetLinkToRemove: DocumentLink | undefined;

  if (request.linkType === 'PREREQUISITE') {
    sourceLinkToRemove = sourceDoc.predecessors.find(
      (l) => l.masterDocumentId === request.targetDocumentId
    );
    targetLinkToRemove = targetDoc.successors.find(
      (l) => l.masterDocumentId === request.sourceDocumentId
    );
  } else if (request.linkType === 'SUCCESSOR') {
    sourceLinkToRemove = sourceDoc.successors.find(
      (l) => l.masterDocumentId === request.targetDocumentId
    );
    targetLinkToRemove = targetDoc.predecessors.find(
      (l) => l.masterDocumentId === request.sourceDocumentId
    );
  } else if (request.linkType === 'RELATED') {
    sourceLinkToRemove = sourceDoc.relatedDocuments.find(
      (l) => l.masterDocumentId === request.targetDocumentId
    );
    targetLinkToRemove = targetDoc.relatedDocuments.find(
      (l) => l.masterDocumentId === request.sourceDocumentId
    );
  }

  if (!sourceLinkToRemove || !targetLinkToRemove) {
    throw new Error('Link not found');
  }

  // Remove links from both documents
  if (request.linkType === 'PREREQUISITE') {
    await Promise.all([
      updateDoc(sourceDocRef, {
        predecessors: arrayRemove(sourceLinkToRemove),
        updatedAt: Timestamp.now(),
      }),
      updateDoc(targetDocRef, {
        successors: arrayRemove(targetLinkToRemove),
        updatedAt: Timestamp.now(),
      }),
    ]);
  } else if (request.linkType === 'SUCCESSOR') {
    await Promise.all([
      updateDoc(sourceDocRef, {
        successors: arrayRemove(sourceLinkToRemove),
        updatedAt: Timestamp.now(),
      }),
      updateDoc(targetDocRef, {
        predecessors: arrayRemove(targetLinkToRemove),
        updatedAt: Timestamp.now(),
      }),
    ]);
  } else if (request.linkType === 'RELATED') {
    await Promise.all([
      updateDoc(sourceDocRef, {
        relatedDocuments: arrayRemove(sourceLinkToRemove),
        updatedAt: Timestamp.now(),
      }),
      updateDoc(targetDocRef, {
        relatedDocuments: arrayRemove(targetLinkToRemove),
        updatedAt: Timestamp.now(),
      }),
    ]);
  }
}

/**
 * Update link status when a document status changes
 * This should be called whenever a document's status changes
 *
 * Performance: Uses parallel reads and batch writes instead of sequential N+1 operations
 */
export async function updateLinksStatus(
  db: Firestore,
  projectId: string,
  documentId: string,
  newStatus: string,
  newRevision: string
): Promise<void> {
  const docRef = doc(db, 'projects', projectId, 'masterDocuments', documentId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    return;
  }

  const document = snapshot.data() as MasterDocumentEntry;

  // Get all documents that link to this document
  const linkedDocumentIds = new Set<string>();

  // Documents that have this as a predecessor (we are their predecessor)
  document.successors.forEach((link) => linkedDocumentIds.add(link.masterDocumentId));

  // Documents that have this as a successor (we are their successor)
  document.predecessors.forEach((link) => linkedDocumentIds.add(link.masterDocumentId));

  // Documents that have this as related
  document.relatedDocuments.forEach((link) => linkedDocumentIds.add(link.masterDocumentId));

  if (linkedDocumentIds.size === 0) {
    return;
  }

  // Fetch all linked documents in parallel (instead of N+1 sequential queries)
  const linkedDocIds = Array.from(linkedDocumentIds);
  const linkedDocPromises = linkedDocIds.map(async (linkedDocId) => {
    const linkedDocRef = doc(db, 'projects', projectId, 'masterDocuments', linkedDocId);
    const linkedSnapshot = await getDoc(linkedDocRef);
    return { linkedDocId, linkedDocRef, linkedSnapshot };
  });

  const linkedDocResults = await Promise.all(linkedDocPromises);

  // Use batch write for all updates (instead of sequential writes)
  const batch = writeBatch(db);
  const now = Timestamp.now();

  for (const { linkedDocRef, linkedSnapshot } of linkedDocResults) {
    if (!linkedSnapshot.exists()) {
      continue;
    }

    const linkedDoc = linkedSnapshot.data() as MasterDocumentEntry;

    // Update the link in predecessors
    const updatedPredecessors = linkedDoc.predecessors.map((link) =>
      link.masterDocumentId === documentId
        ? { ...link, status: newStatus, currentRevision: newRevision }
        : link
    );

    // Update the link in successors
    const updatedSuccessors = linkedDoc.successors.map((link) =>
      link.masterDocumentId === documentId
        ? { ...link, status: newStatus, currentRevision: newRevision }
        : link
    );

    // Update the link in related documents
    const updatedRelated = linkedDoc.relatedDocuments.map((link) =>
      link.masterDocumentId === documentId
        ? { ...link, status: newStatus, currentRevision: newRevision }
        : link
    );

    // Add to batch
    batch.update(linkedDocRef, {
      predecessors: updatedPredecessors,
      successors: updatedSuccessors,
      relatedDocuments: updatedRelated,
      updatedAt: now,
    });
  }

  // Commit all updates atomically
  await batch.commit();
}
