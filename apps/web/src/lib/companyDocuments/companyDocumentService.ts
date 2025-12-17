/**
 * Company Documents Service
 *
 * Service layer for company-wide documents (SOPs, policies, templates)
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
  limit,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  type FirebaseStorage,
} from 'firebase/storage';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type {
  CompanyDocument,
  CompanyDocumentCategory,
  CompanyDocumentInput,
  CompanyDocumentUpdate,
} from '@vapour/types';

const logger = createLogger({ context: 'companyDocumentService' });

export interface CompanyDocumentListResult {
  documents: CompanyDocument[];
  hasMore: boolean;
  lastDoc?: string;
}

/**
 * Get company documents with pagination, optionally filtered by category
 */
export async function getCompanyDocuments(
  db: Firestore,
  category?: CompanyDocumentCategory,
  limitResults: number = 100
): Promise<CompanyDocumentListResult> {
  const collectionRef = collection(db, COLLECTIONS.COMPANY_DOCUMENTS);

  let q;
  if (category) {
    q = query(
      collectionRef,
      where('isDeleted', '==', false),
      where('isLatest', '==', true),
      where('category', '==', category),
      orderBy('title', 'asc'),
      limit(limitResults + 1)
    );
  } else {
    q = query(
      collectionRef,
      where('isDeleted', '==', false),
      where('isLatest', '==', true),
      orderBy('category', 'asc'),
      orderBy('title', 'asc'),
      limit(limitResults + 1)
    );
  }

  const snapshot = await getDocs(q);
  const documents = snapshot.docs.slice(0, limitResults).map(
    (doc): CompanyDocument => ({
      id: doc.id,
      ...(doc.data() as Omit<CompanyDocument, 'id'>),
    })
  );

  const hasMore = snapshot.size > limitResults;
  const lastDocument = documents[documents.length - 1];

  return {
    documents,
    hasMore,
    lastDoc: lastDocument?.id,
  };
}

/**
 * Get a single company document by ID
 */
export async function getCompanyDocument(
  db: Firestore,
  documentId: string
): Promise<CompanyDocument | null> {
  const docRef = doc(db, COLLECTIONS.COMPANY_DOCUMENTS, documentId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const result: CompanyDocument = {
    id: docSnap.id,
    ...(docSnap.data() as Omit<CompanyDocument, 'id'>),
  };
  return result;
}

/**
 * Get version history for a document
 */
export async function getDocumentVersionHistory(
  db: Firestore,
  documentId: string
): Promise<CompanyDocument[]> {
  // First get the current document to find the chain
  const currentDoc = await getCompanyDocument(db, documentId);
  if (!currentDoc) return [];

  const versions: CompanyDocument[] = [currentDoc];

  // Walk backwards through previousVersionId
  let prevId = currentDoc.previousVersionId;
  while (prevId) {
    const prevDoc = await getCompanyDocument(db, prevId);
    if (prevDoc) {
      versions.push(prevDoc);
      prevId = prevDoc.previousVersionId;
    } else {
      break;
    }
  }

  return versions.reverse(); // Oldest first
}

/**
 * Upload a new company document
 */
export async function uploadCompanyDocument(
  db: Firestore,
  storage: FirebaseStorage,
  file: File,
  input: CompanyDocumentInput,
  userId: string,
  userName: string,
  onProgress?: (progress: number) => void
): Promise<CompanyDocument> {
  // Generate storage path
  const timestamp = Date.now();
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `company-documents/${input.category}/${timestamp}_${sanitizedFileName}`;

  // Upload file to storage
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, file);

  // Track upload progress
  await new Promise<void>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(progress);
      },
      reject,
      resolve
    );
  });

  // Get download URL
  const fileUrl = await getDownloadURL(storageRef);

  // Extract file extension
  const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';

  // Create document record
  const now = Timestamp.now();
  const documentData: Omit<CompanyDocument, 'id'> = {
    title: input.title,
    description: input.description,
    category: input.category,
    fileName: file.name,
    fileUrl,
    storageRef: storagePath,
    fileSize: file.size,
    mimeType: file.type,
    fileExtension,
    version: 1,
    isLatest: true,
    revisionNotes: input.revisionNotes,
    folder: input.folder,
    tags: input.tags || [],
    isTemplate: input.isTemplate || false,
    templateType: input.templateType,
    uploadedBy: userId,
    uploadedByName: userName,
    uploadedAt: now,
    updatedAt: now,
    isDeleted: false,
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.COMPANY_DOCUMENTS), documentData);

  return {
    id: docRef.id,
    ...documentData,
  };
}

/**
 * Create a new version of an existing document
 */
