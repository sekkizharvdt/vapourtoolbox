/**
 * Three-Way Match Helpers Tests
 */

jest.mock('@/lib/utils/formatters', () => ({
  formatCurrency: jest.fn((value: number) => `₹${value.toFixed(2)}`),
}));

import {
  getMatchStatusText,
  getMatchStatusColor,
  filterMatches,
  filterMatchesByStatus,
  calculateMatchStats,
  formatPercentage,
  getVarianceColor,
  getMatchPercentageColor,
} from './threeWayMatchHelpers';
import type { ThreeWayMatch, ThreeWayMatchStatus } from '@vapour/types';

function createMatch(overrides: Partial<ThreeWayMatch> = {}): ThreeWayMatch {
  return {
    id: 'match-1',
    matchNumber: 'TWM-001',
    poId: 'po-1',
    poNumber: 'PO-001',
    grId: 'gr-1',
    grNumber: 'GR-001',
    vendorBillId: 'bill-1',
    vendorBillNumber: 'BILL-001',
    vendorId: 'vendor-1',
    vendorName: 'Vendor ABC',
    projectId: 'proj-1',
    projectName: 'Project Alpha',
    status: 'MATCHED' as ThreeWayMatchStatus,
    approvalStatus: 'PENDING' as never,
    poAmount: 100000,
    grAmount: 100000,
    billAmount: 100000,
    variance: 0,
    matchPercentage: 100,
    items: [],
    discrepancies: [],
    createdAt: {} as never,
    createdBy: 'user-1',
    ...overrides,
  } as ThreeWayMatch;
}

