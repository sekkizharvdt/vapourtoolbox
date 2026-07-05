/**
 * Unit tests for the pure balance-calculation logic behind onTransactionWrite
 * and recalculateAccountBalances.
 *
 * The invariant under test: for any document write, the applied delta equals
 * "effective entries after minus effective entries before", where a missing or
 * soft-deleted transaction contributes nothing (CLAUDE.md rule 3). This must
 * agree with aggregateBalanceChanges (the recalculation path) — incremental
 * and from-scratch balances may never diverge.
 */

import {
  calculateBalanceChanges,
  effectiveEntries,
  resolveBalanceUpdate,
  aggregateBalanceChanges,
  roundToPaisa,
  type LedgerEntry,
  type TransactionLike,
} from './accountBalanceLogic';

const entry = (accountId: string, debit: number, credit: number): LedgerEntry => ({
  accountId,
  debit,
  credit,
});

const txn = (entries: LedgerEntry[], extra: Partial<TransactionLike> = {}): TransactionLike => ({
  type: 'JOURNAL_ENTRY',
  status: 'POSTED',
  entries,
  ...extra,
});

describe('effectiveEntries', () => {
  it('returns entries of a live transaction', () => {
    const t = txn([entry('a1', 100, 0), entry('a2', 0, 100)]);
    expect(effectiveEntries(t)).toHaveLength(2);
  });

  it('returns [] for null/undefined (doc does not exist)', () => {
    expect(effectiveEntries(null)).toEqual([]);
    expect(effectiveEntries(undefined)).toEqual([]);
  });

  it('returns [] for a soft-deleted transaction (rule 3)', () => {
    expect(effectiveEntries(txn([entry('a1', 100, 0)], { isDeleted: true }))).toEqual([]);
  });

  it('returns [] when entries is missing or malformed', () => {
    expect(effectiveEntries({ type: 'VENDOR_BILL' })).toEqual([]);
    expect(effectiveEntries({ entries: 'not-an-array' })).toEqual([]);
  });
});

describe('calculateBalanceChanges', () => {
  it('sums debits and credits per account', () => {
    const changes = calculateBalanceChanges([
      entry('a1', 100, 0),
      entry('a2', 0, 60),
      entry('a2', 0, 40),
    ]);
    expect(changes.get('a1')).toEqual({ debit: 100, credit: 0 });
    expect(changes.get('a2')).toEqual({ debit: 0, credit: 100 });
  });

  it('aggregates multiple entries hitting the same account on both sides', () => {
    const changes = calculateBalanceChanges([entry('a1', 100, 0), entry('a1', 0, 30)]);
    expect(changes.get('a1')).toEqual({ debit: 100, credit: 30 });
  });

  it('skips entries without accountId and treats missing amounts as 0', () => {
    const changes = calculateBalanceChanges([
      { accountId: '', debit: 50, credit: 0 },
      { accountId: 'a1' } as LedgerEntry,
    ]);
    expect(changes.has('')).toBe(false);
    expect(changes.get('a1')).toEqual({ debit: 0, credit: 0 });
  });
});

describe('resolveBalanceUpdate — create', () => {
  it('applies all entries on create', () => {
    const delta = resolveBalanceUpdate(null, txn([entry('a1', 500, 0), entry('a2', 0, 500)]));
    expect(delta.get('a1')).toEqual({ debit: 500, credit: 0 });
    expect(delta.get('a2')).toEqual({ debit: 0, credit: 500 });
  });

  it('applies nothing when a doc is created already soft-deleted', () => {
    const delta = resolveBalanceUpdate(null, txn([entry('a1', 500, 0)], { isDeleted: true }));
    expect(delta.size).toBe(0);
  });
});

describe('resolveBalanceUpdate — update', () => {
  it('returns empty delta when entries are unchanged (e.g. status-only edit)', () => {
    const entries = [entry('a1', 500, 0), entry('a2', 0, 500)];
    const delta = resolveBalanceUpdate(
      txn(entries, { status: 'DRAFT' }),
      txn(entries, { status: 'POSTED' })
    );
    expect(delta.size).toBe(0);
  });

  it('applies the net delta when an amount changes', () => {
    const before = txn([entry('a1', 500, 0), entry('a2', 0, 500)]);
    const after = txn([entry('a1', 700, 0), entry('a2', 0, 700)]);
    const delta = resolveBalanceUpdate(before, after);
    expect(delta.get('a1')).toEqual({ debit: 200, credit: 0 });
    expect(delta.get('a2')).toEqual({ debit: 0, credit: 200 });
  });

  it('moves the full amount when an entry switches account', () => {
    const before = txn([entry('a1', 500, 0), entry('a2', 0, 500)]);
    const after = txn([entry('a3', 500, 0), entry('a2', 0, 500)]);
    const delta = resolveBalanceUpdate(before, after);
    expect(delta.get('a1')).toEqual({ debit: -500, credit: 0 });
    expect(delta.get('a3')).toEqual({ debit: 500, credit: 0 });
    expect(delta.has('a2')).toBe(false);
  });
});

