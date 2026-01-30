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
  Description as PRIcon,
  RequestQuote as RFQIcon,
  LocalOffer as OfferIcon,
  Assignment as POIcon,
  LocalShipping as DeliveryIcon,
  Inventory as GRIcon,
  Refresh as RefreshIcon,
  ArrowForward as ArrowIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@vapour/ui';
import { Breadcrumbs, Link } from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';

interface ProcurementHealthStats {
  stalePRs: { count: number; oldestDays: number };
  rfqsWithoutOffers: { count: number };
  pendingOfferSelection: { count: number; totalValue: number };
  posPendingApproval: { count: number; totalValue: number };
  overdueDeliveries: { count: number; totalValue: number };
  missingGoodsReceipts: { count: number };
  totalDocuments: number;
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

export default function ProcurementDataHealthPage() {
  const router = useRouter();
  useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProcurementHealthStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const { db } = getFirebase();

      // Fetch all procurement documents - use allSettled to handle partial permission failures
      const results = await Promise.allSettled([
        getDocs(collection(db, COLLECTIONS.PURCHASE_REQUESTS)),
        getDocs(collection(db, COLLECTIONS.RFQS)),
        getDocs(collection(db, COLLECTIONS.OFFERS)),
        getDocs(collection(db, COLLECTIONS.PURCHASE_ORDERS)),
        getDocs(collection(db, COLLECTIONS.GOODS_RECEIPTS)),
      ]);

      const prsSnap = results[0].status === 'fulfilled' ? results[0].value : null;
      const rfqsSnap = results[1].status === 'fulfilled' ? results[1].value : null;
      const offersSnap = results[2].status === 'fulfilled' ? results[2].value : null;
      const posSnap = results[3].status === 'fulfilled' ? results[3].value : null;
      const grsSnap = results[4].status === 'fulfilled' ? results[4].value : null;

      // If all queries failed, show error
      if (!prsSnap && !rfqsSnap && !offersSnap && !posSnap && !grsSnap) {
        throw new Error('Unable to access procurement data. Check your permissions.');
      }

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // 1. Count stale PRs (DRAFT or SUBMITTED for more than 7 days)
      let stalePRCount = 0;
      let oldestPRDays = 0;
      prsSnap?.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'DRAFT' || data.status === 'SUBMITTED') {
          const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt);
          if (createdAt < sevenDaysAgo) {
            stalePRCount++;
            const daysDiff = Math.floor(
              (now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1000)
            );
            if (daysDiff > oldestPRDays) oldestPRDays = daysDiff;
          }
        }
      });

      // 2. Count RFQs without offers
      const rfqsWithOffers = new Set<string>();
      offersSnap?.forEach((doc) => {
        const data = doc.data();
        if (data.rfqId) rfqsWithOffers.add(data.rfqId);
      });

      let rfqsWithoutOffersCount = 0;
      rfqsSnap?.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'SENT' && !rfqsWithOffers.has(doc.id)) {
          rfqsWithoutOffersCount++;
        }
      });

      // 3. Count RFQs with offers but no selection (pending selection)
      let pendingSelectionCount = 0;
      let pendingSelectionValue = 0;
      rfqsSnap?.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'OFFERS_RECEIVED' || data.status === 'UNDER_EVALUATION') {
          pendingSelectionCount++;
          pendingSelectionValue += data.estimatedValue || 0;
        }
      });

      // 4. Count POs pending approval
      let posPendingCount = 0;
      let posPendingValue = 0;
      posSnap?.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'PENDING_APPROVAL') {
          posPendingCount++;
          posPendingValue += data.grandTotal || 0;
        }
      });

      // 5. Count overdue deliveries
      let overdueCount = 0;
      let overdueValue = 0;
      posSnap?.forEach((doc) => {
        const data = doc.data();
        if (
          data.status === 'ISSUED' ||
          data.status === 'ACKNOWLEDGED' ||
          data.status === 'IN_PROGRESS'
        ) {
          const expectedDate =
            data.expectedDeliveryDate?.toDate?.() ||
            (data.expectedDeliveryDate ? new Date(data.expectedDeliveryDate) : null);
          if (expectedDate && expectedDate < now && data.deliveryProgress < 100) {
            overdueCount++;
            overdueValue += data.grandTotal || 0;
          }
        }
      });

      // 6. Count missing goods receipts (delivered POs without GR)
      const posWithGR = new Set<string>();
      grsSnap?.forEach((doc) => {
        const data = doc.data();
        if (data.purchaseOrderId) posWithGR.add(data.purchaseOrderId);
      });

      let missingGRCount = 0;
      posSnap?.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'DELIVERED' && !posWithGR.has(doc.id)) {
          missingGRCount++;
        }
      });

      const totalDocuments = (prsSnap?.size || 0) + (rfqsSnap?.size || 0) + (posSnap?.size || 0);

      // Calculate health score
      const issueCount =
        stalePRCount +
        rfqsWithoutOffersCount +
        pendingSelectionCount +
        posPendingCount +
        missingGRCount;
      const healthScore = Math.max(
        0,
        Math.round(100 - (issueCount / Math.max(totalDocuments, 1)) * 100)
      );

      setStats({
        stalePRs: { count: stalePRCount, oldestDays: oldestPRDays },
        rfqsWithoutOffers: { count: rfqsWithoutOffersCount },
        pendingOfferSelection: { count: pendingSelectionCount, totalValue: pendingSelectionValue },
        posPendingApproval: { count: posPendingCount, totalValue: posPendingValue },
        overdueDeliveries: { count: overdueCount, totalValue: overdueValue },
        missingGoodsReceipts: { count: missingGRCount },
        totalDocuments,
        healthScore,
      });
    } catch (err) {
      console.error('Error fetching procurement health stats:', err);
      setError('Failed to load procurement health statistics. Please try again.');
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
          title: 'Stale Purchase Requests',
          count: stats.stalePRs.count,
          subtitle:
            stats.stalePRs.oldestDays > 0
              ? `Oldest: ${stats.stalePRs.oldestDays} days`
              : 'All PRs up to date',
          icon: <PRIcon sx={{ fontSize: 40 }} />,
          color: stats.stalePRs.count > 0 ? 'warning.main' : 'success.main',
          path: '/procurement/purchase-requests?status=DRAFT,SUBMITTED',
          description: 'PRs pending action for more than 7 days',
        },
        {
          title: 'RFQs Without Offers',
          count: stats.rfqsWithoutOffers.count,
          subtitle: 'Sent RFQs awaiting vendor response',
          icon: <RFQIcon sx={{ fontSize: 40 }} />,
          color: stats.rfqsWithoutOffers.count > 0 ? 'warning.main' : 'success.main',
          path: '/procurement/rfqs?status=SENT',
          description: 'Follow up with vendors for quotes',
        },
        {
          title: 'Pending Offer Selection',
          count: stats.pendingOfferSelection.count,
          subtitle: `Value: ${formatCurrency(stats.pendingOfferSelection.totalValue)}`,
          icon: <OfferIcon sx={{ fontSize: 40 }} />,
          color: stats.pendingOfferSelection.count > 0 ? 'error.main' : 'success.main',
          path: '/procurement/rfqs?status=OFFERS_RECEIVED',
          description: 'RFQs with offers ready for selection',
        },
        {
          title: 'POs Pending Approval',
          count: stats.posPendingApproval.count,
          subtitle: `Value: ${formatCurrency(stats.posPendingApproval.totalValue)}`,
          icon: <POIcon sx={{ fontSize: 40 }} />,
          color: stats.posPendingApproval.count > 0 ? 'warning.main' : 'success.main',
          path: '/procurement/pos?status=PENDING_APPROVAL',
          description: 'Purchase orders awaiting approval',
        },
        {
          title: 'Overdue Deliveries',
          count: stats.overdueDeliveries.count,
          subtitle: `Value: ${formatCurrency(stats.overdueDeliveries.totalValue)}`,
          icon: <DeliveryIcon sx={{ fontSize: 40 }} />,
          color: stats.overdueDeliveries.count > 0 ? 'error.main' : 'success.main',
          path: '/procurement/pos?overdue=true',
          description: 'POs past expected delivery date',
        },
        {
          title: 'Missing Goods Receipts',
          count: stats.missingGoodsReceipts.count,
          subtitle: 'Delivered POs without GR recorded',
          icon: <GRIcon sx={{ fontSize: 40 }} />,
          color: stats.missingGoodsReceipts.count > 0 ? 'error.main' : 'success.main',
          path: '/procurement/pos?status=DELIVERED',
          description: 'Record goods receipt for delivered items',
        },
      ]
    : [];

  return (
    <>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/procurement"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/procurement');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Procurement
        </Link>
        <Typography color="text.primary">Data Health</Typography>
      </Breadcrumbs>

      <PageHeader
        title="Procurement Data Health"
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
                Overall Procurement Health
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
                Based on {stats.totalDocuments} procurement documents
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
        Click on a card to view and resolve the issues
      </Typography>

      <Grid container spacing={3}>
        {loading
          ? [1, 2, 3, 4, 5, 6].map((i) => (
              <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={i}>
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
              <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={card.title}>
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
                  onClick={() => router.push(card.path)}
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

      {/* Recommended Actions */}
      {!loading && stats && stats.healthScore < 100 && (
        <Card sx={{ mt: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recommended Actions
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {stats.pendingOfferSelection.count > 0 && (
                <Alert
                  severity="error"
                  action={
                    <Button
                      size="small"
                      onClick={() => router.push('/procurement/rfqs?status=OFFERS_RECEIVED')}
                    >
                      Review
                    </Button>
                  }
                >
                  <strong>Priority 1:</strong> {stats.pendingOfferSelection.count} RFQs have offers
                  waiting for selection worth{' '}
                  {formatCurrency(stats.pendingOfferSelection.totalValue)}. This may delay project
                  timelines.
                </Alert>
              )}
              {stats.posPendingApproval.count > 0 && (
                <Alert
                  severity="error"
                  action={
                    <Button
                      size="small"
                      onClick={() => router.push('/procurement/pos?status=PENDING_APPROVAL')}
                    >
                      Approve
                    </Button>
                  }
                >
                  <strong>Priority 2:</strong> {stats.posPendingApproval.count} Purchase Orders
                  worth {formatCurrency(stats.posPendingApproval.totalValue)} are pending approval.
                </Alert>
              )}
              {stats.overdueDeliveries.count > 0 && (
                <Alert
                  severity="warning"
                  action={
                    <Button
                      size="small"
                      onClick={() => router.push('/procurement/pos?overdue=true')}
                    >
                      Follow Up
                    </Button>
                  }
                >
                  <strong>Priority 3:</strong> {stats.overdueDeliveries.count} deliveries are
                  overdue worth {formatCurrency(stats.overdueDeliveries.totalValue)}. Follow up with
                  vendors.
                </Alert>
              )}
              {stats.missingGoodsReceipts.count > 0 && (
                <Alert
                  severity="warning"
                  action={
                    <Button
                      size="small"
                      onClick={() => router.push('/procurement/pos?status=DELIVERED')}
                    >
                      Record GR
                    </Button>
                  }
                >
                  <strong>Priority 4:</strong> {stats.missingGoodsReceipts.count} delivered POs are
                  missing goods receipt records. This affects inventory tracking.
                </Alert>
              )}
              {stats.rfqsWithoutOffers.count > 0 && (
                <Alert
                  severity="info"
                  action={
                    <Button
                      size="small"
                      onClick={() => router.push('/procurement/rfqs?status=SENT')}
                    >
                      View
                    </Button>
                  }
                >
                  {stats.rfqsWithoutOffers.count} RFQs sent to vendors have not received any offers
                  yet.
                </Alert>
              )}
              {stats.stalePRs.count > 0 && (
                <Alert
                  severity="info"
                  action={
                    <Button
                      size="small"
                      onClick={() =>
                        router.push('/procurement/purchase-requests?status=DRAFT,SUBMITTED')
                      }
                    >
                      View
                    </Button>
                  }
                >
                  {stats.stalePRs.count} Purchase Requests have been pending for more than 7 days.
                </Alert>
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* All Clear Message */}
      {!loading && stats && stats.healthScore === 100 && (
        <Alert severity="success" sx={{ mt: 4 }}>
          <strong>Excellent!</strong> All procurement workflows are up to date. No issues detected.
        </Alert>
      )}
    </>
  );
}
