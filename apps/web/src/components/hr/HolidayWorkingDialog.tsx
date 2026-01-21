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
import type { Holiday, HolidayWorkingScope } from '@vapour/types';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { getFirebaseClient } from '@vapour/firebase';
import { COLLECTIONS } from '@vapour/firebase';

interface User {
  id: string;
  displayName: string;
  email: string;
}

interface HolidayWorkingDialogProps {
  open: boolean;
  holiday: Holiday | null;
  onClose: () => void;
  onSubmit: (data: {
    scope: HolidayWorkingScope;
    affectedUserIds: string[];
    reason: string;
  }) => Promise<void>;
}

export default function HolidayWorkingDialog({
  open,
  holiday,
  onClose,
  onSubmit,
}: HolidayWorkingDialogProps) {
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
      setScope('ALL_USERS');
      setSelectedUsers([]);
      setReason('');
      setError(null);
    }
  }, [open]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const { db } = getFirebaseClient();
      const usersRef = collection(db, COLLECTIONS.USERS);
      const q = query(usersRef, orderBy('displayName', 'asc'));
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
    if (!holiday) return;

    // Validation
    if (!reason.trim()) {
      setError('Please provide a reason for converting this holiday to a working day');
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
        scope,
        affectedUserIds: scope === 'ALL_USERS' ? [] : selectedUsers.map((u) => u.id),
        reason: reason.trim(),
      });

      onClose();
    } catch (err) {
      console.error('Failed to submit:', err);
      setError(err instanceof Error ? err.message : 'Failed to convert holiday to working day');
    } finally {
      setSubmitting(false);
    }
  };

  if (!holiday) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Convert Holiday to Working Day</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            You are converting the following holiday into a working day. Selected users will receive
            compensatory leave (comp-off) in their leave balance.
          </Typography>
          <Box
            sx={{
              mt: 2,
              p: 2,
              bgcolor: 'action.hover',
              borderRadius: 1,
              borderLeft: 4,
              borderColor: holiday.color || 'warning.main',
            }}
          >
            <Typography variant="subtitle1" fontWeight="bold">
              {holiday.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {holiday.date.toDate().toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Typography>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

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
                    All employees will receive comp-off for working on this holiday
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
            placeholder="Explain why this holiday is being converted to a working day (e.g., Critical project deadline, Client requirement, etc.)"
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
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" color="warning" disabled={submitting}>
          {submitting ? 'Converting...' : 'Convert to Working Day'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
