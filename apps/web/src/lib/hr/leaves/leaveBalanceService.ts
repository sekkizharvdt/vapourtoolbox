/**
 * Leave Balance Service
 *
 * Manages user leave balances per fiscal year.
 * Tracks entitled, used, pending, and available leave days.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { LeaveBalance, LeaveTypeCode } from '@vapour/types';
import { getLeaveTypes } from './leaveTypeService';

const logger = createLogger({ context: 'leaveBalanceService' });

/**
 * Safely transform Firestore data to LeaveBalance with default values
 * Handles missing or undefined numeric fields to prevent NaN calculations
 */
function toLeaveBalance(id: string, data: Record<string, unknown>): LeaveBalance {
  const entitled = typeof data.entitled === 'number' ? data.entitled : 0;
  const used = typeof data.used === 'number' ? data.used : 0;
  const pending = typeof data.pending === 'number' ? data.pending : 0;
  const carryForward = typeof data.carryForward === 'number' ? data.carryForward : 0;

  // Recalculate available to ensure consistency
  const available = entitled + carryForward - used - pending;

  return {
    id,
    userId: data.userId as string,
    userName: data.userName as string,
    userEmail: data.userEmail as string,
    leaveTypeId: data.leaveTypeId as string,
    leaveTypeCode: data.leaveTypeCode as LeaveTypeCode,
    leaveTypeName: data.leaveTypeName as string,
    fiscalYear: data.fiscalYear as number,
    entitled,
    used,
    pending,
    available,
    carryForward,
    createdAt: data.createdAt as Timestamp,
    updatedAt: data.updatedAt as Timestamp,
  };
}

/**
 * Get current fiscal year (Jan 1 - Dec 31)
 */
export function getCurrentFiscalYear(): number {
  return new Date().getFullYear();
}

/**
 * Get user's leave balances for a fiscal year
 */
export async function getUserLeaveBalances(
  userId: string,
  fiscalYear?: number
): Promise<LeaveBalance[]> {
  const { db } = getFirebase();
  const year = fiscalYear ?? getCurrentFiscalYear();

  try {
    const q = query(
      collection(db, COLLECTIONS.HR_LEAVE_BALANCES),
      where('userId', '==', userId),
      where('fiscalYear', '==', year)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnapshot) =>
      toLeaveBalance(docSnapshot.id, docSnapshot.data() as Record<string, unknown>)
    );
  } catch (error) {
    logger.error('Failed to get user leave balances', { error, userId, fiscalYear: year });
    throw new Error('Failed to get leave balances');
  }
}

/**
 * Get a specific leave balance by ID
 */
export async function getLeaveBalanceById(id: string): Promise<LeaveBalance | null> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.HR_LEAVE_BALANCES, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return toLeaveBalance(docSnap.id, docSnap.data() as Record<string, unknown>);
  } catch (error) {
    logger.error('Failed to get leave balance by ID', { error, id });
    throw new Error('Failed to get leave balance');
  }
}

/**
 * Get user's balance for a specific leave type
 */
