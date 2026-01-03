'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Typography,
  Box,
  Paper,
  Button,
  Alert,
  Chip,
  LinearProgress,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  CircularProgress,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Home as HomeIcon,
  Edit as EditIcon,
  Receipt as InvoiceIcon,
  Payment as PaymentIcon,
  TrendingUp as UpIcon,
  TrendingDown as DownIcon,
  AccountBalance as AccountIcon,
  ShoppingCart as POIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { canViewAccounting, canManageAccounting } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { docToTypedWithDates } from '@/lib/firebase/typeHelpers';
import type { CostCentre, BaseTransaction, CustomerInvoice, PurchaseOrder } from '@vapour/types';
import CostCentreDialog from '../components/CostCentreDialog';

// Lazy load table components
const InvoicesTable = lazy(() =>
  import('./components/InvoicesTable').then((m) => ({ default: m.InvoicesTable }))
);
const PaymentsTable = lazy(() =>
  import('./components/PaymentsTable').then((m) => ({ default: m.PaymentsTable }))
);
const BillsTable = lazy(() =>
  import('./components/BillsTable').then((m) => ({ default: m.BillsTable }))
);
const PurchaseOrdersTable = lazy(() =>
  import('./components/PurchaseOrdersTable').then((m) => ({ default: m.PurchaseOrdersTable }))
);

