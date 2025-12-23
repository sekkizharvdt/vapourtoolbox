/**
 * Tests for feedbackStatsService
 *
 * Tests feedback statistics calculation and filtering functions.
 */

import {
  getFeedbackStats,
  getFeedbackCountByStatus,
  getFeedbackByModule,
  getFeedbackByType,
  getOpenFeedbackCount,
  getHighPriorityBugCount,
} from './feedbackStatsService';

// Mock firebase/firestore
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  getCountFromServer: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date() })),
  },
}));

// Mock logger
jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

import {
  collection,
  query,
  where,
  getDocs,
  getCountFromServer,
  orderBy,
  limit,
  type Firestore,
} from 'firebase/firestore';

const mockCollection = collection as jest.Mock;
const mockQuery = query as jest.Mock;
const mockWhere = where as jest.Mock;
const mockGetDocs = getDocs as jest.Mock;
const mockGetCountFromServer = getCountFromServer as jest.Mock;
const mockOrderBy = orderBy as jest.Mock;
const mockLimit = limit as jest.Mock;

describe('feedbackStatsService', () => {
  const mockDb = {} as unknown as Firestore;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCollection.mockReturnValue('feedbackCollection');
    mockQuery.mockReturnValue('queryRef');
    mockWhere.mockReturnValue('whereClause');
    mockOrderBy.mockReturnValue('orderByClause');
    mockLimit.mockReturnValue('limitClause');
  });

  /**
   * Helper to setup mocks for getFeedbackStats
   * The function uses getCountFromServer for most counts, plus getDocs for module breakdown
   */
  function setupGetFeedbackStatsMocks(options: {
    total?: number;
    bug?: number;
    feature?: number;
    general?: number;
    new?: number;
    in_progress?: number;
    resolved?: number;
    closed?: number;
    wont_fix?: number;
    critical?: number;
    major?: number;
    minor?: number;
    cosmetic?: number;
    moduleBreakdownItems?: Array<{ module?: string }>;
  }) {
    const {
      total = 0,
      bug = 0,
      feature = 0,
      general = 0,
      new: newCount = 0,
      in_progress = 0,
      resolved = 0,
      closed = 0,
      wont_fix = 0,
      critical = 0,
      major = 0,
      minor = 0,
      cosmetic = 0,
      moduleBreakdownItems = [],
    } = options;

    // Mock getCountFromServer for all count queries (13 calls in the Promise.all)
    mockGetCountFromServer
      .mockResolvedValueOnce({ data: () => ({ count: total }) })
      .mockResolvedValueOnce({ data: () => ({ count: bug }) })
      .mockResolvedValueOnce({ data: () => ({ count: feature }) })
      .mockResolvedValueOnce({ data: () => ({ count: general }) })
      .mockResolvedValueOnce({ data: () => ({ count: newCount }) })
      .mockResolvedValueOnce({ data: () => ({ count: in_progress }) })
      .mockResolvedValueOnce({ data: () => ({ count: resolved }) })
      .mockResolvedValueOnce({ data: () => ({ count: closed }) })
      .mockResolvedValueOnce({ data: () => ({ count: wont_fix }) })
      .mockResolvedValueOnce({ data: () => ({ count: critical }) })
      .mockResolvedValueOnce({ data: () => ({ count: major }) })
      .mockResolvedValueOnce({ data: () => ({ count: minor }) })
      .mockResolvedValueOnce({ data: () => ({ count: cosmetic }) });

    // Mock getDocs for module breakdown
    mockGetDocs.mockResolvedValue({
      forEach: (callback: (doc: { id: string; data: () => unknown }) => void) => {
        moduleBreakdownItems.forEach((item, index) =>
          callback({
            id: `id-${index}`,
            data: () => item,
          })
        );
      },
    });
  }

  describe('getFeedbackStats', () => {
    it('should calculate correct statistics from feedback items', async () => {
      setupGetFeedbackStatsMocks({
        total: 5,
        bug: 3,
        feature: 1,
        general: 1,
        new: 2,
        in_progress: 1,
        resolved: 1,
        closed: 1,
        wont_fix: 0,
        critical: 1,
        major: 1,
        minor: 1,
        cosmetic: 0,
        moduleBreakdownItems: [
          { module: 'procurement' },
          { module: 'procurement' },
          { module: 'accounting' },
          { module: 'projects' },
          { module: undefined }, // defaults to 'other'
        ],
      });

      const stats = await getFeedbackStats(mockDb);

      expect(stats.total).toBe(5);
      expect(stats.byType).toEqual({ bug: 3, feature: 1, general: 1 });
      expect(stats.byStatus).toEqual({
        new: 2,
        in_progress: 1,
        resolved: 1,
        closed: 1,
        wont_fix: 0,
      });
      expect(stats.byModule).toEqual({
        procurement: 2,
        accounting: 1,
        projects: 1,
        other: 1,
      });
      expect(stats.bySeverity).toEqual({
        critical: 1,
        major: 1,
        minor: 1,
        cosmetic: 0,
      });
    });

    it('should return empty stats when no feedback exists', async () => {
      setupGetFeedbackStatsMocks({});

      const stats = await getFeedbackStats(mockDb);

      expect(stats.total).toBe(0);
      expect(stats.byType).toEqual({ bug: 0, feature: 0, general: 0 });
      expect(stats.byStatus).toEqual({
        new: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0,
        wont_fix: 0,
      });
      expect(stats.byModule).toEqual({});
      expect(stats.bySeverity).toEqual({
        critical: 0,
        major: 0,
        minor: 0,
        cosmetic: 0,
      });
    });

    it('should use count queries for type stats instead of iterating all docs', async () => {
      setupGetFeedbackStatsMocks({
        total: 2,
        bug: 1,
        moduleBreakdownItems: [{ module: 'accounting' }, { module: 'accounting' }],
      });

      await getFeedbackStats(mockDb);

      // Verify getCountFromServer was called (13 times for all counts)
      expect(mockGetCountFromServer).toHaveBeenCalledTimes(13);
    });

    it('should throw error when Firestore query fails', async () => {
      const error = new Error('Firestore error');
      mockGetCountFromServer.mockRejectedValue(error);

      await expect(getFeedbackStats(mockDb)).rejects.toThrow('Firestore error');
    });
  });

  describe('getFeedbackCountByStatus', () => {
    it('should return count for specific status', async () => {
      mockGetCountFromServer.mockResolvedValue({
        data: () => ({ count: 5 }),
      });

      const count = await getFeedbackCountByStatus(mockDb, 'new');

      expect(count).toBe(5);
      expect(mockWhere).toHaveBeenCalledWith('status', '==', 'new');
    });

    it('should return 0 when no items match status', async () => {
      mockGetCountFromServer.mockResolvedValue({
        data: () => ({ count: 0 }),
      });

      const count = await getFeedbackCountByStatus(mockDb, 'wont_fix');

      expect(count).toBe(0);
    });

    it('should throw error when query fails', async () => {
      const error = new Error('Query failed');
      mockGetCountFromServer.mockRejectedValue(error);

      await expect(getFeedbackCountByStatus(mockDb, 'new')).rejects.toThrow('Query failed');
    });
  });

  describe('getFeedbackByModule', () => {
    it('should return feedback items for specific module', async () => {
      const mockItems = [
        { type: 'bug', module: 'procurement', title: 'Bug 1' },
        { type: 'feature', module: 'procurement', title: 'Feature 1' },
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (callback: (doc: { id: string; data: () => unknown }) => void) => {
          mockItems.forEach((item, index) =>
            callback({
              id: `id-${index}`,
              data: () => item,
            })
          );
        },
      });

      const items = await getFeedbackByModule(mockDb, 'procurement');

      expect(items).toHaveLength(2);
      expect(items[0]).toMatchObject({ id: 'id-0', title: 'Bug 1' });
      expect(items[1]).toMatchObject({ id: 'id-1', title: 'Feature 1' });
      expect(mockWhere).toHaveBeenCalledWith('module', '==', 'procurement');
    });

    it('should return empty array when no items match module', async () => {
      mockGetDocs.mockResolvedValue({
        forEach: () => {},
      });

      const items = await getFeedbackByModule(mockDb, 'thermal');

      expect(items).toHaveLength(0);
    });

    it('should throw error when query fails', async () => {
      const error = new Error('Query failed');
      mockGetDocs.mockRejectedValue(error);

      await expect(getFeedbackByModule(mockDb, 'procurement')).rejects.toThrow('Query failed');
    });
  });

  describe('getFeedbackByType', () => {
    it('should return feedback items for specific type', async () => {
      const mockItems = [
        { type: 'bug', title: 'Bug 1', severity: 'critical' },
        { type: 'bug', title: 'Bug 2', severity: 'minor' },
      ];

      mockGetDocs.mockResolvedValue({
        forEach: (callback: (doc: { id: string; data: () => unknown }) => void) => {
          mockItems.forEach((item, index) =>
            callback({
              id: `id-${index}`,
              data: () => item,
            })
          );
        },
      });

      const items = await getFeedbackByType(mockDb, 'bug');

      expect(items).toHaveLength(2);
      expect(mockWhere).toHaveBeenCalledWith('type', '==', 'bug');
    });

    it('should return empty array when no items match type', async () => {
      mockGetDocs.mockResolvedValue({
        forEach: () => {},
      });

      const items = await getFeedbackByType(mockDb, 'general');

      expect(items).toHaveLength(0);
    });

    it('should throw error when query fails', async () => {
      const error = new Error('Query failed');
      mockGetDocs.mockRejectedValue(error);

      await expect(getFeedbackByType(mockDb, 'bug')).rejects.toThrow('Query failed');
    });
  });

  describe('getOpenFeedbackCount', () => {
    it('should return sum of new and in_progress counts', async () => {
      mockGetCountFromServer
        .mockResolvedValueOnce({ data: () => ({ count: 3 }) }) // new
        .mockResolvedValueOnce({ data: () => ({ count: 2 }) }); // in_progress

      const count = await getOpenFeedbackCount(mockDb);

      expect(count).toBe(5);
    });

    it('should return 0 when no open feedback exists', async () => {
      mockGetCountFromServer
        .mockResolvedValueOnce({ data: () => ({ count: 0 }) })
        .mockResolvedValueOnce({ data: () => ({ count: 0 }) });

      const count = await getOpenFeedbackCount(mockDb);

      expect(count).toBe(0);
    });

    it('should run queries in parallel', async () => {
      mockGetCountFromServer
        .mockResolvedValueOnce({ data: () => ({ count: 1 }) })
        .mockResolvedValueOnce({ data: () => ({ count: 1 }) });

      await getOpenFeedbackCount(mockDb);

      // Both queries should be initiated
      expect(mockGetCountFromServer).toHaveBeenCalledTimes(2);
    });

    it('should throw error when query fails', async () => {
      const error = new Error('Query failed');
      mockGetCountFromServer.mockRejectedValue(error);

      await expect(getOpenFeedbackCount(mockDb)).rejects.toThrow('Query failed');
    });
  });

  describe('getHighPriorityBugCount', () => {
    it('should return sum of critical and major bug counts', async () => {
      mockGetCountFromServer
        .mockResolvedValueOnce({ data: () => ({ count: 2 }) }) // critical
        .mockResolvedValueOnce({ data: () => ({ count: 3 }) }); // major

      const count = await getHighPriorityBugCount(mockDb);

      expect(count).toBe(5);
    });

    it('should return 0 when no high priority bugs exist', async () => {
      mockGetCountFromServer
        .mockResolvedValueOnce({ data: () => ({ count: 0 }) })
        .mockResolvedValueOnce({ data: () => ({ count: 0 }) });

      const count = await getHighPriorityBugCount(mockDb);

      expect(count).toBe(0);
    });

    it('should query with correct type and severity filters', async () => {
      mockGetCountFromServer
        .mockResolvedValueOnce({ data: () => ({ count: 0 }) })
        .mockResolvedValueOnce({ data: () => ({ count: 0 }) });

      await getHighPriorityBugCount(mockDb);

      // Should query for bug type with critical and major severities
      expect(mockWhere).toHaveBeenCalledWith('type', '==', 'bug');
      expect(mockWhere).toHaveBeenCalledWith('severity', '==', 'critical');
      expect(mockWhere).toHaveBeenCalledWith('severity', '==', 'major');
    });

    it('should throw error when query fails', async () => {
      const error = new Error('Query failed');
      mockGetCountFromServer.mockRejectedValue(error);

      await expect(getHighPriorityBugCount(mockDb)).rejects.toThrow('Query failed');
    });
  });
});
