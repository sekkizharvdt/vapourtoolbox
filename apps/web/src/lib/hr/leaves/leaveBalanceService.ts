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
  updateDoc,
  query,
  where,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { LeaveBalance, LeaveTypeCode } from '@vapour/types';
import { getLeaveTypes } from './leaveTypeService';

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

    return snapshot.docs.map((docSnapshot) => {
      const data: LeaveBalance = {
        id: docSnapshot.id,
        ...(docSnapshot.data() as Omit<LeaveBalance, 'id'>),
      };
      return data;
    });
  } catch (error) {
    console.error('[getUserLeaveBalances] Error:', error);
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

    const data: LeaveBalance = {
      id: docSnap.id,
      ...(docSnap.data() as Omit<LeaveBalance, 'id'>),
    };
    return data;
  } catch (error) {
    console.error('[getLeaveBalanceById] Error:', error);
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
    const data: LeaveBalance = {
      id: balanceDoc.id,
      ...(balanceDoc.data() as Omit<LeaveBalance, 'id'>),
    };
    return data;
  } catch (error) {
    console.error('[getUserLeaveBalanceByType] Error:', error);
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
      console.warn('[initializeUserLeaveBalances] No active leave types found');
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
    console.error('[initializeUserLeaveBalances] Error:', error);
    throw new Error('Failed to initialize leave balances');
  }
}

/**
 * Update leave balance when a leave request status changes
 * Called internally by the leave approval workflow
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
    const balanceSnap = await getDoc(docRef);

    if (!balanceSnap.exists()) {
      throw new Error('Leave balance not found');
    }

    const currentBalance = balanceSnap.data() as LeaveBalance;

    // Calculate new values
    const newUsed = updates.used ?? currentBalance.used;
    const newPending = updates.pending ?? currentBalance.pending;
    const newAvailable =
      currentBalance.entitled + currentBalance.carryForward - newUsed - newPending;

    await updateDoc(docRef, {
      used: newUsed,
      pending: newPending,
      available: newAvailable,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  } catch (error) {
    console.error('[updateLeaveBalance] Error:', error);
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

      snapshot.docs.forEach((doc) => {
        batches.push({
          id: doc.id,
          ...doc.data(),
        } as LeaveBalance);
      });
    }

    return batches;
  } catch (error) {
    console.error('[getTeamLeaveBalances] Error:', error);
    throw new Error('Failed to get team leave balances');
  }
}
