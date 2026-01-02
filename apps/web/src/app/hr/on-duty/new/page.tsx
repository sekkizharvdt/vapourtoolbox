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
  Breadcrumbs,
  Link,
} from '@mui/material';
import { Save as SaveIcon, Send as SubmitIcon, Home as HomeIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { createOnDutyRequest, submitOnDutyRequest, validateOnDutyDate } from '@/lib/hr/onDuty';

export default function NewOnDutyRequestPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Form state
  const [holidayDate, setHolidayDate] = useState<Date | null>(null);
  const [holidayName, setHolidayName] = useState('');
  const [reason, setReason] = useState('');

  // Validate holiday date when it changes
  useEffect(() => {
    const validateDate = async () => {
      if (!holidayDate) {
        setValidationErrors([]);
        setHolidayName('');
        return;
      }

      try {
        const validation = await validateOnDutyDate(holidayDate);
        if (validation.valid) {
          setHolidayName(validation.holidayName || '');
          setValidationErrors([]);
        } else {
          setHolidayName('');
          setValidationErrors(validation.errors);
        }
      } catch (err) {
        console.error('Validation error:', err);
        setValidationErrors(['Failed to validate date']);
      }
    };

    validateDate();
  }, [holidayDate]);

  const handleSaveDraft = async () => {
    if (!user || !holidayDate) {
      setError('Please select a holiday date');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createOnDutyRequest(
        {
          holidayDate,
          holidayName,
          reason,
        },
        user.uid,
        user.displayName || 'Unknown User',
        user.email || ''
      );

      router.push('/hr/on-duty/my-requests');
    } catch (err) {
      console.error('Failed to save draft:', err);
      setError(err instanceof Error ? err.message : 'Failed to save on-duty request');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !holidayDate) {
      setError('Please select a holiday date');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for working on the holiday');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Create and submit in one go
      const { requestId } = await createOnDutyRequest(
        {
          holidayDate,
          holidayName,
          reason,
        },
        user.uid,
        user.displayName || 'Unknown User',
        user.email || ''
      );

      // Submit for approval
      await submitOnDutyRequest(requestId, user.uid, user.displayName || 'Unknown User');

      router.push('/hr/on-duty/my-requests');
    } catch (err) {
      console.error('Failed to submit:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit on-duty request');
    } finally {
      setSaving(false);
    }
  };

  const isValid = holidayDate && validationErrors.length === 0 && reason.trim().length > 0;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        <Breadcrumbs sx={{ mb: 3 }}>
          <Link
            href="/hr"
            underline="hover"
            color="inherit"
            sx={{ display: 'flex', alignItems: 'center' }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
            HR
          </Link>
          <Link href="/hr/on-duty/my-requests" underline="hover" color="inherit">
            On-Duty Requests
          </Link>
          <Typography color="text.primary">New Request</Typography>
        </Breadcrumbs>

        <Typography variant="h4" gutterBottom>
          New On-Duty Request
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Apply to work on a holiday. Upon approval, you&apos;ll receive compensatory leave
          (comp-off) that can be redeemed later.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {validationErrors.length > 0 && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {validationErrors.map((err, idx) => (
              <div key={idx}>{err}</div>
            ))}
          </Alert>
        )}

        <Card>
          <CardContent>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <DatePicker
                  label="Holiday Date *"
                  value={holidayDate}
                  onChange={(newValue) => setHolidayDate(newValue as Date | null)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true,
                      error: validationErrors.length > 0,
                      helperText: holidayName ? `Holiday: ${holidayName}` : 'Select a holiday',
                    },
                  }}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Reason *"
                  fullWidth
                  required
                  multiline
                  rows={4}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide a business reason for working on this holiday"
                />
              </Grid>
            </Grid>

            <Box sx={{ display: 'flex', gap: 2, mt: 4, justifyContent: 'flex-end' }}>
              <Button variant="outlined" onClick={() => router.back()} disabled={saving}>
                Cancel
              </Button>
              <Button
                variant="outlined"
                startIcon={<SaveIcon />}
                onClick={handleSaveDraft}
                disabled={!holidayDate || validationErrors.length > 0 || saving}
              >
                Save as Draft
              </Button>
              <Button
                variant="contained"
                startIcon={<SubmitIcon />}
                onClick={handleSubmit}
                disabled={!isValid || saving}
              >
                {saving ? 'Submitting...' : 'Submit for Approval'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </LocalizationProvider>
  );
}
