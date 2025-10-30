"use strict";
// Bitwise Permissions System
// Optimized for Firebase Custom Claims (1000 byte limit)
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionDescriptions = exports.RolePermissions = exports.PermissionFlag = void 0;
exports.hasPermission = hasPermission;
exports.hasAnyPermission = hasAnyPermission;
exports.hasAllPermissions = hasAllPermissions;
exports.addPermission = addPermission;
exports.addPermissions = addPermissions;
exports.removePermission = removePermission;
exports.removePermissions = removePermissions;
exports.togglePermission = togglePermission;
exports.createPermissions = createPermissions;
exports.getGrantedPermissions = getGrantedPermissions;
exports.getPermissionsForRole = getPermissionsForRole;
exports.getPermissionsForRoles = getPermissionsForRoles;
/**
 * Permission flags using bitwise operations
 * Each permission is a power of 2, allowing efficient storage and checking
 */
var PermissionFlag;
(function (PermissionFlag) {
    // User Management (0-3)
    PermissionFlag[PermissionFlag["MANAGE_USERS"] = 1] = "MANAGE_USERS";
    PermissionFlag[PermissionFlag["ASSIGN_ROLES"] = 2] = "ASSIGN_ROLES";
    // Project Management (4-6)
    PermissionFlag[PermissionFlag["CREATE_PROJECTS"] = 16] = "CREATE_PROJECTS";
    PermissionFlag[PermissionFlag["VIEW_ALL_PROJECTS"] = 32] = "VIEW_ALL_PROJECTS";
    PermissionFlag[PermissionFlag["ASSIGN_PROJECTS"] = 64] = "ASSIGN_PROJECTS";
    // Entity Management (7)
    PermissionFlag[PermissionFlag["MANAGE_ENTITIES"] = 128] = "MANAGE_ENTITIES";
    // Time Tracking (8-10)
    PermissionFlag[PermissionFlag["GENERATE_TIMESHEETS"] = 256] = "GENERATE_TIMESHEETS";
    PermissionFlag[PermissionFlag["APPROVE_LEAVES"] = 512] = "APPROVE_LEAVES";
    PermissionFlag[PermissionFlag["MANAGE_ON_DUTY"] = 1024] = "MANAGE_ON_DUTY";
    // Accounting (11-13)
    PermissionFlag[PermissionFlag["CREATE_TRANSACTIONS"] = 2048] = "CREATE_TRANSACTIONS";
    PermissionFlag[PermissionFlag["APPROVE_TRANSACTIONS"] = 4096] = "APPROVE_TRANSACTIONS";
    PermissionFlag[PermissionFlag["VIEW_REPORTS"] = 8192] = "VIEW_REPORTS";
    // Procurement (14-18)
    PermissionFlag[PermissionFlag["CREATE_PR"] = 16384] = "CREATE_PR";
    PermissionFlag[PermissionFlag["APPROVE_PR"] = 32768] = "APPROVE_PR";
    PermissionFlag[PermissionFlag["CREATE_RFQ"] = 65536] = "CREATE_RFQ";
    PermissionFlag[PermissionFlag["CREATE_PO"] = 131072] = "CREATE_PO";
    PermissionFlag[PermissionFlag["APPROVE_PO"] = 262144] = "APPROVE_PO";
    // Estimation (19-20)
    PermissionFlag[PermissionFlag["CREATE_ESTIMATES"] = 524288] = "CREATE_ESTIMATES";
    PermissionFlag[PermissionFlag["APPROVE_ESTIMATES"] = 1048576] = "APPROVE_ESTIMATES";
    // View-only permissions for external users (21-23)
    PermissionFlag[PermissionFlag["VIEW_PROCUREMENT"] = 2097152] = "VIEW_PROCUREMENT";
    PermissionFlag[PermissionFlag["VIEW_PROJECT_STATUS"] = 4194304] = "VIEW_PROJECT_STATUS";
    PermissionFlag[PermissionFlag["VIEW_PAYMENT_STATUS"] = 8388608] = "VIEW_PAYMENT_STATUS";
})(PermissionFlag || (exports.PermissionFlag = PermissionFlag = {}));
/**
 * Permission helper functions
 */
