import {
  PERMISSION_FLAGS,
  PERMISSION_FLAGS_2,
  PERMISSION_BITS,
  PERMISSION_BITS_2,
  PERMISSION_PRESETS,
  ALL_PERMISSIONS,
  MODULE_PERMISSIONS,
  RESTRICTED_MODULES,
  hasPermission,
  hasPermission2,
  getAllPermissions,
  getAllPermissions2,
  canViewProjects,
  canManageProjects,
  canViewEntities,
  canCreateEntities,
  canEditEntities,
  canDeleteEntities,
  canViewAccounting,
  canManageAccounting,
  canViewProposals,
  canManageProposals,
  canViewProcurement,
  canManageProcurement,
  canViewEstimation,
  canManageEstimation,
  canViewTimeTracking,
  canManageTimeTracking,
  canManageDocuments,
  canSubmitDocuments,
  canReviewDocuments,
  canApproveDocuments,
  canViewMaterialDB,
  canManageMaterialDB,
  canViewShapeDB,
  canManageShapeDB,
  canViewBoughtOutDB,
  canManageBoughtOutDB,
  canViewThermalDesal,
  canManageThermalDesal,
  canViewThermalCalcs,
  canManageThermalCalcs,
  canViewSSOT,
  canManageSSOT,
  canViewHR,
  canManageHRSettings,
  canApproveLeaves,
  canManageHRProfiles,
  getApprovalPermissions,
  getPermissionModuleById,
  hasModulePermission,
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

    it('should have correct bit positions', () => {
      expect(PERMISSION_FLAGS.MANAGE_USERS).toBe(1); // 2^0
      expect(PERMISSION_FLAGS.VIEW_USERS).toBe(2); // 2^1
      expect(PERMISSION_FLAGS.MANAGE_ROLES).toBe(4); // 2^2 (deprecated)
      expect(PERMISSION_FLAGS.MANAGE_PROJECTS).toBe(8); // 2^3
      expect(PERMISSION_FLAGS.VIEW_PROJECTS).toBe(16); // 2^4
      expect(PERMISSION_FLAGS.VIEW_ENTITIES).toBe(32); // 2^5
      expect(PERMISSION_FLAGS.CREATE_ENTITIES).toBe(64); // 2^6
      expect(PERMISSION_FLAGS.EDIT_ENTITIES).toBe(128); // 2^7
      expect(PERMISSION_FLAGS.DELETE_ENTITIES).toBe(256); // 2^8
    });

    it('should not use bit 31 (sign bit)', () => {
      Object.values(PERMISSION_FLAGS).forEach((flag) => {
        expect(flag).toBeLessThan(2 ** 31);
      });
    });
  });

  describe('PERMISSION_FLAGS_2', () => {
    it('should have distinct bit values', () => {
      const values = Object.values(PERMISSION_FLAGS_2);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });

    it('should be powers of 2', () => {
      Object.values(PERMISSION_FLAGS_2).forEach((flag) => {
        expect(Math.log2(flag) % 1).toBe(0);
      });
    });

    it('should have correct bit positions', () => {
      expect(PERMISSION_FLAGS_2.VIEW_MATERIAL_DB).toBe(1); // 2^0
      expect(PERMISSION_FLAGS_2.MANAGE_MATERIAL_DB).toBe(2); // 2^1
      expect(PERMISSION_FLAGS_2.VIEW_SHAPE_DB).toBe(4); // 2^2
      expect(PERMISSION_FLAGS_2.MANAGE_SHAPE_DB).toBe(8); // 2^3
      expect(PERMISSION_FLAGS_2.VIEW_BOUGHT_OUT_DB).toBe(16); // 2^4
      expect(PERMISSION_FLAGS_2.MANAGE_BOUGHT_OUT_DB).toBe(32); // 2^5
      expect(PERMISSION_FLAGS_2.VIEW_HR).toBe(4096); // 2^12
      expect(PERMISSION_FLAGS_2.APPROVE_LEAVES).toBe(16384); // 2^14
    });
  });

  describe('PERMISSION_BITS', () => {
    it('should match PERMISSION_FLAGS values', () => {
      expect(PERMISSION_BITS.MANAGE_USERS).toBe(PERMISSION_FLAGS.MANAGE_USERS);
      expect(PERMISSION_BITS.VIEW_PROJECTS).toBe(PERMISSION_FLAGS.VIEW_PROJECTS);
      expect(PERMISSION_BITS.MANAGE_PROCUREMENT).toBe(PERMISSION_FLAGS.MANAGE_PROCUREMENT);
      expect(PERMISSION_BITS.VIEW_ACCOUNTING).toBe(PERMISSION_FLAGS.VIEW_ACCOUNTING);
    });
  });

  describe('PERMISSION_BITS_2', () => {
    it('should match PERMISSION_FLAGS_2 values', () => {
      expect(PERMISSION_BITS_2.VIEW_MATERIAL_DB).toBe(PERMISSION_FLAGS_2.VIEW_MATERIAL_DB);
      expect(PERMISSION_BITS_2.MANAGE_HR_SETTINGS).toBe(PERMISSION_FLAGS_2.MANAGE_HR_SETTINGS);
      expect(PERMISSION_BITS_2.APPROVE_LEAVES).toBe(PERMISSION_FLAGS_2.APPROVE_LEAVES);
    });
  });
});

