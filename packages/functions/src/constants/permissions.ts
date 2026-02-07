/**
 * Permission Flags - Local copy for Cloud Functions
 * Bitwise permission system
 *
 * IMPORTANT: These values MUST match packages/constants/src/permissions.ts exactly.
 * If you add or change flags here, update the canonical source too.
 */

export const PERMISSION_FLAGS = {
  // User Management (bits 0-2)
  MANAGE_USERS: 1 << 0, // 1
  VIEW_USERS: 1 << 1, // 2
  MANAGE_ROLES: 1 << 2, // 4

  // Project Management (bits 3-4)
  MANAGE_PROJECTS: 1 << 3, // 8
  VIEW_PROJECTS: 1 << 4, // 16

  // Entity Management (bits 5-8) - Granular permissions
  VIEW_ENTITIES: 1 << 5, // 32
  CREATE_ENTITIES: 1 << 6, // 64
  EDIT_ENTITIES: 1 << 7, // 128
  DELETE_ENTITIES: 1 << 8, // 256

  // Company Settings (bit 9)
  MANAGE_COMPANY_SETTINGS: 1 << 9, // 512

  // Analytics & Reporting (bits 10-11)
  VIEW_ANALYTICS: 1 << 10, // 1024
  EXPORT_DATA: 1 << 11, // 2048

  // Time Tracking (bits 12-13)
  MANAGE_TIME_TRACKING: 1 << 12, // 4096
  VIEW_TIME_TRACKING: 1 << 13, // 8192

  // Accounting (bits 14-15)
  MANAGE_ACCOUNTING: 1 << 14, // 16384
  VIEW_ACCOUNTING: 1 << 15, // 32768

  // Procurement (bits 16-17)
  MANAGE_PROCUREMENT: 1 << 16, // 65536
  VIEW_PROCUREMENT: 1 << 17, // 131072

  // Estimation (bits 18-19)
  MANAGE_ESTIMATION: 1 << 18, // 262144
  VIEW_ESTIMATION: 1 << 19, // 524288

  // Proposal Management (bits 20-21)
  VIEW_PROPOSALS: 1 << 20, // 1048576
  MANAGE_PROPOSALS: 1 << 21, // 2097152

  // Document Management (bits 27-30)
  MANAGE_DOCUMENTS: 1 << 27, // 134217728
  SUBMIT_DOCUMENTS: 1 << 28, // 268435456
  REVIEW_DOCUMENTS: 1 << 29, // 536870912
  APPROVE_DOCUMENTS: 1 << 30, // 1073741824
} as const;
