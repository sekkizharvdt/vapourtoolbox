/**
 * Holiday Module Exports
 *
 * Re-exports all holiday-related services and utilities.
 */

// Recurring holiday calculator
export {
  DEFAULT_RECURRING_CONFIG,
  isSunday,
  isFirstSaturday,
  isThirdSaturday,
  isSecondSaturday,
  isFourthSaturday,
  isRecurringHoliday,
  getRecurringHolidayLabel,
  getRecurringHolidaysForMonth,
  getRecurringHolidaysInRange,
  countRecurringHolidaysInRange,
  getSaturdaysInMonth,
} from './recurringHolidayCalculator';

// Holiday service
export type { CreateHolidayInput, UpdateHolidayInput, HolidayInfo } from './holidayService';

export {
  createHoliday,
  getHolidayById,
  updateHoliday,
  deleteHoliday,
  hardDeleteHoliday,
  getHolidaysForYear,
  getAllHolidays,
  getCompanyHolidaysInRange,
  getAllHolidaysInRange,
  isHoliday,
  getHolidaysInLeaveRange,
  countWorkingDays,
  copyHolidaysToYear,
} from './holidayService';

// Holiday working override service
export {
  createHolidayWorkingOverride,
  processHolidayWorkingOverride,
  getHolidayWorkingOverrideById,
  listHolidayWorkingOverrides,
  getHolidayWorkingHistory,
  isHolidayConvertedToWorkingDay,
} from './holidayWorkingService';
