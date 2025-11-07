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
} from '@mui/material';
import { Grid } from '@mui/material';
import { FileDownload as DownloadIcon, Print as PrintIcon } from '@mui/icons-material';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import type { GSTR3BData } from '@/lib/accounting/gstReportGenerator';
import { exportGSTR3BToJSON } from '@/lib/accounting/gstReportGenerator';

interface GSTR3BReportProps {
  data: GSTR3BData;
}

export function GSTR3BReport({ data }: GSTR3BReportProps) {
  const handleExportJSON = () => {
    const json = exportGSTR3BToJSON(data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GSTR3B_${data.period.month}_${data.period.year}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const isPayable = data.gstPayable.total > 0;

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h5">GSTR-3B: Monthly Summary Return</Typography>
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
        GSTR-3B is a monthly summary return showing total outward supplies, input tax credit (ITC)
        claimed, and net GST payable. This return must be filed by the 20th of the following month.
      </Alert>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ bgcolor: 'info.light', height: '100%' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Outward Supplies (Sales)
              </Typography>
              <Typography variant="h5">
                {formatCurrency(data.outwardSupplies.taxableValue)}
              </Typography>
              <Chip
                label={`GST: ${formatCurrency(data.outwardSupplies.total)}`}
                size="small"
                color="info"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ bgcolor: 'success.light', height: '100%' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Inward Supplies (Purchases)
              </Typography>
              <Typography variant="h5">
                {formatCurrency(data.inwardSupplies.taxableValue)}
              </Typography>
              <Chip
                label={`ITC: ${formatCurrency(data.inwardSupplies.total)}`}
                size="small"
                color="success"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ bgcolor: 'warning.light', height: '100%' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Net ITC Available
              </Typography>
              <Typography variant="h5">{formatCurrency(data.netITC.total)}</Typography>
              <Chip
                label="Claimed as credit"
                size="small"
                color="success"
                variant="outlined"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card
            sx={{
              bgcolor: isPayable ? 'error.light' : 'success.light',
              height: '100%',
            }}
          >
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Net GST {isPayable ? 'Payable' : 'Refundable'}
              </Typography>
              <Typography variant="h5" color={isPayable ? 'error.main' : 'success.main'}>
                {formatCurrency(Math.abs(data.gstPayable.total))}
              </Typography>
              <Chip
                label={isPayable ? 'To be paid' : 'Refund due'}
                size="small"
                color={isPayable ? 'error' : 'success'}
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main GSTR-3B Table */}
      <Typography variant="h6" sx={{ mb: 2 }}>
        Tax Liability & ITC Details
      </Typography>
      <TableContainer sx={{ mb: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <strong>Particulars</strong>
              </TableCell>
              <TableCell align="right">
                <strong>CGST</strong>
              </TableCell>
              <TableCell align="right">
                <strong>SGST</strong>
              </TableCell>
              <TableCell align="right">
                <strong>IGST</strong>
              </TableCell>
              <TableCell align="right">
                <strong>Cess</strong>
              </TableCell>
              <TableCell align="right">
                <strong>Total</strong>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {/* Outward Supplies */}
            <TableRow sx={{ bgcolor: 'info.lighter' }}>
              <TableCell colSpan={6}>
                <Typography variant="subtitle2">3.1 Tax on Outward Supplies</Typography>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ pl: 4 }}>Output Tax Liability</TableCell>
              <TableCell align="right">{formatCurrency(data.outwardSupplies.cgst)}</TableCell>
              <TableCell align="right">{formatCurrency(data.outwardSupplies.sgst)}</TableCell>
              <TableCell align="right">{formatCurrency(data.outwardSupplies.igst)}</TableCell>
              <TableCell align="right">{formatCurrency(data.outwardSupplies.cess)}</TableCell>
              <TableCell align="right">
                <strong>{formatCurrency(data.outwardSupplies.total)}</strong>
              </TableCell>
            </TableRow>

            {/* ITC Available */}
            <TableRow sx={{ bgcolor: 'success.lighter' }}>
              <TableCell colSpan={6}>
                <Typography variant="subtitle2">4. ITC Available (Input Tax Credit)</Typography>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ pl: 4 }}>ITC Available</TableCell>
              <TableCell align="right">{formatCurrency(data.itcAvailable.cgst)}</TableCell>
              <TableCell align="right">{formatCurrency(data.itcAvailable.sgst)}</TableCell>
              <TableCell align="right">{formatCurrency(data.itcAvailable.igst)}</TableCell>
              <TableCell align="right">{formatCurrency(data.itcAvailable.cess)}</TableCell>
              <TableCell align="right">
                <strong>{formatCurrency(data.itcAvailable.total)}</strong>
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ pl: 4 }}>Less: ITC Reversed</TableCell>
              <TableCell align="right">({formatCurrency(data.itcReversed.cgst)})</TableCell>
              <TableCell align="right">({formatCurrency(data.itcReversed.sgst)})</TableCell>
              <TableCell align="right">({formatCurrency(data.itcReversed.igst)})</TableCell>
              <TableCell align="right">({formatCurrency(data.itcReversed.cess)})</TableCell>
              <TableCell align="right">({formatCurrency(data.itcReversed.total)})</TableCell>
            </TableRow>
            <TableRow>
              <TableCell sx={{ pl: 4 }}>
                <strong>Net ITC</strong>
              </TableCell>
              <TableCell align="right">
                <strong>{formatCurrency(data.netITC.cgst)}</strong>
              </TableCell>
              <TableCell align="right">
                <strong>{formatCurrency(data.netITC.sgst)}</strong>
              </TableCell>
              <TableCell align="right">
                <strong>{formatCurrency(data.netITC.igst)}</strong>
              </TableCell>
              <TableCell align="right">
                <strong>{formatCurrency(data.netITC.cess)}</strong>
              </TableCell>
              <TableCell align="right">
                <strong>{formatCurrency(data.netITC.total)}</strong>
              </TableCell>
            </TableRow>

            {/* Interest */}
            {data.interestLatePayment.total > 0 && (
              <>
                <TableRow sx={{ bgcolor: 'warning.lighter' }}>
                  <TableCell colSpan={6}>
                    <Typography variant="subtitle2">5. Interest for Late Payment of Tax</Typography>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ pl: 4 }}>Interest Amount</TableCell>
                  <TableCell align="right">
                    {formatCurrency(data.interestLatePayment.cgst)}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(data.interestLatePayment.sgst)}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(data.interestLatePayment.igst)}
                  </TableCell>
                  <TableCell align="right">
                    {formatCurrency(data.interestLatePayment.cess)}
                  </TableCell>
                  <TableCell align="right">
                    <strong>{formatCurrency(data.interestLatePayment.total)}</strong>
                  </TableCell>
                </TableRow>
              </>
            )}

            {/* Net Payable */}
            <TableRow sx={{ bgcolor: isPayable ? 'error.lighter' : 'success.lighter' }}>
              <TableCell>
                <Typography variant="h6">Net GST {isPayable ? 'Payable' : 'Refundable'}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {isPayable
                    ? 'To be paid to the government'
                    : 'Refund to be claimed from the government'}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="h6" color={isPayable ? 'error.main' : 'success.main'}>
                  {formatCurrency(Math.abs(data.gstPayable.cgst))}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="h6" color={isPayable ? 'error.main' : 'success.main'}>
                  {formatCurrency(Math.abs(data.gstPayable.sgst))}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="h6" color={isPayable ? 'error.main' : 'success.main'}>
                  {formatCurrency(Math.abs(data.gstPayable.igst))}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="h6" color={isPayable ? 'error.main' : 'success.main'}>
                  {formatCurrency(Math.abs(data.gstPayable.cess))}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography variant="h6" color={isPayable ? 'error.main' : 'success.main'}>
                  {formatCurrency(Math.abs(data.gstPayable.total))}
                </Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {/* Additional Info */}
      <Alert severity="warning" sx={{ mt: 3 }}>
        <Typography variant="body2" gutterBottom>
          <strong>Important Notes:</strong>
        </Typography>
        <Typography variant="body2" component="div">
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li>GSTR-3B must be filed by the 20th of the following month</li>
            <li>Late filing attracts interest @ 18% per annum</li>
            <li>Ensure all invoices are POSTED or APPROVED status</li>
            <li>ITC can only be claimed on eligible purchases</li>
            <li>Interest for late payment should be calculated separately if applicable</li>
          </ul>
        </Typography>
      </Alert>
    </Paper>
  );
}
