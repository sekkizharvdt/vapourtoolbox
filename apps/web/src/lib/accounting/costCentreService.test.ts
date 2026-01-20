/**
 * Cost Centre Service Tests
 *
 * Tests for cost centre operations: create, get
 */

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    COST_CENTRES: 'costCentres',
  },
}));

// Mock Firebase Firestore
const mockAddDoc = jest.fn().mockResolvedValue({ id: 'new-cost-centre-id' });
const mockGetDocs = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, collectionName) => ({ path: collectionName })),
  query: jest.fn((...args) => args),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  serverTimestamp: jest.fn(() => ({ _serverTimestamp: true })),
}));

// Mock logger
jest.mock('@vapour/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock type helpers
jest.mock('@/lib/firebase/typeHelpers', () => ({
  docToTyped: <T>(id: string, data: Record<string, unknown>): T => {
    const result: T = { id, ...data } as unknown as T;
    return result;
  },
}));

import { createProjectCostCentre, getProjectCostCentre } from './costCentreService';
import type { Firestore } from 'firebase/firestore';

describe('costCentreService', () => {
  const mockDb = {} as unknown as Firestore;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createProjectCostCentre', () => {
    it('creates a new cost centre when none exists', async () => {
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      });

      const result = await createProjectCostCentre(
        mockDb,
        'project-123',
        'PRJ-001',
        'Test Project',
        100000,
        'user-123',
        'Test User'
      );

      expect(result).toBe('new-cost-centre-id');
      expect(mockAddDoc).toHaveBeenCalledTimes(1);

      // Verify the created cost centre data
      const addDocCall = mockAddDoc.mock.calls[0][1];
      expect(addDocCall.code).toBe('CC-PRJ-001');
      expect(addDocCall.name).toBe('Test Project - Cost Centre');
      expect(addDocCall.projectId).toBe('project-123');
      expect(addDocCall.budgetAmount).toBe(100000);
      expect(addDocCall.budgetCurrency).toBe('INR');
      expect(addDocCall.actualSpent).toBe(0);
      expect(addDocCall.variance).toBe(100000);
      expect(addDocCall.isActive).toBe(true);
      expect(addDocCall.autoCreated).toBe(true);
      expect(addDocCall.createdBy).toBe('user-123');
    });

    it('returns existing cost centre ID if one already exists', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{ id: 'existing-cost-centre-id', data: () => ({}) }],
      });

      const result = await createProjectCostCentre(
        mockDb,
        'project-123',
        'PRJ-001',
        'Test Project',
        100000,
        'user-123',
        'Test User'
      );

      expect(result).toBe('existing-cost-centre-id');
      expect(mockAddDoc).not.toHaveBeenCalled();
    });

    it('handles null budget amount', async () => {
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      });

      await createProjectCostCentre(
        mockDb,
        'project-123',
        'PRJ-001',
        'Test Project',
        null,
        'user-123',
        'Test User'
      );

      const addDocCall = mockAddDoc.mock.calls[0][1];
      expect(addDocCall.budgetAmount).toBeNull();
      expect(addDocCall.variance).toBeNull();
    });

    it('generates correct cost centre code from project code', async () => {
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      });

      await createProjectCostCentre(
        mockDb,
        'project-456',
        'DESOLENATOR-2026',
        'Desolenator Project',
        500000,
        'user-123',
        'Test User'
      );

      const addDocCall = mockAddDoc.mock.calls[0][1];
      expect(addDocCall.code).toBe('CC-DESOLENATOR-2026');
      expect(addDocCall.description).toBe('Auto-created cost centre for project DESOLENATOR-2026');
    });

    it('throws error when Firestore operation fails', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firestore error'));

      await expect(
        createProjectCostCentre(
          mockDb,
          'project-123',
          'PRJ-001',
          'Test Project',
          100000,
          'user-123',
          'Test User'
        )
      ).rejects.toThrow('Firestore error');
    });
  });

  describe('getProjectCostCentre', () => {
    it('returns cost centre when found', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'cost-centre-123',
            data: () => ({
              code: 'CC-PRJ-001',
              name: 'Test Project - Cost Centre',
              projectId: 'project-123',
              budgetAmount: 100000,
            }),
          },
        ],
      });

      const result = await getProjectCostCentre(mockDb, 'project-123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('cost-centre-123');
      expect(result?.code).toBe('CC-PRJ-001');
      expect(result?.projectId).toBe('project-123');
    });

    it('returns null when no cost centre exists for project', async () => {
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      });

      const result = await getProjectCostCentre(mockDb, 'project-456');

      expect(result).toBeNull();
    });

    it('returns null when docs array is empty but not marked empty', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [undefined], // Edge case where doc might be undefined
      });

      const result = await getProjectCostCentre(mockDb, 'project-789');

      expect(result).toBeNull();
    });

    it('throws error when Firestore operation fails', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firestore error'));

      await expect(getProjectCostCentre(mockDb, 'project-123')).rejects.toThrow('Firestore error');
    });
  });
});
