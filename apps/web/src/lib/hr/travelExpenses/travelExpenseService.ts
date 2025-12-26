/**
 * Travel Expense Service
 *
 * CRUD operations for travel expense reports.
 * Handles creation, listing, expense items, and basic updates.
 * Approval workflow is handled by travelExpenseApprovalService.
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
  TravelExpenseReport,
  TravelExpenseItem,
  TravelExpenseItemInput,
  TravelExpenseStatus,
  TravelExpenseCategory,
  CreateTravelExpenseInput,
  UpdateTravelExpenseInput,
  TravelExpenseFilters,
  CurrencyCode,
} from '@vapour/types';

const logger = createLogger({ context: 'travelExpenseService' });

// ============================================
// Report Number Generation
// ============================================

/**
 * Generate travel expense report number
 */
async function generateReportNumber(): Promise<string> {
  const { db } = getFirebase();
  const year = new Date().getFullYear();
  const yearStr = year.toString();

  const counterRef = doc(db, COLLECTIONS.COUNTERS, `travel-expense-${yearStr}`);

  try {
    const counterDoc = await getDoc(counterRef);
    let sequence = 1;

    if (counterDoc.exists()) {
      sequence = (counterDoc.data()?.value || 0) + 1;
    }

    await setDoc(counterRef, { value: sequence, updatedAt: Timestamp.now() });

    return `TE-${yearStr}-${sequence.toString().padStart(4, '0')}`;
  } catch (error) {
    logger.warn('Counter failed, using timestamp fallback for report number', { error });
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, '0');
    return `TE-${yearStr}-${timestamp}${random}`;
  }
}

// ============================================
// Category Totals Calculation
// ============================================

/**
 * Calculate totals by category from expense items
 */
function calculateCategoryTotals(
  items: TravelExpenseItem[]
): Partial<Record<TravelExpenseCategory, number>> {
  const totals: Partial<Record<TravelExpenseCategory, number>> = {};

  for (const item of items) {
    const current = totals[item.category] || 0;
    totals[item.category] = current + item.amount;
  }

  return totals;
}

/**
 * Calculate total amount and GST from expense items
 */
function calculateTotals(items: TravelExpenseItem[]): {
  totalAmount: number;
  totalGstAmount: number;
} {
  let totalAmount = 0;
  let totalGstAmount = 0;

  for (const item of items) {
    totalAmount += item.amount;
    totalGstAmount += item.gstAmount || 0;
  }

  return { totalAmount, totalGstAmount };
}

// ============================================
// CRUD Operations
// ============================================

/**
 * Create a new travel expense report
 */
export async function createTravelExpenseReport(
  input: CreateTravelExpenseInput,
  employeeId: string,
  employeeName: string,
  employeeEmail: string,
  department?: string
): Promise<{ reportId: string; reportNumber: string }> {
  const { db } = getFirebase();

  try {
    const now = Timestamp.now();
    const reportNumber = await generateReportNumber();
    const reportRef = doc(collection(db, COLLECTIONS.HR_TRAVEL_EXPENSES));

    // Build report data, excluding undefined values (Firestore doesn't accept undefined)
    const reportData: Record<string, unknown> = {
      reportNumber,
      tripPurpose: input.tripPurpose,
      tripStartDate: Timestamp.fromDate(input.tripStartDate),
      tripEndDate: Timestamp.fromDate(input.tripEndDate),
      destinations: input.destinations,
      employeeId,
      employeeName,
      employeeEmail,
      items: [],
      categoryTotals: {},
      totalAmount: 0,
      totalGstAmount: 0,
      currency: 'INR' as CurrencyCode,
      status: 'DRAFT' as TravelExpenseStatus,
      approverIds: [],
      approvalHistory: [],
      createdAt: now,
      updatedAt: now,
    };

    // Only add optional fields if they have values
    if (input.projectId) reportData.projectId = input.projectId;
    if (input.projectName) reportData.projectName = input.projectName;
    if (input.costCentreId) reportData.costCentreId = input.costCentreId;
    if (input.costCentreName) reportData.costCentreName = input.costCentreName;
    if (department) reportData.department = department;
    if (input.notes) reportData.notes = input.notes;

    await setDoc(reportRef, reportData);

    logger.info('Created travel expense report', {
      reportId: reportRef.id,
      reportNumber,
      employeeId,
    });

    return {
      reportId: reportRef.id,
      reportNumber,
    };
  } catch (error) {
    logger.error('Failed to create travel expense report', { employeeId, error });
    throw new Error('Failed to create travel expense report');
  }
}

