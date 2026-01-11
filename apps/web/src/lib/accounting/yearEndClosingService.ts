/**
 * Year-End Closing Service
 *
 * Automates the year-end closing process for accounting:
 * 1. Validates all periods are closed
 * 2. Calculates revenue and expense account balances
 * 3. Creates closing journal entries to zero out income/expense accounts
 * 4. Transfers net income/loss to retained earnings
 * 5. Updates fiscal year status
 *
 * The closing journal entry:
 * - Debits all INCOME accounts (to zero them)
 * - Credits all EXPENSE accounts (to zero them)
 * - The difference goes to Retained Earnings (debit if profit, credit if loss)
 */

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  runTransaction,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import type {
  FiscalYear,
  AccountingPeriod,
  Account,
  YearEndClosingEntry,
  ClosedAccountBalance,
  LedgerEntry,
} from '@vapour/types';
import { generateTransactionNumber } from './transactionNumberGenerator';
import { logAuditEvent, createAuditContext } from '@/lib/audit';

const logger = createLogger({ context: 'yearEndClosingService' });

// Default retained earnings account code (Indian COA standard)
const RETAINED_EARNINGS_CODE = '3100';

/**
 * Error thrown when year-end closing validation fails
 */
export class YearEndClosingError extends Error {
  constructor(
    message: string,
    public readonly errorCode: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'YearEndClosingError';
  }
}

/**
 * Input for creating a year-end closing
 */
export interface CreateYearEndClosingInput {
  fiscalYearId: string;
  userId: string;
  userName: string;
  notes?: string;
}

/**
 * Result of year-end closing readiness check
 */
export interface YearEndClosingReadiness {
  isReady: boolean;
  fiscalYear: FiscalYear | null;
  openPeriods: AccountingPeriod[];
  lockedPeriods: AccountingPeriod[];
  closedPeriods: AccountingPeriod[];
  retainedEarningsAccount: Account | null;
  errors: string[];
  warnings: string[];
}

/**
 * Preview of the year-end closing entry
 */
export interface YearEndClosingPreview {
  fiscalYear: FiscalYear;
  revenueAccounts: ClosedAccountBalance[];
  expenseAccounts: ClosedAccountBalance[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  retainedEarningsAccount: Account;
  closingEntries: LedgerEntry[];
}

/**
 * Result of year-end closing operation
 */
export interface YearEndClosingResult {
  success: boolean;
  yearEndClosingEntryId?: string;
  journalEntryId?: string;
  journalEntryNumber?: string;
  netIncome?: number;
  error?: string;
}

/**
 * Find the retained earnings account
 */
async function findRetainedEarningsAccount(db: Firestore): Promise<Account | null> {
  const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);

  // Try to find by code first
  const codeQuery = query(accountsRef, where('code', '==', RETAINED_EARNINGS_CODE));
  const codeSnapshot = await getDocs(codeQuery);

  if (!codeSnapshot.empty && codeSnapshot.docs[0]) {
    return docToTyped<Account>(codeSnapshot.docs[0].id, codeSnapshot.docs[0].data());
  }

  // Fallback: find by category
  const categoryQuery = query(
    accountsRef,
    where('accountCategory', '==', 'RETAINED_EARNINGS'),
    where('isActive', '==', true)
  );
  const categorySnapshot = await getDocs(categoryQuery);

  if (!categorySnapshot.empty && categorySnapshot.docs[0]) {
    return docToTyped<Account>(categorySnapshot.docs[0].id, categorySnapshot.docs[0].data());
  }

  // Fallback: find any equity account with "retained" in name
  const allEquityQuery = query(accountsRef, where('accountType', '==', 'EQUITY'));
  const equitySnapshot = await getDocs(allEquityQuery);

  for (const docSnapshot of equitySnapshot.docs) {
    const account = docSnapshot.data() as Account;
    if (account.name.toLowerCase().includes('retained') && account.isActive) {
      return docToTyped<Account>(docSnapshot.id, account);
    }
  }

  return null;
}

/**
 * Get all accounts that need to be closed (INCOME and EXPENSE with non-zero balance)
 */
