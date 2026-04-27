/**
 * Fiscal Year Service
 *
 * Fiscal years are DERIVED from dates (April–March, fixed by statute in India)
 * and are not stored as Firestore documents. See `fiscalYearHelpers.ts`.
 *
 * Accounting periods (monthly) ARE stored — but lazily. A period document is
 * only created when a user closes or locks that month. Any month without a
 * document is treated as OPEN.
 */

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { AccountingPeriod, FiscalYear } from '@vapour/types';
import {
  computeFiscalYearForDate,
  derivePeriodsForFiscalYear,
  getAvailableFiscalYears,
  getCurrentFiscalYearDerived,
} from './fiscalYearHelpers';

const logger = createLogger({ context: 'fiscalYearService' });

// ---------------------------------------------------------------------------
// Fiscal year listing (derived — no Firestore reads for FY documents)
// ---------------------------------------------------------------------------

export { computeFiscalYearForDate, getAvailableFiscalYears, getCurrentFiscalYearDerived };

/** Backwards-compatible name used by existing callers. */
export const getAllFiscalYears = getAvailableFiscalYears;

/** Returns the FY that contains today. */
export function getCurrentFiscalYear(): FiscalYear {
  return getCurrentFiscalYearDerived();
}

/**
 * Stub for dormant year-end closing code.
 * Returns a derived FY from its id string — never reads Firestore.
 */
export function getFiscalYear(_db: Firestore, fiscalYearId: string): FiscalYear | null {
  const m = fiscalYearId.match(/^FY-(\d{4})-\d{2}$/);
  if (!m) return null;
  const start = new Date(Number(m[1]), 3, 1);
  const fy = computeFiscalYearForDate(start);
  return {
    id: fy.id,
    name: fy.name,
    startDate: fy.startDate,
    endDate: fy.endDate,
    status: 'OPEN',
    isCurrent: false,
    periods: [],
    isYearEndClosed: false,
    createdAt: fy.startDate,
    createdBy: 'system',
    updatedAt: fy.startDate,
  };
}

// ---------------------------------------------------------------------------
// Accounting periods (12 per FY, Firestore-backed on close/lock)
// ---------------------------------------------------------------------------

/**
 * Returns the 12 monthly periods for a fiscal year, merging persisted
 * close/lock state with the derived template. Adjustment periods (periodType
 * === 'ADJUSTMENT') are appended if they exist.
 */
export async function getAccountingPeriods(
  db: Firestore,
  fiscalYearId: string
): Promise<AccountingPeriod[]> {
  const derived = derivePeriodsForFiscalYear(fiscalYearId);

  const snap = await getDocs(
    query(collection(db, COLLECTIONS.ACCOUNTING_PERIODS), where('fiscalYearId', '==', fiscalYearId))
  );
  const persistedByNumber = new Map<number, AccountingPeriod>();
  const adjustmentPeriods: AccountingPeriod[] = [];
  snap.docs.forEach((d) => {
    const data: AccountingPeriod = { id: d.id, ...(d.data() as Omit<AccountingPeriod, 'id'>) };
    if (data.periodType === 'ADJUSTMENT') {
      adjustmentPeriods.push(data);
    } else {
      persistedByNumber.set(data.periodNumber, data);
    }
  });

  const merged: AccountingPeriod[] = derived.map((p) => {
    const existing = persistedByNumber.get(p.periodNumber);
    if (existing) return existing;
    return {
      id: `${fiscalYearId}-${String(p.periodNumber).padStart(2, '0')}`,
      fiscalYearId: p.fiscalYearId,
      name: p.name,
      periodType: 'MONTH',
      startDate: p.startDate,
      endDate: p.endDate,
      status: 'OPEN',
      periodNumber: p.periodNumber,
      year: p.year,
      createdAt: p.startDate,
      createdBy: 'system',
      updatedAt: p.startDate,
    };
  });

  return [...merged, ...adjustmentPeriods.sort((a, b) => a.periodNumber - b.periodNumber)];
}

function toJsDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(value as string);
}

/**
 * Returns the existing period document for (fiscalYearId, periodNumber), or
 * null if none has been created yet.
 */
async function findPeriodDoc(
  db: Firestore,
  fiscalYearId: string,
  periodNumber: number
): Promise<{ ref: ReturnType<typeof doc>; data: AccountingPeriod } | null> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.ACCOUNTING_PERIODS),
      where('fiscalYearId', '==', fiscalYearId),
      where('periodNumber', '==', periodNumber)
    )
  );
  const d = snap.docs[0];
  if (!d) return null;
  const data: AccountingPeriod = { id: d.id, ...(d.data() as Omit<AccountingPeriod, 'id'>) };
  return { ref: d.ref, data };
}

