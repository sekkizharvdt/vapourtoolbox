/**
 * Line Service Tests
 *
 * Tests for SSOT line CRUD operations including:
 * - List, get, create, update, delete lines
 * - Real-time subscriptions
 * - Line enrichment with calculated properties
 */

import type { ProcessLine, ProcessLineInput } from '@vapour/types';

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
    LINES: (projectId: string) => `projects/${projectId}/lines`,
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

const mockEnrichLineInput = jest.fn((input) => ({
  ...input,
  calculatedID:
    Math.sqrt((4 * input.flowRateKgS) / (Math.PI * input.density * input.designVelocity)) * 1000,
  actualVelocity:
    (4 * input.flowRateKgS) / (Math.PI * input.density * Math.pow(input.selectedID / 1000, 2)),
}));

jest.mock('./lineCalculations', () => ({
  enrichLineInput: mockEnrichLineInput,
}));

import {
  listLines,
  getLine,
  subscribeToLines,
  createLine,
  updateLine,
  deleteLine,
} from './lineService';

function createTestLineData(overrides: Partial<ProcessLine> = {}): Record<string, unknown> {
  return {
    projectId: 'proj-1',
    sNo: 1,
    lineNumber: 'L-001',
    fluid: 'Seawater',
    inputDataTag: 'S-001',
    flowRateKgS: 10,
    density: 1025,
    designVelocity: 2.5,
    calculatedID: 70.5,
    selectedID: 80,
    actualVelocity: 2.0,
    pipeSize: '3"',
    schedule: 'Sch 40',
    createdAt: { seconds: 1234567890, nanoseconds: 0 },
    createdBy: 'user-1',
    updatedAt: { seconds: 1234567890, nanoseconds: 0 },
    updatedBy: 'user-1',
    ...overrides,
  };
}

describe('lineService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockReturnValue({});
    mockCollection.mockReturnValue({});
    mockDoc.mockReturnValue({});
  });

  describe('listLines', () => {
    it('should return all lines for a project', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'line-1', data: () => createTestLineData({ sNo: 1 }) },
          { id: 'line-2', data: () => createTestLineData({ sNo: 2 }) },
        ],
      });

      const lines = await listLines('proj-1');

      expect(lines).toHaveLength(2);
      expect(lines[0]!.id).toBe('line-1');
    });

    it('should order lines by sNo', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await listLines('proj-1');

      expect(mockOrderBy).toHaveBeenCalledWith('sNo', 'asc');
    });

    it('should filter out null lines', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'line-1', data: () => createTestLineData() },
          { id: 'line-2', data: () => undefined },
        ],
      });

      const lines = await listLines('proj-1');

      expect(lines).toHaveLength(1);
    });
  });

  describe('getLine', () => {
    it('should return line when found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'line-1',
        data: () => createTestLineData(),
      });

      const line = await getLine('proj-1', 'line-1');

      expect(line).not.toBeNull();
      expect(line?.lineNumber).toBe('L-001');
    });

    it('should return null when not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const line = await getLine('proj-1', 'nonexistent');

      expect(line).toBeNull();
    });
  });

  describe('subscribeToLines', () => {
    it('should set up subscription', () => {
      const unsubscribeMock = jest.fn();
      mockOnSnapshot.mockReturnValue(unsubscribeMock);

      const onUpdate = jest.fn();
      const unsubscribe = subscribeToLines('proj-1', onUpdate);

      expect(mockOnSnapshot).toHaveBeenCalled();
      expect(unsubscribe).toBe(unsubscribeMock);
    });

    it('should call onUpdate with lines', () => {
      mockOnSnapshot.mockImplementation((_query, onSuccess) => {
        onSuccess({
          docs: [{ id: 'line-1', data: () => createTestLineData() }],
        });
        return jest.fn();
      });

      const onUpdate = jest.fn();
      subscribeToLines('proj-1', onUpdate);

      expect(onUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'line-1' })])
      );
    });

    it('should call onError on failure', () => {
      const testError = new Error('Test error');
      mockOnSnapshot.mockImplementation((_query, _onSuccess, onError) => {
        onError(testError);
        return jest.fn();
      });

      const onError = jest.fn();
      subscribeToLines('proj-1', jest.fn(), onError);

      expect(onError).toHaveBeenCalledWith(testError);
    });
  });

  describe('createLine', () => {
    it('should create a new line', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-line-id' });

      const input: ProcessLineInput = {
        sNo: 1,
        lineNumber: 'L-NEW',
        fluid: 'Seawater',
        inputDataTag: 'S-001',
        flowRateKgS: 10,
        density: 1025,
        designVelocity: 2.5,
        calculatedID: 70,
        selectedID: 80,
        actualVelocity: 2.0,
      };

      const lineId = await createLine('proj-1', input, 'user-1');

      expect(lineId).toBe('new-line-id');
      expect(mockAddDoc).toHaveBeenCalled();
    });

    it('should enrich input with calculations', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-line-id' });

      const input: ProcessLineInput = {
        sNo: 1,
        lineNumber: 'L-NEW',
        fluid: 'Seawater',
        inputDataTag: 'S-001',
        flowRateKgS: 10,
        density: 1025,
        designVelocity: 2.5,
        calculatedID: 0,
        selectedID: 80,
        actualVelocity: 0,
      };

      await createLine('proj-1', input, 'user-1');

      expect(mockEnrichLineInput).toHaveBeenCalledWith(input);
    });
  });

  describe('updateLine', () => {
    it('should update an existing line', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'line-1',
        data: () => createTestLineData(),
      });

      await updateLine('proj-1', 'line-1', { flowRateKgS: 15 }, 'user-2');

      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should throw error if line not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      await expect(updateLine('proj-1', 'nonexistent', {}, 'user-1')).rejects.toThrow(
        'Line nonexistent not found'
      );
    });

    it('should recalculate when flow properties change', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'line-1',
        data: () => createTestLineData(),
      });

      mockEnrichLineInput.mockClear();

      await updateLine('proj-1', 'line-1', { flowRateKgS: 15 }, 'user-2');

      expect(mockEnrichLineInput).toHaveBeenCalled();
    });

    it('should not recalculate for non-flow changes', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'line-1',
        data: () => createTestLineData(),
      });

      mockEnrichLineInput.mockClear();

      await updateLine('proj-1', 'line-1', { lineNumber: 'L-NEW' }, 'user-2');

      expect(mockEnrichLineInput).not.toHaveBeenCalled();
    });
  });

  describe('deleteLine', () => {
    it('should delete a line', async () => {
      await deleteLine('proj-1', 'line-1');

      expect(mockDeleteDoc).toHaveBeenCalled();
    });
  });
});
