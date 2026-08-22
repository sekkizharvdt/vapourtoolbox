/**
 * Milestone amount tests.
 *
 * The reconciliation cases are real live POs, not invented figures — the point
 * of the formula is that one rule reproduces both of the tax intents users
 * actually express, so the evidence has to be the real schedules.
 */

import {
  calculateMilestoneAmounts,
  hasTaxAssignment,
  sumMilestoneAmounts,
  withPricedSchedule,
  type PaymentScheduleTotals,
} from './paymentSchedule';
import { validatePaymentSchedule } from './defaults';
import type { PaymentMilestone } from '@vapour/types';

const ms = (serialNumber: number, percentage: number, carriesTax?: boolean): PaymentMilestone => ({
  id: `milestone-${serialNumber}`,
  serialNumber,
  paymentType: `Payment ${serialNumber}`,
  percentage,
  deliverables: '',
  ...(carriesTax !== undefined && { carriesTax }),
});

const totals = (taxableValue: number, totalTax: number): PaymentScheduleTotals => ({
  taxableValue,
  totalTax,
  grandTotal: taxableValue + totalTax,
});

describe('calculateMilestoneAmounts', () => {
  describe('reconciles to grandTotal on live POs', () => {
    it('PO/2026/001 — advance pre-tax, balance carries the whole GST', () => {
      const priced = calculateMilestoneAmounts(
        [ms(1, 50), ms(2, 50, true)],
        totals(304028.5, 54725.13)
      );

      expect(priced[0]?.amount).toBe(152014.25);
      expect(priced[1]?.amount).toBe(206739.38);
      expect(sumMilestoneAmounts(priced)).toBe(358753.63);
    });

    it('PO/2026/002 — every milestone flagged, each carries its own share', () => {
      const priced = calculateMilestoneAmounts(
        [ms(1, 40, true), ms(2, 40, true), ms(3, 20, true)],
        totals(200000, 36000)
      );

      expect(priced.map((m) => m.amount)).toEqual([94400, 94400, 47200]);
      expect(sumMilestoneAmounts(priced)).toBe(236000);
    });

    it('PO/2026/007 — one unflagged milestone, three flagged', () => {
      const priced = calculateMilestoneAmounts(
        [ms(1, 20), ms(2, 50, true), ms(3, 20, true), ms(4, 10, true)],
        totals(270000, 48600)
      );

      expect(priced.map((m) => m.amount)).toEqual([54000, 165375, 66150, 33075]);
      expect(sumMilestoneAmounts(priced)).toBe(318600);
    });

    it('PO/2026/010 — the 30% advance is priced pre-tax (feedback jRO7w8mg)', () => {
      const priced = calculateMilestoneAmounts(
        [ms(1, 30), ms(2, 70, true)],
        totals(3806740, 685213.2)
      );

      // 30% of the taxable value, NOT of the 4,491,953.20 grand total, which
      // would have been 1,347,585.96 — 205,563.96 too high.
      expect(priced[0]?.amount).toBe(1142022);
      expect(sumMilestoneAmounts(priced)).toBe(4491953.2);
    });
  });

  it('gives a single 100% flagged milestone the entire order', () => {
    const priced = calculateMilestoneAmounts([ms(1, 100, true)], totals(2755.2, 495.94));
    expect(priced[0]?.amount).toBe(3251.14);
  });

  it('leaves the schedule short by exactly the tax when nothing is flagged', () => {
    // The six live POs in this state. Reported, never silently defaulted —
    // validatePaymentSchedule refuses the save.
    const t = totals(10000, 1800);
    const priced = calculateMilestoneAmounts([ms(1, 30), ms(2, 60), ms(3, 10)], t);

    expect(sumMilestoneAmounts(priced)).toBe(10000);
    expect(t.grandTotal - sumMilestoneAmounts(priced)).toBe(1800);
  });

  it('treats a zero-tax PO as complete even with nothing flagged', () => {
    const priced = calculateMilestoneAmounts([ms(1, 100)], totals(4423, 0));
    expect(sumMilestoneAmounts(priced)).toBe(4423);
  });

  it('absorbs rounding residue into the last milestone', () => {
    // Three equal thirds of an amount that does not divide cleanly.
    const priced = calculateMilestoneAmounts(
      [ms(1, 33.33, true), ms(2, 33.33, true), ms(3, 33.34, true)],
      totals(1000, 100)
    );

    expect(sumMilestoneAmounts(priced)).toBe(1100);
  });

  it('does not force reconciliation when the percentages do not sum to 100', () => {
    // An in-progress edit: forcing the residue onto the last milestone here
    // would hide the real error behind a wrong number.
    const priced = calculateMilestoneAmounts([ms(1, 30, true), ms(2, 30, true)], totals(1000, 180));

    expect(sumMilestoneAmounts(priced)).toBe(780);
  });

  it('does not mutate the input milestones', () => {
    const input = [ms(1, 100, true)];
    calculateMilestoneAmounts(input, totals(1000, 180));
    expect(input[0]?.amount).toBeUndefined();
  });

  it('returns an empty array for an empty schedule', () => {
    expect(calculateMilestoneAmounts([], totals(1000, 180))).toEqual([]);
  });
});

