/**
 * Document Service Tests
 *
 * Tests for core document management functionality:
 * - Document upload with versioning
 * - Document retrieval and search
 * - Version history tracking
 * - Equipment document summaries
 * - Download tracking
 * - Soft delete with authorization
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions */

import {
  uploadDocument,
  getDocumentById,
  searchDocuments,
  getDocumentsByEntity,
  getDocumentsByProject,
  getDocumentVersionHistory,
  getEquipmentDocumentSummary,
  trackDocumentDownload,
  deleteDocument,
} from './documentService';
import type { DocumentUploadRequest, DocumentSearchFilters } from '@vapour/types';
import { PERMISSION_FLAGS } from '@vapour/constants';

// Mock Firebase
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockUploadBytes = jest.fn();
const mockGetDownloadURL = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'mock-collection'),
  doc: jest.fn(() => 'mock-doc-ref'),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  query: jest.fn((...args: unknown[]) => args),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({
      seconds: 1702800000,
      nanoseconds: 0,
      toDate: () => new Date('2024-12-17'),
      toMillis: () => 1702800000000,
    })),
    fromDate: jest.fn((date: Date) => ({
      toMillis: () => date.getTime(),
    })),
  },
}));

jest.mock('firebase/storage', () => ({
  ref: jest.fn(() => ({
    fullPath: 'documents/project-1/procurement/purchase-order/po-1/file.pdf',
  })),
  uploadBytes: (...args: unknown[]) => mockUploadBytes(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
}));

jest.mock('@/lib/firebase', () => ({
  getFirebase: jest.fn(() => ({ db: {}, storage: {} })),
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    DOCUMENTS: 'documents',
  },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('@/lib/firebase/typeHelpers', () => ({
  docToTyped: <T>(id: string, data: unknown): T => ({ id, ...(data as object) }) as T,
}));

jest.mock('@/lib/auth', () => ({
  requireOwnerOrPermission: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const mockFile = {
  name: 'test-document.pdf',
  size: 1024000,
  type: 'application/pdf',
} as File;

describe('uploadDocument', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUploadBytes.mockResolvedValue({ ref: { fullPath: 'documents/test-path/file.pdf' } });
    mockGetDownloadURL.mockResolvedValue('https://storage.example.com/file.pdf');
    mockAddDoc.mockResolvedValue({ id: 'new-doc-1' });
  });

  it('should upload document and create record', async () => {
    const request: DocumentUploadRequest = {
      file: mockFile,
      module: 'PROCUREMENT',
      documentType: 'OTHER',
      projectId: 'project-1',
      entityType: 'PURCHASE_ORDER',
      entityId: 'po-1',
    };

    const result = await uploadDocument(request, 'user-1', 'Test User');

    expect(result.id).toBe('new-doc-1');
    expect(result.fileName).toBe('test-document.pdf');
    expect(result.module).toBe('PROCUREMENT');
    expect(result.entityType).toBe('PURCHASE_ORDER');
    expect(result.uploadedBy).toBe('user-1');
    expect(result.version).toBe(1);
    expect(result.isLatest).toBe(true);
    expect(mockUploadBytes).toHaveBeenCalled();
    expect(mockAddDoc).toHaveBeenCalled();
  });

  it('should handle versioning for new version uploads', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ version: 2 }),
    });
    mockUpdateDoc.mockResolvedValue(undefined);

    const request: DocumentUploadRequest = {
      file: mockFile,
      module: 'PROCUREMENT',
      documentType: 'OTHER',
      projectId: 'project-1',
      entityType: 'PURCHASE_ORDER',
      entityId: 'po-1',
      isNewVersion: true,
      previousVersionId: 'prev-doc-1',
    };

    const result = await uploadDocument(request, 'user-1', 'Test User');

    expect(result.version).toBe(3);
    expect(result.previousVersionId).toBe('prev-doc-1');
    expect(mockUpdateDoc).toHaveBeenCalled(); // Previous version marked superseded
  });

  it('should set default visibility to PROJECT_TEAM', async () => {
    const request: DocumentUploadRequest = {
      file: mockFile,
      module: 'PROCUREMENT',
      documentType: 'OTHER',
      projectId: 'project-1',
      entityType: 'PURCHASE_ORDER',
      entityId: 'po-1',
    };

    const result = await uploadDocument(request, 'user-1', 'Test User');

    expect(result.visibility).toBe('PROJECT_TEAM');
  });

  it('should include optional fields when provided', async () => {
    const request: DocumentUploadRequest = {
      file: mockFile,
      module: 'PROCUREMENT',
      documentType: 'OTHER',
      projectId: 'project-1',
      equipmentId: 'equip-1',
      entityType: 'PURCHASE_ORDER',
      entityId: 'po-1',
      title: 'Custom Title',
      description: 'Custom description',
      tags: ['important', 'urgent'],
      folder: '/procurement/purchase-orders/po-1/contracts',
      revisionNotes: 'Updated pricing',
    };

    const result = await uploadDocument(request, 'user-1', 'Test User');

    expect(result.title).toBe('Custom Title');
    expect(result.description).toBe('Custom description');
    expect(result.tags).toEqual(['important', 'urgent']);
    expect(result.folder).toBe('/procurement/purchase-orders/po-1/contracts');
    expect(result.revisionNotes).toBe('Updated pricing');
    expect(result.equipmentId).toBe('equip-1');
  });

  it('should throw error on upload failure', async () => {
    mockUploadBytes.mockRejectedValue(new Error('Storage error'));

    const request: DocumentUploadRequest = {
      file: mockFile,
      module: 'PROCUREMENT',
      documentType: 'OTHER',
      projectId: 'project-1',
      entityType: 'PURCHASE_ORDER',
      entityId: 'po-1',
    };

    await expect(uploadDocument(request, 'user-1', 'Test User')).rejects.toThrow('Storage error');
  });
});

