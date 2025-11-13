/**
 * Offer Service
 *
 * Handles vendor quotation/offer operations
 *
 * Refactored from offerService.ts (706 lines) into modular structure:
 * - types.ts: Type definitions for offers
 * - utils.ts: Internal utilities (offer number generation)
 * - crud.ts: CRUD operations (create, read, update)
 * - queries.ts: Query operations (list, getByRFQ)
 * - evaluation.ts: Evaluation and comparison logic
 * - workflow.ts: Lifecycle management (select, reject, withdraw)
 */

// Export types
export type {
  Offer,
  OfferItem,
  OfferStatus,
  OfferComparisonData,
  CreateOfferInput,
  CreateOfferItemInput,
  UpdateOfferInput,
  EvaluateOfferInput,
  ListOffersFilters,
} from './types';

// Export CRUD operations
export { createOffer, getOfferById, getOfferItems, updateOffer } from './crud';

// Export query operations
export { getOffersByRFQ, listOffers } from './queries';

// Export evaluation operations
export { evaluateOffer, markOfferAsRecommended, getOfferComparison } from './evaluation';

// Export workflow operations
export { selectOffer, rejectOffer, withdrawOffer } from './workflow';