export async function getUserLeaveBalanceByType(
  userId: string,
  leaveTypeCode: LeaveTypeCode,
  fiscalYear?: number
): Promise<LeaveBalance | null> {
  const { db } = getFirebase();
  const year = fiscalYear ?? getCurrentFiscalYear();

  try {
    const q = query(
      collection(db, COLLECTIONS.HR_LEAVE_BALANCES),
      where('userId', '==', userId),
      where('leaveTypeCode', '==', leaveTypeCode),
      where('fiscalYear', '==', year)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const balanceDoc = snapshot.docs[0];
    if (!balanceDoc) return null;
    return toLeaveBalance(balanceDoc.id, balanceDoc.data() as Record<string, unknown>);
  } catch (error) {
    logger.error('Failed to get user leave balance by type', {
      error,
      userId,
      leaveTypeCode,
      fiscalYear: year,
    });
    throw new Error('Failed to get leave balance');
  }
}

/**
 * Initialize leave balances for a user for a fiscal year
 * Creates balance records for all active leave types
 */
export async function initializeUserLeaveBalances(
  userId: string,
  userName: string,
  userEmail: string,
  fiscalYear?: number,
  _adminUserId?: string
): Promise<void> {
  const { db } = getFirebase();
  const year = fiscalYear ?? getCurrentFiscalYear();

  try {
    // Check if balances already exist
    const existingBalances = await getUserLeaveBalances(userId, year);
    if (existingBalances.length > 0) {
      // Balances already exist - nothing to do
      return;
    }

    // Get all active leave types
    const leaveTypes = await getLeaveTypes();

    if (leaveTypes.length === 0) {
      logger.warn('No active leave types found during balance initialization', {
        userId,
        fiscalYear: year,
      });
      return;
    }

    const batch = writeBatch(db);
    const now = Timestamp.now();

    for (const leaveType of leaveTypes) {
      const balanceRef = doc(collection(db, COLLECTIONS.HR_LEAVE_BALANCES));

      const balanceData: Omit<LeaveBalance, 'id'> = {
        userId,
        userName,
        userEmail,
        leaveTypeId: leaveType.id,
        leaveTypeCode: leaveType.code,
        leaveTypeName: leaveType.name,
        fiscalYear: year,
        entitled: leaveType.annualQuota,
        used: 0,
        pending: 0,
        available: leaveType.annualQuota,
        carryForward: 0,
        createdAt: now,
        updatedAt: now,
      };

      batch.set(balanceRef, balanceData);
    }

    await batch.commit();
  } catch (error) {
    logger.error('Failed to initialize user leave balances', { error, userId, fiscalYear: year });
    throw new Error('Failed to initialize leave balances');
  }
}

/**
 * Update leave balance when a leave request status changes
 * Called internally by the leave approval workflow
 *
 * SECURITY: Uses Firestore transaction to prevent race conditions
 * when multiple leave requests are processed concurrently.
 */
export async function updateLeaveBalance(
  balanceId: string,
  updates: {
    used?: number;
    pending?: number;
  },
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.HR_LEAVE_BALANCES, balanceId);

    // Use transaction to ensure atomic read-modify-write
    await runTransaction(db, async (transaction) => {
      const balanceSnap = await transaction.get(docRef);

      if (!balanceSnap.exists()) {
        throw new Error('Leave balance not found');
      }

      const currentBalance = balanceSnap.data() as LeaveBalance;

      // Calculate new values
      const newUsed = updates.used ?? currentBalance.used;
      const newPending = updates.pending ?? currentBalance.pending;
      const newAvailable =
        currentBalance.entitled + currentBalance.carryForward - newUsed - newPending;

      // Validate available balance doesn't go negative
      if (newAvailable < 0) {
        throw new Error('Insufficient leave balance');
      }

      transaction.update(docRef, {
        used: newUsed,
        pending: newPending,
        available: newAvailable,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });
    });
  } catch (error) {
    logger.error('Failed to update leave balance', { error, balanceId, updates });
    if (error instanceof Error && error.message === 'Insufficient leave balance') {
      throw error;
    }
    throw new Error('Failed to update leave balance');
  }
}

/**
 * Add pending leave days to balance (when request is submitted)
 */
export async function addPendingLeave(
  userId: string,
  leaveTypeCode: LeaveTypeCode,
  numberOfDays: number,
  actorUserId: string,
  fiscalYear?: number
): Promise<void> {
  const balance = await getUserLeaveBalanceByType(userId, leaveTypeCode, fiscalYear);

  if (!balance) {
    throw new Error(`No leave balance found for user ${userId} and leave type ${leaveTypeCode}`);
  }

  await updateLeaveBalance(
    balance.id,
    {
      pending: balance.pending + numberOfDays,
    },
    actorUserId
  );
}

/**
 * Confirm pending leave as used (when request is approved)
 */
export async function confirmPendingLeave(
  userId: string,
  leaveTypeCode: LeaveTypeCode,
  numberOfDays: number,
  actorUserId: string,
  fiscalYear?: number
): Promise<void> {
  const balance = await getUserLeaveBalanceByType(userId, leaveTypeCode, fiscalYear);

  if (!balance) {
    throw new Error(`No leave balance found for user ${userId} and leave type ${leaveTypeCode}`);
  }

  await updateLeaveBalance(
    balance.id,
    {
      pending: Math.max(0, balance.pending - numberOfDays),
      used: balance.used + numberOfDays,
    },
    actorUserId
  );
}

/**
 * Remove pending leave days (when request is rejected or cancelled)
 */
export async function removePendingLeave(
  userId: string,
  leaveTypeCode: LeaveTypeCode,
  numberOfDays: number,
  actorUserId: string,
  fiscalYear?: number
): Promise<void> {
  const balance = await getUserLeaveBalanceByType(userId, leaveTypeCode, fiscalYear);

  if (!balance) {
    throw new Error(`No leave balance found for user ${userId} and leave type ${leaveTypeCode}`);
  }

  await updateLeaveBalance(
    balance.id,
    {
      pending: Math.max(0, balance.pending - numberOfDays),
    },
    actorUserId
  );
}

/**
 * Get all leave balances for a fiscal year (admin view)
 */
export async function getAllLeaveBalances(fiscalYear?: number): Promise<LeaveBalance[]> {
  const { db } = getFirebase();
  const year = fiscalYear ?? getCurrentFiscalYear();

  try {
    const q = query(collection(db, COLLECTIONS.HR_LEAVE_BALANCES), where('fiscalYear', '==', year));

    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnapshot) =>
      toLeaveBalance(docSnapshot.id, docSnapshot.data() as Record<string, unknown>)
    );
  } catch (error) {
    logger.error('Failed to get all leave balances', { error, fiscalYear: year });
    throw new Error('Failed to get leave balances');
  }
}

