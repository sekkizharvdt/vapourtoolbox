'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Container,
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
} from '@mui/material';
import { Search as SearchIcon, Business as BusinessIcon } from '@mui/icons-material';
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

export default function EntityLedgerPage() {
  useAuth();
  const [entities, setEntities] = useState<BusinessEntity[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<BusinessEntity | null>(null);
  const [transactions, setTransactions] = useState<EntityTransaction[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'RECEIVABLE' | 'PAYABLE'>('ALL');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

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

  // Load transactions when entity is selected
  useEffect(() => {
    if (!selectedEntity) {
      setTransactions([]);
      return;
    }

    setLoadingTransactions(true);
    const { db } = getFirebase();
    const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
    const q = query(
      transactionsRef,
      where('entityId', '==', selectedEntity.id),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const transactionsData: EntityTransaction[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        transactionsData.push({ id: doc.id, ...data } as EntityTransaction);
      });
      setTransactions(transactionsData);
      setLoadingTransactions(false);
    });

    return () => unsubscribe();
  }, [selectedEntity]);

  // Determine the entity's primary currency from their transactions
  const entityCurrency = useMemo(() => {
    const invoiceOrBill = transactions.find(
      (txn) => txn.type === 'CUSTOMER_INVOICE' || txn.type === 'VENDOR_BILL'
    );
    if (invoiceOrBill?.currency) {
      return invoiceOrBill.currency;
    }
    const firstTransaction = transactions[0];
    if (firstTransaction?.currency) {
      return firstTransaction.currency;
    }
    return 'INR';
  }, [transactions]);

  // Calculate financial summary
  const financialSummary = useMemo((): FinancialSummary => {
    if (!selectedEntity || transactions.length === 0) {
      return {
        totalInvoiced: 0,
        totalBilled: 0,
        totalReceived: 0,
        totalPaid: 0,
        outstandingReceivable: 0,
        outstandingPayable: 0,
        overdueReceivable: 0,
        overduePayable: 0,
        aging: { current: 0, days31to60: 0, days61to90: 0, over90days: 0 },
      };
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

    transactions.forEach((txn) => {
      const amount = txn.totalAmount || txn.amount || 0;
      const outstanding = txn.outstandingAmount || 0;
      const dueDate = txn.dueDate ? new Date(txn.dueDate) : null;
      const daysPastDue = dueDate
        ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      switch (txn.type) {
        case 'CUSTOMER_INVOICE':
          totalInvoiced += amount;
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
          break;
        case 'VENDOR_BILL':
          totalBilled += amount;
          outstandingPayable += outstanding;
          if (txn.paymentStatus === 'OVERDUE' || (dueDate && dueDate < now && outstanding > 0)) {
            overduePayable += outstanding;
          }
          break;
        case 'VENDOR_PAYMENT':
          totalPaid += amount;
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
    };
  }, [selectedEntity, transactions]);

  // Filter transactions by type
  const filteredTransactions = useMemo(() => {
    if (filterType === 'ALL') return transactions;
    if (filterType === 'RECEIVABLE') {
      return transactions.filter((txn) =>
        ['CUSTOMER_INVOICE', 'CUSTOMER_PAYMENT'].includes(txn.type)
      );
    }
    if (filterType === 'PAYABLE') {
      return transactions.filter((txn) => ['VENDOR_BILL', 'VENDOR_PAYMENT'].includes(txn.type));
    }
    return transactions;
  }, [transactions, filterType]);

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
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <LoadingState message="Loading entities..." variant="page" />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <PageHeader
        title="Entity Ledger"
        subtitle="View financial history and outstanding balances for vendors and customers"
      />

      {/* Entity Selection */}
      <Paper sx={{ p: 3, mb: 3 }}>
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
    </Container>
  );
}
