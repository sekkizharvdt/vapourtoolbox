/**
 * Purchase Request Service
 *
 * Handles all Purchase Request operations:
 * - Create (single line or bulk Excel upload)
 * - Read (list, get by ID)
 * - Update
 * - Submit for approval
 * - Approve/Reject
 * - Line item management
 *
 * Refactored from purchaseRequestService.ts (950 lines) into modular structure:
 * - types.ts: Type definitions
 * - utils.ts: Internal utilities (PR number generation, budget validation)
 * - crud.ts: CRUD operations
 * - workflow.ts: Workflow operations (submit, approve, reject, comment)
 * - queries.ts: Specialized query helpers
 */

// Export types
export type {
  CreatePurchaseRequestInput,
  CreatePurchaseRequestItemInput,
  UpdatePurchaseRequestInput,
  ListPurchaseRequestsFilters,
  PaginatedPurchaseRequestsResult,
} from './types';

// Export CRUD operations
export {
  createPurchaseRequest,
  getPurchaseRequestById,
  getPurchaseRequestItems,
  listPurchaseRequests,
  updatePurchaseRequest,
  incrementAttachmentCount,
} from './crud';

// Export workflow operations
export {
  submitPurchaseRequestForApproval,
  approvePurchaseRequest,
  rejectPurchaseRequest,
  addPurchaseRequestComment,
} from './workflow';

// Export query helpers
export { getPendingApprovals, getUnderReviewPRs, getApprovedPRs } from './queries';

// Export attachment operations
export {
  uploadPRAttachment,
  deletePRAttachment,
  getPRAttachments,
  getPRItemAttachments,
  getAttachmentDownloadUrl,
} from './attachments';

// Note: Utility functions (generatePRNumber, validateProjectBudget) are internal
// and not exported from the public API
