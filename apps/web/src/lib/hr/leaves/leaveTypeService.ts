/**
 * Leave Type Service
 *
 * CRUD operations for leave type configuration.
 * Leave types define categories like Sick Leave, Casual Leave, etc.
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
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import type { LeaveType, LeaveTypeCode } from '@vapour/types';

/**
 * Input for creating a leave type
 */
export interface CreateLeaveTypeInput {
  code: LeaveTypeCode;
  name: string;
  description?: string;
  annualQuota: number;
  carryForwardAllowed: boolean;
  maxCarryForward?: number;
  isPaid: boolean;
  requiresApproval: boolean;
  minNoticeDays?: number;
  maxConsecutiveDays?: number;
  allowHalfDay: boolean;
  color?: string;
}

/**
 * Input for updating a leave type
 */
export interface UpdateLeaveTypeInput {
  name?: string;
  description?: string;
  annualQuota?: number;
  carryForwardAllowed?: boolean;
  maxCarryForward?: number;
  isPaid?: boolean;
  requiresApproval?: boolean;
  minNoticeDays?: number;
  maxConsecutiveDays?: number;
  allowHalfDay?: boolean;
  color?: string;
  isActive?: boolean;
}

/**
 * Get all leave types
 */
export async function getLeaveTypes(includeInactive = false): Promise<LeaveType[]> {
  const { db } = getFirebase();

  try {
    let q;
    if (!includeInactive) {
      q = query(
        collection(db, COLLECTIONS.HR_LEAVE_TYPES),
        where('isActive', '==', true),
        orderBy('code', 'asc')
      );
    } else {
      q = query(collection(db, COLLECTIONS.HR_LEAVE_TYPES), orderBy('code', 'asc'));
    }
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnapshot) => {
      const data: LeaveType = {
        id: docSnapshot.id,
        ...(docSnapshot.data() as Omit<LeaveType, 'id'>),
      };
      return data;
    });
  } catch (error) {
    console.error('[getLeaveTypes] Error:', error);
    throw new Error('Failed to get leave types');
  }
}

/**
 * Get a single leave type by ID
 */
export async function getLeaveTypeById(id: string): Promise<LeaveType | null> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.HR_LEAVE_TYPES, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data: LeaveType = {
      id: docSnap.id,
      ...(docSnap.data() as Omit<LeaveType, 'id'>),
    };
    return data;
  } catch (error) {
    console.error('[getLeaveTypeById] Error:', error);
    throw new Error('Failed to get leave type');
  }
}

/**
 * Get leave type by code
 */
export async function getLeaveTypeByCode(code: LeaveTypeCode): Promise<LeaveType | null> {
  const { db } = getFirebase();

  try {
    const q = query(
      collection(db, COLLECTIONS.HR_LEAVE_TYPES),
      where('code', '==', code),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const typeDoc = snapshot.docs[0];
    if (!typeDoc) return null;
    const data: LeaveType = {
      id: typeDoc.id,
      ...(typeDoc.data() as Omit<LeaveType, 'id'>),
    };
    return data;
  } catch (error) {
    console.error('[getLeaveTypeByCode] Error:', error);
    throw new Error('Failed to get leave type');
  }
}

/**
 * Create a new leave type
 */
export async function createLeaveType(
  input: CreateLeaveTypeInput,
  _userId: string
): Promise<string> {
  const { db } = getFirebase();

  try {
    // Check if code already exists
    const existing = await getLeaveTypeByCode(input.code);
    if (existing) {
      throw new Error(`Leave type with code '${input.code}' already exists`);
    }

    const now = Timestamp.now();
    const leaveTypeRef = doc(collection(db, COLLECTIONS.HR_LEAVE_TYPES));

    const leaveTypeData: Omit<LeaveType, 'id'> = {
      code: input.code,
      name: input.name,
      description: input.description || '',
      annualQuota: input.annualQuota,
      carryForwardAllowed: input.carryForwardAllowed,
      maxCarryForward: input.maxCarryForward || 0,
      isPaid: input.isPaid,
      requiresApproval: input.requiresApproval,
      minNoticeDays: input.minNoticeDays || 0,
      maxConsecutiveDays: input.maxConsecutiveDays,
      allowHalfDay: input.allowHalfDay,
      color: input.color || '#6366f1', // Default indigo
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(leaveTypeRef, leaveTypeData);

    return leaveTypeRef.id;
  } catch (error) {
    console.error('[createLeaveType] Error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to create leave type');
  }
}

/**
 * Update a leave type
 */
export async function updateLeaveType(
  id: string,
  updates: UpdateLeaveTypeInput,
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.HR_LEAVE_TYPES, id);

    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  } catch (error) {
    console.error('[updateLeaveType] Error:', error);
    throw new Error('Failed to update leave type');
  }
}

/**
 * Deactivate a leave type (soft delete)
 */
export async function deactivateLeaveType(id: string, userId: string): Promise<void> {
  return updateLeaveType(id, { isActive: false }, userId);
}