/**
 * Check if a permission is granted
 */
function hasPermission(permissions, flag) {
    return (permissions & flag) === flag;
}
/**
 * Check if any of the given permissions are granted
 */
function hasAnyPermission(permissions, ...flags) {
    return flags.some((flag) => hasPermission(permissions, flag));
}
/**
 * Check if all of the given permissions are granted
 */
function hasAllPermissions(permissions, ...flags) {
    return flags.every((flag) => hasPermission(permissions, flag));
}
/**
 * Add a permission
 */
function addPermission(permissions, flag) {
    return permissions | flag;
}
/**
 * Add multiple permissions
 */
function addPermissions(permissions, ...flags) {
    return flags.reduce((acc, flag) => acc | flag, permissions);
}
/**
 * Remove a permission
 */
function removePermission(permissions, flag) {
    return permissions & ~flag;
}
/**
 * Remove multiple permissions
 */
function removePermissions(permissions, ...flags) {
    return flags.reduce((acc, flag) => acc & ~flag, permissions);
}
/**
 * Toggle a permission
 */
function togglePermission(permissions, flag) {
    return permissions ^ flag;
}
/**
 * Create permissions from an array of flags
 */
function createPermissions(...flags) {
    return flags.reduce((acc, flag) => acc | flag, 0);
}
/**
 * Get all granted permissions as an array
 */
function getGrantedPermissions(permissions) {
    const granted = [];
    const allFlags = Object.values(PermissionFlag).filter((v) => typeof v === 'number');
    for (const flag of allFlags) {
        if (hasPermission(permissions, flag)) {
            granted.push(flag);
        }
    }
    return granted;
}
/**
 * Predefined permission sets for common roles
 */
exports.RolePermissions = {
    SUPER_ADMIN: createPermissions(
    // All permissions
    PermissionFlag.MANAGE_USERS, PermissionFlag.ASSIGN_ROLES, PermissionFlag.CREATE_PROJECTS, PermissionFlag.VIEW_ALL_PROJECTS, PermissionFlag.ASSIGN_PROJECTS, PermissionFlag.MANAGE_ENTITIES, PermissionFlag.GENERATE_TIMESHEETS, PermissionFlag.APPROVE_LEAVES, PermissionFlag.MANAGE_ON_DUTY, PermissionFlag.CREATE_TRANSACTIONS, PermissionFlag.APPROVE_TRANSACTIONS, PermissionFlag.VIEW_REPORTS, PermissionFlag.CREATE_PR, PermissionFlag.APPROVE_PR, PermissionFlag.CREATE_RFQ, PermissionFlag.CREATE_PO, PermissionFlag.APPROVE_PO, PermissionFlag.CREATE_ESTIMATES, PermissionFlag.APPROVE_ESTIMATES),
    DIRECTOR: createPermissions(PermissionFlag.VIEW_ALL_PROJECTS, PermissionFlag.ASSIGN_PROJECTS, PermissionFlag.MANAGE_ENTITIES, PermissionFlag.GENERATE_TIMESHEETS, PermissionFlag.APPROVE_LEAVES, PermissionFlag.APPROVE_TRANSACTIONS, PermissionFlag.VIEW_REPORTS, PermissionFlag.APPROVE_PR, PermissionFlag.APPROVE_PO, PermissionFlag.APPROVE_ESTIMATES),
    PROJECT_MANAGER: createPermissions(PermissionFlag.CREATE_PROJECTS, PermissionFlag.ASSIGN_PROJECTS, PermissionFlag.GENERATE_TIMESHEETS, PermissionFlag.CREATE_PR, PermissionFlag.CREATE_RFQ, PermissionFlag.CREATE_ESTIMATES),
    PROCUREMENT_MANAGER: createPermissions(PermissionFlag.MANAGE_ENTITIES, PermissionFlag.CREATE_PR, PermissionFlag.APPROVE_PR, PermissionFlag.CREATE_RFQ, PermissionFlag.CREATE_PO, PermissionFlag.APPROVE_PO),
    ACCOUNTANT: createPermissions(PermissionFlag.MANAGE_ENTITIES, PermissionFlag.CREATE_TRANSACTIONS, PermissionFlag.VIEW_REPORTS),
    FINANCE_MANAGER: createPermissions(PermissionFlag.MANAGE_ENTITIES, PermissionFlag.CREATE_TRANSACTIONS, PermissionFlag.APPROVE_TRANSACTIONS, PermissionFlag.VIEW_REPORTS),
    ENGINEERING_HEAD: createPermissions(PermissionFlag.CREATE_PROJECTS, PermissionFlag.VIEW_ALL_PROJECTS, PermissionFlag.ASSIGN_PROJECTS, PermissionFlag.GENERATE_TIMESHEETS, PermissionFlag.APPROVE_LEAVES),
    ENGINEER: createPermissions(PermissionFlag.CREATE_ESTIMATES),
    SITE_ENGINEER: createPermissions(PermissionFlag.CREATE_PR),
    HR_ADMIN: createPermissions(PermissionFlag.MANAGE_USERS, PermissionFlag.ASSIGN_ROLES, PermissionFlag.APPROVE_LEAVES),
    TEAM_MEMBER: createPermissions(
    // Minimal permissions - can view assigned projects
    ),
    CLIENT_PM: createPermissions(
    // External client PM - view-only procurement for assigned projects
    PermissionFlag.VIEW_PROCUREMENT, PermissionFlag.VIEW_PROJECT_STATUS, PermissionFlag.VIEW_PAYMENT_STATUS),
};
/**
 * Get permissions for a role
 */