describe('Permission Helper Functions', () => {
  describe('hasPermission', () => {
    it('should correctly identify single flags', () => {
      const userPerms = PERMISSION_FLAGS.VIEW_PROJECTS | PERMISSION_FLAGS.MANAGE_PROJECTS;

      expect(hasPermission(userPerms, PERMISSION_FLAGS.VIEW_PROJECTS)).toBe(true);
      expect(hasPermission(userPerms, PERMISSION_FLAGS.MANAGE_PROJECTS)).toBe(true);
      expect(hasPermission(userPerms, PERMISSION_FLAGS.MANAGE_USERS)).toBe(false);
    });

    it('should return false for zero permissions', () => {
      expect(hasPermission(0, PERMISSION_FLAGS.VIEW_PROJECTS)).toBe(false);
    });

    it('should work with combined permission checks', () => {
      const userPerms =
        PERMISSION_FLAGS.VIEW_PROJECTS |
        PERMISSION_FLAGS.MANAGE_PROJECTS |
        PERMISSION_FLAGS.VIEW_ENTITIES;

      // Check for combined permissions
      const required = PERMISSION_FLAGS.VIEW_PROJECTS | PERMISSION_FLAGS.MANAGE_PROJECTS;
      expect(hasPermission(userPerms, required)).toBe(true);
    });

    it('should return false when missing any required permission', () => {
      const userPerms = PERMISSION_FLAGS.VIEW_PROJECTS;
      const required = PERMISSION_FLAGS.VIEW_PROJECTS | PERMISSION_FLAGS.MANAGE_PROJECTS;
      expect(hasPermission(userPerms, required)).toBe(false);
    });
  });

  describe('hasPermission2', () => {
    it('should correctly identify single flags', () => {
      const userPerms2 = PERMISSION_FLAGS_2.VIEW_HR | PERMISSION_FLAGS_2.APPROVE_LEAVES;

      expect(hasPermission2(userPerms2, PERMISSION_FLAGS_2.VIEW_HR)).toBe(true);
      expect(hasPermission2(userPerms2, PERMISSION_FLAGS_2.APPROVE_LEAVES)).toBe(true);
      expect(hasPermission2(userPerms2, PERMISSION_FLAGS_2.MANAGE_HR_SETTINGS)).toBe(false);
    });

    it('should return false for zero permissions', () => {
      expect(hasPermission2(0, PERMISSION_FLAGS_2.VIEW_HR)).toBe(false);
    });
  });

  describe('getAllPermissions', () => {
    it('should return OR of all flags', () => {
      const all = getAllPermissions();
      expect(typeof all).toBe('number');
      expect(all).toBeGreaterThan(0);

      // Should have all individual flags
      expect(hasPermission(all, PERMISSION_FLAGS.MANAGE_USERS)).toBe(true);
      expect(hasPermission(all, PERMISSION_FLAGS.VIEW_PROJECTS)).toBe(true);
      expect(hasPermission(all, PERMISSION_FLAGS.MANAGE_ACCOUNTING)).toBe(true);
      expect(hasPermission(all, PERMISSION_FLAGS.APPROVE_DOCUMENTS)).toBe(true);
    });
  });

  describe('getAllPermissions2', () => {
    it('should return OR of all flags2', () => {
      const all2 = getAllPermissions2();
      expect(typeof all2).toBe('number');
      expect(all2).toBeGreaterThan(0);

      // Should have all individual flags
      expect(hasPermission2(all2, PERMISSION_FLAGS_2.VIEW_MATERIAL_DB)).toBe(true);
      expect(hasPermission2(all2, PERMISSION_FLAGS_2.MANAGE_HR_PROFILES)).toBe(true);
      expect(hasPermission2(all2, PERMISSION_FLAGS_2.VIEW_SSOT)).toBe(true);
    });
  });
});

