/**
 * Tests for PO totals (feedback MesC9vYA).
 *
 * Extracted from createPOFromOffer so a quantity edit computes money the same
 * way creation does; these lock that equivalence in.
 */

import { calculatePOTotals, sumLineItems } from './totals';
import type { POCommercialTerms } from '@vapour/types';

const termsWith = (overrides: Partial<POCommercialTerms>) => overrides as POCommercialTerms;

describe('sumLineItems', () => {
  it('uses the stored amount, which is already net of any line discount', () => {
    expect(sumLineItems([{ quantity: 10, unitPrice: 100, amount: 900 }])).toBe(900);
  });

  it('falls back to qty x price for lines predating the amount field', () => {
    expect(sumLineItems([{ quantity: 10, unitPrice: 100 }])).toBe(1000);
  });

  it('rounds the total to paisa', () => {
    expect(sumLineItems([{ quantity: 3, unitPrice: 33.333 }])).toBe(100);
  });

  it('is zero for no lines', () => {
    expect(sumLineItems([])).toBe(0);
  });
});

describe('calculatePOTotals', () => {
  it('computes tax on the taxable value, not the raw subtotal', () => {
    const totals = calculatePOTotals({ subtotal: 1000, discount: 100, effectiveTaxRate: 0.18 });

    expect(totals.taxableValue).toBe(900);
    expect(totals.totalTax).toBe(162);
    expect(totals.grandTotal).toBe(1062);
  });

  it('adds separately-charged P&F to the taxable value', () => {
    // GST applies to P&F when it is charged on top of the line prices.
    const totals = calculatePOTotals({
      subtotal: 1000,
      effectiveTaxRate: 0.18,
      commercialTerms: termsWith({
        packingForwardingIncluded: false,
        pfChargeType: 'LUMPSUM',
        pfChargeValue: 200,
      }),
    });

    expect(totals.packingForwardingAmount).toBe(200);
    expect(totals.taxableValue).toBe(1200);
    expect(totals.grandTotal).toBe(1416);
  });

  it('computes percentage P&F off the subtotal', () => {
    const totals = calculatePOTotals({
      subtotal: 1000,
      effectiveTaxRate: 0,
      commercialTerms: termsWith({
        packingForwardingIncluded: false,
        pfChargeType: 'PERCENTAGE',
        pfChargeValue: 5,
      }),
    });

    expect(totals.packingForwardingAmount).toBe(50);
    expect(totals.taxableValue).toBe(1050);
  });

  it('adds nothing when P&F is already inside the line prices', () => {
    const totals = calculatePOTotals({
      subtotal: 1000,
      effectiveTaxRate: 0,
      commercialTerms: termsWith({ packingForwardingIncluded: true, pfChargeValue: 200 }),
    });

    expect(totals.packingForwardingAmount).toBe(0);
    expect(totals.taxableValue).toBe(1000);
  });

  it('splits tax evenly across CGST and SGST when states are unknown', () => {
    const totals = calculatePOTotals({ subtotal: 1000, effectiveTaxRate: 0.18 });

    expect(totals.cgst + totals.sgst).toBe(180);
    expect(totals.igst).toBe(0);
  });

  it('handles a zero tax rate without producing NaN', () => {
    const totals = calculatePOTotals({ subtotal: 1000, effectiveTaxRate: 0 });

    expect(totals.totalTax).toBe(0);
    expect(totals.grandTotal).toBe(1000);
  });

  it('ignores a negative or absent discount', () => {
    expect(calculatePOTotals({ subtotal: 500, effectiveTaxRate: 0 }).discount).toBe(0);
    expect(calculatePOTotals({ subtotal: 500, discount: -50, effectiveTaxRate: 0 }).discount).toBe(
      0
    );
  });

  it('scales with quantity — doubling the subtotal doubles the grand total', () => {
    // The property a quantity edit depends on.
    const single = calculatePOTotals({ subtotal: 1000, effectiveTaxRate: 0.18 });
    const double = calculatePOTotals({ subtotal: 2000, effectiveTaxRate: 0.18 });

    expect(double.grandTotal).toBe(single.grandTotal * 2);
  });
});
