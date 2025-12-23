/**
 * Audit Log Service Tests
 *
 * Tests for the audit log query service used by admin audit log viewer.
 */

import type { AuditLog, AuditAction, AuditEntityType, AuditSeverity } from '@vapour/types';

// Mock firebase/firestore
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();
const mockOrderBy = jest.fn();
const mockLimit = jest.fn();
const mockDoc = jest.fn();
const mockGetDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    AUDIT_LOGS: 'auditLogs',
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
import {
  buildAuditLogQuery,
  getAuditLogById,
  ACTION_CATEGORIES,
  ENTITY_TYPE_CATEGORIES,
  SEVERITY_CONFIG,
  type AuditLogQueryOptions,
} from './auditLogService';

describe('auditLogService', () => {
  const mockDb = { id: 'mock-db' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCollection.mockReturnValue({ id: 'auditLogs' });
    mockQuery.mockReturnValue({ id: 'mock-query' });
    mockWhere.mockReturnValue('where-constraint');
    mockOrderBy.mockReturnValue('orderBy-constraint');
    mockLimit.mockReturnValue('limit-constraint');
  });

  describe('buildAuditLogQuery', () => {
    it('should build query with no filters', () => {
      buildAuditLogQuery(mockDb, {});

      expect(mockCollection).toHaveBeenCalledWith(mockDb, 'auditLogs');
      expect(mockOrderBy).toHaveBeenCalledWith('timestamp', 'desc');
      expect(mockLimit).toHaveBeenCalledWith(500);
      expect(mockWhere).not.toHaveBeenCalled();
    });

    it('should apply actorId filter', () => {
      const options: AuditLogQueryOptions = { actorId: 'user-123' };
      buildAuditLogQuery(mockDb, options);

      expect(mockWhere).toHaveBeenCalledWith('actorId', '==', 'user-123');
    });

    it('should apply action filter', () => {
      const options: AuditLogQueryOptions = { action: 'USER_CREATED' as AuditAction };
      buildAuditLogQuery(mockDb, options);

      expect(mockWhere).toHaveBeenCalledWith('action', '==', 'USER_CREATED');
    });

    it('should apply entityType filter', () => {
      const options: AuditLogQueryOptions = { entityType: 'USER' as AuditEntityType };
      buildAuditLogQuery(mockDb, options);

      expect(mockWhere).toHaveBeenCalledWith('entityType', '==', 'USER');
    });

    it('should apply severity filter', () => {
      const options: AuditLogQueryOptions = { severity: 'WARNING' as AuditSeverity };
      buildAuditLogQuery(mockDb, options);

      expect(mockWhere).toHaveBeenCalledWith('severity', '==', 'WARNING');
    });

    it('should apply entityId filter', () => {
      const options: AuditLogQueryOptions = { entityId: 'entity-456' };
      buildAuditLogQuery(mockDb, options);

      expect(mockWhere).toHaveBeenCalledWith('entityId', '==', 'entity-456');
    });

    it('should apply custom limit', () => {
      const options: AuditLogQueryOptions = { limitCount: 100 };
      buildAuditLogQuery(mockDb, options);

      expect(mockLimit).toHaveBeenCalledWith(100);
    });

    it('should apply multiple filters', () => {
      const options: AuditLogQueryOptions = {
        actorId: 'user-123',
        action: 'USER_UPDATED' as AuditAction,
        severity: 'INFO' as AuditSeverity,
        limitCount: 50,
      };
      buildAuditLogQuery(mockDb, options);

      expect(mockWhere).toHaveBeenCalledWith('actorId', '==', 'user-123');
      expect(mockWhere).toHaveBeenCalledWith('action', '==', 'USER_UPDATED');
      expect(mockWhere).toHaveBeenCalledWith('severity', '==', 'INFO');
      expect(mockLimit).toHaveBeenCalledWith(50);
    });

    it('should always order by timestamp descending', () => {
      buildAuditLogQuery(mockDb, { action: 'LOGIN_SUCCESS' as AuditAction });

      expect(mockOrderBy).toHaveBeenCalledWith('timestamp', 'desc');
    });

    it('should use default limit of 500 when not specified', () => {
      buildAuditLogQuery(mockDb, { actorId: 'user-1' });

      expect(mockLimit).toHaveBeenCalledWith(500);
    });
  });

  describe('getAuditLogById', () => {
    const mockAuditLogData: Omit<AuditLog, 'id'> = {
      action: 'USER_CREATED' as AuditAction,
      entityType: 'USER' as AuditEntityType,
      entityId: 'user-456',
      actorId: 'admin-123',
      actorEmail: 'admin@example.com',
      severity: 'INFO' as AuditSeverity,
      description: 'User account created',
      timestamp: { seconds: 1703318400, nanoseconds: 0 } as unknown as AuditLog['timestamp'],
    };

    beforeEach(() => {
      mockDoc.mockReturnValue({ id: 'audit-123' });
    });

    it('should return audit log when document exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'audit-123',
        data: () => mockAuditLogData,
      });

      const result = await getAuditLogById(mockDb, 'audit-123');

      expect(mockDoc).toHaveBeenCalledWith(mockDb, 'auditLogs', 'audit-123');
      expect(result).toEqual({
        id: 'audit-123',
        ...mockAuditLogData,
      });
    });

    it('should return null when document does not exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await getAuditLogById(mockDb, 'non-existent');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

      const result = await getAuditLogById(mockDb, 'audit-123');

      expect(result).toBeNull();
    });

    it('should include all audit log fields', async () => {
      const fullAuditLog: Omit<AuditLog, 'id'> = {
        ...mockAuditLogData,
        fieldChanges: [{ field: 'email', oldValue: 'old@test.com', newValue: 'new@test.com' }],
        metadata: { browser: 'Chrome', ip: '192.168.1.1' },
        errorMessage: undefined,
      };

      mockGetDoc.mockResolvedValue({
        exists: () => true,
        id: 'audit-full',
        data: () => fullAuditLog,
      });

      const result = await getAuditLogById(mockDb, 'audit-full');

      expect(result).toMatchObject({
        id: 'audit-full',
        fieldChanges: [{ field: 'email', oldValue: 'old@test.com', newValue: 'new@test.com' }],
        metadata: { browser: 'Chrome', ip: '192.168.1.1' },
      });
    });
  });

  describe('ACTION_CATEGORIES', () => {
    it('should have User Management category', () => {
      expect(ACTION_CATEGORIES['User Management']).toContain('USER_CREATED');
      expect(ACTION_CATEGORIES['User Management']).toContain('USER_UPDATED');
      expect(ACTION_CATEGORIES['User Management']).toContain('USER_DELETED');
      expect(ACTION_CATEGORIES['User Management']).toContain('USER_APPROVED');
      expect(ACTION_CATEGORIES['User Management']).toContain('USER_REJECTED');
    });

    it('should have Roles & Permissions category', () => {
      expect(ACTION_CATEGORIES['Roles & Permissions']).toContain('ROLE_ASSIGNED');
      expect(ACTION_CATEGORIES['Roles & Permissions']).toContain('PERMISSION_GRANTED');
      expect(ACTION_CATEGORIES['Roles & Permissions']).toContain('CLAIMS_UPDATED');
    });

    it('should have Authentication category', () => {
      expect(ACTION_CATEGORIES['Authentication']).toContain('LOGIN_SUCCESS');
      expect(ACTION_CATEGORIES['Authentication']).toContain('LOGIN_FAILED');
      expect(ACTION_CATEGORIES['Authentication']).toContain('LOGOUT');
      expect(ACTION_CATEGORIES['Authentication']).toContain('PASSWORD_CHANGED');
    });

    it('should have Projects category', () => {
      expect(ACTION_CATEGORIES['Projects']).toContain('PROJECT_CREATED');
      expect(ACTION_CATEGORIES['Projects']).toContain('CHARTER_SUBMITTED');
      expect(ACTION_CATEGORIES['Projects']).toContain('CHARTER_APPROVED');
    });

    it('should have Purchase Requests category', () => {
      expect(ACTION_CATEGORIES['Purchase Requests']).toContain('PR_CREATED');
      expect(ACTION_CATEGORIES['Purchase Requests']).toContain('PR_APPROVED');
      expect(ACTION_CATEGORIES['Purchase Requests']).toContain('PR_REJECTED');
    });

    it('should have Purchase Orders category', () => {
      expect(ACTION_CATEGORIES['Purchase Orders']).toContain('PO_CREATED');
      expect(ACTION_CATEGORIES['Purchase Orders']).toContain('PO_APPROVED');
      expect(ACTION_CATEGORIES['Purchase Orders']).toContain('PO_AMENDED');
    });

    it('should have Accounting category', () => {
      expect(ACTION_CATEGORIES['Accounting']).toContain('TRANSACTION_CREATED');
      expect(ACTION_CATEGORIES['Accounting']).toContain('GL_ENTRY_CREATED');
      expect(ACTION_CATEGORIES['Accounting']).toContain('ACCOUNT_CREATED');
    });

    it('should have Documents category', () => {
      expect(ACTION_CATEGORIES['Documents']).toContain('DOCUMENT_CREATED');
      expect(ACTION_CATEGORIES['Documents']).toContain('DOCUMENT_APPROVED');
      expect(ACTION_CATEGORIES['Documents']).toContain('COMMENT_CREATED');
    });

    it('should have System category', () => {
      expect(ACTION_CATEGORIES['System']).toContain('CONFIG_CHANGED');
      expect(ACTION_CATEGORIES['System']).toContain('INVITATION_SENT');
      expect(ACTION_CATEGORIES['System']).toContain('DATA_EXPORTED');
    });

    it('should contain all expected categories', () => {
      const expectedCategories = [
        'User Management',
        'Roles & Permissions',
        'Authentication',
        'Projects',
        'Entities',
        'Purchase Requests',
        'RFQ',
        'Purchase Orders',
        'Goods Receipt',
        'Three-Way Match',
        'Invoices & Bills',
        'Payments',
        'Accounting',
        'Documents',
        'Materials',
        'Proposals',
        'Tasks',
        'System',
      ];

      expectedCategories.forEach((category) => {
        expect(ACTION_CATEGORIES).toHaveProperty(category);
      });
    });
  });

  describe('ENTITY_TYPE_CATEGORIES', () => {
    it('should have Users & Access category', () => {
      expect(ENTITY_TYPE_CATEGORIES['Users & Access']).toContain('USER');
      expect(ENTITY_TYPE_CATEGORIES['Users & Access']).toContain('ROLE');
      expect(ENTITY_TYPE_CATEGORIES['Users & Access']).toContain('PERMISSION');
      expect(ENTITY_TYPE_CATEGORIES['Users & Access']).toContain('INVITATION');
    });

    it('should have Business Entities category', () => {
      expect(ENTITY_TYPE_CATEGORIES['Business Entities']).toContain('ENTITY');
      expect(ENTITY_TYPE_CATEGORIES['Business Entities']).toContain('VENDOR');
      expect(ENTITY_TYPE_CATEGORIES['Business Entities']).toContain('CUSTOMER');
    });

    it('should have Procurement category', () => {
      expect(ENTITY_TYPE_CATEGORIES['Procurement']).toContain('PURCHASE_REQUEST');
      expect(ENTITY_TYPE_CATEGORIES['Procurement']).toContain('RFQ');
      expect(ENTITY_TYPE_CATEGORIES['Procurement']).toContain('PURCHASE_ORDER');
      expect(ENTITY_TYPE_CATEGORIES['Procurement']).toContain('GOODS_RECEIPT');
      expect(ENTITY_TYPE_CATEGORIES['Procurement']).toContain('THREE_WAY_MATCH');
    });

    it('should have Accounting category', () => {
      expect(ENTITY_TYPE_CATEGORIES['Accounting']).toContain('TRANSACTION');
      expect(ENTITY_TYPE_CATEGORIES['Accounting']).toContain('INVOICE');
      expect(ENTITY_TYPE_CATEGORIES['Accounting']).toContain('BILL');
      expect(ENTITY_TYPE_CATEGORIES['Accounting']).toContain('GL_ACCOUNT');
    });

    it('should have Documents category', () => {
      expect(ENTITY_TYPE_CATEGORIES['Documents']).toContain('MASTER_DOCUMENT');
      expect(ENTITY_TYPE_CATEGORIES['Documents']).toContain('DOCUMENT_SUBMISSION');
      expect(ENTITY_TYPE_CATEGORIES['Documents']).toContain('TRANSMITTAL');
    });

    it('should have Materials category', () => {
      expect(ENTITY_TYPE_CATEGORIES['Materials']).toContain('MATERIAL');
      expect(ENTITY_TYPE_CATEGORIES['Materials']).toContain('BOM');
      expect(ENTITY_TYPE_CATEGORIES['Materials']).toContain('BOUGHT_OUT_ITEM');
    });

    it('should contain all expected entity type categories', () => {
      const expectedCategories = [
        'Users & Access',
        'Business Entities',
        'Projects',
        'Procurement',
        'Accounting',
        'Documents',
        'Materials',
        'Proposals',
        'Tasks',
        'System',
      ];

      expectedCategories.forEach((category) => {
        expect(ENTITY_TYPE_CATEGORIES).toHaveProperty(category);
      });
    });
  });

  describe('SEVERITY_CONFIG', () => {
    it('should have INFO severity with correct config', () => {
      expect(SEVERITY_CONFIG.INFO).toEqual({ label: 'Info', color: 'info' });
    });

    it('should have WARNING severity with correct config', () => {
      expect(SEVERITY_CONFIG.WARNING).toEqual({ label: 'Warning', color: 'warning' });
    });

    it('should have ERROR severity with correct config', () => {
      expect(SEVERITY_CONFIG.ERROR).toEqual({ label: 'Error', color: 'error' });
    });

    it('should have CRITICAL severity with error color', () => {
      expect(SEVERITY_CONFIG.CRITICAL).toEqual({ label: 'Critical', color: 'error' });
    });

    it('should have all four severity levels', () => {
      expect(Object.keys(SEVERITY_CONFIG)).toHaveLength(4);
      expect(SEVERITY_CONFIG).toHaveProperty('INFO');
      expect(SEVERITY_CONFIG).toHaveProperty('WARNING');
      expect(SEVERITY_CONFIG).toHaveProperty('ERROR');
      expect(SEVERITY_CONFIG).toHaveProperty('CRITICAL');
    });
  });
});
