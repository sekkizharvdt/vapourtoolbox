'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Home as HomeIcon, FileDownload as DownloadIcon } from '@mui/icons-material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import { PageHeader } from '@vapour/ui';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import {
  fetchPeriodReportData,
  type PeriodReportData,
  type PeriodSelection,
  type QuarterCode,
  type AgingBuckets,
  type AgingSection,
} from '@/lib/accounting/reports/periodReportData';
import { downloadPDF, sanitiseFilename } from '@/lib/pdf/pdfUtils';
import { fetchLogoAsDataUri } from '@/lib/pdf/logoUtils';
import { PeriodReportPDFDocument } from '@/components/pdf/PeriodReportPDFDocument';
import React from 'react';

/* ─── FY helpers ──────────────────────────────────────────────── */

function currentFyStartYear(today: Date = new Date()): number {
  return today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear();
}

function fyLabel(fyStartYear: number): string {
  return `FY ${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, '0')}`;
}

const QUARTER_OPTIONS: { code: QuarterCode; label: string }[] = [
  { code: 'FY', label: 'Full year' },
  { code: 'Q1', label: 'Q1 (Apr–Jun)' },
  { code: 'Q2', label: 'Q2 (Jul–Sep)' },
  { code: 'Q3', label: 'Q3 (Oct–Dec)' },
  { code: 'Q4', label: 'Q4 (Jan–Mar)' },
];

/* ─── Formatting ──────────────────────────────────────────────── */

function formatINR(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}
function formatINRSigned(n: number): string {
  if (Math.abs(n) < 0.5) return '₹0';
  return (n < 0 ? '-' : '') + '₹' + Math.round(Math.abs(n)).toLocaleString('en-IN');
}
function formatPct(n: number): string {
  return n.toFixed(1) + '%';
}
function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDelta(amount: number, pct: number): string {
  const sign = amount >= 0 ? '+' : '−';
  return `${sign}${formatINR(Math.abs(amount))} (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`;
}

/* ─── Page ────────────────────────────────────────────────────── */

