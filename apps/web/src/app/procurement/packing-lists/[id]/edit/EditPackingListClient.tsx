'use client';

/**
 * Edit Packing List Page
 *
 * Draft packing lists are editable: shipping details, delivery address,
 * instructions, and vendor attachments. Line items and quantities are
 * locked once the PL is created (changing those requires cancelling and
 * creating a new PL so the PO's remaining quantity stays consistent).
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
  Breadcrumbs,
  Link,
  IconButton,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Home as HomeIcon,
  Upload as UploadIcon,
  Delete as DeleteIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import type { PackingList } from '@vapour/types';
import {
  getPLById,
  updatePackingList,
  uploadPLAttachment,
  removePLAttachment,
} from '@/lib/procurement/packingListService';

/** Convert a Firestore Timestamp / Date / string to a YYYY-MM-DD input value. */
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

export default function EditPackingListClient() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const [plId, setPlId] = useState<string | null>(null);
  const [pl, setPL] = useState<PackingList | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Editable form fields
  const [numberOfPackages, setNumberOfPackages] = useState(1);
  const [totalWeight, setTotalWeight] = useState<string>('');
  const [totalVolume, setTotalVolume] = useState<string>('');
  const [shippingMethod, setShippingMethod] = useState<'' | 'AIR' | 'SEA' | 'ROAD' | 'COURIER'>('');
  const [shippingCompany, setShippingCompany] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [packingInstructions, setPackingInstructions] = useState('');
  const [handlingInstructions, setHandlingInstructions] = useState('');

  // Attachment state
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // Extract ID from URL
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/\/packing-lists\/([^/]+)\/edit/);
      const id = match?.[1];
      if (id && id !== 'placeholder') setPlId(id);
    }
  }, [pathname]);

  const loadPL = async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const data = await getPLById(id);
      if (!data) {
        setError('Packing list not found');
        return;
      }
      if (data.status !== 'DRAFT') {
        setError(
          `This packing list is ${data.status.toLowerCase()} and cannot be edited. Only draft packing lists are editable.`
        );
      }
      setPL(data);
      setNumberOfPackages(data.numberOfPackages);
      setTotalWeight(data.totalWeight?.toString() ?? '');
      setTotalVolume(data.totalVolume?.toString() ?? '');
      setShippingMethod(data.shippingMethod ?? '');
      setShippingCompany(data.shippingCompany ?? '');
      setTrackingNumber(data.trackingNumber ?? '');
      setEstimatedDeliveryDate(timestampToDateInput(data.estimatedDeliveryDate));
      setDeliveryAddress(data.deliveryAddress ?? '');
      setContactPerson(data.contactPerson ?? '');
      setContactPhone(data.contactPhone ?? '');
      setPackingInstructions(data.packingInstructions ?? '');
      setHandlingInstructions(data.handlingInstructions ?? '');
    } catch (err) {
      console.error('[EditPackingListClient] Error loading PL:', err);
      setError('Failed to load packing list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (plId) loadPL(plId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plId]);

  const handleSave = async () => {
    if (!user || !plId || !pl || pl.status !== 'DRAFT') return;

    if (!deliveryAddress.trim()) {
      setError('Delivery address is required');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await updatePackingList(
        plId,
        {
          numberOfPackages,
          totalWeight: totalWeight ? Number(totalWeight) : undefined,
          totalVolume: totalVolume ? Number(totalVolume) : undefined,
          shippingMethod: shippingMethod || null,
          shippingCompany,
          trackingNumber,
          estimatedDeliveryDate: estimatedDeliveryDate ? new Date(estimatedDeliveryDate) : null,
          deliveryAddress,
          contactPerson,
          contactPhone,
          packingInstructions,
          handlingInstructions,
        },
        user.uid
      );
      router.push(`/procurement/packing-lists/${plId}`);
    } catch (err) {
      console.error('[EditPackingListClient] Error saving:', err);
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!user || !plId || !files || files.length === 0) return;
    setUploadingAttachment(true);
    try {
      for (const file of Array.from(files)) {
        await uploadPLAttachment(plId, file, user.uid);
      }
      await loadPL(plId);
    } catch (err) {
      console.error('[EditPackingListClient] Error uploading attachment:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload attachment');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleRemoveAttachment = async (index: number) => {
    if (!user || !plId) return;
    try {
      await removePLAttachment(plId, index, user.uid);
      await loadPL(plId);
    } catch (err) {
      console.error('[EditPackingListClient] Error removing attachment:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove attachment');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!pl) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Packing list not found'}</Alert>
        <Button onClick={() => router.push('/procurement/packing-lists')} sx={{ mt: 2 }}>
          Back to Packing Lists
        </Button>
      </Box>
    );
  }

  const isDraft = pl.status === 'DRAFT';

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Breadcrumbs sx={{ mb: 0 }}>
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
          <Link
            color="inherit"
            href="/procurement/packing-lists"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              router.push('/procurement/packing-lists');
            }}
            sx={{ cursor: 'pointer' }}
          >
            Packing Lists
          </Link>
          <Link
            color="inherit"
            href={`/procurement/packing-lists/${plId}`}
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              router.push(`/procurement/packing-lists/${plId}`);
            }}
            sx={{ cursor: 'pointer' }}
          >
            {pl.number}
          </Link>
          <Typography color="text.primary">Edit</Typography>
        </Breadcrumbs>

        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push(`/procurement/packing-lists/${plId}`)}
            sx={{ mb: 1 }}
          >
            Back to Packing List
          </Button>
          <Typography variant="h4" gutterBottom>
            Edit Packing List {pl.number}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            PO {pl.poNumber} · {pl.vendorName}
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}
        {!isDraft && (
          <Alert severity="warning">
            Packing list status is <strong>{pl.status}</strong>. Fields are read-only.
          </Alert>
        )}

        {/* Shipping Details */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Shipping Details
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                label="Number of Packages"
                type="number"
                value={numberOfPackages}
                onChange={(e) => setNumberOfPackages(Number(e.target.value))}
                fullWidth
                required
                inputProps={{ min: 1 }}
                disabled={!isDraft}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth disabled={!isDraft}>
                <InputLabel>Shipping Method</InputLabel>
                <Select
                  value={shippingMethod}
                  onChange={(e) =>
                    setShippingMethod(e.target.value as '' | 'AIR' | 'SEA' | 'ROAD' | 'COURIER')
                  }
                  label="Shipping Method"
                >
                  <MenuItem value="">Not specified</MenuItem>
                  <MenuItem value="AIR">Air Freight</MenuItem>
                  <MenuItem value="SEA">Sea Freight</MenuItem>
                  <MenuItem value="ROAD">Road Transport</MenuItem>
                  <MenuItem value="COURIER">Courier</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                label="Total Weight (kg)"
                type="number"
                value={totalWeight}
                onChange={(e) => setTotalWeight(e.target.value)}
                fullWidth
                disabled={!isDraft}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                label="Total Volume (m³)"
                type="number"
                value={totalVolume}
                onChange={(e) => setTotalVolume(e.target.value)}
                fullWidth
                disabled={!isDraft}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Shipping Company"
                value={shippingCompany}
                onChange={(e) => setShippingCompany(e.target.value)}
                fullWidth
                disabled={!isDraft}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Tracking Number"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                fullWidth
                disabled={!isDraft}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Estimated Delivery Date"
                type="date"
                value={estimatedDeliveryDate}
                onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
                disabled={!isDraft}
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Delivery Address */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Delivery Address
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={3}>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Delivery Address"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                fullWidth
                required
                multiline
                rows={3}
                disabled={!isDraft}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Contact Person"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                fullWidth
                disabled={!isDraft}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Contact Phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                fullWidth
                disabled={!isDraft}
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Instructions */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Instructions
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Packing Instructions"
                value={packingInstructions}
                onChange={(e) => setPackingInstructions(e.target.value)}
                fullWidth
                multiline
                rows={3}
                disabled={!isDraft}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Handling Instructions"
                value={handlingInstructions}
                onChange={(e) => setHandlingInstructions(e.target.value)}
                fullWidth
                multiline
                rows={3}
                disabled={!isDraft}
              />
            </Grid>
          </Grid>
        </Paper>

        {/* Vendor Attachments */}
        <Paper sx={{ p: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <UploadIcon color="primary" />
            <Typography variant="h6">Vendor Attachments</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Vendor&apos;s own packing list, shipping documents, and related files.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
            <Button
              component="label"
              variant="outlined"
              startIcon={<UploadIcon />}
              disabled={!isDraft || uploadingAttachment}
            >
              {uploadingAttachment ? 'Uploading…' : 'Upload File'}
              <input
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  handleUpload(e.target.files);
                  e.target.value = '';
                }}
              />
            </Button>
          </Stack>
          {pl.attachmentUrls && pl.attachmentUrls.length > 0 ? (
            <Stack spacing={1} sx={{ mt: 2 }}>
              {pl.attachmentUrls.map((url, idx) => (
                <Paper
                  key={`${url}-${idx}`}
                  variant="outlined"
                  sx={{ p: 1.5, display: 'flex', gap: 2, alignItems: 'center' }}
                >
                  <FileIcon color="action" />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Link
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}
                    >
                      {pl.attachmentFileNames?.[idx] || `Attachment ${idx + 1}`}
                    </Link>
                  </Box>
                  {isDraft && (
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleRemoveAttachment(idx)}
                      aria-label="Remove"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Paper>
              ))}
            </Stack>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              No attachments yet.
            </Typography>
          )}
        </Paper>

        <Stack direction="row" spacing={2} justifyContent="flex-end">
          <Button
            onClick={() => router.push(`/procurement/packing-lists/${plId}`)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || !isDraft}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
