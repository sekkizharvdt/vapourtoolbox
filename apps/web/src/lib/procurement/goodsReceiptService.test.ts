import type { GoodsReceipt, PurchaseOrder, PurchaseOrderItem } from '@vapour/types';
import { where, orderBy } from 'firebase/firestore';

// Mock Firebase
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockUpdateDoc = jest.fn();
const mockRunTransaction = jest.fn();
const mockSetDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'mock-collection'),
  doc: jest.fn(() => 'mock-doc-ref'),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  query: jest.fn((...args: unknown[]) => args),
  where: jest.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  orderBy: jest.fn((field: string, dir?: string) => ({ field, dir })),
  Timestamp: {
    now: jest.fn(() => ({
      seconds: 1702800000,
      nanoseconds: 0,
      toDate: () => new Date('2024-12-17'),
    })),
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
    })),
  },
}));

// Mock getFirebase
const mockDb = {};
jest.mock('@/lib/firebase', () => ({
  getFirebase: jest.fn(() => ({ db: mockDb })),
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    GOODS_RECEIPTS: 'goodsReceipts',
    GOODS_RECEIPT_ITEMS: 'goodsReceiptItems',
    PURCHASE_ORDERS: 'purchaseOrders',
    PURCHASE_ORDER_ITEMS: 'purchaseOrderItems',
    ACCOUNTS: 'accounts',
    COUNTERS: 'counters',
  },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  }),
}));

// Mock audit logging
const mockLogAuditEvent = jest.fn().mockResolvedValue(undefined);
jest.mock('@/lib/audit', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
  createAuditContext: jest.fn((userId, _, userName) => ({ userId, userName })),
}));

// Mock task notification
jest.mock('@/lib/tasks/taskNotificationService', () => ({
  createTaskNotification: jest.fn().mockResolvedValue('notification-1'),
}));

// Mock workflow state machine
const mockValidateTransition = jest.fn();
jest.mock('@/lib/workflow/stateMachines', () => ({
  goodsReceiptStateMachine: {
    validateTransition: (...args: unknown[]) => mockValidateTransition(...args),
  },
}));

// Mock idempotency
jest.mock('@/lib/utils/idempotencyService', () => ({
  withIdempotency: jest.fn((_db, _key, _operation, fn) => fn()),
  generateIdempotencyKey: jest.fn((...args: string[]) => args.join('-')),
}));

// Mock accounting integration
const mockCreateBill = jest.fn();
const mockCreatePayment = jest.fn();
jest.mock('./accountingIntegration', () => ({
  createBillFromGoodsReceipt: (...args: unknown[]) => mockCreateBill(...args),
  createPaymentFromApprovedReceipt: (...args: unknown[]) => mockCreatePayment(...args),
}));

// Import after mocks
import {
  createGoodsReceipt,
  getGRById,
  getGRItems,
  listGoodsReceipts,
  completeGR,
  approveGRForPayment,
  CreateGoodsReceiptInput,
} from './goodsReceiptService';

const mockPO = {
  id: 'po-1',
  number: 'PO/2024/001',
  vendorName: 'Acme Corp',
  createdBy: 'user-creator',
  projectId: 'proj-1',
} as unknown as PurchaseOrder;

const mockPOItem = {
  id: 'poi-1',
  purchaseOrderId: 'po-1',
  description: 'Widget',
  quantity: 10,
  quantityDelivered: 0,
  quantityAccepted: 0,
  quantityRejected: 0,
  unit: 'PCS',
} as PurchaseOrderItem;

