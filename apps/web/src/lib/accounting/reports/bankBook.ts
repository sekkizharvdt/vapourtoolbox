/**
 * Bank Book
 *
 * Per bank/cash account: opening balance, receipts, payments and closing balance
 * for a period, with the underlying movements listed. Nothing in the app showed a
 * per-account cash position — receipts & payments categorises by nature, and the
 * account ledger works off GL postings rather than the settlement account a
 * payment actually moved through.
 *
 * **No reconciliation section.** `reconciledDate` is set on zero transactions, so
 * a "reconciled vs unreconciled" split would be a column of noughts pretending to
 * be a control. If bank reconciliation starts being recorded, that section is the
 * natural next addition here.
 *
 * Opening balance is the account's own `openingBalance` plus every movement
 * before the period start, so the book is continuous rather than starting from
 * zero on whatever date the user picks.
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { TransactionType } from '@vapour/types';
import { COLLECTIONS } from '@vapour/firebase';
import { toDate } from '@/lib/firebase/typeHelpers';
import { getInrAmount, roundToPaisa } from '@/lib/accounting/amountHelpers';

const PAISA_TOLERANCE = 0.01;

/**
 * Which way money moves through the settlement account, per transaction type.
 * A lookup rather than a switch so adding a tenth type is a compile error
 * (rule 24). `null` means the type never settles through a bank account.
 */
const CASH_DIRECTION: Record<TransactionType, 'IN' | 'OUT' | null> = {
  CUSTOMER_PAYMENT: 'IN',
  DIRECT_RECEIPT: 'IN',
  VENDOR_PAYMENT: 'OUT',
  DIRECT_PAYMENT: 'OUT',
  EXPENSE_CLAIM: 'OUT',
  // Both legs live on one document; handled separately so each account sees its side.
  BANK_TRANSFER: null,
  // Accrual documents — they raise a balance, they do not move cash.
  CUSTOMER_INVOICE: null,
  VENDOR_BILL: null,
  JOURNAL_ENTRY: null,
};

/* ─── Inputs ────────────────────────────────────────────────────── */

export interface BankMovement {
  id: string;
  accountId: string;
  date: Date;
  type: TransactionType;
  reference: string;
  description: string;
  counterparty: string;
  direction: 'IN' | 'OUT';
  amountInr: number;
  paymentMethod: string;
}

export interface BankAccountInfo {
  id: string;
  code: string;
  name: string;
  openingBalance: number;
}

export interface BankBookPeriod {
  startDate: Date;
  /** Inclusive. */
  endDate: Date;
}

/* ─── Output ────────────────────────────────────────────────────── */

export interface BankBookAccount {
  accountId: string;
  accountCode: string;
  accountName: string;
  /** True when the id on the transactions matches no account document. */
  unresolved: boolean;
  openingBalance: number;
  receipts: number;
  payments: number;
  closingBalance: number;
  receiptCount: number;
  paymentCount: number;
  movements: BankMovement[];
  /** Receipts and payments split by payment method, largest first. */
  byMethod: { method: string; receipts: number; payments: number; count: number }[];
}

export interface BankBookReport {
  startDate: Date;
  endDate: Date;
  generatedAt: Date;
  accounts: BankBookAccount[];
  totals: {
    openingBalance: number;
    receipts: number;
    payments: number;
    closingBalance: number;
  };
  /** Movements whose settlement account could not be resolved to an account doc. */
  unresolvedAccountCount: number;
}

/* ─── Pure computation ──────────────────────────────────────────── */

