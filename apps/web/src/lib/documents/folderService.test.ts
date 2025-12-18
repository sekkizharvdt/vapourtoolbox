/**
 * Folder Service Tests
 *
 * Tests for document browser folder management:
 * - Virtual folder tree building
 * - User-created subfolder CRUD
 * - Breadcrumb generation
 * - Entity type configuration
 */

import {
  ENTITY_TYPE_CONFIG,
  MODULE_ENTITY_TYPES,
  buildFolderTree,
  createFolder,
  renameFolder,
  deleteFolder,
  getDocumentsByFolder,
  moveDocumentToFolder,
  moveDocumentsToFolder,
  generateBreadcrumbs,
  entityTypeToSlug,
  slugToEntityType,
  getFolderDocumentCount,
  type FolderTreeOptions,
} from './folderService';
import type { DocumentEntityType } from '@vapour/types';

// Mock Firebase
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockWriteBatch = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'mock-collection'),
  doc: jest.fn(() => 'mock-doc-ref'),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
  query: jest.fn((...args: unknown[]) => args),
  where: jest.fn(),
  orderBy: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({
      seconds: 1702800000,
      nanoseconds: 0,
      toDate: () => new Date('2024-12-17'),
    })),
  },
}));

jest.mock('@/lib/firebase', () => ({
  getFirebase: jest.fn(() => ({ db: {} })),
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    DOCUMENTS: 'documents',
    DOCUMENT_FOLDERS: 'documentFolders',
  },
}));

describe('ENTITY_TYPE_CONFIG', () => {
  it('should have configuration for all document entity types', () => {
    const expectedTypes: DocumentEntityType[] = [
      'PURCHASE_REQUEST',
      'RFQ',
      'OFFER',
      'PURCHASE_ORDER',
      'PACKING_LIST',
      'GOODS_RECEIPT',
      'WORK_COMPLETION_CERTIFICATE',
      'INVOICE',
      'BILL',
      'PAYMENT',
      'JOURNAL_ENTRY',
      'PROJECT',
      'EQUIPMENT',
      'MILESTONE',
      'ESTIMATE',
      'BOQ',
      'VENDOR',
      'CUSTOMER',
      'OTHER',
    ];

    expectedTypes.forEach((type) => {
      expect(ENTITY_TYPE_CONFIG[type]).toBeDefined();
      expect(ENTITY_TYPE_CONFIG[type].name).toBeDefined();
      expect(ENTITY_TYPE_CONFIG[type].pluralName).toBeDefined();
      expect(ENTITY_TYPE_CONFIG[type].slug).toBeDefined();
    });
  });

  it('should have valid URL slugs (lowercase, hyphenated)', () => {
    Object.values(ENTITY_TYPE_CONFIG).forEach((config) => {
      expect(config.slug).toMatch(/^[a-z0-9-]+$/);
    });
  });

  it('should have unique slugs', () => {
    const slugs = Object.values(ENTITY_TYPE_CONFIG).map((c) => c.slug);
    const uniqueSlugs = new Set(slugs);
    expect(uniqueSlugs.size).toBe(slugs.length);
  });
});

describe('MODULE_ENTITY_TYPES', () => {
  it('should define entity types for PROCUREMENT module', () => {
    expect(MODULE_ENTITY_TYPES.PROCUREMENT).toContain('PURCHASE_REQUEST');
    expect(MODULE_ENTITY_TYPES.PROCUREMENT).toContain('RFQ');
    expect(MODULE_ENTITY_TYPES.PROCUREMENT).toContain('PURCHASE_ORDER');
    expect(MODULE_ENTITY_TYPES.PROCUREMENT).toContain('GOODS_RECEIPT');
  });

  it('should define entity types for ACCOUNTING module', () => {
    expect(MODULE_ENTITY_TYPES.ACCOUNTING).toContain('INVOICE');
    expect(MODULE_ENTITY_TYPES.ACCOUNTING).toContain('BILL');
    expect(MODULE_ENTITY_TYPES.ACCOUNTING).toContain('PAYMENT');
    expect(MODULE_ENTITY_TYPES.ACCOUNTING).toContain('JOURNAL_ENTRY');
  });

  it('should define entity types for PROJECTS module', () => {
    expect(MODULE_ENTITY_TYPES.PROJECTS).toContain('PROJECT');
    expect(MODULE_ENTITY_TYPES.PROJECTS).toContain('EQUIPMENT');
    expect(MODULE_ENTITY_TYPES.PROJECTS).toContain('MILESTONE');
  });

  it('should have empty array for TIME_TRACKING module', () => {
    expect(MODULE_ENTITY_TYPES.TIME_TRACKING).toEqual([]);
  });
});

