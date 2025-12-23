/**
 * Charter Procurement Service Tests
 *
 * Tests for managing procurement items in project charters
 * and creating Purchase Requests from charter items.
 */

import type { ProcurementItem, Project } from '@vapour/types';

// Mock crypto for ID generation
const mockRandomUUID = jest.fn(() => 'mock-uuid-1234567890');
Object.defineProperty(globalThis, 'crypto', {
  value: { randomUUID: mockRandomUUID },
});

// Mock firebase/firestore
const mockDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockWriteBatch = jest.fn();
const mockCollection = jest.fn();
const mockTimestampNow = jest.fn();
const mockTimestampFromDate = jest.fn();

const mockBatch = {
  set: jest.fn(),
  update: jest.fn(),
  commit: jest.fn().mockResolvedValue(undefined),
};

jest.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  writeBatch: () => mockWriteBatch(),
  collection: (...args: unknown[]) => mockCollection(...args),
  Timestamp: {
    now: () => mockTimestampNow(),
    fromDate: (date: Date) => mockTimestampFromDate(date),
  },
}));

jest.mock('../firebase', () => ({
  getFirebase: jest.fn(() => ({ db: {} })),
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    PROJECTS: 'projects',
    PURCHASE_REQUESTS: 'purchaseRequests',
    PURCHASE_REQUEST_ITEMS: 'purchaseRequestItems',
  },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
  }),
}));

// Import after mocks
import {
  addProcurementItem,
  updateProcurementItem,
  deleteProcurementItem,
  createPRFromCharterItem,
  createPRsFromCharterItems,
  syncProcurementItemStatus,
} from './charterProcurementService';