describe('Project Permission Helpers', () => {
  it('canViewProjects should work', () => {
    expect(canViewProjects(PERMISSION_FLAGS.VIEW_PROJECTS)).toBe(true);
    expect(canViewProjects(0)).toBe(false);
    expect(canViewProjects(PERMISSION_FLAGS.MANAGE_PROJECTS)).toBe(false);
  });

  it('canManageProjects should work', () => {
    expect(canManageProjects(PERMISSION_FLAGS.MANAGE_PROJECTS)).toBe(true);
    expect(canManageProjects(0)).toBe(false);
    expect(canManageProjects(PERMISSION_FLAGS.VIEW_PROJECTS)).toBe(false);
  });
});

describe('Entity Permission Helpers', () => {
  it('canViewEntities should work', () => {
    expect(canViewEntities(PERMISSION_FLAGS.VIEW_ENTITIES)).toBe(true);
    expect(canViewEntities(0)).toBe(false);
  });

  it('canCreateEntities should work', () => {
    expect(canCreateEntities(PERMISSION_FLAGS.CREATE_ENTITIES)).toBe(true);
    expect(canCreateEntities(0)).toBe(false);
  });

  it('canEditEntities should work', () => {
    expect(canEditEntities(PERMISSION_FLAGS.EDIT_ENTITIES)).toBe(true);
    expect(canEditEntities(0)).toBe(false);
  });

  it('canDeleteEntities should work', () => {
    expect(canDeleteEntities(PERMISSION_FLAGS.DELETE_ENTITIES)).toBe(true);
    expect(canDeleteEntities(0)).toBe(false);
  });
});

describe('Accounting Permission Helpers', () => {
  it('canViewAccounting should work', () => {
    expect(canViewAccounting(PERMISSION_FLAGS.VIEW_ACCOUNTING)).toBe(true);
    expect(canViewAccounting(0)).toBe(false);
  });

  it('canManageAccounting should work', () => {
    expect(canManageAccounting(PERMISSION_FLAGS.MANAGE_ACCOUNTING)).toBe(true);
    expect(canManageAccounting(0)).toBe(false);
  });
});

describe('Proposal Permission Helpers', () => {
  it('canViewProposals should work', () => {
    expect(canViewProposals(PERMISSION_FLAGS.VIEW_PROPOSALS)).toBe(true);
    expect(canViewProposals(0)).toBe(false);
  });

  it('canManageProposals should work', () => {
    expect(canManageProposals(PERMISSION_FLAGS.MANAGE_PROPOSALS)).toBe(true);
    expect(canManageProposals(0)).toBe(false);
  });
});

describe('Procurement Permission Helpers', () => {
  it('canViewProcurement should work', () => {
    expect(canViewProcurement(PERMISSION_FLAGS.VIEW_PROCUREMENT)).toBe(true);
    expect(canViewProcurement(0)).toBe(false);
  });

  it('canManageProcurement should work', () => {
    expect(canManageProcurement(PERMISSION_FLAGS.MANAGE_PROCUREMENT)).toBe(true);
    expect(canManageProcurement(0)).toBe(false);
  });
});

describe('Estimation Permission Helpers', () => {
  it('canViewEstimation should work', () => {
    expect(canViewEstimation(PERMISSION_FLAGS.VIEW_ESTIMATION)).toBe(true);
    expect(canViewEstimation(0)).toBe(false);
  });

  it('canManageEstimation should work', () => {
    expect(canManageEstimation(PERMISSION_FLAGS.MANAGE_ESTIMATION)).toBe(true);
    expect(canManageEstimation(0)).toBe(false);
  });
});

