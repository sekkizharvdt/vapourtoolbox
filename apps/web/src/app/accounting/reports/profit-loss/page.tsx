'use client';

import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  Divider,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { getFirebase } from '@/lib/firebase';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import {
  generateProfitLossReport,
  type ProfitLossReport,
} from '@/lib/accounting/reports/profitLoss';

export default function ProfitLossPage() {
  const [startDate, setStartDate] = useState<string>(() => {
    // Default to first day of current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    return firstDay || '';
  });
  const [endDate, setEndDate] = useState<string>(() => {
    // Default to today
    const today = new Date().toISOString().split('T')[0];
    return today || '';
  });
  const [report, setReport] = useState<ProfitLossReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { db } = getFirebase();
      const start = new Date(startDate);
      const end = new Date(endDate);

      // Validate date range
      if (start > end) {
        throw new Error('Start date must be before end date');
      }

      const reportData = await generateProfitLossReport(db, start, end);
      setReport(reportData);
    } catch (err) {
      console.error('[ProfitLossPage] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={2}>
          <AssessmentIcon sx={{ fontSize: 40 }} color="primary" />
          <Box>
            <Typography variant="h4">Profit & Loss Statement</Typography>
            <Typography variant="body2" color="text.secondary">
              Income statement showing revenue, expenses, and profit
            </Typography>
          </Box>
        </Stack>

        {/* Date Range Selector */}
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
            <TextField
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
            <Button
              variant="contained"
              onClick={handleGenerateReport}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <AssessmentIcon />}
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

        {/* Report Display */}
        {report && (
          <>
            {/* Summary Cards */}
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={3}
              sx={{ mb: 3 }}
              flexWrap="wrap"
            >
              <Box
                sx={{
                  flex: { xs: '1 1 100%', md: '1 1 calc(33.333% - 16px)' },
                }}
              >
                <Paper sx={{ p: 3, bgcolor: 'success.lighter' }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Revenue
                  </Typography>
                  <Typography variant="h4" sx={{ mt: 1 }}>
                    {formatCurrency(report.revenue.total)}
                  </Typography>
                </Paper>
              </Box>
              <Box
                sx={{
                  flex: { xs: '1 1 100%', md: '1 1 calc(33.333% - 16px)' },
                }}
              >
                <Paper sx={{ p: 3, bgcolor: 'error.lighter' }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Expenses
                  </Typography>
                  <Typography variant="h4" sx={{ mt: 1 }}>
                    {formatCurrency(report.expenses.total)}
                  </Typography>
                </Paper>
              </Box>
              <Box
                sx={{
                  flex: { xs: '1 1 100%', md: '1 1 calc(33.333% - 16px)' },
                }}
              >
                <Paper
                  sx={{
                    p: 3,
                    bgcolor: report.netProfit >= 0 ? 'success.main' : 'error.main',
                    color: 'white',
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="subtitle2">Net Profit</Typography>
                    {report.netProfit >= 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
                  </Stack>
                  <Typography variant="h4" sx={{ mt: 1 }}>
                    {formatCurrency(report.netProfit)}
                  </Typography>
                  <Typography variant="caption">
                    Margin: {report.profitMargin.toFixed(2)}%
                  </Typography>
                </Paper>
              </Box>
            </Stack>

            {/* Detailed P&L Table */}
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight="bold">
                        Profit & Loss Statement
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(report.period.startDate).toLocaleDateString()} -{' '}
                        {new Date(report.period.endDate).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="subtitle2" fontWeight="bold">
                        Amount
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* Revenue Section */}
                  <TableRow>
                    <TableCell colSpan={2}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        Revenue
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ pl: 4 }}>Sales Revenue</TableCell>
                    <TableCell align="right">{formatCurrency(report.revenue.sales)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ pl: 4 }}>Other Income</TableCell>
                    <TableCell align="right">
                      {formatCurrency(report.revenue.otherIncome)}
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Total Revenue</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(report.revenue.total)}
                    </TableCell>
                  </TableRow>

                  {/* Spacer */}
                  <TableRow>
                    <TableCell colSpan={2} sx={{ py: 1 }} />
                  </TableRow>

                  {/* Expenses Section */}
                  <TableRow>
                    <TableCell colSpan={2}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        Expenses
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ pl: 4 }}>Cost of Goods Sold</TableCell>
                    <TableCell align="right">
                      {formatCurrency(report.expenses.costOfGoodsSold)}
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Gross Profit</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(report.grossProfit)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ pl: 4 }}>Operating Expenses</TableCell>
                    <TableCell align="right">
                      {formatCurrency(report.expenses.operatingExpenses)}
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Operating Profit</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(report.operatingProfit)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ pl: 4 }}>Other Expenses</TableCell>
                    <TableCell align="right">
                      {formatCurrency(report.expenses.otherExpenses)}
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Total Expenses</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(report.expenses.total)}
                    </TableCell>
                  </TableRow>

                  {/* Spacer */}
                  <TableRow>
                    <TableCell colSpan={2} sx={{ py: 1 }}>
                      <Divider />
                    </TableCell>
                  </TableRow>

                  {/* Net Profit */}
                  <TableRow
                    sx={{
                      bgcolor: report.netProfit >= 0 ? 'success.lighter' : 'error.lighter',
                    }}
                  >
                    <TableCell>
                      <Typography variant="h6" fontWeight="bold">
                        Net Profit (Loss)
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="h6" fontWeight="bold">
                        {formatCurrency(report.netProfit)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Margin: {report.profitMargin.toFixed(2)}%
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            {/* Notes */}
            <Alert severity="info">
              <Typography variant="body2">
                <strong>Note:</strong> This report shows cumulative balances from account ledgers.
                For accurate period-specific reporting, ensure all transactions are properly
                recorded within the selected date range.
              </Typography>
            </Alert>
          </>
        )}

        {/* Empty State */}
        {!report && !loading && (
          <Paper sx={{ p: 6, textAlign: 'center' }}>
            <AssessmentIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Select Date Range
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Choose a start and end date, then click &quot;Generate Report&quot; to view the Profit
              & Loss statement.
            </Typography>
          </Paper>
        )}
      </Stack>
    </Box>
  );
}
