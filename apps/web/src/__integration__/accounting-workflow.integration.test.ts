/**
 * Accounting GL Invariant Integration Test
 *
 * Posts realistic transactions through the real service layer against the
 * Firebase emulator and asserts the invariants CLAUDE.md rules 3, 6, 8, 21,
 * and 23 exist to protect:
 *
 * - every posted transaction's ledger entries balance (debits == credits)
 * - unbalanced entries are rejected, not silently saved
 * - outstanding = total − paid, derived from real payment allocations, never
 *   a cached field, and always from baseAmount (INR) — not totalAmount (forex)
 * - an allocation exceeding the outstanding amount is rejected
 * - soft-deleted payments are excluded from the outstanding calculation
 * - self-approval and invalid-status approval attempts are rejected
 *
 * Only functions that take `db` as an explicit parameter are exercised here.
 * `approveTransaction`'s error paths (invalid status, self-approval) throw
 * BEFORE any code that resolves the default Firebase app internally
 * (task notifications / audit logging use `getFirebase()`, not the injected
 * `db`) — this suite never reaches that code, so it never touches anything
 * but the emulator. The happy-path approval (which DOES reach that code) is
 * intentionally out of scope here; see the Phase 2 execution notes.
 *
 * Prerequisites: Firebase emulators running (`firebase emulators:start`).
 * Run with: `pnpm test:integration`
 */

