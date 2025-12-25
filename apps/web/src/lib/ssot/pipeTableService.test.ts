/**
 * Pipe Table Service Tests
 *
 * Tests for SSOT pipe sizing lookup table operations including:
 * - List, get, create, update, delete pipe sizes
 * - Pipe size lookup by inner diameter
 * - Inner diameter calculation
 * - Seed data functionality
 */

import type { Timestamp } from 'firebase/firestore';
import type { PipeSize, PipeSizeInput } from '@vapour/types';

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
    PIPE_TABLE: (projectId: string) => `projects/${projectId}/pipeTable`,
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
  listPipeSizes,
  getPipeSize,
  subscribeToPipeSizes,
  findPipeSizeForID,
  calculateInnerDiameter,
  createPipeSize,
  updatePipeSize,
  deletePipeSize,
  seedDefaultPipeTable,
  DEFAULT_PIPE_TABLE,
} from './pipeTableService';

function createTestPipeSizeData(overrides: Partial<PipeSize> = {}): Record<string, unknown> {
  return {
    projectId: 'proj-1',
    idRangeMin: 69,
    idRangeMax: 85,
    pipeSizeNB: 80,
    outerDiameter: 88.9,
    thicknessSch40: 5.49,
    createdAt: { seconds: 1234567890, nanoseconds: 0 },
    createdBy: 'user-1',
    ...overrides,
  };
}

