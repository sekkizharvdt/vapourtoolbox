import { getProjects, getProjectsByStatus, getActiveProjects } from './projectService';
import { getDocs, where, orderBy } from 'firebase/firestore';
import type { Project } from '@vapour/types';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn((...args) => args),
  where: jest.fn((field, op, value) => ({ field, op, value })),
  orderBy: jest.fn((field, dir) => ({ field, dir })),
  getDocs: jest.fn(),
}));

jest.mock('@/lib/firebase', () => ({
  getFirebase: jest.fn(() => ({ db: {} })),
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    PROJECTS: 'projects',
  },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
  }),
}));

const mockProject = {
  id: 'proj-1',
  name: 'Project A',
  status: 'IN_PROGRESS',
  createdAt: { toDate: () => new Date() },
} as unknown as Project;

describe('projectService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProjects', () => {
    it('should return all projects ordered by createdAt desc', async () => {
      (getDocs as jest.Mock).mockResolvedValue({
        docs: [{ id: 'proj-1', data: () => mockProject }],
        forEach: (cb: (doc: { id: string; data: () => Project }) => void) =>
          [{ id: 'proj-1', data: () => mockProject }].forEach(cb),
      });
      (getDocs as jest.Mock).mockClear(); // Clear previous calls if any regarding mock implementation details

      const result = await getProjects();

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('proj-1');

      // Check query construction
      expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    });

    it('should return empty array on error', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('Firestore error'));
      const result = await getProjects();
      expect(result).toEqual([]);
    });
  });

  describe('getProjectsByStatus', () => {
    it('should filter by status', async () => {
      (getDocs as jest.Mock).mockResolvedValue({
        docs: [{ id: 'proj-1', data: () => mockProject }],
        forEach: (cb: (doc: { id: string; data: () => Project }) => void) =>
          [{ id: 'proj-1', data: () => mockProject }].forEach(cb),
      });

      await getProjectsByStatus('IN_PROGRESS');

      expect(where).toHaveBeenCalledWith('status', '==', 'IN_PROGRESS');
    });

    it('should return empty array on error', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('Firestore error'));
      const result = await getProjectsByStatus('IN_PROGRESS');
      expect(result).toEqual([]);
    });
  });

  describe('getActiveProjects', () => {
    it('should filter by active statuses', async () => {
      (getDocs as jest.Mock).mockResolvedValue({
        docs: [{ id: 'proj-1', data: () => mockProject }],
        forEach: (cb: (doc: { id: string; data: () => Project }) => void) =>
          [{ id: 'proj-1', data: () => mockProject }].forEach(cb),
      });

      await getActiveProjects();

      expect(where).toHaveBeenCalledWith('status', 'in', ['PLANNING', 'IN_PROGRESS', 'ON_HOLD']);
    });

    it('should return empty array on error', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('Firestore error'));
      const result = await getActiveProjects();
      expect(result).toEqual([]);
    });
  });
});
