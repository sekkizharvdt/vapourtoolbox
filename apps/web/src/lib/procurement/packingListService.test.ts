/**
 * Packing List Service Tests
 *
 * Tests for packing list CRUD operations and status management
 */

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    PURCHASE_ORDERS: 'purchaseOrders',
    PURCHASE_ORDER_ITEMS: 'purchaseOrderItems',
    PACKING_LISTS: 'packingLists',
    PACKING_LIST_ITEMS: 'packingListItems',
    COUNTERS: 'counters',
  },
}));

// Mock getFirebase
const mockDb = {};
jest.mock('@/lib/firebase', () => ({
  getFirebase: () => ({ db: mockDb }),
}));

// Mock audit module
jest.mock('@/lib/audit', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
  createAuditContext: jest
    .fn()
    .mockReturnValue({ userId: 'user-123', email: '', displayName: 'Test User' }),
}));

// Mock Firebase Firestore
const mockAddDoc = jest.fn().mockResolvedValue({ id: 'new-pl-id' });
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockUpdateDoc = jest.fn();
const mockWriteBatch = jest.fn(() => ({
  set: jest.fn(),
  commit: jest.fn().mockResolvedValue(undefined),
}));
const mockRunTransaction = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, collectionName) => ({ path: collectionName })),
  doc: jest.fn((_db, _collection, id) => ({ id, path: `collection/${id}` })),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  writeBatch: () => mockWriteBatch(),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  query: jest.fn((...args) => args),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  orderBy: jest.fn((field, direction) => ({ field, direction })),
  Timestamp: {
    now: jest.fn(() => ({
      seconds: Date.now() / 1000,
      nanoseconds: 0,
      toDate: () => new Date(),
    })),
    fromDate: jest.fn((date: Date) => ({
      seconds: date.getTime() / 1000,
      nanoseconds: 0,
      toDate: () => date,
    })),
  },
}));

// Mock logger
jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

import {
  createPackingList,
  updatePackingListStatus,
  getPLById,
  getPLItems,
  listPackingLists,
  getPackingListsByPO,
  type CreatePackingListInput,
} from './packingListService';

