/**
 * Unit tests for the nightly data-integrity audit checks.
 *
 * Key invariant: BALANCE_DRIFT must agree with the incremental trigger and
 * the Recalculate Balances callable — all three flow through
 * accountBalanceLogic, so a balance maintained correctly by the trigger can
 * never be flagged as drifted by the audit.
 */

import { runDataIntegrityChecks, type AuditDoc, type AccountDoc } from './dataIntegrityAuditLogic';
import { resolveBalanceUpdate } from './accountBalanceLogic';

const NOW = new Date('2026-07-06T12:00:00Z');
const OLD_DATE = new Date('2026-05-01T12:00:00Z'); // > 30 days before NOW
const RECENT_DATE = new Date('2026-07-01T12:00:00Z');

const entry = (accountId: string, debit: number, credit: number) => ({ accountId, debit, credit });

function txn(
  id: string,
  overrides: Partial<AuditDoc['data']> & Record<string, unknown> = {}
): AuditDoc {
  return {
    id,
    data: {
      type: 'JOURNAL_ENTRY',
      status: 'POSTED',
      transactionNumber: `TXN-${id}`,
      entityId: 'entity-1',
      date: RECENT_DATE,
      entries: [entry('acc-1', 100, 0), entry('acc-2', 0, 100)],
      ...overrides,
    },
  };
}

function account(
  id: string,
  currentBalance: number,
  extra: Record<string, unknown> = {}
): AccountDoc {
  return { id, data: { code: id, name: `Account ${id}`, currentBalance, ...extra } };
}

function run(
  transactions: AuditDoc[],
  accounts: AccountDoc[] = [account('acc-1', 0), account('acc-2', 0)],
  entityIds = new Set(['entity-1'])
) {
  return runDataIntegrityChecks({ transactions, accounts, entityIds, now: NOW });
}

describe('clean data produces no findings', () => {
  it('balanced posted transaction with consistent balances', () => {
    const result = run(
      [txn('t1')],
      [account('acc-1', 100), account('acc-2', -100)] // matches entries exactly
    );
    expect(result.findings).toEqual([]);
    expect(result.transactionsScanned).toBe(1);
    expect(result.accountsScanned).toBe(2);
  });
});

describe('UNBALANCED_ENTRIES', () => {
  it('flags debits ≠ credits beyond paisa tolerance', () => {
    const result = run(
      [txn('t1', { entries: [entry('acc-1', 100, 0), entry('acc-2', 0, 90)] })],
      [account('acc-1', 100), account('acc-2', -90)]
    );
    expect(result.countsByCheck.UNBALANCED_ENTRIES).toBe(1);
    expect(result.findings[0]!.docId).toBe('t1');
  });

  it('tolerates sub-paisa float residue', () => {
    const result = run(
      [txn('t1', { entries: [entry('acc-1', 0.1 + 0.2, 0), entry('acc-2', 0, 0.3)] })],
      [account('acc-1', 0.3), account('acc-2', -0.3)]
    );
    expect(result.countsByCheck.UNBALANCED_ENTRIES).toBe(0);
  });

  it('ignores soft-deleted transactions entirely (rule 3)', () => {
    const result = run(
      [txn('t1', { isDeleted: true, entries: [entry('acc-1', 100, 0)] })],
      [account('acc-1', 0)]
    );
    expect(result.findings).toEqual([]);
  });
});

describe('MISSING_ENTRIES', () => {
  it('flags a POSTED transaction with no GL entries', () => {
    const result = run([txn('t1', { entries: [] })], [account('acc-1', 0)]);
    expect(result.countsByCheck.MISSING_ENTRIES).toBe(1);
  });

  it('does not flag drafts without entries', () => {
    const result = run([txn('t1', { status: 'DRAFT', entries: [] })], [account('acc-1', 0)]);
    expect(result.countsByCheck.MISSING_ENTRIES).toBe(0);
  });
});

