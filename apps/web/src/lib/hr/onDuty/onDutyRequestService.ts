/**
 * On-Duty Request Service
 *
 * CRUD operations for on-duty requests (working on holidays).
 * Handles creation, listing, and basic updates.
 * Approval workflow is handled by onDutyApprovalService.
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
  type QueryConstraint,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type {
  OnDutyRequest,
  OnDutyRequestFilters,
  CreateOnDutyRequestInput,
  UpdateOnDutyRequestInput,
} from '@vapour/types';
import {
  isRecurringHoliday,
  DEFAULT_RECURRING_CONFIG,
  getCompanyHolidaysInRange,
} from '../holidays';
import { startOfDay, isBefore } from 'date-fns';

const logger = createLogger({ context: 'onDutyRequestService' });

/**
 * Validate that the date is actually a holiday
 */
export async function validateOnDutyDate(date: Date): Promise<{
  valid: boolean;
  errors: string[];
  holidayName?: string;
}> {
  const errors: string[] = [];
  let holidayName: string | undefined;

  // Normalize to start of day for comparison
  const dateNormalized = startOfDay(date);

  // Check if it's a recurring holiday (Sunday or 1st/3rd Saturday)
  if (isRecurringHoliday(dateNormalized, DEFAULT_RECURRING_CONFIG)) {
    const dayOfWeek = dateNormalized.getDay();
    const dayOfMonth = dateNormalized.getDate();

    if (dayOfWeek === 0) {
      holidayName = 'Sunday';
    } else if (dayOfWeek === 6) {
      if (dayOfMonth <= 7) {
        holidayName = '1st Saturday';
      } else if (dayOfMonth >= 15 && dayOfMonth <= 21) {
        holidayName = '3rd Saturday';
      }
    }

    return { valid: true, errors: [], holidayName };
  }

  // Check if it's a company holiday
  const companyHolidays = await getCompanyHolidaysInRange(dateNormalized, dateNormalized);
  if (companyHolidays.length > 0) {
    const holiday = companyHolidays[0];
    if (holiday) {
      holidayName = holiday.name;
      return { valid: true, errors: [], holidayName };
    }
  }

  // Not a holiday
  errors.push('Selected date is not a holiday. On-duty requests are only for working on holidays.');

  return { valid: false, errors };
}

/**
 * Generate on-duty request number
 */
async function generateOnDutyRequestNumber(): Promise<string> {
  const { db } = getFirebase();
  const year = new Date().getFullYear();
  const yearStr = year.toString();

  // Use a counter document for reliable sequence generation
  const counterRef = doc(db, COLLECTIONS.COUNTERS, `on-duty-request-${yearStr}`);

  try {
    const counterDoc = await getDoc(counterRef);
    let sequence = 1;

    if (counterDoc.exists()) {
      sequence = (counterDoc.data()?.value || 0) + 1;
    }

    // Update the counter
    await setDoc(counterRef, { value: sequence, updatedAt: Timestamp.now() });

    return `OD-${yearStr}-${sequence.toString().padStart(4, '0')}`;
  } catch (error) {
    // Fallback: generate based on timestamp if counter fails
    logger.warn('Counter failed, using timestamp fallback for request number', { error });
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, '0');
    return `OD-${yearStr}-${timestamp}${random}`;
  }
}

/**
 * Get fiscal year from a date
 */
function getFiscalYearFromDate(date: Date): number {
  return date.getFullYear();
}

/**
 * Create a new on-duty request
 */
