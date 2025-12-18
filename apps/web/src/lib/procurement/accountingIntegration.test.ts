/**
 * Procurement-Accounting Integration Tests
 *
 * Tests for the integration between procurement workflows and accounting:
 * - Goods Receipt → Vendor Bill
 * - Purchase Order → Advance Payment
 * - Approved Receipt → Vendor Payment
 */

import {
  createBillFromGoodsReceipt,
  createAdvancePaymentFromPO,
  createPaymentFromApprovedReceipt,
  AccountingIntegrationError,
} from './accountingIntegration';
import { Timestamp } from 'firebase/firestore';
import type {
  PurchaseOrder,
  GoodsReceipt,
  GoodsReceiptItem,
  PurchaseOrderItem,
} from '@vapour/types';

// Mock Firebase
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockUpdateDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => 'mock-doc-ref'),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  collection: jest.fn(() => 'mock-collection'),
  query: jest.fn((...args: unknown[]) => args),
  where: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({
      seconds: 1702800000,
      nanoseconds: 0,
      toDate: () => new Date('2024-12-17'),
    })),
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      seconds: Math.floor(date.getTime() / 1000),
    })),
  },
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    PURCHASE_ORDERS: 'purchaseOrders',
    PURCHASE_ORDER_ITEMS: 'purchaseOrderItems',
    GOODS_RECEIPTS: 'goodsReceipts',
    GOODS_RECEIPT_ITEMS: 'goodsReceiptItems',
    TRANSACTIONS: 'transactions',
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

// Mock type helpers
jest.mock('@/lib/firebase/typeHelpers', () => ({
  docToTyped: <T>(id: string, data: unknown): T => ({ id, ...(data as object) }) as T,
}));

// Mock GL entry generation
const mockGenerateBillGLEntries = jest.fn();
jest.mock('../accounting/glEntry', () => ({
  generateBillGLEntries: (...args: unknown[]) => mockGenerateBillGLEntries(...args),
}));

// Mock payment helpers
const mockCreatePaymentWithAllocationsAtomic = jest.fn();
jest.mock('../accounting/paymentHelpers', () => ({
  createPaymentWithAllocationsAtomic: (...args: unknown[]) =>
    mockCreatePaymentWithAllocationsAtomic(...args),
}));

// Mock transaction service
const mockSaveTransaction = jest.fn();
jest.mock('../accounting/transactionService', () => ({
  saveTransaction: (...args: unknown[]) => mockSaveTransaction(...args),
}));

// Helper to create mock Timestamp
function createMockTimestamp(date: Date): Timestamp {
  return {
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  } as Timestamp;
}

// Helper to create mock GoodsReceipt
function createMockGoodsReceipt(overrides: Partial<GoodsReceipt> = {}): GoodsReceipt {
  return {
    id: 'gr-1',
    number: 'GR/2024/001',
    purchaseOrderId: 'po-1',
    projectId: 'project-1',
    status: 'COMPLETED',
    receivedAt: createMockTimestamp(new Date('2024-12-15')),
    createdAt: createMockTimestamp(new Date('2024-12-15')),
    updatedAt: createMockTimestamp(new Date('2024-12-15')),
    createdBy: 'user-1',
    ...overrides,
  } as GoodsReceipt;
}

// Helper to create mock PurchaseOrder
function createMockPurchaseOrder(overrides: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return {
    id: 'po-1',
    number: 'PO/2024/001',
    vendorId: 'vendor-1',
    vendorName: 'Test Vendor',
    projectIds: ['project-1'],
    subtotal: 100000,
    cgst: 9000,
    sgst: 9000,
    igst: 0,
    totalTax: 18000,
    grandTotal: 118000,
    currency: 'INR',
    status: 'APPROVED',
    createdAt: createMockTimestamp(new Date('2024-12-10')),
    updatedAt: createMockTimestamp(new Date('2024-12-10')),
    createdBy: 'user-1',
    ...overrides,
  } as PurchaseOrder;
}

// Helper to create mock GoodsReceiptItem
function createMockGRItem(overrides: Partial<GoodsReceiptItem> = {}): GoodsReceiptItem {
  return {
    id: 'gri-1',
    goodsReceiptId: 'gr-1',
    poItemId: 'poi-1',
    receivedQuantity: 100,
    acceptedQuantity: 95,
    rejectedQuantity: 5,
    createdAt: createMockTimestamp(new Date('2024-12-15')),
    ...overrides,
  } as GoodsReceiptItem;
}