describe('resolveBalanceUpdate — delete', () => {
  it('fully reverses entries on hard delete of a live transaction', () => {
    const delta = resolveBalanceUpdate(txn([entry('a1', 500, 0), entry('a2', 0, 500)]), null);
    expect(delta.get('a1')).toEqual({ debit: -500, credit: 0 });
    expect(delta.get('a2')).toEqual({ debit: 0, credit: -500 });
  });

  it('does NOT reverse again on hard delete of an already-soft-deleted transaction', () => {
    const delta = resolveBalanceUpdate(txn([entry('a1', 500, 0)], { isDeleted: true }), null);
    expect(delta.size).toBe(0);
  });
});

describe('resolveBalanceUpdate — soft delete & restore (the rule-3 fix)', () => {
  const entries = [entry('a1', 500, 0), entry('a2', 0, 500)];

  it('reverses entries when isDeleted flips false→true', () => {
    const delta = resolveBalanceUpdate(txn(entries), txn(entries, { isDeleted: true }));
    expect(delta.get('a1')).toEqual({ debit: -500, credit: 0 });
    expect(delta.get('a2')).toEqual({ debit: 0, credit: -500 });
  });

  it('re-applies entries on restore (isDeleted removed via deleteField)', () => {
    // restoreTransaction uses deleteField(), so isDeleted is absent after restore
    const delta = resolveBalanceUpdate(txn(entries, { isDeleted: true }), txn(entries));
    expect(delta.get('a1')).toEqual({ debit: 500, credit: 0 });
    expect(delta.get('a2')).toEqual({ debit: 0, credit: 500 });
  });

  it('soft delete + restore round-trip nets to zero', () => {
    const softDelete = resolveBalanceUpdate(txn(entries), txn(entries, { isDeleted: true }));
    const restore = resolveBalanceUpdate(txn(entries, { isDeleted: true }), txn(entries));
    for (const [accountId, change] of softDelete) {
      const back = restore.get(accountId)!;
      expect(change.debit + back.debit).toBe(0);
      expect(change.credit + back.credit).toBe(0);
    }
  });

  it('is a no-op when a soft-deleted transaction is edited while deleted', () => {
    const delta = resolveBalanceUpdate(
      txn(entries, { isDeleted: true }),
      txn([entry('a1', 999, 0)], { isDeleted: true })
    );
    expect(delta.size).toBe(0);
  });
});

describe('rounding (rule 21)', () => {
  it('rounds float residue in deltas to paisa', () => {
    // 0.1 + 0.2 !== 0.3 in floats; the delta must still come out exact
    const before = txn([entry('a1', 0.1, 0)]);
    const after = txn([entry('a1', 0.1, 0), entry('a1', 0.2, 0)]);
    const delta = resolveBalanceUpdate(before, after);
    expect(delta.get('a1')!.debit).toBe(0.2);
  });

  it('drops accounts whose delta rounds to zero', () => {
    const before = txn([entry('a1', 100, 0)]);
    const after = txn([entry('a1', 100.001, 0)]);
    expect(resolveBalanceUpdate(before, after).size).toBe(0);
  });

  it('roundToPaisa rounds to 2 decimals', () => {
    expect(roundToPaisa(10.005)).toBe(10.01);
    expect(roundToPaisa(0.1 + 0.2)).toBe(0.3);
  });
});

describe('aggregateBalanceChanges (recalculation path)', () => {
  it('sums across transactions and skips soft-deleted ones', () => {
    const totals = aggregateBalanceChanges([
      txn([entry('a1', 100, 0), entry('a2', 0, 100)]),
      txn([entry('a1', 50, 0), entry('a2', 0, 50)]),
      txn([entry('a1', 999, 0)], { isDeleted: true }),
    ]);
    expect(totals.get('a1')).toEqual({ debit: 150, credit: 0 });
    expect(totals.get('a2')).toEqual({ debit: 0, credit: 150 });
  });

  it('agrees with the incremental path over a write history', () => {
    // Replay a history through resolveBalanceUpdate and compare against
    // aggregating the final state — the two paths must never diverge.
    const v1 = txn([entry('a1', 100, 0), entry('a2', 0, 100)]);
    const v2 = txn([entry('a1', 250, 0), entry('a2', 0, 250)]); // amended
    const v3 = txn(v2.entries as LedgerEntry[], { isDeleted: true }); // soft-deleted
    const other = txn([entry('a1', 40, 0), entry('a3', 0, 40)]);

    const incremental = new Map<string, { debit: number; credit: number }>();
    const apply = (delta: Map<string, { debit: number; credit: number }>) => {
      for (const [accountId, change] of delta) {
        const cur = incremental.get(accountId) || { debit: 0, credit: 0 };
        incremental.set(accountId, {
          debit: roundToPaisa(cur.debit + change.debit),
          credit: roundToPaisa(cur.credit + change.credit),
        });
      }
    };
    apply(resolveBalanceUpdate(null, v1)); // create
    apply(resolveBalanceUpdate(null, other)); // create other
    apply(resolveBalanceUpdate(v1, v2)); // amend
    apply(resolveBalanceUpdate(v2, v3)); // soft delete

    const fromScratch = aggregateBalanceChanges([v3, other]);
    for (const accountId of ['a1', 'a2', 'a3']) {
      const inc = incremental.get(accountId) || { debit: 0, credit: 0 };
      const agg = fromScratch.get(accountId) || { debit: 0, credit: 0 };
      expect(inc).toEqual(agg);
    }
  });
});
