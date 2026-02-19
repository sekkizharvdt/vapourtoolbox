/**
 * Proposal Revision Management Service
 *
 * Utilities for working with proposal revisions — latest revision lookup
 * and revision comparison.
 *
 * Note: createProposalRevision and getProposalRevisions live in proposalService.ts
 * as the canonical implementations (rule #16).
 */

import type { Firestore } from 'firebase/firestore';
import type { Proposal } from '@vapour/types';
import { getProposalRevisions } from './proposalService';

/**
 * Get latest revision of a proposal
 *
 * Returns the most recent revision by revision number
 */
export async function getLatestRevision(
  db: Firestore,
  proposalNumber: string
): Promise<Proposal | null> {
  const revisions = await getProposalRevisions(db, proposalNumber);
  return revisions.length > 0 ? revisions[0]! : null;
}

/**
 * Compare two proposal revisions
 *
 * Returns changes between revisions
 */
export function compareRevisions(
  oldRevision: Proposal,
  newRevision: Proposal
): {
  pricingChanged: boolean;
  scopeChanged: boolean;
  termsChanged: boolean;
  deliveryChanged: boolean;
  changes: string[];
} {
  const changes: string[] = [];

  // Check pricing changes (prefer pricingConfig, fall back to legacy pricing)
  const oldTotal =
    oldRevision.pricingConfig?.totalPrice?.amount ?? oldRevision.pricing?.totalAmount?.amount;
  const newTotal =
    newRevision.pricingConfig?.totalPrice?.amount ?? newRevision.pricing?.totalAmount?.amount;
  const pricingChanged = oldTotal !== newTotal;
  if (pricingChanged) {
    changes.push(`Total amount changed from ${oldTotal} to ${newTotal}`);
  }

  // Check scope changes (prefer unifiedScopeMatrix, fall back to scopeOfSupply)
  const scopeChanged =
    JSON.stringify(oldRevision.unifiedScopeMatrix) !==
    JSON.stringify(newRevision.unifiedScopeMatrix);
  if (scopeChanged) {
    changes.push('Scope matrix modified');
  }

  // Check terms changes
  const termsChanged = JSON.stringify(oldRevision.terms) !== JSON.stringify(newRevision.terms);
  if (termsChanged) {
    changes.push('Terms and conditions updated');
  }

  // Check delivery changes
  const deliveryChanged =
    JSON.stringify(oldRevision.deliveryPeriod) !== JSON.stringify(newRevision.deliveryPeriod);
  if (deliveryChanged) {
    changes.push('Delivery schedule modified');
  }

  return {
    pricingChanged,
    scopeChanged,
    termsChanged,
    deliveryChanged,
    changes,
  };
}
