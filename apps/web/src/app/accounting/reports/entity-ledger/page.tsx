'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Typography,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TablePagination,
  InputAdornment,
  Autocomplete,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  Search as SearchIcon,
  Business as BusinessIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  AccountBalance as AccountBalanceIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
} from '@mui/icons-material';
import { PageHeader, LoadingState, EmptyState } from '@vapour/ui';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { BusinessEntity } from '@vapour/types';
import type { BaseTransaction, TransactionType } from '@vapour/types';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import { formatDate } from '@/lib/utils/formatters';

interface EntityTransaction extends BaseTransaction {
  entityId: string;
  entityName: string;
  totalAmount?: number;
  paidAmount?: number;
  outstandingAmount?: number;
  paymentStatus?: string;
  invoiceDate?: Date;
  billDate?: Date;
  dueDate?: Date;
}

interface AgingBucket {
  current: number; // 0-30 days
  days31to60: number;
  days61to90: number;
  over90days: number;
}

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
  // Use the currency from invoices/bills linked to this entity
  const entityCurrency = useMemo(() => {
    // Find first invoice or bill to get the currency
    const invoiceOrBill = transactions.find(
      (txn) => txn.type === 'CUSTOMER_INVOICE' || txn.type === 'VENDOR_BILL'
    );
    if (invoiceOrBill?.currency) {
      return invoiceOrBill.currency;
    }
    // Fallback to any transaction's currency
    const firstTransaction = transactions[0];
    if (firstTransaction?.currency) {
      return firstTransaction.currency;
    }
    return 'INR';
  }, [transactions]);

  // Calculate financial summary
  const financialSummary = useMemo(() => {
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
    const aging: AgingBucket = { current: 0, days31to60: 0, days61to90: 0, over90days: 0 };

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
            // Aging buckets for receivables
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

  // Paginate transactions
  const paginatedTransactions = filteredTransactions.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getTransactionTypeLabel = (type: TransactionType): string => {
    const labels: Record<TransactionType, string> = {
      CUSTOMER_INVOICE: 'Invoice',
      CUSTOMER_PAYMENT: 'Receipt',
      VENDOR_BILL: 'Bill',
      VENDOR_PAYMENT: 'Payment',
      JOURNAL_ENTRY: 'Journal',
      BANK_TRANSFER: 'Transfer',
      EXPENSE_CLAIM: 'Expense',
    };
    return labels[type] || type;
  };

  const getTransactionTypeColor = (
    type: TransactionType
  ): 'primary' | 'success' | 'warning' | 'info' | 'default' => {
    switch (type) {
      case 'CUSTOMER_INVOICE':
        return 'primary';
      case 'CUSTOMER_PAYMENT':
        return 'success';
      case 'VENDOR_BILL':
        return 'warning';
      case 'VENDOR_PAYMENT':
        return 'info';
      default:
        return 'default';
    }
  };

  const getPaymentStatusColor = (status?: string): 'success' | 'warning' | 'error' | 'default' => {
    switch (status) {
      case 'PAID':
        return 'success';
      case 'PARTIALLY_PAID':
        return 'warning';
      case 'OVERDUE':
        return 'error';
      case 'UNPAID':
      default:
        return 'default';
    }
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
          {/* Entity Info Card */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <BusinessIcon fontSize="large" color="primary" />
              <Box>
                <Typography variant="h6">{selectedEntity.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedEntity.code} • {selectedEntity.contactPerson} • {selectedEntity.email}
                </Typography>
              </Box>
              <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                {selectedEntity.roles.map((role) => (
                  <Chip
                    key={role}
                    label={role}
                    size="small"
                    color={role === 'CUSTOMER' ? 'success' : role === 'VENDOR' ? 'info' : 'default'}
                  />
                ))}
              </Box>
            </Box>
            {selectedEntity.billingAddress && (
              <Typography variant="body2" color="text.secondary">
                {[
                  selectedEntity.billingAddress.line1,
                  selectedEntity.billingAddress.city,
                  selectedEntity.billingAddress.state,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </Typography>
            )}
          </Paper>

          {/* Financial Summary Cards */}
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
                        {formatCurrency(financialSummary.totalInvoiced, entityCurrency)}
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
                        {formatCurrency(financialSummary.totalReceived, entityCurrency)}
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
                        {formatCurrency(financialSummary.outstandingReceivable, entityCurrency)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card
                    sx={{
                      bgcolor: financialSummary.overdueReceivable > 0 ? 'error.50' : undefined,
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
                        {formatCurrency(financialSummary.overdueReceivable, entityCurrency)}
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
                        {formatCurrency(financialSummary.totalBilled, entityCurrency)}
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
                        {formatCurrency(financialSummary.totalPaid, entityCurrency)}
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
                        {formatCurrency(financialSummary.outstandingPayable, entityCurrency)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card
                    sx={{ bgcolor: financialSummary.overduePayable > 0 ? 'error.50' : undefined }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <AccountBalanceIcon color="error" />
                        <Typography variant="body2" color="text.secondary">
                          Overdue
                        </Typography>
                      </Box>
                      <Typography variant="h5" fontWeight="bold" color="error.main">
                        {formatCurrency(financialSummary.overduePayable, entityCurrency)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </>
            )}
          </Grid>

          {/* Aging Analysis (for customers with outstanding) */}
          {isCustomer && financialSummary.outstandingReceivable > 0 && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Receivables Aging Analysis
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.50', borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Current (0-30 days)
                    </Typography>
                    <Typography variant="h6" color="success.main">
                      {formatCurrency(financialSummary.aging.current, entityCurrency)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'warning.50', borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      31-60 days
                    </Typography>
                    <Typography variant="h6" color="warning.main">
                      {formatCurrency(financialSummary.aging.days31to60, entityCurrency)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'orange.50', borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      61-90 days
                    </Typography>
                    <Typography variant="h6" color="warning.dark">
                      {formatCurrency(financialSummary.aging.days61to90, entityCurrency)}
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'error.50', borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Over 90 days
                    </Typography>
                    <Typography variant="h6" color="error.main">
                      {formatCurrency(financialSummary.aging.over90days, entityCurrency)}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
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
            <Paper>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Transaction #</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="right">Outstanding</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedTransactions.map((txn) => (
                      <TableRow key={txn.id} hover>
                        <TableCell>
                          {formatDate(txn.invoiceDate || txn.billDate || txn.date)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getTransactionTypeLabel(txn.type)}
                            size="small"
                            color={getTransactionTypeColor(txn.type)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {txn.transactionNumber}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>
                            {txn.description || '-'}
                          </Typography>
                          {txn.dueDate && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              Due: {formatDate(txn.dueDate)}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="medium">
                            {formatCurrency(txn.totalAmount || txn.amount, txn.currency)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {txn.outstandingAmount !== undefined && txn.outstandingAmount > 0 ? (
                            <Typography variant="body2" color="warning.main" fontWeight="medium">
                              {formatCurrency(txn.outstandingAmount, txn.currency)}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              -
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {txn.paymentStatus && (
                            <Chip
                              label={txn.paymentStatus.replace('_', ' ')}
                              size="small"
                              color={getPaymentStatusColor(txn.paymentStatus)}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={filteredTransactions.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
              />
            </Paper>
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
