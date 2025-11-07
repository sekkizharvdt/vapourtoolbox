'use client';

import { useState, useEffect } from 'react';
import {
  Container,
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
import {
  Refresh as RefreshIcon,
  TrendingUp as GainIcon,
  TrendingDown as LossIcon,
  AccountBalance as ExposureIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { canViewFinancialReports, canCreateTransactions } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import ExchangeRateTrendChart from '@/components/accounting/currency/ExchangeRateTrendChart';
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
  ForexGainLoss,
  CurrencyExposure,
  CurrencyConfiguration,
  BaseTransaction,
} from '@vapour/types';

// Currency display information
const CURRENCY_INFO: Record<CurrencyCode, { name: string; symbol: string; flag: string }> = {
  INR: { name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  USD: { name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  EUR: { name: 'Euro', symbol: '€', flag: '🇪🇺' },
  GBP: { name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  AED: { name: 'UAE Dirham', symbol: 'د.إ', flag: '🇦🇪' },
  SGD: { name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬' },
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
  const [forexGainLoss, setForexGainLoss] = useState<ForexGainLoss[]>([]);
  const [currencyExposure, setCurrencyExposure] = useState<CurrencyExposure[]>([]);
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

  const hasViewAccess = claims?.permissions ? canViewFinancialReports(claims.permissions) : false;
  const hasCreateAccess = claims?.permissions ? canCreateTransactions(claims.permissions) : false;

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
      const foreignCurrencies: CurrencyCode[] = ['USD', 'EUR', 'GBP', 'SGD', 'AED'];
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

  // Load forex gain/loss
  useEffect(() => {
    if (!hasViewAccess || tabValue !== 2) return;

    const { db } = getFirebase();
    const q = query(
      collection(db, COLLECTIONS.FOREX_GAIN_LOSS),
      orderBy('transactionDate', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as unknown as ForexGainLoss
      );
      setForexGainLoss(entries);
    });

    return () => unsubscribe();
  }, [hasViewAccess, tabValue]);

  // Calculate currency exposure
  useEffect(() => {
    if (!hasViewAccess || tabValue !== 3) return;

    async function calculateExposure() {
      const { db } = getFirebase();
      const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
      const q = query(
        transactionsRef,
        where('status', '==', 'POSTED'),
        where('currency', '!=', baseCurrency)
      );

      const snapshot = await getDocs(q);
      const exposureMap = new Map<CurrencyCode, CurrencyExposure>();

      snapshot.docs.forEach((doc) => {
        const txn = doc.data() as {
          currency?: string;
          amount?: number;
          type?: string;
          exchangeRate?: number;
        };
        const currency = txn.currency as CurrencyCode;
        const amount = txn.amount || 0;
        const rate = txn.exchangeRate || 1;

        if (!exposureMap.has(currency)) {
          exposureMap.set(currency, {
            currency,
            totalReceivables: 0,
            totalPayables: 0,
            netExposure: 0,
            currentRate: rate,
            exposureInBaseCurrency: 0,
            unrealizedGainLoss: 0,
            transactionCount: 0,
          });
        }

        const exposure = exposureMap.get(currency)!;
        exposure.transactionCount++;

        // Categorize as receivable or payable
        if (txn.type === 'CUSTOMER_INVOICE') {
          exposure.totalReceivables += amount;
        } else if (txn.type === 'VENDOR_BILL') {
          exposure.totalPayables += amount;
        }
      });

      // Calculate net exposure
      const exposures = Array.from(exposureMap.values()).map((exp) => {
        exp.netExposure = exp.totalReceivables - exp.totalPayables;
        exp.exposureInBaseCurrency = exp.netExposure * exp.currentRate;
        return exp;
      });

      setCurrencyExposure(exposures);
    }

    calculateExposure();
  }, [hasViewAccess, tabValue, baseCurrency]);

  // Load foreign currency transactions for bank settlement analysis
  useEffect(() => {
    if (!hasViewAccess || tabValue !== 4) return;

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
    if (!hasViewAccess || tabValue !== 5) return;

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

  const formatCurrency = (amount: number, currency: CurrencyCode) => {
    const info = CURRENCY_INFO[currency];
    return `${info.symbol}${amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

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
      <Container maxWidth="xl">
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Currency &amp; Forex Management
          </Typography>
          <Alert severity="error">
            You do not have permission to access currency and forex management.
          </Alert>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Currency &amp; Forex Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage exchange rates, track forex gains/losses, and monitor currency exposure
        </Typography>
      </Box>

      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={tabValue}
          onChange={(_, newValue) => setTabValue(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Exchange Rates" />
          <Tab label="Trends & Analysis" />
          <Tab label="Forex Gain/Loss" />
          <Tab label="Currency Exposure" />
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
                  <TableCell align="right">Current API Rate</TableCell>
                  <TableCell>Last Refreshed</TableCell>
                  <TableCell align="right">Last Bank Rate</TableCell>
                  <TableCell align="right">Difference</TableCell>
                  <TableCell align="center">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(() => {
                  // Group rates by currency (showing only INR to foreign currency)
                  const foreignCurrencies: CurrencyCode[] = ['USD', 'EUR', 'GBP', 'SGD', 'AED'];
                  const latestRates = new Map<CurrencyCode, ExchangeRate>();

                  exchangeRates.forEach((rate) => {
                    if (
                      rate.fromCurrency === 'INR' &&
                      foreignCurrencies.includes(rate.toCurrency)
                    ) {
                      if (
                        !latestRates.has(rate.toCurrency) ||
                        (rate.effectiveFrom &&
                          latestRates.get(rate.toCurrency)?.effectiveFrom &&
                          rate.effectiveFrom > latestRates.get(rate.toCurrency)!.effectiveFrom!)
                      ) {
                        latestRates.set(rate.toCurrency, rate);
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
                                {bankRate.date.toLocaleDateString()}
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
                  <strong>Current API Rate:</strong> Latest exchange rate from ExchangeRate-API
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
        </TabPanel>

        {/* Trends & Analysis Tab */}
        <TabPanel value={tabValue} index={1}>
          <ExchangeRateTrendChart rates={exchangeRates} baseCurrency={baseCurrency} />
        </TabPanel>

        {/* Forex Gain/Loss Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Forex Gain/Loss Report
            </Typography>

            {/* Summary Cards */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <GainIcon color="success" />
                      <Typography variant="body2" color="text.secondary">
                        Realized Gain
                      </Typography>
                    </Box>
                    <Typography variant="h5" color="success.main">
                      {formatCurrency(
                        forexGainLoss
                          .filter((f) => f.type === 'REALIZED' && f.gainLossAmount > 0)
                          .reduce((sum, f) => sum + f.gainLossAmount, 0),
                        baseCurrency
                      )}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <LossIcon color="error" />
                      <Typography variant="body2" color="text.secondary">
                        Realized Loss
                      </Typography>
                    </Box>
                    <Typography variant="h5" color="error.main">
                      {formatCurrency(
                        Math.abs(
                          forexGainLoss
                            .filter((f) => f.type === 'REALIZED' && f.gainLossAmount < 0)
                            .reduce((sum, f) => sum + f.gainLossAmount, 0)
                        ),
                        baseCurrency
                      )}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <ExposureIcon color="primary" />
                      <Typography variant="body2" color="text.secondary">
                        Net Realized Gain/Loss
                      </Typography>
                    </Box>
                    <Typography
                      variant="h5"
                      color={
                        forexGainLoss.reduce((sum, f) => sum + f.gainLossAmount, 0) >= 0
                          ? 'success.main'
                          : 'error.main'
                      }
                    >
                      {formatCurrency(
                        forexGainLoss
                          .filter((f) => f.type === 'REALIZED')
                          .reduce((sum, f) => sum + f.gainLossAmount, 0),
                        baseCurrency
                      )}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Transaction</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Currency</TableCell>
                  <TableCell align="right">Foreign Amount</TableCell>
                  <TableCell align="right">Booking Rate</TableCell>
                  <TableCell align="right">Settlement Rate</TableCell>
                  <TableCell align="right">Gain/Loss</TableCell>
                  <TableCell>Type</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {forexGainLoss.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {entry.transactionNumber}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {entry.transactionType}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {entry.transactionDate instanceof Timestamp
                        ? entry.transactionDate.toDate().toLocaleDateString()
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span>{CURRENCY_INFO[entry.foreignCurrency].flag}</span>
                        <span>{entry.foreignCurrency}</span>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(entry.foreignAmount, entry.foreignCurrency)}
                    </TableCell>
                    <TableCell align="right">{formatRate(entry.bookingRate)}</TableCell>
                    <TableCell align="right">{formatRate(entry.settlementRate)}</TableCell>
                    <TableCell align="right">
                      <Typography
                        color={entry.gainLossAmount >= 0 ? 'success.main' : 'error.main'}
                        fontWeight="medium"
                      >
                        {formatCurrency(entry.gainLossAmount, baseCurrency)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={entry.type}
                        size="small"
                        color={entry.type === 'REALIZED' ? 'success' : 'warning'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {forexGainLoss.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No forex gain/loss entries found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Currency Exposure Tab */}
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Currency Exposure Analysis
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Current exposure to foreign currencies in outstanding transactions
            </Typography>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Currency</TableCell>
                  <TableCell align="right">Total Receivables</TableCell>
                  <TableCell align="right">Total Payables</TableCell>
                  <TableCell align="right">Net Exposure</TableCell>
                  <TableCell align="right">Current Rate</TableCell>
                  <TableCell align="right">Exposure in {baseCurrency}</TableCell>
                  <TableCell align="center">Transactions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {currencyExposure.map((exposure) => (
                  <TableRow key={exposure.currency}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span>{CURRENCY_INFO[exposure.currency].flag}</span>
                        <Box>
                          <Typography variant="body2" fontWeight="medium">
                            {exposure.currency}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {CURRENCY_INFO[exposure.currency].name}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(exposure.totalReceivables, exposure.currency)}
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(exposure.totalPayables, exposure.currency)}
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        color={exposure.netExposure >= 0 ? 'success.main' : 'error.main'}
                        fontWeight="medium"
                      >
                        {formatCurrency(exposure.netExposure, exposure.currency)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">{formatRate(exposure.currentRate)}</TableCell>
                    <TableCell align="right">
                      <Typography fontWeight="medium">
                        {formatCurrency(exposure.exposureInBaseCurrency, baseCurrency)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={exposure.transactionCount} size="small" />
                    </TableCell>
                  </TableRow>
                ))}
                {currencyExposure.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No foreign currency exposure found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Bank Settlement Tab */}
        <TabPanel value={tabValue} index={4}>
          <BankSettlementAnalysis transactions={foreignTransactions} baseCurrency={baseCurrency} />
        </TabPanel>

        {/* Settings Tab */}
        <TabPanel value={tabValue} index={5}>
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
    </Container>
  );
}
