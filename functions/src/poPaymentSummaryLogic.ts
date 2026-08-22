/**
 * Pure logic for the PO payment-summary projection.
 *
 * No firebase imports — deterministic input → output, so it unit-tests without
 * emulators. `procurementPaymentStatus.ts` is a thin shell over this, exactly
 * as `accountBalances.ts` is over `accountBalanceLogic.ts`.
 *
 * ## Why a projection exists at all
 *
 * Procurement cannot read `transactions`: that collection requires
 * VIEW_ACCOUNTING, and four of the nine live users hold MANAGE_PROCUREMENT
 * without it. A client-side query for "what has been paid against this PO"
 * returns permission-denied for precisely the people the feature is for. So a
 * Cloud Function — admin credentials, rules do not apply — reads the
 * transactions and publishes a narrow summary onto the PO document, which
 * procurement already reads. `syncPOPaymentToGRs` in the same file has always
 * worked this way for goods receipts; this is the same pattern one level up.
 *
 * ## What counts as paid
 *
 *     milestone paid = SUM paid-on-bills tagged to the milestone
 *                    + SUM unallocated payments tagged directly to the milestone
 *
 * The tag sits on the BILL because that is the unit vendors invoice in — a live
 * bill is exactly 50% of its PO, matching milestone #2. Payments do not line up
 * that way: 22 live payments settle several bills at once and 64 settle only
 * part of one, both of which the bill's own `amountPaid` already handles.
 *
 * An advance often has no bill at all (15 live payments have no allocation), so
 * a payment with nothing allocated may carry the milestone itself. A payment is
 * EITHER allocated OR directly tagged — counting both would double it.
 *
 * ## Recompute, never increment
 *
 * Every call rebuilds the whole summary from the transactions passed in, so
 * repeated, retried or out-of-order triggers converge on the same answer
 * (rule 21). Nothing here reads the previous summary.
 */

export interface MilestoneLike {
  id: string;
  serialNumber: number;
  paymentType: string;
  percentage: number;
  amount?: number;
  carriesTax?: boolean;
}

export interface POLike {
  grandTotal?: number;
  commercialTerms?: { paymentSchedule?: MilestoneLike[] };
}

export interface BillLike {
  id: string;
  transactionNumber?: string;
  isDeleted?: boolean;
  purchaseOrderId?: string;
  milestoneId?: string;
  totalAmount?: number;
  amountPaid?: number;
  paidAmount?: number;
}

export interface AllocationLike {
  invoiceId?: string;
  allocatedAmount?: number;
}

export interface PaymentLike {
  id: string;
  transactionNumber?: string;
  isDeleted?: boolean;
  /** Seconds since epoch — the caller converts the Firestore Timestamp. */
  paymentDateSeconds?: number;
  billAllocations?: AllocationLike[];
  purchaseOrderId?: string;
  milestoneId?: string;
  totalAmount?: number;
  amount?: number;
  reference?: string;
  chequeNumber?: string;
  upiTransactionId?: string;
}

export type POPaymentStatusValue =
  | 'PENDING'
  | 'DUE'
  | 'PAYMENT_REQUESTED'
  | 'PARTIALLY_PAID'
  | 'PAID';

export interface MilestoneSummary {
  milestoneId: string;
  serialNumber: number;
  paymentType: string;
  percentage: number;
  amount: number;
  paid: number;
  pending: number;
  status: POPaymentStatusValue;
}

export interface HistoryEntry {
  paymentId: string;
  paymentNumber: string;
  paymentDateSeconds: number;
  amount: number;
  reference?: string;
  milestoneId?: string;
  billId?: string;
  billNumber?: string;
}

export interface PaymentSummaryResult {
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: POPaymentStatusValue;
  milestones: MilestoneSummary[];
  history: HistoryEntry[];
}

/** Money tolerance — floating-point residue must not mark a paid item pending. */
const EPSILON = 0.01;

export const roundToPaisa = (n: number): number => Math.round(n * 100) / 100;

/**
 * Paid total on a bill.
 *
 * `amountPaid` first: `paidAmount` is initialised to 0 and never updated, so
 * reading it left every PO looking entirely unpaid. Same precedence as
 * `derivePaid` in the accounting helpers.
 */
export function billPaid(bill: BillLike): number {
  if (typeof bill.amountPaid === 'number') return bill.amountPaid;
  if (typeof bill.paidAmount === 'number') return bill.paidAmount;
  return 0;
}

/** Amount a payment actually moved. */
export function paymentAmount(payment: PaymentLike): number {
  if (typeof payment.totalAmount === 'number') return payment.totalAmount;
  if (typeof payment.amount === 'number') return payment.amount;
  return 0;
}

/** UTR / cheque / UPI, whichever the payment carries. */
export function paymentReference(payment: PaymentLike): string | undefined {
  return payment.reference || payment.chequeNumber || payment.upiTransactionId || undefined;
}

/** Allocations that actually move money. */
function realAllocations(payment: PaymentLike): AllocationLike[] {
  return (payment.billAllocations ?? []).filter((a) => (a.allocatedAmount ?? 0) > 0);
}

