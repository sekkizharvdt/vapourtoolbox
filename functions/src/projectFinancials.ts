/**
 * Project Financials Cloud Functions
 *
 * Updates project financials when accounting transactions change.
 * This implements the Accounting → Projects integration.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const db = getFirestore();

// Collections
const COST_CENTRES_COLLECTION = 'costCentres';
const PROJECTS_COLLECTION = 'projects';
const TRANSACTIONS_COLLECTION = 'transactions';

/**
 * Transaction types that represent actual expenses
 */
const EXPENSE_TRANSACTION_TYPES = ['VENDOR_BILL', 'VENDOR_PAYMENT', 'EXPENSE_CLAIM'];

/**
 * Transaction statuses that represent confirmed expenses
 */
const POSTED_STATUSES = ['APPROVED', 'POSTED'];

/**
 * Calculate total actual spent for a cost centre from transactions
 */
async function calculateCostCentreActualSpent(costCentreId: string): Promise<number> {
  try {
    const transactionsSnapshot = await db
      .collection(TRANSACTIONS_COLLECTION)
      .where('costCentreId', '==', costCentreId)
      .where('type', 'in', EXPENSE_TRANSACTION_TYPES)
      .where('status', 'in', POSTED_STATUSES)
      .get();

    let totalActualSpent = 0;
    transactionsSnapshot.forEach((doc) => {
      const data = doc.data();
      const amount = data.totalAmount || data.amount || 0;
      totalActualSpent += amount;
    });

    return totalActualSpent;
  } catch (error) {
    logger.error('[calculateCostCentreActualSpent] Error:', { costCentreId, error });
    return 0;
  }
}

/**
 * Update cost centre when transactions change
 */
async function updateCostCentre(costCentreId: string, actualSpent: number): Promise<void> {
  try {
    const costCentreRef = db.collection(COST_CENTRES_COLLECTION).doc(costCentreId);
    const costCentreSnap = await costCentreRef.get();

    if (!costCentreSnap.exists) {
      // Maybe costCentreId is actually a projectId
      // Find cost centre by projectId
      const costCentreQuery = await db
        .collection(COST_CENTRES_COLLECTION)
        .where('projectId', '==', costCentreId)
        .limit(1)
        .get();

      if (!costCentreQuery.empty) {
        const actualCostCentreDoc = costCentreQuery.docs[0];
        if (actualCostCentreDoc) {
          const budgetAmount = actualCostCentreDoc.data().budgetAmount;
          const variance = budgetAmount !== null ? budgetAmount - actualSpent : null;

          await actualCostCentreDoc.ref.update({
            actualSpent,
            variance,
            updatedAt: Timestamp.now(),
          });

          logger.info('[updateCostCentre] Updated cost centre by projectId', {
            costCentreId: actualCostCentreDoc.id,
            projectId: costCentreId,
            actualSpent,
            variance,
          });
        }
      }
      return;
    }

    // Update cost centre directly
    const costCentreData = costCentreSnap.data();
    const budgetAmount = costCentreData?.budgetAmount;
    const variance = budgetAmount !== null ? budgetAmount - actualSpent : null;

    await costCentreRef.update({
      actualSpent,
      variance,
      updatedAt: Timestamp.now(),
    });

    logger.info('[updateCostCentre] Updated cost centre', {
      costCentreId,
      actualSpent,
      variance,
    });
  } catch (error) {
    logger.error('[updateCostCentre] Error:', { costCentreId, error });
  }
}

/**
 * Update project budget actuals when transactions change
 */
async function updateProjectBudget(projectId: string, actualExpenses: number): Promise<void> {
  try {
    const projectRef = db.collection(PROJECTS_COLLECTION).doc(projectId);
    const projectSnap = await projectRef.get();

    if (!projectSnap.exists) {
      logger.warn('[updateProjectBudget] Project not found', { projectId });
      return;
    }

    const projectData = projectSnap.data();
    const budget = projectData?.budget;

    if (!budget) {
      // No budget set, nothing to update
      return;
    }

    // Update budget.actual
    await projectRef.update({
      'budget.actual': {
        amount: actualExpenses,
        currency: budget.currency || 'INR',
      },
      updatedAt: Timestamp.now(),
    });

    logger.info('[updateProjectBudget] Updated project budget actuals', {
      projectId,
      actualExpenses,
    });

    // Check budget thresholds and create alerts if needed
    const estimatedAmount = budget.estimated?.amount || 0;
    if (estimatedAmount > 0) {
      const utilizationPercent = (actualExpenses / estimatedAmount) * 100;

      if (utilizationPercent >= 100) {
        logger.warn('[updateProjectBudget] Budget exceeded!', {
          projectId,
          utilizationPercent,
        });
        // TODO: Create task notification for budget exceeded
      } else if (utilizationPercent >= 90) {
        logger.warn('[updateProjectBudget] Budget at 90%', {
          projectId,
          utilizationPercent,
        });
        // TODO: Create task notification for budget warning
      }
    }
  } catch (error) {
    logger.error('[updateProjectBudget] Error:', { projectId, error });
  }
}

