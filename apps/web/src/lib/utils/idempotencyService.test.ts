/**
 * Idempotency Service Tests
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions */

import {
  IdempotencyConflictError,
  generateIdempotencyKey,
  checkIdempotencyKey,
  storeIdempotencyKey,
  withIdempotency,
  withUserIdempotency,
  reserveIdempotencyKey,
} from './idempotencyService';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toMillis: () => Date.now() })),
    fromMillis: jest.fn((ms: number) => ({ toMillis: () => ms })),
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
// Timestamp is mocked through the jest.mock above

describe('IdempotencyConflictError', () => {
  it('should create error with correct properties', () => {
    const error = new IdempotencyConflictError(
      'Operation already completed',
      'create-po:offer-123',
      'po-456'
    );

    expect(error.message).toBe('Operation already completed');
    expect(error.name).toBe('IdempotencyConflictError');
    expect(error.key).toBe('create-po:offer-123');
    expect(error.existingResult).toBe('po-456');
  });

  it('should be instanceof Error', () => {
    const error = new IdempotencyConflictError('Test', 'key', 'result');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('generateIdempotencyKey', () => {
  it('should generate key from operation and entityId', () => {
    const key = generateIdempotencyKey('create-po', 'offer-123');

    expect(key).toBe('create-po:offer-123');
  });

  it('should include additional context when provided', () => {
    const key = generateIdempotencyKey('create-po', 'offer-123', 'user-456');

    expect(key).toBe('create-po:offer-123:user-456');
  });

  it('should handle empty strings in parts', () => {
    const key = generateIdempotencyKey('operation', '');

    expect(key).toBe('operation:');
  });
});

describe('checkIdempotencyKey', () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const mockDb = {} as never;
  const mockDocRef = { path: 'idempotency_keys/test-key' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockReturnValue(mockDocRef);
  });

  it('should return null when key does not exist', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    const result = await checkIdempotencyKey(mockDb, 'create-po:offer-123');

    expect(result).toBeNull();
  });

  it('should return result when key exists and not expired', async () => {
    const futureTime = Date.now() + 60000; // 1 minute in future
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        result: 'po-456',
        expiresAt: { toMillis: () => futureTime },
      }),
    });

    const result = await checkIdempotencyKey(mockDb, 'create-po:offer-123');

    expect(result).toBe('po-456');
  });

  it('should return null when key exists but is expired', async () => {
    const pastTime = Date.now() - 60000; // 1 minute in past
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        result: 'po-456',
        expiresAt: { toMillis: () => pastTime },
      }),
    });

    const result = await checkIdempotencyKey(mockDb, 'create-po:offer-123');

    expect(result).toBeNull();
  });
});

describe('storeIdempotencyKey', () => {
  const mockDb: never = {} as never;
  const mockDocRef = { path: 'idempotency_keys/test-key' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockReturnValue(mockDocRef);
    mockSetDoc.mockResolvedValue(undefined);
  });

  it('should store key with default TTL', async () => {
    await storeIdempotencyKey(mockDb, 'create-po:offer-123', 'create-po', 'po-456');

    expect(mockSetDoc).toHaveBeenCalledWith(mockDocRef, {
      key: 'create-po:offer-123',
      operation: 'create-po',
      result: 'po-456',
      createdAt: expect.anything(),
      expiresAt: expect.anything(),
      userId: undefined,
      metadata: undefined,
    });
  });

  it('should store key with custom options', async () => {
    await storeIdempotencyKey(mockDb, 'key', 'operation', 'result', {
      userId: 'user-123',
      metadata: { projectId: 'proj-1' },
      ttlMs: 3600000, // 1 hour
    });

    expect(mockSetDoc).toHaveBeenCalledWith(mockDocRef, {
      key: 'key',
      operation: 'operation',
      result: 'result',
      createdAt: expect.anything(),
      expiresAt: expect.anything(),
      userId: 'user-123',
      metadata: { projectId: 'proj-1' },
    });
  });
});

