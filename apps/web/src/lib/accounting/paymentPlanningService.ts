/**
 * Payment Planning Service
 *
 * Provides cash flow forecasting by combining:
 * 1. Outstanding customer invoices (expected receipts)
 * 2. Outstanding vendor bills (expected payments)
 * 3. Upcoming recurring transactions
 * 4. Manual cash flow entries
 */

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
  orderBy,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type {
  ManualCashFlowItem,
  ManualCashFlowCategory,
  CashFlowDirection,
  ForecastItem,
  ForecastOptions,
  CashFlowForecast,
  CashFlowSummary,
  DailyForecast,
  WeeklyForecast,
  ForecastConfidence,
  PaymentRiskStatus,
} from '@vapour/types';
import { getUpcomingOccurrences } from './recurringTransactionService';

// Re-export CashFlowSummary for consumers
export type { CashFlowSummary } from '@vapour/types';

// ============================================
// Manual Cash Flow Item CRUD
// ============================================

/**
 * Create a new manual cash flow item
 */
export async function createManualCashFlowItem(
  db: Firestore,
  item: Omit<ManualCashFlowItem, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const now = Timestamp.now();

  const docData = {
    ...item,
    expectedDate:
      item.expectedDate instanceof Date ? Timestamp.fromDate(item.expectedDate) : item.expectedDate,
    recurrenceEndDate: item.recurrenceEndDate
      ? item.recurrenceEndDate instanceof Date
        ? Timestamp.fromDate(item.recurrenceEndDate)
        : item.recurrenceEndDate
      : null,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.MANUAL_CASH_FLOW_ITEMS), docData);
  return docRef.id;
}

/**
 * Update a manual cash flow item
 */
export async function updateManualCashFlowItem(
  db: Firestore,
  id: string,
  updates: Partial<Omit<ManualCashFlowItem, 'id' | 'createdAt' | 'createdBy'>>
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.MANUAL_CASH_FLOW_ITEMS, id);

  const updateData: Record<string, unknown> = {
    ...updates,
    updatedAt: Timestamp.now(),
  };

  if (updates.expectedDate) {
    updateData.expectedDate =
      updates.expectedDate instanceof Date
        ? Timestamp.fromDate(updates.expectedDate)
        : updates.expectedDate;
  }

  if (updates.recurrenceEndDate) {
    updateData.recurrenceEndDate =
      updates.recurrenceEndDate instanceof Date
        ? Timestamp.fromDate(updates.recurrenceEndDate)
        : updates.recurrenceEndDate;
  }

  await updateDoc(docRef, updateData);
}

/**
 * Delete a manual cash flow item
 */
export async function deleteManualCashFlowItem(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS.MANUAL_CASH_FLOW_ITEMS, id));
}

/**
 * Get all manual cash flow items
 */
export async function getManualCashFlowItems(
  db: Firestore,
  options?: {
    direction?: CashFlowDirection;
    status?: ManualCashFlowItem['status'];
    startDate?: Date;
    endDate?: Date;
  }
): Promise<ManualCashFlowItem[]> {
  const q = query(
    collection(db, COLLECTIONS.MANUAL_CASH_FLOW_ITEMS),
    orderBy('expectedDate', 'asc')
  );

  // Note: Firestore doesn't support multiple inequality filters
  // So we filter in memory for complex queries

  const snapshot = await getDocs(q);
  let items: ManualCashFlowItem[] = snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    const item: ManualCashFlowItem = {
      id: docSnap.id,
      name: data.name ?? '',
      direction: data.direction ?? 'OUTFLOW',
      category: data.category ?? 'OTHER_EXPENSE',
      amount: data.amount ?? 0,
      currency: data.currency ?? 'INR',
      isRecurring: data.isRecurring ?? false,
      status: data.status ?? 'PLANNED',
      createdBy: data.createdBy ?? '',
      description: data.description,
      recurrenceFrequency: data.recurrenceFrequency,
      entityId: data.entityId,
      entityName: data.entityName,
      projectId: data.projectId,
      projectName: data.projectName,
      completedTransactionId: data.completedTransactionId,
      notes: data.notes,
      expectedDate: data.expectedDate?.toDate?.() ?? data.expectedDate,
      recurrenceEndDate: data.recurrenceEndDate?.toDate?.() ?? data.recurrenceEndDate,
      createdAt: data.createdAt?.toDate?.() ?? data.createdAt,
      updatedAt: data.updatedAt?.toDate?.() ?? data.updatedAt,
    };
    return item;
  });

  // Apply filters in memory
  if (options?.direction) {
    items = items.filter((item) => item.direction === options.direction);
  }

  if (options?.status) {
    items = items.filter((item) => item.status === options.status);
  }

  if (options?.startDate) {
    items = items.filter((item) => {
      const date = item.expectedDate instanceof Date ? item.expectedDate : new Date();
      return date >= options.startDate!;
    });
  }

  if (options?.endDate) {
    items = items.filter((item) => {
      const date = item.expectedDate instanceof Date ? item.expectedDate : new Date();
      return date <= options.endDate!;
    });
  }

  return items;
}

