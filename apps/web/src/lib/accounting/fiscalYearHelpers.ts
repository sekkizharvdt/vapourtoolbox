/**
 * Derive fiscal years from dates.
 *
 * Indian FY is April 1 – March 31, fixed by statute. There is no need to
 * store fiscal years as Firestore documents — any date maps deterministically
 * to an FY. Accounting periods still exist as documents for close/lock state
 * (see accountingPeriods collection), but those are created lazily when a
 * user actually closes or locks a month.
 */

import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { FiscalYear } from '@vapour/types';

/** Indian fiscal year starts in April. */
const FY_START_MONTH_INDEX = 3; // 0-indexed: April

/**
 * Compute the fiscal year that contains a given date.
 *
 * Example: 2025-04-01 → FY 2025-26 (Apr 2025 – Mar 2026)
 *          2026-03-31 → FY 2025-26
 *          2026-04-01 → FY 2026-27
 */
export function computeFiscalYearForDate(date: Date): {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  fyStartYear: number;
} {
  const month = date.getMonth();
  const year = date.getFullYear();
  const fyStartYear = month >= FY_START_MONTH_INDEX ? year : year - 1;
  const fyEndYear = fyStartYear + 1;
  const startDate = new Date(fyStartYear, FY_START_MONTH_INDEX, 1, 0, 0, 0, 0);
  const endDate = new Date(fyEndYear, FY_START_MONTH_INDEX, 0, 23, 59, 59, 999); // Mar 31
  const id = `FY-${fyStartYear}-${String(fyEndYear).slice(2)}`;
  const name = `FY ${fyStartYear}-${String(fyEndYear).slice(2)}`;
  return { id, name, startDate, endDate, fyStartYear };
}

/** Returns an FY shaped like the existing FiscalYear type, with derived fields. */
function toFiscalYearShape(fyStartYear: number, isCurrent: boolean): FiscalYear {
  const start = new Date(fyStartYear, FY_START_MONTH_INDEX, 1, 0, 0, 0, 0);
  const fy = computeFiscalYearForDate(start);
  return {
    id: fy.id,
    name: fy.name,
    startDate: fy.startDate,
    endDate: fy.endDate,
    status: 'OPEN',
    isCurrent,
    periods: [],
    isYearEndClosed: false,
    createdAt: fy.startDate,
    createdBy: 'system',
    updatedAt: fy.startDate,
  };
}

function toFyDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return null;
}

/**
 * Returns the list of FYs relevant for the current tenant, newest first.
 *
 * Range covers: earliest transaction date (if any) through the next FY, plus
 * the current FY from today. Callers use this to populate filter dropdowns
 * and the fiscal-years list page.
 */
export async function getAvailableFiscalYears(db: Firestore): Promise<FiscalYear[]> {
  const today = new Date();
  const currentFY = computeFiscalYearForDate(today);
  const nextFYStartYear = currentFY.fyStartYear + 1;

  // Find the earliest transaction date (if any) to extend the list backwards.
  let earliestFYStartYear = currentFY.fyStartYear;
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTIONS.TRANSACTIONS), orderBy('date', 'asc'), limit(1))
    );
    if (!snap.empty && snap.docs[0]) {
      const earliest = toFyDate(snap.docs[0].data().date);
      if (earliest) earliestFYStartYear = computeFiscalYearForDate(earliest).fyStartYear;
    }
  } catch {
    // No transactions, or index missing — fall back to just current + next.
  }

  const startYear = Math.min(earliestFYStartYear, currentFY.fyStartYear);
  const endYear = nextFYStartYear;

  const years: FiscalYear[] = [];
  for (let y = endYear; y >= startYear; y--) {
    years.push(toFiscalYearShape(y, y === currentFY.fyStartYear));
  }
  return years;
}

/** Pure synchronous equivalent: current + next FY only, useful when there are no transactions. */
export function getDefaultFiscalYears(): FiscalYear[] {
  const today = new Date();
  const cur = computeFiscalYearForDate(today);
  return [toFiscalYearShape(cur.fyStartYear + 1, false), toFiscalYearShape(cur.fyStartYear, true)];
}

/** The FY that contains today. */
export function getCurrentFiscalYearDerived(): FiscalYear {
  const today = new Date();
  const cur = computeFiscalYearForDate(today);
  return toFiscalYearShape(cur.fyStartYear, true);
}

/**
 * Month name for each period number (1-12) where period 1 is April.
 * Used when displaying periods derived from an FY.
 */
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Derive the 12 monthly periods for a given FY id.
 * `periodNumber` is 1-indexed starting at April.
 *
 * These are ephemeral — the actual Firestore record is created lazily when
 * a user closes or locks the period.
 */
export function derivePeriodsForFiscalYear(fiscalYearId: string): Array<{
  fiscalYearId: string;
  name: string;
  periodNumber: number;
  year: number;
  startDate: Date;
  endDate: Date;
}> {
  // FY id format: "FY-2025-26" — parse the start year.
  const m = fiscalYearId.match(/^FY-(\d{4})-\d{2}$/);
  if (!m) throw new Error(`Invalid fiscal year id: ${fiscalYearId}`);
  const fyStartYear = Number(m[1]);

  const periods = [];
  for (let i = 0; i < 12; i++) {
    const monthIndex = (FY_START_MONTH_INDEX + i) % 12;
    const yearOffset = FY_START_MONTH_INDEX + i >= 12 ? 1 : 0;
    const calendarYear = fyStartYear + yearOffset;
    const startDate = new Date(calendarYear, monthIndex, 1, 0, 0, 0, 0);
    const endDate = new Date(calendarYear, monthIndex + 1, 0, 23, 59, 59, 999);
    periods.push({
      fiscalYearId,
      name: `${MONTH_NAMES[monthIndex]} ${calendarYear}`,
      periodNumber: i + 1,
      year: calendarYear,
      startDate,
      endDate,
    });
  }
  return periods;
}
