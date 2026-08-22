import {
  computePOPaymentSummary,
  derivePaymentStatus,
  billPaid,
  paymentReference,
  type BillLike,
  type PaymentLike,
  type POLike,
} from './poPaymentSummaryLogic';

// PO/2026/007: 318,600 grand total, 270,000 taxable, milestones 20/50/20/10
// with the last three carrying tax. Its real bill BILL-2627-0064 is 159,300 —
// exactly milestone #2 — paid 145,800 by VPAY-2627-0067.
const po007: POLike = {
  grandTotal: 318600,
  commercialTerms: {
    paymentSchedule: [
      { id: 'm1', serialNumber: 1, paymentType: 'Payment 1', percentage: 20, amount: 54000 },
      { id: 'm2', serialNumber: 2, paymentType: 'Payment 2', percentage: 50, amount: 165375 },
      { id: 'm3', serialNumber: 3, paymentType: 'Payment 3', percentage: 20, amount: 66150 },
      { id: 'm4', serialNumber: 4, paymentType: 'Payment 4', percentage: 10, amount: 33075 },
    ],
  },
};

const bill = (o: Partial<BillLike> & { id: string }): BillLike => ({
  purchaseOrderId: 'po-007',
  ...o,
});

const payment = (o: Partial<PaymentLike> & { id: string }): PaymentLike => ({
  paymentDateSeconds: 1_700_000_000,
  ...o,
});

describe('derivePaymentStatus', () => {
  it('is PENDING when nothing is paid', () => {
    expect(derivePaymentStatus(1000, 0)).toBe('PENDING');
  });

  it('is PAID when settled', () => {
    expect(derivePaymentStatus(1000, 1000)).toBe('PAID');
  });

  it('is PARTIALLY_PAID in between', () => {
    expect(derivePaymentStatus(1000, 400)).toBe('PARTIALLY_PAID');
  });

  it('tolerates floating-point residue rather than reporting a paid item pending', () => {
    expect(derivePaymentStatus(1000, 999.995)).toBe('PAID');
    expect(derivePaymentStatus(1000, 0.004)).toBe('PENDING');
  });

  it('treats a zero-value milestone as pending until something is paid', () => {
    expect(derivePaymentStatus(0, 0)).toBe('PENDING');
    expect(derivePaymentStatus(0, 100)).toBe('PAID');
  });
});

describe('billPaid', () => {
  it('prefers amountPaid — paidAmount is initialised to 0 and never updated', () => {
    expect(billPaid({ id: 'b', amountPaid: 145800, paidAmount: 0 })).toBe(145800);
  });

  it('falls back to paidAmount when amountPaid is absent', () => {
    expect(billPaid({ id: 'b', paidAmount: 500 })).toBe(500);
  });

  it('is 0 when neither is present', () => {
    expect(billPaid({ id: 'b' })).toBe(0);
  });
});

describe('paymentReference', () => {
  it('takes the reference, then cheque, then UPI', () => {
    expect(paymentReference({ id: 'p', reference: 'UTR NO: SBIN126166441955' })).toBe(
      'UTR NO: SBIN126166441955'
    );
    expect(paymentReference({ id: 'p', chequeNumber: '000123' })).toBe('000123');
    expect(paymentReference({ id: 'p', upiTransactionId: 'upi-1' })).toBe('upi-1');
    expect(paymentReference({ id: 'p' })).toBeUndefined();
  });
});

