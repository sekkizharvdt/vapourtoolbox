'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import {
  Typography,
  Box,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Grid,
  Card,
  CardContent,
  Alert,
  Chip,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { canViewAccounting, canManageAccounting } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
// Lazy load chart components to reduce initial bundle size
const ExchangeRateTrendChart = lazy(
  () => import('@/components/accounting/currency/ExchangeRateTrendChart')
);
import BankSettlementAnalysis from '@/components/accounting/currency/BankSettlementAnalysis';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  onSnapshot,
  orderBy,
  limit,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { COLLECTIONS } from '@vapour/firebase';
import type {
  CurrencyCode,
  ExchangeRate,
  CurrencyConfiguration,
  BaseTransaction,
} from '@vapour/types';
import { formatDate } from '@/lib/utils/formatters';

// Currency display information
const CURRENCY_INFO: Record<CurrencyCode, { name: string; symbol: string; flag: string }> = {
  INR: { name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  USD: { name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  EUR: { name: 'Euro', symbol: '€', flag: '🇪🇺' },
  GBP: { name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  SGD: { name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬' },
  AED: { name: 'UAE Dirham', symbol: 'AED', flag: '🇦🇪' },
};

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`currency-tabpanel-${index}`}
      aria-labelledby={`currency-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function CurrencyForexPage() {
  const { claims, user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([]);
  const [currencyConfig, setCurrencyConfig] = useState<CurrencyConfiguration[]>([]);
  const [foreignTransactions, setForeignTransactions] = useState<BaseTransaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [bankRates, setBankRates] = useState<
    Partial<Record<CurrencyCode, { rate: number; date: Date }>>
  >({});
  const [baseCurrency] = useState<CurrencyCode>('INR');
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const hasViewAccess = claims?.permissions ? canViewAccounting(claims.permissions) : false;
  const hasCreateAccess = claims?.permissions ? canManageAccounting(claims.permissions) : false;

  // Function to fetch rates from API via Cloud Function
  const fetchExchangeRates = async () => {
    if (!hasCreateAccess || !user) return;

    setRefreshing(true);
    setError('');
    setSuccess('');

    try {
      const functions = getFunctions();
      const manualFetchRates = httpsCallable(functions, 'manualFetchExchangeRates');

      await manualFetchRates();
      setLastRefresh(new Date());
      setSuccess('Successfully refreshed exchange rates from ExchangeRate-API');
    } catch (err: unknown) {
      console.error('[Currency] Error fetching rates:', err);

      let errorMessage = 'Failed to fetch exchange rates';
      const error = err as { code?: string; message?: string };
      if (error?.code === 'permission-denied') {
        errorMessage = 'You do not have permission to refresh exchange rates';
      } else if (error?.code === 'failed-precondition') {
        errorMessage =
          'ExchangeRate API key not configured on server. Please contact administrator.';
      } else if (error?.code === 'unavailable') {
        errorMessage = 'ExchangeRate API is unavailable. Please try again later.';
      } else if (error?.message) {
        errorMessage = error.message;
      }

      setError(errorMessage);
    } finally {
      setRefreshing(false);
    }
  };

  // Load exchange rates
  useEffect(() => {
    if (!hasViewAccess) return;

    const { db } = getFirebase();
    const q = query(
      collection(db, COLLECTIONS.EXCHANGE_RATES),
      where('status', '==', 'ACTIVE'),
      orderBy('effectiveFrom', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rates = snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as unknown as ExchangeRate
      );
      setExchangeRates(rates);

      // Update last refresh time from most recent rate
      if (rates.length > 0 && rates[0]?.effectiveFrom) {
        const mostRecent = rates[0]?.effectiveFrom;
        if (mostRecent instanceof Timestamp) {
          setLastRefresh(mostRecent.toDate());
        }
      }
    });

    return () => unsubscribe();
  }, [hasViewAccess]);

  // Clear success message after 5 seconds
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(''), 5000);
    return () => clearTimeout(timer);
  }, [success]);

  // Clear error message after 10 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 10000);
    return () => clearTimeout(timer);
  }, [error]);

  // Query last bank settlement rates from transactions
  useEffect(() => {
    if (!hasViewAccess || tabValue !== 0) return;

    const { db } = getFirebase();

    // Query for each foreign currency to find last bank settlement
    const fetchBankRates = async () => {
      const foreignCurrencies: CurrencyCode[] = ['USD', 'EUR', 'SGD'];
      const bankRatesData: Partial<Record<CurrencyCode, { rate: number; date: Date }>> = {};

      for (const currency of foreignCurrencies) {
        try {
          const q = query(
            collection(db, COLLECTIONS.TRANSACTIONS),
            where('currency', '==', currency),
            where('bankSettlementRate', '!=', null),
            orderBy('bankSettlementRate'),
            orderBy('bankSettlementDate', 'desc'),
            limit(1)
          );

          const snapshot = await getDocs(q);
          if (!snapshot.empty && snapshot.docs[0]) {
            const txn = snapshot.docs[0]?.data() as BaseTransaction;
            if (txn?.bankSettlementRate && txn?.bankSettlementDate) {
              bankRatesData[currency] = {
                rate: txn.bankSettlementRate,
                date:
                  txn.bankSettlementDate instanceof Timestamp
                    ? txn.bankSettlementDate.toDate()
                    : new Date(txn.bankSettlementDate),
              };
            }
          }
        } catch (error) {
          console.error(`[Currency] Error fetching bank rate for ${currency}:`, error);
        }
      }

      setBankRates(bankRatesData);
    };

    fetchBankRates();
  }, [hasViewAccess, tabValue]);

  // Load foreign currency transactions for bank settlement analysis
  useEffect(() => {
    if (!hasViewAccess || tabValue !== 1) return;

    const { db } = getFirebase();
    const q = query(
      collection(db, COLLECTIONS.TRANSACTIONS),
      where('currency', '!=', baseCurrency),
      orderBy('currency'),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txns = snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as unknown as BaseTransaction
      );
      setForeignTransactions(txns);
    });

    return () => unsubscribe();
  }, [hasViewAccess, tabValue, baseCurrency]);

  // Load currency configuration
  useEffect(() => {
    if (!hasViewAccess || tabValue !== 2) return;

    const { db } = getFirebase();
    const q = query(collection(db, COLLECTIONS.CURRENCY_CONFIG));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const configs = snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as unknown as CurrencyConfiguration
      );
      setCurrencyConfig(configs);
    });

    return () => unsubscribe();
  }, [hasViewAccess, tabValue]);

  const formatRate = (rate: number) => {
    return rate.toFixed(4);
  };

  const getTimeAgo = (date: Date | null): string => {
    if (!date) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const isRateStale = (date: Date | null): 'fresh' | 'stale' | 'very-stale' => {
    if (!date) return 'very-stale';
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    if (diffHours <= 24) return 'fresh';
    if (diffHours <= 48) return 'stale';
    return 'very-stale';
  };

  if (!hasViewAccess) {
    return (
      <>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Currency &amp; Forex Management
          </Typography>
          <Alert severity="error">
            You do not have permission to access currency and forex management.
          </Alert>
        </Box>
      </>
    );
  }

  return (
    <>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Currency &amp; Forex Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Monitor exchange rates and analyze bank settlement margins
        </Typography>
      </Box>

      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Exchange Rates" />
          <Tab label="Bank Settlement" />
          <Tab label="Settings" />
        </Tabs>

        {/* Exchange Rates Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box
            sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          >
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
                  onClick={fetchExchangeRates}
                  disabled={refreshing}
                >
                  {refreshing ? 'Fetching...' : 'Refresh Rates'}
                </Button>
              )}
            </Box>
          </Box>

          {/* Success Message */}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
              {success}
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
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
              Exchange rates are more than 48 hours old. Please refresh immediately for accurate
              rates.
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
                {(() => {
                  // Group rates by currency (showing foreign currency to INR)
                  const foreignCurrencies: CurrencyCode[] = ['USD', 'EUR', 'SGD'];
                  const latestRates = new Map<CurrencyCode, ExchangeRate>();

                  exchangeRates.forEach((rate) => {
                    if (
                      rate.toCurrency === 'INR' &&
                      foreignCurrencies.includes(rate.fromCurrency)
                    ) {
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

                  return foreignCurrencies.map((currency) => {
                    const apiRate = latestRates.get(currency);
                    const bankRate = bankRates[currency];
                    const difference =
                      apiRate && bankRate
                        ? ((bankRate.rate - apiRate.rate) / apiRate.rate) * 100
                        : 0;

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
                              ) === 'fresh' && (
                                <Chip label="✓ Fresh" color="success" size="small" />
                              )}
                              {isRateStale(
                                apiRate.effectiveFrom instanceof Timestamp
                                  ? apiRate.effectiveFrom.toDate()
                                  : null
                              ) === 'stale' && (
                                <Chip label="⚠ Stale" color="warning" size="small" />
                              )}
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
                  });
                })()}
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
                  <strong>Current Rate:</strong> How many rupees (₹) you get/pay for 1 unit of
                  foreign currency (e.g., 1 USD = ₹83.33)
                </li>
                <li>
                  <strong>Last Bank Rate:</strong> The actual rate used by your bank in the most
                  recent transaction
                </li>
                <li>
                  <strong>Difference:</strong> How much the bank rate differs from the API rate
                  (positive = bank charged more)
                </li>
                <li>
                  <strong>Status:</strong> ✓ Fresh (&lt;24h) | ⚠ Stale (&lt;48h) | ⚠ Very Old
                  (&gt;48h)
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
        </TabPanel>

        {/* Bank Settlement Tab */}
        <TabPanel value={tabValue} index={1}>
          <BankSettlementAnalysis transactions={foreignTransactions} baseCurrency={baseCurrency} />
        </TabPanel>

        {/* Settings Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Currency Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage active currencies and default settings
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {Object.entries(CURRENCY_INFO).map(([code, info]) => {
              const config = currencyConfig.find((c) => c.currency === code);
              const isActive = config?.isActive ?? (code === 'INR' || code === 'USD');
              const isBase = code === baseCurrency;

              return (
                <Grid size={{ xs: 12, md: 6 }} key={code}>
                  <Card
                    variant={isBase ? 'outlined' : 'elevation'}
                    sx={{
                      borderColor: isBase ? 'primary.main' : undefined,
                      borderWidth: isBase ? 2 : 1,
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="h3">{info.flag}</Typography>
                          <Box>
                            <Typography variant="h6">
                              {code} - {info.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Symbol: {info.symbol}
                            </Typography>
                          </Box>
                        </Box>
                        {isBase && <Chip label="Base Currency" color="primary" />}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <Chip
                          label={isActive ? 'Active' : 'Inactive'}
                          color={isActive ? 'success' : 'default'}
                          size="small"
                        />
                        {hasCreateAccess && !isBase && (
                          <Button size="small" variant="outlined">
                            {isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </TabPanel>
      </Paper>
    </>
  );
}
