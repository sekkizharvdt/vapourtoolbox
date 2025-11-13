/**
 * PO Approval Information Component
 *
 * Displays approval or rejection information with timestamps and comments
 */

'use client';

import { Box, Paper, Typography, Stack, Divider } from '@mui/material';
import type { PurchaseOrder } from '@vapour/types';

interface POApprovalInfoProps {
  po: PurchaseOrder;
}

export function POApprovalInfo({ po }: POApprovalInfoProps) {
  if (!po.approvedBy && !po.rejectedBy) {
    return null;
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Approval Information
      </Typography>
      <Divider sx={{ my: 2 }} />
      {po.approvedBy && (
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
            <Typography variant="body2">{po.approvedAt?.toDate().toLocaleString()}</Typography>
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
            <Typography variant="body2">{po.rejectedAt?.toDate().toLocaleString()}</Typography>
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
    </Paper>
  );
}