describe('getDocumentById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return document when found', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'doc-1',
      data: () => ({
        fileName: 'test.pdf',
        module: 'PROCUREMENT',
        status: 'ACTIVE',
      }),
    });

    const result = await getDocumentById('doc-1');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('doc-1');
    expect(result!.fileName).toBe('test.pdf');
  });

  it('should return null when document not found', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    const result = await getDocumentById('non-existent');

    expect(result).toBeNull();
  });
});

// Helper to create mock snapshot with forEach
function createMockSnapshot(docs: Array<{ id: string; data: () => unknown }>) {
  return {
    docs,
    forEach: (callback: (doc: { id: string; data: () => unknown }) => void) => {
      docs.forEach(callback);
    },
  };
}

describe('searchDocuments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return documents matching filters', async () => {
    const mockDocs = [
      {
        id: 'doc-1',
        data: () => ({
          fileName: 'invoice.pdf',
          module: 'ACCOUNTING',
          status: 'ACTIVE',
          tags: ['finance'],
          uploadedAt: { toMillis: () => 1702800000000 },
        }),
      },
      {
        id: 'doc-2',
        data: () => ({
          fileName: 'receipt.pdf',
          module: 'ACCOUNTING',
          status: 'ACTIVE',
          tags: ['finance'],
          uploadedAt: { toMillis: () => 1702700000000 },
        }),
      },
    ];

    mockGetDocs.mockResolvedValue(createMockSnapshot(mockDocs));

    const filters: DocumentSearchFilters = {
      module: 'ACCOUNTING',
      status: 'ACTIVE',
    };

    const result = await searchDocuments(filters);

    expect(result.documents).toHaveLength(2);
    expect(result.totalCount).toBe(2);
  });

  it('should filter by search text client-side', async () => {
    const mockDocs = [
      {
        id: 'doc-1',
        data: () => ({
          fileName: 'invoice-2024.pdf',
          title: 'Invoice 2024',
          description: '',
          module: 'ACCOUNTING',
          tags: [],
          uploadedAt: { toMillis: () => 1702800000000 },
        }),
      },
      {
        id: 'doc-2',
        data: () => ({
          fileName: 'contract.pdf',
          title: 'Vendor Contract',
          description: '',
          module: 'ACCOUNTING',
          tags: [],
          uploadedAt: { toMillis: () => 1702700000000 },
        }),
      },
    ];

    mockGetDocs.mockResolvedValue(createMockSnapshot(mockDocs));

    const filters: DocumentSearchFilters = {
      module: 'ACCOUNTING',
      searchText: 'invoice',
    };

    const result = await searchDocuments(filters);

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]!.fileName).toBe('invoice-2024.pdf');
  });

  it('should filter by tags client-side', async () => {
    const mockDocs = [
      {
        id: 'doc-1',
        data: () => ({
          fileName: 'doc1.pdf',
          module: 'ACCOUNTING',
          tags: ['important', 'urgent'],
          uploadedAt: { toMillis: () => 1702800000000 },
        }),
      },
      {
        id: 'doc-2',
        data: () => ({
          fileName: 'doc2.pdf',
          module: 'ACCOUNTING',
          tags: ['routine'],
          uploadedAt: { toMillis: () => 1702700000000 },
        }),
      },
    ];

    mockGetDocs.mockResolvedValue(createMockSnapshot(mockDocs));

    const filters: DocumentSearchFilters = {
      module: 'ACCOUNTING',
      tags: ['important'],
    };

    const result = await searchDocuments(filters);

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]!.tags).toContain('important');
  });

  it('should handle date range filters', async () => {
    // Dec 17 2024 = 1702771200000
    // Dec 18 timestamp should be higher than Dec 17
    const dec18Millis = 1702900000000; // Dec 18
    const dec14Millis = 1702500000000; // Dec 14
    const dec17Millis = 1702771200000; // Dec 17

    const mockDocs = [
      {
        id: 'doc-1',
        data: () => ({
          fileName: 'recent.pdf',
          module: 'ACCOUNTING',
          tags: [],
          uploadedAt: { toMillis: () => dec18Millis },
        }),
      },
      {
        id: 'doc-2',
        data: () => ({
          fileName: 'old.pdf',
          module: 'ACCOUNTING',
          tags: [],
          uploadedAt: { toMillis: () => dec14Millis },
        }),
      },
    ];

    mockGetDocs.mockResolvedValue(createMockSnapshot(mockDocs));

    const filters: DocumentSearchFilters = {
      module: 'ACCOUNTING',
      uploadedAfter: new Date(dec17Millis), // Dec 17
    };

    const result = await searchDocuments(filters);

    // Recent doc (Dec 18) should pass, old doc (Dec 14) should not
    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]!.fileName).toBe('recent.pdf');
  });

  it('should determine hasMore correctly with limit', async () => {
    const mockDocs = Array.from({ length: 10 }, (_, i) => ({
      id: `doc-${i}`,
      data: () => ({
        fileName: `file-${i}.pdf`,
        module: 'ACCOUNTING',
        tags: [],
        uploadedAt: { toMillis: () => 1702800000000 - i * 1000 },
      }),
    }));

    mockGetDocs.mockResolvedValue(createMockSnapshot(mockDocs));

    const filters: DocumentSearchFilters = {
      module: 'ACCOUNTING',
      limit: 10,
    };

    const result = await searchDocuments(filters);

    expect(result.hasMore).toBe(true);
  });
});