describe('computePOPaymentSummary', () => {
  it('reproduces the live PO/2026/007 position', () => {
    const result = computePOPaymentSummary(
      po007,
      [
        bill({
          id: 'bill-64',
          transactionNumber: 'BILL-2627-0064',
          milestoneId: 'm2',
          totalAmount: 159300,
          amountPaid: 145800,
        }),
      ],
      [
        payment({
          id: 'pay-67',
          transactionNumber: 'VPAY-2627-0067',
          billAllocations: [{ invoiceId: 'bill-64', allocatedAmount: 145800 }],
        }),
      ]
    );

    expect(result.totalAmount).toBe(318600);
    expect(result.paidAmount).toBe(145800);
    expect(result.pendingAmount).toBe(172800);
    expect(result.status).toBe('PARTIALLY_PAID');

    // Milestone #2 is partly settled; #1 was never touched, so a waterfall
    // would have got this wrong.
    expect(result.milestones[0]).toMatchObject({ milestoneId: 'm1', paid: 0, status: 'PENDING' });
    expect(result.milestones[1]).toMatchObject({
      milestoneId: 'm2',
      paid: 145800,
      pending: 19575,
      status: 'PARTIALLY_PAID',
    });
  });

  it('counts a direct payment with no allocations', () => {
    // The 15 live advances paid against a proforma with no bill entered.
    const result = computePOPaymentSummary(
      po007,
      [],
      [payment({ id: 'pay-adv', milestoneId: 'm1', purchaseOrderId: 'po-007', totalAmount: 54000 })]
    );

    expect(result.paidAmount).toBe(54000);
    expect(result.milestones[0]).toMatchObject({ paid: 54000, status: 'PAID' });
  });

  it('does not double-count a payment that is both allocated and tagged', () => {
    // assertSingleMilestoneAttribution blocks this at write time, but the
    // projection must not compound a bad record that reaches Firestore anyway.
    const result = computePOPaymentSummary(
      po007,
      [bill({ id: 'bill-64', milestoneId: 'm2', totalAmount: 165375, amountPaid: 165375 })],
      [
        payment({
          id: 'pay-1',
          milestoneId: 'm2',
          purchaseOrderId: 'po-007',
          totalAmount: 165375,
          billAllocations: [{ invoiceId: 'bill-64', allocatedAmount: 165375 }],
        }),
      ]
    );

    expect(result.paidAmount).toBe(165375);
    expect(result.milestones[1]?.paid).toBe(165375);
  });

  it('handles a bill paid by several partial payments', () => {
    // 64 live payments are partial settlements of a single bill.
    const result = computePOPaymentSummary(
      po007,
      [bill({ id: 'bill-64', milestoneId: 'm2', totalAmount: 165375, amountPaid: 100000 })],
      [
        payment({
          id: 'pay-1',
          billAllocations: [{ invoiceId: 'bill-64', allocatedAmount: 60000 }],
        }),
        payment({
          id: 'pay-2',
          billAllocations: [{ invoiceId: 'bill-64', allocatedAmount: 40000 }],
        }),
      ]
    );

    // Paid comes from the bill's running total, not from summing allocations.
    expect(result.paidAmount).toBe(100000);
    expect(result.history).toHaveLength(2);
  });

  it('takes only its own share of a payment spanning several POs', () => {
    // 22 live payments settle more than one bill at a time.
    const result = computePOPaymentSummary(
      po007,
      [bill({ id: 'bill-mine', milestoneId: 'm1', totalAmount: 54000, amountPaid: 54000 })],
      [
        payment({
          id: 'pay-multi',
          billAllocations: [
            { invoiceId: 'bill-mine', allocatedAmount: 54000 },
            { invoiceId: 'bill-other-po', allocatedAmount: 250000 },
          ],
        }),
      ]
    );

    expect(result.paidAmount).toBe(54000);
    expect(result.history).toHaveLength(1);
    expect(result.history[0]?.amount).toBe(54000);
  });

  it('ignores soft-deleted bills and payments (rule 3)', () => {
    const result = computePOPaymentSummary(
      po007,
      [bill({ id: 'b1', milestoneId: 'm1', amountPaid: 54000, isDeleted: true })],
      [payment({ id: 'p1', milestoneId: 'm2', totalAmount: 1000, isDeleted: true })]
    );

    expect(result.paidAmount).toBe(0);
    expect(result.status).toBe('PENDING');
    expect(result.history).toHaveLength(0);
  });

  it('keeps an untagged bill in the PO total even though no milestone claims it', () => {
    const result = computePOPaymentSummary(
      po007,
      [bill({ id: 'b-untagged', totalAmount: 10000, amountPaid: 10000 })],
      []
    );

    expect(result.paidAmount).toBe(10000);
    expect(result.milestones.every((m) => m.paid === 0)).toBe(true);
  });

  it('caps a milestone at its own value when overpaid', () => {
    const result = computePOPaymentSummary(
      po007,
      [bill({ id: 'b1', milestoneId: 'm1', totalAmount: 60000, amountPaid: 60000 })],
      []
    );

    expect(result.milestones[0]?.paid).toBe(54000);
    expect(result.milestones[0]?.pending).toBe(0);
    // The overpayment is still visible on the PO total.
    expect(result.paidAmount).toBe(60000);
  });

  it('orders history newest first', () => {
    const result = computePOPaymentSummary(
      po007,
      [],
      [
        payment({ id: 'old', milestoneId: 'm1', totalAmount: 100, paymentDateSeconds: 1000 }),
        payment({ id: 'new', milestoneId: 'm1', totalAmount: 100, paymentDateSeconds: 2000 }),
      ]
    );

    expect(result.history.map((h) => h.paymentId)).toEqual(['new', 'old']);
  });

  it('carries the UTR through to the history row', () => {
    const result = computePOPaymentSummary(
      po007,
      [],
      [
        payment({
          id: 'p1',
          milestoneId: 'm1',
          totalAmount: 100,
          reference: 'UTR NO: SBIN126166441955',
        }),
      ]
    );

    expect(result.history[0]?.reference).toBe('UTR NO: SBIN126166441955');
  });

  it('returns a zeroed summary for a PO with no schedule and no activity', () => {
    const result = computePOPaymentSummary({ grandTotal: 1000 }, [], []);

    expect(result).toMatchObject({
      totalAmount: 1000,
      paidAmount: 0,
      pendingAmount: 1000,
      status: 'PENDING',
      milestones: [],
      history: [],
    });
  });

  it('is idempotent — recomputing from the same inputs gives the same answer', () => {
    // The projection is rebuilt on every trigger rather than incremented, so
    // repeated or out-of-order triggers must converge (rule 21).
    const bills = [bill({ id: 'b1', milestoneId: 'm2', totalAmount: 165375, amountPaid: 80000 })];
    const payments = [
      payment({ id: 'p1', billAllocations: [{ invoiceId: 'b1', allocatedAmount: 80000 }] }),
    ];

    const first = computePOPaymentSummary(po007, bills, payments);
    const second = computePOPaymentSummary(po007, bills, payments);

    expect(second).toEqual(first);
  });
});
