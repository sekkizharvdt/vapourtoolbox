/**
 * Travel Expense Management Services
 *
 * Re-exports all travel expense services for easier imports.
 */

// Travel Expense Service
export {
  createTravelExpenseReport,
  getTravelExpenseReport,
  listTravelExpenseReports,
  getMyTravelExpenseReports,
  getPendingApprovalReports,
  updateTravelExpenseReport,
  deleteTravelExpenseReport,
  addExpenseItem,
  updateExpenseItem,
  removeExpenseItem,
  updateExpenseItemReceipt,
} from './travelExpenseService';

// Approval Service
export {
  submitTravelExpenseReport,
  approveTravelExpenseReport,
  rejectTravelExpenseReport,
  returnTravelExpenseForRevision,
  markTravelExpenseReimbursed,
} from './travelExpenseApprovalService';

// PDF Report Service
export {
  generateTravelExpenseReportPDF,
  downloadTravelExpenseReportPDF,
  saveTravelExpenseReportPDF,
} from './pdfReportService';
export type { GeneratePDFOptions } from './pdfReportService';

// Receipt Utilities
export { fetchAllReceipts } from './receiptUtils';
export type { ReceiptData, FetchedReceipts } from './receiptUtils';

// PDF Merge Utilities
export { mergePdfWithReceipts } from './pdfMergeUtils';
export type { PdfReceiptData } from './pdfMergeUtils';

// Display Helpers
export {
  TRAVEL_EXPENSE_STATUS_COLORS,
  TRAVEL_EXPENSE_STATUS_LABELS,
  getTravelExpenseStatusDisplay,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_COLORS,
  EXPENSE_CATEGORY_ICONS,
  getExpenseCategoryDisplay,
  getExpenseCategoryOptions,
  formatExpenseDate,
  formatTripDateRange,
  formatExpenseDateTime,
  formatExpenseAmount,
  formatGstRate,
  calculateTripDays,
  formatTripDuration,
} from './displayHelpers';

// React Query Hooks
export {
  useTravelExpenseReport,
  useTravelExpenseReports,
  useMyTravelExpenseReports,
  usePendingApprovalTravelExpenses,
  useCreateTravelExpenseReport,
  useUpdateTravelExpenseReport,
  useDeleteTravelExpenseReport,
  useAddExpenseItem,
  useUpdateExpenseItem,
  useRemoveExpenseItem,
  useUpdateExpenseItemReceipt,
  useSubmitTravelExpenseReport,
  useApproveTravelExpenseReport,
  useRejectTravelExpenseReport,
  useReturnTravelExpenseForRevision,
  useMarkTravelExpenseReimbursed,
  useOptimisticTravelExpenseUpdate,
} from './hooks';
