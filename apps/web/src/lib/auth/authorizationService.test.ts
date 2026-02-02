/**
 * Authorization Service Tests
 *
 * Tests for centralized permission checks, approver validation,
 * ownership checks, and self-approval prevention.
 */

import { PermissionFlag } from '@vapour/types';

// Mock Firebase before imports
jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    USERS: 'users',
  },
}));

// Mock Firebase Firestore
const mockGetDoc = jest.fn();
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, _collection, id) => ({ id, path: `${_collection}/${id}` })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}));

// Mock logger
jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

import {
  AuthorizationError,
  getUserPermissions,
  createAuthContext,
  requirePermission,
  requireAnyPermission,
  requireApprover,
  requireOwnerOrPermission,
  preventSelfApproval,
  checkPermission,
  canPerformOperation,
} from './authorizationService';
import type { Firestore } from 'firebase/firestore';

describe('authorizationService', () => {
  const mockDb = {} as unknown as Firestore;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AuthorizationError', () => {
    it('has correct name and properties', () => {
      const error = new AuthorizationError(
        'Permission denied',
        PermissionFlag.MANAGE_USERS,
        'user-1',
        'create user'
      );

      expect(error.name).toBe('AuthorizationError');
      expect(error.message).toBe('Permission denied');
      expect(error.requiredPermission).toBe(PermissionFlag.MANAGE_USERS);
      expect(error.userId).toBe('user-1');
      expect(error.operation).toBe('create user');
      expect(error instanceof Error).toBe(true);
    });

    it('works with minimal parameters', () => {
      const error = new AuthorizationError('Denied');
      expect(error.requiredPermission).toBeUndefined();
      expect(error.userId).toBeUndefined();
      expect(error.operation).toBeUndefined();
    });
  });

  describe('getUserPermissions', () => {
    it('returns permissions for existing user', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ permissions: 2048 | 4096 }), // CREATE_TRANSACTIONS | APPROVE_TRANSACTIONS
      });

      const permissions = await getUserPermissions(mockDb, 'user-1');
      expect(permissions).toBe(2048 | 4096);
    });

    it('throws AuthorizationError when user not found', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      await expect(getUserPermissions(mockDb, 'non-existent')).rejects.toThrow(AuthorizationError);
      await expect(getUserPermissions(mockDb, 'non-existent')).rejects.toThrow('User not found');
    });

    it('returns 0 when user has no permissions field', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({}),
      });

      const permissions = await getUserPermissions(mockDb, 'user-1');
      expect(permissions).toBe(0);
    });
  });

  describe('createAuthContext', () => {
    it('creates context with all fields', () => {
      const ctx = createAuthContext('user-1', 2048, 'entity-1');
      expect(ctx.userId).toBe('user-1');
      expect(ctx.userPermissions).toBe(2048);
      expect(ctx.entityId).toBe('entity-1');
    });

    it('creates context without entityId', () => {
      const ctx = createAuthContext('user-1', 0);
      expect(ctx.entityId).toBeUndefined();
    });
  });

  describe('requirePermission', () => {
    it('does not throw when user has the permission', () => {
      const permissions = PermissionFlag.CREATE_TRANSACTIONS | PermissionFlag.APPROVE_TRANSACTIONS;

      expect(() => {
        requirePermission(
          permissions,
          PermissionFlag.CREATE_TRANSACTIONS,
          'user-1',
          'create invoice'
        );
      }).not.toThrow();
    });

    it('throws AuthorizationError when permission is missing', () => {
      const permissions = PermissionFlag.CREATE_TRANSACTIONS; // only CREATE, not APPROVE

      expect(() => {
        requirePermission(
          permissions,
          PermissionFlag.APPROVE_TRANSACTIONS,
          'user-1',
          'approve invoice'
        );
      }).toThrow(AuthorizationError);
    });

    it('includes operation name in error message', () => {
      expect(() => {
        requirePermission(0, PermissionFlag.MANAGE_USERS, 'user-1', 'manage users');
      }).toThrow('manage users requires MANAGE_USERS');
    });

    it('works without operation name', () => {
      expect(() => {
        requirePermission(0, PermissionFlag.MANAGE_USERS, 'user-1');
      }).toThrow('requires MANAGE_USERS');
    });

    it('throws when permissions is 0', () => {
      expect(() => {
        requirePermission(0, PermissionFlag.CREATE_TRANSACTIONS, 'user-1');
      }).toThrow(AuthorizationError);
    });
  });

  describe('requireAnyPermission', () => {
    it('does not throw when user has one of the permissions', () => {
      const permissions = PermissionFlag.CREATE_TRANSACTIONS;

      expect(() => {
        requireAnyPermission(
          permissions,
          [PermissionFlag.CREATE_TRANSACTIONS, PermissionFlag.APPROVE_TRANSACTIONS],
          'user-1',
          'transaction operation'
        );
      }).not.toThrow();
    });

    it('throws when user has none of the permissions', () => {
      const permissions = PermissionFlag.MANAGE_ENTITIES; // unrelated permission

      expect(() => {
        requireAnyPermission(
          permissions,
          [PermissionFlag.CREATE_TRANSACTIONS, PermissionFlag.APPROVE_TRANSACTIONS],
          'user-1',
          'transaction operation'
        );
      }).toThrow(AuthorizationError);
    });

    it('includes all flag names in error message', () => {
      try {
        requireAnyPermission(
          0,
          [PermissionFlag.CREATE_TRANSACTIONS, PermissionFlag.APPROVE_TRANSACTIONS],
          'user-1',
          'test op'
        );
        fail('Should have thrown');
      } catch (error) {
        expect((error as AuthorizationError).message).toContain('CREATE_TRANSACTIONS');
        expect((error as AuthorizationError).message).toContain('APPROVE_TRANSACTIONS');
      }
    });

    it('works without operation name', () => {
      expect(() => {
        requireAnyPermission(0, [PermissionFlag.MANAGE_USERS], 'user-1');
      }).toThrow('requires one of: MANAGE_USERS');
    });
  });

  describe('requireApprover', () => {
    it('does not throw when user is in approver list', () => {
      expect(() => {
        requireApprover('user-1', ['user-1', 'user-2', 'user-3'], 'approve PO');
      }).not.toThrow();
    });

    it('throws when user is not in approver list', () => {
      expect(() => {
        requireApprover('user-4', ['user-1', 'user-2', 'user-3'], 'approve PO');
      }).toThrow(AuthorizationError);
    });

    it('includes operation in error message', () => {
      expect(() => {
        requireApprover('user-4', ['user-1'], 'approve purchase order');
      }).toThrow('You are not authorized to approve purchase order');
    });

    it('throws when approver list is empty', () => {
      expect(() => {
        requireApprover('user-1', [], 'approve');
      }).toThrow(AuthorizationError);
    });
  });

  describe('requireOwnerOrPermission', () => {
    it('allows when user is the owner', () => {
      expect(() => {
        requireOwnerOrPermission(
          'user-1',
          'user-1',
          0, // no permissions needed if owner
          PermissionFlag.MANAGE_USERS,
          'edit profile'
        );
      }).not.toThrow();
    });

    it('allows when user has admin permission but is not owner', () => {
      expect(() => {
        requireOwnerOrPermission(
          'user-2',
          'user-1',
          PermissionFlag.MANAGE_USERS,
          PermissionFlag.MANAGE_USERS,
          'edit profile'
        );
      }).not.toThrow();
    });

    it('throws when user is not owner and lacks admin permission', () => {
      expect(() => {
        requireOwnerOrPermission(
          'user-2',
          'user-1',
          0,
          PermissionFlag.MANAGE_USERS,
          'edit profile'
        );
      }).toThrow(AuthorizationError);
    });

    it('includes ownership info in error message', () => {
      expect(() => {
        requireOwnerOrPermission('user-2', 'user-1', 0, PermissionFlag.MANAGE_USERS, 'edit');
      }).toThrow('ownership or MANAGE_USERS');
    });

    it('works without operation name', () => {
      expect(() => {
        requireOwnerOrPermission('user-2', 'user-1', 0, PermissionFlag.MANAGE_USERS);
      }).toThrow('Must be owner or have MANAGE_USERS permission');
    });
  });

  describe('preventSelfApproval', () => {
    it('does not throw for different users', () => {
      expect(() => {
        preventSelfApproval('approver-1', 'creator-1', 'approve invoice');
      }).not.toThrow();
    });

    it('throws when approver is the creator', () => {
      expect(() => {
        preventSelfApproval('user-1', 'user-1', 'approve invoice');
      }).toThrow(AuthorizationError);
    });

    it('includes operation in error message', () => {
      expect(() => {
        preventSelfApproval('user-1', 'user-1', 'approve purchase order');
      }).toThrow('Cannot approve purchase order your own request');
    });
  });

  describe('checkPermission', () => {
    it('returns true when permission is granted', () => {
      const permissions = PermissionFlag.CREATE_TRANSACTIONS | PermissionFlag.APPROVE_TRANSACTIONS;
      expect(checkPermission(permissions, PermissionFlag.CREATE_TRANSACTIONS)).toBe(true);
    });

    it('returns false when permission is not granted', () => {
      const permissions = PermissionFlag.CREATE_TRANSACTIONS;
      expect(checkPermission(permissions, PermissionFlag.APPROVE_TRANSACTIONS)).toBe(false);
    });

    it('returns false for zero permissions', () => {
      expect(checkPermission(0, PermissionFlag.MANAGE_USERS)).toBe(false);
    });
  });

  describe('canPerformOperation', () => {
    it('returns true when required permission is granted', () => {
      const ctx = createAuthContext('user-1', PermissionFlag.CREATE_TRANSACTIONS);
      expect(
        canPerformOperation(ctx, { requiredPermission: PermissionFlag.CREATE_TRANSACTIONS })
      ).toBe(true);
    });

    it('returns false when required permission is missing', () => {
      const ctx = createAuthContext('user-1', 0);
      expect(
        canPerformOperation(ctx, { requiredPermission: PermissionFlag.CREATE_TRANSACTIONS })
      ).toBe(false);
    });

    it('returns true when any of required permissions is granted', () => {
      const ctx = createAuthContext('user-1', PermissionFlag.APPROVE_TRANSACTIONS);
      expect(
        canPerformOperation(ctx, {
          requiredAnyPermission: [
            PermissionFlag.CREATE_TRANSACTIONS,
            PermissionFlag.APPROVE_TRANSACTIONS,
          ],
        })
      ).toBe(true);
    });

    it('returns false when none of required permissions is granted', () => {
      const ctx = createAuthContext('user-1', PermissionFlag.MANAGE_ENTITIES);
      expect(
        canPerformOperation(ctx, {
          requiredAnyPermission: [
            PermissionFlag.CREATE_TRANSACTIONS,
            PermissionFlag.APPROVE_TRANSACTIONS,
          ],
        })
      ).toBe(false);
    });

    it('returns true when user is in approver list', () => {
      const ctx = createAuthContext('user-1', 0);
      expect(canPerformOperation(ctx, { approverIds: ['user-1', 'user-2'] })).toBe(true);
    });

    it('returns false when user is not in approver list', () => {
      const ctx = createAuthContext('user-3', 0);
      expect(canPerformOperation(ctx, { approverIds: ['user-1', 'user-2'] })).toBe(false);
    });

    it('returns true when no options are specified', () => {
      const ctx = createAuthContext('user-1', 0);
      expect(canPerformOperation(ctx, {})).toBe(true);
    });

    it('checks all conditions together', () => {
      const ctx = createAuthContext(
        'user-1',
        PermissionFlag.CREATE_TRANSACTIONS | PermissionFlag.APPROVE_TRANSACTIONS
      );

      // All conditions met
      expect(
        canPerformOperation(ctx, {
          requiredPermission: PermissionFlag.CREATE_TRANSACTIONS,
          approverIds: ['user-1'],
        })
      ).toBe(true);

      // Permission met but not in approver list
      expect(
        canPerformOperation(ctx, {
          requiredPermission: PermissionFlag.CREATE_TRANSACTIONS,
          approverIds: ['user-2'],
        })
      ).toBe(false);
    });
  });
});
