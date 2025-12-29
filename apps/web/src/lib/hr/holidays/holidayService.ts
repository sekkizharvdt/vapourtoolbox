/**
 * Holiday Service
 *
 * CRUD operations for company holidays stored in Firestore.
 * Combines company-defined holidays with recurring holidays.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { Holiday, HolidayType, RecurringHolidayConfig } from '@vapour/types';
import {
  isRecurringHoliday,
  getRecurringHolidaysInRange,
  getRecurringHolidayLabel,
  DEFAULT_RECURRING_CONFIG,
} from './recurringHolidayCalculator';

const logger = createLogger({ context: 'holidayService' });

/**
 * Input for creating a holiday
 */
export interface CreateHolidayInput {
  name: string;
  date: Date;
  type: HolidayType;
  description?: string;
  color?: string;
}

/**
 * Input for updating a holiday
 */
export interface UpdateHolidayInput {
  name?: string;
  date?: Date;
  type?: HolidayType;
  description?: string;
  color?: string;
  isActive?: boolean;
}

/**
 * Holiday data with source indicator
 */
export interface HolidayInfo {
  date: Date;
  name: string;
  type: HolidayType | 'RECURRING';
  isRecurring: boolean;
  holidayId?: string; // Only for company holidays
  description?: string;
  color?: string;
}

/**
 * Create a new company holiday
 */
export async function createHoliday(
  input: CreateHolidayInput,
  userId: string
): Promise<{ holidayId: string }> {
  const { db } = getFirebase();

  try {
    const now = Timestamp.now();
    const holidayRef = doc(collection(db, COLLECTIONS.HR_HOLIDAYS));

    const year = input.date.getFullYear();

    const holidayData: Omit<Holiday, 'id'> = {
      name: input.name,
      date: Timestamp.fromDate(input.date),
      year,
      type: input.type,
      description: input.description,
      color: input.color,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    };

    await setDoc(holidayRef, holidayData);

    logger.info('Holiday created', {
      holidayId: holidayRef.id,
      name: input.name,
      date: input.date,
    });

    return { holidayId: holidayRef.id };
  } catch (error) {
    logger.error('Failed to create holiday', { input, error });
    throw new Error('Failed to create holiday');
  }
}

/**
 * Get a holiday by ID
 */
export async function getHolidayById(holidayId: string): Promise<Holiday | null> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.HR_HOLIDAYS, holidayId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...(docSnap.data() as Omit<Holiday, 'id'>),
    };
  } catch (error) {
    logger.error('Failed to get holiday', { holidayId, error });
    throw new Error('Failed to get holiday');
  }
}

/**
 * Update a holiday
 */
export async function updateHoliday(
  holidayId: string,
  updates: UpdateHolidayInput,
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.HR_HOLIDAYS, holidayId);
    const updateData: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }

    if (updates.date !== undefined) {
      updateData.date = Timestamp.fromDate(updates.date);
      updateData.year = updates.date.getFullYear();
    }

    if (updates.type !== undefined) {
      updateData.type = updates.type;
    }

    if (updates.description !== undefined) {
      updateData.description = updates.description;
    }

    if (updates.color !== undefined) {
      updateData.color = updates.color;
    }

    if (updates.isActive !== undefined) {
      updateData.isActive = updates.isActive;
    }

    await updateDoc(docRef, updateData);

    logger.info('Holiday updated', { holidayId, updates });
  } catch (error) {
    logger.error('Failed to update holiday', { holidayId, error });
    throw new Error('Failed to update holiday');
  }
}

/**
 * Delete a holiday (soft delete by setting isActive = false)
 */
export async function deleteHoliday(holidayId: string, userId: string): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.HR_HOLIDAYS, holidayId);
    await updateDoc(docRef, {
      isActive: false,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    logger.info('Holiday soft deleted', { holidayId });
  } catch (error) {
    logger.error('Failed to delete holiday', { holidayId, error });
    throw new Error('Failed to delete holiday');
  }
}

