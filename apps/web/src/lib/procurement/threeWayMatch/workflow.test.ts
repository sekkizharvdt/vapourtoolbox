/**
 * Three-Way Match Workflow Tests
 *
 * Tests approval and rejection of 3-way matches, including
 * permission checks, vendor bill creation, and audit logging.
 */

// Mock all external dependencies before imports
const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockWriteBatchUpdate = jest.fn().mockReturnThis();
const mockWriteBatchCommit = jest.fn().mockResolvedValue(undefined);

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ...paths: string[]) => paths.join('/')),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  writeBatch: jest.fn(() => ({
    update: mockWriteBatchUpdate,
    commit: mockWriteBatchCommit,
  })),
  serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    THREE_WAY_MATCHES: 'threeWayMatches',
  },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  }),
}));

jest.mock('@vapour/constants', () => ({
  PERMISSION_FLAGS: { MANAGE_PROCUREMENT: 64 },
  hasPermission: jest.fn((perms: number, flag: number) => (perms & flag) !== 0),
}));

jest.mock('@/lib/auth/authorizationService', () => ({
  requirePermission: jest.fn((perms: number, flag: number, _userId: string, _op: string) => {
    if ((perms & flag) === 0) {
      throw new Error('Permission denied');
    }
  }),
}));

jest.mock('@/lib/audit', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
  createAuditContext: jest.fn((userId: string, entityId: string, userName: string) => ({
    userId,
    entityId,
    userName,
  })),
}));

// Mock the dynamic import of vendorBillIntegrationService
jest.mock('@/lib/accounting/vendorBillIntegrationService', () => ({
  createVendorBillFromMatch: jest.fn().mockResolvedValue('vb-001'),
}));

import { approveMatch, rejectMatch } from './workflow';
import { requirePermission } from '@/lib/auth/authorizationService';
import { logAuditEvent } from '@/lib/audit';

const db = {} as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetDoc.mockResolvedValue({
    exists: () => true,
    id: 'match-1',
    data: () => ({
      matchNumber: 'TWM-001',
      poNumber: 'PO-001',
      grNumber: 'GR-001',
      vendorName: 'Acme Corp',
      invoiceAmount: 50000,
      variance: 0,
    }),
  });
  mockUpdateDoc.mockResolvedValue(undefined);
});

describe('approveMatch', () => {
  it('should approve a match and create vendor bill', async () => {
    await approveMatch(db, 'match-1', 'user-1', 'Admin User', 'Looks good');

    // Should update match via batch write
    expect(mockWriteBatchUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        approvalStatus: 'APPROVED',
        approvedBy: 'user-1',
        approvedByName: 'Admin User',
        resolved: true,
      })
    );
    expect(mockWriteBatchCommit).toHaveBeenCalled();

    // Should update match with vendor bill ID
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ vendorBillId: 'vb-001' })
    );

    // Should log audit event
    expect(logAuditEvent).toHaveBeenCalledWith(
      db,
      expect.anything(),
      'MATCH_APPROVED',
      'THREE_WAY_MATCH',
      'match-1',
      expect.stringContaining('TWM-001'),
      expect.anything()
    );
  });

  it('should check permissions when auth context is provided', async () => {
    const auth = { userId: 'user-1', userPermissions: 64 }; // Has MANAGE_PROCUREMENT

    await approveMatch(db, 'match-1', 'user-1', 'Admin', undefined, auth);

    expect(requirePermission).toHaveBeenCalledWith(64, 64, 'user-1', 'approve three-way match');
  });

  it('should throw when user lacks permission', async () => {
    const auth = { userId: 'user-1', userPermissions: 0 }; // No permissions

    await expect(approveMatch(db, 'match-1', 'user-1', 'Admin', undefined, auth)).rejects.toThrow(
      'Permission denied'
    );
  });

  it('should skip permission check when no auth context provided', async () => {
    await approveMatch(db, 'match-1', 'user-1', 'Admin');

    expect(requirePermission).not.toHaveBeenCalled();
  });
});

describe('rejectMatch', () => {
  it('should reject a match with reason', async () => {
    await rejectMatch(db, 'match-1', 'user-1', 'Admin User', 'Price discrepancy');

    expect(mockWriteBatchUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        approvalStatus: 'REJECTED',
        approvedBy: 'user-1',
        approvalComments: 'Price discrepancy',
      })
    );
    expect(mockWriteBatchCommit).toHaveBeenCalled();

    // Should log warning-level audit event
    expect(logAuditEvent).toHaveBeenCalledWith(
      db,
      expect.anything(),
      'MATCH_REJECTED',
      'THREE_WAY_MATCH',
      'match-1',
      expect.stringContaining('Price discrepancy'),
      expect.objectContaining({ severity: 'WARNING' })
    );
  });

  it('should check permissions when auth context is provided', async () => {
    const auth = { userId: 'user-1', userPermissions: 64 };

    await rejectMatch(db, 'match-1', 'user-1', 'Admin', 'Bad quality', auth);

    expect(requirePermission).toHaveBeenCalledWith(64, 64, 'user-1', 'reject three-way match');
  });

  it('should throw when user lacks permission', async () => {
    const auth = { userId: 'user-1', userPermissions: 0 };

    await expect(rejectMatch(db, 'match-1', 'user-1', 'Admin', 'Reason', auth)).rejects.toThrow(
      'Permission denied'
    );
  });
});
