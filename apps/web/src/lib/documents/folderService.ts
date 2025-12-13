/**
 * Folder Service for Document Browser
 *
 * Manages virtual folder hierarchy and user-created subfolders
 * for the module-scoped document browser
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
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type {
  DocumentRecord,
  DocumentModule,
  DocumentEntityType,
  DocumentFolder,
  FolderNode,
  DocumentBrowserViewMode,
  BreadcrumbSegment,
} from '@vapour/types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Entity type display names and URL slugs
 */
export const ENTITY_TYPE_CONFIG: Record<
  DocumentEntityType,
  { name: string; pluralName: string; slug: string }
> = {
  PURCHASE_REQUEST: {
    name: 'Purchase Request',
    pluralName: 'Purchase Requests',
    slug: 'purchase-requests',
  },
  RFQ: { name: 'RFQ', pluralName: 'RFQs', slug: 'rfqs' },
  OFFER: { name: 'Offer', pluralName: 'Offers', slug: 'offers' },
  PURCHASE_ORDER: {
    name: 'Purchase Order',
    pluralName: 'Purchase Orders',
    slug: 'purchase-orders',
  },
  PACKING_LIST: { name: 'Packing List', pluralName: 'Packing Lists', slug: 'packing-lists' },
  GOODS_RECEIPT: { name: 'Goods Receipt', pluralName: 'Goods Receipts', slug: 'goods-receipts' },
  WORK_COMPLETION_CERTIFICATE: {
    name: 'Work Completion',
    pluralName: 'Work Completions',
    slug: 'work-completions',
  },
  INVOICE: { name: 'Invoice', pluralName: 'Invoices', slug: 'invoices' },
  BILL: { name: 'Bill', pluralName: 'Bills', slug: 'bills' },
  PAYMENT: { name: 'Payment', pluralName: 'Payments', slug: 'payments' },
  JOURNAL_ENTRY: { name: 'Journal Entry', pluralName: 'Journal Entries', slug: 'journal-entries' },
  PROJECT: { name: 'Project', pluralName: 'Projects', slug: 'projects' },
  EQUIPMENT: { name: 'Equipment', pluralName: 'Equipment', slug: 'equipment' },
  MILESTONE: { name: 'Milestone', pluralName: 'Milestones', slug: 'milestones' },
  ESTIMATE: { name: 'Estimate', pluralName: 'Estimates', slug: 'estimates' },
  BOQ: { name: 'BOQ', pluralName: 'BOQs', slug: 'boqs' },
  VENDOR: { name: 'Vendor', pluralName: 'Vendors', slug: 'vendors' },
  CUSTOMER: { name: 'Customer', pluralName: 'Customers', slug: 'customers' },
  OTHER: { name: 'Other', pluralName: 'Other', slug: 'other' },
};

/**
 * Entity types by module
 */
export const MODULE_ENTITY_TYPES: Record<DocumentModule, DocumentEntityType[]> = {
  PROCUREMENT: [
    'PURCHASE_REQUEST',
    'RFQ',
    'OFFER',
    'PURCHASE_ORDER',
    'PACKING_LIST',
    'GOODS_RECEIPT',
    'WORK_COMPLETION_CERTIFICATE',
  ],
  ACCOUNTING: ['INVOICE', 'BILL', 'PAYMENT', 'JOURNAL_ENTRY'],
  PROJECTS: ['PROJECT', 'EQUIPMENT', 'MILESTONE'],
  PROPOSALS: ['VENDOR', 'CUSTOMER', 'OTHER'], // Uses general entity types for proposal documents
  ESTIMATION: ['ESTIMATE', 'BOQ'],
  TIME_TRACKING: [],
  GENERAL: ['VENDOR', 'CUSTOMER', 'OTHER'],
};

// ============================================================================
// FOLDER TREE BUILDING
// ============================================================================

export interface FolderTreeOptions {
  module: DocumentModule;
  projectId?: string;
  viewMode: DocumentBrowserViewMode;
}

/**
 * Build virtual folder tree from document metadata
 * Combines auto-generated folders (from entity types/IDs) with user-created subfolders
 */
