/**
 * Document Management Service
 *
 * Lightweight DMS service for uploading, versioning, and retrieving documents
 * across all modules with project/equipment linking
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
  type DocumentReference,
  type QueryConstraint,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, type UploadResult } from 'firebase/storage';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type {
  DocumentRecord,
  DocumentUploadRequest,
  DocumentSearchFilters,
  DocumentSearchResult,
  DocumentVersionHistory,
  EquipmentDocumentSummary,
} from '@vapour/types';

// ============================================================================
// UPLOAD DOCUMENT
// ============================================================================

/**
 * Upload a document to Firebase Storage and create a record in Firestore
 */
export async function uploadDocument(
  request: DocumentUploadRequest,
  userId: string,
  userName: string
): Promise<DocumentRecord> {
  const { db, storage } = getFirebase();

  try {
    // 1. Generate storage path
    const storagePath = generateStoragePath(request);

    // 2. Generate unique filename (add timestamp to avoid conflicts)
    const timestamp = Date.now();
    const fileExtension = getFileExtension(request.file.name);
    const sanitizedName = sanitizeFileName(request.file.name);
    const uniqueFileName = `${timestamp}-${sanitizedName}`;

    // 3. Upload to Firebase Storage
    const storageRef = ref(storage, `${storagePath}/${uniqueFileName}`);
    const uploadResult: UploadResult = await uploadBytes(storageRef, request.file, {
      contentType: request.file.type,
    });

    // 4. Get download URL
    const fileUrl = await getDownloadURL(uploadResult.ref);

    // 5. Handle versioning
    let version = 1;
    let previousVersionId: string | undefined;

    if (request.isNewVersion && request.previousVersionId) {
      // Mark previous version as superseded
      const prevDocRef = doc(db, COLLECTIONS.DOCUMENTS, request.previousVersionId);
      const prevDoc = await getDoc(prevDocRef);

      if (prevDoc.exists()) {
        const prevData = prevDoc.data() as DocumentRecord;
        version = prevData.version + 1;
        previousVersionId = request.previousVersionId;

        // Update previous version
        await updateDoc(prevDocRef, {
          isLatest: false,
          status: 'SUPERSEDED',
          supersededBy: userId,
          supersededAt: Timestamp.now(),
          nextVersionId: '', // Will be updated with new doc ID
          updatedAt: Timestamp.now(),
        });
      }
    }

    // 6. Create document record
    const now = Timestamp.now();
    const documentRecord: Omit<DocumentRecord, 'id'> = {
      // File information
      fileName: request.file.name,
      fileUrl,
      storageRef: uploadResult.ref.fullPath,
      fileSize: request.file.size,
      mimeType: request.file.type,
      fileExtension,

      // Categorization
      module: request.module,
      documentType: request.documentType,

      // Linking
      projectId: request.projectId,
      equipmentId: request.equipmentId,
      entityType: request.entityType,
      entityId: request.entityId,

      // Version control
      version,
      isLatest: true,
      previousVersionId,
      revisionNotes: request.revisionNotes,

      // Metadata
      title: request.title || request.file.name,
      description: request.description,
      tags: request.tags || [],
      folder: request.folder,

      // Status
      status: 'ACTIVE',
      visibility: 'PROJECT_TEAM', // Default visibility

      // Download tracking
      downloadCount: 0,

      // Workflow
      uploadedBy: userId,
      uploadedByName: userName,
      uploadedAt: now,

      // Timestamps
      createdAt: now,
      updatedAt: now,
    };

    // 7. Save to Firestore
    const docRef: DocumentReference = await addDoc(
      collection(db, COLLECTIONS.DOCUMENTS),
      documentRecord
    );

    // 8. Update previous version with next version ID
    if (previousVersionId) {
      await updateDoc(doc(db, COLLECTIONS.DOCUMENTS, previousVersionId), {
        nextVersionId: docRef.id,
      });
    }

    // 9. Return complete record
    return {
      id: docRef.id,
      ...documentRecord,
    };
  } catch (error) {
    console.error('[uploadDocument] Error uploading document:', error);
    throw new Error('Failed to upload document');
  }
}

// ============================================================================
// GET DOCUMENT BY ID
// ============================================================================

export async function getDocumentById(documentId: string): Promise<DocumentRecord | null> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.DOCUMENTS, documentId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    const documentRecord: DocumentRecord = {
      id: docSnap.id,
      ...data,
    } as DocumentRecord;
    return documentRecord;
  } catch (error) {
    console.error('[getDocumentById] Error:', error);
    throw new Error('Failed to get document');
  }
}

// ============================================================================
// SEARCH DOCUMENTS
// ============================================================================

