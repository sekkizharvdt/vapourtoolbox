/**
 * Amendment Service (Compatibility Shim)
 *
 * This file maintains backward compatibility with existing imports.
 * All functionality has been refactored into the amendment/ module.
 *
 * @deprecated Import from '@/lib/procurement/amendment' instead
 */

// Re-export everything from the modular structure
export type {
  PurchaseOrderAmendment,
  PurchaseOrderChange,
  PurchaseOrderVersion,
  AmendmentApprovalHistory,
} from './amendment';

export {
  createAmendment,
  submitAmendmentForApproval,
  approveAmendment,
  rejectAmendment,
  getAmendmentHistory,
  getAmendmentApprovalHistory,
  getPurchaseOrderVersions,
  createVersionSnapshot,
  compareVersions,
} from './amendment';