export async function buildFolderTree(options: FolderTreeOptions): Promise<FolderNode[]> {
  const { module, projectId, viewMode } = options;
  const { db } = getFirebase();

  // 1. Fetch documents for this module
  const documentsRef = collection(db, COLLECTIONS.DOCUMENTS);
  const constraints = [
    where('module', '==', module),
    where('status', '!=', 'DELETED'),
    orderBy('status'),
    orderBy('uploadedAt', 'desc'),
  ];

  if (projectId) {
    constraints.push(where('projectId', '==', projectId));
  }

  const documentsSnapshot = await getDocs(query(documentsRef, ...constraints));
  const documents: DocumentRecord[] = documentsSnapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as DocumentRecord[];

  // 2. Fetch user-created folders for this module
  const foldersRef = collection(db, COLLECTIONS.DOCUMENT_FOLDERS);
  const folderConstraints = [where('module', '==', module), where('isDeleted', '==', false)];

  if (projectId) {
    folderConstraints.push(where('projectId', '==', projectId));
  }

  const foldersSnapshot = await getDocs(query(foldersRef, ...folderConstraints));
  const userFolders: DocumentFolder[] = foldersSnapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as DocumentFolder[];

  // 3. Build tree based on view mode
  if (viewMode === 'project') {
    return buildProjectViewTree(documents, userFolders, module);
  } else {
    return buildEntityViewTree(documents, userFolders, module);
  }
}

/**
 * Build entity-based view tree
 * Structure: Module / EntityType / EntityId / [UserFolders]
 */
function buildEntityViewTree(
  documents: DocumentRecord[],
  userFolders: DocumentFolder[],
  module: DocumentModule
): FolderNode[] {
  const tree: FolderNode[] = [];
  const entityTypes = MODULE_ENTITY_TYPES[module] || [];

  // Create "General" folder for unlinked documents
  const generalDocs = documents.filter((d) => !d.entityType || !d.entityId);
  if (generalDocs.length > 0 || module === 'GENERAL') {
    tree.push({
      id: `${module.toLowerCase()}/general`,
      name: 'General',
      path: `${module.toLowerCase()}/general`,
      type: 'virtual',
      level: 0,
      children: [],
      documentCount: generalDocs.length,
      totalDocumentCount: generalDocs.length,
    });
  }

  // Group documents by entity type
  for (const entityType of entityTypes) {
    const config = ENTITY_TYPE_CONFIG[entityType];
    const entityTypePath = `${module.toLowerCase()}/${config.slug}`;

    // Get all documents of this entity type
    const entityTypeDocs = documents.filter((d) => d.entityType === entityType);
    if (entityTypeDocs.length === 0) continue;

    // Group by entity ID
    const byEntityId = new Map<string, DocumentRecord[]>();
    for (const doc of entityTypeDocs) {
      const entityId = doc.entityId || 'unknown';
      if (!byEntityId.has(entityId)) {
        byEntityId.set(entityId, []);
      }
      byEntityId.get(entityId)!.push(doc);
    }

    // Build entity type node with children
    const entityChildren: FolderNode[] = [];

    for (const [entityId, docs] of byEntityId) {
      const entityNumber = docs[0]?.entityNumber || entityId;
      const entityPath = `${entityTypePath}/${entityNumber}`;

      // Find user folders under this entity
      const entityUserFolders = userFolders.filter(
        (f) => f.entityType === entityType && f.entityId === entityId
      );

      const userFolderNodes = entityUserFolders.map((f) =>
        buildUserFolderNode(f, entityPath, 2, userFolders)
      );

      // Count docs in root (not in user folders)
      const docsInRoot = docs.filter((d) => !d.folder || !d.folder.startsWith(entityPath));

      entityChildren.push({
        id: entityPath,
        name: entityNumber,
        path: entityPath,
        type: 'virtual',
        level: 1,
        entityType,
        entityId,
        entityNumber,
        children: userFolderNodes,
        documentCount: docsInRoot.length,
        totalDocumentCount: docs.length,
      });
    }

    // Sort entity children by name
    entityChildren.sort((a, b) => a.name.localeCompare(b.name));

    tree.push({
      id: entityTypePath,
      name: config.pluralName,
      path: entityTypePath,
      type: 'virtual',
      level: 0,
      entityType,
      children: entityChildren,
      documentCount: 0,
      totalDocumentCount: entityTypeDocs.length,
    });
  }

  return tree;
}

