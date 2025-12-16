'use client';

/**
 * Work Completion Certificate Detail Page
 *
 * View work completion certificate details
 */

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Box,
  Stack,
  CircularProgress,
  Alert,
  Button,
  Paper,
  Typography,
  Chip,
  Grid,
  Divider,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Home as HomeIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Print as PrintIcon,
} from '@mui/icons-material';
import type { WorkCompletionCertificate } from '@vapour/types';
import { getWCCById } from '@/lib/procurement/workCompletionService';
import { getCompletionStatus } from '@/lib/procurement/workCompletionHelpers';
import { formatDate } from '@/lib/utils/formatters';

export default function WCCDetailClient() {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wcc, setWcc] = useState<WorkCompletionCertificate | null>(null);
  const [wccId, setWccId] = useState<string | null>(null);

  // Handle static export - extract actual ID from pathname on client side
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/\/procurement\/work-completion\/([^/]+)(?:\/|$)/);
      const extractedId = match?.[1];
      if (extractedId && extractedId !== 'placeholder') {
        setWccId(extractedId);
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (wccId) {
      loadWCC();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wccId]);

  const loadWCC = async () => {
    if (!wccId) return;
    setLoading(true);
    setError('');
    try {
      const wccData = await getWCCById(wccId);

      if (!wccData) {
        setError('Work Completion Certificate not found');
        return;
      }

      setWcc(wccData);
    } catch (err) {
      console.error('[WCCDetailClient] Error loading WCC:', err);
      setError('Failed to load work completion certificate');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !wcc) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Work Completion Certificate not found'}</Alert>
        <Button onClick={() => router.push('/procurement/work-completion')} sx={{ mt: 2 }}>
          Back to Work Completion Certificates
        </Button>
      </Box>
    );
  }

  const status = getCompletionStatus(wcc);

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Breadcrumbs sx={{ mb: 2 }}>
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
            <Typography color="text.primary">{wcc.number}</Typography>
          </Breadcrumbs>

          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Typography variant="h4">{wcc.number}</Typography>
                <Chip label={status.label} color={status.color} size="medium" />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                PO: {wcc.poNumber} • Vendor: {wcc.vendorName} • Project: {wcc.projectName}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()}>
                Print
              </Button>
            </Stack>
          </Stack>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {/* WCC Details */}
        <Grid container spacing={3}>
          {/* Left Column - Certificate Content */}
          <Grid size={{ xs: 12, md: 8 }}>
            {/* Work Description */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Work Description
              </Typography>
              <Typography variant="body1">{wcc.workDescription}</Typography>
            </Paper>

            {/* Certificate Text */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Certificate Text
              </Typography>
              <Box
                sx={{
                  p: 3,
                  bgcolor: 'background.default',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {wcc.certificateText}
                </Typography>
              </Box>
            </Paper>

            {/* Remarks */}
            {wcc.remarks && (
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Remarks
                </Typography>
                <Typography variant="body1">{wcc.remarks}</Typography>
              </Paper>
            )}
          </Grid>

          {/* Right Column - Status & Details */}
          <Grid size={{ xs: 12, md: 4 }}>
            {/* Completion Status */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Completion Status
              </Typography>
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {wcc.allItemsDelivered ? (
                    <CheckCircleIcon color="success" />
                  ) : (
                    <CancelIcon color="error" />
                  )}
                  <Typography variant="body2">
                    All Items Delivered: {wcc.allItemsDelivered ? 'Yes' : 'No'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {wcc.allItemsAccepted ? (
                    <CheckCircleIcon color="success" />
                  ) : (
                    <CancelIcon color="error" />
                  )}
                  <Typography variant="body2">
                    All Items Accepted: {wcc.allItemsAccepted ? 'Yes' : 'No'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {wcc.allPaymentsCompleted ? (
                    <CheckCircleIcon color="success" />
                  ) : (
                    <CancelIcon color="error" />
                  )}
                  <Typography variant="body2">
                    All Payments Completed: {wcc.allPaymentsCompleted ? 'Yes' : 'No'}
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            {/* Details */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Details
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Completion Date
                  </Typography>
                  <Typography variant="body1">{formatDate(wcc.completionDate)}</Typography>
                </Box>
                <Divider />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Vendor
                  </Typography>
                  <Typography variant="body1">{wcc.vendorName}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Project
                  </Typography>
                  <Typography variant="body1">{wcc.projectName}</Typography>
                </Box>
                <Divider />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Purchase Order
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => router.push(`/procurement/pos/${wcc.purchaseOrderId}`)}
                  >
                    {wcc.poNumber}
                  </Button>
                </Box>
              </Stack>
            </Paper>

            {/* Timeline */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Timeline
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Issued At
                  </Typography>
                  <Typography variant="body1">{formatDate(wcc.issuedAt)}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Issued By
                  </Typography>
                  <Typography variant="body1">{wcc.issuedByName}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Created
                  </Typography>
                  <Typography variant="body1">{formatDate(wcc.createdAt)}</Typography>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Stack>
    </Box>
  );
}
