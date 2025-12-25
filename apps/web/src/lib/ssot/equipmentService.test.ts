/**
 * Equipment Service Tests
 *
 * Tests for SSOT equipment CRUD operations including:
 * - List, get, create, update, delete equipment
 * - Real-time subscriptions
 */

import type { ProcessEquipment, ProcessEquipmentInput } from '@vapour/types';

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
    EQUIPMENT: (projectId: string) => `projects/${projectId}/equipment`,
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
  listEquipment,
  getEquipment,
  subscribeToEquipment,
  createEquipment,
  updateEquipment,
  deleteEquipment,
} from './equipmentService';

function createTestEquipmentData(
  overrides: Partial<ProcessEquipment> = {}
): Record<string, unknown> {
  return {
    projectId: 'proj-1',
    equipmentName: 'Flash Vessel',
    equipmentTag: 'V-001',
    operatingPressure: 1.5,
    operatingTemperature: 120,
    fluidIn: ['S-001', 'S-002'],
    fluidOut: ['S-003', 'S-004'],
    createdAt: { seconds: 1234567890, nanoseconds: 0 },
    createdBy: 'user-1',
    updatedAt: { seconds: 1234567890, nanoseconds: 0 },
    updatedBy: 'user-1',
    ...overrides,
  };
}

describe('equipmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockReturnValue({});
    mockCollection.mockReturnValue({});
    mockDoc.mockReturnValue({});
  });

  describe('listEquipment', () => {
    it('should return all equipment for a project', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'eq-1', data: () => createTestEquipmentData({ equipmentTag: 'V-001' }) },
          { id: 'eq-2', data: () => createTestEquipmentData({ equipmentTag: 'P-001' }) },
        ],
      });

      const equipment = await listEquipment('proj-1');

      expect(equipment).toHaveLength(2);
      expect(equipment[0]!.id).toBe('eq-1');
    });

    it('should order by equipmentTag', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      await listEquipment('proj-1');

      expect(mockOrderBy).toHaveBeenCalledWith('equipmentTag', 'asc');
    });

    it('should filter out null equipment', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'eq-1', data: () => createTestEquipmentData() },
          { id: 'eq-2', data: () => undefined },
        ],
      });

      const equipment = await listEquipment('proj-1');

      expect(equipment).toHaveLength(1);
    });

    it('should handle empty fluidIn/fluidOut arrays', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          {
            id: 'eq-1',
            data: () => ({ ...createTestEquipmentData(), fluidIn: undefined, fluidOut: undefined }),
          },
        ],
      });

      const equipment = await listEquipment('proj-1');

      expect(equipment[0]!.fluidIn).toEqual([]);
      expect(equipment[0]!.fluidOut).toEqual([]);
    });
  });

  describe('getEquipment', () => {
    it('should return equipment when found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'eq-1',
        data: () => createTestEquipmentData(),
      });

      const equipment = await getEquipment('proj-1', 'eq-1');

      expect(equipment).not.toBeNull();
      expect(equipment?.equipmentTag).toBe('V-001');
    });

    it('should return null when not found', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false });

      const equipment = await getEquipment('proj-1', 'nonexistent');

      expect(equipment).toBeNull();
    });
  });

  describe('subscribeToEquipment', () => {
    it('should set up subscription', () => {
      const unsubscribeMock = jest.fn();
      mockOnSnapshot.mockReturnValue(unsubscribeMock);

      const onUpdate = jest.fn();
      const unsubscribe = subscribeToEquipment('proj-1', onUpdate);

      expect(mockOnSnapshot).toHaveBeenCalled();
      expect(unsubscribe).toBe(unsubscribeMock);
    });

    it('should call onUpdate with equipment', () => {
      mockOnSnapshot.mockImplementation((_query, onSuccess) => {
        onSuccess({
          docs: [{ id: 'eq-1', data: () => createTestEquipmentData() }],
        });
        return jest.fn();
      });

      const onUpdate = jest.fn();
      subscribeToEquipment('proj-1', onUpdate);

      expect(onUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'eq-1' })])
      );
    });

    it('should call onError on failure', () => {
      const testError = new Error('Test error');
      mockOnSnapshot.mockImplementation((_query, _onSuccess, onError) => {
        onError(testError);
        return jest.fn();
      });

      const onError = jest.fn();
      subscribeToEquipment('proj-1', jest.fn(), onError);

      expect(onError).toHaveBeenCalledWith(testError);
    });
  });

  describe('createEquipment', () => {
    it('should create new equipment', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-eq-id' });

      const input: ProcessEquipmentInput = {
        equipmentName: 'Heat Exchanger',
        equipmentTag: 'E-001',
        operatingPressure: 2.0,
        operatingTemperature: 80,
        fluidIn: ['S-001'],
        fluidOut: ['S-002'],
      };

      const equipmentId = await createEquipment('proj-1', input, 'user-1');

      expect(equipmentId).toBe('new-eq-id');
      expect(mockAddDoc).toHaveBeenCalled();
    });

    it('should include metadata', async () => {
      mockAddDoc.mockResolvedValue({ id: 'new-eq-id' });

      const input: ProcessEquipmentInput = {
        equipmentName: 'Pump',
        equipmentTag: 'P-001',
        operatingPressure: 3.0,
        operatingTemperature: 25,
        fluidIn: ['S-001'],
        fluidOut: ['S-002'],
      };

      await createEquipment('proj-1', input, 'user-1');

      const callArgs = mockAddDoc.mock.calls[0];
      const data = callArgs[1];

      expect(data.projectId).toBe('proj-1');
      expect(data.createdBy).toBe('user-1');
      expect(data.updatedBy).toBe('user-1');
    });
  });

  describe('updateEquipment', () => {
    it('should update equipment', async () => {
      await updateEquipment('proj-1', 'eq-1', { operatingPressure: 3.0 }, 'user-2');

      expect(mockUpdateDoc).toHaveBeenCalled();
      const callArgs = mockUpdateDoc.mock.calls[0];
      expect(callArgs[1].operatingPressure).toBe(3.0);
      expect(callArgs[1].updatedBy).toBe('user-2');
    });
  });

  describe('deleteEquipment', () => {
    it('should delete equipment', async () => {
      await deleteEquipment('proj-1', 'eq-1');

      expect(mockDeleteDoc).toHaveBeenCalled();
    });
  });
});
