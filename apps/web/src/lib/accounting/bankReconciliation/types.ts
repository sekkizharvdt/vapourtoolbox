/**
 * Bank Reconciliation Type Definitions
 *
 * Re-exports types from @vapour/types for convenience
 */

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
} from '@vapour/types';

export type {
  MatchingConfig,
  EnhancedMatchSuggestion,
  MultiTransactionMatch,
} from '../autoMatching';
