/**
 * Interproject Loan Service
 *
 * Manages loans between projects (cost centres) with:
 * - Automatic journal entry generation for disbursement and repayments
 * - Simple and compound interest calculations
 * - Repayment schedule generation and tracking
 * - Integration with cost centres and general ledger
 *
 * Accounting treatment:
 * - Lending project: Debit Intercompany Loan Receivable, Credit Cash/Bank
 * - Borrowing project: Debit Cash/Bank, Credit Intercompany Loan Payable
 * - Interest accrual: Debit Interest Receivable, Credit Interest Income (lending)
 *                     Debit Interest Expense, Credit Interest Payable (borrowing)
 */

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  updateDoc,
  runTransaction,
  orderBy,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import type { InterprojectLoan, RepaymentSchedule, LedgerEntry, CostCentre } from '@vapour/types';
import { generateTransactionNumber } from './transactionNumberGenerator';
import { getSystemAccountIds } from './systemAccountResolver';
import { logAuditEvent, createAuditContext } from '@/lib/audit';

const logger = createLogger({ context: 'interprojectLoanService' });

/**
 * Error thrown for interproject loan operations
 */
export class InterprojectLoanError extends Error {
  constructor(
    message: string,
    public readonly errorCode: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'InterprojectLoanError';
  }
}

/**
 * Input for creating a new interproject loan
 */
export interface CreateInterprojectLoanInput {
  lendingProjectId: string;
  borrowingProjectId: string;
  principalAmount: number;
  currency?: string;
  interestRate: number; // Annual percentage (e.g., 10 for 10%)
  interestCalculationMethod: 'SIMPLE' | 'COMPOUND';
  startDate: Date;
  maturityDate: Date;
  repaymentFrequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUALLY' | 'ANNUALLY' | 'BULLET';
  notes?: string;
  userId: string;
  userName: string;
}

/**
 * Input for recording a repayment
 */
export interface RecordRepaymentInput {
  loanId: string;
  repaymentDate: Date;
  principalAmount: number;
  interestAmount: number;
  notes?: string;
  userId: string;
  userName: string;
}

/**
 * Result of loan operations
 */
export interface InterprojectLoanResult {
  success: boolean;
  loanId?: string;
  loanNumber?: string;
  journalEntryId?: string;
  error?: string;
}

/**
 * Loan list filters
 */
export interface LoanListFilters {
  status?: InterprojectLoan['status'];
  lendingProjectId?: string;
  borrowingProjectId?: string;
}

/**
 * Generate loan number
 */
async function generateLoanNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `IPL-${year}-${random}`;
}

/**
 * AC-8: Round to paisa (2 decimal places) to prevent floating point accumulation.
 * Applied at each intermediate step, not just at the end.
 */
