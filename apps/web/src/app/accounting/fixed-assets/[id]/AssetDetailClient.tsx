'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Typography,
  Box,
  Paper,
  Button,
  Alert,
  Chip,
  Grid,
  Card,
  CardContent,
  Breadcrumbs,
  Link,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Home as HomeIcon,
  Edit as EditIcon,
  Delete as WriteOffIcon,
  Sell as DisposeIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { PageHeader, LoadingState } from '@vapour/ui';
import { useAuth } from '@/contexts/AuthContext';
import { canViewAccounting, canManageAccounting } from '@vapour/constants';
import { getFirebase } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import type { FixedAsset, AssetStatus } from '@vapour/types';
import { ASSET_CATEGORY_LABELS } from '@vapour/types';
import { formatCurrency, formatDate, formatPercentage } from '@/lib/utils/formatters';
import {
  getDepreciationSchedule,
  calculateMonthlyDepreciation,
} from '@/lib/accounting/fixedAssetService';
import { fixedAssetStateMachine } from '@/lib/workflow/stateMachines';
import EditAssetDialog from '../components/EditAssetDialog';
import DisposeAssetDialog from '../components/DisposeAssetDialog';
import WriteOffAssetDialog from '../components/WriteOffAssetDialog';

const STATUS_COLORS: Record<AssetStatus, 'success' | 'default' | 'error'> = {
  ACTIVE: 'success',
  DISPOSED: 'default',
  WRITTEN_OFF: 'error',
};

const STATUS_LABELS: Record<AssetStatus, string> = {
  ACTIVE: 'Active',
  DISPOSED: 'Disposed',
  WRITTEN_OFF: 'Written Off',
};

