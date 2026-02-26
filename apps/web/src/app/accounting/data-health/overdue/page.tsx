'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Button,
  Chip,
  Alert,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Breadcrumbs,
  Link,
  Paper,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Warning as WarningIcon,
  Home as HomeIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  AccountBalance as TotalIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { PageHeader, LoadingState, StatCard, FilterBar, EmptyState } from '@vapour/ui';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { VendorBill, CustomerInvoice } from '@vapour/types';
import { formatCurrency } from '@/lib/utils/formatters';

const CreateBillDialog = dynamic(
  () => import('../../bills/components/CreateBillDialog').then((mod) => mod.CreateBillDialog),
  { ssr: false }
);
const CreateInvoiceDialog = dynamic(
  () =>
    import('../../invoices/components/CreateInvoiceDialog').then((mod) => mod.CreateInvoiceDialog),
  { ssr: false }
);

type OverdueItem = {
  id: string;
  transactionNumber: string;
  type: 'VENDOR_BILL' | 'CUSTOMER_INVOICE';
  entityName: string;
  dueDate: Date;
  totalAmount: number;
  outstandingAmount: number;
  daysOverdue: number;
  status: string;
  fullData: VendorBill | CustomerInvoice;
};

function getAgingBucket(daysOverdue: number): string {
  if (daysOverdue <= 30) return '0-30 days';
  if (daysOverdue <= 60) return '31-60 days';
  if (daysOverdue <= 90) return '61-90 days';
  return '90+ days';
}

function getAgingColor(daysOverdue: number): 'warning' | 'error' | 'default' {
  if (daysOverdue <= 30) return 'warning';
  if (daysOverdue <= 90) return 'error';
  return 'error';
}

