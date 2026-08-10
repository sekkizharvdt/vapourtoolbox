/**
 * Foreign Currency Exposure
 *
 * Every non-INR transaction, grouped by currency: what was booked, at what rate,
 * and how much is still open. Nothing in the app surfaced the currency dimension
 * at all, despite `currency`, `exchangeRate` and `baseAmount` sitting on every
 * transaction.
 *
 * **Scope is deliberately exposure, not realized gain or loss.** The settlement
 * fields that a realized-FX report needs — `bankSettlementRate`,
 * `bankSettlementAmount`, `bankCharges`, `forexGainLoss` — are populated on zero
 * records, because no create or edit path writes them. A gain/loss report built
 * today would render empty columns, so the report instead measures what *is*
 * recorded and states the capture gap outright via `settlementCoverage`.
 *
 * The rate spread per currency is the closest available proxy for FX risk: it is
 * the range of booking rates actually used, so a wide spread means the INR value
 * of similar invoices moved materially over the period.
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { TransactionType } from '@vapour/types';
import { COLLECTIONS } from '@vapour/firebase';
import { toDate } from '@/lib/firebase/typeHelpers';
import { deriveOutstanding, getInrAmount, roundToPaisa } from '@/lib/accounting/amountHelpers';

const PAISA_TOLERANCE = 0.01;

/* ─── Inputs ────────────────────────────────────────────────────── */

export interface FxTransaction {
  id: string;
  type: TransactionType;
  reference: string;
  date: Date;
  counterparty: string;
  currency: string;
  /** Amount in the foreign currency as invoiced/billed. */
  foreignAmount: number;
  /** Booked INR value. */
  inrAmount: number;
  /** INR per unit of foreign currency, as booked. */
  exchangeRate: number | null;
  /** Still-open INR amount for invoices and bills; zero for settled or non-open types. */
  openInr: number;
  /** Whether an open balance is money in or money out. */
  side: 'RECEIVABLE' | 'PAYABLE' | 'NONE';
  hasSettlementData: boolean;
}

export interface FxPeriod {
  startDate: Date;
  /** Inclusive. */
  endDate: Date;
}

/* ─── Output ────────────────────────────────────────────────────── */

export interface FxCurrencyRow {
  currency: string;
  transactionCount: number;
  foreignTotal: number;
  inrTotal: number;
  /** Value-weighted INR per unit — what the book actually converted at. */
  weightedRate: number | null;
  minRate: number | null;
  maxRate: number | null;
  /** (max − min) / min, as a percentage. Null with fewer than two rates. */
  rateSpreadPct: number | null;
  openReceivableInr: number;
  openPayableInr: number;
  /** Net open exposure in INR: receivables less payables. */
  netOpenInr: number;
}

export interface FxExposureReport {
  startDate: Date;
  endDate: Date;
  generatedAt: Date;
  currencies: FxCurrencyRow[];
  totals: {
    transactionCount: number;
    inrTotal: number;
    openReceivableInr: number;
    openPayableInr: number;
    netOpenInr: number;
  };
  /**
   * How many foreign-currency transactions carry bank-settlement data. While this
   * is zero, realized gain/loss cannot be reported at all — the report says so
   * rather than showing a silent zero.
   */
  settlementCoverage: { withSettlementData: number; total: number };
  transactions: FxTransaction[];
}

/* ─── Pure computation ──────────────────────────────────────────── */

