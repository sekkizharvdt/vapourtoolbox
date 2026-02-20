/**
 * Proposal Helpers
 * Pure utility functions for scope matrix derivation and payment terms generation
 */

import type { UnifiedScopeMatrix, UnifiedScopeItem, ProposalMilestone } from '@vapour/types';
import { MILESTONE_TAX_TYPE_LABELS } from '@vapour/types';

// ============================================================================
// Unified Scope Matrix Helpers
// ============================================================================

/**
 * Derive exclusion names from the unified scope matrix.
 * Returns the names of all items where included === false.
 * Used for proposal preview and PDF generation.
 */
export function deriveExclusions(matrix: UnifiedScopeMatrix): string[] {
  return matrix.categories.flatMap((cat) =>
    cat.items.filter((item) => !item.included).map((item) => item.name)
  );
}

/**
 * Derive all included items from the unified scope matrix.
 * Used for estimation linkage and summary views.
 */
export function deriveIncludedItems(matrix: UnifiedScopeMatrix): UnifiedScopeItem[] {
  return matrix.categories.flatMap((cat) => cat.items.filter((item) => item.included));
}

/**
 * Derive included items by classification from the unified scope matrix.
 */
export function deriveIncludedByClassification(matrix: UnifiedScopeMatrix): {
  services: UnifiedScopeItem[];
  supply: UnifiedScopeItem[];
} {
  const included = deriveIncludedItems(matrix);
  return {
    services: included.filter((item) => item.classification === 'SERVICE'),
    supply: included.filter((item) => item.classification === 'SUPPLY'),
  };
}

/**
 * Generate payment terms text from milestones.
 * Produces a human-readable summary for backward compat and PDF generation.
 */
export function generatePaymentTermsFromMilestones(milestones: ProposalMilestone[]): string {
  const withPayment = milestones.filter((m) => (m.paymentPercentage ?? 0) > 0);
  if (withPayment.length === 0) return '';

  const lines = withPayment.map((m) => {
    const taxLabel = m.taxType ? ` (${MILESTONE_TAX_TYPE_LABELS[m.taxType]})` : '';
    return `${m.paymentPercentage}% - ${m.description || `Milestone ${m.milestoneNumber}`}${taxLabel}`;
  });

  return lines.join('\n');
}