/**
 * Create a period document from the derived template. Called when the user
 * first closes or locks a month.
 */
async function createPeriodDoc(
  db: Firestore,
  fiscalYearId: string,
  periodNumber: number,
  userId: string,
  tenantId: string,
  initialStatus: 'CLOSED' | 'LOCKED',
  payload: Partial<AccountingPeriod>
): Promise<{ id: string; data: AccountingPeriod }> {
  const derived = derivePeriodsForFiscalYear(fiscalYearId).find(
    (p) => p.periodNumber === periodNumber
  );
  if (!derived) throw new Error(`Invalid period: ${fiscalYearId} #${periodNumber}`);

  const baseData = {
    tenantId,
    fiscalYearId,
    name: derived.name,
    periodType: 'MONTH' as const,
    startDate: Timestamp.fromDate(derived.startDate),
    endDate: Timestamp.fromDate(derived.endDate),
    status: initialStatus,
    periodNumber: derived.periodNumber,
    year: derived.year,
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
    ...payload,
  };

  const ref = await addDoc(collection(db, COLLECTIONS.ACCOUNTING_PERIODS), baseData);
  return {
    id: ref.id,
    data: { ...baseData, id: ref.id } as unknown as AccountingPeriod,
  };
}

// ---------------------------------------------------------------------------
// Close / lock / reopen
// ---------------------------------------------------------------------------

/**
 * Close an accounting period. Creates the Firestore doc if this is the first
 * action on the period.
 */