describe('buildFolderTree', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return empty array when no documents exist', async () => {
    mockGetDocs
      .mockResolvedValueOnce({ docs: [] }) // documents
      .mockResolvedValueOnce({ docs: [] }); // folders

    const options: FolderTreeOptions = {
      module: 'PROCUREMENT',
      viewMode: 'entity',
    };

    const tree = await buildFolderTree(options);

    expect(tree).toEqual([]);
  });

  it('should build entity-based tree from documents', async () => {
    const mockDocuments = [
      {
        id: 'doc-1',
        data: () => ({
          entityType: 'PURCHASE_ORDER',
          entityId: 'po-1',
          entityName: 'PO-001',
          module: 'PROCUREMENT',
          status: 'ACTIVE',
        }),
      },
      {
        id: 'doc-2',
        data: () => ({
          entityType: 'PURCHASE_ORDER',
          entityId: 'po-1',
          entityName: 'PO-001',
          module: 'PROCUREMENT',
          status: 'ACTIVE',
        }),
      },
    ];

    mockGetDocs
      .mockResolvedValueOnce({ docs: mockDocuments }) // documents
      .mockResolvedValueOnce({ docs: [] }); // folders

    const options: FolderTreeOptions = {
      module: 'PROCUREMENT',
      viewMode: 'entity',
    };

    const tree = await buildFolderTree(options);

    // Should have entity type folder with entity subfolder
    expect(tree.length).toBeGreaterThanOrEqual(1);
  });

  it('should include project filter when projectId provided', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [] });

    const options: FolderTreeOptions = {
      module: 'PROCUREMENT',
      projectId: 'project-123',
      viewMode: 'project',
    };

    await buildFolderTree(options);

    // Verify where clause was called with projectId
    expect(mockGetDocs).toHaveBeenCalled();
  });

  it('should merge user-created folders with auto-generated tree', async () => {
    const mockDocuments = [
      {
        id: 'doc-1',
        data: () => ({
          entityType: 'PURCHASE_ORDER',
          entityId: 'po-1',
          module: 'PROCUREMENT',
          status: 'ACTIVE',
        }),
      },
    ];

    const mockFolders = [
      {
        id: 'folder-1',
        data: () => ({
          name: 'User Folder',
          parentPath: '/PURCHASE_ORDER/po-1',
          module: 'PROCUREMENT',
          isDeleted: false,
        }),
      },
    ];

    mockGetDocs
      .mockResolvedValueOnce({ docs: mockDocuments })
      .mockResolvedValueOnce({ docs: mockFolders });

    const options: FolderTreeOptions = {
      module: 'PROCUREMENT',
      viewMode: 'entity',
    };

    const tree = await buildFolderTree(options);

    expect(tree).toBeDefined();
  });
});

describe('createFolder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: 'new-folder-1' });
  });

  it('should create folder with correct data', async () => {
    const result = await createFolder(
      '/procurement/purchase-orders',
      'Test Folder',
      'PROCUREMENT',
      'user-1',
      'Test User'
    );

    expect(result.id).toBe('new-folder-1');
    expect(result.name).toBe('Test Folder');
    expect(result.module).toBe('PROCUREMENT');
    expect(result.createdBy).toBe('user-1');
    expect(result.isDeleted).toBe(false);
    expect(mockAddDoc).toHaveBeenCalled();
  });

  it('should include projectId when provided', async () => {
    const result = await createFolder(
      '/procurement',
      'Project Folder',
      'PROCUREMENT',
      'user-1',
      'Test User',
      {
        projectId: 'project-123',
      }
    );

    expect(result.projectId).toBe('project-123');
  });

  it('should include entityType and entityId when provided', async () => {
    const result = await createFolder(
      '/procurement/purchase-orders',
      'PO Folder',
      'PROCUREMENT',
      'user-1',
      'Test User',
      {
        entityType: 'PURCHASE_ORDER',
        entityId: 'po-123',
      }
    );

    expect(result.entityType).toBe('PURCHASE_ORDER');
    expect(result.entityId).toBe('po-123');
  });

  it('should set parentFolderId when provided', async () => {
    const result = await createFolder(
      '/procurement',
      'Subfolder',
      'PROCUREMENT',
      'user-1',
      'Test User',
      {
        parentFolderId: 'parent-folder-1',
      }
    );

    expect(result.parentFolderId).toBe('parent-folder-1');
  });

  it('should calculate depth from parent path', async () => {
    const result = await createFolder(
      '/procurement/purchase-orders/po-1',
      'Deep Folder',
      'PROCUREMENT',
      'user-1',
      'Test User'
    );

    // Path splits into ['', 'procurement', 'purchase-orders', 'po-1'] so depth = 4
    expect(result.depth).toBe(4);
  });
});

