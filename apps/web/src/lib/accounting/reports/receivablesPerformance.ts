/**
 * Receivables Performance Report
 *
 * Answers how *fast* money comes in, which the existing reports do not. Entity
 * ledger covers one counterparty at a time and the period report's AR ageing is
 * a static snapshot — neither shows velocity: DSO, days-to-collect, on-time
 * rate, or whether invoicing is outrunning collection month to month.
 *
 * Three deliberate choices:
 *
 * 1. Outstanding comes from `deriveOutstanding` (total − `amountPaid`), the same
 *    canonical helper the ageing, data-health, payment-batch and overdue-email
 *    surfaces use. An earlier draft reconstructed it by replaying allocations;
 *    that produced a figure ten times larger, because `invoiceAllocations` are
 *    historically incomplete — some payments carry none and some allocate against
 *    a synthetic opening-balance id. Rule 21 bars trusting the cached
 *    `outstandingAmount`, not the maintained `amountPaid`, and a second
 *    definition of "outstanding" is exactly the parallel implementation rule 32
 *    warns about.
 *
 * 2. Because `amountPaid` is a running total rather than a dated history, the
 *    ageing is **as at today**, not as at the period end. The period bounds the
 *    flows (invoiced, collected, collection speed). `asOfIsAfterPeriodEnd` tells
 *    the UI to say so when someone runs a historical period.
 *
 * 3. Settlements join to invoices on `invoiceId`, not on the allocation's
 *    denormalised `invoiceDate`/`dueDate` — those are populated on well under
 *    half of allocations, so the join is both more accurate and more complete.
 *    Allocations are used only for *dates* (when cash arrived), never for
 *    outstanding.
 *
 * All money is INR (`getInrAmount`); a payment's INR value is split across its
 * allocations in proportion to their amounts, so a foreign-currency receipt
 * never leaks a non-INR figure into a total (rule 21).
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { toDate } from '@/lib/firebase/typeHelpers';
import { getInrAmount, deriveOutstanding, roundToPaisa } from '@/lib/accounting/amountHelpers';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Rule 21 — float residue must not make a settled invoice look open. */
const PAISA_TOLERANCE = 0.01;

/* ─── Inputs (structural, so tests can build fixtures directly) ── */

export interface ReceivableInvoice {
  id: string;
  entityId: string;
  entityName: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date | null;
  /** Invoice total in INR. */
  totalInr: number;
  /** Canonical open amount: total − amountPaid, via `deriveOutstanding`. */
  outstandingInr: number;
}

export interface ReceivableSettlement {
  invoiceId: string;
  paymentDate: Date;
  /** Portion of the receipt applied to this invoice, in INR. */
  amountInr: number;
}

export interface ReceivablesPeriod {
  startDate: Date;
  /** Inclusive. */
  endDate: Date;
}

/* ─── Output ────────────────────────────────────────────────────── */

export interface AgingBand {
  label: string;
  amount: number;
  count: number;
  /** Share of total outstanding, 0–100. */
  pct: number;
}

export interface ReceivablesTrendPoint {
  label: string;
  invoiced: number;
  collected: number;
  /** invoiced − collected: positive means the book grew that month. */
  net: number;
}

export interface CustomerReceivableRow {
  entityId: string;
  entityName: string;
  invoiced: number;
  collected: number;
  outstanding: number;
  overdue: number;
  invoiceCount: number;
  /** Amount-weighted, over settlements inside the period. Null if none. */
  avgDaysToCollect: number | null;
  /** By amount, over settlements whose invoice had a due date. Null if none. */
  onTimePct: number | null;
  oldestOverdueDays: number | null;
}

export interface ReceivablesHeadline {
  /** (outstanding / credit sales) x days in period. Null without sales. */
  dso: number | null;
  closingReceivables: number;
  creditSales: number;
  collectedInPeriod: number;
  /** Amount-weighted days from invoice date to receipt. */
  avgDaysToCollect: number | null;
  /** Median alongside the weighted mean — one slow whale moves only the mean. */
  medianDaysToCollect: number | null;
  onTimePctByAmount: number | null;
  onTimePctByCount: number | null;
  overdueAmount: number;
  overduePct: number;
  daysInPeriod: number;
}

