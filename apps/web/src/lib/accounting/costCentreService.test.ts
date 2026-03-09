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
const mockGetDoc = jest.fn();
const mockSetDoc = jest.fn().mockResolvedValue(undefined);
const mockGetDocs = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, collectionName) => ({ path: collectionName })),
  doc: jest.fn((_db, collectionName, docId) => ({
    path: `${collectionName}/${docId}`,
    id: docId,
  })),
  query: jest.fn((...args) => args),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
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
      // AC-14: getDoc returns not-exists for deterministic ID
      mockGetDoc.mockResolvedValue({
        exists: () => false,
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

      // AC-14: Deterministic ID based on projectId
      expect(result).toBe('CC-project-123');
      expect(mockSetDoc).toHaveBeenCalledTimes(1);

      // Verify the created cost centre data
      const setDocCall = mockSetDoc.mock.calls[0][1];
      expect(setDocCall.code).toBe('CC-PRJ-001');
      expect(setDocCall.name).toBe('Test Project - Cost Centre');
      expect(setDocCall.projectId).toBe('project-123');
      expect(setDocCall.budgetAmount).toBe(100000);
      expect(setDocCall.budgetCurrency).toBe('INR');
      expect(setDocCall.actualSpent).toBe(0);
      expect(setDocCall.variance).toBe(100000);
      expect(setDocCall.isActive).toBe(true);
      expect(setDocCall.autoCreated).toBe(true);
      expect(setDocCall.createdBy).toBe('user-123');
    });

    it('returns existing cost centre ID if one already exists', async () => {
      // AC-14: getDoc returns exists for deterministic ID
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'CC-project-123',
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

      expect(result).toBe('CC-project-123');
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('handles null budget amount', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
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

      const setDocCall = mockSetDoc.mock.calls[0][1];
      expect(setDocCall.budgetAmount).toBeNull();
      expect(setDocCall.variance).toBeNull();
    });

    it('generates correct cost centre code from project code', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
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

      const setDocCall = mockSetDoc.mock.calls[0][1];
      expect(setDocCall.code).toBe('CC-DESOLENATOR-2026');
      expect(setDocCall.description).toBe('Auto-created cost centre for project DESOLENATOR-2026');
    });

    it('throws error when Firestore operation fails', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

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
