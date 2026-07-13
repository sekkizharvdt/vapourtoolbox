/**
 * Purchase Request Utility Functions
 *
 * Internal utilities for PR number generation and budget validation
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { PurchaseRequest, PurchaseRequestItem, Project } from '@vapour/types';
import { generateCounterBackedNumber } from '../generateProcurementNumber';

/**
 * Pure formatter for PR numbers: PR/YYYY/XXXX.
 * Exported so tests can pin the byte-exact format.
 */
export function formatPRNumber(year: number, sequence: number): string {
  return `PR/${year}/${String(sequence).padStart(4, '0')}`;
}

/**
 * Generate PR number in format: PR/YYYY/XXXX, via the shared counter-backed
 * generator (known-gaps 2.4 — the old read-latest-then-increment was
 * race-prone). On first use for a year the counter seeds from the most
 * recently created PR's sequence so the existing sequence continues.
 *
 * NOTE: functions/src/charterApproval.ts increments the SAME counter doc
 * (`pr-{year}`) with the admin SDK — keep the key and format in sync.
 */
export async function generatePRNumber(): Promise<string> {
  const { db } = getFirebase();
  const year = new Date().getFullYear();

  return generateCounterBackedNumber({
    counterKey: `pr-${year}`,
    counterType: 'purchase_request',
    counterMeta: { year },
    format: (sequence) => formatPRNumber(year, sequence),
    seed: async () => {
      // Latest PR in the current year (same lookup the old generator used).
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31, 23, 59, 59);
      const q = query(
        collection(db, COLLECTIONS.PURCHASE_REQUESTS),
        where('createdAt', '>=', Timestamp.fromDate(yearStart)),
        where('createdAt', '<=', Timestamp.fromDate(yearEnd)),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(q);
      const lastPR = snapshot.docs[0]?.data() as PurchaseRequest | undefined;
      // Last segment works for both old (PR/YYYY/MM/XXXX) and new (PR/YYYY/XXXX) formats
      const parts = typeof lastPR?.number === 'string' ? lastPR.number.split('/') : [];
      const lastSequence = parseInt(parts[parts.length - 1] || '', 10);
      return isNaN(lastSequence) ? 0 : lastSequence;
    },
  });
}

/**
 * Validate that a purchase request fits within project budget
 *
 * This checks:
 * 1. Project exists and has a charter with budget
 * 2. PR estimated cost + existing approved PRs <= total project budget
 *
 * @param pr - Purchase request to validate
 * @param items - PR line items
 * @returns Validation result with details
 */
export async function validateProjectBudget(
  pr: PurchaseRequest,
  items: PurchaseRequestItem[]
): Promise<{ valid: boolean; error?: string; details?: Record<string, string | number> }> {
  const { db } = getFirebase();

  try {
    // Skip validation if no project ID
    if (!pr.projectId) {
      return {
        valid: true,
        details: { message: 'No project linked - budget validation skipped' },
      };
    }

    // Fetch project
    const projectRef = doc(db, COLLECTIONS.PROJECTS, pr.projectId);
    const projectDoc = await getDoc(projectRef);

    if (!projectDoc.exists()) {
      // Project may have been deleted or archived — skip budget validation
      // rather than blocking approval
      return {
        valid: true,
        details: { message: `Project ${pr.projectId} not found - budget validation skipped` },
      };
    }

    const project = projectDoc.data() as Omit<Project, 'id'>;

    // Check if project has charter with budget
    if (!project.charter?.budgetLineItems || project.charter.budgetLineItems.length === 0) {
      return {
        valid: true,
        details: { message: 'No charter budget defined - validation skipped' },
      };
    }

    // Calculate total project budget
    const totalBudget = project.charter.budgetLineItems.reduce(
      (sum, item) => sum + (item.estimatedCost || 0),
      0
    );

    // Calculate actual costs from budget line items (if available)
    const totalActualCost = project.charter.budgetLineItems.reduce(
      (sum, item) => sum + (item.actualCost || 0),
      0
    );

    // Calculate this PR's estimated cost
    const prEstimatedCost = items.reduce((sum, item) => sum + (item.estimatedTotalCost || 0), 0);

    // Query all approved PRs for this project to get committed costs
    const approvedPRsQuery = query(
      collection(db, COLLECTIONS.PURCHASE_REQUESTS),
      where('projectId', '==', pr.projectId),
      where('status', 'in', ['APPROVED', 'UNDER_REVIEW', 'SUBMITTED'])
    );

    const approvedPRsSnapshot = await getDocs(approvedPRsQuery);

    // Filter out the current PR and get IDs of approved PRs
    const approvedPRIds = approvedPRsSnapshot.docs
      .map((prDoc) => ({ id: prDoc.id, data: prDoc.data() as PurchaseRequest }))
      .filter((item) => item.data.number !== pr.number)
      .map((item) => item.id);

    // Batch fetch all PR items in parallel (avoid N+1 queries)
    // Firestore 'in' queries support up to 30 items per query
    let totalCommittedCost = 0;

    if (approvedPRIds.length > 0) {
      const batchSize = 30;
      const itemsBatches = await Promise.all(
        Array.from({ length: Math.ceil(approvedPRIds.length / batchSize) }, (_, i) => {
          const batchIds = approvedPRIds.slice(i * batchSize, (i + 1) * batchSize);
          return getDocs(
            query(
              collection(db, COLLECTIONS.PURCHASE_REQUEST_ITEMS),
              where('purchaseRequestId', 'in', batchIds)
            )
          );
        })
      );

      // Sum up costs from all batches
      for (const itemsSnapshot of itemsBatches) {
        totalCommittedCost += itemsSnapshot.docs.reduce((sum, itemDoc) => {
          const item = itemDoc.data() as PurchaseRequestItem;
          return sum + (item.estimatedTotalCost || 0);
        }, 0);
      }
    }

    // Calculate available budget
    const availableBudget = totalBudget - totalActualCost - totalCommittedCost;

    // Check if PR exceeds available budget
    if (prEstimatedCost > availableBudget) {
      return {
        valid: false,
        error: `Insufficient budget. PR cost: ₹${prEstimatedCost.toFixed(2)}, Available: ₹${availableBudget.toFixed(2)}`,
        details: {
          totalBudget,
          totalActualCost,
          totalCommittedCost,
          availableBudget,
          prEstimatedCost,
          exceedBy: prEstimatedCost - availableBudget,
        },
      };
    }

    return {
      valid: true,
      details: {
        totalBudget,
        totalActualCost,
        totalCommittedCost,
        availableBudget,
        prEstimatedCost,
        remainingAfterPR: availableBudget - prEstimatedCost,
      },
    };
  } catch (error) {
    return {
      valid: false,
      error: `Budget validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
