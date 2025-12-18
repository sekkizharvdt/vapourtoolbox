/**
 * Optimistic Locking Tests
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions */

import {
  OptimisticLockError,
  updateWithVersionCheck,
  updateWithVersionIncrement,
  getDocumentVersion,
  hasBeenModified,
  initialVersion,
  withOptimisticRetry,
} from './optimisticLocking';
import { runTransaction, updateDoc, getDoc, increment } from 'firebase/firestore';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  runTransaction: jest.fn(),
  updateDoc: jest.fn(),
  getDoc: jest.fn(),
  increment: jest.fn((value) => ({ _increment: value })),
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

const mockRunTransaction = runTransaction as jest.Mock;
const mockUpdateDoc = updateDoc as jest.Mock;
const mockGetDoc = getDoc as jest.Mock;
const mockIncrement = increment as jest.Mock;

describe('OptimisticLockError', () => {
  it('should create error with correct properties', () => {
    const error = new OptimisticLockError('Version mismatch', 'documents/doc-1', 1, 2);

    expect(error.message).toBe('Version mismatch');
    expect(error.name).toBe('OptimisticLockError');
    expect(error.documentPath).toBe('documents/doc-1');
    expect(error.expectedVersion).toBe(1);
    expect(error.actualVersion).toBe(2);
  });

  it('should be instanceof Error', () => {
    const error = new OptimisticLockError('Test', 'path', 1, 2);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('updateWithVersionCheck', () => {
  const mockDb: never = {} as never;
  const mockDocRef: never = { path: 'documents/doc-1' } as never;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update document when version matches', async () => {
    const mockTransaction = {
      get: jest.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({ version: 1, name: 'Old Name' }),
      }),
      update: jest.fn(),
    };

    mockRunTransaction.mockImplementation(async (_db, callback) => {
      return callback(mockTransaction);
    });

    await updateWithVersionCheck(mockDb, mockDocRef, { name: 'New Name' }, 1);

    expect(mockTransaction.update).toHaveBeenCalledWith(mockDocRef, {
      name: 'New Name',
      version: 2,
    });
  });

  it('should throw OptimisticLockError when version mismatch', async () => {
    const mockTransaction = {
      get: jest.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({ version: 3 }), // Actual version is 3
      }),
      update: jest.fn(),
    };

    mockRunTransaction.mockImplementation(async (_db, callback) => {
      return callback(mockTransaction);
    });

    await expect(
      updateWithVersionCheck(mockDb, mockDocRef, { name: 'New Name' }, 1)
    ).rejects.toThrow(OptimisticLockError);

    expect(mockTransaction.update).not.toHaveBeenCalled();
  });

  it('should throw error when document not found', async () => {
    const mockTransaction = {
      get: jest.fn().mockResolvedValue({
        exists: () => false,
      }),
    };

    mockRunTransaction.mockImplementation(async (_db, callback) => {
      return callback(mockTransaction);
    });

    await expect(
      updateWithVersionCheck(mockDb, mockDocRef, { name: 'New Name' }, 1)
    ).rejects.toThrow('Document not found');
  });

  it('should handle document without version field (treat as version 0)', async () => {
    const mockTransaction = {
      get: jest.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({ name: 'No version' }), // No version field
      }),
      update: jest.fn(),
    };

    mockRunTransaction.mockImplementation(async (_db, callback) => {
      return callback(mockTransaction);
    });

    await updateWithVersionCheck(mockDb, mockDocRef, { name: 'New Name' }, 0);

    expect(mockTransaction.update).toHaveBeenCalledWith(mockDocRef, {
      name: 'New Name',
      version: 1,
    });
  });
});

describe('updateWithVersionIncrement', () => {
  const mockDocRef: never = { path: 'documents/doc-1' } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it('should update document with increment', async () => {
    await updateWithVersionIncrement(mockDocRef, { name: 'New Name' });

    expect(mockUpdateDoc).toHaveBeenCalledWith(mockDocRef, {
      name: 'New Name',
      version: { _increment: 1 },
    });
  });

  it('should use firestore increment function', async () => {
    await updateWithVersionIncrement(mockDocRef, { status: 'ACTIVE' });

    expect(mockIncrement).toHaveBeenCalledWith(1);
  });
});

