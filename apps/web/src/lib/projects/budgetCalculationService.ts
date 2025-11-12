/**
 * Budget Calculation Service
 *
 * Calculates actual costs for project budget line items by aggregating
 * accounting transactions linked to the project.
 */

import {
  collection,
  query,
  where,
  getDocs,
  type Firestore,
  type DocumentData,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'budgetCalculationService' });

/**
 * Transaction types that represent actual expenses
 */
const EXPENSE_TRANSACTION_TYPES = ['VENDOR_BILL', 'VENDOR_PAYMENT', 'EXPENSE_CLAIM'];

/**
 * Transaction statuses that should be included in actual cost calculation
 */
const POSTED_STATUSES = ['POSTED', 'PAID', 'PARTIALLY_PAID'];

/**
 * Budget line item actual cost data
 */
export interface BudgetLineItemActualCost {
  budgetLineItemId: string;
  actualCost: number;
  transactionCount: number;
}

/**
 * Calculate actual costs for all budget line items in a project
 *
 * This function:
 * 1. Queries all posted expense transactions for the project
 * 2. Filters by expense transaction types (bills, payments, expenses)
 * 3. Aggregates amounts by budgetLineItemId
 * 4. Returns a map of budgetLineItemId -> actualCost
 *
 * @param db - Firestore instance
 * @param projectId - Project ID (used as costCentreId in transactions)
 * @returns Map of budget line item IDs to their calculated actual costs
 */
export async function calculateProjectBudgetActualCosts(
  db: Firestore,
  projectId: string
): Promise<Map<string, BudgetLineItemActualCost>> {
  try {
    logger.info('Calculating actual costs for project', { projectId });

    // Query all transactions for this project
    const transactionsQuery = query(
      collection(db, COLLECTIONS.TRANSACTIONS),
      where('costCentreId', '==', projectId),
      where('type', 'in', EXPENSE_TRANSACTION_TYPES),
      where('status', 'in', POSTED_STATUSES)
    );

    const transactionsSnapshot = await getDocs(transactionsQuery);

    // Aggregate costs by budget line item
    const costMap = new Map<string, BudgetLineItemActualCost>();

    transactionsSnapshot.forEach((doc) => {
      const transaction = doc.data() as DocumentData;
      const budgetLineItemId = transaction.budgetLineItemId as string | undefined;
      const amount = transaction.totalAmount || transaction.amount || 0;

      // Skip transactions not linked to a budget line item
      if (!budgetLineItemId) {
        logger.debug('Transaction not linked to budget line item', {
          transactionId: doc.id,
          transactionNumber: transaction.transactionNumber,
        });
        return;
      }

      // Add to existing or create new entry
      const existing = costMap.get(budgetLineItemId);
      if (existing) {
        existing.actualCost += amount;
        existing.transactionCount += 1;
      } else {
        costMap.set(budgetLineItemId, {
          budgetLineItemId,
          actualCost: amount,
          transactionCount: 1,
        });
      }
    });

    logger.info('Calculated actual costs', {
      projectId,
      budgetLineItemCount: costMap.size,
      transactionCount: transactionsSnapshot.size,
    });

    return costMap;
  } catch (error) {
    logger.error('Error calculating project budget actual costs', {
      projectId,
      error,
    });
    throw new Error(
      `Failed to calculate actual costs: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Calculate total actual cost for a project across all budget line items
 *
 * @param db - Firestore instance
 * @param projectId - Project ID
 * @returns Total actual cost for the project
 */
export async function calculateProjectTotalActualCost(
  db: Firestore,
  projectId: string
): Promise<number> {
  try {
    const costMap = await calculateProjectBudgetActualCosts(db, projectId);

    const totalActualCost = Array.from(costMap.values()).reduce(
      (sum, item) => sum + item.actualCost,
      0
    );

    logger.info('Calculated total actual cost', {
      projectId,
      totalActualCost,
    });

    return totalActualCost;
  } catch (error) {
    logger.error('Error calculating project total actual cost', {
      projectId,
      error,
    });
    throw error;
  }
}

/**
 * Calculate actual cost for a specific budget line item
 *
 * @param db - Firestore instance
 * @param projectId - Project ID
 * @param budgetLineItemId - Budget line item ID
 * @returns Actual cost for the specific budget line item
 */
export async function calculateBudgetLineItemActualCost(
  db: Firestore,
  projectId: string,
  budgetLineItemId: string
): Promise<number> {
  try {
    logger.info('Calculating actual cost for budget line item', {
      projectId,
      budgetLineItemId,
    });

    // Query transactions for this project and budget line item
    const transactionsQuery = query(
      collection(db, COLLECTIONS.TRANSACTIONS),
      where('costCentreId', '==', projectId),
      where('budgetLineItemId', '==', budgetLineItemId),
      where('type', 'in', EXPENSE_TRANSACTION_TYPES),
      where('status', 'in', POSTED_STATUSES)
    );

    const transactionsSnapshot = await getDocs(transactionsQuery);

    // Sum up the amounts
    let actualCost = 0;
    transactionsSnapshot.forEach((doc) => {
      const transaction = doc.data() as DocumentData;
      const amount = transaction.totalAmount || transaction.amount || 0;
      actualCost += amount;
    });

    logger.info('Calculated actual cost for budget line item', {
      projectId,
      budgetLineItemId,
      actualCost,
      transactionCount: transactionsSnapshot.size,
    });

    return actualCost;
  } catch (error) {
    logger.error('Error calculating budget line item actual cost', {
      projectId,
      budgetLineItemId,
      error,
    });
    throw new Error(
      `Failed to calculate actual cost: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
