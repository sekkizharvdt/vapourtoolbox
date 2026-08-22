/**
 * Purchase Order totals.
 *
 * Extracted so PO creation and PO editing compute money the same way. They did
 * not before: creation derived `subtotal` from the vendor quote's own subtotal,
 * while an edit has to derive it from the PO's line items. Two code paths
 * computing GST from different inputs is exactly how a rounding difference
 * becomes a ledger difference, so both now go through here.
 *
 * The GST rate is carried as the quote's blended effective rate rather than
 * recomputed per line: it is exact for a single-rate PO and correct in
 * aggregate for a mixed-rate one, which is the behaviour POs already had.
 */

import { roundToPaisa } from '@/lib/accounting/amountHelpers';
import { calculateGST } from '@/lib/accounting/gstCalculator';
import type { POCommercialTerms } from '@vapour/types';

export interface POTotalsInput {
  /** Basic price before discount and P&F. */
  subtotal: number;
  /** Header discount, applied before tax. */
  discount?: number;
  /** Blended GST rate as a fraction (0.18 for 18%). */
  effectiveTaxRate: number;
  commercialTerms?: POCommercialTerms;
  /** Vendor and company states decide CGST+SGST vs IGST. */
  vendorState?: string;
  companyState?: string;
}

export interface POTotals {
  subtotal: number;
  discount: number;
  packingForwardingAmount: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  grandTotal: number;
}

/**
 * Compute every monetary field on a PO from its basic price.
 *
 * Mirrors the original creation sequence exactly: discount reduces the taxable
 * value before tax, separately-charged P&F is part of it, and GST is computed
 * on the result.
 */
export function calculatePOTotals(input: POTotalsInput): POTotals {
  const subtotal = roundToPaisa(input.subtotal);
  const discount = input.discount && input.discount > 0 ? roundToPaisa(input.discount) : 0;

  // P&F, when charged separately, is part of the taxable value (GST applies to
  // it). Zero when it is already inside the line prices.
  const ct = input.commercialTerms;
  let packingForwardingAmount = 0;
  if (ct && !ct.packingForwardingIncluded && ct.pfChargeValue && ct.pfChargeValue > 0) {
    packingForwardingAmount =
      ct.pfChargeType === 'PERCENTAGE'
        ? roundToPaisa((subtotal * ct.pfChargeValue) / 100)
        : roundToPaisa(ct.pfChargeValue);
  }

  const taxableValue = roundToPaisa(subtotal - discount + packingForwardingAmount);
  const totalTax = roundToPaisa(taxableValue * input.effectiveTaxRate);

  // Default to an even CGST/SGST split; the state-aware calculation below
  // overrides it when both states are known.
  let cgst = roundToPaisa(totalTax / 2);
  let sgst = roundToPaisa(totalTax - cgst);
  let igst = 0;

  if (input.vendorState && input.companyState) {
    const gstDetails = calculateGST({
      taxableAmount: taxableValue,
      gstRate: input.effectiveTaxRate * 100,
      sourceState: input.companyState,
      destinationState: input.vendorState,
    });

    if (gstDetails.gstType === 'IGST') {
      cgst = 0;
      sgst = 0;
      igst = roundToPaisa(gstDetails.igstAmount ?? 0);
    } else {
      cgst = roundToPaisa(gstDetails.cgstAmount ?? 0);
      sgst = roundToPaisa(gstDetails.sgstAmount ?? 0);
      igst = 0;
    }
  }

  return {
    subtotal,
    discount,
    packingForwardingAmount,
    taxableValue,
    cgst,
    sgst,
    igst,
    totalTax,
    grandTotal: roundToPaisa(taxableValue + totalTax),
  };
}

/**
 * The pre-tax value GST is charged on, for a PO already saved to Firestore.
 *
 * Prefer the persisted `taxableValue`. POs written before that field existed do
 * not carry it, so fall back to `grandTotal - totalTax` — an exact identity,
 * not an estimate, since `grandTotal` is defined as `taxableValue + totalTax`.
 * `scripts/analysis/backfill-po-taxable-value.js` fills the field in for the
 * existing records; this accessor is the one place the fallback lives.
 */
export function getTaxableValue(po: {
  taxableValue?: number;
  grandTotal?: number;
  totalTax?: number;
}): number {
  if (typeof po.taxableValue === 'number') return roundToPaisa(po.taxableValue);
  return roundToPaisa((po.grandTotal ?? 0) - (po.totalTax ?? 0));
}

/**
 * Basic price of a PO, summed from its line items.
 *
 * `amount` is already net of any per-line discount, so it is used directly
 * where present; qty x unitPrice is the fallback for lines predating that field.
 */
export function sumLineItems(
  items: Array<{ quantity: number; unitPrice: number; amount?: number }>
): number {
  return roundToPaisa(
    items.reduce((sum, item) => sum + (item.amount ?? item.quantity * item.unitPrice), 0)
  );
}