export async function createNewVersion(
  db: Firestore,
  storage: FirebaseStorage,
  documentId: string,
  file: File,
  revisionNotes: string,
  userId: string,
  userName: string,
  onProgress?: (progress: number) => void
): Promise<CompanyDocument> {
  // Get the current document
  const currentDoc = await getCompanyDocument(db, documentId);
  if (!currentDoc) {
    throw new Error('Document not found');
  }

  // Generate storage path
  const timestamp = Date.now();
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `company-documents/${currentDoc.category}/${timestamp}_${sanitizedFileName}`;

  // Upload file to storage
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, file);

  await new Promise<void>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(progress);
      },
      reject,
      resolve
    );
  });

  const fileUrl = await getDownloadURL(storageRef);
  const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';

  // Mark current version as not latest
  await updateDoc(doc(db, COLLECTIONS.COMPANY_DOCUMENTS, documentId), {
    isLatest: false,
    updatedAt: Timestamp.now(),
  });

  // Create new version
  const now = Timestamp.now();
  const newDocData: Omit<CompanyDocument, 'id'> = {
    title: currentDoc.title,
    description: currentDoc.description,
    category: currentDoc.category,
    fileName: file.name,
    fileUrl,
    storageRef: storagePath,
    fileSize: file.size,
    mimeType: file.type,
    fileExtension,
    version: currentDoc.version + 1,
    isLatest: true,
    previousVersionId: documentId,
    revisionNotes,
    folder: currentDoc.folder,
    tags: currentDoc.tags,
    isTemplate: currentDoc.isTemplate,
    templateType: currentDoc.templateType,
    uploadedBy: userId,
    uploadedByName: userName,
    uploadedAt: now,
    updatedAt: now,
    isDeleted: false,
  };

  const newDocRef = await addDoc(collection(db, COLLECTIONS.COMPANY_DOCUMENTS), newDocData);

  return {
    id: newDocRef.id,
    ...newDocData,
  };
}

/**
 * Update document metadata (not the file itself)
 */
export async function updateCompanyDocument(
  db: Firestore,
  documentId: string,
  updates: CompanyDocumentUpdate,
  userId: string,
  userName: string
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.COMPANY_DOCUMENTS, documentId);

  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
    updatedByName: userName,
  });
}

/**
 * Soft delete a company document
 */
export async function deleteCompanyDocument(
  db: Firestore,
  documentId: string,
  userId: string
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.COMPANY_DOCUMENTS, documentId);

  await updateDoc(docRef, {
    isDeleted: true,
    deletedAt: Timestamp.now(),
    deletedBy: userId,
  });
}

/**
 * Permanently delete a document and its file from storage
 * Use with caution - typically soft delete is preferred
 */
export async function permanentlyDeleteCompanyDocument(
  db: Firestore,
  storage: FirebaseStorage,
  documentId: string
): Promise<void> {
  const document = await getCompanyDocument(db, documentId);
  if (!document) return;

  // Delete file from storage
  try {
    const storageRef = ref(storage, document.storageRef);
    await deleteObject(storageRef);
  } catch (error) {
    logger.warn('Failed to delete file from storage', {
      error,
      documentId,
      storageRef: document.storageRef,
    });
  }

  // Note: We're not deleting the Firestore document since security rules
  // may not allow hard deletes. Use soft delete instead.
}

/**
 * Search company documents by title or description
 */
export async function searchCompanyDocuments(
  db: Firestore,
  searchQuery: string,
  category?: CompanyDocumentCategory
): Promise<CompanyDocument[]> {
  // Note: Firestore doesn't support full-text search natively
  // This is a client-side filter - for production, consider Algolia or similar
  const result = await getCompanyDocuments(db, category, 500); // Get more for search filtering

  const queryLower = searchQuery.toLowerCase();
  return result.documents.filter(
    (doc) =>
      doc.title.toLowerCase().includes(queryLower) ||
      doc.description.toLowerCase().includes(queryLower) ||
      doc.tags.some((tag) => tag.toLowerCase().includes(queryLower))
  );
}

/**
 * Get documents by template type (for app generation)
 * Templates are typically few, so default limit is reasonable
 */
export async function getTemplatesByType(
  db: Firestore,
  templateType: string,
  limitResults: number = 50
): Promise<CompanyDocument[]> {
  const collectionRef = collection(db, COLLECTIONS.COMPANY_DOCUMENTS);

  const q = query(
    collectionRef,
    where('isDeleted', '==', false),
    where('isLatest', '==', true),
    where('isTemplate', '==', true),
    where('templateType', '==', templateType),
    limit(limitResults)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (doc): CompanyDocument => ({
      id: doc.id,
      ...(doc.data() as Omit<CompanyDocument, 'id'>),
    })
  );
}

/**
 * Get document counts by category
 */
export async function getDocumentCountsByCategory(
  db: Firestore
): Promise<Record<CompanyDocumentCategory, number>> {
  const result = await getCompanyDocuments(db, undefined, 1000); // Get enough for accurate counts

  const counts: Record<CompanyDocumentCategory, number> = {
    SOP: 0,
    POLICY: 0,
    TEMPLATE: 0,
    STANDARD: 0,
    MANUAL: 0,
    OTHER: 0,
  };

  result.documents.forEach((doc) => {
    counts[doc.category]++;
  });

  return counts;
}