export function computeBankBook(
  movements: BankMovement[],
  accounts: Map<string, BankAccountInfo>,
  period: BankBookPeriod,
  options: { generatedAt?: Date } = {}
): BankBookReport {
  const byAccount = new Map<string, BankMovement[]>();
  for (const m of movements) {
    const list = byAccount.get(m.accountId);
    if (list) list.push(m);
    else byAccount.set(m.accountId, [m]);
  }

  const out: BankBookAccount[] = [];

  for (const [accountId, all] of byAccount) {
    const info = accounts.get(accountId);

    const before = all.filter((m) => m.date.getTime() < period.startDate.getTime());
    const inPeriod = all
      .filter(
        (m) =>
          m.date.getTime() >= period.startDate.getTime() &&
          m.date.getTime() <= period.endDate.getTime()
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const netBefore = before.reduce(
      (sum, m) => sum + (m.direction === 'IN' ? m.amountInr : -m.amountInr),
      0
    );
    const openingBalance = roundToPaisa((info?.openingBalance ?? 0) + netBefore);

    const receipts = roundToPaisa(
      inPeriod.filter((m) => m.direction === 'IN').reduce((s, m) => s + m.amountInr, 0)
    );
    const payments = roundToPaisa(
      inPeriod.filter((m) => m.direction === 'OUT').reduce((s, m) => s + m.amountInr, 0)
    );

    const methods = new Map<string, { receipts: number; payments: number; count: number }>();
    for (const m of inPeriod) {
      const key = m.paymentMethod || 'Unspecified';
      const row = methods.get(key) ?? { receipts: 0, payments: 0, count: 0 };
      if (m.direction === 'IN') row.receipts = roundToPaisa(row.receipts + m.amountInr);
      else row.payments = roundToPaisa(row.payments + m.amountInr);
      row.count++;
      methods.set(key, row);
    }

    out.push({
      accountId,
      accountCode: info?.code ?? '',
      accountName: info?.name ?? `Unknown account (${accountId})`,
      unresolved: !info,
      openingBalance,
      receipts,
      payments,
      closingBalance: roundToPaisa(openingBalance + receipts - payments),
      receiptCount: inPeriod.filter((m) => m.direction === 'IN').length,
      paymentCount: inPeriod.filter((m) => m.direction === 'OUT').length,
      movements: inPeriod,
      byMethod: Array.from(methods.entries())
        .map(([method, v]) => ({ method, ...v }))
        .sort((a, b) => b.receipts + b.payments - (a.receipts + a.payments)),
    });
  }

  out.sort((a, b) => Math.abs(b.closingBalance) - Math.abs(a.closingBalance));

  return {
    startDate: period.startDate,
    endDate: period.endDate,
    generatedAt: options.generatedAt ?? new Date(),
    accounts: out,
    totals: {
      openingBalance: roundToPaisa(out.reduce((s, a) => s + a.openingBalance, 0)),
      receipts: roundToPaisa(out.reduce((s, a) => s + a.receipts, 0)),
      payments: roundToPaisa(out.reduce((s, a) => s + a.payments, 0)),
      closingBalance: roundToPaisa(out.reduce((s, a) => s + a.closingBalance, 0)),
    },
    unresolvedAccountCount: out.filter((a) => a.unresolved).length,
  };
}

/* ─── Firestore fetch ───────────────────────────────────────────── */

/** A payment's settlement account: the explicit bank account, else the deposit account. */
function settlementAccountId(data: Record<string, unknown>): string | null {
  if (typeof data.bankAccountId === 'string' && data.bankAccountId) return data.bankAccountId;
  if (typeof data.depositedToBankAccountId === 'string' && data.depositedToBankAccountId) {
    return data.depositedToBankAccountId;
  }
  return null;
}

export async function generateBankBookReport(
  db: Firestore,
  period: BankBookPeriod
): Promise<BankBookReport> {
  const [txnSnap, accountSnap] = await Promise.all([
    // Equality-only on status — the cash types are filtered in memory, since an
    // `in` over five types plus a status filter buys nothing over one read here.
    getDocs(
      query(collection(db, COLLECTIONS.TRANSACTIONS), where('status', 'in', ['POSTED', 'APPROVED']))
    ),
    getDocs(collection(db, COLLECTIONS.ACCOUNTS)),
  ]);

  const accounts = new Map<string, BankAccountInfo>();
  for (const d of accountSnap.docs) {
    const a = d.data() as Record<string, unknown>;
    accounts.set(d.id, {
      id: d.id,
      code: typeof a.code === 'string' ? a.code : '',
      name: typeof a.name === 'string' ? a.name : d.id,
      openingBalance: typeof a.openingBalance === 'number' ? a.openingBalance : 0,
    });
  }

  const movements: BankMovement[] = [];
  for (const d of txnSnap.docs) {
    const data = d.data() as Record<string, unknown> & { isDeleted?: boolean };
    if (data.isDeleted === true) continue; // rule 3 — client-side

    const type = data.type as TransactionType;
    const date = toDate((data.paymentDate ?? data.date) as Parameters<typeof toDate>[0]);
    if (!date) continue;

    const amountInr = getInrAmount(data as Parameters<typeof getInrAmount>[0]);
    if (amountInr <= PAISA_TOLERANCE) continue;

    const base = {
      id: d.id,
      date,
      type,
      reference: typeof data.transactionNumber === 'string' ? data.transactionNumber : d.id,
      description: typeof data.description === 'string' ? data.description : '',
      counterparty: typeof data.entityName === 'string' ? data.entityName : '',
      amountInr,
      paymentMethod: typeof data.paymentMethod === 'string' ? data.paymentMethod : '',
    };

    if (type === 'BANK_TRANSFER') {
      // One document, two accounts — emit both legs so each book balances.
      const from = typeof data.fromBankAccountId === 'string' ? data.fromBankAccountId : null;
      const to = typeof data.toBankAccountId === 'string' ? data.toBankAccountId : null;
      if (from) movements.push({ ...base, accountId: from, direction: 'OUT' });
      if (to) movements.push({ ...base, accountId: to, direction: 'IN' });
      continue;
    }

    const direction = CASH_DIRECTION[type];
    if (!direction) continue;

    const accountId = settlementAccountId(data);
    if (!accountId) continue;

    movements.push({ ...base, accountId, direction });
  }

  return computeBankBook(movements, accounts, period);
}
