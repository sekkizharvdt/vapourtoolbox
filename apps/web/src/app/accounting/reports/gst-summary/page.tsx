'use client';

import { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Breadcrumbs,
  Link,
  Button,
  TextField,
  Collapse,
  IconButton,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Home as HomeIcon,
  KeyboardArrowDown as ExpandIcon,
  KeyboardArrowUp as CollapseIcon,
  FileDownload as ExportIcon,
} from '@mui/icons-material';
import { PageHeader } from '@vapour/ui';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { canViewAccounting } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import { getSystemAccountIds } from '@/lib/accounting/systemAccountResolver';
import { fetchAccountGLEntries, type GLDrilldownEntry } from '@/lib/accounting/reports/glDrilldown';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import {
  downloadReportCSV,
  downloadReportExcel,
  type ExportSection,
} from '@/lib/accounting/reports/exportReport';

type GSTType = 'CGST' | 'SGST' | 'IGST';

interface GSTAccountData {
  gstType: GSTType;
  inputAccountId: string | undefined;
  outputAccountId: string | undefined;
  inputEntries: GLDrilldownEntry[];
  outputEntries: GLDrilldownEntry[];
  inputDebit: number;
  inputCredit: number;
  outputDebit: number;
  outputCredit: number;
  inputBalance: number; // debit - credit (asset, so normally debit balance)
  outputBalance: number; // credit - debit (liability, so normally credit balance)
  netPayable: number; // output - input (positive = payable, negative = refund)
}