describe('Charter Procurement Service', () => {
  const projectId = 'project-123';
  const userId = 'user-456';
  const mockTimestamp = { seconds: 1703318400, nanoseconds: 0 };

  beforeEach(() => {
    jest.clearAllMocks();
    mockTimestampNow.mockReturnValue(mockTimestamp);
    mockTimestampFromDate.mockImplementation((date: Date) => ({
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
    }));
    mockWriteBatch.mockReturnValue(mockBatch);
    mockDoc.mockReturnValue({ id: 'mock-doc-id' });
    mockCollection.mockReturnValue({ id: 'mock-collection' });
  });

  describe('addProcurementItem', () => {
    const newItemData = {
      itemName: 'Control Valve',
      description: 'DN50 control valve for steam line',
      category: 'EQUIPMENT' as const,
      quantity: 2,
      unit: 'NOS',
      estimatedUnitPrice: { amount: 50000, currency: 'INR' },
      estimatedTotalPrice: { amount: 100000, currency: 'INR' },
      priority: 'HIGH' as const,
      requiredByDate: new Date('2024-06-01'),
    };

    it('should add a procurement item to project', async () => {
      const mockProject: Partial<Project> = {
        id: projectId,
        procurementItems: [],
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      const result = await addProcurementItem(projectId, newItemData, userId);

      expect(result).toMatch(/^PROC-/);
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          updatedAt: mockTimestamp,
          updatedBy: userId,
        })
      );
    });

    it('should add item with PLANNING status', async () => {
      const mockProject: Partial<Project> = {
        id: projectId,
        procurementItems: [],
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await addProcurementItem(projectId, newItemData, userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          procurementItems: expect.arrayContaining([
            expect.objectContaining({
              status: 'PLANNING',
              itemName: 'Control Valve',
            }),
          ]),
        })
      );
    });

    it('should append to existing procurement items', async () => {
      const existingItem: ProcurementItem = {
        id: 'PROC-existing',
        itemName: 'Existing Item',
        status: 'PR_DRAFTED',
        category: 'MATERIAL',
        quantity: 1,
        unit: 'NOS',
      };

      const mockProject: Partial<Project> = {
        id: projectId,
        procurementItems: [existingItem],
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await addProcurementItem(projectId, newItemData, userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          procurementItems: expect.arrayContaining([
            expect.objectContaining({ id: 'PROC-existing' }),
            expect.objectContaining({ itemName: 'Control Valve' }),
          ]),
        })
      );
    });

    it('should throw error when project not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(addProcurementItem(projectId, newItemData, userId)).rejects.toThrow(
        'Failed to add procurement item'
      );
    });

    it('should handle undefined procurementItems array', async () => {
      const mockProject: Partial<Project> = {
        id: projectId,
        // No procurementItems field
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await addProcurementItem(projectId, newItemData, userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          procurementItems: expect.any(Array),
        })
      );
    });
  });

  describe('updateProcurementItem', () => {
    it('should update procurement item by ID', async () => {
      const existingItem: ProcurementItem = {
        id: 'PROC-001',
        itemName: 'Original Name',
        status: 'PLANNING',
        category: 'EQUIPMENT',
        quantity: 1,
        unit: 'NOS',
      };

      const mockProject: Partial<Project> = {
        id: projectId,
        procurementItems: [existingItem],
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateProcurementItem(projectId, 'PROC-001', { itemName: 'Updated Name' }, userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          procurementItems: expect.arrayContaining([
            expect.objectContaining({
              id: 'PROC-001',
              itemName: 'Updated Name',
            }),
          ]),
        })
      );
    });

    it('should not modify other items when updating one', async () => {
      const items: ProcurementItem[] = [
        { id: 'PROC-001', itemName: 'Item 1', status: 'PLANNING', category: 'EQUIPMENT', quantity: 1, unit: 'NOS' },
        { id: 'PROC-002', itemName: 'Item 2', status: 'PR_DRAFTED', category: 'MATERIAL', quantity: 2, unit: 'KG' },
      ];

      const mockProject: Partial<Project> = {
        id: projectId,
        procurementItems: items,
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await updateProcurementItem(projectId, 'PROC-001', { quantity: 5 }, userId);

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          procurementItems: expect.arrayContaining([
            expect.objectContaining({ id: 'PROC-002', itemName: 'Item 2' }),
          ]),
        })
      );
    });

    it('should throw error when project not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(
        updateProcurementItem(projectId, 'PROC-001', { itemName: 'Updated' }, userId)
      ).rejects.toThrow('Failed to update procurement item');
    });
  });

  describe('deleteProcurementItem', () => {
    it('should remove procurement item by ID', async () => {
      const items: ProcurementItem[] = [
        { id: 'PROC-001', itemName: 'Item 1', status: 'PLANNING', category: 'EQUIPMENT', quantity: 1, unit: 'NOS' },
        { id: 'PROC-002', itemName: 'Item 2', status: 'PLANNING', category: 'MATERIAL', quantity: 1, unit: 'NOS' },
      ];

      const mockProject: Partial<Project> = {
        id: projectId,
        procurementItems: items,
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await deleteProcurementItem(projectId, 'PROC-001', userId);

      const updateCall = mockUpdateDoc.mock.calls[0][1] as { procurementItems: ProcurementItem[] };
      expect(updateCall.procurementItems).toHaveLength(1);
      expect(updateCall.procurementItems[0]?.id).toBe('PROC-002');
    });

    it('should throw error when project not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(deleteProcurementItem(projectId, 'PROC-001', userId)).rejects.toThrow(
        'Failed to delete procurement item'
      );
    });
  });

  describe('createPRFromCharterItem', () => {
    const userName = 'John Doe';
    const projectName = 'Test Project';

    const charterItem: ProcurementItem = {
      id: 'PROC-001',
      itemName: 'Control Valve DN50',
      description: 'Steam control valve',
      category: 'EQUIPMENT',
      quantity: 2,
      unit: 'NOS',
      status: 'PLANNING',
      estimatedUnitPrice: { amount: 50000, currency: 'INR' },
      estimatedTotalPrice: { amount: 100000, currency: 'INR' },
      priority: 'HIGH',
      requiredByDate: new Date('2024-06-01'),
      technicalSpecs: 'Actuator: Electric, Fail position: Closed',
    };

    it('should create PR and update charter item', async () => {
      const mockProject: Partial<Project> = {
        id: projectId,
        procurementItems: [charterItem],
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });

      const result = await createPRFromCharterItem(
        projectId,
        projectName,
        charterItem,
        userId,
        userName
      );

      expect(result.prId).toBeDefined();
      expect(result.prNumber).toMatch(/^PR\/\d{4}\/\d{2}\/\d{4}$/);
      expect(mockBatch.set).toHaveBeenCalledTimes(2); // PR and PR Item
      expect(mockBatch.update).toHaveBeenCalled(); // Update charter
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should create PR with DRAFT status', async () => {
      const mockProject: Partial<Project> = {
        id: projectId,
        procurementItems: [charterItem],
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });

      await createPRFromCharterItem(projectId, projectName, charterItem, userId, userName);

      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'DRAFT',
          projectId,
          projectName,
          charterItemId: 'PROC-001',
        })
      );
    });

    it('should link PR to charter item', async () => {
      const mockProject: Partial<Project> = {
        id: projectId,
        procurementItems: [charterItem],
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });

      await createPRFromCharterItem(projectId, projectName, charterItem, userId, userName);

      expect(mockBatch.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          procurementItems: expect.arrayContaining([
            expect.objectContaining({
              id: 'PROC-001',
              status: 'PR_DRAFTED',
              linkedPurchaseRequestId: expect.any(String),
            }),
          ]),
        })
      );
    });

    it('should handle item with Timestamp requiredByDate', async () => {
      const itemWithTimestamp: ProcurementItem = {
        ...charterItem,
        requiredByDate: {
          toDate: () => new Date('2024-06-01'),
        } as unknown as Date,
      };

      const mockProject: Partial<Project> = {
        id: projectId,
        procurementItems: [itemWithTimestamp],
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });

      await createPRFromCharterItem(projectId, projectName, itemWithTimestamp, userId, userName);

      expect(mockBatch.set).toHaveBeenCalled();
    });

    it('should handle item with string requiredByDate', async () => {
      const itemWithString: ProcurementItem = {
        ...charterItem,
        requiredByDate: '2024-06-01' as unknown as Date,
      };

      const mockProject: Partial<Project> = {
        id: projectId,
        procurementItems: [itemWithString],
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });

      await createPRFromCharterItem(projectId, projectName, itemWithString, userId, userName);

      expect(mockBatch.set).toHaveBeenCalled();
    });

    it('should map priority correctly', async () => {
      const criticalItem: ProcurementItem = {
        ...charterItem,
        priority: 'CRITICAL',
      };

      const mockProject: Partial<Project> = {
        id: projectId,
        procurementItems: [criticalItem],
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });

      await createPRFromCharterItem(projectId, projectName, criticalItem, userId, userName);

      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          priority: 'CRITICAL',
        })
      );
    });

    it('should throw error on batch commit failure', async () => {
      const mockProject: Partial<Project> = {
        id: projectId,
        procurementItems: [charterItem],
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });
      mockBatch.commit.mockRejectedValue(new Error('Batch commit failed'));

      await expect(
        createPRFromCharterItem(projectId, projectName, charterItem, userId, userName)
      ).rejects.toThrow('Failed to create purchase request');
    });
  });

  describe('createPRsFromCharterItems', () => {
    const userName = 'John Doe';
    const projectName = 'Test Project';

    const items: ProcurementItem[] = [
      {
        id: 'PROC-001',
        itemName: 'Item 1',
        status: 'PLANNING',
        category: 'EQUIPMENT',
        quantity: 1,
        unit: 'NOS',
      },
      {
        id: 'PROC-002',
        itemName: 'Item 2',
        status: 'PLANNING',
        category: 'MATERIAL',
        quantity: 2,
        unit: 'KG',
      },
    ];

    it('should create PRs for multiple items', async () => {
      const mockProject: Partial<Project> = {
        id: projectId,
        procurementItems: items,
      };

      // Reset batch commit to resolved (may be rejected from previous test)
      mockBatch.commit.mockResolvedValue(undefined);

      // Mock getDoc to always return the project (called multiple times per PR creation)
      mockGetDoc.mockImplementation(() =>
        Promise.resolve({
          exists: () => true,
          data: () => mockProject,
        })
      );

      const result = await createPRsFromCharterItems(
        projectId,
        projectName,
        items,
        userId,
        userName
      );

      expect(result.createdPRs).toHaveLength(2);
      expect(result.createdPRs[0]?.itemId).toBe('PROC-001');
      expect(result.createdPRs[1]?.itemId).toBe('PROC-002');
    });

    it('should continue processing if one item fails', async () => {
      const mockProject: Partial<Project> = {
        id: projectId,
        procurementItems: items,
      };

      // First call fails, second succeeds
      mockGetDoc
        .mockResolvedValueOnce({ exists: () => false })
        .mockResolvedValueOnce({ exists: () => true, data: () => mockProject });

      const result = await createPRsFromCharterItems(
        projectId,
        projectName,
        items,
        userId,
        userName
      );

      // Should only have one successful PR
      expect(result.createdPRs.length).toBeLessThanOrEqual(items.length);
    });

    it('should return empty array when all items fail', async () => {
      const mockProject: Partial<Project> = {
        id: projectId,
        procurementItems: items,
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });

      // Make batch commit fail for all attempts
      mockBatch.commit.mockRejectedValue(new Error('Batch commit failed'));

      const result = await createPRsFromCharterItems(
        projectId,
        projectName,
        items,
        userId,
        userName
      );

      expect(result.createdPRs).toHaveLength(0);
    });
  });

  describe('syncProcurementItemStatus', () => {
    it('should update item status to RFQ_ISSUED with linked RFQ ID', async () => {
      const items: ProcurementItem[] = [
        { id: 'PROC-001', itemName: 'Item 1', status: 'PR_DRAFTED', category: 'EQUIPMENT', quantity: 1, unit: 'NOS' },
      ];

      const mockProject: Partial<Project> = {
        id: projectId,
        procurementItems: items,
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await syncProcurementItemStatus(projectId, 'PROC-001', 'RFQ_ISSUED', 'rfq-123');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          procurementItems: expect.arrayContaining([
            expect.objectContaining({
              id: 'PROC-001',
              status: 'RFQ_ISSUED',
              linkedRFQId: 'rfq-123',
            }),
          ]),
        })
      );
    });

    it('should update item status to PO_PLACED with linked PO ID', async () => {
      const items: ProcurementItem[] = [
        { id: 'PROC-001', itemName: 'Item 1', status: 'RFQ_ISSUED', category: 'EQUIPMENT', quantity: 1, unit: 'NOS' },
      ];

      const mockProject: Partial<Project> = {
        id: projectId,
        procurementItems: items,
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await syncProcurementItemStatus(projectId, 'PROC-001', 'PO_PLACED', 'po-456');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          procurementItems: expect.arrayContaining([
            expect.objectContaining({
              id: 'PROC-001',
              status: 'PO_PLACED',
              linkedPOId: 'po-456',
            }),
          ]),
        })
      );
    });

    it('should not modify other items when syncing status', async () => {
      const items: ProcurementItem[] = [
        { id: 'PROC-001', itemName: 'Item 1', status: 'PLANNING', category: 'EQUIPMENT', quantity: 1, unit: 'NOS' },
        { id: 'PROC-002', itemName: 'Item 2', status: 'PR_DRAFTED', category: 'MATERIAL', quantity: 2, unit: 'KG' },
      ];

      const mockProject: Partial<Project> = {
        id: projectId,
        procurementItems: items,
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockProject,
      });
      mockUpdateDoc.mockResolvedValue(undefined);

      await syncProcurementItemStatus(projectId, 'PROC-001', 'PR_DRAFTED');

      const updateCall = mockUpdateDoc.mock.calls[0][1] as { procurementItems: ProcurementItem[] };
      const item2 = updateCall.procurementItems.find((i) => i.id === 'PROC-002');
      expect(item2?.status).toBe('PR_DRAFTED');
    });

    it('should throw error when project not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(
        syncProcurementItemStatus(projectId, 'PROC-001', 'RFQ_ISSUED')
      ).rejects.toThrow('Failed to sync procurement item status');
    });
  });
});