export interface ReceivablesDataNotes {
  invoicesWithoutDueDate: number;
  /** Allocations pointing at something that is not a live customer invoice. */
  unmatchedSettlements: number;
  /**
   * Invoices whose allocation history does not reconcile with `amountPaid`.
   * Informational only — `amountPaid` remains the figure the report uses.
   */
  allocationReconciliationGaps: number;
  /** True when the ageing (always current) post-dates the requested period. */
  asOfIsAfterPeriodEnd: boolean;
}

export interface ReceivablesPerformanceReport {
  startDate: Date;
  endDate: Date;
  /** The ageing/outstanding reference date — always "now". */
  asOf: Date;
  generatedAt: Date;
  headline: ReceivablesHeadline;
  aging: AgingBand[];
  trend: ReceivablesTrendPoint[];
  customers: CustomerReceivableRow[];
  dataNotes: ReceivablesDataNotes;
}

/* ─── Pure computation ──────────────────────────────────────────── */

function daysBetween(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / MS_PER_DAY);
}

function inPeriod(d: Date, period: ReceivablesPeriod): boolean {
  return d.getTime() >= period.startDate.getTime() && d.getTime() <= period.endDate.getTime();
}

function pct(part: number, whole: number): number {
  return whole > 0 ? roundToPaisa((part / whole) * 100) : 0;
}