/**
 * Get travel expense report by ID
 */
export async function getTravelExpenseReport(
  reportId: string
): Promise<TravelExpenseReport | null> {
  const { db } = getFirebase();

  logger.info('Fetching travel expense report', { reportId });

  try {
    const docRef = doc(db, COLLECTIONS.HR_TRAVEL_EXPENSES, reportId);
    logger.debug('Document reference created', { path: docRef.path });

    const docSnap = await getDoc(docRef);
    logger.debug('Document snapshot retrieved', {
      exists: docSnap.exists(),
      id: docSnap.id,
    });

    if (!docSnap.exists()) {
      logger.warn('Travel expense report not found', { reportId });
      return null;
    }

    const data = docSnap.data();
    logger.debug('Document data', { employeeId: data?.employeeId, status: data?.status });

    return {
      id: docSnap.id,
      ...(data as Omit<TravelExpenseReport, 'id'>),
    };
  } catch (error) {
    logger.error('Failed to get travel expense report', {
      reportId,
      error,
      errorCode: (error as { code?: string })?.code,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    // Check for permission denied error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as { code?: string })?.code;
    if (
      errorMessage.includes('permission') ||
      errorMessage.includes('PERMISSION_DENIED') ||
      errorCode === 'permission-denied'
    ) {
      throw new Error('You do not have permission to view this report');
    }
    throw new Error('Failed to get travel expense report');
  }
}

/**
 * List travel expense reports with filters
 */
export async function listTravelExpenseReports(
  filters: TravelExpenseFilters = {}
): Promise<TravelExpenseReport[]> {
  const { db } = getFirebase();

  try {
    const constraints: QueryConstraint[] = [];

    if (filters.employeeId) {
      constraints.push(where('employeeId', '==', filters.employeeId));
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        constraints.push(where('status', 'in', filters.status));
      } else {
        constraints.push(where('status', '==', filters.status));
      }
    }

    if (filters.projectId) {
      constraints.push(where('projectId', '==', filters.projectId));
    }

    if (filters.costCentreId) {
      constraints.push(where('costCentreId', '==', filters.costCentreId));
    }

    if (filters.tripStartDateFrom) {
      constraints.push(where('tripStartDate', '>=', Timestamp.fromDate(filters.tripStartDateFrom)));
    }

    if (filters.tripStartDateTo) {
      constraints.push(where('tripStartDate', '<=', Timestamp.fromDate(filters.tripStartDateTo)));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    const q = query(collection(db, COLLECTIONS.HR_TRAVEL_EXPENSES), ...constraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...(docSnapshot.data() as Omit<TravelExpenseReport, 'id'>),
    }));
  } catch (error) {
    logger.error('Failed to list travel expense reports', { filters, error });
    throw new Error('Failed to list travel expense reports');
  }
}

/**
 * Get user's own travel expense reports
 */
export async function getMyTravelExpenseReports(
  employeeId: string,
  filters?: Omit<TravelExpenseFilters, 'employeeId'>
): Promise<TravelExpenseReport[]> {
  return listTravelExpenseReports({ ...filters, employeeId });
}

/**
 * Get travel expense reports pending approval
 */
export async function getPendingApprovalReports(
  approverId: string
): Promise<TravelExpenseReport[]> {
  const { db } = getFirebase();

  try {
    const q = query(
      collection(db, COLLECTIONS.HR_TRAVEL_EXPENSES),
      where('status', '==', 'SUBMITTED'),
      where('approverIds', 'array-contains', approverId),
      orderBy('submittedAt', 'asc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnapshot) => ({
      id: docSnapshot.id,
      ...(docSnapshot.data() as Omit<TravelExpenseReport, 'id'>),
    }));
  } catch (error) {
    logger.error('Failed to get pending approval reports', { approverId, error });
    throw new Error('Failed to get pending approval reports');
  }
}

