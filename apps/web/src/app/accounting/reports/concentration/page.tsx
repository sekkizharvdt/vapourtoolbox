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
  generateEntityConcentrationReport,
  type EntityConcentrationReport,
  type ConcentrationSide,
} from '@/lib/accounting/reports/entityConcentration';

const logger = createLogger({ context: 'ConcentrationReport' });

function currentFiscalYear(now = new Date()) {
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { start: `${y}-04-01`, end: `${y + 1}-03-31` };
}

const percent = (n: number) => `${n.toFixed(1)}%`;
const signed = (n: number | null) => (n === null ? 'new' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`);

/** Conventional HHI reading, so the number means something without a textbook. */
function hhiVerdict(hhi: number): string {
  if (hhi === 0) return 'no activity';
  if (hhi < 1500) return 'diversified';
  if (hhi < 2500) return 'moderately concentrated';
  return 'highly concentrated';
}

export default function ConcentrationPage() {
  const { claims } = useAuth();
  const exportPDF = useReportPDFExport();
  const fy = currentFiscalYear();

  const [startDate, setStartDate] = useState(fy.start);
  const [endDate, setEndDate] = useState(fy.end);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<EntityConcentrationReport | null>(null);

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
        await generateEntityConcentrationReport(db, {
          startDate: new Date(`${startDate}T00:00:00`),
          endDate: new Date(`${endDate}T23:59:59`),
        })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Failed to generate concentration report', { error: message });
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const sideSection = (side: ConcentrationSide, title: string, label: string): ExportSection => ({
    title,
    columns: [
      { header: label, key: 'name', width: 30 },
      { header: 'Amount', key: 'amount', width: 18, align: 'right', format: 'currency' },
      { header: 'Share', key: 'share', width: 10, align: 'right' },
      { header: 'Cumulative', key: 'cumulative', width: 12, align: 'right' },
      { header: 'Docs', key: 'docs', width: 8, align: 'right' },
      { header: 'Prior period', key: 'prior', width: 18, align: 'right', format: 'currency' },
      { header: 'Change', key: 'change', width: 12, align: 'right' },
    ],
    rows: side.rows.map((r) => ({
      name: `  ${r.entityName}`,
      amount: r.amount,
      share: percent(r.sharePct),
      cumulative: percent(r.cumulativePct),
      docs: r.documentCount,
      prior: r.priorAmount,
      change: signed(r.changePct),
    })),
    summary: {
      name: 'Total',
      amount: side.total,
      share: '100.0%',
      cumulative: '',
      docs: side.documentCount,
      prior: side.priorTotal,
      change: '',
    },
  });

  const buildExportSections = (): ExportSection[] => {
    if (!report) return [];
    const overview = (side: ConcentrationSide, noun: string) => [
      { measure: `  ${noun} count`, value: String(side.counterpartyCount) },
      { measure: `  Total`, value: formatCurrency(side.total) },
      { measure: `  Largest single share`, value: percent(side.top1Pct) },
      { measure: `  Top 3 share`, value: percent(side.top3Pct) },
      { measure: `  Top 5 share`, value: percent(side.top5Pct) },
      { measure: `  Top 10 share`, value: percent(side.top10Pct) },
      { measure: `  ${noun}s making up half`, value: String(side.countToHalf) },
      { measure: `  HHI`, value: `${side.hhi} (${hhiVerdict(side.hhi)})` },
    ];
    return [
      {
        title: 'Customer concentration — overview',
        columns: [
          { header: 'Measure', key: 'measure', width: 34 },
          { header: 'Value', key: 'value', width: 24, align: 'right' },
        ],
        rows: overview(report.customers, 'Customer'),
      },
      sideSection(report.customers, 'Revenue by customer', 'Customer'),
      {
        title: 'Vendor concentration — overview',
        columns: [
          { header: 'Measure', key: 'measure', width: 34 },
          { header: 'Value', key: 'value', width: 24, align: 'right' },
        ],
        rows: overview(report.vendors, 'Vendor'),
      },
      sideSection(report.vendors, 'Spend by vendor', 'Vendor'),
    ];
  };

  const filename = `Concentration_${startDate}_to_${endDate}`;
  const handleExportCSV = () => downloadReportCSV(buildExportSections(), filename);
  const handleExportExcel = () =>
    downloadReportExcel(buildExportSections(), filename, 'Concentration');
  const handleExportPDF = () =>
    exportPDF(buildExportSections(), filename, {
      title: 'Customer & Vendor Concentration',
      subtitle: `${startDate} to ${endDate}`,
    });

  if (!hasViewAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <PageHeader title="Customer & Vendor Concentration" />
        <Alert severity="error">You do not have permission to view financial reports.</Alert>
      </Box>
    );
  }

  const renderSide = (side: ConcentrationSide, heading: string, label: string) => (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Typography variant="subtitle1" gutterBottom>
        {heading}
      </Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          { label: `${label}s`, value: String(side.counterpartyCount) },
          { label: 'Total', value: formatCurrency(side.total) },
          { label: 'Largest share', value: percent(side.top1Pct) },
          { label: 'Top 5 share', value: percent(side.top5Pct) },
          {
            label: `${label}s making up half`,
            value: String(side.countToHalf),
          },
          { label: 'HHI', value: `${side.hhi}`, caption: hhiVerdict(side.hhi) },
        ].map((kpi) => (
          <Grid size={{ xs: 6, sm: 4, md: 2 }} key={kpi.label}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent sx={{ py: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {kpi.label}
                </Typography>
                <Typography variant="h6">{kpi.value}</Typography>
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
      {side.rows.length === 0 ? (
        <EmptyState message={`No ${label.toLowerCase()} activity in this period.`} />
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{label}</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right">Share</TableCell>
                <TableCell align="right">Cumulative</TableCell>
                <TableCell align="right">Docs</TableCell>
                <TableCell align="right">Prior period</TableCell>
                <TableCell align="right">Change</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {side.rows.map((r) => (
                <TableRow key={r.entityId}>
                  <TableCell>{r.entityName}</TableCell>
                  <TableCell align="right">{formatCurrency(r.amount)}</TableCell>
                  <TableCell align="right">{percent(r.sharePct)}</TableCell>
                  <TableCell align="right">{percent(r.cumulativePct)}</TableCell>
                  <TableCell align="right">{r.documentCount}</TableCell>
                  <TableCell align="right">{formatCurrency(r.priorAmount)}</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color:
                        r.changePct === null
                          ? 'text.secondary'
                          : r.changePct >= 0
                            ? 'success.main'
                            : 'error.main',
                    }}
                  >
                    {signed(r.changePct)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell>
                  <strong>Total</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>{formatCurrency(side.total)}</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>100.0%</strong>
                </TableCell>
                <TableCell />
                <TableCell align="right">
                  <strong>{side.documentCount}</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>{formatCurrency(side.priorTotal)}</strong>
                </TableCell>
                <TableCell />
              </TableRow>
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
          { label: 'Concentration' },
        ]}
      />
      <PageHeader
        title="Customer & Vendor Concentration"
        subtitle="Who the revenue and the spend actually depend on, and how that shifted since the previous period."
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

      {loading && <LoadingState message="Reading invoices and bills…" />}

      {!loading && !report && !error && (
        <EmptyState title="No report yet" message="Pick a date range and select Generate Report." />
      )}

      {!loading && report && (
        <>
          <Alert severity="info" sx={{ mb: 3 }}>
            Change is measured against {formatDate(report.priorStartDate)} –{' '}
            {formatDate(report.priorEndDate)}, the equal-length window immediately before this one.
            Revenue counts customer invoices raised, not cash received.
          </Alert>
          {renderSide(report.customers, 'Revenue by customer', 'Customer')}
          {renderSide(report.vendors, 'Spend by vendor', 'Vendor')}
        </>
      )}
    </Box>
  );
}
