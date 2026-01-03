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
const COMP_OFF = 'COMP_OFF';

// Default quotas
const DEFAULT_SICK_LEAVE_QUOTA = 12;
const DEFAULT_CASUAL_LEAVE_QUOTA = 12;
const DEFAULT_COMP_OFF_QUOTA = 0; // Comp-off starts at 0, earned through working on holidays

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
      // Get all active users - only check isActive, status field may not be set
      const usersSnapshot = await db.collection(USERS).where('isActive', '==', true).get();

      logger.info('Found active users', { count: usersSnapshot.size });

      if (usersSnapshot.empty) {
        logger.info('No active users found. Skipping reset.');
        return;
      }

      // Get leave types with their IDs and names
      const leaveTypesSnapshot = await db
        .collection(HR_LEAVE_TYPES)
        .where('isActive', '==', true)
        .get();

      // Build leave type info map
      interface LeaveTypeInfo {
        id: string;
        name: string;
        quota: number;
      }
      const leaveTypeMap = new Map<string, LeaveTypeInfo>();
      leaveTypesSnapshot.forEach((doc) => {
        const data = doc.data();
        leaveTypeMap.set(data.code, {
          id: doc.id,
          name: data.name || data.code,
          quota: data.annualQuota || 0,
        });
      });

      // Fallback leave type info if not found
      const sickLeaveInfo = leaveTypeMap.get(SICK_LEAVE) || {
        id: 'sick',
        name: 'Sick Leave',
        quota: DEFAULT_SICK_LEAVE_QUOTA,
      };
      const casualLeaveInfo = leaveTypeMap.get(CASUAL_LEAVE) || {
        id: 'casual',
        name: 'Casual Leave',
        quota: DEFAULT_CASUAL_LEAVE_QUOTA,
      };

      logger.info('Quotas for new year', {
        sickLeaveQuota: sickLeaveInfo.quota,
        casualLeaveQuota: casualLeaveInfo.quota,
      });

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
            userEmail: userData.email || '',
            leaveTypeId: sickLeaveInfo.id,
            leaveTypeCode: SICK_LEAVE,
            leaveTypeName: sickLeaveInfo.name,
            fiscalYear: newYear,
            entitled: sickLeaveInfo.quota,
            used: 0,
            pending: 0,
            available: sickLeaveInfo.quota,
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
            userEmail: userData.email || '',
            leaveTypeId: casualLeaveInfo.id,
            leaveTypeCode: CASUAL_LEAVE,
            leaveTypeName: casualLeaveInfo.name,
            fiscalYear: newYear,
            entitled: casualLeaveInfo.quota,
            used: 0,
            pending: 0,
            available: casualLeaveInfo.quota,
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
 * Seed leave types (for initial setup)
 *
 * Creates default leave types: Sick Leave and Casual Leave
 * Can be called from the app by admin users
 */
