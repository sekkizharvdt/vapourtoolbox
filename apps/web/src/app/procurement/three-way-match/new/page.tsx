'use client';

/**
 * Create Three-Way Match Page
 *
 * Select documents to perform three-way matching
 */

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  CircularProgress,
  Alert,
  Divider,
  Grid,
  Autocomplete,
  TextField,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CompareArrows as CompareArrowsIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import type { PurchaseOrder, GoodsReceipt } from '@vapour/types';
import { listPOs } from '@/lib/procurement/purchaseOrderService';
import { listGoodsReceipts } from '@/lib/procurement/goodsReceiptService';
import { performThreeWayMatch } from '@/lib/procurement/threeWayMatch';
import { getFirebase } from '@/lib/firebase';
import { formatCurrency } from '@/lib/procurement/purchaseOrderHelpers';
import { formatDate } from '@/lib/utils/formatters';

export default function NewThreeWayMatchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const preselectedPoId = searchParams.get('poId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  // Available documents
  const [availablePOs, setAvailablePOs] = useState<PurchaseOrder[]>([]);
  const [availableGRs, setAvailableGRs] = useState<GoodsReceipt[]>([]);

  // Selected documents
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [selectedGR, setSelectedGR] = useState<GoodsReceipt | null>(null);

  // Vendor bill info (manual entry for now)
  const [vendorBillId, setVendorBillId] = useState('');
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState('');

  // Load available POs
  useEffect(() => {
    loadAvailablePOs();
  }, []);

  // Load preselected PO
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
      // Filter to POs that have completed goods receipts
      const eligiblePOs = pos.filter((po) =>
        ['ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED'].includes(po.status)
      );
      setAvailablePOs(eligiblePOs);
    } catch (err) {
      console.error('[NewThreeWayMatchPage] Error loading POs:', err);
      setError('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const handlePOSelect = async (po: PurchaseOrder | null) => {
    setSelectedPO(po);
    setSelectedGR(null);

    if (!po) {
      setAvailableGRs([]);
      return;
    }

    try {
      // Load GRs for this PO
      const grs = await listGoodsReceipts({ purchaseOrderId: po.id });
      const completedGRs = grs.filter((gr) => gr.status === 'COMPLETED');
      setAvailableGRs(completedGRs);
    } catch (err) {
      console.error('[NewThreeWayMatchPage] Error loading GRs:', err);
      setError('Failed to load goods receipts');
    }
  };

  const handleCreateMatch = async () => {
    if (!user || !selectedPO || !selectedGR || !vendorBillId) return;

    setCreating(true);
    setError('');

    try {
      const { db } = getFirebase();
      const matchId = await performThreeWayMatch(
        db,
        selectedPO.id,
        selectedGR.id,
        vendorBillId,
        user.uid,
        user.displayName || 'Unknown'
      );

      router.push(`/procurement/three-way-match/${matchId}`);
    } catch (err) {
      console.error('[NewThreeWayMatchPage] Error creating match:', err);
      setError('Failed to perform three-way match. Please try again.');
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
            onClick={() => router.push('/procurement/three-way-match')}
            sx={{ mb: 1 }}
          >
            Back to Three-Way Match
          </Button>
          <Typography variant="h4" gutterBottom>
            New Three-Way Match
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Select a Purchase Order, Goods Receipt, and Vendor Bill to perform matching
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {/* Step 1: Select PO */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            1. Select Purchase Order
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
                    Total Amount
                  </Typography>
                  <Typography variant="body1" fontWeight="medium">
                    {formatCurrency(selectedPO.grandTotal, selectedPO.currency)}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </Paper>

        {/* Step 2: Select GR */}
        {selectedPO && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              2. Select Goods Receipt
            </Typography>
            <Divider sx={{ my: 2 }} />

            {availableGRs.length === 0 ? (
              <Alert severity="info">
                No completed goods receipts found for this PO. Please complete a goods receipt
                first.
              </Alert>
            ) : (
              <Autocomplete
                options={availableGRs}
                value={selectedGR}
                onChange={(_, newValue) => setSelectedGR(newValue)}
                getOptionLabel={(option) =>
                  `${option.number} - ${formatDate(option.inspectionDate)}`
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Goods Receipt"
                    placeholder="Select a goods receipt..."
                    required
                  />
                )}
                isOptionEqualToValue={(option, value) => option.id === value.id}
              />
            )}

            {selectedGR && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      Inspection Date
                    </Typography>
                    <Typography variant="body1">{formatDate(selectedGR.inspectionDate)}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      Inspected By
                    </Typography>
                    <Typography variant="body1">{selectedGR.inspectedByName}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      Overall Condition
                    </Typography>
                    <Typography variant="body1">{selectedGR.overallCondition}</Typography>
                  </Grid>
                </Grid>
              </Box>
            )}
          </Paper>
        )}

        {/* Step 3: Enter Vendor Bill */}
        {selectedGR && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              3. Vendor Bill Information
            </Typography>
            <Divider sx={{ my: 2 }} />

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Vendor Bill ID"
                  value={vendorBillId}
                  onChange={(e) => setVendorBillId(e.target.value)}
                  fullWidth
                  required
                  placeholder="Enter the vendor bill transaction ID"
                  helperText="The ID of the vendor bill transaction in accounting"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Vendor Invoice Number"
                  value={vendorInvoiceNumber}
                  onChange={(e) => setVendorInvoiceNumber(e.target.value)}
                  fullWidth
                  placeholder="Enter vendor's invoice number"
                  helperText="The invoice number from the vendor"
                />
              </Grid>
            </Grid>
          </Paper>
        )}

        {/* Actions */}
        {selectedGR && (
          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button onClick={() => router.push('/procurement/three-way-match')} disabled={creating}>
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={creating ? <CircularProgress size={20} /> : <CompareArrowsIcon />}
              onClick={handleCreateMatch}
              disabled={creating || !vendorBillId}
            >
              {creating ? 'Processing...' : 'Perform Three-Way Match'}
            </Button>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
