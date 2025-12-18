/**
 * Purchase Order Service
 *
 * @deprecated Import from '@/lib/procurement/purchaseOrder' instead
 *
 * This file re-exports from the modular structure for backwards compatibility.
 * New code should import directly from:
 * - '@/lib/procurement/purchaseOrder/crud' for CRUD operations
 * - '@/lib/procurement/purchaseOrder/workflow' for workflow operations
 * - '@/lib/procurement/purchaseOrder' for all exports
 */

// Re-export everything from the new modular structure
export {
  // CRUD
  generatePONumber,
  createPOFromOffer,
  getPOById,
  getPOItems,
  listPOs,
  type CreatePOFromOfferTerms,
  // Workflow
  submitPOForApproval,
  approvePO,
  rejectPO,
  issuePO,
  updatePOStatus,
} from './purchaseOrder';