describe('Time Tracking Permission Helpers', () => {
  it('canViewTimeTracking should work', () => {
    expect(canViewTimeTracking(PERMISSION_FLAGS.VIEW_TIME_TRACKING)).toBe(true);
    expect(canViewTimeTracking(0)).toBe(false);
  });

  it('canManageTimeTracking should work', () => {
    expect(canManageTimeTracking(PERMISSION_FLAGS.MANAGE_TIME_TRACKING)).toBe(true);
    expect(canManageTimeTracking(0)).toBe(false);
  });
});

describe('Document Permission Helpers', () => {
  it('canManageDocuments should work', () => {
    expect(canManageDocuments(PERMISSION_FLAGS.MANAGE_DOCUMENTS)).toBe(true);
    expect(canManageDocuments(0)).toBe(false);
  });

  it('canSubmitDocuments should work', () => {
    expect(canSubmitDocuments(PERMISSION_FLAGS.SUBMIT_DOCUMENTS)).toBe(true);
    expect(canSubmitDocuments(0)).toBe(false);
  });

  it('canReviewDocuments should work', () => {
    expect(canReviewDocuments(PERMISSION_FLAGS.REVIEW_DOCUMENTS)).toBe(true);
    expect(canReviewDocuments(0)).toBe(false);
  });

  it('canApproveDocuments should work', () => {
    expect(canApproveDocuments(PERMISSION_FLAGS.APPROVE_DOCUMENTS)).toBe(true);
    expect(canApproveDocuments(0)).toBe(false);
  });
});

describe('permissions2 Helper Functions', () => {
  describe('Material Database', () => {
    it('canViewMaterialDB should work', () => {
      expect(canViewMaterialDB(PERMISSION_FLAGS_2.VIEW_MATERIAL_DB)).toBe(true);
      expect(canViewMaterialDB(0)).toBe(false);
    });

    it('canManageMaterialDB should work', () => {
      expect(canManageMaterialDB(PERMISSION_FLAGS_2.MANAGE_MATERIAL_DB)).toBe(true);
      expect(canManageMaterialDB(0)).toBe(false);
    });
  });

  describe('Shape Database', () => {
    it('canViewShapeDB should work', () => {
      expect(canViewShapeDB(PERMISSION_FLAGS_2.VIEW_SHAPE_DB)).toBe(true);
      expect(canViewShapeDB(0)).toBe(false);
    });

    it('canManageShapeDB should work', () => {
      expect(canManageShapeDB(PERMISSION_FLAGS_2.MANAGE_SHAPE_DB)).toBe(true);
      expect(canManageShapeDB(0)).toBe(false);
    });
  });

  describe('Bought Out Database', () => {
    it('canViewBoughtOutDB should work', () => {
      expect(canViewBoughtOutDB(PERMISSION_FLAGS_2.VIEW_BOUGHT_OUT_DB)).toBe(true);
      expect(canViewBoughtOutDB(0)).toBe(false);
    });

    it('canManageBoughtOutDB should work', () => {
      expect(canManageBoughtOutDB(PERMISSION_FLAGS_2.MANAGE_BOUGHT_OUT_DB)).toBe(true);
      expect(canManageBoughtOutDB(0)).toBe(false);
    });
  });

  describe('Thermal Desalination', () => {
    it('canViewThermalDesal should work', () => {
      expect(canViewThermalDesal(PERMISSION_FLAGS_2.VIEW_THERMAL_DESAL)).toBe(true);
      expect(canViewThermalDesal(0)).toBe(false);
    });

    it('canManageThermalDesal should work', () => {
      expect(canManageThermalDesal(PERMISSION_FLAGS_2.MANAGE_THERMAL_DESAL)).toBe(true);
      expect(canManageThermalDesal(0)).toBe(false);
    });
  });

  describe('Thermal Calculators', () => {
    it('canViewThermalCalcs should work', () => {
      expect(canViewThermalCalcs(PERMISSION_FLAGS_2.VIEW_THERMAL_CALCS)).toBe(true);
      expect(canViewThermalCalcs(0)).toBe(false);
    });

    it('canManageThermalCalcs should work', () => {
      expect(canManageThermalCalcs(PERMISSION_FLAGS_2.MANAGE_THERMAL_CALCS)).toBe(true);
      expect(canManageThermalCalcs(0)).toBe(false);
    });
  });

  describe('SSOT / Process Data', () => {
    it('canViewSSOT should work', () => {
      expect(canViewSSOT(PERMISSION_FLAGS_2.VIEW_SSOT)).toBe(true);
      expect(canViewSSOT(0)).toBe(false);
    });

    it('canManageSSOT should work', () => {
      expect(canManageSSOT(PERMISSION_FLAGS_2.MANAGE_SSOT)).toBe(true);
      expect(canManageSSOT(0)).toBe(false);
    });
  });

  describe('HR Module', () => {
    it('canViewHR should work', () => {
      expect(canViewHR(PERMISSION_FLAGS_2.VIEW_HR)).toBe(true);
      expect(canViewHR(0)).toBe(false);
    });

    it('canManageHRSettings should work', () => {
      expect(canManageHRSettings(PERMISSION_FLAGS_2.MANAGE_HR_SETTINGS)).toBe(true);
      expect(canManageHRSettings(0)).toBe(false);
    });

    it('canApproveLeaves should work', () => {
      expect(canApproveLeaves(PERMISSION_FLAGS_2.APPROVE_LEAVES)).toBe(true);
      expect(canApproveLeaves(0)).toBe(false);
    });

    it('canManageHRProfiles should work', () => {
      expect(canManageHRProfiles(PERMISSION_FLAGS_2.MANAGE_HR_PROFILES)).toBe(true);
      expect(canManageHRProfiles(0)).toBe(false);
    });
  });
});

