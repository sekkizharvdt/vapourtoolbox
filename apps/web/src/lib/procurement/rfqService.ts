/**
 * RFQ Service (Compatibility Shim)
 *
 * This file maintains backward compatibility with existing imports.
 * All functionality has been refactored into the rfq/ module.
 *
 * @deprecated Import from '@/lib/procurement/rfq' instead
 */

// Re-export everything from the modular structure
export type {
  RFQ,
  RFQItem,
  RFQStatus,
  CreateRFQInput,
  CreateRFQItemInput,
  ListRFQsFilters,
  UpdateRFQInput,
} from './rfq';

export {
  createRFQ,
  createRFQFromPRs,
  getRFQById,
  getRFQItems,
  listRFQs,
  updateRFQ,
  issueRFQ,
  incrementOffersReceived,
  incrementOffersEvaluated,
  completeRFQ,
  cancelRFQ,
  generateRFQPDFVersion,
} from './rfq';
