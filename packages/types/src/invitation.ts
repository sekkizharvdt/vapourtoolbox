// Invitation System Types
// For inviting users (internal team members or external CLIENT_PM users)

import type { Timestamp } from './common';
import type { Department } from './core';

/**
 * Invitation status
 */
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

/**
 * Invitation role type
 * - INTERNAL: Internal team member with configurable permissions
 * - CLIENT_PM: External client project manager with project-scoped access
 */
export type InvitationRole = 'INTERNAL' | 'CLIENT_PM';

/**
 * Invitation for new users
 * Supports both internal team members and external CLIENT_PM users
 */
export interface Invitation {
  id: string;
  email: string;
  domain: string; // Extracted from email for validation
  role: InvitationRole;
  displayName?: string; // Optional pre-filled name
  department?: Department; // For INTERNAL invitations
  jobTitle?: string; // For INTERNAL invitations
  permissions: number; // Bitwise permissions (INTERNAL) or 0 (CLIENT_PM)
  permissions2?: number; // Extended permissions
  assignedProjects: string[]; // Project IDs (required for CLIENT_PM, optional for INTERNAL)
  createdBy: string; // User ID who created the invitation
  createdByName: string; // Display name of creator
  createdAt: Timestamp;
  expiresAt: Timestamp; // Default: 7 days from creation
  status: InvitationStatus;
  acceptedAt?: Timestamp; // When invitation was accepted
  userId?: string; // Firebase Auth UID after acceptance
}

/**
 * Input for creating an internal user invitation
 */
export interface CreateInternalInvitationInput {
  email: string;
  displayName?: string;
  department?: Department;
  jobTitle?: string;
  permissions: number;
  permissions2?: number;
}

/**
 * Input for creating a CLIENT_PM invitation (legacy)
 */
export interface CreateInvitationInput {
  email: string;
  assignedProjects: string[]; // Must have at least one project
  expiresInDays?: number; // Optional, defaults to 7
}

/**
 * Input for updating invitation status
 */
export interface UpdateInvitationInput {
  id: string;
  status: InvitationStatus;
  userId?: string; // Set when accepting invitation
}

/**
 * Invitation with project names (for display)
 */
export interface InvitationWithProjects extends Invitation {
  projectNames: string[]; // Project names for display
}
