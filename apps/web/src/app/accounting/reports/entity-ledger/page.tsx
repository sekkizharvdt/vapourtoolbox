'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Paper,
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Autocomplete,
  Breadcrumbs,
  Link,
  Grid,
  Button,
} from '@mui/material';
import {
  Search as SearchIcon,
  Business as BusinessIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useRouter } from 'next/navigation';
import { PageHeader, LoadingState, EmptyState } from '@vapour/ui';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { BusinessEntity } from '@vapour/types';
import {
  EntityTransaction,
  FinancialSummary,
  FinancialSummaryCards,
  AgingAnalysis,
  TransactionsTable,
  EntityInfoCard,
} from './components';

// Helper to get fiscal year start (April 1st)
function getFiscalYearStart(date: Date = new Date()): Date {
  const year = date.getMonth() < 3 ? date.getFullYear() - 1 : date.getFullYear();
  return new Date(year, 3, 1); // April 1st
}

// Helper to convert Firestore Timestamp or Date to Date
function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }
  return null;
}

export default function EntityLedgerPage() {
  const router = useRouter();
  useAuth();
  const [entities, setEntities] = useState<BusinessEntity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<BusinessEntity | null>(null);
  const [allTransactions, setAllTransactions] = useState<EntityTransaction[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'RECEIVABLE' | 'PAYABLE'>('ALL');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  // Date range filter - default to current fiscal year
  const [startDate, setStartDate] = useState<Date | null>(getFiscalYearStart());
  const [endDate, setEndDate] = useState<Date | null>(new Date());

  // Load all entities on mount
  useEffect(() => {
    const { db } = getFirebase();
    const entitiesRef = collection(db, COLLECTIONS.ENTITIES);
    const q = query(entitiesRef, orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entitiesData: BusinessEntity[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Only include active, non-deleted entities
        if (data.isDeleted !== true && data.isArchived !== true) {
          entitiesData.push({ id: doc.id, ...data } as BusinessEntity);
        }
      });
      setEntities(entitiesData);
      setLoadingEntities(false);
    });

    return () => unsubscribe();
  }, []);

  // Load ALL transactions when entity is selected (no date filter in query)
  // We filter by date in memory to calculate opening balance
  useEffect(() => {
    if (!selectedEntity) {
      setAllTransactions([]);
      return;
    }

    setLoadingTransactions(true);
    const { db } = getFirebase();
    const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
    // Only show POSTED or APPROVED transactions for accurate financial reporting
    const q = query(
      transactionsRef,
      where('entityId', '==', selectedEntity.id),
      where('status', 'in', ['POSTED', 'APPROVED']),
      orderBy('date', 'asc') // Order ascending for running balance calculation
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const transactionsData: EntityTransaction[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        transactionsData.push({ id: doc.id, ...data } as EntityTransaction);
      });
      setAllTransactions(transactionsData);
      setLoadingTransactions(false);
    });

    return () => unsubscribe();
  }, [selectedEntity]);

  // Split transactions into opening balance (before start date) and current period
  const { openingBalanceTransactions, periodTransactions } = useMemo(() => {
    if (!startDate) {
      return { openingBalanceTransactions: [], periodTransactions: allTransactions };
    }

    const startOfDay = new Date(startDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = endDate ? new Date(endDate) : new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const opening: EntityTransaction[] = [];
    const period: EntityTransaction[] = [];

    allTransactions.forEach((txn) => {
      const txnDate = toDate(txn.date) || toDate(txn.invoiceDate) || toDate(txn.billDate);
      if (!txnDate) {
        period.push(txn); // If no date, include in period
        return;
      }

      if (txnDate < startOfDay) {
        opening.push(txn);
      } else if (txnDate <= endOfDay) {
        period.push(txn);
      }
      // Transactions after endDate are excluded
    });

    return { openingBalanceTransactions: opening, periodTransactions: period };
  }, [allTransactions, startDate, endDate]);

  // Get entity's stored opening balance (from previous financial year)
  const entityOpeningBalance = useMemo(() => {
    if (!selectedEntity?.openingBalance) return 0;
    const amount = selectedEntity.openingBalance;
    // DR (Debit) = They owe us (positive balance / receivable)
    // CR (Credit) = We owe them (negative balance / payable)
    return selectedEntity.openingBalanceType === 'CR' ? -amount : amount;
  }, [selectedEntity]);

  // Calculate opening balance: entity's stored balance + transactions before start date
  const openingBalance = useMemo(() => {
    // Start with entity's stored opening balance from previous financial year
    let balance = entityOpeningBalance;

    // Add movement from transactions before the selected start date
    openingBalanceTransactions.forEach((txn) => {
      const amount = txn.totalAmount || txn.amount || 0;
      switch (txn.type) {
        case 'CUSTOMER_INVOICE':
          balance += amount; // Customer owes us
          break;
        case 'CUSTOMER_PAYMENT':
          balance -= amount; // Customer paid us
          break;
        case 'VENDOR_BILL':
          balance -= amount; // We owe vendor (negative from entity perspective)
          break;
        case 'VENDOR_PAYMENT':
          balance += amount; // We paid vendor (reduces our liability)
          break;
      }
    });
    return balance;
  }, [entityOpeningBalance, openingBalanceTransactions]);

  // Determine the entity's primary currency from their transactions
  const entityCurrency = useMemo(() => {
    const invoiceOrBill = allTransactions.find(
      (txn) => txn.type === 'CUSTOMER_INVOICE' || txn.type === 'VENDOR_BILL'
    );
    if (invoiceOrBill?.currency) {
      return invoiceOrBill.currency;
    }
    const firstTransaction = allTransactions[0];
    if (firstTransaction?.currency) {
      return firstTransaction.currency;
    }
    return 'INR';
  }, [allTransactions]);

  // Calculate financial summary for the selected period
  const financialSummary = useMemo((): FinancialSummary => {
    const emptySummary: FinancialSummary = {
      totalInvoiced: 0,
      totalBilled: 0,
      totalReceived: 0,
      totalPaid: 0,
      outstandingReceivable: 0,
      outstandingPayable: 0,
      overdueReceivable: 0,
      overduePayable: 0,
      aging: { current: 0, days31to60: 0, days61to90: 0, over90days: 0 },
      openingBalance: 0,
      closingBalance: 0,
    };

    if (!selectedEntity) {
      return emptySummary;
    }

    // Even if no transactions in period, we may have an opening balance
    if (periodTransactions.length === 0 && openingBalance === 0) {
      return emptySummary;
    }

    const now = new Date();
    let totalInvoiced = 0;
    let totalBilled = 0;
    let totalReceived = 0;
    let totalPaid = 0;
    let outstandingReceivable = 0;
    let outstandingPayable = 0;
    let overdueReceivable = 0;
    let overduePayable = 0;
    const aging = { current: 0, days31to60: 0, days61to90: 0, over90days: 0 };
    let periodMovement = 0; // Net movement during the period

    periodTransactions.forEach((txn) => {
      const amount = txn.totalAmount || txn.amount || 0;
      const outstanding = txn.outstandingAmount || 0;
      const dueDate = txn.dueDate ? new Date(txn.dueDate) : null;
      const daysPastDue = dueDate
        ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      switch (txn.type) {
        case 'CUSTOMER_INVOICE':
          totalInvoiced += amount;
          periodMovement += amount;
          outstandingReceivable += outstanding;
          if (txn.paymentStatus === 'OVERDUE' || (dueDate && dueDate < now && outstanding > 0)) {
            overdueReceivable += outstanding;
            if (daysPastDue <= 30) aging.current += outstanding;
            else if (daysPastDue <= 60) aging.days31to60 += outstanding;
            else if (daysPastDue <= 90) aging.days61to90 += outstanding;
            else aging.over90days += outstanding;
          } else if (outstanding > 0) {
            aging.current += outstanding;
          }
          break;
        case 'CUSTOMER_PAYMENT':
          totalReceived += amount;
          periodMovement -= amount;
          break;
        case 'VENDOR_BILL':
          totalBilled += amount;
          periodMovement -= amount;
          outstandingPayable += outstanding;
          if (txn.paymentStatus === 'OVERDUE' || (dueDate && dueDate < now && outstanding > 0)) {
            overduePayable += outstanding;
          }
          break;
        case 'VENDOR_PAYMENT':
          totalPaid += amount;
          periodMovement += amount;
          break;
      }
    });

    return {
      totalInvoiced,
      totalBilled,
      totalReceived,
      totalPaid,
      outstandingReceivable,
      outstandingPayable,
      overdueReceivable,
      overduePayable,
      aging,
      openingBalance,
      closingBalance: openingBalance + periodMovement,
    };
  }, [selectedEntity, periodTransactions, openingBalance]);

  // Filter transactions by type (using periodTransactions which is already date-filtered)
  const filteredTransactions = useMemo(() => {
    // Reverse to show newest first for display
    const sorted = [...periodTransactions].reverse();
    if (filterType === 'ALL') return sorted;
    if (filterType === 'RECEIVABLE') {
      return sorted.filter((txn) => ['CUSTOMER_INVOICE', 'CUSTOMER_PAYMENT'].includes(txn.type));
    }
    if (filterType === 'PAYABLE') {
      return sorted.filter((txn) => ['VENDOR_BILL', 'VENDOR_PAYMENT'].includes(txn.type));
    }
    return sorted;
  }, [periodTransactions, filterType]);

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Determine entity roles for display
  const isCustomer = selectedEntity?.roles.includes('CUSTOMER');
  const isVendor = selectedEntity?.roles.includes('VENDOR');

  if (loadingEntities) {
    return <LoadingState message="Loading entities..." variant="page" />;
  }

  return (
    <Box>
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
        <Link
          color="inherit"
          href="/accounting/reports"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/accounting/reports');
          }}
          sx={{ cursor: 'pointer' }}
        >
          Reports
        </Link>
        <Typography color="text.primary">Entity Ledger</Typography>
      </Breadcrumbs>

      <PageHeader
        title="Entity Ledger"
        subtitle="View financial history and outstanding balances for vendors and customers"
      />

      {/* Entity Selection and Date Range */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 5 }}>
            <Autocomplete
              options={entities}
              getOptionLabel={(entity) => `${entity.code} - ${entity.name}`}
              value={selectedEntity}
              onChange={(_, newValue) => {
                setSelectedEntity(newValue);
                setPage(0);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Select Entity"
                  placeholder="Search by name or code..."
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: (
                      <>
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                        {params.InputProps.startAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, entity) => (
                <li {...props} key={entity.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <BusinessIcon fontSize="small" color="action" />
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {entity.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {entity.code} • {entity.roles.join(', ')}
                      </Typography>
                    </Box>
                  </Box>
                </li>
              )}
              isOptionEqualToValue={(option, value) => option.id === value.id}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <DatePicker
              label="From Date"
              value={startDate}
              onChange={(date) => {
                setStartDate(date);
                setPage(0);
              }}
              slotProps={{
                textField: { fullWidth: true, size: 'medium' },
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <DatePicker
              label="To Date"
              value={endDate}
              onChange={(date) => {
                setEndDate(date);
                setPage(0);
              }}
              slotProps={{
                textField: { fullWidth: true, size: 'medium' },
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                setStartDate(getFiscalYearStart());
                setEndDate(new Date());
                setPage(0);
              }}
              sx={{ whiteSpace: 'nowrap' }}
            >
              Reset
            </Button>
          </Grid>
        </Grid>
        {startDate && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Showing transactions from {startDate.toLocaleDateString('en-IN')} to{' '}
            {endDate?.toLocaleDateString('en-IN') || 'today'}.
            {selectedEntity?.openingBalance
              ? " Opening balance includes entity's previous year balance plus all prior transactions."
              : ' Opening balance calculated from all prior transactions.'}
          </Typography>
        )}
      </Paper>

      {selectedEntity && (
        <>
          <EntityInfoCard entity={selectedEntity} />

          <FinancialSummaryCards
            summary={financialSummary}
            isCustomer={!!isCustomer}
            isVendor={!!isVendor}
            currency={entityCurrency}
          />

          {isCustomer && financialSummary.outstandingReceivable > 0 && (
            <AgingAnalysis aging={financialSummary.aging} currency={entityCurrency} />
          )}

          {/* Transaction Type Filter */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Transaction Type</InputLabel>
              <Select
                value={filterType}
                label="Transaction Type"
                onChange={(e) => {
                  setFilterType(e.target.value as 'ALL' | 'RECEIVABLE' | 'PAYABLE');
                  setPage(0);
                }}
              >
                <MenuItem value="ALL">All Transactions</MenuItem>
                {isCustomer && (
                  <MenuItem value="RECEIVABLE">Receivables (Invoices & Receipts)</MenuItem>
                )}
                {isVendor && <MenuItem value="PAYABLE">Payables (Bills & Payments)</MenuItem>}
              </Select>
            </FormControl>
          </Paper>

          {/* Transactions Table */}
          {loadingTransactions ? (
            <LoadingState message="Loading transactions..." variant="table" colSpan={7} />
          ) : filteredTransactions.length === 0 ? (
            <EmptyState
              message="No transactions found for this entity."
              variant="table"
              colSpan={7}
            />
          ) : (
            <TransactionsTable
              transactions={filteredTransactions}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              openingBalance={openingBalance}
            />
          )}
        </>
      )}

      {!selectedEntity && (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <BusinessIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Select an Entity
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Use the search above to find a vendor or customer and view their financial history.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