describe('Three-Way Match Helpers', () => {
  describe('getMatchStatusText', () => {
    it('should return correct text for MATCHED', () => {
      expect(getMatchStatusText('MATCHED')).toBe('Matched');
    });

    it('should return correct text for PARTIALLY_MATCHED', () => {
      expect(getMatchStatusText('PARTIALLY_MATCHED')).toBe('Partially Matched');
    });

    it('should return correct text for NOT_MATCHED', () => {
      expect(getMatchStatusText('NOT_MATCHED')).toBe('Not Matched');
    });

    it('should return correct text for PENDING_REVIEW', () => {
      expect(getMatchStatusText('PENDING_REVIEW')).toBe('Pending Review');
    });
  });

  describe('getMatchStatusColor', () => {
    it('should return success for MATCHED', () => {
      expect(getMatchStatusColor('MATCHED')).toBe('success');
    });

    it('should return warning for PARTIALLY_MATCHED', () => {
      expect(getMatchStatusColor('PARTIALLY_MATCHED')).toBe('warning');
    });

    it('should return error for NOT_MATCHED', () => {
      expect(getMatchStatusColor('NOT_MATCHED')).toBe('error');
    });

    it('should return info for PENDING_REVIEW', () => {
      expect(getMatchStatusColor('PENDING_REVIEW')).toBe('info');
    });
  });

  describe('filterMatches', () => {
    const matches = [
      createMatch({
        matchNumber: 'TWM-001',
        poNumber: 'PO-100',
        vendorName: 'Vendor Alpha',
        projectName: 'Highway Project',
      }),
      createMatch({
        matchNumber: 'TWM-002',
        poNumber: 'PO-200',
        vendorName: 'Vendor Beta',
        projectName: 'Dam Project',
      }),
      createMatch({ matchNumber: 'TWM-003', grNumber: 'GR-300', projectName: 'Bridge Project' }),
    ];

    it('should return all matches for empty search term', () => {
      expect(filterMatches(matches, '')).toHaveLength(3);
      expect(filterMatches(matches, '   ')).toHaveLength(3);
    });

    it('should filter by match number', () => {
      expect(filterMatches(matches, 'TWM-001')).toHaveLength(1);
    });

    it('should filter by PO number', () => {
      expect(filterMatches(matches, 'PO-200')).toHaveLength(1);
    });

    it('should filter by vendor name', () => {
      expect(filterMatches(matches, 'Alpha')).toHaveLength(1);
    });

    it('should filter by GR number', () => {
      expect(filterMatches(matches, 'GR-300')).toHaveLength(1);
    });

    it('should filter by project name', () => {
      expect(filterMatches(matches, 'Bridge')).toHaveLength(1);
    });

    it('should be case insensitive', () => {
      expect(filterMatches(matches, 'vendor beta')).toHaveLength(1);
    });
  });

  describe('filterMatchesByStatus', () => {
    const matches = [
      createMatch({ status: 'MATCHED' as ThreeWayMatchStatus }),
      createMatch({ status: 'PARTIALLY_MATCHED' as ThreeWayMatchStatus }),
      createMatch({ status: 'NOT_MATCHED' as ThreeWayMatchStatus }),
    ];

    it('should return all matches for ALL status', () => {
      expect(filterMatchesByStatus(matches, 'ALL')).toHaveLength(3);
    });

    it('should filter by specific status', () => {
      expect(filterMatchesByStatus(matches, 'MATCHED')).toHaveLength(1);
      expect(filterMatchesByStatus(matches, 'NOT_MATCHED')).toHaveLength(1);
    });
  });

  describe('calculateMatchStats', () => {
    it('should calculate stats correctly', () => {
      const matches = [
        createMatch({
          status: 'MATCHED' as ThreeWayMatchStatus,
          variance: 0,
          approvalStatus: 'APPROVED' as never,
        }),
        createMatch({
          status: 'MATCHED' as ThreeWayMatchStatus,
          variance: 50,
          approvalStatus: 'APPROVED' as never,
        }),
        createMatch({
          status: 'PARTIALLY_MATCHED' as ThreeWayMatchStatus,
          variance: 200,
          approvalStatus: 'PENDING' as never,
        }),
        createMatch({
          status: 'NOT_MATCHED' as ThreeWayMatchStatus,
          variance: 1000,
          approvalStatus: 'PENDING' as never,
        }),
        createMatch({
          status: 'PENDING_REVIEW' as ThreeWayMatchStatus,
          variance: 100,
          approvalStatus: 'PENDING' as never,
        }),
      ];

      const stats = calculateMatchStats(matches);

      expect(stats.total).toBe(5);
      expect(stats.matched).toBe(2);
      expect(stats.partiallyMatched).toBe(1);
      expect(stats.notMatched).toBe(1);
      expect(stats.pendingReview).toBe(1);
      expect(stats.approved).toBe(2);
      expect(stats.totalVariance).toBe(1350);
    });

    it('should handle empty matches', () => {
      const stats = calculateMatchStats([]);
      expect(stats.total).toBe(0);
      expect(stats.matched).toBe(0);
      expect(stats.totalVariance).toBe(0);
    });
  });

  describe('formatPercentage', () => {
    it('should format percentage with 2 decimal places', () => {
      expect(formatPercentage(95.123)).toBe('95.12%');
      expect(formatPercentage(100)).toBe('100.00%');
      expect(formatPercentage(0)).toBe('0.00%');
    });
  });

  describe('getVarianceColor', () => {
    it('should return success for near-zero variance', () => {
      expect(getVarianceColor(0)).toBe('success');
      expect(getVarianceColor(0.005)).toBe('success');
    });

    it('should return warning for small variance', () => {
      expect(getVarianceColor(50)).toBe('warning');
      expect(getVarianceColor(-50)).toBe('warning');
    });

    it('should return error for large variance', () => {
      expect(getVarianceColor(500)).toBe('error');
      expect(getVarianceColor(-500)).toBe('error');
    });
  });

  describe('getMatchPercentageColor', () => {
    it('should return success for >= 95%', () => {
      expect(getMatchPercentageColor(100)).toBe('success');
      expect(getMatchPercentageColor(95)).toBe('success');
    });

    it('should return warning for >= 80% and < 95%', () => {
      expect(getMatchPercentageColor(80)).toBe('warning');
      expect(getMatchPercentageColor(90)).toBe('warning');
    });

    it('should return error for < 80%', () => {
      expect(getMatchPercentageColor(79)).toBe('error');
      expect(getMatchPercentageColor(50)).toBe('error');
    });
  });
});
