/**
 * Period Report Data Service
 *
 * Aggregates data for the on-demand quarterly / annual management report.
 * Individual section fetchers are parallelizable; `fetchPeriodReportData`
 * composes the full payload that the PDF document + page preview consume.
 */

import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { CustomerInvoice } from '@vapour/types';
import { generateComparativeProfitLossReport, type ProfitLossReport } from './profitLoss';
import { generateBalanceSheet, type BalanceSheetReport } from './balanceSheet';
import { generateCashFlowStatement, type CashFlowStatement } from './cashFlow';

/* ─── Period model ────────────────────────────────────────────── */

export type QuarterCode = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FY';

export interface PeriodSelection {
  /** Indian fiscal-year start (e.g. 2025 means FY 2025-26) */
  fyStartYear: number;
  quarter: QuarterCode;
}

export interface ResolvedPeriod {
  label: string;
  startDate: Date;
  endDate: Date; // exclusive upper bound
  fyLabel: string;
}

export function resolvePeriod(sel: PeriodSelection): ResolvedPeriod {
  const fyStart = new Date(sel.fyStartYear, 3, 1); // 1 Apr
  const nextFyStart = new Date(sel.fyStartYear + 1, 3, 1);
  const fyLabel = `FY ${sel.fyStartYear}-${String((sel.fyStartYear + 1) % 100).padStart(2, '0')}`;

  if (sel.quarter === 'FY') {
    return { label: `${fyLabel} (Full Year)`, startDate: fyStart, endDate: nextFyStart, fyLabel };
  }

  const quarterOffsets: Record<Exclude<QuarterCode, 'FY'>, { start: number; end: number }> = {
    Q1: { start: 0, end: 3 }, // Apr-Jun
    Q2: { start: 3, end: 6 }, // Jul-Sep
    Q3: { start: 6, end: 9 }, // Oct-Dec
    Q4: { start: 9, end: 12 }, // Jan-Mar
  };
  const off = quarterOffsets[sel.quarter];
  const start = new Date(fyStart);
  start.setMonth(start.getMonth() + off.start);
  const end = new Date(fyStart);
  end.setMonth(end.getMonth() + off.end);

  return {
    label: `${fyLabel} ${sel.quarter}`,
    startDate: start,
    endDate: end,
    fyLabel,
  };
}

/* ─── Timestamp helper ────────────────────────────────────────── */

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function periodEndInclusive(period: ResolvedPeriod): Date {
  // Services expect an inclusive upper bound; resolvePeriod returns exclusive.
  const d = new Date(period.endDate);
  d.setMilliseconds(d.getMilliseconds() - 1);
  return d;
}

/* ─── Aging (shared for AR + AP) ──────────────────────────────── */

export interface AgingBuckets {
  current: number; // 0-30 (incl. not-yet-due)
  days31to60: number;
  days61to90: number;
  over90days: number;
}

export interface AgingBucketCounts {
  current: number;
  days31to60: number;
  days61to90: number;
  over90days: number;
}

export interface EntityAging {
  entityId: string;
  entityName: string;
  outstanding: number;
  daysPastDue: number; // max across that entity's documents
  invoiceCount: number; // count of open documents
}

export interface AgingSection {
  /** 'AR' for customer receivables, 'AP' for vendor payables */
  kind: 'AR' | 'AP';
  asOf: Date;
  totalOutstanding: number;
  invoiceCount: number;
  entityCount: number;
  buckets: AgingBuckets;
  bucketCounts: AgingBucketCounts;
  topEntities: EntityAging[]; // up to 10, descending by outstanding
  /** Share of total outstanding held by the top 5 entities */
  top5ConcentrationPct: number;
}