async function getAccountsToClose(
  db: Firestore
): Promise<{
  revenueAccounts: ClosedAccountBalance[];
  expenseAccounts: ClosedAccountBalance[];
  totalRevenue: number;
  totalExpenses: number;
}> {
  const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);
  const accountsSnapshot = await getDocs(accountsRef);

  const revenueAccounts: ClosedAccountBalance[] = [];
  const expenseAccounts: ClosedAccountBalance[] = [];
  let totalRevenue = 0;
  let totalExpenses = 0;

  accountsSnapshot.docs.forEach((docSnapshot) => {
    const account = docSnapshot.data() as Account;

    // Only process active accounts with balances
    if (!account.isActive || account.currentBalance === 0) return;

    if (account.accountType === 'INCOME') {
      const balance: ClosedAccountBalance = {
        accountId: docSnapshot.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: 'INCOME',
        closingBalance: account.currentBalance,
      };
      revenueAccounts.push(balance);
      totalRevenue += account.currentBalance;
    } else if (account.accountType === 'EXPENSE') {
      const balance: ClosedAccountBalance = {
        accountId: docSnapshot.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: 'EXPENSE',
        closingBalance: account.currentBalance,
      };
      expenseAccounts.push(balance);
      totalExpenses += account.currentBalance;
    }
  });

  // Sort by account code
  revenueAccounts.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  expenseAccounts.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  return { revenueAccounts, expenseAccounts, totalRevenue, totalExpenses };
}

/**
 * Generate closing journal entries
 *
 * Closing entry logic:
 * - Revenue accounts (normally credit balance): DEBIT to zero them out
 * - Expense accounts (normally debit balance): CREDIT to zero them out
 * - Net difference goes to Retained Earnings:
 *   - If profit (revenue > expenses): CREDIT Retained Earnings
 *   - If loss (expenses > revenue): DEBIT Retained Earnings
 */
function generateClosingEntries(
  revenueAccounts: ClosedAccountBalance[],
  expenseAccounts: ClosedAccountBalance[],
  retainedEarningsAccount: Account
): LedgerEntry[] {
  const entries: LedgerEntry[] = [];

  // Close revenue accounts (debit to zero credit balances)
  revenueAccounts.forEach((account) => {
    if (account.closingBalance !== 0) {
      entries.push({
        accountId: account.accountId,
        accountCode: account.accountCode,
        accountName: account.accountName,
        debit: account.closingBalance, // Debit to close credit balance
        credit: 0,
        description: `Year-end closing - Close ${account.accountName}`,
      });
    }
  });

  // Close expense accounts (credit to zero debit balances)
  expenseAccounts.forEach((account) => {
    if (account.closingBalance !== 0) {
      entries.push({
        accountId: account.accountId,
        accountCode: account.accountCode,
        accountName: account.accountName,
        debit: 0,
        credit: account.closingBalance, // Credit to close debit balance
        description: `Year-end closing - Close ${account.accountName}`,
      });
    }
  });

  // Calculate net income
  const totalRevenue = revenueAccounts.reduce((sum, acc) => sum + acc.closingBalance, 0);
  const totalExpenses = expenseAccounts.reduce((sum, acc) => sum + acc.closingBalance, 0);
  const netIncome = totalRevenue - totalExpenses;

  // Add retained earnings entry
  if (netIncome > 0) {
    // Profit: Credit retained earnings
    entries.push({
      accountId: retainedEarningsAccount.id,
      accountCode: retainedEarningsAccount.code,
      accountName: retainedEarningsAccount.name,
      debit: 0,
      credit: netIncome,
      description: 'Year-end closing - Transfer net profit to Retained Earnings',
    });
  } else if (netIncome < 0) {
    // Loss: Debit retained earnings
    entries.push({
      accountId: retainedEarningsAccount.id,
      accountCode: retainedEarningsAccount.code,
      accountName: retainedEarningsAccount.name,
      debit: Math.abs(netIncome),
      credit: 0,
      description: 'Year-end closing - Transfer net loss to Retained Earnings',
    });
  }

  return entries;
}

/**
 * Check if fiscal year is ready for year-end closing
 */