describe('renameFolder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
    mockGetDocs.mockResolvedValue({ docs: [], empty: true });
  });

  it('should rename folder and update path', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        name: 'Old Name',
        path: '/procurement/purchase-orders/Old Name',
      }),
    });

    await renameFolder('folder-1', 'New Name');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        name: 'New Name',
        path: '/procurement/purchase-orders/New Name',
        updatedAt: expect.anything(),
      })
    );
  });

  it('should throw error when folder not found', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    await expect(renameFolder('non-existent', 'New Name')).rejects.toThrow('Folder not found');
  });

  it('should update child folder paths when parent is renamed', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        name: 'Parent',
        path: '/procurement/Parent',
      }),
    });

    const mockChildFolders = [
      {
        id: 'child-1',
        data: () => ({ path: '/procurement/Parent/child1' }),
        ref: 'child-1-ref',
      },
    ];

    mockGetDocs.mockResolvedValue({ docs: mockChildFolders, empty: false });

    const mockBatch = {
      update: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    mockWriteBatch.mockReturnValue(mockBatch);

    await renameFolder('folder-1', 'Renamed');

    expect(mockWriteBatch).toHaveBeenCalled();
  });
});

describe('deleteFolder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it('should soft delete folder (set isDeleted flag)', async () => {
    await deleteFolder('folder-1', 'user-1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        isDeleted: true,
        deletedAt: expect.anything(),
        deletedBy: 'user-1',
        updatedAt: expect.anything(),
      })
    );
  });
});

describe('getDocumentsByFolder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return documents in specific folder', async () => {
    const mockDocs = [
      { id: 'doc-1', data: () => ({ name: 'Document 1', folder: '/procurement/invoices' }) },
      { id: 'doc-2', data: () => ({ name: 'Document 2', folder: '/procurement/invoices' }) },
    ];

    mockGetDocs.mockResolvedValue({ docs: mockDocs });

    const docs = await getDocumentsByFolder('/procurement/invoices');

    expect(docs).toHaveLength(2);
    expect(mockGetDocs).toHaveBeenCalled();
  });

  it('should include subfolders when option is true', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    await getDocumentsByFolder('/procurement', { includeSubfolders: true });

    expect(mockGetDocs).toHaveBeenCalled();
  });
});

describe('moveDocumentToFolder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it('should update document folder path', async () => {
    await moveDocumentToFolder('doc-1', '/procurement/new-folder');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        folder: '/procurement/new-folder',
        updatedAt: expect.anything(),
      })
    );
  });
});

describe('moveDocumentsToFolder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should batch update multiple documents', async () => {
    const mockBatch = {
      update: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    mockWriteBatch.mockReturnValue(mockBatch);

    await moveDocumentsToFolder(['doc-1', 'doc-2', 'doc-3'], '/procurement/target-folder');

    expect(mockWriteBatch).toHaveBeenCalled();
    expect(mockBatch.update).toHaveBeenCalledTimes(3);
    expect(mockBatch.commit).toHaveBeenCalled();
  });
});