async function fetchAgingForType(
  db: Firestore,
  txnType: 'CUSTOMER_INVOICE' | 'VENDOR_BILL',
  asOf: Date
): Promise<AgingSection> {
  const q = query(
    collection(db, COLLECTIONS.TRANSACTIONS),
    where('type', '==', txnType),
    where('status', 'in', ['POSTED', 'APPROVED'])
  );
  const snap = await getDocs(q);

  const buckets: AgingBuckets = { current: 0, days31to60: 0, days61to90: 0, over90days: 0 };
  const bucketCounts: AgingBucketCounts = {
    current: 0,
    days31to60: 0,
    days61to90: 0,
    over90days: 0,
  };
  const entityMap = new Map<string, EntityAging>();
  let totalOutstanding = 0;
  let invoiceCount = 0;

  for (const d of snap.docs) {
    const data = d.data() as Partial<CustomerInvoice> & { isDeleted?: boolean };
    if (data.isDeleted === true) continue;

    const outstanding = Number(data.outstandingAmount ?? 0);
    if (outstanding <= 0.01) continue; // rule 21: use tolerance for zero-check

    const dueDate = toDate(data.dueDate);
    const daysPastDue = dueDate
      ? Math.floor((asOf.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    if (daysPastDue <= 30) {
      buckets.current += outstanding;
      bucketCounts.current++;
    } else if (daysPastDue <= 60) {
      buckets.days31to60 += outstanding;
      bucketCounts.days31to60++;
    } else if (daysPastDue <= 90) {
      buckets.days61to90 += outstanding;
      bucketCounts.days61to90++;
    } else {
      buckets.over90days += outstanding;
      bucketCounts.over90days++;
    }

    totalOutstanding += outstanding;
    invoiceCount++;

    const entityId = data.entityId ?? '(unassigned)';
    const entityName = data.entityName ?? entityId;
    const existing = entityMap.get(entityId);
    if (existing) {
      existing.outstanding += outstanding;
      existing.invoiceCount += 1;
      if (daysPastDue > existing.daysPastDue) existing.daysPastDue = daysPastDue;
    } else {
      entityMap.set(entityId, {
        entityId,
        entityName,
        outstanding,
        daysPastDue,
        invoiceCount: 1,
      });
    }
  }

  const allEntities = Array.from(entityMap.values()).sort((a, b) => b.outstanding - a.outstanding);
  const top5Total = allEntities.slice(0, 5).reduce((sum, e) => sum + e.outstanding, 0);
  const top5ConcentrationPct = totalOutstanding > 0 ? (top5Total / totalOutstanding) * 100 : 0;

  return {
    kind: txnType === 'CUSTOMER_INVOICE' ? 'AR' : 'AP',
    asOf,
    totalOutstanding,
    invoiceCount,
    entityCount: entityMap.size,
    buckets,
    bucketCounts,
    topEntities: allEntities.slice(0, 10),
    top5ConcentrationPct,
  };
}

export const fetchARAging = (db: Firestore, options: { asOf?: Date } = {}) =>
  fetchAgingForType(db, 'CUSTOMER_INVOICE', options.asOf ?? new Date());
export const fetchAPAging = (db: Firestore, options: { asOf?: Date } = {}) =>
  fetchAgingForType(db, 'VENDOR_BILL', options.asOf ?? new Date());

/* ─── P&L with QoQ comparison ─────────────────────────────────── */

export interface PnLSection {
  current: ProfitLossReport;
  previous: ProfitLossReport | null;
  changes: {
    revenue: { amount: number; percentage: number };
    expenses: { amount: number; percentage: number };
    netProfit: { amount: number; percentage: number };
  } | null;
}

async function fetchPnL(
  db: Firestore,
  tenantId: string,
  period: ResolvedPeriod
): Promise<PnLSection> {
  const start = period.startDate;
  const end = periodEndInclusive(period);
  // Comparative is meaningful only for sub-year periods or where prior-year data exists.
  const comparative = await generateComparativeProfitLossReport(db, start, end, tenantId);
  // If previous period has no activity at all, surface null to avoid misleading deltas.
  const prevHasActivity =
    comparative.previous.revenue.total > 0 || comparative.previous.expenses.total > 0;
  return {
    current: comparative.current,
    previous: prevHasActivity ? comparative.previous : null,
    changes: prevHasActivity ? comparative.changes : null,
  };
}

/* ─── Balance Sheet ───────────────────────────────────────────── */

async function fetchBalanceSheet(
  db: Firestore,
  tenantId: string,
  period: ResolvedPeriod
): Promise<BalanceSheetReport> {
  return generateBalanceSheet(db, periodEndInclusive(period), tenantId);
}

/* ─── Cash Flow ───────────────────────────────────────────────── */

async function fetchCashFlow(
  db: Firestore,
  tenantId: string,
  period: ResolvedPeriod
): Promise<CashFlowStatement> {
  return generateCashFlowStatement(db, period.startDate, periodEndInclusive(period), tenantId);
}

/* ─── Project performance ─────────────────────────────────────── */

export interface ProjectPerformanceRow {
  projectId: string;
  projectName: string;
  revenue: number;
  expense: number;
  margin: number;
  marginPct: number;
  invoiceCount: number;
  billCount: number;
}

export interface ProjectPerformanceSection {
  rows: ProjectPerformanceRow[];
  corporateOverhead: {
    /** Vendor-bill amount in period not tagged to any project */
    amount: number;
    billCount: number;
  };
  totals: {
    revenue: number;
    expense: number;
    margin: number;
    /** Share of total vendor-bill spend that's tagged to at least one project */
    taggedSpendPct: number;
  };
}

function extractProjectIds(data: Record<string, unknown>): string[] {
  const arr = Array.isArray(data.projectIds) ? (data.projectIds as unknown[]) : [];
  const ids = arr.filter((x): x is string => typeof x === 'string' && x.length > 0);
  if (ids.length > 0) return ids;
  const legacy = typeof data.projectId === 'string' ? data.projectId : null;
  return legacy ? [legacy] : [];
}

function extractProjectNames(data: Record<string, unknown>, ids: string[]): string[] {
  const arr = Array.isArray(data.projectNames) ? (data.projectNames as unknown[]) : [];
  const names = arr.filter((x): x is string => typeof x === 'string' && x.length > 0);
  if (names.length === ids.length) return names;
  // Fallback: single projectName string, or use ids
  if (typeof data.projectName === 'string' && data.projectName) {
    return ids.map(() => data.projectName as string);
  }
  return ids;
}

async function fetchProjectPerformance(
  db: Firestore,
  period: ResolvedPeriod
): Promise<ProjectPerformanceSection> {
  const startTs = Timestamp.fromDate(period.startDate);
  const endTs = Timestamp.fromDate(periodEndInclusive(period));

  const txnsRef = collection(db, COLLECTIONS.TRANSACTIONS);
  const [invSnap, billSnap] = await Promise.all([
    getDocs(
      query(
        txnsRef,
        where('type', '==', 'CUSTOMER_INVOICE'),
        where('date', '>=', startTs),
        where('date', '<=', endTs)
      )
    ),
    getDocs(
      query(
        txnsRef,
        where('type', '==', 'VENDOR_BILL'),
        where('date', '>=', startTs),
        where('date', '<=', endTs)
      )
    ),
  ]);

  const projects = new Map<string, ProjectPerformanceRow>();
  const ensureRow = (id: string, name: string) => {
    const existing = projects.get(id);
    if (existing) return existing;
    const row: ProjectPerformanceRow = {
      projectId: id,
      projectName: name,
      revenue: 0,
      expense: 0,
      margin: 0,
      marginPct: 0,
      invoiceCount: 0,
      billCount: 0,
    };
    projects.set(id, row);
    return row;
  };

  let totalRevenue = 0;
  let totalBilled = 0;
  let corporateOverheadAmount = 0;
  let corporateOverheadCount = 0;

  for (const d of invSnap.docs) {
    const data = d.data() as Record<string, unknown> & { isDeleted?: boolean };
    if (data.isDeleted === true) continue;
    const amount = Number(data.baseAmount ?? data.totalAmount ?? 0);
    if (amount <= 0.01) continue;
    totalRevenue += amount;

    const ids = extractProjectIds(data);
    if (ids.length === 0) {
      // Untagged invoices are rare per our coverage audit (0%); aggregate under a sentinel.
      const row = ensureRow('__untagged__', '(Untagged revenue)');
      row.revenue += amount;
      row.invoiceCount++;
      continue;
    }
    const names = extractProjectNames(data, ids);
    // Split amount equally across multiple projects — naive but defensible absent explicit splits.
    const per = amount / ids.length;
    ids.forEach((id, i) => {
      const row = ensureRow(id, names[i] ?? id);
      row.revenue += per;
      row.invoiceCount++;
    });
  }

  for (const d of billSnap.docs) {
    const data = d.data() as Record<string, unknown> & { isDeleted?: boolean };
    if (data.isDeleted === true) continue;
    const amount = Number(data.baseAmount ?? data.totalAmount ?? 0);
    if (amount <= 0.01) continue;
    totalBilled += amount;

    const ids = extractProjectIds(data);
    if (ids.length === 0) {
      corporateOverheadAmount += amount;
      corporateOverheadCount++;
      continue;
    }
    const names = extractProjectNames(data, ids);
    const per = amount / ids.length;
    ids.forEach((id, i) => {
      const row = ensureRow(id, names[i] ?? id);
      row.expense += per;
      row.billCount++;
    });
  }

  // Finalize margins, remove the sentinel row, sort by absolute spend descending.
  for (const row of projects.values()) {
    row.margin = row.revenue - row.expense;
    row.marginPct = row.revenue > 0 ? (row.margin / row.revenue) * 100 : 0;
  }
  const rows = Array.from(projects.values()).sort(
    (a, b) => Math.max(b.revenue, b.expense) - Math.max(a.revenue, a.expense)
  );

  return {
    rows,
    corporateOverhead: { amount: corporateOverheadAmount, billCount: corporateOverheadCount },
    totals: {
      revenue: totalRevenue,
      expense: totalBilled,
      margin: totalRevenue - totalBilled,
      taggedSpendPct:
        totalBilled > 0 ? ((totalBilled - corporateOverheadAmount) / totalBilled) * 100 : 0,
    },
  };
}

/* ─── Trial Balance (appendix) ────────────────────────────────── */

export interface TrialBalanceRow {
  code: string;
  name: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface TrialBalanceSection {
  rows: TrialBalanceRow[];
  totals: { debit: number; credit: number };
  balanced: boolean;
}

async function fetchTrialBalance(db: Firestore, tenantId: string): Promise<TrialBalanceSection> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.ACCOUNTS), where('tenantId', '==', tenantId))
  );
  const rows: TrialBalanceRow[] = snap.docs
    .map((d) => {
      const data = d.data() as Record<string, unknown>;
      const debit = Number(data.debit ?? 0);
      const credit = Number(data.credit ?? 0);
      return {
        code: String(data.code ?? ''),
        name: String(data.name ?? ''),
        debit,
        credit,
        balance: debit - credit,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  const totals = rows.reduce(
    (acc, r) => ({ debit: acc.debit + r.debit, credit: acc.credit + r.credit }),
    { debit: 0, credit: 0 }
  );
  return { rows, totals, balanced: Math.abs(totals.debit - totals.credit) < 0.01 };
}

/* ─── GST (simplified) ────────────────────────────────────────── */

export interface GSTSection {
  configured: boolean;
  // Present only when configured=true
  cgstInput: number;
  sgstInput: number;
  igstInput: number;
  cgstOutput: number;
  sgstOutput: number;
  igstOutput: number;
  totalInput: number;
  totalOutput: number;
  netPayable: number;
  /** Present when configured=false — tells the reader what's missing */
  missingAccountCodes: string[];
}

async function fetchGST(db: Firestore, tenantId: string): Promise<GSTSection> {
  // GST summary uses cumulative account balances rather than date-filtered GL entries
  // for this prototype. Aligns with how accounts are maintained; sufficient for a
  // "net position as of today" management view. Period-specific GST is a v1.1 item.
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.ACCOUNTS), where('tenantId', '==', tenantId))
  );
  const inputCodes = new Set(['1301', '1302', '1303']); // CGST/SGST/IGST Input
  const outputCodes = new Set(['2201', '2202', '2203']); // CGST/SGST/IGST Output
  const values: Record<string, number> = {};

  snap.docs.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    const code = String(data.code ?? '');
    if (!inputCodes.has(code) && !outputCodes.has(code)) return;
    const debit = Number(data.debit ?? 0);
    const credit = Number(data.credit ?? 0);
    values[code] = inputCodes.has(code) ? debit - credit : credit - debit;
  });

  const required = ['1301', '1302', '1303', '2201', '2202', '2203'];
  const missing = required.filter((c) => values[c] == null);

  if (missing.length === required.length) {
    return {
      configured: false,
      cgstInput: 0,
      sgstInput: 0,
      igstInput: 0,
      cgstOutput: 0,
      sgstOutput: 0,
      igstOutput: 0,
      totalInput: 0,
      totalOutput: 0,
      netPayable: 0,
      missingAccountCodes: missing,
    };
  }

  const cgstInput = values['1301'] ?? 0;
  const sgstInput = values['1302'] ?? 0;
  const igstInput = values['1303'] ?? 0;
  const cgstOutput = values['2201'] ?? 0;
  const sgstOutput = values['2202'] ?? 0;
  const igstOutput = values['2203'] ?? 0;
  const totalInput = cgstInput + sgstInput + igstInput;
  const totalOutput = cgstOutput + sgstOutput + igstOutput;

  return {
    configured: true,
    cgstInput,
    sgstInput,
    igstInput,
    cgstOutput,
    sgstOutput,
    igstOutput,
    totalInput,
    totalOutput,
    netPayable: totalOutput - totalInput,
    missingAccountCodes: missing,
  };
}