/**
 * Build project-based view tree
 * Structure: Project / Module / EntityType / EntityId / [UserFolders]
 */
function buildProjectViewTree(
  documents: DocumentRecord[],
  userFolders: DocumentFolder[],
  module: DocumentModule
): FolderNode[] {
  const tree: FolderNode[] = [];

  // Group documents by project
  const byProject = new Map<string, { docs: DocumentRecord[]; name: string; code: string }>();

  for (const doc of documents) {
    const projectId = doc.projectId || 'unassigned';
    if (!byProject.has(projectId)) {
      byProject.set(projectId, {
        docs: [],
        name: doc.projectName || 'Unassigned',
        code: doc.projectCode || 'Unassigned',
      });
    }
    byProject.get(projectId)!.docs.push(doc);
  }

  for (const [projectId, { docs, name, code }] of byProject) {
    const projectPath = projectId === 'unassigned' ? 'unassigned' : code;

    // Build entity type tree under project
    const entityTypeNodes: FolderNode[] = [];
    const entityTypes = MODULE_ENTITY_TYPES[module] || [];

    for (const entityType of entityTypes) {
      const config = ENTITY_TYPE_CONFIG[entityType];
      const entityTypeDocs = docs.filter((d) => d.entityType === entityType);
      if (entityTypeDocs.length === 0) continue;

      const entityTypePath = `${projectPath}/${module.toLowerCase()}/${config.slug}`;

      // Group by entity ID
      const byEntityId = new Map<string, DocumentRecord[]>();
      for (const doc of entityTypeDocs) {
        const entityId = doc.entityId || 'unknown';
        if (!byEntityId.has(entityId)) {
          byEntityId.set(entityId, []);
        }
        byEntityId.get(entityId)!.push(doc);
      }

      const entityChildren: FolderNode[] = [];
      for (const [entityId, entityDocs] of byEntityId) {
        const entityNumber = entityDocs[0]?.entityNumber || entityId;
        const entityPath = `${entityTypePath}/${entityNumber}`;

        // Find user folders
        const entityUserFolders = userFolders.filter(
          (f) => f.entityType === entityType && f.entityId === entityId && f.projectId === projectId
        );

        const userFolderNodes = entityUserFolders.map((f) =>
          buildUserFolderNode(f, entityPath, 3, userFolders)
        );

        entityChildren.push({
          id: entityPath,
          name: entityNumber,
          path: entityPath,
          type: 'virtual',
          level: 2,
          entityType,
          entityId,
          entityNumber,
          children: userFolderNodes,
          documentCount: entityDocs.length,
          totalDocumentCount: entityDocs.length,
        });
      }

      entityChildren.sort((a, b) => a.name.localeCompare(b.name));

      entityTypeNodes.push({
        id: entityTypePath,
        name: config.pluralName,
        path: entityTypePath,
        type: 'virtual',
        level: 1,
        entityType,
        children: entityChildren,
        documentCount: 0,
        totalDocumentCount: entityTypeDocs.length,
      });
    }

    // General folder for unlinked docs
    const generalDocs = docs.filter((d) => !d.entityType || !d.entityId);
    if (generalDocs.length > 0) {
      entityTypeNodes.unshift({
        id: `${projectPath}/general`,
        name: 'General',
        path: `${projectPath}/general`,
        type: 'virtual',
        level: 1,
        children: [],
        documentCount: generalDocs.length,
        totalDocumentCount: generalDocs.length,
      });
    }

    tree.push({
      id: projectPath,
      name: projectId === 'unassigned' ? 'Unassigned' : `${code} - ${name}`,
      path: projectPath,
      type: 'virtual',
      level: 0,
      children: entityTypeNodes,
      documentCount: 0,
      totalDocumentCount: docs.length,
    });
  }

  // Sort projects alphabetically, with "Unassigned" at the end
  tree.sort((a, b) => {
    if (a.id === 'unassigned') return 1;
    if (b.id === 'unassigned') return -1;
    return a.name.localeCompare(b.name);
  });

  return tree;
}