// Helper to create mock PurchaseOrderItem
function createMockPOItem(overrides: Partial<PurchaseOrderItem> = {}): PurchaseOrderItem {
  return {
    id: 'poi-1',
    purchaseOrderId: 'po-1',
    lineNumber: 1,
    description: 'Steel Plate 10mm',
    quantity: 100,
    unit: 'KG',
    unitPrice: 1000,
    amount: 100000,
    gstRate: 18,
    gstAmount: 18000,
    createdAt: createMockTimestamp(new Date('2024-12-10')),
    ...overrides,
  } as PurchaseOrderItem;
}

describe('AccountingIntegrationError', () => {
  it('should create error with code and details', () => {
    const error = new AccountingIntegrationError('Test error', 'TEST_CODE', { extra: 'data' });

    expect(error.message).toBe('Test error');
    expect(error.name).toBe('AccountingIntegrationError');
    expect(error.code).toBe('TEST_CODE');
    expect(error.details).toEqual({ extra: 'data' });
  });

  it('should be instanceof Error', () => {
    const error = new AccountingIntegrationError('Test', 'CODE');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('createBillFromGoodsReceipt', () => {
  const mockDb = {} as never;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
    mockGenerateBillGLEntries.mockResolvedValue({
      success: true,
      entries: [
        { accountId: 'acc-1', debit: 100000, credit: 0 },
        { accountId: 'acc-2', debit: 0, credit: 100000 },
      ],
    });
    mockSaveTransaction.mockResolvedValue('bill-1');
  });

  it('should throw error if goods receipt status is not COMPLETED', async () => {
    const gr = createMockGoodsReceipt({ status: 'PENDING' });

    await expect(createBillFromGoodsReceipt(mockDb, gr, 'user-1', 'user@test.com')).rejects.toThrow(
      AccountingIntegrationError
    );

    await expect(createBillFromGoodsReceipt(mockDb, gr, 'user-1', 'user@test.com')).rejects.toThrow(
      'must be completed'
    );
  });

  it('should throw error if bill already exists', async () => {
    const gr = createMockGoodsReceipt({ paymentRequestId: 'existing-bill' });

    await expect(createBillFromGoodsReceipt(mockDb, gr, 'user-1', 'user@test.com')).rejects.toThrow(
      'Bill already exists'
    );
  });

  it('should throw error if purchase order not found', async () => {
    const gr = createMockGoodsReceipt();
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });

    await expect(createBillFromGoodsReceipt(mockDb, gr, 'user-1', 'user@test.com')).rejects.toThrow(
      'Purchase order not found'
    );
  });

  it('should create bill from goods receipt successfully', async () => {
    const gr = createMockGoodsReceipt();
    const po = createMockPurchaseOrder();
    const grItems = [createMockGRItem()];
    const poItems = [createMockPOItem()];

    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: po.id,
      data: () => po,
    });

    mockGetDocs
      .mockResolvedValueOnce({
        docs: grItems.map((item) => ({ id: item.id, data: () => item })),
      })
      .mockResolvedValueOnce({
        docs: poItems.map((item) => ({ id: item.id, data: () => item })),
      });

    const billId = await createBillFromGoodsReceipt(mockDb, gr, 'user-1', 'user@test.com');

    expect(billId).toBe('bill-1');
    expect(mockSaveTransaction).toHaveBeenCalled();
    expect(mockUpdateDoc).toHaveBeenCalled();
  });

  it('should calculate bill amounts based on accepted quantities', async () => {
    const gr = createMockGoodsReceipt();
    const po = createMockPurchaseOrder();
    const grItems = [createMockGRItem({ acceptedQuantity: 50 })]; // Only 50 accepted
    const poItems = [createMockPOItem({ unitPrice: 1000, gstRate: 18 })];

    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: po.id,
      data: () => po,
    });

    mockGetDocs
      .mockResolvedValueOnce({
        docs: grItems.map((item) => ({ id: item.id, data: () => item })),
      })
      .mockResolvedValueOnce({
        docs: poItems.map((item) => ({ id: item.id, data: () => item })),
      });

    await createBillFromGoodsReceipt(mockDb, gr, 'user-1', 'user@test.com');

    // Verify GL input uses accepted quantity (50 * 1000 = 50000 subtotal)
    expect(mockGenerateBillGLEntries).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        subtotal: 50000,
        gstDetails: expect.objectContaining({
          taxableAmount: 50000,
          totalGST: 9000, // 18% of 50000
        }),
      })
    );
  });

  it('should use IGST for interstate transactions', async () => {
    const gr = createMockGoodsReceipt();
    const po = createMockPurchaseOrder({ igst: 18000, cgst: 0, sgst: 0 });
    const grItems = [createMockGRItem()];
    const poItems = [createMockPOItem()];

    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: po.id,
      data: () => po,
    });

    mockGetDocs
      .mockResolvedValueOnce({
        docs: grItems.map((item) => ({ id: item.id, data: () => item })),
      })
      .mockResolvedValueOnce({
        docs: poItems.map((item) => ({ id: item.id, data: () => item })),
      });

    await createBillFromGoodsReceipt(mockDb, gr, 'user-1', 'user@test.com');

    expect(mockGenerateBillGLEntries).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        gstDetails: expect.objectContaining({
          gstType: 'IGST',
          igstAmount: expect.any(Number),
        }),
      })
    );
  });

  it('should throw error if GL generation fails', async () => {
    const gr = createMockGoodsReceipt();
    const po = createMockPurchaseOrder();

    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: po.id,
      data: () => po,
    });

    mockGetDocs.mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [] });

    mockGenerateBillGLEntries.mockResolvedValueOnce({
      success: false,
      errors: ['Account not found'],
    });

    await expect(createBillFromGoodsReceipt(mockDb, gr, 'user-1', 'user@test.com')).rejects.toThrow(
      'Failed to generate GL entries'
    );
  });

  it('should update goods receipt with bill reference', async () => {
    const gr = createMockGoodsReceipt();
    const po = createMockPurchaseOrder();

    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: po.id,
      data: () => po,
    });

    mockGetDocs.mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [] });

    await createBillFromGoodsReceipt(mockDb, gr, 'user-1', 'user@test.com');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        paymentRequestId: 'bill-1',
      })
    );
  });
});