/**
 * Get team leave balances (for managers/approvers)
 */
export async function getTeamLeaveBalances(
  userIds: string[],
  fiscalYear?: number
): Promise<LeaveBalance[]> {
  const { db } = getFirebase();
  const year = fiscalYear ?? getCurrentFiscalYear();

  if (userIds.length === 0) {
    return [];
  }

  try {
    // Firestore 'in' query supports max 30 items
    const batches: LeaveBalance[] = [];
    const batchSize = 30;

    for (let i = 0; i < userIds.length; i += batchSize) {
      const batchUserIds = userIds.slice(i, i + batchSize);

      const q = query(
        collection(db, COLLECTIONS.HR_LEAVE_BALANCES),
        where('userId', 'in', batchUserIds),
        where('fiscalYear', '==', year)
      );

      const snapshot = await getDocs(q);

      snapshot.docs.forEach((docSnapshot) => {
        batches.push(toLeaveBalance(docSnapshot.id, docSnapshot.data() as Record<string, unknown>));
      });
    }

    return batches;
  } catch (error) {
    logger.error('Failed to get team leave balances', {
      error,
      userCount: userIds.length,
      fiscalYear: year,
    });
    throw new Error('Failed to get team leave balances');
  }
}

/**
 * Add comp-off balance to a user
 * Called when on-duty request is approved or holiday working override is processed
 */
export async function addCompOffBalance(
  userId: string,
  amount: number,
  metadata: {
    source: 'ON_DUTY_REQUEST' | 'HOLIDAY_WORKING';
    onDutyRequestId?: string;
    holidayWorkingId?: string;
    holidayName: string;
    holidayDate: Date;
    grantDate: Date;
    expiryDate: Date;
    grantedBy: string;
    userName?: string;
  }
): Promise<void> {
  const fiscalYear = getCurrentFiscalYear();
  const balance = await getUserLeaveBalanceByType(userId, 'COMP_OFF', fiscalYear);

  if (!balance) {
    throw new Error(
      `Comp-off balance not found for user ${userId}. Ensure COMP_OFF leave type exists and balances are initialized.`
    );
  }

  const { db } = getFirebase();
  const docRef = doc(db, COLLECTIONS.HR_LEAVE_BALANCES, balance.id);

  await runTransaction(db, async (transaction) => {
    const balanceSnap = await transaction.get(docRef);

    if (!balanceSnap.exists()) {
      throw new Error('Comp-off balance not found');
    }

    const currentBalance = balanceSnap.data() as LeaveBalance;
    const newEntitled = currentBalance.entitled + amount;
    const newAvailable =
      newEntitled + currentBalance.carryForward - currentBalance.used - currentBalance.pending;

    transaction.update(docRef, {
      entitled: newEntitled,
      available: newAvailable,
      updatedAt: Timestamp.now(),
      updatedBy: metadata.grantedBy,
    });

    // HR-8: Create individual grant record for expiry tracking
    const grantRef = doc(collection(db, COLLECTIONS.HR_COMP_OFF_GRANTS));
    transaction.set(grantRef, {
      userId,
      userName: metadata.userName || '',
      source: metadata.source,
      ...(metadata.onDutyRequestId && { onDutyRequestId: metadata.onDutyRequestId }),
      ...(metadata.holidayWorkingId && { holidayWorkingId: metadata.holidayWorkingId }),
      holidayName: metadata.holidayName,
      holidayDate: Timestamp.fromDate(metadata.holidayDate),
      grantDate: Timestamp.fromDate(metadata.grantDate),
      expiryDate: Timestamp.fromDate(metadata.expiryDate),
      grantedBy: metadata.grantedBy,
      fiscalYear,
      status: 'active',
      createdAt: Timestamp.now(),
    });

    logger.info('Comp-off balance added', {
      userId,
      amount,
      source: metadata.source,
      newEntitled,
      newAvailable,
      grantId: grantRef.id,
    });
  });
}

/**
 * Deduct comp-off balance from a user
 * This is called automatically when a comp-off leave request is approved
 * via the existing confirmPendingLeave function
 */
export async function deductCompOffBalance(
  userId: string,
  amount: number,
  actorUserId: string
): Promise<void> {
  // This is handled by confirmPendingLeave when a comp-off leave request is approved
  // This function exists for explicit deduction if needed (e.g., expiry, revocation)
  const fiscalYear = getCurrentFiscalYear();
  const balance = await getUserLeaveBalanceByType(userId, 'COMP_OFF', fiscalYear);

  if (!balance) {
    throw new Error(`Comp-off balance not found for user ${userId}`);
  }

  await updateLeaveBalance(
    balance.id,
    {
      used: balance.used + amount,
    },
    actorUserId
  );

  logger.info('Comp-off balance deducted', {
    userId,
    amount,
    actorUserId,
  });
}
