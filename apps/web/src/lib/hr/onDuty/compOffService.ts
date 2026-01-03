/**
 * Compensatory Off (Comp-Off) Service
 *
 * Manages comp-off balance granting, tracking, and usage.
 * Comp-offs are earned by working on holidays and can be redeemed as leave.
 */

import { collection, doc, getDocs, setDoc, query, where, Timestamp } from 'firebase/firestore';
import { createLogger } from '@vapour/logger';
import type { LeaveTypeCode } from '@vapour/types';
import { getUserLeaveBalanceByType, getCurrentFiscalYear } from '../leaves/leaveBalanceService';
import { addYears } from 'date-fns';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';

const logger = createLogger({ context: 'compOffService' });

const COMP_OFF_LEAVE_TYPE: LeaveTypeCode = 'COMP_OFF';

/**
 * Source of comp-off grant
 */
export interface CompOffSource {
  source: 'ON_DUTY_REQUEST' | 'HOLIDAY_WORKING';
  onDutyRequestId?: string;
  holidayWorkingId?: string;
  holidayName: string;
  holidayDate: Date;
}

/**
 * Auto-initialize COMP_OFF balance for a user if it doesn't exist
 * This is needed when a new fiscal year starts and balances haven't been reset yet
 */
async function ensureCompOffBalanceExists(
  userId: string,
  userName: string,
  userEmail: string,
  fiscalYear: number
): Promise<void> {
  const { db } = getFirebase();

  // Check if balance already exists
  const existingBalance = await getUserLeaveBalanceByType(userId, COMP_OFF_LEAVE_TYPE, fiscalYear);
  if (existingBalance) {
    return; // Balance already exists
  }

  // Get COMP_OFF leave type info
  const leaveTypesQuery = query(
    collection(db, COLLECTIONS.HR_LEAVE_TYPES),
    where('code', '==', 'COMP_OFF'),
    where('isActive', '==', true)
  );
  const leaveTypesSnapshot = await getDocs(leaveTypesQuery);

  if (leaveTypesSnapshot.empty) {
    throw new Error('COMP_OFF leave type not found. Please ensure leave types are seeded.');
  }

  const leaveTypeDoc = leaveTypesSnapshot.docs[0];
  if (!leaveTypeDoc) {
    throw new Error('COMP_OFF leave type not found.');
  }

  const leaveType = leaveTypeDoc.data();
  const now = Timestamp.now();

  // Create the balance record
  const balanceRef = doc(collection(db, COLLECTIONS.HR_LEAVE_BALANCES));
  await setDoc(balanceRef, {
    userId,
    userName,
    userEmail,
    leaveTypeId: leaveTypeDoc.id,
    leaveTypeCode: 'COMP_OFF',
    leaveTypeName: leaveType.name || 'Compensatory Off',
    fiscalYear,
    entitled: 0, // Comp-off starts at 0, earned through working holidays
    used: 0,
    pending: 0,
    available: 0,
    carryForward: 0,
    createdAt: now,
    updatedAt: now,
  });

  logger.info('Auto-initialized COMP_OFF balance', { userId, fiscalYear });
}

/**
 * Grant comp-off to a user
 * Adds 1 day to the user's comp-off balance
 *
 * @param userId - User to grant comp-off to
 * @param source - Source of the comp-off (on-duty request or holiday working)
 * @param grantedBy - User ID of admin/approver granting the comp-off
 * @param userInfo - Optional user info for auto-initialization
 */
