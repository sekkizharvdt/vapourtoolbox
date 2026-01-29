/**
 * Work Completion Certificate Service Tests
 *
 * Tests for WCC CRUD operations
 */

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    WORK_COMPLETION_CERTIFICATES: 'workCompletionCertificates',
    PURCHASE_ORDERS: 'purchaseOrders',
    COUNTERS: 'counters',
  },
}));

// Mock getFirebase
const mockDb = {};
jest.mock('@/lib/firebase', () => ({
  getFirebase: () => ({ db: mockDb }),
}));

// Mock Firebase Firestore
const mockAddDoc = jest.fn().mockResolvedValue({ id: 'new-wcc-id' });
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockRunTransaction = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, collectionName) => ({ path: collectionName })),
  doc: jest.fn((_db, _collection, id) => ({ id, path: `collection/${id}` })),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  query: jest.fn((...args) => args),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  orderBy: jest.fn((field, direction) => ({ field, direction })),
  limit: jest.fn((n) => ({ limit: n })),
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
  createWorkCompletionCertificate,
  getWCCById,
  listWCCs,
  type CreateWorkCompletionCertificateInput,
} from './workCompletionService';

describe('workCompletionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createWorkCompletionCertificate', () => {
    const mockPO = {
      id: 'po-123',
      number: 'PO/2024/01/0001',
      vendorId: 'vendor-123',
      vendorName: 'Test Vendor',
      status: 'COMPLETED',
    };

    const validInput: CreateWorkCompletionCertificateInput = {
      purchaseOrderId: 'po-123',
      projectId: 'project-123',
      projectName: 'Test Project',
      workDescription: 'All work completed as per specifications',
      completionDate: new Date('2024-02-01'),
      allItemsDelivered: true,
      allItemsAccepted: true,
      allPaymentsCompleted: true,
      certificateText: 'This certifies that all work under PO has been completed.',
      remarks: 'No issues found',
    };

    it('should create a WCC when PO exists', async () => {
      // Mock PO exists
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: mockPO.id,
        data: () => mockPO,
      });

      // Mock transaction for WCC number generation
      mockRunTransaction.mockResolvedValueOnce('WCC/2024/01/0001');

      const wccId = await createWorkCompletionCertificate(validInput, 'user-123', 'Test User');

      expect(wccId).toBe('new-wcc-id');
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      expect(mockAddDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          purchaseOrderId: 'po-123',
          poNumber: mockPO.number,
          vendorId: mockPO.vendorId,
          vendorName: mockPO.vendorName,
          projectId: validInput.projectId,
          projectName: validInput.projectName,
          allItemsDelivered: true,
          allItemsAccepted: true,
          allPaymentsCompleted: true,
        })
      );
    });

    it('should throw error when PO does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      await expect(
        createWorkCompletionCertificate(validInput, 'user-123', 'Test User')
      ).rejects.toThrow('Purchase Order not found');

      expect(mockAddDoc).not.toHaveBeenCalled();
    });
  });

  describe('getWCCById', () => {
    it('should return WCC when it exists', async () => {
      const mockWCC = {
        id: 'wcc-123',
        number: 'WCC/2024/01/0001',
        purchaseOrderId: 'po-123',
        poNumber: 'PO/2024/01/0001',
        vendorId: 'vendor-123',
        vendorName: 'Test Vendor',
        projectId: 'project-123',
        projectName: 'Test Project',
      };

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: mockWCC.id,
        data: () => mockWCC,
      });

      const result = await getWCCById('wcc-123');

      expect(result).toEqual(
        expect.objectContaining({
          id: 'wcc-123',
          number: 'WCC/2024/01/0001',
          vendorName: 'Test Vendor',
        })
      );
    });

    it('should return null when WCC does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await getWCCById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('listWCCs', () => {
    it('should return list of WCCs', async () => {
      const mockWCCs = [
        { id: 'wcc-1', number: 'WCC/2024/01/0001', vendorName: 'Vendor A' },
        { id: 'wcc-2', number: 'WCC/2024/01/0002', vendorName: 'Vendor B' },
      ];

      mockGetDocs.mockResolvedValueOnce({
        docs: mockWCCs.map((wcc) => ({
          id: wcc.id,
          data: () => wcc,
        })),
      });

      const results = await listWCCs();

      expect(results).toHaveLength(2);
      expect(results[0]?.number).toBe('WCC/2024/01/0001');
      expect(results[1]?.number).toBe('WCC/2024/01/0002');
    });

    it('should filter by PO ID', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await listWCCs({ poId: 'po-123' });

      // Verify query was built with where clause
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { where } = require('firebase/firestore');
      expect(where).toHaveBeenCalledWith('purchaseOrderId', '==', 'po-123');
    });

    it('should filter by project ID', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await listWCCs({ projectId: 'project-123' });

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { where } = require('firebase/firestore');
      expect(where).toHaveBeenCalledWith('projectId', '==', 'project-123');
    });

    it('should apply limit when provided', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      await listWCCs({ limit: 10 });

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { limit } = require('firebase/firestore');
      expect(limit).toHaveBeenCalledWith(10);
    });

    it('should return empty array when no WCCs found', async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      const results = await listWCCs();

      expect(results).toEqual([]);
    });
  });
});
