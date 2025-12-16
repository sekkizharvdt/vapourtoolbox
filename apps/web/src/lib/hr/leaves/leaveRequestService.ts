/**
 * Leave Request Service
 *
 * CRUD operations for leave requests.
 * Handles creation, listing, and basic updates.
 * Approval workflow is handled by leaveApprovalService.
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
import type { LeaveRequest, LeaveRequestStatus, LeaveTypeCode } from '@vapour/types';
import { getUserLeaveBalanceByType } from './leaveBalanceService';
import { getLeaveTypeByCode } from './leaveTypeService';

const logger = createLogger({ context: 'leaveRequestService' });

/**
 * Input for creating a leave request
 */
export interface CreateLeaveRequestInput {
  leaveTypeCode: LeaveTypeCode;
  startDate: Date;
  endDate: Date;
  isHalfDay?: boolean;
  halfDayType?: 'FIRST_HALF' | 'SECOND_HALF';
  reason: string;
  attachmentUrls?: string[];
}

/**
 * Filters for listing leave requests
 */
export interface ListLeaveRequestsFilters {
  userId?: string;
  status?: LeaveRequestStatus;
  leaveTypeCode?: LeaveTypeCode;
  fiscalYear?: number;
  startDateFrom?: Date;
  startDateTo?: Date;
  limit?: number;
}

/**
 * Calculate number of leave days between two dates
 * Excludes weekends by default
 */
export function calculateLeaveDays(
  startDate: Date,
  endDate: Date,
  isHalfDay = false,
  excludeWeekends = true
): number {
  if (isHalfDay) {
    return 0.5;
  }

  let days = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    // 0 = Sunday, 6 = Saturday
    if (!excludeWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
      days++;
    }
    current.setDate(current.getDate() + 1);
  }

  return days;
}

/**
 * Generate leave request number
 */
async function generateLeaveRequestNumber(): Promise<string> {
  const { db } = getFirebase();
  const year = new Date().getFullYear();
  const yearStr = year.toString();

  // Use a counter document for reliable sequence generation
  const counterRef = doc(db, COLLECTIONS.COUNTERS, `leave-request-${yearStr}`);

  try {
    const counterDoc = await getDoc(counterRef);
    let sequence = 1;

    if (counterDoc.exists()) {
      sequence = (counterDoc.data()?.value || 0) + 1;
    }

    // Update the counter
    await setDoc(counterRef, { value: sequence, updatedAt: Timestamp.now() });

    return `LR-${yearStr}-${sequence.toString().padStart(4, '0')}`;
  } catch (error) {
    // Fallback: generate based on timestamp if counter fails
    logger.warn('Counter failed, using timestamp fallback for request number', { error });
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, '0');
    return `LR-${yearStr}-${timestamp}${random}`;
  }
}

/**
 * Get fiscal year from a date
 */
function getFiscalYearFromDate(date: Date): number {
  return date.getFullYear();
}

/**
 * Create a new leave request
 */