describe('getDocumentsByEntity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return documents for specific entity', async () => {
    const mockDocs = [
      {
        id: 'doc-1',
        data: () => ({
          fileName: 'po-attachment.pdf',
          entityType: 'PURCHASE_ORDER',
          entityId: 'po-123',
          tags: [],
          uploadedAt: { toMillis: () => 1702800000000 },
        }),
      },
    ];

    mockGetDocs.mockResolvedValue(createMockSnapshot(mockDocs));

    const result = await getDocumentsByEntity('PURCHASE_ORDER', 'po-123');

    expect(result).toHaveLength(1);
    expect(result[0]!.entityType).toBe('PURCHASE_ORDER');
    expect(result[0]!.entityId).toBe('po-123');
  });
});

describe('getDocumentsByProject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return documents for project', async () => {
    const mockDocs = [
      {
        id: 'doc-1',
        data: () => ({
          fileName: 'project-doc.pdf',
          projectId: 'proj-1',
          tags: [],
          uploadedAt: { toMillis: () => 1702800000000 },
        }),
      },
      {
        id: 'doc-2',
        data: () => ({
          fileName: 'project-doc-2.pdf',
          projectId: 'proj-1',
          tags: [],
          uploadedAt: { toMillis: () => 1702700000000 },
        }),
      },
    ];

    mockGetDocs.mockResolvedValue(createMockSnapshot(mockDocs));

    const result = await getDocumentsByProject('proj-1');

    expect(result).toHaveLength(2);
  });

  it('should filter by equipment when provided', async () => {
    const mockDocs = [
      {
        id: 'doc-1',
        data: () => ({
          fileName: 'equipment-doc.pdf',
          projectId: 'proj-1',
          equipmentId: 'equip-1',
          tags: [],
          uploadedAt: { toMillis: () => 1702800000000 },
        }),
      },
    ];

    mockGetDocs.mockResolvedValue(createMockSnapshot(mockDocs));

    const result = await getDocumentsByProject('proj-1', 'equip-1');

    expect(result).toHaveLength(1);
    expect(result[0]!.equipmentId).toBe('equip-1');
  });
});

describe('getDocumentVersionHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return version history chain', async () => {
    // Current version (v3)
    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        id: 'doc-v3',
        data: () => ({
          version: 3,
          isLatest: true,
          previousVersionId: 'doc-v2',
        }),
      })
      // Previous version (v2)
      .mockResolvedValueOnce({
        exists: () => true,
        id: 'doc-v2',
        data: () => ({
          version: 2,
          isLatest: false,
          previousVersionId: 'doc-v1',
        }),
      })
      // First version (v1)
      .mockResolvedValueOnce({
        exists: () => true,
        id: 'doc-v1',
        data: () => ({
          version: 1,
          isLatest: false,
        }),
      });

    const result = await getDocumentVersionHistory('doc-v3');

    expect(result.totalVersions).toBe(3);
    expect(result.allVersions[0]!.version).toBe(3);
    expect(result.allVersions[2]!.version).toBe(1);
    expect(result.currentVersion.isLatest).toBe(true);
  });

  it('should throw error when document not found', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    await expect(getDocumentVersionHistory('non-existent')).rejects.toThrow('Document not found');
  });
});

