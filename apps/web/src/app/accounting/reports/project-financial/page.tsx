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
  LinearProgress,
} from '@mui/material';
import {
  Home as HomeIcon,
  FileDownload as DownloadIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { PageHeader, LoadingState, EmptyState } from '@vapour/ui';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import { ProjectSelector } from '@/components/common/forms/ProjectSelector';
import { useAuth } from '@/contexts/AuthContext';
import { canViewAccounting } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import { createLogger } from '@vapour/logger';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils/formatters';
import {
  downloadReportCSV,
  downloadReportExcel,
  type ExportSection,
} from '@/lib/accounting/reports/exportReport';
import { useReportPDFExport } from '@/lib/accounting/reports/useReportPDFExport';
import {
  generateProjectFinancialsReport,
  type ProjectFinancialsReport,
} from '@/lib/accounting/reports/projectFinancials';

const logger = createLogger({ context: 'ProjectFinancialReport' });

function currentFiscalYear(now = new Date()) {
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { start: `${y}-04-01`, end: `${y + 1}-03-31` };
}

export default function ProjectFinancialReportPage() {
  const { claims } = useAuth();
  const exportPDF = useReportPDFExport();
  const fy = currentFiscalYear();

  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(fy.start);
  const [endDate, setEndDate] = useState(fy.end);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ProjectFinancialsReport | null>(null);

  const hasViewAccess = claims?.permissions ? canViewAccounting(claims.permissions) : false;

  const handleGenerate = async () => {
    if (!selectedProject) {
      setError('Select a project first.');
      return;
    }
    if (!startDate || !endDate || new Date(startDate) > new Date(endDate)) {
      setError('Select a valid date range.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { db } = getFirebase();
      setReport(
        await generateProjectFinancialsReport(db, selectedProject, {
          startDate: new Date(`${startDate}T00:00:00`),
          endDate: new Date(`${endDate}T23:59:59`),
        })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Failed to generate project financial report', { error: message });
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const buildExportSections = (): ExportSection[] => {
    if (!report) return [];
    const money = { width: 18, align: 'right' as const, format: 'currency' as const };
    const measure = [
      { header: 'Measure', key: 'measure', width: 34 },
      { header: 'Amount', key: 'amount', ...money },
    ];

    const sections: ExportSection[] = [
      {
        title: 'Result (accrual basis)',
        columns: measure,
        rows: [
          { measure: '  Revenue — invoices raised', amount: report.accrual.revenue },
          { measure: '  Expenses — bills and direct payments', amount: report.accrual.expenses },
        ],
        summary: {
          measure:
            report.accrual.marginPct === null
              ? 'Profit'
              : `Profit (${report.accrual.marginPct.toFixed(1)}% margin)`,
          amount: report.accrual.profit,
        },
      },
      {
        title: 'Cash movement',
        columns: measure,
        rows: [
          { measure: '  Received from customers', amount: report.cash.receipts },
          { measure: '  Paid to vendors and others', amount: report.cash.payments },
        ],
        summary: { measure: 'Net cash movement', amount: report.cash.net },
      },
    ];

    if (report.budget.amount !== null) {
      sections.push({
        title: 'Budget',
        columns: measure,
        rows: [
          { measure: '  Budget', amount: report.budget.amount },
          { measure: '  Spent (accrual expenses)', amount: report.accrual.expenses },
          {
            measure: `  Utilisation — ${report.budget.utilisationPct?.toFixed(1) ?? '—'}%`,
            amount: '',
          },
        ],
        summary: { measure: 'Remaining', amount: report.budget.variance },
      });
    }

    for (const g of report.groups) {
      sections.push({
        title: `${g.label} — ${g.contributesTo}`,
        columns: [
          { header: 'Date', key: 'date', width: 12 },
          { header: 'Number', key: 'number', width: 18 },
          { header: 'Counterparty', key: 'counterparty', width: 24 },
          { header: 'Description', key: 'description', width: 34 },
          { header: 'Ccy', key: 'currency', width: 6, align: 'center' as const },
          { header: 'Amount', key: 'native', width: 14, align: 'right' as const },
          { header: 'Amount (INR)', key: 'inr', ...money },
        ],
        rows: g.transactions.map((t) => ({
          date: t.date,
          number: t.reference,
          counterparty: t.counterparty,
          description: t.description,
          currency: t.currency,
          native: formatNumber(t.nativeAmount, 2),
          inr: t.amountInr,
        })),
        summary: {
          date: '',
          number: `Total — ${g.transactions.length} item(s)`,
          counterparty: '',
          description: '',
          currency: '',
          native: '',
          inr: g.total,
        },
      });
    }

    return sections;
  };

  const filename = report
    ? `Project_Financials_${report.projectName}_${startDate}_to_${endDate}`
    : 'Project_Financials';
  const handleExportCSV = () => downloadReportCSV(buildExportSections(), filename);
  const handleExportExcel = () =>
    downloadReportExcel(buildExportSections(), filename, 'Project Financials');
  const handleExportPDF = () =>
    exportPDF(buildExportSections(), filename, {
      title: report
        ? `Project Financial Report — ${report.projectName}`
        : 'Project Financial Report',
      subtitle: report ? `${formatDate(report.startDate)} to ${formatDate(report.endDate)}` : '',
    });

  if (!hasViewAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <PageHeader title="Project Financial Report" />
        <Alert severity="error">You do not have permission to access financial reports.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <PageBreadcrumbs
        items={[
          { label: 'Accounting', href: '/accounting', icon: <HomeIcon fontSize="small" /> },
          { label: 'Reports', href: '/accounting/reports' },
          { label: 'Project Financial' },
        ]}
      />
      <PageHeader
        title="Project Financial Report"
        subtitle="Did the project make money, and has the cash arrived — the two are not the same."
      />

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 4 }}>
            <ProjectSelector
              value={selectedProject}
              onChange={setSelectedProject}
              label="Select Project"
              required
            />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField
              fullWidth
              label="From"
              type="date"
              size="small"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField
              fullWidth
              label="To"
              type="date"
              size="small"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={handleGenerate} disabled={loading}>
                {loading ? 'Generating…' : 'Generate'}
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
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading && <LoadingState message="Reading project transactions…" />}

      {!loading && !report && !error && (
        <EmptyState
          title="No report yet"
          message="Choose a project and date range, then Generate."
        />
      )}

      {!loading && report && (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {report.projectName}
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              {formatDate(report.startDate)} – {formatDate(report.endDate)}
            </Typography>
          </Typography>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    Result — accrual basis
                  </Typography>
                  <Stack spacing={0.5} sx={{ mt: 1 }}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2">Revenue (invoices raised)</Typography>
                      <Typography variant="body2">
                        {formatCurrency(report.accrual.revenue)}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2">Expenses (bills + direct payments)</Typography>
                      <Typography variant="body2">
                        {formatCurrency(report.accrual.expenses)}
                      </Typography>
                    </Stack>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      sx={{ borderTop: 1, borderColor: 'divider', pt: 0.5 }}
                    >
                      <Typography variant="subtitle2">Profit</Typography>
                      <Typography
                        variant="subtitle2"
                        color={report.accrual.profit >= 0 ? 'success.main' : 'error.main'}
                      >
                        {formatCurrency(report.accrual.profit)}
                        {report.accrual.marginPct !== null &&
                          ` (${report.accrual.marginPct.toFixed(1)}%)`}
                      </Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="overline" color="text.secondary">
                    Cash movement
                  </Typography>
                  <Stack spacing={0.5} sx={{ mt: 1 }}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2">Received from customers</Typography>
                      <Typography variant="body2">
                        {formatCurrency(report.cash.receipts)}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2">Paid out</Typography>
                      <Typography variant="body2">
                        {formatCurrency(report.cash.payments)}
                      </Typography>
                    </Stack>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      sx={{ borderTop: 1, borderColor: 'divider', pt: 0.5 }}
                    >
                      <Typography variant="subtitle2">Net cash movement</Typography>
                      <Typography
                        variant="subtitle2"
                        color={report.cash.net >= 0 ? 'success.main' : 'error.main'}
                      >
                        {formatCurrency(report.cash.net)}
                      </Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {report.budget.amount !== null && (
            <Paper sx={{ p: 2, mb: 3 }}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2">
                  Budget {formatCurrency(report.budget.amount)} · spent{' '}
                  {formatCurrency(report.accrual.expenses)}
                </Typography>
                <Typography
                  variant="subtitle2"
                  color={(report.budget.variance ?? 0) >= 0 ? 'success.main' : 'error.main'}
                >
                  {(report.budget.variance ?? 0) >= 0 ? 'Remaining ' : 'Over by '}
                  {formatCurrency(Math.abs(report.budget.variance ?? 0))}
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={Math.min(report.budget.utilisationPct ?? 0, 100)}
                color={(report.budget.utilisationPct ?? 0) > 100 ? 'error' : 'primary'}
              />
            </Paper>
          )}

          {report.excludedCount > 0 && (
            <Alert severity="info" sx={{ mb: 3 }}>
              {report.excludedCount} journal entry/transfer totalling{' '}
              {formatCurrency(report.excludedTotal)} is listed below but excluded from both results
              — folding adjustments in would double-count the entries they adjust.
            </Alert>
          )}

          {report.groups.length === 0 ? (
            <EmptyState message="No transactions for this project in the selected period." />
          ) : (
            report.groups.map((g) => (
              <Paper sx={{ p: 2, mb: 3 }} key={g.type}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="subtitle1">{g.label}</Typography>
                  <Chip size="small" variant="outlined" label={g.contributesTo} />
                  <Box sx={{ flexGrow: 1 }} />
                  <Typography variant="subtitle2">{formatCurrency(g.total)}</Typography>
                </Stack>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Number</TableCell>
                        <TableCell>Counterparty</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell align="right">Amount</TableCell>
                        <TableCell align="right">Amount (INR)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {g.transactions.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>{formatDate(t.date)}</TableCell>
                          <TableCell>{t.reference}</TableCell>
                          <TableCell>{t.counterparty || '—'}</TableCell>
                          <TableCell>{t.description || '—'}</TableCell>
                          <TableCell align="right">
                            {t.currency !== 'INR'
                              ? `${t.currency} ${formatNumber(t.nativeAmount, 2)}`
                              : '—'}
                          </TableCell>
                          <TableCell align="right">{formatCurrency(t.amountInr)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            ))
          )}
        </>
      )}
    </Box>
  );
}
