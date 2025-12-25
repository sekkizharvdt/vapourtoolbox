/**
 * Stream Service Tests
 *
 * Tests for SSOT stream CRUD operations including:
 * - List, get, create, update, delete streams
 * - Real-time subscriptions
 * - Bulk operations
 * - Stream enrichment with calculated properties
 */

import type { ProcessStream, ProcessStreamInput } from '@vapour/types';

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
  getFirebase: jest.fn(() => ({
    db: {},
  })),
}));

jest.mock('@vapour/firebase', () => ({
  SSOT_COLLECTIONS: {
    STREAMS: (projectId: string) => `projects/${projectId}/streams`,
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

// Mock streamCalculations
const mockEnrichStreamInput = jest.fn((input) => ({
  ...input,
  flowRateKgHr: input.flowRateKgS * 3600,
  pressureBar: input.pressureMbar / 1000,
  density: 1000,
  enthalpy: input.temperature * 4.18,
}));

jest.mock('./streamCalculations', () => ({
  enrichStreamInput: mockEnrichStreamInput,
}));

import {
  listStreams,
  getStream,
  subscribeToStreams,
  createStream,
  updateStream,
  deleteStream,
  createStreamsInBulk,
} from './streamService';

// Helper to create test stream data
function createTestStreamData(overrides: Partial<ProcessStream> = {}): Record<string, unknown> {
  return {
    projectId: 'proj-1',
    lineTag: 'S-001',
    description: 'Test stream',
    flowRateKgS: 10,
    flowRateKgHr: 36000,
    pressureMbar: 1013,
    pressureBar: 1.013,
    temperature: 25,
    density: 1000,
    tds: 35000,
    enthalpy: 104.5,
    fluidType: 'SEA WATER',
    createdAt: { seconds: 1234567890, nanoseconds: 0 },
    createdBy: 'user-1',
    updatedAt: { seconds: 1234567890, nanoseconds: 0 },
    updatedBy: 'user-1',
    ...overrides,
  };
}

describe('streamService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockReturnValue({});
    mockCollection.mockReturnValue({});
    mockDoc.mockReturnValue({});
  });

  // ============================================================================
  // listStreams Tests
  // ============================================================================

  describe('listStreams', () => {
    it('should return all streams for a project', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'stream-1', data: () => createTestStreamData({ lineTag: 'S-001' }) },
          { id: 'stream-2', data: () => createTestStreamData({ lineTag: 'S-002' }) },
        ],
      });

      const streams = await listStreams('proj-1');

      expect(streams).toHaveLength(2);
      expect(streams[0]!.id).toBe('stream-1');
      expect(streams[1]!.id).toBe('stream-2');
    });

    it('should filter out null streams', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'stream-1', data: () => createTestStreamData() },
          { id: 'stream-2', data: () => undefined }, // Will return null
        ],
      });

      const streams = await listStreams('proj-1');

      expect(streams).toHaveLength(1);
      expect(streams[0]!.id).toBe('stream-1');
    });

    it('should return empty array when no streams exist', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const streams = await listStreams('proj-1');

      expect(streams).toEqual([]);
    });

    it('should order streams by lineTag', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await listStreams('proj-1');

      expect(mockOrderBy).toHaveBeenCalledWith('lineTag', 'asc');
    });
  });

  // ============================================================================
  // getStream Tests
  // ============================================================================

  describe('getStream', () => {
    it('should return stream when found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'stream-1',
        data: () => createTestStreamData(),
      });

      const stream = await getStream('proj-1', 'stream-1');

      expect(stream).not.toBeNull();
      expect(stream?.id).toBe('stream-1');
      expect(stream?.lineTag).toBe('S-001');
    });

    it('should return null when stream not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const stream = await getStream('proj-1', 'nonexistent');

      expect(stream).toBeNull();
    });

    it('should map all stream properties correctly', async () => {
      const testData = createTestStreamData({
        lineTag: 'S-TEST',
        temperature: 80,
        fluidType: 'STEAM',
      });
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'stream-1',
        data: () => testData,
      });

      const stream = await getStream('proj-1', 'stream-1');

      expect(stream?.lineTag).toBe('S-TEST');
      expect(stream?.temperature).toBe(80);
      expect(stream?.fluidType).toBe('STEAM');
      expect(stream?.projectId).toBe('proj-1');
    });
  });

  // ============================================================================
  // subscribeToStreams Tests
  // ============================================================================

  describe('subscribeToStreams', () => {
    it('should set up real-time subscription', () => {
      const unsubscribeMock = jest.fn();
      mockOnSnapshot.mockReturnValue(unsubscribeMock);

      const onUpdate = jest.fn();
      const unsubscribe = subscribeToStreams('proj-1', onUpdate);

      expect(mockOnSnapshot).toHaveBeenCalled();
      expect(unsubscribe).toBe(unsubscribeMock);
    });

    it('should call onUpdate with streams when snapshot changes', () => {
      mockOnSnapshot.mockImplementation((_query, onSuccess) => {
        onSuccess({
          docs: [
            { id: 'stream-1', data: () => createTestStreamData({ lineTag: 'S-001' }) },
            { id: 'stream-2', data: () => createTestStreamData({ lineTag: 'S-002' }) },
          ],
        });
        return jest.fn();
      });

      const onUpdate = jest.fn();
      subscribeToStreams('proj-1', onUpdate);

      expect(onUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'stream-1' }),
          expect.objectContaining({ id: 'stream-2' }),
        ])
      );
    });

    it('should call onError when snapshot fails', () => {
      const testError = new Error('Firestore error');
      mockOnSnapshot.mockImplementation((_query, _onSuccess, onError) => {
        onError(testError);
        return jest.fn();
      });

      const onUpdate = jest.fn();
      const onError = jest.fn();
      subscribeToStreams('proj-1', onUpdate, onError);

      expect(onError).toHaveBeenCalledWith(testError);
    });

    it('should handle missing onError callback', () => {
      const testError = new Error('Firestore error');
      mockOnSnapshot.mockImplementation((_query, _onSuccess, onError) => {
        onError(testError);
        return jest.fn();
      });

      const onUpdate = jest.fn();
      // Should not throw when onError is not provided
      expect(() => subscribeToStreams('proj-1', onUpdate)).not.toThrow();
    });
  });

  // ============================================================================
  // createStream Tests
  // ============================================================================

  describe('createStream', () => {
    it('should create a new stream and return its ID', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-stream-id' });

      const input: ProcessStreamInput = {
        lineTag: 'S-NEW',
        flowRateKgS: 5,
        flowRateKgHr: 18000,
        pressureMbar: 1013,
        pressureBar: 1.013,
        temperature: 25,
        density: 1000,
        enthalpy: 104.5,
        fluidType: 'SEA WATER',
      };

      const streamId = await createStream('proj-1', input, 'user-1');

      expect(streamId).toBe('new-stream-id');
      expect(mockAddDoc).toHaveBeenCalled();
    });

    it('should include projectId and user metadata', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-stream-id' });

      const input: ProcessStreamInput = {
        lineTag: 'S-NEW',
        flowRateKgS: 5,
        flowRateKgHr: 18000,
        pressureMbar: 1013,
        pressureBar: 1.013,
        temperature: 25,
        density: 1000,
        enthalpy: 104.5,
        fluidType: 'SEA WATER',
      };

      await createStream('proj-1', input, 'user-1');

      const callArgs = mockAddDoc.mock.calls[0];
      const streamData = callArgs[1];

      expect(streamData.projectId).toBe('proj-1');
      expect(streamData.createdBy).toBe('user-1');
      expect(streamData.updatedBy).toBe('user-1');
      expect(streamData.createdAt).toBeDefined();
      expect(streamData.updatedAt).toBeDefined();
    });

    it('should enrich input with calculated properties', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-stream-id' });

      const input: ProcessStreamInput = {
        lineTag: 'S-NEW',
        flowRateKgS: 10,
        flowRateKgHr: 0, // Will be calculated
        pressureMbar: 2000,
        pressureBar: 0, // Will be calculated
        temperature: 50,
        density: 0, // Will be calculated
        enthalpy: 0, // Will be calculated
        fluidType: 'DISTILLATE WATER',
      };

      await createStream('proj-1', input, 'user-1');

      const callArgs = mockAddDoc.mock.calls[0];
      const streamData = callArgs[1];

      // enrichStreamInput mock calculates these
      expect(streamData.flowRateKgHr).toBe(36000); // 10 * 3600
      expect(streamData.pressureBar).toBe(2); // 2000 / 1000
      expect(streamData.density).toBe(1000);
      expect(streamData.enthalpy).toBe(209); // 50 * 4.18
    });
  });

  // ============================================================================
  // updateStream Tests
  // ============================================================================

  describe('updateStream', () => {
    it('should update an existing stream', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'stream-1',
        data: () => createTestStreamData(),
      });

      await updateStream('proj-1', 'stream-1', { temperature: 80 }, 'user-2');

      expect(mockUpdateDoc).toHaveBeenCalled();
    });

    it('should throw error if stream not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(
        updateStream('proj-1', 'nonexistent', { temperature: 80 }, 'user-1')
      ).rejects.toThrow('Stream nonexistent not found');
    });

    it('should merge updates with current stream data', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'stream-1',
        data: () => createTestStreamData({ lineTag: 'S-001', temperature: 25 }),
      });

      await updateStream('proj-1', 'stream-1', { temperature: 80 }, 'user-2');

      const callArgs = mockUpdateDoc.mock.calls[0];
      const updateData = callArgs[1];

      expect(updateData.lineTag).toBe('S-001'); // Preserved
      expect(updateData.temperature).toBe(80); // Updated
      expect(updateData.updatedBy).toBe('user-2');
    });

    it('should recalculate properties when key inputs change', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'stream-1',
        data: () => createTestStreamData({ temperature: 25, flowRateKgS: 10 }),
      });

      // Temperature change triggers recalculation
      await updateStream('proj-1', 'stream-1', { temperature: 50 }, 'user-2');

      expect(mockEnrichStreamInput).toHaveBeenCalled();
    });

    it('should not recalculate if only non-key inputs change', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'stream-1',
        data: () => createTestStreamData(),
      });

      // Clear previous calls
      mockEnrichStreamInput.mockClear();

      // Description change doesn't trigger recalculation
      await updateStream('proj-1', 'stream-1', { description: 'New description' }, 'user-2');

      expect(mockEnrichStreamInput).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // deleteStream Tests
  // ============================================================================

  describe('deleteStream', () => {
    it('should delete a stream', async () => {
      await deleteStream('proj-1', 'stream-1');

      expect(mockDeleteDoc).toHaveBeenCalled();
    });

    it('should use correct document reference', async () => {
      await deleteStream('proj-1', 'stream-1');

      expect(mockDoc).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // createStreamsInBulk Tests
  // ============================================================================

  describe('createStreamsInBulk', () => {
    it('should create multiple streams and return their IDs', async () => {
      let callCount = 0;
      mockAddDoc.mockImplementation(() => {
        callCount++;
        return Promise.resolve({ id: `stream-${callCount}` });
      });

      const inputs: ProcessStreamInput[] = [
        {
          lineTag: 'S-001',
          flowRateKgS: 5,
          flowRateKgHr: 18000,
          pressureMbar: 1013,
          pressureBar: 1.013,
          temperature: 25,
          density: 1000,
          enthalpy: 104.5,
          fluidType: 'SEA WATER',
        },
        {
          lineTag: 'S-002',
          flowRateKgS: 10,
          flowRateKgHr: 36000,
          pressureMbar: 2000,
          pressureBar: 2,
          temperature: 50,
          density: 1000,
          enthalpy: 209,
          fluidType: 'DISTILLATE WATER',
        },
      ];

      const ids = await createStreamsInBulk('proj-1', inputs, 'user-1');

      expect(ids).toHaveLength(2);
      expect(ids[0]).toBe('stream-1');
      expect(ids[1]).toBe('stream-2');
    });

    it('should process all streams sequentially', async () => {
      const callOrder: string[] = [];
      mockAddDoc.mockImplementation(async (_, data) => {
        callOrder.push(data.lineTag);
        return { id: `id-${callOrder.length}` };
      });

      const inputs: ProcessStreamInput[] = [
        {
          lineTag: 'S-001',
          flowRateKgS: 1,
          flowRateKgHr: 3600,
          pressureMbar: 1000,
          pressureBar: 1,
          temperature: 25,
          density: 1000,
          enthalpy: 100,
          fluidType: 'SEA WATER',
        },
        {
          lineTag: 'S-002',
          flowRateKgS: 2,
          flowRateKgHr: 7200,
          pressureMbar: 1000,
          pressureBar: 1,
          temperature: 25,
          density: 1000,
          enthalpy: 100,
          fluidType: 'SEA WATER',
        },
        {
          lineTag: 'S-003',
          flowRateKgS: 3,
          flowRateKgHr: 10800,
          pressureMbar: 1000,
          pressureBar: 1,
          temperature: 25,
          density: 1000,
          enthalpy: 100,
          fluidType: 'SEA WATER',
        },
      ];

      await createStreamsInBulk('proj-1', inputs, 'user-1');

      expect(callOrder).toEqual(['S-001', 'S-002', 'S-003']);
    });

    it('should handle empty input array', async () => {
      const ids = await createStreamsInBulk('proj-1', [], 'user-1');

      expect(ids).toEqual([]);
      expect(mockAddDoc).not.toHaveBeenCalled();
    });
  });
});