export default function GSTSummaryPage() {
  const router = useRouter();
  const { claims } = useAuth();
  const hasViewAccess = claims?.permissions ? canViewAccounting(claims.permissions) : false;

  // Date range — default to current financial year
  const today = new Date();
  const fyStart =
    today.getMonth() >= 3
      ? new Date(today.getFullYear(), 3, 1)
      : new Date(today.getFullYear() - 1, 3, 1);

  const [startDate, setStartDate] = useState(fyStart.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GSTAccountData[] | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [expandedSide, setExpandedSide] = useState<'input' | 'output' | null>(null);

  const generateReport = useCallback(async () => {
    setLoading(true);
    setData(null);
    try {
      const entityId = claims?.entityId;
      if (!entityId) {
        setData(null);
        return;
      }
      const { db } = getFirebase();
      const accounts = await getSystemAccountIds(db, entityId);

      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const gstTypes: { type: GSTType; inputId?: string; outputId?: string }[] = [
        { type: 'CGST', inputId: accounts.cgstInput, outputId: accounts.cgstPayable },
        { type: 'SGST', inputId: accounts.sgstInput, outputId: accounts.sgstPayable },
        { type: 'IGST', inputId: accounts.igstInput, outputId: accounts.igstPayable },
      ];

      // Fetch GL entries for all 6 accounts in parallel
      const results = await Promise.all(
        gstTypes.map(async ({ type, inputId, outputId }) => {
          const [inputEntries, outputEntries] = await Promise.all([
            inputId ? fetchAccountGLEntries(db, inputId) : Promise.resolve([]),
            outputId ? fetchAccountGLEntries(db, outputId) : Promise.resolve([]),
          ]);

          // Filter by date range
          const filterByDate = (entries: GLDrilldownEntry[]) =>
            entries.filter((e) => e.date >= start && e.date <= end);

          const filteredInput = filterByDate(inputEntries);
          const filteredOutput = filterByDate(outputEntries);

          const inputDebit = filteredInput.reduce((sum, e) => sum + e.debit, 0);
          const inputCredit = filteredInput.reduce((sum, e) => sum + e.credit, 0);
          const outputDebit = filteredOutput.reduce((sum, e) => sum + e.debit, 0);
          const outputCredit = filteredOutput.reduce((sum, e) => sum + e.credit, 0);

          // Input accounts (1301-1303) are assets: debit balance = ITC available
          const inputBalance = inputDebit - inputCredit;
          // Output accounts (2201-2203) are liabilities: credit balance = tax collected
          const outputBalance = outputCredit - outputDebit;
          // Net payable = Output (collected) - Input (paid)
          const netPayable = outputBalance - inputBalance;

          return {
            gstType: type,
            inputAccountId: inputId,
            outputAccountId: outputId,
            inputEntries: filteredInput,
            outputEntries: filteredOutput,
            inputDebit,
            inputCredit,
            outputDebit,
            outputCredit,
            inputBalance,
            outputBalance,
            netPayable,
          };
        })
      );

      setData(results);
    } catch (error) {
      console.error('[GSTSummary] Error generating report:', error);
      alert('Failed to generate GST summary. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, claims?.entityId]);

  const handleToggleExpand = (gstType: string, side: 'input' | 'output') => {
    if (expandedRow === gstType && expandedSide === side) {
      setExpandedRow(null);
      setExpandedSide(null);
    } else {
      setExpandedRow(gstType);
      setExpandedSide(side);
    }
  };

  const handleExport = (format: 'csv' | 'excel') => {
    if (!data) return;

    const totalInput = data.reduce((sum, d) => sum + d.inputBalance, 0);
    const totalOutput = data.reduce((sum, d) => sum + d.outputBalance, 0);
    const totalNet = data.reduce((sum, d) => sum + d.netPayable, 0);

    const sections: ExportSection[] = [
      {
        title: `GST Summary (${startDate} to ${endDate})`,
        columns: [
          { header: 'GST Type', key: 'type', width: 12 },
          {
            header: 'Input (ITC Available)',
            key: 'input',
            width: 20,
            align: 'right',
            format: 'currency',
          },
          {
            header: 'Output (Tax Collected)',
            key: 'output',
            width: 20,
            align: 'right',
            format: 'currency',
          },
          { header: 'Net Payable', key: 'net', width: 20, align: 'right', format: 'currency' },
        ],
        rows: data.map((d) => ({
          type: d.gstType,
          input: d.inputBalance,
          output: d.outputBalance,
          net: d.netPayable,
        })),
        summary: {
          type: 'TOTAL',
          input: totalInput,
          output: totalOutput,
          net: totalNet,
        },
      },
    ];

    const filename = `GST_Summary_${startDate}_to_${endDate}`;
    if (format === 'csv') {
      downloadReportCSV(sections, filename);
    } else {
      downloadReportExcel(sections, filename);
    }
  };

  if (!hasViewAccess) {
    return (
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          GST Summary
        </Typography>
        <Typography color="error">
          You do not have permission to access financial reports.
        </Typography>
      </Box>
    );
  }

  const totalInput = data?.reduce((sum, d) => sum + d.inputBalance, 0) ?? 0;
  const totalOutput = data?.reduce((sum, d) => sum + d.outputBalance, 0) ?? 0;
  const totalNet = data?.reduce((sum, d) => sum + d.netPayable, 0) ?? 0;

  return (
    <Box sx={{ py: 4 }}>
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
        <Typography color="text.primary">GST Summary</Typography>
      </Breadcrumbs>

      <PageHeader
        title="GST Summary"
        subtitle="Net GST position across CGST, SGST, and IGST with input vs output breakdown"
      />

      {/* Controls */}
      <Paper sx={{ p: 2, mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          label="From"
          type="date"
          size="small"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="To"
          type="date"
          size="small"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <Button variant="contained" onClick={generateReport} disabled={loading}>
          {loading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
          Generate
        </Button>
        {data && (
          <>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ExportIcon />}
              onClick={() => handleExport('csv')}
            >
              CSV
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ExportIcon />}
              onClick={() => handleExport('excel')}
            >
              Excel
            </Button>
          </>
        )}
      </Paper>

      {/* Summary Cards */}
      {data && (
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Paper sx={{ p: 2, flex: 1, minWidth: 200, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Total Input (ITC)
            </Typography>
            <Typography variant="h6" color="success.main">
              {formatCurrency(totalInput, 'INR')}
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1, minWidth: 200, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Total Output (Collected)
            </Typography>
            <Typography variant="h6" color="error.main">
              {formatCurrency(totalOutput, 'INR')}
            </Typography>
          </Paper>
          <Paper sx={{ p: 2, flex: 1, minWidth: 200, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Net GST {totalNet >= 0 ? 'Payable' : 'Refundable'}
            </Typography>
            <Typography variant="h6" color={totalNet >= 0 ? 'error.main' : 'success.main'}>
              {formatCurrency(Math.abs(totalNet), 'INR')}
            </Typography>
          </Paper>
        </Box>
      )}

      {/* Results Table */}
      {data && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width={40} />
                <TableCell>GST Type</TableCell>
                <TableCell align="right">Input (ITC Available)</TableCell>
                <TableCell align="right">Output (Tax Collected)</TableCell>
                <TableCell align="right">Net Payable</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((row) => (
                <>
                  <TableRow key={row.gstType} hover>
                    <TableCell />
                    <TableCell>
                      <Typography fontWeight="bold">{row.gstType}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          cursor: 'pointer',
                        }}
                        onClick={() => handleToggleExpand(row.gstType, 'input')}
                      >
                        {formatCurrency(row.inputBalance, 'INR')}
                        <IconButton size="small">
                          {expandedRow === row.gstType && expandedSide === 'input' ? (
                            <CollapseIcon fontSize="small" />
                          ) : (
                            <ExpandIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          cursor: 'pointer',
                        }}
                        onClick={() => handleToggleExpand(row.gstType, 'output')}
                      >
                        {formatCurrency(row.outputBalance, 'INR')}
                        <IconButton size="small">
                          {expandedRow === row.gstType && expandedSide === 'output' ? (
                            <CollapseIcon fontSize="small" />
                          ) : (
                            <ExpandIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={formatCurrency(Math.abs(row.netPayable), 'INR')}
                        size="small"
                        color={row.netPayable >= 0 ? 'error' : 'success'}
                        variant="outlined"
                      />
                      <Typography variant="caption" sx={{ ml: 0.5 }}>
                        {row.netPayable >= 0 ? 'Payable' : 'Refund'}
                      </Typography>
                    </TableCell>
                  </TableRow>

                  {/* Drill-down entries */}
                  {expandedRow === row.gstType && expandedSide && (
                    <TableRow key={`${row.gstType}-detail`}>
                      <TableCell colSpan={5} sx={{ py: 0 }}>
                        <Collapse in={true} timeout="auto" unmountOnExit>
                          <Box sx={{ m: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>
                              {row.gstType} {expandedSide === 'input' ? 'Input' : 'Output'} — GL
                              Entries
                            </Typography>
                            <DrilldownTable
                              entries={
                                expandedSide === 'input' ? row.inputEntries : row.outputEntries
                              }
                            />
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}

              {/* Totals row */}
              <TableRow sx={{ backgroundColor: 'action.hover' }}>
                <TableCell />
                <TableCell>
                  <Typography fontWeight="bold">Total</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography fontWeight="bold">{formatCurrency(totalInput, 'INR')}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography fontWeight="bold">{formatCurrency(totalOutput, 'INR')}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography
                    fontWeight="bold"
                    color={totalNet >= 0 ? 'error.main' : 'success.main'}
                  >
                    {formatCurrency(Math.abs(totalNet), 'INR')}{' '}
                    <Typography component="span" variant="caption">
                      {totalNet >= 0 ? 'Payable' : 'Refund'}
                    </Typography>
                  </Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!data && !loading && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            Select a date range and click Generate to view the GST summary.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

/** Drill-down table for individual GL entries */
function DrilldownTable({ entries }: { entries: GLDrilldownEntry[] }) {
  if (entries.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
        No entries found for this period.
      </Typography>
    );
  }

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Date</TableCell>
          <TableCell>Transaction #</TableCell>
          <TableCell>Type</TableCell>
          <TableCell>Description</TableCell>
          <TableCell align="right">Debit</TableCell>
          <TableCell align="right">Credit</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {entries.map((entry, idx) => (
          <TableRow key={`${entry.transactionId}-${idx}`} hover>
            <TableCell>{formatDate(entry.date)}</TableCell>
            <TableCell>
              <Link
                href={entry.route}
                sx={{ cursor: 'pointer' }}
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  // Navigate to transaction list (the route points to the list page)
                }}
              >
                {entry.transactionNumber}
              </Link>
            </TableCell>
            <TableCell>{entry.transactionType}</TableCell>
            <TableCell>{entry.description || '-'}</TableCell>
            <TableCell align="right">
              {entry.debit ? formatCurrency(entry.debit, 'INR') : '-'}
            </TableCell>
            <TableCell align="right">
              {entry.credit ? formatCurrency(entry.credit, 'INR') : '-'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
