/**
 * Auto-Matching Engine (Compatibility Shim)
 *
 * This file maintains backward compatibility with existing imports.
 * All functionality has been refactored into the autoMatching/ module.
 *
 * @deprecated Import from '@/lib/accounting/autoMatching' instead
 */

// Re-export everything from the modular structure
export type {
  MatchingConfig,
  EnhancedMatchSuggestion,
  MultiTransactionMatch,
} from './autoMatching';

export {
  DEFAULT_MATCHING_CONFIG,
  calculateEnhancedMatchScore,
  findBestMatches,
  findMultiTransactionMatches,
  batchAutoMatch,
  getMatchStatistics,
} from './autoMatching';