describe('getEquipmentDocumentSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return document summary by entity type', async () => {
    const mockDocs = [
      {
        id: 'doc-1',
        data: () => ({
          entityType: 'PURCHASE_REQUEST',
          projectId: 'proj-1',
          equipmentId: 'equip-1',
          projectName: 'Test Project',
          equipmentCode: 'EQ-001',
          equipmentName: 'Pump',
          tags: [],
          uploadedAt: { toMillis: () => 1702800000000 },
        }),
      },
      {
        id: 'doc-2',
        data: () => ({
          entityType: 'PURCHASE_ORDER',
          projectId: 'proj-1',
          equipmentId: 'equip-1',
          tags: [],
          uploadedAt: { toMillis: () => 1702700000000 },
        }),
      },
      {
        id: 'doc-3',
        data: () => ({
          entityType: 'PURCHASE_ORDER',
          projectId: 'proj-1',
          equipmentId: 'equip-1',
          tags: [],
          uploadedAt: { toMillis: () => 1702600000000 },
        }),
      },
      {
        id: 'doc-4',
        data: () => ({
          entityType: 'GOODS_RECEIPT',
          projectId: 'proj-1',
          equipmentId: 'equip-1',
          tags: [],
          uploadedAt: { toMillis: () => 1702500000000 },
        }),
      },
    ];

    mockGetDocs.mockResolvedValue(createMockSnapshot(mockDocs));

    const result = await getEquipmentDocumentSummary('proj-1', 'equip-1');

    expect(result.totalDocuments).toBe(4);
    expect(result.purchaseRequestDocs).toBe(1);
    expect(result.purchaseOrderDocs).toBe(2);
    expect(result.receiptDocs).toBe(1);
    expect(result.rfqDocs).toBe(0);
    expect(result.equipmentId).toBe('equip-1');
    expect(result.projectId).toBe('proj-1');
  });
});

describe('trackDocumentDownload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should increment download count', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ downloadCount: 5 }),
    });
    mockUpdateDoc.mockResolvedValue(undefined);

    await trackDocumentDownload('doc-1', 'user-1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        downloadCount: 6,
        lastDownloadedBy: 'user-1',
        lastDownloadedAt: expect.anything(),
      })
    );
  });

  it('should not throw on failure (tracking is non-critical)', async () => {
    mockGetDoc.mockRejectedValue(new Error('Network error'));

    await expect(trackDocumentDownload('doc-1', 'user-1')).resolves.toBeUndefined();
  });

  it('should handle documents with no previous downloads', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({}), // No downloadCount field
    });
    mockUpdateDoc.mockResolvedValue(undefined);

    await trackDocumentDownload('doc-1', 'user-1');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        downloadCount: 1,
      })
    );
  });
});

describe('deleteDocument', () => {
  const { requireOwnerOrPermission } = jest.requireMock('@/lib/auth');

  beforeEach(() => {
    jest.clearAllMocks();
    requireOwnerOrPermission.mockImplementation(() => {}); // Allow by default
  });

  it('should soft delete document', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'doc-1',
      data: () => ({
        uploadedBy: 'user-1',
        status: 'ACTIVE',
      }),
    });
    mockUpdateDoc.mockResolvedValue(undefined);

    await deleteDocument('doc-1', 'user-1', PERMISSION_FLAGS.MANAGE_DOCUMENTS);

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'DELETED',
        deletedBy: 'user-1',
        deletedAt: expect.anything(),
      })
    );
  });

  it('should include deletion reason when provided', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'doc-1',
      data: () => ({
        uploadedBy: 'user-1',
        status: 'ACTIVE',
      }),
    });
    mockUpdateDoc.mockResolvedValue(undefined);

    await deleteDocument(
      'doc-1',
      'user-1',
      PERMISSION_FLAGS.MANAGE_DOCUMENTS,
      'Duplicate document'
    );

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        deletionReason: 'Duplicate document',
      })
    );
  });

  it('should check authorization', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      id: 'doc-1',
      data: () => ({
        uploadedBy: 'other-user',
        status: 'ACTIVE',
      }),
    });

    await deleteDocument('doc-1', 'user-1', 0);

    expect(requireOwnerOrPermission).toHaveBeenCalledWith(
      'user-1',
      'other-user',
      0,
      PERMISSION_FLAGS.MANAGE_DOCUMENTS,
      'delete document'
    );
  });

  it('should throw when document not found', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    await expect(deleteDocument('non-existent', 'user-1', 0)).rejects.toThrow('Document not found');
  });
});
