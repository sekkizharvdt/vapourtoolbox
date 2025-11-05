'use client';

import { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Button,
  TextField,
  Grid,
  Card,
  CardContent,
  Alert,
  MenuItem,
} from '@mui/material';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

interface CompanySettings {
  setupComplete?: boolean;
  companyName?: string;
  legalName?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  contact?: {
    phone: string;
    email: string;
    website?: string;
  };
  taxIds?: {
    gstin?: string;
    pan?: string;
    tan?: string;
  };
  banking?: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
  };
  fiscalYearStartMonth?: number;
  baseCurrency?: string;
}

interface SetupWizardProps {
  onComplete: () => void;
  existingSettings?: CompanySettings;
}

const steps = ['Basic Info', 'Contact', 'Tax IDs', 'Banking', 'Fiscal'];

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export default function SetupWizard({ onComplete, existingSettings }: SetupWizardProps) {
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    companyName: existingSettings?.companyName || '',
    legalName: existingSettings?.legalName || '',
    street: existingSettings?.address?.street || '',
    city: existingSettings?.address?.city || '',
    state: existingSettings?.address?.state || '',
    postalCode: existingSettings?.address?.postalCode || '',
    country: existingSettings?.address?.country || 'India',
    phone: existingSettings?.contact?.phone || '',
    email: existingSettings?.contact?.email || '',
    website: existingSettings?.contact?.website || '',
    gstin: existingSettings?.taxIds?.gstin || '',
    pan: existingSettings?.taxIds?.pan || '',
    tan: existingSettings?.taxIds?.tan || '',
    bankName: existingSettings?.banking?.bankName || '',
    accountNumber: existingSettings?.banking?.accountNumber || '',
    ifscCode: existingSettings?.banking?.ifscCode || '',
    fiscalYearStartMonth: existingSettings?.fiscalYearStartMonth || 4, // April default
    baseCurrency: existingSettings?.baseCurrency || 'INR',
  });

  const handleChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [field]: event.target.value });
  };

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError('');

    try {
      const settingsData: Record<string, unknown> = {
        setupComplete: true,
        companyName: formData.companyName,
        legalName: formData.legalName,
        address: {
          street: formData.street,
          city: formData.city,
          state: formData.state,
          postalCode: formData.postalCode,
          country: formData.country,
        },
        contact: {
          phone: formData.phone,
          email: formData.email,
          website: formData.website || null,
        },
        taxIds: {
          gstin: formData.gstin || null,
          pan: formData.pan || null,
          tan: formData.tan || null,
        },
        banking: {
          bankName: formData.bankName,
          accountNumber: formData.accountNumber,
          ifscCode: formData.ifscCode,
        },
        fiscalYearStartMonth: formData.fiscalYearStartMonth,
        baseCurrency: formData.baseCurrency,
        updatedAt: serverTimestamp(),
        setupCompletedAt: serverTimestamp(),
        setupCompletedBy: user?.uid,
      };

      // Add createdAt only if this is a new setup
      if (!existingSettings) {
        settingsData.createdAt = serverTimestamp();
      }

      await setDoc(doc(db, 'company', 'settings'), settingsData);
      onComplete();
    } catch (err) {
      console.error('Error saving company settings:', err);
      setError('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0: // Basic Info
        return (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <TextField
                required
                fullWidth
                label="Company Name"
                value={formData.companyName}
                onChange={handleChange('companyName')}
                helperText="The name your company operates under"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                required
                fullWidth
                label="Legal Name"
                value={formData.legalName}
                onChange={handleChange('legalName')}
                helperText="Official registered name (if different from company name)"
              />
            </Grid>
          </Grid>
        );

      case 1: // Contact
        return (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <TextField
                required
                fullWidth
                label="Street Address"
                value={formData.street}
                onChange={handleChange('street')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                required
                fullWidth
                label="City"
                value={formData.city}
                onChange={handleChange('city')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                required
                fullWidth
                label="State"
                value={formData.state}
                onChange={handleChange('state')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                required
                fullWidth
                label="Postal Code"
                value={formData.postalCode}
                onChange={handleChange('postalCode')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                required
                fullWidth
                label="Country"
                value={formData.country}
                onChange={handleChange('country')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                required
                fullWidth
                label="Phone"
                value={formData.phone}
                onChange={handleChange('phone')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                required
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={handleChange('email')}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Website"
                value={formData.website}
                onChange={handleChange('website')}
                helperText="Optional"
              />
            </Grid>
          </Grid>
        );

      case 2: // Tax IDs
        return (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <Alert severity="info">
                Enter your company&apos;s tax identification numbers. All fields are optional.
              </Alert>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="GSTIN"
                value={formData.gstin}
                onChange={handleChange('gstin')}
                helperText="Goods and Services Tax Identification Number"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="PAN"
                value={formData.pan}
                onChange={handleChange('pan')}
                helperText="Permanent Account Number"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="TAN"
                value={formData.tan}
                onChange={handleChange('tan')}
                helperText="Tax Deduction Account Number"
              />
            </Grid>
          </Grid>
        );

      case 3: // Banking
        return (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <TextField
                required
                fullWidth
                label="Bank Name"
                value={formData.bankName}
                onChange={handleChange('bankName')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                required
                fullWidth
                label="Account Number"
                value={formData.accountNumber}
                onChange={handleChange('accountNumber')}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                required
                fullWidth
                label="IFSC Code"
                value={formData.ifscCode}
                onChange={handleChange('ifscCode')}
              />
            </Grid>
          </Grid>
        );

      case 4: // Fiscal
        return (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                required
                fullWidth
                select
                label="Fiscal Year Start Month"
                value={formData.fiscalYearStartMonth}
                onChange={handleChange('fiscalYearStartMonth')}
                helperText="The month your fiscal year begins"
              >
                {MONTHS.map((month) => (
                  <MenuItem key={month.value} value={month.value}>
                    {month.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                required
                fullWidth
                label="Base Currency"
                value={formData.baseCurrency}
                onChange={handleChange('baseCurrency')}
                helperText="Primary currency for transactions"
              />
            </Grid>
          </Grid>
        );

      default:
        return 'Unknown step';
    }
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          {existingSettings?.setupComplete ? 'Edit Company Settings' : 'Company Settings Setup'}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          {existingSettings?.setupComplete
            ? 'Update your company information'
            : "Let's set up your company information. This is a one-time setup."}
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Card>
          <CardContent sx={{ p: 3 }}>
            {getStepContent(activeStep)}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
              <Button disabled={activeStep === 0} onClick={handleBack}>
                Back
              </Button>
              <Box>
                {activeStep === steps.length - 1 ? (
                  <Button variant="contained" onClick={handleSubmit} disabled={saving}>
                    {saving ? 'Saving...' : 'Complete Setup'}
                  </Button>
                ) : (
                  <Button variant="contained" onClick={handleNext}>
                    Next
                  </Button>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}
