/**
 * Advanced Auto-Matching Engine for Bank Reconciliation
 *
 * Provides sophisticated algorithms for automatically matching bank transactions
 * with accounting transactions using multiple matching strategies:
 * - Exact matching (amount + date)
 * - Fuzzy matching (description similarity)
 * - Multi-transaction matching (bulk payments)
 * - Pattern-based matching (recurring transactions)
 * - Historical learning (past match patterns)
 *
 * Refactored from autoMatchingEngine.ts (623 lines) into modular structure:
 * - types.ts: Type definitions and configuration
 * - utils.ts: String similarity and helper utilities
 * - scoring.ts: Match score calculation logic
 * - matching.ts: Single and multi-transaction matching
 * - batch.ts: Batch operations and statistics
 */

// Export types
export type { MatchingConfig, EnhancedMatchSuggestion, MultiTransactionMatch } from './types';

export { DEFAULT_MATCHING_CONFIG } from './types';

// Export scoring
export { calculateEnhancedMatchScore } from './scoring';

// Export matching operations
export { findBestMatches, findMultiTransactionMatches } from './matching';

// Export batch operations
export { batchAutoMatch, getMatchStatistics } from './batch';
