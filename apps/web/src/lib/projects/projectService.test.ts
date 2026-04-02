import {
  getProjects,
  getProjectsByStatus,
  getActiveProjects,
  getProjectsForUser,
} from './projectService';
import { getDocs, getDoc, where, orderBy, documentId } from 'firebase/firestore';
import type { Project } from '@vapour/types';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  query: jest.fn((...args) => args),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  orderBy: jest.fn((field, dir) => ({ field, dir })),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  documentId: jest.fn(() => '__name__'),
}));

jest.mock('@/lib/firebase', () => ({
  getFirebase: jest.fn(() => ({ db: {} })),
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    PROJECTS: 'projects',
    USERS: 'users',
  },
}));

jest.mock('@vapour/constants', () => ({
  canManageProjects: jest.fn((permissions: number) => (permissions & 0x100) !== 0),
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

const mockProject = {
  id: 'proj-1',
  name: 'Project A',
  status: 'IN_PROGRESS',
  createdAt: { seconds: 1000, toDate: () => new Date() },
} as unknown as Project;

/** Helper to build a mock Firestore snapshot */
function mockSnapshot(docs: Array<{ id: string; data: () => unknown }>) {
  return {
    docs,
    forEach: (cb: (doc: { id: string; data: () => unknown }) => void) => docs.forEach(cb),
    size: docs.length,
  };
}

describe('projectService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProjects', () => {
    it('should return all projects ordered by createdAt desc', async () => {
      (getDocs as jest.Mock).mockResolvedValue(
        mockSnapshot([{ id: 'proj-1', data: () => mockProject }])
      );

      const result = await getProjects('entity-1');

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('proj-1');

      // Check query construction
      expect(where).toHaveBeenCalledWith('tenantId', '==', 'entity-1');
      expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    });

    it('should return empty array on error', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('Firestore error'));
      const result = await getProjects('entity-1');
      expect(result).toEqual([]);
    });
  });

  describe('getProjectsByStatus', () => {
    it('should filter by status', async () => {
      (getDocs as jest.Mock).mockResolvedValue(
        mockSnapshot([{ id: 'proj-1', data: () => mockProject }])
      );

      await getProjectsByStatus('entity-1', 'IN_PROGRESS');

      expect(where).toHaveBeenCalledWith('tenantId', '==', 'entity-1');
      expect(where).toHaveBeenCalledWith('status', '==', 'IN_PROGRESS');
    });

    it('should return empty array on error', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('Firestore error'));
      const result = await getProjectsByStatus('entity-1', 'IN_PROGRESS');
      expect(result).toEqual([]);
    });
  });

  describe('getActiveProjects', () => {
    it('should filter by active statuses', async () => {
      (getDocs as jest.Mock).mockResolvedValue(
        mockSnapshot([{ id: 'proj-1', data: () => mockProject }])
      );

      await getActiveProjects('entity-1');

      expect(where).toHaveBeenCalledWith('tenantId', '==', 'entity-1');
      expect(where).toHaveBeenCalledWith('status', 'in', ['PLANNING', 'IN_PROGRESS', 'ON_HOLD']);
    });

    it('should return empty array on error', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('Firestore error'));
      const result = await getActiveProjects('entity-1');
      expect(result).toEqual([]);
    });
  });

  describe('getProjectsForUser', () => {
    const MANAGE_PROJECTS_FLAG = 0x100;

    it('should delegate to getProjects when user has MANAGE_PROJECTS permission', async () => {
      (getDocs as jest.Mock).mockResolvedValue(
        mockSnapshot([
          { id: 'proj-1', data: () => ({ name: 'Project 1', createdAt: { seconds: 1000 } }) },
          { id: 'proj-2', data: () => ({ name: 'Project 2', createdAt: { seconds: 2000 } }) },
        ])
      );

      const result = await getProjectsForUser('entity-1', 'user-1', MANAGE_PROJECTS_FLAG);

      expect(result).toHaveLength(2);
      // Should NOT read user doc — it goes through the getProjects path
      expect(getDoc).not.toHaveBeenCalled();
    });

    it('should return empty array when user doc does not exist', async () => {
      (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

      const result = await getProjectsForUser('entity-1', 'user-1', 0);

      expect(result).toEqual([]);
    });

    it('should return empty array when user has no assigned projects', async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ assignedProjects: [] }),
      });

      const result = await getProjectsForUser('entity-1', 'user-1', 0);

      expect(result).toEqual([]);
      // Should NOT query projects collection
      expect(getDocs).not.toHaveBeenCalled();
    });

    it('should return empty array when assignedProjects field is undefined', async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({}), // No assignedProjects
      });

      const result = await getProjectsForUser('entity-1', 'user-1', 0);

      expect(result).toEqual([]);
    });

    it('should query projects by assigned IDs with documentId in-filter', async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ assignedProjects: ['proj-1', 'proj-2'] }),
      });

      (getDocs as jest.Mock).mockResolvedValue(
        mockSnapshot([
          { id: 'proj-1', data: () => ({ name: 'P1', createdAt: { seconds: 2000 } }) },
          { id: 'proj-2', data: () => ({ name: 'P2', createdAt: { seconds: 1000 } }) },
        ])
      );

      const result = await getProjectsForUser('entity-1', 'user-1', 0);

      expect(result).toHaveLength(2);
      expect(where).toHaveBeenCalledWith('tenantId', '==', 'entity-1');
      expect(documentId).toHaveBeenCalled();
      expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    });

    it('should sort results by createdAt descending', async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ assignedProjects: ['proj-a', 'proj-b', 'proj-c'] }),
      });

      (getDocs as jest.Mock).mockResolvedValue(
        mockSnapshot([
          { id: 'proj-a', data: () => ({ name: 'A', createdAt: { seconds: 100 } }) },
          { id: 'proj-b', data: () => ({ name: 'B', createdAt: { seconds: 300 } }) },
          { id: 'proj-c', data: () => ({ name: 'C', createdAt: { seconds: 200 } }) },
        ])
      );

      const result = await getProjectsForUser('entity-1', 'user-1', 0);

      expect(result[0]!.id).toBe('proj-b');
      expect(result[1]!.id).toBe('proj-c');
      expect(result[2]!.id).toBe('proj-a');
    });

    it('should chunk assigned projects into batches of 30', async () => {
      const assignedIds = Array.from({ length: 35 }, (_, i) => `proj-${i}`);

      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ assignedProjects: assignedIds }),
      });

      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot([]));

      await getProjectsForUser('entity-1', 'user-1', 0);

      // 35 IDs → 2 chunks (30 + 5)
      expect(getDocs).toHaveBeenCalledTimes(2);
    });

    it('should handle projects with undefined createdAt in sorting', async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ assignedProjects: ['proj-1', 'proj-2'] }),
      });

      (getDocs as jest.Mock).mockResolvedValue(
        mockSnapshot([
          { id: 'proj-1', data: () => ({ name: 'P1' }) }, // No createdAt
          { id: 'proj-2', data: () => ({ name: 'P2', createdAt: { seconds: 1000 } }) },
        ])
      );

      const result = await getProjectsForUser('entity-1', 'user-1', 0);

      expect(result).toHaveLength(2);
      // proj-2 (seconds=1000) first, proj-1 (fallback 0) second
      expect(result[0]!.id).toBe('proj-2');
      expect(result[1]!.id).toBe('proj-1');
    });

    it('should return empty array on Firestore error', async () => {
      (getDoc as jest.Mock).mockRejectedValue(new Error('Firestore error'));

      const result = await getProjectsForUser('entity-1', 'user-1', 0);

      expect(result).toEqual([]);
    });
  });
});
