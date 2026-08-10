/**
 * Customer & Vendor Concentration Report
 *
 * Entity ledger answers "what did we do with this counterparty"; nothing in the
 * app ranks *across* counterparties. This does: revenue by customer and spend by
 * vendor, each ordered by size with cumulative share, top-N concentration, a
 * Herfindahl index, and movement against the immediately preceding period of the
 * same length.
 *
 * Concentration is a risk measure, so the shape matters more than the totals: one
 * customer at 60% of revenue is a different business from ten at 6% each, and the
 * cumulative column is what makes that visible at a glance.
 *
 * Revenue is customer invoices (earned), not receipts (collected) — pairing it
 * with the receivables report separates "who buys" from "who pays". All amounts
 * are INR via `getInrAmount` (rule 21).
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { toDate } from '@/lib/firebase/typeHelpers';
import { getInrAmount, roundToPaisa } from '@/lib/accounting/amountHelpers';

const PAISA_TOLERANCE = 0.01;

/* ─── Inputs ────────────────────────────────────────────────────── */

export interface ConcentrationDoc {
  entityId: string;
  entityName: string;
  date: Date;
  amountInr: number;
}

export interface ConcentrationPeriod {
  startDate: Date;
  /** Inclusive. */
  endDate: Date;
}

/* ─── Output ────────────────────────────────────────────────────── */

export interface ConcentrationRow {
  entityId: string;
  entityName: string;
  amount: number;
  /** Share of the side's total, 0–100. */
  sharePct: number;
  /** Running share including every row above, 0–100. */
  cumulativePct: number;
  documentCount: number;
  priorAmount: number;
  changeAmount: number;
  /** Null when there was no prior-period activity to compare against. */
  changePct: number | null;
}

export interface ConcentrationSide {
  kind: 'CUSTOMER' | 'VENDOR';
  total: number;
  priorTotal: number;
  counterpartyCount: number;
  documentCount: number;
  top1Pct: number;
  top3Pct: number;
  top5Pct: number;
  top10Pct: number;
  /**
   * Herfindahl–Hirschman index over percentage shares (0–10,000). Above ~2,500
   * is conventionally "highly concentrated"; it rises sharply as revenue leans on
   * fewer names, which a simple top-5 share can hide.
   */
  hhi: number;
  /** Counterparties needed to reach half the total — 1 is a single point of failure. */
  countToHalf: number;
  rows: ConcentrationRow[];
}

export interface EntityConcentrationReport {
  startDate: Date;
  endDate: Date;
  priorStartDate: Date;
  priorEndDate: Date;
  generatedAt: Date;
  customers: ConcentrationSide;
  vendors: ConcentrationSide;
}

/* ─── Pure computation ──────────────────────────────────────────── */

function pct(part: number, whole: number): number {
  return whole > 0 ? roundToPaisa((part / whole) * 100) : 0;
}

/** The window of equal length ending immediately before `period` starts. */
export function priorPeriodOf(period: ConcentrationPeriod): ConcentrationPeriod {
  const span = period.endDate.getTime() - period.startDate.getTime();
  const priorEnd = new Date(period.startDate.getTime() - 1);
  return { startDate: new Date(priorEnd.getTime() - span), endDate: priorEnd };
}

function within(d: Date, p: ConcentrationPeriod): boolean {
  return d.getTime() >= p.startDate.getTime() && d.getTime() <= p.endDate.getTime();
}

