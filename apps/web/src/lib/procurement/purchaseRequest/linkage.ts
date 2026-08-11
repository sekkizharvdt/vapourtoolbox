/**
 * What a purchase request is linked to, rendered as one string.
 *
 * `raisedFor` decides which of the three id/name pairs on the document is the
 * live one. Every read surface — list, detail, CSV, PDF — needs the same
 * answer, so it is derived here once rather than re-branched per surface
 * (rule 32).
 */

import type { PurchaseRequest } from '@vapour/types';

/**
 * Display name for a PR's linkage, or '-' when the document does not carry
 * the pair its `raisedFor` implies (only possible on data written before the
 * field split).
 */
export function describeLinkage(pr: PurchaseRequest): string {
  switch (pr.raisedFor) {
    case 'PROJECT':
      return pr.projectName || '-';
    case 'PROPOSAL':
      return pr.proposalNumber || '-';
    case 'INTERNAL':
      return pr.costCentreCode || '-';
    default:
      return '-';
  }
}
