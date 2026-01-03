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
  CircularProgress,
  Alert,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Print as PrintIcon,
  FileDownload as DownloadIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { canViewAccounting } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import {
  generateCashFlowStatement,
  type CashFlowStatement,
} from '@/lib/accounting/reports/cashFlow';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';

export default function CashFlowStatementPage() {
  const router = useRouter();
  const { claims } = useAuth();
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0] || '';
  });
  const [endDate, setEndDate] = useState<string>(
    () => new Date().toISOString().split('T')[0] || ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statement, setStatement] = useState<CashFlowStatement | null>(null);

  const hasViewAccess = claims?.permissions ? canViewAccounting(claims.permissions) : false;

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date must be before end date');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();
      const result = await generateCashFlowStatement(db, new Date(startDate), new Date(endDate));
      setStatement(result);
    } catch (err) {
      console.error('[CashFlowStatement] Error generating report:', err);
      setError('Failed to generate cash flow statement');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!hasViewAccess) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Cash Flow Statement
          </Typography>
          <Alert severity="error">You do not have permission to view financial reports.</Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/accounting"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/accounting');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Accounting
        </Link>
        <Link
          color="inherit"
          href="/accounting/reports"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/accounting/reports');
          }}
          sx={{ cursor: 'pointer' }}
        >
          Reports
        </Link>
        <Typography color="text.primary">Cash Flow</Typography>
      </Breadcrumbs>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Cash Flow Statement
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Track cash inflows and outflows from operating, investing, and financing activities
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
              <Button variant="contained" onClick={handleGenerate} disabled={loading}>
                {loading ? <CircularProgress size={24} /> : 'Generate Report'}
              </Button>
              {statement && (
                <>
                  <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
                    Print
                  </Button>
                  <Button variant="outlined" startIcon={<DownloadIcon />}>
                    Export PDF
                  </Button>
                </>
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

      {/* Cash Flow Statement */}
      {statement && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <Typography variant="h5" gutterBottom>
              Vapour Desal Technologies Private Limited
            </Typography>
            <Typography variant="h6" gutterBottom>
              Cash Flow Statement
            </Typography>
            <Typography variant="body2" color="text.secondary">
              For the period {new Date(statement.startDate).toLocaleDateString()} to{' '}
              {new Date(statement.endDate).toLocaleDateString()}
            </Typography>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <strong>Particulars</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>Amount (₹)</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* Opening Cash Balance */}
                <TableRow>
                  <TableCell>
                    <strong>Opening Cash & Cash Equivalents</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>{formatCurrency(statement.openingCash)}</strong>
                  </TableCell>
                </TableRow>

                {/* Operating Activities */}
                <TableRow>
                  <TableCell colSpan={2} sx={{ bgcolor: 'action.hover', pt: 2, pb: 1 }}>
                    <strong>{statement.operating.title}</strong>
                  </TableCell>
                </TableRow>
                {statement.operating.lines.map((line, index) => (
                  <TableRow key={index}>
                    <TableCell sx={{ pl: line.isSubtotal ? 2 : 4 }}>
                      {line.isSubtotal ? <strong>{line.description}</strong> : line.description}
                    </TableCell>
                    <TableCell align="right">
                      {line.isSubtotal ? (
                        <strong>{formatCurrency(line.amount)}</strong>
                      ) : (
                        formatCurrency(line.amount)
                      )}
                    </TableCell>
                  </TableRow>
                ))}

                {/* Investing Activities */}
                <TableRow>
                  <TableCell colSpan={2} sx={{ bgcolor: 'action.hover', pt: 2, pb: 1 }}>
                    <strong>{statement.investing.title}</strong>
                  </TableCell>
                </TableRow>
                {statement.investing.lines.map((line, index) => (
                  <TableRow key={index}>
                    <TableCell sx={{ pl: line.isSubtotal ? 2 : 4 }}>
                      {line.isSubtotal ? <strong>{line.description}</strong> : line.description}
                    </TableCell>
                    <TableCell align="right">
                      {line.isSubtotal ? (
                        <strong>{formatCurrency(line.amount)}</strong>
                      ) : (
                        formatCurrency(line.amount)
                      )}
                    </TableCell>
                  </TableRow>
                ))}

                {/* Financing Activities */}
                <TableRow>
                  <TableCell colSpan={2} sx={{ bgcolor: 'action.hover', pt: 2, pb: 1 }}>
                    <strong>{statement.financing.title}</strong>
                  </TableCell>
                </TableRow>
                {statement.financing.lines.map((line, index) => (
                  <TableRow key={index}>
                    <TableCell sx={{ pl: line.isSubtotal ? 2 : 4 }}>
                      {line.isSubtotal ? <strong>{line.description}</strong> : line.description}
                    </TableCell>
                    <TableCell align="right">
                      {line.isSubtotal ? (
                        <strong>{formatCurrency(line.amount)}</strong>
                      ) : (
                        formatCurrency(line.amount)
                      )}
                    </TableCell>
                  </TableRow>
                ))}

                {/* Net Cash Flow */}
                <TableRow sx={{ bgcolor: 'action.selected' }}>
                  <TableCell>
                    <strong>Net Increase/(Decrease) in Cash</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong style={{ color: statement.netCashFlow >= 0 ? 'green' : 'red' }}>
                      {formatCurrency(statement.netCashFlow)}
                    </strong>
                  </TableCell>
                </TableRow>

                {/* Closing Cash Balance */}
                <TableRow sx={{ bgcolor: 'primary.light' }}>
                  <TableCell>
                    <strong>Closing Cash & Cash Equivalents</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>{formatCurrency(statement.closingCash)}</strong>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ mt: 3, textAlign: 'right' }}>
            <Typography variant="caption" color="text.secondary">
              Generated on {new Date(statement.generatedAt).toLocaleString()}
            </Typography>
          </Box>
        </Paper>
      )}

      {!statement && !loading && (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            Select a date range and click &quot;Generate Report&quot; to view the cash flow
            statement
          </Typography>
        </Paper>
      )}
    </Container>
  );
}