describe('getDocumentVersion', () => {
  const mockDocRef: never = { path: 'documents/doc-1' } as never;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return current version', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ version: 5 }),
    });

    const version = await getDocumentVersion(mockDocRef);

    expect(version).toBe(5);
  });

  it('should return 0 when version field is missing', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ name: 'No version' }),
    });

    const version = await getDocumentVersion(mockDocRef);

    expect(version).toBe(0);
  });

  it('should throw error when document not found', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    await expect(getDocumentVersion(mockDocRef)).rejects.toThrow('Document not found');
  });
});

describe('hasBeenModified', () => {
  const mockDocRef: never = { path: 'documents/doc-1' } as never;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return true when version is higher', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ version: 5 }),
    });

    const modified = await hasBeenModified(mockDocRef, 3);

    expect(modified).toBe(true);
  });

  it('should return false when version matches', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ version: 3 }),
    });

    const modified = await hasBeenModified(mockDocRef, 3);

    expect(modified).toBe(false);
  });

  it('should return false when known version is higher (unusual case)', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ version: 2 }),
    });

    const modified = await hasBeenModified(mockDocRef, 5);

    expect(modified).toBe(false);
  });
});

describe('initialVersion', () => {
  it('should return object with version 1', () => {
    const result = initialVersion();

    expect(result).toEqual({ version: 1 });
  });

  it('should create new object each time', () => {
    const result1 = initialVersion();
    const result2 = initialVersion();

    expect(result1).not.toBe(result2);
    expect(result1).toEqual(result2);
  });
});

describe('withOptimisticRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return result on first success', async () => {
    const updateFn = jest.fn().mockResolvedValue('success');
    const refreshFn = jest.fn();

    const result = await withOptimisticRetry(updateFn, refreshFn);

    expect(result).toBe('success');
    expect(updateFn).toHaveBeenCalledTimes(1);
    expect(refreshFn).not.toHaveBeenCalled();
  });

  it('should retry on OptimisticLockError', async () => {
    const lockError = new OptimisticLockError('Conflict', 'path', 1, 2);
    const updateFn = jest
      .fn()
      .mockRejectedValueOnce(lockError)
      .mockResolvedValueOnce('success after retry');
    const refreshFn = jest.fn().mockResolvedValue(undefined);

    const result = await withOptimisticRetry(updateFn, refreshFn);

    expect(result).toBe('success after retry');
    expect(updateFn).toHaveBeenCalledTimes(2);
    expect(refreshFn).toHaveBeenCalledTimes(1);
  });

  it('should throw after max retries exceeded', async () => {
    const lockError = new OptimisticLockError('Conflict', 'path', 1, 2);
    const updateFn = jest.fn().mockRejectedValue(lockError);
    const refreshFn = jest.fn().mockResolvedValue(undefined);

    await expect(withOptimisticRetry(updateFn, refreshFn, 2)).rejects.toThrow(OptimisticLockError);

    expect(updateFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    expect(refreshFn).toHaveBeenCalledTimes(2);
  });

  it('should not retry for non-OptimisticLockError', async () => {
    const otherError = new Error('Different error');
    const updateFn = jest.fn().mockRejectedValue(otherError);
    const refreshFn = jest.fn();

    await expect(withOptimisticRetry(updateFn, refreshFn)).rejects.toThrow('Different error');

    expect(updateFn).toHaveBeenCalledTimes(1);
    expect(refreshFn).not.toHaveBeenCalled();
  });

  it('should respect custom maxRetries', async () => {
    const lockError = new OptimisticLockError('Conflict', 'path', 1, 2);
    const updateFn = jest.fn().mockRejectedValue(lockError);
    const refreshFn = jest.fn().mockResolvedValue(undefined);

    await expect(withOptimisticRetry(updateFn, refreshFn, 5)).rejects.toThrow(OptimisticLockError);

    expect(updateFn).toHaveBeenCalledTimes(6); // Initial + 5 retries
    expect(refreshFn).toHaveBeenCalledTimes(5);
  });

  it('should succeed if retry succeeds within limit', async () => {
    const lockError = new OptimisticLockError('Conflict', 'path', 1, 2);
    const updateFn = jest
      .fn()
      .mockRejectedValueOnce(lockError)
      .mockRejectedValueOnce(lockError)
      .mockResolvedValueOnce('success');
    const refreshFn = jest.fn().mockResolvedValue(undefined);

    const result = await withOptimisticRetry(updateFn, refreshFn, 3);

    expect(result).toBe('success');
    expect(updateFn).toHaveBeenCalledTimes(3);
    expect(refreshFn).toHaveBeenCalledTimes(2);
  });
});
