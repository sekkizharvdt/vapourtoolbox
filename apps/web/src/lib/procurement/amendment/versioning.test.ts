/**
 * Amendment Versioning Tests
 */

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    PURCHASE_ORDER_VERSIONS: 'purchaseOrderVersions',
    PURCHASE_ORDERS: 'purchaseOrders',
    PURCHASE_ORDER_ITEMS: 'purchaseOrderItems',
    PURCHASE_ORDER_AMENDMENTS: 'purchaseOrderAmendments',
  },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockAddDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, name) => ({ path: name })),
  doc: jest.fn((_db, _col, _id) => ({ path: `${_col}/${_id}` })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  query: jest.fn((...args) => args),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  orderBy: jest.fn((field, dir) => ({ field, dir })),
  serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({
      seconds: date.getTime() / 1000,
      nanoseconds: 0,
      toDate: () => date,
    })),
  },
}));

import { getPurchaseOrderVersions, createVersionSnapshot, compareVersions } from './versioning';

const mockDb = {} as never;

function mockDocResult(exists: boolean, data: Record<string, unknown> = {}, id = 'doc-1') {
  return {
    exists: () => exists,
    id,
    data: () => data,
  };
}

function mockSnapshot(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    docs: docs.map((d) => ({
      id: d.id,
      data: () => d.data,
    })),
    forEach: (cb: (doc: { id: string; data: () => Record<string, unknown> }) => void) =>
      docs.forEach((d) => cb({ id: d.id, data: () => d.data })),
    size: docs.length,
    empty: docs.length === 0,
  };
}