export async function createLeaveRequest(
  input: CreateLeaveRequestInput,
  userId: string,
  userName: string,
  userEmail: string
): Promise<{ requestId: string; requestNumber: string }> {
  const { db } = getFirebase();

  try {
    // Get leave type
    const leaveType = await getLeaveTypeByCode(input.leaveTypeCode);
    if (!leaveType) {
      throw new Error(`Leave type '${input.leaveTypeCode}' not found`);
    }

    // Calculate number of days
    const numberOfDays = calculateLeaveDays(input.startDate, input.endDate, input.isHalfDay);

    // Validate half day
    if (input.isHalfDay && !leaveType.allowHalfDay) {
      throw new Error(`${leaveType.name} does not allow half-day leaves`);
    }

    // Check if half day is only for single day
    if (input.isHalfDay) {
      const start = new Date(input.startDate);
      const end = new Date(input.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      if (start.getTime() !== end.getTime()) {
        throw new Error('Half-day leave can only be for a single day');
      }
    }

    // Check leave balance
    const fiscalYear = getFiscalYearFromDate(input.startDate);
    const balance = await getUserLeaveBalanceByType(userId, input.leaveTypeCode, fiscalYear);

    if (!balance) {
      throw new Error(
        `No leave balance found for ${leaveType.name}. Please contact HR to initialize your leave balances.`
      );
    }

    if (balance.available < numberOfDays) {
      throw new Error(
        `Insufficient ${leaveType.name} balance. Available: ${balance.available} days, Requested: ${numberOfDays} days`
      );
    }

    const now = Timestamp.now();
    const requestNumber = await generateLeaveRequestNumber();
    const requestRef = doc(collection(db, COLLECTIONS.HR_LEAVE_REQUESTS));

    // Build request data
    const requestData: Omit<LeaveRequest, 'id'> = {
      requestNumber,
      userId,
      userName,
      userEmail,
      leaveTypeId: leaveType.id,
      leaveTypeCode: input.leaveTypeCode,
      leaveTypeName: leaveType.name,
      startDate: Timestamp.fromDate(input.startDate),
      endDate: Timestamp.fromDate(input.endDate),
      numberOfDays,
      isHalfDay: input.isHalfDay || false,
      ...(input.halfDayType && { halfDayType: input.halfDayType }),
      reason: input.reason,
      attachmentUrls: input.attachmentUrls || [],
      status: 'DRAFT',
      fiscalYear,
      approverIds: [], // Will be set when submitted
      approvalHistory: [],
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(requestRef, requestData);

    return {
      requestId: requestRef.id,
      requestNumber,
    };
  } catch (error) {
    logger.error('Failed to create leave request', { userId, error });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to create leave request');
  }
}

/**
 * Get leave request by ID
 */
export async function getLeaveRequestById(requestId: string): Promise<LeaveRequest | null> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.HR_LEAVE_REQUESTS, requestId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data: LeaveRequest = {
      id: docSnap.id,
      ...(docSnap.data() as Omit<LeaveRequest, 'id'>),
    };
    return data;
  } catch (error) {
    logger.error('Failed to get leave request', { requestId, error });
    throw new Error('Failed to get leave request');
  }
}

/**
 * List leave requests with filters
 */
export async function listLeaveRequests(
  filters: ListLeaveRequestsFilters = {}
): Promise<LeaveRequest[]> {
  const { db } = getFirebase();

  try {
    const constraints: QueryConstraint[] = [];

    if (filters.userId) {
      constraints.push(where('userId', '==', filters.userId));
    }

    if (filters.status) {
      constraints.push(where('status', '==', filters.status));
    }

    if (filters.leaveTypeCode) {
      constraints.push(where('leaveTypeCode', '==', filters.leaveTypeCode));
    }

    if (filters.fiscalYear) {
      constraints.push(where('fiscalYear', '==', filters.fiscalYear));
    }

    if (filters.startDateFrom) {
      constraints.push(where('startDate', '>=', Timestamp.fromDate(filters.startDateFrom)));
    }

    if (filters.startDateTo) {
      constraints.push(where('startDate', '<=', Timestamp.fromDate(filters.startDateTo)));
    }

    // Order by start date descending
    constraints.push(orderBy('startDate', 'desc'));

    const q = query(collection(db, COLLECTIONS.HR_LEAVE_REQUESTS), ...constraints);
    const snapshot = await getDocs(q);

    let results = snapshot.docs.map((docSnapshot) => {
      const data: LeaveRequest = {
        id: docSnapshot.id,
        ...(docSnapshot.data() as Omit<LeaveRequest, 'id'>),
      };
      return data;
    });

    // Apply limit after fetching (Firestore limit requires ordered query)
    if (filters.limit && results.length > filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  } catch (error) {
    logger.error('Failed to list leave requests', { filters, error });
    throw new Error('Failed to list leave requests');
  }
}

/**
 * Get user's own leave requests
 */
export async function getMyLeaveRequests(
  userId: string,
  filters?: Omit<ListLeaveRequestsFilters, 'userId'>
): Promise<LeaveRequest[]> {
  return listLeaveRequests({ ...filters, userId });
}

/**
 * Get leave requests pending approval (for approvers)
 */
export async function getPendingApprovalRequests(): Promise<LeaveRequest[]> {
  return listLeaveRequests({ status: 'PENDING_APPROVAL' });
}

/**
 * Update a draft leave request
 * Only allowed for DRAFT status
 */
export async function updateLeaveRequest(
  requestId: string,
  updates: Partial<CreateLeaveRequestInput>,
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const request = await getLeaveRequestById(requestId);

    if (!request) {
      throw new Error('Leave request not found');
    }

    if (request.status !== 'DRAFT') {
      throw new Error('Can only edit leave requests in DRAFT status');
    }

    if (request.userId !== userId) {
      throw new Error('You can only edit your own leave requests');
    }

    const updateData: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    if (updates.startDate || updates.endDate || updates.isHalfDay !== undefined) {
      const startDate = updates.startDate || request.startDate.toDate();
      const endDate = updates.endDate || request.endDate.toDate();
      const isHalfDay = updates.isHalfDay ?? request.isHalfDay;

      const numberOfDays = calculateLeaveDays(startDate, endDate, isHalfDay);

      updateData.startDate = Timestamp.fromDate(startDate);
      updateData.endDate = Timestamp.fromDate(endDate);
      updateData.isHalfDay = isHalfDay;
      updateData.numberOfDays = numberOfDays;
    }

    if (updates.halfDayType !== undefined) {
      updateData.halfDayType = updates.halfDayType;
    }

    if (updates.reason !== undefined) {
      updateData.reason = updates.reason;
    }

    if (updates.attachmentUrls !== undefined) {
      updateData.attachmentUrls = updates.attachmentUrls;
    }

    const docRef = doc(db, COLLECTIONS.HR_LEAVE_REQUESTS, requestId);
    await updateDoc(docRef, updateData);
  } catch (error) {
    logger.error('Failed to update leave request', { requestId, error });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to update leave request');
  }
}

