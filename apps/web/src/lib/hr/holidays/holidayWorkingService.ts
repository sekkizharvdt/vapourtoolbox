/**
 * Holiday Working Override Service
 *
 * Admin bulk action to convert holidays to working days.
 * Automatically grants compensatory leave to all or specific users.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type {
  HolidayWorkingOverride,
  HolidayWorkingOverrideFilters,
  CreateHolidayWorkingInput,
  HolidayWorkingUserResult,
  HolidayWorkingStatus,
} from '@vapour/types';
import { grantCompOff } from '../onDuty/compOffService';
import { getHolidayById } from './holidayService';
import type { User } from '@vapour/types';

const logger = createLogger({ context: 'holidayWorkingService' });

/**
 * Create holiday working override
 * Converts a holiday to a working day and grants comp-off to affected users
 * Supports both declared holidays (from hrHolidays) and ad-hoc dates (Saturdays/Sundays)
 */
export async function createHolidayWorkingOverride(
  input: CreateHolidayWorkingInput,
  adminUserId: string,
  adminUserName: string,
  adminUserEmail: string
): Promise<{ overrideId: string }> {
  const { db } = getFirebase();

  try {
    let holidayName = input.holidayName;
    let holidayDate = Timestamp.fromDate(input.holidayDate);

    // If holidayId is provided, validate it exists (for declared holidays)
    if (input.holidayId && !input.isAdHoc) {
      const holiday = await getHolidayById(input.holidayId);
      if (!holiday) {
        throw new Error('Holiday not found');
      }
      holidayName = holiday.name;
      holidayDate = holiday.date;
    }

    // Validate holidayName is provided
    if (!holidayName) {
      throw new Error('Holiday name is required');
    }

    // Validate scope and affected users
    if (input.scope === 'SPECIFIC_USERS' && input.affectedUserIds.length === 0) {
      throw new Error('At least one user must be selected for SPECIFIC_USERS scope');
    }

    // Create override document
    const overrideRef = doc(collection(db, COLLECTIONS.HR_HOLIDAY_WORKING_OVERRIDES));

    const override: Omit<HolidayWorkingOverride, 'id'> = {
      ...(input.holidayId && { holidayId: input.holidayId }),
      holidayName,
      holidayDate,
      isAdHoc: input.isAdHoc || false,
      scope: input.scope,
      affectedUserIds: input.scope === 'SPECIFIC_USERS' ? input.affectedUserIds : [],
      compOffGrantedCount: 0,
      processedUserIds: [],
      failedUserIds: [],
      createdBy: adminUserId,
      createdByName: adminUserName,
      createdByEmail: adminUserEmail,
      reason: input.reason,
      status: 'PROCESSING',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(overrideRef, override);

    logger.info('Holiday working override created', {
      overrideId: overrideRef.id,
      holidayId: input.holidayId,
      holidayName,
      isAdHoc: input.isAdHoc,
      scope: input.scope,
      adminUserId,
    });

    // Process asynchronously
    processHolidayWorkingOverride(overrideRef.id).catch((error) => {
      logger.error('Failed to process holiday working override in background', {
        error,
        overrideId: overrideRef.id,
      });
    });

    return {
      overrideId: overrideRef.id,
    };
  } catch (error) {
    logger.error('Failed to create holiday working override', { error, input, adminUserId });
    throw error;
  }
}

/**
 * Process holiday working override
 * Grants comp-off to all affected users
 */
export async function processHolidayWorkingOverride(overrideId: string): Promise<void> {
  const { db } = getFirebase();

  try {
    // Get override document
    const overrideRef = doc(db, COLLECTIONS.HR_HOLIDAY_WORKING_OVERRIDES, overrideId);
    const overrideSnap = await getDoc(overrideRef);

    if (!overrideSnap.exists()) {
      throw new Error('Holiday working override not found');
    }

    const override = {
      id: overrideSnap.id,
      ...(overrideSnap.data() as Omit<HolidayWorkingOverride, 'id'>),
    };

    // Get list of users to grant comp-off
    let targetUsers: Array<{ userId: string; userName: string; userEmail: string }> = [];

    if (override.scope === 'ALL_USERS') {
      // Get all active users from the users collection
      const usersQuery = query(collection(db, COLLECTIONS.USERS), where('isActive', '==', true));
      const usersSnapshot = await getDocs(usersQuery);

      targetUsers = usersSnapshot.docs.map((docSnapshot) => {
        const user = docSnapshot.data() as User;
        return {
          userId: docSnapshot.id,
          userName: user.displayName || 'Unknown User',
          userEmail: user.email || '',
        };
      });
    } else {
      // Get specific users
      const userPromises = override.affectedUserIds.map((userId) =>
        getDoc(doc(db, COLLECTIONS.USERS, userId))
      );
      const userSnapshots = await Promise.all(userPromises);

      targetUsers = userSnapshots
        .filter((snap) => snap.exists())
        .map((snap) => {
          const user = snap.data() as User;
          return {
            userId: snap.id,
            userName: user.displayName || 'Unknown User',
            userEmail: user.email || '',
          };
        })
        .filter((user) => {
          // Only include active users
          const userDoc = userSnapshots.find((s) => s.id === user.userId);
          if (userDoc?.exists()) {
            const userData = userDoc.data() as User;
            return userData.isActive;
          }
          return false;
        });
    }

    // Process each user
    const results: HolidayWorkingUserResult[] = [];

    for (const user of targetUsers) {
      try {
        // Grant comp-off to the user
        await grantCompOff(
          user.userId,
          {
            source: 'HOLIDAY_WORKING',
            holidayWorkingId: overrideId,
            holidayName: override.holidayName,
            holidayDate: override.holidayDate.toDate(),
          },
          override.createdBy
        );

        results.push({
          userId: user.userId,
          userName: user.userName,
          userEmail: user.userEmail,
          success: true,
        });

        logger.info('Comp-off granted for holiday working', {
          overrideId,
          userId: user.userId,
          holidayName: override.holidayName,
        });
      } catch (error) {
        results.push({
          userId: user.userId,
          userName: user.userName,
          userEmail: user.userEmail,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        logger.error('Failed to grant comp-off for holiday working', {
          error,
          overrideId,
          userId: user.userId,
        });
      }
    }

    // Update override document with results
    const successfulResults = results.filter((r) => r.success);
    const failedResults = results.filter((r) => !r.success);

    await updateDoc(overrideRef, {
      status: failedResults.length > 0 && successfulResults.length === 0 ? 'FAILED' : 'COMPLETED',
      compOffGrantedCount: successfulResults.length,
      processedUserIds: successfulResults.map((r) => r.userId),
      failedUserIds: failedResults.map((r) => r.userId),
      processedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      errorMessage:
        failedResults.length > 0
          ? `Failed to grant comp-off to ${failedResults.length} user(s). Check logs for details.`
          : undefined,
    });

    logger.info('Holiday working override processed', {
      overrideId,
      totalUsers: results.length,
      successful: successfulResults.length,
      failed: failedResults.length,
    });
  } catch (error) {
    logger.error('Failed to process holiday working override', { error, overrideId });

    // Update status to FAILED
    const overrideRef = doc(db, COLLECTIONS.HR_HOLIDAY_WORKING_OVERRIDES, overrideId);
    await updateDoc(overrideRef, {
      status: 'FAILED',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      processedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });

    throw error;
  }
}

/**
 * Get holiday working override by ID
 */
export async function getHolidayWorkingOverrideById(
  overrideId: string
): Promise<HolidayWorkingOverride | null> {
  const { db } = getFirebase();

  try {
    const overrideRef = doc(db, COLLECTIONS.HR_HOLIDAY_WORKING_OVERRIDES, overrideId);
    const overrideSnap = await getDoc(overrideRef);

    if (!overrideSnap.exists()) {
      return null;
    }

    return {
      id: overrideSnap.id,
      ...(overrideSnap.data() as Omit<HolidayWorkingOverride, 'id'>),
    };
  } catch (error) {
    logger.error('Failed to get holiday working override', { error, overrideId });
    throw new Error('Failed to get holiday working override');
  }
}

/**
 * List holiday working overrides with filters
 */
export async function listHolidayWorkingOverrides(
  filters: HolidayWorkingOverrideFilters = {}
): Promise<HolidayWorkingOverride[]> {
  const { db } = getFirebase();

  try {
    const constraints: QueryConstraint[] = [];

    if (filters.holidayId) {
      constraints.push(where('holidayId', '==', filters.holidayId));
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        constraints.push(where('status', 'in', filters.status));
      } else {
        constraints.push(where('status', '==', filters.status));
      }
    }

    if (filters.createdBy) {
      constraints.push(where('createdBy', '==', filters.createdBy));
    }

    if (filters.dateFrom && filters.dateTo) {
      const fromTimestamp = Timestamp.fromDate(filters.dateFrom);
      const toTimestamp = Timestamp.fromDate(filters.dateTo);
      constraints.push(where('holidayDate', '>=', fromTimestamp));
      constraints.push(where('holidayDate', '<=', toTimestamp));
    }

    // Order by creation date (most recent first)
    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collection(db, COLLECTIONS.HR_HOLIDAY_WORKING_OVERRIDES), ...constraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...(docSnapshot.data() as Omit<HolidayWorkingOverride, 'id'>),
    }));
  } catch (error) {
    logger.error('Failed to list holiday working overrides', { error, filters });
    throw new Error('Failed to list holiday working overrides');
  }
}