describe('createAdvancePaymentFromPO', () => {
  const mockDb = {} as never;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
    mockCreatePaymentWithAllocationsAtomic.mockResolvedValue('payment-1');
  });

  it('should throw error if advance payment not required', async () => {
    const po = createMockPurchaseOrder({ advancePaymentRequired: false });

    await expect(
      createAdvancePaymentFromPO(mockDb, po, 'bank-1', 'user-1', 'user@test.com')
    ).rejects.toThrow('does not require advance payment');
  });

  it('should throw error if advance amount is invalid', async () => {
    const po = createMockPurchaseOrder({
      advancePaymentRequired: true,
      advanceAmount: 0,
    });

    await expect(
      createAdvancePaymentFromPO(mockDb, po, 'bank-1', 'user-1', 'user@test.com')
    ).rejects.toThrow('Invalid advance amount');
  });

  it('should throw error if advance payment already exists', async () => {
    const po = createMockPurchaseOrder({
      advancePaymentRequired: true,
      advanceAmount: 35400,
      advancePaymentId: 'existing-payment',
    });

    await expect(
      createAdvancePaymentFromPO(mockDb, po, 'bank-1', 'user-1', 'user@test.com')
    ).rejects.toThrow('Advance payment already exists');
  });

  it('should create advance payment successfully', async () => {
    const po = createMockPurchaseOrder({
      advancePaymentRequired: true,
      advanceAmount: 35400,
      advancePercentage: 30,
    });

    const paymentId = await createAdvancePaymentFromPO(
      mockDb,
      po,
      'bank-1',
      'user-1',
      'user@test.com'
    );

    expect(paymentId).toBe('payment-1');
    expect(mockCreatePaymentWithAllocationsAtomic).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        type: 'VENDOR_PAYMENT',
        amount: 35400,
        entityId: 'vendor-1',
        bankAccountId: 'bank-1',
      }),
      [] // No allocations for advance
    );
  });

  it('should update PO with payment reference and status', async () => {
    const po = createMockPurchaseOrder({
      advancePaymentRequired: true,
      advanceAmount: 35400,
      advancePercentage: 30,
    });

    await createAdvancePaymentFromPO(mockDb, po, 'bank-1', 'user-1', 'user@test.com');

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        advancePaymentId: 'payment-1',
        advancePaymentStatus: 'PAID',
        paymentProgress: 30,
      })
    );
  });

  it('should include PO reference in payment', async () => {
    const po = createMockPurchaseOrder({
      id: 'po-123',
      number: 'PO/2024/001',
      advancePaymentRequired: true,
      advanceAmount: 35400,
    });

    await createAdvancePaymentFromPO(mockDb, po, 'bank-1', 'user-1', 'user@test.com');

    expect(mockCreatePaymentWithAllocationsAtomic).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        purchaseOrderId: 'po-123',
        referenceNumber: 'ADV-PO/2024/001',
      }),
      expect.anything()
    );
  });
});