function roundToPaisa(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/**
 * Calculate simple interest
 */
function calculateSimpleInterest(principal: number, annualRate: number, days: number): number {
  return roundToPaisa((principal * annualRate * days) / (100 * 365));
}

/**
 * Calculate compound interest (monthly compounding)
 */
function calculateCompoundInterest(principal: number, annualRate: number, months: number): number {
  const monthlyRate = annualRate / 100 / 12;
  const amount = principal * Math.pow(1 + monthlyRate, months);
  return roundToPaisa(amount - principal);
}

/**
 * Generate repayment schedule
 */
export function generateRepaymentSchedule(
  principalAmount: number,
  interestRate: number,
  interestMethod: 'SIMPLE' | 'COMPOUND',
  startDate: Date,
  maturityDate: Date,
  frequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUALLY' | 'ANNUALLY' | 'BULLET'
): RepaymentSchedule[] {
  const schedule: RepaymentSchedule[] = [];

  // Calculate number of periods
  const startMs = startDate.getTime();
  const endMs = maturityDate.getTime();
  const totalDays = Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24));
  const totalMonths = Math.ceil(totalDays / 30);

  let periodMonths: number;
  switch (frequency) {
    case 'MONTHLY':
      periodMonths = 1;
      break;
    case 'QUARTERLY':
      periodMonths = 3;
      break;
    case 'SEMI_ANNUALLY':
      periodMonths = 6;
      break;
    case 'ANNUALLY':
      periodMonths = 12;
      break;
    case 'BULLET':
      // Single payment at maturity
      periodMonths = totalMonths;
      break;
    default:
      periodMonths = 1;
  }

  const numberOfPayments = Math.max(1, Math.ceil(totalMonths / periodMonths));
  const principalPerPayment = roundToPaisa(principalAmount / numberOfPayments);

  let remainingPrincipal = principalAmount;
  let currentDate = new Date(startDate);

  for (let i = 0; i < numberOfPayments; i++) {
    // Calculate due date
    const dueDate = new Date(currentDate);
    dueDate.setMonth(dueDate.getMonth() + periodMonths);

    // Calculate interest for this period (already rounded via roundToPaisa in helpers)
    let interestAmount: number;
    if (interestMethod === 'SIMPLE') {
      const daysInPeriod = Math.ceil(
        (dueDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      interestAmount = calculateSimpleInterest(remainingPrincipal, interestRate, daysInPeriod);
    } else {
      interestAmount = calculateCompoundInterest(remainingPrincipal, interestRate, periodMonths);
    }

    // For bullet payment, principal is only paid at maturity
    // Last payment absorbs any rounding remainder
    let principalPayment: number;
    if (frequency === 'BULLET' && i < numberOfPayments - 1) {
      principalPayment = 0;
    } else if (i === numberOfPayments - 1) {
      // Last payment: use remaining principal to avoid rounding drift
      principalPayment = roundToPaisa(remainingPrincipal);
    } else {
      principalPayment = principalPerPayment;
    }

    schedule.push({
      dueDate,
      principalAmount: principalPayment,
      interestAmount,
      totalAmount: roundToPaisa(principalPayment + interestAmount),
      status: 'PENDING',
    });

    remainingPrincipal = roundToPaisa(remainingPrincipal - principalPayment);
    currentDate = dueDate;
  }

  return schedule;
}

/**
 * Get cost centre by ID
 */
async function getCostCentre(db: Firestore, costCentreId: string): Promise<CostCentre | null> {
  const docSnap = await getDoc(doc(db, COLLECTIONS.COST_CENTRES, costCentreId));
  if (!docSnap.exists()) return null;
  return docToTyped<CostCentre>(docSnap.id, docSnap.data());
}

/**
 * Create a new interproject loan
 */
export async function createInterprojectLoan(
  db: Firestore,
  input: CreateInterprojectLoanInput
): Promise<InterprojectLoanResult> {
  const {
    lendingProjectId,
    borrowingProjectId,
    principalAmount,
    currency = 'INR',
    interestRate,
    interestCalculationMethod,
    startDate,
    maturityDate,
    repaymentFrequency,
    notes,
    userId,
    userName,
  } = input;

  try {
    // Validate projects exist
    const [lendingProject, borrowingProject] = await Promise.all([
      getCostCentre(db, lendingProjectId),
      getCostCentre(db, borrowingProjectId),
    ]);

    if (!lendingProject) {
      throw new InterprojectLoanError('Lending project not found', 'LENDING_PROJECT_NOT_FOUND');
    }

    if (!borrowingProject) {
      throw new InterprojectLoanError('Borrowing project not found', 'BORROWING_PROJECT_NOT_FOUND');
    }

    if (lendingProjectId === borrowingProjectId) {
      throw new InterprojectLoanError(
        'Lending and borrowing projects must be different',
        'SAME_PROJECT'
      );
    }

    // Generate loan number
    const loanNumber = await generateLoanNumber();

    // Generate repayment schedule
    const repaymentSchedule = generateRepaymentSchedule(
      principalAmount,
      interestRate,
      interestCalculationMethod,
      startDate,
      maturityDate,
      repaymentFrequency
    );

    // Generate journal entry number
    const journalEntryNumber = await generateTransactionNumber('JOURNAL_ENTRY');

    // Resolve intercompany accounts from Chart of Accounts
    const systemAccounts = await getSystemAccountIds(db);
    if (!systemAccounts.intercompanyReceivable || !systemAccounts.intercompanyPayable) {
      throw new InterprojectLoanError(
        'Intercompany accounts (1400, 2400) not found in Chart of Accounts. Please set up Intercompany Loan Receivable and Payable accounts.',
        'MISSING_INTERCOMPANY_ACCOUNTS'
      );
    }

    // Create loan and journal entry atomically
    const result = await runTransaction(db, async (transaction) => {
      // Create journal entry for loan disbursement
      // Debit: Intercompany Loan Receivable (Lending Project)
      // Credit: Intercompany Loan Payable (Borrowing Project)
      const journalEntryRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));
      const entries: LedgerEntry[] = [
        {
          accountId: systemAccounts.intercompanyReceivable!,
          accountCode: '1400',
          accountName: 'Intercompany Loan Receivable',
          debit: principalAmount,
          credit: 0,
          description: `Loan to ${borrowingProject.name}`,
          costCentreId: lendingProjectId,
        },
        {
          accountId: systemAccounts.intercompanyPayable!,
          accountCode: '2400',
          accountName: 'Intercompany Loan Payable',
          debit: 0,
          credit: principalAmount,
          description: `Loan from ${lendingProject.name}`,
          costCentreId: borrowingProjectId,
        },
      ];

      transaction.set(journalEntryRef, {
        type: 'JOURNAL_ENTRY' as const,
        transactionNumber: journalEntryNumber,
        journalDate: Timestamp.fromDate(startDate),
        date: Timestamp.fromDate(startDate),
        journalType: 'GENERAL' as const,
        description: `Interproject loan ${loanNumber}: ${lendingProject.name} to ${borrowingProject.name}`,
        reference: loanNumber,
        entries,
        status: 'POSTED' as const,
        isReversed: false,
        createdAt: Timestamp.now(),
        createdBy: userId,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
        doubleEntryValidatedAt: Timestamp.now(),
      });

      // Create loan document
      const loanRef = doc(collection(db, COLLECTIONS.INTERPROJECT_LOANS));
      const loanData: Omit<InterprojectLoan, 'id'> = {
        loanNumber,
        lendingProjectId,
        borrowingProjectId,
        principalAmount,
        currency,
        interestRate,
        interestCalculationMethod,
        startDate,
        maturityDate,
        repaymentSchedule,
        remainingPrincipal: principalAmount,
        totalInterestAccrued: 0,
        totalInterestPaid: 0,
        status: 'ACTIVE',
        disbursementJournalId: journalEntryRef.id,
        notes: notes || `Interproject loan from ${lendingProject.name} to ${borrowingProject.name}`,
        createdAt: new Date(),
        createdBy: userId,
        updatedAt: new Date(),
        updatedBy: userId,
      };

      transaction.set(loanRef, {
        ...loanData,
        startDate: Timestamp.fromDate(startDate),
        maturityDate: Timestamp.fromDate(maturityDate),
        repaymentSchedule: repaymentSchedule.map((s) => ({
          ...s,
          dueDate: Timestamp.fromDate(s.dueDate),
        })),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      return {
        loanId: loanRef.id,
        loanNumber,
        journalEntryId: journalEntryRef.id,
      };
    });

    // Audit log
    const auditContext = createAuditContext(userId, '', userName);
    try {
      await logAuditEvent(
        db,
        auditContext,
        'TRANSACTION_CREATED',
        'TRANSACTION',
        result.loanId,
        `Created interproject loan ${result.loanNumber} from ${lendingProject.name} to ${borrowingProject.name} for ${principalAmount.toLocaleString('en-IN', { style: 'currency', currency })}`,
        {
          entityName: result.loanNumber,
          metadata: {
            lendingProjectId,
            borrowingProjectId,
            principalAmount,
            interestRate,
            journalEntryId: result.journalEntryId,
          },
        }
      );
    } catch (auditError) {
      logger.warn('Failed to write audit log for loan creation', { auditError });
    }

    logger.info('Interproject loan created successfully', {
      loanId: result.loanId,
      loanNumber: result.loanNumber,
      lendingProjectId,
      borrowingProjectId,
      principalAmount,
    });

    return {
      success: true,
      loanId: result.loanId,
      loanNumber: result.loanNumber,
      journalEntryId: result.journalEntryId,
    };
  } catch (error) {
    logger.error('Failed to create interproject loan', { error, input });

    if (error instanceof InterprojectLoanError) {
      return { success: false, error: error.message };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error creating loan',
    };
  }
}

/**
 * Get interproject loan by ID
 */
export async function getInterprojectLoan(
  db: Firestore,
  loanId: string
): Promise<InterprojectLoan | null> {
  const docSnap = await getDoc(doc(db, COLLECTIONS.INTERPROJECT_LOANS, loanId));
  if (!docSnap.exists()) return null;
  return docToTyped<InterprojectLoan>(docSnap.id, docSnap.data());
}

/**
 * Get all interproject loans with optional filters
 */
export async function getInterprojectLoans(
  db: Firestore,
  filters?: LoanListFilters
): Promise<InterprojectLoan[]> {
  let q = query(collection(db, COLLECTIONS.INTERPROJECT_LOANS), orderBy('createdAt', 'desc'));

  if (filters?.status) {
    q = query(q, where('status', '==', filters.status));
  }

  if (filters?.lendingProjectId) {
    q = query(q, where('lendingProjectId', '==', filters.lendingProjectId));
  }

  if (filters?.borrowingProjectId) {
    q = query(q, where('borrowingProjectId', '==', filters.borrowingProjectId));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => docToTyped<InterprojectLoan>(d.id, d.data()));
}

/**
 * Get loans by project (as lender or borrower)
 */
export async function getLoansByProject(
  db: Firestore,
  projectId: string
): Promise<{ asLender: InterprojectLoan[]; asBorrower: InterprojectLoan[] }> {
  const [lenderLoans, borrowerLoans] = await Promise.all([
    getInterprojectLoans(db, { lendingProjectId: projectId }),
    getInterprojectLoans(db, { borrowingProjectId: projectId }),
  ]);

  return {
    asLender: lenderLoans,
    asBorrower: borrowerLoans,
  };
}

/**
 * Record a loan repayment
 */
export async function recordRepayment(
  db: Firestore,
  input: RecordRepaymentInput
): Promise<InterprojectLoanResult> {
  const { loanId, repaymentDate, principalAmount, interestAmount, userId, userName } = input;

  try {
    const loan = await getInterprojectLoan(db, loanId);

    if (!loan) {
      throw new InterprojectLoanError('Loan not found', 'LOAN_NOT_FOUND');
    }

    if (loan.status === 'FULLY_REPAID') {
      throw new InterprojectLoanError('Loan is already fully repaid', 'LOAN_FULLY_REPAID');
    }

    if (loan.status === 'WRITTEN_OFF') {
      throw new InterprojectLoanError(
        'Cannot record payment on written-off loan',
        'LOAN_WRITTEN_OFF'
      );
    }

    const totalPayment = principalAmount + interestAmount;

    const journalEntryNumber = await generateTransactionNumber('JOURNAL_ENTRY');

    // Resolve intercompany accounts from Chart of Accounts
    const systemAccounts = await getSystemAccountIds(db);
    if (!systemAccounts.intercompanyReceivable || !systemAccounts.intercompanyPayable) {
      throw new InterprojectLoanError(
        'Intercompany accounts (1400, 2400) not found in Chart of Accounts',
        'MISSING_INTERCOMPANY_ACCOUNTS'
      );
    }

    // Create repayment journal entry and update loan
    const result = await runTransaction(db, async (transaction) => {
      // Create journal entry
      // Debit: Cash/Intercompany Payable (Borrowing reduces liability)
      // Credit: Intercompany Receivable (Lending receives payment)
      // Plus interest entries
      const journalEntryRef = doc(collection(db, COLLECTIONS.TRANSACTIONS));
      const entries: LedgerEntry[] = [];

      // Principal repayment
      if (principalAmount > 0) {
        entries.push({
          accountId: systemAccounts.intercompanyPayable!,
          accountCode: '2400',
          accountName: 'Intercompany Loan Payable',
          debit: principalAmount,
          credit: 0,
          description: `Principal repayment on loan ${loan.loanNumber}`,
          costCentreId: loan.borrowingProjectId,
        });
        entries.push({
          accountId: systemAccounts.intercompanyReceivable!,
          accountCode: '1400',
          accountName: 'Intercompany Loan Receivable',
          debit: 0,
          credit: principalAmount,
          description: `Principal received on loan ${loan.loanNumber}`,
          costCentreId: loan.lendingProjectId,
        });
      }

      // Interest payment
      if (interestAmount > 0) {
        entries.push({
          accountId: systemAccounts.interestExpense || 'interest-expense',
          accountCode: '6100',
          accountName: 'Interest Expense',
          debit: interestAmount,
          credit: 0,
          description: `Interest on loan ${loan.loanNumber}`,
          costCentreId: loan.borrowingProjectId,
        });
        entries.push({
          accountId: systemAccounts.interestIncome || 'interest-income',
          accountCode: '4200',
          accountName: 'Interest Income',
          debit: 0,
          credit: interestAmount,
          description: `Interest received on loan ${loan.loanNumber}`,
          costCentreId: loan.lendingProjectId,
        });
      }

      transaction.set(journalEntryRef, {
        type: 'JOURNAL_ENTRY' as const,
        transactionNumber: journalEntryNumber,
        journalDate: Timestamp.fromDate(repaymentDate),
        date: Timestamp.fromDate(repaymentDate),
        journalType: 'GENERAL' as const,
        description: `Repayment on ${loan.loanNumber}: Principal ${principalAmount}, Interest ${interestAmount}`,
        reference: loan.loanNumber,
        entries,
        status: 'POSTED' as const,
        isReversed: false,
        createdAt: Timestamp.now(),
        createdBy: userId,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
        doubleEntryValidatedAt: Timestamp.now(),
      });

      // Update loan
      const newRemainingPrincipal = loan.remainingPrincipal - principalAmount;
      const newStatus: InterprojectLoan['status'] =
        newRemainingPrincipal <= 0 ? 'FULLY_REPAID' : 'PARTIALLY_REPAID';

      // Update repayment schedule - mark oldest pending as paid
      const updatedSchedule = [...loan.repaymentSchedule];
      for (const item of updatedSchedule) {
        if (item.status === 'PENDING') {
          item.status = 'PAID';
          item.paidDate = repaymentDate;
          item.paidAmount = totalPayment;
          item.journalEntryId = journalEntryRef.id;
          break;
        }
      }

      const loanRef = doc(db, COLLECTIONS.INTERPROJECT_LOANS, loanId);
      transaction.update(loanRef, {
        remainingPrincipal: Math.max(0, newRemainingPrincipal),
        totalInterestPaid: loan.totalInterestPaid + interestAmount,
        status: newStatus,
        repaymentSchedule: updatedSchedule.map((s) => ({
          ...s,
          dueDate: s.dueDate instanceof Date ? Timestamp.fromDate(s.dueDate) : s.dueDate,
          paidDate: s.paidDate
            ? s.paidDate instanceof Date
              ? Timestamp.fromDate(s.paidDate)
              : s.paidDate
            : null,
        })),
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      return { journalEntryId: journalEntryRef.id };
    });

    // Audit log
    const auditContext = createAuditContext(userId, '', userName);
    try {
      await logAuditEvent(
        db,
        auditContext,
        'PAYMENT_COMPLETED',
        'TRANSACTION',
        loanId,
        `Recorded repayment on loan ${loan.loanNumber}: Principal ${principalAmount}, Interest ${interestAmount}`,
        {
          entityName: loan.loanNumber,
          metadata: {
            principalAmount,
            interestAmount,
            totalPayment,
            journalEntryId: result.journalEntryId,
          },
        }
      );
    } catch (auditError) {
      logger.warn('Failed to write audit log for repayment', { auditError });
    }

    logger.info('Loan repayment recorded successfully', {
      loanId,
      loanNumber: loan.loanNumber,
      principalAmount,
      interestAmount,
    });

    return {
      success: true,
      loanId,
      loanNumber: loan.loanNumber,
      journalEntryId: result.journalEntryId,
    };
  } catch (error) {
    logger.error('Failed to record loan repayment', { error, input });

    if (error instanceof InterprojectLoanError) {
      return { success: false, error: error.message };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error recording repayment',
    };
  }
}

/**
 * Update loan status
 */
export async function updateLoanStatus(
  db: Firestore,
  loanId: string,
  status: InterprojectLoan['status'],
  userId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const loanRef = doc(db, COLLECTIONS.INTERPROJECT_LOANS, loanId);
    await updateDoc(loanRef, {
      status,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
      ...(reason && { statusChangeReason: reason }),
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to update loan status', { error, loanId, status });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get loan summary for a project
 */
export async function getProjectLoanSummary(
  db: Firestore,
  projectId: string
): Promise<{
  totalLent: number;
  totalBorrowed: number;
  outstandingReceivable: number;
  outstandingPayable: number;
  activeLoansAsLender: number;
  activeLoansAsBorrower: number;
}> {
  const { asLender, asBorrower } = await getLoansByProject(db, projectId);

  const activeStatuses = ['ACTIVE', 'PARTIALLY_REPAID'];

  const activeAsLender = asLender.filter((l) => activeStatuses.includes(l.status));
  const activeAsBorrower = asBorrower.filter((l) => activeStatuses.includes(l.status));

  return {
    totalLent: asLender.reduce((sum, l) => sum + l.principalAmount, 0),
    totalBorrowed: asBorrower.reduce((sum, l) => sum + l.principalAmount, 0),
    outstandingReceivable: activeAsLender.reduce((sum, l) => sum + l.remainingPrincipal, 0),
    outstandingPayable: activeAsBorrower.reduce((sum, l) => sum + l.remainingPrincipal, 0),
    activeLoansAsLender: activeAsLender.length,
    activeLoansAsBorrower: activeAsBorrower.length,
  };
}