export default function OverdueItemsPage() {
  const router = useRouter();
  useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<OverdueItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<OverdueItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [tabValue, setTabValue] = useState(0); // 0 = All, 1 = Receivables, 2 = Payables
  const [agingFilter, setAgingFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [error, setError] = useState<string | null>(null);

  // View dialog state
  const [viewingBill, setViewingBill] = useState<VendorBill | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<CustomerInvoice | null>(null);
  const [billDialogOpen, setBillDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);

  const fetchOverdueItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const { db } = getFirebase();
      const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
      const now = new Date();

      const [billsSnap, invoicesSnap, paymentsSnap, journalEntriesSnap] = await Promise.all([
        getDocs(
          query(
            transactionsRef,
            where('type', '==', 'VENDOR_BILL'),
            where('status', 'in', ['APPROVED', 'POSTED'])
          )
        ),
        getDocs(
          query(
            transactionsRef,
            where('type', '==', 'CUSTOMER_INVOICE'),
            where('status', 'in', ['APPROVED', 'POSTED'])
          )
        ),
        getDocs(
          query(transactionsRef, where('type', 'in', ['CUSTOMER_PAYMENT', 'VENDOR_PAYMENT']))
        ),
        getDocs(query(transactionsRef, where('type', '==', 'JOURNAL_ENTRY'))),
      ]);

      // Build entity-level closing balance map.
      // Positive = entity owes us (receivable), Negative = we owe entity (payable).
      const entityTxnBalance = new Map<string, number>();
      const addToEntityBalance = (entityId: string | undefined, delta: number) => {
        if (!entityId) return;
        entityTxnBalance.set(entityId, (entityTxnBalance.get(entityId) ?? 0) + delta);
      };

      invoicesSnap.docs.forEach((doc) => {
        if (doc.data().isDeleted) return;
        const data = doc.data();
        addToEntityBalance(data.entityId, data.baseAmount || data.totalAmount || 0);
      });
      billsSnap.docs.forEach((doc) => {
        if (doc.data().isDeleted) return;
        const data = doc.data();
        addToEntityBalance(data.entityId, -(data.baseAmount || data.totalAmount || 0));
      });
      paymentsSnap.docs.forEach((doc) => {
        if (doc.data().isDeleted) return;
        const data = doc.data();
        const amount = data.baseAmount || data.totalAmount || data.amount || 0;
        addToEntityBalance(data.entityId, data.type === 'CUSTOMER_PAYMENT' ? -amount : amount);
      });
      journalEntriesSnap.docs.forEach((doc) => {
        if (doc.data().isDeleted) return;
        const entries = (doc.data().entries || []) as Array<{
          entityId?: string;
          debit?: number;
          credit?: number;
        }>;
        const perEntity = new Map<string, number>();
        entries.forEach((entry) => {
          if (!entry.entityId) return;
          perEntity.set(
            entry.entityId,
            (perEntity.get(entry.entityId) ?? 0) + (entry.debit || 0) - (entry.credit || 0)
          );
        });
        perEntity.forEach((delta, entityId) => addToEntityBalance(entityId, delta));
      });

      // Fetch entity opening balances and add to transaction balances
      const entityBalanceMap = new Map<string, number>();
      entityTxnBalance.forEach((balance, entityId) => entityBalanceMap.set(entityId, balance));

      const entityIds = [...entityTxnBalance.keys()];
      if (entityIds.length > 0) {
        const entitiesRef = collection(db, COLLECTIONS.ENTITIES);
        for (let i = 0; i < entityIds.length; i += 30) {
          const batchIds = entityIds.slice(i, i + 30);
          const entitySnap = await getDocs(query(entitiesRef, where(documentId(), 'in', batchIds)));
          entitySnap.forEach((entityDoc) => {
            const data = entityDoc.data();
            const openingBalance = data.openingBalance || 0;
            const signedOpening =
              data.openingBalanceType === 'CR' ? -openingBalance : openingBalance;
            entityBalanceMap.set(
              entityDoc.id,
              signedOpening + (entityTxnBalance.get(entityDoc.id) ?? 0)
            );
          });
        }
      }

      const overdue: OverdueItem[] = [];

      billsSnap.forEach((doc) => {
        if (doc.data().isDeleted) return;
        const data = doc.data() as VendorBill & { entityId?: string };
        const dueDateRaw = data.dueDate as unknown as
          | { toDate?: () => Date }
          | string
          | Date
          | undefined;
        const dueDate =
          dueDateRaw &&
          typeof dueDateRaw === 'object' &&
          'toDate' in dueDateRaw &&
          dueDateRaw.toDate
            ? dueDateRaw.toDate()
            : dueDateRaw
              ? new Date(dueDateRaw as string | Date)
              : null;

        if (dueDate && dueDate < now) {
          const daysOverdue = Math.floor(
            (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          // Skip if entity net position shows no payable (we don't owe them anything)
          if (data.entityId) {
            const entityBalance = entityBalanceMap.get(data.entityId) ?? 0;
            if (entityBalance >= 0) return;
          }

          // Use outstandingAmount (INR), fallback to baseAmount (INR) for forex, then totalAmount
          const outstanding = data.outstandingAmount ?? data.baseAmount ?? data.totalAmount ?? 0;

          if (outstanding > 0) {
            overdue.push({
              id: doc.id,
              transactionNumber: data.transactionNumber || '',
              type: 'VENDOR_BILL',
              entityName: data.entityName || '',
              dueDate,
              totalAmount: data.totalAmount || 0,
              outstandingAmount: outstanding,
              daysOverdue,
              status: data.status || '',
              fullData: { ...data, id: doc.id },
            });
          }
        }
      });

      invoicesSnap.forEach((doc) => {
        if (doc.data().isDeleted) return;
        const data = doc.data() as CustomerInvoice & { entityId?: string };
        const dueDateRaw = data.dueDate as unknown as
          | { toDate?: () => Date }
          | string
          | Date
          | undefined;
        const dueDate =
          dueDateRaw &&
          typeof dueDateRaw === 'object' &&
          'toDate' in dueDateRaw &&
          dueDateRaw.toDate
            ? dueDateRaw.toDate()
            : dueDateRaw
              ? new Date(dueDateRaw as string | Date)
              : null;

        if (dueDate && dueDate < now) {
          const daysOverdue = Math.floor(
            (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          // Skip if entity net position shows no receivable (they don't owe us anything)
          if (data.entityId) {
            const entityBalance = entityBalanceMap.get(data.entityId) ?? 0;
            if (entityBalance <= 0) return;
          }

          // Use outstandingAmount (INR), fallback to baseAmount (INR) for forex, then totalAmount
          const outstanding = data.outstandingAmount ?? data.baseAmount ?? data.totalAmount ?? 0;

          if (outstanding > 0) {
            overdue.push({
              id: doc.id,
              transactionNumber: data.transactionNumber || '',
              type: 'CUSTOMER_INVOICE',
              entityName: data.entityName || '',
              dueDate,
              totalAmount: data.totalAmount || 0,
              outstandingAmount: outstanding,
              daysOverdue,
              status: data.status || '',
              fullData: { ...data, id: doc.id },
            });
          }
        }
      });

      // Sort by days overdue descending
      overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);

      setItems(overdue);
      setFilteredItems(overdue);
    } catch (err) {
      console.error('Error fetching overdue items:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to fetch overdue items. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverdueItems();
  }, []);

  useEffect(() => {
    let filtered = items;

    // Filter by tab
    if (tabValue === 1) {
      filtered = filtered.filter((i) => i.type === 'CUSTOMER_INVOICE');
    } else if (tabValue === 2) {
      filtered = filtered.filter((i) => i.type === 'VENDOR_BILL');
    }

    // Filter by aging bucket
    if (agingFilter !== 'all') {
      filtered = filtered.filter((i) => getAgingBucket(i.daysOverdue) === agingFilter);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.entityName?.toLowerCase().includes(term) ||
          i.transactionNumber?.toLowerCase().includes(term)
      );
    }

    setFilteredItems(filtered);
    setPage(0);
  }, [items, tabValue, agingFilter, searchTerm]);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setAgingFilter('all');
  };

  const handleViewItem = (item: OverdueItem) => {
    if (item.type === 'VENDOR_BILL') {
      setViewingBill(item.fullData as VendorBill);
      setBillDialogOpen(true);
    } else {
      setViewingInvoice(item.fullData as CustomerInvoice);
      setInvoiceDialogOpen(true);
    }
  };

  const handleDialogClose = () => {
    setBillDialogOpen(false);
    setInvoiceDialogOpen(false);
    setViewingBill(null);
    setViewingInvoice(null);
  };

  const receivables = items.filter((i) => i.type === 'CUSTOMER_INVOICE');
  const payables = items.filter((i) => i.type === 'VENDOR_BILL');
  const totalReceivable = receivables.reduce((sum, i) => sum + i.outstandingAmount, 0);
  const totalPayable = payables.reduce((sum, i) => sum + i.outstandingAmount, 0);

  // Aging summary
  const agingSummary = {
    '0-30 days': filteredItems
      .filter((i) => i.daysOverdue <= 30)
      .reduce((sum, i) => sum + i.outstandingAmount, 0),
    '31-60 days': filteredItems
      .filter((i) => i.daysOverdue > 30 && i.daysOverdue <= 60)
      .reduce((sum, i) => sum + i.outstandingAmount, 0),
    '61-90 days': filteredItems
      .filter((i) => i.daysOverdue > 60 && i.daysOverdue <= 90)
      .reduce((sum, i) => sum + i.outstandingAmount, 0),
    '90+ days': filteredItems
      .filter((i) => i.daysOverdue > 90)
      .reduce((sum, i) => sum + i.outstandingAmount, 0),
  };

  if (loading) {
    return <LoadingState variant="page" message="Loading overdue items..." />;
  }

  return (
    <Box sx={{ py: 4 }}>
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
          href="/accounting/data-health"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/accounting/data-health');
          }}
          sx={{ cursor: 'pointer' }}
        >
          Data Health
        </Link>
        <Typography color="text.primary">Overdue Items</Typography>
      </Breadcrumbs>

      <PageHeader
        title="Overdue Items"
        action={
          <Button
            variant="outlined"
            startIcon={<BackIcon />}
            onClick={() => router.push('/accounting/data-health')}
          >
            Back to Dashboard
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {items.length > 0 && (
        <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
          You have {items.length} overdue items totaling{' '}
          {formatCurrency(
            items.reduce((sum, i) => sum + i.outstandingAmount, 0),
            'INR'
          )}
          . Follow up on these items to improve cash flow.
        </Alert>
      )}

      {/* Summary Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <StatCard
          label="Total Overdue"
          value={items.length.toString()}
          icon={<TotalIcon />}
          color="primary"
        />
        <StatCard
          label={`Receivables (${receivables.length})`}
          value={formatCurrency(totalReceivable, 'INR')}
          icon={<ReceiptIcon />}
          color="success"
        />
        <StatCard
          label={`Payables (${payables.length})`}
          value={formatCurrency(totalPayable, 'INR')}
          icon={<PaymentIcon />}
          color="error"
        />
      </Box>

      {/* Aging Summary */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom>
            Aging Summary
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {Object.entries(agingSummary).map(([bucket, amount]) => (
              <Box
                key={bucket}
                sx={{
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: amount > 0 ? 'action.hover' : 'transparent',
                  minWidth: 120,
                  cursor: amount > 0 ? 'pointer' : 'default',
                  border: agingFilter === bucket ? 2 : 0,
                  borderColor: 'primary.main',
                }}
                onClick={() => setAgingFilter(agingFilter === bucket ? 'all' : bucket)}
              >
                <Typography variant="caption" color="text.secondary">
                  {bucket}
                </Typography>
                <Typography variant="h6" fontWeight="medium">
                  {formatCurrency(amount, 'INR')}
                </Typography>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label={`All (${items.length})`} />
          <Tab label={`Receivables (${receivables.length})`} />
          <Tab label={`Payables (${payables.length})`} />
        </Tabs>
      </Card>

      {/* Filters */}
      <FilterBar onClear={handleClearFilters}>
        <TextField
          placeholder="Search by entity or number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          sx={{ minWidth: 300 }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Aging</InputLabel>
          <Select
            value={agingFilter}
            label="Aging"
            onChange={(e) => setAgingFilter(e.target.value)}
          >
            <MenuItem value="all">All Aging</MenuItem>
            <MenuItem value="0-30 days">0-30 days</MenuItem>
            <MenuItem value="31-60 days">31-60 days</MenuItem>
            <MenuItem value="61-90 days">61-90 days</MenuItem>
            <MenuItem value="90+ days">90+ days</MenuItem>
          </Select>
        </FormControl>
      </FilterBar>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Number</TableCell>
              <TableCell>Entity</TableCell>
              <TableCell>Due Date</TableCell>
              <TableCell>Days Overdue</TableCell>
              <TableCell align="right">Outstanding</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="center">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredItems.length === 0 ? (
              <EmptyState
                message="All invoices and bills are within their due dates."
                variant="table"
                colSpan={8}
              />
            ) : (
              filteredItems
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Chip
                        label={item.type === 'CUSTOMER_INVOICE' ? 'Invoice' : 'Bill'}
                        size="small"
                        color={item.type === 'CUSTOMER_INVOICE' ? 'success' : 'error'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {item.transactionNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>{item.entityName}</TableCell>
                    <TableCell>{formatDate(item.dueDate)}</TableCell>
                    <TableCell>
                      <Chip
                        label={`${item.daysOverdue} days`}
                        size="small"
                        color={getAgingColor(item.daysOverdue)}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        fontWeight="medium"
                        color={item.type === 'CUSTOMER_INVOICE' ? 'success.main' : 'error.main'}
                      >
                        {formatCurrency(item.outstandingAmount, 'INR')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={item.status.replace('_', ' ')} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Details">
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<ViewIcon />}
                          onClick={() => handleViewItem(item)}
                        >
                          View
                        </Button>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={filteredItems.length}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </TableContainer>

      {/* View Dialogs */}
      <CreateBillDialog
        open={billDialogOpen}
        onClose={handleDialogClose}
        editingBill={viewingBill}
        viewOnly
      />
      <CreateInvoiceDialog
        open={invoiceDialogOpen}
        onClose={handleDialogClose}
        editingInvoice={viewingInvoice}
        viewOnly
      />
    </Box>
  );
}
