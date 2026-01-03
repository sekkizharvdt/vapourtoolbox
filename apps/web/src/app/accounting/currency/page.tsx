'use client';

import { useState, useEffect } from 'react';
import { Typography, Box, Paper, Tabs, Tab, Alert, Breadcrumbs, Link } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { canViewAccounting, canManageAccounting } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import { Home as HomeIcon } from '@mui/icons-material';
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
import { ExchangeRatesTab, SettingsTab } from './components';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
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
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            color="inherit"
            href="/accounting"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              router.push('/accounting');
            }}
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
            Accounting
          </Link>
          <Typography color="text.primary">Currency & Forex</Typography>
        </Breadcrumbs>

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
          <ExchangeRatesTab
            exchangeRates={exchangeRates}
            bankRates={bankRates}
            lastRefresh={lastRefresh}
            refreshing={refreshing}
            hasCreateAccess={hasCreateAccess}
            onRefresh={fetchExchangeRates}
            error={error}
            success={success}
            onClearError={() => setError('')}
            onClearSuccess={() => setSuccess('')}
            baseCurrency={baseCurrency}
          />
        </TabPanel>

        {/* Bank Settlement Tab */}
        <TabPanel value={tabValue} index={1}>
          <BankSettlementAnalysis transactions={foreignTransactions} baseCurrency={baseCurrency} />
        </TabPanel>

        {/* Settings Tab */}
        <TabPanel value={tabValue} index={2}>
          <SettingsTab
            currencyConfig={currencyConfig}
            baseCurrency={baseCurrency}
            hasCreateAccess={hasCreateAccess}
          />
        </TabPanel>
      </Paper>
    </>
  );
}
