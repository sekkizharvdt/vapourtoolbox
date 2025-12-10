'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Container,
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Receipt as InvoiceIcon,
  Payment as PaymentIcon,
  TrendingUp as UpIcon,
  TrendingDown as DownIcon,
  AccountBalance as AccountIcon,
  OpenInNew as OpenIcon,
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
import type { CostCentre, BaseTransaction, CustomerInvoice } from '@vapour/types';
import CostCentreDialog from '../components/CostCentreDialog';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [openEditDialog, setOpenEditDialog] = useState(false);

  // Wait for auth to complete before checking permissions
  const hasViewAccess = claims?.permissions ? canViewAccounting(claims.permissions) : false;
  const hasEditAccess = claims?.permissions ? canManageAccounting(claims.permissions) : false;

  // Extract ID from pathname - handle placeholder from static export
  const rawCostCentreId = pathname?.split('/').pop() || '';
  const costCentreId = rawCostCentreId && rawCostCentreId !== 'placeholder' ? rawCostCentreId : '';

  // Load cost centre details - wait for auth to complete first
  useEffect(() => {
    // Wait for auth to complete before attempting data fetch
    if (authLoading) {
      return;
    }

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
    // Wait for auth to complete
    if (authLoading || !hasViewAccess || !costCentreId) return;

    const { db } = getFirebase();

    // Query invoices (CUSTOMER_INVOICE)
    const invoicesQuery = query(
      collection(db, COLLECTIONS.TRANSACTIONS),
      where('costCentreId', '==', costCentreId),
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

    // Query payments received (CUSTOMER_PAYMENT)
    const paymentsQuery = query(
      collection(db, COLLECTIONS.TRANSACTIONS),
      where('costCentreId', '==', costCentreId),
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

    // Query bills (VENDOR_BILL)
    const billsQuery = query(
      collection(db, COLLECTIONS.TRANSACTIONS),
      where('costCentreId', '==', costCentreId),
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

    return () => {
      unsubInvoices();
      unsubPayments();
      unsubBills();
    };
  }, [hasViewAccess, costCentreId, authLoading]);

  const handleBack = () => {
    router.push('/accounting/cost-centres');
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const formatCurrency = (amount: number | undefined | null, currency = 'INR') => {
    const safeAmount = amount ?? 0;
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

  // Calculate totals
  const totalInvoiced = invoices.reduce(
    (sum, inv) => sum + (inv.totalAmount || inv.amount || 0),
    0
  );
  const totalReceived = payments.reduce((sum, pay) => sum + (pay.amount || 0), 0);
  const totalBilled = bills.reduce((sum, bill) => sum + (bill.amount || 0), 0);

  // Show loading while auth is in progress or data is loading
  if (authLoading || loading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mt: 4 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Loading cost centre details...
          </Typography>
          <LinearProgress />
        </Box>
      </Container>
    );
  }

  // Permission check after auth is complete
  if (!hasViewAccess) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mb: 4 }}>
          <Alert severity="error">You do not have permission to view cost centre details.</Alert>
        </Box>
      </Container>
    );
  }

  if (error || !costCentre) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ mb: 4 }}>
          <Button startIcon={<BackIcon />} onClick={handleBack} sx={{ mb: 2 }}>
            Back to Cost Centres
          </Button>
          <Alert severity="error">{error || 'Cost centre not found'}</Alert>
        </Box>
      </Container>
    );
  }

  const budgetUtilization = calculateBudgetUtilization();
  const budgetStatus = getBudgetStatus(budgetUtilization);
  const variance = costCentre.variance ?? 0;

  return (
    <Container maxWidth="xl">
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Button startIcon={<BackIcon />} onClick={handleBack} sx={{ mb: 2 }}>
          Back to Cost Centres
        </Button>

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

      {/* Summary Cards */}
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
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Spent / Bills
              </Typography>
              <Typography variant="h5" color="error.main">
                {formatCurrency(costCentre.actualSpent || totalBilled, costCentre.budgetCurrency)}
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
                Invoiced
              </Typography>
              <Typography variant="h5" color="primary.main">
                {formatCurrency(totalInvoiced, costCentre.budgetCurrency)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {invoices.length} invoice(s)
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Received
              </Typography>
              <Typography variant="h5" color="success.main">
                {formatCurrency(totalReceived, costCentre.budgetCurrency)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {payments.length} payment(s)
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

      {/* Tabs */}
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
        </Tabs>

        {/* Invoices Tab */}
        <TabPanel value={tabValue} index={0}>
          {invoices.length === 0 ? (
            <Box sx={{ p: 3 }}>
              <Alert severity="info">No invoices found for this cost centre.</Alert>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Invoice #</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="right">Paid</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {invoice.transactionNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDate(invoice.date)}</TableCell>
                      <TableCell>{invoice.entityName || '-'}</TableCell>
                      <TableCell align="right">
                        {formatCurrency(invoice.totalAmount || invoice.amount, invoice.currency)}
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(invoice.paidAmount || 0, invoice.currency)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={invoice.paymentStatus || invoice.status}
                          color={
                            invoice.paymentStatus === 'PAID'
                              ? 'success'
                              : invoice.paymentStatus === 'PARTIALLY_PAID'
                                ? 'warning'
                                : 'default'
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="View Invoice">
                          <IconButton
                            size="small"
                            onClick={() => router.push(`/accounting/invoices/${invoice.id}`)}
                          >
                            <OpenIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* Payments Tab */}
        <TabPanel value={tabValue} index={1}>
          {payments.length === 0 ? (
            <Box sx={{ p: 3 }}>
              <Alert severity="info">No payments received for this cost centre.</Alert>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Receipt #</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Reference</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {payment.transactionNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDate(payment.date)}</TableCell>
                      <TableCell>{payment.entityName || '-'}</TableCell>
                      <TableCell>{payment.referenceNumber || payment.reference || '-'}</TableCell>
                      <TableCell align="right">
                        {formatCurrency(payment.amount, payment.currency)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={payment.status}
                          color={payment.status === 'POSTED' ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* Bills Tab */}
        <TabPanel value={tabValue} index={2}>
          {bills.length === 0 ? (
            <Box sx={{ p: 3 }}>
              <Alert severity="info">No vendor bills found for this cost centre.</Alert>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Bill #</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Vendor</TableCell>
                    <TableCell>Reference</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bills.map((bill) => (
                    <TableRow key={bill.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {bill.transactionNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDate(bill.date)}</TableCell>
                      <TableCell>{bill.entityName || '-'}</TableCell>
                      <TableCell>{bill.referenceNumber || bill.reference || '-'}</TableCell>
                      <TableCell align="right">
                        {formatCurrency(bill.amount, bill.currency)}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={bill.status}
                          color={
                            bill.status === 'PAID'
                              ? 'success'
                              : bill.status === 'POSTED'
                                ? 'info'
                                : 'default'
                          }
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>
      </Paper>

      {/* Edit Dialog */}
      <CostCentreDialog
        open={openEditDialog}
        costCentre={costCentre}
        onClose={() => {
          setOpenEditDialog(false);
          // Reload cost centre data
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
    </Container>
  );
}
