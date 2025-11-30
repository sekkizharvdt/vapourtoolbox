'use client';

/**
 * Edit Enquiry Client Component
 *
 * Allows editing an existing enquiry's details
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  TextField,
  CircularProgress,
  Alert,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material';
import { Controller, useForm } from 'react-hook-form';
import { Timestamp } from 'firebase/firestore';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { getEnquiryById, updateEnquiry } from '@/lib/enquiry/enquiryService';
import type { Enquiry, EnquirySource, EnquiryUrgency, EnquiryProjectType } from '@vapour/types';
import { ENQUIRY_URGENCY_LABELS, ENQUIRY_PROJECT_TYPE_LABELS } from '@vapour/types';
import { EntitySelector } from '@/components/common/forms/EntitySelector';

interface EditEnquiryFormValues {
  title: string;
  description: string;
  clientId: string;
  clientContactPerson: string;
  clientEmail: string;
  clientPhone: string;
  clientReferenceNumber: string;
  receivedVia: EnquirySource;
  referenceSource: string;
  projectType: EnquiryProjectType;
  industry: string;
  location: string;
  urgency: EnquiryUrgency;
  estimatedBudgetAmount: number | '';
  estimatedBudgetCurrency: string;
  receivedDate: Date;
  requiredDeliveryDate: Date | null;
}

const RECEIVED_VIA_OPTIONS: { value: EnquirySource; label: string }[] = [
  { value: 'EMAIL', label: 'Email' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'WEBSITE', label: 'Website' },
  { value: 'REFERRAL', label: 'Referral' },
  { value: 'OTHER', label: 'Other' },
];

export default function EditEnquiryClient() {
  const params = useParams();
  const router = useRouter();
  const db = useFirestore();
  const { user } = useAuth();
  const enquiryId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<EditEnquiryFormValues>({
    mode: 'onBlur',
    defaultValues: {
      title: '',
      description: '',
      clientId: '',
      clientContactPerson: '',
      clientEmail: '',
      clientPhone: '',
      clientReferenceNumber: '',
      receivedVia: 'EMAIL',
      referenceSource: '',
      projectType: 'SUPPLY_ONLY',
      industry: '',
      location: '',
      urgency: 'STANDARD',
      estimatedBudgetAmount: '',
      estimatedBudgetCurrency: 'INR',
      receivedDate: new Date(),
      requiredDeliveryDate: null,
    },
  });

  useEffect(() => {
    if (!db || !enquiryId || enquiryId === 'placeholder') return;

    const loadEnquiry = async () => {
      try {
        setLoading(true);
        const data = await getEnquiryById(db, enquiryId);
        if (!data) {
          setError('Enquiry not found');
          return;
        }
        setEnquiry(data);

        // Reset form with loaded data
        reset({
          title: data.title || '',
          description: data.description || '',
          clientId: data.clientId || '',
          clientContactPerson: data.clientContactPerson || '',
          clientEmail: data.clientEmail || '',
          clientPhone: data.clientPhone || '',
          clientReferenceNumber: data.clientReferenceNumber || '',
          receivedVia: data.receivedVia || 'EMAIL',
          referenceSource: data.referenceSource || '',
          projectType: data.projectType || 'SUPPLY_ONLY',
          industry: data.industry || '',
          location: data.location || '',
          urgency: data.urgency || 'MEDIUM',
          estimatedBudgetAmount: data.estimatedBudget?.amount || '',
          estimatedBudgetCurrency: data.estimatedBudget?.currency || 'INR',
          receivedDate: data.receivedDate?.toDate() || new Date(),
          requiredDeliveryDate: data.requiredDeliveryDate?.toDate() || null,
        });
      } catch (err) {
        console.error('[EditEnquiryClient] Error loading enquiry:', err);
        setError('Failed to load enquiry');
      } finally {
        setLoading(false);
      }
    };

    loadEnquiry();
  }, [db, enquiryId, reset]);

  const onSubmit = async (data: EditEnquiryFormValues) => {
    if (!db || !user || !enquiryId) return;

    try {
      setSaving(true);
      setError('');

      await updateEnquiry(
        db,
        enquiryId,
        {
          title: data.title,
          description: data.description,
          clientContactPerson: data.clientContactPerson,
          clientEmail: data.clientEmail,
          clientPhone: data.clientPhone,
          clientReferenceNumber: data.clientReferenceNumber || undefined,
          receivedVia: data.receivedVia,
          referenceSource: data.referenceSource || undefined,
          projectType: data.projectType,
          industry: data.industry || undefined,
          location: data.location || undefined,
          urgency: data.urgency,
          estimatedBudget:
            data.estimatedBudgetAmount !== ''
              ? {
                  amount: Number(data.estimatedBudgetAmount),
                  currency: data.estimatedBudgetCurrency as 'INR' | 'USD' | 'AED' | 'EUR',
                }
              : undefined,
          receivedDate: Timestamp.fromDate(data.receivedDate),
          requiredDeliveryDate: data.requiredDeliveryDate
            ? Timestamp.fromDate(data.requiredDeliveryDate)
            : undefined,
        },
        user.uid
      );

      router.push(`/proposals/enquiries/${enquiryId}`);
    } catch (err) {
      console.error('[EditEnquiryClient] Error updating enquiry:', err);
      setError('Failed to update enquiry. Please try again.');
      setSaving(false);
    }
  };

  // Handle placeholder ID for static export
  if (enquiryId === 'placeholder') {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={40} />
      </Box>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={40} />
        <Typography variant="body2" sx={{ ml: 2 }}>
          Loading enquiry...
        </Typography>
      </Box>
    );
  }

  if (error && !enquiry) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button onClick={() => router.push('/proposals/enquiries')} sx={{ mt: 2 }}>
          Back to Enquiries
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push(`/proposals/enquiries/${enquiryId}`)}
            sx={{ mb: 1 }}
          >
            Back to Enquiry
          </Button>
          <Typography variant="h4" gutterBottom>
            Edit Enquiry
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {enquiry?.enquiryNumber}
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Basic Information */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Basic Information
            </Typography>
            <Grid container spacing={3}>
              <Grid size={12}>
                <Controller
                  name="title"
                  control={control}
                  rules={{ required: 'Title is required' }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Enquiry Title"
                      fullWidth
                      required
                      error={!!errors.title}
                      helperText={errors.title?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="clientId"
                  control={control}
                  render={({ field }) => (
                    <EntitySelector
                      value={field.value}
                      onChange={field.onChange}
                      label="Client"
                      required
                      filterByRole="CUSTOMER"
                      disabled // Can't change client on edit
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="clientContactPerson"
                  control={control}
                  render={({ field }) => <TextField {...field} label="Contact Person" fullWidth />}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="clientEmail"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label="Client Email" type="email" fullWidth />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="clientPhone"
                  control={control}
                  render={({ field }) => <TextField {...field} label="Client Phone" fullWidth />}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Enquiry Details */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Enquiry Details
            </Typography>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <Controller
                    name="receivedDate"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        label="Received Date"
                        value={field.value}
                        onChange={field.onChange}
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            required: true,
                          },
                        }}
                      />
                    )}
                  />
                </LocalizationProvider>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="receivedVia"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Received Via</InputLabel>
                      <Select {...field} label="Received Via">
                        {RECEIVED_VIA_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="urgency"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Urgency</InputLabel>
                      <Select {...field} label="Urgency">
                        {Object.entries(ENQUIRY_URGENCY_LABELS).map(([value, label]) => (
                          <MenuItem key={value} value={value}>
                            {label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="projectType"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth error={!!errors.projectType}>
                      <InputLabel>Project Type</InputLabel>
                      <Select {...field} label="Project Type">
                        {Object.entries(ENQUIRY_PROJECT_TYPE_LABELS).map(([value, label]) => (
                          <MenuItem key={value} value={value}>
                            {label}
                          </MenuItem>
                        ))}
                      </Select>
                      <FormHelperText>{errors.projectType?.message}</FormHelperText>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="industry"
                  control={control}
                  render={({ field }) => <TextField {...field} label="Industry" fullWidth />}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="location"
                  control={control}
                  render={({ field }) => <TextField {...field} label="Location" fullWidth />}
                />
              </Grid>

              <Grid size={12}>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Description / Scope Overview"
                      fullWidth
                      multiline
                      rows={4}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Paper>

          {/* Budget & Timeline */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Budget & Timeline
            </Typography>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Controller
                  name="estimatedBudgetAmount"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Estimated Budget"
                      type="number"
                      fullWidth
                      inputProps={{ min: 0 }}
                    />
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 2 }}>
                <Controller
                  name="estimatedBudgetCurrency"
                  control={control}
                  render={({ field }) => (
                    <FormControl fullWidth>
                      <InputLabel>Currency</InputLabel>
                      <Select {...field} label="Currency">
                        <MenuItem value="INR">INR</MenuItem>
                        <MenuItem value="USD">USD</MenuItem>
                        <MenuItem value="AED">AED</MenuItem>
                        <MenuItem value="EUR">EUR</MenuItem>
                      </Select>
                    </FormControl>
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <Controller
                    name="requiredDeliveryDate"
                    control={control}
                    render={({ field }) => (
                      <DatePicker
                        label="Required Delivery Date"
                        value={field.value}
                        onChange={field.onChange}
                        slotProps={{
                          textField: {
                            fullWidth: true,
                          },
                        }}
                      />
                    )}
                  />
                </LocalizationProvider>
              </Grid>
            </Grid>
          </Paper>

          {/* Actions */}
          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button
              onClick={() => router.push(`/proposals/enquiries/${enquiryId}`)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
              disabled={saving || !isDirty}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </Stack>
        </form>
      </Stack>
    </Box>
  );
}
