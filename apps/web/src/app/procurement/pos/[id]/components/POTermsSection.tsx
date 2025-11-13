/**
 * PO Terms Section Component
 *
 * Displays payment terms, delivery terms, warranty, and penalty clauses
 */

'use client';

import { Box, Paper, Typography, Stack, Divider } from '@mui/material';
import type { PurchaseOrder } from '@vapour/types';

interface POTermsSectionProps {
  po: PurchaseOrder;
}

export function POTermsSection({ po }: POTermsSectionProps) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Terms and Conditions
      </Typography>
      <Divider sx={{ my: 2 }} />
      <Stack spacing={2}>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Payment Terms
          </Typography>
          <Typography variant="body2">{po.paymentTerms || 'Not specified'}</Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Delivery Terms
          </Typography>
          <Typography variant="body2">{po.deliveryTerms || 'Not specified'}</Typography>
        </Box>
        {po.warrantyTerms && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Warranty Terms
            </Typography>
            <Typography variant="body2">{po.warrantyTerms}</Typography>
          </Box>
        )}
        {po.penaltyClause && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Penalty Clause
            </Typography>
            <Typography variant="body2">{po.penaltyClause}</Typography>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
