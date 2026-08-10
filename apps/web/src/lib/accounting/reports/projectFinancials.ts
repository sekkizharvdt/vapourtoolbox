/**
 * Project Financial Report
 *
 * Accrual and cash views of one project, side by side, plus budget variance and
 * the transactions grouped by what they are.
 *
 * Replaces an inline calculation that was wrong three ways:
 *
 * 1. It added customer invoices **and** customer receipts into "revenue", and
 *    vendor bills **and** vendor payments into "expenses" — so an invoice that
 *    was raised and then paid counted twice. On a real project this understated
 *    profit by about a third.
 * 2. It summed `amount`, the native-currency face value, so a USD invoice worth
 *    ₹5,28,403 was added as 6,072 (rule 21).
 * 3. It silently ignored `DIRECT_PAYMENT`, `DIRECT_RECEIPT` and `JOURNAL_ENTRY`
 *    while still listing them, so the transaction list never reconciled to the
 *    totals above it.
 *
 * The fix is to stop conflating the two bases. Accrual answers "did this project
 * make money" (invoices against bills and direct payments); cash answers "has the
 * money moved" (receipts against payments). Both are shown because on a project
 * with slow-paying customers they say very different things.
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { TransactionType } from '@vapour/types';
import { COLLECTIONS } from '@vapour/firebase';
import { toDate } from '@/lib/firebase/typeHelpers';
import { getInrAmount, roundToPaisa } from '@/lib/accounting/amountHelpers';

const PAISA_TOLERANCE = 0.01;

/**
 * How each transaction type contributes. A lookup rather than a switch so a
 * tenth type is a compile error (rule 24).
 *
 * `DIRECT_PAYMENT` is deliberately in both columns: it is an expense *and* an
 * outflow, because it settles immediately with no bill in between.
 */
const CONTRIBUTION: Record<
  TransactionType,
  { accrual: 'REVENUE' | 'EXPENSE' | null; cash: 'IN' | 'OUT' | null }
> = {
  CUSTOMER_INVOICE: { accrual: 'REVENUE', cash: null },
  VENDOR_BILL: { accrual: 'EXPENSE', cash: null },
  CUSTOMER_PAYMENT: { accrual: null, cash: 'IN' },
  VENDOR_PAYMENT: { accrual: null, cash: 'OUT' },
  DIRECT_PAYMENT: { accrual: 'EXPENSE', cash: 'OUT' },
  DIRECT_RECEIPT: { accrual: 'REVENUE', cash: 'IN' },
  EXPENSE_CLAIM: { accrual: 'EXPENSE', cash: 'OUT' },
  // Adjustments and transfers: shown in the listing, never folded into either
  // basis, because doing so would double-count the entry they adjust.
  JOURNAL_ENTRY: { accrual: null, cash: null },
  BANK_TRANSFER: { accrual: null, cash: null },
};

/* ─── Inputs ────────────────────────────────────────────────────── */

export interface ProjectTransaction {
  id: string;
  type: TransactionType;
  reference: string;
  date: Date;
  description: string;
  counterparty: string;
  currency: string;
  /** Native-currency face value, for display next to the INR figure. */
  nativeAmount: number;
  amountInr: number;
}

export interface ProjectPeriod {
  startDate: Date;
  /** Inclusive. */
  endDate: Date;
}

/* ─── Output ────────────────────────────────────────────────────── */

export interface ProjectTransactionGroup {
  type: TransactionType;
  label: string;
  transactions: ProjectTransaction[];
  total: number;
  /** Whether this group feeds the accrual result, the cash result, or neither. */
  contributesTo: string;
}

export interface ProjectFinancialsReport {
  projectId: string;
  projectName: string;
  startDate: Date;
  endDate: Date;
  generatedAt: Date;

  accrual: {
    revenue: number;
    expenses: number;
    profit: number;
    /** Profit as a share of revenue, 0–100. Null without revenue. */
    marginPct: number | null;
  };
  cash: {
    receipts: number;
    payments: number;
    net: number;
  };
  budget: {
    amount: number | null;
    /** Accrual expenses against budget, 0–100. Null without a budget. */
    utilisationPct: number | null;
    /** Budget less accrual expenses. Negative means overspend. */
    variance: number | null;
  };

  groups: ProjectTransactionGroup[];
  transactionCount: number;
  /** Transactions listed but excluded from both bases (journals, transfers). */
  excludedCount: number;
  excludedTotal: number;
}

/* ─── Pure computation ──────────────────────────────────────────── */

const TYPE_LABELS: Record<TransactionType, string> = {
  CUSTOMER_INVOICE: 'Customer Invoices',
  CUSTOMER_PAYMENT: 'Receipts from Customers',
  VENDOR_BILL: 'Vendor Bills',
  VENDOR_PAYMENT: 'Payments to Vendors',
  DIRECT_PAYMENT: 'Direct Payments',
  DIRECT_RECEIPT: 'Direct Receipts',
  EXPENSE_CLAIM: 'Expense Claims',
  JOURNAL_ENTRY: 'Journal Entries',
  BANK_TRANSFER: 'Bank Transfers',
};

/** Reading order: earn, spend, collect, pay, then adjustments. */
const GROUP_ORDER: TransactionType[] = [
  'CUSTOMER_INVOICE',
  'DIRECT_RECEIPT',
  'VENDOR_BILL',
  'DIRECT_PAYMENT',
  'EXPENSE_CLAIM',
  'CUSTOMER_PAYMENT',
  'VENDOR_PAYMENT',
  'JOURNAL_ENTRY',
  'BANK_TRANSFER',
];

