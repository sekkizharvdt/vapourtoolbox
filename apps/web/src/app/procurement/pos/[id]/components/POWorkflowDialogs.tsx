/**
 * PO Workflow Dialogs Component
 *
 * All confirmation dialogs for PO workflow actions
 */

'use client';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  TextField,
  CircularProgress,
  Box,
} from '@mui/material';
import type { WorkflowDialogState } from './useWorkflowDialogs';
import { ApproverSelector } from '@/components/common/forms/ApproverSelector';

interface POWorkflowDialogsProps {
  dialogState: WorkflowDialogState;
  actionLoading: boolean;
  /** Which approval step the PO is at — drives the Approve dialog (review 2.3). */
  approvalStage: 'FIRST' | 'FINAL';
  onSubmitForApproval: () => void;
  onApprove: () => void;
  onReject: () => void;
  onIssue: () => void;
  onCancel: () => void;
}

export function POWorkflowDialogs({
  dialogState,
  actionLoading,
  approvalStage,
  onSubmitForApproval,
  onApprove,
  onReject,
  onIssue,
  onCancel,
}: POWorkflowDialogsProps) {
  return (
    <>
      {/* Submit Dialog */}
      <Dialog
        open={dialogState.submitDialogOpen}
        onClose={() => dialogState.setSubmitDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Submit for Approval</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Choose the two people who must approve this Purchase Order, in order. Once submitted you
            will not be able to edit it.
          </Typography>
          <Box sx={{ mt: 2 }}>
            <ApproverSelector
              value={dialogState.selectedApproverId}
              onChange={() => {}}
              onChangeWithName={(id, name) => dialogState.setSelectedApprover(id, name)}
              label="First approver"
              allowAnyUser
              required
              excludeUserIds={
                dialogState.selectedSecondApproverId ? [dialogState.selectedSecondApproverId] : []
              }
              helperText="Approves first"
            />
          </Box>
          <Box sx={{ mt: 2 }}>
            <ApproverSelector
              value={dialogState.selectedSecondApproverId}
              onChange={() => {}}
              onChangeWithName={(id, name) => dialogState.setSelectedSecondApprover(id, name)}
              label="Second (final) approver"
              allowAnyUser
              required
              excludeUserIds={
                dialogState.selectedApproverId ? [dialogState.selectedApproverId] : []
              }
              helperText="Gives final approval after the first approver"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => dialogState.setSubmitDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={onSubmitForApproval}
            variant="contained"
            disabled={
              actionLoading ||
              !dialogState.selectedApproverId ||
              !dialogState.selectedSecondApproverId
            }
          >
            {actionLoading ? <CircularProgress size={20} /> : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog
        open={dialogState.approveDialogOpen}
        onClose={() => dialogState.setApproveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{approvalStage === 'FIRST' ? 'First Approval' : 'Final Approval'}</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            {approvalStage === 'FIRST'
              ? 'Give your approval? It then goes to the second approver for final sign-off.'
              : 'Give final approval to this Purchase Order?'}
          </Typography>
          <TextField
            label="Comments (Optional)"
            value={dialogState.approvalComments}
            onChange={(e) => dialogState.setApprovalComments(e.target.value)}
            multiline
            rows={3}
            fullWidth
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => dialogState.setApproveDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button onClick={onApprove} variant="contained" color="success" disabled={actionLoading}>
            {actionLoading ? (
              <CircularProgress size={20} />
            ) : approvalStage === 'FIRST' ? (
              'Approve'
            ) : (
              'Approve'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={dialogState.rejectDialogOpen}
        onClose={() => dialogState.setRejectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reject Purchase Order</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>Please provide a reason for rejection:</Typography>
          <TextField
            label="Rejection Reason"
            value={dialogState.rejectionReason}
            onChange={(e) => dialogState.setRejectionReason(e.target.value)}
            multiline
            rows={3}
            fullWidth
            required
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => dialogState.setRejectDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={onReject}
            variant="contained"
            color="error"
            disabled={actionLoading || !dialogState.rejectionReason.trim()}
          >
            {actionLoading ? <CircularProgress size={20} /> : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Issue Dialog */}
      <Dialog
        open={dialogState.issueDialogOpen}
        onClose={() => dialogState.setIssueDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Issue Purchase Order</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to issue this Purchase Order to the vendor? This will send the PO
            to the vendor and mark it as issued.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => dialogState.setIssueDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button onClick={onIssue} variant="contained" disabled={actionLoading}>
            {actionLoading ? <CircularProgress size={20} /> : 'Issue'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog
        open={dialogState.cancelDialogOpen}
        onClose={() => dialogState.setCancelDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Cancel Purchase Order</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>Please provide a reason for cancellation:</Typography>
          <TextField
            label="Cancellation Reason"
            value={dialogState.cancellationReason}
            onChange={(e) => dialogState.setCancellationReason(e.target.value)}
            multiline
            rows={3}
            fullWidth
            required
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => dialogState.setCancelDialogOpen(false)} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={onCancel}
            variant="contained"
            color="error"
            disabled={actionLoading || !dialogState.cancellationReason.trim()}
          >
            {actionLoading ? <CircularProgress size={20} /> : 'Cancel PO'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