/**
 * Cloud Function: Update project financials when transaction is written
 *
 * Triggers on create, update, or delete of transactions.
 * Recalculates and updates:
 * 1. Cost centre actualSpent and variance
 * 2. Project budget actual amounts
 */
export const onTransactionWriteUpdateProjectFinancials = onDocumentWritten(
  {
    document: 'transactions/{transactionId}',
    region: 'us-central1',
  },
  async (event) => {
    const transactionId = event.params.transactionId;

    // Get before and after data
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    // Determine which costCentreId to process
    const beforeCostCentreId = before?.costCentreId as string | undefined;
    const afterCostCentreId = after?.costCentreId as string | undefined;

    // Skip if no cost centre is involved
    if (!beforeCostCentreId && !afterCostCentreId) {
      logger.debug('[onTransactionWriteUpdateProjectFinancials] No costCentreId, skipping', {
        transactionId,
      });
      return;
    }

    // Get relevant transaction types and statuses
    const beforeType = before?.type as string | undefined;
    const afterType = after?.type as string | undefined;
    const beforeStatus = before?.status as string | undefined;
    const afterStatus = after?.status as string | undefined;

    // Check if this transaction affects expense calculations
    const isRelevantBefore =
      beforeType &&
      EXPENSE_TRANSACTION_TYPES.includes(beforeType) &&
      beforeStatus &&
      POSTED_STATUSES.includes(beforeStatus);
    const isRelevantAfter =
      afterType &&
      EXPENSE_TRANSACTION_TYPES.includes(afterType) &&
      afterStatus &&
      POSTED_STATUSES.includes(afterStatus);

    // Skip if transaction doesn't affect expenses (neither before nor after is relevant)
    if (!isRelevantBefore && !isRelevantAfter) {
      logger.debug(
        '[onTransactionWriteUpdateProjectFinancials] Not an expense transaction, skipping',
        {
          transactionId,
          beforeType,
          afterType,
          beforeStatus,
          afterStatus,
        }
      );
      return;
    }

    logger.info('[onTransactionWriteUpdateProjectFinancials] Processing transaction change', {
      transactionId,
      beforeCostCentreId,
      afterCostCentreId,
      change: !before ? 'created' : !after ? 'deleted' : 'updated',
    });

    // Collect unique costCentreIds to update
    const costCentreIdsToUpdate = new Set<string>();
    if (beforeCostCentreId) costCentreIdsToUpdate.add(beforeCostCentreId);
    if (afterCostCentreId) costCentreIdsToUpdate.add(afterCostCentreId);

    // Process each affected cost centre
    for (const costCentreId of costCentreIdsToUpdate) {
      try {
        // Recalculate actual spent from all transactions
        const actualSpent = await calculateCostCentreActualSpent(costCentreId);

        // Update cost centre
        await updateCostCentre(costCentreId, actualSpent);

        // Update project budget (costCentreId is often the projectId)
        await updateProjectBudget(costCentreId, actualSpent);

        logger.info('[onTransactionWriteUpdateProjectFinancials] Updated financials', {
          transactionId,
          costCentreId,
          actualSpent,
        });
      } catch (error) {
        logger.error('[onTransactionWriteUpdateProjectFinancials] Error updating financials', {
          transactionId,
          costCentreId,
          error,
        });
        // Continue with other cost centres
      }
    }
  }
);

/**
 * Cloud Function: Sync project budget to cost centre when project is updated
 *
 * When project budget is changed, update the linked cost centre's budget
 */
export const onProjectBudgetChange = onDocumentWritten(
  {
    document: 'projects/{projectId}',
    region: 'us-central1',
  },
  async (event) => {
    const projectId = event.params.projectId;

    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    // Skip deletes
    if (!after) {
      return;
    }

    // Check if budget changed
    const beforeBudget = before?.budget?.estimated?.amount;
    const afterBudget = after?.budget?.estimated?.amount;

    if (beforeBudget === afterBudget) {
      return;
    }

    logger.info('[onProjectBudgetChange] Project budget changed', {
      projectId,
      beforeBudget,
      afterBudget,
    });

    try {
      // Find cost centre for this project
      const costCentreQuery = await db
        .collection(COST_CENTRES_COLLECTION)
        .where('projectId', '==', projectId)
        .limit(1)
        .get();

      if (costCentreQuery.empty) {
        logger.info('[onProjectBudgetChange] No cost centre found for project', { projectId });
        return;
      }

      const costCentreDoc = costCentreQuery.docs[0];
      if (!costCentreDoc) {
        return;
      }

      const costCentreData = costCentreDoc.data();
      const actualSpent = costCentreData.actualSpent || 0;
      const newVariance = afterBudget !== null ? afterBudget - actualSpent : null;

      // Update cost centre budget
      await costCentreDoc.ref.update({
        budgetAmount: afterBudget || null,
        variance: newVariance,
        updatedAt: Timestamp.now(),
      });

      logger.info('[onProjectBudgetChange] Updated cost centre budget', {
        projectId,
        costCentreId: costCentreDoc.id,
        budgetAmount: afterBudget,
        variance: newVariance,
      });
    } catch (error) {
      logger.error('[onProjectBudgetChange] Error updating cost centre', {
        projectId,
        error,
      });
    }
  }
);