export async function checkYearEndClosingReadiness(
  db: Firestore,
  fiscalYearId: string
): Promise<YearEndClosingReadiness> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Get fiscal year
  const fiscalYearDoc = await getDoc(doc(db, COLLECTIONS.FISCAL_YEARS, fiscalYearId));
  if (!fiscalYearDoc.exists()) {
    return {
      isReady: false,
      fiscalYear: null,
      openPeriods: [],
      lockedPeriods: [],
      closedPeriods: [],
      retainedEarningsAccount: null,
      errors: ['Fiscal year not found'],
      warnings: [],
    };
  }

  const fiscalYear = docToTyped<FiscalYear>(fiscalYearDoc.id, fiscalYearDoc.data());

  // Check if already closed
  if (fiscalYear.isYearEndClosed) {
    errors.push('Fiscal year has already been closed');
  }

  // Get all periods for this fiscal year
  const periodsRef = collection(db, COLLECTIONS.ACCOUNTING_PERIODS);
  const periodsQuery = query(periodsRef, where('fiscalYearId', '==', fiscalYearId));
  const periodsSnapshot = await getDocs(periodsQuery);

  const openPeriods: AccountingPeriod[] = [];
  const closedPeriods: AccountingPeriod[] = [];
  const lockedPeriods: AccountingPeriod[] = [];

  periodsSnapshot.docs.forEach((docSnapshot) => {
    const period = docToTyped<AccountingPeriod>(docSnapshot.id, docSnapshot.data());
    switch (period.status) {
      case 'OPEN':
        openPeriods.push(period);
        break;
      case 'CLOSED':
        closedPeriods.push(period);
        break;
      case 'LOCKED':
        lockedPeriods.push(period);
        break;
    }
  });

  // Check if all periods are closed or locked
  if (openPeriods.length > 0) {
    errors.push(
      `${openPeriods.length} period(s) are still open: ${openPeriods.map((p) => p.name).join(', ')}`
    );
  }

  // Check for retained earnings account
  const retainedEarningsAccount = await findRetainedEarningsAccount(db);
  if (!retainedEarningsAccount) {
    errors.push(
      'Retained Earnings account not found. Please create an equity account with code 3100 or category RETAINED_EARNINGS.'
    );
  }

  // Warnings
  if (closedPeriods.length > 0 && lockedPeriods.length === 0) {
    warnings.push(
      'Consider locking all periods before year-end closing to prevent accidental reopening.'
    );
  }

  // Check fiscal year dates
  const today = new Date();
  if (fiscalYear.endDate > today) {
    warnings.push('Fiscal year end date has not yet passed. Are you sure you want to close early?');
  }

  return {
    isReady: errors.length === 0,
    fiscalYear,
    openPeriods,
    closedPeriods,
    lockedPeriods,
    retainedEarningsAccount,
    errors,
    warnings,
  };
}

/**
 * Preview year-end closing without making changes
 */
export async function previewYearEndClosing(
  db: Firestore,
  fiscalYearId: string
): Promise<YearEndClosingPreview> {
  // Check readiness first
  const readiness = await checkYearEndClosingReadiness(db, fiscalYearId);

  if (!readiness.fiscalYear) {
    throw new YearEndClosingError('Fiscal year not found', 'FISCAL_YEAR_NOT_FOUND');
  }

  if (!readiness.retainedEarningsAccount) {
    throw new YearEndClosingError(
      'Retained Earnings account not found',
      'RETAINED_EARNINGS_NOT_FOUND'
    );
  }

  // Get accounts to close
  const { revenueAccounts, expenseAccounts, totalRevenue, totalExpenses } =
    await getAccountsToClose(db);

  const netIncome = totalRevenue - totalExpenses;

  // Generate closing entries
  const closingEntries = generateClosingEntries(
    revenueAccounts,
    expenseAccounts,
    readiness.retainedEarningsAccount
  );

  return {
    fiscalYear: readiness.fiscalYear,
    revenueAccounts,
    expenseAccounts,
    totalRevenue,
    totalExpenses,
    netIncome,
    retainedEarningsAccount: readiness.retainedEarningsAccount,
    closingEntries,
  };
}

/**
 * Execute year-end closing
 *
 * This operation:
 * 1. Creates a closing journal entry
 * 2. Updates account balances
 * 3. Creates a YearEndClosingEntry record
 * 4. Marks the fiscal year as closed
 */
