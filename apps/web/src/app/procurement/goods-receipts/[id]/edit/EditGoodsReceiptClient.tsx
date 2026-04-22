'use client';

/**
 * Edit Goods Receipt Page
 *
 * Inspection metadata (date, location, overall notes, issues summary)
 * is editable while the GR is still PENDING / IN_PROGRESS / ISSUES_FOUND.
 * Per-item received/accepted/rejected quantities are NOT edited here —
 * those are locked once the GR is created so the PO's delivery counts
 * stay consistent. To correct a quantity the user cancels the GR and
 * creates a new one.
 */

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  TextField,
  CircularProgress,
  Alert,
  Divider,
  Grid,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import type { GoodsReceipt } from '@vapour/types';
import { getGRById, updateGoodsReceiptMetadata } from '@/lib/procurement/goodsReceiptService';

function timestampToDateInput(value: unknown): string {
  if (!value) return '';
  try {
    const date =
      value && typeof value === 'object' && 'toDate' in value
        ? (value as { toDate: () => Date }).toDate()
        : value instanceof Date
          ? value
          : new Date(value as string);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0] ?? '';
  } catch {
    return '';
  }
}

export default function EditGoodsReceiptClient() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const [grId, setGrId] = useState<string | null>(null);
  const [gr, setGR] = useState<GoodsReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Editable metadata
  const [inspectionType, setInspectionType] = useState<
    'VENDOR_SITE' | 'DELIVERY_SITE' | 'THIRD_PARTY'
  >('DELIVERY_SITE');
  const [inspectionLocation, setInspectionLocation] = useState('');
  const [inspectionDate, setInspectionDate] = useState('');
  const [overallNotes, setOverallNotes] = useState('');
  const [issuesSummary, setIssuesSummary] = useState('');

  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/\/goods-receipts\/([^/]+)\/edit/);
      const id = match?.[1];
      if (id && id !== 'placeholder') setGrId(id);
    }
  }, [pathname]);

  const loadGR = async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await getGRById(id);
      if (!data) {
        setError('Goods receipt not found');
        return;
      }
      setGR(data);
      setInspectionType(data.inspectionType);
      setInspectionLocation(data.inspectionLocation ?? '');
      setInspectionDate(timestampToDateInput(data.inspectionDate));
      setOverallNotes(data.overallNotes ?? '');
      setIssuesSummary(data.issuesSummary ?? '');
    } catch (err) {
      console.error('[EditGoodsReceiptClient] Error loading GR:', err);
      setError('Failed to load goods receipt');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (grId) loadGR(grId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grId]);

  const handleSave = async () => {
    if (!user || !grId || !gr) return;
    if (gr.status === 'COMPLETED') {
      setError('Cannot edit a completed Goods Receipt');
      return;
    }
    if (!inspectionLocation.trim()) {
      setError('Inspection location is required');
      return;
    }
    if (!inspectionDate) {
      setError('Inspection date is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await updateGoodsReceiptMetadata(
        grId,
        {
          inspectionType,
          inspectionLocation,
          inspectionDate: new Date(inspectionDate),
          overallNotes,
          issuesSummary,
        },
        user.uid
      );
      router.push(`/procurement/goods-receipts/${grId}`);
    } catch (err) {
      console.error('[EditGoodsReceiptClient] Error saving:', err);
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!gr) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Goods receipt not found'}</Alert>
        <Button onClick={() => router.push('/procurement/goods-receipts')} sx={{ mt: 2 }}>
          Back to Goods Receipts
        </Button>
      </Box>
    );
  }

  const readOnly = gr.status === 'COMPLETED';

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <PageBreadcrumbs
          items={[
            { label: 'Procurement', href: '/procurement', icon: <HomeIcon fontSize="small" /> },
            { label: 'Goods Receipts', href: '/procurement/goods-receipts' },
            { label: gr.number, href: `/procurement/goods-receipts/${grId}` },
            { label: 'Edit' },
          ]}
        />

        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push(`/procurement/goods-receipts/${grId}`)}
            sx={{ mb: 1 }}
          >
            Back to Goods Receipt
          </Button>
          <Typography variant="h4" gutterBottom>
            Edit {gr.number}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            PO {gr.poNumber} · Status: {gr.status.replace(/_/g, ' ')}
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}
        {readOnly && (
          <Alert severity="warning">
            This goods receipt is completed. Fields are read-only. To correct a completed GR,
            contact accounting.
          </Alert>
        )}
        <Alert severity="info">
          Only overall inspection metadata is editable here. Per-item received/accepted/rejected
          quantities are locked once the goods receipt is created so PO delivery counts stay
          consistent.
        </Alert>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Inspection Details
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth required disabled={readOnly}>
                <InputLabel>Inspection Type</InputLabel>
                <Select
                  value={inspectionType}
                  onChange={(e) =>
                    setInspectionType(
                      e.target.value as 'VENDOR_SITE' | 'DELIVERY_SITE' | 'THIRD_PARTY'
                    )
                  }
                  label="Inspection Type"
                >
                  <MenuItem value="VENDOR_SITE">At Vendor Site</MenuItem>
                  <MenuItem value="DELIVERY_SITE">At Delivery Site</MenuItem>
                  <MenuItem value="THIRD_PARTY">Third Party</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Inspection Date"
                type="date"
                value={inspectionDate}
                onChange={(e) => setInspectionDate(e.target.value)}
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
                disabled={readOnly}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Inspection Location"
                value={inspectionLocation}
                onChange={(e) => setInspectionLocation(e.target.value)}
                fullWidth
                required
                disabled={readOnly}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Overall Notes"
                value={overallNotes}
                onChange={(e) => setOverallNotes(e.target.value)}
                fullWidth
                multiline
                rows={3}
                disabled={readOnly}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Issues Summary"
                value={issuesSummary}
                onChange={(e) => setIssuesSummary(e.target.value)}
                fullWidth
                multiline
                rows={2}
                placeholder="Summarise any damage, shortfall, or defects observed."
                disabled={readOnly}
              />
            </Grid>
          </Grid>
        </Paper>

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button
            onClick={() => router.push(`/procurement/goods-receipts/${grId}`)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || readOnly}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
