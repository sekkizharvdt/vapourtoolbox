/**
 * Vendor-quote line-item math — single source of truth for per-line discount
 * and GST, shared by the service layer and both quote forms (new + detail).
 *
 * Discount is applied BEFORE GST (mirrors the quote-level discount semantics).
 * Every step rounds to paisa per CLAUDE.md rule 21, and the resolved discount
 * is clamped to [0, gross] so an over-entered absolute discount can't push the
 * net line value negative.
 */

export type LineDiscountType = 'PERCENT' | 'ABSOLUTE';

export interface LineMathInput {
  quantity: number;
  unitPrice: number;
  gstRate?: number;
  discountType?: LineDiscountType;
  discountValue?: number;
}

export interface LineMathResult {
  /** quantity × unitPrice, rounded. */
  gross: number;
  /** Resolved absolute discount, clamped to [0, gross]. */
  discountAmount: number;
  /** Net of discount, before GST. This is what gets stored as `amount`. */
  amount: number;
  /** GST on the net amount, or undefined when no rate is set. */
  gstAmount: number | undefined;
  /** Net + GST — the line's contribution to the grand total. */
  total: number;
}

export function roundToPaisa(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Resolve gross → discount → net → GST → total for one quote line.
 */
export function computeQuoteLineAmounts(input: LineMathInput): LineMathResult {
  const quantity = Number(input.quantity) || 0;
  const unitPrice = Number(input.unitPrice) || 0;
  const gross = roundToPaisa(quantity * unitPrice);

  const discountType: LineDiscountType = input.discountType ?? 'PERCENT';
  const rawDiscountValue = Number(input.discountValue) || 0;

  let discountAmount = 0;
  if (rawDiscountValue > 0) {
    discountAmount =
      discountType === 'PERCENT'
        ? roundToPaisa(gross * (rawDiscountValue / 100))
        : roundToPaisa(rawDiscountValue);
  }
  // Never discount below zero or above the line value.
  discountAmount = Math.min(Math.max(discountAmount, 0), Math.max(gross, 0));

  const amount = roundToPaisa(gross - discountAmount);
  const gstAmount =
    input.gstRate !== undefined && input.gstRate !== null
      ? roundToPaisa(amount * (Number(input.gstRate) / 100))
      : undefined;
  const total = roundToPaisa(amount + (gstAmount ?? 0));

  return { gross, discountAmount, amount, gstAmount, total };
}
