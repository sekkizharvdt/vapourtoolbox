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

    const docRef = await addDoc(collection(db, COLLECTIONS.BANK_STATEMENTS), statement);
    return docRef.id;
  } catch (error) {
    throw new Error(
      `Failed to create bank statement: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
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
      const txnRef = doc(collection(db, COLLECTIONS.BANK_TRANSACTIONS));
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
    throw new Error(
      `Failed to add bank transactions: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Accounting transaction with reconciliation status
 */
interface AccountingTransaction {
  id: string;
  bankAccountId: string;
  date: Timestamp;
  status: string;
  isReconciled?: boolean;
  amount?: number;
  description?: string;
  type?: string;
  reference?: string;
}

export async function getUnmatchedAccountingTransactions(
  db: Firestore,
  accountId: string,
  startDate: Timestamp,
  endDate: Timestamp
): Promise<AccountingTransaction[]> {
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
  const transactions: AccountingTransaction[] = [];

  snapshot.forEach((docSnapshot) => {
    const data = docSnapshot.data();
    // Only include if not already reconciled
    if (!data.isReconciled) {
      transactions.push({
        id: docSnapshot.id,
        bankAccountId: data.bankAccountId,
        date: data.date,
        status: data.status,
        isReconciled: data.isReconciled,
        amount: data.amount,
        description: data.description,
        type: data.type,
        reference: data.reference,
      });
    }
  });

  return transactions;
}

/**
 * Get unmatched bank transactions for a statement
 */
export async function getUnmatchedBankTransactions(
  db: Firestore,
  statementId: string
): Promise<BankTransaction[]> {
  const transactionsRef = collection(db, COLLECTIONS.BANK_TRANSACTIONS);
  const q = query(
    transactionsRef,
    where('statementId', '==', statementId),
    where('isReconciled', '==', false),
    orderBy('transactionDate', 'desc')
  );

  const snapshot = await getDocs(q);
  const transactions: BankTransaction[] = [];

  snapshot.forEach((docSnapshot) => {
    const data = docSnapshot.data();
    transactions.push({
      id: docSnapshot.id,
      statementId: data.statementId,
      accountId: data.accountId,
      transactionDate: data.transactionDate,
      valueDate: data.valueDate,
      description: data.description,
      reference: data.reference,
      debitAmount: data.debitAmount ?? data.debit ?? 0,
      creditAmount: data.creditAmount ?? data.credit ?? 0,
      balance: data.balance,
      isReconciled: data.isReconciled,
      reconciledWith: data.reconciledWith,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  });

  return transactions;
}
