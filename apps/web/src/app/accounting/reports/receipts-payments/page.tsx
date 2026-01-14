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
  Grid,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Link,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
  IconButton,
  Divider,
} from '@mui/material';
import {
  Print as PrintIcon,
  FileDownload as DownloadIcon,
  Home as HomeIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  TrendingUp as SurplusIcon,
  TrendingDown as DeficitIcon,
  AccountBalanceWallet as WalletIcon,
  ArrowDownward as ReceiptIcon,
  ArrowUpward as PaymentIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { canViewAccounting } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import {
  generateReceiptsPaymentsReport,
  type MonthlyReceiptsPaymentsReport,
  type PaymentCategoryBreakdown,
  type ProjectReceipt,
  type ReceiptPaymentLineItem,
} from '@/lib/accounting/reports/receiptsPayments';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';

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

// Generate year options (last 5 years + current year)
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => currentYear - 5 + i).reverse();

export default function ReceiptsPaymentsPage() {
  const router = useRouter();
  const { claims } = useAuth();

  // Date selection
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(currentYear);

  // Report state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<MonthlyReceiptsPaymentsReport | null>(null);

  // Expandable sections
  const [expandedReceipts, setExpandedReceipts] = useState(true);
  const [expandedPayments, setExpandedPayments] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    SALARY_WAGES: false,
    PROJECT_EXPENSES: false,
    DUTIES_TAXES: false,
    ADMINISTRATIVE_EXPENSES: false,
    LOANS_OTHER_PAYMENTS: false,
  });
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});

  const hasViewAccess = claims?.permissions ? canViewAccounting(claims.permissions) : false;

  const handleGenerate = async () => {
    setLoading(true);
    setError('');

    try {
      const { db } = getFirebase();
      const result = await generateReceiptsPaymentsReport(db, month, year);
      setReport(result);
    } catch (err) {
      console.error('[ReceiptsPayments] Error generating report:', err);
      setError('Failed to generate report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => ({
      ...prev,
      [projectId]: !prev[projectId],
    }));
  };

  if (!hasViewAccess) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Monthly Receipts & Payments
          </Typography>
          <Alert severity="error">You do not have permission to view financial reports.</Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      {/* Breadcrumbs */}
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
          Financial Reports
        </Link>
        <Typography color="text.primary">Receipts & Payments</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Monthly Receipts & Payments
        </Typography>
        <Typography variant="body1" color="text.secondary">
          View monthly cash receipts and payments with categorized breakdowns
        </Typography>
      </Box>

      {/* Month/Year Selector */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 3 }}>
            <FormControl fullWidth>
              <InputLabel>Month</InputLabel>
              <Select
                value={month}
                onChange={(e) => setMonth(e.target.value as number)}
                label="Month"
              >
                {MONTHS.map((m) => (
                  <MenuItem key={m.value} value={m.value}>
                    {m.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Year</InputLabel>
              <Select value={year} onChange={(e) => setYear(e.target.value as number)} label="Year">
                {YEARS.map((y) => (
                  <MenuItem key={y} value={y}>
                    {y}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button variant="contained" onClick={handleGenerate} disabled={loading}>
                {loading ? <CircularProgress size={24} /> : 'Generate Report'}
              </Button>
              {report && (
                <>
                  <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
                    Print
                  </Button>
                  <Button variant="outlined" startIcon={<DownloadIcon />} disabled>
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

      {/* Report Content */}
      {report && (
        <>
          {/* Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <WalletIcon sx={{ color: 'info.main', mr: 1 }} />
                    <Typography variant="subtitle2" color="text.secondary">
                      Opening Balance
                    </Typography>
                  </Box>
                  <Typography variant="h5">{formatCurrency(report.openingBalance)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ bgcolor: 'success.light' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <ReceiptIcon sx={{ color: 'success.dark', mr: 1 }} />
                    <Typography variant="subtitle2" color="success.dark">
                      Total Receipts
                    </Typography>
                  </Box>
                  <Typography variant="h5" color="success.dark">
                    {formatCurrency(report.summary.totalReceipts)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ bgcolor: 'error.light' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <PaymentIcon sx={{ color: 'error.dark', mr: 1 }} />
                    <Typography variant="subtitle2" color="error.dark">
                      Total Payments
                    </Typography>
                  </Box>
                  <Typography variant="h5" color="error.dark">
                    {formatCurrency(report.summary.totalPayments)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ bgcolor: report.summary.isDeficit ? 'warning.light' : 'primary.light' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <WalletIcon
                      sx={{
                        color: report.summary.isDeficit ? 'warning.dark' : 'primary.dark',
                        mr: 1,
                      }}
                    />
                    <Typography
                      variant="subtitle2"
                      color={report.summary.isDeficit ? 'warning.dark' : 'primary.dark'}
                    >
                      Closing Balance
                    </Typography>
                  </Box>
                  <Typography
                    variant="h5"
                    color={report.summary.isDeficit ? 'warning.dark' : 'primary.dark'}
                  >
                    {formatCurrency(report.summary.closingBalance)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Receipts Section */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
              onClick={() => setExpandedReceipts(!expandedReceipts)}
            >
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                <ReceiptIcon sx={{ mr: 1, color: 'success.main' }} />
                Receipts (Income)
              </Typography>
              <IconButton size="small">
                {expandedReceipts ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>

            <Collapse in={expandedReceipts}>
              <Box sx={{ mt: 2 }}>
                {/* Project-wise Receipts */}
                {report.receipts.projectReceipts.length > 0 && (
                  <>
                    <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                      Project-wise Receipts
                    </Typography>
                    <TableContainer sx={{ mb: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'action.hover' }}>
                            <TableCell width="50%">Project</TableCell>
                            <TableCell align="right">Amount (INR)</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {report.receipts.projectReceipts.map((project: ProjectReceipt) => (
                            <>
                              <TableRow
                                key={project.projectId}
                                hover
                                onClick={() => toggleProject(project.projectId)}
                                sx={{ cursor: 'pointer' }}
                              >
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <IconButton size="small">
                                      {expandedProjects[project.projectId] ? (
                                        <ExpandLessIcon fontSize="small" />
                                      ) : (
                                        <ExpandMoreIcon fontSize="small" />
                                      )}
                                    </IconButton>
                                    <strong>{project.projectCode}</strong> - {project.projectName}
                                  </Box>
                                </TableCell>
                                <TableCell align="right">
                                  <strong>{formatCurrency(project.total)}</strong>
                                </TableCell>
                              </TableRow>
                              {expandedProjects[project.projectId] &&
                                project.items.map((item: ReceiptPaymentLineItem, idx: number) => (
                                  <TableRow key={`${project.projectId}-${idx}`}>
                                    <TableCell sx={{ pl: 6 }}>
                                      <Typography variant="body2" color="text.secondary">
                                        {item.transactionNumber} - {item.description || 'Receipt'}
                                        {item.entityName && ` (${item.entityName})`}
                                      </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                      <Typography variant="body2">
                                        {formatCurrency(item.amount)}
                                      </Typography>
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </>
                          ))}
                          <TableRow sx={{ bgcolor: 'success.light' }}>
                            <TableCell>
                              <strong>Total Project Receipts</strong>
                            </TableCell>
                            <TableCell align="right">
                              <strong>
                                {formatCurrency(report.receipts.totalProjectReceipts)}
                              </strong>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                )}

                {/* Other Income */}
                {report.receipts.otherIncome.length > 0 && (
                  <>
                    <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                      Other Sources of Income
                    </Typography>
                    <TableContainer sx={{ mb: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'action.hover' }}>
                            <TableCell>Date</TableCell>
                            <TableCell>Reference</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell align="right">Amount (INR)</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {report.receipts.otherIncome.map(
                            (item: ReceiptPaymentLineItem, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell>{new Date(item.date).toLocaleDateString()}</TableCell>
                                <TableCell>{item.transactionNumber}</TableCell>
                                <TableCell>
                                  {item.description || item.accountName}
                                  {item.entityName && ` - ${item.entityName}`}
                                </TableCell>
                                <TableCell align="right">{formatCurrency(item.amount)}</TableCell>
                              </TableRow>
                            )
                          )}
                          <TableRow sx={{ bgcolor: 'success.light' }}>
                            <TableCell colSpan={3}>
                              <strong>Total Other Income</strong>
                            </TableCell>
                            <TableCell align="right">
                              <strong>{formatCurrency(report.receipts.totalOtherIncome)}</strong>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                )}

                {/* Total Receipts */}
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Paper
                    elevation={2}
                    sx={{ p: 2, bgcolor: 'success.main', color: 'success.contrastText' }}
                  >
                    <Typography variant="h6">
                      Total Monthly Receipts: {formatCurrency(report.receipts.totalReceipts)}
                    </Typography>
                  </Paper>
                </Box>
              </Box>
            </Collapse>
          </Paper>

          {/* Payments Section */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
              onClick={() => setExpandedPayments(!expandedPayments)}
            >
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                <PaymentIcon sx={{ mr: 1, color: 'error.main' }} />
                Payments (Expenses)
              </Typography>
              <IconButton size="small">
                {expandedPayments ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>

            <Collapse in={expandedPayments}>
              <Box sx={{ mt: 2 }}>
                {/* Payment Categories */}
                {[
                  { key: 'salaryWages', data: report.payments.salaryWages },
                  { key: 'projectExpenses', data: report.payments.projectExpenses },
                  { key: 'dutiesTaxes', data: report.payments.dutiesTaxes },
                  { key: 'administrativeExpenses', data: report.payments.administrativeExpenses },
                  { key: 'loansOtherPayments', data: report.payments.loansOtherPayments },
                ].map(({ key, data }: { key: string; data: PaymentCategoryBreakdown }) => (
                  <Box key={key} sx={{ mb: 2 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1,
                        bgcolor: 'action.hover',
                        borderRadius: 1,
                        cursor: 'pointer',
                      }}
                      onClick={() => toggleCategory(key)}
                    >
                      <Typography variant="subtitle1">
                        <strong>{data.categoryLabel}</strong>
                        <Typography component="span" color="text.secondary" sx={{ ml: 1 }}>
                          ({data.items.length} transactions)
                        </Typography>
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="subtitle1" sx={{ mr: 1 }}>
                          <strong>{formatCurrency(data.total)}</strong>
                        </Typography>
                        <IconButton size="small">
                          {expandedCategories[key] ? (
                            <ExpandLessIcon fontSize="small" />
                          ) : (
                            <ExpandMoreIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Box>
                    </Box>

                    <Collapse in={expandedCategories[key]}>
                      {data.items.length > 0 ? (
                        <TableContainer sx={{ mt: 1 }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Date</TableCell>
                                <TableCell>Reference</TableCell>
                                <TableCell>Description</TableCell>
                                <TableCell>Account</TableCell>
                                <TableCell align="right">Amount (INR)</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {data.items.map((item: ReceiptPaymentLineItem, idx: number) => (
                                <TableRow key={idx}>
                                  <TableCell>{new Date(item.date).toLocaleDateString()}</TableCell>
                                  <TableCell>{item.transactionNumber}</TableCell>
                                  <TableCell>
                                    {item.description}
                                    {item.entityName && ` - ${item.entityName}`}
                                  </TableCell>
                                  <TableCell>{item.accountName}</TableCell>
                                  <TableCell align="right">{formatCurrency(item.amount)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      ) : (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ p: 2, textAlign: 'center' }}
                        >
                          No transactions in this category
                        </Typography>
                      )}
                    </Collapse>
                  </Box>
                ))}

                {/* Total Payments */}
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Paper
                    elevation={2}
                    sx={{ p: 2, bgcolor: 'error.main', color: 'error.contrastText' }}
                  >
                    <Typography variant="h6">
                      Total Monthly Payments: {formatCurrency(report.payments.totalPayments)}
                    </Typography>
                  </Paper>
                </Box>
              </Box>
            </Collapse>
          </Paper>

          {/* Monthly Summary */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
              {report.summary.isDeficit ? (
                <DeficitIcon sx={{ mr: 1, color: 'error.main' }} />
              ) : (
                <SurplusIcon sx={{ mr: 1, color: 'success.main' }} />
              )}
              Monthly Summary
            </Typography>

            <TableContainer>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <strong>Total Monthly Receipts</strong>
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'success.main' }}>
                      <strong>{formatCurrency(report.summary.totalReceipts)}</strong>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <strong>Total Monthly Payments</strong>
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'error.main' }}>
                      <strong>{formatCurrency(report.summary.totalPayments)}</strong>
                    </TableCell>
                  </TableRow>
                  <TableRow
                    sx={{ bgcolor: report.summary.isDeficit ? 'error.light' : 'success.light' }}
                  >
                    <TableCell>
                      <strong>
                        Net {report.summary.isDeficit ? 'Deficit' : 'Surplus'} for the Month
                      </strong>
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ color: report.summary.isDeficit ? 'error.main' : 'success.main' }}
                    >
                      <strong>
                        {report.summary.isDeficit ? '(' : ''}
                        {formatCurrency(Math.abs(report.summary.netSurplusDeficit))}
                        {report.summary.isDeficit ? ')' : ''}
                      </strong>
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ bgcolor: 'primary.light' }}>
                    <TableCell>
                      <strong>Closing Balance</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>{formatCurrency(report.summary.closingBalance)}</strong>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            <Box sx={{ mt: 3, textAlign: 'right' }}>
              <Typography variant="caption" color="text.secondary">
                Report generated on {new Date(report.generatedAt).toLocaleString()}
              </Typography>
            </Box>
          </Paper>
        </>
      )}

      {/* Empty State */}
      {!report && !loading && (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            Select a month and year, then click &quot;Generate Report&quot; to view the receipts and
            payments summary
          </Typography>
        </Paper>
      )}
    </Container>
  );
}
