/**
 * Bank Reconciliation Service (Compatibility Shim)
 *
 * This file maintains backward compatibility with existing imports.
 * All functionality has been refactored into the bankReconciliation/ module.
 *
 * @deprecated Import from '@/lib/accounting/bankReconciliation' instead
 */

// Re-export everything from the modular structure
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
} from './bankReconciliation';

export {
  createBankStatement,
  addBankTransactions,
  getUnmatchedAccountingTransactions,
  getUnmatchedBankTransactions,
  calculateMatchScore,
  getSuggestedMatches,
  matchTransactions,
  unmatchTransaction,
  matchMultipleTransactions,
  getReconciliationStats,
  generateReconciliationReport,
  markStatementAsReconciled,
  getEnhancedSuggestedMatches,
  getEnhancedMatchStatistics,
  autoMatchTransactions,
  getMultiTransactionMatches,
} from './bankReconciliation';
