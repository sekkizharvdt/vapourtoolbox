'use client';

import { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  TextField,
  Grid,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Dialog,
  DialogContent,
} from '@mui/material';
import {
  Assessment as ReportIcon,
  Receipt as InvoiceIcon,
  Payment as BillIcon,
  Send as SendIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { canViewFinancialReports } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';
import { GSTR1Report } from './components/GSTR1Report';
import { GSTR3BReport } from './components/GSTR3BReport';
import { GSTFilingInterface } from './components/GSTFilingInterface';
import {
  generateGSTR1,
  generateGSTR3B,
  type GSTR1Data,
  type GSTR3BData,
} from '@/lib/accounting/gstReportGenerator';

type TabValue = 'gstr1' | 'gstr3b';

export default function TaxCompliancePage() {
  const { claims } = useAuth();
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(1); // First day of month
    return date.toISOString().split('T')[0] || '';
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    date.setDate(0); // Last day of month
    return date.toISOString().split('T')[0] || '';
  });
  const [activeTab, setActiveTab] = useState<TabValue>('gstr1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gstr1Data, setGstr1Data] = useState<GSTR1Data | null>(null);
  const [gstr3bData, setGstr3bData] = useState<GSTR3BData | null>(null);
  const [filingDialogOpen, setFilingDialogOpen] = useState(false);

  // Company GSTIN - in production, fetch from company settings
  const companyGSTIN = '27AABCU9603R1ZX'; // Demo GSTIN
  const companyName = 'Your Company Name'; // Demo company name

  const hasViewAccess = claims?.permissions ? canViewFinancialReports(claims.permissions) : false;

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();
      const start = Timestamp.fromDate(new Date(startDate));
      const end = Timestamp.fromDate(new Date(endDate));

      // Generate GSTR-1 (Outward Supplies - Sales/Invoices)
      const gstr1 = await generateGSTR1(db, start, end, companyGSTIN, companyName);
      setGstr1Data(gstr1);

      // Generate GSTR-3B (Monthly Summary)
      const gstr3b = await generateGSTR3B(db, start, end, companyGSTIN, companyName);
      setGstr3bData(gstr3b);
    } catch (err) {
      console.error('[TaxCompliance] Error generating reports:', err);
      setError('Failed to generate GST returns. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!hasViewAccess) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            GST & TDS Compliance
          </Typography>
          <Alert severity="error">You do not have permission to view tax compliance reports.</Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          GST & TDS Compliance
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Generate GST returns (GSTR-1, GSTR-3B) and file them with the GST portal
        </Typography>
      </Box>

      {/* Date Range Selector */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                onClick={handleGenerate}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <ReportIcon />}
              >
                {loading ? 'Generating...' : 'Generate GST Returns'}
              </Button>
              {(gstr1Data || gstr3bData) && (
                <Button
                  variant="outlined"
                  onClick={() => setFilingDialogOpen(true)}
                  startIcon={<SendIcon />}
                  color="primary"
                >
                  File Returns
                </Button>
              )}
            </Box>
          </Grid>
        </Grid>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Paper>

      {/* Tabs */}
      {(gstr1Data || gstr3bData) && (
        <>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
            <Tab
              label="GSTR-1 (Outward Supplies)"
              value="gstr1"
              icon={<InvoiceIcon />}
              iconPosition="start"
            />
            <Tab
              label="GSTR-3B (Summary)"
              value="gstr3b"
              icon={<BillIcon />}
              iconPosition="start"
            />
          </Tabs>

          {/* GSTR-1 Report */}
          {activeTab === 'gstr1' && gstr1Data && <GSTR1Report data={gstr1Data} />}

          {/* GSTR-3B Report */}
          {activeTab === 'gstr3b' && gstr3bData && <GSTR3BReport data={gstr3bData} />}
        </>
      )}

      {!gstr1Data && !loading && (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            Select a date range and click &quot;Generate GST Returns&quot; to view compliance
            reports
          </Typography>
        </Paper>
      )}

      {/* GST Filing Dialog */}
      <Dialog
        open={filingDialogOpen}
        onClose={() => setFilingDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogContent sx={{ p: 3 }}>
          <GSTFilingInterface
            gstr1Data={gstr1Data}
            gstr3bData={gstr3bData}
            onClose={() => setFilingDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </Container>
  );
}
