'use client';

import React, { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Tabs,
  Tab,
  Alert,
} from '@mui/material';
import { Grid } from '@mui/material';
import { FileDownload as DownloadIcon, Print as PrintIcon } from '@mui/icons-material';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import type { GSTR1Data } from '@/lib/accounting/gstReportGenerator';
import { exportGSTR1ToJSON } from '@/lib/accounting/gstReportGenerator';

/** Safely convert a value that may be a Firestore Timestamp, Date, or string to a locale date string */
function formatDate(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().toLocaleDateString();
  }
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }
  if (typeof value === 'string') {
    return new Date(value).toLocaleDateString();
  }
  return '';
}

interface GSTR1ReportProps {
  data: GSTR1Data;
}

type TabValue = 'summary' | 'b2b' | 'b2c' | 'hsn';

export function GSTR1Report({ data }: GSTR1ReportProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('summary');

  const handleExportJSON = () => {
    const json = exportGSTR1ToJSON(data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GSTR1_${data.period.month}_${data.period.year}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5">GSTR-1: Outward Supplies (Sales)</Typography>
          <Typography variant="body2" color="text.secondary">
            Period: {data.period.month.toString().padStart(2, '0')}/{data.period.year}
          </Typography>
          {data.gstin && (
            <Typography variant="body2" color="text.secondary">
              GSTIN: {data.gstin}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
            Print
          </Button>
          <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleExportJSON}>
            Export JSON
          </Button>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        GSTR-1 contains details of all outward supplies (sales/invoices) made during the period.
        This report must be filed by the 11th of the following month.
      </Alert>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Total Invoices
              </Typography>
              <Typography variant="h4">{data.total.transactionCount}</Typography>
              <Typography variant="caption" color="textSecondary">
                B2B: {data.b2b.summary.transactionCount} | B2C: {data.b2c.summary.transactionCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Taxable Value
              </Typography>
              <Typography variant="h5">{formatCurrency(data.total.taxableValue)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Total GST
              </Typography>
              <Typography variant="h5" color="primary">
                {formatCurrency(data.total.total)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Invoice Value
              </Typography>
              <Typography variant="h5">
                {formatCurrency(data.total.taxableValue + data.total.total)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
        <Tab label="Summary" value="summary" />
        <Tab label={`B2B Invoices (${data.b2b.invoices.length})`} value="b2b" />
        <Tab label={`B2C Invoices (${data.b2c.invoices.length})`} value="b2c" />
        <Tab label={`HSN Summary (${data.hsnSummary.length})`} value="hsn" />
      </Tabs>

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell align="right">Count</TableCell>
                <TableCell align="right">Taxable Value</TableCell>
                <TableCell align="right">CGST</TableCell>
                <TableCell align="right">SGST</TableCell>
                <TableCell align="right">IGST</TableCell>
                <TableCell align="right">Total GST</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>
                  <strong>B2B (Business to Business)</strong>
                  <br />
                  <Typography variant="caption" color="textSecondary">
                    Invoices with GSTIN
                  </Typography>
                </TableCell>
                <TableCell align="right">{data.b2b.summary.transactionCount}</TableCell>
                <TableCell align="right">{formatCurrency(data.b2b.summary.taxableValue)}</TableCell>
                <TableCell align="right">{formatCurrency(data.b2b.summary.cgst)}</TableCell>
                <TableCell align="right">{formatCurrency(data.b2b.summary.sgst)}</TableCell>
                <TableCell align="right">{formatCurrency(data.b2b.summary.igst)}</TableCell>
                <TableCell align="right">
                  <strong>{formatCurrency(data.b2b.summary.total)}</strong>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <strong>B2C (Business to Consumer)</strong>
                  <br />
                  <Typography variant="caption" color="textSecondary">
                    Invoices without GSTIN
                  </Typography>
                </TableCell>
                <TableCell align="right">{data.b2c.summary.transactionCount}</TableCell>
                <TableCell align="right">{formatCurrency(data.b2c.summary.taxableValue)}</TableCell>
                <TableCell align="right">{formatCurrency(data.b2c.summary.cgst)}</TableCell>
                <TableCell align="right">{formatCurrency(data.b2c.summary.sgst)}</TableCell>
                <TableCell align="right">{formatCurrency(data.b2c.summary.igst)}</TableCell>
                <TableCell align="right">
                  <strong>{formatCurrency(data.b2c.summary.total)}</strong>
                </TableCell>
              </TableRow>
              <TableRow sx={{ bgcolor: 'action.selected' }}>
                <TableCell>
                  <strong>Total</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>{data.total.transactionCount}</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>{formatCurrency(data.total.taxableValue)}</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>{formatCurrency(data.total.cgst)}</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>{formatCurrency(data.total.sgst)}</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>{formatCurrency(data.total.igst)}</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>{formatCurrency(data.total.total)}</strong>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* B2B Invoices Tab */}
      {activeTab === 'b2b' && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Invoice No.</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>GSTIN</TableCell>
                <TableCell align="right">Taxable Value</TableCell>
                <TableCell align="right">CGST</TableCell>
                <TableCell align="right">SGST</TableCell>
                <TableCell align="right">IGST</TableCell>
                <TableCell align="right">Invoice Value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.b2b.invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      No B2B invoices found for this period
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data.b2b.invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.invoiceNumber}</TableCell>
                    <TableCell>{formatDate(inv.invoiceDate)}</TableCell>
                    <TableCell>{inv.customerName}</TableCell>
                    <TableCell>{inv.customerGSTIN}</TableCell>
                    <TableCell align="right">{formatCurrency(inv.taxableValue)}</TableCell>
                    <TableCell align="right">{formatCurrency(inv.cgst)}</TableCell>
                    <TableCell align="right">{formatCurrency(inv.sgst)}</TableCell>
                    <TableCell align="right">{formatCurrency(inv.igst)}</TableCell>
                    <TableCell align="right">
                      <strong>{formatCurrency(inv.invoiceValue)}</strong>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* B2C Invoices Tab */}
      {activeTab === 'b2c' && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Invoice No.</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Place of Supply</TableCell>
                <TableCell align="right">GST Rate</TableCell>
                <TableCell align="right">Taxable Value</TableCell>
                <TableCell align="right">CGST</TableCell>
                <TableCell align="right">SGST</TableCell>
                <TableCell align="right">IGST</TableCell>
                <TableCell align="right">Invoice Value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.b2c.invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      No B2C invoices found for this period
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data.b2c.invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.invoiceNumber}</TableCell>
                    <TableCell>{formatDate(inv.invoiceDate)}</TableCell>
                    <TableCell>{inv.placeOfSupply || 'N/A'}</TableCell>
                    <TableCell align="right">{inv.gstRate}%</TableCell>
                    <TableCell align="right">{formatCurrency(inv.taxableValue)}</TableCell>
                    <TableCell align="right">{formatCurrency(inv.cgst)}</TableCell>
                    <TableCell align="right">{formatCurrency(inv.sgst)}</TableCell>
                    <TableCell align="right">{formatCurrency(inv.igst)}</TableCell>
                    <TableCell align="right">
                      <strong>{formatCurrency(inv.invoiceValue)}</strong>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* HSN Summary Tab */}
      {activeTab === 'hsn' && (
        <>
          <Alert severity="info" sx={{ mb: 2 }}>
            HSN-wise summary of outward supplies as required by GSTR-1. This section consolidates
            all invoices by HSN code.
          </Alert>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>HSN Code</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">UQC</TableCell>
                  <TableCell align="right">Total Qty</TableCell>
                  <TableCell align="right">Taxable Value</TableCell>
                  <TableCell align="right">CGST</TableCell>
                  <TableCell align="right">SGST</TableCell>
                  <TableCell align="right">IGST</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.hsnSummary.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                        No HSN data available
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.hsnSummary.map((hsn, index) => (
                    <TableRow key={index}>
                      <TableCell>{hsn.hsnCode}</TableCell>
                      <TableCell>{hsn.description}</TableCell>
                      <TableCell align="right">{hsn.uqc}</TableCell>
                      <TableCell align="right">{hsn.totalQuantity.toFixed(2)}</TableCell>
                      <TableCell align="right">{formatCurrency(hsn.taxableValue)}</TableCell>
                      <TableCell align="right">{formatCurrency(hsn.cgst)}</TableCell>
                      <TableCell align="right">{formatCurrency(hsn.sgst)}</TableCell>
                      <TableCell align="right">{formatCurrency(hsn.igst)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Paper>
  );
}