/* ─── Data Quality (simplified) ───────────────────────────────── */

export interface DataQualityFinding {
  severity: 'high' | 'medium' | 'low';
  label: string;
  count: number;
  detail?: string;
}

export interface DataQualitySection {
  findings: DataQualityFinding[];
  totalIssues: number;
}

async function fetchDataQuality(db: Firestore): Promise<DataQualitySection> {
  const txnRef = collection(db, COLLECTIONS.TRANSACTIONS);

  const [allSnap, paymentsSnap] = await Promise.all([
    getDocs(
      query(
        txnRef,
        where('type', 'in', [
          'CUSTOMER_INVOICE',
          'VENDOR_BILL',
          'CUSTOMER_PAYMENT',
          'VENDOR_PAYMENT',
          'JOURNAL_ENTRY',
        ])
      )
    ),
    getDocs(query(txnRef, where('type', 'in', ['CUSTOMER_PAYMENT', 'VENDOR_PAYMENT']))),
  ]);

  let missingGL = 0;
  let unmappedAccount = 0;
  let duplicateNumbers = 0;
  let unappliedPayments = 0;

  const numberSeen = new Map<string, number>();

  for (const d of allSnap.docs) {
    const data = d.data() as Record<string, unknown>;
    if (data.isDeleted === true) continue;

    if (data.status === 'POSTED') {
      const entries = Array.isArray(data.entries) ? data.entries : [];
      if (entries.length === 0) missingGL++;
    }

    const lineItems = Array.isArray(data.lineItems) ? (data.lineItems as unknown[]) : [];
    const hasUnmapped = lineItems.some((item) => {
      if (!item || typeof item !== 'object') return false;
      const accountId = (item as Record<string, unknown>).accountId;
      return !accountId;
    });
    if (hasUnmapped) unmappedAccount++;

    const num = data.transactionNumber;
    if (typeof num === 'string' && num.length > 0) {
      numberSeen.set(num, (numberSeen.get(num) ?? 0) + 1);
    }
  }
  duplicateNumbers = Array.from(numberSeen.values()).filter((c) => c > 1).length;

  for (const d of paymentsSnap.docs) {
    const data = d.data() as Record<string, unknown>;
    if (data.isDeleted === true) continue;
    if (data.isAdvance === true) continue; // intentional
    const allocs =
      data.type === 'CUSTOMER_PAYMENT'
        ? (data.invoiceAllocations as unknown[] | undefined)
        : (data.billAllocations as unknown[] | undefined);
    const hasAllocations =
      Array.isArray(allocs) &&
      allocs.some((a) => {
        if (!a || typeof a !== 'object') return false;
        const amount = (a as Record<string, unknown>).allocatedAmount;
        return typeof amount === 'number' && amount > 0;
      });
    if (!hasAllocations) unappliedPayments++;
  }

  const findings: DataQualityFinding[] = (
    [
      {
        severity: 'high',
        label: 'Transactions missing GL entries',
        count: missingGL,
        detail: 'Posted transactions with no ledger entries distort P&L and Balance Sheet totals.',
      },
      {
        severity: 'high',
        label: 'Duplicate transaction numbers',
        count: duplicateNumbers,
        detail: 'Two documents share a number — makes reconciliation ambiguous.',
      },
      {
        severity: 'medium',
        label: 'Unapplied payments',
        count: unappliedPayments,
        detail: 'Non-advance payments not allocated to any invoice/bill.',
      },
      {
        severity: 'low',
        label: 'Line items without account mapping',
        count: unmappedAccount,
        detail: 'Bills/invoices with line items missing an accountId.',
      },
    ] as DataQualityFinding[]
  ).filter((f) => f.count > 0);

  return { findings, totalIssues: findings.reduce((s, f) => s + f.count, 0) };
}

