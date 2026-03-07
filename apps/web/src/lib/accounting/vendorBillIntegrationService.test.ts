/**
 * Vendor Bill Integration Service Tests
 *
 * Tests creation of vendor bills from approved 3-way matches.
 */

// Mock Firestore
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockAddDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, ...paths: string[]) => paths.join('/')),
  doc: jest.fn((_db: unknown, ...paths: string[]) => paths.join('/')),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  query: jest.fn((...args: unknown[]) => args),
  where: jest.fn((...args: unknown[]) => args),
  Timestamp: {
    now: () => ({ seconds: 1709827200, nanoseconds: 0, toMillis: () => 1709827200000 }),
  },
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    THREE_WAY_MATCHES: 'threeWayMatches',
    TRANSACTIONS: 'transactions',
    MATCH_LINE_ITEMS: 'matchLineItems',
  },
}));

jest.mock('@vapour/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('@/lib/firebase/typeHelpers', () => ({
  docToTyped: jest.fn((id: string, data: Record<string, unknown>) => ({ id, ...data })),
}));

import { createVendorBillFromMatch, getVendorBillForMatch } from './vendorBillIntegrationService';

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const db = {} as never;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createVendorBillFromMatch', () => {
  const mockMatch = {
    poNumber: 'PO-001',
    vendorName: 'Acme Corp',
    vendorId: 'vendor-1',
    vendorGSTIN: '29AABCU9603R1ZM',
    vendorInvoiceNumber: 'INV-2024-001',
    costCentreId: 'cc-1',
    matchNumber: 'TWM-001',
  };

  const mockLineItems = [
    {
      id: 'li-1',
      data: () => ({
        threeWayMatchId: 'match-1',
        description: 'Steel Plate',
        acceptedQuantity: 10,
        invoicedQuantity: 10,
        invoiceUnitPrice: 5000,
        taxRate: 18,
        taxAmount: 9000,
        accountId: 'acc-exp',
      }),
    },
    {
      id: 'li-2',
      data: () => ({
        threeWayMatchId: 'match-1',
        description: 'Pipe Fittings',
        acceptedQuantity: 5,
        invoicedQuantity: 5,
        invoiceUnitPrice: 2000,
        taxRate: 18,
        taxAmount: 1800,
        accountId: 'acc-exp',
      }),
    },
  ];

  it('should create a vendor bill from a 3-way match', async () => {
    // Match document exists
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => mockMatch,
    });

    // No existing bill
    mockGetDocs
      .mockResolvedValueOnce({ empty: true, docs: [] })
      // Line items
      .mockResolvedValueOnce({ docs: mockLineItems });

    mockAddDoc.mockResolvedValue({ id: 'new-bill-id' });

    const result = await createVendorBillFromMatch(db, 'match-1', 'user-1', 'Test User');

    expect(result).toBe('new-bill-id');
    expect(mockAddDoc).toHaveBeenCalledTimes(1);

    const billData = mockAddDoc.mock.calls[0][1];
    expect(billData.type).toBe('VENDOR_BILL');
    expect(billData.vendorInvoiceNumber).toBe('INV-2024-001');
    expect(billData.sourceDocumentId).toBe('match-1');
    expect(billData.sourceModule).toBe('procurement');
    expect(billData.paymentStatus).toBe('UNPAID');
    expect(billData.paidAmount).toBe(0);

    // Verify totals: (10*5000 + 5*2000) = 60000 subtotal, 10800 tax
    expect(billData.subtotal).toBe(60000);
    expect(billData.taxAmount).toBe(10800);
    expect(billData.totalAmount).toBe(70800);
    expect(billData.outstandingAmount).toBe(70800);
  });

  it('should return existing bill ID if bill already exists (idempotent)', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => mockMatch,
    });

    // Existing bill found
    mockGetDocs.mockResolvedValueOnce({
      empty: false,
      docs: [{ id: 'existing-bill-id' }],
    });

    const result = await createVendorBillFromMatch(db, 'match-1', 'user-1', 'Test User');

    expect(result).toBe('existing-bill-id');
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('should throw when 3-way match is not found', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    await expect(
      createVendorBillFromMatch(db, 'nonexistent', 'user-1', 'Test User')
    ).rejects.toThrow('Three-way match not found');
  });

  it('should use acceptedQuantity over invoicedQuantity when available', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => mockMatch,
    });

    const lineItemsWithAccepted = [
      {
        id: 'li-1',
        data: () => ({
          threeWayMatchId: 'match-1',
          description: 'Item',
          acceptedQuantity: 8, // Differs from invoiced
          invoicedQuantity: 10,
          invoiceUnitPrice: 1000,
          taxRate: 0,
          taxAmount: 0,
        }),
      },
    ];

    mockGetDocs
      .mockResolvedValueOnce({ empty: true, docs: [] })
      .mockResolvedValueOnce({ docs: lineItemsWithAccepted });

    mockAddDoc.mockResolvedValue({ id: 'bill-id' });

    await createVendorBillFromMatch(db, 'match-1', 'user-1', 'User');

    const billData = mockAddDoc.mock.calls[0][1];
    expect(billData.subtotal).toBe(8000); // 8 * 1000, not 10 * 1000
  });

  it('should handle line items with zero tax', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => mockMatch,
    });

    const lineItems = [
      {
        id: 'li-1',
        data: () => ({
          threeWayMatchId: 'match-1',
          description: 'Exempt Item',
          acceptedQuantity: 5,
          invoicedQuantity: 5,
          invoiceUnitPrice: 1000,
          taxRate: 0,
          taxAmount: 0,
        }),
      },
    ];

    mockGetDocs
      .mockResolvedValueOnce({ empty: true, docs: [] })
      .mockResolvedValueOnce({ docs: lineItems });

    mockAddDoc.mockResolvedValue({ id: 'bill-id' });

    await createVendorBillFromMatch(db, 'match-1', 'user-1', 'User');

    const billData = mockAddDoc.mock.calls[0][1];
    expect(billData.subtotal).toBe(5000);
    expect(billData.taxAmount).toBe(0);
    expect(billData.totalAmount).toBe(5000);
  });
});

describe('getVendorBillForMatch', () => {
  it('should return vendor bill when it exists', async () => {
    const mockBillData = {
      type: 'VENDOR_BILL',
      totalAmount: 50000,
      sourceDocumentId: 'match-1',
    };

    mockGetDocs.mockResolvedValue({
      empty: false,
      docs: [{ id: 'bill-1', data: () => mockBillData }],
    });

    const result = await getVendorBillForMatch(db, 'match-1');

    expect(result).toBeDefined();
    expect(result!.id).toBe('bill-1');
  });

  it('should return null when no bill exists', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

    const result = await getVendorBillForMatch(db, 'match-no-bill');
    expect(result).toBeNull();
  });
});
