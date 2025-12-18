/**
 * Materialized Aggregations Tests
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions */

import {
  AGGREGATIONS_COLLECTION,
  aggregationKey,
  getAggregation,
  getAggregations,
  incrementCounter,
  updateSum,
  setAggregation,
  updateStatusCounter,
  AggregationKeys,
} from './materializedAggregations';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  increment: jest.fn((value) => ({ _increment: value })),
  Timestamp: {
    now: jest.fn(() => ({ toMillis: () => Date.now() })),
  },
}));

// Mock logger
jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

const mockDoc = doc as jest.Mock;
const mockGetDoc = getDoc as jest.Mock;
const mockSetDoc = setDoc as jest.Mock;
const mockUpdateDoc = updateDoc as jest.Mock;
const mockIncrement = increment as jest.Mock;
// Timestamp is mocked through the jest.mock above

describe('aggregationKey', () => {
  it('should generate key with entity and field for global scope', () => {
    const key = aggregationKey('purchaseOrders', 'count');

    expect(key).toBe('purchaseOrders/count/global');
  });

  it('should generate key with string scope', () => {
    const key = aggregationKey('purchaseOrders', 'totalAmount', 'project-123');

    expect(key).toBe('purchaseOrders/totalAmount/project-123');
  });

  it('should generate key with object scope', () => {
    const key = aggregationKey('purchaseOrders', 'status:APPROVED', {
      projectId: 'proj-1',
      fiscalYear: '2024',
    });

    // Object keys should be sorted alphabetically
    expect(key).toBe('purchaseOrders/status:APPROVED/fiscalYear:2024/projectId:proj-1');
  });

  it('should handle empty object scope as empty string', () => {
    const key = aggregationKey('projects', 'count', {});

    // Empty object results in empty scope part
    expect(key).toBe('projects/count/');
  });

  it('should sort object scope keys alphabetically', () => {
    const key = aggregationKey('vendors', 'spend', {
      z: 'last',
      a: 'first',
      m: 'middle',
    });

    expect(key).toBe('vendors/spend/a:first/m:middle/z:last');
  });
});

describe('getAggregation', () => {
  const mockDb: never = {} as never;
  const mockDocRef = { path: 'aggregations/test-key' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockReturnValue(mockDocRef);
  });

  it('should return aggregation value when document exists', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ value: 42 }),
    });

    const result = await getAggregation(mockDb, 'purchaseOrders/count/global');

    expect(result).toBe(42);
    expect(mockDoc).toHaveBeenCalledWith(
      mockDb,
      AGGREGATIONS_COLLECTION,
      'purchaseOrders__count__global'
    );
  });

  it('should return 0 when document does not exist', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    const result = await getAggregation(mockDb, 'nonexistent/key');

    expect(result).toBe(0);
  });

  it('should return 0 when value field is missing', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({}),
    });

    const result = await getAggregation(mockDb, 'key/without/value');

    expect(result).toBe(0);
  });

  it('should encode slashes in key for document ID', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    await getAggregation(mockDb, 'a/b/c/d');

    expect(mockDoc).toHaveBeenCalledWith(mockDb, AGGREGATIONS_COLLECTION, 'a__b__c__d');
  });
});

describe('getAggregations', () => {
  const mockDb: never = {} as never;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockReturnValue({});
  });

  it('should return map of keys to values', async () => {
    mockGetDoc
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ value: 10 }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ value: 20 }),
      })
      .mockResolvedValueOnce({
        exists: () => false,
      });

    const result = await getAggregations(mockDb, ['key1', 'key2', 'key3']);

    expect(result.get('key1')).toBe(10);
    expect(result.get('key2')).toBe(20);
    expect(result.get('key3')).toBe(0);
    expect(result.size).toBe(3);
  });

  it('should return empty map for empty keys array', async () => {
    const result = await getAggregations(mockDb, []);

    expect(result.size).toBe(0);
  });
});