/** Status of a single amount-versus-paid pair. */
export function derivePaymentStatus(amount: number, paid: number): POPaymentStatusValue {
  if (amount <= EPSILON) return paid > EPSILON ? 'PAID' : 'PENDING';
  if (paid <= EPSILON) return 'PENDING';
  if (paid >= amount - EPSILON) return 'PAID';
  return 'PARTIALLY_PAID';
}

/**
 * Rebuild a PO's payment summary from its bills and payments.
 *
 * `bills` and `payments` must already be narrowed to this PO — bills by
 * `purchaseOrderId`, payments by allocation-to-those-bills or by a direct
 * `purchaseOrderId` tag. Soft-deleted documents are dropped here regardless
 * (rule 3), so callers need not pre-filter.
 */
export function computePOPaymentSummary(
  po: POLike,
  bills: BillLike[],
  payments: PaymentLike[]
): PaymentSummaryResult {
  const liveBills = bills.filter((b) => !b.isDeleted);
  const livePayments = payments.filter((p) => !p.isDeleted);
  const billById = new Map(liveBills.map((b) => [b.id, b]));

  const schedule = po.commercialTerms?.paymentSchedule ?? [];
  const grandTotal = roundToPaisa(po.grandTotal ?? 0);

  // ── Paid per milestone ──
  const paidByMilestone = new Map<string, number>();
  const addPaid = (milestoneId: string | undefined, amount: number) => {
    if (!milestoneId || amount <= 0) return;
    paidByMilestone.set(milestoneId, (paidByMilestone.get(milestoneId) ?? 0) + amount);
  };

  for (const bill of liveBills) {
    addPaid(bill.milestoneId, billPaid(bill));
  }

  for (const payment of livePayments) {
    // Only a payment with nothing allocated may be tagged directly; one that
    // settles bills is already counted through those bills' amountPaid.
    if (realAllocations(payment).length === 0) {
      addPaid(payment.milestoneId, paymentAmount(payment));
    }
  }

  // ── Per-milestone rows ──
  const milestones: MilestoneSummary[] = schedule.map((m) => {
    const amount = roundToPaisa(m.amount ?? 0);
    // Cap at the milestone value: an overpayment belongs to the PO total, not
    // to a milestone that would otherwise report more than 100% settled.
    const paid = roundToPaisa(Math.min(paidByMilestone.get(m.id) ?? 0, amount || Infinity));
    return {
      milestoneId: m.id,
      serialNumber: m.serialNumber,
      paymentType: m.paymentType,
      percentage: m.percentage,
      amount,
      paid,
      pending: roundToPaisa(Math.max(amount - paid, 0)),
      status: derivePaymentStatus(amount, paid),
    };
  });

  // ── PO totals ──
  //
  // Summed from the source documents rather than from the milestone rows: a
  // bill with no milestone tag, or one tagged to a milestone that has since
  // been removed from the schedule, still represents money paid against this
  // PO and must not vanish from the total.
  let paidAmount = 0;
  for (const bill of liveBills) paidAmount += billPaid(bill);
  for (const payment of livePayments) {
    if (realAllocations(payment).length === 0) paidAmount += paymentAmount(payment);
  }
  paidAmount = roundToPaisa(paidAmount);

  // ── Payment history ──
  const history: HistoryEntry[] = [];
  for (const payment of livePayments) {
    const allocations = realAllocations(payment);
    const reference = paymentReference(payment);

    if (allocations.length === 0) {
      history.push({
        paymentId: payment.id,
        paymentNumber: payment.transactionNumber ?? payment.id,
        paymentDateSeconds: payment.paymentDateSeconds ?? 0,
        amount: roundToPaisa(paymentAmount(payment)),
        ...(reference && { reference }),
        ...(payment.milestoneId && { milestoneId: payment.milestoneId }),
      });
      continue;
    }

    // One row per allocation that lands on a bill belonging to this PO, so a
    // payment spanning several POs contributes only its relevant share.
    for (const allocation of allocations) {
      const bill = allocation.invoiceId ? billById.get(allocation.invoiceId) : undefined;
      if (!bill) continue;
      history.push({
        paymentId: payment.id,
        paymentNumber: payment.transactionNumber ?? payment.id,
        paymentDateSeconds: payment.paymentDateSeconds ?? 0,
        amount: roundToPaisa(allocation.allocatedAmount ?? 0),
        ...(reference && { reference }),
        ...(bill.milestoneId && { milestoneId: bill.milestoneId }),
        billId: bill.id,
        ...(bill.transactionNumber && { billNumber: bill.transactionNumber }),
      });
    }
  }

  history.sort((a, b) => b.paymentDateSeconds - a.paymentDateSeconds);

  return {
    totalAmount: grandTotal,
    paidAmount,
    pendingAmount: roundToPaisa(Math.max(grandTotal - paidAmount, 0)),
    status: derivePaymentStatus(grandTotal, paidAmount),
    milestones,
    history,
  };
}
