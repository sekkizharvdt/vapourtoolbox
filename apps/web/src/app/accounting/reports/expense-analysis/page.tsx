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
  generateExpenseAnalysisReport,
  type ExpenseAnalysisReport,
  type ExpenseBreakdownRow,
} from '@/lib/accounting/reports/expenseAnalysis';

const logger = createLogger({ context: 'ExpenseAnalysisReport' });

function currentFiscalYear(now = new Date()) {
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { start: `${y}-04-01`, end: `${y + 1}-03-31` };
}

const signed = (n: number | null) => (n === null ? 'new' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`);

export default function ExpenseAnalysisPage() {
  const { claims } = useAuth();
  const exportPDF = useReportPDFExport();
  const fy = currentFiscalYear();

  const [startDate, setStartDate] = useState(fy.start);
  const [endDate, setEndDate] = useState(fy.end);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ExpenseAnalysisReport | null>(null);

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
      setReport(
        await generateExpenseAnalysisReport(db, {
          startDate: new Date(`${startDate}T00:00:00`),
          endDate: new Date(`${endDate}T23:59:59`),
        })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Failed to generate expense analysis', { error: message });
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const breakdownSection = (
    rows: ExpenseBreakdownRow[],
    title: string,
    label: string,
    total: number
  ): ExportSection => ({
    title,
    columns: [
      { header: label, key: 'label', width: 30 },
      { header: 'Amount', key: 'amount', width: 18, align: 'right', format: 'currency' },
      { header: 'Share', key: 'share', width: 10, align: 'right' },
      { header: 'Lines', key: 'lines', width: 8, align: 'right' },
      { header: 'Prior period', key: 'prior', width: 18, align: 'right', format: 'currency' },
      { header: 'Change', key: 'change', width: 12, align: 'right' },
    ],
    rows: rows.map((r) => ({
      label: `  ${r.label}`,
      amount: r.amount,
      share: `${r.sharePct.toFixed(1)}%`,
      lines: r.lineCount,
      prior: r.priorAmount,
      change: signed(r.changePct),
    })),
    summary: {
      label: 'Total',
      amount: total,
      share: '100.0%',
      lines: rows.reduce((s, r) => s + r.lineCount, 0),
      prior: '',
      change: '',
    },
  });

  const buildExportSections = (): ExportSection[] => {
    if (!report) return [];
    return [
      breakdownSection(report.byAccount, 'By expense account', 'Account', report.total),
      breakdownSection(report.byProject, 'By project / cost centre', 'Project', report.total),
      breakdownSection(report.byCounterparty, 'By counterparty', 'Counterparty', report.total),
      {
        title: 'Monthly trend',
        columns: [
          { header: 'Month', key: 'month', width: 16 },
          { header: 'Amount', key: 'amount', width: 18, align: 'right', format: 'currency' },
        ],
        rows: report.trend.map((t) => ({ month: `  ${t.label}`, amount: t.amount })),
        summary: { month: 'Total', amount: report.total },
      },
    ];
  };

  const filename = `Expense_Analysis_${startDate}_to_${endDate}`;
  const handleExportCSV = () => downloadReportCSV(buildExportSections(), filename);
  const handleExportExcel = () => downloadReportExcel(buildExportSections(), filename, 'Expenses');
  const handleExportPDF = () =>
    exportPDF(buildExportSections(), filename, {
      title: 'Expense Analysis',
      subtitle: `${startDate} to ${endDate}`,
    });

  if (!hasViewAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <PageHeader title="Expense Analysis" />
        <Alert severity="error">You do not have permission to view financial reports.</Alert>
      </Box>
    );
  }

  const renderBreakdown = (rows: ExpenseBreakdownRow[], heading: string, label: string) => (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Typography variant="subtitle1" gutterBottom>
        {heading}
      </Typography>
      {rows.length === 0 ? (
        <EmptyState message="Nothing in this period." />
      ) : (
        <TableContainer sx={{ maxHeight: 460 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>{label}</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right">Share</TableCell>
                <TableCell align="right">Lines</TableCell>
                <TableCell align="right">Prior period</TableCell>
                <TableCell align="right">Change</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.key}>
                  <TableCell>{r.label}</TableCell>
                  <TableCell align="right">{formatCurrency(r.amount)}</TableCell>
                  <TableCell align="right">{r.sharePct.toFixed(1)}%</TableCell>
                  <TableCell align="right">{r.lineCount}</TableCell>
                  <TableCell align="right">{formatCurrency(r.priorAmount)}</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color:
                        r.changePct === null
                          ? 'text.secondary'
                          : r.changePct > 0
                            ? 'error.main'
                            : 'success.main',
                    }}
                  >
                    {signed(r.changePct)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );

  return (
    <Box sx={{ p: 3 }}>
      <PageBreadcrumbs
        items={[
          { label: 'Accounting', href: '/accounting', icon: <HomeIcon fontSize="small" /> },
          { label: 'Reports', href: '/accounting/reports' },
          { label: 'Expense Analysis' },
        ]}
      />
      <PageHeader
        title="Expense Analysis"
        subtitle="Where operating spend goes — by account, by project, and by counterparty."
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

      {loading && <LoadingState message="Reading payments…" />}

      {!loading && !report && !error && (
        <EmptyState title="No report yet" message="Pick a date range and select Generate Report." />
      )}

      {!loading && report && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Total spend', value: formatCurrency(report.total) },
              { label: 'Prior period', value: formatCurrency(report.priorTotal) },
              {
                label: 'Change',
                value:
                  report.priorTotal > 0
                    ? signed(((report.total - report.priorTotal) / report.priorTotal) * 100)
                    : '—',
              },
              { label: 'Expense lines', value: String(report.lineCount) },
            ].map((kpi) => (
              <Grid size={{ xs: 6, md: 3 }} key={kpi.label}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">
                      {kpi.label}
                    </Typography>
                    <Typography variant="h6">{kpi.value}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Alert severity="info" sx={{ mb: 3 }}>
            Spend is read from direct payments and expense claims, categorised by the expense
            account each debit posted to. Change compares against{' '}
            {formatDate(report.priorStartDate)} – {formatDate(report.priorEndDate)}.
          </Alert>

          {report.unclassifiedLineCount > 0 && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              {report.unclassifiedLineCount} payment(s) posted no identifiable expense account and
              are grouped under &ldquo;Unclassified&rdquo;. They are still counted in the total.
            </Alert>
          )}

          {renderBreakdown(report.byAccount, 'By expense account', 'Account')}
          {renderBreakdown(report.byProject, 'By project / cost centre', 'Project')}
          {renderBreakdown(report.byCounterparty, 'By counterparty', 'Counterparty')}

          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Monthly trend
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Month</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.trend.map((t) => (
                    <TableRow key={t.label}>
                      <TableCell>{t.label}</TableCell>
                      <TableCell align="right">{formatCurrency(t.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}
    </Box>
  );
}
