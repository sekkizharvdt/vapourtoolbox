'use client';

import { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Breadcrumbs,
  Link,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import {
  Home as HomeIcon,
  PlayArrow as RunIcon,
  Preview as PreviewIcon,
} from '@mui/icons-material';
import { PageHeader, LoadingState } from '@vapour/ui';
import { LoadingButton } from '@/components/common/LoadingButton';
import { useAuth } from '@/contexts/AuthContext';
import { canManageAccounting } from '@vapour/constants';
import { useToast } from '@/components/common/Toast';
import { formatCurrency } from '@/lib/utils/formatters';
import { ASSET_CATEGORY_LABELS } from '@vapour/types';
import type { DepreciationPreviewItem } from '@/lib/accounting/fixedAssetService';
import { previewDepreciation, runDepreciation } from '@/lib/accounting/fixedAssetService';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export default function DepreciationRunPage() {
  const { user, claims, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [previewing, setPreviewing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [preview, setPreview] = useState<{
    items: DepreciationPreviewItem[];
    totalDepreciation: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    journalEntryId: string;
    assetsProcessed: number;
    totalAmount: number;
  } | null>(null);

  const canManage = claims?.permissions ? canManageAccounting(claims.permissions) : false;
  const entityId = claims?.entityId;

  const handlePreview = useCallback(async () => {
    if (!entityId) return;
    try {
      setPreviewing(true);
      setError(null);
      setResult(null);
      const data = await previewDepreciation(entityId);
      setPreview(data);
      if (data.items.length === 0) {
        setError('No active assets to depreciate.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to preview depreciation';
      setError(message);
    } finally {
      setPreviewing(false);
    }
  }, [entityId]);

  const handlePost = useCallback(async () => {
    if (!user || !claims?.permissions || !entityId) return;

    try {
      setPosting(true);
      setError(null);

      const res = await runDepreciation(entityId, month, year, user.uid, claims.permissions);

      setResult(res);
      setPreview(null);
      toast.success(
        `Depreciation posted: ${formatCurrency(res.totalAmount)} for ${res.assetsProcessed} assets`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to post depreciation';
      setError(message);
      toast.error(message);
    } finally {
      setPosting(false);
    }
  }, [user, claims, entityId, month, year, toast]);

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  if (authLoading) return <LoadingState />;

  if (!canManage) {
    return <Alert severity="error">You do not have permission to run depreciation.</Alert>;
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
        <Typography color="text.primary">Run Depreciation</Typography>
      </Breadcrumbs>

      <PageHeader
        title="Run Depreciation"
        subtitle="Calculate and post monthly depreciation for all active assets"
      />

      {/* Period Selection */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 2 }}>
          Select Period
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Month</InputLabel>
              <Select
                value={month}
                label="Month"
                onChange={(e) => setMonth(e.target.value as number)}
              >
                {MONTHS.map((m) => (
                  <MenuItem key={m.value} value={m.value}>
                    {m.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Year</InputLabel>
              <Select value={year} label="Year" onChange={(e) => setYear(e.target.value as number)}>
                {yearOptions.map((y) => (
                  <MenuItem key={y} value={y}>
                    {y}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 4, md: 3 }}>
            <LoadingButton
              variant="outlined"
              startIcon={<PreviewIcon />}
              onClick={handlePreview}
              loading={previewing}
            >
              Preview
            </LoadingButton>
          </Grid>
        </Grid>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {result && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Depreciation posted successfully! Journal Entry ID: {result.journalEntryId}.{' '}
          {result.assetsProcessed} assets processed, total {formatCurrency(result.totalAmount)}.
        </Alert>
      )}

      {/* Preview Table */}
      {preview && preview.items.length > 0 && (
        <>
          {/* Summary Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Assets to Depreciate
                  </Typography>
                  <Typography variant="h5">{preview.items.length}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Total Depreciation
                  </Typography>
                  <Typography variant="h5" color="warning.main">
                    {formatCurrency(preview.totalDepreciation)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Period
                  </Typography>
                  <Typography variant="h5">
                    {MONTHS[month - 1]?.label} {year}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Asset breakdown table */}
          <Paper>
            <Box
              sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <Typography variant="h6">Depreciation Preview</Typography>
              <LoadingButton
                variant="contained"
                color="primary"
                startIcon={<RunIcon />}
                onClick={handlePost}
                loading={posting}
              >
                Post Depreciation
              </LoadingButton>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Asset #</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell align="right">Current WDV</TableCell>
                    <TableCell align="right">Depreciation</TableCell>
                    <TableCell align="right">New WDV</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {preview.items.map((item) => (
                    <TableRow key={item.assetId}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {item.assetNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>
                        <Chip
                          label={ASSET_CATEGORY_LABELS[item.category] ?? item.category}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">{formatCurrency(item.writtenDownValue)}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="warning.main" fontWeight="medium">
                          {formatCurrency(item.depreciationAmount)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="medium">
                          {formatCurrency(item.newWDV)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow sx={{ '& td': { fontWeight: 'bold' } }}>
                    <TableCell colSpan={3}>
                      <Typography variant="body2" fontWeight="bold">
                        Total
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(preview.items.reduce((s, i) => s + i.writtenDownValue, 0))}
                    </TableCell>
                    <TableCell align="right">
                      <Typography color="warning.main" fontWeight="bold">
                        {formatCurrency(preview.totalDepreciation)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {formatCurrency(preview.items.reduce((s, i) => s + i.newWDV, 0))}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* Journal Entry Preview */}
          <Paper sx={{ mt: 3, p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Journal Entry to be Posted
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              DEP-{year}-{String(month).padStart(2, '0')} — Monthly depreciation for{' '}
              {MONTHS[month - 1]?.label} {year}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Account</TableCell>
                  <TableCell align="right">Debit</TableCell>
                  <TableCell align="right">Credit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>5208 — Depreciation Expense</TableCell>
                  <TableCell align="right">{formatCurrency(preview.totalDepreciation)}</TableCell>
                  <TableCell align="right">-</TableCell>
                </TableRow>
                {/* Group by accum dep account */}
                {Array.from(
                  preview.items.reduce((map, item) => {
                    const key = item.accumDepAccountCode;
                    map.set(key, (map.get(key) || 0) + item.depreciationAmount);
                    return map;
                  }, new Map<string, number>())
                ).map(([code, amount]) => (
                  <TableRow key={code}>
                    <TableCell>{code} — Accumulated Depreciation</TableCell>
                    <TableCell align="right">-</TableCell>
                    <TableCell align="right">{formatCurrency(amount)}</TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ '& td': { fontWeight: 'bold', borderTop: 2 } }}>
                  <TableCell>Total</TableCell>
                  <TableCell align="right">{formatCurrency(preview.totalDepreciation)}</TableCell>
                  <TableCell align="right">{formatCurrency(preview.totalDepreciation)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Paper>
        </>
      )}
    </Box>
  );
}
