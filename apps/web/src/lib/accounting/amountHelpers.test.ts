/**
 * Tests for the rule 21 amount helpers.
 *
 * The `amountPaid` / `paidAmount` resolution is the load-bearing part: the
 * payment path writes `amountPaid`, the transaction types declare `paidAmount`
 * and the create dialogs initialise it to 0 and never update it. Code that read
 * the declared name treated fully-settled documents as unpaid, which overstated
 * the cash-flow forecast and reset partially-paid bills to UNPAID on edit.
 */

import { derivePaid, deriveOutstanding, getInrAmount, roundToPaisa } from './amountHelpers';

describe('roundToPaisa', () => {
  it('rounds to two decimals', () => {
    expect(roundToPaisa(0.1 + 0.2)).toBe(0.3);
    expect(roundToPaisa(1234.5678)).toBe(1234.57);
  });
});

describe('getInrAmount', () => {
  it('prefers baseAmount, the INR leg of a forex document', () => {
    expect(getInrAmount({ baseAmount: 8400, totalAmount: 100 })).toBe(8400);
  });

  it('falls back to totalAmount then amount', () => {
    expect(getInrAmount({ totalAmount: 500 })).toBe(500);
    expect(getInrAmount({ amount: 250 })).toBe(250);
  });

  it('treats a missing document as zero', () => {
    expect(getInrAmount(null)).toBe(0);
    expect(getInrAmount({})).toBe(0);
  });
});

describe('derivePaid', () => {
  it('reads amountPaid — the field the payment path actually writes', () => {
    expect(derivePaid({ amountPaid: 1350 })).toBe(1350);
  });

  it('prefers amountPaid over the stale declared paidAmount', () => {
    // Production shape: paidAmount initialised to 0 and never updated.
    expect(derivePaid({ amountPaid: 1350, paidAmount: 0 })).toBe(1350);
  });

  it('still honours paidAmount when it is the only field present', () => {
    expect(derivePaid({ paidAmount: 900 })).toBe(900);
  });

  it('returns zero for a missing or empty document', () => {
    expect(derivePaid(null)).toBe(0);
    expect(derivePaid({})).toBe(0);
  });

  it('ignores non-finite values rather than propagating NaN', () => {
    expect(derivePaid({ amountPaid: Number.NaN, paidAmount: 500 })).toBe(500);
  });
});

describe('deriveOutstanding', () => {
  it('derives total minus paid rather than trusting outstandingAmount (rule 21)', () => {
    expect(deriveOutstanding({ baseAmount: 1000, amountPaid: 400 })).toBe(600);
  });

  it('reports a fully settled document as zero even when paidAmount says otherwise', () => {
    expect(deriveOutstanding({ baseAmount: 1000, amountPaid: 1000, paidAmount: 0 })).toBe(0);
  });

  it('never returns a negative balance when over-allocated', () => {
    expect(deriveOutstanding({ baseAmount: 1000, amountPaid: 1500 })).toBe(0);
  });

  it('uses the full total when nothing has been paid', () => {
    expect(deriveOutstanding({ baseAmount: 1000 })).toBe(1000);
  });

  it('rounds the remainder to paisa', () => {
    expect(deriveOutstanding({ baseAmount: 0.3, amountPaid: 0.1 })).toBe(0.2);
  });
});
