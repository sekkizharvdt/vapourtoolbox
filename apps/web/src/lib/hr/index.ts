/**
 * HR Module Services
 *
 * Re-exports all HR-related services for easier imports.
 *
 * @example
 * ```typescript
 * import { createLeaveRequest, getLeaveTypes } from '@/lib/hr';
 * import { createTravelExpenseReport, addExpenseItem } from '@/lib/hr';
 * ```
 */

// Leave Management
export * from './leaves';

// Travel Expense Management
export * from './travelExpenses';
