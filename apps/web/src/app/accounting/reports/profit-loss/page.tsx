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
  Breadcrumbs,
  Link,
  Collapse,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Assessment as AssessmentIcon,
  Home as HomeIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  UnfoldMore as UnfoldMoreIcon,
  UnfoldLess as UnfoldLessIcon,
  FileDownload as DownloadIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import {
  generateProfitLossReport,
  type ProfitLossReport,
  type AccountLineItem,
  type PnLTransactionDetail,
} from '@/lib/accounting/reports/profitLoss';
import {
  downloadReportCSV,
  downloadReportExcel,
  type ExportSection,
} from '@/lib/accounting/reports/exportReport';
import type { TransactionType } from '@vapour/types';
import { TRANSACTION_TYPE_SHORT_LABELS } from '@vapour/constants';

function formatTxType(type: string): string {
  return TRANSACTION_TYPE_SHORT_LABELS[type as TransactionType] ?? (type || '—');
}

/**
 * Account row with its own expand state for transaction drill-down
 */
function AccountRow({ account }: { account: AccountLineItem }) {
  const [open, setOpen] = useState(false);
  const hasTransactions = account.transactions.length > 0;

  return (
    <>
      <TableRow
        sx={{
          cursor: hasTransactions ? 'pointer' : 'default',
          '&:hover': hasTransactions ? { bgcolor: 'action.selected' } : {},
        }}
        onClick={hasTransactions ? () => setOpen((v) => !v) : undefined}
      >
        <TableCell sx={{ pl: 8, py: 0.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            {hasTransactions && (
              <IconButton size="small" sx={{ p: 0 }}>
                {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
            )}
            <Typography variant="body2" color="text.secondary">
              {account.code}
            </Typography>
            <Typography variant="body2">{account.name}</Typography>
            {hasTransactions && (
              <Typography variant="caption" color="text.secondary">
                ({account.transactions.length})
              </Typography>
            )}
          </Stack>
        </TableCell>
        <TableCell align="right" sx={{ py: 0.5 }}>
          <Typography variant="body2">{formatCurrency(account.amount)}</Typography>
        </TableCell>
      </TableRow>

      {/* Transaction drill-down */}
      {hasTransactions && (
        <TableRow>
          <TableCell colSpan={2} sx={{ py: 0, pl: 0, pr: 0 }}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ bgcolor: 'grey.100', px: 2, py: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ py: 0.5, fontWeight: 'bold', fontSize: '0.7rem' }}>
                        Date
                      </TableCell>
                      <TableCell sx={{ py: 0.5, fontWeight: 'bold', fontSize: '0.7rem' }}>
                        Type
                      </TableCell>
                      <TableCell sx={{ py: 0.5, fontWeight: 'bold', fontSize: '0.7rem' }}>
                        Number
                      </TableCell>
                      <TableCell sx={{ py: 0.5, fontWeight: 'bold', fontSize: '0.7rem' }}>
                        Customer / Vendor
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ py: 0.5, fontWeight: 'bold', fontSize: '0.7rem' }}
                      >
                        Amount
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {account.transactions.map((txn: PnLTransactionDetail) => (
                      <TableRow key={`${txn.id}-${txn.amount}`}>
                        <TableCell sx={{ py: 0.5, fontSize: '0.75rem' }}>
                          {txn.date.toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </TableCell>
                        <TableCell sx={{ py: 0.5, fontSize: '0.75rem' }}>
                          {formatTxType(txn.type)}
                        </TableCell>
                        <TableCell sx={{ py: 0.5, fontSize: '0.75rem' }}>
                          {txn.transactionNumber || '—'}
                        </TableCell>
                        <TableCell sx={{ py: 0.5, fontSize: '0.75rem' }}>
                          {txn.entityName || '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ py: 0.5, fontSize: '0.75rem' }}>
                          {formatCurrency(txn.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/**
 * Expandable row component for P&L categories with account breakdown
 */
interface ExpandableRowProps {
  label: string;
  amount: number;
  accounts: AccountLineItem[];
  expanded: boolean;
  onToggle: () => void;
}

function ExpandableRow({ label, amount, accounts, expanded, onToggle }: ExpandableRowProps) {
  const hasAccounts = accounts.length > 0;

  return (
    <>
      {/* Main category row */}
      <TableRow
        sx={{
          cursor: hasAccounts ? 'pointer' : 'default',
          '&:hover': hasAccounts ? { bgcolor: 'action.hover' } : {},
        }}
        onClick={hasAccounts ? onToggle : undefined}
      >
        <TableCell sx={{ pl: 4 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            {hasAccounts && (
              <IconButton size="small" sx={{ p: 0 }}>
                {expanded ? (
                  <ExpandLessIcon fontSize="small" />
                ) : (
                  <ExpandMoreIcon fontSize="small" />
                )}
              </IconButton>
            )}
            <Typography>{label}</Typography>
            {hasAccounts && (
              <Typography variant="caption" color="text.secondary">
                ({accounts.length} account{accounts.length !== 1 ? 's' : ''})
              </Typography>
            )}
          </Stack>
        </TableCell>
        <TableCell align="right">{formatCurrency(amount)}</TableCell>
      </TableRow>

      {/* Expanded account details — each account manages its own transaction expansion */}
      {hasAccounts && (
        <TableRow>
          <TableCell colSpan={2} sx={{ py: 0, pl: 0, pr: 0 }}>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Box sx={{ bgcolor: 'grey.50', py: 1 }}>
                <Table size="small">
                  <TableBody>
                    {accounts.map((account) => (
                      <AccountRow key={account.id} account={account} />
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export default function ProfitLossPage() {
  const router = useRouter();
  const { claims } = useAuth();
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

  // Expand/collapse state for each category
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    sales: false,
    otherIncome: false,
    cogs: false,
    operating: false,
    other: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const expandAll = () => {
    setExpandedSections({
      sales: true,
      otherIncome: true,
      cogs: true,
      operating: true,
      other: true,
    });
  };

  const collapseAll = () => {
    setExpandedSections({
      sales: false,
      otherIncome: false,
      cogs: false,
      operating: false,
      other: false,
    });
  };

  const allExpanded = Object.values(expandedSections).every(Boolean);
  const allCollapsed = Object.values(expandedSections).every((v) => !v);

  const buildPnLExportSections = (): ExportSection[] => {
    if (!report) return [];
    const cols = [
      { header: 'Account', key: 'name', width: 35 },
      {
        header: 'Amount',
        key: 'amount',
        width: 18,
        align: 'right' as const,
        format: 'currency' as const,
      },
    ];
    const flattenAccounts = (accounts: AccountLineItem[]) =>
      accounts.map((a) => ({ name: `  ${a.code} ${a.name}`, amount: a.amount }));

    return [
      { title: `Profit & Loss: ${startDate} to ${endDate}`, columns: cols, rows: [] },
      {
        title: 'Revenue',
        columns: cols,
        rows: [
          ...flattenAccounts(report.revenue.salesAccounts),
          ...flattenAccounts(report.revenue.otherIncomeAccounts),
        ],
        summary: { name: 'Total Revenue', amount: report.revenue.total },
      },
      {
        title: 'Cost of Goods Sold',
        columns: cols,
        rows: flattenAccounts(report.expenses.cogsAccounts),
        summary: { name: 'Total COGS', amount: report.expenses.costOfGoodsSold },
      },
      {
        title: 'Operating Expenses',
        columns: cols,
        rows: flattenAccounts(report.expenses.operatingAccounts),
        summary: { name: 'Total Operating', amount: report.expenses.operatingExpenses },
      },
      {
        title: 'Other Expenses',
        columns: cols,
        rows: flattenAccounts(report.expenses.otherAccounts),
        summary: { name: 'Total Other', amount: report.expenses.otherExpenses },
      },
      {
        title: 'Summary',
        columns: cols,
        rows: [
          { name: 'Gross Profit', amount: report.grossProfit },
          { name: 'Operating Profit', amount: report.operatingProfit },
          { name: 'Net Profit', amount: report.netProfit },
        ],
      },
    ];
  };

  const handleExportCSV = () =>
    downloadReportCSV(buildPnLExportSections(), `PnL_${startDate}_to_${endDate}`);
  const handleExportExcel = () =>
    downloadReportExcel(
      buildPnLExportSections(),
      `PnL_${startDate}_to_${endDate}`,
      'Profit & Loss'
    );

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

      const entityId = claims?.entityId;
      if (!entityId) {
        throw new Error('No entity selected');
      }
      const reportData = await generateProfitLossReport(db, start, end, entityId);
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
        <Typography color="text.primary">Profit & Loss</Typography>
      </Breadcrumbs>

      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={2}>
            <AssessmentIcon sx={{ fontSize: 40 }} color="primary" />
            <Box>
              <Typography variant="h4">Profit & Loss Statement</Typography>
              <Typography variant="body2" color="text.secondary">
                Income statement showing revenue, expenses, and profit
              </Typography>
            </Box>
          </Stack>
          {report && (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Export CSV">
                <IconButton onClick={handleExportCSV} size="small">
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Export Excel">
                <IconButton onClick={handleExportExcel} size="small" color="primary">
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          )}
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
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <Box>
                          <Typography variant="subtitle2" fontWeight="bold">
                            Profit & Loss Statement
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(report.period.startDate).toLocaleDateString()} -{' '}
                            {new Date(report.period.endDate).toLocaleDateString()}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Stack
                        direction="row"
                        spacing={1}
                        justifyContent="flex-end"
                        alignItems="center"
                      >
                        <Tooltip title={allExpanded ? 'All expanded' : 'Expand All'}>
                          <span>
                            <IconButton size="small" onClick={expandAll} disabled={allExpanded}>
                              <UnfoldMoreIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={allCollapsed ? 'All collapsed' : 'Collapse All'}>
                          <span>
                            <IconButton size="small" onClick={collapseAll} disabled={allCollapsed}>
                              <UnfoldLessIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Typography variant="subtitle2" fontWeight="bold" sx={{ ml: 1 }}>
                          Amount
                        </Typography>
                      </Stack>
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

                  {/* Sales Revenue - Expandable */}
                  <ExpandableRow
                    label="Sales Revenue"
                    amount={report.revenue.sales}
                    accounts={report.revenue.salesAccounts}
                    expanded={expandedSections.sales ?? false}
                    onToggle={() => toggleSection('sales')}
                  />

                  {/* Other Income - Expandable */}
                  <ExpandableRow
                    label="Other Income"
                    amount={report.revenue.otherIncome}
                    accounts={report.revenue.otherIncomeAccounts}
                    expanded={expandedSections.otherIncome ?? false}
                    onToggle={() => toggleSection('otherIncome')}
                  />

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

                  {/* Cost of Goods Sold - Expandable */}
                  <ExpandableRow
                    label="Cost of Goods Sold"
                    amount={report.expenses.costOfGoodsSold}
                    accounts={report.expenses.cogsAccounts}
                    expanded={expandedSections.cogs ?? false}
                    onToggle={() => toggleSection('cogs')}
                  />

                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Gross Profit</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(report.grossProfit)}
                    </TableCell>
                  </TableRow>

                  {/* Operating Expenses - Expandable */}
                  <ExpandableRow
                    label="Operating Expenses"
                    amount={report.expenses.operatingExpenses}
                    accounts={report.expenses.operatingAccounts}
                    expanded={expandedSections.operating ?? false}
                    onToggle={() => toggleSection('operating')}
                  />

                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Operating Profit</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      {formatCurrency(report.operatingProfit)}
                    </TableCell>
                  </TableRow>

                  {/* Other Expenses - Expandable */}
                  <ExpandableRow
                    label="Other Expenses"
                    amount={report.expenses.otherExpenses}
                    accounts={report.expenses.otherAccounts}
                    expanded={expandedSections.other ?? false}
                    onToggle={() => toggleSection('other')}
                  />

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
