/**
 * Leave Balance Reset Cloud Function
 *
 * Scheduled function to reset leave balances on January 1st each year.
 * Runs at 00:00 IST (18:30 UTC previous day) on January 1st.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// Collection names
const USERS = 'users';
const HR_LEAVE_BALANCES = 'hrLeaveBalances';
const HR_LEAVE_TYPES = 'hrLeaveTypes';

// Leave type codes
const SICK_LEAVE = 'SICK';
const CASUAL_LEAVE = 'CASUAL';

// Default quotas
const DEFAULT_SICK_LEAVE_QUOTA = 12;
const DEFAULT_CASUAL_LEAVE_QUOTA = 12;

/**
 * Scheduled function to reset leave balances on January 1st
 *
 * Schedule: 00:00 IST on January 1st (18:30 UTC on December 31st)
 * Timezone: Asia/Kolkata (IST)
 */
export const resetLeaveBalances = onSchedule(
  {
    schedule: '30 18 31 12 *', // 18:30 UTC on Dec 31 = 00:00 IST on Jan 1
    timeZone: 'Asia/Kolkata',
    region: 'asia-south1',
  },
  async () => {
    const newYear = new Date().getFullYear() + 1; // Since this runs on Dec 31
    logger.info('Starting leave balance reset for year', { year: newYear });

    try {
      // Get all active users
      const usersSnapshot = await db
        .collection(USERS)
        .where('isActive', '==', true)
        .where('status', '==', 'active')
        .get();

      logger.info('Found active users', { count: usersSnapshot.size });

      if (usersSnapshot.empty) {
        logger.info('No active users found. Skipping reset.');
        return;
      }

      // Get leave types to fetch quotas
      const leaveTypesSnapshot = await db
        .collection(HR_LEAVE_TYPES)
        .where('isActive', '==', true)
        .get();

      // Build quota map
      const quotaMap = new Map<string, number>();
      leaveTypesSnapshot.forEach((doc) => {
        const data = doc.data();
        quotaMap.set(data.code, data.annualQuota || 0);
      });

      // Default quotas if not found in leave types
      const sickLeaveQuota = quotaMap.get(SICK_LEAVE) || DEFAULT_SICK_LEAVE_QUOTA;
      const casualLeaveQuota = quotaMap.get(CASUAL_LEAVE) || DEFAULT_CASUAL_LEAVE_QUOTA;

      logger.info('Quotas for new year', { sickLeaveQuota, casualLeaveQuota });

      // Batch write for efficiency
      const batches: admin.firestore.WriteBatch[] = [];
      let currentBatch = db.batch();
      let operationCount = 0;
      const MAX_BATCH_SIZE = 500;

      let successCount = 0;
      let errorCount = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();

        try {
          // Check if balance already exists for new year
          const existingBalance = await db
            .collection(HR_LEAVE_BALANCES)
            .where('userId', '==', userId)
            .where('fiscalYear', '==', newYear)
            .limit(1)
            .get();

          if (!existingBalance.empty) {
            logger.debug('Balance already exists for user', { userId, year: newYear });
            continue;
          }

          const now = admin.firestore.Timestamp.now();

          // Create sick leave balance
          const sickBalanceRef = db.collection(HR_LEAVE_BALANCES).doc();
          currentBatch.set(sickBalanceRef, {
            userId,
            userName: userData.displayName || userData.email || 'Unknown',
            leaveTypeCode: SICK_LEAVE,
            fiscalYear: newYear,
            allocated: sickLeaveQuota,
            used: 0,
            pending: 0,
            available: sickLeaveQuota,
            carryForward: 0, // No carry forward for now
            createdAt: now,
            updatedAt: now,
            createdBy: 'system',
            updatedBy: 'system',
          });
          operationCount++;

          // Create casual leave balance
          const casualBalanceRef = db.collection(HR_LEAVE_BALANCES).doc();
          currentBatch.set(casualBalanceRef, {
            userId,
            userName: userData.displayName || userData.email || 'Unknown',
            leaveTypeCode: CASUAL_LEAVE,
            fiscalYear: newYear,
            allocated: casualLeaveQuota,
            used: 0,
            pending: 0,
            available: casualLeaveQuota,
            carryForward: 0,
            createdAt: now,
            updatedAt: now,
            createdBy: 'system',
            updatedBy: 'system',
          });
          operationCount++;

          successCount++;

          // Check if batch is full
          if (operationCount >= MAX_BATCH_SIZE) {
            batches.push(currentBatch);
            currentBatch = db.batch();
            operationCount = 0;
          }
        } catch (userError) {
          logger.error('Error creating balance for user', { userId, error: userError });
          errorCount++;
        }
      }

      // Add last batch if it has operations
      if (operationCount > 0) {
        batches.push(currentBatch);
      }

      // Commit all batches
      logger.info('Committing batches', { batchCount: batches.length });
      for (const batch of batches) {
        await batch.commit();
      }

      logger.info('Leave balance reset completed', {
        year: newYear,
        usersProcessed: successCount,
        errors: errorCount,
        totalBatches: batches.length,
      });
    } catch (error) {
      logger.error('Failed to reset leave balances', { error });
      throw error;
    }
  }
);

