'use client';

import { useState } from 'react';
import {
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Grid,
  Alert,
  TextField,
  Autocomplete,
  Chip,
} from '@mui/material';
import { ArrowBack as BackIcon, Save as SaveIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useCreateTravelExpenseReport } from '@/lib/hr';
import { ProjectSelector } from '@/components/common/forms/ProjectSelector';

// Common Indian cities for autocomplete
const COMMON_DESTINATIONS = [
  'Mumbai',
  'Delhi',
  'Bangalore',
  'Chennai',
  'Hyderabad',
  'Kolkata',
  'Pune',
  'Ahmedabad',
  'Jaipur',
  'Coimbatore',
  'Surat',
  'Kochi',
  'Visakhapatnam',
  'Indore',
  'Nagpur',
  'Lucknow',
  'Vadodara',
  'Goa',
];

export default function NewTravelExpensePage() {
  const router = useRouter();
  const { user } = useAuth();

  const createReportMutation = useCreateTravelExpenseReport();

  const [error, setError] = useState<string | null>(null);

  // Form state
  const [tripPurpose, setTripPurpose] = useState('');
  const [tripStartDate, setTripStartDate] = useState<Date | null>(null);
  const [tripEndDate, setTripEndDate] = useState<Date | null>(null);
  const [destinations, setDestinations] = useState<string[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');

  const isFormValid = tripPurpose.trim() && tripStartDate && tripEndDate && destinations.length > 0;

  const handleSave = async () => {
    if (!user || !tripStartDate || !tripEndDate) {
      setError('Please fill in all required fields');
      return;
    }

    if (!tripPurpose.trim()) {
      setError('Please provide a trip purpose');
      return;
    }

    if (destinations.length === 0) {
      setError('Please add at least one destination');
      return;
    }

    if (tripEndDate < tripStartDate) {
      setError('End date cannot be before start date');
      return;
    }

    setError(null);

    try {
      const result = await createReportMutation.mutateAsync({
        input: {
          tripPurpose: tripPurpose.trim(),
          tripStartDate,
          tripEndDate,
          destinations,
          projectId: projectId || undefined,
          projectName: projectName || undefined,
          notes: notes.trim() || undefined,
        },
        employeeId: user.uid,
        employeeName: user.displayName || 'User',
        employeeEmail: user.email || '',
      });

      // Navigate to the detail page to add expense items
      router.push(`/hr/travel-expenses/${result.reportId}`);
    } catch (err) {
      console.error('Failed to create travel expense report:', err);
      setError(err instanceof Error ? err.message : 'Failed to create report');
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ maxWidth: 'md', mx: 'auto' }}>
        <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<BackIcon />} onClick={() => router.back()}>
            Back
          </Button>
          <Typography variant="h5" component="h1">
            New Travel Expense Report
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom sx={{ mb: 3 }}>
              Trip Details
            </Typography>

            <Grid container spacing={3}>
              {/* Trip Purpose */}
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Trip Purpose"
                  fullWidth
                  required
                  value={tripPurpose}
                  onChange={(e) => setTripPurpose(e.target.value)}
                  placeholder="e.g., Client meeting at XYZ Corp, Site visit for Project ABC"
                  helperText="Describe the business purpose of this trip"
                />
              </Grid>

              {/* Project / Cost Centre */}
              <Grid size={{ xs: 12 }}>
                <ProjectSelector
                  value={projectId}
                  onChange={(id, name) => {
                    setProjectId(id);
                    setProjectName(name);
                  }}
                  label="Project / Cost Centre"
                  helperText="Select the project or cost centre to charge this expense to (optional)"
                  includeCostCentres={true}
                />
              </Grid>

              {/* Date Range */}
              <Grid size={{ xs: 12, sm: 6 }}>
                <DatePicker
                  label="Trip Start Date"
                  value={tripStartDate}
                  onChange={(newValue) => {
                    const date = newValue as Date | null;
                    setTripStartDate(date);
                    if (!tripEndDate || (date && tripEndDate < date)) {
                      setTripEndDate(date);
                    }
                  }}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true,
                    },
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <DatePicker
                  label="Trip End Date"
                  value={tripEndDate}
                  onChange={(newValue) => setTripEndDate(newValue as Date | null)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true,
                    },
                  }}
                  minDate={tripStartDate || undefined}
                />
              </Grid>

              {/* Destinations */}
              <Grid size={{ xs: 12 }}>
                <Autocomplete
                  multiple
                  freeSolo
                  autoSelect
                  options={COMMON_DESTINATIONS}
                  value={destinations}
                  onChange={(_, newValue) => setDestinations(newValue)}
                  onBlur={(event) => {
                    const inputValue = (event.target as HTMLInputElement).value?.trim();
                    if (inputValue && !destinations.includes(inputValue)) {
                      setDestinations([...destinations, inputValue]);
                    }
                  }}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => {
                      const { key, ...tagProps } = getTagProps({ index });
                      return <Chip variant="outlined" label={option} key={key} {...tagProps} />;
                    })
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Destinations"
                      required
                      placeholder="Add cities visited"
                      helperText="Type a city and press Enter, or click away to add"
                    />
                  )}
                />
              </Grid>

              {/* Notes */}
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Additional Notes"
                  fullWidth
                  multiline
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional information about this trip..."
                />
              </Grid>

              {/* Actions */}
              <Grid size={{ xs: 12 }}>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                  <Button variant="outlined" onClick={() => router.back()}>
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                    disabled={!isFormValid || createReportMutation.isPending}
                  >
                    {createReportMutation.isPending ? 'Creating...' : 'Create Report'}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Alert severity="info" sx={{ mt: 3 }}>
          After creating the report, you&apos;ll be able to add expense items such as travel
          tickets, hotel bills, and meal receipts.
        </Alert>
      </Box>
    </LocalizationProvider>
  );
}