/**
 * Median days-to-collect, reported next to the weighted average: a single large
 * slow-paying invoice drags the average without moving the median, so the pair
 * shows whether slowness is systemic or one account.
 */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  if (s.length % 2 === 1) return s[mid] ?? null;
  return Math.round(((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2);
}

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

/** Month buckets covering the period, clipped to its bounds. */
function monthBuckets(period: ReceivablesPeriod): { label: string; from: Date; to: Date }[] {
  const out: { label: string; from: Date; to: Date }[] = [];
  const cursor = new Date(period.startDate.getFullYear(), period.startDate.getMonth(), 1);
  while (cursor.getTime() <= period.endDate.getTime()) {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
    out.push({
      label: `${MONTH_LABELS[cursor.getMonth()]} ${cursor.getFullYear()}`,
      from: monthStart.getTime() < period.startDate.getTime() ? period.startDate : monthStart,
      to: monthEnd.getTime() > period.endDate.getTime() ? period.endDate : monthEnd,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

export function computeReceivablesPerformance(
  invoices: ReceivableInvoice[],
  settlements: ReceivableSettlement[],
  period: ReceivablesPeriod,
  options: { asOf?: Date; storedPaidByInvoice?: Map<string, number> } = {}
): ReceivablesPerformanceReport {
  const asOf = options.asOf ?? new Date();
  const invoiceById = new Map(invoices.map((i) => [i.id, i]));

  const byInvoice = new Map<string, ReceivableSettlement[]>();
  let unmatchedSettlements = 0;
  for (const s of settlements) {
    if (!invoiceById.has(s.invoiceId)) {
      unmatchedSettlements++;
      continue;
    }
    const list = byInvoice.get(s.invoiceId);
    if (list) list.push(s);
    else byInvoice.set(s.invoiceId, [s]);
  }

  const creditSales = roundToPaisa(
    invoices.filter((i) => inPeriod(i.invoiceDate, period)).reduce((s, i) => s + i.totalInr, 0)
  );
  const periodSettlements = settlements.filter(
    (s) => invoiceById.has(s.invoiceId) && inPeriod(s.paymentDate, period)
  );
  const collectedInPeriod = roundToPaisa(periodSettlements.reduce((s, x) => s + x.amountInr, 0));

  /* Collection speed */
  let weightedDays = 0;
  let weightBase = 0;
  const dayValues: number[] = [];
  let onTimeAmount = 0;
  let datedAmount = 0;
  let onTimeCount = 0;
  let datedCount = 0;

  const perCustomerSpeed = new Map<
    string,
    { weighted: number; base: number; onTime: number; dated: number }
  >();

  for (const s of periodSettlements) {
    const inv = invoiceById.get(s.invoiceId);
    if (!inv) continue;
    const days = Math.max(0, daysBetween(s.paymentDate, inv.invoiceDate));
    weightedDays += days * s.amountInr;
    weightBase += s.amountInr;
    dayValues.push(days);

    const speed = perCustomerSpeed.get(inv.entityId) ?? {
      weighted: 0,
      base: 0,
      onTime: 0,
      dated: 0,
    };
    speed.weighted += days * s.amountInr;
    speed.base += s.amountInr;

    if (inv.dueDate) {
      datedAmount += s.amountInr;
      datedCount++;
      speed.dated += s.amountInr;
      if (s.paymentDate.getTime() <= inv.dueDate.getTime()) {
        onTimeAmount += s.amountInr;
        onTimeCount++;
        speed.onTime += s.amountInr;
      }
    }
    perCustomerSpeed.set(inv.entityId, speed);
  }

  /* Ageing on the canonical outstanding, as at `asOf` */
  const bands: { label: string; amount: number; count: number }[] = [
    { label: 'Not yet due', amount: 0, count: 0 },
    { label: 'Overdue 1–30 days', amount: 0, count: 0 },
    { label: 'Overdue 31–60 days', amount: 0, count: 0 },
    { label: 'Overdue 61–90 days', amount: 0, count: 0 },
    { label: 'Overdue over 90 days', amount: 0, count: 0 },
  ];

  let closingReceivables = 0;
  let overdueAmount = 0;
  let invoicesWithoutDueDate = 0;

  const customers = new Map<string, CustomerReceivableRow>();
  const ensureCustomer = (entityId: string, entityName: string) => {
    const existing = customers.get(entityId);
    if (existing) return existing;
    const row: CustomerReceivableRow = {
      entityId,
      entityName,
      invoiced: 0,
      collected: 0,
      outstanding: 0,
      overdue: 0,
      invoiceCount: 0,
      avgDaysToCollect: null,
      onTimePct: null,
      oldestOverdueDays: null,
    };
    customers.set(entityId, row);
    return row;
  };

  for (const inv of invoices) {
    const row = ensureCustomer(inv.entityId, inv.entityName);
    if (inPeriod(inv.invoiceDate, period)) {
      row.invoiced = roundToPaisa(row.invoiced + inv.totalInr);
      row.invoiceCount++;
    }

    const open = inv.outstandingInr;
    if (open <= PAISA_TOLERANCE) continue;

    closingReceivables = roundToPaisa(closingReceivables + open);
    row.outstanding = roundToPaisa(row.outstanding + open);

    if (!inv.dueDate) {
      invoicesWithoutDueDate++;
      bands[0]!.amount = roundToPaisa(bands[0]!.amount + open);
      bands[0]!.count++;
      continue;
    }

    const daysPastDue = daysBetween(asOf, inv.dueDate);
    const bandIndex =
      daysPastDue <= 0
        ? 0
        : daysPastDue <= 30
          ? 1
          : daysPastDue <= 60
            ? 2
            : daysPastDue <= 90
              ? 3
              : 4;
    bands[bandIndex]!.amount = roundToPaisa(bands[bandIndex]!.amount + open);
    bands[bandIndex]!.count++;

    if (daysPastDue > 0) {
      overdueAmount = roundToPaisa(overdueAmount + open);
      row.overdue = roundToPaisa(row.overdue + open);
      row.oldestOverdueDays = Math.max(row.oldestOverdueDays ?? 0, daysPastDue);
    }
  }

  for (const s of periodSettlements) {
    const inv = invoiceById.get(s.invoiceId);
    if (!inv) continue;
    const row = ensureCustomer(inv.entityId, inv.entityName);
    row.collected = roundToPaisa(row.collected + s.amountInr);
  }

  for (const [entityId, speed] of perCustomerSpeed) {
    const row = customers.get(entityId);
    if (!row) continue;
    row.avgDaysToCollect = speed.base > 0 ? Math.round(speed.weighted / speed.base) : null;
    row.onTimePct = speed.dated > 0 ? pct(speed.onTime, speed.dated) : null;
  }

  /* Trend — real flows only. Outstanding is a running total with no dated
     history, so a month-by-month closing balance cannot be derived honestly. */
  const trend: ReceivablesTrendPoint[] = monthBuckets(period).map(({ label, from, to }) => {
    const invoiced = invoices
      .filter((i) => i.invoiceDate >= from && i.invoiceDate <= to)
      .reduce((s, i) => s + i.totalInr, 0);
    const collected = settlements
      .filter((s) => invoiceById.has(s.invoiceId) && s.paymentDate >= from && s.paymentDate <= to)
      .reduce((s, x) => s + x.amountInr, 0);
    return {
      label,
      invoiced: roundToPaisa(invoiced),
      collected: roundToPaisa(collected),
      net: roundToPaisa(invoiced - collected),
    };
  });

  let allocationReconciliationGaps = 0;
  if (options.storedPaidByInvoice) {
    for (const inv of invoices) {
      const stored = options.storedPaidByInvoice.get(inv.id);
      if (stored === undefined) continue;
      const replayed = (byInvoice.get(inv.id) ?? []).reduce((s, x) => s + x.amountInr, 0);
      if (Math.abs(stored - replayed) > PAISA_TOLERANCE) allocationReconciliationGaps++;
    }
  }

  const daysInPeriod = Math.max(1, daysBetween(period.endDate, period.startDate) + 1);

  return {
    startDate: period.startDate,
    endDate: period.endDate,
    asOf,
    generatedAt: asOf,
    headline: {
      dso: creditSales > 0 ? Math.round((closingReceivables / creditSales) * daysInPeriod) : null,
      closingReceivables,
      creditSales,
      collectedInPeriod,
      avgDaysToCollect: weightBase > 0 ? Math.round(weightedDays / weightBase) : null,
      medianDaysToCollect: median(dayValues),
      onTimePctByAmount: datedAmount > 0 ? pct(onTimeAmount, datedAmount) : null,
      onTimePctByCount: datedCount > 0 ? pct(onTimeCount, datedCount) : null,
      overdueAmount,
      overduePct: pct(overdueAmount, closingReceivables),
      daysInPeriod,
    },
    aging: bands.map((b) => ({ ...b, pct: pct(b.amount, closingReceivables) })),
    trend,
    customers: Array.from(customers.values())
      .filter((c) => c.invoiced > 0 || c.collected > 0 || c.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding || b.invoiced - a.invoiced),
    dataNotes: {
      invoicesWithoutDueDate,
      unmatchedSettlements,
      allocationReconciliationGaps,
      asOfIsAfterPeriodEnd: asOf.getTime() > period.endDate.getTime(),
    },
  };
}

/* ─── Firestore fetch ───────────────────────────────────────────── */

/**
 * Splits a receipt's INR value across its allocations in proportion to their
 * amounts. `PaymentAllocation.allocatedAmount` carries no currency of its own,
 * so on a foreign-currency receipt it cannot be summed directly (rule 21).
 */
function settlementsFromPayment(data: Record<string, unknown>): ReceivableSettlement[] {
  const allocations = Array.isArray(data.invoiceAllocations) ? data.invoiceAllocations : [];
  if (allocations.length === 0) return [];

  const paymentDate = toDate((data.paymentDate ?? data.date) as Parameters<typeof toDate>[0]);
  if (!paymentDate) return [];

  const parsed = allocations
    .map((a) => a as { invoiceId?: unknown; allocatedAmount?: unknown })
    .filter(
      (a): a is { invoiceId: string; allocatedAmount: number } =>
        typeof a.invoiceId === 'string' &&
        a.invoiceId.length > 0 &&
        typeof a.allocatedAmount === 'number' &&
        Number.isFinite(a.allocatedAmount)
    );

  const allocatedTotal = parsed.reduce((s, a) => s + a.allocatedAmount, 0);
  if (allocatedTotal <= PAISA_TOLERANCE) return [];

  const paymentInr = getInrAmount(data as Parameters<typeof getInrAmount>[0]);
  return parsed.map((a) => ({
    invoiceId: a.invoiceId,
    paymentDate,
    amountInr: roundToPaisa(paymentInr * (a.allocatedAmount / allocatedTotal)),
  }));
}

export async function generateReceivablesPerformanceReport(
  db: Firestore,
  period: ReceivablesPeriod
): Promise<ReceivablesPerformanceReport> {
  const txnRef = collection(db, COLLECTIONS.TRANSACTIONS);

  // Equality-only filters, no orderBy — served by the existing
  // (type, status, date) index. Soft deletes are filtered client-side (rule 3).
  const [invSnap, paySnap] = await Promise.all([
    getDocs(
      query(
        txnRef,
        where('type', '==', 'CUSTOMER_INVOICE'),
        where('status', 'in', ['POSTED', 'APPROVED'])
      )
    ),
    getDocs(
      query(
        txnRef,
        where('type', '==', 'CUSTOMER_PAYMENT'),
        where('status', 'in', ['POSTED', 'APPROVED'])
      )
    ),
  ]);

  const invoices: ReceivableInvoice[] = [];
  const storedPaidByInvoice = new Map<string, number>();

  for (const d of invSnap.docs) {
    const data = d.data() as Record<string, unknown> & { isDeleted?: boolean };
    if (data.isDeleted === true) continue;

    const invoiceDate = toDate((data.invoiceDate ?? data.date) as Parameters<typeof toDate>[0]);
    if (!invoiceDate) continue;

    const totalInr = getInrAmount(data as Parameters<typeof getInrAmount>[0]);
    if (totalInr <= PAISA_TOLERANCE) continue;

    invoices.push({
      id: d.id,
      entityId: typeof data.entityId === 'string' ? data.entityId : '(unassigned)',
      entityName:
        typeof data.entityName === 'string' && data.entityName
          ? data.entityName
          : typeof data.entityId === 'string'
            ? data.entityId
            : '(unassigned)',
      invoiceNumber: typeof data.transactionNumber === 'string' ? data.transactionNumber : d.id,
      invoiceDate,
      dueDate: toDate(data.dueDate as Parameters<typeof toDate>[0]),
      totalInr,
      // Canonical open amount — the same helper the ageing, data-health and
      // overdue-email surfaces use, so this report cannot disagree with them.
      outstandingInr: deriveOutstanding(data as Parameters<typeof deriveOutstanding>[0]),
    });

    // `amountPaid` is what the atomic payment path maintains; `paidAmount` is the
    // older name the type still declares. Mirror deriveOutstanding's resolution.
    const storedPaid =
      typeof data.amountPaid === 'number' && Number.isFinite(data.amountPaid)
        ? data.amountPaid
        : typeof data.paidAmount === 'number' && Number.isFinite(data.paidAmount)
          ? data.paidAmount
          : null;
    if (storedPaid !== null) storedPaidByInvoice.set(d.id, roundToPaisa(storedPaid));
  }

  const settlements: ReceivableSettlement[] = [];
  for (const d of paySnap.docs) {
    const data = d.data() as Record<string, unknown> & { isDeleted?: boolean };
    if (data.isDeleted === true) continue;
    settlements.push(...settlementsFromPayment(data));
  }

  return computeReceivablesPerformance(invoices, settlements, period, { storedPaidByInvoice });
}
