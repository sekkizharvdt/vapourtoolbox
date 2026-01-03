'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  Typography,
  Box,
  Autocomplete,
  Chip,
  Alert,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import type { HolidayWorkingScope } from '@vapour/types';
import { collection, query, orderBy, getDocs, where } from 'firebase/firestore';
import { getFirebaseClient } from '@vapour/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { format, isSaturday, isSunday } from 'date-fns';

interface User {
  id: string;
  displayName: string;
  email: string;
}

interface DeclareWorkingDayDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    date: Date;
    name: string;
    scope: HolidayWorkingScope;
    affectedUserIds: string[];
    reason: string;
  }) => Promise<void>;
}

/**
 * Dialog for declaring any date (including Saturdays/Sundays) as a working day
 * and granting comp-off to affected users
 */
export default function DeclareWorkingDayDialog({
  open,
  onClose,
  onSubmit,
}: DeclareWorkingDayDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<HolidayWorkingScope>('ALL_USERS');
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [reason, setReason] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadUsers();
    } else {
      // Reset form when closed
      setSelectedDate(null);
      setName('');
      setScope('ALL_USERS');
      setSelectedUsers([]);
      setReason('');
      setError(null);
    }
  }, [open]);

  // Auto-generate name based on selected date
  useEffect(() => {
    if (selectedDate) {
      const formattedDate = format(selectedDate, 'dd MMM yyyy');

      if (isSunday(selectedDate)) {
        setName(`Working Sunday - ${formattedDate}`);
      } else if (isSaturday(selectedDate)) {
        setName(`Working Saturday - ${formattedDate}`);
      } else {
        setName(`Working Day - ${formattedDate}`);
      }
    }
  }, [selectedDate]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const { db } = getFirebaseClient();
      const usersRef = collection(db, COLLECTIONS.USERS);
      const q = query(usersRef, where('isActive', '==', true), orderBy('displayName', 'asc'));
      const snapshot = await getDocs(q);

      const userData: User[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        displayName: doc.data().displayName || 'Unknown',
        email: doc.data().email || '',
      }));

      setUsers(userData);
    } catch (err) {
      console.error('Failed to load users:', err);
      setError('Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!selectedDate) {
      setError('Please select a date');
      return;
    }

    if (!name.trim()) {
      setError('Please provide a name for this working day');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for declaring this as a working day');
      return;
    }

    if (scope === 'SPECIFIC_USERS' && selectedUsers.length === 0) {
      setError('Please select at least one user');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        date: selectedDate,
        name: name.trim(),
        scope,
        affectedUserIds: scope === 'ALL_USERS' ? [] : selectedUsers.map((u) => u.id),
        reason: reason.trim(),
      });

      onClose();
    } catch (err) {
      console.error('Failed to submit:', err);
      setError(err instanceof Error ? err.message : 'Failed to declare working day');
    } finally {
      setSubmitting(false);
    }
  };

  // Determine if the selected date is a weekend
  const isWeekend = selectedDate && (isSaturday(selectedDate) || isSunday(selectedDate));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Declare Working Day</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Declare any date (including Saturdays and Sundays) as a working day. Selected users will
            receive compensatory leave (comp-off) in their leave balance.
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ mb: 3 }}>
          <DatePicker
            label="Select Date *"
            value={selectedDate}
            onChange={(newValue) => setSelectedDate(newValue as Date | null)}
            format="dd/MM/yyyy"
            slotProps={{
              textField: {
                fullWidth: true,
                required: true,
                helperText: isWeekend
                  ? `This is a ${isSunday(selectedDate!) ? 'Sunday' : 'Saturday'}`
                  : selectedDate
                    ? 'This is a weekday'
                    : 'Select a date to declare as a working day',
              },
            }}
          />
        </Box>

        {selectedDate && (
          <>
            <Box
              sx={{
                mb: 3,
                p: 2,
                backgroundColor: isWeekend ? 'warning.light' : 'info.light',
                borderRadius: 1,
                borderLeft: 4,
                borderColor: isWeekend ? 'warning.main' : 'info.main',
              }}
            >
              <Typography variant="subtitle1" fontWeight="bold">
                {name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {format(selectedDate, 'EEEE, dd MMMM yyyy')}
              </Typography>
            </Box>

            <Box sx={{ mb: 3 }}>
              <TextField
                label="Working Day Name"
                fullWidth
                value={name}
                onChange={(e) => setName(e.target.value)}
                helperText="You can customize the name for this working day"
              />
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Apply to *
              </Typography>
              <RadioGroup
                value={scope}
                onChange={(e) => setScope(e.target.value as HolidayWorkingScope)}
              >
                <FormControlLabel
                  value="ALL_USERS"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body1">All Users</Typography>
                      <Typography variant="caption" color="text.secondary">
                        All employees will receive comp-off for working on this day
                      </Typography>
                    </Box>
                  }
                />
                <FormControlLabel
                  value="SPECIFIC_USERS"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body1">Specific Users</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Only selected employees will receive comp-off
                      </Typography>
                    </Box>
                  }
                />
              </RadioGroup>
            </Box>

            {scope === 'SPECIFIC_USERS' && (
              <Box sx={{ mb: 3 }}>
                <Autocomplete
                  multiple
                  options={users}
                  getOptionLabel={(option) => `${option.displayName} (${option.email})`}
                  value={selectedUsers}
                  onChange={(_, newValue) => setSelectedUsers(newValue)}
                  loading={loadingUsers}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Users *"
                      placeholder={selectedUsers.length === 0 ? 'Search and select users...' : ''}
                      helperText={`${selectedUsers.length} user(s) selected`}
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        label={option.displayName}
                        {...getTagProps({ index })}
                        key={option.id}
                        size="small"
                      />
                    ))
                  }
                />
              </Box>
            )}

            <Box sx={{ mb: 2 }}>
              <TextField
                label="Reason *"
                fullWidth
                required
                multiline
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this day is being declared as a working day (e.g., Critical project deadline, Client requirement, Make-up day, etc.)"
                helperText="This reason will be communicated to all affected employees"
              />
            </Box>

            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>What happens next:</strong>
              </Typography>
              <Typography variant="body2" component="ul" sx={{ mt: 1, mb: 0 }}>
                <li>
                  {scope === 'ALL_USERS'
                    ? 'All employees'
                    : `${selectedUsers.length} selected employee(s)`}{' '}
                  will be notified
                </li>
                <li>1 day of comp-off will be added to their leave balance</li>
                <li>Comp-off will expire 365 days from the grant date</li>
                <li>Employees can redeem comp-off through regular leave requests</li>
              </Typography>
            </Alert>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="warning"
          disabled={submitting || !selectedDate}
        >
          {submitting ? 'Declaring...' : 'Declare Working Day'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