/* ─── Working Capital (derived) ───────────────────────────────── */

export interface WorkingCapitalSection {
  currentAssets: number;
  currentLiabilities: number;
  workingCapital: number;
  currentRatio: number | null;
  quickAssets: number; // currentAssets minus inventory (approx: current assets exc. "inventory" named accounts)
  quickRatio: number | null;
}

function computeWorkingCapital(bs: BalanceSheetReport): WorkingCapitalSection {
  const currentAssets = bs.assets.totalCurrentAssets;
  const currentLiabilities = bs.liabilities.totalCurrentLiabilities;
  const inventoryAmount = bs.assets.currentAssets
    .filter((a) => a.name.toLowerCase().includes('inventory'))
    .reduce((s, a) => s + a.balance, 0);
  const quickAssets = currentAssets - inventoryAmount;
  return {
    currentAssets,
    currentLiabilities,
    workingCapital: currentAssets - currentLiabilities,
    currentRatio: currentLiabilities > 0 ? currentAssets / currentLiabilities : null,
    quickAssets,
    quickRatio: currentLiabilities > 0 ? quickAssets / currentLiabilities : null,
  };
}

/* ─── Executive Summary (derived) ─────────────────────────────── */

export interface ExecutiveSummarySection {
  revenue: number;
  expenses: number;
  netProfit: number;
  profitMarginPct: number;
  netCashFlow: number;
  closingCash: number;
  arOutstanding: number;
  apOutstanding: number;
  workingCapital: number;
  dataQualityIssues: number;
}