export async function searchDocuments(
  filters: DocumentSearchFilters
): Promise<DocumentSearchResult> {
  const { db } = getFirebase();

  try {
    const constraints: QueryConstraint[] = [];

    // Module filter
    if (filters.module) {
      constraints.push(where('module', '==', filters.module));
    }

    // Document type filter
    if (filters.documentType) {
      constraints.push(where('documentType', '==', filters.documentType));
    }

    // Entity type filter
    if (filters.entityType) {
      constraints.push(where('entityType', '==', filters.entityType));
    }

    // Project filter
    if (filters.projectId) {
      constraints.push(where('projectId', '==', filters.projectId));
    }

    // Equipment filter
    if (filters.equipmentId) {
      constraints.push(where('equipmentId', '==', filters.equipmentId));
    }

    // Entity filter
    if (filters.entityId) {
      constraints.push(where('entityId', '==', filters.entityId));
    }

    // Only latest versions
    if (filters.onlyLatest) {
      constraints.push(where('isLatest', '==', true));
    }

    // Status filter
    if (filters.status) {
      constraints.push(where('status', '==', filters.status));
    }

    // Uploader filter
    if (filters.uploadedBy) {
      constraints.push(where('uploadedBy', '==', filters.uploadedBy));
    }

    // Order by
    const orderByField = filters.orderBy || 'uploadedAt';
    const orderDirection = filters.orderDirection || 'desc';
    constraints.push(orderBy(orderByField, orderDirection));

    // Limit
    if (filters.limit) {
      constraints.push(firestoreLimit(filters.limit));
    }

    // Execute query
    const q = query(collection(db, COLLECTIONS.DOCUMENTS), ...constraints);
    const snapshot = await getDocs(q);

    const documents: DocumentRecord[] = [];
    snapshot.forEach((doc) => {
      documents.push({
        id: doc.id,
        ...doc.data(),
      } as DocumentRecord);
    });

    // Client-side filtering for text search and tags (Firestore doesn't support these natively)
    let filteredDocuments = documents;

    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase();
      filteredDocuments = filteredDocuments.filter((doc) => {
        return (
          doc.fileName.toLowerCase().includes(searchLower) ||
          doc.title?.toLowerCase().includes(searchLower) ||
          doc.description?.toLowerCase().includes(searchLower) ||
          doc.tags.some((tag) => tag.toLowerCase().includes(searchLower))
        );
      });
    }

    if (filters.tags && filters.tags.length > 0) {
      filteredDocuments = filteredDocuments.filter((doc) => {
        return filters.tags!.some((tag) => doc.tags.includes(tag));
      });
    }

    // Date range filters (client-side)
    if (filters.uploadedAfter) {
      const afterTimestamp = Timestamp.fromDate(filters.uploadedAfter);
      filteredDocuments = filteredDocuments.filter((doc) => {
        return doc.uploadedAt.toMillis() >= afterTimestamp.toMillis();
      });
    }

    if (filters.uploadedBefore) {
      const beforeTimestamp = Timestamp.fromDate(filters.uploadedBefore);
      filteredDocuments = filteredDocuments.filter((doc) => {
        return doc.uploadedAt.toMillis() <= beforeTimestamp.toMillis();
      });
    }

    return {
      documents: filteredDocuments,
      totalCount: filteredDocuments.length,
      hasMore: false, // TODO: Implement proper pagination
    };
  } catch (error) {
    console.error('[searchDocuments] Error:', error);
    throw new Error('Failed to search documents');
  }
}

// ============================================================================
// GET DOCUMENTS BY ENTITY
// ============================================================================

export async function getDocumentsByEntity(
  entityType: DocumentRecord['entityType'],
  entityId: string,
  onlyLatest = true
): Promise<DocumentRecord[]> {
  return (
    await searchDocuments({
      entityType,
      entityId,
      onlyLatest,
      orderBy: 'uploadedAt',
      orderDirection: 'desc',
    })
  ).documents;
}

// ============================================================================
// GET DOCUMENTS BY PROJECT/EQUIPMENT
// ============================================================================

export async function getDocumentsByProject(
  projectId: string,
  equipmentId?: string
): Promise<DocumentRecord[]> {
  return (
    await searchDocuments({
      projectId,
      equipmentId,
      onlyLatest: true,
      orderBy: 'uploadedAt',
      orderDirection: 'asc',
    })
  ).documents;
}

// ============================================================================
// GET DOCUMENT VERSION HISTORY
// ============================================================================

