'use client';

/**
 * Create Work Completion Certificate Page
 *
 * Create a WCC from a Purchase Order
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
  FormControlLabel,
  Checkbox,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import type { PurchaseOrder } from '@vapour/types';
import { listPOs } from '@/lib/procurement/purchaseOrderService';
import { createWorkCompletionCertificate } from '@/lib/procurement/workCompletionService';
import { formatCurrency } from '@/lib/procurement/purchaseOrderHelpers';

const DEFAULT_CERTIFICATE_TEXT = `This is to certify that all work and deliverables under the referenced Purchase Order have been completed satisfactorily.

The vendor has fulfilled all contractual obligations and the delivered goods/services meet the specified requirements.

This certificate is issued as confirmation of work completion for record purposes.`;

export default function NewWorkCompletionPage() {
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
  const [workDescription, setWorkDescription] = useState('');
  const [completionDate, setCompletionDate] = useState(() => {
    const dateStr = new Date().toISOString().split('T')[0];
    return dateStr ?? '';
  });
  const [allItemsDelivered, setAllItemsDelivered] = useState(true);
  const [allItemsAccepted, setAllItemsAccepted] = useState(true);
  const [allPaymentsCompleted, setAllPaymentsCompleted] = useState(false);
  const [certificateText, setCertificateText] = useState(DEFAULT_CERTIFICATE_TEXT);
  const [remarks, setRemarks] = useState('');

  // Load available POs
  useEffect(() => {
    loadAvailablePOs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // Load POs that are in progress or completed (eligible for WCCs)
      const pos = await listPOs({});
      const eligiblePOs = pos.filter((po) =>
        ['ISSUED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'COMPLETED'].includes(po.status)
      );
      setAvailablePOs(eligiblePOs);
    } catch (err) {
      console.error('[NewWorkCompletionPage] Error loading POs:', err);
      setError('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  const handlePOSelect = useCallback((po: PurchaseOrder | null) => {
    setSelectedPO(po);
    if (po) {
      // Pre-fill work description from PO description
      setWorkDescription(po.description || `Work under ${po.number}`);
    }
  }, []);

  const handleCreateWCC = async () => {
    if (!user || !selectedPO) return;

    // Validation
    if (!workDescription.trim()) {
      setError('Work description is required');
      return;
    }

    if (!certificateText.trim()) {
      setError('Certificate text is required');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const wccId = await createWorkCompletionCertificate(
        {
          purchaseOrderId: selectedPO.id,
          projectId: selectedPO.projectIds?.[0] || '',
          projectName: selectedPO.projectNames?.[0] || '',
          workDescription,
          completionDate: new Date(completionDate),
          allItemsDelivered,
          allItemsAccepted,
          allPaymentsCompleted,
          certificateText,
          remarks: remarks || undefined,
        },
        user.uid,
        user.displayName || 'Unknown'
      );

      router.push(`/procurement/work-completion/${wccId}`);
    } catch (err) {
      console.error('[NewWorkCompletionPage] Error creating WCC:', err);
      setError('Failed to create work completion certificate. Please try again.');
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
            href="/procurement/work-completion"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              router.push('/procurement/work-completion');
            }}
            sx={{ cursor: 'pointer' }}
          >
            Work Completion
          </Link>
          <Typography color="text.primary">New</Typography>
        </Breadcrumbs>

        {/* Header */}
        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push('/procurement/work-completion')}
            sx={{ mb: 1 }}
          >
            Back to Work Completion Certificates
          </Button>
          <Typography variant="h4" gutterBottom>
            Create Work Completion Certificate
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Issue a work completion certificate for a Purchase Order
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

        {selectedPO && (
          <>
            {/* Work Details */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Work Details
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Grid container spacing={3}>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Work Description"
                    value={workDescription}
                    onChange={(e) => setWorkDescription(e.target.value)}
                    fullWidth
                    required
                    multiline
                    rows={3}
                    placeholder="Describe the work that was completed..."
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Completion Date"
                    type="date"
                    value={completionDate}
                    onChange={(e) => setCompletionDate(e.target.value)}
                    fullWidth
                    required
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </Paper>

            {/* Completion Status */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Completion Status
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Stack spacing={1}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={allItemsDelivered}
                      onChange={(e) => setAllItemsDelivered(e.target.checked)}
                    />
                  }
                  label="All items have been delivered"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={allItemsAccepted}
                      onChange={(e) => setAllItemsAccepted(e.target.checked)}
                    />
                  }
                  label="All items have been accepted (passed inspection)"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={allPaymentsCompleted}
                      onChange={(e) => setAllPaymentsCompleted(e.target.checked)}
                    />
                  }
                  label="All payments have been completed"
                />
              </Stack>
            </Paper>

            {/* Certificate Text */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Certificate Text
              </Typography>
              <Divider sx={{ my: 2 }} />
              <TextField
                value={certificateText}
                onChange={(e) => setCertificateText(e.target.value)}
                fullWidth
                required
                multiline
                rows={8}
                placeholder="Enter the certificate text..."
              />
            </Paper>

            {/* Remarks */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Remarks (Optional)
              </Typography>
              <Divider sx={{ my: 2 }} />
              <TextField
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                fullWidth
                multiline
                rows={3}
                placeholder="Any additional remarks..."
              />
            </Paper>

            {/* Actions */}
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button
                onClick={() => router.push('/procurement/work-completion')}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                startIcon={creating ? <CircularProgress size={20} /> : <SaveIcon />}
                onClick={handleCreateWCC}
                disabled={creating}
              >
                {creating ? 'Creating...' : 'Create Certificate'}
              </Button>
            </Stack>
          </>
        )}
      </Stack>
    </Box>
  );
}
