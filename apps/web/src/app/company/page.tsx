'use client';

import { useState, useEffect } from 'react';
import { Container, Box, Typography, Card, CardContent, Button, CircularProgress, Grid } from '@mui/material';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import SetupWizard from './components/SetupWizard';
import { Edit as EditIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material';

interface CompanySettings {
  setupComplete: boolean;
  companyName: string;
  legalName: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  contact: {
    phone: string;
    email: string;
    website?: string;
  };
  taxIds: {
    gstin?: string;
    pan?: string;
    tan?: string;
  };
  banking: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
  };
  fiscalYearStartMonth: number;
  baseCurrency: string;
  setupCompletedAt?: any;
  setupCompletedBy?: string;
}

export default function CompanySettingsPage() {
  const { claims } = useAuth();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  // Check if user is SUPER_ADMIN
  const isSuperAdmin = claims?.roles?.includes('SUPER_ADMIN') || false;

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, 'company', 'settings'));
      if (settingsDoc.exists()) {
        setSettings(settingsDoc.data() as CompanySettings);
      }
    } catch (error) {
      console.error('Error loading company settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetupComplete = () => {
    loadSettings();
    setEditMode(false);
  };

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  // Show wizard if no settings or not complete or in edit mode
  if (!settings || !settings.setupComplete || editMode) {
    return <SetupWizard onComplete={handleSetupComplete} existingSettings={settings} />;
  }

  // Show read-only view
  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Company Settings
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleIcon color="success" fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              Setup completed
              {settings.setupCompletedAt && ` on ${settings.setupCompletedAt.toDate().toLocaleDateString()}`}
            </Typography>
          </Box>
        </Box>
        {isSuperAdmin && (
          <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setEditMode(true)}>
            Edit Settings
          </Button>
        )}
      </Box>

      <Grid container spacing={3}>
        {/* Basic Information */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Company Name
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {settings.companyName}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary">
                  Legal Name
                </Typography>
                <Typography variant="body1">
                  {settings.legalName}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Contact Information */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Contact Information
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Address
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {settings.address.street}
                  <br />
                  {settings.address.city}, {settings.address.state} {settings.address.postalCode}
                  <br />
                  {settings.address.country}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary">
                  Phone
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {settings.contact.phone}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary">
                  Email
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {settings.contact.email}
                </Typography>

                {settings.contact.website && (
                  <>
                    <Typography variant="subtitle2" color="text.secondary">
                      Website
                    </Typography>
                    <Typography variant="body1">
                      {settings.contact.website}
                    </Typography>
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Tax Information */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Tax Information
              </Typography>
              <Box sx={{ mt: 2 }}>
                {settings.taxIds.gstin && (
                  <>
                    <Typography variant="subtitle2" color="text.secondary">
                      GSTIN
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                      {settings.taxIds.gstin}
                    </Typography>
                  </>
                )}

                {settings.taxIds.pan && (
                  <>
                    <Typography variant="subtitle2" color="text.secondary">
                      PAN
                    </Typography>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                      {settings.taxIds.pan}
                    </Typography>
                  </>
                )}

                {settings.taxIds.tan && (
                  <>
                    <Typography variant="subtitle2" color="text.secondary">
                      TAN
                    </Typography>
                    <Typography variant="body1">
                      {settings.taxIds.tan}
                    </Typography>
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Banking Information */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Banking Information
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Bank Name
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {settings.banking.bankName}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary">
                  Account Number
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {settings.banking.accountNumber}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary">
                  IFSC Code
                </Typography>
                <Typography variant="body1">
                  {settings.banking.ifscCode}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Fiscal Information */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Fiscal Information
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Fiscal Year Start
                </Typography>
                <Typography variant="body1" sx={{ mb: 2 }}>
                  {new Date(2000, settings.fiscalYearStartMonth - 1, 1).toLocaleString('default', { month: 'long' })}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary">
                  Base Currency
                </Typography>
                <Typography variant="body1">
                  {settings.baseCurrency}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
