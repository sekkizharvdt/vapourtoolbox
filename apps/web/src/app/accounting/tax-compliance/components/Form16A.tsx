'use client';

import React from 'react';
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
  Chip,
  Alert,
  Divider,
} from '@mui/material';
import { Grid } from '@mui/material';
import { FileDownload as DownloadIcon, Print as PrintIcon } from '@mui/icons-material';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import type { Form16AData } from '@/lib/accounting/tdsReportGenerator';
import { exportForm16AToJSON } from '@/lib/accounting/tdsReportGenerator';

interface Form16AProps {
  data: Form16AData;
}

export function Form16A({ data }: Form16AProps) {
  const handleExportJSON = () => {
    const json = exportForm16AToJSON(data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Form16A_${data.certificateNumber.replace(/\//g, '_')}.json`;
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
          <Typography variant="h5">Form 16A: TDS Certificate</Typography>
          <Typography variant="body2" color="text.secondary">
            Certificate Number: {data.certificateNumber}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Quarter {data.quarter}, FY {data.financialYear} (AY {data.assessmentYear})
          </Typography>
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
        Form 16A is a TDS certificate issued by the deductor (payer) to the deductee (payee) for tax
        deducted at source on payments other than salary. This certificate is required for claiming
        TDS credit in income tax returns.
      </Alert>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ bgcolor: 'info.light', height: '100%' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Total Payment
              </Typography>
              <Typography variant="h5">{formatCurrency(data.summary.totalPayment)}</Typography>
              <Chip
                label={`${data.summary.transactionCount} transaction${data.summary.transactionCount > 1 ? 's' : ''}`}
                size="small"
                color="info"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ bgcolor: 'warning.light', height: '100%' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Total TDS Deducted
              </Typography>
              <Typography variant="h5">{formatCurrency(data.summary.totalTDS)}</Typography>
              <Chip
                label={`${((data.summary.totalTDS / data.summary.totalPayment) * 100).toFixed(2)}% of payment`}
                size="small"
                color="warning"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ bgcolor: 'success.light', height: '100%' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Net Payment
              </Typography>
              <Typography variant="h5">
                {formatCurrency(data.summary.totalPayment - data.summary.totalTDS)}
              </Typography>
              <Chip label="After TDS" size="small" color="success" sx={{ mt: 1 }} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Deductor Details */}
      <Typography variant="h6" sx={{ mb: 2 }}>
        Part A: Details of Deductor (Payer)
      </Typography>
      <TableContainer sx={{ mb: 3 }}>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Name of Deductor</TableCell>
              <TableCell>{data.deductor.name}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>TAN (Tax Deduction Account Number)</TableCell>
              <TableCell>{data.deductor.tan}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>PAN</TableCell>
              <TableCell>{data.deductor.pan}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Address</TableCell>
              <TableCell>
                {data.deductor.address}, {data.deductor.city}, {data.deductor.state} -{' '}
                {data.deductor.pincode}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {/* Deductee Details */}
      <Typography variant="h6" sx={{ mb: 2 }}>
        Part B: Details of Deductee (Payee)
      </Typography>
      <TableContainer sx={{ mb: 3 }}>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Name of Deductee</TableCell>
              <TableCell>{data.deductee.name}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>PAN</TableCell>
              <TableCell>{data.deductee.pan || 'Not Available'}</TableCell>
            </TableRow>
            {data.deductee.address && (
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Address</TableCell>
                <TableCell>
                  {data.deductee.address}
                  {data.deductee.city && `, ${data.deductee.city}`}
                  {data.deductee.state && `, ${data.deductee.state}`}
                  {data.deductee.pincode && ` - ${data.deductee.pincode}`}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Transaction Details */}
      <Typography variant="h6" sx={{ mb: 2 }}>
        Part C: Details of Payment and Tax Deducted
      </Typography>
      <TableContainer sx={{ mb: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <strong>Payment Date</strong>
              </TableCell>
              <TableCell>
                <strong>Section</strong>
              </TableCell>
              <TableCell>
                <strong>Nature of Payment</strong>
              </TableCell>
              <TableCell align="right">
                <strong>Amount Paid</strong>
              </TableCell>
              <TableCell align="right">
                <strong>TDS Rate</strong>
              </TableCell>
              <TableCell align="right">
                <strong>TDS Deducted</strong>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.transactions.map((transaction, index) => (
              <TableRow key={index}>
                <TableCell>{transaction.paymentDate.toLocaleDateString('en-IN')}</TableCell>
                <TableCell>
                  <Chip label={transaction.tdsSection} size="small" color="primary" />
                </TableCell>
                <TableCell>{transaction.natureOfPayment}</TableCell>
                <TableCell align="right">{formatCurrency(transaction.paymentAmount)}</TableCell>
                <TableCell align="right">{transaction.tdsRate.toFixed(2)}%</TableCell>
                <TableCell align="right">{formatCurrency(transaction.tdsAmount)}</TableCell>
              </TableRow>
            ))}
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell colSpan={3}>
                <strong>Total</strong>
              </TableCell>
              <TableCell align="right">
                <strong>{formatCurrency(data.summary.totalPayment)}</strong>
              </TableCell>
              <TableCell />
              <TableCell align="right">
                <strong>{formatCurrency(data.summary.totalTDS)}</strong>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {/* Challan Details */}
      {data.challanDetails.length > 0 && (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Part D: Details of Tax Deposited (Challan Information)
          </Typography>
          <TableContainer sx={{ mb: 3 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <strong>BSR Code</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Challan Serial Number</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Deposit Date</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Section</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>Amount Deposited</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.challanDetails.map((challan, index) => (
                  <TableRow key={index}>
                    <TableCell>{challan.bsrCode}</TableCell>
                    <TableCell>{challan.challanSerialNumber}</TableCell>
                    <TableCell>{challan.depositDate.toLocaleDateString('en-IN')}</TableCell>
                    <TableCell>
                      <Chip label={challan.tdsSection} size="small" color="secondary" />
                    </TableCell>
                    <TableCell align="right">{formatCurrency(challan.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Footer */}
      <Box sx={{ mt: 3 }}>
        <Alert severity="warning">
          <Typography variant="body2" gutterBottom>
            <strong>Important Notes:</strong>
          </Typography>
          <Typography variant="body2" component="div">
            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
              <li>This certificate is issued as per Section 203 of the Income Tax Act, 1961</li>
              <li>
                The deductee should verify the details with Form 26AS or Annual Information
                Statement (AIS)
              </li>
              <li>Keep this certificate for claiming TDS credit in your income tax return</li>
              <li>Report any discrepancies to the deductor immediately for rectification</li>
            </ul>
          </Typography>
        </Alert>

        <Box sx={{ mt: 3, textAlign: 'right' }}>
          <Typography variant="body2" color="text.secondary">
            Certificate generated on: {data.generatedDate.toLocaleDateString('en-IN')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            For {data.deductor.name}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}