describe('incrementCounter', () => {
  const mockDb: never = {} as never;
  const mockDocRef = { path: 'aggregations/test-key' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockReturnValue(mockDocRef);
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it('should increment counter by 1 by default', async () => {
    await incrementCounter(mockDb, 'purchaseOrders/count/global');

    expect(mockUpdateDoc).toHaveBeenCalledWith(mockDocRef, {
      value: { _increment: 1 },
      itemCount: { _increment: 1 },
      updatedAt: expect.anything(),
    });
  });

  it('should increment counter by specified amount', async () => {
    await incrementCounter(mockDb, 'key', 5);

    expect(mockIncrement).toHaveBeenCalledWith(5);
    expect(mockUpdateDoc).toHaveBeenCalled();
  });

  it('should decrement counter when amount is negative', async () => {
    await incrementCounter(mockDb, 'key', -1);

    expect(mockIncrement).toHaveBeenCalledWith(-1);
    // itemCount should also decrement
    expect(mockUpdateDoc).toHaveBeenCalledWith(mockDocRef, {
      value: { _increment: -1 },
      itemCount: { _increment: -1 },
      updatedAt: expect.anything(),
    });
  });

  it('should create document if not found', async () => {
    const notFoundError = new Error('No document to update');
    mockUpdateDoc.mockRejectedValueOnce(notFoundError);
    mockSetDoc.mockResolvedValue(undefined);

    await incrementCounter(mockDb, 'new/key', 1);

    expect(mockSetDoc).toHaveBeenCalledWith(mockDocRef, {
      key: 'new/key',
      type: 'count',
      value: 1,
      itemCount: 1,
      updatedAt: expect.anything(),
    });
  });

  it('should create document with 0 itemCount for negative increment on new doc', async () => {
    const notFoundError = new Error('NOT_FOUND');
    mockUpdateDoc.mockRejectedValueOnce(notFoundError);
    mockSetDoc.mockResolvedValue(undefined);

    await incrementCounter(mockDb, 'new/key', -1);

    expect(mockSetDoc).toHaveBeenCalledWith(mockDocRef, {
      key: 'new/key',
      type: 'count',
      value: -1,
      itemCount: 0,
      updatedAt: expect.anything(),
    });
  });

  it('should rethrow non-not-found errors', async () => {
    const otherError = new Error('Permission denied');
    mockUpdateDoc.mockRejectedValueOnce(otherError);

    await expect(incrementCounter(mockDb, 'key')).rejects.toThrow('Permission denied');
  });
});

describe('updateSum', () => {
  const mockDb: never = {} as never;
  const mockDocRef = { path: 'aggregations/test-key' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockReturnValue(mockDocRef);
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it('should update sum with positive delta', async () => {
    await updateSum(mockDb, 'projects/totalValue/global', 1000);

    expect(mockUpdateDoc).toHaveBeenCalledWith(mockDocRef, {
      value: { _increment: 1000 },
      updatedAt: expect.anything(),
    });
  });

  it('should update sum with negative delta', async () => {
    await updateSum(mockDb, 'key', -500);

    expect(mockIncrement).toHaveBeenCalledWith(-500);
  });

  it('should create document if not found', async () => {
    const notFoundError = new Error('No document to update');
    mockUpdateDoc.mockRejectedValueOnce(notFoundError);
    mockSetDoc.mockResolvedValue(undefined);

    await updateSum(mockDb, 'new/sum/key', 100);

    expect(mockSetDoc).toHaveBeenCalledWith(mockDocRef, {
      key: 'new/sum/key',
      type: 'sum',
      value: 100,
      itemCount: 1,
      updatedAt: expect.anything(),
    });
  });
});

describe('setAggregation', () => {
  const mockDb: never = {} as never;
  const mockDocRef = { path: 'aggregations/test-key' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockReturnValue(mockDocRef);
    mockSetDoc.mockResolvedValue(undefined);
  });

  it('should set aggregation with default count type', async () => {
    await setAggregation(mockDb, 'projects/count/global', 50);

    expect(mockSetDoc).toHaveBeenCalledWith(mockDocRef, {
      key: 'projects/count/global',
      type: 'count',
      value: 50,
      itemCount: 50,
      updatedAt: expect.anything(),
    });
  });

  it('should set aggregation with sum type', async () => {
    await setAggregation(mockDb, 'projects/totalValue', 100000, 'sum');

    expect(mockSetDoc).toHaveBeenCalledWith(mockDocRef, {
      key: 'projects/totalValue',
      type: 'sum',
      value: 100000,
      itemCount: 1,
      updatedAt: expect.anything(),
    });
  });

  it('should set aggregation with custom itemCount', async () => {
    await setAggregation(mockDb, 'key', 500, 'avg', 10);

    expect(mockSetDoc).toHaveBeenCalledWith(mockDocRef, {
      key: 'key',
      type: 'avg',
      value: 500,
      itemCount: 10,
      updatedAt: expect.anything(),
    });
  });
});

describe('updateStatusCounter', () => {
  const mockDb: never = {} as never;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockReturnValue({});
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it('should increment new status counter for new entity', async () => {
    await updateStatusCounter(mockDb, 'purchaseOrders', null, 'DRAFT');

    // Should only increment new status (not decrement null)
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
  });

  it('should decrement old and increment new status on status change', async () => {
    await updateStatusCounter(mockDb, 'purchaseOrders', 'DRAFT', 'APPROVED');

    // Should call updateDoc twice: once to decrement old, once to increment new
    expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
  });

  it('should not decrement when old status equals new status', async () => {
    await updateStatusCounter(mockDb, 'purchaseOrders', 'APPROVED', 'APPROVED');

    // Should only increment (same status doesn't decrement)
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
  });

  it('should include scope in aggregation keys', async () => {
    await updateStatusCounter(mockDb, 'purchaseOrders', null, 'DRAFT', { projectId: 'proj-1' });

    expect(mockDoc).toHaveBeenCalledWith(
      mockDb,
      AGGREGATIONS_COLLECTION,
      'purchaseOrders__status:DRAFT__projectId:proj-1'
    );
  });
});

describe('AggregationKeys', () => {
  describe('poCountByStatus', () => {
    it('should generate global key without projectId', () => {
      const key = AggregationKeys.poCountByStatus('APPROVED');

      expect(key).toBe('purchaseOrders/status:APPROVED/global');
    });

    it('should generate project-scoped key with projectId', () => {
      const key = AggregationKeys.poCountByStatus('DRAFT', 'proj-123');

      expect(key).toBe('purchaseOrders/status:DRAFT/projectId:proj-123');
    });
  });

  describe('poTotalByProject', () => {
    it('should generate project-scoped total key', () => {
      const key = AggregationKeys.poTotalByProject('proj-456');

      expect(key).toBe('purchaseOrders/totalAmount/projectId:proj-456');
    });
  });

  describe('prCountByStatus', () => {
    it('should generate global key without projectId', () => {
      const key = AggregationKeys.prCountByStatus('PENDING_APPROVAL');

      expect(key).toBe('purchaseRequests/status:PENDING_APPROVAL/global');
    });

    it('should generate project-scoped key with projectId', () => {
      const key = AggregationKeys.prCountByStatus('APPROVED', 'proj-789');

      expect(key).toBe('purchaseRequests/status:APPROVED/projectId:proj-789');
    });
  });

  describe('projectCount', () => {
    it('should generate global project count key', () => {
      const key = AggregationKeys.projectCount();

      expect(key).toBe('projects/count/global');
    });
  });

  describe('projectCountByStatus', () => {
    it('should generate status-specific project count key', () => {
      const key = AggregationKeys.projectCountByStatus('ACTIVE');

      expect(key).toBe('projects/status:ACTIVE/global');
    });
  });

  describe('vendorSpend', () => {
    it('should generate vendor spend key without fiscal year', () => {
      const key = AggregationKeys.vendorSpend('vendor-1');

      expect(key).toBe('vendors/totalSpend/vendorId:vendor-1');
    });

    it('should generate vendor spend key with fiscal year', () => {
      const key = AggregationKeys.vendorSpend('vendor-1', 2024);

      expect(key).toBe('vendors/totalSpend/fiscalYear:2024/vendorId:vendor-1');
    });
  });

  describe('documentCountByStatus', () => {
    it('should generate global document status key', () => {
      const key = AggregationKeys.documentCountByStatus('APPROVED');

      expect(key).toBe('documents/status:APPROVED/global');
    });

    it('should generate project-scoped document status key', () => {
      const key = AggregationKeys.documentCountByStatus('DRAFT', 'proj-1');

      expect(key).toBe('documents/status:DRAFT/projectId:proj-1');
    });
  });

  describe('userActionCount', () => {
    it('should generate user action count key', () => {
      const key = AggregationKeys.userActionCount('user-123', 'po_created');

      expect(key).toBe('userActivity/po_created/userId:user-123');
    });
  });
});