export async function executeYearEndClosing(
  db: Firestore,
  input: CreateYearEndClosingInput
): Promise<YearEndClosingResult> {
  const { fiscalYearId, userId, userName, notes } = input;

  try {
    // Validate readiness
    const readiness = await checkYearEndClosingReadiness(db, fiscalYearId);

    if (!readiness.isReady) {
      throw new YearEndClosingError('Fiscal year is not ready for closing', 'NOT_READY', {
        errors: readiness.errors,
      });
    }

    if (!readiness.fiscalYear || !readiness.retainedEarningsAccount) {
      throw new YearEndClosingError('Required data missing', 'DATA_MISSING');
    }

    const fiscalYear = readiness.fiscalYear;
    const retainedEarningsAccount = readiness.retainedEarningsAccount;

    // Get accounts to close
    const { revenueAccounts, expenseAccounts, totalRevenue, totalExpenses } =
      await getAccountsToClose(db);

    const netIncome = totalRevenue - totalExpenses;

    // Generate closing entries
    const closingEntries = generateClosingEntries(
      revenueAccounts,
      expenseAccounts,
      retainedEarningsAccount
    );

    // Validate entries balance
    const totalDebits = closingEntries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredits = closingEntries.reduce((sum, e) => sum + e.credit, 0);

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      throw new YearEndClosingError(
        `Closing entries do not balance: Debits=${totalDebits}, Credits=${totalCredits}`,
        'ENTRIES_UNBALANCED'
      );
    }

    // Generate transaction number for closing journal
    const journalEntryNumber = await generateTransactionNumber('JOURNAL_ENTRY');

    // Execute in a transaction
    const result = await runTransaction(db, async (transaction) => {
      const closingDate = new Date();

      // Create the closing journal entry
      const journalEntryRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));
      const journalEntryData = {
        type: 'JOURNAL_ENTRY' as const,
        transactionNumber: journalEntryNumber,
        journalDate: Timestamp.fromDate(closingDate),
        date: Timestamp.fromDate(closingDate),
        journalType: 'CLOSING' as const,
        description: `Year-end closing for ${fiscalYear.name}`,
        reference: `Year-End Closing - ${fiscalYear.name}`,
        entries: closingEntries,
        status: 'POSTED' as const,
        isReversed: false,
        createdAt: Timestamp.now(),
        createdBy: userId,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
        // Double-entry validation
        doubleEntryValidatedAt: Timestamp.now(),
      };

      transaction.set(journalEntryRef, journalEntryData);

      // Create Year-End Closing Entry record
      const yearEndClosingRef = doc(collection(db, COLLECTIONS.YEAR_END_CLOSING_ENTRIES));
      const yearEndClosingData: Omit<YearEndClosingEntry, 'id'> = {
        fiscalYearId,
        fiscalYearName: fiscalYear.name,
        closingDate,
        retainedEarningsAccountId: retainedEarningsAccount.id,
        revenueAccounts,
        expenseAccounts,
        totalRevenue,
        totalExpenses,
        netIncome,
        journalEntryId: journalEntryRef.id,
        journalEntryNumber,
        status: 'POSTED',
        preparedBy: userId,
        notes: notes || `Year-end closing executed by ${userName}`,
        createdAt: closingDate,
        createdBy: userId,
        updatedAt: closingDate,
        updatedBy: userId,
      };

      transaction.set(yearEndClosingRef, yearEndClosingData);

      // Update fiscal year status
      const fiscalYearRef = doc(db, COLLECTIONS.FISCAL_YEARS, fiscalYearId);
      transaction.update(fiscalYearRef, {
        isYearEndClosed: true,
        yearEndClosingDate: Timestamp.fromDate(closingDate),
        yearEndClosingJournalId: journalEntryRef.id,
        closedBy: userId,
        status: 'CLOSED',
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      // Zero out revenue accounts
      for (const account of revenueAccounts) {
        const accountRef = doc(db, COLLECTIONS.ACCOUNTS, account.accountId);
        transaction.update(accountRef, {
          currentBalance: 0,
          updatedAt: Timestamp.now(),
          updatedBy: userId,
        });
      }

      // Zero out expense accounts
      for (const account of expenseAccounts) {
        const accountRef = doc(db, COLLECTIONS.ACCOUNTS, account.accountId);
        transaction.update(accountRef, {
          currentBalance: 0,
          updatedAt: Timestamp.now(),
          updatedBy: userId,
        });
      }

      // Update retained earnings balance
      const retainedEarningsRef = doc(db, COLLECTIONS.ACCOUNTS, retainedEarningsAccount.id);
      transaction.update(retainedEarningsRef, {
        currentBalance: retainedEarningsAccount.currentBalance + netIncome,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      return {
        yearEndClosingEntryId: yearEndClosingRef.id,
        journalEntryId: journalEntryRef.id,
        journalEntryNumber,
      };
    });

    // Audit log (outside transaction to not block on audit failure)
    const auditContext = createAuditContext(userId, '', userName);
    try {
      await logAuditEvent(
        db,
        auditContext,
        'YEAR_END_CLOSING_POSTED',
        'YEAR_END_CLOSING',
        result.yearEndClosingEntryId,
        `Year-end closing completed for ${fiscalYear.name}. Net Income: ${netIncome.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}`,
        {
          entityName: fiscalYear.name,
          severity: 'WARNING',
          metadata: {
            fiscalYearId,
            totalRevenue,
            totalExpenses,
            netIncome,
            journalEntryId: result.journalEntryId,
            journalEntryNumber: result.journalEntryNumber,
            revenueAccountsCount: revenueAccounts.length,
            expenseAccountsCount: expenseAccounts.length,
          },
        }
      );
    } catch (auditError) {
      logger.warn('Failed to write audit log for year-end closing', { auditError });
    }

    logger.info('Year-end closing completed successfully', {
      fiscalYearId,
      fiscalYearName: fiscalYear.name,
      yearEndClosingEntryId: result.yearEndClosingEntryId,
      journalEntryId: result.journalEntryId,
      netIncome,
    });

    return {
      success: true,
      yearEndClosingEntryId: result.yearEndClosingEntryId,
      journalEntryId: result.journalEntryId,
      journalEntryNumber: result.journalEntryNumber,
      netIncome,
    };
  } catch (error) {
    logger.error('Year-end closing failed', { fiscalYearId, error });

    if (error instanceof YearEndClosingError) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during year-end closing',
    };
  }
}

