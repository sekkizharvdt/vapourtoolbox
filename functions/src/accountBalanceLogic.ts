/**
 * Pure balance-calculation logic for account balance maintenance.
 *
 * No firebase imports — everything here is deterministic input → output so it
 * can be unit-tested without emulators. The Firestore trigger and the
 * recalculation callable in accountBalances.ts are thin shells over this module.
 *
 * Core semantics: a soft-deleted transaction (isDeleted === true) contributes
 * NOTHING to account balances (CLAUDE.md rule 3). resolveBalanceUpdate treats
 * every write as "effective entries after minus effective entries before",
 * which uniformly handles create, update, hard delete, soft delete, restore,
 * and hard-delete-of-already-soft-deleted (no double reversal).
 */

export interface LedgerEntry {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
  costCentreId?: string;
  accountCode?: string;
  accountName?: string;
}

export interface TransactionLike {
  entries?: unknown;
  isDeleted?: boolean;
  [key: string]: unknown;
}

export interface BalanceChange {
  debit: number;
  credit: number;
}

/** Round to 2 decimals (paisa) — rule 21. */
export function roundToPaisa(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The GL entries a transaction contributes to balances.
 * Missing doc, soft-deleted doc, or malformed entries field → contributes nothing.
 */
export function effectiveEntries(txn: TransactionLike | null | undefined): LedgerEntry[] {
  if (!txn || txn.isDeleted) return [];
  return Array.isArray(txn.entries) ? (txn.entries as LedgerEntry[]) : [];
}

/**
 * Sum ledger entries into per-account debit/credit totals.
 * Entries without an accountId are skipped.
 */
export function calculateBalanceChanges(entries: LedgerEntry[]): Map<string, BalanceChange> {
  const changes = new Map<string, BalanceChange>();

  for (const entry of entries) {
    if (!entry.accountId) continue;

    const current = changes.get(entry.accountId) || { debit: 0, credit: 0 };
    changes.set(entry.accountId, {
      debit: current.debit + (entry.debit || 0),
      credit: current.credit + (entry.credit || 0),
    });
  }

  return changes;
}

/**
 * Net per-account delta for a transaction document write (create/update/delete).
 *
 * delta = changes(effectiveEntries(after)) − changes(effectiveEntries(before))
 *
 * Deltas are rounded to paisa; accounts whose rounded delta is zero on both
 * sides are dropped, so an update that doesn't change entries (e.g. a status
 * edit) returns an empty map and the caller can skip the batch commit.
 */
export function resolveBalanceUpdate(
  before: TransactionLike | null | undefined,
  after: TransactionLike | null | undefined
): Map<string, BalanceChange> {
  const delta = new Map<string, BalanceChange>();

  for (const [accountId, change] of calculateBalanceChanges(effectiveEntries(before))) {
    const current = delta.get(accountId) || { debit: 0, credit: 0 };
    delta.set(accountId, {
      debit: current.debit - change.debit,
      credit: current.credit - change.credit,
    });
  }

  for (const [accountId, change] of calculateBalanceChanges(effectiveEntries(after))) {
    const current = delta.get(accountId) || { debit: 0, credit: 0 };
    delta.set(accountId, {
      debit: current.debit + change.debit,
      credit: current.credit + change.credit,
    });
  }

  for (const [accountId, change] of delta) {
    const debit = roundToPaisa(change.debit);
    const credit = roundToPaisa(change.credit);
    if (debit === 0 && credit === 0) {
      delta.delete(accountId);
    } else {
      delta.set(accountId, { debit, credit });
    }
  }

  return delta;
}

/**
 * Aggregate per-account totals across a full transaction set, skipping
 * soft-deleted transactions. Used by recalculateAccountBalances to rebuild
 * balances from scratch. Totals are rounded to paisa.
 */
export function aggregateBalanceChanges(
  transactions: TransactionLike[]
): Map<string, BalanceChange> {
  const totals = new Map<string, BalanceChange>();

  for (const txn of transactions) {
    for (const [accountId, change] of calculateBalanceChanges(effectiveEntries(txn))) {
      const current = totals.get(accountId) || { debit: 0, credit: 0 };
      totals.set(accountId, {
        debit: current.debit + change.debit,
        credit: current.credit + change.credit,
      });
    }
  }

  for (const [accountId, change] of totals) {
    totals.set(accountId, {
      debit: roundToPaisa(change.debit),
      credit: roundToPaisa(change.credit),
    });
  }

  return totals;
}
