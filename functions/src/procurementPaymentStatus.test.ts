/**
 * Unit tests for syncPOPaymentToGRs — specifically the PO auto-advance to
 * IN_PROGRESS on payment (feedback i7brfS9rrdfGVxRTHHZu). The GR paymentStatus
 * sync itself predates this change and isn't re-tested here.
 *
 * Hand-rolled Firestore doubles (no emulator) — this module isn't factored
 * into pure logic + admin wrapper, so we stub only the calls it makes.
 */

import { syncPOPaymentToGRs } from './procurementPaymentStatus';

function makeDb(options: {
  po: Record<string, unknown> | null;
  bills?: Array<Record<string, unknown>>;
  grs?: Array<Record<string, unknown> & { id: string }>;
}) {
  const poUpdate = jest.fn().mockResolvedValue(undefined);
  const grUpdates: Array<[unknown, Record<string, unknown>]> = [];
  const batchUpdate = jest.fn((ref: unknown, data: Record<string, unknown>) => {
    grUpdates.push([ref, data]);
  });
  const batchCommit = jest.fn().mockResolvedValue(undefined);

  const bills = options.bills ?? [];
  const grs = options.grs ?? [];

  const db = {
    collection: (name: string) => {
      if (name === 'purchaseOrders') {
        return {
          doc: (_id: string) => ({
            get: async () => ({
              exists: options.po !== null,
              data: () => options.po,
              ref: { update: poUpdate },
            }),
          }),
        };
      }
      if (name === 'transactions') {
        return {
          where: () => ({
            where: () => ({
              get: async () => ({ docs: bills.map((b) => ({ data: () => b })) }),
            }),
          }),
        };
      }
      if (name === 'goodsReceipts') {
        return {
          where: () => ({
            get: async () => ({
              empty: grs.length === 0,
              size: grs.length,
              docs: grs.map((g) => ({ ref: { id: g.id }, data: () => g })),
            }),
          }),
        };
      }
      throw new Error(`Unexpected collection in test double: ${name}`);
    },
    batch: () => ({ update: batchUpdate, commit: batchCommit }),
  };

  return { db: db as unknown as FirebaseFirestore.Firestore, poUpdate, batchUpdate, batchCommit };
}

describe('syncPOPaymentToGRs — PO auto-advance to IN_PROGRESS', () => {
  it('advances ISSUED to IN_PROGRESS once any payment is recorded', async () => {
    const { db, poUpdate } = makeDb({
      po: { grandTotal: 1000, status: 'ISSUED' },
      bills: [{ paidAmount: 100, isDeleted: false }],
      grs: [],
    });

    await syncPOPaymentToGRs(db, 'po-1');

    expect(poUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'IN_PROGRESS' }));
  });

  it('advances ACKNOWLEDGED to IN_PROGRESS too', async () => {
    const { db, poUpdate } = makeDb({
      po: { grandTotal: 1000, status: 'ACKNOWLEDGED' },
      bills: [{ paidAmount: 500, isDeleted: false }],
      grs: [],
    });

    await syncPOPaymentToGRs(db, 'po-1');

    expect(poUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'IN_PROGRESS' }));
  });

  it('does not advance when no payment has been made yet', async () => {
    const { db, poUpdate } = makeDb({
      po: { grandTotal: 1000, status: 'ISSUED' },
      bills: [{ paidAmount: 0, isDeleted: false }],
      grs: [],
    });

    await syncPOPaymentToGRs(db, 'po-1');

    expect(poUpdate).not.toHaveBeenCalled();
  });

  it('does not advance a PO already past IN_PROGRESS (idempotent)', async () => {
    const { db, poUpdate } = makeDb({
      po: { grandTotal: 1000, status: 'DELIVERED' },
      bills: [{ paidAmount: 1000, isDeleted: false }],
      grs: [],
    });

    await syncPOPaymentToGRs(db, 'po-1');

    expect(poUpdate).not.toHaveBeenCalled();
  });

  it('ignores soft-deleted bills when checking whether any payment exists', async () => {
    const { db, poUpdate } = makeDb({
      po: { grandTotal: 1000, status: 'ISSUED' },
      bills: [{ paidAmount: 500, isDeleted: true }],
      grs: [],
    });

    await syncPOPaymentToGRs(db, 'po-1');

    expect(poUpdate).not.toHaveBeenCalled();
  });
});
