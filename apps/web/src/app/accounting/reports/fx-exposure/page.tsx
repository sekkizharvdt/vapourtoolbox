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
  AlertTitle,
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
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils/formatters';
import {
  downloadReportCSV,
  downloadReportExcel,
  type ExportSection,
} from '@/lib/accounting/reports/exportReport';
import { useReportPDFExport } from '@/lib/accounting/reports/useReportPDFExport';
import {
  generateFxExposureReport,
  type FxExposureReport,
} from '@/lib/accounting/reports/fxExposure';

const logger = createLogger({ context: 'FxExposureReport' });

function currentFiscalYear(now = new Date()) {
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { start: `${y}-04-01`, end: `${y + 1}-03-31` };
}

const rate = (n: number | null) => (n === null ? '—' : formatNumber(n, 4));
const spread = (n: number | null) => (n === null ? '—' : `${n.toFixed(1)}%`);

export default function FxExposurePage() {
  const { claims } = useAuth();
  const exportPDF = useReportPDFExport();
  const fy = currentFiscalYear();

  const [startDate, setStartDate] = useState(fy.start);
  const [endDate, setEndDate] = useState(fy.end);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<FxExposureReport | null>(null);

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
        await generateFxExposureReport(db, {
          startDate: new Date(`${startDate}T00:00:00`),
          endDate: new Date(`${endDate}T23:59:59`),
        })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Failed to generate FX exposure report', { error: message });
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const buildExportSections = (): ExportSection[] => {
    if (!report) return [];
    const money = { width: 16, align: 'right' as const, format: 'currency' as const };
    return [
      {
        title: 'Exposure by currency',
        columns: [
          { header: 'Currency', key: 'currency', width: 10 },
          { header: 'Txns', key: 'count', width: 8, align: 'right' as const },
          { header: 'Foreign total', key: 'foreign', width: 16, align: 'right' as const },
          { header: 'INR booked', key: 'inr', ...money },
          { header: 'Effective rate', key: 'rate', width: 14, align: 'right' as const },
          { header: 'Rate spread', key: 'spread', width: 12, align: 'right' as const },
          { header: 'Open receivable', key: 'recv', ...money },
          { header: 'Open payable', key: 'pay', ...money },
          { header: 'Net open', key: 'net', ...money },
        ],
        rows: report.currencies.map((c) => ({
          currency: c.currency,
          count: c.transactionCount,
          foreign: formatNumber(c.foreignTotal, 2),
          inr: c.inrTotal,
          rate: rate(c.weightedRate),
          spread: spread(c.rateSpreadPct),
          recv: c.openReceivableInr,
          pay: c.openPayableInr,
          net: c.netOpenInr,
        })),
        summary: {
          currency: 'Total',
          count: report.totals.transactionCount,
          foreign: '',
          inr: report.totals.inrTotal,
          rate: '',
          spread: '',
          recv: report.totals.openReceivableInr,
          pay: report.totals.openPayableInr,
          net: report.totals.netOpenInr,
        },
      },
      {
        title: 'Transactions',
        columns: [
          { header: 'Date', key: 'date', width: 12 },
          { header: 'Reference', key: 'reference', width: 18 },
          { header: 'Counterparty', key: 'counterparty', width: 24 },
          { header: 'Ccy', key: 'currency', width: 6, align: 'center' as const },
          { header: 'Foreign', key: 'foreign', width: 14, align: 'right' as const },
          { header: 'Rate', key: 'rate', width: 12, align: 'right' as const },
          { header: 'INR', key: 'inr', ...money },
          { header: 'Open (INR)', key: 'open', ...money },
        ],
        rows: report.transactions.map((t) => ({
          date: t.date,
          reference: t.reference,
          counterparty: t.counterparty,
          currency: t.currency,
          foreign: formatNumber(t.foreignAmount, 2),
          rate: rate(t.exchangeRate),
          inr: t.inrAmount,
          open: t.openInr,
        })),
      },
      {
        title: 'Settlement data coverage',
        columns: [
          { header: 'Measure', key: 'measure', width: 40 },
          { header: 'Value', key: 'value', width: 16, align: 'right' as const },
        ],
        rows: [
          {
            measure: '  Foreign-currency transactions in period',
            value: report.settlementCoverage.total,
          },
          {
            measure: '  Carrying bank settlement data',
            value: report.settlementCoverage.withSettlementData,
          },
        ],
      },
    ];
  };

  const filename = `FX_Exposure_${startDate}_to_${endDate}`;
  const handleExportCSV = () => downloadReportCSV(buildExportSections(), filename);
  const handleExportExcel = () =>
    downloadReportExcel(buildExportSections(), filename, 'FX Exposure');
  const handleExportPDF = () =>
    exportPDF(buildExportSections(), filename, {
      title: 'Foreign Currency Exposure',
      subtitle: `${startDate} to ${endDate}`,
    });

  if (!hasViewAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <PageHeader title="Foreign Currency Exposure" />
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
          { label: 'FX Exposure' },
        ]}
      />
      <PageHeader
        title="Foreign Currency Exposure"
        subtitle="What was booked in each foreign currency, at what rate, and how much is still open."
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

      {loading && <LoadingState message="Reading foreign-currency transactions…" />}

      {!loading && !report && !error && (
        <EmptyState title="No report yet" message="Pick a date range and select Generate Report." />
      )}

      {!loading && report && report.currencies.length === 0 && (
        <EmptyState message="No foreign-currency transactions in this period." />
      )}

      {!loading && report && report.currencies.length > 0 && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Currencies', value: String(report.currencies.length) },
              { label: 'Transactions', value: String(report.totals.transactionCount) },
              { label: 'INR booked', value: formatCurrency(report.totals.inrTotal) },
              { label: 'Net open exposure', value: formatCurrency(report.totals.netOpenInr) },
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

          {report.settlementCoverage.withSettlementData === 0 && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              <AlertTitle>Realized gain and loss cannot be reported</AlertTitle>
              None of the {report.settlementCoverage.total} foreign-currency transactions in this
              period carry bank settlement data — no create or edit path records{' '}
              <code>bankSettlementRate</code>, <code>bankSettlementAmount</code>,{' '}
              <code>bankCharges</code> or <code>forexGainLoss</code>. Until those are captured on
              receipt, this report can only show exposure at booked rates, not the gain or loss
              actually realized when the bank settled. Closing that gap is a change to the invoice
              and payment dialogs, not to this report.
            </Alert>
          )}

          <Paper sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              By currency
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Currency</TableCell>
                    <TableCell align="right">Txns</TableCell>
                    <TableCell align="right">Foreign total</TableCell>
                    <TableCell align="right">INR booked</TableCell>
                    <TableCell align="right">Effective rate</TableCell>
                    <TableCell align="right">Rate spread</TableCell>
                    <TableCell align="right">Net open (INR)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.currencies.map((c) => (
                    <TableRow key={c.currency}>
                      <TableCell>{c.currency}</TableCell>
                      <TableCell align="right">{c.transactionCount}</TableCell>
                      <TableCell align="right">{formatNumber(c.foreignTotal, 2)}</TableCell>
                      <TableCell align="right">{formatCurrency(c.inrTotal)}</TableCell>
                      <TableCell align="right">{rate(c.weightedRate)}</TableCell>
                      <TableCell align="right">{spread(c.rateSpreadPct)}</TableCell>
                      <TableCell align="right">{formatCurrency(c.netOpenInr)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="caption" color="text.secondary">
              Effective rate is weighted by INR value, so a large invoice moves it more than a small
              one. Rate spread is the range of booking rates actually used — the wider it is, the
              more the INR value of comparable invoices moved over the period.
            </Typography>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Transactions
            </Typography>
            <TableContainer sx={{ maxHeight: 480 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Reference</TableCell>
                    <TableCell>Counterparty</TableCell>
                    <TableCell>Ccy</TableCell>
                    <TableCell align="right">Foreign</TableCell>
                    <TableCell align="right">Rate</TableCell>
                    <TableCell align="right">INR</TableCell>
                    <TableCell align="right">Open (INR)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{formatDate(t.date)}</TableCell>
                      <TableCell>{t.reference}</TableCell>
                      <TableCell>{t.counterparty || '—'}</TableCell>
                      <TableCell>{t.currency}</TableCell>
                      <TableCell align="right">{formatNumber(t.foreignAmount, 2)}</TableCell>
                      <TableCell align="right">{rate(t.exchangeRate)}</TableCell>
                      <TableCell align="right">{formatCurrency(t.inrAmount)}</TableCell>
                      <TableCell align="right">
                        {t.openInr > 0 ? formatCurrency(t.openInr) : '—'}
                      </TableCell>
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