/**
 * Build a user folder node recursively
 */
function buildUserFolderNode(
  folder: DocumentFolder,
  parentPath: string,
  level: number,
  allFolders: DocumentFolder[]
): FolderNode {
  const folderPath = `${parentPath}/${folder.name}`;

  // Find child folders
  const childFolders = allFolders.filter((f) => f.parentFolderId === folder.id);
  const children = childFolders.map((f) =>
    buildUserFolderNode(f, folderPath, level + 1, allFolders)
  );

  return {
    id: folder.id,
    name: folder.name,
    path: folderPath,
    type: 'user',
    level,
    folderId: folder.id,
    children,
    documentCount: 0, // Will be calculated when needed
    totalDocumentCount: 0,
  };
}

// ============================================================================
// USER FOLDER CRUD
// ============================================================================

/**
 * Create a user subfolder
 */
export async function createFolder(
  parentPath: string,
  name: string,
  module: DocumentModule,
  userId: string,
  userName: string,
  options?: {
    projectId?: string;
    entityType?: DocumentEntityType;
    entityId?: string;
    parentFolderId?: string;
  }
): Promise<DocumentFolder> {
  const { db } = getFirebase();

  const now = Timestamp.now();
  const depth = parentPath.split('/').length;

  const folderData: Omit<DocumentFolder, 'id'> = {
    module,
    projectId: options?.projectId,
    entityType: options?.entityType,
    entityId: options?.entityId,
    parentFolderId: options?.parentFolderId,
    path: `${parentPath}/${name}`,
    name,
    depth,
    createdBy: userId,
    createdByName: userName,
    createdAt: now,
    updatedAt: now,
    isDeleted: false,
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.DOCUMENT_FOLDERS), folderData);

  return {
    id: docRef.id,
    ...folderData,
  };
}

/**
 * Rename a folder
 */
export async function renameFolder(folderId: string, newName: string): Promise<void> {
  const { db } = getFirebase();

  const folderRef = doc(db, COLLECTIONS.DOCUMENT_FOLDERS, folderId);
  const folderDoc = await getDoc(folderRef);

  if (!folderDoc.exists()) {
    throw new Error('Folder not found');
  }

  const folder = folderDoc.data() as DocumentFolder;
  const oldPath = folder.path;
  const pathParts = oldPath.split('/');
  pathParts[pathParts.length - 1] = newName;
  const newPath = pathParts.join('/');

  await updateDoc(folderRef, {
    name: newName,
    path: newPath,
    updatedAt: Timestamp.now(),
  });

  // Update child folders' paths
  await updateChildFolderPaths(oldPath, newPath);
}

/**
 * Delete a folder (soft delete)
 */
