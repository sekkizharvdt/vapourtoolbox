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
import { generateBankBookReport, type BankBookReport } from '@/lib/accounting/reports/bankBook';

const logger = createLogger({ context: 'BankBookReport' });

function currentFiscalYear(now = new Date()) {
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { start: `${y}-04-01`, end: `${y + 1}-03-31` };
}

export default function BankBookPage() {
  const { claims } = useAuth();
  const exportPDF = useReportPDFExport();
  const fy = currentFiscalYear();

  const [startDate, setStartDate] = useState(fy.start);
  const [endDate, setEndDate] = useState(fy.end);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<BankBookReport | null>(null);

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
        await generateBankBookReport(db, {
          startDate: new Date(`${startDate}T00:00:00`),
          endDate: new Date(`${endDate}T23:59:59`),
        })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Failed to generate bank book', { error: message });
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const buildExportSections = (): ExportSection[] => {
    if (!report) return [];
    const money = { width: 16, align: 'right' as const, format: 'currency' as const };
    const sections: ExportSection[] = [
      {
        title: 'All accounts',
        columns: [
          { header: 'Account', key: 'account', width: 30 },
          { header: 'Opening', key: 'opening', ...money },
          { header: 'Receipts', key: 'receipts', ...money },
          { header: 'Payments', key: 'payments', ...money },
          { header: 'Closing', key: 'closing', ...money },
        ],
        rows: report.accounts.map((a) => ({
          account: `  ${a.accountCode ? a.accountCode + ' ' : ''}${a.accountName}`,
          opening: a.openingBalance,
          receipts: a.receipts,
          payments: a.payments,
          closing: a.closingBalance,
        })),
        summary: {
          account: 'Total',
          opening: report.totals.openingBalance,
          receipts: report.totals.receipts,
          payments: report.totals.payments,
          closing: report.totals.closingBalance,
        },
      },
    ];

    for (const a of report.accounts) {
      sections.push({
        title: `${a.accountName} — by payment method`,
        columns: [
          { header: 'Method', key: 'method', width: 20 },
          { header: 'Receipts', key: 'receipts', ...money },
          { header: 'Payments', key: 'payments', ...money },
          { header: 'Count', key: 'count', width: 8, align: 'right' as const },
        ],
        rows: a.byMethod.map((m) => ({
          method: `  ${m.method}`,
          receipts: m.receipts,
          payments: m.payments,
          count: m.count,
        })),
      });
      sections.push({
        title: `${a.accountName} — movements`,
        columns: [
          { header: 'Date', key: 'date', width: 12 },
          { header: 'Reference', key: 'reference', width: 18 },
          { header: 'Counterparty', key: 'counterparty', width: 24 },
          { header: 'Description', key: 'description', width: 30 },
          { header: 'Receipt', key: 'receipt', ...money },
          { header: 'Payment', key: 'payment', ...money },
        ],
        rows: a.movements.map((m) => ({
          date: m.date,
          reference: m.reference,
          counterparty: m.counterparty,
          description: m.description,
          receipt: m.direction === 'IN' ? m.amountInr : '',
          payment: m.direction === 'OUT' ? m.amountInr : '',
        })),
        summary: {
          date: '',
          reference: 'Total',
          counterparty: '',
          description: '',
          receipt: a.receipts,
          payment: a.payments,
        },
      });
    }
    return sections;
  };

  const filename = `Bank_Book_${startDate}_to_${endDate}`;
  const handleExportCSV = () => downloadReportCSV(buildExportSections(), filename);
  const handleExportExcel = () => downloadReportExcel(buildExportSections(), filename, 'Bank Book');
  const handleExportPDF = () =>
    exportPDF(buildExportSections(), filename, {
      title: 'Bank Book',
      subtitle: `${startDate} to ${endDate}`,
    });

  if (!hasViewAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <PageHeader title="Bank Book" />
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
          { label: 'Bank Book' },
        ]}
      />
      <PageHeader
        title="Bank Book"
        subtitle="Opening to closing balance per bank and cash account, with every movement behind it."
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

      {loading && <LoadingState message="Reading payments and receipts…" />}

      {!loading && !report && !error && (
        <EmptyState title="No report yet" message="Pick a date range and select Generate Report." />
      )}

      {!loading && report && report.accounts.length === 0 && (
        <EmptyState message="No bank or cash movements in this period." />
      )}

      {!loading && report && report.accounts.length > 0 && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Opening balance', value: report.totals.openingBalance },
              { label: 'Receipts', value: report.totals.receipts },
              { label: 'Payments', value: report.totals.payments },
              { label: 'Closing balance', value: report.totals.closingBalance },
            ].map((kpi) => (
              <Grid size={{ xs: 6, md: 3 }} key={kpi.label}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">
                      {kpi.label}
                    </Typography>
                    <Typography variant="h6">{formatCurrency(kpi.value)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {report.unresolvedAccountCount > 0 && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              {report.unresolvedAccountCount} settlement account id on these transactions matches no
              account record, so its movements are grouped under the raw id. Its balances are still
              correct; only the name is missing.
            </Alert>
          )}

          {report.accounts.map((a) => (
            <Paper sx={{ p: 2, mb: 3 }} key={a.accountId}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle1">
                  {a.accountCode ? `${a.accountCode} · ` : ''}
                  {a.accountName}
                </Typography>
                {a.unresolved && <Chip size="small" color="warning" label="unresolved" />}
              </Stack>

              <Stack direction="row" spacing={3} sx={{ mb: 2, flexWrap: 'wrap' }}>
                <Typography variant="body2">
                  Opening <strong>{formatCurrency(a.openingBalance)}</strong>
                </Typography>
                <Typography variant="body2" color="success.main">
                  Receipts <strong>{formatCurrency(a.receipts)}</strong> ({a.receiptCount})
                </Typography>
                <Typography variant="body2" color="error.main">
                  Payments <strong>{formatCurrency(a.payments)}</strong> ({a.paymentCount})
                </Typography>
                <Typography variant="body2">
                  Closing <strong>{formatCurrency(a.closingBalance)}</strong>
                </Typography>
              </Stack>

              {a.byMethod.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
                  {a.byMethod.map((m) => (
                    <Chip
                      key={m.method}
                      size="small"
                      variant="outlined"
                      label={`${m.method}: ${m.count}`}
                    />
                  ))}
                </Stack>
              )}

              {a.movements.length === 0 ? (
                <EmptyState message="No movements in this period." />
              ) : (
                <TableContainer sx={{ maxHeight: 420 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Reference</TableCell>
                        <TableCell>Counterparty</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell align="right">Receipt</TableCell>
                        <TableCell align="right">Payment</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {a.movements.map((m) => (
                        <TableRow key={`${m.id}-${m.direction}`}>
                          <TableCell>{formatDate(m.date)}</TableCell>
                          <TableCell>{m.reference}</TableCell>
                          <TableCell>{m.counterparty || '—'}</TableCell>
                          <TableCell>{m.description || '—'}</TableCell>
                          <TableCell align="right">
                            {m.direction === 'IN' ? formatCurrency(m.amountInr) : ''}
                          </TableCell>
                          <TableCell align="right">
                            {m.direction === 'OUT' ? formatCurrency(m.amountInr) : ''}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          ))}

          <Alert severity="info">
            Bank reconciliation is not shown: no transaction currently carries a reconciled date, so
            a reconciled-versus-unreconciled split would report only zeroes. Once reconciliation is
            recorded, that section belongs here.
          </Alert>
        </>
      )}
    </Box>
  );
}
