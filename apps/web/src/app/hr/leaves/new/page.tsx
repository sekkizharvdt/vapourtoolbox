'use client';

import { useState, useEffect } from 'react';
import {
  Container,
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
} from '@mui/material';
import { ArrowBack as BackIcon, Save as SaveIcon, Send as SubmitIcon } from '@mui/icons-material';
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
} from '@/lib/hr';
import type { LeaveType, LeaveBalance } from '@vapour/types';

export default function NewLeaveRequestPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const [typesData, balancesData] = await Promise.all([
        getLeaveTypes(),
        getUserLeaveBalances(user.uid, fiscalYear),
      ]);

      setLeaveTypes(typesData);
      setBalances(balancesData);

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
      <Container maxWidth="md">
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<BackIcon />} onClick={() => router.back()}>
            Back
          </Button>
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
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true,
                    },
                  }}
                  minDate={new Date()}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={(newValue) => setEndDate(newValue as Date | null)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true,
                    },
                  }}
                  minDate={startDate || new Date()}
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
                    Total Leave Days: <strong>{calculatedDays}</strong>
                    {isHalfDay && ' (Half Day)'}
                    {selectedBalance && calculatedDays > selectedBalance.available && (
                      <Typography variant="body2" color="error" component="span" sx={{ ml: 2 }}>
                        Exceeds available balance!
                      </Typography>
                    )}
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
      </Container>
    </LocalizationProvider>
  );
}
