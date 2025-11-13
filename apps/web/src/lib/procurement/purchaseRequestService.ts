/**
 * Purchase Request Service (Compatibility Shim)
 *
 * This file maintains backward compatibility with existing imports.
 * All functionality has been refactored into the purchaseRequest/ module.
 *
 * @deprecated Import from '@/lib/procurement/purchaseRequest' instead
 */

// Re-export everything from the modular structure
export type {
  CreatePurchaseRequestInput,
  CreatePurchaseRequestItemInput,
  UpdatePurchaseRequestInput,
  ListPurchaseRequestsFilters,
} from './purchaseRequest';

export {
  createPurchaseRequest,
  getPurchaseRequestById,
  getPurchaseRequestItems,
  listPurchaseRequests,
  updatePurchaseRequest,
  incrementAttachmentCount,
  submitPurchaseRequestForApproval,
  approvePurchaseRequest,
  rejectPurchaseRequest,
  addPurchaseRequestComment,
  getPendingApprovals,
  getUnderReviewPRs,
  getApprovedPRs,
} from './purchaseRequest';