export async function deleteFolder(folderId: string, userId: string): Promise<void> {
  const { db } = getFirebase();

  await updateDoc(doc(db, COLLECTIONS.DOCUMENT_FOLDERS, folderId), {
    isDeleted: true,
    deletedBy: userId,
    deletedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

/**
 * Update paths of child folders when parent is renamed
 */
async function updateChildFolderPaths(oldParentPath: string, newParentPath: string): Promise<void> {
  const { db } = getFirebase();

  // Find all folders with paths starting with oldParentPath
  const foldersRef = collection(db, COLLECTIONS.DOCUMENT_FOLDERS);
  const snapshot = await getDocs(
    query(
      foldersRef,
      where('path', '>=', oldParentPath),
      where('path', '<', oldParentPath + '\uf8ff')
    )
  );

  if (snapshot.empty) return;

  const batch = writeBatch(db);

  snapshot.docs.forEach((docSnap) => {
    const folder = docSnap.data() as DocumentFolder;
    if (folder.path.startsWith(oldParentPath + '/')) {
      const newPath = folder.path.replace(oldParentPath, newParentPath);
      batch.update(docSnap.ref, { path: newPath, updatedAt: Timestamp.now() });
    }
  });

  await batch.commit();
}

// ============================================================================
// DOCUMENT QUERIES BY FOLDER
// ============================================================================

/**
 * Get documents in a specific folder path
 */
export async function getDocumentsByFolder(
  folderPath: string,
  options?: { includeSubfolders?: boolean }
): Promise<DocumentRecord[]> {
  const { db } = getFirebase();

  const documentsRef = collection(db, COLLECTIONS.DOCUMENTS);

  let constraints;
  if (options?.includeSubfolders) {
    // Get all docs with folder starting with this path
    constraints = [
      where('folder', '>=', folderPath),
      where('folder', '<', folderPath + '\uf8ff'),
      where('status', '!=', 'DELETED'),
    ];
  } else {
    // Get only docs directly in this folder
    constraints = [where('folder', '==', folderPath), where('status', '!=', 'DELETED')];
  }

  const snapshot = await getDocs(
    query(documentsRef, ...constraints, orderBy('uploadedAt', 'desc'))
  );

  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as DocumentRecord[];
}

/**
 * Move a document to a different folder
 */
export async function moveDocumentToFolder(
  documentId: string,
  newFolderPath: string
): Promise<void> {
  const { db } = getFirebase();

  await updateDoc(doc(db, COLLECTIONS.DOCUMENTS, documentId), {
    folder: newFolderPath,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Move multiple documents to a folder
 */
export async function moveDocumentsToFolder(
  documentIds: string[],
  newFolderPath: string
): Promise<void> {
  const { db } = getFirebase();
  const batch = writeBatch(db);

  for (const documentId of documentIds) {
    batch.update(doc(db, COLLECTIONS.DOCUMENTS, documentId), {
      folder: newFolderPath,
      updatedAt: Timestamp.now(),
    });
  }

  await batch.commit();
}

// ============================================================================
// BREADCRUMB GENERATION
// ============================================================================

/**
 * Generate breadcrumb segments from a folder path
 */
export function generateBreadcrumbs(
  path: string,
  viewMode: DocumentBrowserViewMode,
  module: DocumentModule
): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [];
  const parts = path.split('/').filter(Boolean);

  if (parts.length === 0) {
    return [{ label: module, path: module.toLowerCase(), type: 'module' }];
  }

  let currentPath = '';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i] ?? '';
    if (!part) continue;

    currentPath = currentPath ? `${currentPath}/${part}` : part;

    // Determine segment type based on position and view mode
    let type: BreadcrumbSegment['type'] = 'folder';
    let label: string = part;

    if (viewMode === 'project') {
      if (i === 0) {
        type = 'project';
        label = part === 'unassigned' ? 'Unassigned' : part;
      } else if (i === 1) {
        type = 'module';
        label = part.toUpperCase();
      } else if (i === 2) {
        type = 'entityType';
        // Find display name
        const entityTypeEntry = Object.entries(ENTITY_TYPE_CONFIG).find(([, v]) => v.slug === part);
        label = entityTypeEntry ? entityTypeEntry[1].pluralName : part;
      } else if (i === 3) {
        type = 'entity';
      }
    } else {
      // Entity view
      if (i === 0) {
        type = 'module';
        label = part.toUpperCase();
      } else if (i === 1) {
        type = 'entityType';
        const entityTypeEntry = Object.entries(ENTITY_TYPE_CONFIG).find(([, v]) => v.slug === part);
        label = entityTypeEntry ? entityTypeEntry[1].pluralName : part;
      } else if (i === 2) {
        type = 'entity';
      }
    }

    segments.push({ label, path: currentPath, type });
  }

  return segments;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert entity type to URL slug
 */
export function entityTypeToSlug(entityType: DocumentEntityType): string {
  return ENTITY_TYPE_CONFIG[entityType]?.slug || entityType.toLowerCase().replace(/_/g, '-');
}

/**
 * Convert URL slug to entity type
 */
export function slugToEntityType(slug: string): DocumentEntityType | undefined {
  const entry = Object.entries(ENTITY_TYPE_CONFIG).find(([, v]) => v.slug === slug);
  return entry ? (entry[0] as DocumentEntityType) : undefined;
}

/**
 * Get document count for a folder path
 */
export async function getFolderDocumentCount(
  folderPath: string,
  includeSubfolders = false
): Promise<number> {
  const docs = await getDocumentsByFolder(folderPath, { includeSubfolders });
  return docs.length;
}
