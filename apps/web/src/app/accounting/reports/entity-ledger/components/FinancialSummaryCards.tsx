'use client';

import { Box, Typography, Grid, Card, CardContent, Paper } from '@mui/material';
import {
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  AccountBalance as AccountBalanceIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  PlayArrow as OpeningIcon,
  Stop as ClosingIcon,
} from '@mui/icons-material';
import { formatCurrency } from '@/lib/utils/formatters';
import type { FinancialSummary } from './types';

interface FinancialSummaryCardsProps {
  summary: FinancialSummary;
  isCustomer: boolean;
  isVendor: boolean;
  /** Primary transaction currency for display context */
  currency: string;
}

export function FinancialSummaryCards({
  summary,
  isCustomer,
  isVendor,
  currency,
}: FinancialSummaryCardsProps) {
  return (
    <>
      {/* Opening and Closing Balance Card */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <OpeningIcon color="primary" />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Opening Balance
                </Typography>
                <Typography
                  variant="h6"
                  fontWeight="bold"
                  color={summary.openingBalance >= 0 ? 'success.main' : 'error.main'}
                >
                  {formatCurrency(Math.abs(summary.openingBalance), currency)}
                  {summary.openingBalance !== 0 && (
                    <Typography component="span" variant="caption" sx={{ ml: 0.5 }}>
                      {summary.openingBalance > 0 ? '(Receivable)' : '(Payable)'}
                    </Typography>
                  )}
                </Typography>
              </Box>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Period Movement
              </Typography>
              <Typography variant="h6" fontWeight="medium">
                {formatCurrency(summary.closingBalance - summary.openingBalance, currency)}
              </Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" color="text.secondary">
                  Closing Balance
                </Typography>
                <Typography
                  variant="h6"
                  fontWeight="bold"
                  color={summary.closingBalance >= 0 ? 'success.main' : 'error.main'}
                >
                  {formatCurrency(Math.abs(summary.closingBalance), currency)}
                  {summary.closingBalance !== 0 && (
                    <Typography component="span" variant="caption" sx={{ ml: 0.5 }}>
                      {summary.closingBalance > 0 ? '(Receivable)' : '(Payable)'}
                    </Typography>
                  )}
                </Typography>
              </Box>
              <ClosingIcon color="secondary" />
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {isCustomer && (
          <>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <ReceiptIcon color="primary" />
                    <Typography variant="body2" color="text.secondary">
                      Total Invoiced
                    </Typography>
                  </Box>
                  <Typography variant="h5" fontWeight="bold">
                    {formatCurrency(summary.totalInvoiced, currency)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <PaymentIcon color="success" />
                    <Typography variant="body2" color="text.secondary">
                      Total Received
                    </Typography>
                  </Box>
                  <Typography variant="h5" fontWeight="bold" color="success.main">
                    {formatCurrency(summary.totalReceived, currency)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <TrendingUpIcon color="warning" />
                    <Typography variant="body2" color="text.secondary">
                      Outstanding Receivable
                    </Typography>
                  </Box>
                  <Typography variant="h5" fontWeight="bold" color="warning.main">
                    {formatCurrency(summary.outstandingReceivable, currency)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card
                sx={{
                  bgcolor: summary.overdueReceivable > 0 ? 'error.50' : undefined,
                }}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <AccountBalanceIcon color="error" />
                    <Typography variant="body2" color="text.secondary">
                      Overdue
                    </Typography>
                  </Box>
                  <Typography variant="h5" fontWeight="bold" color="error.main">
                    {formatCurrency(summary.overdueReceivable, currency)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </>
        )}

        {isVendor && (
          <>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <ReceiptIcon color="warning" />
                    <Typography variant="body2" color="text.secondary">
                      Total Billed
                    </Typography>
                  </Box>
                  <Typography variant="h5" fontWeight="bold">
                    {formatCurrency(summary.totalBilled, currency)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <PaymentIcon color="info" />
                    <Typography variant="body2" color="text.secondary">
                      Total Paid
                    </Typography>
                  </Box>
                  <Typography variant="h5" fontWeight="bold" color="info.main">
                    {formatCurrency(summary.totalPaid, currency)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <TrendingDownIcon color="warning" />
                    <Typography variant="body2" color="text.secondary">
                      Outstanding Payable
                    </Typography>
                  </Box>
                  <Typography variant="h5" fontWeight="bold" color="warning.main">
                    {formatCurrency(summary.outstandingPayable, currency)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ bgcolor: summary.overduePayable > 0 ? 'error.50' : undefined }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <AccountBalanceIcon color="error" />
                    <Typography variant="body2" color="text.secondary">
                      Overdue
                    </Typography>
                  </Box>
                  <Typography variant="h5" fontWeight="bold" color="error.main">
                    {formatCurrency(summary.overduePayable, currency)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </>
        )}
      </Grid>
    </>
  );
}