/**
 * Update a draft travel expense report
 */
export async function updateTravelExpenseReport(
  reportId: string,
  updates: UpdateTravelExpenseInput,
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const report = await getTravelExpenseReport(reportId);

    if (!report) {
      throw new Error('Travel expense report not found');
    }

    if (report.status !== 'DRAFT') {
      throw new Error('Can only edit reports in DRAFT status');
    }

    if (report.employeeId !== userId) {
      throw new Error('You can only edit your own travel expense reports');
    }

    const updateData: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };

    if (updates.tripPurpose !== undefined) {
      updateData.tripPurpose = updates.tripPurpose;
    }

    if (updates.tripStartDate !== undefined) {
      updateData.tripStartDate = Timestamp.fromDate(updates.tripStartDate);
    }

    if (updates.tripEndDate !== undefined) {
      updateData.tripEndDate = Timestamp.fromDate(updates.tripEndDate);
    }

    if (updates.destinations !== undefined) {
      updateData.destinations = updates.destinations;
    }

    if (updates.projectId !== undefined) {
      updateData.projectId = updates.projectId;
      updateData.projectName = updates.projectName;
    }

    if (updates.costCentreId !== undefined) {
      updateData.costCentreId = updates.costCentreId;
      updateData.costCentreName = updates.costCentreName;
    }

    if (updates.notes !== undefined) {
      updateData.notes = updates.notes;
    }

    const docRef = doc(db, COLLECTIONS.HR_TRAVEL_EXPENSES, reportId);
    await updateDoc(docRef, updateData);

    logger.info('Updated travel expense report', { reportId, userId });
  } catch (error) {
    logger.error('Failed to update travel expense report', { reportId, error });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to update travel expense report');
  }
}

/**
 * Delete a draft travel expense report
 */
export async function deleteTravelExpenseReport(reportId: string, userId: string): Promise<void> {
  const { db } = getFirebase();

  try {
    const report = await getTravelExpenseReport(reportId);

    if (!report) {
      throw new Error('Travel expense report not found');
    }

    if (report.status !== 'DRAFT') {
      throw new Error('Can only delete reports in DRAFT status');
    }

    if (report.employeeId !== userId) {
      throw new Error('You can only delete your own travel expense reports');
    }

    const docRef = doc(db, COLLECTIONS.HR_TRAVEL_EXPENSES, reportId);
    await deleteDoc(docRef);

    logger.info('Deleted travel expense report', { reportId, userId });
  } catch (error) {
    logger.error('Failed to delete travel expense report', { reportId, error });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to delete travel expense report');
  }
}

// ============================================
// Expense Item Operations
// ============================================

/**
 * Generate a unique ID for expense items
 */
function generateItemId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Add an expense item to a report
 */
