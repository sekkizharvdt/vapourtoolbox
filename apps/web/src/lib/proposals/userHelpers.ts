/**
 * Proposal User Helpers
 *
 * Helper functions for finding users with specific permissions
 * for task assignment in proposal workflows
 */

import { collection, query, where, getDocs, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { PERMISSION_FLAGS, hasPermission } from '@vapour/constants';
import type { User } from '@vapour/types';
import { createLogger } from '@vapour/logger';
import { getUsersWithPermission } from '@/lib/auth/userLookup';

const logger = createLogger({ context: 'proposalUserHelpers' });

// Canonical implementation lives in @/lib/auth/userLookup (rule 16/32);
// re-exported here so existing proposal-module imports keep working.
export { getUsersWithPermission };

/**
 * Get users who can approve proposals (id-only).
 *
 * Used internally; the picker UI uses {@link getProposalApproverCandidates}
 * for richer user info.
 */
export async function getProposalApprovers(db: Firestore, tenantId: string): Promise<string[]> {
  return getUsersWithPermission(db, tenantId, PERMISSION_FLAGS.MANAGE_PROPOSALS);
}

/**
 * Approver candidate — minimum fields the submit-for-approval dialog needs.
 */
export interface ProposalApproverCandidate {
  id: string;
  displayName: string;
  email: string;
}

/**
 * Get users who can approve proposals, with display name + email so the
 * submit-for-approval dialog can render a useful picker. The submitter is
 * excluded (you can't be your own approver — the server-side
 * preventSelfApproval guard would reject the call anyway).
 */
export async function getProposalApproverCandidates(
  db: Firestore,
  tenantId: string,
  excludeUserId?: string
): Promise<ProposalApproverCandidate[]> {
  try {
    const usersRef = collection(db, COLLECTIONS.USERS);
    const q = query(usersRef, where('tenantId', '==', tenantId), where('isActive', '==', true));
    const snapshot = await getDocs(q);
    const candidates: ProposalApproverCandidate[] = [];
    snapshot.forEach((d) => {
      const u = d.data() as User;
      if (!u.permissions || !hasPermission(u.permissions, PERMISSION_FLAGS.MANAGE_PROPOSALS)) {
        return;
      }
      if (excludeUserId && d.id === excludeUserId) return;
      candidates.push({
        id: d.id,
        displayName: u.displayName || u.email || d.id,
        email: u.email || '',
      });
    });
    candidates.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return candidates;
  } catch (error) {
    logger.error('Error getting proposal approver candidates', { tenantId, error });
    return [];
  }
}