describe('Permission Presets', () => {
  describe('FULL_ACCESS', () => {
    it('should include all basic permissions', () => {
      const fullAccess = PERMISSION_PRESETS.FULL_ACCESS;
      expect(hasPermission(fullAccess, PERMISSION_FLAGS.MANAGE_USERS)).toBe(true);
      expect(hasPermission(fullAccess, PERMISSION_FLAGS.VIEW_PROJECTS)).toBe(true);
      expect(hasPermission(fullAccess, PERMISSION_FLAGS.MANAGE_ACCOUNTING)).toBe(true);
      expect(hasPermission(fullAccess, PERMISSION_FLAGS.APPROVE_DOCUMENTS)).toBe(true);
    });
  });

  describe('MANAGER', () => {
    it('should include project and entity access', () => {
      const manager = PERMISSION_PRESETS.MANAGER;
      expect(hasPermission(manager, PERMISSION_FLAGS.MANAGE_PROJECTS)).toBe(true);
      expect(hasPermission(manager, PERMISSION_FLAGS.VIEW_PROJECTS)).toBe(true);
      expect(hasPermission(manager, PERMISSION_FLAGS.VIEW_ENTITIES)).toBe(true);
      expect(hasPermission(manager, PERMISSION_FLAGS.CREATE_ENTITIES)).toBe(true);
    });

    it('should not include system admin permissions', () => {
      const manager = PERMISSION_PRESETS.MANAGER;
      expect(hasPermission(manager, PERMISSION_FLAGS.MANAGE_USERS)).toBe(false);
      expect(hasPermission(manager, PERMISSION_FLAGS.MANAGE_COMPANY_SETTINGS)).toBe(false);
    });
  });

  describe('FINANCE', () => {
    it('should include accounting permissions', () => {
      const finance = PERMISSION_PRESETS.FINANCE;
      expect(hasPermission(finance, PERMISSION_FLAGS.MANAGE_ACCOUNTING)).toBe(true);
      expect(hasPermission(finance, PERMISSION_FLAGS.VIEW_ACCOUNTING)).toBe(true);
      expect(hasPermission(finance, PERMISSION_FLAGS.VIEW_ANALYTICS)).toBe(true);
      expect(hasPermission(finance, PERMISSION_FLAGS.EXPORT_DATA)).toBe(true);
    });

    it('should not include project management', () => {
      const finance = PERMISSION_PRESETS.FINANCE;
      expect(hasPermission(finance, PERMISSION_FLAGS.MANAGE_PROJECTS)).toBe(false);
    });
  });

  describe('ENGINEERING', () => {
    it('should include estimation permissions', () => {
      const engineering = PERMISSION_PRESETS.ENGINEERING;
      expect(hasPermission(engineering, PERMISSION_FLAGS.MANAGE_ESTIMATION)).toBe(true);
      expect(hasPermission(engineering, PERMISSION_FLAGS.VIEW_ESTIMATION)).toBe(true);
      expect(hasPermission(engineering, PERMISSION_FLAGS.SUBMIT_DOCUMENTS)).toBe(true);
    });

    it('should have view access to related modules', () => {
      const engineering = PERMISSION_PRESETS.ENGINEERING;
      expect(hasPermission(engineering, PERMISSION_FLAGS.VIEW_PROJECTS)).toBe(true);
      expect(hasPermission(engineering, PERMISSION_FLAGS.VIEW_ENTITIES)).toBe(true);
      expect(hasPermission(engineering, PERMISSION_FLAGS.VIEW_PROCUREMENT)).toBe(true);
    });
  });

  describe('PROJECT_MANAGER', () => {
    it('should include project and document management', () => {
      const pm = PERMISSION_PRESETS.PROJECT_MANAGER;
      expect(hasPermission(pm, PERMISSION_FLAGS.MANAGE_PROJECTS)).toBe(true);
      expect(hasPermission(pm, PERMISSION_FLAGS.MANAGE_DOCUMENTS)).toBe(true);
      expect(hasPermission(pm, PERMISSION_FLAGS.APPROVE_DOCUMENTS)).toBe(true);
    });
  });

  describe('PROCUREMENT', () => {
    it('should include procurement and entity permissions', () => {
      const procurement = PERMISSION_PRESETS.PROCUREMENT;
      expect(hasPermission(procurement, PERMISSION_FLAGS.MANAGE_PROCUREMENT)).toBe(true);
      expect(hasPermission(procurement, PERMISSION_FLAGS.VIEW_PROCUREMENT)).toBe(true);
      expect(hasPermission(procurement, PERMISSION_FLAGS.VIEW_ENTITIES)).toBe(true);
      expect(hasPermission(procurement, PERMISSION_FLAGS.CREATE_ENTITIES)).toBe(true);
      expect(hasPermission(procurement, PERMISSION_FLAGS.EDIT_ENTITIES)).toBe(true);
    });
  });

  describe('VIEWER', () => {
    it('should have only view permissions', () => {
      const viewer = PERMISSION_PRESETS.VIEWER;
      expect(hasPermission(viewer, PERMISSION_FLAGS.VIEW_PROJECTS)).toBe(true);
      expect(hasPermission(viewer, PERMISSION_FLAGS.VIEW_ENTITIES)).toBe(true);
      expect(hasPermission(viewer, PERMISSION_FLAGS.VIEW_ACCOUNTING)).toBe(true);
      expect(hasPermission(viewer, PERMISSION_FLAGS.VIEW_PROCUREMENT)).toBe(true);
      expect(hasPermission(viewer, PERMISSION_FLAGS.VIEW_ESTIMATION)).toBe(true);
    });

    it('should not have any manage permissions', () => {
      const viewer = PERMISSION_PRESETS.VIEWER;
      expect(hasPermission(viewer, PERMISSION_FLAGS.MANAGE_PROJECTS)).toBe(false);
      expect(hasPermission(viewer, PERMISSION_FLAGS.MANAGE_ACCOUNTING)).toBe(false);
      expect(hasPermission(viewer, PERMISSION_FLAGS.MANAGE_PROCUREMENT)).toBe(false);
      expect(hasPermission(viewer, PERMISSION_FLAGS.MANAGE_USERS)).toBe(false);
    });
  });
});

