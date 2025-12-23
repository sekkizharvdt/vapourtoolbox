/**
 * RFQ Service
 *
 * Handles all RFQ operations:
 * - Create RFQ from approved PRs
 * - Read (list, get by ID)
 * - Update
 * - Issue to vendors
 * - Track offers received
 * - Complete RFQ
 *
 * Refactored from rfqService.ts (656 lines) into modular structure:
 * - types.ts: Type definitions and interfaces
 * - utils.ts: RFQ number generation utilities
 * - crud.ts: Create, read, update operations
 * - queries.ts: List and filter operations
 * - workflow.ts: Status transitions and workflow actions
 */

// Export types
export type {
  RFQ,
  RFQItem,
  RFQStatus,
  CreateRFQInput,
  CreateRFQItemInput,
  ListRFQsFilters,
  PaginatedRFQsResult,
  UpdateRFQInput,
} from './types';

// Export utilities
export { generateRFQNumber } from './utils';

// Export CRUD operations
export {
  createRFQ,
  createRFQFromPRs,
  getRFQById,
  getRFQItems,
  updateRFQ,
  generateRFQPDFVersion,
} from './crud';

// Export queries
export { listRFQs } from './queries';

// Export workflow operations
export {
  issueRFQ,
  incrementOffersReceived,
  incrementOffersEvaluated,
  completeRFQ,
  cancelRFQ,
} from './workflow';
