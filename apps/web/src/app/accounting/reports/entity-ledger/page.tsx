'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
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
  Grid,
  Button,
  CircularProgress,
  IconButton,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import {
  Search as SearchIcon,
  Business as BusinessIcon,
  Home as HomeIcon,
  FileDownload as DownloadIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useSearchParams } from 'next/navigation';
import { PageHeader, LoadingState, EmptyState } from '@vapour/ui';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, where, doc, getDoc } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { BusinessEntity, LedgerEntry } from '@vapour/types';
import { TRANSACTION_TYPE_SHORT_LABELS } from '@vapour/constants';
import {
  EntityTransaction,
  FinancialSummary,
  FinancialSummaryCards,
  AgingAnalysis,
  TransactionsTable,
  EntityInfoCard,
} from './components';
import type { AllocationRef } from './components/types';
import {
  downloadReportCSV,
  downloadReportExcel,
  type ExportSection,
} from '@/lib/accounting/reports/exportReport';
import { FiscalYearFilter, useFiscalYearFilter } from '@/components/accounting/FiscalYearFilter';
import { getInrAmount } from '@/lib/accounting/amountHelpers';

// Helper to get fiscal year start based on configured start month
function getFiscalYearStart(startMonth: number = 4, date: Date = new Date()): Date {
  const monthIndex = startMonth - 1; // 0-based
  const year = date.getMonth() < monthIndex ? date.getFullYear() - 1 : date.getFullYear();
  return new Date(year, monthIndex, 1);
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

function EntityLedgerInner() {
  const searchParams = useSearchParams();
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
  const [fyStartMonth, setFyStartMonth] = useState(4);
  const fy = useFiscalYearFilter();

  // When the FY dropdown changes, snap the date pickers to the selected FY
  // window. A 'CURRENT'/'ALL' selection leaves the pickers under user control.
  useEffect(() => {
    if (fy.range) {
      setStartDate(fy.range.startDate);
      setEndDate(fy.range.endDate);
      setPage(0);
    }
  }, [fy.range]);

  // Load fiscal year start month from company settings
  useEffect(() => {
    const loadFYStart = async () => {
      try {
        const { db } = getFirebase();
        const settingsDoc = await getDoc(doc(db, 'company', 'settings'));
        if (settingsDoc.exists()) {
          const month = settingsDoc.data().fiscalYearStartMonth;
          if (month && month !== 4) {
            setFyStartMonth(month);
            setStartDate(getFiscalYearStart(month));
          }
        }
      } catch {
        // Fall back to April (default Indian FY)
      }
    };
    loadFYStart();
  }, []);

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

  // Auto-select entity from URL query param (deep-link support)
  useEffect(() => {
    const entityIdParam = searchParams.get('entityId');
    if (entityIdParam && entities.length > 0 && !selectedEntity) {
      const match = entities.find((e) => e.id === entityIdParam);
      if (match) {
        setSelectedEntity(match);
      }
    }
  }, [searchParams, entities, selectedEntity]);

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

    // Query 1: Regular transactions with top-level entityId
    const entityQuery = query(
      transactionsRef,
      where('entityId', '==', selectedEntity.id),
      where('status', 'in', ['POSTED', 'APPROVED']),
      orderBy('date', 'asc')
    );

    // Query 2: Journal entries (entityId is in entries[].entityId, not top-level)
    const journalQuery = query(
      transactionsRef,
      where('type', '==', 'JOURNAL_ENTRY'),
      where('status', 'in', ['POSTED', 'APPROVED']),
      orderBy('date', 'asc')
    );

    let entityTxns: EntityTransaction[] = [];
    let journalTxns: EntityTransaction[] = [];
    let entityLoaded = false;
    let journalLoaded = false;

    function mergeAndSet() {
      if (!entityLoaded || !journalLoaded) return;
      const merged = [...entityTxns, ...journalTxns].sort((a, b) => {
        const dateA = toDate(a.date)?.getTime() || 0;
        const dateB = toDate(b.date)?.getTime() || 0;
        return dateA - dateB;
      });
      setAllTransactions(merged);
      setLoadingTransactions(false);
    }

    const unsub1 = onSnapshot(entityQuery, (snapshot) => {
      entityTxns = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.isDeleted) return; // Skip soft-deleted transactions
        entityTxns.push({ id: doc.id, ...data } as EntityTransaction);
      });
      entityLoaded = true;
      mergeAndSet();
    });

    const unsub2 = onSnapshot(journalQuery, (snapshot) => {
      journalTxns = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.isDeleted) return; // Skip soft-deleted transactions
        const entries = (data.entries || []) as LedgerEntry[];
        // Filter journal entries that have lines referencing this entity
        const entityLines = entries.filter((entry) => entry.entityId === selectedEntity.id);
        if (entityLines.length > 0) {
          // Sum debit/credit for this entity's lines
          const totalDebit = entityLines.reduce((sum, e) => sum + (e.debit || 0), 0);
          const totalCredit = entityLines.reduce((sum, e) => sum + (e.credit || 0), 0);
          journalTxns.push({
            id: doc.id,
            ...data,
            entityId: selectedEntity.id,
            entityName: selectedEntity.name,
            // Store entity-specific amounts for display
            _journalDebit: totalDebit,
            _journalCredit: totalCredit,
          } as EntityTransaction);
        }
      });
      journalLoaded = true;
      mergeAndSet();
    });

    return () => {
      unsub1();
      unsub2();
    };
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
      const txnDate = toDate(txn.date);
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
    // Use baseAmount (INR) for foreign currency transactions, fall back to totalAmount for INR-only
    openingBalanceTransactions.forEach((txn) => {
      const amount = getInrAmount(txn);
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
        case 'DIRECT_PAYMENT':
          balance += amount; // Direct payment to entity (reduces our liability, like vendor payment)
          break;
        case 'DIRECT_RECEIPT':
          balance -= amount; // Income received from entity (like customer payment)
          break;
        case 'JOURNAL_ENTRY': {
          // Journal entries: debit increases balance, credit decreases
          const jDebit = (txn as EntityTransaction & { _journalDebit?: number })._journalDebit || 0;
          const jCredit =
            (txn as EntityTransaction & { _journalCredit?: number })._journalCredit || 0;
          balance += jDebit - jCredit;
          break;
        }
        case 'BANK_TRANSFER':
        case 'EXPENSE_CLAIM':
          // These don't appear in entity ledgers
          break;
      }
    });
    return balance;
  }, [entityOpeningBalance, openingBalanceTransactions]);

  // Entity ledger always aggregates in base currency (INR).
  // Foreign currency transactions are converted via baseAmount.
  const entityCurrency = 'INR';

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
    let overdueReceivable = 0;
    let overduePayable = 0;
    const aging = { current: 0, days31to60: 0, days61to90: 0, over90days: 0 };
    let periodMovement = 0; // Net movement during the period

    periodTransactions.forEach((txn) => {
      // Use baseAmount (INR) for foreign currency transactions
      const amount = getInrAmount(txn);
      const outstanding = txn.outstandingAmount ?? 0;
      const dueDate = txn.dueDate ? new Date(txn.dueDate) : null;
      const daysPastDue = dueDate
        ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      switch (txn.type) {
        case 'CUSTOMER_INVOICE':
          totalInvoiced += amount;
          periodMovement += amount;
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
          if (txn.paymentStatus === 'OVERDUE' || (dueDate && dueDate < now && outstanding > 0)) {
            overduePayable += outstanding;
          }
          break;
        case 'VENDOR_PAYMENT':
          totalPaid += amount;
          periodMovement += amount;
          break;
        case 'DIRECT_PAYMENT':
          totalPaid += amount;
          periodMovement += amount;
          break;
        case 'DIRECT_RECEIPT':
          totalReceived += amount;
          periodMovement -= amount;
          break;
        case 'JOURNAL_ENTRY': {
          const jDebit = (txn as EntityTransaction & { _journalDebit?: number })._journalDebit || 0;
          const jCredit =
            (txn as EntityTransaction & { _journalCredit?: number })._journalCredit || 0;
          periodMovement += jDebit - jCredit;
          if (selectedEntity?.roles.includes('CUSTOMER')) {
            totalInvoiced += jDebit;
            totalReceived += jCredit;
          } else if (selectedEntity?.roles.includes('VENDOR')) {
            totalBilled += jCredit;
            totalPaid += jDebit;
          }
          break;
        }
        case 'BANK_TRANSFER':
        case 'EXPENSE_CLAIM':
          break;
      }
    });

    // Derive outstanding from closing balance so that opening balance, JE adjustments,
    // and payments all contribute to the outstanding figure (not just per-transaction
    // outstandingAmount fields which only reflect payment allocations).
    const closingBalance = openingBalance + periodMovement;
    // Positive closing = entity owes us (receivable); negative = we owe them (payable)
    const derivedOutstandingReceivable = closingBalance > 0 ? closingBalance : 0;
    const derivedOutstandingPayable = closingBalance < 0 ? -closingBalance : 0;

    return {
      totalInvoiced,
      totalBilled,
      totalReceived,
      totalPaid,
      outstandingReceivable: derivedOutstandingReceivable,
      outstandingPayable: derivedOutstandingPayable,
      overdueReceivable,
      overduePayable,
      aging,
      openingBalance,
      closingBalance,
    };
  }, [selectedEntity, periodTransactions, openingBalance]);

  // Filter transactions by type (using periodTransactions which is already date-filtered)
  const filteredTransactions = useMemo(() => {
    // Reverse to show newest first for display
    const sorted = [...periodTransactions].reverse();
    if (filterType === 'ALL') return sorted;
    if (filterType === 'RECEIVABLE') {
      return sorted.filter((txn) =>
        ['CUSTOMER_INVOICE', 'CUSTOMER_PAYMENT', 'DIRECT_RECEIPT'].includes(txn.type)
      );
    }
    if (filterType === 'PAYABLE') {
      return sorted.filter((txn) =>
        ['VENDOR_BILL', 'VENDOR_PAYMENT', 'DIRECT_PAYMENT'].includes(txn.type)
      );
    }
    return sorted;
  }, [periodTransactions, filterType]);

  // Build cross-reference map: billId/invoiceId → payments that allocated to it
  const allocationMap = useMemo(() => {
    const map = new Map<string, AllocationRef[]>();

    for (const txn of periodTransactions) {
      const allocations =
        txn.type === 'CUSTOMER_PAYMENT'
          ? txn.invoiceAllocations
          : txn.type === 'VENDOR_PAYMENT'
            ? txn.billAllocations
            : undefined;

      if (!allocations?.length) continue;

      for (const alloc of allocations) {
        const existing = map.get(alloc.invoiceId) || [];
        existing.push({
          paymentNumber: txn.transactionNumber,
          paymentDate: txn.date,
          allocatedAmount: alloc.allocatedAmount,
        });
        map.set(alloc.invoiceId, existing);
      }
    }
    return map;
  }, [periodTransactions]);

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

  const buildEntityLedgerExport = (): ExportSection[] => {
    if (!selectedEntity || filteredTransactions.length === 0) return [];
    const cols = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Type', key: 'type', width: 14 },
      { header: 'Number', key: 'number', width: 16 },
      { header: 'Description', key: 'description', width: 25 },
      {
        header: 'Debit',
        key: 'debit',
        width: 14,
        align: 'right' as const,
        format: 'currency' as const,
      },
      {
        header: 'Credit',
        key: 'credit',
        width: 14,
        align: 'right' as const,
        format: 'currency' as const,
      },
    ];
    const typeLabels: Record<string, string> = {
      ...TRANSACTION_TYPE_SHORT_LABELS,
    };
    const rows = filteredTransactions.map((txn) => {
      const d = toDate(txn.date);
      const amount = getInrAmount(txn);
      let debit = 0;
      let credit = 0;
      switch (txn.type) {
        case 'CUSTOMER_INVOICE':
        case 'VENDOR_PAYMENT':
        case 'DIRECT_PAYMENT':
          debit = amount;
          break;
        case 'CUSTOMER_PAYMENT':
        case 'VENDOR_BILL':
        case 'DIRECT_RECEIPT':
          credit = amount;
          break;
        case 'JOURNAL_ENTRY':
          debit = txn._journalDebit || 0;
          credit = txn._journalCredit || 0;
          break;
        case 'BANK_TRANSFER':
        case 'EXPENSE_CLAIM':
          break;
      }
      return {
        date: d ? d.toLocaleDateString('en-IN') : '',
        type: typeLabels[txn.type] || txn.type,
        number: txn.transactionNumber || '',
        description: txn.description || '',
        debit: debit > 0 ? debit : 0,
        credit: credit > 0 ? credit : 0,
      };
    });
    return [
      {
        title: `Entity Ledger — ${selectedEntity.name}`,
        columns: cols,
        rows,
        summary: {
          date: null,
          type: null,
          number: null,
          description: `Closing Balance: ${financialSummary.closingBalance >= 0 ? 'Receivable' : 'Payable'}`,
          debit: rows.reduce((s, r) => s + (typeof r.debit === 'number' ? r.debit : 0), 0),
          credit: rows.reduce((s, r) => s + (typeof r.credit === 'number' ? r.credit : 0), 0),
        },
      },
    ];
  };

  const handleExportCSV = () =>
    downloadReportCSV(
      buildEntityLedgerExport(),
      `Entity_Ledger_${selectedEntity?.code || 'unknown'}_${new Date().toISOString().slice(0, 10)}`
    );
  const handleExportExcel = () =>
    downloadReportExcel(
      buildEntityLedgerExport(),
      `Entity_Ledger_${selectedEntity?.code || 'unknown'}_${new Date().toISOString().slice(0, 10)}`,
      'Entity Ledger'
    );

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Accounting', href: '/accounting', icon: <HomeIcon fontSize="small" /> },
          { label: 'Reports', href: '/accounting/reports' },
          { label: 'Entity Ledger' },
        ]}
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <PageHeader
          title="Entity Ledger"
          subtitle="View financial history and outstanding balances for vendors and customers"
        />
        {filteredTransactions.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
            <IconButton
              onClick={handleExportCSV}
              size="small"
              title="Export CSV"
              aria-label="Export CSV"
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
            <IconButton
              onClick={handleExportExcel}
              size="small"
              color="primary"
              title="Export Excel"
              aria-label="Export Excel"
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
      </Box>

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
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <FiscalYearFilter
              options={fy.options}
              selectedId={fy.selectedId}
              onChange={fy.setSelectedId}
              fullWidth
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
                setStartDate(getFiscalYearStart(fyStartMonth));
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
              allocationMap={allocationMap}
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

export default function EntityLedgerPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      }
    >
      <EntityLedgerInner />
    </Suspense>
  );
}