describe('hasTaxAssignment', () => {
  it('requires an explicit true — absent is not false-but-fine', () => {
    // Firestore drops undefined keys, so an unticked box is stored as absent.
    expect(hasTaxAssignment([ms(1, 100)])).toBe(false);
    expect(hasTaxAssignment([ms(1, 100, false)])).toBe(false);
    expect(hasTaxAssignment([ms(1, 50), ms(2, 50, true)])).toBe(true);
  });
});

describe('validatePaymentSchedule', () => {
  it('still checks percentages when no totals are supplied', () => {
    expect(validatePaymentSchedule([ms(1, 60), ms(2, 30)]).isValid).toBe(false);
    expect(validatePaymentSchedule([ms(1, 60), ms(2, 40)]).isValid).toBe(true);
  });

  it('refuses a taxed schedule with no milestone carrying the GST', () => {
    // The state six live POs are in. Blocked rather than defaulted, per the
    // locked decision — a silent default is what let them get there.
    const result = validatePaymentSchedule([ms(1, 30), ms(2, 60), ms(3, 10)], totals(10000, 1800));

    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/Carries tax/);
  });

  it('accepts the same schedule once a milestone is flagged', () => {
    const result = validatePaymentSchedule(
      [ms(1, 30), ms(2, 60, true), ms(3, 10)],
      totals(10000, 1800)
    );

    expect(result.isValid).toBe(true);
  });

  it('does not demand a tax assignment when there is no tax', () => {
    // PO/2026/012 — zero GST, so there is nothing to assign.
    expect(validatePaymentSchedule([ms(1, 100)], totals(4423, 0)).isValid).toBe(true);
  });

  it('reports the shortfall when the amounts miss the grand total', () => {
    const result = validatePaymentSchedule([ms(1, 30), ms(2, 70)], totals(10000, 1800));
    expect(result.isValid).toBe(false);
  });

  it('passes the live schedules that reconcile', () => {
    expect(
      validatePaymentSchedule([ms(1, 50), ms(2, 50, true)], totals(304028.5, 54725.13)).isValid
    ).toBe(true);
    expect(
      validatePaymentSchedule(
        [ms(1, 40, true), ms(2, 40, true), ms(3, 20, true)],
        totals(200000, 36000)
      ).isValid
    ).toBe(true);
    expect(
      validatePaymentSchedule(
        [ms(1, 20), ms(2, 50, true), ms(3, 20, true), ms(4, 10, true)],
        totals(270000, 48600)
      ).isValid
    ).toBe(true);
  });
});

describe('withPricedSchedule', () => {
  it('returns terms untouched when there is no schedule', () => {
    const terms = { paymentSchedule: [] } as unknown as Parameters<typeof withPricedSchedule>[0];
    expect(withPricedSchedule(terms, totals(1000, 180))).toBe(terms);
    expect(withPricedSchedule(undefined, totals(1000, 180))).toBeUndefined();
  });

  it('prices the schedule in place on the terms object', () => {
    const terms = {
      currency: 'INR',
      paymentSchedule: [ms(1, 50), ms(2, 50, true)],
    } as unknown as NonNullable<Parameters<typeof withPricedSchedule>[0]>;

    const priced = withPricedSchedule(terms, totals(304028.5, 54725.13));

    expect(priced?.paymentSchedule[0]?.amount).toBe(152014.25);
    expect(priced?.currency).toBe('INR');
    // Original untouched.
    expect(terms.paymentSchedule[0]?.amount).toBeUndefined();
  });
});
