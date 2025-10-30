// Invitation System Types
// For inviting external CLIENT_PM users to view procurement data

import type { Timestamp } from './common';

/**
 * Invitation status
 */
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

/**
 * Invitation for external CLIENT_PM users
 * Allows external client project managers to view procurement for specific projects
 */
export interface Invitation {
  id: string;
  email: string;
  domain: string; // Extracted from email for validation
  role: 'CLIENT_PM'; // Only CLIENT_PM for external users
  assignedProjects: string[]; // Project IDs this user can view
  createdBy: string; // User ID who created the invitation
  createdAt: Timestamp;
  expiresAt: Timestamp; // Default: 7 days from creation
  status: InvitationStatus;
  token: string; // Secure random token for magic link verification
  acceptedAt?: Timestamp; // When invitation was accepted
  userId?: string; // Firebase Auth UID after acceptance
}

/**
 * Input for creating a new invitation
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
  createdByName: string; // Name of user who created invitation
}