function contributionLabel(type: TransactionType): string {
  const c = CONTRIBUTION[type];
  const parts: string[] = [];
  if (c.accrual === 'REVENUE') parts.push('revenue');
  if (c.accrual === 'EXPENSE') parts.push('expense');
  if (c.cash === 'IN') parts.push('cash in');
  if (c.cash === 'OUT') parts.push('cash out');
  return parts.length > 0 ? parts.join(' · ') : 'not in totals';
}

export function computeProjectFinancials(
  transactions: ProjectTransaction[],
  period: ProjectPeriod,
  meta: { projectId: string; projectName: string; budget?: number | null },
  options: { generatedAt?: Date } = {}
): ProjectFinancialsReport {
  const inPeriod = transactions.filter(
    (t) =>
      t.amountInr > PAISA_TOLERANCE &&
      t.date.getTime() >= period.startDate.getTime() &&
      t.date.getTime() <= period.endDate.getTime()
  );

  let revenue = 0;
  let expenses = 0;
  let receipts = 0;
  let payments = 0;
  let excludedCount = 0;
  let excludedTotal = 0;

  for (const t of inPeriod) {
    const c = CONTRIBUTION[t.type];
    if (c.accrual === 'REVENUE') revenue = roundToPaisa(revenue + t.amountInr);
    if (c.accrual === 'EXPENSE') expenses = roundToPaisa(expenses + t.amountInr);
    if (c.cash === 'IN') receipts = roundToPaisa(receipts + t.amountInr);
    if (c.cash === 'OUT') payments = roundToPaisa(payments + t.amountInr);
    if (!c.accrual && !c.cash) {
      excludedCount++;
      excludedTotal = roundToPaisa(excludedTotal + t.amountInr);
    }
  }

  const groups: ProjectTransactionGroup[] = GROUP_ORDER.map((type) => {
    const list = inPeriod
      .filter((t) => t.type === type)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    return {
      type,
      label: TYPE_LABELS[type],
      transactions: list,
      total: roundToPaisa(list.reduce((s, t) => s + t.amountInr, 0)),
      contributesTo: contributionLabel(type),
    };
  }).filter((g) => g.transactions.length > 0);

  const profit = roundToPaisa(revenue - expenses);
  const budget = meta.budget ?? null;

  return {
    projectId: meta.projectId,
    projectName: meta.projectName,
    startDate: period.startDate,
    endDate: period.endDate,
    generatedAt: options.generatedAt ?? new Date(),
    accrual: {
      revenue,
      expenses,
      profit,
      marginPct: revenue > 0 ? roundToPaisa((profit / revenue) * 100) : null,
    },
    cash: {
      receipts,
      payments,
      net: roundToPaisa(receipts - payments),
    },
    budget: {
      amount: budget,
      utilisationPct: budget && budget > 0 ? roundToPaisa((expenses / budget) * 100) : null,
      variance: budget !== null ? roundToPaisa(budget - expenses) : null,
    },
    groups,
    transactionCount: inPeriod.length,
    excludedCount,
    excludedTotal,
  };
}

/* ─── Firestore fetch ───────────────────────────────────────────── */

export async function generateProjectFinancialsReport(
  db: Firestore,
  projectId: string,
  period: ProjectPeriod
): Promise<ProjectFinancialsReport> {
  // Equality on projectId only; the date range is applied in memory so the
  // existing (projectId, date) index is enough and no new one is needed (rule 2).
  const [txnSnap, costCentreSnap, projectSnap] = await Promise.all([
    getDocs(query(collection(db, COLLECTIONS.TRANSACTIONS), where('projectId', '==', projectId))),
    getDocs(query(collection(db, COLLECTIONS.COST_CENTRES), where('projectId', '==', projectId))),
    getDocs(collection(db, COLLECTIONS.PROJECTS)),
  ]);

  // The project name comes from the master, not from the transactions: the page
  // previously carried an empty string here, so every export was untitled.
  let projectName = projectId;
  for (const d of projectSnap.docs) {
    if (d.id !== projectId) continue;
    const n = (d.data() as { name?: unknown }).name;
    if (typeof n === 'string' && n.trim()) projectName = n.trim();
  }

  let budget: number | null = null;
  for (const d of costCentreSnap.docs) {
    const b = (d.data() as { budgetAmount?: unknown }).budgetAmount;
    if (typeof b === 'number' && Number.isFinite(b)) budget = roundToPaisa((budget ?? 0) + b);
  }

  const transactions: ProjectTransaction[] = [];
  for (const d of txnSnap.docs) {
    const data = d.data() as Record<string, unknown> & { isDeleted?: boolean };
    if (data.isDeleted === true) continue; // rule 3 — client-side

    const date = toDate((data.date ?? data.paymentDate) as Parameters<typeof toDate>[0]);
    if (!date) continue;

    transactions.push({
      id: d.id,
      type: data.type as TransactionType,
      reference: typeof data.transactionNumber === 'string' ? data.transactionNumber : d.id,
      date,
      description: typeof data.description === 'string' ? data.description : '',
      counterparty: typeof data.entityName === 'string' ? data.entityName : '',
      currency: typeof data.currency === 'string' ? data.currency : 'INR',
      nativeAmount:
        typeof data.totalAmount === 'number'
          ? roundToPaisa(data.totalAmount)
          : typeof data.amount === 'number'
            ? roundToPaisa(data.amount)
            : 0,
      amountInr: getInrAmount(data as Parameters<typeof getInrAmount>[0]),
    });
  }

  return computeProjectFinancials(transactions, period, { projectId, projectName, budget });
}
