'use client';

import { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  Grid,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import {
  FileDownload as DownloadIcon,
  Assessment as ReportIcon,
  Receipt as InvoiceIcon,
  Payment as BillIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { canViewFinancialReports } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';

interface GSTSummary {
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  total: number;
  transactionCount: number;
}

interface GSTR1Data {
  b2b: GSTSummary; // Business to Business
  b2c: GSTSummary; // Business to Consumer
  total: GSTSummary;
}

interface GSTR2Data {
  purchases: GSTSummary;
  reverseCharge: GSTSummary;
  total: GSTSummary;
}

interface GSTR3BData {
  outwardSupplies: GSTSummary;
  inwardSupplies: GSTSummary;
  netGST: {
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    total: number;
  };
  itcAvailable: {
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    total: number;
  };
  gstPayable: {
    cgst: number;
    sgst: number;
    igst: number;
    cess: number;
    total: number;
  };
}

type TabValue = 'gstr1' | 'gstr2' | 'gstr3b';

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
  const [gstr2Data, setGstr2Data] = useState<GSTR2Data | null>(null);
  const [gstr3bData, setGstr3bData] = useState<GSTR3BData | null>(null);

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
      const gstr1 = await generateGSTR1(db, start, end);
      setGstr1Data(gstr1);

      // Generate GSTR-2 (Inward Supplies - Purchases/Bills)
      const gstr2 = await generateGSTR2(db, start, end);
      setGstr2Data(gstr2);

      // Generate GSTR-3B (Summary)
      const gstr3b = await generateGSTR3B(gstr1, gstr2);
      setGstr3bData(gstr3b);
    } catch (err) {
      console.error('[TaxCompliance] Error generating reports:', err);
      setError('Failed to generate GST returns');
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
          Generate GST returns (GSTR-1, GSTR-2, GSTR-3B) and TDS reports
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
            <Button variant="contained" onClick={handleGenerate} disabled={loading}>
              {loading ? <CircularProgress size={24} /> : 'Generate GST Returns'}
            </Button>
          </Grid>
        </Grid>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Paper>

      {/* Tabs */}
      {(gstr1Data || gstr2Data || gstr3bData) && (
        <>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
            <Tab
              label="GSTR-1 (Outward Supplies)"
              value="gstr1"
              icon={<InvoiceIcon />}
              iconPosition="start"
            />
            <Tab
              label="GSTR-2 (Inward Supplies)"
              value="gstr2"
              icon={<BillIcon />}
              iconPosition="start"
            />
            <Tab
              label="GSTR-3B (Summary)"
              value="gstr3b"
              icon={<ReportIcon />}
              iconPosition="start"
            />
          </Tabs>

          {/* GSTR-1 Report */}
          {activeTab === 'gstr1' && gstr1Data && (
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h6">GSTR-1: Outward Supplies (Sales)</Typography>
                <Button variant="outlined" startIcon={<DownloadIcon />}>
                  Export JSON
                </Button>
              </Box>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Total Invoices
                      </Typography>
                      <Typography variant="h4">{gstr1Data.total.transactionCount}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Taxable Value
                      </Typography>
                      <Typography variant="h4">
                        {formatCurrency(gstr1Data.total.taxableValue)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Total GST Collected
                      </Typography>
                      <Typography variant="h4" color="primary">
                        {formatCurrency(gstr1Data.total.total)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Taxable Value</TableCell>
                      <TableCell align="right">CGST</TableCell>
                      <TableCell align="right">SGST</TableCell>
                      <TableCell align="right">IGST</TableCell>
                      <TableCell align="right">Total GST</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <strong>B2B (Business to Business)</strong>
                        <br />
                        <Typography variant="caption" color="textSecondary">
                          {gstr1Data.b2b.transactionCount} invoices
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(gstr1Data.b2b.taxableValue)}
                      </TableCell>
                      <TableCell align="right">{formatCurrency(gstr1Data.b2b.cgst)}</TableCell>
                      <TableCell align="right">{formatCurrency(gstr1Data.b2b.sgst)}</TableCell>
                      <TableCell align="right">{formatCurrency(gstr1Data.b2b.igst)}</TableCell>
                      <TableCell align="right">
                        <strong>{formatCurrency(gstr1Data.b2b.total)}</strong>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <strong>B2C (Business to Consumer)</strong>
                        <br />
                        <Typography variant="caption" color="textSecondary">
                          {gstr1Data.b2c.transactionCount} invoices
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(gstr1Data.b2c.taxableValue)}
                      </TableCell>
                      <TableCell align="right">{formatCurrency(gstr1Data.b2c.cgst)}</TableCell>
                      <TableCell align="right">{formatCurrency(gstr1Data.b2c.sgst)}</TableCell>
                      <TableCell align="right">{formatCurrency(gstr1Data.b2c.igst)}</TableCell>
                      <TableCell align="right">
                        <strong>{formatCurrency(gstr1Data.b2c.total)}</strong>
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ bgcolor: 'action.selected' }}>
                      <TableCell>
                        <strong>Total</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>{formatCurrency(gstr1Data.total.taxableValue)}</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>{formatCurrency(gstr1Data.total.cgst)}</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>{formatCurrency(gstr1Data.total.sgst)}</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>{formatCurrency(gstr1Data.total.igst)}</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>{formatCurrency(gstr1Data.total.total)}</strong>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* GSTR-2 Report */}
          {activeTab === 'gstr2' && gstr2Data && (
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h6">GSTR-2: Inward Supplies (Purchases)</Typography>
                <Button variant="outlined" startIcon={<DownloadIcon />}>
                  Export JSON
                </Button>
              </Box>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Total Bills
                      </Typography>
                      <Typography variant="h4">{gstr2Data.total.transactionCount}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Taxable Value
                      </Typography>
                      <Typography variant="h4">
                        {formatCurrency(gstr2Data.total.taxableValue)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Card>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Input Tax Credit (ITC)
                      </Typography>
                      <Typography variant="h4" color="success.main">
                        {formatCurrency(gstr2Data.total.total)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Taxable Value</TableCell>
                      <TableCell align="right">CGST (ITC)</TableCell>
                      <TableCell align="right">SGST (ITC)</TableCell>
                      <TableCell align="right">IGST (ITC)</TableCell>
                      <TableCell align="right">Total ITC</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <strong>Regular Purchases</strong>
                        <br />
                        <Typography variant="caption" color="textSecondary">
                          {gstr2Data.purchases.transactionCount} bills
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(gstr2Data.purchases.taxableValue)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(gstr2Data.purchases.cgst)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(gstr2Data.purchases.sgst)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(gstr2Data.purchases.igst)}
                      </TableCell>
                      <TableCell align="right">
                        <strong>{formatCurrency(gstr2Data.purchases.total)}</strong>
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ bgcolor: 'action.selected' }}>
                      <TableCell>
                        <strong>Total ITC Available</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>{formatCurrency(gstr2Data.total.taxableValue)}</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>{formatCurrency(gstr2Data.total.cgst)}</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>{formatCurrency(gstr2Data.total.sgst)}</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>{formatCurrency(gstr2Data.total.igst)}</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>{formatCurrency(gstr2Data.total.total)}</strong>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* GSTR-3B Report */}
          {activeTab === 'gstr3b' && gstr3bData && (
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h6">GSTR-3B: Monthly Summary Return</Typography>
                <Button variant="outlined" startIcon={<DownloadIcon />}>
                  Export JSON
                </Button>
              </Box>

              <Alert severity="info" sx={{ mb: 3 }}>
                GSTR-3B is a monthly summary return showing total outward supplies, ITC claimed, and
                GST payable.
              </Alert>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Card sx={{ bgcolor: 'info.light' }}>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Total Outward Supplies
                      </Typography>
                      <Typography variant="h5">
                        {formatCurrency(gstr3bData.outwardSupplies.taxableValue)}
                      </Typography>
                      <Chip
                        label={`GST: ${formatCurrency(gstr3bData.outwardSupplies.total)}`}
                        size="small"
                        sx={{ mt: 1 }}
                      />
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Card sx={{ bgcolor: 'success.light' }}>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        ITC Available (Inward)
                      </Typography>
                      <Typography variant="h5">
                        {formatCurrency(gstr3bData.itcAvailable.total)}
                      </Typography>
                      <Chip
                        label="Can be claimed as credit"
                        size="small"
                        color="success"
                        sx={{ mt: 1 }}
                      />
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Card sx={{ bgcolor: 'warning.light' }}>
                    <CardContent>
                      <Typography color="textSecondary" gutterBottom>
                        Net GST Payable
                      </Typography>
                      <Typography variant="h5" color="error.main">
                        {formatCurrency(gstr3bData.gstPayable.total)}
                      </Typography>
                      <Chip
                        label={gstr3bData.gstPayable.total > 0 ? 'To be paid' : 'Refund due'}
                        size="small"
                        color={gstr3bData.gstPayable.total > 0 ? 'warning' : 'success'}
                        sx={{ mt: 1 }}
                      />
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Particulars</TableCell>
                      <TableCell align="right">CGST</TableCell>
                      <TableCell align="right">SGST</TableCell>
                      <TableCell align="right">IGST</TableCell>
                      <TableCell align="right">Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <strong>GST Collected (Output Tax)</strong>
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(gstr3bData.outwardSupplies.cgst)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(gstr3bData.outwardSupplies.sgst)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(gstr3bData.outwardSupplies.igst)}
                      </TableCell>
                      <TableCell align="right">
                        <strong>{formatCurrency(gstr3bData.outwardSupplies.total)}</strong>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <strong>Less: ITC Claimed (Input Tax)</strong>
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(gstr3bData.itcAvailable.cgst)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(gstr3bData.itcAvailable.sgst)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(gstr3bData.itcAvailable.igst)}
                      </TableCell>
                      <TableCell align="right">
                        <strong>{formatCurrency(gstr3bData.itcAvailable.total)}</strong>
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ bgcolor: 'warning.light' }}>
                      <TableCell>
                        <strong>Net GST Payable / (Refundable)</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>{formatCurrency(gstr3bData.gstPayable.cgst)}</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>{formatCurrency(gstr3bData.gstPayable.sgst)}</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>{formatCurrency(gstr3bData.gstPayable.igst)}</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong
                          style={{ color: gstr3bData.gstPayable.total > 0 ? 'red' : 'green' }}
                        >
                          {formatCurrency(gstr3bData.gstPayable.total)}
                        </strong>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
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
    </Container>
  );
}

