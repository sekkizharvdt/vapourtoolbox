/**
 * Employee Service
 *
 * Service for managing employee HR profiles.
 * Employee data is stored in the users collection with hrProfile field.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { User } from '@vapour/types';
import type { HRProfile, EmployeeListItem, EmployeeDetail, BloodGroup } from '@vapour/types';

const logger = createLogger({ context: 'employeeService' });

/**
 * Get all employees (active users with internal domain)
 */
export async function getAllEmployees(): Promise<EmployeeListItem[]> {
  const { db } = getFirebase();

  try {
    const q = query(
      collection(db, COLLECTIONS.USERS),
      where('isActive', '==', true),
      orderBy('displayName', 'asc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnapshot) => {
      const data = docSnapshot.data() as User;
      return mapUserToEmployeeListItem(docSnapshot.id, data);
    });
  } catch (error) {
    logger.error('Failed to get all employees', { error });
    throw new Error('Failed to get employees');
  }
}

/**
 * Get employees with filters
 */
export interface EmployeeFilters {
  department?: string;
  isActive?: boolean;
  bloodGroup?: BloodGroup;
  reportingManagerId?: string;
}

export async function getEmployeesWithFilters(
  filters: EmployeeFilters = {}
): Promise<EmployeeListItem[]> {
  const { db } = getFirebase();

  try {
    // Start with base query - we'll filter in memory for hrProfile fields
    let q = query(collection(db, COLLECTIONS.USERS), orderBy('displayName', 'asc'));

    // Add isActive filter if specified
    if (filters.isActive !== undefined) {
      q = query(
        collection(db, COLLECTIONS.USERS),
        where('isActive', '==', filters.isActive),
        orderBy('displayName', 'asc')
      );
    }

    // Add department filter if specified
    if (filters.department) {
      q = query(
        collection(db, COLLECTIONS.USERS),
        where('department', '==', filters.department),
        where('isActive', '==', filters.isActive ?? true),
        orderBy('displayName', 'asc')
      );
    }

    const snapshot = await getDocs(q);

    let results = snapshot.docs.map((docSnapshot) => {
      const data = docSnapshot.data() as User;
      return {
        ...mapUserToEmployeeListItem(docSnapshot.id, data),
        _hrProfile: data.hrProfile, // Keep for filtering
      };
    });

    // Filter by hrProfile fields in memory (Firestore can't query nested fields efficiently)
    if (filters.bloodGroup) {
      results = results.filter((e) => e._hrProfile?.bloodGroup === filters.bloodGroup);
    }

    if (filters.reportingManagerId) {
      results = results.filter(
        (e) => e._hrProfile?.reportingManagerId === filters.reportingManagerId
      );
    }

    // Remove internal _hrProfile field
    return results.map(({ _hrProfile, ...employee }) => employee as EmployeeListItem);
  } catch (error) {
    logger.error('Failed to get employees with filters', { filters, error });
    throw new Error('Failed to get employees');
  }
}

/**
 * Get single employee by user ID
 */
export async function getEmployeeById(userId: string): Promise<EmployeeDetail | null> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.USERS, userId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data() as User;
    return mapUserToEmployeeDetail(docSnap.id, data);
  } catch (error) {
    logger.error('Failed to get employee', { userId, error });
    throw new Error('Failed to get employee');
  }
}

/**
 * Update employee HR profile
 */
export async function updateEmployeeHRProfile(
  userId: string,
  hrProfile: Partial<HRProfile>,
  updatedBy: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.USERS, userId);

    // Get current hrProfile to merge
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error('Employee not found');
    }

    const currentData = docSnap.data() as User;
    const currentHRProfile = currentData.hrProfile || {};

    // Merge HR profile data
    const updatedHRProfile = {
      ...currentHRProfile,
      ...hrProfile,
    };

    await updateDoc(docRef, {
      hrProfile: updatedHRProfile,
      updatedAt: Timestamp.now(),
      updatedBy,
    });

    logger.info('Employee HR profile updated', { userId, updatedBy });
  } catch (error) {
    logger.error('Failed to update employee HR profile', { userId, error });
    throw new Error('Failed to update employee profile');
  }
}

/**
 * Update employee basic info (phone, job title, etc.)
 */
export async function updateEmployeeBasicInfo(
  userId: string,
  updates: {
    phone?: string;
    mobile?: string;
    jobTitle?: string;
    department?: string;
  },
  updatedBy: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, COLLECTIONS.USERS, userId);

    const updateData: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
      updatedBy,
    };

    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.mobile !== undefined) updateData.mobile = updates.mobile;
    if (updates.jobTitle !== undefined) updateData.jobTitle = updates.jobTitle;
    if (updates.department !== undefined) updateData.department = updates.department;

    await updateDoc(docRef, updateData);

    logger.info('Employee basic info updated', { userId, updatedBy });
  } catch (error) {
    logger.error('Failed to update employee basic info', { userId, error });
    throw new Error('Failed to update employee info');
  }
}

/**
 * Get employees by reporting manager
 */
export async function getEmployeesByManager(managerId: string): Promise<EmployeeListItem[]> {
  const employees = await getAllEmployees();

  // Filter by reporting manager - need to do in memory since hrProfile is nested
  return employees.filter((e) => e.reportingManagerId === managerId);
}

/**
 * Get all unique departments
 */
export async function getDepartments(): Promise<string[]> {
  const { db } = getFirebase();

  try {
    const q = query(collection(db, COLLECTIONS.USERS), where('isActive', '==', true));

    const snapshot = await getDocs(q);
    const departments = new Set<string>();

    snapshot.docs.forEach((docSnapshot) => {
      const data = docSnapshot.data() as User;
      if (data.department) {
        departments.add(data.department);
      }
    });

    return Array.from(departments).sort();
  } catch (error) {
    logger.error('Failed to get departments', { error });
    throw new Error('Failed to get departments');
  }
}

/**
 * Search employees by name or email
 */
export async function searchEmployees(searchQuery: string): Promise<EmployeeListItem[]> {
  const employees = await getAllEmployees();
  const query = searchQuery.toLowerCase();

  return employees.filter(
    (e) =>
      e.displayName.toLowerCase().includes(query) ||
      e.email.toLowerCase().includes(query) ||
      e.employeeId?.toLowerCase().includes(query)
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapUserToEmployeeListItem(uid: string, user: User): EmployeeListItem {
  return {
    uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    department: user.department,
    jobTitle: user.jobTitle,
    phone: user.phone,
    mobile: user.mobile,
    isActive: user.isActive,
    status: user.status,
    employeeId: user.hrProfile?.employeeId,
    dateOfJoining: user.hrProfile?.dateOfJoining,
    bloodGroup: user.hrProfile?.bloodGroup,
    reportingManagerId: user.hrProfile?.reportingManagerId,
    reportingManagerName: user.hrProfile?.reportingManagerName,
  };
}

function mapUserToEmployeeDetail(uid: string, user: User): EmployeeDetail {
  return {
    ...mapUserToEmployeeListItem(uid, user),
    hrProfile: user.hrProfile,
    assignedProjects: user.assignedProjects,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
