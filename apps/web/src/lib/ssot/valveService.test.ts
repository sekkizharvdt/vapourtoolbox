/**
 * Valve Service Tests
 *
 * Tests for SSOT valve CRUD operations including:
 * - List, get, create, update, delete valves
 * - Real-time subscriptions
 */

import type { ProcessValve, ProcessValveInput } from '@vapour/types';

// Mock Firebase
const mockGetDocs = jest.fn();
const mockGetDoc = jest.fn();
const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockOnSnapshot = jest.fn();
const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockQuery = jest.fn();
const mockOrderBy = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  Timestamp: {
    now: jest.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
  },
}));

jest.mock('@/lib/firebase', () => ({
  getFirebase: jest.fn(() => ({ db: {} })),
}));

jest.mock('@vapour/firebase', () => ({
  SSOT_COLLECTIONS: {
    VALVES: (projectId: string) => `projects/${projectId}/valves`,
  },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

import {
  listValves,
  getValve,
  subscribeToValves,
  createValve,
  updateValve,
  deleteValve,
} from './valveService';

function createTestValveData(overrides: Partial<ProcessValve> = {}): Record<string, unknown> {
  return {
    projectId: 'proj-1',
    sNo: 1,
    pidNo: 'PID-001',
    lineNumber: 'L-001',
    valveTag: 'XV-001',
    serviceLocation: 'Seawater Intake',
    valveType: 'Ball',
    endConnection: 'Flanged',
    sizeNB: '80',
    fluid: 'Seawater',
    pressureNor: 2.5,
    temperatureNor: 25,
    flowNor: 10,
    valveOperation: 'Manual',
    bodyMaterial: 'SS316',
    createdAt: { seconds: 1234567890, nanoseconds: 0 },
    createdBy: 'user-1',
    updatedAt: { seconds: 1234567890, nanoseconds: 0 },
    updatedBy: 'user-1',
    ...overrides,
  };
}

describe('valveService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockReturnValue({});
    mockCollection.mockReturnValue({});
    mockDoc.mockReturnValue({});
  });

  describe('listValves', () => {
    it('should return all valves for a project', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'valve-1', data: () => createTestValveData({ valveTag: 'XV-001' }) },
          { id: 'valve-2', data: () => createTestValveData({ valveTag: 'CV-001' }) },
        ],
      });

      const valves = await listValves('proj-1');

      expect(valves).toHaveLength(2);
      expect(valves[0]!.id).toBe('valve-1');
    });

    it('should order by sNo', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await listValves('proj-1');

      expect(mockOrderBy).toHaveBeenCalledWith('sNo', 'asc');
    });

    it('should filter out null valves', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'valve-1', data: () => createTestValveData() },
          { id: 'valve-2', data: () => undefined },
        ],
      });

      const valves = await listValves('proj-1');

      expect(valves).toHaveLength(1);
    });
  });

  describe('getValve', () => {
    it('should return valve when found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'valve-1',
        data: () => createTestValveData(),
      });

      const valve = await getValve('proj-1', 'valve-1');

      expect(valve).not.toBeNull();
      expect(valve?.valveTag).toBe('XV-001');
    });

    it('should return null when not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const valve = await getValve('proj-1', 'nonexistent');

      expect(valve).toBeNull();
    });

    it('should map all valve properties', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'valve-1',
        data: () =>
          createTestValveData({
            valveType: 'Globe',
            bodyMaterial: 'CS',
            trimMaterial: 'SS304',
          }),
      });

      const valve = await getValve('proj-1', 'valve-1');

      expect(valve?.valveType).toBe('Globe');
      expect(valve?.bodyMaterial).toBe('CS');
      expect(valve?.trimMaterial).toBe('SS304');
    });
  });

  describe('subscribeToValves', () => {
    it('should set up subscription', () => {
      const unsubscribeMock = jest.fn();
      mockOnSnapshot.mockReturnValue(unsubscribeMock);

      const onUpdate = jest.fn();
      const unsubscribe = subscribeToValves('proj-1', onUpdate);

      expect(mockOnSnapshot).toHaveBeenCalled();
      expect(unsubscribe).toBe(unsubscribeMock);
    });

    it('should call onUpdate with valves', () => {
      mockOnSnapshot.mockImplementation((_query, onSuccess) => {
        onSuccess({
          docs: [{ id: 'valve-1', data: () => createTestValveData() }],
        });
        return jest.fn();
      });

      const onUpdate = jest.fn();
      subscribeToValves('proj-1', onUpdate);

      expect(onUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'valve-1' })])
      );
    });

    it('should call onError on failure', () => {
      const testError = new Error('Test error');
      mockOnSnapshot.mockImplementation((_query, _onSuccess, onError) => {
        onError(testError);
        return jest.fn();
      });

      const onError = jest.fn();
      subscribeToValves('proj-1', jest.fn(), onError);

      expect(onError).toHaveBeenCalledWith(testError);
    });
  });

  describe('createValve', () => {
    it('should create new valve', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-valve-id' });

      const input: ProcessValveInput = {
        sNo: 1,
        pidNo: 'PID-001',
        lineNumber: 'L-001',
        valveTag: 'XV-NEW',
        serviceLocation: 'Test Location',
        valveType: 'Gate',
        endConnection: 'Flanged',
        sizeNB: '50',
        fluid: 'Water',
      };

      const valveId = await createValve('proj-1', input, 'user-1');

      expect(valveId).toBe('new-valve-id');
      expect(mockAddDoc).toHaveBeenCalled();
    });

    it('should include metadata', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-valve-id' });

      const input: ProcessValveInput = {
        sNo: 1,
        pidNo: 'PID-001',
        lineNumber: 'L-001',
        valveTag: 'XV-NEW',
        serviceLocation: 'Test',
        valveType: 'Ball',
        endConnection: 'Screwed',
        sizeNB: '25',
        fluid: 'Air',
      };

      await createValve('proj-1', input, 'user-1');

      const callArgs = mockAddDoc.mock.calls[0];
      const data = callArgs[1];

      expect(data.projectId).toBe('proj-1');
      expect(data.createdBy).toBe('user-1');
      expect(data.updatedBy).toBe('user-1');
    });
  });

  describe('updateValve', () => {
    it('should update valve', async () => {
      await updateValve('proj-1', 'valve-1', { pressureNor: 5.0 }, 'user-2');

      expect(mockUpdateDoc).toHaveBeenCalled();
      const callArgs = mockUpdateDoc.mock.calls[0];
      expect(callArgs[1].pressureNor).toBe(5.0);
      expect(callArgs[1].updatedBy).toBe('user-2');
    });
  });

  describe('deleteValve', () => {
    it('should delete valve', async () => {
      await deleteValve('proj-1', 'valve-1');

      expect(mockDeleteDoc).toHaveBeenCalled();
    });
  });
});
