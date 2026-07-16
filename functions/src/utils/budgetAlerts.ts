/**
 * Budget threshold alert logic (pure).
 *
 * Decides which budget-utilization alerts to fire based on the current
 * utilization and the one-shot stamps already on the project doc.
 *
 * Behavior (kept deliberately simple):
 * - Crossing 90% fires the warning once; staying above 90% never re-fires.
 * - Crossing 100% fires the exceeded alert once (the "second" alert).
 * - Jumping straight past 100% fires only the exceeded alert, but stamps
 *   both thresholds so a later dip into the 90s can't fire a stale warning.
 * - Stamps are never cleared when utilization drops back below a threshold.
 */

export interface BudgetAlertStamps {
  /** Truthy when the 90% warning has already been sent (Timestamp on the doc). */
  budgetAlert90SentAt?: unknown;
  /** Truthy when the 100% exceeded alert has already been sent. */
  budgetAlert100SentAt?: unknown;
}

export interface BudgetAlertDecision {
  /** Which alert to notify for this run, if any. */
  notify: 90 | 100 | null;
  /** Stamp budgetAlert90SentAt on the project doc. */
  stamp90: boolean;
  /** Stamp budgetAlert100SentAt on the project doc. */
  stamp100: boolean;
}

export function evaluateBudgetAlerts(
  utilizationPercent: number,
  stamps: BudgetAlertStamps
): BudgetAlertDecision {
  const sent90 = Boolean(stamps.budgetAlert90SentAt);
  const sent100 = Boolean(stamps.budgetAlert100SentAt);

  if (utilizationPercent >= 100) {
    if (!sent100) {
      // Fire the exceeded alert; backfill the 90% stamp so a later dip
      // into 90–100% doesn't fire a stale warning.
      return { notify: 100, stamp90: !sent90, stamp100: true };
    }
    return { notify: null, stamp90: false, stamp100: false };
  }

  if (utilizationPercent >= 90 && !sent90) {
    return { notify: 90, stamp90: true, stamp100: false };
  }

  return { notify: null, stamp90: false, stamp100: false };
}
