/**
 * Payment milestone amounts.
 *
 * The rupee value of each milestone in a PO's payment schedule. One function,
 * used by PO create, draft edit, amendment apply, the schedule editor, the PO
 * PDF and the payment tracking — so the figure the vendor is quoted, the figure
 * printed on the PO and the figure payments are measured against are the same
 * number rather than three re-derivations.
 *
 * ## The formula
 *
 * GST is distributed pro-rata across the milestones flagged `carriesTax`, and
 * every milestone is otherwise priced on the pre-tax `taxableValue`:
 *
 *     amount_i = pct_i x taxableValue + (pct_i / SUM pct_flagged) x totalTax   [flagged]
 *              = pct_i x taxableValue                                          [otherwise]
 *
 * This is one rule, not two. It collapses correctly to both intents users
 * express in practice, verified against every live PO:
 *
 * - PO/2026/001, 50% advance unflagged + 50% before-dispatch flagged: the
 *   advance is pre-tax and the balance carries the whole GST.
 *   152,014.25 + 206,739.38 = 358,753.63.
 * - PO/2026/002, 40/40/20 all flagged: each payment carries its own share.
 *   94,400 + 94,400 + 47,200 = 236,000.
 * - PO/2026/007, 20% unflagged then 50/20/10 flagged:
 *   54,000 + 165,375 + 66,150 + 33,075 = 318,600.
 *
 * Buyers normally settle the full tax with the dispatch payment rather than
 * advancing GST they have not agreed to pay, which is why an unflagged
 * milestone must be priced on `taxableValue` and never on `grandTotal`.
 * Getting that wrong billed a 30% advance on the 4,491,953.20 grand total
 * instead of the 3,806,740 taxable value — 205,563.96 too high (feedback
 * jRO7w8mg).
 *
 * ## When nothing is flagged
 *
 * The tax belongs to nobody and the milestones fall short of `grandTotal` by
 * exactly `totalTax`. That is NOT silently defaulted here: the amounts come
 * back short and `validatePaymentSchedule` refuses the save, so the user has to
 * say which milestone carries the GST. Six live POs are in that state because
 * the checkbox defaults to unticked and Firestore drops the key, making silence
 * indistinguishable from "no tax anywhere".
 */

import type { PaymentMilestone, POCommercialTerms } from '@vapour/types';
import { roundToPaisa } from '@/lib/accounting/amountHelpers';

/** The PO totals a payment schedule is priced against. */
export interface PaymentScheduleTotals {
  /** Pre-tax value GST is charged on. */
  taxableValue: number;
  /** Total GST across all components. */
  totalTax: number;
  /** taxableValue + totalTax. */
  grandTotal: number;
}

/** Percentage points assigned to the milestones that carry GST. */
function flaggedPercentage(milestones: PaymentMilestone[]): number {
  return milestones.reduce(
    (sum, m) => (m.carriesTax === true ? sum + (m.percentage || 0) : sum),
    0
  );
}

/**
 * Whether any milestone has been told to carry the GST.
 *
 * `carriesTax` is opt-IN: only an explicit `true` counts. The editor renders
 * the checkbox as `carriesTax ?? false` and Firestore drops undefined keys, so
 * an unticked box is stored as absent rather than false, and every other
 * consumer already reads it as falsy-means-no.
 */
export function hasTaxAssignment(milestones: PaymentMilestone[]): boolean {
  return milestones.some((m) => m.carriesTax === true);
}

/**
 * Price each milestone, returning a new array — the input is not mutated.
 *
 * Any paisa residue from rounding each milestone independently is absorbed by
 * the last one, so a complete schedule sums to `grandTotal` exactly rather than
 * a paisa either side of it.
 */
export function calculateMilestoneAmounts(
  milestones: PaymentMilestone[],
  totals: PaymentScheduleTotals
): PaymentMilestone[] {
  if (milestones.length === 0) return [];

  const { taxableValue, totalTax, grandTotal } = totals;
  const flaggedPct = flaggedPercentage(milestones);

  const priced = milestones.map((m) => {
    const pct = m.percentage || 0;
    const base = (taxableValue * pct) / 100;
    // Divide the tax across the flagged milestones in proportion to their own
    // percentages. With a single flagged milestone this gives it the whole tax;
    // with every milestone flagged it gives each its own share.
    const taxShare = flaggedPct > 0 && m.carriesTax === true ? (totalTax * pct) / flaggedPct : 0;
    return { ...m, amount: roundToPaisa(base + taxShare) };
  });

  // Only reconcile a schedule that can reconcile: the percentages must account
  // for the whole order and some milestone must own the tax. A short schedule
  // is left short so validation can report the real gap.
  const pctTotal = milestones.reduce((sum, m) => sum + (m.percentage || 0), 0);
  const reconcilable = Math.abs(pctTotal - 100) < 0.01 && flaggedPct > 0;

  if (reconcilable) {
    const sum = roundToPaisa(priced.reduce((acc, m) => acc + (m.amount || 0), 0));
    const residue = roundToPaisa(grandTotal - sum);
    const last = priced[priced.length - 1];
    if (residue !== 0 && last) {
      last.amount = roundToPaisa((last.amount || 0) + residue);
    }
  }

  return priced;
}

/** Sum of the priced milestones, for reconciliation against `grandTotal`. */
export function sumMilestoneAmounts(milestones: PaymentMilestone[]): number {
  return roundToPaisa(milestones.reduce((sum, m) => sum + (m.amount || 0), 0));
}

/**
 * Reprice the schedule inside a commercial-terms object, returning a new one.
 *
 * Call this on every path that moves `grandTotal` — PO create, draft edit and
 * amendment apply — so a stored milestone amount can never disagree with the
 * order it belongs to. Returns the terms unchanged when there is no schedule.
 */
export function withPricedSchedule(
  terms: POCommercialTerms | undefined,
  totals: PaymentScheduleTotals
): POCommercialTerms | undefined {
  if (!terms?.paymentSchedule?.length) return terms;
  return {
    ...terms,
    paymentSchedule: calculateMilestoneAmounts(terms.paymentSchedule, totals),
  };
}