function getPermissionsForRole(role) {
    return exports.RolePermissions[role] || 0;
}
/**
 * Get permissions for multiple roles (combines all role permissions)
 */
function getPermissionsForRoles(roles) {
    return roles.reduce((acc, role) => {
        const rolePerms = getPermissionsForRole(role);
        return acc | rolePerms;
    }, 0);
}
/**
 * Permission descriptions for UI display
 */
exports.PermissionDescriptions = {
    [PermissionFlag.MANAGE_USERS]: 'Manage users',
    [PermissionFlag.ASSIGN_ROLES]: 'Assign roles',
    [PermissionFlag.CREATE_PROJECTS]: 'Create projects',
    [PermissionFlag.VIEW_ALL_PROJECTS]: 'View all projects',
    [PermissionFlag.ASSIGN_PROJECTS]: 'Assign projects',
    [PermissionFlag.MANAGE_ENTITIES]: 'Manage entities',
    [PermissionFlag.GENERATE_TIMESHEETS]: 'Generate timesheets',
    [PermissionFlag.APPROVE_LEAVES]: 'Approve leaves',
    [PermissionFlag.MANAGE_ON_DUTY]: 'Manage on-duty',
    [PermissionFlag.CREATE_TRANSACTIONS]: 'Create transactions',
    [PermissionFlag.APPROVE_TRANSACTIONS]: 'Approve transactions',
    [PermissionFlag.VIEW_REPORTS]: 'View reports',
    [PermissionFlag.CREATE_PR]: 'Create purchase requisitions',
    [PermissionFlag.APPROVE_PR]: 'Approve purchase requisitions',
    [PermissionFlag.CREATE_RFQ]: 'Create RFQs',
    [PermissionFlag.CREATE_PO]: 'Create purchase orders',
    [PermissionFlag.APPROVE_PO]: 'Approve purchase orders',
    [PermissionFlag.CREATE_ESTIMATES]: 'Create estimates',
    [PermissionFlag.APPROVE_ESTIMATES]: 'Approve estimates',
    [PermissionFlag.VIEW_PROCUREMENT]: 'View procurement',
    [PermissionFlag.VIEW_PROJECT_STATUS]: 'View project status',
    [PermissionFlag.VIEW_PAYMENT_STATUS]: 'View payment status',
};
//# sourceMappingURL=permissions.js.map