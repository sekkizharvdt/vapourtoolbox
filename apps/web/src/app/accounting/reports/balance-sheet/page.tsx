'use client';

import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  AccountBalance as AccountBalanceIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { getFirebase } from '@/lib/firebase';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import {
  generateBalanceSheet,
  validateAccountingEquation,
  type BalanceSheetReport,
} from '@/lib/accounting/reports/balanceSheet';

export default function BalanceSheetPage() {
  const [asOfDate, setAsOfDate] = useState<string>(() => {
    // Default to today
    const today = new Date().toISOString().split('T')[0];
    return today || '';
  });
  const [report, setReport] = useState<BalanceSheetReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    if (!asOfDate) {
      setError('Please select a date');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { db } = getFirebase();
      const date = new Date(asOfDate);

      const reportData = await generateBalanceSheet(db, date);
      setReport(reportData);
    } catch (err) {
      console.error('[BalanceSheetPage] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const validation = report ? validateAccountingEquation(report) : null;

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={2}>
          <AccountBalanceIcon sx={{ fontSize: 40 }} color="primary" />
          <Box>
            <Typography variant="h4">Balance Sheet</Typography>
            <Typography variant="body2" color="text.secondary">
              Statement of financial position showing assets, liabilities, and equity
            </Typography>
          </Box>
        </Stack>

        {/* Date Selector */}
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              label="As of Date"
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
              helperText="Balance sheet shows financial position as of this date"
            />
            <Button
              variant="contained"
              onClick={handleGenerateReport}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <AccountBalanceIcon />}
            >
              Generate Report
            </Button>
          </Stack>
        </Paper>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Validation Alert */}
        {validation && (
          <Alert
            severity={validation.valid ? 'success' : 'error'}
            icon={validation.valid ? <CheckCircleIcon /> : <ErrorIcon />}
          >
            {validation.message}
          </Alert>
        )}

        {/* Report Display */}
        {report && (
          <>
            {/* Summary Cards */}
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 3, bgcolor: 'info.lighter' }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Assets
                  </Typography>
                  <Typography variant="h4" sx={{ mt: 1 }}>
                    {formatCurrency(report.assets.totalAssets)}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 3, bgcolor: 'warning.lighter' }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Liabilities
                  </Typography>
                  <Typography variant="h4" sx={{ mt: 1 }}>
                    {formatCurrency(report.liabilities.totalLiabilities)}
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper sx={{ p: 3, bgcolor: 'success.lighter' }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Equity
                  </Typography>
                  <Typography variant="h4" sx={{ mt: 1 }}>
                    {formatCurrency(report.equity.totalEquity)}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            {/* Balance Sheet Table - Two Column Layout */}
            <Grid container spacing={3}>
              {/* Assets Column */}
              <Grid item xs={12} md={6}>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell colSpan={2}>
                          <Typography variant="h6" fontWeight="bold">
                            ASSETS
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            As of {new Date(report.asOfDate).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {/* Current Assets */}
                      <TableRow>
                        <TableCell colSpan={2}>
                          <Typography variant="subtitle2" fontWeight="bold">
                            Current Assets
                          </Typography>
                        </TableCell>
                      </TableRow>
                      {report.assets.currentAssets.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell sx={{ pl: 4 }}>{account.name}</TableCell>
                          <TableCell align="right">{formatCurrency(account.balance)}</TableCell>
                        </TableRow>
                      ))}
                      {report.assets.currentAssets.length === 0 && (
                        <TableRow>
                          <TableCell sx={{ pl: 4 }} colSpan={2}>
                            <Typography variant="body2" color="text.secondary">
                              No current assets
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>Total Current Assets</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(report.assets.totalCurrentAssets)}
                        </TableCell>
                      </TableRow>

                      {/* Fixed Assets */}
                      <TableRow>
                        <TableCell colSpan={2} sx={{ pt: 2 }}>
                          <Typography variant="subtitle2" fontWeight="bold">
                            Fixed Assets
                          </Typography>
                        </TableCell>
                      </TableRow>
                      {report.assets.fixedAssets.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell sx={{ pl: 4 }}>{account.name}</TableCell>
                          <TableCell align="right">{formatCurrency(account.balance)}</TableCell>
                        </TableRow>
                      ))}
                      {report.assets.fixedAssets.length === 0 && (
                        <TableRow>
                          <TableCell sx={{ pl: 4 }} colSpan={2}>
                            <Typography variant="body2" color="text.secondary">
                              No fixed assets
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>Total Fixed Assets</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(report.assets.totalFixedAssets)}
                        </TableCell>
                      </TableRow>

                      {/* Other Assets */}
                      {report.assets.otherAssets.length > 0 && (
                        <>
                          <TableRow>
                            <TableCell colSpan={2} sx={{ pt: 2 }}>
                              <Typography variant="subtitle2" fontWeight="bold">
                                Other Assets
                              </Typography>
                            </TableCell>
                          </TableRow>
                          {report.assets.otherAssets.map((account) => (
                            <TableRow key={account.id}>
                              <TableCell sx={{ pl: 4 }}>{account.name}</TableCell>
                              <TableCell align="right">{formatCurrency(account.balance)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow sx={{ bgcolor: 'action.hover' }}>
                            <TableCell sx={{ fontWeight: 'bold' }}>Total Other Assets</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                              {formatCurrency(report.assets.totalOtherAssets)}
                            </TableCell>
                          </TableRow>
                        </>
                      )}

                      {/* Total Assets */}
                      <TableRow sx={{ bgcolor: 'info.main', color: 'white' }}>
                        <TableCell sx={{ fontWeight: 'bold', color: 'inherit' }}>
                          <Typography variant="h6">TOTAL ASSETS</Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'inherit' }}>
                          <Typography variant="h6">
                            {formatCurrency(report.assets.totalAssets)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>

              {/* Liabilities & Equity Column */}
              <Grid item xs={12} md={6}>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell colSpan={2}>
                          <Typography variant="h6" fontWeight="bold">
                            LIABILITIES & EQUITY
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            As of {new Date(report.asOfDate).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {/* Current Liabilities */}
                      <TableRow>
                        <TableCell colSpan={2}>
                          <Typography variant="subtitle2" fontWeight="bold">
                            Current Liabilities
                          </Typography>
                        </TableCell>
                      </TableRow>
                      {report.liabilities.currentLiabilities.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell sx={{ pl: 4 }}>{account.name}</TableCell>
                          <TableCell align="right">{formatCurrency(account.balance)}</TableCell>
                        </TableRow>
                      ))}
                      {report.liabilities.currentLiabilities.length === 0 && (
                        <TableRow>
                          <TableCell sx={{ pl: 4 }} colSpan={2}>
                            <Typography variant="body2" color="text.secondary">
                              No current liabilities
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>Total Current Liabilities</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(report.liabilities.totalCurrentLiabilities)}
                        </TableCell>
                      </TableRow>

                      {/* Long-term Liabilities */}
                      {report.liabilities.longTermLiabilities.length > 0 && (
                        <>
                          <TableRow>
                            <TableCell colSpan={2} sx={{ pt: 2 }}>
                              <Typography variant="subtitle2" fontWeight="bold">
                                Long-term Liabilities
                              </Typography>
                            </TableCell>
                          </TableRow>
                          {report.liabilities.longTermLiabilities.map((account) => (
                            <TableRow key={account.id}>
                              <TableCell sx={{ pl: 4 }}>{account.name}</TableCell>
                              <TableCell align="right">{formatCurrency(account.balance)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow sx={{ bgcolor: 'action.hover' }}>
                            <TableCell sx={{ fontWeight: 'bold' }}>
                              Total Long-term Liabilities
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                              {formatCurrency(report.liabilities.totalLongTermLiabilities)}
                            </TableCell>
                          </TableRow>
                        </>
                      )}

                      {/* Total Liabilities */}
                      <TableRow sx={{ bgcolor: 'warning.lighter' }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>Total Liabilities</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(report.liabilities.totalLiabilities)}
                        </TableCell>
                      </TableRow>

                      {/* Equity Section */}
                      <TableRow>
                        <TableCell colSpan={2} sx={{ pt: 2 }}>
                          <Typography variant="subtitle2" fontWeight="bold">
                            Equity
                          </Typography>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ pl: 4 }}>Capital</TableCell>
                        <TableCell align="right">{formatCurrency(report.equity.capital)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ pl: 4 }}>Retained Earnings</TableCell>
                        <TableCell align="right">
                          {formatCurrency(report.equity.retainedEarnings)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ pl: 4 }}>Current Year Profit</TableCell>
                        <TableCell align="right">
                          {formatCurrency(report.equity.currentYearProfit)}
                        </TableCell>
                      </TableRow>
                      <TableRow sx={{ bgcolor: 'success.lighter' }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>Total Equity</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(report.equity.totalEquity)}
                        </TableCell>
                      </TableRow>

                      {/* Total Liabilities & Equity */}
                      <TableRow sx={{ bgcolor: 'info.main', color: 'white' }}>
                        <TableCell sx={{ fontWeight: 'bold', color: 'inherit' }}>
                          <Typography variant="h6">TOTAL LIABILITIES & EQUITY</Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: 'inherit' }}>
                          <Typography variant="h6">
                            {formatCurrency(
                              report.liabilities.totalLiabilities + report.equity.totalEquity
                            )}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>

            {/* Accounting Equation */}
            <Paper sx={{ p: 3, bgcolor: report.balanced ? 'success.lighter' : 'error.lighter' }}>
              <Typography variant="h6" gutterBottom>
                Accounting Equation
              </Typography>
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                <Chip label={`Assets: ${formatCurrency(report.assets.totalAssets)}`} />
                <Typography variant="h6">=</Typography>
                <Chip
                  label={`Liabilities: ${formatCurrency(report.liabilities.totalLiabilities)}`}
                />
                <Typography variant="h6">+</Typography>
                <Chip label={`Equity: ${formatCurrency(report.equity.totalEquity)}`} />
              </Stack>
              {!report.balanced && (
                <Typography variant="body2" color="error" sx={{ mt: 2 }}>
                  Difference: {formatCurrency(Math.abs(report.difference))}
                </Typography>
              )}
            </Paper>
          </>
        )}

        {/* Empty State */}
        {!report && !loading && (
          <Paper sx={{ p: 6, textAlign: 'center' }}>
            <AccountBalanceIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Select Date
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Choose a date, then click &quot;Generate Report&quot; to view the Balance Sheet as of
              that date.
            </Typography>
          </Paper>
        )}
      </Stack>
    </Box>
  );
}
