'use client';

import { useState } from 'react';
import {
  Box,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Button,
  Alert,
  Grid,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import {
  Home as HomeIcon,
  FileDownload as DownloadIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { PageHeader, LoadingState, EmptyState } from '@vapour/ui';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import { useAuth } from '@/contexts/AuthContext';
import { canViewAccounting } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import { createLogger } from '@vapour/logger';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import {
  downloadReportCSV,
  downloadReportExcel,
  type ExportSection,
} from '@/lib/accounting/reports/exportReport';
import { useReportPDFExport } from '@/lib/accounting/reports/useReportPDFExport';
import {
  generateReceivablesPerformanceReport,
  type ReceivablesPerformanceReport,
} from '@/lib/accounting/reports/receivablesPerformance';

const logger = createLogger({ context: 'ReceivablesPerformanceReport' });

/** Indian fiscal year containing `d`, as ISO date strings. */
function currentFiscalYear(d = new Date()): { start: string; end: string } {
  const fyStartYear = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return {
    start: `${fyStartYear}-04-01`,
    end: `${fyStartYear + 1}-03-31`,
  };
}

function days(n: number | null): string {
  return n === null ? '—' : `${n} days`;
}

function percent(n: number | null): string {
  return n === null ? '—' : `${n.toFixed(1)}%`;
}

export default function ReceivablesPerformancePage() {
  const { claims } = useAuth();
  const exportPDF = useReportPDFExport();
  const fy = currentFiscalYear();

  const [startDate, setStartDate] = useState(fy.start);
  const [endDate, setEndDate] = useState(fy.end);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ReceivablesPerformanceReport | null>(null);

  const hasViewAccess = claims?.permissions ? canViewAccounting(claims.permissions) : false;

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      setError('Select both a start and an end date.');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setError('The start date must fall on or before the end date.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { db } = getFirebase();
      const result = await generateReceivablesPerformanceReport(db, {
        startDate: new Date(`${startDate}T00:00:00`),
        endDate: new Date(`${endDate}T23:59:59`),
      });
      setReport(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Failed to generate receivables performance report', { error: message });
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const buildExportSections = (): ExportSection[] => {
    if (!report) return [];
    const money = { width: 18, align: 'right' as const, format: 'currency' as const };

    return [
      {
        title: 'Summary',
        columns: [
          { header: 'Measure', key: 'measure', width: 34 },
          { header: 'Value', key: 'value', width: 20, align: 'right' as const },
        ],
        rows: [
          { measure: '  Days Sales Outstanding', value: days(report.headline.dso) },
          {
            measure: '  Credit sales (period)',
            value: formatCurrency(report.headline.creditSales),
          },
          {
            measure: '  Collected (period)',
            value: formatCurrency(report.headline.collectedInPeriod),
          },
          {
            measure: '  Outstanding (current)',
            value: formatCurrency(report.headline.closingReceivables),
          },
          {
            measure: '  Overdue (current)',
            value: `${formatCurrency(report.headline.overdueAmount)} (${percent(report.headline.overduePct)})`,
          },
          {
            measure: '  Average days to collect',
            value: days(report.headline.avgDaysToCollect),
          },
          { measure: '  Median days to collect', value: days(report.headline.medianDaysToCollect) },
          { measure: '  On time (by value)', value: percent(report.headline.onTimePctByAmount) },
          { measure: '  On time (by count)', value: percent(report.headline.onTimePctByCount) },
        ],
      },
      {
        title: `Ageing as at ${formatDate(report.asOf)}`,
        columns: [
          { header: 'Band', key: 'band', width: 26 },
          { header: 'Invoices', key: 'count', width: 10, align: 'right' as const },
          { header: 'Amount', key: 'amount', ...money },
          { header: 'Share', key: 'share', width: 12, align: 'right' as const },
        ],
        rows: report.aging.map((b) => ({
          band: `  ${b.label}`,
          count: b.count,
          amount: b.amount,
          share: percent(b.pct),
        })),
        summary: {
          band: 'Total outstanding',
          count: report.aging.reduce((s, b) => s + b.count, 0),
          amount: report.headline.closingReceivables,
          share: '100.0%',
        },
      },
      {
        title: 'Monthly movement',
        columns: [
          { header: 'Month', key: 'month', width: 16 },
          { header: 'Invoiced', key: 'invoiced', ...money },
          { header: 'Collected', key: 'collected', ...money },
          { header: 'Net', key: 'net', ...money },
        ],
        rows: report.trend.map((t) => ({
          month: `  ${t.label}`,
          invoiced: t.invoiced,
          collected: t.collected,
          net: t.net,
        })),
        summary: {
          month: 'Total',
          invoiced: report.headline.creditSales,
          collected: report.headline.collectedInPeriod,
          net: report.headline.creditSales - report.headline.collectedInPeriod,
        },
      },
      {
        title: 'By customer',
        columns: [
          { header: 'Customer', key: 'customer', width: 30 },
          { header: 'Invoiced', key: 'invoiced', ...money },
          { header: 'Collected', key: 'collected', ...money },
          { header: 'Outstanding', key: 'outstanding', ...money },
          { header: 'Overdue', key: 'overdue', ...money },
          { header: 'Avg days', key: 'avgDays', width: 10, align: 'right' as const },
          { header: 'On time', key: 'onTime', width: 10, align: 'right' as const },
        ],
        rows: report.customers.map((c) => ({
          customer: `  ${c.entityName}`,
          invoiced: c.invoiced,
          collected: c.collected,
          outstanding: c.outstanding,
          overdue: c.overdue,
          avgDays: c.avgDaysToCollect === null ? '—' : c.avgDaysToCollect,
          onTime: percent(c.onTimePct),
        })),
      },
    ];
  };

  const filename = `Receivables_Performance_${startDate}_to_${endDate}`;
  const handleExportCSV = () => downloadReportCSV(buildExportSections(), filename);
  const handleExportExcel = () =>
    downloadReportExcel(buildExportSections(), filename, 'Receivables');
  const handleExportPDF = () =>
    exportPDF(buildExportSections(), filename, {
      title: 'Receivables Performance',
      subtitle: `${startDate} to ${endDate}`,
    });

  if (!hasViewAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <PageHeader title="Receivables Performance" />
        <Alert severity="error">You do not have permission to view financial reports.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <PageBreadcrumbs
        items={[
          { label: 'Accounting', href: '/accounting', icon: <HomeIcon fontSize="small" /> },
          { label: 'Reports', href: '/accounting/reports' },
          { label: 'Receivables Performance' },
        ]}
      />
      <PageHeader
        title="Receivables Performance"
        subtitle="How quickly customers pay — DSO, collection speed, on-time rate, and ageing."
      />

      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            label="From"
            type="date"
            size="small"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="To"
            type="date"
            size="small"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Button variant="contained" onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generating…' : 'Generate Report'}
          </Button>
          {report && (
            <>
              <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportCSV}>
                CSV
              </Button>
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handleExportExcel}
                color="primary"
              >
                Excel
              </Button>
              <Button
                variant="outlined"
                startIcon={<PdfIcon />}
                onClick={handleExportPDF}
                color="primary"
              >
                PDF
              </Button>
            </>
          )}
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading && <LoadingState message="Reading invoices and receipts…" />}

      {!loading && !report && !error && (
        <EmptyState title="No report yet" message="Pick a date range and select Generate Report." />
      )}

      {!loading && report && (
        <>
          {report.dataNotes.asOfIsAfterPeriodEnd && (
            <Alert severity="info" sx={{ mb: 3 }}>
              Ageing and outstanding are shown <strong>as at today</strong> (
              {formatDate(report.asOf)}
              ), not as at the period end — invoices carry a running paid total rather than a dated
              payment history. The flows below (invoiced, collected, collection speed) do cover the
              selected period.
            </Alert>
          )}

          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Days Sales Outstanding', value: days(report.headline.dso) },
              {
                label: 'Outstanding (current)',
                value: formatCurrency(report.headline.closingReceivables),
              },
              {
                label: 'Overdue',
                value: formatCurrency(report.headline.overdueAmount),
                caption: percent(report.headline.overduePct) + ' of outstanding',
              },
              {
                label: 'Avg days to collect',
                value: days(report.headline.avgDaysToCollect),
                caption: `median ${days(report.headline.medianDaysToCollect)}`,
              },
              {
                label: 'On time (by value)',
                value: percent(report.headline.onTimePctByAmount),
                caption: `${percent(report.headline.onTimePctByCount)} by count`,
              },
              {
                label: 'Collected in period',
                value: formatCurrency(report.headline.collectedInPeriod),
                caption: `invoiced ${formatCurrency(report.headline.creditSales)}`,
              },
            ].map((kpi) => (
              <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }} key={kpi.label}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">
                      {kpi.label}
                    </Typography>
                    <Typography variant="h6" sx={{ mt: 0.5 }}>
                      {kpi.value}
                    </Typography>
                    {kpi.caption && (
                      <Typography variant="caption" color="text.secondary">
                        {kpi.caption}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Ageing as at {formatDate(report.asOf)}
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Band</TableCell>
                    <TableCell align="right">Invoices</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="right">Share</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.aging.map((b) => (
                    <TableRow key={b.label}>
                      <TableCell>{b.label}</TableCell>
                      <TableCell align="right">{b.count}</TableCell>
                      <TableCell align="right">{formatCurrency(b.amount)}</TableCell>
                      <TableCell align="right">{percent(b.pct)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell>
                      <strong>Total outstanding</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>{report.aging.reduce((s, b) => s + b.count, 0)}</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>{formatCurrency(report.headline.closingReceivables)}</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>100.0%</strong>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Monthly movement
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Month</TableCell>
                    <TableCell align="right">Invoiced</TableCell>
                    <TableCell align="right">Collected</TableCell>
                    <TableCell align="right">Net</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.trend.map((t) => (
                    <TableRow key={t.label}>
                      <TableCell>{t.label}</TableCell>
                      <TableCell align="right">{formatCurrency(t.invoiced)}</TableCell>
                      <TableCell align="right">{formatCurrency(t.collected)}</TableCell>
                      <TableCell
                        align="right"
                        sx={{ color: t.net > 0 ? 'error.main' : 'success.main' }}
                      >
                        {formatCurrency(t.net)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="caption" color="text.secondary">
              Net is invoiced minus collected — a positive figure means the receivables book grew
              that month.
            </Typography>
          </Paper>

          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              By customer
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Customer</TableCell>
                    <TableCell align="right">Invoiced</TableCell>
                    <TableCell align="right">Collected</TableCell>
                    <TableCell align="right">Outstanding</TableCell>
                    <TableCell align="right">Overdue</TableCell>
                    <TableCell align="right">Avg days</TableCell>
                    <TableCell align="right">On time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.customers.map((c) => (
                    <TableRow key={c.entityId}>
                      <TableCell>
                        {c.entityName}
                        {c.oldestOverdueDays !== null && c.oldestOverdueDays > 90 && (
                          <Chip
                            size="small"
                            color="error"
                            variant="outlined"
                            label={`${c.oldestOverdueDays}d`}
                            sx={{ ml: 1 }}
                          />
                        )}
                      </TableCell>
                      <TableCell align="right">{formatCurrency(c.invoiced)}</TableCell>
                      <TableCell align="right">{formatCurrency(c.collected)}</TableCell>
                      <TableCell align="right">{formatCurrency(c.outstanding)}</TableCell>
                      <TableCell align="right">{formatCurrency(c.overdue)}</TableCell>
                      <TableCell align="right">
                        {c.avgDaysToCollect === null ? '—' : c.avgDaysToCollect}
                      </TableCell>
                      <TableCell align="right">{percent(c.onTimePct)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {(report.dataNotes.invoicesWithoutDueDate > 0 ||
            report.dataNotes.unmatchedSettlements > 0 ||
            report.dataNotes.allocationReconciliationGaps > 0) && (
            <Alert severity="warning">
              <Typography variant="body2" component="div">
                Data quality:
                <ul style={{ margin: '4px 0 0 0', paddingLeft: 18 }}>
                  {report.dataNotes.invoicesWithoutDueDate > 0 && (
                    <li>
                      {report.dataNotes.invoicesWithoutDueDate} open invoice(s) carry no due date
                      and are treated as not yet due, so they never appear as overdue.
                    </li>
                  )}
                  {report.dataNotes.unmatchedSettlements > 0 && (
                    <li>
                      {report.dataNotes.unmatchedSettlements} receipt allocation(s) point at
                      something that is not a live customer invoice — typically an opening-balance
                      allocation. They are excluded from collection speed.
                    </li>
                  )}
                  {report.dataNotes.allocationReconciliationGaps > 0 && (
                    <li>
                      {report.dataNotes.allocationReconciliationGaps} invoice(s) have an allocation
                      history that disagrees with their recorded paid amount. Outstanding uses the
                      recorded paid amount; collection speed uses allocation dates, so speed metrics
                      may cover fewer receipts than the collected total.
                    </li>
                  )}
                </ul>
              </Typography>
            </Alert>
          )}
        </>
      )}
    </Box>
  );
}