// Helper functions to generate GST data
async function generateGSTR1(db: any, start: Timestamp, end: Timestamp): Promise<GSTR1Data> {
  const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
  const q = query(
    transactionsRef,
    where('type', '==', 'CUSTOMER_INVOICE'),
    where('status', 'in', ['POSTED', 'APPROVED']),
    where('date', '>=', start),
    where('date', '<=', end)
  );

  const snapshot = await getDocs(q);
  const b2b: GSTSummary = {
    taxableValue: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    cess: 0,
    total: 0,
    transactionCount: 0,
  };

  const b2c: GSTSummary = { ...b2b };

  snapshot.forEach((doc) => {
    const invoice = doc.data() as {
      subtotal?: number;
      cgst?: number;
      sgst?: number;
      igst?: number;
      entityGSTIN?: string;
    };
    const isB2B = invoice.entityGSTIN && invoice.entityGSTIN.length > 0;
    const target = isB2B ? b2b : b2c;

    target.taxableValue += invoice.subtotal || 0;
    target.cgst += invoice.cgst || 0;
    target.sgst += invoice.sgst || 0;
    target.igst += invoice.igst || 0;
    target.total += (invoice.cgst || 0) + (invoice.sgst || 0) + (invoice.igst || 0);
    target.transactionCount++;
  });

  const total: GSTSummary = {
    taxableValue: b2b.taxableValue + b2c.taxableValue,
    cgst: b2b.cgst + b2c.cgst,
    sgst: b2b.sgst + b2c.sgst,
    igst: b2b.igst + b2c.igst,
    cess: b2b.cess + b2c.cess,
    total: b2b.total + b2c.total,
    transactionCount: b2b.transactionCount + b2c.transactionCount,
  };

  return { b2b, b2c, total };
}

