'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  LinearProgress,
  Button,
  Alert,
  Skeleton,
} from '@mui/material';
import {
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Payment as PaymentIcon,
  AccountTree as GLIcon,
  Category as CategoryIcon,
  Schedule as OverdueIcon,
  Refresh as RefreshIcon,
  ArrowForward as ArrowIcon,
  Home as HomeIcon,
  SyncProblem as SyncIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@vapour/ui';
import { Breadcrumbs, Link } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { reconcilePaymentStatuses } from '@/lib/accounting/paymentHelpers';

interface DataHealthStats {
  unappliedPayments: { count: number; total: number };
  missingGLEntries: { count: number };
  unmappedAccounts: { count: number };
  overdueItems: { count: number; total: number };
  stalePaymentStatuses: { count: number };
  totalTransactions: number;
  healthScore: number;
}

function getHealthColor(score: number): 'error' | 'warning' | 'success' {
  if (score < 50) return 'error';
  if (score < 80) return 'warning';
  return 'success';
}

function getHealthLabel(score: number): string {
  if (score < 50) return 'Critical';
  if (score < 80) return 'Needs Attention';
  return 'Healthy';
}

export default function DataHealthPage() {
  const router = useRouter();
  useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DataHealthStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<{
    fixed: number;
    checked: number;
  } | null>(null);

  const handleReconcile = async () => {
    setReconciling(true);
    setReconcileResult(null);
    try {
      const { db } = getFirebase();
      const result = await reconcilePaymentStatuses(db);
      setReconcileResult({ fixed: result.fixed, checked: result.checked });
      // Refresh stats after reconciliation
      if (result.fixed > 0) {
        fetchStats();
      }
    } catch (err) {
      console.error('Reconciliation failed:', err);
      setError('Reconciliation failed. Please try again.');
    } finally {
      setReconciling(false);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const { db } = getFirebase();
      const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);

      // Fetch all relevant transactions
      const [paymentsSnap, billsSnap, invoicesSnap] = await Promise.all([
        getDocs(
          query(transactionsRef, where('type', 'in', ['CUSTOMER_PAYMENT', 'VENDOR_PAYMENT']))
        ),
        getDocs(query(transactionsRef, where('type', '==', 'VENDOR_BILL'))),
        getDocs(query(transactionsRef, where('type', '==', 'CUSTOMER_INVOICE'))),
      ]);

      // Filter out soft-deleted transactions from all snapshots
      const payments = paymentsSnap.docs.filter((doc) => !doc.data().isDeleted);
      const bills = billsSnap.docs.filter((doc) => !doc.data().isDeleted);
      const invoices = invoicesSnap.docs.filter((doc) => !doc.data().isDeleted);

      // Track unique transactions with any issue for health score
      const transactionsWithIssues = new Set<string>();

      // Count unapplied payments
      let unappliedCount = 0;
      let unappliedTotal = 0;
      payments.forEach((doc) => {
        const data = doc.data();
        const allocations =
          data.type === 'CUSTOMER_PAYMENT'
            ? data.invoiceAllocations || []
            : data.billAllocations || [];
        const hasAllocations = allocations.some(
          (a: { allocatedAmount?: number }) => (a.allocatedAmount || 0) > 0
        );
        if (!hasAllocations) {
          unappliedCount++;
          unappliedTotal += data.totalAmount || data.amount || 0;
          transactionsWithIssues.add(doc.id);
        }
      });

      // Count missing GL entries (check all transaction types, not just payments)
      let missingGLCount = 0;
      const checkMissingGL = (docs: typeof payments) => {
        docs.forEach((doc) => {
          const data = doc.data();
          if (data.status === 'POSTED' && (!data.entries || data.entries.length === 0)) {
            missingGLCount++;
            transactionsWithIssues.add(doc.id);
          }
        });
      };
      checkMissingGL(payments);
      checkMissingGL(bills);
      checkMissingGL(invoices);

      // Count unmapped accounts in line items
      let unmappedCount = 0;
      bills.forEach((doc) => {
        const data = doc.data();
        const lineItems = data.lineItems || [];
        const hasUnmapped = lineItems.some((item: { accountId?: string }) => !item.accountId);
        if (hasUnmapped) {
          unmappedCount++;
          transactionsWithIssues.add(doc.id);
        }
      });
      invoices.forEach((doc) => {
        const data = doc.data();
        const lineItems = data.lineItems || [];
        const hasUnmapped = lineItems.some((item: { accountId?: string }) => !item.accountId);
        if (hasUnmapped) {
          unmappedCount++;
          transactionsWithIssues.add(doc.id);
        }
      });

      // Count stale payment statuses: bills/invoices with allocations but wrong paymentStatus
      let staleStatusCount = 0;
      const allocationMap = new Map<string, number>();
      payments.forEach((payDoc) => {
        const payData = payDoc.data();
        const allocs =
          payData.type === 'CUSTOMER_PAYMENT'
            ? payData.invoiceAllocations || []
            : payData.billAllocations || [];
        for (const a of allocs) {
          if (a.invoiceId && a.allocatedAmount > 0 && a.invoiceId !== '__opening_balance__') {
            allocationMap.set(
              a.invoiceId,
              (allocationMap.get(a.invoiceId) ?? 0) + a.allocatedAmount
            );
          }
        }
      });
      [...bills, ...invoices].forEach((d) => {
        const data = d.data();
        const totalINR = data.baseAmount || data.totalAmount || 0;
        const correctPaid = allocationMap.get(d.id) ?? 0;
        const currentPaid = data.amountPaid ?? 0;
        const currentStatus = data.paymentStatus ?? 'UNPAID';
        let correctStatus: string;
        if (correctPaid >= totalINR && totalINR > 0) correctStatus = 'PAID';
        else if (correctPaid > 0) correctStatus = 'PARTIALLY_PAID';
        else correctStatus = 'UNPAID';
        if (Math.abs(currentPaid - correctPaid) > 0.01 || currentStatus !== correctStatus) {
          staleStatusCount++;
          transactionsWithIssues.add(d.id);
        }
      });

      // Count overdue items
      const now = new Date();
      let overdueCount = 0;
      let overdueTotal = 0;

      const checkOverdue = (docs: typeof bills) => {
        docs.forEach((doc) => {
          const data = doc.data();
          if (
            data.paymentStatus !== 'PAID' &&
            data.status !== 'CANCELLED' &&
            data.status !== 'VOIDED'
          ) {
            const dueDate = data.dueDate?.toDate?.() || new Date(data.dueDate);
            if (dueDate && dueDate < now) {
              overdueCount++;
              // Use outstandingAmount (INR), fallback to baseAmount (INR) for forex, then totalAmount
              overdueTotal += data.outstandingAmount || data.baseAmount || data.totalAmount || 0;
              transactionsWithIssues.add(doc.id);
            }
          }
        });
      };
      checkOverdue(bills);
      checkOverdue(invoices);

      const totalTransactions = payments.length + bills.length + invoices.length;

      // Health score = % of transactions with no issues
      const cleanTransactions = totalTransactions - transactionsWithIssues.size;
      const healthScore = Math.round((cleanTransactions / Math.max(totalTransactions, 1)) * 100);

      setStats({
        unappliedPayments: { count: unappliedCount, total: unappliedTotal },
        missingGLEntries: { count: missingGLCount },
        unmappedAccounts: { count: unmappedCount },
        overdueItems: { count: overdueCount, total: overdueTotal },
        stalePaymentStatuses: { count: staleStatusCount },
        totalTransactions,
        healthScore,
      });
    } catch (err) {
      console.error('Error fetching data health stats:', err);
      setError('Failed to load data health statistics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const issueCards = stats
    ? [
        {
          title: 'Unapplied Payments',
          count: stats.unappliedPayments.count,
          subtitle: `Total: ${formatCurrency(stats.unappliedPayments.total)}`,
          icon: <PaymentIcon sx={{ fontSize: 40 }} />,
          color: 'warning.main' as const,
          path: '/accounting/data-health/unapplied-payments',
          description: 'Payments not linked to any invoice or bill',
        },
        {
          title: 'Missing GL Entries',
          count: stats.missingGLEntries.count,
          subtitle: 'Posted transactions without ledger entries',
          icon: <GLIcon sx={{ fontSize: 40 }} />,
          color: 'error.main' as const,
          path: '/accounting/data-health/missing-gl',
          description: 'Transactions that need GL entry regeneration',
        },
        {
          title: 'Unmapped Accounts',
          count: stats.unmappedAccounts.count,
          subtitle: 'Line items without expense/revenue account',
          icon: <CategoryIcon sx={{ fontSize: 40 }} />,
          color: 'warning.main' as const,
          path: '/accounting/data-health/unmapped-accounts',
          description: 'Bills/Invoices with unassigned Chart of Accounts',
        },
        {
          title: 'Stale Payment Statuses',
          count: stats.stalePaymentStatuses.count,
          subtitle: 'Bills/invoices with wrong payment status',
          icon: <SyncIcon sx={{ fontSize: 40 }} />,
          color: 'error.main' as const,
          path: '', // No detail page — reconcile button handles it
          description: 'Payment allocations exist but bill status not updated',
        },
        {
          title: 'Overdue Items',
          count: stats.overdueItems.count,
          subtitle: `Total: ${formatCurrency(stats.overdueItems.total)}`,
          icon: <OverdueIcon sx={{ fontSize: 40 }} />,
          color: 'error.main' as const,
          path: '/accounting/data-health/overdue',
          description: 'Invoices and bills past their due date',
        },
      ].filter((card) => card.count > 0)
    : [];

  return (
    <>
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
        <Typography color="text.primary">Data Health</Typography>
      </Breadcrumbs>

      <PageHeader
        title="Data Health"
        action={
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchStats}
            disabled={loading}
          >
            Refresh
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Health Score Card */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h6" gutterBottom>
                Overall Data Health
              </Typography>
              {loading ? (
                <Skeleton width={200} height={40} />
              ) : stats ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography
                    variant="h3"
                    fontWeight="bold"
                    color={`${getHealthColor(stats.healthScore)}.main`}
                  >
                    {stats.healthScore}%
                  </Typography>
                  <Chip
                    label={getHealthLabel(stats.healthScore)}
                    color={getHealthColor(stats.healthScore)}
                    icon={
                      stats.healthScore >= 80 ? (
                        <CheckCircleIcon />
                      ) : stats.healthScore >= 50 ? (
                        <WarningIcon />
                      ) : (
                        <ErrorIcon />
                      )
                    }
                  />
                </Box>
              ) : null}
            </Box>
            {!loading && stats && (
              <Typography variant="body2" color="text.secondary">
                Based on {stats.totalTransactions} transactions
              </Typography>
            )}
          </Box>
          {loading ? (
            <Skeleton sx={{ mt: 2 }} height={10} />
          ) : stats ? (
            <LinearProgress
              variant="determinate"
              value={stats.healthScore}
              color={getHealthColor(stats.healthScore)}
              sx={{ mt: 2, height: 10, borderRadius: 5 }}
            />
          ) : null}
        </CardContent>
      </Card>

      {/* Issue Cards */}
      <Typography variant="h6" gutterBottom>
        Data Issues
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Click on a card to view and fix the issues
      </Typography>

      <Grid container spacing={3}>
        {loading
          ? [1, 2, 3, 4, 5].map((i) => (
              <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={i}>
                <Card>
                  <CardContent>
                    <Skeleton variant="circular" width={40} height={40} />
                    <Skeleton sx={{ mt: 2 }} width="60%" />
                    <Skeleton width="40%" />
                    <Skeleton sx={{ mt: 1 }} width="80%" />
                  </CardContent>
                </Card>
              </Grid>
            ))
          : issueCards.map((card) => (
              <Grid size={{ xs: 12, sm: 6, lg: 3 }} key={card.title}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 4,
                    },
                    borderLeft: 4,
                    borderColor: card.color,
                  }}
                  onClick={() => card.path && router.push(card.path)}
                >
                  <CardContent>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                      }}
                    >
                      <Box sx={{ color: card.color }}>{card.icon}</Box>
                      <ArrowIcon sx={{ color: 'text.secondary' }} />
                    </Box>
                    <Typography variant="h4" fontWeight="bold" sx={{ mt: 2 }}>
                      {card.count}
                    </Typography>
                    <Typography variant="subtitle1" fontWeight="medium">
                      {card.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {card.subtitle}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 1, display: 'block' }}
                    >
                      {card.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
      </Grid>

      {/* Quick Actions */}
      {!loading && stats && stats.healthScore < 100 && (
        <Card sx={{ mt: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recommended Actions
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {stats.stalePaymentStatuses.count > 0 && (
                <Alert
                  severity="error"
                  action={
                    <Button size="small" onClick={handleReconcile} disabled={reconciling}>
                      {reconciling ? 'Reconciling...' : 'Reconcile Now'}
                    </Button>
                  }
                >
                  <strong>Priority 1:</strong> {stats.stalePaymentStatuses.count} bills/invoices
                  have stale payment statuses. Payments are allocated but the bill status was never
                  updated.
                </Alert>
              )}
              {reconcileResult && (
                <Alert severity="success">
                  Reconciliation complete: {reconcileResult.fixed} of {reconcileResult.checked}{' '}
                  bills/invoices were fixed.
                </Alert>
              )}
              {stats.missingGLEntries.count > 0 && (
                <Alert
                  severity="error"
                  action={
                    <Button
                      size="small"
                      onClick={() => router.push('/accounting/data-health/missing-gl')}
                    >
                      Fix Now
                    </Button>
                  }
                >
                  <strong>Priority 1:</strong> {stats.missingGLEntries.count} transactions are
                  missing GL entries. This affects financial reports.
                </Alert>
              )}
              {stats.unappliedPayments.count > 0 && (
                <Alert
                  severity="warning"
                  action={
                    <Button
                      size="small"
                      onClick={() => router.push('/accounting/data-health/unapplied-payments')}
                    >
                      Fix Now
                    </Button>
                  }
                >
                  <strong>Priority 2:</strong> {stats.unappliedPayments.count} payments need to be
                  applied to invoices/bills.
                </Alert>
              )}
              {stats.unmappedAccounts.count > 0 && (
                <Alert
                  severity="warning"
                  action={
                    <Button
                      size="small"
                      onClick={() => router.push('/accounting/data-health/unmapped-accounts')}
                    >
                      Fix Now
                    </Button>
                  }
                >
                  <strong>Priority 3:</strong> {stats.unmappedAccounts.count} transactions have line
                  items without account mapping.
                </Alert>
              )}
              {stats.overdueItems.count > 0 && (
                <Alert
                  severity="info"
                  action={
                    <Button
                      size="small"
                      onClick={() => router.push('/accounting/data-health/overdue')}
                    >
                      View
                    </Button>
                  }
                >
                  {stats.overdueItems.count} overdue items totaling{' '}
                  {formatCurrency(stats.overdueItems.total)} need follow-up.
                </Alert>
              )}
            </Box>
          </CardContent>
        </Card>
      )}
    </>
  );
}
