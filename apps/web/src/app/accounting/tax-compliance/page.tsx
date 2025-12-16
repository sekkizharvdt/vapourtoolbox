'use client';

import { useState } from 'react';
import {
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
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Assessment as ReportIcon,
  Receipt as InvoiceIcon,
  Payment as BillIcon,
  Send as SendIcon,
  Description as FormIcon,
  AccountBalance as TaxIcon,
  ReceiptLong as ChallanIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { canViewAccounting } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';
import { GSTR1Report } from './components/GSTR1Report';
import { GSTR3BReport } from './components/GSTR3BReport';
import { GSTFilingInterface } from './components/GSTFilingInterface';
import { Form16A } from './components/Form16A';
import { Form26Q } from './components/Form26Q';
import { TDSChallanTracking } from './components/TDSChallanTracking';
import {
  generateGSTR1,
  generateGSTR3B,
  type GSTR1Data,
  type GSTR3BData,
} from '@/lib/accounting/gstReportGenerator';
import {
  generateForm16A,
  generateForm26Q,
  getDeducteesWithTDS,
  type Form16AData,
  type Form26QData,
  type TDSChallan,
} from '@/lib/accounting/tdsReportGenerator';

type ComplianceType = 'GST' | 'TDS';
type GSTTabValue = 'gstr1' | 'gstr3b';
type TDSTabValue = 'form16a' | 'form26q' | 'challans';

export default function TaxCompliancePage() {
  const { claims } = useAuth();
  const hasViewAccess = claims?.permissions ? canViewAccounting(claims.permissions) : false;

  // Compliance type selector
  const [complianceType, setComplianceType] = useState<ComplianceType>('GST');

  // GST State
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
  const [gstActiveTab, setGstActiveTab] = useState<GSTTabValue>('gstr1');
  const [gstLoading, setGstLoading] = useState(false);
  const [gstError, setGstError] = useState('');
  const [gstr1Data, setGstr1Data] = useState<GSTR1Data | null>(null);
  const [gstr3bData, setGstr3bData] = useState<GSTR3BData | null>(null);
  const [filingDialogOpen, setFilingDialogOpen] = useState(false);

  // TDS State
  const [tdsActiveTab, setTdsActiveTab] = useState<TDSTabValue>('form26q');
  const [tdsLoading, setTdsLoading] = useState(false);
  const [tdsError, setTdsError] = useState('');
  const [financialYear, setFinancialYear] = useState<string>(() => getCurrentFinancialYear());
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(getCurrentQuarter());
  const [selectedDeducteeId, setSelectedDeducteeId] = useState<string>('');
  const [deductees, setDeductees] = useState<
    Array<{ id: string; name: string; pan: string; totalTDS: number }>
  >([]);
  const [form16aData, setForm16aData] = useState<Form16AData | null>(null);
  const [form26qData, setForm26qData] = useState<Form26QData | null>(null);
  const [tdsChalans, setTdsChalans] = useState<TDSChallan[]>([]);

  // Company Details - in production, fetch from company settings
  const companyGSTIN = '27AABCU9603R1ZX'; // Demo GSTIN
  const companyName = 'Your Company Name'; // Demo company name
  const companyTAN = 'DELC12345D'; // Demo TAN
  const companyPAN = 'AABCU9603R'; // Demo PAN
  const companyAddress = '123 Business Street, New Delhi - 110001'; // Demo address

  const handleGenerateGST = async () => {
    if (!startDate || !endDate) {
      setGstError('Please select both start and end dates');
      return;
    }

    setGstLoading(true);
    setGstError('');

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
      console.error('[TaxCompliance] Error generating GST reports:', err);
      setGstError('Failed to generate GST returns. Please try again.');
    } finally {
      setGstLoading(false);
    }
  };

  const handleGenerateTDS = async () => {
    setTdsLoading(true);
    setTdsError('');

    try {
      const { db } = getFirebase();

      const deductorDetails = {
        name: companyName,
        tan: companyTAN,
        pan: companyPAN,
        address: companyAddress,
      };

      // Generate Form 26Q (Quarterly Return)
      const form26q = await generateForm26Q(db, quarter, financialYear, deductorDetails);
      setForm26qData(form26q);

      // Get list of deductees for Form 16A selection
      const deducteesList = await getDeducteesWithTDS(db, quarter, financialYear);
      setDeductees(deducteesList);

      // If there's a selected deductee, generate Form 16A
      if (selectedDeducteeId) {
        const form16a = await generateForm16A(db, selectedDeducteeId, quarter, financialYear, {
          name: companyName,
          tan: companyTAN,
          pan: companyPAN,
          address: companyAddress,
          city: 'New Delhi',
          state: 'Delhi',
          pincode: '110001',
        });
        setForm16aData(form16a);
      } else {
        setForm16aData(null);
      }
    } catch (err) {
      console.error('[TaxCompliance] Error generating TDS reports:', err);
      setTdsError('Failed to generate TDS reports. Please try again.');
    } finally {
      setTdsLoading(false);
    }
  };

  const handleGenerateForm16A = async (deducteeId: string) => {
    setTdsLoading(true);
    setTdsError('');
    setSelectedDeducteeId(deducteeId);

    try {
      const { db } = getFirebase();
      const form16a = await generateForm16A(db, deducteeId, quarter, financialYear, {
        name: companyName,
        tan: companyTAN,
        pan: companyPAN,
        address: companyAddress,
        city: 'New Delhi',
        state: 'Delhi',
        pincode: '110001',
      });
      setForm16aData(form16a);
      setTdsActiveTab('form16a');
    } catch (err) {
      console.error('[TaxCompliance] Error generating Form 16A:', err);
      setTdsError('Failed to generate Form 16A. Please try again.');
    } finally {
      setTdsLoading(false);
    }
  };

  // Challan management handlers
  const handleAddChallan = async (challan: TDSChallan) => {
    // In production, save to Firestore
    setTdsChalans([...tdsChalans, challan]);
  };

  const handleUpdateChallan = async (index: number, challan: TDSChallan) => {
    // In production, update in Firestore
    const updated = [...tdsChalans];
    updated[index] = challan;
    setTdsChalans(updated);
  };

  const handleDeleteChallan = async (index: number) => {
    // In production, delete from Firestore
    setTdsChalans(tdsChalans.filter((_, i) => i !== index));
  };

  if (!hasViewAccess) {
    return (
      <>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            GST & TDS Compliance
          </Typography>
          <Alert severity="error">You do not have permission to view tax compliance reports.</Alert>
        </Box>
      </>
    );
  }

  return (
    <>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          GST & TDS Compliance
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Generate and file tax compliance reports for GST and TDS
        </Typography>
      </Box>

      {/* Compliance Type Selector */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
        <ToggleButtonGroup
          value={complianceType}
          exclusive
          onChange={(_, value) => value && setComplianceType(value)}
          size="large"
        >
          <ToggleButton value="GST">
            <TaxIcon sx={{ mr: 1 }} />
            GST Compliance
          </ToggleButton>
          <ToggleButton value="TDS">
            <FormIcon sx={{ mr: 1 }} />
            TDS Compliance
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* GST Section */}
      {complianceType === 'GST' && (
        <>
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
                    onClick={handleGenerateGST}
                    disabled={gstLoading}
                    startIcon={gstLoading ? <CircularProgress size={20} /> : <ReportIcon />}
                  >
                    {gstLoading ? 'Generating...' : 'Generate GST Returns'}
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

            {gstError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {gstError}
              </Alert>
            )}
          </Paper>

          {/* GST Tabs */}
          {(gstr1Data || gstr3bData) && (
            <>
              <Tabs value={gstActiveTab} onChange={(_, v) => setGstActiveTab(v)} sx={{ mb: 3 }}>
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
              {gstActiveTab === 'gstr1' && gstr1Data && <GSTR1Report data={gstr1Data} />}

              {/* GSTR-3B Report */}
              {gstActiveTab === 'gstr3b' && gstr3bData && <GSTR3BReport data={gstr3bData} />}
            </>
          )}

          {!gstr1Data && !gstLoading && (
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
        </>
      )}

      {/* TDS Section */}
      {complianceType === 'TDS' && (
        <>
          {/* Quarter & Financial Year Selector */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  fullWidth
                  select
                  label="Financial Year"
                  value={financialYear}
                  onChange={(e) => setFinancialYear(e.target.value)}
                >
                  <MenuItem value="2023-24">2023-24 (AY 2024-25)</MenuItem>
                  <MenuItem value="2024-25">2024-25 (AY 2025-26)</MenuItem>
                  <MenuItem value="2025-26">2025-26 (AY 2026-27)</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  fullWidth
                  select
                  label="Quarter"
                  value={quarter}
                  onChange={(e) => setQuarter(parseInt(e.target.value, 10) as 1 | 2 | 3 | 4)}
                >
                  <MenuItem value={1}>Q1 (Apr-Jun)</MenuItem>
                  <MenuItem value={2}>Q2 (Jul-Sep)</MenuItem>
                  <MenuItem value={3}>Q3 (Oct-Dec)</MenuItem>
                  <MenuItem value={4}>Q4 (Jan-Mar)</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Button
                  variant="contained"
                  onClick={handleGenerateTDS}
                  disabled={tdsLoading}
                  startIcon={tdsLoading ? <CircularProgress size={20} /> : <ReportIcon />}
                  fullWidth
                >
                  {tdsLoading ? 'Generating...' : 'Generate TDS Reports'}
                </Button>
              </Grid>
            </Grid>

            {tdsError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {tdsError}
              </Alert>
            )}
          </Paper>

          {/* TDS Tabs */}
          {form26qData && (
            <>
              <Tabs value={tdsActiveTab} onChange={(_, v) => setTdsActiveTab(v)} sx={{ mb: 3 }}>
                <Tab
                  label="Form 26Q (Quarterly Return)"
                  value="form26q"
                  icon={<TaxIcon />}
                  iconPosition="start"
                />
                <Tab
                  label="Form 16A (Certificates)"
                  value="form16a"
                  icon={<FormIcon />}
                  iconPosition="start"
                />
                <Tab
                  label="Challan Tracking"
                  value="challans"
                  icon={<ChallanIcon />}
                  iconPosition="start"
                />
              </Tabs>

              {/* Form 26Q Report */}
              {tdsActiveTab === 'form26q' && form26qData && <Form26Q data={form26qData} />}

              {/* Form 16A */}
              {tdsActiveTab === 'form16a' && (
                <Paper sx={{ p: 3 }}>
                  {form16aData ? (
                    <Form16A data={form16aData} />
                  ) : (
                    <>
                      <Typography variant="h6" gutterBottom>
                        Generate Form 16A Certificate
                      </Typography>
                      <Alert severity="info" sx={{ mb: 3 }}>
                        Select a deductee (vendor) to generate their TDS certificate (Form 16A) for
                        the selected quarter.
                      </Alert>

                      {deductees.length > 0 ? (
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                              fullWidth
                              select
                              label="Select Deductee"
                              value={selectedDeducteeId}
                              onChange={(e) => setSelectedDeducteeId(e.target.value)}
                            >
                              {deductees.map((deductee) => (
                                <MenuItem key={deductee.id} value={deductee.id}>
                                  {deductee.name} ({deductee.pan}) - TDS:{' '}
                                  {formatCurrency(deductee.totalTDS)}
                                </MenuItem>
                              ))}
                            </TextField>
                          </Grid>
                          <Grid size={{ xs: 12, md: 6 }}>
                            <Button
                              variant="contained"
                              onClick={() => handleGenerateForm16A(selectedDeducteeId)}
                              disabled={!selectedDeducteeId || tdsLoading}
                              fullWidth
                            >
                              Generate Certificate
                            </Button>
                          </Grid>
                        </Grid>
                      ) : (
                        <Alert severity="warning">
                          No TDS deductions found for the selected quarter. Please ensure you have
                          vendor bills with TDS deductions.
                        </Alert>
                      )}
                    </>
                  )}
                </Paper>
              )}

              {/* Challan Tracking */}
              {tdsActiveTab === 'challans' && (
                <TDSChallanTracking
                  challans={tdsChalans}
                  onAddChallan={handleAddChallan}
                  onUpdateChallan={handleUpdateChallan}
                  onDeleteChallan={handleDeleteChallan}
                />
              )}
            </>
          )}

          {!form26qData && !tdsLoading && (
            <Paper sx={{ p: 6, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                Select a financial year and quarter, then click &quot;Generate TDS Reports&quot; to
                view compliance reports
              </Typography>
            </Paper>
          )}
        </>
      )}
    </>
  );
}

// Helper functions
function getCurrentFinancialYear(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1; // 1-12
  if (month >= 4) {
    return `${year}-${(year + 1).toString().slice(2)}`;
  }
  return `${year - 1}-${year.toString().slice(2)}`;
}

function getCurrentQuarter(): 1 | 2 | 3 | 4 {
  const today = new Date();
  const month = today.getMonth() + 1; // 1-12
  if (month >= 4 && month <= 6) return 1;
  if (month >= 7 && month <= 9) return 2;
  if (month >= 10 && month <= 12) return 3;
  return 4;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
}
