/**
 * PO Approval Information Component
 *
 * Displays the assigned approvers (while the PO is pending) and the final
 * approval / rejection record with timestamps and comments.
 */

'use client';

import { Box, Paper, Typography, Stack, Divider, Chip } from '@mui/material';
import type { PurchaseOrder } from '@vapour/types';

interface POApprovalInfoProps {
  po: PurchaseOrder;
}

/** Timestamp-safe formatter (rule 14 — Firestore may return Timestamp or Date). */
function formatTimestamp(raw: unknown): string {
  if (!raw) return '—';
  const date =
    typeof raw === 'object' && raw !== null && 'toDate' in raw
      ? (raw as { toDate: () => Date }).toDate()
      : raw instanceof Date
        ? raw
        : new Date(raw as string);
  return date.toLocaleString();
}

export function POApprovalInfo({ po }: POApprovalInfoProps) {
  // Show the section once approvers are assigned (pending) or a decision exists.
  const hasAssignedApprovers = !!po.approverId || !!po.secondApproverId;
  if (!hasAssignedApprovers && !po.approvedBy && !po.rejectedBy && !po.returnedBy) {
    return null;
  }

  // First approver is "approved" once firstApprovedBy is set (PO moved to
  // PENDING_FINAL_APPROVAL) or the whole PO is fully approved.
  const firstApproved = !!po.firstApprovedBy || !!po.approvedBy;
  // Final approver is "approved" once approvedBy is set.
  const finalApproved = !!po.approvedBy;

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Approval Information
      </Typography>
      <Divider sx={{ my: 2 }} />

      {/* Assigned approvers — visible while pending and after approval */}
      {hasAssignedApprovers && !po.rejectedBy && !po.returnedBy && (
        <Stack spacing={2} sx={{ mb: po.approvedBy || po.rejectedBy ? 2 : 0 }}>
          {po.approverId && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                First Approver
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2">{po.approverName || po.approverId}</Typography>
                {firstApproved ? (
                  <Chip
                    size="small"
                    color="success"
                    label={`Approved · ${formatTimestamp(po.firstApprovedAt)}`}
                  />
                ) : (
                  <Chip size="small" color="warning" label="Pending" />
                )}
              </Stack>
            </Box>
          )}
          {po.secondApproverId && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Final Approver
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2">
                  {po.secondApproverName || po.secondApproverId}
                </Typography>
                {finalApproved ? (
                  <Chip
                    size="small"
                    color="success"
                    label={`Approved · ${formatTimestamp(po.approvedAt)}`}
                  />
                ) : (
                  <Chip size="small" color="warning" label="Pending" />
                )}
              </Stack>
            </Box>
          )}
        </Stack>
      )}

      {po.approvedBy && (
        <>
          {hasAssignedApprovers && <Divider sx={{ my: 2 }} />}
          <Stack spacing={1}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Approved By
              </Typography>
              <Typography variant="body2">{po.approvedByName}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Approved At
              </Typography>
              <Typography variant="body2">{formatTimestamp(po.approvedAt)}</Typography>
            </Box>
            {po.approvalComments && (
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Comments
                </Typography>
                <Typography variant="body2">{po.approvalComments}</Typography>
              </Box>
            )}
          </Stack>
        </>
      )}

      {po.rejectedBy && (
        <Stack spacing={1}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Rejected By
            </Typography>
            <Typography variant="body2">{po.rejectedByName}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Rejected At
            </Typography>
            <Typography variant="body2">{formatTimestamp(po.rejectedAt)}</Typography>
          </Box>
          {po.rejectionReason && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Reason
              </Typography>
              <Typography variant="body2">{po.rejectionReason}</Typography>
            </Box>
          )}
        </Stack>
      )}

      {po.returnedBy && (
        <Stack spacing={1}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Returned By
            </Typography>
            <Typography variant="body2">{po.returnedByName}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Returned At
            </Typography>
            <Typography variant="body2">{formatTimestamp(po.returnedAt)}</Typography>
          </Box>
          {po.returnComments && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Comments
              </Typography>
              <Typography variant="body2">{po.returnComments}</Typography>
            </Box>
          )}
        </Stack>
      )}
    </Paper>
  );
}
