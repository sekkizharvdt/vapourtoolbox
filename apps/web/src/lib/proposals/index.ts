/**
 * Proposals Module
 *
 * Consolidated module for all proposal-related services.
 * Merged from proposal/ and proposals/ directories.
 */

// Core CRUD services
export {
  createProposal,
  getProposalById,
  getProposalByNumber,
  listProposals,
  updateProposal,
  getProposalsCountByStatus,
  // Use proposalService versions for these (they delegate to the specialized modules)
  createProposalRevision,
  submitProposalForApproval,
  getProposalRevisions,
} from './proposalService';

export * from './proposalAttachmentService';

// Workflow and conversion - export specific functions to avoid conflicts
export {
  approveProposal,
  rejectProposal,
  requestProposalChanges,
  markProposalAsSubmitted,
  updateProposalStatus,
  getAvailableActions,
} from './approvalWorkflow';

export * from './projectConversion';

export { getLatestRevision, compareRevisions } from './revisionManagement';

// Utilities
export * from './proposalPDF';
export * from './userHelpers';
