/**
 * Firebase Test Mocks
 *
 * Provides mock implementations of Firebase services for testing
 */

import type { User } from 'firebase/auth';
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';

/**
 * Mock Firebase User
 */
export const createMockUser = (overrides?: Partial<User>): User => ({
  uid: 'test-user-id',
  email: 'test@example.com',
  displayName: 'Test User',
  emailVerified: true,
  isAnonymous: false,
  metadata: {
    creationTime: new Date().toISOString(),
    lastSignInTime: new Date().toISOString(),
  },
  providerData: [],
  refreshToken: 'mock-refresh-token',
  tenantId: null,
  delete: jest.fn().mockResolvedValue(undefined),
  getIdToken: jest.fn().mockResolvedValue('mock-id-token'),
  getIdTokenResult: jest.fn().mockResolvedValue({
    token: 'mock-id-token',
    expirationTime: new Date(Date.now() + 3600000).toISOString(),
    authTime: new Date().toISOString(),
    issuedAtTime: new Date().toISOString(),
    signInProvider: 'password',
    signInSecondFactor: null,
    claims: {},
  }),
  reload: jest.fn().mockResolvedValue(undefined),
  toJSON: jest.fn().mockReturnValue({}),
  phoneNumber: null,
  photoURL: null,
  providerId: 'firebase',
  ...overrides,
});

/**
 * Mock Firestore Document Snapshot
 */
export const createMockDocumentSnapshot = <T = DocumentData>(
  id: string,
  data: T,
  exists = true
): QueryDocumentSnapshot<T> => {
  const snapshot = {
    id,
    exists: () => exists,
    data: () => (exists ? data : undefined),
    get: (field: string) => (data as Record<string, unknown>)?.[field],
    ref: {
      id,
      path: `collection/${id}`,
      parent: {},
    },
  } as unknown as QueryDocumentSnapshot<T>;

  return snapshot;
};

/**
 * Mock Firestore Query Snapshot
 */
export const createMockQuerySnapshot = <T = DocumentData>(
  docs: Array<{ id: string; data: T }>
) => ({
  docs: docs.map(({ id, data }) => createMockDocumentSnapshot(id, data)),
  empty: docs.length === 0,
  size: docs.length,
  forEach: (
    callback: (doc: ReturnType<typeof createMockDocumentSnapshot>, index: number) => void
  ) => docs.forEach((doc, i) => callback(createMockDocumentSnapshot(doc.id, doc.data), i)),
});

/**
 * Mock Firebase Auth Context
 */
export const mockFirebaseAuth = {
  currentUser: createMockUser(),
  onAuthStateChanged: jest.fn((callback) => {
    callback(createMockUser());
    return jest.fn(); // unsubscribe function
  }),
  signInWithEmailAndPassword: jest.fn().mockResolvedValue({
    user: createMockUser(),
  }),
  signOut: jest.fn().mockResolvedValue(undefined),
  createUserWithEmailAndPassword: jest.fn().mockResolvedValue({
    user: createMockUser(),
  }),
};

/**
 * Mock Firestore
 */
export const mockFirestore = {
  collection: jest.fn().mockReturnThis(),
  doc: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  get: jest.fn().mockResolvedValue(createMockQuerySnapshot([])),
  getDoc: jest.fn().mockResolvedValue(createMockDocumentSnapshot('test-id', {}, false)),
  getDocs: jest.fn().mockResolvedValue(createMockQuerySnapshot([])),
  addDoc: jest.fn().mockResolvedValue({ id: 'new-doc-id' }),
  setDoc: jest.fn().mockResolvedValue(undefined),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  deleteDoc: jest.fn().mockResolvedValue(undefined),
  onSnapshot: jest.fn((callback) => {
    callback(createMockQuerySnapshot([]));
    return jest.fn(); // unsubscribe function
  }),
};

/**
 * Reset all Firebase mocks
 * Call this in beforeEach or afterEach
 */
export const resetFirebaseMocks = () => {
  jest.clearAllMocks();
  Object.values(mockFirebaseAuth).forEach((fn) => {
    if (typeof fn === 'function' && 'mockClear' in fn) {
      fn.mockClear();
    }
  });
  Object.values(mockFirestore).forEach((fn) => {
    if (typeof fn === 'function' && 'mockClear' in fn) {
      fn.mockClear();
    }
  });
};

/**
 * Mock Firestore write batch
 */
export function createMockBatch() {
  const batch = {
    set: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    commit: jest.fn().mockResolvedValue(undefined),
  };

  return batch;
}

/**
 * Mock Firestore onSnapshot listener
 *
 * Returns a function that can be used to trigger snapshot updates in tests
 */
export function createMockOnSnapshot() {
  let callback: ((snapshot: unknown) => void) | null = null;
  let errorCallback: ((error: Error) => void) | null = null;

  const onSnapshot = jest.fn((successCallback, failureCallback?) => {
    callback = successCallback;
    errorCallback = failureCallback || null;

    // Return unsubscribe function
    return jest.fn();
  });

  // Helper to trigger snapshot in tests
  const triggerSnapshot = (data: unknown[] | unknown) => {
    if (!callback) {
      throw new Error('onSnapshot callback not registered');
    }

    const snapshot = Array.isArray(data)
      ? createMockQuerySnapshot(data.map((d, i) => ({ id: `doc-${i}`, data: d as DocumentData })))
      : createMockDocumentSnapshot('test-id', data as DocumentData);

    callback(snapshot);
  };

  // Helper to trigger error in tests
  const triggerError = (error: Error) => {
    if (errorCallback) {
      errorCallback(error);
    }
  };

  return {
    onSnapshot,
    triggerSnapshot,
    triggerError,
  };
}

/**
 * Mock Firebase error
 */
export class FirebaseError extends Error {
  constructor(
    public code: string,
    message: string,
    public customData?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'FirebaseError';
  }
}

/**
 * Common Firebase error codes
 */
export const FirebaseErrorCodes = {
  PERMISSION_DENIED: 'permission-denied',
  NOT_FOUND: 'not-found',
  ALREADY_EXISTS: 'already-exists',
  INVALID_ARGUMENT: 'invalid-argument',
  UNAUTHENTICATED: 'unauthenticated',
  RESOURCE_EXHAUSTED: 'resource-exhausted',
  FAILED_PRECONDITION: 'failed-precondition',
  ABORTED: 'aborted',
  OUT_OF_RANGE: 'out-of-range',
  UNIMPLEMENTED: 'unimplemented',
  INTERNAL: 'internal',
  UNAVAILABLE: 'unavailable',
  DATA_LOSS: 'data-loss',
  DEADLINE_EXCEEDED: 'deadline-exceeded',
};

/**
 * Create a Firebase error
 */
export function createFirebaseError(code: string, message?: string): FirebaseError {
  return new FirebaseError(code, message || `Firebase error: ${code}`, { code });
}

/**
 * Helper to wait for async operations
 */
export function waitFor(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper to flush all pending promises
 */
export async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}
