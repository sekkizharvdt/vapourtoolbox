/**
 * Audit Logger Tests
 *
 * Tests for financial transaction audit logging.
 * Critical for compliance - ensures all financial operations are tracked.
 */

import {
  logFinancialTransactionEvent,
  createAuditFieldChanges,
  logPaymentCreated,
  logPaymentUpdated,
  logInvoiceStatusUpdated,
  logPaymentPosted,
  syncFallbackAuditLogs,
  getPendingAuditLogCount,
  type AuditUserContext,
} from './auditLogger';
import { addDoc, collection } from 'firebase/firestore';

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  collection: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
    fromDate: jest.fn((date: Date) => ({
      seconds: Math.floor(date.getTime() / 1000),
      nanoseconds: 0,
    })),
  },
}));

// Mock @vapour/firebase
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    AUDIT_LOGS: 'auditLogs',
  },
}));

// Mock @vapour/logger
jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  }),
}));

// Mock fetch for IP detection
global.fetch = jest.fn();

describe('auditLogger', () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const mockDb = {} as Parameters<typeof logFinancialTransactionEvent>[0];
  const mockUser: AuditUserContext = {
    userId: 'user-123',
    userEmail: 'test@example.com',
    userName: 'Test User',
    userPermissions: 255,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock successful IP fetch
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ip: '192.168.1.1' }),
    });
    // Mock successful addDoc
    (addDoc as jest.Mock).mockResolvedValue({ id: 'audit-123' });
    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('logFinancialTransactionEvent', () => {
    it('should write audit log to Firestore on success', async () => {
      await logFinancialTransactionEvent(
        mockDb,
        mockUser,
        'USER_CREATED',
        'USER',
        'entity-123',
        'Created a new user'
      );

      expect(addDoc).toHaveBeenCalledTimes(1);
      expect(collection).toHaveBeenCalledWith(mockDb, 'auditLogs');

      const writtenData = (addDoc as jest.Mock).mock.calls[0][1];
      expect(writtenData.actorId).toBe('user-123');
      expect(writtenData.actorEmail).toBe('test@example.com');
      expect(writtenData.action).toBe('USER_CREATED');
      expect(writtenData.entityType).toBe('USER');
      expect(writtenData.entityId).toBe('entity-123');
      expect(writtenData.description).toBe('Created a new user');
      expect(writtenData.success).toBe(true);
    });

    it('should include entity name when provided', async () => {
      await logFinancialTransactionEvent(
        mockDb,
        mockUser,
        'USER_CREATED',
        'USER',
        'entity-123',
        'Created invoice',
        'INV-2024-001'
      );

      const writtenData = (addDoc as jest.Mock).mock.calls[0][1];
      expect(writtenData.entityName).toBe('INV-2024-001');
    });

    it('should include field changes when provided', async () => {
      const changes = [{ field: 'status', oldValue: 'DRAFT', newValue: 'APPROVED' }];

      await logFinancialTransactionEvent(
        mockDb,
        mockUser,
        'USER_UPDATED',
        'USER',
        'entity-123',
        'Updated status',
        undefined,
        changes
      );

      const writtenData = (addDoc as jest.Mock).mock.calls[0][1];
      expect(writtenData.changes).toEqual(changes);
    });

    it('should include metadata when provided', async () => {
      const metadata = { customField: 'value', amount: 1000 };

      await logFinancialTransactionEvent(
        mockDb,
        mockUser,
        'DATA_EXPORTED',
        'SYSTEM',
        'entity-123',
        'Exported data',
        undefined,
        undefined,
        metadata
      );

      const writtenData = (addDoc as jest.Mock).mock.calls[0][1];
      expect(writtenData.metadata).toEqual(metadata);
    });

    it('should retry once on first failure', async () => {
      (addDoc as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ id: 'audit-123' });

      await logFinancialTransactionEvent(
        mockDb,
        mockUser,
        'USER_CREATED',
        'USER',
        'entity-123',
        'Created user'
      );

      expect(addDoc).toHaveBeenCalledTimes(2);
    });

    it('should skip IP detection on retry to avoid additional failures', async () => {
      (addDoc as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ id: 'audit-123' });

      await logFinancialTransactionEvent(
        mockDb,
        mockUser,
        'USER_CREATED',
        'USER',
        'entity-123',
        'Created user'
      );

      // Second call (retry) should have undefined ipAddress
      const retryData = (addDoc as jest.Mock).mock.calls[1][1];
      expect(retryData.ipAddress).toBeUndefined();
      expect(retryData.metadata._retryAttempt).toBe(true);
    });

    it('should handle IP fetch failure gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await logFinancialTransactionEvent(
        mockDb,
        mockUser,
        'USER_CREATED',
        'USER',
        'entity-123',
        'Created user'
      );

      expect(addDoc).toHaveBeenCalled();
      const writtenData = (addDoc as jest.Mock).mock.calls[0][1];
      expect(writtenData.ipAddress).toBeUndefined();
    });

    it('should set severity to CRITICAL for delete actions', async () => {
      await logFinancialTransactionEvent(
        mockDb,
        mockUser,
        'USER_DELETED',
        'USER',
        'entity-123',
        'Deleted user'
      );

      const writtenData = (addDoc as jest.Mock).mock.calls[0][1];
      expect(writtenData.severity).toBe('CRITICAL');
    });

    it('should set severity to WARNING for reject actions', async () => {
      await logFinancialTransactionEvent(
        mockDb,
        mockUser,
        'USER_REJECTED',
        'USER',
        'entity-123',
        'Rejected access'
      );

      const writtenData = (addDoc as jest.Mock).mock.calls[0][1];
      expect(writtenData.severity).toBe('WARNING');
    });

    it('should set severity to WARNING for export actions', async () => {
      await logFinancialTransactionEvent(
        mockDb,
        mockUser,
        'DATA_EXPORTED',
        'SYSTEM',
        'entity-123',
        'Exported data'
      );

      const writtenData = (addDoc as jest.Mock).mock.calls[0][1];
      expect(writtenData.severity).toBe('WARNING');
    });

    it('should set severity to INFO for other actions', async () => {
      await logFinancialTransactionEvent(
        mockDb,
        mockUser,
        'USER_CREATED',
        'USER',
        'entity-123',
        'Created user'
      );

      const writtenData = (addDoc as jest.Mock).mock.calls[0][1];
      expect(writtenData.severity).toBe('INFO');
    });
  });

  describe('createAuditFieldChanges', () => {
    it('should detect added fields', () => {
      const oldData = { name: 'John' };
      const newData = { name: 'John', email: 'john@example.com' };

      const changes = createAuditFieldChanges(oldData, newData);

      expect(changes).toContainEqual({
        field: 'email',
        oldValue: undefined,
        newValue: 'john@example.com',
      });
    });

    it('should detect removed fields', () => {
      const oldData = { name: 'John', email: 'john@example.com' };
      const newData = { name: 'John' };

      const changes = createAuditFieldChanges(oldData, newData);

      expect(changes).toContainEqual({
        field: 'email',
        oldValue: 'john@example.com',
        newValue: undefined,
      });
    });

    it('should detect changed fields', () => {
      const oldData = { name: 'John', status: 'DRAFT' };
      const newData = { name: 'John', status: 'APPROVED' };

      const changes = createAuditFieldChanges(oldData, newData);

      expect(changes).toContainEqual({
        field: 'status',
        oldValue: 'DRAFT',
        newValue: 'APPROVED',
      });
    });

    it('should not include unchanged fields', () => {
      const oldData = { name: 'John', status: 'DRAFT' };
      const newData = { name: 'John', status: 'APPROVED' };

      const changes = createAuditFieldChanges(oldData, newData);

      expect(changes).not.toContainEqual(expect.objectContaining({ field: 'name' }));
    });

    it('should skip internal fields starting with underscore', () => {
      const oldData = { name: 'John', _internal: 'old' };
      const newData = { name: 'John', _internal: 'new' };

      const changes = createAuditFieldChanges(oldData, newData);

      expect(changes).not.toContainEqual(expect.objectContaining({ field: '_internal' }));
    });

    it('should skip updatedAt and updatedBy fields', () => {
      const oldData = { name: 'John', updatedAt: new Date('2024-01-01') };
      const newData = { name: 'John', updatedAt: new Date('2024-01-02') };

      const changes = createAuditFieldChanges(oldData, newData);

      expect(changes).not.toContainEqual(expect.objectContaining({ field: 'updatedAt' }));
    });

    it('should detect nested object changes', () => {
      const oldData = { address: { city: 'NYC' } };
      const newData = { address: { city: 'LA' } };

      const changes = createAuditFieldChanges(oldData, newData);

      // Note: The implementation uses String() which converts objects to "[object Object]"
      // This is a limitation - complex objects lose detail in the audit log
      expect(changes).toContainEqual({
        field: 'address',
        oldValue: '[object Object]',
        newValue: '[object Object]',
      });
    });

    it('should return empty array when no changes', () => {
      const data = { name: 'John', status: 'DRAFT' };

      const changes = createAuditFieldChanges(data, data);

      expect(changes).toEqual([]);
    });
  });

  describe('convenience functions', () => {
    describe('logPaymentCreated', () => {
      it('should log payment creation with correct metadata', async () => {
        await logPaymentCreated(
          mockDb,
          mockUser,
          'payment-123',
          'PMT-2024-001',
          10000,
          'INR',
          'customer-456'
        );

        const writtenData = (addDoc as jest.Mock).mock.calls[0][1];
        expect(writtenData.entityId).toBe('payment-123');
        expect(writtenData.entityName).toBe('PMT-2024-001');
        expect(writtenData.description).toContain('PMT-2024-001');
        expect(writtenData.description).toContain('INR 10000');
        expect(writtenData.metadata.amount).toBe(10000);
        expect(writtenData.metadata.currency).toBe('INR');
        expect(writtenData.metadata.customerId).toBe('customer-456');
      });
    });

    describe('logPaymentUpdated', () => {
      it('should log payment update with changes', async () => {
        const changes = [{ field: 'amount', oldValue: '1000', newValue: '1500' }];

        await logPaymentUpdated(mockDb, mockUser, 'payment-123', 'PMT-2024-001', changes);

        const writtenData = (addDoc as jest.Mock).mock.calls[0][1];
        expect(writtenData.entityId).toBe('payment-123');
        expect(writtenData.changes).toEqual(changes);
        expect(writtenData.metadata.action).toBe('UPDATE');
      });
    });

    describe('logInvoiceStatusUpdated', () => {
      it('should log invoice status change', async () => {
        await logInvoiceStatusUpdated(
          mockDb,
          mockUser,
          'invoice-123',
          'INV-2024-001',
          'DRAFT',
          'APPROVED',
          5000
        );

        const writtenData = (addDoc as jest.Mock).mock.calls[0][1];
        expect(writtenData.entityId).toBe('invoice-123');
        expect(writtenData.description).toContain('DRAFT');
        expect(writtenData.description).toContain('APPROVED');
        expect(writtenData.changes).toContainEqual({
          field: 'status',
          oldValue: 'DRAFT',
          newValue: 'APPROVED',
        });
        expect(writtenData.metadata.allocatedAmount).toBe(5000);
      });
    });

    describe('logPaymentPosted', () => {
      it('should log payment posting', async () => {
        await logPaymentPosted(mockDb, mockUser, 'payment-123', 'PMT-2024-001');

        const writtenData = (addDoc as jest.Mock).mock.calls[0][1];
        expect(writtenData.entityId).toBe('payment-123');
        expect(writtenData.description).toContain('Posted');
        expect(writtenData.changes).toContainEqual({
          field: 'status',
          oldValue: 'DRAFT',
          newValue: 'POSTED',
        });
        expect(writtenData.metadata.action).toBe('POST');
      });
    });
  });

  describe('fallback storage', () => {
    // Skip these tests in Node environment without DOM
    const isNode = typeof window === 'undefined';

    describe('getPendingAuditLogCount', () => {
      it('should return 0 when no pending logs', () => {
        const count = getPendingAuditLogCount();
        // In Node, returns 0 because window is undefined
        expect(count).toBe(0);
      });

      if (!isNode) {
        it('should return count of pending logs', () => {
          localStorage.setItem(
            'vapour_failed_audit_logs',
            JSON.stringify([{ entityId: '1' }, { entityId: '2' }])
          );

          const count = getPendingAuditLogCount();
          expect(count).toBe(2);
        });

        it('should return 0 for invalid JSON', () => {
          localStorage.setItem('vapour_failed_audit_logs', 'invalid json');

          const count = getPendingAuditLogCount();
          expect(count).toBe(0);
        });
      }
    });

    describe('syncFallbackAuditLogs', () => {
      it('should return 0 in SSR context', async () => {
        // In Node environment, this returns 0
        const synced = await syncFallbackAuditLogs(mockDb, mockUser);
        expect(synced).toBe(0);
      });

      if (!isNode) {
        it('should return 0 when no pending logs', async () => {
          const synced = await syncFallbackAuditLogs(mockDb, mockUser);
          expect(synced).toBe(0);
        });

        it('should sync pending logs and return count', async () => {
          const pendingLogs = [
            {
              action: 'USER_CREATED',
              entityType: 'USER',
              entityId: 'entity-1',
              user: 'test@example.com',
              description: 'Test 1',
              timestamp: new Date().toISOString(),
              originalError: 'error',
              retryError: 'retry error',
            },
          ];
          localStorage.setItem('vapour_failed_audit_logs', JSON.stringify(pendingLogs));

          const synced = await syncFallbackAuditLogs(mockDb, mockUser);

          expect(synced).toBe(1);
          expect(addDoc).toHaveBeenCalled();
          expect(localStorage.getItem('vapour_failed_audit_logs')).toBeNull();
        });
      }
    });
  });
});