describe('Amendment Versioning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPurchaseOrderVersions', () => {
    it('should return versions ordered by version number', async () => {
      const versions = [
        { id: 'v-1', data: { purchaseOrderId: 'po-1', versionNumber: 1 } },
        { id: 'v-2', data: { purchaseOrderId: 'po-1', versionNumber: 2 } },
      ];

      mockGetDocs.mockResolvedValueOnce(mockSnapshot(versions));

      const result = await getPurchaseOrderVersions(mockDb, 'po-1');

      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe('v-1');
      expect(result[1]!.id).toBe('v-2');
    });

    it('should return empty array when no versions exist', async () => {
      mockGetDocs.mockResolvedValueOnce(mockSnapshot([]));

      const result = await getPurchaseOrderVersions(mockDb, 'po-1');

      expect(result).toHaveLength(0);
    });

    it('should throw on Firestore error', async () => {
      mockGetDocs.mockRejectedValueOnce(new Error('Firestore error'));

      await expect(getPurchaseOrderVersions(mockDb, 'po-1')).rejects.toThrow();
    });
  });

  describe('createVersionSnapshot', () => {
    it('should create a version snapshot with correct version number', async () => {
      // Mock PO document
      mockGetDoc.mockResolvedValueOnce(
        mockDocResult(true, { poNumber: 'PO-001', status: 'ISSUED' }, 'po-1')
      );
      // Mock PO items
      mockGetDocs.mockResolvedValueOnce(
        mockSnapshot([
          { id: 'item-1', data: { description: 'Steel', quantity: 100, unitPrice: 500 } },
        ])
      );
      // Mock existing versions (for version number)
      mockGetDocs.mockResolvedValueOnce(mockSnapshot([]));
      // Mock addDoc
      mockAddDoc.mockResolvedValueOnce({ id: 'version-new' });

      const result = await createVersionSnapshot(mockDb, 'po-1', null, 'user-1', 'Initial version');

      expect(result).toBe('version-new');
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
      const addDocCall = mockAddDoc.mock.calls[0][1];
      expect(addDocCall.versionNumber).toBe(1);
      expect(addDocCall.purchaseOrderId).toBe('po-1');
      expect(addDocCall.createdBy).toBe('user-1');
      expect(addDocCall.notes).toBe('Initial version');
    });

    it('should increment version number based on existing versions', async () => {
      mockGetDoc.mockResolvedValueOnce(mockDocResult(true, { poNumber: 'PO-001' }, 'po-1'));
      mockGetDocs.mockResolvedValueOnce(mockSnapshot([])); // PO items
      mockGetDocs.mockResolvedValueOnce(
        mockSnapshot([
          { id: 'v-1', data: { versionNumber: 1 } },
          { id: 'v-2', data: { versionNumber: 2 } },
        ])
      ); // Existing versions
      mockAddDoc.mockResolvedValueOnce({ id: 'version-new' });

      await createVersionSnapshot(mockDb, 'po-1', null, 'user-1');

      const addDocCall = mockAddDoc.mock.calls[0][1];
      expect(addDocCall.versionNumber).toBe(3);
    });

    it('should include amendment info when amendment ID is provided', async () => {
      mockGetDoc.mockResolvedValueOnce(mockDocResult(true, { poNumber: 'PO-001' }, 'po-1'));
      mockGetDocs.mockResolvedValueOnce(mockSnapshot([])); // PO items
      mockGetDocs.mockResolvedValueOnce(mockSnapshot([])); // Existing versions
      // Mock amendment document
      mockGetDoc.mockResolvedValueOnce(mockDocResult(true, { amendmentNumber: 3 }, 'amend-1'));
      mockAddDoc.mockResolvedValueOnce({ id: 'version-new' });

      await createVersionSnapshot(mockDb, 'po-1', 'amend-1', 'user-1');

      const addDocCall = mockAddDoc.mock.calls[0][1];
      expect(addDocCall.createdByAmendmentId).toBe('amend-1');
      expect(addDocCall.amendmentNumber).toBe(3);
    });

    it('should throw when PO does not exist', async () => {
      mockGetDoc.mockResolvedValueOnce(mockDocResult(false));

      await expect(createVersionSnapshot(mockDb, 'po-1', null, 'user-1')).rejects.toThrow(
        'Purchase order not found'
      );
    });
  });

  describe('compareVersions', () => {
    it('should detect financial changes between versions', async () => {
      const versions = [
        {
          id: 'v-1',
          data: {
            versionNumber: 1,
            snapshot: { subtotal: 50000, grandTotal: 59000 },
            snapshotItems: [],
          },
        },
        {
          id: 'v-2',
          data: {
            versionNumber: 2,
            snapshot: { subtotal: 60000, grandTotal: 70800 },
            snapshotItems: [],
          },
        },
      ];

      mockGetDocs.mockResolvedValueOnce(mockSnapshot(versions));

      const changes = await compareVersions(mockDb, 'po-1', 1, 2);

      expect(changes.length).toBeGreaterThanOrEqual(2);
      expect(changes.some((c) => c.field === 'subtotal')).toBe(true);
      expect(changes.some((c) => c.field === 'grandTotal')).toBe(true);
    });

    it('should detect item quantity changes', async () => {
      const versions = [
        {
          id: 'v-1',
          data: {
            versionNumber: 1,
            snapshot: {},
            snapshotItems: [{ id: 'item-1', quantity: 100, unitPrice: 500 }],
          },
        },
        {
          id: 'v-2',
          data: {
            versionNumber: 2,
            snapshot: {},
            snapshotItems: [{ id: 'item-1', quantity: 150, unitPrice: 500 }],
          },
        },
      ];

      mockGetDocs.mockResolvedValueOnce(mockSnapshot(versions));

      const changes = await compareVersions(mockDb, 'po-1', 1, 2);

      expect(changes.some((c) => c.field.includes('quantity'))).toBe(true);
      const qtyChange = changes.find((c) => c.field.includes('quantity'));
      expect(qtyChange?.oldValue).toBe(100);
      expect(qtyChange?.newValue).toBe(150);
    });

    it('should detect item price changes', async () => {
      const versions = [
        {
          id: 'v-1',
          data: {
            versionNumber: 1,
            snapshot: {},
            snapshotItems: [{ id: 'item-1', quantity: 100, unitPrice: 500 }],
          },
        },
        {
          id: 'v-2',
          data: {
            versionNumber: 2,
            snapshot: {},
            snapshotItems: [{ id: 'item-1', quantity: 100, unitPrice: 600 }],
          },
        },
      ];

      mockGetDocs.mockResolvedValueOnce(mockSnapshot(versions));

      const changes = await compareVersions(mockDb, 'po-1', 1, 2);

      const priceChange = changes.find((c) => c.field.includes('unitPrice'));
      expect(priceChange).toBeDefined();
      expect(priceChange?.category).toBe('FINANCIAL');
    });

    it('should return empty array when versions are identical', async () => {
      const snapshot = { subtotal: 50000, grandTotal: 59000 };
      const items = [{ id: 'item-1', quantity: 100, unitPrice: 500 }];

      const versions = [
        { id: 'v-1', data: { versionNumber: 1, snapshot, snapshotItems: items } },
        { id: 'v-2', data: { versionNumber: 2, snapshot, snapshotItems: items } },
      ];

      mockGetDocs.mockResolvedValueOnce(mockSnapshot(versions));

      const changes = await compareVersions(mockDb, 'po-1', 1, 2);

      expect(changes).toHaveLength(0);
    });

    it('should throw when version not found', async () => {
      mockGetDocs.mockResolvedValueOnce(mockSnapshot([]));

      await expect(compareVersions(mockDb, 'po-1', 1, 2)).rejects.toThrow('Version not found');
    });
  });
});
