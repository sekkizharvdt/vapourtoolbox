/**
 * Bank Reconciliation CRUD Operations
 *
 * Basic operations for bank statements and transactions
 */

import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { BankStatement, BankTransaction } from '@vapour/types';

/**
 * Create a new bank statement
 */
export async function createBankStatement(
  db: Firestore,
  statementData: Omit<BankStatement, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'uploadedBy'>,
  userId: string
): Promise<string> {
  try {
    const now = Timestamp.now();
    const statement: Omit<BankStatement, 'id'> = {
      ...statementData,
      status: 'DRAFT',
      uploadedBy: userId,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, 'bankStatements'), statement);
    return docRef.id;
  } catch (error) {
    console.error('[createBankStatement] Error:', error);
    throw new Error('Failed to create bank statement');
  }
}

/**
 * Add bank transactions to a statement (bulk import)
 */
export async function addBankTransactions(
  db: Firestore,
  statementId: string,
  transactions: Omit<BankTransaction, 'id' | 'createdAt' | 'updatedAt' | 'isReconciled'>[]
): Promise<void> {
  try {
    const batch = writeBatch(db);
    const now = Timestamp.now();

    transactions.forEach((txn) => {
      const txnRef = doc(collection(db, 'bankTransactions'));
      batch.set(txnRef, {
        ...txn,
        statementId,
        isReconciled: false,
        createdAt: now,
        updatedAt: now,
      });
    });

    await batch.commit();
  } catch (error) {
    console.error('[addBankTransactions] Error:', error);
    throw new Error('Failed to add bank transactions');
  }
}

/**
 * Get unmatched accounting transactions for a bank account and period
 */
export async function getUnmatchedAccountingTransactions(
  db: Firestore,
  accountId: string,
  startDate: Timestamp,
  endDate: Timestamp
): Promise<unknown[]> {
  try {
    const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
    const q = query(
      transactionsRef,
      where('bankAccountId', '==', accountId),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      where('status', '==', 'POSTED'),
      orderBy('date', 'desc')
    );

    const snapshot = await getDocs(q);
    const transactions: unknown[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      // Only include if not already reconciled
      if (!data.isReconciled) {
        transactions.push({
          id: doc.id,
          ...data,
        });
      }
    });

    return transactions;
  } catch (error) {
    console.error('[getUnmatchedAccountingTransactions] Error:', error);
    throw error;
  }
}

/**
 * Get unmatched bank transactions for a statement
 */
export async function getUnmatchedBankTransactions(
  db: Firestore,
  statementId: string
): Promise<BankTransaction[]> {
  try {
    const transactionsRef = collection(db, 'bankTransactions');
    const q = query(
      transactionsRef,
      where('statementId', '==', statementId),
      where('isReconciled', '==', false),
      orderBy('transactionDate', 'desc')
    );

    const snapshot = await getDocs(q);
    const transactions: BankTransaction[] = [];

    snapshot.forEach((doc) => {
      transactions.push({
        id: doc.id,
        ...doc.data(),
      } as unknown as BankTransaction);
    });

    return transactions;
  } catch (error) {
    console.error('[getUnmatchedBankTransactions] Error:', error);
    throw error;
  }
}