/**
 * Hard delete a holiday (admin only)
 */
export async function hardDeleteHoliday(holidayId: string): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.HR_HOLIDAYS, holidayId);
    await deleteDoc(docRef);

    logger.info('Holiday hard deleted', { holidayId });
  } catch (error) {
    logger.error('Failed to hard delete holiday', { holidayId, error });
    throw new Error('Failed to delete holiday');
  }
}

/**
 * Get company holidays for a specific year
 */
export async function getHolidaysForYear(year: number): Promise<Holiday[]> {
  const { db } = getFirebase();

  try {
    const q = query(
      collection(db, COLLECTIONS.HR_HOLIDAYS),
      where('year', '==', year),
      where('isActive', '==', true),
      orderBy('date', 'asc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Holiday, 'id'>),
    }));
  } catch (error) {
    logger.error('Failed to get holidays for year', { year, error });
    throw new Error('Failed to get holidays');
  }
}

/**
 * Get all company holidays (for admin view)
 */
export async function getAllHolidays(includeInactive = false): Promise<Holiday[]> {
  const { db } = getFirebase();

  try {
    let q;
    if (includeInactive) {
      q = query(collection(db, COLLECTIONS.HR_HOLIDAYS), orderBy('date', 'desc'));
    } else {
      q = query(
        collection(db, COLLECTIONS.HR_HOLIDAYS),
        where('isActive', '==', true),
        orderBy('date', 'desc')
      );
    }

    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Holiday, 'id'>),
    }));
  } catch (error) {
    logger.error('Failed to get all holidays', { error });
    throw new Error('Failed to get holidays');
  }
}

/**
 * Get company holidays within a date range
 */
export async function getCompanyHolidaysInRange(
  startDate: Date,
  endDate: Date
): Promise<Holiday[]> {
  const { db } = getFirebase();

  try {
    const q = query(
      collection(db, COLLECTIONS.HR_HOLIDAYS),
      where('isActive', '==', true),
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate)),
      orderBy('date', 'asc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Holiday, 'id'>),
    }));
  } catch (error) {
    logger.error('Failed to get holidays in range', { startDate, endDate, error });
    throw new Error('Failed to get holidays');
  }
}

/**
 * Get all holidays (recurring + company) for a date range
 * This is the main function for calendar display and validation
 */