function buildExecutiveSummary(args: {
  pnl: PnLSection;
  cashFlow: CashFlowStatement;
  arAging: AgingSection;
  apAging: AgingSection;
  workingCapital: WorkingCapitalSection;
  dataQuality: DataQualitySection;
}): ExecutiveSummarySection {
  const { pnl, cashFlow, arAging, apAging, workingCapital, dataQuality } = args;
  return {
    revenue: pnl.current.revenue.total,
    expenses: pnl.current.expenses.total,
    netProfit: pnl.current.netProfit,
    profitMarginPct: pnl.current.profitMargin,
    netCashFlow: cashFlow.netCashFlow,
    closingCash: cashFlow.closingCash,
    arOutstanding: arAging.totalOutstanding,
    apOutstanding: apAging.totalOutstanding,
    workingCapital: workingCapital.workingCapital,
    dataQualityIssues: dataQuality.totalIssues,
  };
}

/* ─── Top-level payload for the PDF ───────────────────────────── */

export interface PeriodReportData {
  period: ResolvedPeriod;
  generatedAt: Date;
  executiveSummary: ExecutiveSummarySection;
  pnl: PnLSection;
  balanceSheet: BalanceSheetReport;
  cashFlow: CashFlowStatement;
  arAging: AgingSection;
  apAging: AgingSection;
  workingCapital: WorkingCapitalSection;
  gst: GSTSection;
  projectPerformance: ProjectPerformanceSection;
  dataQuality: DataQualitySection;
  trialBalance: TrialBalanceSection;
}