import { doc, setDoc, getDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { initializeTestFirebase, cleanupTestData, checkEmulatorsRunning } from './setup';
import { saveTransaction, UnbalancedEntriesError } from '@/lib/accounting/transactionService';
import { getOutstandingAmount, validatePaymentAllocation } from '@/lib/accounting/paymentHelpers';
import { deriveOutstanding } from '@/lib/accounting/amountHelpers';
import { approveTransaction } from '@/lib/accounting/transactionApprovalService';
import { preventSelfApproval } from '@/lib/auth/authorizationService';

const COLLECTIONS = {
  TRANSACTIONS: 'transactions',
};

const AR_ACCOUNT = 'test-accounts-receivable';
const REVENUE_ACCOUNT = 'test-revenue';
const AP_ACCOUNT = 'test-accounts-payable';
const EXPENSE_ACCOUNT = 'test-expense';

const CUSTOMER = 'customer-001';
const SUBMITTER = 'user-submitter';
const APPROVER = 'user-approver';

describe('Accounting GL Invariant Integration', () => {
  let db: Firestore;
  let emulatorsRunning: boolean;

  beforeAll(async () => {
    emulatorsRunning = await checkEmulatorsRunning();
    if (!emulatorsRunning) {
      console.warn(
        '\n⚠️  Firebase emulators not running. Skipping integration tests.\n' +
          '   Run: firebase emulators:start\n'
      );
      return;
    }
    db = initializeTestFirebase().db;
  });

  beforeEach(async () => {
    if (emulatorsRunning) await cleanupTestData();
  });

  afterAll(async () => {
    if (emulatorsRunning) await cleanupTestData();
  });

  const itWithEmulator = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (!emulatorsRunning) {
        // eslint-disable-next-line no-console
        console.log(`  ⏭️  Skipping: ${name} (emulators not running)`);
        return;
      }
      await fn();
    });
  };

  // ==========================================================================
  // Double-entry invariant (rule 21) across transaction types
  // ==========================================================================

  itWithEmulator(
    'saves CUSTOMER_INVOICE, VENDOR_BILL, and JOURNAL_ENTRY with balanced entries',
    async () => {
      const cases = [
        {
          type: 'CUSTOMER_INVOICE',
          entries: [
            { accountId: AR_ACCOUNT, debit: 1000, credit: 0 },
            { accountId: REVENUE_ACCOUNT, debit: 0, credit: 1000 },
          ],
        },
        {
          type: 'VENDOR_BILL',
          entries: [
            { accountId: EXPENSE_ACCOUNT, debit: 500, credit: 0 },
            { accountId: AP_ACCOUNT, debit: 0, credit: 500 },
          ],
        },
        {
          type: 'JOURNAL_ENTRY',
          entries: [
            { accountId: AR_ACCOUNT, debit: 250, credit: 0 },
            { accountId: REVENUE_ACCOUNT, debit: 0, credit: 250 },
          ],
        },
      ];

      for (const { type, entries } of cases) {
        const firstEntry = entries[0]!;
        const id = await saveTransaction(db, {
          type,
          status: 'POSTED',
          date: Timestamp.now(),
          entityId: CUSTOMER,
          totalAmount: firstEntry.debit,
          baseAmount: firstEntry.debit,
          entries,
        });

        const snap = await getDoc(doc(db, COLLECTIONS.TRANSACTIONS, id));
        const data = snap.data()!;
        const totalDebit = (data.entries as typeof entries).reduce(
          (sum: number, e: { debit: number }) => sum + e.debit,
          0
        );
        const totalCredit = (data.entries as typeof entries).reduce(
          (sum: number, e: { credit: number }) => sum + e.credit,
          0
        );
        expect(totalDebit).toBe(totalCredit);
      }
    }
  );

  itWithEmulator('rejects a transaction whose entries do not balance', async () => {
    await expect(
      saveTransaction(db, {
        type: 'JOURNAL_ENTRY',
        status: 'POSTED',
        date: Timestamp.now(),
        entries: [
          { accountId: AR_ACCOUNT, debit: 1000, credit: 0 },
          { accountId: REVENUE_ACCOUNT, debit: 0, credit: 900 },
        ],
      })
    ).rejects.toThrow(UnbalancedEntriesError);
  });

  // ==========================================================================
  // Outstanding = total − paid, from baseAmount, never a cached field (rule 21)
  // ==========================================================================

  itWithEmulator(
    'derives outstanding from baseAmount (INR) even when totalAmount is a foreign-currency figure',
    async () => {
      // totalAmount is USD 1200; baseAmount is the INR-converted 1000 that
      // allocations are actually tracked against (CLAUDE.md rule 21).
      const invoiceId = await saveTransaction(db, {
        type: 'CUSTOMER_INVOICE',
        status: 'POSTED',
        date: Timestamp.now(),
        entityId: CUSTOMER,
        currency: 'USD',
        totalAmount: 1200,
        baseAmount: 1000,
        entries: [
          { accountId: AR_ACCOUNT, debit: 1000, credit: 0 },
          { accountId: REVENUE_ACCOUNT, debit: 0, credit: 1000 },
        ],
      });

      const beforePayment = await getOutstandingAmount(db, invoiceId, 'CUSTOMER_INVOICE', CUSTOMER);
      expect(beforePayment.totalAmount).toBe(1000);
      expect(beforePayment.outstanding).toBe(1000);

      // Partial payment: 400 allocated
      await setDoc(doc(db, COLLECTIONS.TRANSACTIONS, 'payment-partial'), {
        type: 'CUSTOMER_PAYMENT',
        status: 'POSTED',
        entityId: CUSTOMER,
        date: Timestamp.now(),
        invoiceAllocations: [{ invoiceId, allocatedAmount: 400 }],
      });

      const afterPartial = await getOutstandingAmount(db, invoiceId, 'CUSTOMER_INVOICE', CUSTOMER);
      expect(afterPartial.outstanding).toBe(600);

      // A soft-deleted payment allocation must NOT count (rule 3)
      await setDoc(doc(db, COLLECTIONS.TRANSACTIONS, 'payment-soft-deleted'), {
        type: 'CUSTOMER_PAYMENT',
        status: 'POSTED',
        entityId: CUSTOMER,
        date: Timestamp.now(),
        isDeleted: true,
        invoiceAllocations: [{ invoiceId, allocatedAmount: 600 }],
      });

      const afterSoftDeleted = await getOutstandingAmount(
        db,
        invoiceId,
        'CUSTOMER_INVOICE',
        CUSTOMER
      );
      expect(afterSoftDeleted.outstanding).toBe(600); // unchanged — soft-deleted payment ignored

      // Full payment: remaining 600 allocated
      await setDoc(doc(db, COLLECTIONS.TRANSACTIONS, 'payment-final'), {
        type: 'CUSTOMER_PAYMENT',
        status: 'POSTED',
        entityId: CUSTOMER,
        date: Timestamp.now(),
        invoiceAllocations: [{ invoiceId, allocatedAmount: 600 }],
      });

      const afterFull = await getOutstandingAmount(db, invoiceId, 'CUSTOMER_INVOICE', CUSTOMER);
      expect(afterFull.outstanding).toBe(0);
    }
  );

  itWithEmulator('rejects a payment allocation that exceeds the outstanding amount', async () => {
    const invoiceId = await saveTransaction(db, {
      type: 'CUSTOMER_INVOICE',
      status: 'POSTED',
      date: Timestamp.now(),
      entityId: CUSTOMER,
      totalAmount: 500,
      baseAmount: 500,
      entries: [
        { accountId: AR_ACCOUNT, debit: 500, credit: 0 },
        { accountId: REVENUE_ACCOUNT, debit: 0, credit: 500 },
      ],
    });

    const result = await validatePaymentAllocation(
      db,
      invoiceId,
      600,
      'CUSTOMER_INVOICE',
      CUSTOMER
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/exceeds outstanding amount/i);
  });

  it('deriveOutstanding ignores a stale cached outstandingAmount and recomputes from total/paid', () => {
    // A doc with a wrong cached outstandingAmount must not be trusted (rule 21).
    // Pure function — no emulator/Firestore involved, runs unconditionally.
    const stale = deriveOutstanding({
      baseAmount: 1000,
      amountPaid: 400,
      outstandingAmount: 999999, // deliberately wrong, must be ignored
    } as never);
    expect(stale).toBe(600);
  });

  // ==========================================================================
  // Approval workflow guards (rules 6, 8) — both throw before any code path
  // that touches the default Firebase app (see file header)
  // ==========================================================================

  itWithEmulator('rejects approving a transaction that is not PENDING_APPROVAL', async () => {
    const invoiceId = 'invoice-wrong-status';
    await setDoc(doc(db, COLLECTIONS.TRANSACTIONS, invoiceId), {
      type: 'CUSTOMER_INVOICE',
      status: 'DRAFT',
      submittedByUserId: SUBMITTER,
      entityId: CUSTOMER,
      date: Timestamp.now(),
    });

    await expect(
      approveTransaction(db, 'CUSTOMER_INVOICE', invoiceId, APPROVER, 'Approver Name')
    ).rejects.toThrow(/Cannot approve invoice with status/i);
  });

  itWithEmulator('rejects a user approving their own submitted transaction', async () => {
    const invoiceId = 'invoice-self-approval';
    await setDoc(doc(db, COLLECTIONS.TRANSACTIONS, invoiceId), {
      type: 'CUSTOMER_INVOICE',
      status: 'PENDING_APPROVAL',
      submittedByUserId: SUBMITTER,
      entityId: CUSTOMER,
      date: Timestamp.now(),
    });

    await expect(
      approveTransaction(db, 'CUSTOMER_INVOICE', invoiceId, SUBMITTER, 'Submitter Name')
    ).rejects.toThrow();
  });

  it('preventSelfApproval throws for matching userId/submitterId and passes otherwise', () => {
    expect(() => preventSelfApproval(SUBMITTER, SUBMITTER, 'approve invoice')).toThrow();
    expect(() => preventSelfApproval(APPROVER, SUBMITTER, 'approve invoice')).not.toThrow();
  });
});
