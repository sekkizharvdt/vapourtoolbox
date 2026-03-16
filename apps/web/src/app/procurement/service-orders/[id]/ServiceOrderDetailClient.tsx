'use client';

/**
 * Service Order Detail Page
 *
 * Shows service order details with status timeline and transition actions.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Chip,
  Button,
  CircularProgress,
  TextField,
  Snackbar,
  Alert,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useRouter, useParams } from 'next/navigation';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { SERVICE_ORDER_STATUS_LABELS, SERVICE_ORDER_STATUS_COLORS } from '@vapour/types';
import type { ServiceOrder, ServiceOrderStatus } from '@vapour/types';
import {
  getServiceOrderById,
  updateServiceOrderStatus,
  updateServiceOrder,
} from '@/lib/procurement/serviceOrder';
import { serviceOrderStateMachine } from '@/lib/workflow/stateMachines';

const STATUS_STEPS: ServiceOrderStatus[] = [
  'DRAFT',
  'SAMPLE_SENT',
  'IN_PROGRESS',
  'RESULTS_RECEIVED',
  'UNDER_REVIEW',
  'COMPLETED',
];

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1">{value || '-'}</Typography>
    </Grid>
  );
}

export default function ServiceOrderDetailClient() {
  const router = useRouter();
  const params = useParams();
  const soId = params.id as string;
  const { user } = useAuth();
  const { db } = getFirebase();

  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [resultSummary, setResultSummary] = useState('');
  const [remarks, setRemarks] = useState('');
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({ open: false, message: '', severity: 'success' });

  const loadOrder = useCallback(async () => {
    if (!db || !soId) return;
    try {
      const result = await getServiceOrderById(db, soId);
      setOrder(result);
      if (result) {
        setResultSummary(result.resultSummary ?? '');
        setRemarks(result.remarks ?? '');
      }
    } catch (error) {
      console.error('Error loading service order:', error);
    } finally {
      setLoading(false);
    }
  }, [db, soId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const handleStatusTransition = async (targetStatus: ServiceOrderStatus) => {
    if (!db || !user?.uid || !order) return;
    setTransitioning(true);
    try {
      const updates: Partial<ServiceOrder> = {};
      if (resultSummary.trim() && targetStatus === 'COMPLETED') {
        updates.resultSummary = resultSummary.trim();
      }
      if (remarks.trim()) {
        updates.remarks = remarks.trim();
      }

      await updateServiceOrderStatus(db, soId, targetStatus, user.uid, updates);
      setSnackbar({
        open: true,
        message: `Status updated to ${SERVICE_ORDER_STATUS_LABELS[targetStatus]}`,
        severity: 'success',
      });
      await loadOrder();
    } catch (error) {
      setSnackbar({
        open: true,
        message: error instanceof Error ? error.message : 'Failed to update status',
        severity: 'error',
      });
    } finally {
      setTransitioning(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!db || !user?.uid) return;
    try {
      await updateServiceOrder(
        db,
        soId,
        {
          ...(resultSummary.trim() && { resultSummary: resultSummary.trim() }),
          ...(remarks.trim() && { remarks: remarks.trim() }),
        },
        user.uid
      );
      setSnackbar({ open: true, message: 'Details saved', severity: 'success' });
    } catch (error) {
      console.error('Error saving details:', error);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!order) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <Typography color="text.secondary">Service order not found</Typography>
        <Button onClick={() => router.push('/procurement/service-orders')} sx={{ mt: 2 }}>
          Back to Service Orders
        </Button>
      </Box>
    );
  }

  const availableTransitions = serviceOrderStateMachine.getAvailableTransitions(order.status);
  const isTerminal = serviceOrderStateMachine.isTerminal(order.status);
  const currentStepIndex = STATUS_STEPS.indexOf(order.status);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => router.push('/procurement/service-orders')}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h5" component="h1">
              {order.number}
            </Typography>
            <Chip
              label={SERVICE_ORDER_STATUS_LABELS[order.status]}
              size="small"
              color={
                SERVICE_ORDER_STATUS_COLORS[order.status] as
                  | 'default'
                  | 'info'
                  | 'warning'
                  | 'success'
                  | 'error'
              }
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            {order.serviceName} &mdash; {order.vendorName}
          </Typography>
        </Box>
      </Box>

      {/* Status Stepper */}
      {order.status !== 'CANCELLED' && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Stepper activeStep={currentStepIndex} alternativeLabel>
            {STATUS_STEPS.map((step) => (
              <Step key={step} completed={STATUS_STEPS.indexOf(step) < currentStepIndex}>
                <StepLabel>{SERVICE_ORDER_STATUS_LABELS[step]}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Paper>
      )}

      {/* Details */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Service Order Details
        </Typography>
        <Grid container spacing={2}>
          <DetailRow label="SO Number" value={order.number} />
          <DetailRow label="PO Number" value={order.poNumber} />
          <DetailRow label="Vendor" value={order.vendorName} />
          <DetailRow label="Project" value={order.projectName} />
          <DetailRow label="Service" value={order.serviceName} />
          <DetailRow label="Service Code" value={order.serviceCode} />
          <DetailRow label="Category" value={order.serviceCategory} />
          <DetailRow
            label="Est. Turnaround"
            value={
              order.estimatedTurnaroundDays ? `${order.estimatedTurnaroundDays} days` : undefined
            }
          />
          {order.description && (
            <Grid size={12}>
              <Typography variant="caption" color="text.secondary">
                Description
              </Typography>
              <Typography variant="body1">{order.description}</Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Sample Details */}
      {order.sampleDetails && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Sample Details
          </Typography>
          <Grid container spacing={2}>
            <DetailRow label="Sample ID" value={order.sampleDetails.sampleId} />
            <DetailRow label="Sample Description" value={order.sampleDetails.sampleDescription} />
          </Grid>
        </Paper>
      )}

      {/* Results & Notes */}
      {!isTerminal && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Results & Notes
          </Typography>
          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField
                label="Result Summary"
                value={resultSummary}
                onChange={(e) => setResultSummary(e.target.value)}
                fullWidth
                multiline
                rows={3}
                placeholder="Summary of test results or service deliverables..."
              />
            </Grid>
            <Grid size={12}>
              <TextField
                label="Remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                fullWidth
                multiline
                rows={2}
                placeholder="Any additional notes..."
              />
            </Grid>
            <Grid size={12}>
              <Button variant="outlined" size="small" onClick={handleSaveDetails}>
                Save Notes
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Completed Results */}
      {isTerminal && (order.resultSummary || order.remarks) && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Results
          </Typography>
          <Grid container spacing={2}>
            {order.resultSummary && (
              <Grid size={12}>
                <Typography variant="caption" color="text.secondary">
                  Result Summary
                </Typography>
                <Typography variant="body1">{order.resultSummary}</Typography>
              </Grid>
            )}
            {order.remarks && (
              <Grid size={12}>
                <Typography variant="caption" color="text.secondary">
                  Remarks
                </Typography>
                <Typography variant="body1">{order.remarks}</Typography>
              </Grid>
            )}
          </Grid>
        </Paper>
      )}

      {/* Actions */}
      {!isTerminal && availableTransitions.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Actions
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {availableTransitions
              .filter((t) => t !== 'CANCELLED')
              .map((targetStatus) => (
                <Button
                  key={targetStatus}
                  variant="contained"
                  onClick={() => handleStatusTransition(targetStatus)}
                  disabled={transitioning}
                >
                  {SERVICE_ORDER_STATUS_LABELS[targetStatus]}
                </Button>
              ))}
            {availableTransitions.includes('CANCELLED') && (
              <Button
                variant="outlined"
                color="error"
                onClick={() => handleStatusTransition('CANCELLED')}
                disabled={transitioning}
              >
                Cancel
              </Button>
            )}
          </Box>
        </Paper>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