export default function PeriodReportPage() {
  const { claims } = useAuth();
  const currentFy = currentFyStartYear();

  const [fyStartYear, setFyStartYear] = useState<number>(currentFy - 1);
  const [quarter, setQuarter] = useState<QuarterCode>('FY');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [data, setData] = useState<PeriodReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fyOptions = useMemo(
    () => [currentFy, currentFy - 1, currentFy - 2, currentFy - 3],
    [currentFy]
  );

  const loadReport = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { db } = getFirebase();
      const tenantId = claims?.tenantId || 'default-entity';
      const sel: PeriodSelection = { fyStartYear, quarter };
      const result = await fetchPeriodReportData(db, sel, tenantId);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [fyStartYear, quarter, claims?.tenantId]);

  const downloadReportPdf = useCallback(async () => {
    if (!data) return;
    setDownloading(true);
    try {
      const logoDataUri = await fetchLogoAsDataUri();
      const filename = sanitiseFilename(`Accounting-Report-${data.period.label}.pdf`);
      await downloadPDF(
        <PeriodReportPDFDocument data={data} logoDataUri={logoDataUri} />,
        filename
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate PDF');
    } finally {
      setDownloading(false);
    }
  }, [data]);

  return (
    <Box sx={{ p: 3 }}>
      <PageBreadcrumbs
        items={[
          { label: 'Home', href: '/', icon: <HomeIcon sx={{ fontSize: 16 }} /> },
          { label: 'Accounting', href: '/accounting' },
          { label: 'Reports', href: '/accounting/reports' },
          { label: 'Period Report' },
        ]}
      />
      <PageHeader
        title="Period Report"
        subtitle="On-demand quarterly / annual management report — accrual basis, INR."
      />

      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Fiscal year</InputLabel>
            <Select
              label="Fiscal year"
              value={fyStartYear}
              onChange={(e) => setFyStartYear(Number(e.target.value))}
            >
              {fyOptions.map((y) => (
                <MenuItem key={y} value={y}>
                  {fyLabel(y)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Period</InputLabel>
            <Select
              label="Period"
              value={quarter}
              onChange={(e) => setQuarter(e.target.value as QuarterCode)}
            >
              {QUARTER_OPTIONS.map((opt) => (
                <MenuItem key={opt.code} value={opt.code}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="contained" onClick={loadReport} disabled={loading}>
            {loading ? 'Loading…' : 'Load preview'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={downloadReportPdf}
            disabled={!data || downloading}
          >
            {downloading ? 'Generating…' : 'Download PDF'}
          </Button>
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}
      {!loading && data && <ReportPreview data={data} />}
      {!loading && !data && !error && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Pick a fiscal year + period and click “Load preview”.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

/* ─── Preview (mirrors the PDF) ───────────────────────────────── */

function ReportPreview({ data }: { data: PeriodReportData }) {
  const {
    period,
    executiveSummary,
    pnl,
    balanceSheet,
    cashFlow,
    arAging,
    apAging,
    workingCapital,
    gst,
    projectPerformance,
    dataQuality,
    trialBalance,
  } = data;

  return (
    <Stack spacing={3}>
      {/* Executive Summary */}
      <Card>
        <CardContent>
          <Typography variant="overline" color="text.secondary">
            {period.label}
          </Typography>
          <Typography variant="h6" sx={{ mt: 1 }}>
            Executive Summary
          </Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <KPI label="Revenue" value={formatINR(executiveSummary.revenue)} />
            <KPI
              label="Net profit"
              value={formatINRSigned(executiveSummary.netProfit)}
              color={executiveSummary.netProfit >= 0 ? 'success.main' : 'error.main'}
            />
            <KPI
              label="Net cash flow"
              value={formatINRSigned(executiveSummary.netCashFlow)}
              color={executiveSummary.netCashFlow >= 0 ? 'success.main' : 'error.main'}
            />
            <KPI label="Closing cash" value={formatINR(executiveSummary.closingCash)} />
            <KPI label="AR outstanding" value={formatINR(executiveSummary.arOutstanding)} />
            <KPI label="AP outstanding" value={formatINR(executiveSummary.apOutstanding)} />
            <KPI
              label="Working capital"
              value={formatINRSigned(executiveSummary.workingCapital)}
              color={executiveSummary.workingCapital >= 0 ? 'success.main' : 'error.main'}
            />
            <KPI
              label="Data quality issues"
              value={String(executiveSummary.dataQualityIssues)}
              color={
                executiveSummary.dataQualityIssues === 0
                  ? 'success.main'
                  : executiveSummary.dataQualityIssues <= 5
                    ? 'warning.main'
                    : 'error.main'
              }
            />
          </Grid>
          {pnl.changes && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                vs prior equal-length period
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Metric</TableCell>
                      <TableCell align="right">Current</TableCell>
                      <TableCell align="right">Prior</TableCell>
                      <TableCell align="right">Δ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>Revenue</TableCell>
                      <TableCell align="right">{formatINR(pnl.current.revenue.total)}</TableCell>
                      <TableCell align="right">
                        {pnl.previous ? formatINR(pnl.previous.revenue.total) : '—'}
                      </TableCell>
                      <TableCell align="right">
                        {formatDelta(pnl.changes.revenue.amount, pnl.changes.revenue.percentage)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Expenses</TableCell>
                      <TableCell align="right">{formatINR(pnl.current.expenses.total)}</TableCell>
                      <TableCell align="right">
                        {pnl.previous ? formatINR(pnl.previous.expenses.total) : '—'}
                      </TableCell>
                      <TableCell align="right">
                        {formatDelta(pnl.changes.expenses.amount, pnl.changes.expenses.percentage)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Net profit</TableCell>
                      <TableCell align="right">{formatINRSigned(pnl.current.netProfit)}</TableCell>
                      <TableCell align="right">
                        {pnl.previous ? formatINRSigned(pnl.previous.netProfit) : '—'}
                      </TableCell>
                      <TableCell align="right">
                        {formatDelta(
                          pnl.changes.netProfit.amount,
                          pnl.changes.netProfit.percentage
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
          {!pnl.previous && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              Prior-period figures unavailable — no activity in prior window.
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* P&L */}
      <Card>
        <CardContent>
          <Typography variant="h6">Profit & Loss</Typography>
          <TableContainer sx={{ mt: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Line</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <RowAmt label="Revenue — sales" amount={pnl.current.revenue.sales} />
                <RowAmt label="Revenue — other income" amount={pnl.current.revenue.otherIncome} />
                <RowAmt label="Total revenue" amount={pnl.current.revenue.total} bold />
                <RowAmt label="COGS" amount={pnl.current.expenses.costOfGoodsSold} />
                <RowAmt
                  label="Operating expenses"
                  amount={pnl.current.expenses.operatingExpenses}
                />
                <RowAmt label="Other expenses" amount={pnl.current.expenses.otherExpenses} />
                <RowAmt label="Total expenses" amount={pnl.current.expenses.total} bold />
                <RowAmt label="Gross profit" amount={pnl.current.grossProfit} />
                <RowAmt label="Operating profit" amount={pnl.current.operatingProfit} />
                <RowAmt label="Net profit" amount={pnl.current.netProfit} bold signed />
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Balance Sheet */}
      <Card>
        <CardContent>
          <Typography variant="h6">
            Balance Sheet{' '}
            <Typography component="span" variant="caption" color="text.secondary">
              as of {formatDate(balanceSheet.asOfDate)}
            </Typography>
          </Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="subtitle2" gutterBottom>
                Assets
              </Typography>
              <KV label="Current" value={formatINR(balanceSheet.assets.totalCurrentAssets)} />
              <KV label="Fixed" value={formatINR(balanceSheet.assets.totalFixedAssets)} />
              <KV label="Other" value={formatINR(balanceSheet.assets.totalOtherAssets)} />
              <KV label="Total" value={formatINR(balanceSheet.assets.totalAssets)} bold />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="subtitle2" gutterBottom>
                Liabilities
              </Typography>
              <KV
                label="Current"
                value={formatINR(balanceSheet.liabilities.totalCurrentLiabilities)}
              />
              <KV
                label="Long-term"
                value={formatINR(balanceSheet.liabilities.totalLongTermLiabilities)}
              />
              <KV label="Total" value={formatINR(balanceSheet.liabilities.totalLiabilities)} bold />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="subtitle2" gutterBottom>
                Equity
              </Typography>
              <KV label="Capital" value={formatINRSigned(balanceSheet.equity.capital)} />
              <KV label="Retained" value={formatINRSigned(balanceSheet.equity.retainedEarnings)} />
              <KV
                label="Current-year profit"
                value={formatINRSigned(balanceSheet.equity.currentYearProfit)}
              />
              <KV label="Total" value={formatINRSigned(balanceSheet.equity.totalEquity)} bold />
            </Grid>
          </Grid>
          <Box sx={{ mt: 2 }}>
            <Chip
              size="small"
              color={balanceSheet.balanced ? 'success' : 'error'}
              label={
                balanceSheet.balanced
                  ? 'Accounting equation balances'
                  : `Off by ${formatINRSigned(balanceSheet.difference)}`
              }
            />
          </Box>
        </CardContent>
      </Card>

      {/* Cash Flow */}
      <Card>
        <CardContent>
          <Typography variant="h6">Cash Flow</Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <KPI label="Opening cash" value={formatINR(cashFlow.openingCash)} />
            <KPI
              label="Net cash flow"
              value={formatINRSigned(cashFlow.netCashFlow)}
              color={cashFlow.netCashFlow >= 0 ? 'success.main' : 'error.main'}
            />
            <KPI label="Closing cash" value={formatINR(cashFlow.closingCash)} />
          </Grid>
          <TableContainer sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Activity</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <RowAmt label={cashFlow.operating.title} amount={cashFlow.operating.total} signed />
                <RowAmt label={cashFlow.investing.title} amount={cashFlow.investing.total} signed />
                <RowAmt label={cashFlow.financing.title} amount={cashFlow.financing.total} signed />
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* AR & AP aging */}
      <Card>
        <CardContent>
          <Typography variant="h6">Aging — receivables and payables</Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <AgingPanel aging={arAging} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <AgingPanel aging={apAging} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Working capital */}
      <Card>
        <CardContent>
          <Typography variant="h6">Working Capital</Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <KPI
              label="Working capital"
              value={formatINRSigned(workingCapital.workingCapital)}
              color={workingCapital.workingCapital >= 0 ? 'success.main' : 'error.main'}
            />
            <KPI
              label="Current ratio"
              value={
                workingCapital.currentRatio != null ? workingCapital.currentRatio.toFixed(2) : '—'
              }
            />
            <KPI
              label="Quick ratio"
              value={workingCapital.quickRatio != null ? workingCapital.quickRatio.toFixed(2) : '—'}
            />
          </Grid>
        </CardContent>
      </Card>

      {/* GST */}
      <Card>
        <CardContent>
          <Typography variant="h6">GST & Statutory</Typography>
          {!gst.configured ? (
            <Alert severity="warning" sx={{ mt: 1 }}>
              GST accounts not configured (expected codes {gst.missingAccountCodes.join(', ')}).
            </Alert>
          ) : (
            <TableContainer sx={{ mt: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>GST</TableCell>
                    <TableCell align="right">Input (ITC)</TableCell>
                    <TableCell align="right">Output</TableCell>
                    <TableCell align="right">Net</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>CGST</TableCell>
                    <TableCell align="right">{formatINR(gst.cgstInput)}</TableCell>
                    <TableCell align="right">{formatINR(gst.cgstOutput)}</TableCell>
                    <TableCell align="right">
                      {formatINRSigned(gst.cgstOutput - gst.cgstInput)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>SGST</TableCell>
                    <TableCell align="right">{formatINR(gst.sgstInput)}</TableCell>
                    <TableCell align="right">{formatINR(gst.sgstOutput)}</TableCell>
                    <TableCell align="right">
                      {formatINRSigned(gst.sgstOutput - gst.sgstInput)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>IGST</TableCell>
                    <TableCell align="right">{formatINR(gst.igstInput)}</TableCell>
                    <TableCell align="right">{formatINR(gst.igstOutput)}</TableCell>
                    <TableCell align="right">
                      {formatINRSigned(gst.igstOutput - gst.igstInput)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Net payable</TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {formatINRSigned(gst.netPayable)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Project performance */}
      <Card>
        <CardContent>
          <Typography variant="h6">Project Performance</Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <KPI label="Revenue (tagged)" value={formatINR(projectPerformance.totals.revenue)} />
            <KPI label="Spend (tagged)" value={formatINR(projectPerformance.totals.expense)} />
            <KPI
              label="Margin"
              value={formatINRSigned(projectPerformance.totals.margin)}
              color={projectPerformance.totals.margin >= 0 ? 'success.main' : 'error.main'}
            />
            <KPI
              label="Spend coverage"
              value={formatPct(projectPerformance.totals.taggedSpendPct)}
            />
          </Grid>
          <TableContainer sx={{ mt: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Project</TableCell>
                  <TableCell align="right">Revenue</TableCell>
                  <TableCell align="right">Expense</TableCell>
                  <TableCell align="right">Margin</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projectPerformance.rows.slice(0, 10).map((p) => (
                  <TableRow key={p.projectId}>
                    <TableCell>{p.projectName}</TableCell>
                    <TableCell align="right">{formatINR(p.revenue)}</TableCell>
                    <TableCell align="right">{formatINR(p.expense)}</TableCell>
                    <TableCell align="right">{formatINRSigned(p.margin)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell sx={{ fontStyle: 'italic' }}>
                    Corporate overhead (untagged bills)
                  </TableCell>
                  <TableCell />
                  <TableCell align="right">
                    {formatINR(projectPerformance.corporateOverhead.amount)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Data quality */}
      <Card>
        <CardContent>
          <Typography variant="h6">Data Quality</Typography>
          {dataQuality.findings.length === 0 ? (
            <Alert severity="success" sx={{ mt: 1 }}>
              No issues detected.
            </Alert>
          ) : (
            <Stack spacing={1} sx={{ mt: 1 }}>
              {dataQuality.findings.map((f, i) => (
                <Alert
                  key={i}
                  severity={
                    f.severity === 'high' ? 'error' : f.severity === 'medium' ? 'warning' : 'info'
                  }
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {f.count} — {f.label}
                  </Typography>
                  {f.detail && (
                    <Typography variant="caption" color="text.secondary">
                      {f.detail}
                    </Typography>
                  )}
                </Alert>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Trial balance preview (first 12 rows) */}
      <Card>
        <CardContent>
          <Typography variant="h6">
            Trial Balance{' '}
            <Typography component="span" variant="caption" color="text.secondary">
              (appendix — full list in PDF)
            </Typography>
          </Typography>
          <TableContainer sx={{ mt: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Account</TableCell>
                  <TableCell align="right">Debit</TableCell>
                  <TableCell align="right">Credit</TableCell>
                  <TableCell align="right">Balance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {trialBalance.rows
                  .filter((r) => r.debit > 0.01 || r.credit > 0.01)
                  .slice(0, 12)
                  .map((r) => (
                    <TableRow key={r.code}>
                      <TableCell>{r.code}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell align="right">{formatINR(r.debit)}</TableCell>
                      <TableCell align="right">{formatINR(r.credit)}</TableCell>
                      <TableCell align="right">{formatINRSigned(r.balance)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ mt: 1 }}>
            <Chip
              size="small"
              color={trialBalance.balanced ? 'success' : 'error'}
              label={
                trialBalance.balanced
                  ? `Balanced — Dr ${formatINR(trialBalance.totals.debit)} = Cr ${formatINR(trialBalance.totals.credit)}`
                  : `Unbalanced — Δ ${formatINRSigned(trialBalance.totals.debit - trialBalance.totals.credit)}`
              }
            />
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}

/* ─── Little widgets ──────────────────────────────────────────── */

function KPI({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Grid size={{ xs: 12, sm: 6, md: 3 }}>
      <Box
        sx={{
          p: 2,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          height: '100%',
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ textTransform: 'uppercase', display: 'block' }}
        >
          {label}
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5, color }}>
          {value}
        </Typography>
      </Box>
    </Grid>
  );
}

function RowAmt({
  label,
  amount,
  bold,
  signed,
}: {
  label: string;
  amount: number;
  bold?: boolean;
  signed?: boolean;
}) {
  return (
    <TableRow>
      <TableCell sx={{ fontWeight: bold ? 700 : 400 }}>{label}</TableCell>
      <TableCell align="right" sx={{ fontWeight: bold ? 700 : 400 }}>
        {signed ? formatINRSigned(amount) : formatINR(amount)}
      </TableCell>
    </TableRow>
  );
}

function KV({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
      <Typography variant="body2" sx={{ fontWeight: bold ? 700 : 400 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: bold ? 700 : 400 }}>
        {value}
      </Typography>
    </Box>
  );
}

const BUCKET_COLORS = {
  current: '#2e7d32',
  days31to60: '#ff9800',
  days61to90: '#ef6c00',
  over90days: '#d32f2f',
} as const;
const BUCKET_LABELS = {
  current: '0-30',
  days31to60: '31-60',
  days61to90: '61-90',
  over90days: '90+',
} as const;

function AgingPanel({ aging }: { aging: AgingSection }) {
  const title = aging.kind === 'AR' ? 'Receivables (AR)' : 'Payables (AP)';
  return (
    <Box>
      <Typography variant="subtitle2">{title}</Typography>
      <Typography variant="h6" sx={{ mt: 0.5, mb: 1 }}>
        {formatINR(aging.totalOutstanding)}
      </Typography>
      <StackedBarPreview buckets={aging.buckets} total={aging.totalOutstanding} />
      <Typography variant="caption" color="text.secondary">
        {aging.invoiceCount} items across {aging.entityCount}{' '}
        {aging.kind === 'AR' ? 'customers' : 'vendors'} · top-5{' '}
        {formatPct(aging.top5ConcentrationPct)}
      </Typography>
    </Box>
  );
}

function StackedBarPreview({ buckets, total }: { buckets: AgingBuckets; total: number }) {
  if (total <= 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Nothing outstanding.
      </Typography>
    );
  }
  const order = ['current', 'days31to60', 'days61to90', 'over90days'] as const;
  return (
    <Box>
      <Box sx={{ display: 'flex', width: '100%', height: 30, borderRadius: 1, overflow: 'hidden' }}>
        {order.map((key) => {
          const pct = (buckets[key] / total) * 100;
          if (pct <= 0) return null;
          return (
            <Box
              key={key}
              sx={{
                width: `${pct}%`,
                bgcolor: BUCKET_COLORS[key],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {pct >= 10 ? pct.toFixed(0) + '%' : ''}
            </Box>
          );
        })}
      </Box>
      <Stack direction="row" spacing={1.5} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
        {order.map((key) => (
          <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: BUCKET_COLORS[key] }} />
            <Typography variant="caption" color="text.secondary">
              {BUCKET_LABELS[key]}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
