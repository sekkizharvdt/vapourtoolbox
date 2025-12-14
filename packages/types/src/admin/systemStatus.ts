/**
 * System Status Types
 *
 * Types for the admin system status page that displays
 * package versions, security vulnerabilities, and updates.
 */

/**
 * Vulnerability severity levels
 */
export type VulnerabilitySeverity = 'critical' | 'high' | 'moderate' | 'low' | 'info';

/**
 * Update type for outdated packages
 */
export type UpdateType = 'major' | 'minor' | 'patch';

/**
 * Workspace/package status in the monorepo
 */
export interface WorkspaceStatus {
  name: string;
  path: string;
  version: string;
  dependencyCount: number;
}

/**
 * Individual vulnerability detail
 */
export interface VulnerabilityDetail {
  id: string;
  package: string;
  severity: VulnerabilitySeverity;
  title: string;
  url?: string;
  vulnerableVersions: string;
  patchedVersions: string;
  recommendation?: string;
}

/**
 * Summary of all vulnerabilities
 */
export interface VulnerabilitySummary {
  critical: number;
  high: number;
  moderate: number;
  low: number;
  info: number;
  total: number;
  details: VulnerabilityDetail[];
}

/**
 * Outdated package information
 */
export interface OutdatedPackage {
  name: string;
  current: string;
  wanted: string;
  latest: string;
  workspace: string;
  updateType: UpdateType;
  isSecurityUpdate: boolean;
}

/**
 * Runtime environment info
 */
export interface RuntimeInfo {
  node: {
    current: string;
    recommended?: string;
  };
  pnpm: {
    current: string;
    recommended?: string;
  };
}

/**
 * Complete system status response
 */
export interface SystemStatusResponse {
  generatedAt: string;
  runtime: RuntimeInfo;
  workspaces: WorkspaceStatus[];
  vulnerabilities: VulnerabilitySummary;
  outdatedPackages: OutdatedPackage[];
  totalDependencies: number;
}

/**
 * Error response from system status API
 */
export interface SystemStatusError {
  error: string;
  details?: string;
}
