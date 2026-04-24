/**
 * PO Header Component
 *
 * Header with PO number, status chips, and action buttons
 */

'use client';

import { Box, Typography, Button, Stack, Chip, Alert } from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Send as SendIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Cancel as CancelIcon,
  PictureAsPdf as PdfIcon,
  Inventory2 as GoodsReceiptIcon,
  AssignmentTurnedIn as WorkCompletionIcon,
} from '@mui/icons-material';
import type { PurchaseOrder } from '@vapour/types';
import {
  getPOStatusText,
  getPOStatusColor,
  canEditPO,
  canSubmitForApproval,
  canApprovePO,
  canRejectPO,
  canIssuePO,
  canCancelPO,
  canReceiveGoods,
  canIssueWorkCompletion,
  getAdvancePaymentStatus,
} from '@/lib/procurement/purchaseOrderHelpers';

interface POHeaderProps {
  po: PurchaseOrder;
  onBack: () => void;
  onEdit: () => void;
  onSubmitForApproval: () => void;
  onApprove: () => void;
  onReject: () => void;
  onIssue: () => void;
  onCancel: () => void;
  onCreateGoodsReceipt?: () => void;
  onCreateWorkCompletion?: () => void;
  onDownloadPDF?: () => void;
  pdfLoading?: boolean;
}

export function POHeader({
  po,
  onBack,
  onEdit,
  onSubmitForApproval,
  onApprove,
  onReject,
  onIssue,
  onCancel,
  onCreateGoodsReceipt,
  onCreateWorkCompletion,
  onDownloadPDF,
  pdfLoading = false,
}: POHeaderProps) {
  const advancePaymentStatus = getAdvancePaymentStatus(po);
  const showIssueNudge = po.status === 'APPROVED' && canIssuePO(po);

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
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {onDownloadPDF && (
            <Button
              variant="outlined"
              startIcon={<PdfIcon />}
              onClick={onDownloadPDF}
              disabled={pdfLoading}
            >
              {pdfLoading ? 'Generating...' : 'Download PDF'}
            </Button>
          )}
          {canEditPO(po) && (
            <Button variant="outlined" startIcon={<EditIcon />} onClick={onEdit}>
              Edit
            </Button>
          )}
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
          {canReceiveGoods(po) && onCreateGoodsReceipt && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<GoodsReceiptIcon />}
              onClick={onCreateGoodsReceipt}
            >
              Receive Goods
            </Button>
          )}
          {canIssueWorkCompletion(po) && onCreateWorkCompletion && (
            <Button
              variant="outlined"
              color="primary"
              startIcon={<WorkCompletionIcon />}
              onClick={onCreateWorkCompletion}
            >
              Issue Work Certificate
            </Button>
          )}
          {canCancelPO(po) && (
            <Button variant="outlined" color="error" startIcon={<CancelIcon />} onClick={onCancel}>
              Cancel
            </Button>
          )}
        </Stack>
      </Stack>
      {showIssueNudge && (
        <Alert severity="info" sx={{ mt: 2 }}>
          This PO is approved but not yet issued to the vendor. Goods receipts and work certificates
          become available after you click <strong>Issue to Vendor</strong>.
        </Alert>
      )}
    </Box>
  );
}
