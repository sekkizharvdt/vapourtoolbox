/**
 * Emulator smoke test for the onTransactionWrite trigger wiring.
 *
 * The balance MATH is covered by accountBalanceLogic.test.ts; this suite only
 * proves the deployed wiring works end-to-end: trigger registration, event
 * payload handling, and the FieldValue.increment() writes — including the
 * soft-delete → reverse and restore → re-apply paths.
 *
 * Runs inside `firebase emulators:exec --only firestore,functions` via
 * `npm run test:integration` (FIRESTORE_EMULATOR_HOST is injected by the CLI).
 */

import * as admin from 'firebase-admin';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error(
    'FIRESTORE_EMULATOR_HOST is not set — run via `npm run test:integration`, not plain jest'
  );
}

admin.initializeApp({ projectId: 'test-project' });
const db = admin.firestore();

interface BalanceSnapshot {
  debit: number;
  credit: number;
  currentBalance: number;
}

async function readBalance(accountId: string): Promise<BalanceSnapshot> {
  const snap = await db.collection('accounts').doc(accountId).get();
  const data = snap.data() || {};
  return {
    debit: (data.debit as number) || 0,
    credit: (data.credit as number) || 0,
    currentBalance: (data.currentBalance as number) || 0,
  };
}

/** Poll until the account balance matches, or fail after ~15s of trigger latency. */
async function expectBalance(accountId: string, expected: BalanceSnapshot): Promise<void> {
  const deadline = Date.now() + 15000;
  let last: BalanceSnapshot = await readBalance(accountId);
  while (Date.now() < deadline) {
    if (
      last.debit === expected.debit &&
      last.credit === expected.credit &&
      last.currentBalance === expected.currentBalance
    ) {
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
    last = await readBalance(accountId);
  }
  expect(last).toEqual(expected);
}

describe('onTransactionWrite (emulator)', () => {
  const DEBIT_ACC = 'smoke-debit-account';
  const CREDIT_ACC = 'smoke-credit-account';
  const TXN_ID = 'smoke-transaction-1';

  beforeAll(async () => {
    await db.collection('accounts').doc(DEBIT_ACC).set({
      code: '9998',
      name: 'Smoke Test Debit',
      debit: 0,
      credit: 0,
      currentBalance: 0,
    });
    await db.collection('accounts').doc(CREDIT_ACC).set({
      code: '9999',
      name: 'Smoke Test Credit',
      debit: 0,
      credit: 0,
      currentBalance: 0,
    });
  });

  it('applies entries on create', async () => {
    await db
      .collection('transactions')
      .doc(TXN_ID)
      .set({
        type: 'JOURNAL_ENTRY',
        status: 'POSTED',
        date: admin.firestore.Timestamp.now(),
        entries: [
          { accountId: DEBIT_ACC, debit: 150.5, credit: 0 },
          { accountId: CREDIT_ACC, debit: 0, credit: 150.5 },
        ],
      });

    await expectBalance(DEBIT_ACC, { debit: 150.5, credit: 0, currentBalance: 150.5 });
    await expectBalance(CREDIT_ACC, { debit: 0, credit: 150.5, currentBalance: -150.5 });
  });

  it('reverses entries on soft delete (rule 3)', async () => {
    await db.collection('transactions').doc(TXN_ID).update({ isDeleted: true });

    await expectBalance(DEBIT_ACC, { debit: 0, credit: 0, currentBalance: 0 });
    await expectBalance(CREDIT_ACC, { debit: 0, credit: 0, currentBalance: 0 });
  });

  it('re-applies entries on restore', async () => {
    await db
      .collection('transactions')
      .doc(TXN_ID)
      .update({ isDeleted: admin.firestore.FieldValue.delete() });

    await expectBalance(DEBIT_ACC, { debit: 150.5, credit: 0, currentBalance: 150.5 });
    await expectBalance(CREDIT_ACC, { debit: 0, credit: 150.5, currentBalance: -150.5 });
  });

  it('reverses entries on hard delete', async () => {
    await db.collection('transactions').doc(TXN_ID).delete();

    await expectBalance(DEBIT_ACC, { debit: 0, credit: 0, currentBalance: 0 });
    await expectBalance(CREDIT_ACC, { debit: 0, credit: 0, currentBalance: 0 });
  });
});
