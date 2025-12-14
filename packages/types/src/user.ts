// User Management Types

import { Timestamp } from 'firebase/firestore';
import { Department } from './core';
import { UserStatus, TimestampFields } from './common';

/**
 * Firebase Custom Claims structure
 * Optimized for 1000-byte limit using bitwise permissions
 */
export interface CustomClaims {
  entityId?: string; // Business entity ID for multi-entity support
  department?: Department;
  permissions: number; // Bitwise permissions (see permissions.ts)
  permissions2?: number; // Extended permissions (see PERMISSION_FLAGS_2 in permissions.ts)
  domain: 'internal' | 'external'; // vapourdesal.com vs external domains
  allowedModules?: string[]; // Module IDs user can access (empty = all modules)
}

/**
 * Main User interface
 */
export interface User extends TimestampFields {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;

  // Permissions and department
  department?: Department;
  permissions: number; // Bitwise permissions (see permissions.ts)
  permissions2?: number; // Extended permissions (see PERMISSION_FLAGS_2 in permissions.ts)
  allowedModules?: string[]; // Module IDs user can access (empty = all modules)
  jobTitle?: string;

  // Contact info
  phone?: string;
  mobile?: string;

  // Status
  status: UserStatus;
  isActive: boolean;

  // Projects
  assignedProjects: string[];

  // Settings
  preferences?: {
    theme?: 'light' | 'dark';
    language?: string;
    notifications?: {
      email: boolean;
      push: boolean;
    };
  };

  // Last login tracking
  lastLoginAt?: Timestamp;

  // HR Profile (extended employee information)
  hrProfile?: {
    employeeId?: string; // Employee ID (e.g., VDT-001)
    dateOfJoining?: Timestamp;
    reportingManagerId?: string; // Manager's UID for hierarchy
    probationEndDate?: Timestamp;
    emergencyContact?: {
      name: string;
      relationship: string;
      phone: string;
    };
    bankDetails?: {
      accountNumber: string;
      bankName: string;
      ifscCode: string;
      accountHolderName: string;
    };
  };
}

/**
 * User profile (subset of User for public display)
 */
export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  email: string;
  department?: Department;
  jobTitle?: string;
}