/**
 * Manual trigger for leave balance reset (for testing or manual execution)
 *
 * Can be called with: firebase functions:shell
 * manualResetLeaveBalances({year: 2026})
 */
export const manualResetLeaveBalances = onCall(
  {
    region: 'asia-south1',
    cors: true,
  },
  async (request) => {
    // Verify caller has admin permissions
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    // Get user's permissions from custom claims
    const permissions = request.auth.token.permissions || 0;
    const isAdmin = permissions & 1; // MANAGE_USERS permission

    if (!isAdmin) {
      throw new HttpsError(
        'permission-denied',
        'Must have admin permissions to reset leave balances'
      );
    }

    const year = request.data?.year || new Date().getFullYear();
    logger.info('Manual leave balance reset triggered', { year, triggeredBy: request.auth.uid });

    try {
      // Get all active users
      const usersSnapshot = await db
        .collection(USERS)
        .where('isActive', '==', true)
        .where('status', '==', 'active')
        .get();

      if (usersSnapshot.empty) {
        return { success: true, message: 'No active users found', created: 0 };
      }

      // Get leave types
      const leaveTypesSnapshot = await db
        .collection(HR_LEAVE_TYPES)
        .where('isActive', '==', true)
        .get();

      const quotaMap = new Map<string, number>();
      leaveTypesSnapshot.forEach((doc) => {
        const data = doc.data();
        quotaMap.set(data.code, data.annualQuota || 0);
      });

      const sickLeaveQuota = quotaMap.get(SICK_LEAVE) || DEFAULT_SICK_LEAVE_QUOTA;
      const casualLeaveQuota = quotaMap.get(CASUAL_LEAVE) || DEFAULT_CASUAL_LEAVE_QUOTA;

      let created = 0;
      let skipped = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();

        // Check if balance already exists
        const existingBalance = await db
          .collection(HR_LEAVE_BALANCES)
          .where('userId', '==', userId)
          .where('fiscalYear', '==', year)
          .limit(1)
          .get();

        if (!existingBalance.empty) {
          skipped++;
          continue;
        }

        const now = admin.firestore.Timestamp.now();
        const batch = db.batch();

        // Create sick leave balance
        const sickBalanceRef = db.collection(HR_LEAVE_BALANCES).doc();
        batch.set(sickBalanceRef, {
          userId,
          userName: userData.displayName || userData.email || 'Unknown',
          leaveTypeCode: SICK_LEAVE,
          fiscalYear: year,
          allocated: sickLeaveQuota,
          used: 0,
          pending: 0,
          available: sickLeaveQuota,
          carryForward: 0,
          createdAt: now,
          updatedAt: now,
          createdBy: request.auth.uid,
          updatedBy: request.auth.uid,
        });

        // Create casual leave balance
        const casualBalanceRef = db.collection(HR_LEAVE_BALANCES).doc();
        batch.set(casualBalanceRef, {
          userId,
          userName: userData.displayName || userData.email || 'Unknown',
          leaveTypeCode: CASUAL_LEAVE,
          fiscalYear: year,
          allocated: casualLeaveQuota,
          used: 0,
          pending: 0,
          available: casualLeaveQuota,
          carryForward: 0,
          createdAt: now,
          updatedAt: now,
          createdBy: request.auth.uid,
          updatedBy: request.auth.uid,
        });

        await batch.commit();
        created++;
      }

      logger.info('Manual leave balance reset completed', { year, created, skipped });

      return {
        success: true,
        message: `Leave balances reset for year ${year}`,
        created,
        skipped,
      };
    } catch (error) {
      logger.error('Manual leave balance reset failed', { error });
      throw new HttpsError('internal', 'Failed to reset leave balances');
    }
  }
);
