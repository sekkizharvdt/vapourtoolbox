/**
 * Leave Management Services
 *
 * Re-exports all leave-related services for easier imports.
 */

// Leave Type Service
export {
  getLeaveTypes,
  getLeaveTypeById,
  getLeaveTypeByCode,
  createLeaveType,
  updateLeaveType,
  deactivateLeaveType,
  type CreateLeaveTypeInput,
  type UpdateLeaveTypeInput,
} from './leaveTypeService';

// Leave Balance Service
export {
  getCurrentFiscalYear,
  getUserLeaveBalances,
  getLeaveBalanceById,
  getUserLeaveBalanceByType,
  initializeUserLeaveBalances,
  updateLeaveBalance,
  addPendingLeave,
  confirmPendingLeave,
  removePendingLeave,
  getTeamLeaveBalances,
} from './leaveBalanceService';

// Leave Request Service
export {
  calculateLeaveDays,
  calculateLeaveDaysAsync,
  validateLeaveDates,
  createLeaveRequest,
  getLeaveRequestById,
  listLeaveRequests,
  getMyLeaveRequests,
  getPendingApprovalRequests,
  updateLeaveRequest,
  deleteLeaveRequest,
  getTeamCalendar,
  getUsersOnLeaveToday,
  type CreateLeaveRequestInput,
  type ListLeaveRequestsFilters,
} from './leaveRequestService';

// Leave Approval Service
export {
  submitLeaveRequest,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
} from './leaveApprovalService';

// Display Helpers
export {
  LEAVE_STATUS_COLORS,
  LEAVE_STATUS_LABELS,
  formatLeaveDate,
  formatLeaveDateTime,
  getLeaveStatusDisplay,
} from './displayHelpers';