export async function getDocumentVersionHistory(
  documentId: string
): Promise<DocumentVersionHistory> {
  try {
    // Get current document
    const currentDoc = await getDocumentById(documentId);
    if (!currentDoc) {
      throw new Error('Document not found');
    }

    // Collect all versions
    const allVersions: DocumentRecord[] = [currentDoc];

    // Follow previous version chain
    let prevId = currentDoc.previousVersionId;
    while (prevId) {
      const prevDoc = await getDocumentById(prevId);
      if (!prevDoc) break;
      allVersions.push(prevDoc);
      prevId = prevDoc.previousVersionId;
    }

    // Follow next version chain (if current is superseded)
    let nextId = currentDoc.nextVersionId;
    while (nextId) {
      const nextDoc = await getDocumentById(nextId);
      if (!nextDoc) break;
      allVersions.unshift(nextDoc); // Add to beginning
      nextId = nextDoc.nextVersionId;
    }

    // Sort by version number descending
    allVersions.sort((a, b) => b.version - a.version);

    return {
      documentId,
      currentVersion: allVersions.find((v) => v.isLatest) || currentDoc,
      allVersions,
      totalVersions: allVersions.length,
    };
  } catch (error) {
    console.error('[getDocumentVersionHistory] Error:', error);
    throw new Error('Failed to get document version history');
  }
}

// ============================================================================
// GET EQUIPMENT DOCUMENT SUMMARY
// ============================================================================

export async function getEquipmentDocumentSummary(
  projectId: string,
  equipmentId: string
): Promise<EquipmentDocumentSummary> {
  try {
    // Get all documents for this equipment
    const documents = await getDocumentsByProject(projectId, equipmentId);

    // Count by procurement phase
    const purchaseRequestDocs = documents.filter((d) => d.entityType === 'PURCHASE_REQUEST').length;
    const rfqDocs = documents.filter((d) => d.entityType === 'RFQ').length;
    const offerDocs = documents.filter((d) => d.entityType === 'OFFER').length;
    const purchaseOrderDocs = documents.filter((d) => d.entityType === 'PURCHASE_ORDER').length;
    const packingListDocs = documents.filter((d) => d.entityType === 'PACKING_LIST').length;
    const receiptDocs = documents.filter((d) => d.entityType === 'GOODS_RECEIPT').length;
    const completionDocs = documents.filter(
      (d) => d.entityType === 'WORK_COMPLETION_CERTIFICATE'
    ).length;

    // Find date range
    const firstDoc = documents[documents.length - 1]; // Oldest (sorted ascending)
    const lastDoc = documents[0]; // Newest

    return {
      projectId,
      projectName: firstDoc?.projectName || '',
      equipmentId,
      equipmentCode: firstDoc?.equipmentCode || '',
      equipmentName: firstDoc?.equipmentName || '',

      purchaseRequestDocs,
      rfqDocs,
      offerDocs,
      purchaseOrderDocs,
      packingListDocs,
      receiptDocs,
      completionDocs,

      totalDocuments: documents.length,
      documents,

      firstDocumentDate: firstDoc?.uploadedAt,
      lastDocumentDate: lastDoc?.uploadedAt,
    };
  } catch (error) {
    console.error('[getEquipmentDocumentSummary] Error:', error);
    throw new Error('Failed to get equipment document summary');
  }
}

// ============================================================================
// TRACK DOWNLOAD
// ============================================================================

export async function trackDocumentDownload(documentId: string, userId: string): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.DOCUMENTS, documentId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Document not found');
    }

    const currentData = docSnap.data() as DocumentRecord;

    await updateDoc(docRef, {
      downloadCount: (currentData.downloadCount || 0) + 1,
      lastDownloadedAt: Timestamp.now(),
      lastDownloadedBy: userId,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('[trackDocumentDownload] Error:', error);
    // Don't throw - download tracking is not critical
  }
}

// ============================================================================
// DELETE DOCUMENT (SOFT DELETE)
// ============================================================================

export async function deleteDocument(
  documentId: string,
  userId: string,
  reason?: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.DOCUMENTS, documentId);

    await updateDoc(docRef, {
      status: 'DELETED',
      deletedBy: userId,
      deletedAt: Timestamp.now(),
      deletionReason: reason,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('[deleteDocument] Error:', error);
    throw new Error('Failed to delete document');
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate storage path based on request
 */
function generateStoragePath(request: DocumentUploadRequest): string {
  const parts: string[] = ['documents'];

  // Add project path
  if (request.projectId) {
    parts.push(request.projectId);

    // Add equipment path if specified
    if (request.equipmentId) {
      parts.push(request.equipmentId);
    }
  }

  // Add module
  parts.push(request.module.toLowerCase());

  // Add entity type path
  parts.push(request.entityType.toLowerCase().replace(/_/g, '-'));

  // Add entity ID
  parts.push(request.entityId);

  return parts.join('/');
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.substring(lastDot + 1).toLowerCase();
}

/**
 * Sanitize filename for storage
 */
function sanitizeFileName(filename: string): string {
  return filename
    .replace(/[^a-z0-9.-]/gi, '_') // Replace non-alphanumeric with underscore
    .replace(/__+/g, '_') // Replace multiple underscores with single
    .toLowerCase();
}