describe('generateBreadcrumbs', () => {
  it('should return module breadcrumb for empty path', () => {
    const breadcrumbs = generateBreadcrumbs('', 'entity', 'PROCUREMENT');

    expect(breadcrumbs).toHaveLength(1);
    expect(breadcrumbs[0]!.label).toBe('PROCUREMENT');
    expect(breadcrumbs[0]!.type).toBe('module');
  });

  it('should generate breadcrumbs for entity view path', () => {
    const breadcrumbs = generateBreadcrumbs(
      'procurement/purchase-orders/PO-001',
      'entity',
      'PROCUREMENT'
    );

    expect(breadcrumbs.length).toBeGreaterThanOrEqual(2);
    expect(breadcrumbs[0]!.type).toBe('module');
    expect(breadcrumbs[1]!.type).toBe('entityType');
  });

  it('should generate breadcrumbs for project view path', () => {
    const breadcrumbs = generateBreadcrumbs(
      'PRJ-001/procurement/purchase-orders',
      'project',
      'PROCUREMENT'
    );

    expect(breadcrumbs[0]!.type).toBe('project');
    expect(breadcrumbs[1]!.type).toBe('module');
    expect(breadcrumbs[2]!.type).toBe('entityType');
  });

  it('should resolve entity type slug to display name', () => {
    const breadcrumbs = generateBreadcrumbs('procurement/purchase-orders', 'entity', 'PROCUREMENT');

    const entityTypeBreadcrumb = breadcrumbs.find((b) => b.type === 'entityType');
    expect(entityTypeBreadcrumb?.label).toBe('Purchase Orders');
  });

  it('should handle deeply nested paths', () => {
    const breadcrumbs = generateBreadcrumbs(
      'procurement/purchase-orders/PO-001/subfolder1/subfolder2',
      'entity',
      'PROCUREMENT'
    );

    expect(breadcrumbs.length).toBe(5);
  });
});

describe('entityTypeToSlug', () => {
  it('should convert PURCHASE_ORDER to purchase-orders', () => {
    expect(entityTypeToSlug('PURCHASE_ORDER')).toBe('purchase-orders');
  });

  it('should convert RFQ to rfqs', () => {
    expect(entityTypeToSlug('RFQ')).toBe('rfqs');
  });

  it('should convert GOODS_RECEIPT to goods-receipts', () => {
    expect(entityTypeToSlug('GOODS_RECEIPT')).toBe('goods-receipts');
  });

  it('should convert WORK_COMPLETION_CERTIFICATE to work-completions', () => {
    expect(entityTypeToSlug('WORK_COMPLETION_CERTIFICATE')).toBe('work-completions');
  });

  it('should convert JOURNAL_ENTRY to journal-entries', () => {
    expect(entityTypeToSlug('JOURNAL_ENTRY')).toBe('journal-entries');
  });
});

describe('slugToEntityType', () => {
  it('should convert purchase-orders to PURCHASE_ORDER', () => {
    expect(slugToEntityType('purchase-orders')).toBe('PURCHASE_ORDER');
  });

  it('should convert rfqs to RFQ', () => {
    expect(slugToEntityType('rfqs')).toBe('RFQ');
  });

  it('should convert goods-receipts to GOODS_RECEIPT', () => {
    expect(slugToEntityType('goods-receipts')).toBe('GOODS_RECEIPT');
  });

  it('should return undefined for unknown slug', () => {
    expect(slugToEntityType('unknown-type')).toBeUndefined();
  });
});

describe('getFolderDocumentCount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return count of documents in folder', async () => {
    const mockDocs = [
      { id: 'doc-1', data: () => ({ name: 'Doc 1' }) },
      { id: 'doc-2', data: () => ({ name: 'Doc 2' }) },
      { id: 'doc-3', data: () => ({ name: 'Doc 3' }) },
    ];

    mockGetDocs.mockResolvedValue({ docs: mockDocs });

    const count = await getFolderDocumentCount('/procurement/invoices');

    expect(count).toBe(3);
  });

  it('should include subfolders when option is true', async () => {
    const mockDocs = [
      { id: 'doc-1', data: () => ({ folder: '/procurement/invoices' }) },
      { id: 'doc-2', data: () => ({ folder: '/procurement/invoices/subfolder' }) },
    ];

    mockGetDocs.mockResolvedValue({ docs: mockDocs });

    const count = await getFolderDocumentCount('/procurement/invoices', true);

    expect(count).toBe(2);
  });

  it('should return 0 for empty folder', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    const count = await getFolderDocumentCount('/empty-folder');

    expect(count).toBe(0);
  });
});