describe('goodsReceiptService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateTransition.mockReturnValue({ allowed: true });
  });

  describe('createGoodsReceipt', () => {
    const input: CreateGoodsReceiptInput = {
      purchaseOrderId: 'po-1',
      projectId: 'proj-1',
      projectName: 'Project A',
      inspectionType: 'DELIVERY_SITE',
      inspectionLocation: 'Warehouse',
      inspectionDate: new Date('2024-12-17'),
      items: [
        {
          poItemId: 'poi-1',
          receivedQuantity: 5,
          acceptedQuantity: 5,
          rejectedQuantity: 0,
          condition: 'GOOD',
          testingRequired: false,
          hasIssues: false,
        },
      ],
    };

    it('should create GR and update PO items successfully', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: 'poi-1', data: () => mockPOItem }],
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const transaction = {
          get: jest.fn(() => {
            return Promise.resolve({
              exists: () => true,
              id: 'doc-id',
              data: () => ({ value: 100, ...mockPO, ...mockPOItem }),
            });
          }),
          set: mockSetDoc,
          update: mockUpdateDoc,
        };
        return callback(transaction);
      });

      mockRunTransaction
        .mockResolvedValueOnce('GR/2024/12/0001')
        .mockResolvedValueOnce({ grId: 'new-gr-id', poNumber: 'PO/1', poVendorName: 'V' });

      const result = await createGoodsReceipt(input, 'user-1', 'User Name');

      expect(result).toBe('new-gr-id');
      expect(mockRunTransaction).toHaveBeenCalledTimes(2);
    });

    it('should calculate validation flags correctly', async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: 'poi-1', data: () => mockPOItem }],
      });

      let savedGRData: any;

      mockRunTransaction
        .mockResolvedValueOnce('GR/NUM')
        .mockImplementation(async (_db, callback) => {
          const transaction = {
            get: jest.fn().mockResolvedValue({
              exists: () => true,
              data: () => ({ ...mockPO, ...mockPOItem }),
            }),
            set: jest.fn((_ref, data) => {
              // Determine if this is GR or Item by checking fields
              // GR has 'overallCondition', Item has 'receivedQuantity'
              if ('overallCondition' in data) {
                savedGRData = data;
              }
            }),
            update: jest.fn(),
          };
          return callback(transaction);
        });

      await createGoodsReceipt(input, 'user-1', 'User');

      expect(savedGRData).toBeDefined();
      expect(savedGRData.overallCondition).toBe('ACCEPTED');
      expect(savedGRData.hasIssues).toBe(false);
    });

    it('should throw error when PO not found', async () => {
      // Mock docs to return items (since fetch happens before txn in current service impl assumption?
      // Actually, service code: fetches items -> withIdempotency -> generateGRNumber -> run txn.
      // Inside txn: fetches PO.
      // So we DO need to mock items fetch first.
      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: 'poi-1', data: () => mockPOItem }],
      });

      mockRunTransaction
        .mockResolvedValueOnce('GR/NUM')
        .mockImplementation(async (_db, callback) => {
          const transaction = {
            get: jest.fn(() => Promise.resolve({ exists: () => false })), // PO not found
            set: jest.fn(),
            update: jest.fn(),
          };
          return callback(transaction);
        });

      await expect(createGoodsReceipt(input, 'user-1', 'User')).rejects.toThrow(
        'Purchase Order not found'
      );
    });

    it('should handle empty items array (no items created)', async () => {
      const emptyInput = { ...input, items: [] };

      // Mock PO items fetch
      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: 'poi-1', data: () => mockPOItem }],
      });

      let createdItemsCount = 0;

      mockRunTransaction
        .mockResolvedValueOnce('GR/NUM')
        .mockImplementation(async (_db, callback) => {
          const transaction = {
            get: jest.fn().mockResolvedValue({
              exists: () => true,
              data: () => ({ ...mockPO, ...mockPOItem }),
            }),
            set: jest.fn((_ref, data) => {
              if (!('overallCondition' in data)) {
                // It's an item
                createdItemsCount++;
              }
            }),
            update: jest.fn(),
          };
          return callback(transaction);
        });

      await createGoodsReceipt(emptyInput, 'user-1', 'User');
      expect(createdItemsCount).toBe(0);
    });
  });

  describe('getGRById', () => {
    it('should return GR when found', async () => {
      const mockGR = { id: 'gr-1', number: 'GR-1' } as GoodsReceipt;
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'gr-1',
        data: () => mockGR,
      });

      const result = await getGRById('gr-1');
      expect(result).toEqual(mockGR);
    });

    it('should return null when not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });
      const result = await getGRById('gr-1');
      expect(result).toBeNull();
    });
  });

  describe('getGRItems', () => {
    it('should return empty array when no items', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });
      const result = await getGRItems('gr-1');
      expect(result).toEqual([]);
    });

    it('should include orderBy lineNumber', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });
      await getGRItems('gr-1');
      expect(orderBy).toHaveBeenCalledWith('lineNumber', 'asc');
    });
  });

  describe('listGoodsReceipts', () => {
    it('should apply filters', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [],
      });

      await listGoodsReceipts({ status: 'COMPLETED', purchaseOrderId: 'po-1' });

      expect(where).toHaveBeenCalledWith('status', '==', 'COMPLETED');
      expect(where).toHaveBeenCalledWith('purchaseOrderId', '==', 'po-1');
    });

    it('should filter by projectId', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });
      await listGoodsReceipts({ projectId: 'proj-1' });
      expect(where).toHaveBeenCalledWith('projectId', '==', 'proj-1');
    });

    it('should filter by approvedForPayment', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });
      await listGoodsReceipts({ approvedForPayment: true });
      expect(where).toHaveBeenCalledWith('approvedForPayment', '==', true);
    });
  });

  describe('completeGR', () => {
    it('should complete GR and trigger bill creation', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ status: 'IN_PROGRESS', purchaseOrderId: 'po-1', projectId: 'proj-1' }),
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const txn = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            id: 'gr-1',
            data: () => ({ status: 'IN_PROGRESS', paymentRequestId: null }),
          }),
          update: mockUpdateDoc,
        };
        await callback(txn);
      });

      await completeGR('gr-1', 'user-1', 'email@test.com');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'COMPLETED' })
      );
      expect(mockCreateBill).toHaveBeenCalled();
    });

    it('should validate transition', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ status: 'DRAFT' }),
      });

      mockValidateTransition.mockReturnValue({ allowed: false, reason: 'Bad state' });

      await expect(completeGR('gr-1', 'u', 'e')).rejects.toThrow('Bad state');
    });

    it('should throw error when GR not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });
      await expect(completeGR('gr-1', 'u', 'e')).rejects.toThrow('Goods Receipt not found');
    });

    it('should skip bill creation if paymentRequestId exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ status: 'IN_PROGRESS', purchaseOrderId: 'po-1' }),
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const txn = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            id: 'gr-1',
            data: () => ({ status: 'IN_PROGRESS', paymentRequestId: 'existing-bill' }),
          }),
          update: mockUpdateDoc,
        };
        await callback(txn);
      });

      // Re-fetch post txn
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ status: 'COMPLETED', paymentRequestId: 'existing-bill' }),
      });

      await completeGR('gr-1', 'u', 'e');

      expect(mockCreateBill).not.toHaveBeenCalled();
    });

    it('should log audit event', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ status: 'IN_PROGRESS', purchaseOrderId: 'po-1' }),
      });
      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const txn = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            id: 'gr-1',
            data: () => ({ status: 'IN_PROGRESS' }),
          }),
          update: mockUpdateDoc,
        };
        await callback(txn);
      });

      await completeGR('gr-1', 'u', 'e');

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'GR_COMPLETED',
        'GOODS_RECEIPT',
        'gr-1',
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe('approveGRForPayment', () => {
    // PR-9: Bank account mock — all tests need a valid bank account for the validation check
    const mockBankAccount = {
      exists: () => true,
      data: () => ({ isBankAccount: true, name: 'SBI Current' }),
    };

    it('should approve if completed and billed', async () => {
      // First getDoc: bank account, second getDoc: GR re-fetch after approval
      mockGetDoc.mockResolvedValueOnce(mockBankAccount).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ status: 'COMPLETED', paymentRequestId: 'bill-1' }),
      });

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const txn = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            id: 'gr-1',
            data: () => ({
              status: 'COMPLETED',
              paymentRequestId: 'bill-1',
              approvedForPayment: false,
            }),
          }),
          update: mockUpdateDoc,
        };
        return callback(txn);
      });

      await approveGRForPayment('gr-1', 'bank-1', 'user-1', 'email');

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ approvedForPayment: true })
      );
      expect(mockCreatePayment).toHaveBeenCalled();
    });

    it('should fail if not completed', async () => {
      mockGetDoc.mockResolvedValueOnce(mockBankAccount);

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const txn = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({ status: 'IN_PROGRESS' }),
          }),
        };
        return callback(txn);
      });

      await expect(approveGRForPayment('gr-1', 'b', 'u', 'e')).rejects.toThrow(/must be completed/);
    });

    it('should fail if already approved for payment', async () => {
      mockGetDoc.mockResolvedValueOnce(mockBankAccount);

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const txn = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({
              status: 'COMPLETED',
              approvedForPayment: true,
            }),
          }),
        };
        return callback(txn);
      });

      await expect(approveGRForPayment('gr-1', 'b', 'u', 'e')).rejects.toThrow('already approved');
    });

    it('should fail if no bill exists', async () => {
      mockGetDoc.mockResolvedValueOnce(mockBankAccount);

      mockRunTransaction.mockImplementation(async (_db, callback) => {
        const txn = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({
              status: 'COMPLETED',
              approvedForPayment: false,
              paymentRequestId: null, // No bill
            }),
          }),
        };
        return callback(txn);
      });

      await expect(approveGRForPayment('gr-1', 'b', 'u', 'e')).rejects.toThrow(/Create bill first/);
    });

    it('should fail if bank account not found (PR-9)', async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });

      await expect(approveGRForPayment('gr-1', 'bad-bank', 'u', 'e')).rejects.toThrow(
        'Bank account not found'
      );
    });

    it('should fail if account is not a bank account (PR-9)', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ isBankAccount: false, name: 'Revenue Account' }),
      });

      await expect(approveGRForPayment('gr-1', 'non-bank', 'u', 'e')).rejects.toThrow(
        'not a bank account'
      );
    });
  });
});
