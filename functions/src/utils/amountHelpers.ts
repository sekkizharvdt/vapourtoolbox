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

export function deriveOutstanding(
  data: (AmountSource & { amountPaid?: unknown; paidAmount?: unknown }) | null | undefined
): number {
  if (!data) return 0;
  const total = getInrAmount(data);
  const paid = asNumber(data.amountPaid) ?? asNumber(data.paidAmount) ?? 0; // rule21-exempt
  const remaining = total - paid;
  return Math.max(0, roundToPaisa(remaining));
}
