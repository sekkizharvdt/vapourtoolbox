/**
 * Instrument Service Tests
 *
 * Tests for SSOT instrument CRUD operations including:
 * - List, get, create, update, delete instruments
 * - Real-time subscriptions
 */

import type { ProcessInstrument, ProcessInstrumentInput } from '@vapour/types';

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
    INSTRUMENTS: (projectId: string) => `projects/${projectId}/instruments`,
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
  listInstruments,
  getInstrument,
  subscribeToInstruments,
  createInstrument,
  updateInstrument,
  deleteInstrument,
} from './instrumentService';

function createTestInstrumentData(
  overrides: Partial<ProcessInstrument> = {}
): Record<string, unknown> {
  return {
    projectId: 'proj-1',
    sNo: 1,
    pidNo: 'PID-001',
    lineNo: 'L-001',
    tagNo: 'PT-001',
    serviceLocation: 'Seawater Pump Discharge',
    instrumentType: 'Pressure Transmitter',
    fluid: 'Seawater',
    pressureNor: 2.5,
    temperatureNor: 25,
    instRange: '0-10 bar',
    type: '4-20mA',
    moc: 'SS316',
    createdAt: { seconds: 1234567890, nanoseconds: 0 },
    createdBy: 'user-1',
    updatedAt: { seconds: 1234567890, nanoseconds: 0 },
    updatedBy: 'user-1',
    ...overrides,
  };
}

describe('instrumentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockReturnValue({});
    mockCollection.mockReturnValue({});
    mockDoc.mockReturnValue({});
  });

  describe('listInstruments', () => {
    it('should return all instruments for a project', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'inst-1', data: () => createTestInstrumentData({ tagNo: 'PT-001' }) },
          { id: 'inst-2', data: () => createTestInstrumentData({ tagNo: 'FT-001' }) },
        ],
      });

      const instruments = await listInstruments('proj-1');

      expect(instruments).toHaveLength(2);
      expect(instruments[0]!.id).toBe('inst-1');
    });

    it('should order by sNo', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await listInstruments('proj-1');

      expect(mockOrderBy).toHaveBeenCalledWith('sNo', 'asc');
    });

    it('should filter out null instruments', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'inst-1', data: () => createTestInstrumentData() },
          { id: 'inst-2', data: () => undefined },
        ],
      });

      const instruments = await listInstruments('proj-1');

      expect(instruments).toHaveLength(1);
    });
  });

  describe('getInstrument', () => {
    it('should return instrument when found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'inst-1',
        data: () => createTestInstrumentData(),
      });

      const instrument = await getInstrument('proj-1', 'inst-1');

      expect(instrument).not.toBeNull();
      expect(instrument?.tagNo).toBe('PT-001');
    });

    it('should return null when not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const instrument = await getInstrument('proj-1', 'nonexistent');

      expect(instrument).toBeNull();
    });

    it('should map all instrument properties', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'inst-1',
        data: () =>
          createTestInstrumentData({
            instrumentType: 'Flow Meter',
            instRange: '0-100 m³/h',
            signalPLC: 'AI',
          }),
      });

      const instrument = await getInstrument('proj-1', 'inst-1');

      expect(instrument?.instrumentType).toBe('Flow Meter');
      expect(instrument?.instRange).toBe('0-100 m³/h');
      expect(instrument?.signalPLC).toBe('AI');
    });
  });

  describe('subscribeToInstruments', () => {
    it('should set up subscription', () => {
      const unsubscribeMock = jest.fn();
      mockOnSnapshot.mockReturnValue(unsubscribeMock);

      const onUpdate = jest.fn();
      const unsubscribe = subscribeToInstruments('proj-1', onUpdate);

      expect(mockOnSnapshot).toHaveBeenCalled();
      expect(unsubscribe).toBe(unsubscribeMock);
    });

    it('should call onUpdate with instruments', () => {
      mockOnSnapshot.mockImplementation((_query, onSuccess) => {
        onSuccess({
          docs: [{ id: 'inst-1', data: () => createTestInstrumentData() }],
        });
        return jest.fn();
      });

      const onUpdate = jest.fn();
      subscribeToInstruments('proj-1', onUpdate);

      expect(onUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'inst-1' })])
      );
    });

    it('should call onError on failure', () => {
      const testError = new Error('Test error');
      mockOnSnapshot.mockImplementation((_query, _onSuccess, onError) => {
        onError(testError);
        return jest.fn();
      });

      const onError = jest.fn();
      subscribeToInstruments('proj-1', jest.fn(), onError);

      expect(onError).toHaveBeenCalledWith(testError);
    });
  });

  describe('createInstrument', () => {
    it('should create new instrument', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-inst-id' });

      const input: ProcessInstrumentInput = {
        sNo: 1,
        pidNo: 'PID-001',
        lineNo: 'L-001',
        tagNo: 'TT-001',
        serviceLocation: 'Heater Outlet',
        instrumentType: 'Temperature Transmitter',
        fluid: 'Steam',
      };

      const instrumentId = await createInstrument('proj-1', input, 'user-1');

      expect(instrumentId).toBe('new-inst-id');
      expect(mockAddDoc).toHaveBeenCalled();
    });

    it('should include metadata', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-inst-id' });

      const input: ProcessInstrumentInput = {
        sNo: 1,
        pidNo: 'PID-001',
        lineNo: 'L-001',
        tagNo: 'LT-001',
        serviceLocation: 'Tank Level',
        instrumentType: 'Level Transmitter',
        fluid: 'Water',
      };

      await createInstrument('proj-1', input, 'user-1');

      const callArgs = mockAddDoc.mock.calls[0];
      const data = callArgs[1];

      expect(data.projectId).toBe('proj-1');
      expect(data.createdBy).toBe('user-1');
      expect(data.updatedBy).toBe('user-1');
    });
  });

  describe('updateInstrument', () => {
    it('should update instrument', async () => {
      await updateInstrument('proj-1', 'inst-1', { instRange: '0-20 bar' }, 'user-2');

      expect(mockUpdateDoc).toHaveBeenCalled();
      const callArgs = mockUpdateDoc.mock.calls[0];
      expect(callArgs[1].instRange).toBe('0-20 bar');
      expect(callArgs[1].updatedBy).toBe('user-2');
    });
  });

  describe('deleteInstrument', () => {
    it('should delete instrument', async () => {
      await deleteInstrument('proj-1', 'inst-1');

      expect(mockDeleteDoc).toHaveBeenCalled();
    });
  });
});
