/**
 * Expense Analysis
 *
 * Where the money goes, cut three ways: by expense account, by project/cost
 * centre, and by counterparty — each with movement against the equal-length
 * window before, plus a monthly trend.
 *
 * **Sourced from direct payments, not expense claims.** The plan assumed
 * `EXPENSE_CLAIM` would drive this; there are zero such records. The 247
 * `DIRECT_PAYMENT` transactions are where operating spend actually lives, so
 * that is what the report reads, alongside `EXPENSE_CLAIM` for whenever claims
 * start being recorded.
 *
 * Category comes from the debit legs of the GL entry rather than a label on the
 * transaction: the posting is the only place that says *what* was bought. Bank
 * and cash legs are excluded, since those are the funding side, not the expense.
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { TransactionType } from '@vapour/types';
import { COLLECTIONS } from '@vapour/firebase';
import { toDate } from '@/lib/firebase/typeHelpers';
import { roundToPaisa } from '@/lib/accounting/amountHelpers';

const PAISA_TOLERANCE = 0.01;

/** Source types that represent operating spend leaving the business. */
const EXPENSE_TYPES: TransactionType[] = ['DIRECT_PAYMENT', 'EXPENSE_CLAIM'];

/* ─── Inputs ────────────────────────────────────────────────────── */

export interface ExpenseLine {
  transactionId: string;
  reference: string;
  date: Date;
  type: TransactionType;
  /** Expense account the debit landed on. */
  accountId: string;
  accountName: string;
  counterparty: string;
  projectId: string | null;
  projectName: string;
  amountInr: number;
}

export interface ExpensePeriod {
  startDate: Date;
  /** Inclusive. */
  endDate: Date;
}

/* ─── Output ────────────────────────────────────────────────────── */

export interface ExpenseBreakdownRow {
  key: string;
  label: string;
  amount: number;
  sharePct: number;
  lineCount: number;
  priorAmount: number;
  changeAmount: number;
  /** Null when there was nothing in the prior window to compare against. */
  changePct: number | null;
}

export interface ExpenseTrendPoint {
  label: string;
  amount: number;
}

export interface ExpenseAnalysisReport {
  startDate: Date;
  endDate: Date;
  priorStartDate: Date;
  priorEndDate: Date;
  generatedAt: Date;
  total: number;
  priorTotal: number;
  lineCount: number;
  byAccount: ExpenseBreakdownRow[];
  byProject: ExpenseBreakdownRow[];
  byCounterparty: ExpenseBreakdownRow[];
  trend: ExpenseTrendPoint[];
  /** Lines whose GL posting named no expense account. */
  unclassifiedLineCount: number;
}

/* ─── Pure computation ──────────────────────────────────────────── */

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function pct(part: number, whole: number): number {
  return whole > 0 ? roundToPaisa((part / whole) * 100) : 0;
}

export function priorPeriodOf(period: ExpensePeriod): ExpensePeriod {
  const span = period.endDate.getTime() - period.startDate.getTime();
  const priorEnd = new Date(period.startDate.getTime() - 1);
  return { startDate: new Date(priorEnd.getTime() - span), endDate: priorEnd };
}

function within(d: Date, p: ExpensePeriod): boolean {
  return d.getTime() >= p.startDate.getTime() && d.getTime() <= p.endDate.getTime();
}

