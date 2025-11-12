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
