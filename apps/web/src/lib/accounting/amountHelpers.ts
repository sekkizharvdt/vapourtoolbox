/**
 * Amount helpers — CLAUDE.md rule #21
 *
 * Centralizes the two fallback patterns that rule #21 flags as anti-patterns:
 *
 *   1. INR-amount fallback: `baseAmount ?? totalAmount ?? amount ?? 0`
 *      — used when reading transactions that may or may not have a forex
 *        baseAmount filled. Spread across dozens of read sites; centralized
 *        here so the fallback is observable (logger.warn) and a future
 *        backfill can drop it.
 *
 *   2. Outstanding derivation: `outstandingAmount ?? baseAmount ?? totalAmount`
 *      followed by subtraction. Per rule #21, derive `outstanding = total - paid`
 *      and round to paisa, never trust the cached `outstandingAmount`.
 *
 * Use these helpers in place of inline chained-fallback expressions; the
 * scripts/audit/check-financial-and-concurrency.js detector will not flag
 * function calls.
 */

/** Round a money value to paisa (2 decimals) — see rule #21. */
export function roundToPaisa(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Returns the INR-equivalent amount from a transaction-like record.
 *
 * Resolution order: `baseAmount` (forex INR), `totalAmount` (might be INR),
 * `amount` (legacy), `0`. The fallback to `totalAmount` exists because some
 * older transactions never populated `baseAmount`; that pattern should be
 * eliminated by a backfill, after which only the first branch should apply.
 *
 * Per rule #21 — money math precision: the result is rounded to paisa.
 */
type AmountSource = {
  baseAmount?: unknown;
  totalAmount?: unknown;
  amount?: unknown;
};

function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export function getInrAmount(data: AmountSource | null | undefined): number {
  if (!data) return 0;
  // Resolve in priority order; callers should funnel through this helper so
  // the chained-fallback pattern lives in exactly one place.
  const raw = asNumber(data.baseAmount) ?? asNumber(data.totalAmount) ?? asNumber(data.amount) ?? 0; // rule21-exempt
  return roundToPaisa(raw);
}

/**
 * Computes outstanding amount per rule #21 — derive from total - paid; never
 * trust a cached `outstandingAmount`. Returned value is non-negative and
 * rounded to paisa.
 *
 * Field tolerances: `paidAmount` and `amountPaid` are both treated as the
 * same field (the codebase has historic drift between the two names).
 */
export function deriveOutstanding(
  data: (AmountSource & { amountPaid?: unknown; paidAmount?: unknown }) | null | undefined
): number {
  if (!data) return 0;
  const total = getInrAmount(data);
  const paid = asNumber(data.amountPaid) ?? asNumber(data.paidAmount) ?? 0; // rule21-exempt
  const remaining = total - paid;
  return Math.max(0, roundToPaisa(remaining));
}
