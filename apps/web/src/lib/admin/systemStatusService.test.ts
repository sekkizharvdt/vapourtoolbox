/**
 * System Status Service Tests
 *
 * Tests for the system status retrieval service.
 */

import type { SystemStatusResponse } from '@vapour/types';

// Mock firebase/firestore
const mockDoc = jest.fn();
const mockGetDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));

const mockDb = { id: 'mock-db' };
jest.mock('@/lib/firebase', () => ({
  getFirebase: () => ({ db: mockDb }),
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    SYSTEM_STATUS: 'systemStatus',
  },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  }),
}));

// Import after mocks
import { getSystemStatus } from './systemStatusService';

describe('systemStatusService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockReturnValue({ id: 'current' });
  });

  describe('getSystemStatus', () => {
    const mockSystemStatus: SystemStatusResponse = {
      generatedAt: '2024-12-23T10:00:00Z',
      runtime: {
        node: {
          current: '20.10.0',
          recommended: '20.10.0',
        },
        pnpm: {
          current: '8.15.0',
          recommended: '8.15.0',
        },
      },
      workspaces: [
        {
          name: '@vapour/web',
          path: 'apps/web',
          version: '1.0.0',
          dependencyCount: 100,
        },
      ],
      vulnerabilities: {
        critical: 0,
        high: 0,
        moderate: 3,
        low: 7,
        info: 0,
        total: 10,
        details: [],
      },
      outdatedPackages: [],
      totalDependencies: 500,
    };

    it('should return system status when document exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockSystemStatus,
      });

      const result = await getSystemStatus();

      expect(mockDoc).toHaveBeenCalledWith(mockDb, 'systemStatus', 'current');
      expect(result).toEqual(mockSystemStatus);
    });

    it('should return null when document does not exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await getSystemStatus();

      expect(result).toBeNull();
    });

    it('should throw error on Firestore failure', async () => {
      mockGetDoc.mockRejectedValue(new Error('Connection failed'));

      await expect(getSystemStatus()).rejects.toThrow('Failed to get system status');
    });

    it('should use correct document ID', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockSystemStatus,
      });

      await getSystemStatus();

      expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'systemStatus', 'current');
    });

    it('should return full vulnerability information', async () => {
      const statusWithVulnerabilities: SystemStatusResponse = {
        ...mockSystemStatus,
        vulnerabilities: {
          critical: 0,
          high: 1,
          moderate: 1,
          low: 0,
          info: 0,
          total: 2,
          details: [
            {
              id: 'VULN-001',
              package: 'lodash',
              severity: 'high',
              title: 'Prototype Pollution',
              vulnerableVersions: '<4.17.21',
              patchedVersions: '>=4.17.21',
            },
          ],
        },
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => statusWithVulnerabilities,
      });

      const result = await getSystemStatus();

      expect(result?.vulnerabilities.details).toHaveLength(1);
      expect(result?.vulnerabilities.details?.[0]?.package).toBe('lodash');
      expect(result?.vulnerabilities.details?.[0]?.severity).toBe('high');
    });

    it('should return full outdated packages information', async () => {
      const statusWithOutdated: SystemStatusResponse = {
        ...mockSystemStatus,
        outdatedPackages: [
          {
            name: 'react',
            current: '17.0.2',
            wanted: '17.0.2',
            latest: '18.2.0',
            workspace: '@vapour/web',
            updateType: 'major',
            isSecurityUpdate: false,
          },
        ],
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => statusWithOutdated,
      });

      const result = await getSystemStatus();

      expect(result?.outdatedPackages).toHaveLength(1);
      expect(result?.outdatedPackages?.[0]?.name).toBe('react');
      expect(result?.outdatedPackages?.[0]?.updateType).toBe('major');
    });

    it('should return workspace information', async () => {
      const statusWithWorkspaces: SystemStatusResponse = {
        ...mockSystemStatus,
        workspaces: [
          {
            name: '@vapour/web',
            path: 'apps/web',
            version: '1.0.0',
            dependencyCount: 100,
          },
          {
            name: '@vapour/types',
            path: 'packages/types',
            version: '1.0.0',
            dependencyCount: 10,
          },
        ],
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => statusWithWorkspaces,
      });

      const result = await getSystemStatus();

      expect(result?.workspaces).toHaveLength(2);
      expect(result?.workspaces?.[0]?.name).toBe('@vapour/web');
      expect(result?.workspaces?.[1]?.name).toBe('@vapour/types');
    });
  });
});
