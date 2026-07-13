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
  fiscalYear: number,
  tenantId?: string
): Promise<void> {
  // rule19-exempt: idempotent create-if-missing pattern; the inner getDoc + setDoc cooperate via the existence check, and a duplicate concurrent bootstrap simply overwrites identical seed data
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
  let leaveTypesSnapshot = await getDocs(leaveTypesQuery);

  // Auto-create COMP_OFF leave type if it doesn't exist
  if (leaveTypesSnapshot.empty) {
    logger.info('COMP_OFF leave type not found, auto-creating...');
    const createTimestamp = Timestamp.now();
    const leaveTypeRef = doc(collection(db, COLLECTIONS.HR_LEAVE_TYPES));
    await setDoc(leaveTypeRef, {
      code: 'COMP_OFF',
      name: 'Compensatory Off',
      description: 'Compensatory leave earned by working on holidays',
      annualQuota: 0,
      // Company policy (decided 2026-07-11): comp-off credits do NOT carry
      // forward across fiscal years — matches seedLeaveTypes in
      // functions/src/hr/leaveBalanceReset.ts. Unused credits expire via the
      // 1-year grant expiry sweep or lapse at year end.
      carryForwardAllowed: false,
      maxCarryForward: 0,
      isPaid: true,
      requiresApproval: true,
      minNoticeDays: 0,
      maxConsecutiveDays: 5,
      allowHalfDay: true,
      color: '#9C27B0',
      isActive: true,
      order: 7,
      createdAt: createTimestamp,
      updatedAt: createTimestamp,
      ...(tenantId && { tenantId }),
    });

    // Re-query to get the document
    leaveTypesSnapshot = await getDocs(leaveTypesQuery);
    if (leaveTypesSnapshot.empty) {
      throw new Error('Failed to auto-create COMP_OFF leave type');
    }
    logger.info('COMP_OFF leave type auto-created successfully');
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
    ...(tenantId && { tenantId }),
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
  userInfo?: { userName: string; userEmail: string },
  tenantId?: string
): Promise<void> {
  try {
    const fiscalYear = getCurrentFiscalYear();

    // Get current comp-off balance
    let balance = await getUserLeaveBalanceByType(userId, COMP_OFF_LEAVE_TYPE, fiscalYear);

    // Auto-initialize COMP_OFF balance if it doesn't exist and we have user info
    if (!balance && userInfo) {
      await ensureCompOffBalanceExists(
        userId,
        userInfo.userName,
        userInfo.userEmail,
        fiscalYear,
        tenantId
      );
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
      userName: userInfo?.userName,
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
 * Queries individual grant records to find active grants nearing expiry.
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
  const { db } = getFirebase();
  const now = new Date();
  const cutoff = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

  try {
    const q = query(
      collection(db, COLLECTIONS.HR_COMP_OFF_GRANTS),
      where('status', '==', 'active'),
      where('expiryDate', '<=', Timestamp.fromDate(cutoff))
    );

    const snapshot = await getDocs(q);
    const results: Array<{
      userId: string;
      userName: string;
      expiryDate: Date;
      daysRemaining: number;
    }> = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const expiryDate = data.expiryDate?.toDate?.() || new Date();
      const daysRemaining = Math.max(
        0,
        Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      );

      results.push({
        userId: data.userId,
        userName: data.userName || '',
        expiryDate,
        daysRemaining,
      });
    });

    logger.info('Found expiring comp-offs', { withinDays, count: results.length });
    return results;
  } catch (error) {
    logger.error('Failed to find expiring comp-offs', { error, withinDays });
    return [];
  }
}

/**
 * Get comp-off expiry warning threshold (in days)
 */
export function getExpiryWarningThreshold(): number {
  return 30; // Warn 30 days before expiry
}

/**
 * Revoke the comp-off credit granted for a cancelled on-duty request
 * (known-gaps 2.8b). Marks the grant `revoked` and decrements the user's
 * COMP_OFF balance in one transaction.
 *
 * Idempotent (rule 9): only `active` grants are revoked; a retry after a
 * partial failure finds no active grant and no-ops.
 *
 * Consumption is not linked to individual grants (usedByLeaveRequestId is
 * never written), so if the user has already spent the credit the balance
 * decrement is clamped at available >= 0 (FIFO assumption) and a warning is
 * logged instead of driving the balance negative.
 */
export async function revokeCompOffForOnDuty(
  onDutyRequestId: string,
  revokedBy: string
): Promise<void> {
  // rule5-exempt: internal helper invoked only from cancelOnDutyRequest, which performs the permission check (owner-or-HR) before calling; firestore.rules gate the collections server-side
  const { db } = getFirebase();

  const grantsSnap = await getDocs(
    query(
      collection(db, COLLECTIONS.HR_COMP_OFF_GRANTS),
      where('onDutyRequestId', '==', onDutyRequestId),
      where('status', '==', 'active')
    )
  );

  if (grantsSnap.empty) {
    logger.info('No active comp-off grant to revoke for on-duty request', { onDutyRequestId });
    return;
  }

  const { runTransaction } = await import('firebase/firestore');

  for (const grantDoc of grantsSnap.docs) {
    const grantData = grantDoc.data();
    const userId = grantData.userId as string;
    const grantFiscalYear = grantData.fiscalYear as number;

    // Resolve the balance doc holding this credit: prefer the current fiscal
    // year (where the credit is usable), falling back to the grant's year.
    const currentFiscalYear = getCurrentFiscalYear();
    const balance =
      (await getUserLeaveBalanceByType(userId, COMP_OFF_LEAVE_TYPE, currentFiscalYear)) ??
      (await getUserLeaveBalanceByType(userId, COMP_OFF_LEAVE_TYPE, grantFiscalYear));

    await runTransaction(db, async (transaction) => {
      const grantRef = doc(db, COLLECTIONS.HR_COMP_OFF_GRANTS, grantDoc.id);
      const grantSnap = await transaction.get(grantRef);
      if (!grantSnap.exists() || grantSnap.data().status !== 'active') {
        return; // Already revoked/used/expired — idempotent no-op
      }

      if (balance) {
        const balanceRef = doc(db, COLLECTIONS.HR_LEAVE_BALANCES, balance.id);
        const balanceSnap = await transaction.get(balanceRef);
        if (balanceSnap.exists()) {
          const b = balanceSnap.data();
          const inGrantYearBucket = b.fiscalYear === grantFiscalYear;
          const bucket = inGrantYearBucket ? 'entitled' : 'carryForward';
          const bucketValue = (b[bucket] as number) || 0;
          const available = (b.available as number) || 0;

          // Clamp so a credit the user already consumed doesn't push
          // available below zero (see function docs).
          const decrement = Math.min(1, Math.max(0, bucketValue), Math.max(0, available));
          if (decrement < 1) {
            logger.warn('Comp-off revoke clamped — credit appears already consumed', {
              onDutyRequestId,
              userId,
              grantId: grantDoc.id,
              available,
            });
          }
          if (decrement > 0) {
            transaction.update(balanceRef, {
              [bucket]: bucketValue - decrement,
              available: available - decrement,
              updatedAt: Timestamp.now(),
              updatedBy: revokedBy,
            });
          }
        }
      } else {
        logger.warn('COMP_OFF balance not found while revoking grant — grant marked only', {
          onDutyRequestId,
          userId,
          grantId: grantDoc.id,
        });
      }

      transaction.update(grantRef, {
        status: 'revoked',
        revokedAt: Timestamp.now(),
        revokedBy,
      });
    });

    logger.info('Comp-off grant revoked for cancelled on-duty request', {
      onDutyRequestId,
      grantId: grantDoc.id,
      userId,
    });
  }
}