/**
 * Delete a draft leave request
 * Only allowed for DRAFT status
 */
export async function deleteLeaveRequest(requestId: string, userId: string): Promise<void> {
  const { db } = getFirebase();

  try {
    const request = await getLeaveRequestById(requestId);

    if (!request) {
      throw new Error('Leave request not found');
    }

    if (request.status !== 'DRAFT') {
      throw new Error('Can only delete leave requests in DRAFT status');
    }

    if (request.userId !== userId) {
      throw new Error('You can only delete your own leave requests');
    }

    // Soft delete - change status to CANCELLED
    const docRef = doc(db, COLLECTIONS.HR_LEAVE_REQUESTS, requestId);
    await updateDoc(docRef, {
      status: 'CANCELLED',
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  } catch (error) {
    logger.error('Failed to delete leave request', { requestId, error });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to delete leave request');
  }
}

/**
 * Get team calendar data (approved leaves for a date range)
 */
export async function getTeamCalendar(startDate: Date, endDate: Date): Promise<LeaveRequest[]> {
  const { db } = getFirebase();

  try {
    // Query for approved leaves that overlap with the date range
    const q = query(
      collection(db, COLLECTIONS.HR_LEAVE_REQUESTS),
      where('status', '==', 'APPROVED'),
      where('startDate', '<=', Timestamp.fromDate(endDate)),
      orderBy('startDate', 'asc')
    );

    const snapshot = await getDocs(q);

    // Filter for leaves that actually overlap with the range
    const requests = snapshot.docs
      .map((docSnapshot) => {
        const data: LeaveRequest = {
          id: docSnapshot.id,
          ...(docSnapshot.data() as Omit<LeaveRequest, 'id'>),
        };
        return data;
      })
      .filter((request) => {
        const reqEnd = request.endDate.toDate();
        return reqEnd >= startDate;
      });

    return requests;
  } catch (error) {
    logger.error('Failed to get team calendar', { startDate, endDate, error });
    throw new Error('Failed to get team calendar');
  }
}

/**
 * Get users on leave today
 */
export async function getUsersOnLeaveToday(): Promise<LeaveRequest[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return getTeamCalendar(today, today);
}
