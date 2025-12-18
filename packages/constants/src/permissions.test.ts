import {
  PERMISSION_FLAGS,
  PERMISSION_BITS,
  hasPermission,
  canViewProjects,
  canManageProjects,
} from './permissions';

describe('Permissions Constants', () => {
  describe('PERMISSION_FLAGS', () => {
    it('should have distinct bit values', () => {
      const values = Object.values(PERMISSION_FLAGS);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });

    it('should be powers of 2', () => {
      Object.values(PERMISSION_FLAGS).forEach((flag) => {
        expect(Math.log2(flag) % 1).toBe(0);
      });
    });
  });

  describe('PERMISSION_BITS', () => {
    it('should match PERMISSION_FLAGS indices', () => {
      // PERMISSION_BITS values are 2^index, same as FLAGS.
      // Wait, looking at the source code, PERMISSION_BITS seem to have the same values as random flags?
      // Let's re-read the source code carefully.
      // Ah, in source: MANAGE_USERS: 1 << 0 which is 1.
      // PERMISSION_BITS: MANAGE_USERS: 1.
      // READ_USERS: 1 << 1 which is 2.
      // PERMISSION_BITS: VIEW_USERS: 2.
      // They seem identical in value.
      // The comment says "Used with modulo arithmetic: floor(permissions / permissionBit) % 2 == 1"
      // If permissionBit is the flag value (e.g. 4), then floor(x / 4) % 2 checks the 3rd bit (bit index 2). Correct.
      expect(PERMISSION_BITS.MANAGE_USERS).toBe(PERMISSION_FLAGS.MANAGE_USERS);
      expect(PERMISSION_BITS.VIEW_PROJECTS).toBe(PERMISSION_FLAGS.VIEW_PROJECTS);
    });
  });

  describe('Helper Functions', () => {
    const VIEW_PROJ = PERMISSION_FLAGS.VIEW_PROJECTS; // 16
    const MANAGE_PROJ = PERMISSION_FLAGS.MANAGE_PROJECTS; // 8

    it('hasPermission should correctly identify flags', () => {
      const userPerms = VIEW_PROJ | MANAGE_PROJ; // 24

      expect(hasPermission(userPerms, VIEW_PROJ)).toBe(true);
      expect(hasPermission(userPerms, MANAGE_PROJ)).toBe(true);
      expect(hasPermission(userPerms, PERMISSION_FLAGS.MANAGE_USERS)).toBe(false);
    });

    it('canViewProjects should work', () => {
      expect(canViewProjects(VIEW_PROJ)).toBe(true);
      expect(canViewProjects(0)).toBe(false);
    });

    it('canManageProjects should work', () => {
      expect(canManageProjects(MANAGE_PROJ)).toBe(true);
      expect(canManageProjects(0)).toBe(false);
    });
  });
});