export const seedLeaveTypes = onCall(
  {
    region: 'asia-south1',
    cors: true,
  },
  async (request) => {
    // Verify caller has admin permissions
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const permissions = request.auth.token.permissions || 0;
    const isAdmin = permissions & 1; // MANAGE_USERS permission

    if (!isAdmin) {
      throw new HttpsError('permission-denied', 'Must have admin permissions to seed leave types');
    }

    logger.info('Seeding leave types', { triggeredBy: request.auth.uid });

    const LEAVE_TYPES = [
      {
        code: 'SICK',
        name: 'Sick Leave',
        description: 'Leave for medical reasons or illness',
        annualQuota: 12,
        carryForwardAllowed: false,
        maxCarryForward: 0,
        isPaid: true,
        requiresApproval: true,
        minNoticeDays: 0,
        maxConsecutiveDays: null,
        allowHalfDay: true,
        color: '#ef4444',
        isActive: true,
      },
      {
        code: 'CASUAL',
        name: 'Casual Leave',
        description: 'Leave for personal matters or emergencies',
        annualQuota: 12,
        carryForwardAllowed: false,
        maxCarryForward: 0,
        isPaid: true,
        requiresApproval: true,
        minNoticeDays: 1,
        maxConsecutiveDays: 3,
        allowHalfDay: true,
        color: '#3b82f6',
        isActive: true,
      },
      {
        code: 'COMP_OFF',
        name: 'Compensatory Off',
        description: 'Leave earned by working on holidays or weekends',
        annualQuota: 0, // Starts at 0, earned through working on holidays
        carryForwardAllowed: false,
        maxCarryForward: 0,
        isPaid: true,
        requiresApproval: true,
        minNoticeDays: 1,
        maxConsecutiveDays: null,
        allowHalfDay: true,
        color: '#10b981', // green
        isActive: true,
      },
    ];

    try {
      const now = admin.firestore.Timestamp.now();
      let created = 0;
      let skipped = 0;

      for (const leaveType of LEAVE_TYPES) {
        // Check if leave type already exists
        const existingQuery = await db
          .collection(HR_LEAVE_TYPES)
          .where('code', '==', leaveType.code)
          .limit(1)
          .get();

        if (!existingQuery.empty) {
          logger.info('Leave type already exists, skipping', { code: leaveType.code });
          skipped++;
          continue;
        }

        // Create the leave type
        await db.collection(HR_LEAVE_TYPES).add({
          ...leaveType,
          createdAt: now,
          updatedAt: now,
          createdBy: request.auth.uid,
          updatedBy: request.auth.uid,
        });

        logger.info('Created leave type', { code: leaveType.code, name: leaveType.name });
        created++;
      }

      return {
        success: true,
        message: `Leave types seeded successfully`,
        created,
        skipped,
      };
    } catch (error) {
      logger.error('Failed to seed leave types', { error });
      throw new HttpsError('internal', 'Failed to seed leave types');
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
      // Get all active users - only check isActive, status field may not be set
      const usersSnapshot = await db.collection(USERS).where('isActive', '==', true).get();

      if (usersSnapshot.empty) {
        return { success: true, message: 'No active users found', created: 0, skipped: 0 };
      }

      // Get leave types with their IDs and names
      const leaveTypesSnapshot = await db
        .collection(HR_LEAVE_TYPES)
        .where('isActive', '==', true)
        .get();

      // Build leave type info map
      interface LeaveTypeInfo {
        id: string;
        name: string;
        quota: number;
      }
      const leaveTypeMap = new Map<string, LeaveTypeInfo>();
      leaveTypesSnapshot.forEach((doc) => {
        const data = doc.data();
        leaveTypeMap.set(data.code, {
          id: doc.id,
          name: data.name || data.code,
          quota: data.annualQuota || 0,
        });
      });

      // Fallback leave type info if not found
      const sickLeaveInfo = leaveTypeMap.get(SICK_LEAVE) || {
        id: 'sick',
        name: 'Sick Leave',
        quota: DEFAULT_SICK_LEAVE_QUOTA,
      };
      const casualLeaveInfo = leaveTypeMap.get(CASUAL_LEAVE) || {
        id: 'casual',
        name: 'Casual Leave',
        quota: DEFAULT_CASUAL_LEAVE_QUOTA,
      };
      const compOffInfo = leaveTypeMap.get(COMP_OFF) || {
        id: 'comp_off',
        name: 'Compensatory Off',
        quota: DEFAULT_COMP_OFF_QUOTA,
      };

      let created = 0;
      let skipped = 0;
      let updated = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const userData = userDoc.data();

        // Check if balance already exists
        const existingBalanceSnap = await db
          .collection(HR_LEAVE_BALANCES)
          .where('userId', '==', userId)
          .where('fiscalYear', '==', year)
          .get();

        // Check if existing balances have entitled > 0 (excluding COMP_OFF which starts at 0)
        let hasValidSickCasualBalances = false;
        let hasCompOffBalance = false;
        if (!existingBalanceSnap.empty) {
          for (const doc of existingBalanceSnap.docs) {
            const data = doc.data();
            if (data.leaveTypeCode === COMP_OFF) {
              hasCompOffBalance = true;
            } else if ((data.entitled || 0) > 0) {
              hasValidSickCasualBalances = true;
            }
          }
        }

        const now = admin.firestore.Timestamp.now();
        const batch = db.batch();

        // If user has valid SICK/CASUAL balances but no COMP_OFF, just add COMP_OFF
        if (hasValidSickCasualBalances && !hasCompOffBalance) {
          const compOffBalanceRef = db.collection(HR_LEAVE_BALANCES).doc();
          batch.set(compOffBalanceRef, {
            userId,
            userName: userData.displayName || userData.email || 'Unknown',
            userEmail: userData.email || '',
            leaveTypeId: compOffInfo.id,
            leaveTypeCode: COMP_OFF,
            leaveTypeName: compOffInfo.name,
            fiscalYear: year,
            entitled: compOffInfo.quota,
            used: 0,
            pending: 0,
            available: compOffInfo.quota,
            carryForward: 0,
            createdAt: now,
            updatedAt: now,
            createdBy: request.auth.uid,
            updatedBy: request.auth.uid,
          });
          await batch.commit();
          updated++;
          continue;
        }

        if (hasValidSickCasualBalances && hasCompOffBalance) {
          // User already has all valid balances, skip
          skipped++;
          continue;
        }

        // If existing balances have entitled=0, update them; otherwise create new
        if (!existingBalanceSnap.empty && !hasValidSickCasualBalances) {
          // Update existing SICK/CASUAL balances that have entitled=0
          for (const balDoc of existingBalanceSnap.docs) {
            const balData = balDoc.data();
            if (balData.leaveTypeCode === COMP_OFF) continue; // Skip comp-off, it's supposed to be 0

            const leaveInfo =
              balData.leaveTypeCode === SICK_LEAVE ? sickLeaveInfo : casualLeaveInfo;

            batch.update(balDoc.ref, {
              entitled: leaveInfo.quota,
              available: leaveInfo.quota - (balData.used || 0) - (balData.pending || 0),
              leaveTypeId: leaveInfo.id,
              leaveTypeName: leaveInfo.name,
              userEmail: userData.email || '',
              updatedAt: now,
              updatedBy: request.auth.uid,
            });
          }

          // Also create COMP_OFF if it doesn't exist
          if (!hasCompOffBalance) {
            const compOffBalanceRef = db.collection(HR_LEAVE_BALANCES).doc();
            batch.set(compOffBalanceRef, {
              userId,
              userName: userData.displayName || userData.email || 'Unknown',
              userEmail: userData.email || '',
              leaveTypeId: compOffInfo.id,
              leaveTypeCode: COMP_OFF,
              leaveTypeName: compOffInfo.name,
              fiscalYear: year,
              entitled: compOffInfo.quota,
              used: 0,
              pending: 0,
              available: compOffInfo.quota,
              carryForward: 0,
              createdAt: now,
              updatedAt: now,
              createdBy: request.auth.uid,
              updatedBy: request.auth.uid,
            });
          }

          await batch.commit();
          updated++;
        } else {
          // Create new balances
          // Create sick leave balance
          const sickBalanceRef = db.collection(HR_LEAVE_BALANCES).doc();
          batch.set(sickBalanceRef, {
            userId,
            userName: userData.displayName || userData.email || 'Unknown',
            userEmail: userData.email || '',
            leaveTypeId: sickLeaveInfo.id,
            leaveTypeCode: SICK_LEAVE,
            leaveTypeName: sickLeaveInfo.name,
            fiscalYear: year,
            entitled: sickLeaveInfo.quota,
            used: 0,
            pending: 0,
            available: sickLeaveInfo.quota,
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
            userEmail: userData.email || '',
            leaveTypeId: casualLeaveInfo.id,
            leaveTypeCode: CASUAL_LEAVE,
            leaveTypeName: casualLeaveInfo.name,
            fiscalYear: year,
            entitled: casualLeaveInfo.quota,
            used: 0,
            pending: 0,
            available: casualLeaveInfo.quota,
            carryForward: 0,
            createdAt: now,
            updatedAt: now,
            createdBy: request.auth.uid,
            updatedBy: request.auth.uid,
          });

          // Create comp-off balance (starts at 0, earned through working on holidays)
          const compOffBalanceRef = db.collection(HR_LEAVE_BALANCES).doc();
          batch.set(compOffBalanceRef, {
            userId,
            userName: userData.displayName || userData.email || 'Unknown',
            userEmail: userData.email || '',
            leaveTypeId: compOffInfo.id,
            leaveTypeCode: COMP_OFF,
            leaveTypeName: compOffInfo.name,
            fiscalYear: year,
            entitled: compOffInfo.quota,
            used: 0,
            pending: 0,
            available: compOffInfo.quota,
            carryForward: 0,
            createdAt: now,
            updatedAt: now,
            createdBy: request.auth.uid,
            updatedBy: request.auth.uid,
          });

          await batch.commit();
          created++;
        }
      }

      logger.info('Manual leave balance reset completed', { year, created, updated, skipped });

      return {
        success: true,
        message: `Leave balances reset for year ${year}`,
        created: created + updated,
        skipped,
      };
    } catch (error) {
      logger.error('Manual leave balance reset failed', { error });
      throw new HttpsError('internal', 'Failed to reset leave balances');
    }
  }
);
