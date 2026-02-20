/**
 * Document Management - Folder Browser Types
 *
 * Folder-based document browsing, breadcrumbs, view modes
 */

import type { Timestamp } from 'firebase/firestore';
import type { DocumentModule, DocumentEntityType } from './core';

// ============================================================================
// FOLDER-BASED DOCUMENT BROWSER
// ============================================================================

/**
 * User-created subfolder within an entity's document area
 * Stored in documentFolders collection for efficient tree queries
 */
export interface DocumentFolder {
  id: string;

  // Scope
  module: DocumentModule;
  projectId?: string; // If project-specific
  entityType?: DocumentEntityType; // If entity-specific
  entityId?: string; // If entity-specific

  // Hierarchy
  parentFolderId?: string; // null for root-level user folders
  path: string; // Full path e.g., "procurement/purchase-request/PR-001/specs"
  name: string; // Display name e.g., "specs"
  depth: number; // Nesting level (0 = root, 1 = first level, etc.)

  // Metadata
  color?: string; // Optional folder color for UI
  description?: string;

  // Audit
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Soft delete
  isDeleted: boolean;
  deletedBy?: string;
  deletedAt?: Timestamp;
}

/**
 * Virtual folder node for tree display
 * Combines auto-generated (virtual) and user-created folders
 */
export interface FolderNode {
  id: string; // Unique identifier (generated path or actual folder ID)
  name: string; // Display name
  path: string; // Full path
  type: 'virtual' | 'user'; // Auto-generated vs user-created

  // Tree position
  level: number; // Tree depth (0 = root)
  parentPath?: string; // Parent folder path

  // For virtual folders linked to entities
  entityType?: DocumentEntityType;
  entityId?: string;
  entityNumber?: string; // e.g., "PR-001", "INV-001"

  // For user-created folders
  folderId?: string; // Actual DocumentFolder ID

  // Children
  children: FolderNode[];

  // Document counts
  documentCount: number; // Files directly in this folder
  totalDocumentCount: number; // Files in this folder + all descendants

  // UI state (not persisted, set by component)
  isExpanded?: boolean;
  isSelected?: boolean;
}

/**
 * View mode for document browser
 * - entity: Organized by entity type (PRs, RFQs, POs, etc.)
 * - project: Organized by project first, then by module/entity
 */
export type DocumentBrowserViewMode = 'entity' | 'project';

/**
 * Breadcrumb segment for navigation
 */
export interface BreadcrumbSegment {
  label: string;
  path: string;
  type: 'module' | 'project' | 'entityType' | 'entity' | 'folder';
  icon?: string; // Optional icon name
}
