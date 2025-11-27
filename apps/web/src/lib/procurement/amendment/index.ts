/**
 * Purchase Order Amendment Service
 *
 * Manages amendments to approved purchase orders with full version history,
 * approval workflow, and audit trail.
 *
 * Refactored from amendmentService.ts (617 lines) into modular structure:
 * - types.ts: Type definitions
 * - crud.ts: Create, submit, approve, reject amendments
 * - queries.ts: Get amendment and approval history
 * - versioning.ts: Version snapshots and comparisons
 * - helpers.ts: Utility functions
 */

// Export types
export type {
  PurchaseOrderAmendment,
  PurchaseOrderChange,
  PurchaseOrderVersion,
  AmendmentApprovalHistory,
} from './types';

// Export CRUD operations
export {
  createAmendment,
  submitAmendmentForApproval,
  approveAmendment,
  rejectAmendment,
} from './crud';

// Export query operations
export {
  getAmendmentHistory,
  getAmendmentApprovalHistory,
  listAmendments,
  getAmendmentById,
  type ListAmendmentsFilters,
} from './queries';

// Export versioning operations
export { getPurchaseOrderVersions, createVersionSnapshot, compareVersions } from './versioning';
