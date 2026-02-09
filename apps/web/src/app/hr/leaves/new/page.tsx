'use client';

import { useState, useEffect } from 'react';
import {
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Grid,
  Alert,
  TextField,
  FormControlLabel,
  Switch,
  MenuItem,
  Breadcrumbs,
  Link,
} from '@mui/material';
import { Save as SaveIcon, Send as SubmitIcon, Home as HomeIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import {
  getLeaveTypes,
  getUserLeaveBalances,
  createLeaveRequest,
  submitLeaveRequest,
  calculateLeaveDays,
  getCurrentFiscalYear,
  isRecurringHoliday,
  DEFAULT_RECURRING_CONFIG,
  getAllHolidaysInRange,
  type HolidayInfo,
} from '@/lib/hr';
import type { LeaveType, LeaveBalance } from '@vapour/types';

export default function NewLeaveRequestPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [companyHolidays, setCompanyHolidays] = useState<HolidayInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [excludedHolidays, setExcludedHolidays] = useState<HolidayInfo[]>([]);

  // Form state
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayType, setHalfDayType] = useState<'FIRST_HALF' | 'SECOND_HALF'>('FIRST_HALF');
  const [reason, setReason] = useState('');

  const selectedLeaveType = leaveTypes.find((t) => t.id === leaveTypeId);
  const selectedBalance = balances.find(
    (b) => selectedLeaveType && b.leaveTypeCode === selectedLeaveType.code
  );

  // Calculate days
  const calculatedDays =
    startDate && endDate ? calculateLeaveDays(startDate, endDate, isHalfDay) : 0;

  const fiscalYear = getCurrentFiscalYear();

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Load leave types, balances, and company holidays for the next year
      const today = new Date();
      const nextYear = new Date(today.getFullYear() + 1, 11, 31);

      const [typesData, balancesData, holidaysData] = await Promise.all([
        getLeaveTypes(),
        getUserLeaveBalances(user.uid, fiscalYear),
        getAllHolidaysInRange(today, nextYear),
      ]);

      setLeaveTypes(typesData);
      setBalances(balancesData);
      setCompanyHolidays(holidaysData.filter((h) => !h.isRecurring));

      // Pre-select first leave type
      if (typesData.length > 0 && !leaveTypeId && typesData[0]) {
        setLeaveTypeId(typesData[0].id);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Failed to load leave types. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Reset half day when not single day
  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);

      if (start.getTime() !== end.getTime() && isHalfDay) {
        setIsHalfDay(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  // Calculate excluded holidays when date range changes
  useEffect(() => {
    if (startDate && endDate) {
      const holidays: HolidayInfo[] = [];
      const current = new Date(startDate);
      current.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(0, 0, 0, 0);

      while (current <= end) {
        // Check recurring holidays
        if (isRecurringHoliday(current, DEFAULT_RECURRING_CONFIG)) {
          const dayOfWeek = current.getDay();
          const dayOfMonth = current.getDate();
          let label = 'Sunday';
          if (dayOfWeek === 6) {
            if (dayOfMonth <= 7) label = '1st Saturday';
            else if (dayOfMonth >= 15 && dayOfMonth <= 21) label = '3rd Saturday';
          }
          holidays.push({
            date: new Date(current),
            name: label,
            type: 'RECURRING',
            isRecurring: true,
          });
        } else {
          // Check company holidays
          const dateKey = current.toISOString().split('T')[0];
          const companyHoliday = companyHolidays.find(
            (h) => h.date.toISOString().split('T')[0] === dateKey
          );
          if (companyHoliday) {
            holidays.push(companyHoliday);
          }
        }
        current.setDate(current.getDate() + 1);
      }

      setExcludedHolidays(holidays);
    } else {
      setExcludedHolidays([]);
    }
  }, [startDate, endDate, companyHolidays]);

  // Function to determine if a date should be disabled
  const shouldDisableDate = (day: Date | { toDate(): Date }): boolean => {
    // Handle both Date and Dayjs objects
    const date = 'toDate' in day ? day.toDate() : day;

    // Check recurring holidays (Sundays, 1st/3rd Saturdays)
    if (isRecurringHoliday(date, DEFAULT_RECURRING_CONFIG)) {
      return true;
    }

    // Check company holidays
    const dateKey = date.toISOString().split('T')[0];
    const isCompanyHoliday = companyHolidays.some(
      (h) => h.date.toISOString().split('T')[0] === dateKey
    );
    return isCompanyHoliday;
  };

  const handleSave = async (submitForApproval = false) => {
    if (!user || !selectedLeaveType || !startDate || !endDate) {
      setError('Please fill in all required fields');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for your leave');
      return;
    }

    if (selectedBalance && calculatedDays > selectedBalance.available) {
      setError(
        `Insufficient ${selectedLeaveType.name} balance. Available: ${selectedBalance.available} days`
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const result = await createLeaveRequest(
        {
          leaveTypeCode: selectedLeaveType.code,
          startDate,
          endDate,
          isHalfDay,
          halfDayType: isHalfDay ? halfDayType : undefined,
          reason,
        },
        user.uid,
        user.displayName || 'User',
        user.email || ''
      );

      if (submitForApproval) {
        await submitLeaveRequest(result.requestId, user.uid, user.displayName || 'User');
      }

      router.push(`/hr/leaves/${result.requestId}`);
    } catch (err) {
      console.error('Failed to create leave request:', err);
      setError(err instanceof Error ? err.message : 'Failed to create leave request');
    } finally {
      setSaving(false);
    }
  };

  const isSingleDay =
    startDate &&
    endDate &&
    new Date(startDate).setHours(0, 0, 0, 0) === new Date(endDate).setHours(0, 0, 0, 0);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ maxWidth: 'md', mx: 'auto' }}>
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            color="inherit"
            href="/hr"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              router.push('/hr');
            }}
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
            HR
          </Link>
          <Link
            color="inherit"
            href="/hr/leaves/my-leaves"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              router.push('/hr/leaves/my-leaves');
            }}
            sx={{ cursor: 'pointer' }}
          >
            My Leaves
          </Link>
          <Typography color="text.primary">New Leave Request</Typography>
        </Breadcrumbs>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" component="h1">
            Apply for Leave
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card>
          <CardContent>
            <Grid container spacing={3}>
              {/* Leave Type */}
              <Grid size={{ xs: 12 }}>
                <TextField
                  select
                  label="Leave Type"
                  fullWidth
                  value={leaveTypeId}
                  onChange={(e) => setLeaveTypeId(e.target.value)}
                  disabled={loading || leaveTypes.length === 0}
                  helperText={
                    selectedBalance
                      ? `Available: ${selectedBalance.available} days | Used: ${selectedBalance.used} days`
                      : 'No balance found for this leave type'
                  }
                >
                  {leaveTypes.map((type) => (
                    <MenuItem key={type.id} value={type.id}>
                      {type.name}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              {/* Date Range */}
              <Grid size={{ xs: 12, sm: 6 }}>
                <DatePicker
                  label="Start Date"
                  value={startDate}
                  onChange={(newValue) => {
                    const date = newValue as Date | null;
                    setStartDate(date);
                    if (!endDate || (date && endDate < date)) {
                      setEndDate(date);
                    }
                  }}
                  shouldDisableDate={shouldDisableDate}
                  format="dd/MM/yyyy"
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true,
                      helperText: 'Sundays and 1st/3rd Saturdays are disabled',
                    },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={(newValue) => setEndDate(newValue as Date | null)}
                  shouldDisableDate={shouldDisableDate}
                  format="dd/MM/yyyy"
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true,
                    },
                  }}
                  minDate={startDate ?? undefined}
                />
              </Grid>

              {/* Half Day Option */}
              {isSingleDay && selectedLeaveType?.allowHalfDay && (
                <>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={isHalfDay}
                          onChange={(e) => setIsHalfDay(e.target.checked)}
                        />
                      }
                      label="Half Day Leave"
                    />
                  </Grid>
                  {isHalfDay && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        select
                        label="Half Day Type"
                        fullWidth
                        value={halfDayType}
                        onChange={(e) =>
                          setHalfDayType(e.target.value as 'FIRST_HALF' | 'SECOND_HALF')
                        }
                      >
                        <MenuItem value="FIRST_HALF">First Half (Morning)</MenuItem>
                        <MenuItem value="SECOND_HALF">Second Half (Afternoon)</MenuItem>
                      </TextField>
                    </Grid>
                  )}
                </>
              )}

              {/* Summary */}
              {startDate && endDate && (
                <Grid size={{ xs: 12 }}>
                  <Alert severity="info">
                    <Box>
                      <Typography component="span">
                        Total Leave Days: <strong>{calculatedDays}</strong>
                        {isHalfDay && ' (Half Day)'}
                      </Typography>
                      {excludedHolidays.length > 0 && (
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {excludedHolidays.length} holiday{excludedHolidays.length > 1 ? 's' : ''}{' '}
                          excluded: {excludedHolidays.map((h) => h.name).join(', ')}
                        </Typography>
                      )}
                      {selectedBalance && calculatedDays > selectedBalance.available && (
                        <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>
                          Exceeds available balance!
                        </Typography>
                      )}
                    </Box>
                  </Alert>
                </Grid>
              )}

              {/* Reason */}
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Reason for Leave"
                  fullWidth
                  multiline
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  placeholder="Please provide a reason for your leave request..."
                />
              </Grid>

              {/* Actions */}
              <Grid size={{ xs: 12 }}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button
                    variant="outlined"
                    startIcon={<SaveIcon />}
                    onClick={() => handleSave(false)}
                    disabled={saving || !startDate || !endDate || !reason.trim()}
                  >
                    Save as Draft
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<SubmitIcon />}
                    onClick={() => handleSave(true)}
                    disabled={saving || !startDate || !endDate || !reason.trim()}
                  >
                    {saving ? 'Submitting...' : 'Submit for Approval'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>
    </LocalizationProvider>
  );
}
