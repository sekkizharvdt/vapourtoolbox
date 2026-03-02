'use client';

import { useState, useCallback } from 'react';
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
  CircularProgress,
  Alert,
  Chip,
  Breadcrumbs,
  Link,
  Collapse,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  AccountBalance as AccountBalanceIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Home as HomeIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { getFirebase } from '@/lib/firebase';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import {
  generateBalanceSheet,
  validateAccountingEquation,
  type BalanceSheetReport,
  type AccountBalance,
} from '@/lib/accounting/reports/balanceSheet';
import {
  fetchAccountGLEntries,
  getTransactionTypeLabel,
  type GLDrilldownEntry,
} from '@/lib/accounting/reports/glDrilldown';

// ---------------------------------------------------------------------------
// AccountRow: renders a single account row with an expandable GL drill-down
// ---------------------------------------------------------------------------
function AccountRow({
  account,
  expandedAccountId,
  drilldownData,
  drilldownLoading,
  onToggle,
  onNavigate,
}: {
  account: AccountBalance;
  expandedAccountId: string | null;
  drilldownData: Map<string, GLDrilldownEntry[]>;
  drilldownLoading: Set<string>;
  onToggle: (account: AccountBalance) => void;
  onNavigate: (route: string) => void;
}) {
  const isExpanded = expandedAccountId === account.id;
  const isLoading = drilldownLoading.has(account.id);
  const entries = drilldownData.get(account.id) ?? [];

  const formatDate = (date: Date): string =>
    date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <>
      <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => onToggle(account)}>
        <TableCell padding="none" sx={{ pl: 1, width: 40 }}>
          <IconButton size="small">
            {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ pl: 2 }}>{account.name}</TableCell>
        <TableCell align="right">{formatCurrency(account.balance)}</TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={3} sx={{ py: 0, border: 0 }}>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ mx: 4, my: 1 }}>
              {isLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
                  <CircularProgress size={16} />
                  <Typography variant="body2" color="text.secondary">
                    Loading transactions...
                  </Typography>
                </Box>
              ) : entries.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  No GL entries found for this account.
                </Typography>
              ) : (
                <Table size="small" sx={{ mb: 1 }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'grey.50' }}>
                      <TableCell>Date</TableCell>
                      <TableCell>Transaction #</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Debit</TableCell>
                      <TableCell align="right">Credit</TableCell>
                      <TableCell align="center">View</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {entries.map((entry, idx) => (
                      <TableRow key={`${entry.transactionId}-${idx}`} hover>
                        <TableCell>{formatDate(entry.date)}</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {entry.transactionNumber}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getTransactionTypeLabel(entry.transactionType)}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              maxWidth: 200,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {entry.description || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {entry.debit > 0 ? entry.debit.toFixed(2) : '-'}
                        </TableCell>
                        <TableCell align="right">
                          {entry.credit > 0 ? entry.credit.toFixed(2) : '-'}
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip
                            title={`View in ${getTransactionTypeLabel(entry.transactionType)}s`}
                          >
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigate(entry.route);
                              }}
                            >
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function BalanceSheetPage() {
  const router = useRouter();
  const [asOfDate, setAsOfDate] = useState<string>(() => {
    const today = new Date().toISOString().split('T')[0];
    return today || '';
  });
  const [report, setReport] = useState<BalanceSheetReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drill-down state
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [drilldownData, setDrilldownData] = useState<Map<string, GLDrilldownEntry[]>>(new Map());
  const [drilldownLoading, setDrilldownLoading] = useState<Set<string>>(new Set());

  const handleGenerateReport = async () => {
    if (!asOfDate) {
      setError('Please select a date');
      return;
    }

    setLoading(true);
    setError(null);
    // Clear drill-down cache when regenerating the report for a new date
    setExpandedAccountId(null);
    setDrilldownData(new Map());

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

  const handleToggleExpand = useCallback(
    async (account: AccountBalance) => {
      if (expandedAccountId === account.id) {
        setExpandedAccountId(null);
        return;
      }

      setExpandedAccountId(account.id);

      if (!drilldownData.has(account.id)) {
        setDrilldownLoading((prev) => new Set(prev).add(account.id));
        try {
          const { db } = getFirebase();
          const entries = await fetchAccountGLEntries(db, account.id);
          setDrilldownData((prev) => new Map(prev).set(account.id, entries));
        } catch (err) {
          console.error('Error loading GL entries:', err);
          setDrilldownData((prev) => new Map(prev).set(account.id, []));
        } finally {
          setDrilldownLoading((prev) => {
            const next = new Set(prev);
            next.delete(account.id);
            return next;
          });
        }
      }
    },
    [expandedAccountId, drilldownData]
  );

  const validation = report ? validateAccountingEquation(report) : null;

  const accountRowProps = {
    expandedAccountId,
    drilldownData,
    drilldownLoading,
    onToggle: handleToggleExpand,
    onNavigate: (route: string) => router.push(route),
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
        <Typography color="text.primary">Balance Sheet</Typography>
      </Breadcrumbs>

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

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {validation && (
          <Alert
            severity={validation.valid ? 'success' : 'error'}
            icon={validation.valid ? <CheckCircleIcon /> : <ErrorIcon />}
          >
            {validation.message}
          </Alert>
        )}

        {report && (
          <>
            {/* Summary Cards */}
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={3}
              sx={{ mb: 3 }}
              flexWrap="wrap"
            >
              <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(33.333% - 16px)' } }}>
                <Paper sx={{ p: 3, bgcolor: 'info.lighter' }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Assets
                  </Typography>
                  <Typography variant="h4" sx={{ mt: 1 }}>
                    {formatCurrency(report.assets.totalAssets)}
                  </Typography>
                </Paper>
              </Box>
              <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(33.333% - 16px)' } }}>
                <Paper sx={{ p: 3, bgcolor: 'warning.lighter' }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Liabilities
                  </Typography>
                  <Typography variant="h4" sx={{ mt: 1 }}>
                    {formatCurrency(report.liabilities.totalLiabilities)}
                  </Typography>
                </Paper>
              </Box>
              <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(33.333% - 16px)' } }}>
                <Paper sx={{ p: 3, bgcolor: 'success.lighter' }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Total Equity
                  </Typography>
                  <Typography variant="h4" sx={{ mt: 1 }}>
                    {formatCurrency(report.equity.totalEquity)}
                  </Typography>
                </Paper>
              </Box>
            </Stack>

            {/* Balance Sheet Table - Two Column Layout */}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} flexWrap="wrap">
              {/* Assets Column */}
              <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 12px)' } }}>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell colSpan={3}>
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
                        <TableCell colSpan={3}>
                          <Typography variant="subtitle2" fontWeight="bold">
                            Current Assets
                          </Typography>
                        </TableCell>
                      </TableRow>
                      {report.assets.currentAssets.map((account) => (
                        <AccountRow key={account.id} account={account} {...accountRowProps} />
                      ))}
                      {report.assets.currentAssets.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} sx={{ pl: 4 }}>
                            <Typography variant="body2" color="text.secondary">
                              No current assets
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell />
                        <TableCell sx={{ fontWeight: 'bold' }}>Total Current Assets</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(report.assets.totalCurrentAssets)}
                        </TableCell>
                      </TableRow>

                      {/* Fixed Assets */}
                      <TableRow>
                        <TableCell colSpan={3} sx={{ pt: 2 }}>
                          <Typography variant="subtitle2" fontWeight="bold">
                            Fixed Assets
                          </Typography>
                        </TableCell>
                      </TableRow>
                      {report.assets.fixedAssets.map((account) => (
                        <AccountRow key={account.id} account={account} {...accountRowProps} />
                      ))}
                      {report.assets.fixedAssets.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} sx={{ pl: 4 }}>
                            <Typography variant="body2" color="text.secondary">
                              No fixed assets
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell />
                        <TableCell sx={{ fontWeight: 'bold' }}>Total Fixed Assets</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(report.assets.totalFixedAssets)}
                        </TableCell>
                      </TableRow>

                      {/* Other Assets */}
                      {report.assets.otherAssets.length > 0 && (
                        <>
                          <TableRow>
                            <TableCell colSpan={3} sx={{ pt: 2 }}>
                              <Typography variant="subtitle2" fontWeight="bold">
                                Other Assets
                              </Typography>
                            </TableCell>
                          </TableRow>
                          {report.assets.otherAssets.map((account) => (
                            <AccountRow key={account.id} account={account} {...accountRowProps} />
                          ))}
                          <TableRow sx={{ bgcolor: 'action.hover' }}>
                            <TableCell />
                            <TableCell sx={{ fontWeight: 'bold' }}>Total Other Assets</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                              {formatCurrency(report.assets.totalOtherAssets)}
                            </TableCell>
                          </TableRow>
                        </>
                      )}

                      {/* Total Assets */}
                      <TableRow sx={{ bgcolor: 'info.main', color: 'white' }}>
                        <TableCell />
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
              </Box>

              {/* Liabilities & Equity Column */}
              <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 12px)' } }}>
                <TableContainer component={Paper}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell colSpan={3}>
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
                        <TableCell colSpan={3}>
                          <Typography variant="subtitle2" fontWeight="bold">
                            Current Liabilities
                          </Typography>
                        </TableCell>
                      </TableRow>
                      {report.liabilities.currentLiabilities.map((account) => (
                        <AccountRow key={account.id} account={account} {...accountRowProps} />
                      ))}
                      {report.liabilities.currentLiabilities.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} sx={{ pl: 4 }}>
                            <Typography variant="body2" color="text.secondary">
                              No current liabilities
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                      <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell />
                        <TableCell sx={{ fontWeight: 'bold' }}>Total Current Liabilities</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(report.liabilities.totalCurrentLiabilities)}
                        </TableCell>
                      </TableRow>

                      {/* Long-term Liabilities */}
                      {report.liabilities.longTermLiabilities.length > 0 && (
                        <>
                          <TableRow>
                            <TableCell colSpan={3} sx={{ pt: 2 }}>
                              <Typography variant="subtitle2" fontWeight="bold">
                                Long-term Liabilities
                              </Typography>
                            </TableCell>
                          </TableRow>
                          {report.liabilities.longTermLiabilities.map((account) => (
                            <AccountRow key={account.id} account={account} {...accountRowProps} />
                          ))}
                          <TableRow sx={{ bgcolor: 'action.hover' }}>
                            <TableCell />
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
                        <TableCell />
                        <TableCell sx={{ fontWeight: 'bold' }}>Total Liabilities</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(report.liabilities.totalLiabilities)}
                        </TableCell>
                      </TableRow>

                      {/* Equity — aggregate rows, no drill-down */}
                      <TableRow>
                        <TableCell colSpan={3} sx={{ pt: 2 }}>
                          <Typography variant="subtitle2" fontWeight="bold">
                            Equity
                          </Typography>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell />
                        <TableCell sx={{ pl: 2 }}>Capital</TableCell>
                        <TableCell align="right">{formatCurrency(report.equity.capital)}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell />
                        <TableCell sx={{ pl: 2 }}>Retained Earnings</TableCell>
                        <TableCell align="right">
                          {formatCurrency(report.equity.retainedEarnings)}
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell />
                        <TableCell sx={{ pl: 2 }}>Current Year Profit</TableCell>
                        <TableCell align="right">
                          {formatCurrency(report.equity.currentYearProfit)}
                        </TableCell>
                      </TableRow>
                      <TableRow sx={{ bgcolor: 'success.lighter' }}>
                        <TableCell />
                        <TableCell sx={{ fontWeight: 'bold' }}>Total Equity</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                          {formatCurrency(report.equity.totalEquity)}
                        </TableCell>
                      </TableRow>

                      {/* Total Liabilities & Equity */}
                      <TableRow sx={{ bgcolor: 'info.main', color: 'white' }}>
                        <TableCell />
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
              </Box>
            </Stack>

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