// ============================================
// Forecast Generation
// ============================================

/**
 * Get outstanding invoices (expected receipts)
 */
async function getOutstandingInvoices(
  db: Firestore,
  _startDate: Date,
  _endDate: Date
): Promise<ForecastItem[]> {
  const q = query(
    collection(db, COLLECTIONS.TRANSACTIONS),
    where('type', '==', 'CUSTOMER_INVOICE'),
    where('paymentStatus', 'in', ['UNPAID', 'PARTIALLY_PAID'])
  );

  const snapshot = await getDocs(q);
  const items: ForecastItem[] = [];
  const today = new Date();

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (data.isDeleted) continue; // Skip soft-deleted transactions
    const dueDate = data.dueDate?.toDate?.() ?? data.date?.toDate?.() ?? today;
    const amount = (data.totalAmount ?? data.amount ?? 0) - (data.paidAmount ?? 0);

    if (amount <= 0) continue;

    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const daysOverdue = daysUntilDue < 0 ? Math.abs(daysUntilDue) : 0;

    items.push({
      id: `invoice-${docSnap.id}`,
      source: 'INVOICE',
      sourceId: docSnap.id,
      sourceReference: data.transactionNumber || data.invoiceNumber || 'Invoice',
      direction: 'INFLOW',
      entityId: data.entityId,
      entityName: data.entityName || data.customerName,
      amount,
      currency: data.currency || 'INR',
      expectedDate: dueDate,
      dueDate,
      confidence: calculateConfidence(daysOverdue),
      riskStatus: calculateRiskStatus(daysUntilDue),
      daysUntilDue: Math.max(0, daysUntilDue),
      daysOverdue,
    });
  }

  return items;
}

/**
 * Get outstanding bills (expected payments)
 */
async function getOutstandingBills(
  db: Firestore,
  _startDate: Date,
  _endDate: Date
): Promise<ForecastItem[]> {
  const q = query(
    collection(db, COLLECTIONS.TRANSACTIONS),
    where('type', '==', 'VENDOR_BILL'),
    where('paymentStatus', 'in', ['UNPAID', 'PARTIALLY_PAID'])
  );

  const snapshot = await getDocs(q);
  const items: ForecastItem[] = [];
  const today = new Date();

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (data.isDeleted) continue; // Skip soft-deleted transactions
    const dueDate = data.dueDate?.toDate?.() ?? data.date?.toDate?.() ?? today;
    const amount = (data.totalAmount ?? data.amount ?? 0) - (data.paidAmount ?? 0);

    if (amount <= 0) continue;

    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const daysOverdue = daysUntilDue < 0 ? Math.abs(daysUntilDue) : 0;

    items.push({
      id: `bill-${docSnap.id}`,
      source: 'BILL',
      sourceId: docSnap.id,
      sourceReference: data.transactionNumber || data.billNumber || 'Bill',
      direction: 'OUTFLOW',
      entityId: data.entityId,
      entityName: data.entityName || data.vendorName,
      amount,
      currency: data.currency || 'INR',
      expectedDate: dueDate,
      dueDate,
      confidence: 'HIGH', // Bills are typically more certain
      riskStatus: calculateRiskStatus(daysUntilDue),
      daysUntilDue: Math.max(0, daysUntilDue),
      daysOverdue,
    });
  }

  return items;
}