export function computeConcentrationSide(
  kind: 'CUSTOMER' | 'VENDOR',
  docs: ConcentrationDoc[],
  period: ConcentrationPeriod,
  prior: ConcentrationPeriod
): ConcentrationSide {
  const current = new Map<string, { name: string; amount: number; count: number }>();
  const previous = new Map<string, number>();

  for (const doc of docs) {
    if (doc.amountInr <= PAISA_TOLERANCE) continue;
    if (within(doc.date, period)) {
      const row = current.get(doc.entityId);
      if (row) {
        row.amount = roundToPaisa(row.amount + doc.amountInr);
        row.count++;
        // Keep the most recent non-empty name we see.
        if (doc.entityName) row.name = doc.entityName;
      } else {
        current.set(doc.entityId, {
          name: doc.entityName || doc.entityId,
          amount: doc.amountInr,
          count: 1,
        });
      }
    } else if (within(doc.date, prior)) {
      previous.set(doc.entityId, roundToPaisa((previous.get(doc.entityId) ?? 0) + doc.amountInr));
    }
  }

  const total = roundToPaisa(Array.from(current.values()).reduce((sum, r) => sum + r.amount, 0));
  const priorTotal = roundToPaisa(Array.from(previous.values()).reduce((s, v) => s + v, 0));

  const ordered = Array.from(current.entries()).sort((a, b) => b[1].amount - a[1].amount);

  let running = 0;
  let countToHalf = 0;
  const rows: ConcentrationRow[] = ordered.map(([entityId, r]) => {
    running = roundToPaisa(running + r.amount);
    if (countToHalf === 0 && total > 0 && running >= total / 2) {
      countToHalf = ordered.findIndex(([id]) => id === entityId) + 1;
    }
    const priorAmount = previous.get(entityId) ?? 0;
    return {
      entityId,
      entityName: r.name,
      amount: r.amount,
      sharePct: pct(r.amount, total),
      cumulativePct: pct(running, total),
      documentCount: r.count,
      priorAmount,
      changeAmount: roundToPaisa(r.amount - priorAmount),
      changePct: priorAmount > PAISA_TOLERANCE ? pct(r.amount - priorAmount, priorAmount) : null,
    };
  });

  const topN = (n: number) =>
    pct(
      rows.slice(0, n).reduce((s, r) => s + r.amount, 0),
      total
    );
  const hhi = Math.round(rows.reduce((s, r) => s + r.sharePct * r.sharePct, 0));

  return {
    kind,
    total,
    priorTotal,
    counterpartyCount: rows.length,
    documentCount: rows.reduce((s, r) => s + r.documentCount, 0),
    top1Pct: topN(1),
    top3Pct: topN(3),
    top5Pct: topN(5),
    top10Pct: topN(10),
    hhi,
    countToHalf,
    rows,
  };
}

export function computeEntityConcentration(
  customerDocs: ConcentrationDoc[],
  vendorDocs: ConcentrationDoc[],
  period: ConcentrationPeriod,
  options: { generatedAt?: Date; prior?: ConcentrationPeriod } = {}
): EntityConcentrationReport {
  const prior = options.prior ?? priorPeriodOf(period);
  return {
    startDate: period.startDate,
    endDate: period.endDate,
    priorStartDate: prior.startDate,
    priorEndDate: prior.endDate,
    generatedAt: options.generatedAt ?? new Date(),
    customers: computeConcentrationSide('CUSTOMER', customerDocs, period, prior),
    vendors: computeConcentrationSide('VENDOR', vendorDocs, period, prior),
  };
}

/* ─── Firestore fetch ───────────────────────────────────────────── */

async function fetchSide(
  db: Firestore,
  type: 'CUSTOMER_INVOICE' | 'VENDOR_BILL'
): Promise<ConcentrationDoc[]> {
  // Equality-only filters — served by the existing (type, status, date) index.
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.TRANSACTIONS),
      where('type', '==', type),
      where('status', 'in', ['POSTED', 'APPROVED'])
    )
  );

  const out: ConcentrationDoc[] = [];
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown> & { isDeleted?: boolean };
    if (data.isDeleted === true) continue; // rule 3 — filtered client-side

    const date = toDate(
      (type === 'CUSTOMER_INVOICE'
        ? (data.invoiceDate ?? data.date)
        : (data.billDate ?? data.date)) as Parameters<typeof toDate>[0]
    );
    if (!date) continue;

    const entityId =
      typeof data.entityId === 'string' && data.entityId ? data.entityId : '(unassigned)';
    out.push({
      entityId,
      entityName:
        typeof data.entityName === 'string' && data.entityName ? data.entityName : entityId,
      date,
      amountInr: getInrAmount(data as Parameters<typeof getInrAmount>[0]),
    });
  }
  return out;
}

export async function generateEntityConcentrationReport(
  db: Firestore,
  period: ConcentrationPeriod
): Promise<EntityConcentrationReport> {
  const [customerDocs, vendorDocs] = await Promise.all([
    fetchSide(db, 'CUSTOMER_INVOICE'),
    fetchSide(db, 'VENDOR_BILL'),
  ]);
  return computeEntityConcentration(customerDocs, vendorDocs, period);
}
