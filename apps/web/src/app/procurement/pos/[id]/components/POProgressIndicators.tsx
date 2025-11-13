/**
 * PO Progress Indicators Component
 *
 * Displays delivery and payment progress bars with status chips
 */

'use client';

import { Box, Paper, Stack, Typography, Chip, LinearProgress } from '@mui/material';
import type { PurchaseOrder } from '@vapour/types';
import { getDeliveryStatus, getPaymentStatus } from '@/lib/procurement/purchaseOrderHelpers';

interface POProgressIndicatorsProps {
  po: PurchaseOrder;
}

export function POProgressIndicators({ po }: POProgressIndicatorsProps) {
  const deliveryStatus = getDeliveryStatus(po);
  const paymentStatus = getPaymentStatus(po);

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Delivery Progress
            </Typography>
            <Chip label={deliveryStatus.text} color={deliveryStatus.color} size="small" />
          </Stack>
          <LinearProgress
            variant="determinate"
            value={po.deliveryProgress || 0}
            sx={{ height: 8, borderRadius: 1 }}
          />
        </Box>
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Payment Progress
            </Typography>
            <Chip label={paymentStatus.text} color={paymentStatus.color} size="small" />
          </Stack>
          <LinearProgress
            variant="determinate"
            value={po.paymentProgress || 0}
            color="warning"
            sx={{ height: 8, borderRadius: 1 }}
          />
        </Box>
      </Stack>
    </Paper>
  );
}
