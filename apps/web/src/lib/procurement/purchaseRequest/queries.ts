/**
 * Purchase Request Query Helpers
 *
 * Specialized queries for common PR retrieval patterns
 */

import type { PurchaseRequest } from '@vapour/types';
import { listPurchaseRequests } from './crud';

/**
 * Get pending approvals (PRs in SUBMITTED status)
 * Used by Engineering Head to see PRs awaiting review
 */
export async function getPendingApprovals(): Promise<PurchaseRequest[]> {
  const result = await listPurchaseRequests({
    status: 'SUBMITTED',
  });
  return result.items;
}

/**
 * Get PRs under review
 * Used by Engineering Head to see PRs currently being reviewed
 */
export async function getUnderReviewPRs(): Promise<PurchaseRequest[]> {
  const result = await listPurchaseRequests({
    status: 'UNDER_REVIEW',
  });
  return result.items;
}

/**
 * Get approved PRs (for RFQ creation)
 * Optionally filter by project
 */
export async function getApprovedPRs(projectId?: string): Promise<PurchaseRequest[]> {
  const result = await listPurchaseRequests({
    status: 'APPROVED',
    projectId,
  });
  return result.items;
}
