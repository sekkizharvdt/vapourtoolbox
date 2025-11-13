/**
 * PO Header Component
 *
 * Header with PO number, status chips, and action buttons
 */

'use client';

import { Box, Typography, Button, Stack, Chip } from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Send as SendIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import type { PurchaseOrder } from '@vapour/types';
import {
  getPOStatusText,
  getPOStatusColor,
  canSubmitForApproval,
  canApprovePO,
  canRejectPO,
  canIssuePO,
  canCancelPO,
  getAdvancePaymentStatus,
} from '@/lib/procurement/purchaseOrderHelpers';

interface POHeaderProps {
  po: PurchaseOrder;
  onBack: () => void;
  onSubmitForApproval: () => void;
  onApprove: () => void;
  onReject: () => void;
  onIssue: () => void;
  onCancel: () => void;
}

export function POHeader({
  po,
  onBack,
  onSubmitForApproval,
  onApprove,
  onReject,
  onIssue,
  onCancel,
}: POHeaderProps) {
  const advancePaymentStatus = getAdvancePaymentStatus(po);

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 1 }}>
        Back to Purchase Orders
      </Button>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
        spacing={2}
      >
        <Box>
          <Typography variant="h4" gutterBottom>
            {po.number}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip label={getPOStatusText(po.status)} color={getPOStatusColor(po.status)} />
            {advancePaymentStatus && (
              <Chip
                label={advancePaymentStatus.text}
                color={advancePaymentStatus.color}
                size="small"
                variant="outlined"
              />
            )}
          </Stack>
        </Box>
        <Stack direction="row" spacing={1}>
          {canSubmitForApproval(po) && (
            <Button variant="contained" startIcon={<SendIcon />} onClick={onSubmitForApproval}>
              Submit for Approval
            </Button>
          )}
          {canApprovePO(po) && (
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckIcon />}
              onClick={onApprove}
            >
              Approve
            </Button>
          )}
          {canRejectPO(po) && (
            <Button variant="outlined" color="error" startIcon={<CloseIcon />} onClick={onReject}>
              Reject
            </Button>
          )}
          {canIssuePO(po) && (
            <Button variant="contained" startIcon={<SendIcon />} onClick={onIssue}>
              Issue to Vendor
            </Button>
          )}
          {canCancelPO(po) && (
            <Button variant="outlined" color="error" startIcon={<CancelIcon />} onClick={onCancel}>
              Cancel
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