export async function addExpenseItem(
  reportId: string,
  input: TravelExpenseItemInput,
  userId: string,
  receiptAttachmentId?: string,
  receiptFileName?: string,
  receiptUrl?: string
): Promise<string> {
  const { db } = getFirebase();

  try {
    const report = await getTravelExpenseReport(reportId);

    if (!report) {
      throw new Error('Travel expense report not found');
    }

    if (report.status !== 'DRAFT') {
      throw new Error('Can only add items to reports in DRAFT status');
    }

    if (report.employeeId !== userId) {
      throw new Error('You can only modify your own travel expense reports');
    }

    const itemId = generateItemId();
    // Build the item object, only including fields that have values
    // Firestore does not accept undefined values
    const newItem: TravelExpenseItem = {
      id: itemId,
      category: input.category,
      description: input.description,
      expenseDate: Timestamp.fromDate(input.expenseDate),
      amount: input.amount,
      currency: input.currency || ('INR' as CurrencyCode),
      hasReceipt: !!receiptAttachmentId,
    };

    // Add optional receipt fields only if they have values
    if (receiptAttachmentId) newItem.receiptAttachmentId = receiptAttachmentId;
    if (receiptFileName) newItem.receiptFileName = receiptFileName;
    if (receiptUrl) newItem.receiptUrl = receiptUrl;

    // Add optional vendor fields only if they have values
    if (input.vendorName) newItem.vendorName = input.vendorName;
    if (input.invoiceNumber) newItem.invoiceNumber = input.invoiceNumber;

    // Add GST fields only if they have values
    if (input.gstRate !== undefined) newItem.gstRate = input.gstRate;
    if (input.gstAmount !== undefined) newItem.gstAmount = input.gstAmount;
    if (input.cgstAmount !== undefined) newItem.cgstAmount = input.cgstAmount;
    if (input.sgstAmount !== undefined) newItem.sgstAmount = input.sgstAmount;
    if (input.igstAmount !== undefined) newItem.igstAmount = input.igstAmount;
    if (input.taxableAmount !== undefined) newItem.taxableAmount = input.taxableAmount;
    if (input.vendorGstin) newItem.vendorGstin = input.vendorGstin;
    if (input.ourGstinUsed !== undefined) newItem.ourGstinUsed = input.ourGstinUsed;

    // Add location fields only if they have values
    if (input.fromLocation) newItem.fromLocation = input.fromLocation;
    if (input.toLocation) newItem.toLocation = input.toLocation;

    const updatedItems = [...report.items, newItem];
    const categoryTotals = calculateCategoryTotals(updatedItems);
    const { totalAmount, totalGstAmount } = calculateTotals(updatedItems);

    const docRef = doc(db, COLLECTIONS.HR_TRAVEL_EXPENSES, reportId);
    await updateDoc(docRef, {
      items: updatedItems,
      categoryTotals,
      totalAmount,
      totalGstAmount,
      updatedAt: Timestamp.now(),
    });

    logger.info('Added expense item', { reportId, itemId, category: input.category });

    return itemId;
  } catch (error) {
    logger.error('Failed to add expense item', { reportId, error });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to add expense item');
  }
}

/**
 * Update an expense item
 */
export async function updateExpenseItem(
  reportId: string,
  itemId: string,
  updates: Partial<TravelExpenseItemInput>,
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const report = await getTravelExpenseReport(reportId);

    if (!report) {
      throw new Error('Travel expense report not found');
    }

    if (report.status !== 'DRAFT') {
      throw new Error('Can only update items in reports in DRAFT status');
    }

    if (report.employeeId !== userId) {
      throw new Error('You can only modify your own travel expense reports');
    }

    const itemIndex = report.items.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
      throw new Error('Expense item not found');
    }

    const existingItem = report.items[itemIndex]!;
    const updatedItem: TravelExpenseItem = {
      id: existingItem.id,
      category: updates.category ?? existingItem.category,
      description: updates.description ?? existingItem.description,
      expenseDate: updates.expenseDate
        ? Timestamp.fromDate(updates.expenseDate)
        : existingItem.expenseDate,
      amount: updates.amount ?? existingItem.amount,
      currency: updates.currency ?? existingItem.currency,
      hasReceipt: existingItem.hasReceipt,
      receiptAttachmentId: existingItem.receiptAttachmentId,
      receiptFileName: existingItem.receiptFileName,
      receiptUrl: existingItem.receiptUrl,
      vendorName: updates.vendorName !== undefined ? updates.vendorName : existingItem.vendorName,
      invoiceNumber:
        updates.invoiceNumber !== undefined ? updates.invoiceNumber : existingItem.invoiceNumber,
      // GST fields
      gstRate: updates.gstRate !== undefined ? updates.gstRate : existingItem.gstRate,
      gstAmount: updates.gstAmount !== undefined ? updates.gstAmount : existingItem.gstAmount,
      cgstAmount: updates.cgstAmount !== undefined ? updates.cgstAmount : existingItem.cgstAmount,
      sgstAmount: updates.sgstAmount !== undefined ? updates.sgstAmount : existingItem.sgstAmount,
      igstAmount: updates.igstAmount !== undefined ? updates.igstAmount : existingItem.igstAmount,
      taxableAmount:
        updates.taxableAmount !== undefined ? updates.taxableAmount : existingItem.taxableAmount,
      vendorGstin:
        updates.vendorGstin !== undefined ? updates.vendorGstin : existingItem.vendorGstin,
      ourGstinUsed:
        updates.ourGstinUsed !== undefined ? updates.ourGstinUsed : existingItem.ourGstinUsed,
      // Location fields
      fromLocation:
        updates.fromLocation !== undefined ? updates.fromLocation : existingItem.fromLocation,
      toLocation: updates.toLocation !== undefined ? updates.toLocation : existingItem.toLocation,
      isApproved: existingItem.isApproved,
      approvedAmount: existingItem.approvedAmount,
      rejectionReason: existingItem.rejectionReason,
    };

    const updatedItems = [...report.items];
    updatedItems[itemIndex] = updatedItem;

    const categoryTotals = calculateCategoryTotals(updatedItems);
    const { totalAmount, totalGstAmount } = calculateTotals(updatedItems);

    const docRef = doc(db, COLLECTIONS.HR_TRAVEL_EXPENSES, reportId);
    await updateDoc(docRef, {
      items: updatedItems,
      categoryTotals,
      totalAmount,
      totalGstAmount,
      updatedAt: Timestamp.now(),
    });

    logger.info('Updated expense item', { reportId, itemId });
  } catch (error) {
    logger.error('Failed to update expense item', { reportId, itemId, error });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to update expense item');
  }
}

