'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  TablePagination,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Breadcrumbs,
  Link,
  Typography,
  Button,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Home as HomeIcon,
  Business as AssetIcon,
  TrendingDown as DepreciationIcon,
  AccountBalance as BookValueIcon,
  Inventory as CountIcon,
  PlayArrow as RunDepIcon,
} from '@mui/icons-material';
import { PageHeader, LoadingState, EmptyState, StatCard, FilterBar } from '@vapour/ui';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { hasPermission, PERMISSION_FLAGS } from '@vapour/constants';
import type { FixedAsset, AssetCategory, AssetStatus } from '@vapour/types';
import { ASSET_CATEGORY_LABELS } from '@vapour/types';
import { formatCurrency, formatDate } from '@/lib/utils/formatters';
import { useFirestoreQuery } from '@/hooks/useFirestoreQuery';
import { useRouter } from 'next/navigation';
import { useFirestore } from '@/lib/firebase/hooks';

const CreateAssetDialog = dynamic(
  () => import('./components/CreateAssetDialog').then((mod) => mod.CreateAssetDialog),
  { ssr: false }
);

const STATUS_COLORS: Record<AssetStatus, 'success' | 'default' | 'error'> = {
  ACTIVE: 'success',
  DISPOSED: 'default',
  WRITTEN_OFF: 'error',
};

const CATEGORY_OPTIONS: { value: '' | AssetCategory; label: string }[] = [
  { value: '', label: 'All Categories' },
  ...Object.entries(ASSET_CATEGORY_LABELS).map(([value, label]) => ({
    value: value as AssetCategory,
    label,
  })),
];

const STATUS_OPTIONS: { value: '' | AssetStatus; label: string }[] = [
  { value: '', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'DISPOSED', label: 'Disposed' },
  { value: 'WRITTEN_OFF', label: 'Written Off' },
];

export default function FixedAssetsPage() {
  const router = useRouter();
  const db = useFirestore();
  const { claims } = useAuth();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'' | AssetCategory>('');
  const [statusFilter, setStatusFilter] = useState<'' | AssetStatus>('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const canManage = claims?.permissions
    ? hasPermission(claims.permissions, PERMISSION_FLAGS.MANAGE_ACCOUNTING)
    : false;

  const entityId = claims?.entityId;

  // Build Firestore query
  const firestoreQuery = useMemo(() => {
    if (!db || !entityId) return null;
    const constraints = [
      where('entityId', '==', entityId),
      ...(statusFilter ? [where('status', '==', statusFilter)] : []),
      ...(categoryFilter ? [where('category', '==', categoryFilter)] : []),
      orderBy('createdAt', 'desc'),
    ];
    return query(collection(db, COLLECTIONS.FIXED_ASSETS), ...constraints);
  }, [db, entityId, statusFilter, categoryFilter]);

  const { data: assets, loading } = useFirestoreQuery<FixedAsset>(firestoreQuery);

  // Client-side filtering
  const filteredAssets = useMemo(() => {
    let result = assets?.filter((a) => !a.isDeleted) ?? [];
    if (search) {
      const term = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(term) ||
          a.assetNumber.toLowerCase().includes(term) ||
          a.vendor?.toLowerCase().includes(term) ||
          a.location?.toLowerCase().includes(term) ||
          a.assignedTo?.toLowerCase().includes(term)
      );
    }
    return result;
  }, [assets, search]);

  // Stats
  const stats = useMemo(() => {
    const active = filteredAssets.filter((a) => a.status === 'ACTIVE');
    return {
      totalAssets: active.length,
      totalCost: active.reduce((sum, a) => sum + a.purchaseAmount, 0),
      totalDepreciation: active.reduce((sum, a) => sum + a.totalDepreciation, 0),
      netBookValue: active.reduce((sum, a) => sum + a.writtenDownValue, 0),
    };
  }, [filteredAssets]);

  const paginatedAssets = filteredAssets.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  if (loading) return <LoadingState />;

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
        <Typography color="text.primary">Fixed Assets</Typography>
      </Breadcrumbs>

      <PageHeader
        title="Fixed Asset Register"
        action={
          canManage ? (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<RunDepIcon />}
                onClick={() => router.push('/accounting/fixed-assets/depreciation')}
              >
                Run Depreciation
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
              >
                Register Asset
              </Button>
            </Box>
          ) : undefined
        }
      />

      {/* Stat Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <StatCard
          label="Active Assets"
          value={stats.totalAssets}
          icon={<CountIcon />}
          color="primary"
        />
        <StatCard
          label="Total Cost"
          value={formatCurrency(stats.totalCost)}
          icon={<AssetIcon />}
          color="info"
        />
        <StatCard
          label="Total Depreciation"
          value={formatCurrency(stats.totalDepreciation)}
          icon={<DepreciationIcon />}
          color="warning"
        />
        <StatCard
          label="Net Book Value"
          value={formatCurrency(stats.netBookValue)}
          icon={<BookValueIcon />}
          color="success"
        />
      </Box>

      {/* Filters */}
      <FilterBar>
        <TextField
          size="small"
          placeholder="Search assets..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 250 }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Category</InputLabel>
          <Select
            value={categoryFilter}
            label="Category"
            onChange={(e) => {
              setCategoryFilter(e.target.value as '' | AssetCategory);
              setPage(0);
            }}
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => {
              setStatusFilter(e.target.value as '' | AssetStatus);
              setPage(0);
            }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </FilterBar>

      {/* Table */}
      {filteredAssets.length === 0 ? (
        <EmptyState
          message={
            search || categoryFilter || statusFilter
              ? 'No assets match the selected filters.'
              : 'No fixed assets found. Register your first asset to get started.'
          }
        />
      ) : (
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Asset #</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Purchase Date</TableCell>
                  <TableCell align="right">Cost</TableCell>
                  <TableCell align="right">Depreciation</TableCell>
                  <TableCell align="right">WDV</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedAssets.map((asset) => (
                  <TableRow
                    key={asset.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/accounting/fixed-assets/${asset.id}`)}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {asset.assetNumber}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{asset.name}</Typography>
                      {asset.assignedTo && (
                        <Typography variant="caption" color="text.secondary">
                          {asset.assignedTo}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={ASSET_CATEGORY_LABELS[asset.category] ?? asset.category}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{formatDate(asset.purchaseDate)}</TableCell>
                    <TableCell align="right">{formatCurrency(asset.purchaseAmount)}</TableCell>
                    <TableCell align="right">{formatCurrency(asset.totalDepreciation)}</TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(asset.writtenDownValue)}
                      </Typography>
                    </TableCell>
                    <TableCell>{asset.location ?? '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={asset.status}
                        size="small"
                        color={STATUS_COLORS[asset.status] ?? 'default'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filteredAssets.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </Paper>
      )}

      {/* Create Dialog */}
      {createDialogOpen && (
        <CreateAssetDialog
          open={createDialogOpen}
          onClose={() => setCreateDialogOpen(false)}
          onCreated={(id) => {
            setCreateDialogOpen(false);
            router.push(`/accounting/fixed-assets/${id}`);
          }}
        />
      )}
    </Box>
  );
}