export function computeFxExposure(
  transactions: FxTransaction[],
  period: FxPeriod,
  options: { generatedAt?: Date } = {}
): FxExposureReport {
  const inPeriod = transactions
    .filter(
      (t) =>
        t.date.getTime() >= period.startDate.getTime() &&
        t.date.getTime() <= period.endDate.getTime()
    )
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const byCurrency = new Map<string, FxTransaction[]>();
  for (const t of inPeriod) {
    const list = byCurrency.get(t.currency);
    if (list) list.push(t);
    else byCurrency.set(t.currency, [t]);
  }

  const currencies: FxCurrencyRow[] = Array.from(byCurrency.entries())
    .map(([currency, list]) => {
      const rates = list.map((t) => t.exchangeRate).filter((r): r is number => r !== null && r > 0);
      const foreignTotal = roundToPaisa(list.reduce((s, t) => s + t.foreignAmount, 0));
      const inrTotal = roundToPaisa(list.reduce((s, t) => s + t.inrAmount, 0));
      const minRate = rates.length > 0 ? Math.min(...rates) : null;
      const maxRate = rates.length > 0 ? Math.max(...rates) : null;

      const openReceivableInr = roundToPaisa(
        list.filter((t) => t.side === 'RECEIVABLE').reduce((s, t) => s + t.openInr, 0)
      );
      const openPayableInr = roundToPaisa(
        list.filter((t) => t.side === 'PAYABLE').reduce((s, t) => s + t.openInr, 0)
      );

      return {
        currency,
        transactionCount: list.length,
        foreignTotal,
        inrTotal,
        // Weighted by INR value, not a plain mean: a single large invoice should
        // move the effective rate more than a small one.
        weightedRate: foreignTotal > 0 ? roundToPaisa(inrTotal / foreignTotal) : null,
        minRate,
        maxRate,
        rateSpreadPct:
          minRate !== null && maxRate !== null && rates.length > 1 && minRate > 0
            ? roundToPaisa(((maxRate - minRate) / minRate) * 100)
            : null,
        openReceivableInr,
        openPayableInr,
        netOpenInr: roundToPaisa(openReceivableInr - openPayableInr),
      };
    })
    .sort((a, b) => b.inrTotal - a.inrTotal);

  return {
    startDate: period.startDate,
    endDate: period.endDate,
    generatedAt: options.generatedAt ?? new Date(),
    currencies,
    totals: {
      transactionCount: inPeriod.length,
      inrTotal: roundToPaisa(currencies.reduce((s, c) => s + c.inrTotal, 0)),
      openReceivableInr: roundToPaisa(currencies.reduce((s, c) => s + c.openReceivableInr, 0)),
      openPayableInr: roundToPaisa(currencies.reduce((s, c) => s + c.openPayableInr, 0)),
      netOpenInr: roundToPaisa(currencies.reduce((s, c) => s + c.netOpenInr, 0)),
    },
    settlementCoverage: {
      withSettlementData: inPeriod.filter((t) => t.hasSettlementData).length,
      total: inPeriod.length,
    },
    transactions: inPeriod,
  };
}

/* ─── Firestore fetch ───────────────────────────────────────────── */

/** Only invoices and bills carry an open balance worth reporting as exposure. */
function openSide(type: TransactionType): 'RECEIVABLE' | 'PAYABLE' | 'NONE' {
  if (type === 'CUSTOMER_INVOICE') return 'RECEIVABLE';
  if (type === 'VENDOR_BILL') return 'PAYABLE';
  return 'NONE';
}

export async function generateFxExposureReport(
  db: Firestore,
  period: FxPeriod
): Promise<FxExposureReport> {
  // Equality-only on status; the currency filter runs in memory because a
  // non-INR test cannot be expressed as a Firestore equality.
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.TRANSACTIONS), where('status', 'in', ['POSTED', 'APPROVED']))
  );

  const transactions: FxTransaction[] = [];
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown> & { isDeleted?: boolean };
    if (data.isDeleted === true) continue; // rule 3 — client-side

    const currency = typeof data.currency === 'string' ? data.currency : 'INR';
    if (!currency || currency === 'INR') continue;

    const date = toDate((data.date ?? data.invoiceDate) as Parameters<typeof toDate>[0]);
    if (!date) continue;

    const type = data.type as TransactionType;
    const inrAmount = getInrAmount(data as Parameters<typeof getInrAmount>[0]);

    // The foreign-currency face value: totalAmount is stated in `currency` for
    // forex documents, with baseAmount carrying the INR equivalent.
    const foreignAmount =
      typeof data.totalAmount === 'number' && Number.isFinite(data.totalAmount)
        ? data.totalAmount
        : typeof data.amount === 'number' && Number.isFinite(data.amount)
          ? data.amount
          : 0;

    const rate =
      typeof data.exchangeRate === 'number' && data.exchangeRate > 0
        ? data.exchangeRate
        : foreignAmount > 0
          ? roundToPaisa(inrAmount / foreignAmount)
          : null;

    const side = openSide(type);
    const openInr =
      side === 'NONE' ? 0 : deriveOutstanding(data as Parameters<typeof deriveOutstanding>[0]);

    transactions.push({
      id: d.id,
      type,
      reference: typeof data.transactionNumber === 'string' ? data.transactionNumber : d.id,
      date,
      counterparty: typeof data.entityName === 'string' ? data.entityName : '',
      currency,
      foreignAmount: roundToPaisa(foreignAmount),
      inrAmount,
      exchangeRate: rate,
      openInr: openInr > PAISA_TOLERANCE ? openInr : 0,
      side,
      hasSettlementData:
        typeof data.bankSettlementAmount === 'number' ||
        typeof data.bankSettlementRate === 'number' ||
        typeof data.forexGainLoss === 'number',
    });
  }

  return computeFxExposure(transactions, period);
}
