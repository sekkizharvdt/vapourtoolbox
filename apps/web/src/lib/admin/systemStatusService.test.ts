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
      lastUpdated: {
        seconds: 1703318400,
        nanoseconds: 0,
      } as unknown as SystemStatusResponse['lastUpdated'],
      audit: {
        summary: {
          total: 10,
          high: 0,
          moderate: 3,
          low: 7,
        },
        vulnerabilities: [],
      },
      outdated: {
        summary: {
          total: 5,
          major: 1,
          minor: 2,
          patch: 2,
        },
        packages: [],
      },
      build: {
        status: 'success',
        lastBuildTime: {
          seconds: 1703318400,
          nanoseconds: 0,
        } as unknown as SystemStatusResponse['build']['lastBuildTime'],
      },
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

    it('should return full audit information', async () => {
      const statusWithVulnerabilities: SystemStatusResponse = {
        ...mockSystemStatus,
        audit: {
          summary: {
            total: 2,
            high: 1,
            moderate: 1,
            low: 0,
          },
          vulnerabilities: [
            {
              name: 'lodash',
              severity: 'high',
              title: 'Prototype Pollution',
              path: 'lodash',
              fixAvailable: true,
            },
          ],
        },
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => statusWithVulnerabilities,
      });

      const result = await getSystemStatus();

      expect(result?.audit.vulnerabilities).toHaveLength(1);
      expect(result?.audit.vulnerabilities[0].name).toBe('lodash');
      expect(result?.audit.vulnerabilities[0].severity).toBe('high');
    });

    it('should return full outdated packages information', async () => {
      const statusWithOutdated: SystemStatusResponse = {
        ...mockSystemStatus,
        outdated: {
          summary: {
            total: 2,
            major: 1,
            minor: 1,
            patch: 0,
          },
          packages: [
            {
              name: 'react',
              current: '17.0.2',
              wanted: '17.0.2',
              latest: '18.2.0',
              type: 'major',
            },
          ],
        },
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => statusWithOutdated,
      });

      const result = await getSystemStatus();

      expect(result?.outdated.packages).toHaveLength(1);
      expect(result?.outdated.packages[0].name).toBe('react');
      expect(result?.outdated.packages[0].type).toBe('major');
    });

    it('should return build status information', async () => {
      const statusWithBuild: SystemStatusResponse = {
        ...mockSystemStatus,
        build: {
          status: 'failed',
          lastBuildTime: {
            seconds: 1703318400,
            nanoseconds: 0,
          } as unknown as SystemStatusResponse['build']['lastBuildTime'],
          error: 'TypeScript compilation failed',
        },
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => statusWithBuild,
      });

      const result = await getSystemStatus();

      expect(result?.build.status).toBe('failed');
      expect(result?.build.error).toBe('TypeScript compilation failed');
    });
  });
});