/**
 * Get upcoming recurring transactions as forecast items
 */
async function getRecurringForecastItems(
  db: Firestore,
  startDate: Date,
  endDate: Date
): Promise<ForecastItem[]> {
  const occurrences = await getUpcomingOccurrences(db, startDate, endDate);
  const items: ForecastItem[] = [];
  const today = new Date();

  for (const occ of occurrences) {
    // Skip non-pending occurrences
    if (occ.status !== 'PENDING') continue;

    const scheduledDate = occ.scheduledDate as Timestamp;
    const expectedDate = scheduledDate.toDate();

    const daysUntilDue = Math.ceil(
      (expectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Determine direction based on recurring transaction type
    const direction: CashFlowDirection = occ.type === 'CUSTOMER_INVOICE' ? 'INFLOW' : 'OUTFLOW';

    // Use finalAmount (after any modifications) for the forecast
    const amount = occ.finalAmount?.amount ?? occ.originalAmount?.amount ?? 0;
    const currency = occ.finalAmount?.currency ?? occ.originalAmount?.currency ?? 'INR';

    items.push({
      id: `recurring-${occ.id}`,
      source: 'RECURRING',
      sourceId: occ.recurringTransactionId,
      sourceReference: occ.recurringTransactionName || `Recurring #${occ.occurrenceNumber}`,
      direction,
      amount,
      currency,
      expectedDate,
      confidence: 'HIGH', // Recurring transactions are predictable
      riskStatus: 'ON_SCHEDULE',
      daysUntilDue: Math.max(0, daysUntilDue),
      daysOverdue: 0,
    });
  }

  return items;
}

/**
 * Get manual cash flow items as forecast items
 */
async function getManualForecastItems(
  db: Firestore,
  startDate: Date,
  endDate: Date
): Promise<ForecastItem[]> {
  const manualItems = await getManualCashFlowItems(db, {
    status: 'PLANNED',
    startDate,
    endDate,
  });

  const today = new Date();

  return manualItems.map((item) => {
    const expectedDate =
      item.expectedDate instanceof Date ? item.expectedDate : new Date(String(item.expectedDate));
    const daysUntilDue = Math.ceil(
      (expectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      id: `manual-${item.id}`,
      source: 'MANUAL' as const,
      sourceId: item.id,
      sourceReference: item.name,
      direction: item.direction,
      category: item.category,
      entityId: item.entityId,
      entityName: item.entityName,
      amount: item.amount,
      currency: item.currency,
      expectedDate,
      confidence: 'MEDIUM' as const, // Manual entries have medium confidence
      riskStatus: 'ON_SCHEDULE' as const,
      daysUntilDue: Math.max(0, daysUntilDue),
      daysOverdue: 0,
      notes: item.notes,
    };
  });
}

/**
 * Calculate confidence based on days overdue
 */
function calculateConfidence(daysOverdue: number): ForecastConfidence {
  if (daysOverdue === 0) return 'HIGH';
  if (daysOverdue <= 30) return 'MEDIUM';
  return 'LOW';
}

/**
 * Calculate risk status based on days until due
 */
function calculateRiskStatus(daysUntilDue: number): PaymentRiskStatus {
  if (daysUntilDue < 0) return 'OVERDUE';
  if (daysUntilDue <= 7) return 'AT_RISK';
  return 'ON_SCHEDULE';
}

/**
 * Generate complete cash flow forecast
 */
export async function generateCashFlowForecast(
  db: Firestore,
  options: ForecastOptions
): Promise<CashFlowForecast> {
  const { startDate, endDate } = options;
  const today = new Date();

  // Collect all forecast items
  const allItems: ForecastItem[] = [];

  if (options.includeInvoices !== false) {
    const invoices = await getOutstandingInvoices(db, startDate, endDate);
    allItems.push(...invoices);
  }

  if (options.includeBills !== false) {
    const bills = await getOutstandingBills(db, startDate, endDate);
    allItems.push(...bills);
  }

  if (options.includeRecurring !== false) {
    const recurring = await getRecurringForecastItems(db, startDate, endDate);
    allItems.push(...recurring);
  }

  if (options.includeManual !== false) {
    const manual = await getManualForecastItems(db, startDate, endDate);
    allItems.push(...manual);
  }

  // Filter by date range
  const filteredItems = allItems.filter((item) => {
    const date = item.expectedDate;
    if (options.includeOverdue && date < startDate) return true;
    return date >= startDate && date <= endDate;
  });

  // Sort by date
  filteredItems.sort((a, b) => a.expectedDate.getTime() - b.expectedDate.getTime());

  // Calculate opening balance (simplified - would normally come from bank accounts)
  const openingBalance = options.openingBalance ?? 0;

  // Build daily forecasts
  const dailyForecasts = buildDailyForecasts(filteredItems, startDate, endDate, openingBalance);

  // Build weekly forecasts
  const weeklyForecasts = buildWeeklyForecasts(dailyForecasts);

  // Calculate totals
  const totalProjectedReceipts = filteredItems
    .filter((item) => item.direction === 'INFLOW')
    .reduce((sum, item) => sum + item.amount, 0);

  const totalProjectedPayments = filteredItems
    .filter((item) => item.direction === 'OUTFLOW')
    .reduce((sum, item) => sum + item.amount, 0);

  // Calculate by source
  const receiptsBySource = {
    invoices: filteredItems
      .filter((item) => item.source === 'INVOICE')
      .reduce((sum, item) => sum + item.amount, 0),
    recurring: filteredItems
      .filter((item) => item.source === 'RECURRING' && item.direction === 'INFLOW')
      .reduce((sum, item) => sum + item.amount, 0),
    manual: filteredItems
      .filter((item) => item.source === 'MANUAL' && item.direction === 'INFLOW')
      .reduce((sum, item) => sum + item.amount, 0),
  };

  const paymentsBySource = {
    bills: filteredItems
      .filter((item) => item.source === 'BILL')
      .reduce((sum, item) => sum + item.amount, 0),
    recurring: filteredItems
      .filter((item) => item.source === 'RECURRING' && item.direction === 'OUTFLOW')
      .reduce((sum, item) => sum + item.amount, 0),
    manual: filteredItems
      .filter((item) => item.source === 'MANUAL' && item.direction === 'OUTFLOW')
      .reduce((sum, item) => sum + item.amount, 0),
  };

  // Risk analysis
  const overdueReceivables = filteredItems
    .filter((item) => item.direction === 'INFLOW' && item.daysOverdue > 0)
    .reduce((sum, item) => sum + item.amount, 0);

  const overduePayables = filteredItems
    .filter((item) => item.direction === 'OUTFLOW' && item.daysOverdue > 0)
    .reduce((sum, item) => sum + item.amount, 0);

  const atRiskItems = filteredItems.filter((item) => item.riskStatus !== 'ON_SCHEDULE');

  const netForecastedCashFlow = totalProjectedReceipts - totalProjectedPayments;
  const projectedClosingBalance = openingBalance + netForecastedCashFlow;

  return {
    generatedAt: today,
    forecastStartDate: startDate,
    forecastEndDate: endDate,
    forecastDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
    currency: 'INR',
    openingCashBalance: openingBalance,
    dailyForecasts,
    weeklyForecasts,
    totalProjectedReceipts,
    totalProjectedPayments,
    netForecastedCashFlow,
    projectedClosingBalance,
    receiptsBySource,
    paymentsBySource,
    overdueReceivables,
    overduePayables,
    atRiskItems,
    allItems: filteredItems,
  };
}

/**
 * Build daily forecast breakdown
 */
function buildDailyForecasts(
  items: ForecastItem[],
  startDate: Date,
  endDate: Date,
  openingBalance: number
): DailyForecast[] {
  const dailyForecasts: DailyForecast[] = [];
  let runningBalance = openingBalance;

  // Create a map of items by date
  const itemsByDate = new Map<string, ForecastItem[]>();
  for (const item of items) {
    const dateKey = item.expectedDate.toISOString().split('T')[0] ?? '';
    if (!itemsByDate.has(dateKey)) {
      itemsByDate.set(dateKey, []);
    }
    const dateItems = itemsByDate.get(dateKey);
    if (dateItems) {
      dateItems.push(item);
    }
  }

  // Iterate through each day in the range
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split('T')[0] ?? '';
    const dayItems = itemsByDate.get(dateKey) || [];

    const receipts = dayItems.filter((item) => item.direction === 'INFLOW');
    const payments = dayItems.filter((item) => item.direction === 'OUTFLOW');

    const projectedReceipts = receipts.reduce((sum, item) => sum + item.amount, 0);
    const projectedPayments = payments.reduce((sum, item) => sum + item.amount, 0);
    const netCashFlow = projectedReceipts - projectedPayments;

    const openingBalanceForDay = runningBalance;
    runningBalance += netCashFlow;

    dailyForecasts.push({
      date: new Date(currentDate),
      projectedReceipts,
      projectedPayments,
      netCashFlow,
      openingBalance: openingBalanceForDay,
      closingBalance: runningBalance,
      receiptsCount: receipts.length,
      paymentsCount: payments.length,
      items: dayItems,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dailyForecasts;
}

/**
 * Build weekly forecast summary
 */
function buildWeeklyForecasts(dailyForecasts: DailyForecast[]): WeeklyForecast[] {
  const weeklyForecasts: WeeklyForecast[] = [];

  if (dailyForecasts.length === 0) return weeklyForecasts;

  const firstDay = dailyForecasts[0];
  if (!firstDay) return weeklyForecasts;

  let currentWeekStart = new Date(firstDay.date);
  // Move to start of week (Sunday)
  currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());

  let weekNumber = 1;
  let currentWeekDays: DailyForecast[] = [];

  for (const daily of dailyForecasts) {
    const dayStart = new Date(daily.date);
    dayStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    if (dayStart > weekEnd) {
      // Save current week and start new one
      if (currentWeekDays.length > 0) {
        weeklyForecasts.push(summarizeWeek(currentWeekDays, weekNumber, currentWeekStart));
      }
      weekNumber++;
      currentWeekStart = new Date(dayStart);
      currentWeekStart.setDate(currentWeekStart.getDate() - currentWeekStart.getDay());
      currentWeekDays = [];
    }

    currentWeekDays.push(daily);
  }

  // Don't forget the last week
  if (currentWeekDays.length > 0) {
    weeklyForecasts.push(summarizeWeek(currentWeekDays, weekNumber, currentWeekStart));
  }

  return weeklyForecasts;
}

function summarizeWeek(days: DailyForecast[], weekNumber: number, weekStart: Date): WeeklyForecast {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  let invoicesDue = 0;
  let billsDue = 0;
  let recurringItems = 0;
  let manualItems = 0;

  for (const day of days) {
    for (const item of day.items) {
      switch (item.source) {
        case 'INVOICE':
          invoicesDue++;
          break;
        case 'BILL':
          billsDue++;
          break;
        case 'RECURRING':
          recurringItems++;
          break;
        case 'MANUAL':
          manualItems++;
          break;
      }
    }
  }

  return {
    weekStartDate: weekStart,
    weekEndDate: weekEnd,
    weekNumber,
    totalReceipts: days.reduce((sum, d) => sum + d.projectedReceipts, 0),
    totalPayments: days.reduce((sum, d) => sum + d.projectedPayments, 0),
    netCashFlow: days.reduce((sum, d) => sum + d.netCashFlow, 0),
    invoicesDue,
    billsDue,
    recurringItems,
    manualItems,
  };
}

/**
 * Get quick summary for dashboard
 */
export async function getCashFlowSummary(
  db: Firestore,
  currentBalance?: number
): Promise<CashFlowSummary> {
  const today = new Date();
  const next7Days = new Date(today);
  next7Days.setDate(next7Days.getDate() + 7);
  const next30Days = new Date(today);
  next30Days.setDate(next30Days.getDate() + 30);

  // Get 30-day forecast
  const forecast = await generateCashFlowForecast(db, {
    startDate: today,
    endDate: next30Days,
    includeOverdue: true,
    includeInvoices: true,
    includeBills: true,
    includeRecurring: true,
    includeManual: true,
    openingBalance: currentBalance ?? 0,
  });

  // Calculate 7-day totals
  const next7DaysReceipts = forecast.dailyForecasts
    .filter((d) => d.date <= next7Days)
    .reduce((sum, d) => sum + d.projectedReceipts, 0);

  const next7DaysPayments = forecast.dailyForecasts
    .filter((d) => d.date <= next7Days)
    .reduce((sum, d) => sum + d.projectedPayments, 0);

  // Get projected balance at day 7
  const day7Forecast = forecast.dailyForecasts.find(
    (d) => d.date.toDateString() === next7Days.toDateString()
  );

  // Count overdue items
  const overdueReceivablesCount = forecast.allItems.filter(
    (item) => item.direction === 'INFLOW' && item.daysOverdue > 0
  ).length;

  const overduePayablesCount = forecast.allItems.filter(
    (item) => item.direction === 'OUTFLOW' && item.daysOverdue > 0
  ).length;

  const upcomingRecurringCount = forecast.allItems.filter(
    (item) => item.source === 'RECURRING'
  ).length;

  return {
    currentBalance: currentBalance ?? 0,
    next7DaysReceipts,
    next7DaysPayments,
    next7DaysNet: next7DaysReceipts - next7DaysPayments,
    next30DaysReceipts: forecast.totalProjectedReceipts,
    next30DaysPayments: forecast.totalProjectedPayments,
    next30DaysNet: forecast.netForecastedCashFlow,
    overdueReceivablesCount,
    overduePayablesCount,
    upcomingRecurringCount,
    projectedBalance7Days:
      day7Forecast?.closingBalance ??
      (currentBalance ?? 0) + (next7DaysReceipts - next7DaysPayments),
    projectedBalance30Days: forecast.projectedClosingBalance,
  };
}

/**
 * Get category display label
 */
export function getCategoryLabel(category: ManualCashFlowCategory): string {
  const labels: Record<ManualCashFlowCategory, string> = {
    PROJECT_RECEIPT: 'Project Receipt',
    LOAN_RECEIPT: 'Loan Received',
    INTEREST_INCOME: 'Interest Income',
    OTHER_INCOME: 'Other Income',
    SALARY_WAGES: 'Salary & Wages',
    RENT_LEASE: 'Rent / Lease',
    UTILITIES: 'Utilities',
    LOAN_REPAYMENT: 'Loan Repayment',
    TAX_PAYMENT: 'Tax Payment',
    VENDOR_PAYMENT: 'Vendor Payment',
    CAPITAL_EXPENSE: 'Capital Expense',
    OTHER_EXPENSE: 'Other Expense',
  };
  return labels[category] || category;
}

/**
 * Get categories by direction
 */
export function getCategoriesByDirection(direction: CashFlowDirection): ManualCashFlowCategory[] {
  if (direction === 'INFLOW') {
    return ['PROJECT_RECEIPT', 'LOAN_RECEIPT', 'INTEREST_INCOME', 'OTHER_INCOME'];
  }
  return [
    'SALARY_WAGES',
    'RENT_LEASE',
    'UTILITIES',
    'LOAN_REPAYMENT',
    'TAX_PAYMENT',
    'VENDOR_PAYMENT',
    'CAPITAL_EXPENSE',
    'OTHER_EXPENSE',
  ];
}