describe('pipeTableService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockReturnValue({});
    mockCollection.mockReturnValue({});
    mockDoc.mockReturnValue({});
  });

  // ============================================================================
  // CRUD Tests
  // ============================================================================

  describe('listPipeSizes', () => {
    it('should return all pipe sizes for a project', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'pipe-1', data: () => createTestPipeSizeData({ pipeSizeNB: 50 }) },
          { id: 'pipe-2', data: () => createTestPipeSizeData({ pipeSizeNB: 80 }) },
        ],
      });

      const pipes = await listPipeSizes('proj-1');

      expect(pipes).toHaveLength(2);
      expect(pipes[0]!.id).toBe('pipe-1');
    });

    it('should order by pipeSizeNB', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await listPipeSizes('proj-1');

      expect(mockOrderBy).toHaveBeenCalledWith('pipeSizeNB', 'asc');
    });

    it('should calculate innerDiameter from OD and thickness', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: 'pipe-1',
            data: () => createTestPipeSizeData({ outerDiameter: 88.9, thicknessSch40: 5.49 }),
          },
        ],
      });

      const pipes = await listPipeSizes('proj-1');

      // innerDiameter = 88.9 - 2 * 5.49 = 77.92
      expect(pipes[0]!.innerDiameter).toBeCloseTo(77.92, 1);
    });

    it('should filter out null pipe sizes', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'pipe-1', data: () => createTestPipeSizeData() },
          { id: 'pipe-2', data: () => undefined },
        ],
      });

      const pipes = await listPipeSizes('proj-1');

      expect(pipes).toHaveLength(1);
    });
  });

  describe('getPipeSize', () => {
    it('should return pipe size when found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'pipe-1',
        data: () => createTestPipeSizeData(),
      });

      const pipe = await getPipeSize('proj-1', 'pipe-1');

      expect(pipe).not.toBeNull();
      expect(pipe?.pipeSizeNB).toBe(80);
    });

    it('should return null when not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const pipe = await getPipeSize('proj-1', 'nonexistent');

      expect(pipe).toBeNull();
    });
  });

  describe('subscribeToPipeSizes', () => {
    it('should set up subscription', () => {
      const unsubscribeMock = jest.fn();
      mockOnSnapshot.mockReturnValue(unsubscribeMock);

      const onUpdate = jest.fn();
      const unsubscribe = subscribeToPipeSizes('proj-1', onUpdate);

      expect(mockOnSnapshot).toHaveBeenCalled();
      expect(unsubscribe).toBe(unsubscribeMock);
    });

    it('should call onUpdate with pipe sizes', () => {
      mockOnSnapshot.mockImplementation((_query, onSuccess) => {
        onSuccess({
          docs: [{ id: 'pipe-1', data: () => createTestPipeSizeData() }],
        });
        return jest.fn();
      });

      const onUpdate = jest.fn();
      subscribeToPipeSizes('proj-1', onUpdate);

      expect(onUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'pipe-1' })])
      );
    });

    it('should call onError on failure', () => {
      const testError = new Error('Test error');
      mockOnSnapshot.mockImplementation((_query, _onSuccess, onError) => {
        onError(testError);
        return jest.fn();
      });

      const onError = jest.fn();
      subscribeToPipeSizes('proj-1', jest.fn(), onError);

      expect(onError).toHaveBeenCalledWith(testError);
    });
  });

  describe('createPipeSize', () => {
    it('should create new pipe size', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-pipe-id' });

      const input: PipeSizeInput = {
        idRangeMin: 100,
        idRangeMax: 120,
        pipeSizeNB: 100,
        outerDiameter: 114.3,
        thicknessSch40: 6.02,
      };

      const pipeId = await createPipeSize('proj-1', input, 'user-1');

      expect(pipeId).toBe('new-pipe-id');
      expect(mockAddDoc).toHaveBeenCalled();
    });
  });

  describe('updatePipeSize', () => {
    it('should update pipe size', async () => {
      await updatePipeSize('proj-1', 'pipe-1', { outerDiameter: 90 }, 'user-2');

      expect(mockUpdateDoc).toHaveBeenCalled();
      const callArgs = mockUpdateDoc.mock.calls[0];
      expect(callArgs[1].outerDiameter).toBe(90);
    });
  });

  describe('deletePipeSize', () => {
    it('should delete pipe size', async () => {
      await deletePipeSize('proj-1', 'pipe-1');

      expect(mockDeleteDoc).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Lookup Function Tests
  // ============================================================================

  describe('findPipeSizeForID', () => {
    const mockTimestamp: Timestamp = {
      seconds: 1234567890,
      nanoseconds: 0,
      toDate: () => new Date(),
      toMillis: () => 1234567890000,
      isEqual: () => true,
      valueOf: () => '',
      toJSON: () => ({ seconds: 1234567890, nanoseconds: 0, type: 'Timestamp' }),
    };
    const testPipes: PipeSize[] = [
      {
        id: 'p1',
        projectId: 'proj-1',
        idRangeMin: 0,
        idRangeMax: 15,
        pipeSizeNB: 15,
        outerDiameter: 21.3,
        thicknessSch40: 2.77,
        innerDiameter: 15.76,
        createdAt: mockTimestamp,
        createdBy: 'user-1',
      },
      {
        id: 'p2',
        projectId: 'proj-1',
        idRangeMin: 15,
        idRangeMax: 27,
        pipeSizeNB: 25,
        outerDiameter: 33.4,
        thicknessSch40: 3.38,
        innerDiameter: 26.64,
        createdAt: mockTimestamp,
        createdBy: 'user-1',
      },
      {
        id: 'p3',
        projectId: 'proj-1',
        idRangeMin: 27,
        idRangeMax: 43,
        pipeSizeNB: 40,
        outerDiameter: 48.3,
        thicknessSch40: 3.68,
        innerDiameter: 40.94,
        createdAt: mockTimestamp,
        createdBy: 'user-1',
      },
    ];

    it('should find pipe size matching inner diameter range', () => {
      const result = findPipeSizeForID(testPipes, 20);

      expect(result).not.toBeNull();
      expect(result?.pipeSizeNB).toBe(25);
    });

    it('should find smallest pipe size for minimum value', () => {
      const result = findPipeSizeForID(testPipes, 5);

      expect(result).not.toBeNull();
      expect(result?.pipeSizeNB).toBe(15);
    });

    it('should return largest pipe for value exceeding all ranges', () => {
      const result = findPipeSizeForID(testPipes, 50);

      expect(result).not.toBeNull();
      expect(result?.pipeSizeNB).toBe(40);
    });

    it('should return null for empty pipe array', () => {
      const result = findPipeSizeForID([], 20);

      expect(result).toBeNull();
    });

    it('should handle boundary values correctly', () => {
      // At exact boundary (15), should go to next range
      const atBoundary = findPipeSizeForID(testPipes, 15);
      expect(atBoundary?.pipeSizeNB).toBe(25);

      // Just below boundary
      const belowBoundary = findPipeSizeForID(testPipes, 14.9);
      expect(belowBoundary?.pipeSizeNB).toBe(15);
    });

    it('should sort pipes by NB before lookup', () => {
      const unsortedPipes = [...testPipes].reverse();

      const result = findPipeSizeForID(unsortedPipes, 20);

      expect(result?.pipeSizeNB).toBe(25);
    });
  });

  describe('calculateInnerDiameter', () => {
    it('should calculate ID from OD and wall thickness', () => {
      const id = calculateInnerDiameter(88.9, 5.49);

      expect(id).toBeCloseTo(77.92, 1);
    });

    it('should handle zero wall thickness', () => {
      const id = calculateInnerDiameter(100, 0);

      expect(id).toBe(100);
    });

    it('should return negative for thick walls', () => {
      const id = calculateInnerDiameter(10, 10);

      expect(id).toBe(-10);
    });
  });

  // ============================================================================
  // Seed Data Tests
  // ============================================================================

  describe('DEFAULT_PIPE_TABLE', () => {
    it('should contain standard pipe sizes', () => {
      expect(DEFAULT_PIPE_TABLE.length).toBeGreaterThan(10);
    });

    it('should have valid ID ranges', () => {
      DEFAULT_PIPE_TABLE.forEach((pipe) => {
        expect(pipe.idRangeMin).toBeLessThan(pipe.idRangeMax);
      });
    });

    it('should have contiguous ID ranges', () => {
      for (let i = 1; i < DEFAULT_PIPE_TABLE.length; i++) {
        expect(DEFAULT_PIPE_TABLE[i]!.idRangeMin).toBe(DEFAULT_PIPE_TABLE[i - 1]!.idRangeMax);
      }
    });

    it('should start from 0', () => {
      expect(DEFAULT_PIPE_TABLE[0]!.idRangeMin).toBe(0);
    });
  });

  describe('seedDefaultPipeTable', () => {
    it('should create all default pipe sizes', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-pipe-id' });

      await seedDefaultPipeTable('proj-1', 'user-1');

      expect(mockAddDoc).toHaveBeenCalledTimes(DEFAULT_PIPE_TABLE.length);
    });
  });
});
