/**
 * Bank Reconciliation Service
 *
 * Handles bank statement uploads, transaction matching, and reconciliation reports
 *
 * Refactored from bankReconciliationService.ts (868 lines) into modular structure:
 * - types.ts: Type definitions and re-exports
 * - crud.ts: CRUD operations for statements and transactions
 * - matching.ts: Core matching logic and manual matching
 * - reporting.ts: Statistics, reports, and completion
 * - autoMatching.ts: Enhanced auto-matching with confidence levels
 */

// Export types
export type {
  BankStatement,
  BankTransaction,
  ReconciliationMatch,
  ReconciliationReport,
  ReconciliationStats,
  MatchSuggestion,
  ManualMatchInput,
  MatchType,
  BankStatementStatus,
  MatchingConfig,
  EnhancedMatchSuggestion,
  MultiTransactionMatch,
} from './types';

// Export CRUD operations
export {
  createBankStatement,
  addBankTransactions,
  getUnmatchedAccountingTransactions,
  getUnmatchedBankTransactions,
} from './crud';

// Export matching operations
export {
  calculateMatchScore,
  getSuggestedMatches,
  matchTransactions,
  unmatchTransaction,
  matchMultipleTransactions,
} from './matching';

// Export reporting functions
export {
  getReconciliationStats,
  generateReconciliationReport,
  markStatementAsReconciled,
} from './reporting';

// Export auto-matching functions
export {
  getEnhancedSuggestedMatches,
  getEnhancedMatchStatistics,
  autoMatchTransactions,
  getMultiTransactionMatches,
} from './autoMatching';
