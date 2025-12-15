'use client';

/**
 * Purchase Request Detail Page
 *
 * View and manage a single Purchase Request
 */

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Box,
  Paper,
  Typography,
  Button,
  Stack,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Edit as EditIcon } from '@mui/icons-material';
import type { PurchaseRequest, PurchaseRequestItem } from '@vapour/types';
import { getPurchaseRequestById, getPurchaseRequestItems } from '@/lib/procurement/purchaseRequest';
import { formatDate } from '@/lib/utils/formatters';

export default function PRDetailPage() {
  const pathname = usePathname();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [pr, setPr] = useState<PurchaseRequest | null>(null);
  const [items, setItems] = useState<PurchaseRequestItem[]>([]);
  const [error, setError] = useState<string>('');
  const [prId, setPrId] = useState<string | null>(null);

  // Handle static export - extract actual ID from pathname on client side
  useEffect(() => {
    if (pathname) {
      const match = pathname.match(/\/procurement\/purchase-requests\/([^/]+)(?:\/|$)/);
      const extractedId = match?.[1];
      if (extractedId && extractedId !== 'placeholder') {
        setPrId(extractedId);
      }
    }
  }, [pathname]);

  useEffect(() => {
    if (prId) {
      loadPR();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prId]);

  const loadPR = async () => {
    if (!prId) return;
    setLoading(true);
    setError('');
    try {
      const [prData, itemsData] = await Promise.all([
        getPurchaseRequestById(prId),
        getPurchaseRequestItems(prId),
      ]);

      if (!prData) {
        setError('Purchase Request not found');
        return;
      }

      setPr(prData);
      setItems(itemsData);
    } catch (err) {
      console.error('[PRDetailPage] Error loading PR:', err);
      setError('Failed to load Purchase Request');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (
    status: string
  ): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case 'DRAFT':
        return 'default';
      case 'SUBMITTED':
        return 'info';
      case 'UNDER_REVIEW':
        return 'warning';
      case 'APPROVED':
        return 'success';
      case 'REJECTED':
        return 'error';
      case 'CONVERTED_TO_RFQ':
        return 'primary';
      default:
        return 'default';
    }
  };

  const getPriorityColor = (
    priority: string
  ): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (priority) {
      case 'URGENT':
        return 'error';
      case 'HIGH':
        return 'warning';
      case 'MEDIUM':
        return 'info';
      case 'LOW':
        return 'default';
      default:
        return 'default';
    }
  };

  // Check if PR can be edited (only DRAFT and REJECTED status can be edited)
  const canEdit = (status: string): boolean => {
    return status === 'DRAFT' || status === 'REJECTED';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !pr) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Purchase Request not found'}</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/procurement/purchase-requests')}
          sx={{ mt: 2 }}
        >
          Back to Purchase Requests
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => router.push('/procurement/purchase-requests')}
              sx={{ mb: 1 }}
            >
              Back to Purchase Requests
            </Button>
            <Typography variant="h4" gutterBottom>
              {pr.number}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label={pr.status.replace(/_/g, ' ')} color={getStatusColor(pr.status)} />
              <Chip label={pr.priority} color={getPriorityColor(pr.priority)} size="small" />
              <Chip label={pr.type} variant="outlined" size="small" />
              <Chip label={pr.category} variant="outlined" size="small" />
            </Stack>
          </Box>

          {/* Action Buttons */}
          {canEdit(pr.status) && (
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => router.push(`/procurement/purchase-requests/${pr.id}/edit`)}
            >
              Edit
            </Button>
          )}
        </Stack>

        {/* PR Details */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Request Details
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Title
              </Typography>
              <Typography variant="body1">{pr.title}</Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Description
              </Typography>
              <Typography variant="body1">{pr.description || '-'}</Typography>
            </Box>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Box flex={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Project
                </Typography>
                <Typography variant="body1">{pr.projectName || 'N/A'}</Typography>
              </Box>

              <Box flex={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Required By
                </Typography>
                <Typography variant="body1">
                  {formatDate(pr.requiredBy) !== '-' ? formatDate(pr.requiredBy) : 'Not specified'}
                </Typography>
              </Box>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <Box flex={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Submitted By
                </Typography>
                <Typography variant="body1">{pr.submittedByName}</Typography>
              </Box>

              <Box flex={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Total Items
                </Typography>
                <Typography variant="body1">{pr.itemCount}</Typography>
              </Box>
            </Stack>
          </Stack>
        </Paper>

        {/* Approval Information */}
        {(pr.status === 'APPROVED' || pr.status === 'REJECTED' || pr.reviewedBy) && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Approval Status
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Stack spacing={2}>
              {pr.reviewedBy && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Reviewed By
                  </Typography>
                  <Typography variant="body1">
                    {pr.reviewedByName} on {formatDate(pr.reviewedAt)}
                  </Typography>
                  {pr.reviewComments && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Comments: {pr.reviewComments}
                    </Typography>
                  )}
                </Box>
              )}

              {pr.approvedBy && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary">
                    Approved By
                  </Typography>
                  <Typography variant="body1">
                    {pr.approvedByName} on {formatDate(pr.approvedAt)}
                  </Typography>
                  {pr.approvalComments && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Comments: {pr.approvalComments}
                    </Typography>
                  )}
                </Box>
              )}

              {pr.status === 'REJECTED' && pr.rejectionReason && (
                <Box>
                  <Typography variant="subtitle2" color="error">
                    Rejection Reason
                  </Typography>
                  <Typography variant="body1">{pr.rejectionReason}</Typography>
                </Box>
              )}
            </Stack>
          </Paper>
        )}

        {/* Line Items */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Line Items ({items.length})
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Line #</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Specification</TableCell>
                  <TableCell align="right">Quantity</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Equipment</TableCell>
                  <TableCell align="right">Est. Cost</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No line items found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.lineNumber}</TableCell>
                      <TableCell>
                        <Typography variant="body2">{item.description}</Typography>
                        {item.materialName && (
                          <Typography variant="caption" color="text.secondary">
                            Material: {item.materialName}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{item.specification || '-'}</Typography>
                      </TableCell>
                      <TableCell align="right">{item.quantity}</TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>{item.equipmentCode || '-'}</TableCell>
                      <TableCell align="right">
                        {item.estimatedTotalCost
                          ? `₹${item.estimatedTotalCost.toLocaleString('en-IN')}`
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={item.status}
                          size="small"
                          color={
                            item.status === 'APPROVED'
                              ? 'success'
                              : item.status === 'REJECTED'
                                ? 'error'
                                : item.status === 'CONVERTED'
                                  ? 'primary'
                                  : 'default'
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Audit Trail */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Audit Trail
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Stack spacing={1}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Created
              </Typography>
              <Typography variant="body2">
                {pr.createdAt?.toDate?.()?.toLocaleString() || '-'}
              </Typography>
            </Box>

            {pr.submittedAt && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Submitted
                </Typography>
                <Typography variant="body2">
                  {pr.submittedAt.toDate().toLocaleString()} by {pr.submittedByName}
                </Typography>
              </Box>
            )}

            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Last Updated
              </Typography>
              <Typography variant="body2">
                {pr.updatedAt?.toDate?.()?.toLocaleString() || '-'}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
