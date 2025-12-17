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

/**
 * Generate PR number in format: PR/YYYY/MM/XXXX
 */
export async function generatePRNumber(): Promise<string> {
  const { db } = getFirebase();

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // Get count of PRs in current month
  const monthStart = new Date(year, now.getMonth(), 1);
  const monthEnd = new Date(year, now.getMonth() + 1, 0, 23, 59, 59);

  const q = query(
    collection(db, COLLECTIONS.PURCHASE_REQUESTS),
    where('createdAt', '>=', Timestamp.fromDate(monthStart)),
    where('createdAt', '<=', Timestamp.fromDate(monthEnd)),
    orderBy('createdAt', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);

  let sequence = 1;
  if (!snapshot.empty && snapshot.docs[0]) {
    const lastPR = snapshot.docs[0].data() as PurchaseRequest;
    // Extract sequence from last PR number (PR/2025/11/0001 -> 0001)
    const lastNumber = lastPR.number;
    if (lastNumber && typeof lastNumber === 'string') {
      const parts = lastNumber.split('/');
      if (parts.length >= 4) {
        const lastSequenceStr = parts[3]; // PR/YYYY/MM/XXXX -> index 3
        const lastSequence = parseInt(lastSequenceStr || '0', 10);
        if (!isNaN(lastSequence)) {
          sequence = lastSequence + 1;
        }
      }
    }
  }

  const sequenceStr = String(sequence).padStart(4, '0');
  return `PR/${year}/${month}/${sequenceStr}`;
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
      return {
        valid: false,
        error: `Project ${pr.projectId} not found`,
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