/**
 * Remove an expense item from a report
 */
export async function removeExpenseItem(
  reportId: string,
  itemId: string,
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const report = await getTravelExpenseReport(reportId);

    if (!report) {
      throw new Error('Travel expense report not found');
    }

    if (report.status !== 'DRAFT') {
      throw new Error('Can only remove items from reports in DRAFT status');
    }

    if (report.employeeId !== userId) {
      throw new Error('You can only modify your own travel expense reports');
    }

    const updatedItems = report.items.filter((item) => item.id !== itemId);

    if (updatedItems.length === report.items.length) {
      throw new Error('Expense item not found');
    }

    const categoryTotals = calculateCategoryTotals(updatedItems);
    const { totalAmount, totalGstAmount } = calculateTotals(updatedItems);

    const docRef = doc(db, COLLECTIONS.HR_TRAVEL_EXPENSES, reportId);
    await updateDoc(docRef, {
      items: updatedItems,
      categoryTotals,
      totalAmount,
      totalGstAmount,
      updatedAt: Timestamp.now(),
    });

    logger.info('Removed expense item', { reportId, itemId });
  } catch (error) {
    logger.error('Failed to remove expense item', { reportId, itemId, error });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to remove expense item');
  }
}

/**
 * Update receipt attachment for an expense item
 */
export async function updateExpenseItemReceipt(
  reportId: string,
  itemId: string,
  receiptAttachmentId: string,
  receiptFileName: string,
  receiptUrl: string,
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const report = await getTravelExpenseReport(reportId);

    if (!report) {
      throw new Error('Travel expense report not found');
    }

    if (report.status !== 'DRAFT') {
      throw new Error('Can only update items in reports in DRAFT status');
    }

    if (report.employeeId !== userId) {
      throw new Error('You can only modify your own travel expense reports');
    }

    const itemIndex = report.items.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
      throw new Error('Expense item not found');
    }

    const existingItem = report.items[itemIndex]!;
    const updatedItems = [...report.items];
    updatedItems[itemIndex] = {
      ...existingItem,
      hasReceipt: true,
      receiptAttachmentId,
      receiptFileName,
      receiptUrl,
    };

    const docRef = doc(db, COLLECTIONS.HR_TRAVEL_EXPENSES, reportId);
    await updateDoc(docRef, {
      items: updatedItems,
      updatedAt: Timestamp.now(),
    });

    logger.info('Updated expense item receipt', { reportId, itemId, receiptAttachmentId });
  } catch (error) {
    logger.error('Failed to update expense item receipt', { reportId, itemId, error });
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to update expense item receipt');
  }
}