/**
 * Reverse a year-end closing entry
 * This creates reversing entries and reopens the fiscal year
 */
export async function reverseYearEndClosing(
  db: Firestore,
  yearEndClosingEntryId: string,
  userId: string,
  userName: string,
  reason: string
): Promise<{ success: boolean; reversalJournalId?: string; error?: string }> {
  try {
    // Get the year-end closing entry
    const closingEntryDoc = await getDoc(
      doc(db, COLLECTIONS.YEAR_END_CLOSING_ENTRIES, yearEndClosingEntryId)
    );

    if (!closingEntryDoc.exists()) {
      return { success: false, error: 'Year-end closing entry not found' };
    }

    const closingEntry = docToTyped<YearEndClosingEntry>(closingEntryDoc.id, closingEntryDoc.data());

    if (closingEntry.status === 'REVERSED') {
      return { success: false, error: 'Year-end closing entry has already been reversed' };
    }

    // Get the original journal entry
    const originalJournalDoc = await getDoc(
      doc(db, COLLECTIONS.TRANSACTIONS, closingEntry.journalEntryId)
    );

    if (!originalJournalDoc.exists()) {
      return { success: false, error: 'Original closing journal entry not found' };
    }

    const originalJournal = originalJournalDoc.data();
    const originalEntries = (originalJournal.entries || []) as LedgerEntry[];

    // Generate reversing entries (swap debits and credits)
    const reversalEntries: LedgerEntry[] = originalEntries.map((entry) => ({
      ...entry,
      debit: entry.credit,
      credit: entry.debit,
      description: `[REVERSAL] ${entry.description || ''}`,
    }));

    // Generate reversal journal number
    const reversalJournalNumber = await generateTransactionNumber('JOURNAL_ENTRY');

    // Execute reversal in a transaction
    const result = await runTransaction(db, async (transaction) => {
      const reversalDate = new Date();

      // Create reversal journal entry
      const reversalJournalRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));
      transaction.set(reversalJournalRef, {
        type: 'JOURNAL_ENTRY' as const,
        transactionNumber: reversalJournalNumber,
        journalDate: Timestamp.fromDate(reversalDate),
        date: Timestamp.fromDate(reversalDate),
        journalType: 'REVERSING' as const,
        description: `Reversal of year-end closing for ${closingEntry.fiscalYearName}`,
        reference: `Reversal - ${reason}`,
        entries: reversalEntries,
        status: 'POSTED' as const,
        isReversed: false,
        originalJournalId: closingEntry.journalEntryId,
        createdAt: Timestamp.now(),
        createdBy: userId,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
        doubleEntryValidatedAt: Timestamp.now(),
      });

      // Update original journal as reversed
      transaction.update(doc(db, COLLECTIONS.TRANSACTIONS, closingEntry.journalEntryId), {
        isReversed: true,
        reversalJournalId: reversalJournalRef.id,
        reversalDate: Timestamp.fromDate(reversalDate),
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      // Update year-end closing entry
      transaction.update(doc(db, COLLECTIONS.YEAR_END_CLOSING_ENTRIES, yearEndClosingEntryId), {
        status: 'REVERSED',
        reversalDate,
        reversalJournalId: reversalJournalRef.id,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      // Reopen fiscal year
      transaction.update(doc(db, COLLECTIONS.FISCAL_YEARS, closingEntry.fiscalYearId), {
        isYearEndClosed: false,
        yearEndClosingDate: null,
        yearEndClosingJournalId: null,
        closedBy: null,
        status: 'OPEN',
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      // Restore revenue account balances
      for (const account of closingEntry.revenueAccounts) {
        const accountRef = doc(db, COLLECTIONS.ACCOUNTS, account.accountId);
        const accountDoc = await transaction.get(accountRef);
        if (accountDoc.exists()) {
          const currentBalance = (accountDoc.data().currentBalance as number) || 0;
          transaction.update(accountRef, {
            currentBalance: currentBalance + account.closingBalance,
            updatedAt: Timestamp.now(),
            updatedBy: userId,
          });
        }
      }

      // Restore expense account balances
      for (const account of closingEntry.expenseAccounts) {
        const accountRef = doc(db, COLLECTIONS.ACCOUNTS, account.accountId);
        const accountDoc = await transaction.get(accountRef);
        if (accountDoc.exists()) {
          const currentBalance = (accountDoc.data().currentBalance as number) || 0;
          transaction.update(accountRef, {
            currentBalance: currentBalance + account.closingBalance,
            updatedAt: Timestamp.now(),
            updatedBy: userId,
          });
        }
      }

      // Restore retained earnings balance
      const retainedEarningsRef = doc(
        db,
        COLLECTIONS.ACCOUNTS,
        closingEntry.retainedEarningsAccountId
      );
      const retainedEarningsDoc = await transaction.get(retainedEarningsRef);
      if (retainedEarningsDoc.exists()) {
        const currentBalance = (retainedEarningsDoc.data().currentBalance as number) || 0;
        transaction.update(retainedEarningsRef, {
          currentBalance: currentBalance - closingEntry.netIncome,
          updatedAt: Timestamp.now(),
          updatedBy: userId,
        });
      }

      return { reversalJournalId: reversalJournalRef.id };
    });

    // Audit log
    const auditContext = createAuditContext(userId, '', userName);
    try {
      await logAuditEvent(
        db,
        auditContext,
        'YEAR_END_CLOSING_REVERSED',
        'YEAR_END_CLOSING',
        yearEndClosingEntryId,
        `Year-end closing reversed for ${closingEntry.fiscalYearName}. Reason: ${reason}`,
        {
          entityName: closingEntry.fiscalYearName,
          severity: 'CRITICAL',
          metadata: {
            fiscalYearId: closingEntry.fiscalYearId,
            reversalReason: reason,
            reversalJournalId: result.reversalJournalId,
          },
        }
      );
    } catch (auditError) {
      logger.warn('Failed to write audit log for year-end closing reversal', { auditError });
    }

    logger.info('Year-end closing reversed successfully', {
      yearEndClosingEntryId,
      reversalJournalId: result.reversalJournalId,
    });

    return {
      success: true,
      reversalJournalId: result.reversalJournalId,
    };
  } catch (error) {
    logger.error('Year-end closing reversal failed', { yearEndClosingEntryId, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during reversal',
    };
  }
}

/**
 * Get year-end closing history for a fiscal year
 */
export async function getYearEndClosingHistory(
  db: Firestore,
  fiscalYearId: string
): Promise<YearEndClosingEntry[]> {
  const closingEntriesRef = collection(db, COLLECTIONS.YEAR_END_CLOSING_ENTRIES);
  const q = query(closingEntriesRef, where('fiscalYearId', '==', fiscalYearId));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnapshot) =>
    docToTyped<YearEndClosingEntry>(docSnapshot.id, docSnapshot.data())
  );
}

/**
 * Get all year-end closing entries
 */
export async function getAllYearEndClosingEntries(db: Firestore): Promise<YearEndClosingEntry[]> {
  const closingEntriesRef = collection(db, COLLECTIONS.YEAR_END_CLOSING_ENTRIES);
  const snapshot = await getDocs(closingEntriesRef);

  return snapshot.docs.map((docSnapshot) =>
    docToTyped<YearEndClosingEntry>(docSnapshot.id, docSnapshot.data())
  );
}
