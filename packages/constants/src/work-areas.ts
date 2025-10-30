// Work Areas / Project Phases
// Extracted from Time Tracker analysis - maps to actual VDT workflow

import type { WorkArea } from '@vapour/types';

export interface WorkAreaConfig {
  value: WorkArea;
  label: string;
  icon: string; // Material UI icon name
  color: string;
  description: string;
}

/**
 * Work areas represent the different phases of project execution
 * Extracted from Time Tracker - proven workflow
 */
export const WORK_AREAS: Record<WorkArea, WorkAreaConfig> = {
  PROPOSAL: {
    value: 'PROPOSAL',
    label: 'Proposal',
    icon: 'Description',
    color: '#F59E0B', // Amber
    description: 'Initial proposal and quotation phase',
  },

  DESIGN: {
    value: 'DESIGN',
    label: 'Design',
    icon: 'DesignServices',
    color: '#8B5CF6', // Purple
    description: 'Engineering design and planning',
  },

  PROCUREMENT: {
    value: 'PROCUREMENT',
    label: 'Procurement',
    icon: 'ShoppingCart',
    color: '#EC4899', // Pink
    description: 'Material and equipment procurement',
  },

  MANUFACTURING: {
    value: 'MANUFACTURING',
    label: 'Manufacturing',
    icon: 'Build',
    color: '#3B82F6', // Blue
    description: 'Manufacturing and fabrication',
  },

  INSTALLATION: {
    value: 'INSTALLATION',
    label: 'Installation',
    icon: 'Construction',
    color: '#10B981', // Green
    description: 'On-site installation work',
  },

  COMMISSIONING: {
    value: 'COMMISSIONING',
    label: 'Commissioning',
    icon: 'Settings',
    color: '#0891B2', // Cyan
    description: 'System testing and commissioning',
  },

  SUPPORT: {
    value: 'SUPPORT',
    label: 'Support',
    icon: 'Support',
    color: '#6366F1', // Indigo
    description: 'Post-installation support and maintenance',
  },

  ADMIN: {
    value: 'ADMIN',
    label: 'Admin',
    icon: 'AdminPanelSettings',
    color: '#6B7280', // Gray
    description: 'Administrative and management tasks',
  },
};

/**
 * Get work area by value
 */
export function getWorkArea(value: WorkArea): WorkAreaConfig {
  return WORK_AREAS[value];
}

/**
 * Get all work areas as array
 */
export function getAllWorkAreas(): WorkAreaConfig[] {
  return Object.values(WORK_AREAS);
}

/**
 * Get work area options for select/dropdown
 */
export function getWorkAreaOptions() {
  return getAllWorkAreas().map((area) => ({
    value: area.value,
    label: area.label,
  }));
}
