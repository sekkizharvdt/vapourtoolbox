// Project Management Types

import { Timestamp } from 'firebase/firestore';
import { ProjectStatus, ProjectPriority } from './core';
import { TimestampFields, SoftDeleteFields, Money } from './common';

/**
 * Project team member
 */
export interface ProjectMember {
  userId: string;
  userName: string;
  role: string; // Project-specific role
  assignedAt: Timestamp;
  isActive: boolean;
}

/**
 * Project client information
 */
export interface ProjectClient {
  entityId: string; // Reference to BusinessEntity
  entityName: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
}

/**
 * Project dates
 */
export interface ProjectDates {
  startDate: Timestamp;
  endDate?: Timestamp;
  actualStartDate?: Timestamp;
  actualEndDate?: Timestamp;
}

/**
 * Project budget
 */
export interface ProjectBudget {
  estimated: Money;
  actual?: Money;
  currency: string;
}

/**
 * Main Project interface
 */
export interface Project extends TimestampFields, SoftDeleteFields {
  id: string;
  code: string; // PRJ-001, PRJ-002

  // Basic info
  name: string;
  description?: string;
  status: ProjectStatus;
  priority: ProjectPriority;

  // Client
  client: ProjectClient;

  // Team
  projectManager: {
    userId: string;
    userName: string;
  };
  team: ProjectMember[];

  // Timeline
  dates: ProjectDates;

  // Budget
  budget?: ProjectBudget;

  // Metadata
  tags?: string[];
  category?: string;
  location?: string;

  // RBAC (Project-level permissions)
  ownerId: string;
  visibility: 'private' | 'team' | 'company' | 'public';

  // Activity tracking
  lastActivityAt?: Timestamp;
  lastActivityBy?: string;

  // Progress (optional, can be computed)
  progress?: {
    percentage: number;
    completedMilestones: number;
    totalMilestones: number;
  };
}

/**
 * Project activity log entry
 */
export interface ProjectActivity {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  action: string;
  description: string;
  timestamp: Timestamp;
  metadata?: Record<string, unknown>;
}

/**
 * Project milestone
 */
export interface ProjectMilestone extends TimestampFields {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  dueDate: Timestamp;
  completedAt?: Timestamp;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo?: string[];
}