describe('createPaymentFromApprovedReceipt', () => {
  const mockDb = {} as never;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
    mockCreatePaymentWithAllocationsAtomic.mockResolvedValue('payment-1');
  });

  it('should throw error if goods receipt not approved for payment', async () => {
    const gr = createMockGoodsReceipt({ approvedForPayment: false });

    await expect(
      createPaymentFromApprovedReceipt(mockDb, gr, 'bank-1', 'user-1', 'user@test.com')
    ).rejects.toThrow('not approved for payment');
  });

  it('should throw error if no bill exists', async () => {
    const gr = createMockGoodsReceipt({
      approvedForPayment: true,
      paymentRequestId: undefined,
    });

    await expect(
      createPaymentFromApprovedReceipt(mockDb, gr, 'bank-1', 'user-1', 'user@test.com')
    ).rejects.toThrow('No bill found');
  });

  it('should throw error if bill document not found', async () => {
    const gr = createMockGoodsReceipt({
      approvedForPayment: true,
      paymentRequestId: 'bill-1',
    });

    mockGetDoc.mockResolvedValueOnce({ exists: () => false });

    await expect(
      createPaymentFromApprovedReceipt(mockDb, gr, 'bank-1', 'user-1', 'user@test.com')
    ).rejects.toThrow('Bill document not found');
  });

  it('should throw error if bill is already paid', async () => {
    const gr = createMockGoodsReceipt({
      approvedForPayment: true,
      paymentRequestId: 'bill-1',
    });

    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ status: 'PAID', totalAmount: 118000 }),
    });

    await expect(
      createPaymentFromApprovedReceipt(mockDb, gr, 'bank-1', 'user-1', 'user@test.com')
    ).rejects.toThrow('already fully paid');
  });

  it('should create payment for outstanding amount', async () => {
    const gr = createMockGoodsReceipt({
      approvedForPayment: true,
      paymentRequestId: 'bill-1',
    });

    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        status: 'UNPAID',
        totalAmount: 118000,
        outstandingAmount: 118000,
        currency: 'INR',
        entityId: 'vendor-1',
        entityName: 'Test Vendor',
        transactionNumber: 'BILL-001',
        projectId: 'project-1',
      }),
    });

    const paymentId = await createPaymentFromApprovedReceipt(
      mockDb,
      gr,
      'bank-1',
      'user-1',
      'user@test.com'
    );

    expect(paymentId).toBe('payment-1');
    expect(mockCreatePaymentWithAllocationsAtomic).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        type: 'VENDOR_PAYMENT',
        amount: 118000,
        entityId: 'vendor-1',
      }),
      [
        expect.objectContaining({
          invoiceId: 'bill-1',
          allocatedAmount: 118000,
        }),
      ]
    );
  });

  it('should handle partial payment (outstanding less than total)', async () => {
    const gr = createMockGoodsReceipt({
      approvedForPayment: true,
      paymentRequestId: 'bill-1',
    });

    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        status: 'PARTIAL',
        totalAmount: 118000,
        outstandingAmount: 50000, // Partial already paid
        currency: 'INR',
        entityId: 'vendor-1',
        transactionNumber: 'BILL-001',
      }),
    });

    await createPaymentFromApprovedReceipt(mockDb, gr, 'bank-1', 'user-1', 'user@test.com');

    expect(mockCreatePaymentWithAllocationsAtomic).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        amount: 50000, // Outstanding amount only
      }),
      expect.anything()
    );
  });

  it('should include goods receipt reference in payment', async () => {
    const gr = createMockGoodsReceipt({
      id: 'gr-123',
      number: 'GR/2024/001',
      approvedForPayment: true,
      paymentRequestId: 'bill-1',
    });

    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        status: 'UNPAID',
        totalAmount: 118000,
        outstandingAmount: 118000,
        currency: 'INR',
        entityId: 'vendor-1',
        transactionNumber: 'BILL-001',
      }),
    });

    await createPaymentFromApprovedReceipt(mockDb, gr, 'bank-1', 'user-1', 'user@test.com');

    expect(mockCreatePaymentWithAllocationsAtomic).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        goodsReceiptId: 'gr-123',
        referenceNumber: 'GR-GR/2024/001',
      }),
      expect.anything()
    );
  });
});

describe('Error handling', () => {
  const mockDb = {} as never;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should wrap unknown errors in AccountingIntegrationError', async () => {
    const gr = createMockGoodsReceipt();

    mockGetDoc.mockRejectedValueOnce(new Error('Network error'));

    await expect(createBillFromGoodsReceipt(mockDb, gr, 'user-1', 'user@test.com')).rejects.toThrow(
      AccountingIntegrationError
    );
  });

  it('should preserve AccountingIntegrationError details', async () => {
    const gr = createMockGoodsReceipt({ status: 'PENDING' });

    try {
      await createBillFromGoodsReceipt(mockDb, gr, 'user-1', 'user@test.com');
    } catch (error) {
      expect(error).toBeInstanceOf(AccountingIntegrationError);
      expect((error as AccountingIntegrationError).code).toBe('INVALID_STATUS');
      expect((error as AccountingIntegrationError).details).toEqual({ status: 'PENDING' });
    }
  });
});
