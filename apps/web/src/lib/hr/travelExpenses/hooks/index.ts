/**
 * Travel Expense Hooks
 *
 * Re-exports all travel expense React Query hooks.
 */

export {
  // Query hooks
  useTravelExpenseReport,
  useTravelExpenseReports,
  useMyTravelExpenseReports,
  usePendingApprovalTravelExpenses,
  // Mutation hooks
  useCreateTravelExpenseReport,
  useUpdateTravelExpenseReport,
  useDeleteTravelExpenseReport,
  // Expense item mutation hooks
  useAddExpenseItem,
  useUpdateExpenseItem,
  useRemoveExpenseItem,
  useUpdateExpenseItemReceipt,
  // Approval mutation hooks
  useSubmitTravelExpenseReport,
  useApproveTravelExpenseReport,
  useRejectTravelExpenseReport,
  useReturnTravelExpenseForRevision,
  useMarkTravelExpenseReimbursed,
  // Helpers
  useOptimisticTravelExpenseUpdate,
} from './useTravelExpenses';