function breakdown(
  current: ExpenseLine[],
  prior: ExpenseLine[],
  keyOf: (l: ExpenseLine) => string,
  labelOf: (l: ExpenseLine) => string,
  total: number
): ExpenseBreakdownRow[] {
  const now = new Map<string, { label: string; amount: number; count: number }>();
  for (const l of current) {
    const key = keyOf(l);
    const row = now.get(key);
    if (row) {
      row.amount = roundToPaisa(row.amount + l.amountInr);
      row.count++;
    } else {
      now.set(key, { label: labelOf(l), amount: l.amountInr, count: 1 });
    }
  }

  const before = new Map<string, number>();
  for (const l of prior) {
    const key = keyOf(l);
    before.set(key, roundToPaisa((before.get(key) ?? 0) + l.amountInr));
  }

  return Array.from(now.entries())
    .map(([key, r]) => {
      const priorAmount = before.get(key) ?? 0;
      return {
        key,
        label: r.label,
        amount: r.amount,
        sharePct: pct(r.amount, total),
        lineCount: r.count,
        priorAmount,
        changeAmount: roundToPaisa(r.amount - priorAmount),
        changePct: priorAmount > PAISA_TOLERANCE ? pct(r.amount - priorAmount, priorAmount) : null,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export function computeExpenseAnalysis(
  lines: ExpenseLine[],
  period: ExpensePeriod,
  options: { generatedAt?: Date; prior?: ExpensePeriod } = {}
): ExpenseAnalysisReport {
  const prior = options.prior ?? priorPeriodOf(period);
  const current = lines.filter((l) => l.amountInr > PAISA_TOLERANCE && within(l.date, period));
  const previous = lines.filter((l) => l.amountInr > PAISA_TOLERANCE && within(l.date, prior));

  const total = roundToPaisa(current.reduce((s, l) => s + l.amountInr, 0));
  const priorTotal = roundToPaisa(previous.reduce((s, l) => s + l.amountInr, 0));

  // Month buckets across the period, so an empty month still shows as a zero.
  const trend: ExpenseTrendPoint[] = [];
  const cursor = new Date(period.startDate.getFullYear(), period.startDate.getMonth(), 1);
  while (cursor.getTime() <= period.endDate.getTime()) {
    const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
    trend.push({
      label: `${MONTH_LABELS[cursor.getMonth()]} ${cursor.getFullYear()}`,
      amount: roundToPaisa(
        current.filter((l) => l.date >= from && l.date <= to).reduce((s, l) => s + l.amountInr, 0)
      ),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return {
    startDate: period.startDate,
    endDate: period.endDate,
    priorStartDate: prior.startDate,
    priorEndDate: prior.endDate,
    generatedAt: options.generatedAt ?? new Date(),
    total,
    priorTotal,
    lineCount: current.length,
    byAccount: breakdown(
      current,
      previous,
      (l) => l.accountId,
      (l) => l.accountName,
      total
    ),
    byProject: breakdown(
      current,
      previous,
      (l) => l.projectId ?? '(unallocated)',
      (l) => l.projectName,
      total
    ),
    byCounterparty: breakdown(
      current,
      previous,
      (l) => l.counterparty || '(unnamed)',
      (l) => l.counterparty || '(unnamed)',
      total
    ),
    trend,
    unclassifiedLineCount: current.filter((l) => l.accountId === '(unclassified)').length,
  };
}

/* ─── Firestore fetch ───────────────────────────────────────────── */

/** Bank and cash legs fund the payment; they are not what was bought. */
function isFundingAccount(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes('bank') || lower.includes('cash');
}

export async function generateExpenseAnalysisReport(
  db: Firestore,
  period: ExpensePeriod,
  options: { projectNames?: Map<string, string> } = {}
): Promise<ExpenseAnalysisReport> {
  const [txnSnap, projectSnap, costCentreSnap] = await Promise.all([
    getDocs(query(collection(db, COLLECTIONS.TRANSACTIONS), where('type', 'in', EXPENSE_TYPES))),
    getDocs(collection(db, COLLECTIONS.PROJECTS)),
    getDocs(collection(db, COLLECTIONS.COST_CENTRES)),
  ]);

  // Same lesson as the period report: transactions tag project ids and cost-centre
  // ids interchangeably, so both masters are needed or rows render a raw id.
  const names = new Map<string, string>(options.projectNames ?? []);
  for (const d of projectSnap.docs) {
    const n = (d.data() as { name?: unknown }).name;
    if (typeof n === 'string' && n.trim()) names.set(d.id, n.trim());
  }
  for (const d of costCentreSnap.docs) {
    const n = (d.data() as { name?: unknown }).name;
    if (typeof n === 'string' && n.trim() && !names.has(d.id)) {
      names.set(d.id, `${n.trim()} (cost centre)`);
    }
  }

  const lines: ExpenseLine[] = [];
  for (const d of txnSnap.docs) {
    const data = d.data() as Record<string, unknown> & { isDeleted?: boolean };
    if (data.isDeleted === true) continue; // rule 3 — client-side

    const date = toDate((data.paymentDate ?? data.date) as Parameters<typeof toDate>[0]);
    if (!date) continue;

    const type = data.type as TransactionType;
    const reference = typeof data.transactionNumber === 'string' ? data.transactionNumber : d.id;
    const counterparty = typeof data.entityName === 'string' ? data.entityName : '';
    const projectId =
      typeof data.projectId === 'string' && data.projectId
        ? data.projectId
        : typeof data.costCentreId === 'string' && data.costCentreId
          ? data.costCentreId
          : null;

    const base = {
      transactionId: d.id,
      reference,
      date,
      type,
      counterparty,
      projectId,
      projectName: projectId ? (names.get(projectId) ?? projectId) : '(unallocated)',
    };

    const entries = Array.isArray(data.entries) ? data.entries : [];
    const debits = entries
      .map((e) => e as { accountId?: unknown; accountName?: unknown; debit?: unknown })
      .filter(
        (e): e is { accountId?: string; accountName?: string; debit: number } =>
          typeof e.debit === 'number' && e.debit > PAISA_TOLERANCE
      )
      .filter((e) => !isFundingAccount(typeof e.accountName === 'string' ? e.accountName : ''));

    if (debits.length === 0) {
      // No usable posting — keep the spend visible rather than dropping it.
      const amount =
        typeof data.baseAmount === 'number'
          ? data.baseAmount
          : typeof data.totalAmount === 'number'
            ? data.totalAmount
            : 0;
      if (amount > PAISA_TOLERANCE) {
        lines.push({
          ...base,
          accountId: '(unclassified)',
          accountName: 'Unclassified',
          amountInr: roundToPaisa(amount),
        });
      }
      continue;
    }

    for (const e of debits) {
      lines.push({
        ...base,
        accountId: typeof e.accountId === 'string' ? e.accountId : '(unclassified)',
        accountName:
          typeof e.accountName === 'string' && e.accountName ? e.accountName : 'Unclassified',
        amountInr: roundToPaisa(e.debit),
      });
    }
  }

  return computeExpenseAnalysis(lines, period);
}
