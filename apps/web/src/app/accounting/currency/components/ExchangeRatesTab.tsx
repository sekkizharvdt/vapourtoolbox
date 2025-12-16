'use client';

/**
 * Exchange Rates Tab
 *
 * Displays current exchange rates with bank comparison.
 */

import { lazy, Suspense } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { Timestamp } from 'firebase/firestore';
import type { CurrencyCode, ExchangeRate } from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';
import {
  CURRENCY_INFO,
  formatRate,
  getTimeAgo,
  isRateStale,
  type ExchangeRatesTabProps,
} from './types';

// Lazy load chart components to reduce initial bundle size
const ExchangeRateTrendChart = lazy(
  () => import('@/components/accounting/currency/ExchangeRateTrendChart')
);

export function ExchangeRatesTab({
  exchangeRates,
  bankRates,
  lastRefresh,
  refreshing,
  hasCreateAccess,
  onRefresh,
  error,
  success,
  onClearError,
  onClearSuccess,
  baseCurrency,
}: ExchangeRatesTabProps) {
  const foreignCurrencies: CurrencyCode[] = ['USD', 'EUR', 'SGD'];

  // Group rates by currency (showing foreign currency to INR)
  const latestRates = new Map<CurrencyCode, ExchangeRate>();
  exchangeRates.forEach((rate) => {
    if (rate.toCurrency === 'INR' && foreignCurrencies.includes(rate.fromCurrency)) {
      if (
        !latestRates.has(rate.fromCurrency) ||
        (rate.effectiveFrom &&
          latestRates.get(rate.fromCurrency)?.effectiveFrom &&
          rate.effectiveFrom > latestRates.get(rate.fromCurrency)!.effectiveFrom!)
      ) {
        latestRates.set(rate.fromCurrency, rate);
      }
    }
  });

  return (
    <>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6">Active Exchange Rates</Typography>
          <Typography variant="body2" color="text.secondary">
            Last updated: {getTimeAgo(lastRefresh)}
          </Typography>
        </Box>
        <Box>
          {hasCreateAccess && (
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={onRefresh}
              disabled={refreshing}
            >
              {refreshing ? 'Fetching...' : 'Refresh Rates'}
            </Button>
          )}
        </Box>
      </Box>

      {/* Success Message */}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={onClearSuccess}>
          {success}
        </Alert>
      )}

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={onClearError}>
          {error}
        </Alert>
      )}

      {/* Age Warning */}
      {isRateStale(lastRefresh) === 'stale' && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Exchange rates are more than 24 hours old. Consider refreshing for the latest rates.
        </Alert>
      )}
      {isRateStale(lastRefresh) === 'very-stale' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Exchange rates are more than 48 hours old. Please refresh immediately for accurate rates.
        </Alert>
      )}

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Currency</TableCell>
              <TableCell align="right">Current Rate (₹ per unit)</TableCell>
              <TableCell>Last Refreshed</TableCell>
              <TableCell align="right">Last Bank Rate</TableCell>
              <TableCell align="right">Difference</TableCell>
              <TableCell align="center">Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {foreignCurrencies.map((currency) => {
              const apiRate = latestRates.get(currency);
              const bankRate = bankRates[currency];
              const difference =
                apiRate && bankRate ? ((bankRate.rate - apiRate.rate) / apiRate.rate) * 100 : 0;

              return (
                <TableRow key={currency}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>{CURRENCY_INFO[currency].flag}</span>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {currency}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {CURRENCY_INFO[currency].name}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    {apiRate ? (
                      <Typography variant="body2" fontWeight="medium">
                        {formatRate(apiRate.rate)}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        -
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {apiRate?.effectiveFrom ? (
                      <Typography variant="body2" color="text.secondary">
                        {apiRate.effectiveFrom instanceof Timestamp
                          ? getTimeAgo(apiRate.effectiveFrom.toDate())
                          : 'N/A'}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        -
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {bankRate ? (
                      <Box>
                        <Typography variant="body2">{formatRate(bankRate.rate)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(bankRate.date)}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No data
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {apiRate && bankRate ? (
                      <Typography
                        variant="body2"
                        color={
                          difference > 0
                            ? 'error.main'
                            : difference < 0
                              ? 'success.main'
                              : 'text.secondary'
                        }
                        fontWeight="medium"
                      >
                        {difference > 0 ? '+' : ''}
                        {difference.toFixed(2)}%
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        -
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {apiRate ? (
                      <>
                        {isRateStale(
                          apiRate.effectiveFrom instanceof Timestamp
                            ? apiRate.effectiveFrom.toDate()
                            : null
                        ) === 'fresh' && <Chip label="✓ Fresh" color="success" size="small" />}
                        {isRateStale(
                          apiRate.effectiveFrom instanceof Timestamp
                            ? apiRate.effectiveFrom.toDate()
                            : null
                        ) === 'stale' && <Chip label="⚠ Stale" color="warning" size="small" />}
                        {isRateStale(
                          apiRate.effectiveFrom instanceof Timestamp
                            ? apiRate.effectiveFrom.toDate()
                            : null
                        ) === 'very-stale' && (
                          <Chip label="⚠ Very Old" color="error" size="small" />
                        )}
                      </>
                    ) : (
                      <Chip label="No Data" color="default" size="small" />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Help Text */}
      <Alert severity="info" sx={{ mt: 2 }}>
        <Typography variant="body2" gutterBottom>
          <strong>Understanding the data:</strong>
        </Typography>
        <Typography variant="body2" component="div">
          <ul style={{ marginTop: 4, paddingLeft: 20, marginBottom: 0 }}>
            <li>
              <strong>Current Rate:</strong> How many rupees (₹) you get/pay for 1 unit of foreign
              currency (e.g., 1 USD = ₹83.33)
            </li>
            <li>
              <strong>Last Bank Rate:</strong> The actual rate used by your bank in the most recent
              transaction
            </li>
            <li>
              <strong>Difference:</strong> How much the bank rate differs from the API rate
              (positive = bank charged more)
            </li>
            <li>
              <strong>Status:</strong> ✓ Fresh (&lt;24h) | ⚠ Stale (&lt;48h) | ⚠ Very Old (&gt;48h)
            </li>
          </ul>
        </Typography>
      </Alert>

      {/* Visual Divider */}
      <Box sx={{ my: 4, borderTop: 1, borderColor: 'divider' }} />

      {/* Exchange Rate Trends */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Historical Trends
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Track exchange rate movements over time to identify patterns
        </Typography>
        <Suspense
          fallback={
            <Box
              sx={{
                height: 300,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Loading chart...
            </Box>
          }
        >
          <ExchangeRateTrendChart rates={exchangeRates} baseCurrency={baseCurrency} />
        </Suspense>
      </Box>
    </>
  );
}
