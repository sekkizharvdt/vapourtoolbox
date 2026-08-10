/**
 * Cloud-Functions copy of apps/web/src/lib/accounting/amountHelpers.ts.
 *
 * Centralizes the rule #21 fallback patterns. Kept in sync with the web-side
 * helper. See apps/web/src/lib/accounting/amountHelpers.ts for full context.
 */

type AmountSource = {
  baseAmount?: unknown;
  totalAmount?: unknown;
  amount?: unknown;
};

function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export function roundToPaisa(n: number): number {
  return Math.round(n * 100) / 100;
}

export function getInrAmount(data: AmountSource | null | undefined): number {
  if (!data) return 0;
  const raw = asNumber(data.baseAmount) ?? asNumber(data.totalAmount) ?? asNumber(data.amount) ?? 0; // rule21-exempt
  return roundToPaisa(raw);
}

/**
 * Amount actually settled against a document, in INR.
 *
 * `amountPaid` is the live field written by the payment path; `paidAmount` is
 * declared on the types, initialised to 0 and never updated. Reading the
 * declared name returns 0 on settled documents — always come through here.
 */
export function derivePaid(
  data: { amountPaid?: unknown; paidAmount?: unknown } | null | undefined
): number {
  if (!data) return 0;
  return roundToPaisa(asNumber(data.amountPaid) ?? asNumber(data.paidAmount) ?? 0); // rule21-exempt
}

export function deriveOutstanding(
  data: (AmountSource & { amountPaid?: unknown; paidAmount?: unknown }) | null | undefined
): number {
  if (!data) return 0;
  const remaining = getInrAmount(data) - derivePaid(data);
  return Math.max(0, roundToPaisa(remaining));
}