describe('BALANCE_DRIFT', () => {
  it('flags a stored balance that disagrees with recomputation', () => {
    const result = run([txn('t1')], [account('acc-1', 999), account('acc-2', -100)]);
    expect(result.countsByCheck.BALANCE_DRIFT).toBe(1);
    expect(result.findings[0]!.docId).toBe('acc-1');
  });

  it('flags a nonzero balance on an account no live transaction touches', () => {
    const result = run(
      [txn('t1', { isDeleted: true })], // its amounts must NOT count
      [account('acc-1', 100), account('acc-2', 0)]
    );
    expect(result.countsByCheck.BALANCE_DRIFT).toBe(1);
    expect(result.findings[0]!.docId).toBe('acc-1');
  });

  it('agrees with the incremental trigger over a write history', () => {
    // Replay create → amend → soft-delete through resolveBalanceUpdate
    // (the trigger's math) onto stored balances, then audit: no drift.
    const v1 = txn('t1').data;
    const v2 = { ...v1, entries: [entry('acc-1', 250, 0), entry('acc-2', 0, 250)] };
    const v3 = { ...v2, isDeleted: true };
    const other = txn('t2', { entries: [entry('acc-1', 40, 0), entry('acc-3', 0, 40)] }).data;

    const stored = new Map<string, number>();
    const apply = (before: typeof v1 | null, after: typeof v1 | null) => {
      for (const [accountId, change] of resolveBalanceUpdate(before, after)) {
        stored.set(accountId, (stored.get(accountId) ?? 0) + change.debit - change.credit);
      }
    };
    apply(null, v1);
    apply(null, other);
    apply(v1, v2);
    apply(v2, v3);

    const result = run(
      [
        { id: 't1', data: v3 },
        { id: 't2', data: other },
      ],
      ['acc-1', 'acc-2', 'acc-3'].map((id) => account(id, stored.get(id) ?? 0))
    );
    expect(result.countsByCheck.BALANCE_DRIFT).toBe(0);
  });
});

describe('orphaned references', () => {
  it('flags a transaction pointing at a missing entity', () => {
    const result = run(
      [txn('t1', { entityId: 'ghost-entity' })],
      [account('acc-1', 100), account('acc-2', -100)]
    );
    expect(result.countsByCheck.ORPHANED_ENTITY).toBe(1);
  });

  it('flags a GL entry against a missing account, once per account', () => {
    const result = run(
      [
        txn('t1', {
          entries: [entry('ghost-acc', 100, 0), entry('ghost-acc', 0, 50), entry('acc-2', 0, 50)],
        }),
      ],
      [account('acc-2', -100)]
    );
    expect(result.countsByCheck.ORPHANED_ACCOUNT).toBe(1);
  });
});

describe('DUPLICATE_NUMBER', () => {
  it('flags two live transactions sharing a number', () => {
    const result = run(
      [txn('t1', { transactionNumber: 'INV-001' }), txn('t2', { transactionNumber: 'INV-001' })],
      [account('acc-1', 200), account('acc-2', -200)]
    );
    expect(result.countsByCheck.DUPLICATE_NUMBER).toBe(1);
  });

  it('does not count a soft-deleted holder of the same number', () => {
    const result = run(
      [
        txn('t1', { transactionNumber: 'INV-001' }),
        txn('t2', { transactionNumber: 'INV-001', isDeleted: true }),
      ],
      [account('acc-1', 100), account('acc-2', -100)]
    );
    expect(result.countsByCheck.DUPLICATE_NUMBER).toBe(0);
  });
});

describe('STALE_DRAFT', () => {
  it('flags a draft older than the threshold', () => {
    const result = run(
      [txn('t1', { status: 'DRAFT', date: OLD_DATE, entries: [] })],
      [account('acc-1', 0)]
    );
    expect(result.countsByCheck.STALE_DRAFT).toBe(1);
  });

  it('handles Firestore Timestamp-shaped dates (rule 14)', () => {
    const result = run(
      [
        txn('t1', {
          status: 'DRAFT',
          date: { toDate: () => OLD_DATE },
          entries: [],
        }),
      ],
      [account('acc-1', 0)]
    );
    expect(result.countsByCheck.STALE_DRAFT).toBe(1);
  });

  it('leaves recent drafts alone', () => {
    const result = run(
      [txn('t1', { status: 'DRAFT', date: RECENT_DATE, entries: [] })],
      [account('acc-1', 0)]
    );
    expect(result.countsByCheck.STALE_DRAFT).toBe(0);
  });
});