export async function closePeriod(
  db: Firestore,
  fiscalYearId: string,
  periodNumber: number,
  userId: string,
  tenantId: string,
  notes?: string
): Promise<void> {
  // rule18-exempt: writes to PERIOD_LOCK_AUDIT (domain-specific audit trail).
  const existing = await findPeriodDoc(db, fiscalYearId, periodNumber);

  if (!existing) {
    const { id } = await createPeriodDoc(
      db,
      fiscalYearId,
      periodNumber,
      userId,
      tenantId,
      'CLOSED',
      {
        closedDate: Timestamp.now() as unknown as Date,
        closedBy: userId,
        closingNotes: notes || '',
      }
    );
    await addDoc(collection(db, COLLECTIONS.PERIOD_LOCK_AUDIT), {
      tenantId,
      periodId: id,
      fiscalYearId,
      action: 'CLOSE',
      actionDate: serverTimestamp(),
      actionBy: userId,
      reason: notes || 'Period closed',
      previousStatus: 'OPEN',
      newStatus: 'CLOSED',
    });
    logger.info('Accounting period closed (new doc)', { fiscalYearId, periodNumber });
    return;
  }

  if (existing.data.status !== 'OPEN') {
    throw new Error(`Period cannot be closed: current status is ${existing.data.status}`);
  }

  await updateDoc(existing.ref, {
    status: 'CLOSED',
    closedDate: serverTimestamp(),
    closedBy: userId,
    closingNotes: notes || '',
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  await addDoc(collection(db, COLLECTIONS.PERIOD_LOCK_AUDIT), {
    tenantId,
    periodId: existing.data.id,
    fiscalYearId,
    action: 'CLOSE',
    actionDate: serverTimestamp(),
    actionBy: userId,
    reason: notes || 'Period closed',
    previousStatus: 'OPEN',
    newStatus: 'CLOSED',
  });

  logger.info('Accounting period closed', { fiscalYearId, periodNumber });
}

/** Lock an accounting period. Must be CLOSED first. */
export async function lockPeriod(
  db: Firestore,
  fiscalYearId: string,
  periodNumber: number,
  userId: string,
  tenantId: string,
  reason: string
): Promise<void> {
  // rule18-exempt: writes to PERIOD_LOCK_AUDIT (domain-specific audit trail).
  const existing = await findPeriodDoc(db, fiscalYearId, periodNumber);

  if (!existing) {
    throw new Error('Only closed periods can be locked. Please close the period first.');
  }

  if (existing.data.status !== 'CLOSED') {
    throw new Error(
      `Only closed periods can be locked. Current status: ${existing.data.status}. Please close the period first.`
    );
  }

  await updateDoc(existing.ref, {
    status: 'LOCKED',
    lockedDate: serverTimestamp(),
    lockedBy: userId,
    lockReason: reason,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  await addDoc(collection(db, COLLECTIONS.PERIOD_LOCK_AUDIT), {
    tenantId,
    periodId: existing.data.id,
    fiscalYearId,
    action: 'LOCK',
    actionDate: serverTimestamp(),
    actionBy: userId,
    reason,
    previousStatus: 'CLOSED',
    newStatus: 'LOCKED',
  });

  logger.info('Accounting period locked', { fiscalYearId, periodNumber });
}

/** Reopen a closed period. LOCKED periods cannot be reopened. */
export async function reopenPeriod(
  db: Firestore,
  fiscalYearId: string,
  periodNumber: number,
  userId: string,
  tenantId: string,
  reason: string
): Promise<void> {
  // rule18-exempt: writes to PERIOD_LOCK_AUDIT (domain-specific audit trail).
  const existing = await findPeriodDoc(db, fiscalYearId, periodNumber);

  if (!existing) {
    throw new Error('This period has no close/lock history. It is already open.');
  }

  if (existing.data.status === 'LOCKED') {
    throw new Error('Cannot reopen a locked period. Please contact a super admin.');
  }

  if (existing.data.status !== 'CLOSED') {
    throw new Error(`Only closed periods can be reopened. Current status: ${existing.data.status}`);
  }

  await updateDoc(existing.ref, {
    status: 'OPEN',
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  await addDoc(collection(db, COLLECTIONS.PERIOD_LOCK_AUDIT), {
    tenantId,
    periodId: existing.data.id,
    fiscalYearId,
    action: 'UNLOCK',
    actionDate: serverTimestamp(),
    actionBy: userId,
    reason,
    previousStatus: 'CLOSED',
    newStatus: 'OPEN',
  });

  logger.info('Accounting period reopened', { fiscalYearId, periodNumber });
}

// ---------------------------------------------------------------------------
// Transaction date validation
// ---------------------------------------------------------------------------

/**
 * Returns true if the period containing `transactionDate` is OPEN (either the
 * monthly period itself, or an adjustment period covering the same date).
 *
 * Missing period docs are treated as OPEN — we only persist state when the
 * user explicitly closes or locks a month.
 */
export async function isPeriodOpen(db: Firestore, transactionDate: Date): Promise<boolean> {
  const fy = computeFiscalYearForDate(transactionDate);
  // Months are derived: period 1 = April (index 3), 2 = May (4), …, 10 = Jan, 11 = Feb, 12 = Mar.
  const monthIndex = transactionDate.getMonth();
  const periodNumber = ((monthIndex - 3 + 12) % 12) + 1;

  const existing = await findPeriodDoc(db, fy.id, periodNumber);
  if (!existing) return true; // no doc ⇒ OPEN by default

  if (existing.data.status === 'OPEN') return true;

  // If the monthly period is closed/locked, check for an open adjustment period.
  const adjSnap = await getDocs(
    query(
      collection(db, COLLECTIONS.ACCOUNTING_PERIODS),
      where('fiscalYearId', '==', fy.id),
      where('periodType', '==', 'ADJUSTMENT'),
      where('status', '==', 'OPEN')
    )
  );
  for (const d of adjSnap.docs) {
    const data = d.data() as AccountingPeriod;
    const start = toJsDate(data.startDate);
    const end = toJsDate(data.endDate);
    if (transactionDate >= start && transactionDate <= end) return true;
  }

  return false;
}

/** Throws if the period containing `transactionDate` is closed or locked. */
export async function validateTransactionDate(db: Firestore, transactionDate: Date): Promise<void> {
  const isOpen = await isPeriodOpen(db, transactionDate);
  if (!isOpen) {
    throw new Error(
      `Cannot post transaction: the accounting period for ${transactionDate.toLocaleDateString()} is closed. Ask an accountant to reopen the period.`
    );
  }
}

// ---------------------------------------------------------------------------
// Deprecated stubs — kept only so dormant year-end code compiles.
// Invoke them and they will throw; they have no UI surface yet.
// ---------------------------------------------------------------------------

/** @deprecated Year-end UI is not wired; this throws. */
export async function calculateYearEndBalances(
  _db: Firestore,
  _fiscalYearId: string
): Promise<never> {
  throw new Error('Year-end closing is not available yet.');
}

/** @deprecated See above. */
export async function createAdjustmentPeriod(
  _db: Firestore,
  _fiscalYearId: string,
  _userId: string
): Promise<string> {
  throw new Error('Year-end closing is not available yet.');
}

/** @deprecated See above. */
export async function provisionalClose(): Promise<never> {
  throw new Error('Year-end closing is not available yet.');
}

/** @deprecated See above. */
export async function finalClose(): Promise<never> {
  throw new Error('Year-end closing is not available yet.');
}