async function generateGSTR2(db: any, start: Timestamp, end: Timestamp): Promise<GSTR2Data> {
  const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
  const q = query(
    transactionsRef,
    where('type', '==', 'VENDOR_BILL'),
    where('status', 'in', ['POSTED', 'APPROVED']),
    where('date', '>=', start),
    where('date', '<=', end)
  );

  const snapshot = await getDocs(q);
  const purchases: GSTSummary = {
    taxableValue: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    cess: 0,
    total: 0,
    transactionCount: 0,
  };

  snapshot.forEach((doc) => {
    const bill = doc.data() as {
      subtotal?: number;
      cgst?: number;
      sgst?: number;
      igst?: number;
    };

    purchases.taxableValue += bill.subtotal || 0;
    purchases.cgst += bill.cgst || 0;
    purchases.sgst += bill.sgst || 0;
    purchases.igst += bill.igst || 0;
    purchases.total += (bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0);
    purchases.transactionCount++;
  });

  return {
    purchases,
    reverseCharge: {
      taxableValue: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      cess: 0,
      total: 0,
      transactionCount: 0,
    },
    total: purchases,
  };
}

async function generateGSTR3B(gstr1: GSTR1Data, gstr2: GSTR2Data): Promise<GSTR3BData> {
  const gstPayable = {
    cgst: gstr1.total.cgst - gstr2.total.cgst,
    sgst: gstr1.total.sgst - gstr2.total.sgst,
    igst: gstr1.total.igst - gstr2.total.igst,
    cess: gstr1.total.cess - gstr2.total.cess,
    total: gstr1.total.total - gstr2.total.total,
  };

  return {
    outwardSupplies: gstr1.total,
    inwardSupplies: gstr2.total,
    netGST: {
      cgst: gstr1.total.cgst,
      sgst: gstr1.total.sgst,
      igst: gstr1.total.igst,
      cess: gstr1.total.cess,
      total: gstr1.total.total,
    },
    itcAvailable: {
      cgst: gstr2.total.cgst,
      sgst: gstr2.total.sgst,
      igst: gstr2.total.igst,
      cess: gstr2.total.cess,
      total: gstr2.total.total,
    },
    gstPayable,
  };
}
