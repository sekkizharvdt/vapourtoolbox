/**
 * Advance amount calculation tests
 *
 * Covers feedback jRO7w8mg: a 30% advance with tax unselected was computed on
 * the tax-inclusive grand total instead of the taxable value. The figure is not
 * display-only — createAdvancePaymentRequest posts it as a real accounting
 * transaction — so the wrong base reaches the ledger.
 */

import { calculateAdvanceAmount } from './crud';
import type { POCommercialTerms, PaymentMilestone } from '@vapour/types';

// Figures from the reported PO (qxBe8jnvjENS7lx1640x)
const TAXABLE_VALUE = 3806740; // subtotal 37,84,740 + P&F 22,000
const GRAND_TOTAL = 4491953.2; // + IGST 6,85,213.20

const milestone = (overrides: Partial<PaymentMilestone>): PaymentMilestone => ({
  id: 'm1',
  serialNumber: 1,
  paymentType: 'Advance',
  percentage: 30,
  deliverables: 'along with order',
  ...overrides,
});

const termsWith = (milestones: PaymentMilestone[]) =>
  ({ paymentSchedule: milestones }) as unknown as POCommercialTerms;

describe('calculateAdvanceAmount', () => {
  it('excludes tax when the advance milestone does not carry it', () => {
    const result = calculateAdvanceAmount({
      grandTotal: GRAND_TOTAL,
      taxableValue: TAXABLE_VALUE,
      advancePaymentRequired: true,
      advancePercentage: 30,
      commercialTerms: termsWith([milestone({ carriesTax: false })]),
    });

    // 30% of the taxable value, not of the grand total
    expect(result).toBe(1142022);
  });

  it('includes tax when the advance milestone carries it', () => {
    const result = calculateAdvanceAmount({
      grandTotal: GRAND_TOTAL,
      taxableValue: TAXABLE_VALUE,
      advancePaymentRequired: true,
      advancePercentage: 30,
      commercialTerms: termsWith([milestone({ carriesTax: true })]),
    });

    expect(result).toBe(1347585.96);
  });

  it('picks the advance milestone, not the first one', () => {
    const result = calculateAdvanceAmount({
      grandTotal: GRAND_TOTAL,
      taxableValue: TAXABLE_VALUE,
      advancePaymentRequired: true,
      advancePercentage: 30,
      commercialTerms: termsWith([
        milestone({ id: 'm1', paymentType: 'Before Dispatch', percentage: 70, carriesTax: true }),
        milestone({ id: 'm2', serialNumber: 2, paymentType: 'Advance', carriesTax: false }),
      ]),
    });

    expect(result).toBe(1142022);
  });

  it('matches the advance milestone case-insensitively', () => {
    const result = calculateAdvanceAmount({
      grandTotal: GRAND_TOTAL,
      taxableValue: TAXABLE_VALUE,
      advancePaymentRequired: true,
      advancePercentage: 30,
      commercialTerms: termsWith([
        milestone({ paymentType: '30% ADVANCE with order', carriesTax: false }),
      ]),
    });

    expect(result).toBe(1142022);
  });

  it('defaults to tax-inclusive when there is no payment schedule', () => {
    // Preserves prior behaviour for POs created without structured terms
    const result = calculateAdvanceAmount({
      grandTotal: GRAND_TOTAL,
      taxableValue: TAXABLE_VALUE,
      advancePaymentRequired: true,
      advancePercentage: 30,
      commercialTerms: undefined,
    });

    expect(result).toBe(1347585.96);
  });

  // This case previously asserted the grand total, which is what made the first
  // fix a no-op: the editor never writes `carriesTax: false`, it just omits the
  // key, so every real PO took the tax-inclusive branch. An unticked box means
  // "no tax on the advance" everywhere else in the app; it means that here too.
  it('is pre-tax when carriesTax is unset — an unticked box, not a missing answer', () => {
    const result = calculateAdvanceAmount({
      grandTotal: GRAND_TOTAL,
      taxableValue: TAXABLE_VALUE,
      advancePaymentRequired: true,
      advancePercentage: 30,
      commercialTerms: termsWith([milestone({ carriesTax: undefined })]),
    });

    expect(result).toBe(1142022);
  });

  // The exact figures from the reopened report (PO/2026/011): 20% of a
  // ₹1,18,000 grand total carrying ₹18,000 GST is ₹20,000, not ₹23,600.
  it('matches the reported PO/2026/011 figures', () => {
    const result = calculateAdvanceAmount({
      grandTotal: 118000,
      taxableValue: 100000,
      advancePaymentRequired: true,
      advancePercentage: 20,
      commercialTerms: termsWith([milestone({ carriesTax: undefined })]),
    });

    expect(result).toBe(20000);
  });

  it('returns 0 when no advance is required', () => {
    expect(
      calculateAdvanceAmount({
        grandTotal: GRAND_TOTAL,
        taxableValue: TAXABLE_VALUE,
        advancePaymentRequired: false,
        advancePercentage: 30,
        commercialTerms: termsWith([milestone({ carriesTax: false })]),
      })
    ).toBe(0);
  });

  it('returns 0 when the percentage is absent', () => {
    expect(
      calculateAdvanceAmount({
        grandTotal: GRAND_TOTAL,
        taxableValue: TAXABLE_VALUE,
        advancePaymentRequired: true,
        advancePercentage: undefined,
        commercialTerms: termsWith([milestone({ carriesTax: false })]),
      })
    ).toBe(0);
  });

  it('rounds to paisa (rule 21)', () => {
    const result = calculateAdvanceAmount({
      grandTotal: 1000.005,
      taxableValue: 1000.005,
      advancePaymentRequired: true,
      advancePercentage: 33.333,
      commercialTerms: undefined,
    });

    expect(result).toBe(Math.round(((1000.005 * 33.333) / 100) * 100) / 100);
  });
});