describe('withIdempotency', () => {
  const mockDb: never = {} as never;
  const mockDocRef = { path: 'idempotency_keys/test-key' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockReturnValue(mockDocRef);
    mockSetDoc.mockResolvedValue(undefined);
  });

  it('should return cached result when key exists', async () => {
    const futureTime = Date.now() + 60000;
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        result: 'cached-result',
        expiresAt: { toMillis: () => futureTime },
      }),
    });

    const fn = jest.fn().mockResolvedValue('new-result');

    const result = await withIdempotency(mockDb, 'key', 'operation', fn);

    expect(result).toBe('cached-result');
    expect(fn).not.toHaveBeenCalled();
  });

  it('should execute function and store result when key does not exist', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    const fn = jest.fn().mockResolvedValue('new-result');

    const result = await withIdempotency(mockDb, 'key', 'operation', fn);

    expect(result).toBe('new-result');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).toHaveBeenCalled();
  });

  it('should propagate errors from the function', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    const fn = jest.fn().mockRejectedValue(new Error('Operation failed'));

    await expect(withIdempotency(mockDb, 'key', 'operation', fn)).rejects.toThrow(
      'Operation failed'
    );
  });

  it('should pass options to storeIdempotencyKey', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    const fn = jest.fn().mockResolvedValue('result');

    await withIdempotency(mockDb, 'key', 'operation', fn, {
      userId: 'user-123',
      metadata: { test: true },
    });

    expect(mockSetDoc).toHaveBeenCalledWith(
      mockDocRef,
      expect.objectContaining({
        userId: 'user-123',
        metadata: { test: true },
      })
    );
  });
});

describe('withUserIdempotency', () => {
  const mockDb: never = {} as never;
  const mockDocRef = { path: 'idempotency_keys/test-key' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockReturnValue(mockDocRef);
    mockSetDoc.mockResolvedValue(undefined);
  });

  it('should generate key with user context', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    const fn = jest.fn().mockResolvedValue('result');

    await withUserIdempotency(mockDb, 'create-po', 'offer-123', 'user-456', fn);

    // Key should include user ID
    expect(mockDoc).toHaveBeenCalledWith(
      mockDb,
      'idempotency_keys',
      'create-po:offer-123:user-456'
    );
  });

  it('should include userId in stored record', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    const fn = jest.fn().mockResolvedValue('result');

    await withUserIdempotency(mockDb, 'create-po', 'offer-123', 'user-456', fn);

    expect(mockSetDoc).toHaveBeenCalledWith(
      mockDocRef,
      expect.objectContaining({
        userId: 'user-456',
      })
    );
  });
});

describe('reserveIdempotencyKey', () => {
  const mockDb: never = {} as never;
  const mockDocRef = { path: 'idempotency_keys/test-key' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockReturnValue(mockDocRef);
    mockSetDoc.mockResolvedValue(undefined);
  });

  it('should throw IdempotencyConflictError when key already exists', async () => {
    const futureTime = Date.now() + 60000;
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        result: 'existing-result',
        expiresAt: { toMillis: () => futureTime },
      }),
    });

    await expect(reserveIdempotencyKey(mockDb, 'create-po:offer-123', 'create-po')).rejects.toThrow(
      IdempotencyConflictError
    );
  });

  it('should create placeholder when key does not exist', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    await reserveIdempotencyKey(mockDb, 'key', 'operation');

    expect(mockSetDoc).toHaveBeenCalledWith(
      mockDocRef,
      expect.objectContaining({
        key: 'key',
        operation: 'operation',
        result: '_pending_',
        status: 'pending',
      })
    );
  });

  it('should return finalizeWithResult function', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    const { finalizeWithResult } = await reserveIdempotencyKey(mockDb, 'key', 'operation');

    expect(typeof finalizeWithResult).toBe('function');
  });

  it('should update record when finalizeWithResult is called', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => false,
    });

    const { finalizeWithResult } = await reserveIdempotencyKey(mockDb, 'key', 'operation');

    await finalizeWithResult('final-result');

    // Should have been called twice: once for placeholder, once for finalize
    expect(mockSetDoc).toHaveBeenCalledTimes(2);
    expect(mockSetDoc).toHaveBeenLastCalledWith(
      mockDocRef,
      expect.objectContaining({
        result: 'final-result',
        status: 'completed',
      })
    );
  });

  it('should allow reservation after key expires', async () => {
    const pastTime = Date.now() - 60000;
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        result: 'old-result',
        expiresAt: { toMillis: () => pastTime },
      }),
    });

    // Should not throw - expired keys are treated as non-existent
    const { finalizeWithResult } = await reserveIdempotencyKey(mockDb, 'key', 'operation');

    expect(finalizeWithResult).toBeDefined();
  });
});
