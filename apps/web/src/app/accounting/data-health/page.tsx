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
  ContentCopy as DuplicateIcon,
  Category as CategoryIcon,
  Schedule as OverdueIcon,
  Refresh as RefreshIcon,
  ArrowForward as ArrowIcon,
  Home as HomeIcon,
  SyncProblem as SyncIcon,
  Savings as AdvanceIcon,
  Calculate as RecalculateIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@vapour/ui';
import { Breadcrumbs, Link } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { COLLECTIONS } from '@vapour/firebase';
import { reconcilePaymentStatuses } from '@/lib/accounting/paymentHelpers';
import { useConfirmDialog } from '@/components/common/ConfirmDialog';

interface DataHealthStats {
  unappliedPayments: { count: number; total: number };
  advances: { count: number; total: number };
  missingGLEntries: { count: number };
  unmappedAccounts: { count: number };
  overdueItems: { count: number; total: number };
  stalePaymentStatuses: { count: number };
  duplicateNumbers: { count: number };
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
  const { confirm } = useConfirmDialog();
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<{
    fixed: number;
    checked: number;
  } | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const [recalculateResult, setRecalculateResult] = useState<{
    accountsUpdated: number;
    transactionsProcessed: number;
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

  const handleRecalculateBalances = async () => {
    const confirmed = await confirm({
      title: 'Recalculate Account Balances',
      message:
        'This will reset all account running totals (debit/credit/balance) to zero and rebuild them from transaction GL entries. This is safe but should be done during a quiet period when no transactions are being created. Continue?',
      confirmText: 'Recalculate',
      confirmColor: 'warning',
    });
    if (!confirmed) return;

    setRecalculating(true);
    setRecalculateResult(null);
    try {
      const { functions } = getFirebase();
      const recalculateFn = httpsCallable<
        void,
        { success: boolean; accountsUpdated: number; transactionsProcessed: number }
      >(functions, 'recalculateAccountBalances');
      const result = await recalculateFn();
      setRecalculateResult({
        accountsUpdated: result.data.accountsUpdated,
        transactionsProcessed: result.data.transactionsProcessed,
      });
    } catch (err) {
      console.error('Recalculation failed:', err);
      setError('Account balance recalculation failed. Please try again.');
    } finally {
      setRecalculating(false);
    }
  };

  const fetchStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const { db } = getFirebase();
      const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);

      // Fetch all relevant transactions
      const [paymentsSnap, billsSnap, invoicesSnap, journalEntriesSnap] = await Promise.all([
        getDocs(
          query(transactionsRef, where('type', 'in', ['CUSTOMER_PAYMENT', 'VENDOR_PAYMENT']))
        ),
        getDocs(query(transactionsRef, where('type', '==', 'VENDOR_BILL'))),
        getDocs(query(transactionsRef, where('type', '==', 'CUSTOMER_INVOICE'))),
        getDocs(query(transactionsRef, where('type', '==', 'JOURNAL_ENTRY'))),
      ]);

      // Filter out soft-deleted transactions from all snapshots
      const payments = paymentsSnap.docs.filter((doc) => !doc.data().isDeleted);
      const bills = billsSnap.docs.filter((doc) => !doc.data().isDeleted);
      const invoices = invoicesSnap.docs.filter((doc) => !doc.data().isDeleted);
      const journalEntries = journalEntriesSnap.docs.filter((doc) => !doc.data().isDeleted);

      // Track unique transactions with any issue for health score
      const transactionsWithIssues = new Set<string>();

      // Count unapplied payments and advances separately
      let unappliedCount = 0;
      let unappliedTotal = 0;
      let advancesCount = 0;
      let advancesTotal = 0;
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
          if (data.isAdvance === true) {
            // Intentional advance — informational only, does not affect health score
            advancesCount++;
            advancesTotal += data.totalAmount || data.amount || 0;
          } else {
            // Unintentionally unapplied — counts as a data issue
            unappliedCount++;
            unappliedTotal += data.totalAmount || data.amount || 0;
            transactionsWithIssues.add(doc.id);
          }
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
      // Stale status check is deferred until after entity balance map is built,
      // so we can skip items where the entity's net position is zero.
      const staleCandidates = [...bills, ...invoices].map((d) => {
        const data = d.data();
        const totalINR = data.baseAmount || data.totalAmount || 0;
        const correctPaid = allocationMap.get(d.id) ?? 0;
        const currentPaid = data.amountPaid ?? 0;
        const currentStatus = data.paymentStatus ?? 'UNPAID';
        let correctStatus: string;
        if (correctPaid >= totalINR && totalINR > 0) correctStatus = 'PAID';
        else if (correctPaid > 0) correctStatus = 'PARTIALLY_PAID';
        else correctStatus = 'UNPAID';
        const isStale =
          Math.abs(currentPaid - correctPaid) > 0.01 || currentStatus !== correctStatus;
        return {
          id: d.id,
          isStale,
          entityId: data.entityId as string | undefined,
          type: data.type as string,
        };
      });