export async function createOnDutyRequest(
  input: CreateOnDutyRequestInput,
  userId: string,
  userName: string,
  userEmail: string,
  department?: string
): Promise<{ requestId: string; requestNumber: string }> {
  const { db } = getFirebase();

  try {
    // Validate date is a holiday
    const validation = await validateOnDutyDate(input.holidayDate);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    // Validate date is not in the past (before today)
    const today = startOfDay(new Date());
    const holidayDate = startOfDay(input.holidayDate);
    if (isBefore(holidayDate, today)) {
      throw new Error('Cannot apply for on-duty on past dates');
    }

    // Check for duplicate on-duty request on the same date
    const existingRequests = await listOnDutyRequests({
      userId,
      dateFrom: input.holidayDate,
      dateTo: input.holidayDate,
      status: ['PENDING_APPROVAL', 'PARTIALLY_APPROVED', 'APPROVED'],
    });

    if (existingRequests.length > 0) {
      throw new Error('You already have an on-duty request for this date');
    }

    // Generate request number
    const requestNumber = await generateOnDutyRequestNumber();

    // Create request document
    const requestRef = doc(collection(db, COLLECTIONS.HR_ON_DUTY_REQUESTS));
    const fiscalYear = getFiscalYearFromDate(input.holidayDate);

    const request: Omit<OnDutyRequest, 'id'> = {
      requestNumber,
      userId,
      userName,
      userEmail,
      department,
      holidayDate: Timestamp.fromDate(input.holidayDate),
      holidayName: validation.holidayName || input.holidayName,
      holidayId: input.holidayId,
      reason: input.reason,
      status: 'DRAFT',
      approverIds: [],
      compOffGranted: false,
      compOffUsed: false,
      fiscalYear,
      approvalHistory: [],
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(requestRef, request);

    logger.info('On-duty request created', {
      requestId: requestRef.id,
      requestNumber,
      userId,
      holidayDate: input.holidayDate,
    });

    return {
      requestId: requestRef.id,
      requestNumber,
    };
  } catch (error) {
    logger.error('Failed to create on-duty request', { error, userId, input });
    throw error;
  }
}

/**
 * Get on-duty request by ID
 */
export async function getOnDutyRequestById(requestId: string): Promise<OnDutyRequest | null> {
  const { db } = getFirebase();

  try {
    const requestRef = doc(db, COLLECTIONS.HR_ON_DUTY_REQUESTS, requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) {
      return null;
    }

    return {
      id: requestSnap.id,
      ...(requestSnap.data() as Omit<OnDutyRequest, 'id'>),
    };
  } catch (error) {
    logger.error('Failed to get on-duty request', { error, requestId });
    throw new Error('Failed to get on-duty request');
  }
}

/**
 * List on-duty requests with filters
 */
export async function listOnDutyRequests(
  filters: OnDutyRequestFilters = {}
): Promise<OnDutyRequest[]> {
  const { db } = getFirebase();

  try {
    const constraints: QueryConstraint[] = [];

    if (filters.userId) {
      constraints.push(where('userId', '==', filters.userId));
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        constraints.push(where('status', 'in', filters.status));
      } else {
        constraints.push(where('status', '==', filters.status));
      }
    }

    if (filters.fiscalYear) {
      constraints.push(where('fiscalYear', '==', filters.fiscalYear));
    }

    if (filters.dateFrom && filters.dateTo) {
      const fromTimestamp = Timestamp.fromDate(startOfDay(filters.dateFrom));
      const toTimestamp = Timestamp.fromDate(startOfDay(filters.dateTo));
      constraints.push(where('holidayDate', '>=', fromTimestamp));
      constraints.push(where('holidayDate', '<=', toTimestamp));
    }

    if (filters.approverId) {
      constraints.push(where('approverIds', 'array-contains', filters.approverId));
    }

    // Order by creation date (most recent first)
    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collection(db, COLLECTIONS.HR_ON_DUTY_REQUESTS), ...constraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...(docSnapshot.data() as Omit<OnDutyRequest, 'id'>),
    }));
  } catch (error) {
    logger.error('Failed to list on-duty requests', { error, filters });
    throw new Error('Failed to list on-duty requests');
  }
}

/**
 * Get current user's on-duty requests
 */
export async function getMyOnDutyRequests(userId: string): Promise<OnDutyRequest[]> {
  return listOnDutyRequests({ userId });
}

/**
 * Update on-duty request (draft only)
 */
export async function updateOnDutyRequest(
  requestId: string,
  input: UpdateOnDutyRequestInput,
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    // Get existing request
    const request = await getOnDutyRequestById(requestId);
    if (!request) {
      throw new Error('On-duty request not found');
    }

    // Only allow updates to DRAFT requests
    if (request.status !== 'DRAFT') {
      throw new Error('Can only edit draft on-duty requests');
    }

    // Check ownership
    if (request.userId !== userId) {
      throw new Error('Unauthorized: Not your request');
    }

    const updates: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };

    if (input.holidayDate) {
      // Validate new date is a holiday
      const validation = await validateOnDutyDate(input.holidayDate);
      if (!validation.valid) {
        throw new Error(validation.errors.join(', '));
      }

      // Validate date is not in the past
      const today = startOfDay(new Date());
      const holidayDate = startOfDay(input.holidayDate);
      if (isBefore(holidayDate, today)) {
        throw new Error('Cannot apply for on-duty on past dates');
      }

      updates.holidayDate = Timestamp.fromDate(input.holidayDate);
      updates.fiscalYear = getFiscalYearFromDate(input.holidayDate);

      if (validation.holidayName) {
        updates.holidayName = validation.holidayName;
      }
    }

    if (input.holidayName) {
      updates.holidayName = input.holidayName;
    }

    if (input.holidayId !== undefined) {
      updates.holidayId = input.holidayId;
    }

    if (input.reason) {
      updates.reason = input.reason;
    }

    const requestRef = doc(db, COLLECTIONS.HR_ON_DUTY_REQUESTS, requestId);
    await updateDoc(requestRef, updates);

    logger.info('On-duty request updated', { requestId, userId });
  } catch (error) {
    logger.error('Failed to update on-duty request', { error, requestId, input });
    throw error;
  }
}

/**
 * Delete on-duty request (draft only)
 */
export async function deleteOnDutyRequest(requestId: string, userId: string): Promise<void> {
  const { db } = getFirebase();

  try {
    // Get existing request
    const request = await getOnDutyRequestById(requestId);
    if (!request) {
      throw new Error('On-duty request not found');
    }

    // Only allow deletion of DRAFT requests
    if (request.status !== 'DRAFT') {
      throw new Error('Can only delete draft on-duty requests');
    }

    // Check ownership
    if (request.userId !== userId) {
      throw new Error('Unauthorized: Not your request');
    }

    const requestRef = doc(db, COLLECTIONS.HR_ON_DUTY_REQUESTS, requestId);
    await deleteDoc(requestRef);

    logger.info('On-duty request deleted', { requestId, userId });
  } catch (error) {
    logger.error('Failed to delete on-duty request', { error, requestId });
    throw error;
  }
}
