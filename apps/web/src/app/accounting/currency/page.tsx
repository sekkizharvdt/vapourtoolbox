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
  TextField,
  Grid,
  Card,
  CardContent,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Refresh as RefreshIcon,
  TrendingUp as GainIcon,
  TrendingDown as LossIcon,
  AccountBalance as ExposureIcon,
  Edit as EditIcon,
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
  addDoc,
  Timestamp,
  onSnapshot,
  orderBy,
} from 'firebase/firestore';
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
  const [loading, setLoading] = useState(false);
  const [openAddRateDialog, setOpenAddRateDialog] = useState(false);
  const [baseCurrency] = useState<CurrencyCode>('INR');

  // Form state for adding exchange rate
  const [newRate, setNewRate] = useState({
    fromCurrency: 'USD' as CurrencyCode,
    toCurrency: 'INR' as CurrencyCode,
    rate: 0,
    effectiveFrom: new Date().toISOString().split('T')[0] || '',
  });

  const hasViewAccess = claims?.permissions ? canViewFinancialReports(claims.permissions) : false;
  const hasCreateAccess = claims?.permissions ? canCreateTransactions(claims.permissions) : false;

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
    });

    return () => unsubscribe();
  }, [hasViewAccess]);

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

  const handleAddExchangeRate = async () => {
    if (!hasCreateAccess || !user) return;

    setLoading(true);
    try {
      const { db } = getFirebase();
      const rate = parseFloat(newRate.rate.toString());
      const inverseRate = 1 / rate;

      const rateData: Omit<ExchangeRate, 'id'> = {
        fromCurrency: newRate.fromCurrency,
        toCurrency: newRate.toCurrency,
        baseCurrency,
        rate,
        inverseRate,
        effectiveFrom: Timestamp.fromDate(new Date(newRate.effectiveFrom)),
        status: 'ACTIVE',
        source: 'MANUAL',
        createdBy: user.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await addDoc(collection(db, COLLECTIONS.EXCHANGE_RATES), rateData);

      setOpenAddRateDialog(false);
      setNewRate({
        fromCurrency: 'USD',
        toCurrency: 'INR',
        rate: 0,
        effectiveFrom: new Date().toISOString().split('T')[0] || '',
      });
    } catch (error) {
      console.error('[CurrencyForex] Error adding rate:', error);
    } finally {
      setLoading(false);
    }
  };

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
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="h6">Active Exchange Rates</Typography>
            <Box>
              {hasCreateAccess && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setOpenAddRateDialog(true)}
                  sx={{ mr: 2 }}
                >
                  Add Rate
                </Button>
              )}
              <Button variant="outlined" startIcon={<RefreshIcon />}>
                Refresh Rates
              </Button>
            </Box>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>From</TableCell>
                  <TableCell>To</TableCell>
                  <TableCell align="right">Exchange Rate</TableCell>
                  <TableCell align="right">Inverse Rate</TableCell>
                  <TableCell>Effective From</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {exchangeRates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span>{CURRENCY_INFO[rate.fromCurrency].flag}</span>
                        <span>
                          {rate.fromCurrency} - {CURRENCY_INFO[rate.fromCurrency].name}
                        </span>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span>{CURRENCY_INFO[rate.toCurrency].flag}</span>
                        <span>
                          {rate.toCurrency} - {CURRENCY_INFO[rate.toCurrency].name}
                        </span>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <strong>{formatRate(rate.rate)}</strong>
                    </TableCell>
                    <TableCell align="right">{formatRate(rate.inverseRate)}</TableCell>
                    <TableCell>
                      {rate.effectiveFrom instanceof Timestamp
                        ? rate.effectiveFrom.toDate().toLocaleDateString()
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={rate.source}
                        size="small"
                        color={rate.source === 'MANUAL' ? 'default' : 'primary'}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Edit Rate">
                        <IconButton size="small" disabled={!hasCreateAccess}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {exchangeRates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No active exchange rates found. Add your first rate to get started.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
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

      {/* Add Exchange Rate Dialog */}
      <Dialog
        open={openAddRateDialog}
        onClose={() => setOpenAddRateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Exchange Rate</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>From Currency</InputLabel>
                  <Select
                    value={newRate.fromCurrency}
                    label="From Currency"
                    onChange={(e) =>
                      setNewRate({ ...newRate, fromCurrency: e.target.value as CurrencyCode })
                    }
                  >
                    {Object.entries(CURRENCY_INFO).map(([code, info]) => (
                      <MenuItem key={code} value={code}>
                        {info.flag} {code} - {info.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>To Currency</InputLabel>
                  <Select
                    value={newRate.toCurrency}
                    label="To Currency"
                    onChange={(e) =>
                      setNewRate({ ...newRate, toCurrency: e.target.value as CurrencyCode })
                    }
                  >
                    {Object.entries(CURRENCY_INFO).map(([code, info]) => (
                      <MenuItem key={code} value={code}>
                        {info.flag} {code} - {info.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Exchange Rate"
                  type="number"
                  value={newRate.rate}
                  onChange={(e) => setNewRate({ ...newRate, rate: parseFloat(e.target.value) })}
                  slotProps={{ htmlInput: { step: '0.0001', min: '0' } }}
                  helperText={`1 ${newRate.fromCurrency} = ${newRate.rate} ${newRate.toCurrency}`}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Effective From"
                  type="date"
                  value={newRate.effectiveFrom}
                  onChange={(e) => setNewRate({ ...newRate, effectiveFrom: e.target.value })}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddRateDialog(false)}>Cancel</Button>
          <Button
            onClick={handleAddExchangeRate}
            variant="contained"
            disabled={loading || newRate.rate <= 0}
          >
            Add Rate
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
