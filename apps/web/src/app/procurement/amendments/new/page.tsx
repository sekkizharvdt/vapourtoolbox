'use client';

/**
 * Create PO Amendment Page
 *
 * Create an amendment for an approved Purchase Order. PO selection lives here;
 * the change set is captured by the shared <AmendmentForm /> (also used by the
 * edit route).
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
import { ArrowBack as ArrowBackIcon, Home as HomeIcon } from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import type { PurchaseOrder, PurchaseOrderChange } from '@vapour/types';
import { listPOs } from '@/lib/procurement/purchaseOrderService';
import { createAmendment } from '@/lib/procurement/amendment';
import { getFirebase } from '@/lib/firebase';
import { formatCurrency } from '@/lib/procurement/purchaseOrderHelpers';
import { AmendmentForm } from '@/components/procurement/AmendmentForm';

export default function NewAmendmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, claims } = useAuth();
  const tenantId = claims?.tenantId || 'default-entity';
  const preselectedPoId = searchParams.get('poId');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [creating, setCreating] = useState(false);

  // PO Selection
  const [availablePOs, setAvailablePOs] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  // Load available POs
  useEffect(() => {
    loadAvailablePOs();
  }, []);

  // Load preselected PO
  useEffect(() => {
    if (preselectedPoId && availablePOs.length > 0) {
      const po = availablePOs.find((p) => p.id === preselectedPoId);
      if (po) {
        setSelectedPO(po);
      }
    }
  }, [preselectedPoId, availablePOs]);

  const loadAvailablePOs = async () => {
    setLoading(true);
    try {
      const pos = await listPOs({});
      // Filter to approved/issued POs that can be amended
      const eligiblePOs = pos.filter((po) =>
        ['APPROVED', 'ISSUED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(po.status)
      );
      setAvailablePOs(eligiblePOs);
    } catch (err) {
      console.error('[NewAmendmentPage] Error loading POs:', err);
      setLoadError('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const handlePOSelect = useCallback((po: PurchaseOrder | null) => {
    setSelectedPO(po);
    setSaveError('');
  }, []);

  const handleCreate = async (reason: string, changes: PurchaseOrderChange[]) => {
    if (!user || !selectedPO) return;

    setCreating(true);
    setSaveError('');
    try {
      const { db } = getFirebase();
      const amendmentId = await createAmendment(
        db,
        selectedPO.id,
        changes,
        reason,
        user.uid,
        user.displayName || 'Unknown',
        tenantId
      );
      router.push(`/procurement/amendments/${amendmentId}`);
    } catch (err) {
      console.error('[NewAmendmentPage] Error creating amendment:', err);
      setSaveError('Failed to create amendment. Please try again.');
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
            { label: 'PO Amendments', href: '/procurement/amendments' },
            { label: 'New' },
          ]}
        />

        {/* Header */}
        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push('/procurement/amendments')}
            sx={{ mb: 1 }}
          >
            Back to Amendments
          </Button>
          <Typography variant="h4" gutterBottom>
            Create PO Amendment
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create an amendment to modify an approved purchase order
          </Typography>
        </Box>

        {loadError && <Alert severity="error">{loadError}</Alert>}

        {/* PO Selection */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Select Purchase Order
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
                    Current Total
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
          <AmendmentForm
            po={selectedPO}
            submitting={creating}
            submitLabel="Create Amendment"
            externalError={saveError}
            onCancel={() => router.push('/procurement/amendments')}
            onSubmit={handleCreate}
          />
        )}
      </Stack>
    </Box>
  );
}