describe('ALL_PERMISSIONS Configuration', () => {
  it('should have all permissions defined', () => {
    expect(ALL_PERMISSIONS.length).toBeGreaterThan(20);
  });

  it('should have required fields for each permission', () => {
    ALL_PERMISSIONS.forEach((perm) => {
      expect(perm.flag).toBeDefined();
      expect(typeof perm.flag).toBe('number');
      expect(perm.label).toBeDefined();
      expect(perm.label.length).toBeGreaterThan(0);
      expect(perm.description).toBeDefined();
      expect(perm.field).toMatch(/^permissions2?$/);
      expect(typeof perm.adminOnly).toBe('boolean');
    });
  });

  it('should separate regular and admin permissions', () => {
    const regularPerms = ALL_PERMISSIONS.filter((p) => !p.adminOnly);
    const adminPerms = ALL_PERMISSIONS.filter((p) => p.adminOnly);

    expect(regularPerms.length).toBeGreaterThan(0);
    expect(adminPerms.length).toBeGreaterThan(0);
  });

  it('should have unique labels', () => {
    const labels = ALL_PERMISSIONS.map((p) => p.label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });

  it('admin permissions should include MANAGE_USERS', () => {
    const manageUsers = ALL_PERMISSIONS.find((p) => p.flag === PERMISSION_FLAGS.MANAGE_USERS);
    expect(manageUsers).toBeDefined();
    expect(manageUsers?.adminOnly).toBe(true);
  });
});

describe('MODULE_PERMISSIONS Configuration', () => {
  it('should have all core modules defined', () => {
    const moduleIds = MODULE_PERMISSIONS.map((m) => m.id);
    expect(moduleIds).toContain('projects');
    expect(moduleIds).toContain('procurement');
    expect(moduleIds).toContain('accounting');
    expect(moduleIds).toContain('estimation');
    expect(moduleIds).toContain('documents');
    expect(moduleIds).toContain('hr');
  });

  it('should have required fields for each module', () => {
    MODULE_PERMISSIONS.forEach((module) => {
      expect(module.id).toBeDefined();
      expect(module.name).toBeDefined();
      expect(module.description).toBeDefined();
      expect(Array.isArray(module.permissions)).toBe(true);
      expect(module.permissions.length).toBeGreaterThan(0);
    });
  });

  it('should have valid permissions for each module', () => {
    MODULE_PERMISSIONS.forEach((module) => {
      module.permissions.forEach((perm) => {
        expect(perm.flag).toBeDefined();
        expect(typeof perm.flag).toBe('number');
        expect(perm.label).toBeDefined();
        expect(perm.description).toBeDefined();
        expect(['view', 'manage', 'approve', 'action']).toContain(perm.category);
      });
    });
  });
});

describe('RESTRICTED_MODULES Configuration', () => {
  it('should have core restricted modules', () => {
    const moduleIds = RESTRICTED_MODULES.map((m) => m.id);
    expect(moduleIds).toContain('projects');
    expect(moduleIds).toContain('procurement');
    expect(moduleIds).toContain('accounting');
  });

  it('should have valid viewFlag and manageFlag', () => {
    RESTRICTED_MODULES.forEach((module) => {
      expect(typeof module.viewFlag).toBe('number');
      expect(typeof module.manageFlag).toBe('number');
      expect(module.viewFlag).toBeGreaterThan(0);
      expect(module.manageFlag).toBeGreaterThan(0);
    });
  });

  it('should correctly specify field for permissions2 modules', () => {
    const thermal = RESTRICTED_MODULES.find((m) => m.id === 'thermal-desal');
    expect(thermal?.field).toBe('permissions2');

    const processData = RESTRICTED_MODULES.find((m) => m.id === 'process-data');
    expect(processData?.field).toBe('permissions2');
  });
});

describe('getApprovalPermissions', () => {
  it('should return approval permissions', () => {
    const approvals = getApprovalPermissions();
    expect(approvals.length).toBeGreaterThan(0);
  });

  it('should only include approve category', () => {
    const approvals = getApprovalPermissions();
    approvals.forEach((a) => {
      expect(a.permission.category).toBe('approve');
    });
  });

  it('should include document approval', () => {
    const approvals = getApprovalPermissions();
    const docApproval = approvals.find((a) => a.moduleId === 'documents');
    expect(docApproval).toBeDefined();
    expect(docApproval?.permission.flag).toBe(PERMISSION_FLAGS.APPROVE_DOCUMENTS);
  });

  it('should include leave approval', () => {
    const approvals = getApprovalPermissions();
    const leaveApproval = approvals.find((a) => a.moduleId === 'hr');
    expect(leaveApproval).toBeDefined();
    expect(leaveApproval?.permission.flag).toBe(PERMISSION_FLAGS_2.APPROVE_LEAVES);
  });
});

describe('getPermissionModuleById', () => {
  it('should find existing module', () => {
    const projects = getPermissionModuleById('projects');
    expect(projects).toBeDefined();
    expect(projects?.name).toBe('Projects');
  });

  it('should return undefined for non-existent module', () => {
    const unknown = getPermissionModuleById('non-existent');
    expect(unknown).toBeUndefined();
  });
});

describe('hasModulePermission', () => {
  it('should check permissions field correctly', () => {
    const perms = PERMISSION_FLAGS.VIEW_PROJECTS | PERMISSION_FLAGS.MANAGE_PROJECTS;
    const perms2 = 0;

    expect(hasModulePermission(perms, perms2, 'projects', 'View')).toBe(true);
    expect(hasModulePermission(perms, perms2, 'projects', 'Manage')).toBe(true);
    expect(hasModulePermission(0, perms2, 'projects', 'View')).toBe(false);
  });

  it('should check permissions2 field correctly', () => {
    const perms = 0;
    const perms2 = PERMISSION_FLAGS_2.VIEW_HR | PERMISSION_FLAGS_2.APPROVE_LEAVES;

    expect(hasModulePermission(perms, perms2, 'hr', 'View')).toBe(true);
    expect(hasModulePermission(perms, perms2, 'hr', 'Approve Leaves')).toBe(true);
    expect(hasModulePermission(perms, 0, 'hr', 'View')).toBe(false);
  });

  it('should return false for non-existent module', () => {
    expect(hasModulePermission(PERMISSION_FLAGS.VIEW_PROJECTS, 0, 'fake-module', 'View')).toBe(
      false
    );
  });

  it('should return false for non-existent permission in module', () => {
    expect(hasModulePermission(PERMISSION_FLAGS.VIEW_PROJECTS, 0, 'projects', 'Delete')).toBe(
      false
    );
  });
});

describe('Bitwise Operations Edge Cases', () => {
  it('should handle combined permissions correctly', () => {
    const combined =
      PERMISSION_FLAGS.VIEW_PROJECTS |
      PERMISSION_FLAGS.MANAGE_PROJECTS |
      PERMISSION_FLAGS.VIEW_ENTITIES |
      PERMISSION_FLAGS.CREATE_ENTITIES;

    // Should have all combined
    expect(hasPermission(combined, PERMISSION_FLAGS.VIEW_PROJECTS)).toBe(true);
    expect(hasPermission(combined, PERMISSION_FLAGS.MANAGE_PROJECTS)).toBe(true);
    expect(hasPermission(combined, PERMISSION_FLAGS.VIEW_ENTITIES)).toBe(true);
    expect(hasPermission(combined, PERMISSION_FLAGS.CREATE_ENTITIES)).toBe(true);

    // Should not have unset permissions
    expect(hasPermission(combined, PERMISSION_FLAGS.MANAGE_USERS)).toBe(false);
    expect(hasPermission(combined, PERMISSION_FLAGS.DELETE_ENTITIES)).toBe(false);
  });

  it('should handle large combined values', () => {
    const all = getAllPermissions();
    const all2 = getAllPermissions2();

    // Should be able to check any permission
    expect(hasPermission(all, PERMISSION_FLAGS.APPROVE_DOCUMENTS)).toBe(true);
    expect(hasPermission2(all2, PERMISSION_FLAGS_2.MANAGE_HR_PROFILES)).toBe(true);
  });

  it('should correctly remove permissions', () => {
    let perms = PERMISSION_FLAGS.VIEW_PROJECTS | PERMISSION_FLAGS.MANAGE_PROJECTS;

    // Remove MANAGE_PROJECTS
    perms = perms & ~PERMISSION_FLAGS.MANAGE_PROJECTS;

    expect(hasPermission(perms, PERMISSION_FLAGS.VIEW_PROJECTS)).toBe(true);
    expect(hasPermission(perms, PERMISSION_FLAGS.MANAGE_PROJECTS)).toBe(false);
  });

  it('should correctly add permissions', () => {
    let perms = PERMISSION_FLAGS.VIEW_PROJECTS;

    // Add MANAGE_PROJECTS
    perms = perms | PERMISSION_FLAGS.MANAGE_PROJECTS;

    expect(hasPermission(perms, PERMISSION_FLAGS.VIEW_PROJECTS)).toBe(true);
    expect(hasPermission(perms, PERMISSION_FLAGS.MANAGE_PROJECTS)).toBe(true);
  });

  it('should handle toggle operations', () => {
    let perms = PERMISSION_FLAGS.VIEW_PROJECTS;

    // Toggle MANAGE_PROJECTS on
    perms = perms ^ PERMISSION_FLAGS.MANAGE_PROJECTS;
    expect(hasPermission(perms, PERMISSION_FLAGS.MANAGE_PROJECTS)).toBe(true);

    // Toggle MANAGE_PROJECTS off
    perms = perms ^ PERMISSION_FLAGS.MANAGE_PROJECTS;
    expect(hasPermission(perms, PERMISSION_FLAGS.MANAGE_PROJECTS)).toBe(false);
  });
});
