/**
 * Pure data-integrity checks for the nightly audit (Phase 5 of
 * docs/archive/2026-07-05-automated-verification-plan.md).
 *
 * No firebase imports — deterministic input → output, unit-tested without
 * emulators (same pattern as accountBalanceLogic.ts). The GL recomputation
 * deliberately REUSES aggregateBalanceChanges/effectiveEntries from
 * accountBalanceLogic (rule 32): the incremental trigger, the manual
 * "Recalculate Balances" callable, and this audit must all agree on one
 * definition of "what a transaction contributes to balances".
 */

import {
  aggregateBalanceChanges,
  effectiveEntries,
  roundToPaisa,
  type LedgerEntry,
  type TransactionLike,
} from './accountBalanceLogic';

export interface AuditDoc {
  id: string;
  data: TransactionLike & Record<string, unknown>;
}

export interface AccountDoc {
  id: string;
  data: Record<string, unknown>;
}

export type AuditCheck =
  | 'UNBALANCED_ENTRIES'
  | 'MISSING_ENTRIES'
  | 'BALANCE_DRIFT'
  | 'ORPHANED_ENTITY'
  | 'ORPHANED_ACCOUNT'
  | 'DUPLICATE_NUMBER'
  | 'STALE_DRAFT';

export interface AuditFinding {
  check: AuditCheck;
  /** Document id the finding is about (transaction or account). */
  docId: string;
  /** Human-readable one-liner for the email / run summary. */
  message: string;
}

export interface AuditResult {
  findings: AuditFinding[];
  countsByCheck: Record<AuditCheck, number>;
  transactionsScanned: number;
  accountsScanned: number;
}

const TOLERANCE = 0.01; // paisa tolerance (rule 21)

/** Firestore Timestamp / Date / string → millis; null when unparseable (rule 14). */
function toMillis(raw: unknown): number | null {
  if (raw && typeof raw === 'object' && 'toDate' in raw) {
    return (raw as { toDate: () => Date }).toDate().getTime();
  }
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === 'string' || typeof raw === 'number') {
    const ms = new Date(raw).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

function label(txn: AuditDoc): string {
  const num = txn.data.transactionNumber;
  return typeof num === 'string' && num ? num : txn.id;
}

export function runDataIntegrityChecks(input: {
  transactions: AuditDoc[];
  accounts: AccountDoc[];
  entityIds: Set<string>;
  now: Date;
  staleDraftDays?: number;
}): AuditResult {
  const { transactions, accounts, entityIds, now, staleDraftDays = 30 } = input;
  const findings: AuditFinding[] = [];
  const live = transactions.filter((t) => !t.data.isDeleted);

  // ── 1. Per-transaction double entry (rule 21) ─────────────────────────────
  for (const txn of live) {
    const entries = effectiveEntries(txn.data);
    if (entries.length === 0) continue;
    const debit = entries.reduce((s: number, e: LedgerEntry) => s + (e.debit || 0), 0);
    const credit = entries.reduce((s: number, e: LedgerEntry) => s + (e.credit || 0), 0);
    const diff = roundToPaisa(Math.abs(debit - credit));
    if (diff >= TOLERANCE) {
      findings.push({
        check: 'UNBALANCED_ENTRIES',
        docId: txn.id,
        message: `${label(txn)}: debits ${roundToPaisa(debit)} ≠ credits ${roundToPaisa(credit)} (diff ${diff})`,
      });
    }
  }

  // ── 2. Posted/approved transactions with no GL entries at all ────────────
  for (const txn of live) {
    const status = txn.data.status;
    if (status !== 'POSTED' && status !== 'APPROVED') continue;
    if (effectiveEntries(txn.data).length === 0) {
      findings.push({
        check: 'MISSING_ENTRIES',
        docId: txn.id,
        message: `${label(txn)} (${String(txn.data.type ?? 'unknown type')}) is ${String(status)} but has no GL entries`,
      });
    }
  }

  // ── 3. Stored account balances vs from-scratch recomputation ─────────────
  // aggregateBalanceChanges skips soft-deleted transactions itself.
  const recomputed = aggregateBalanceChanges(transactions.map((t) => t.data));
  for (const account of accounts) {
    const rc = recomputed.get(account.id) ?? { debit: 0, credit: 0 };
    const expected = roundToPaisa(rc.debit - rc.credit);
    const stored =
      typeof account.data.currentBalance === 'number' ? account.data.currentBalance : 0;
    const drift = roundToPaisa(stored - expected);
    if (Math.abs(drift) >= TOLERANCE) {
      const code = typeof account.data.code === 'string' ? account.data.code : account.id;
      findings.push({
        check: 'BALANCE_DRIFT',
        docId: account.id,
        message: `Account ${code} (${String(account.data.name ?? '')}): stored ${stored}, recomputed ${expected} (drift ${drift})`,
      });
    }
  }

  // ── 4. Orphaned references ────────────────────────────────────────────────
  const accountIds = new Set(accounts.map((a) => a.id));
  for (const txn of live) {
    const entityId = txn.data.entityId;
    if (typeof entityId === 'string' && entityId && !entityIds.has(entityId)) {
      findings.push({
        check: 'ORPHANED_ENTITY',
        docId: txn.id,
        message: `${label(txn)} references missing entity ${entityId}`,
      });
    }
    const seenMissingAccounts = new Set<string>();
    for (const entry of effectiveEntries(txn.data)) {
      if (
        entry.accountId &&
        !accountIds.has(entry.accountId) &&
        !seenMissingAccounts.has(entry.accountId)
      ) {
        seenMissingAccounts.add(entry.accountId);
        findings.push({
          check: 'ORPHANED_ACCOUNT',
          docId: txn.id,
          message: `${label(txn)} has a GL entry against missing account ${entry.accountId}`,
        });
      }
    }
  }

  // ── 5. Duplicate transaction numbers ─────────────────────────────────────
  const byNumber = new Map<string, string[]>();
  for (const txn of live) {
    const num = txn.data.transactionNumber;
    if (typeof num !== 'string' || !num) continue;
    const ids = byNumber.get(num) ?? [];
    ids.push(txn.id);
    byNumber.set(num, ids);
  }
  for (const [num, ids] of byNumber) {
    if (ids.length > 1) {
      findings.push({
        check: 'DUPLICATE_NUMBER',
        docId: ids[0]!,
        message: `Transaction number ${num} used by ${ids.length} documents (${ids.join(', ')})`,
      });
    }
  }

  // ── 6. Stale drafts ───────────────────────────────────────────────────────
  const cutoff = now.getTime() - staleDraftDays * 24 * 60 * 60 * 1000;
  for (const txn of live) {
    if (txn.data.status !== 'DRAFT') continue;
    const ms = toMillis(txn.data.date) ?? toMillis(txn.data.createdAt);
    if (ms !== null && ms < cutoff) {
      findings.push({
        check: 'STALE_DRAFT',
        docId: txn.id,
        message: `${label(txn)} has been DRAFT for over ${staleDraftDays} days`,
      });
    }
  }

  const countsByCheck: Record<AuditCheck, number> = {
    UNBALANCED_ENTRIES: 0,
    MISSING_ENTRIES: 0,
    BALANCE_DRIFT: 0,
    ORPHANED_ENTITY: 0,
    ORPHANED_ACCOUNT: 0,
    DUPLICATE_NUMBER: 0,
    STALE_DRAFT: 0,
  };
  for (const f of findings) countsByCheck[f.check] += 1;

  return {
    findings,
    countsByCheck,
    transactionsScanned: transactions.length,
    accountsScanned: accounts.length,
  };
}
