'use client';

/**
 * Create PO Amendment Page
 *
 * Create an amendment for an approved Purchase Order
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import type { PurchaseOrder, PurchaseOrderAmendment } from '@vapour/types';
import { listPOs } from '@/lib/procurement/purchaseOrderService';
import { createAmendment } from '@/lib/procurement/amendment';
import { getFirebase } from '@/lib/firebase';
import { formatCurrency } from '@/lib/procurement/purchaseOrderHelpers';

type AmendmentType = PurchaseOrderAmendment['amendmentType'];

export default function NewAmendmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const preselectedPoId = searchParams.get('poId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  // PO Selection
  const [availablePOs, setAvailablePOs] = useState<PurchaseOrder[]>([]);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  // Form fields
  const [amendmentType, setAmendmentType] = useState<AmendmentType>('GENERAL');
  const [reason, setReason] = useState('');
  const [changeDescription, setChangeDescription] = useState('');

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
      setError('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const handlePOSelect = useCallback((po: PurchaseOrder | null) => {
    setSelectedPO(po);
  }, []);

  const handleCreateAmendment = async () => {
    if (!user || !selectedPO) return;

    // Validation
    if (!reason.trim()) {
      setError('Reason for amendment is required');
      return;
    }

    if (!changeDescription.trim()) {
      setError('Change description is required');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const { db } = getFirebase();

      // Create a simple change object based on amendment type
      const categoryMap: Record<string, 'FINANCIAL' | 'SCHEDULE' | 'SCOPE' | 'TERMS'> = {
        QUANTITY_CHANGE: 'SCOPE',
        PRICE_CHANGE: 'FINANCIAL',
        TERMS_CHANGE: 'TERMS',
        DELIVERY_CHANGE: 'SCHEDULE',
        GENERAL: 'SCOPE',
      };

      const changes = [
        {
          field: 'general',
          fieldLabel: changeDescription,
          oldValue: 'See original PO',
          newValue: 'As per amendment',
          category: categoryMap[amendmentType] || 'SCOPE',
        },
      ];

      const amendmentId = await createAmendment(
        db,
        selectedPO.id,
        changes,
        reason,
        user.uid,
        user.displayName || 'Unknown'
      );

      router.push(`/procurement/amendments/${amendmentId}`);
    } catch (err) {
      console.error('[NewAmendmentPage] Error creating amendment:', err);
      setError('Failed to create amendment. Please try again.');
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

        {error && <Alert severity="error">{error}</Alert>}

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
          <>
            {/* Amendment Details */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Amendment Details
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth required>
                    <InputLabel>Amendment Type</InputLabel>
                    <Select
                      value={amendmentType}
                      onChange={(e) => setAmendmentType(e.target.value as AmendmentType)}
                      label="Amendment Type"
                    >
                      <MenuItem value="QUANTITY_CHANGE">Quantity Change</MenuItem>
                      <MenuItem value="PRICE_CHANGE">Price Change</MenuItem>
                      <MenuItem value="TERMS_CHANGE">Terms Change</MenuItem>
                      <MenuItem value="DELIVERY_CHANGE">Delivery Change</MenuItem>
                      <MenuItem value="GENERAL">General Amendment</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Reason for Amendment"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    fullWidth
                    required
                    multiline
                    rows={3}
                    placeholder="Explain why this amendment is needed..."
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Change Description"
                    value={changeDescription}
                    onChange={(e) => setChangeDescription(e.target.value)}
                    fullWidth
                    required
                    multiline
                    rows={4}
                    placeholder="Describe the specific changes to be made to the PO..."
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* Info */}
            <Alert severity="info">
              After creating the amendment, you can review it and submit it for approval. The
              amendment will be applied to the PO only after it is approved.
            </Alert>

            {/* Actions */}
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button onClick={() => router.push('/procurement/amendments')} disabled={creating}>
                Cancel
              </Button>
              <Button
                variant="contained"
                startIcon={creating ? <CircularProgress size={20} /> : <SaveIcon />}
                onClick={handleCreateAmendment}
                disabled={creating}
              >
                {creating ? 'Creating...' : 'Create Amendment'}
              </Button>
            </Stack>
          </>
        )}
      </Stack>
    </Box>
  );
}