export async function fetchPeriodReportData(
  db: Firestore,
  sel: PeriodSelection,
  tenantId: string
): Promise<PeriodReportData> {
  const period = resolvePeriod(sel);
  const now = new Date();
  const asOf = period.endDate.getTime() <= now.getTime() ? periodEndInclusive(period) : now;

  // Fire everything in parallel; services don't share state.
  const [
    arAging,
    apAging,
    pnl,
    balanceSheet,
    cashFlow,
    projectPerformance,
    gst,
    dataQuality,
    trialBalance,
  ] = await Promise.all([
    fetchAgingForType(db, 'CUSTOMER_INVOICE', asOf),
    fetchAgingForType(db, 'VENDOR_BILL', asOf),
    fetchPnL(db, tenantId, period),
    fetchBalanceSheet(db, tenantId, period),
    fetchCashFlow(db, tenantId, period),
    fetchProjectPerformance(db, period),
    fetchGST(db, tenantId),
    fetchDataQuality(db),
    fetchTrialBalance(db, tenantId),
  ]);

  const workingCapital = computeWorkingCapital(balanceSheet);
  const executiveSummary = buildExecutiveSummary({
    pnl,
    cashFlow,
    arAging,
    apAging,
    workingCapital,
    dataQuality,
  });

  return {
    period,
    generatedAt: now,
    executiveSummary,
    pnl,
    balanceSheet,
    cashFlow,
    arAging,
    apAging,
    workingCapital,
    gst,
    projectPerformance,
    dataQuality,
    trialBalance,
  };
}

/* ─── Backward-compat alias ───────────────────────────────────── */

// Keep the old type name alive while migrating downstream consumers.
export type ARAgingSection = AgingSection;
