/**
 * Attributing a bill or a payment to a PO payment milestone.
 *
 * ## Why the bill carries the tag
 *
 * A milestone is settled by an invoice, not by a bank transfer. That is how the
 * live data looks: BILL-2627-0064 is ₹1,59,300 — exactly 50% of PO/2026/007 —
 * which is its milestone #2. The vendor invoiced for the milestone.
 *
 * Payments do not line up the same way. Of 204 live vendor payments, 167
 * allocate to exactly one bill, 22 to several at once, and 64 of the
 * single-bill ones are partial. A `milestoneId` on the payment could not
 * express the 22, and would need hand-apportioning for the 64. Tagging the bill
 * instead lets `createPaymentWithAllocationsAtomic` keep doing the work: it
 * already maintains `amountPaid` / `outstandingAmount` / `paymentStatus` on the
 * bill atomically, so partial payments, multi-bill payments and reversals all
 * fall out for free.
 *
 * ## Why a payment can still be tagged directly
 *
 * An advance is paid against a proforma, which is frequently never entered as a
 * payable — 15 live payments have no allocation at all. Those need somewhere to
 * put the milestone, so a payment with no `billAllocations` may carry
 * `purchaseOrderId` + `milestoneId` itself.
 *
 * ## The invariant
 *
 * A payment is EITHER allocated to bills OR tagged directly, never both.
 * Otherwise the rollup counts it twice — once through the bill's `amountPaid`
 * and once as a direct payment. {@link assertSingleMilestoneAttribution}
 * enforces it at write time.
 *
 * Note that `isAdvance` is NOT the test. The flag means "advance against the
 * PO" to users and "unapplied" to the code: VPAY-2627-0067 and -0068 are both
 * `isAdvance: true` AND allocated to bills, while `bulkAutoAllocatePayments`
 * skips `isAdvance` payments outright. Presence of allocations is the only
 * reliable signal.
 */

import type { PaymentAllocation, PaymentMilestone, PurchaseOrder } from '@vapour/types';

/** A payment allocation that actually moves money. */
function hasRealAllocations(allocations: PaymentAllocation[] | undefined): boolean {
  return (allocations ?? []).some((a) => (a.allocatedAmount ?? 0) > 0);
}

export class MilestoneAttributionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MilestoneAttributionError';
  }
}

/**
 * Refuse a vendor payment that is both allocated to bills and tagged to a
 * milestone directly.
 *
 * Throws rather than silently dropping one side: either the allocation or the
 * tag is wrong, and guessing which would misstate the milestone's paid amount.
 */
export function assertSingleMilestoneAttribution(payment: {
  billAllocations?: PaymentAllocation[];
  purchaseOrderId?: string | null;
  milestoneId?: string | null;
}): void {
  const allocated = hasRealAllocations(payment.billAllocations);
  const taggedDirectly = Boolean(payment.purchaseOrderId || payment.milestoneId);

  if (allocated && taggedDirectly) {
    throw new MilestoneAttributionError(
      'A payment allocated to bills must not also be tagged to a PO milestone — ' +
        'the milestone comes from the bill in that case, and tagging both counts the payment twice. ' +
        'Clear the PO/milestone selection, or remove the bill allocations.'
    );
  }
}

/**
 * Milestones of a PO, priced and labelled for a picker.
 *
 * Returns an empty list for a PO with no structured payment schedule — those
 * predate the schedule editor and have nothing to attribute against.
 */
export interface MilestoneOption {
  id: string;
  serialNumber: number;
  label: string;
  amount?: number;
  carriesTax: boolean;
}

export function milestoneOptions(po: Pick<PurchaseOrder, 'commercialTerms'>): MilestoneOption[] {
  const schedule: PaymentMilestone[] = po.commercialTerms?.paymentSchedule ?? [];
  return schedule.map((m) => ({
    id: m.id,
    serialNumber: m.serialNumber,
    label: `${m.serialNumber}. ${m.paymentType || 'Payment'} (${m.percentage}%)`,
    amount: m.amount,
    carriesTax: m.carriesTax === true,
  }));
}