export async function getAllHolidaysInRange(
  startDate: Date,
  endDate: Date,
  recurringConfig: RecurringHolidayConfig = DEFAULT_RECURRING_CONFIG
): Promise<HolidayInfo[]> {
  try {
    // Get recurring holidays
    const recurringDates = getRecurringHolidaysInRange(startDate, endDate, recurringConfig);
    const recurringHolidays: HolidayInfo[] = recurringDates.map((date) => ({
      date,
      name: getRecurringHolidayLabel(date) || 'Holiday',
      type: 'RECURRING' as const,
      isRecurring: true,
    }));

    // Get company holidays
    const companyHolidays = await getCompanyHolidaysInRange(startDate, endDate);
    const companyHolidayInfos: HolidayInfo[] = companyHolidays.map((holiday) => ({
      date: holiday.date.toDate(),
      name: holiday.name,
      type: holiday.type,
      isRecurring: false,
      holidayId: holiday.id,
      description: holiday.description,
      color: holiday.color,
    }));

    // Merge and deduplicate (company holidays take precedence on same date)
    const holidayMap = new Map<string, HolidayInfo>();

    // Add recurring first
    for (const holiday of recurringHolidays) {
      const key = holiday.date.toISOString().split('T')[0] ?? '';
      holidayMap.set(key, holiday);
    }

    // Company holidays override recurring
    for (const holiday of companyHolidayInfos) {
      const key = holiday.date.toISOString().split('T')[0] ?? '';
      holidayMap.set(key, holiday);
    }

    // Sort by date
    return Array.from(holidayMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  } catch (error) {
    logger.error('Failed to get all holidays in range', { startDate, endDate, error });
    throw new Error('Failed to get holidays');
  }
}

/**
 * Check if a specific date is a holiday
 */
export async function isHoliday(
  date: Date,
  recurringConfig: RecurringHolidayConfig = DEFAULT_RECURRING_CONFIG
): Promise<{ isHoliday: boolean; holidayInfo: HolidayInfo | null }> {
  try {
    // Check recurring first
    if (isRecurringHoliday(date, recurringConfig)) {
      return {
        isHoliday: true,
        holidayInfo: {
          date,
          name: getRecurringHolidayLabel(date) || 'Holiday',
          type: 'RECURRING',
          isRecurring: true,
        },
      };
    }

    // Check company holidays
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const holidays = await getCompanyHolidaysInRange(startOfDay, endOfDay);

    const holiday = holidays[0];
    if (holiday) {
      return {
        isHoliday: true,
        holidayInfo: {
          date: holiday.date.toDate(),
          name: holiday.name,
          type: holiday.type,
          isRecurring: false,
          holidayId: holiday.id,
          description: holiday.description,
          color: holiday.color,
        },
      };
    }

    return { isHoliday: false, holidayInfo: null };
  } catch (error) {
    logger.error('Failed to check if date is holiday', { date, error });
    throw new Error('Failed to check holiday');
  }
}

/**
 * Get holidays that fall within a leave request date range
 * Returns dates that should be excluded from leave calculation
 */
export async function getHolidaysInLeaveRange(
  startDate: Date,
  endDate: Date,
  recurringConfig: RecurringHolidayConfig = DEFAULT_RECURRING_CONFIG
): Promise<HolidayInfo[]> {
  return getAllHolidaysInRange(startDate, endDate, recurringConfig);
}

/**
 * Count working days between two dates (excluding holidays)
 */
export async function countWorkingDays(
  startDate: Date,
  endDate: Date,
  recurringConfig: RecurringHolidayConfig = DEFAULT_RECURRING_CONFIG
): Promise<{ workingDays: number; holidays: HolidayInfo[] }> {
  try {
    const holidays = await getAllHolidaysInRange(startDate, endDate, recurringConfig);
    const holidayDates = new Set(holidays.map((h) => h.date.toISOString().split('T')[0]));

    let workingDays = 0;
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    while (current <= end) {
      const dateKey = current.toISOString().split('T')[0];
      if (!holidayDates.has(dateKey)) {
        workingDays++;
      }
      current.setDate(current.getDate() + 1);
    }

    return { workingDays, holidays };
  } catch (error) {
    logger.error('Failed to count working days', { startDate, endDate, error });
    throw new Error('Failed to count working days');
  }
}

/**
 * Copy holidays from one year to another (for admin convenience)
 */
export async function copyHolidaysToYear(
  sourceYear: number,
  targetYear: number,
  userId: string
): Promise<{ copied: number; skipped: number }> {
  const { db } = getFirebase();

  try {
    const sourceHolidays = await getHolidaysForYear(sourceYear);
    let copied = 0;
    let skipped = 0;

    for (const holiday of sourceHolidays) {
      const sourceDate = holiday.date.toDate();
      const targetDate = new Date(sourceDate);
      targetDate.setFullYear(targetYear);

      // Check if holiday already exists on target date
      const existing = await getCompanyHolidaysInRange(targetDate, targetDate);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      const now = Timestamp.now();
      const holidayRef = doc(collection(db, COLLECTIONS.HR_HOLIDAYS));

      const holidayData: Omit<Holiday, 'id'> = {
        name: holiday.name,
        date: Timestamp.fromDate(targetDate),
        year: targetYear,
        type: holiday.type,
        description: holiday.description,
        color: holiday.color,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      };

      await setDoc(holidayRef, holidayData);
      copied++;
    }

    logger.info('Holidays copied', { sourceYear, targetYear, copied, skipped });

    return { copied, skipped };
  } catch (error) {
    logger.error('Failed to copy holidays', { sourceYear, targetYear, error });
    throw new Error('Failed to copy holidays');
  }
}