/**
 * Get holiday working overrides for a year
 */
export async function getHolidayWorkingOverrides(filters: {
  year?: number;
  status?: HolidayWorkingStatus | HolidayWorkingStatus[];
}): Promise<HolidayWorkingOverride[]> {
  const { db } = getFirebase();

  try {
    const constraints: QueryConstraint[] = [];

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        constraints.push(where('status', 'in', filters.status));
      } else {
        constraints.push(where('status', '==', filters.status));
      }
    }

    // Order by createdAt instead of holidayDate to use existing index
    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collection(db, COLLECTIONS.HR_HOLIDAY_WORKING_OVERRIDES), ...constraints);
    const snapshot = await getDocs(q);

    let results = snapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...(docSnapshot.data() as Omit<HolidayWorkingOverride, 'id'>),
    }));

    // Filter by year in memory (more efficient than complex Firestore query)
    if (filters.year) {
      const startOfYear = new Date(filters.year, 0, 1).getTime();
      const endOfYear = new Date(filters.year, 11, 31, 23, 59, 59).getTime();
      results = results.filter((override) => {
        const holidayTime = override.holidayDate.toDate().getTime();
        return holidayTime >= startOfYear && holidayTime <= endOfYear;
      });
    }

    return results;
  } catch (error) {
    logger.error('Failed to get holiday working overrides', { error, filters });
    throw new Error('Failed to get holiday working overrides');
  }
}

/**
 * Get holiday working history for a specific holiday
 */
export async function getHolidayWorkingHistory(
  holidayId: string
): Promise<HolidayWorkingOverride[]> {
  return listHolidayWorkingOverrides({ holidayId });
}

/**
 * Check if a holiday has been converted to working day
 */
export async function isHolidayConvertedToWorkingDay(holidayId: string): Promise<boolean> {
  const overrides = await listHolidayWorkingOverrides({
    holidayId,
    status: ['COMPLETED', 'PROCESSING'],
  });

  return overrides.length > 0;
}