// Loading fallback for tables
function TableLoader() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
      <CircularProgress />
    </Box>
  );
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function CostCentreDetailClient() {
  const pathname = usePathname();
  const router = useRouter();
  const { claims, loading: authLoading } = useAuth();

  const [costCentre, setCostCentre] = useState<CostCentre | null>(null);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [payments, setPayments] = useState<BaseTransaction[]>([]);
  const [bills, setBills] = useState<BaseTransaction[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [openEditDialog, setOpenEditDialog] = useState(false);

  const hasViewAccess = claims?.permissions ? canViewAccounting(claims.permissions) : false;
  const hasEditAccess = claims?.permissions ? canManageAccounting(claims.permissions) : false;

  const rawCostCentreId = pathname?.split('/').pop() || '';
  const costCentreId = rawCostCentreId && rawCostCentreId !== 'placeholder' ? rawCostCentreId : '';

  // Load cost centre details
  useEffect(() => {
    if (authLoading) return;
    if (!hasViewAccess || !costCentreId) {
      setLoading(false);
      return;
    }

    const loadCostCentre = async () => {
      try {
        const { db } = getFirebase();
        const docRef = doc(db, COLLECTIONS.COST_CENTRES, costCentreId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setCostCentre({
            id: docSnap.id,
            ...data,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
            updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
          } as CostCentre);
        } else {
          setError('Cost centre not found');
        }
      } catch (err) {
        console.error('[CostCentreDetail] Error loading cost centre:', err);
        setError('Failed to load cost centre');
      } finally {
        setLoading(false);
      }
    };

    loadCostCentre();
  }, [hasViewAccess, costCentreId, authLoading]);

  // Load transactions linked to this cost centre
  useEffect(() => {
    if (authLoading || !hasViewAccess || !costCentreId || !costCentre) return;

    const { db } = getFirebase();
    const linkField = costCentre.projectId ? 'projectId' : 'costCentreId';
    const linkValue = costCentre.projectId || costCentreId;

    // Query invoices
    const invoicesQuery = query(
      collection(db, COLLECTIONS.TRANSACTIONS),
      where(linkField, '==', linkValue),
      where('type', '==', 'CUSTOMER_INVOICE'),
      orderBy('date', 'desc')
    );

    const unsubInvoices = onSnapshot(
      invoicesQuery,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => docToTypedWithDates<CustomerInvoice>(d.id, d.data()));
        setInvoices(docs);
      },
      (err) => console.error('[CostCentreDetail] Error loading invoices:', err)
    );

    // Query payments
    const paymentsQuery = query(
      collection(db, COLLECTIONS.TRANSACTIONS),
      where(linkField, '==', linkValue),
      where('type', '==', 'CUSTOMER_PAYMENT'),
      orderBy('date', 'desc')
    );

    const unsubPayments = onSnapshot(
      paymentsQuery,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => docToTypedWithDates<BaseTransaction>(d.id, d.data()));
        setPayments(docs);
      },
      (err) => console.error('[CostCentreDetail] Error loading payments:', err)
    );

    // Query bills
    const billsQuery = query(
      collection(db, COLLECTIONS.TRANSACTIONS),
      where(linkField, '==', linkValue),
      where('type', '==', 'VENDOR_BILL'),
      orderBy('date', 'desc')
    );

    const unsubBills = onSnapshot(
      billsQuery,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => docToTypedWithDates<BaseTransaction>(d.id, d.data()));
        setBills(docs);
      },
      (err) => console.error('[CostCentreDetail] Error loading bills:', err)
    );

    // Query purchase orders
    let unsubPOs: (() => void) | undefined;
    if (costCentre.projectId) {
      const posQuery = query(
        collection(db, COLLECTIONS.PURCHASE_ORDERS),
        where('projectIds', 'array-contains', costCentre.projectId),
        where('status', 'in', [
          'APPROVED',
          'ISSUED',
          'ACKNOWLEDGED',
          'IN_PROGRESS',
          'DELIVERED',
          'COMPLETED',
        ]),
        orderBy('createdAt', 'desc')
      );

      unsubPOs = onSnapshot(
        posQuery,
        (snapshot) => {
          const docs = snapshot.docs.map((d) => docToTypedWithDates<PurchaseOrder>(d.id, d.data()));
          setPurchaseOrders(docs);
        },
        (err) => console.error('[CostCentreDetail] Error loading POs:', err)
      );
    }

    return () => {
      unsubInvoices();
      unsubPayments();
      unsubBills();
      unsubPOs?.();
    };
  }, [hasViewAccess, costCentreId, authLoading, costCentre]);

  const handleBack = () => router.push('/accounting/cost-centres');
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => setTabValue(newValue);

  const formatCurrency = (amount: number | undefined | null, currency = 'INR') => {
    const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    return `${safeAmount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currency}`;
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return '-';
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const calculateBudgetUtilization = () => {
    if (!costCentre?.budgetAmount || costCentre.budgetAmount <= 0) return 0;
    const actualSpent = costCentre.actualSpent ?? 0;
    return (actualSpent / costCentre.budgetAmount) * 100;
  };

  const getBudgetStatus = (utilization: number): 'success' | 'warning' | 'error' => {
    if (utilization < 75) return 'success';
    if (utilization < 90) return 'warning';
    return 'error';
  };

  // Calculate totals grouped by currency
  const invoiceTotals = invoices.reduce(
    (acc, inv) => {
      const currency = inv.currency || 'INR';
      const amount = inv.totalAmount || inv.amount || 0;
      acc[currency] = (acc[currency] || 0) + amount;
      return acc;
    },
    {} as Record<string, number>
  );

  const paymentTotals = payments.reduce(
    (acc, pay) => {
      const currency = pay.currency || 'INR';
      acc[currency] = (acc[currency] || 0) + (pay.amount || 0);
      return acc;
    },
    {} as Record<string, number>
  );

  const billTotals = bills.reduce(
    (acc, bill) => {
      const currency = bill.currency || 'INR';
      // Use totalAmount from VendorBill for accurate total
      const totalAmount =
        (bill as unknown as { totalAmount?: number }).totalAmount || bill.amount || 0;
      acc[currency] = (acc[currency] || 0) + totalAmount;
      return acc;
    },
    {} as Record<string, number>
  );

  const poTotals = purchaseOrders.reduce(
    (acc, po) => {
      const currency = po.currency || 'INR';
      acc[currency] = (acc[currency] || 0) + (po.grandTotal || 0);
      return acc;
    },
    {} as Record<string, number>
  );

  // Use outstandingAmount directly from bills for accurate outstanding calculation
  // This handles cases where payments have been recorded against bills
  const vendorOutstandingTotals = bills.reduce(
    (acc, bill) => {
      const currency = bill.currency || 'INR';
      // Use outstandingAmount field which is maintained when payments are recorded
      const outstanding = (bill as unknown as { outstandingAmount?: number }).outstandingAmount;
      // If outstandingAmount is available, use it; otherwise calculate from totalAmount - paidAmount
      const totalAmount =
        (bill as unknown as { totalAmount?: number }).totalAmount || bill.amount || 0;
      const paidAmount = (bill as unknown as { paidAmount?: number }).paidAmount || 0;
      const outstandingValue = outstanding !== undefined ? outstanding : totalAmount - paidAmount;
      acc[currency] = (acc[currency] || 0) + outstandingValue;
      return acc;
    },
    {} as Record<string, number>
  );

  const formatCurrencyTotals = (totals: Record<string, number>) => {
    const entries = Object.entries(totals);
    if (entries.length === 0) return formatCurrency(0, costCentre?.budgetCurrency || 'INR');
    return entries.map(([currency, amount]) => formatCurrency(amount, currency)).join(' + ');
  };

  if (authLoading || loading) {
    return (
      <Box sx={{ mt: 4 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Loading cost centre details...
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  if (!hasViewAccess) {
    return (
      <Box sx={{ mb: 4 }}>
        <Alert severity="error">You do not have permission to view cost centre details.</Alert>
      </Box>
    );
  }

  if (error || !costCentre) {
    return (
      <Box sx={{ mb: 4 }}>
        <Button onClick={handleBack} sx={{ mb: 2 }}>
          Back to Cost Centres
        </Button>
        <Alert severity="error">{error || 'Cost centre not found'}</Alert>
      </Box>
    );
  }

  const budgetUtilization = calculateBudgetUtilization();
  const budgetStatus = getBudgetStatus(budgetUtilization);
  const variance = costCentre.variance ?? 0;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
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
            href="/accounting/cost-centres"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              router.push('/accounting/cost-centres');
            }}
            sx={{ cursor: 'pointer' }}
          >
            Cost Centres
          </Link>
          <Typography color="text.primary">{costCentre.code}</Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
              <Typography variant="h4" component="h1">
                {costCentre.name}
              </Typography>
              <Chip label={costCentre.code} color="primary" variant="outlined" size="small" />
              <Chip
                label={costCentre.isActive ? 'Active' : 'Inactive'}
                color={costCentre.isActive ? 'success' : 'default'}
                size="small"
              />
            </Box>
            {costCentre.description && (
              <Typography variant="body1" color="text.secondary">
                {costCentre.description}
              </Typography>
            )}
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Chip
                label={costCentre.category || 'PROJECT'}
                color={
                  costCentre.category === 'ADMINISTRATION'
                    ? 'secondary'
                    : costCentre.category === 'OVERHEAD'
                      ? 'warning'
                      : 'primary'
                }
                size="small"
                variant="outlined"
              />
            </Box>
          </Box>

          {hasEditAccess && (
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setOpenEditDialog(true)}
            >
              Edit
            </Button>
          )}
        </Box>
      </Box>

      {/* Summary Cards - First Row */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Budget
              </Typography>
              <Typography variant="h5">
                {costCentre.budgetAmount
                  ? formatCurrency(costCentre.budgetAmount, costCentre.budgetCurrency)
                  : 'Not Set'}
              </Typography>
              {costCentre.budgetAmount && costCentre.budgetAmount > 0 && (
                <Box sx={{ mt: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(budgetUtilization, 100)}
                    color={budgetStatus}
                    sx={{ height: 6, borderRadius: 1 }}
                  />
                  <Typography variant="caption" color={`${budgetStatus}.main`}>
                    {budgetUtilization.toFixed(1)}% utilized
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Committed (POs)
              </Typography>
              <Typography variant="h5" color="warning.main">
                {formatCurrencyTotals(poTotals)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {purchaseOrders.length} purchase order(s)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
            onClick={() => setTabValue(2)}
          >
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Billed (Vendor Bills)
              </Typography>
              <Typography variant="h5" color="error.main">
                {formatCurrencyTotals(billTotals)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {bills.length} bill(s) • Click to view
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
            onClick={() => setTabValue(0)}
          >
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Invoiced (Revenue)
              </Typography>
              <Typography variant="h5" color="primary.main">
                {formatCurrencyTotals(invoiceTotals)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {invoices.length} invoice(s) • Click to view
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Second Row - Additional Metrics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
            onClick={() => setTabValue(1)}
          >
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Payments Received
              </Typography>
              <Typography variant="h5" color="success.main">
                {formatCurrencyTotals(paymentTotals)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {payments.length} payment(s) • Click to view
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card
            sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
            onClick={() => setTabValue(3)}
          >
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                PO Details
              </Typography>
              <Typography variant="h5" color="warning.main">
                {purchaseOrders.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Active purchase order(s) • Click to view
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Outstanding Payable
              </Typography>
              <Typography variant="h5" color="error.main">
                {formatCurrencyTotals(vendorOutstandingTotals)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Unpaid vendor bills
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Outstanding Receivable
              </Typography>
              <Typography variant="h5" color="info.main">
                {formatCurrencyTotals(
                  Object.fromEntries(
                    Object.entries(invoiceTotals).map(([currency, total]) => {
                      const received = paymentTotals[currency] || 0;
                      return [currency, Math.max(0, total - received)];
                    })
                  )
                )}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Unpaid customer invoices
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Variance Card */}
      {costCentre.budgetAmount && costCentre.budgetAmount > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AccountIcon color="action" />
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Budget Variance
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {variance >= 0 ? <UpIcon color="success" /> : <DownIcon color="error" />}
                <Typography variant="h6" color={variance >= 0 ? 'success.main' : 'error.main'}>
                  {formatCurrency(Math.abs(variance), costCentre.budgetCurrency)}
                  {variance >= 0 ? ' under budget' : ' over budget'}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Tabs with lazy-loaded tables */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            icon={<InvoiceIcon />}
            iconPosition="start"
            label={`Invoices (${invoices.length})`}
          />
          <Tab
            icon={<PaymentIcon />}
            iconPosition="start"
            label={`Payments (${payments.length})`}
          />
          <Tab icon={<AccountIcon />} iconPosition="start" label={`Bills (${bills.length})`} />
          <Tab icon={<POIcon />} iconPosition="start" label={`POs (${purchaseOrders.length})`} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Suspense fallback={<TableLoader />}>
            <InvoicesTable
              invoices={invoices}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
            />
          </Suspense>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Suspense fallback={<TableLoader />}>
            <PaymentsTable
              payments={payments}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
            />
          </Suspense>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Suspense fallback={<TableLoader />}>
            <BillsTable bills={bills} formatCurrency={formatCurrency} formatDate={formatDate} />
          </Suspense>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Suspense fallback={<TableLoader />}>
            <PurchaseOrdersTable purchaseOrders={purchaseOrders} formatCurrency={formatCurrency} />
          </Suspense>
        </TabPanel>
      </Paper>

      {/* Edit Dialog */}
      <CostCentreDialog
        open={openEditDialog}
        costCentre={costCentre}
        onClose={() => {
          setOpenEditDialog(false);
          if (costCentreId) {
            const { db } = getFirebase();
            getDoc(doc(db, COLLECTIONS.COST_CENTRES, costCentreId)).then((docSnap) => {
              if (docSnap.exists()) {
                const data = docSnap.data();
                setCostCentre({
                  id: docSnap.id,
                  ...data,
                  createdAt:
                    data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
                  updatedAt:
                    data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
                } as CostCentre);
              }
            });
          }
        }}
      />
    </Box>
  );
}
