'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
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
  Paper,
  Tooltip,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import {
  ArrowBack as BackIcon,
  Home as HomeIcon,
  Sync as ReconcileIcon,
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
import { reconcilePaymentStatuses } from '@/lib/accounting/paymentHelpers';
import { getInrAmount } from '@/lib/accounting/amountHelpers';

const CreateBillDialog = dynamic(
  () => import('../../bills/components/CreateBillDialog').then((mod) => mod.CreateBillDialog),
  { ssr: false }
);
const CreateInvoiceDialog = dynamic(
  () =>
    import('../../invoices/components/CreateInvoiceDialog').then((mod) => mod.CreateInvoiceDialog),
  { ssr: false }
);

interface StaleItem {
  id: string;
  transactionNumber: string;
  type: 'VENDOR_BILL' | 'CUSTOMER_INVOICE';
  entityName: string;
  totalAmount: number;
  currentPaid: number;
  correctPaid: number;
  currentStatus: string;
  correctStatus: string;
  currentOutstanding: number;
  correctOutstanding: number;
  fullData: VendorBill | CustomerInvoice;
}

export default function StalePaymentsPage() {
  const router = useRouter();
  useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<StaleItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<StaleItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'VENDOR_BILL' | 'CUSTOMER_INVOICE'>('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<{
    fixed: number;
    checked: number;
  } | null>(null);

  // View dialog state
  const [viewingBill, setViewingBill] = useState<VendorBill | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<CustomerInvoice | null>(null);
  const [billDialogOpen, setBillDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);

  const fetchStaleItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const { db } = getFirebase();
      const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);

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

      // Build allocation map from payments
      const allocationMap = new Map<string, number>();
      paymentsSnap.forEach((doc) => {
        const data = doc.data();
        if (data.isDeleted) return;
        const allocs =
          data.type === 'CUSTOMER_PAYMENT'
            ? data.invoiceAllocations || []
            : data.billAllocations || [];
        for (const a of allocs as Array<{
          invoiceId?: string;
          allocatedAmount?: number;
        }>) {
          if (
            a.invoiceId &&
            (a.allocatedAmount ?? 0) > 0 &&
            a.invoiceId !== '__opening_balance__'
          ) {
            allocationMap.set(
              a.invoiceId,
              (allocationMap.get(a.invoiceId) ?? 0) + (a.allocatedAmount ?? 0)
            );
          }
        }
      });

      // Build entity-level balance map to skip stale items for settled entities.
      // Positive = entity owes us (receivable), Negative = we owe entity (payable).
      const entityTxnBalance = new Map<string, number>();
      const addToEntityBalance = (entityId: string | undefined, delta: number) => {
        if (!entityId) return;
        entityTxnBalance.set(entityId, (entityTxnBalance.get(entityId) ?? 0) + delta);
      };

      const bills = billsSnap.docs.filter((d) => !d.data().isDeleted);
      const invoices = invoicesSnap.docs.filter((d) => !d.data().isDeleted);
      const payments = paymentsSnap.docs.filter((d) => !d.data().isDeleted);
      const journalEntries = journalEntriesSnap.docs.filter((d) => !d.data().isDeleted);

      invoices.forEach((d) => {
        const data = d.data();
        addToEntityBalance(data.entityId, getInrAmount(data));
      });
      bills.forEach((d) => {
        const data = d.data();
        addToEntityBalance(data.entityId, -getInrAmount(data));
      });
      payments.forEach((d) => {
        const data = d.data();
        const amount = getInrAmount(data);
        addToEntityBalance(data.entityId, data.type === 'CUSTOMER_PAYMENT' ? -amount : amount);
      });
      journalEntries.forEach((d) => {
        const data = d.data();
        const entries = (data.entries || []) as Array<{
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

      // Fetch entity opening balances
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

      const stale: StaleItem[] = [];

      const processDoc = (
        doc: { id: string; data: () => Record<string, unknown> },
        type: 'VENDOR_BILL' | 'CUSTOMER_INVOICE'
      ) => {
        const data = doc.data();
        if (data.isDeleted) return;

        // Skip if entity-level net position is zero in the relevant direction
        const entityId = data.entityId as string | undefined;
        if (entityId) {
          const entityBalance = entityBalanceMap.get(entityId) ?? 0;
          if (type === 'CUSTOMER_INVOICE' && entityBalance <= 0) return;
          if (type === 'VENDOR_BILL' && entityBalance >= 0) return;
        }

        const totalINR = (data.baseAmount as number) || (data.totalAmount as number) || 0;
        const correctPaid = allocationMap.get(doc.id) ?? 0;
        const currentPaid = (data.amountPaid as number) ?? 0;
        const currentStatus = (data.paymentStatus as string) ?? 'UNPAID';
        const currentOutstanding = data.outstandingAmount as number | undefined;

        const correctOutstanding = parseFloat(Math.max(0, totalINR - correctPaid).toFixed(2));
        let correctStatus: string;
        if (correctOutstanding === 0 && totalINR > 0) correctStatus = 'PAID';
        else if (correctPaid > 0) correctStatus = 'PARTIALLY_PAID';
        else correctStatus = 'UNPAID';

        const isStale =
          Math.abs(currentPaid - correctPaid) > 0.01 ||
          currentStatus !== correctStatus ||
          currentOutstanding === undefined ||
          currentOutstanding === null ||
          Math.abs((currentOutstanding ?? 0) - correctOutstanding) > 0.01;

        if (isStale) {
          const fullData = Object.assign({}, data, { id: doc.id }) as unknown as
            | VendorBill
            | CustomerInvoice;
          stale.push({
            id: doc.id,
            transactionNumber: (data.transactionNumber as string) || doc.id,
            type,
            entityName: (data.entityName as string) || '',
            totalAmount: totalINR,
            currentPaid,
            correctPaid,
            currentStatus,
            correctStatus,
            currentOutstanding: currentOutstanding ?? 0,
            correctOutstanding,
            fullData,
          });
        }
      };

      billsSnap.forEach((doc) =>
        processDoc({ id: doc.id, data: () => doc.data() as Record<string, unknown> }, 'VENDOR_BILL')
      );
      invoicesSnap.forEach((doc) =>
        processDoc(
          { id: doc.id, data: () => doc.data() as Record<string, unknown> },
          'CUSTOMER_INVOICE'
        )
      );

      stale.sort(
        (a, b) => Math.abs(b.correctPaid - b.currentPaid) - Math.abs(a.correctPaid - a.currentPaid)
      );
      setItems(stale);
      setFilteredItems(stale);
    } catch (err) {
      console.error('Error fetching stale payment items:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to fetch stale items. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaleItems();
  }, []);

  useEffect(() => {
    let filtered = items;
    if (typeFilter !== 'all') {
      filtered = filtered.filter((i) => i.type === typeFilter);
    }
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
  }, [items, typeFilter, searchTerm]);

  const handleReconcileAll = async () => {
    setReconciling(true);
    setReconcileResult(null);
    try {
      const { db } = getFirebase();
      const result = await reconcilePaymentStatuses(db);
      setReconcileResult({ fixed: result.fixed, checked: result.checked });
      if (result.fixed > 0) {
        fetchStaleItems();
      }
    } catch (err) {
      console.error('Reconciliation failed:', err);
      setError('Reconciliation failed. Please try again.');
    } finally {
      setReconciling(false);
    }
  };

  const handleViewItem = (item: StaleItem) => {
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

  const bills = items.filter((i) => i.type === 'VENDOR_BILL');
  const invoices = items.filter((i) => i.type === 'CUSTOMER_INVOICE');

  if (loading) {
    return <LoadingState variant="page" message="Scanning payment statuses..." />;
  }

  return (
    <Box sx={{ py: 4 }}>
      <PageBreadcrumbs
        items={[
          { label: 'Accounting', href: '/accounting', icon: <HomeIcon fontSize="small" /> },
          { label: 'Data Health', href: '/accounting/data-health' },
          { label: 'Stale Payment Statuses' },
        ]}
      />

      <PageHeader
        title="Stale Payment Statuses"
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              color="error"
              startIcon={<ReconcileIcon />}
              onClick={handleReconcileAll}
              disabled={reconciling || items.length === 0}
            >
              {reconciling ? 'Reconciling...' : `Reconcile All (${items.length})`}
            </Button>
            <Button
              variant="outlined"
              startIcon={<BackIcon />}
              onClick={() => router.push('/accounting/data-health')}
            >
              Back
            </Button>
          </Box>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {reconcileResult && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setReconcileResult(null)}>
          Reconciliation complete: {reconcileResult.fixed} of {reconcileResult.checked}{' '}
          bills/invoices were fixed.
        </Alert>
      )}

      {items.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {items.length} bill(s)/invoice(s) have payment statuses that don&apos;t match their actual
          payment allocations. Review the discrepancies below, then reconcile to fix them.
        </Alert>
      )}

      {/* Summary Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <StatCard
          label="Total Stale"
          value={items.length.toString()}
          icon={<ReconcileIcon />}
          color="error"
        />
        <StatCard
          label={`Bills (${bills.length})`}
          value={bills.length.toString()}
          icon={<ReconcileIcon />}
          color="warning"
        />
        <StatCard
          label={`Invoices (${invoices.length})`}
          value={invoices.length.toString()}
          icon={<ReconcileIcon />}
          color="info"
        />
      </Box>

      {/* Filters */}
      <FilterBar
        onClear={() => {
          setSearchTerm('');
          setTypeFilter('all');
        }}
      >
        <TextField
          placeholder="Search by entity or number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          sx={{ minWidth: 300 }}
        />
        <Button
          variant={typeFilter === 'all' ? 'contained' : 'outlined'}
          size="small"
          onClick={() => setTypeFilter('all')}
        >
          All ({items.length})
        </Button>
        <Button
          variant={typeFilter === 'VENDOR_BILL' ? 'contained' : 'outlined'}
          size="small"
          onClick={() => setTypeFilter('VENDOR_BILL')}
        >
          Bills ({bills.length})
        </Button>
        <Button
          variant={typeFilter === 'CUSTOMER_INVOICE' ? 'contained' : 'outlined'}
          size="small"
          onClick={() => setTypeFilter('CUSTOMER_INVOICE')}
        >
          Invoices ({invoices.length})
        </Button>
      </FilterBar>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Number</TableCell>
              <TableCell>Entity</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell>Current Status</TableCell>
              <TableCell>Correct Status</TableCell>
              <TableCell align="right">Stored Paid</TableCell>
              <TableCell align="right">Actual Paid</TableCell>
              <TableCell align="center">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredItems.length === 0 ? (
              <EmptyState
                message={
                  items.length === 0
                    ? 'All payment statuses are correct.'
                    : 'No items match your filters.'
                }
                variant="table"
                colSpan={9}
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
                    <TableCell align="right">{formatCurrency(item.totalAmount, 'INR')}</TableCell>
                    <TableCell>
                      <Chip
                        label={item.currentStatus.replace('_', ' ')}
                        size="small"
                        color="error"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.correctStatus.replace('_', ' ')}
                        size="small"
                        color="success"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        color={
                          Math.abs(item.currentPaid - item.correctPaid) > 0.01
                            ? 'error.main'
                            : 'text.primary'
                        }
                      >
                        {formatCurrency(item.currentPaid, 'INR')}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="success.main" fontWeight="medium">
                        {formatCurrency(item.correctPaid, 'INR')}
                      </Typography>
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
