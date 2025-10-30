/**
 * Permission Flags - Local copy for Cloud Functions
 * Bitwise permission system
 */

export const PERMISSION_FLAGS = {
  // User Management (bits 0-2)
  MANAGE_USERS: 1 << 0,        // 1
  VIEW_USERS: 1 << 1,          // 2
  MANAGE_ROLES: 1 << 2,        // 4

  // Project Management (bits 3-4)
  MANAGE_PROJECTS: 1 << 3,     // 8
  VIEW_PROJECTS: 1 << 4,       // 16

  // Entity Management (bits 5-6)
  MANAGE_ENTITIES: 1 << 5,     // 32
  VIEW_ENTITIES: 1 << 6,       // 64

  // Company Settings (bit 7)
  MANAGE_COMPANY_SETTINGS: 1 << 7, // 128

  // Analytics & Reporting (bits 8-9)
  VIEW_ANALYTICS: 1 << 8,      // 256
  EXPORT_DATA: 1 << 9,         // 512

  // Time Tracking (bits 10-11)
  MANAGE_TIME_TRACKING: 1 << 10, // 1024
  VIEW_TIME_TRACKING: 1 << 11,   // 2048

  // Accounting (bits 12-13)
  MANAGE_ACCOUNTING: 1 << 12,  // 4096
  VIEW_ACCOUNTING: 1 << 13,    // 8192

  // Procurement (bits 14-15)
  MANAGE_PROCUREMENT: 1 << 14, // 16384
  VIEW_PROCUREMENT: 1 << 15,   // 32768

  // Estimation (bits 16-17)
  MANAGE_ESTIMATION: 1 << 16,  // 65536
  VIEW_ESTIMATION: 1 << 17,    // 131072
} as const;
