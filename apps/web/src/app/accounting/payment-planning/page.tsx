'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import {
  downloadReportCSV,
  downloadReportExcel,
  type ExportSection,
} from '@/lib/accounting/reports/exportReport';
import { useReportPDFExport } from '@/lib/accounting/reports/useReportPDFExport';
import {
  Home as HomeIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalanceWallet as WalletIcon,
  CalendarMonth as CalendarIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  Loop as RecurringIcon,
  FileDownload as DownloadIcon,
  PictureAsPdf as PdfIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { canViewAccounting } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import {
  getCashFlowSummary,
  generateCashFlowForecast,
  getManualCashFlowItems,
  type CashFlowSummary,
} from '@/lib/accounting/paymentPlanningService';
import type { CashFlowForecast, ManualCashFlowItem } from '@vapour/types';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import { ManualCashFlowDialog } from './components/ManualCashFlowDialog';
import { CashFlowChart } from './components/CashFlowChart';
import { ForecastTable } from './components/ForecastTable';

export default function PaymentPlanningPage() {
  const router = useRouter();
  const { claims } = useAuth();

  const exportPDF = useReportPDFExport();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<CashFlowSummary | null>(null);
  const [forecast, setForecast] = useState<CashFlowForecast | null>(null);
  const [manualItems, setManualItems] = useState<ManualCashFlowItem[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDirection, setDialogDirection] = useState<'INFLOW' | 'OUTFLOW'>('INFLOW');

  const hasViewAccess = claims?.permissions ? canViewAccounting(claims.permissions) : false;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const { db } = getFirebase();

      // Get summary
      const summaryData = await getCashFlowSummary(db, 0); // Would get from bank accounts
      setSummary(summaryData);

      // Get 30-day forecast
      const today = new Date();
      const thirtyDays = new Date(today);
      thirtyDays.setDate(thirtyDays.getDate() + 30);

      const forecastData = await generateCashFlowForecast(db, {
        startDate: today,
        endDate: thirtyDays,
        includeOverdue: true,
        includeInvoices: true,
        includeBills: true,
        includeRecurring: true,
        includeManual: true,
      });
      setForecast(forecastData);

      // Get manual items
      const items = await getManualCashFlowItems(db, { status: 'PLANNED' });
      setManualItems(items);
    } catch (err) {
      console.error('[PaymentPlanning] Error loading data:', err);
      setError('Failed to load payment planning data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasViewAccess) {
      loadData();
    } else {
      setLoading(false);
    }
  }, [hasViewAccess, loadData]);

  /**
   * The forecast is the one number set here worth taking away — a weekly cash
   * position and the items putting it at risk. Built on the shared
   * ExportSection[] so CSV, Excel and PDF all come from one shape.
   */
  const buildForecastExportSections = (): ExportSection[] => {
    if (!forecast) return [];
    const money = { width: 16, align: 'right' as const, format: 'currency' as const };

    const sections: ExportSection[] = [
      {
        title: 'Cash position',
        columns: [
          { header: 'Measure', key: 'measure', width: 34 },
          { header: 'Amount', key: 'amount', ...money },
        ],
        rows: [
          { measure: '  Opening cash balance', amount: forecast.openingCashBalance },
          { measure: '  Projected receipts', amount: forecast.totalProjectedReceipts },
          { measure: '  Projected payments', amount: forecast.totalProjectedPayments },
          { measure: '  Overdue receivables', amount: forecast.overdueReceivables },
          { measure: '  Overdue payables', amount: forecast.overduePayables },
        ],
        summary: {
          measure: `Projected closing balance (${forecast.forecastDays} days)`,
          amount: forecast.projectedClosingBalance,
        },
      },
      {
        title: 'Receipts by source',
        columns: [
          { header: 'Source', key: 'source', width: 34 },
          { header: 'Amount', key: 'amount', ...money },
        ],
        rows: [
          { source: '  Invoices', amount: forecast.receiptsBySource.invoices },
          { source: '  Recurring', amount: forecast.receiptsBySource.recurring },
          { source: '  Manual', amount: forecast.receiptsBySource.manual },
        ],
        summary: { source: 'Total receipts', amount: forecast.totalProjectedReceipts },
      },
      {
        title: 'Payments by source',
        columns: [
          { header: 'Source', key: 'source', width: 34 },
          { header: 'Amount', key: 'amount', ...money },
        ],
        rows: [
          { source: '  Bills', amount: forecast.paymentsBySource.bills },
          { source: '  Recurring', amount: forecast.paymentsBySource.recurring },
          { source: '  Manual', amount: forecast.paymentsBySource.manual },
        ],
        summary: { source: 'Total payments', amount: forecast.totalProjectedPayments },
      },
      {
        title: 'Weekly forecast',
        columns: [
          { header: 'Week', key: 'week', width: 10, align: 'right' as const },
          { header: 'From', key: 'from', width: 12 },
          { header: 'To', key: 'to', width: 12 },
          { header: 'Receipts', key: 'receipts', ...money },
          { header: 'Payments', key: 'payments', ...money },
          { header: 'Net', key: 'net', ...money },
        ],
        rows: forecast.weeklyForecasts.map((w) => ({
          week: w.weekNumber,
          from: w.weekStartDate,
          to: w.weekEndDate,
          receipts: w.totalReceipts,
          payments: w.totalPayments,
          net: w.netCashFlow,
        })),
        summary: {
          week: '',
          from: 'Total',
          to: '',
          receipts: forecast.totalProjectedReceipts,
          payments: forecast.totalProjectedPayments,
          net: forecast.netForecastedCashFlow,
        },
      },
      {
        title: 'Daily forecast',
        columns: [
          { header: 'Date', key: 'date', width: 12 },
          { header: 'Opening', key: 'opening', ...money },
          { header: 'Receipts', key: 'receipts', ...money },
          { header: 'Payments', key: 'payments', ...money },
          { header: 'Net', key: 'net', ...money },
          { header: 'Closing', key: 'closing', ...money },
        ],
        rows: forecast.dailyForecasts.map((d) => ({
          date: d.date,
          opening: d.openingBalance,
          receipts: d.projectedReceipts,
          payments: d.projectedPayments,
          net: d.netCashFlow,
          closing: d.closingBalance,
        })),
      },
    ];

    if (forecast.atRiskItems.length > 0) {
      sections.push({
        title: 'At-risk items',
        columns: [
          { header: 'Reference', key: 'reference', width: 18 },
          { header: 'Counterparty', key: 'entity', width: 26 },
          { header: 'Direction', key: 'direction', width: 10 },
          { header: 'Expected', key: 'expected', width: 12 },
          { header: 'Days overdue', key: 'overdue', width: 12, align: 'right' as const },
          { header: 'Risk', key: 'risk', width: 12 },
          { header: 'Amount', key: 'amount', ...money },
        ],
        rows: forecast.atRiskItems.map((i) => ({
          reference: i.sourceReference,
          entity: i.entityName ?? '',
          direction: i.direction,
          expected: i.expectedDate,
          overdue: i.daysOverdue,
          risk: i.riskStatus,
          amount: i.amount,
        })),
      });
    }

    return sections;
  };

  const forecastFilename = `Cash_Flow_Forecast_${new Date().toISOString().slice(0, 10)}`;
  const handleExportForecastCSV = () =>
    downloadReportCSV(buildForecastExportSections(), forecastFilename);
  const handleExportForecastExcel = () =>
    downloadReportExcel(buildForecastExportSections(), forecastFilename, 'Cash Flow Forecast');
  const handleExportForecastPDF = () =>
    exportPDF(buildForecastExportSections(), forecastFilename, {
      title: 'Cash Flow Forecast',
      subtitle: `${forecast?.forecastDays ?? 0}-day outlook`,
    });

  const handleAddReceipt = () => {
    setDialogDirection('INFLOW');
    setDialogOpen(true);
  };

  const handleAddPayment = () => {
    setDialogDirection('OUTFLOW');
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    loadData(); // Refresh data
  };

  if (!hasViewAccess) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Payment Planning
          </Typography>
          <Alert severity="error">You do not have permission to view payment planning.</Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      {/* Breadcrumbs */}
      <PageBreadcrumbs
        items={[
          { label: 'Accounting', href: '/accounting', icon: <HomeIcon fontSize="small" /> },
          { label: 'Payment Planning' },
        ]}
      />

      {/* Header */}
      <Box
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Payment Planning
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Plan cash flow, track expected receipts and payments
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RecurringIcon />}
            onClick={() => router.push('/accounting/recurring')}
          >
            Recurring
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<AddIcon />}
            onClick={handleAddReceipt}
          >
            Add Receipt
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<AddIcon />}
            onClick={handleAddPayment}
          >
            Add Payment
          </Button>
          {forecast && (
            <>
              <Tooltip title="Export forecast as CSV">
                <IconButton onClick={handleExportForecastCSV} aria-label="Export CSV">
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Export forecast as Excel">
                <IconButton
                  onClick={handleExportForecastExcel}
                  color="primary"
                  aria-label="Export Excel"
                >
                  <DownloadIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Export forecast as PDF">
                <IconButton
                  onClick={handleExportForecastPDF}
                  color="primary"
                  aria-label="Export PDF"
                >
                  <PdfIcon />
                </IconButton>
              </Tooltip>
            </>
          )}
          <Tooltip title="Refresh data">
            <IconButton onClick={loadData} disabled={loading} aria-label="Refresh data">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {/* Current Balance */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <WalletIcon sx={{ color: 'primary.main', mr: 1 }} />
                    <Typography variant="subtitle2" color="text.secondary">
                      Current Balance
                    </Typography>
                  </Box>
                  <Typography variant="h5">
                    {formatCurrency(summary?.currentBalance ?? 0)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    From bank accounts
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {/* Expected Receipts (7 days) */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ bgcolor: 'success.light' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <TrendingUpIcon sx={{ color: 'success.dark', mr: 1 }} />
                    <Typography variant="subtitle2" color="success.dark">
                      Expected Receipts (7d)
                    </Typography>
                  </Box>
                  <Typography variant="h5" color="success.dark">
                    {formatCurrency(summary?.next7DaysReceipts ?? 0)}
                  </Typography>
                  {(summary?.overdueReceivablesCount ?? 0) > 0 && (
                    <Chip
                      size="small"
                      label={`${summary?.overdueReceivablesCount} overdue`}
                      color="warning"
                      sx={{ mt: 0.5 }}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Expected Payments (7 days) */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ bgcolor: 'error.light' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <TrendingDownIcon sx={{ color: 'error.dark', mr: 1 }} />
                    <Typography variant="subtitle2" color="error.dark">
                      Expected Payments (7d)
                    </Typography>
                  </Box>
                  <Typography variant="h5" color="error.dark">
                    {formatCurrency(summary?.next7DaysPayments ?? 0)}
                  </Typography>
                  {(summary?.overduePayablesCount ?? 0) > 0 && (
                    <Chip
                      size="small"
                      label={`${summary?.overduePayablesCount} overdue`}
                      color="error"
                      sx={{ mt: 0.5 }}
                    />
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Projected Balance (30 days) */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card
                sx={{
                  bgcolor:
                    (summary?.projectedBalance30Days ?? 0) >= 0 ? 'primary.light' : 'warning.light',
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <CalendarIcon
                      sx={{
                        color:
                          (summary?.projectedBalance30Days ?? 0) >= 0
                            ? 'primary.dark'
                            : 'warning.dark',
                        mr: 1,
                      }}
                    />
                    <Typography
                      variant="subtitle2"
                      color={
                        (summary?.projectedBalance30Days ?? 0) >= 0
                          ? 'primary.dark'
                          : 'warning.dark'
                      }
                    >
                      Projected (30d)
                    </Typography>
                  </Box>
                  <Typography
                    variant="h5"
                    color={
                      (summary?.projectedBalance30Days ?? 0) >= 0 ? 'primary.dark' : 'warning.dark'
                    }
                  >
                    {formatCurrency(summary?.projectedBalance30Days ?? 0)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Net: {formatCurrency(summary?.next30DaysNet ?? 0)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Source Breakdown */}
          {forecast && (
            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                30-Day Forecast Breakdown
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" color="success.main" gutterBottom>
                    Expected Receipts: {formatCurrency(forecast.totalProjectedReceipts)}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Chip
                      icon={<ReceiptIcon />}
                      label={`Invoices: ${formatCurrency(forecast.receiptsBySource.invoices)}`}
                      variant="outlined"
                      color="success"
                    />
                    <Chip
                      icon={<RecurringIcon />}
                      label={`Recurring: ${formatCurrency(forecast.receiptsBySource.recurring)}`}
                      variant="outlined"
                      color="success"
                    />
                    <Chip
                      icon={<AddIcon />}
                      label={`Manual: ${formatCurrency(forecast.receiptsBySource.manual)}`}
                      variant="outlined"
                      color="success"
                    />
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" color="error.main" gutterBottom>
                    Expected Payments: {formatCurrency(forecast.totalProjectedPayments)}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Chip
                      icon={<PaymentIcon />}
                      label={`Bills: ${formatCurrency(forecast.paymentsBySource.bills)}`}
                      variant="outlined"
                      color="error"
                    />
                    <Chip
                      icon={<RecurringIcon />}
                      label={`Recurring: ${formatCurrency(forecast.paymentsBySource.recurring)}`}
                      variant="outlined"
                      color="error"
                    />
                    <Chip
                      icon={<AddIcon />}
                      label={`Manual: ${formatCurrency(forecast.paymentsBySource.manual)}`}
                      variant="outlined"
                      color="error"
                    />
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          )}

          {/* Warnings */}
          {forecast && forecast.atRiskItems.length > 0 && (
            <Alert severity="warning" sx={{ mb: 3 }} icon={<WarningIcon />}>
              <Typography variant="subtitle2">
                {forecast.atRiskItems.length} items require attention
              </Typography>
              <Typography variant="body2">
                Overdue receivables: {formatCurrency(forecast.overdueReceivables)} | Overdue
                payables: {formatCurrency(forecast.overduePayables)}
              </Typography>
            </Alert>
          )}

          {/* Tabs */}
          <Paper sx={{ mb: 3 }}>
            <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
              <Tab label="Cash Flow Chart" />
              <Tab label="Detailed Forecast" />
              <Tab label={`Manual Items (${manualItems.length})`} />
            </Tabs>
          </Paper>

          {/* Tab Content */}
          {activeTab === 0 && forecast && <CashFlowChart forecast={forecast} />}

          {activeTab === 1 && forecast && <ForecastTable forecast={forecast} />}

          {activeTab === 2 && (
            <Paper sx={{ p: 3 }}>
              {manualItems.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary" gutterBottom>
                    No manual cash flow items yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Add expected receipts or payments that aren&apos;t captured by invoices, bills,
                    or recurring transactions
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                    <Button
                      variant="outlined"
                      color="success"
                      startIcon={<AddIcon />}
                      onClick={handleAddReceipt}
                    >
                      Add Expected Receipt
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<AddIcon />}
                      onClick={handleAddPayment}
                    >
                      Add Expected Payment
                    </Button>
                  </Box>
                </Box>
              ) : (
                <Box>
                  {/* TODO: Manual items table */}
                  <Typography>Manual items list coming soon...</Typography>
                </Box>
              )}
            </Paper>
          )}
        </>
      )}

      {/* Dialog */}
      <ManualCashFlowDialog
        open={dialogOpen}
        direction={dialogDirection}
        onClose={handleDialogClose}
      />
    </Container>
  );
}
