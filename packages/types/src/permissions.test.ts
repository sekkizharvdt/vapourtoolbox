/**
 * Permission System Tests
 *
 * Comprehensive test suite for bitwise permission system
 * Covers: permission flags, helper functions, role permissions, and combinations
 */

import {
  PermissionFlag,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  addPermission,
  addPermissions,
  removePermission,
  removePermissions,
  togglePermission,
  createPermissions,
  getGrantedPermissions,
  RolePermissions,
  getPermissionsForRole,
  getPermissionsForRoles,
  PermissionDescriptions,
} from './permissions';

describe('Permission System', () => {
  /**
   * Test Group 1: Basic Permission Checks
   */
  describe('hasPermission', () => {
    it('should return true when permission is granted', () => {
      const permissions = PermissionFlag.MANAGE_USERS | PermissionFlag.CREATE_PROJECTS;

      expect(hasPermission(permissions, PermissionFlag.MANAGE_USERS)).toBe(true);
      expect(hasPermission(permissions, PermissionFlag.CREATE_PROJECTS)).toBe(true);
    });

    it('should return false when permission is not granted', () => {
      const permissions = PermissionFlag.MANAGE_USERS;

      expect(hasPermission(permissions, PermissionFlag.CREATE_PROJECTS)).toBe(false);
      expect(hasPermission(permissions, PermissionFlag.ASSIGN_ROLES)).toBe(false);
    });

    it('should return false for zero permissions', () => {
      const permissions = 0;

      expect(hasPermission(permissions, PermissionFlag.MANAGE_USERS)).toBe(false);
      expect(hasPermission(permissions, PermissionFlag.CREATE_PROJECTS)).toBe(false);
    });

    it('should work with all permission flags', () => {
      // Test each individual permission flag
      expect(hasPermission(PermissionFlag.MANAGE_USERS, PermissionFlag.MANAGE_USERS)).toBe(true);
      expect(hasPermission(PermissionFlag.ASSIGN_ROLES, PermissionFlag.ASSIGN_ROLES)).toBe(true);
      expect(hasPermission(PermissionFlag.CREATE_PROJECTS, PermissionFlag.CREATE_PROJECTS)).toBe(
        true
      );
      expect(
        hasPermission(PermissionFlag.VIEW_ALL_PROJECTS, PermissionFlag.VIEW_ALL_PROJECTS)
      ).toBe(true);
      expect(hasPermission(PermissionFlag.ASSIGN_PROJECTS, PermissionFlag.ASSIGN_PROJECTS)).toBe(
        true
      );
      expect(hasPermission(PermissionFlag.MANAGE_ENTITIES, PermissionFlag.MANAGE_ENTITIES)).toBe(
        true
      );
      expect(hasPermission(PermissionFlag.CREATE_PR, PermissionFlag.CREATE_PR)).toBe(true);
      expect(hasPermission(PermissionFlag.APPROVE_PO, PermissionFlag.APPROVE_PO)).toBe(true);
    });
  });

  /**
   * Test Group 2: Multiple Permission Checks
   */
  describe('hasAnyPermission', () => {
    it('should return true when at least one permission is granted', () => {
      const permissions = PermissionFlag.MANAGE_USERS;

      expect(
        hasAnyPermission(permissions, PermissionFlag.MANAGE_USERS, PermissionFlag.CREATE_PROJECTS)
      ).toBe(true);
    });

    it('should return false when no permissions are granted', () => {
      const permissions = PermissionFlag.MANAGE_USERS;

      expect(
        hasAnyPermission(permissions, PermissionFlag.CREATE_PROJECTS, PermissionFlag.ASSIGN_ROLES)
      ).toBe(false);
    });

    it('should return true when all permissions are granted', () => {
      const permissions = PermissionFlag.MANAGE_USERS | PermissionFlag.CREATE_PROJECTS;

      expect(
        hasAnyPermission(permissions, PermissionFlag.MANAGE_USERS, PermissionFlag.CREATE_PROJECTS)
      ).toBe(true);
    });

    it('should return false for empty permission list', () => {
      const permissions = PermissionFlag.MANAGE_USERS;

      expect(hasAnyPermission(permissions)).toBe(false);
    });
  });

  describe('hasAllPermissions', () => {
    it('should return true when all permissions are granted', () => {
      const permissions = PermissionFlag.MANAGE_USERS | PermissionFlag.CREATE_PROJECTS;

      expect(
        hasAllPermissions(permissions, PermissionFlag.MANAGE_USERS, PermissionFlag.CREATE_PROJECTS)
      ).toBe(true);
    });

    it('should return false when some permissions are missing', () => {
      const permissions = PermissionFlag.MANAGE_USERS;

      expect(
        hasAllPermissions(permissions, PermissionFlag.MANAGE_USERS, PermissionFlag.CREATE_PROJECTS)
      ).toBe(false);
    });

    it('should return false when no permissions are granted', () => {
      const permissions = 0;

      expect(
        hasAllPermissions(permissions, PermissionFlag.MANAGE_USERS, PermissionFlag.CREATE_PROJECTS)
      ).toBe(false);
    });

    it('should return true for single permission check', () => {
      const permissions = PermissionFlag.MANAGE_USERS;

      expect(hasAllPermissions(permissions, PermissionFlag.MANAGE_USERS)).toBe(true);
    });

    it('should return true for empty permission list', () => {
      const permissions = PermissionFlag.MANAGE_USERS;

      expect(hasAllPermissions(permissions)).toBe(true);
    });
  });

  /**
   * Test Group 3: Adding Permissions
   */
  describe('addPermission', () => {
    it('should add a permission to empty permissions', () => {
      const permissions = 0;
      const result = addPermission(permissions, PermissionFlag.MANAGE_USERS);

      expect(hasPermission(result, PermissionFlag.MANAGE_USERS)).toBe(true);
    });

    it('should add a permission to existing permissions', () => {
      const permissions = PermissionFlag.MANAGE_USERS;
      const result = addPermission(permissions, PermissionFlag.CREATE_PROJECTS);

      expect(hasPermission(result, PermissionFlag.MANAGE_USERS)).toBe(true);
      expect(hasPermission(result, PermissionFlag.CREATE_PROJECTS)).toBe(true);
    });

    it('should be idempotent (adding same permission twice)', () => {
      const permissions = PermissionFlag.MANAGE_USERS;
      const result = addPermission(permissions, PermissionFlag.MANAGE_USERS);

      expect(result).toBe(permissions);
    });

    it('should not affect other permissions', () => {
      const permissions = PermissionFlag.MANAGE_USERS | PermissionFlag.CREATE_PROJECTS;
      const result = addPermission(permissions, PermissionFlag.ASSIGN_ROLES);

      expect(hasPermission(result, PermissionFlag.MANAGE_USERS)).toBe(true);
      expect(hasPermission(result, PermissionFlag.CREATE_PROJECTS)).toBe(true);
      expect(hasPermission(result, PermissionFlag.ASSIGN_ROLES)).toBe(true);
    });
  });

  describe('addPermissions', () => {
    it('should add multiple permissions at once', () => {
      const permissions = 0;
      const result = addPermissions(
        permissions,
        PermissionFlag.MANAGE_USERS,
        PermissionFlag.CREATE_PROJECTS,
        PermissionFlag.ASSIGN_ROLES
      );

      expect(hasPermission(result, PermissionFlag.MANAGE_USERS)).toBe(true);
      expect(hasPermission(result, PermissionFlag.CREATE_PROJECTS)).toBe(true);
      expect(hasPermission(result, PermissionFlag.ASSIGN_ROLES)).toBe(true);
    });

    it('should add permissions to existing permissions', () => {
      const permissions = PermissionFlag.MANAGE_USERS;
      const result = addPermissions(
        permissions,
        PermissionFlag.CREATE_PROJECTS,
        PermissionFlag.ASSIGN_ROLES
      );

      expect(hasPermission(result, PermissionFlag.MANAGE_USERS)).toBe(true);
      expect(hasPermission(result, PermissionFlag.CREATE_PROJECTS)).toBe(true);
      expect(hasPermission(result, PermissionFlag.ASSIGN_ROLES)).toBe(true);
    });

    it('should handle empty permissions list', () => {
      const permissions = PermissionFlag.MANAGE_USERS;
      const result = addPermissions(permissions);

      expect(result).toBe(permissions);
    });
  });

  /**
   * Test Group 4: Removing Permissions
   */
  describe('removePermission', () => {
    it('should remove an existing permission', () => {
      const permissions = PermissionFlag.MANAGE_USERS | PermissionFlag.CREATE_PROJECTS;
      const result = removePermission(permissions, PermissionFlag.MANAGE_USERS);

      expect(hasPermission(result, PermissionFlag.MANAGE_USERS)).toBe(false);
      expect(hasPermission(result, PermissionFlag.CREATE_PROJECTS)).toBe(true);
    });

    it('should be safe to remove non-existent permission', () => {
      const permissions = PermissionFlag.MANAGE_USERS;
      const result = removePermission(permissions, PermissionFlag.CREATE_PROJECTS);

      expect(result).toBe(permissions);
      expect(hasPermission(result, PermissionFlag.MANAGE_USERS)).toBe(true);
    });

    it('should remove permission from full permissions', () => {
      const permissions = RolePermissions.SUPER_ADMIN;
      const result = removePermission(permissions, PermissionFlag.MANAGE_USERS);

      expect(hasPermission(result, PermissionFlag.MANAGE_USERS)).toBe(false);
      expect(hasPermission(result, PermissionFlag.CREATE_PROJECTS)).toBe(true);
    });
  });

  describe('removePermissions', () => {
    it('should remove multiple permissions at once', () => {
      const permissions =
        PermissionFlag.MANAGE_USERS | PermissionFlag.CREATE_PROJECTS | PermissionFlag.ASSIGN_ROLES;
      const result = removePermissions(
        permissions,
        PermissionFlag.MANAGE_USERS,
        PermissionFlag.CREATE_PROJECTS
      );

      expect(hasPermission(result, PermissionFlag.MANAGE_USERS)).toBe(false);
      expect(hasPermission(result, PermissionFlag.CREATE_PROJECTS)).toBe(false);
      expect(hasPermission(result, PermissionFlag.ASSIGN_ROLES)).toBe(true);
    });

    it('should handle removing non-existent permissions', () => {
      const permissions = PermissionFlag.MANAGE_USERS;
      const result = removePermissions(
        permissions,
        PermissionFlag.CREATE_PROJECTS,
        PermissionFlag.ASSIGN_ROLES
      );

      expect(result).toBe(permissions);
    });

    it('should handle empty permissions list', () => {
      const permissions = PermissionFlag.MANAGE_USERS | PermissionFlag.CREATE_PROJECTS;
      const result = removePermissions(permissions);

      expect(result).toBe(permissions);
    });
  });

  /**
   * Test Group 5: Toggle Permission
   */
  describe('togglePermission', () => {
    it('should add permission if not present', () => {
      const permissions = PermissionFlag.MANAGE_USERS;
      const result = togglePermission(permissions, PermissionFlag.CREATE_PROJECTS);

      expect(hasPermission(result, PermissionFlag.MANAGE_USERS)).toBe(true);
      expect(hasPermission(result, PermissionFlag.CREATE_PROJECTS)).toBe(true);
    });

    it('should remove permission if already present', () => {
      const permissions = PermissionFlag.MANAGE_USERS | PermissionFlag.CREATE_PROJECTS;
      const result = togglePermission(permissions, PermissionFlag.MANAGE_USERS);

      expect(hasPermission(result, PermissionFlag.MANAGE_USERS)).toBe(false);
      expect(hasPermission(result, PermissionFlag.CREATE_PROJECTS)).toBe(true);
    });

    it('should be reversible (toggle twice returns to original)', () => {
      const permissions = PermissionFlag.MANAGE_USERS;
      const toggled = togglePermission(permissions, PermissionFlag.CREATE_PROJECTS);
      const toggledBack = togglePermission(toggled, PermissionFlag.CREATE_PROJECTS);

      expect(toggledBack).toBe(permissions);
    });
  });

  /**
   * Test Group 6: Create Permissions
   */
  describe('createPermissions', () => {
    it('should create permissions from single flag', () => {
      const permissions = createPermissions(PermissionFlag.MANAGE_USERS);

      expect(hasPermission(permissions, PermissionFlag.MANAGE_USERS)).toBe(true);
      expect(hasPermission(permissions, PermissionFlag.CREATE_PROJECTS)).toBe(false);
    });

    it('should create permissions from multiple flags', () => {
      const permissions = createPermissions(
        PermissionFlag.MANAGE_USERS,
        PermissionFlag.CREATE_PROJECTS,
        PermissionFlag.ASSIGN_ROLES
      );

      expect(hasPermission(permissions, PermissionFlag.MANAGE_USERS)).toBe(true);
      expect(hasPermission(permissions, PermissionFlag.CREATE_PROJECTS)).toBe(true);
      expect(hasPermission(permissions, PermissionFlag.ASSIGN_ROLES)).toBe(true);
    });

    it('should return 0 for empty flags', () => {
      const permissions = createPermissions();

      expect(permissions).toBe(0);
    });

    it('should create correct numeric value', () => {
      const permissions = createPermissions(
        PermissionFlag.MANAGE_USERS, // 1
        PermissionFlag.ASSIGN_ROLES // 2
      );

      expect(permissions).toBe(3); // 1 | 2 = 3
    });
  });

  /**
   * Test Group 7: Get Granted Permissions
   */
  describe('getGrantedPermissions', () => {
    it('should return array of granted permissions', () => {
      const permissions = createPermissions(
        PermissionFlag.MANAGE_USERS,
        PermissionFlag.CREATE_PROJECTS
      );

      const granted = getGrantedPermissions(permissions);

      expect(granted).toContain(PermissionFlag.MANAGE_USERS);
      expect(granted).toContain(PermissionFlag.CREATE_PROJECTS);
      expect(granted.length).toBe(2);
    });

    it('should return empty array for zero permissions', () => {
      const granted = getGrantedPermissions(0);

      expect(granted).toEqual([]);
    });

    it('should return all permissions for SUPER_ADMIN', () => {
      const granted = getGrantedPermissions(RolePermissions.SUPER_ADMIN);

      expect(granted.length).toBeGreaterThan(10);
      expect(granted).toContain(PermissionFlag.MANAGE_USERS);
      expect(granted).toContain(PermissionFlag.CREATE_PROJECTS);
      expect(granted).toContain(PermissionFlag.APPROVE_TRANSACTIONS);
    });

    it('should return only granted permissions', () => {
      const permissions = PermissionFlag.MANAGE_USERS;
      const granted = getGrantedPermissions(permissions);

      expect(granted).toEqual([PermissionFlag.MANAGE_USERS]);
    });
  });

  /**
   * Test Group 8: Role Permissions
   */
  describe('RolePermissions', () => {
    it('should have permissions for SUPER_ADMIN', () => {
      expect(hasPermission(RolePermissions.SUPER_ADMIN, PermissionFlag.MANAGE_USERS)).toBe(true);
      expect(hasPermission(RolePermissions.SUPER_ADMIN, PermissionFlag.CREATE_PROJECTS)).toBe(true);
      expect(hasPermission(RolePermissions.SUPER_ADMIN, PermissionFlag.APPROVE_TRANSACTIONS)).toBe(
        true
      );
    });

    it('should have correct permissions for DIRECTOR', () => {
      expect(hasPermission(RolePermissions.DIRECTOR, PermissionFlag.VIEW_ALL_PROJECTS)).toBe(true);
      expect(hasPermission(RolePermissions.DIRECTOR, PermissionFlag.APPROVE_TRANSACTIONS)).toBe(
        true
      );
      expect(hasPermission(RolePermissions.DIRECTOR, PermissionFlag.MANAGE_USERS)).toBe(false);
    });

    it('should have correct permissions for PROJECT_MANAGER', () => {
      expect(hasPermission(RolePermissions.PROJECT_MANAGER, PermissionFlag.CREATE_PROJECTS)).toBe(
        true
      );
      expect(hasPermission(RolePermissions.PROJECT_MANAGER, PermissionFlag.CREATE_PR)).toBe(true);
      expect(hasPermission(RolePermissions.PROJECT_MANAGER, PermissionFlag.APPROVE_PO)).toBe(false);
    });

    it('should have correct permissions for PROCUREMENT_MANAGER', () => {
      expect(
        hasPermission(RolePermissions.PROCUREMENT_MANAGER, PermissionFlag.MANAGE_ENTITIES)
      ).toBe(true);
      expect(hasPermission(RolePermissions.PROCUREMENT_MANAGER, PermissionFlag.CREATE_PR)).toBe(
        true
      );
      expect(hasPermission(RolePermissions.PROCUREMENT_MANAGER, PermissionFlag.APPROVE_PO)).toBe(
        true
      );
      expect(
        hasPermission(RolePermissions.PROCUREMENT_MANAGER, PermissionFlag.CREATE_PROJECTS)
      ).toBe(false);
    });

    it('should have correct permissions for ACCOUNTANT', () => {
      expect(hasPermission(RolePermissions.ACCOUNTANT, PermissionFlag.CREATE_TRANSACTIONS)).toBe(
        true
      );
      expect(hasPermission(RolePermissions.ACCOUNTANT, PermissionFlag.VIEW_REPORTS)).toBe(true);
      expect(hasPermission(RolePermissions.ACCOUNTANT, PermissionFlag.APPROVE_TRANSACTIONS)).toBe(
        false
      );
    });

    it('should have correct permissions for FINANCE_MANAGER', () => {
      expect(
        hasPermission(RolePermissions.FINANCE_MANAGER, PermissionFlag.CREATE_TRANSACTIONS)
      ).toBe(true);
      expect(
        hasPermission(RolePermissions.FINANCE_MANAGER, PermissionFlag.APPROVE_TRANSACTIONS)
      ).toBe(true);
      expect(hasPermission(RolePermissions.FINANCE_MANAGER, PermissionFlag.VIEW_REPORTS)).toBe(
        true
      );
    });

    it('should have correct permissions for ENGINEER', () => {
      expect(hasPermission(RolePermissions.ENGINEER, PermissionFlag.CREATE_ESTIMATES)).toBe(true);
      expect(hasPermission(RolePermissions.ENGINEER, PermissionFlag.CREATE_PROJECTS)).toBe(false);
    });

    it('should have correct permissions for SITE_ENGINEER', () => {
      expect(hasPermission(RolePermissions.SITE_ENGINEER, PermissionFlag.CREATE_PR)).toBe(true);
      expect(hasPermission(RolePermissions.SITE_ENGINEER, PermissionFlag.APPROVE_PR)).toBe(false);
    });

    it('should have minimal permissions for TEAM_MEMBER', () => {
      expect(RolePermissions.TEAM_MEMBER).toBe(0);
    });

    it('should have view-only permissions for CLIENT_PM', () => {
      expect(hasPermission(RolePermissions.CLIENT_PM, PermissionFlag.VIEW_PROCUREMENT)).toBe(true);
      expect(hasPermission(RolePermissions.CLIENT_PM, PermissionFlag.VIEW_PROJECT_STATUS)).toBe(
        true
      );
      expect(hasPermission(RolePermissions.CLIENT_PM, PermissionFlag.VIEW_PAYMENT_STATUS)).toBe(
        true
      );
      expect(hasPermission(RolePermissions.CLIENT_PM, PermissionFlag.CREATE_PR)).toBe(false);
    });
  });

  /**
   * Test Group 9: Get Permissions for Role
   */
  describe('getPermissionsForRole', () => {
    it('should return permissions for valid role', () => {
      const permissions = getPermissionsForRole('SUPER_ADMIN');

      expect(permissions).toBe(RolePermissions.SUPER_ADMIN);
      expect(hasPermission(permissions, PermissionFlag.MANAGE_USERS)).toBe(true);
    });

    it('should return 0 for invalid role', () => {
      const permissions = getPermissionsForRole('INVALID_ROLE');

      expect(permissions).toBe(0);
    });

    it('should return correct permissions for all roles', () => {
      expect(getPermissionsForRole('DIRECTOR')).toBe(RolePermissions.DIRECTOR);
      expect(getPermissionsForRole('PROJECT_MANAGER')).toBe(RolePermissions.PROJECT_MANAGER);
      expect(getPermissionsForRole('ACCOUNTANT')).toBe(RolePermissions.ACCOUNTANT);
    });
  });

  describe('getPermissionsForRoles', () => {
    it('should combine permissions from multiple roles', () => {
      const permissions = getPermissionsForRoles(['ACCOUNTANT', 'ENGINEER']);

      // Should have ACCOUNTANT permissions
      expect(hasPermission(permissions, PermissionFlag.CREATE_TRANSACTIONS)).toBe(true);
      expect(hasPermission(permissions, PermissionFlag.VIEW_REPORTS)).toBe(true);

      // Should have ENGINEER permissions
      expect(hasPermission(permissions, PermissionFlag.CREATE_ESTIMATES)).toBe(true);
    });

    it('should return 0 for empty roles array', () => {
      const permissions = getPermissionsForRoles([]);

      expect(permissions).toBe(0);
    });

    it('should handle invalid roles gracefully', () => {
      const permissions = getPermissionsForRoles(['INVALID_ROLE', 'ACCOUNTANT']);

      expect(hasPermission(permissions, PermissionFlag.CREATE_TRANSACTIONS)).toBe(true);
    });

    it('should not duplicate permissions when combining roles', () => {
      const permissions = getPermissionsForRoles(['ACCOUNTANT', 'FINANCE_MANAGER']);

      // Both have CREATE_TRANSACTIONS and VIEW_REPORTS
      expect(hasPermission(permissions, PermissionFlag.CREATE_TRANSACTIONS)).toBe(true);
      expect(hasPermission(permissions, PermissionFlag.VIEW_REPORTS)).toBe(true);

      // FINANCE_MANAGER has APPROVE_TRANSACTIONS
      expect(hasPermission(permissions, PermissionFlag.APPROVE_TRANSACTIONS)).toBe(true);
    });
  });

  /**
   * Test Group 10: Permission Descriptions
   */
  describe('PermissionDescriptions', () => {
    it('should have description for each permission flag', () => {
      expect(PermissionDescriptions[PermissionFlag.MANAGE_USERS]).toBe('Manage users');
      expect(PermissionDescriptions[PermissionFlag.CREATE_PROJECTS]).toBe('Create projects');
      expect(PermissionDescriptions[PermissionFlag.APPROVE_TRANSACTIONS]).toBe(
        'Approve transactions'
      );
    });

    it('should have descriptions for all permission flags', () => {
      const allFlags = Object.values(PermissionFlag).filter(
        (v) => typeof v === 'number'
      ) as PermissionFlag[];

      for (const flag of allFlags) {
        expect(PermissionDescriptions[flag]).toBeDefined();
        expect(typeof PermissionDescriptions[flag]).toBe('string');
        expect(PermissionDescriptions[flag].length).toBeGreaterThan(0);
      }
    });

    it('should have unique descriptions', () => {
      const descriptions = Object.values(PermissionDescriptions);
      const uniqueDescriptions = new Set(descriptions);

      expect(descriptions.length).toBe(uniqueDescriptions.size);
    });
  });

  /**
   * Test Group 11: Complex Permission Scenarios
   */
  describe('Complex Scenarios', () => {
    it('should handle permission inheritance properly', () => {
      // Start with ACCOUNTANT, add APPROVE_TRANSACTIONS to become FINANCE_MANAGER-like
      const accountantPerms = RolePermissions.ACCOUNTANT;
      const financePerms = addPermission(accountantPerms, PermissionFlag.APPROVE_TRANSACTIONS);

      expect(hasPermission(financePerms, PermissionFlag.CREATE_TRANSACTIONS)).toBe(true);
      expect(hasPermission(financePerms, PermissionFlag.APPROVE_TRANSACTIONS)).toBe(true);
      expect(hasPermission(financePerms, PermissionFlag.VIEW_REPORTS)).toBe(true);
    });

    it('should handle permission revocation properly', () => {
      // Start with SUPER_ADMIN, remove sensitive permissions
      const superAdminPerms = RolePermissions.SUPER_ADMIN;
      const restrictedPerms = removePermissions(
        superAdminPerms,
        PermissionFlag.MANAGE_USERS,
        PermissionFlag.ASSIGN_ROLES
      );

      expect(hasPermission(restrictedPerms, PermissionFlag.MANAGE_USERS)).toBe(false);
      expect(hasPermission(restrictedPerms, PermissionFlag.ASSIGN_ROLES)).toBe(false);
      expect(hasPermission(restrictedPerms, PermissionFlag.CREATE_PROJECTS)).toBe(true);
    });

    it('should correctly identify permission overlaps', () => {
      const projectManagerPerms = RolePermissions.PROJECT_MANAGER;
      const procurementManagerPerms = RolePermissions.PROCUREMENT_MANAGER;

      // Both can CREATE_PR
      expect(hasPermission(projectManagerPerms, PermissionFlag.CREATE_PR)).toBe(true);
      expect(hasPermission(procurementManagerPerms, PermissionFlag.CREATE_PR)).toBe(true);

      // Only PROJECT_MANAGER can CREATE_PROJECTS
      expect(hasPermission(projectManagerPerms, PermissionFlag.CREATE_PROJECTS)).toBe(true);
      expect(hasPermission(procurementManagerPerms, PermissionFlag.CREATE_PROJECTS)).toBe(false);
    });

    it('should handle bitwise edge cases', () => {
      // Test with maximum safe integer
      const allPermissions = getPermissionsForRoles([
        'SUPER_ADMIN',
        'CLIENT_PM', // Add view permissions
      ]);

      expect(allPermissions).toBeGreaterThan(0);
      expect(hasPermission(allPermissions, PermissionFlag.MANAGE_USERS)).toBe(true);
      expect(hasPermission(allPermissions, PermissionFlag.VIEW_PROCUREMENT)).toBe(true);
    });

    it('should verify permission flag uniqueness', () => {
      const allFlags = Object.values(PermissionFlag).filter(
        (v) => typeof v === 'number'
      ) as number[];
      const uniqueFlags = new Set(allFlags);

      expect(allFlags.length).toBe(uniqueFlags.size);
    });

    it('should verify all flags are powers of 2', () => {
      const allFlags = Object.values(PermissionFlag).filter(
        (v) => typeof v === 'number'
      ) as number[];

      for (const flag of allFlags) {
        // A number is a power of 2 if (n & (n-1)) === 0
        expect(flag & (flag - 1)).toBe(0);
      }
    });
  });
});
