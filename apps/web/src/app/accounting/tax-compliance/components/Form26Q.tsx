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
  Tabs,
  Tab,
} from '@mui/material';
import { Grid } from '@mui/material';
import { FileDownload as DownloadIcon, Print as PrintIcon } from '@mui/icons-material';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import type { Form26QData } from '@/lib/accounting/tdsReportGenerator';
import { exportForm26QToJSON } from '@/lib/accounting/tdsReportGenerator';

interface Form26QProps {
  data: Form26QData;
}

export function Form26Q({ data }: Form26QProps) {
  const [tabValue, setTabValue] = React.useState(0);

  const handleExportJSON = () => {
    const json = exportForm26QToJSON(data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Form26Q_Q${data.quarter}_${data.financialYear.replace('-', '')}.json`;
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
          <Typography variant="h5">Form 26Q: Quarterly TDS Return</Typography>
          <Typography variant="body2" color="text.secondary">
            Quarter {data.quarter}, FY {data.financialYear} (AY {data.assessmentYear})
          </Typography>
          <Typography variant="body2" color="text.secondary">
            TAN: {data.deductor.tan}
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
        Form 26Q is a quarterly statement of TDS on payments other than salary. This return must be
        filed with the Income Tax Department by the specified due date. After filing, TDS
        certificates (Form 16A) should be issued to deductees.
      </Alert>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ bgcolor: 'info.light', height: '100%' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Total Payments
              </Typography>
              <Typography variant="h5">{formatCurrency(data.summary.totalPayment)}</Typography>
              <Chip
                label={`${data.summary.totalTransactions} transaction${data.summary.totalTransactions > 1 ? 's' : ''}`}
                size="small"
                color="info"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ bgcolor: 'warning.light', height: '100%' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Total TDS Deducted
              </Typography>
              <Typography variant="h5">{formatCurrency(data.summary.totalTDS)}</Typography>
              <Chip
                label={`${((data.summary.totalTDS / data.summary.totalPayment) * 100).toFixed(2)}% avg rate`}
                size="small"
                color="warning"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ bgcolor: 'success.light', height: '100%' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Total Deductees
              </Typography>
              <Typography variant="h5">{data.summary.totalDeductees}</Typography>
              <Chip label="Unique vendors" size="small" color="success" sx={{ mt: 1 }} />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ bgcolor: 'secondary.light', height: '100%' }}>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Challans Deposited
              </Typography>
              <Typography variant="h5">{data.challanSummary.length}</Typography>
              <Chip label="Tax payments" size="small" color="secondary" sx={{ mt: 1 }} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Deductor Details */}
      <Typography variant="h6" sx={{ mb: 2 }}>
        Details of Deductor
      </Typography>
      <TableContainer sx={{ mb: 3 }}>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', width: '30%' }}>Name</TableCell>
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
              <TableCell>{data.deductor.address}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {/* Tabs for different views */}
      <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ mb: 3 }}>
        <Tab label="Summary by Section" />
        <Tab label="All Transactions" />
        <Tab label="Challan Summary" />
      </Tabs>

      {/* Tab 1: Summary by Section */}
      {tabValue === 0 && (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            TDS Summary by Section
          </Typography>
          <TableContainer sx={{ mb: 3 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <strong>Section</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Nature of Payment</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>Transactions</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>Total Payment</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>TDS Deducted</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>Effective Rate</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.summary.bySectionSummary.map((section) => (
                  <TableRow key={section.section}>
                    <TableCell>
                      <Chip label={section.section} size="small" color="primary" />
                    </TableCell>
                    <TableCell>{section.description}</TableCell>
                    <TableCell align="right">{section.transactionCount}</TableCell>
                    <TableCell align="right">{formatCurrency(section.paymentAmount)}</TableCell>
                    <TableCell align="right">{formatCurrency(section.tdsAmount)}</TableCell>
                    <TableCell align="right">
                      {((section.tdsAmount / section.paymentAmount) * 100).toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ bgcolor: 'grey.100' }}>
                  <TableCell colSpan={3}>
                    <strong>Total</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>{formatCurrency(data.summary.totalPayment)}</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>{formatCurrency(data.summary.totalTDS)}</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>
                      {((data.summary.totalTDS / data.summary.totalPayment) * 100).toFixed(2)}%
                    </strong>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* Tab 2: All Transactions */}
      {tabValue === 1 && (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            All TDS Transactions
          </Typography>
          <TableContainer sx={{ mb: 3 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>
                    <strong>Payment Date</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Deductee Name</strong>
                  </TableCell>
                  <TableCell>
                    <strong>PAN</strong>
                  </TableCell>
                  <TableCell>
                    <strong>Section</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>Payment</strong>
                  </TableCell>
                  <TableCell align="right">
                    <strong>TDS</strong>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.transactions.map((transaction, index) => (
                  <TableRow key={index}>
                    <TableCell>{transaction.paymentDate.toLocaleDateString('en-IN')}</TableCell>
                    <TableCell>{transaction.deducteeName}</TableCell>
                    <TableCell>
                      {transaction.deducteePAN || (
                        <Chip label="No PAN" size="small" color="error" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip label={transaction.tdsSection} size="small" color="primary" />
                    </TableCell>
                    <TableCell align="right">{formatCurrency(transaction.paymentAmount)}</TableCell>
                    <TableCell align="right">{formatCurrency(transaction.tdsAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* Tab 3: Challan Summary */}
      {tabValue === 2 && (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Challan Details
          </Typography>
          {data.challanSummary.length > 0 ? (
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
                      <strong>Transactions</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>TDS Deposited</strong>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.challanSummary.map((challanSummary, index) => (
                    <TableRow key={index}>
                      <TableCell>{challanSummary.challan.bsrCode}</TableCell>
                      <TableCell>{challanSummary.challan.challanSerialNumber}</TableCell>
                      <TableCell>
                        {challanSummary.challan.depositDate.toLocaleDateString('en-IN')}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={challanSummary.challan.tdsSection}
                          size="small"
                          color="secondary"
                        />
                      </TableCell>
                      <TableCell align="right">{challanSummary.transactionCount}</TableCell>
                      <TableCell align="right">{formatCurrency(challanSummary.totalTDS)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell colSpan={5}>
                      <strong>Total TDS Deposited</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>
                        {formatCurrency(
                          data.challanSummary.reduce((sum, c) => sum + c.totalTDS, 0)
                        )}
                      </strong>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="warning" sx={{ mb: 3 }}>
              No challan information available. Please add challan details to link TDS payments with
              deposited tax.
            </Alert>
          )}
        </>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Footer Notes */}
      <Alert severity="warning">
        <Typography variant="body2" gutterBottom>
          <strong>Important Notes:</strong>
        </Typography>
        <Typography variant="body2" component="div">
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li>
              Form 26Q must be filed quarterly by the following due dates:
              <ul style={{ marginTop: '4px' }}>
                <li>Q1 (Apr-Jun): 31st July</li>
                <li>Q2 (Jul-Sep): 31st October</li>
                <li>Q3 (Oct-Dec): 31st January</li>
                <li>Q4 (Jan-Mar): 31st May</li>
              </ul>
            </li>
            <li>Late filing attracts penalties as per Section 234E</li>
            <li>
              After successful filing, download Form 16A certificates for each deductee from TRACES
              portal
            </li>
            <li>Verify that all TDS deducted has been deposited via challans before filing</li>
            <li>Maintain backup of all supporting documents and challans</li>
          </ul>
        </Typography>
      </Alert>

      <Box sx={{ mt: 3, textAlign: 'right' }}>
        <Typography variant="body2" color="text.secondary">
          Return generated on: {data.generatedDate.toLocaleDateString('en-IN')}
        </Typography>
      </Box>
    </Paper>
  );
}
