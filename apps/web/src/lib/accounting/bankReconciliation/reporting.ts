/**
 * Bank Reconciliation Reporting
 *
 * Statistics, reports, and reconciliation completion
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import { createLogger } from '@vapour/logger';
import { COLLECTIONS } from '@vapour/firebase';
import type {
  BankStatement,
  BankTransaction,
  ReconciliationStats,
  ReconciliationReport,
  BankStatementStatus,
} from '@vapour/types';
import { getUnmatchedAccountingTransactions } from './crud';

const logger = createLogger({ context: 'bankReconciliation/reporting' });

/**
 * Get reconciliation statistics for a statement
 */
export async function getReconciliationStats(
  db: Firestore,
  statementId: string
): Promise<ReconciliationStats> {
  try {
    // Get all bank transactions
    const bankTxnsRef = collection(db, COLLECTIONS.BANK_TRANSACTIONS);
    const bankQ = query(bankTxnsRef, where('statementId', '==', statementId));
    const bankSnapshot = await getDocs(bankQ);

    let totalBankTransactions = 0;
    let reconciledBankTransactions = 0;
    let totalBankAmount = 0;
    let reconciledBankAmount = 0;

    bankSnapshot.forEach((doc) => {
      const txn = doc.data() as BankTransaction;
      totalBankTransactions++;
      const amount = txn.debitAmount || txn.creditAmount;
      totalBankAmount += amount;

      if (txn.isReconciled) {
        reconciledBankTransactions++;
        reconciledBankAmount += amount;
      }
    });

    // Get statement for accounting transactions
    const statementDoc = await getDoc(doc(db, COLLECTIONS.BANK_STATEMENTS, statementId));
    if (!statementDoc.exists()) {
      throw new Error('Bank statement not found');
    }

    const statement = statementDoc.data() as BankStatement;
    const accountingTxns = await getUnmatchedAccountingTransactions(
      db,
      statement.accountId,
      statement.startDate,
      statement.endDate
    );

    const stats: ReconciliationStats = {
      statementId,
      totalBankTransactions,
      reconciledBankTransactions,
      unreconciledBankTransactions: totalBankTransactions - reconciledBankTransactions,
      totalAccountingTransactions: accountingTxns.length,
      reconciledAccountingTransactions: 0, // Will be calculated
      unreconciledAccountingTransactions: accountingTxns.length,
      matchedPairs: reconciledBankTransactions,
      suggestedMatches: 0, // Will be calculated separately
      amountDifference: totalBankAmount - reconciledBankAmount,
      percentageComplete:
        totalBankTransactions > 0 ? (reconciledBankTransactions / totalBankTransactions) * 100 : 0,
    };

    return stats;
  } catch (error) {
    logger.error('getReconciliationStats failed', { statementId, error });
    throw error;
  }
}

/**
 * Generate reconciliation report
 */
export async function generateReconciliationReport(
  db: Firestore,
  statementId: string,
  userId: string
): Promise<ReconciliationReport> {
  try {
    const stats = await getReconciliationStats(db, statementId);
    const statementDoc = await getDoc(doc(db, COLLECTIONS.BANK_STATEMENTS, statementId));

    if (!statementDoc.exists()) {
      throw new Error('Bank statement not found');
    }

    const statement = statementDoc.data() as BankStatement;
    const now = Timestamp.now();

    const report: ReconciliationReport = {
      statementId,
      accountId: statement.accountId,
      accountName: statement.accountName,
      startDate: statement.startDate,
      endDate: statement.endDate,
      reportDate: now,
      openingBalance: statement.openingBalance,
      closingBalance: statement.closingBalance,
      bookBalance: 0, // Calculate from accounting records
      bankBalance: statement.closingBalance,
      difference: 0, // bankBalance - bookBalance
      totalTransactions: stats.totalBankTransactions,
      reconciledCount: stats.reconciledBankTransactions,
      unreconciledCount: stats.unreconciledBankTransactions,
      reconciliationPercentage: stats.percentageComplete,
      unreconciledBankTransactions: stats.unreconciledBankTransactions,
      unreconciledBankAmount: stats.amountDifference,
      unreconciledAccountingTransactions: stats.unreconciledAccountingTransactions,
      unreconciledAccountingAmount: 0, // Calculate from unmatched transactions
      status: statement.status,
      generatedBy: userId,
      createdAt: now,
    };

    // Save report to database
    await addDoc(collection(db, COLLECTIONS.RECONCILIATION_REPORTS), report);

    return report;
  } catch (error) {
    logger.error('generateReconciliationReport failed', { statementId, error });
    throw error;
  }
}

/**
 * Mark statement as reconciled
 */
export async function markStatementAsReconciled(
  db: Firestore,
  statementId: string,
  userId: string
): Promise<void> {
  try {
    const stats = await getReconciliationStats(db, statementId);

    // Check if fully reconciled
    if (stats.unreconciledBankTransactions > 0) {
      throw new Error(
        `Cannot mark as reconciled: ${stats.unreconciledBankTransactions} transactions are still unmatched`
      );
    }

    await updateDoc(doc(db, COLLECTIONS.BANK_STATEMENTS, statementId), {
      status: 'RECONCILED' as BankStatementStatus,
      reconciledAt: Timestamp.now(),
      reconciledBy: userId,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    logger.error('markStatementAsReconciled failed', { statementId, error });
    throw error;
  }
}