describe('packingListService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockPO = {
    id: 'po-123',
    number: 'PO/2024/01/0001',
    vendorId: 'vendor-123',
    vendorName: 'Test Vendor',
    status: 'APPROVED',
  };

  const mockPOItems = [
    {
      id: 'poi-1',
      purchaseOrderId: 'po-123',
      description: 'Water Pump',
      quantity: 10,
      unit: 'NOS',
      equipmentId: 'eq-1',
      equipmentCode: 'WP-001',
    },
    {
      id: 'poi-2',
      purchaseOrderId: 'po-123',
      description: 'Filter',
      quantity: 20,
      unit: 'NOS',
    },
  ];

  // ============================================================================
  // CREATE PACKING LIST
  // ============================================================================
  describe('createPackingList', () => {
    const validInput: CreatePackingListInput = {
      purchaseOrderId: 'po-123',
      projectId: 'project-123',
      projectName: 'Test Project',
      numberOfPackages: 2,
      totalWeight: 150,
      totalVolume: 5,
      shippingMethod: 'ROAD',
      shippingCompany: 'Blue Dart',
      trackingNumber: 'BD123456',
      estimatedDeliveryDate: new Date('2024-02-15'),
      deliveryAddress: '123 Site Street, Chennai',
      contactPerson: 'John Doe',
      contactPhone: '+91 9876543210',
      packingInstructions: 'Handle with care',
      handlingInstructions: 'Keep dry',
      items: [
        { poItemId: 'poi-1', quantity: 5, packageNumber: 'PKG-001', weight: 50 },
        {
          poItemId: 'poi-2',
          quantity: 10,
          packageNumber: 'PKG-002',
          weight: 30,
          dimensions: '50x30x20cm',
        },
      ],
    };

    it('should create a packing list when PO exists', async () => {
      // Mock PO exists
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: mockPO.id,
        data: () => mockPO,
      });

      // Mock PL number generation
      mockRunTransaction.mockResolvedValueOnce('PL/2024/01/0001');

      // Mock PO items query
      mockGetDocs.mockResolvedValueOnce({
        docs: mockPOItems.map((item) => ({
          id: item.id,
          data: () => item,
        })),
      });

      const plId = await createPackingList(validInput, 'user-123', 'Test User');

      expect(plId).toBe('new-pl-id');
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          purchaseOrderId: 'po-123',
          poNumber: mockPO.number,
          vendorId: mockPO.vendorId,
          vendorName: mockPO.vendorName,
          projectId: 'project-123',
          projectName: 'Test Project',
          numberOfPackages: 2,
          status: 'DRAFT',
        })
      );
    });

    it('should throw error when PO does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      await expect(createPackingList(validInput, 'user-123', 'Test User')).rejects.toThrow(
        'Purchase Order not found'
      );

      expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it('should create packing list with minimal required fields', async () => {
      const minimalInput: CreatePackingListInput = {
        purchaseOrderId: 'po-123',
        projectId: 'project-123',
        projectName: 'Test Project',
        numberOfPackages: 1,
        deliveryAddress: '123 Test Address',
        items: [{ poItemId: 'poi-1', quantity: 5, packageNumber: 'PKG-001' }],
      };

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: mockPO.id,
        data: () => mockPO,
      });
      mockRunTransaction.mockResolvedValueOnce('PL/2024/01/0002');
      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: 'poi-1', data: () => mockPOItems[0] }],
      });

      const plId = await createPackingList(minimalInput, 'user-123', 'Test User');

      expect(plId).toBe('new-pl-id');
      // Verify optional fields are not included
      const addDocCall = mockAddDoc.mock.calls[0]?.[1];
      expect(addDocCall?.totalWeight).toBeUndefined();
      expect(addDocCall?.shippingMethod).toBeUndefined();
    });
  });

  // ============================================================================
  // UPDATE PACKING LIST STATUS
  // ============================================================================
  describe('updatePackingListStatus', () => {
    const mockPL = {
      id: 'pl-123',
      number: 'PL/2024/01/0001',
      purchaseOrderId: 'po-123',
      poNumber: 'PO/2024/01/0001',
      vendorName: 'Test Vendor',
      status: 'DRAFT',
    };

    it('should update status to FINALIZED', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: mockPL.id,
        data: () => mockPL,
      });

      await updatePackingListStatus('pl-123', 'FINALIZED', 'user-123', 'Test User');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'FINALIZED',
        })
      );
    });

    it('should add shippedDate when status is SHIPPED', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: mockPL.id,
        data: () => mockPL,
      });

      await updatePackingListStatus('pl-123', 'SHIPPED', 'user-123');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'SHIPPED',
          shippedDate: expect.anything(),
        })
      );
    });

    it('should add actualDeliveryDate when status is DELIVERED', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: mockPL.id,
        data: () => mockPL,
      });

      await updatePackingListStatus('pl-123', 'DELIVERED', 'user-123');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'DELIVERED',
          actualDeliveryDate: expect.anything(),
        })
      );
    });

    it('should throw error when packing list not found', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      await expect(updatePackingListStatus('pl-123', 'SHIPPED', 'user-123')).rejects.toThrow(
        'Packing List not found'
      );

      expect(mockUpdateDoc).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // GET PACKING LIST BY ID
  // ============================================================================
  describe('getPLById', () => {
    it('should return packing list when it exists', async () => {
      const mockPL = {
        id: 'pl-123',
        number: 'PL/2024/01/0001',
        purchaseOrderId: 'po-123',
        poNumber: 'PO/2024/01/0001',
        vendorId: 'vendor-123',
        vendorName: 'Test Vendor',
        projectId: 'project-123',
        projectName: 'Test Project',
        status: 'DRAFT',
      };

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: mockPL.id,
        data: () => mockPL,
      });

      const result = await getPLById('pl-123');

      expect(result).toEqual(
        expect.objectContaining({
          id: 'pl-123',
          number: 'PL/2024/01/0001',
          vendorName: 'Test Vendor',
        })
      );
    });

    it('should return null when packing list does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await getPLById('non-existent');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // GET PACKING LIST ITEMS
  // ============================================================================
  describe('getPLItems', () => {
    it('should return packing list items sorted by line number', async () => {
      const mockItems = [
        { id: 'pli-1', packingListId: 'pl-123', lineNumber: 1, description: 'Item 1', quantity: 5 },
        {
          id: 'pli-2',
          packingListId: 'pl-123',
          lineNumber: 2,
          description: 'Item 2',
          quantity: 10,
        },
      ];

      mockGetDocs.mockResolvedValueOnce({
        docs: mockItems.map((item) => ({
          id: item.id,
          data: () => item,
        })),
      });

      const result = await getPLItems('pl-123');

      expect(result).toHaveLength(2);
      expect(result[0]?.lineNumber).toBe(1);
      expect(result[1]?.lineNumber).toBe(2);
    });

    it('should return empty array when no items found', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      const result = await getPLItems('pl-123');

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // LIST PACKING LISTS
  // ============================================================================
  describe('listPackingLists', () => {
    it('should return list of packing lists', async () => {
      const mockPLs = [
        { id: 'pl-1', number: 'PL/2024/01/0001', status: 'SHIPPED', vendorName: 'Vendor A' },
        { id: 'pl-2', number: 'PL/2024/01/0002', status: 'DRAFT', vendorName: 'Vendor B' },
      ];

      mockGetDocs.mockResolvedValueOnce({
        docs: mockPLs.map((pl) => ({
          id: pl.id,
          data: () => pl,
        })),
      });

      const results = await listPackingLists();

      expect(results).toHaveLength(2);
      expect(results[0]?.number).toBe('PL/2024/01/0001');
      expect(results[1]?.number).toBe('PL/2024/01/0002');
    });

    it('should filter by status', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await listPackingLists({ status: 'SHIPPED' });

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { where } = require('firebase/firestore');
      expect(where).toHaveBeenCalledWith('status', '==', 'SHIPPED');
    });

    it('should filter by purchaseOrderId', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await listPackingLists({ purchaseOrderId: 'po-123' });

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { where } = require('firebase/firestore');
      expect(where).toHaveBeenCalledWith('purchaseOrderId', '==', 'po-123');
    });

    it('should filter by projectId', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await listPackingLists({ projectId: 'project-123' });

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { where } = require('firebase/firestore');
      expect(where).toHaveBeenCalledWith('projectId', '==', 'project-123');
    });

    it('should filter by vendorId', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await listPackingLists({ vendorId: 'vendor-123' });

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { where } = require('firebase/firestore');
      expect(where).toHaveBeenCalledWith('vendorId', '==', 'vendor-123');
    });

    it('should return empty array when no packing lists found', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      const results = await listPackingLists();

      expect(results).toEqual([]);
    });
  });

  // ============================================================================
  // GET PACKING LISTS BY PO
  // ============================================================================
  describe('getPackingListsByPO', () => {
    it('should return packing lists for a specific PO', async () => {
      const mockPLs = [
        { id: 'pl-1', number: 'PL/2024/01/0001', purchaseOrderId: 'po-123' },
        { id: 'pl-2', number: 'PL/2024/01/0002', purchaseOrderId: 'po-123' },
      ];

      mockGetDocs.mockResolvedValueOnce({
        docs: mockPLs.map((pl) => ({
          id: pl.id,
          data: () => pl,
        })),
      });

      const results = await getPackingListsByPO('po-123');

      expect(results).toHaveLength(2);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { where } = require('firebase/firestore');
      expect(where).toHaveBeenCalledWith('purchaseOrderId', '==', 'po-123');
    });
  });
});