export async function grantCompOff(
  userId: string,
  source: CompOffSource,
  grantedBy: string,
  userInfo?: { userName: string; userEmail: string }
): Promise<void> {
  try {
    const fiscalYear = getCurrentFiscalYear();

    // Get current comp-off balance
    let balance = await getUserLeaveBalanceByType(userId, COMP_OFF_LEAVE_TYPE, fiscalYear);

    // Auto-initialize COMP_OFF balance if it doesn't exist and we have user info
    if (!balance && userInfo) {
      await ensureCompOffBalanceExists(userId, userInfo.userName, userInfo.userEmail, fiscalYear);
      balance = await getUserLeaveBalanceByType(userId, COMP_OFF_LEAVE_TYPE, fiscalYear);
    }

    if (!balance) {
      throw new Error(
        `Comp-off balance not found for user ${userId}. Ensure COMP_OFF leave type exists and balances are initialized for fiscal year ${fiscalYear}.`
      );
    }

    // Check maximum balance limit (soft: 10, hard: 20)
    if (balance.available >= 20) {
      throw new Error(
        'Maximum comp-off balance (20 days) reached. Please use existing comp-offs before earning more.'
      );
    }

    if (balance.available >= 10) {
      logger.warn('High comp-off balance', {
        userId,
        balance: balance.available,
        message: 'User has high comp-off balance (>= 10 days)',
      });
    }

    // Calculate expiry date (365 days from now)
    const grantDate = new Date();
    const expiryDate = addYears(grantDate, 1);

    // For now, simply increment the balance
    // In the future, we'll track individual grants with expiry dates in metadata
    // For MVP, we'll use the leaveBalanceService to add the comp-off

    // Import dynamically to avoid circular dependency
    const { addCompOffBalance } = await import('../leaves/leaveBalanceService');

    await addCompOffBalance(userId, 1, {
      source: source.source,
      onDutyRequestId: source.onDutyRequestId,
      holidayWorkingId: source.holidayWorkingId,
      holidayName: source.holidayName,
      holidayDate: source.holidayDate,
      grantDate,
      expiryDate,
      grantedBy,
    });

    logger.info('Comp-off granted successfully', {
      userId,
      source: source.source,
      fiscalYear,
      expiryDate: expiryDate.toISOString(),
    });
  } catch (error) {
    logger.error('Failed to grant comp-off', { error, userId, source });
    throw error;
  }
}

/**
 * Get user's comp-off balance for a fiscal year
 */
export async function getCompOffBalance(
  userId: string,
  fiscalYear?: number
): Promise<{
  entitled: number;
  used: number;
  pending: number;
  available: number;
} | null> {
  try {
    const year = fiscalYear ?? getCurrentFiscalYear();
    const balance = await getUserLeaveBalanceByType(userId, COMP_OFF_LEAVE_TYPE, year);

    if (!balance) {
      logger.warn('Comp-off balance not found', { userId, fiscalYear: year });
      return null;
    }

    return {
      entitled: balance.entitled,
      used: balance.used,
      pending: balance.pending,
      available: balance.available,
    };
  } catch (error) {
    logger.error('Failed to get comp-off balance', { error, userId, fiscalYear });
    throw new Error('Failed to get comp-off balance');
  }
}

/**
 * Mark comp-off as used (called when comp-off leave is approved)
 * This is handled automatically by the leave balance service
 * when a leave request with type COMP_OFF is approved
 *
 * @param userId - User whose comp-off is being used
 * @param leaveRequestId - Leave request ID that used the comp-off
 */
export async function useCompOff(userId: string, leaveRequestId: string): Promise<void> {
  try {
    // The leave balance service automatically handles deduction when leave is approved
    // This function exists for explicit tracking/logging if needed

    logger.info('Comp-off used', {
      userId,
      leaveRequestId,
      message: 'Comp-off deducted via leave approval',
    });
  } catch (error) {
    logger.error('Failed to mark comp-off as used', { error, userId, leaveRequestId });
    throw error;
  }
}

/**
 * Find comp-offs expiring within specified days
 * This is a placeholder for future implementation of expiry tracking
 *
 * @param withinDays - Number of days to look ahead for expiring comp-offs
 */
export async function findExpiringCompOffs(withinDays: number): Promise<
  Array<{
    userId: string;
    userName: string;
    expiryDate: Date;
    daysRemaining: number;
  }>
> {
  // Placeholder - in future, this will query balance metadata to find expiring grants
  // For MVP, we'll handle expiry manually or via a scheduled Cloud Function

  logger.info('Finding expiring comp-offs', { withinDays });

  // TODO: Implement when metadata tracking is added to leaveBalances
  return [];
}

/**
 * Get comp-off expiry warning threshold (in days)
 */
export function getExpiryWarningThreshold(): number {
  return 30; // Warn 30 days before expiry
}