      // Build entity-level closing balance map to avoid flagging invoices where the
      // entity's net outstanding is zero (e.g. opening balance covers all invoices).
      // Positive = entity owes us (receivable), Negative = we owe entity (payable).
      const entityTxnBalance = new Map<string, number>();
      const addToEntityBalance = (entityId: string | undefined, delta: number) => {
        if (!entityId) return;
        entityTxnBalance.set(entityId, (entityTxnBalance.get(entityId) ?? 0) + delta);
      };
      invoices.forEach((doc) => {
        const data = doc.data();
        addToEntityBalance(data.entityId, data.baseAmount || data.totalAmount || 0);
      });
      bills.forEach((doc) => {
        const data = doc.data();
        addToEntityBalance(data.entityId, -(data.baseAmount || data.totalAmount || 0));
      });
      payments.forEach((doc) => {
        const data = doc.data();
        const amount = data.baseAmount || data.totalAmount || data.amount || 0;
        addToEntityBalance(data.entityId, data.type === 'CUSTOMER_PAYMENT' ? -amount : amount);
      });
      journalEntries.forEach((doc) => {
        const data = doc.data();
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

      // Fetch entity opening balances and compute final closing balance per entity
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

      // Now count stale items, skipping entities with zero net balance
      for (const candidate of staleCandidates) {
        if (!candidate.isStale) continue;
        // Skip if entity-level net position is zero in the relevant direction
        if (candidate.entityId) {
          const entityBalance = entityBalanceMap.get(candidate.entityId) ?? 0;
          if (candidate.type === 'CUSTOMER_INVOICE' && entityBalance <= 0) continue;
          if (candidate.type === 'VENDOR_BILL' && entityBalance >= 0) continue;
        }
        staleStatusCount++;
        transactionsWithIssues.add(candidate.id);
      }

      // Count overdue items
      const now = new Date();
      let overdueCount = 0;
      let overdueTotal = 0;

      const checkOverdue = (
        docs: typeof bills,
        transactionType: 'VENDOR_BILL' | 'CUSTOMER_INVOICE'
      ) => {
        docs.forEach((doc) => {
          const data = doc.data();
          if (
            data.paymentStatus !== 'PAID' &&
            data.status !== 'CANCELLED' &&
            data.status !== 'VOIDED'
          ) {
            const dueDate = data.dueDate?.toDate?.() || new Date(data.dueDate);
            if (dueDate && dueDate < now) {
              // Skip if entity-level net outstanding is zero in the relevant direction.
              // This prevents stale per-invoice amounts from creating false overdue alerts
              // when payments or opening balances cover the full entity position.
              if (data.entityId) {
                const entityBalance = entityBalanceMap.get(data.entityId) ?? 0;
                if (transactionType === 'CUSTOMER_INVOICE' && entityBalance <= 0) return;
                if (transactionType === 'VENDOR_BILL' && entityBalance >= 0) return;
              }
              // Use outstandingAmount (INR), fallback to baseAmount (INR) for forex, then totalAmount
              const outstanding =
                data.outstandingAmount ?? data.baseAmount ?? data.totalAmount ?? 0;
              if (outstanding > 0) {
                overdueCount++;
                overdueTotal += outstanding;
                transactionsWithIssues.add(doc.id);
              }
            }
          }
        });
      };
      checkOverdue(bills, 'VENDOR_BILL');
      checkOverdue(invoices, 'CUSTOMER_INVOICE');

      // Detect duplicate transaction numbers
      const allTransactions = [...payments, ...bills, ...invoices, ...journalEntries];
      const numberCounts = new Map<string, number>();
      allTransactions.forEach((doc) => {
        const num = doc.data().transactionNumber;
        if (num) {
          numberCounts.set(num, (numberCounts.get(num) || 0) + 1);
        }
      });
      const duplicateCount = Array.from(numberCounts.values()).filter((c) => c > 1).length;

      const totalTransactions = payments.length + bills.length + invoices.length;

      // Health score = % of transactions with no issues
      const cleanTransactions = totalTransactions - transactionsWithIssues.size;
      const healthScore = Math.round((cleanTransactions / Math.max(totalTransactions, 1)) * 100);

      setStats({
        unappliedPayments: { count: unappliedCount, total: unappliedTotal },
        advances: { count: advancesCount, total: advancesTotal },
        missingGLEntries: { count: missingGLCount },
        unmappedAccounts: { count: unmappedCount },
        overdueItems: { count: overdueCount, total: overdueTotal },
        stalePaymentStatuses: { count: staleStatusCount },
        duplicateNumbers: { count: duplicateCount },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          title: 'Advances',
          count: stats.advances.count,
          subtitle: `Total: ${formatCurrency(stats.advances.total)}`,
          icon: <AdvanceIcon sx={{ fontSize: 40 }} />,
          color: 'info.main' as const,
          path: '/accounting/data-health/advances',
          description: 'Advance receipts/payments pending invoice or bill',
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
          path: '/accounting/data-health/stale-payments',
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
        {
          title: 'Duplicate Transaction Numbers',
          count: stats.duplicateNumbers.count,
          subtitle: 'Groups with the same transaction number',
          icon: <DuplicateIcon sx={{ fontSize: 40 }} />,
          color: 'error.main' as const,
          path: undefined as unknown as string,
          description: 'Multiple transactions sharing the same number',
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
              {stats.duplicateNumbers.count > 0 && (
                <Alert severity="error">
                  <strong>Priority 1:</strong> {stats.duplicateNumbers.count} duplicate transaction
                  number group{stats.duplicateNumbers.count > 1 ? 's' : ''} found. Each transaction
                  should have a unique number to prevent confusion in reports and reconciliation.
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
              <Alert
                severity="info"
                icon={<RecalculateIcon />}
                action={
                  <Button size="small" onClick={handleRecalculateBalances} disabled={recalculating}>
                    {recalculating ? 'Recalculating...' : 'Recalculate'}
                  </Button>
                }
              >
                <strong>Account Balances:</strong> Rebuild all account running totals from
                transaction GL entries. Use this if the Balance Sheet or Trial Balance shows
                incorrect numbers.
              </Alert>
              {recalculateResult && (
                <Alert severity="success">
                  Recalculation complete: {recalculateResult.accountsUpdated} accounts updated from{' '}
                  {recalculateResult.transactionsProcessed} transactions.
                </Alert>
              )}
            </Box>
          </CardContent>
        </Card>
      )}
    </>
  );
}
