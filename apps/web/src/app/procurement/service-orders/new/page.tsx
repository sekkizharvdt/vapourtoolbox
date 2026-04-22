'use client';

/**
 * Create Service Order Page
 *
 * Create a service order from an approved / issued / in-progress PO.
 * Parallel to Goods Receipts for materials — tracks the execution of a
 * procured service (lab tests, calibration, consulting, etc.).
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Autocomplete,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import type { PurchaseOrder, PurchaseOrderItem } from '@vapour/types';
import { listPOs, getPOItems } from '@/lib/procurement/purchaseOrderService';
import { createServiceOrder } from '@/lib/procurement/serviceOrder';
import { getFirebase } from '@/lib/firebase';
import { formatCurrency } from '@/lib/procurement/purchaseOrderHelpers';

export default function NewServiceOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const preselectedPoId = searchParams.get('poId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  // PO selection — restricted to POs that can still accept service execution
  const [availablePOs, setAvailablePOs] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [poItems, setPOItems] = useState<PurchaseOrderItem[]>([]);
  const [selectedPOItem, setSelectedPOItem] = useState<PurchaseOrderItem | null>(null);

  // Service details
  const [serviceName, setServiceName] = useState('');
  const [serviceCategory, setServiceCategory] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedTurnaroundDays, setEstimatedTurnaroundDays] = useState('');
  const [expectedCompletionDate, setExpectedCompletionDate] = useState('');

  // Load available POs on mount
  useEffect(() => {
    loadAvailablePOs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply preselected PO after POs load
  useEffect(() => {
    if (preselectedPoId && availablePOs.length > 0) {
      const po = availablePOs.find((p) => p.id === preselectedPoId);
      if (po) {
        handlePOSelect(po);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedPoId, availablePOs]);

  const loadAvailablePOs = async () => {
    setLoading(true);
    try {
      const pos = await listPOs({});
      // Only POs that are live (not cancelled / not already fully done) make sense
      // as the source of a service order. Matches the WCC filter set closely.
      const eligiblePOs = pos.filter((po) =>
        ['APPROVED', 'ISSUED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'AMENDED'].includes(po.status)
      );
      setAvailablePOs(eligiblePOs);
    } catch (err) {
      console.error('[NewServiceOrderPage] Error loading POs:', err);
      setError('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const handlePOSelect = useCallback(async (po: PurchaseOrder | null) => {
    setSelectedPO(po);
    setSelectedPOItem(null);
    setPOItems([]);
    if (!po) return;

    try {
      const items = await getPOItems(po.id);
      // Prefer items explicitly marked as services; fall back to all items so the
      // user can still pick even when `itemType` is missing on older documents.
      const serviceItems = items.filter((i) => i.itemType === 'SERVICE');
      setPOItems(serviceItems.length > 0 ? serviceItems : items);
    } catch (err) {
      console.error('[NewServiceOrderPage] Error loading PO items:', err);
    }
  }, []);

  // When a PO line item is selected, prefill service details from it
  useEffect(() => {
    if (selectedPOItem) {
      setServiceName(selectedPOItem.serviceName || selectedPOItem.description || '');
      setServiceCategory(selectedPOItem.serviceCategory || '');
      if (selectedPOItem.description && !description) {
        setDescription(selectedPOItem.description);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPOItem]);

  const handleCreate = async () => {
    if (!user || !selectedPO) return;

    if (!serviceName.trim()) {
      setError('Service name is required');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const { db } = getFirebase();
      const turnaround = estimatedTurnaroundDays ? Number(estimatedTurnaroundDays) : undefined;
      if (estimatedTurnaroundDays && (!Number.isFinite(turnaround) || (turnaround ?? 0) < 0)) {
        setError('Estimated turnaround days must be a non-negative number');
        setCreating(false);
        return;
      }

      const created = await createServiceOrder(
        db,
        {
          purchaseOrderId: selectedPO.id,
          poNumber: selectedPO.number,
          ...(selectedPOItem && { purchaseOrderItemId: selectedPOItem.id }),
          vendorId: selectedPO.vendorId,
          vendorName: selectedPO.vendorName,
          ...(selectedPO.projectIds?.[0] && { projectId: selectedPO.projectIds[0] }),
          ...(selectedPO.projectNames?.[0] && { projectName: selectedPO.projectNames[0] }),
          ...(selectedPOItem?.serviceId && { serviceId: selectedPOItem.serviceId }),
          ...(selectedPOItem?.serviceCode && { serviceCode: selectedPOItem.serviceCode }),
          serviceName: serviceName.trim(),
          ...(serviceCategory.trim() && { serviceCategory: serviceCategory.trim() }),
          ...(description.trim() && { description: description.trim() }),
          ...(turnaround !== undefined && { estimatedTurnaroundDays: turnaround }),
          ...(expectedCompletionDate && {
            expectedCompletionDate: new Date(expectedCompletionDate),
          }),
        },
        user.uid,
        user.displayName || 'Unknown'
      );

      router.push(`/procurement/service-orders/${created.id}`);
    } catch (err) {
      console.error('[NewServiceOrderPage] Error creating service order:', err);
      setError('Failed to create service order. Please try again.');
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Breadcrumbs */}
        <PageBreadcrumbs
          items={[
            { label: 'Procurement', href: '/procurement', icon: <HomeIcon fontSize="small" /> },
            { label: 'Service Orders', href: '/procurement/service-orders' },
            { label: 'New' },
          ]}
        />

        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push('/procurement/service-orders')}
            sx={{ mb: 1 }}
          >
            Back to Service Orders
          </Button>
          <Typography variant="h4" gutterBottom>
            Create Service Order
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Track the execution of a procured service — sample submission, progress, and results
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {/* PO Selection */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Source Purchase Order
          </Typography>
          <Divider sx={{ my: 2 }} />

          <Autocomplete
            options={availablePOs}
            value={selectedPO}
            onChange={(_, newValue) => handlePOSelect(newValue)}
            getOptionLabel={(option) =>
              `${option.number} - ${option.vendorName} (${formatCurrency(option.grandTotal, option.currency)})`
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Purchase Order"
                placeholder="Search by PO number or vendor..."
                required
              />
            )}
            isOptionEqualToValue={(option, value) => option.id === value.id}
          />

          {selectedPO && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Vendor
                  </Typography>
                  <Typography variant="body1">{selectedPO.vendorName}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Project
                  </Typography>
                  <Typography variant="body1">{selectedPO.projectNames?.[0] || '-'}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    PO Total
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {formatCurrency(selectedPO.grandTotal, selectedPO.currency)}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </Paper>

        {selectedPO && (
          <>
            {/* Optional PO line-item linkage */}
            {poItems.length > 0 && (
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Link to PO Line Item (optional)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  If this service order covers a specific PO line item, link it here so the service
                  order picks up the service catalog details.
                </Typography>
                <Autocomplete
                  options={poItems}
                  value={selectedPOItem}
                  onChange={(_, newValue) => setSelectedPOItem(newValue)}
                  getOptionLabel={(option) =>
                    `Line ${option.lineNumber} — ${option.serviceName || option.description}`
                  }
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="PO Line Item"
                      placeholder="Select a line item..."
                    />
                  )}
                />
              </Paper>
            )}

            {/* Service Details */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Service Details
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 8 }}>
                  <TextField
                    label="Service Name"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    fullWidth
                    required
                    placeholder="e.g. TDS test, calibration of flow meter"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Service Category"
                    value={serviceCategory}
                    onChange={(e) => setServiceCategory(e.target.value)}
                    fullWidth
                    placeholder="e.g. Lab testing, Calibration"
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    fullWidth
                    multiline
                    rows={3}
                    placeholder="Scope of service, sample details, acceptance criteria..."
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Estimated Turnaround (days)"
                    type="number"
                    value={estimatedTurnaroundDays}
                    onChange={(e) => setEstimatedTurnaroundDays(e.target.value)}
                    fullWidth
                    inputProps={{ min: 0 }}
                    placeholder="e.g. 7"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Expected Completion Date"
                    type="date"
                    value={expectedCompletionDate}
                    onChange={(e) => setExpectedCompletionDate(e.target.value)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </Paper>

            <Alert severity="info">
              The service order is created in <strong>Draft</strong> status. You can then mark
              samples as sent, results as received, and close out the service order from the detail
              page.
            </Alert>

            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button
                onClick={() => router.push('/procurement/service-orders')}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                startIcon={creating ? <CircularProgress size={20} /> : <SaveIcon />}
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? 'Creating...' : 'Create Service Order'}
              </Button>
            </Stack>
          </>
        )}
      </Stack>
    </Box>
  );
}
