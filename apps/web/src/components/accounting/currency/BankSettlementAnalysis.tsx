'use client';

import { useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Card,
  CardContent,
  Grid,
  Alert,
} from '@mui/material';
import { CheckCircle, Cancel, Info as InfoIcon } from '@mui/icons-material';
import type { CurrencyCode, BaseTransaction } from '@vapour/types';

interface BankSettlementAnalysisProps {
  transactions: BaseTransaction[];
  baseCurrency: CurrencyCode;
}

interface SettlementSummary {
  totalTransactions: number;
  totalWithSettlement: number;
  totalForexGain: number;
  totalForexLoss: number;
  totalBankCharges: number;
  netForexGainLoss: number;
  avgRateDifference: number;
}

interface SettlementDetail {
  id: string;
  transactionNumber: string;
  date: string;
  currency: CurrencyCode;
  amount: number;
  referenceRate?: number;
  bankSettlementRate?: number;
  expectedINR: number;
  actualINR?: number;
  bankCharges?: number;
  forexGainLoss?: number;
  rateDifference?: number;
  rateDifferencePercent?: number;
}

export default function BankSettlementAnalysis({
  transactions,
  baseCurrency,
}: BankSettlementAnalysisProps) {
  // Calculate settlement details and summary
  const { details, summary } = useMemo(() => {
    const settlementDetails: SettlementDetail[] = [];
    let totalForexGain = 0;
    let totalForexLoss = 0;
    let totalBankCharges = 0;
    let totalWithSettlement = 0;
    let totalRateDifference = 0;

    transactions.forEach((txn) => {
      // Only include foreign currency transactions
      if (txn.currency === baseCurrency) return;

      const hasSettlement = !!txn.bankSettlementRate && !!txn.bankSettlementAmount;
      if (hasSettlement) totalWithSettlement++;

      const referenceRate = txn.exchangeRate || 0;
      const bankRate = txn.bankSettlementRate || referenceRate;
      const expectedINR = txn.baseAmount;
      const actualINR = txn.bankSettlementAmount || expectedINR;
      const forexGainLoss = txn.forexGainLoss || 0;
      const bankCharges = txn.bankCharges || 0;

      // Calculate rate difference
      const rateDifference = hasSettlement ? bankRate - referenceRate : undefined;
      const rateDifferencePercent =
        hasSettlement && referenceRate > 0
          ? ((rateDifference || 0) / referenceRate) * 100
          : undefined;

      if (rateDifference !== undefined) {
        totalRateDifference += Math.abs(rateDifference);
      }

      if (forexGainLoss > 0) {
        totalForexGain += forexGainLoss;
      } else if (forexGainLoss < 0) {
        totalForexLoss += Math.abs(forexGainLoss);
      }

      totalBankCharges += bankCharges;

      settlementDetails.push({
        id: txn.id,
        transactionNumber: txn.transactionNumber,
        date:
          txn.date instanceof Date
            ? txn.date.toLocaleDateString()
            : new Date(txn.date).toLocaleDateString(),
        currency: txn.currency as CurrencyCode,
        amount: txn.amount,
        referenceRate: referenceRate > 0 ? referenceRate : undefined,
        bankSettlementRate: hasSettlement ? bankRate : undefined,
        expectedINR,
        actualINR: hasSettlement ? actualINR : undefined,
        bankCharges: bankCharges > 0 ? bankCharges : undefined,
        forexGainLoss: hasSettlement ? forexGainLoss : undefined,
        rateDifference,
        rateDifferencePercent,
      });
    });

    const summaryData: SettlementSummary = {
      totalTransactions: transactions.filter((t) => t.currency !== baseCurrency).length,
      totalWithSettlement,
      totalForexGain,
      totalForexLoss,
      totalBankCharges,
      netForexGainLoss: totalForexGain - totalForexLoss,
      avgRateDifference: totalWithSettlement > 0 ? totalRateDifference / totalWithSettlement : 0,
    };

    return {
      details: settlementDetails.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
      summary: summaryData,
    };
  }, [transactions, baseCurrency]);

  const formatCurrency = (amount: number, currency: string = baseCurrency) => {
    return `${amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currency}`;
  };

  const formatRate = (rate: number) => {
    return rate.toFixed(4);
  };

  if (details.length === 0) {
    return (
      <Alert severity="info" icon={<InfoIcon />}>
        No foreign currency transactions found. This analysis shows bank settlement rates for
        foreign currency invoices and payments.
      </Alert>
    );
  }

  return (
    <Box>
      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Total Foreign Currency Transactions
              </Typography>
              <Typography variant="h4">{summary.totalTransactions}</Typography>
              <Typography variant="caption" color="text.secondary">
                {summary.totalWithSettlement} with bank settlement data
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Net Forex Gain/Loss
              </Typography>
              <Typography
                variant="h4"
                color={summary.netForexGainLoss >= 0 ? 'success.main' : 'error.main'}
              >
                {summary.netForexGainLoss >= 0 ? '+' : ''}
                {formatCurrency(summary.netForexGainLoss)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Gain: {formatCurrency(summary.totalForexGain)} | Loss:{' '}
                {formatCurrency(summary.totalForexLoss)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Total Bank Charges
              </Typography>
              <Typography variant="h4" color="error.main">
                {formatCurrency(summary.totalBankCharges)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Across all transactions
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Avg Rate Difference
              </Typography>
              <Typography variant="h4">{summary.avgRateDifference.toFixed(4)}</Typography>
              <Typography variant="caption" color="text.secondary">
                Reference vs Bank rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Transaction Details Table */}
      <Paper>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Bank Settlement Rate Comparison
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Compare reference exchange rates with actual bank settlement rates to track forex
            gains/losses
          </Typography>
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Transaction</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Foreign Amount</TableCell>
                <TableCell align="right">Reference Rate</TableCell>
                <TableCell align="right">Bank Rate</TableCell>
                <TableCell align="right">Rate Diff</TableCell>
                <TableCell align="right">Expected {baseCurrency}</TableCell>
                <TableCell align="right">Actual {baseCurrency}</TableCell>
                <TableCell align="right">Bank Charges</TableCell>
                <TableCell align="right">Forex Gain/Loss</TableCell>
                <TableCell align="center">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {details.map((detail) => (
                <TableRow key={detail.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {detail.transactionNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>{detail.date}</TableCell>
                  <TableCell align="right">
                    {formatCurrency(detail.amount, detail.currency)}
                  </TableCell>
                  <TableCell align="right">
                    {detail.referenceRate ? formatRate(detail.referenceRate) : '-'}
                  </TableCell>
                  <TableCell align="right">
                    {detail.bankSettlementRate ? (
                      <Typography fontWeight="medium">
                        {formatRate(detail.bankSettlementRate)}
                      </Typography>
                    ) : (
                      <Typography color="text.secondary">Pending</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {detail.rateDifference !== undefined ? (
                      <Typography
                        color={detail.rateDifference >= 0 ? 'success.main' : 'error.main'}
                        variant="body2"
                      >
                        {detail.rateDifference >= 0 ? '+' : ''}
                        {formatRate(detail.rateDifference)}
                        {detail.rateDifferencePercent !== undefined && (
                          <span style={{ fontSize: '0.75rem' }}>
                            {' '}
                            ({detail.rateDifferencePercent >= 0 ? '+' : ''}
                            {detail.rateDifferencePercent.toFixed(2)}%)
                          </span>
                        )}
                      </Typography>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell align="right">{formatCurrency(detail.expectedINR)}</TableCell>
                  <TableCell align="right">
                    {detail.actualINR !== undefined ? (
                      <Typography fontWeight="medium">
                        {formatCurrency(detail.actualINR)}
                      </Typography>
                    ) : (
                      <Typography color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {detail.bankCharges !== undefined && detail.bankCharges > 0 ? (
                      <Typography color="error.main">
                        {formatCurrency(detail.bankCharges)}
                      </Typography>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {detail.forexGainLoss !== undefined ? (
                      <Typography
                        fontWeight="medium"
                        color={detail.forexGainLoss >= 0 ? 'success.main' : 'error.main'}
                      >
                        {detail.forexGainLoss >= 0 ? '+' : ''}
                        {formatCurrency(detail.forexGainLoss)}
                      </Typography>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {detail.bankSettlementRate ? (
                      <Chip icon={<CheckCircle />} label="Settled" color="success" size="small" />
                    ) : (
                      <Chip icon={<Cancel />} label="Pending" color="default" size="small" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Help Text */}
      <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 2 }}>
        <Typography variant="body2" gutterBottom>
          <strong>How to use:</strong>
        </Typography>
        <Typography variant="body2" component="div">
          <ul style={{ marginTop: 4, paddingLeft: 20 }}>
            <li>
              <strong>Reference Rate:</strong> The exchange rate at the time of invoice creation
            </li>
            <li>
              <strong>Bank Rate:</strong> The actual rate used by your bank when crediting INR
            </li>
            <li>
              <strong>Rate Diff:</strong> Difference between bank rate and reference rate (positive
              = favorable)
            </li>
            <li>
              <strong>Forex Gain/Loss:</strong> Financial impact of rate difference (after bank
              charges)
            </li>
          </ul>
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          💡 <strong>Tip:</strong> Enter bank settlement details when you receive the bank credit
          statement to track actual forex performance.
        </Typography>
      </Alert>
    </Box>
  );
}