export default function AssetDetailClient() {
  const pathname = usePathname();
  const router = useRouter();
  const { claims, loading: authLoading } = useAuth();

  const [asset, setAsset] = useState<FixedAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [disposeOpen, setDisposeOpen] = useState(false);
  const [writeOffOpen, setWriteOffOpen] = useState(false);

  const hasViewAccess = claims?.permissions ? canViewAccounting(claims.permissions) : false;
  const hasEditAccess = claims?.permissions ? canManageAccounting(claims.permissions) : false;

  const rawId = pathname?.split('/').pop() || '';
  const assetId = rawId && rawId !== 'placeholder' ? rawId : '';

  // Load asset
  useEffect(() => {
    if (authLoading) return;
    if (!hasViewAccess || !assetId) {
      setLoading(false);
      return;
    }

    const loadAsset = async () => {
      try {
        const { db } = getFirebase();
        const docSnap = await getDoc(doc(db, COLLECTIONS.FIXED_ASSETS, assetId));

        if (docSnap.exists()) {
          setAsset(docToTyped<FixedAsset>(docSnap.id, docSnap.data()));
        } else {
          setError('Asset not found');
        }
      } catch (err) {
        console.error('[AssetDetail] Error loading asset:', err);
        setError('Failed to load asset');
      } finally {
        setLoading(false);
      }
    };

    loadAsset();
  }, [assetId, hasViewAccess, authLoading]);

  // Depreciation schedule
  const schedule = useMemo(() => {
    if (!asset) return [];
    return getDepreciationSchedule(asset);
  }, [asset]);

  // Monthly depreciation
  const monthlyDep = useMemo(() => {
    if (!asset) return 0;
    return calculateMonthlyDepreciation(asset);
  }, [asset]);

  // Available transitions
  const canDispose = asset
    ? fixedAssetStateMachine.canTransitionTo(asset.status, 'DISPOSED')
    : false;
  const canWriteOff = asset
    ? fixedAssetStateMachine.canTransitionTo(asset.status, 'WRITTEN_OFF')
    : false;

  const handleRefresh = async () => {
    if (!assetId) return;
    try {
      const { db } = getFirebase();
      const docSnap = await getDoc(doc(db, COLLECTIONS.FIXED_ASSETS, assetId));
      if (docSnap.exists()) {
        setAsset(docToTyped<FixedAsset>(docSnap.id, docSnap.data()));
      }
    } catch {
      // Silently fail on refresh
    }
  };

  if (loading || authLoading) return <LoadingState />;

  if (!hasViewAccess) {
    return <Alert severity="error">You do not have permission to view this page.</Alert>;
  }

  if (error || !asset) {
    return (
      <Box>
        <Button startIcon={<BackIcon />} onClick={() => router.push('/accounting/fixed-assets')}>
          Back to Asset Register
        </Button>
        <Alert severity="error" sx={{ mt: 2 }}>
          {error || 'Asset not found'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          underline="hover"
          color="inherit"
          href="/accounting"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <HomeIcon fontSize="small" />
          Accounting
        </Link>
        <Link underline="hover" color="inherit" href="/accounting/fixed-assets">
          Fixed Assets
        </Link>
        <Typography color="text.primary">{asset.assetNumber}</Typography>
      </Breadcrumbs>

      <PageHeader
        title={asset.name}
        action={
          hasEditAccess && asset.status === 'ACTIVE' ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setEditOpen(true)}>
                Edit
              </Button>
              {canDispose && (
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<DisposeIcon />}
                  onClick={() => setDisposeOpen(true)}
                >
                  Dispose
                </Button>
              )}
              {canWriteOff && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<WriteOffIcon />}
                  onClick={() => setWriteOffOpen(true)}
                >
                  Write Off
                </Button>
              )}
            </Box>
          ) : undefined
        }
      >
        <Chip label={asset.assetNumber} size="small" variant="outlined" />
        <Chip
          label={STATUS_LABELS[asset.status]}
          size="small"
          color={STATUS_COLORS[asset.status]}
        />
        <Chip
          label={ASSET_CATEGORY_LABELS[asset.category] ?? asset.category}
          size="small"
          variant="outlined"
        />
      </PageHeader>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Purchase Cost
              </Typography>
              <Typography variant="h5">{formatCurrency(asset.purchaseAmount)}</Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDate(asset.purchaseDate)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Total Depreciation
              </Typography>
              <Typography variant="h5" color="warning.main">
                {formatCurrency(asset.totalDepreciation)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatPercentage((asset.totalDepreciation / asset.purchaseAmount) * 100)} of cost
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Written Down Value
              </Typography>
              <Typography variant="h5" color="success.main">
                {formatCurrency(asset.writtenDownValue)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Net book value
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Monthly Depreciation
              </Typography>
              <Typography variant="h5" color="info.main">
                {formatCurrency(monthlyDep)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {asset.depreciationMethod} @ {formatPercentage(asset.depreciationRatePercent)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Asset Details */}
      <Grid container spacing={3}>
        {/* Left column: Asset info */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Asset Details
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <DetailRow label="Asset Number" value={asset.assetNumber} />
            <DetailRow label="Name" value={asset.name} />
            {asset.description && <DetailRow label="Description" value={asset.description} />}
            <DetailRow
              label="Category"
              value={ASSET_CATEGORY_LABELS[asset.category] ?? asset.category}
            />
            <DetailRow label="Purchase Date" value={formatDate(asset.purchaseDate)} />
            <DetailRow label="Purchase Amount" value={formatCurrency(asset.purchaseAmount)} />
            {asset.vendor && <DetailRow label="Vendor" value={asset.vendor} />}
            {asset.sourceBillNumber && (
              <DetailRow label="Source Bill" value={asset.sourceBillNumber} />
            )}
            {asset.location && <DetailRow label="Location" value={asset.location} />}
            {asset.assignedTo && <DetailRow label="Assigned To" value={asset.assignedTo} />}
            {asset.notes && <DetailRow label="Notes" value={asset.notes} />}
            {asset.tags && asset.tags.length > 0 && (
              <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                <Typography variant="body2" color="text.secondary" sx={{ minWidth: 140 }}>
                  Tags
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {asset.tags.map((tag) => (
                    <Chip key={tag} label={tag} size="small" variant="outlined" />
                  ))}
                </Box>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Right column: Depreciation config + disposal */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Depreciation Configuration
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <DetailRow
              label="Method"
              value={
                asset.depreciationMethod === 'WDV'
                  ? 'Written Down Value (WDV)'
                  : 'Straight Line Method (SLM)'
              }
            />
            <DetailRow label="Rate" value={formatPercentage(asset.depreciationRatePercent)} />
            {asset.usefulLifeYears && (
              <DetailRow label="Useful Life" value={`${asset.usefulLifeYears} years`} />
            )}
            <DetailRow label="Residual Value" value={formatCurrency(asset.residualValue)} />
            <DetailRow label="Total Depreciation" value={formatCurrency(asset.totalDepreciation)} />
            <DetailRow label="Written Down Value" value={formatCurrency(asset.writtenDownValue)} />
            {asset.lastDepreciationDate && (
              <DetailRow label="Last Depreciation" value={formatDate(asset.lastDepreciationDate)} />
            )}

            {/* GL Account Info */}
            <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
              GL Account Mapping
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <DetailRow label="Asset Account" value={asset.assetAccountCode} />
            <DetailRow label="Accum. Depreciation" value={asset.accumulatedDepAccountCode} />

            {/* Disposal info if disposed */}
            {(asset.status === 'DISPOSED' || asset.status === 'WRITTEN_OFF') && (
              <>
                <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
                  Disposal Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {asset.disposalDate && (
                  <DetailRow label="Disposal Date" value={formatDate(asset.disposalDate)} />
                )}
                {asset.disposalAmount !== undefined && (
                  <DetailRow label="Sale Proceeds" value={formatCurrency(asset.disposalAmount)} />
                )}
                {asset.disposalReason && <DetailRow label="Reason" value={asset.disposalReason} />}
                {asset.gainLossOnDisposal !== undefined && (
                  <DetailRow
                    label="Gain / (Loss)"
                    value={
                      <Typography
                        variant="body2"
                        color={asset.gainLossOnDisposal >= 0 ? 'success.main' : 'error.main'}
                        fontWeight="medium"
                      >
                        {formatCurrency(asset.gainLossOnDisposal)}
                      </Typography>
                    }
                  />
                )}
              </>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Depreciation Schedule */}
      {schedule.length > 0 && (
        <Paper sx={{ mt: 3 }}>
          <Box sx={{ p: 2 }}>
            <Typography variant="h6">Depreciation Schedule</Typography>
            <Typography variant="body2" color="text.secondary">
              Year-by-year projection ({asset.depreciationMethod} @{' '}
              {formatPercentage(asset.depreciationRatePercent)})
            </Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Year</TableCell>
                  <TableCell align="right">Opening WDV</TableCell>
                  <TableCell align="right">Depreciation</TableCell>
                  <TableCell align="right">Closing WDV</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {schedule.map((row) => (
                  <TableRow key={row.year}>
                    <TableCell>{row.year}</TableCell>
                    <TableCell align="right">{formatCurrency(row.openingWDV)}</TableCell>
                    <TableCell align="right">{formatCurrency(row.depreciation)}</TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(row.closingWDV)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Dialogs */}
      {editOpen && (
        <EditAssetDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          asset={asset}
          onUpdated={handleRefresh}
        />
      )}
      {disposeOpen && (
        <DisposeAssetDialog
          open={disposeOpen}
          onClose={() => setDisposeOpen(false)}
          asset={asset}
          onDisposed={handleRefresh}
        />
      )}
      {writeOffOpen && (
        <WriteOffAssetDialog
          open={writeOffOpen}
          onClose={() => setWriteOffOpen(false)}
          asset={asset}
          onWrittenOff={handleRefresh}
        />
      )}
    </Box>
  );
}

/** Simple label-value row for detail display */
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', py: 0.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 160 }}>
        {label}
      </Typography>
      {typeof value === 'string' ? <Typography variant="body2">{value}</Typography> : value}
    </Box>
  );
}
