/**
 * PO Details Section Component
 *
 * Displays basic PO information: vendor, dates, title, description, delivery address
 */

'use client';

import { Box, Paper, Typography, Stack, Divider } from '@mui/material';
import type { PurchaseOrder } from '@vapour/types';
import { formatExpectedDelivery } from '@/lib/procurement/purchaseOrderHelpers';

interface PODetailsSectionProps {
  po: PurchaseOrder;
}

export function PODetailsSection({ po }: PODetailsSectionProps) {
  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Purchase Order Details
      </Typography>
      <Divider sx={{ my: 2 }} />
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Box flex={1}>
            <Typography variant="subtitle2" color="text.secondary">
              Vendor
            </Typography>
            <Typography variant="body1">{po.vendorName}</Typography>
          </Box>
          <Box flex={1}>
            <Typography variant="subtitle2" color="text.secondary">
              Offer Reference
            </Typography>
            <Typography variant="body1">{po.selectedOfferNumber || 'N/A'}</Typography>
          </Box>
          <Box flex={1}>
            <Typography variant="subtitle2" color="text.secondary">
              Expected Delivery
            </Typography>
            <Typography variant="body1">{formatExpectedDelivery(po)}</Typography>
          </Box>
        </Stack>

        {po.title && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Title
            </Typography>
            <Typography variant="body1">{po.title}</Typography>
          </Box>
        )}

        {po.description && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Description
            </Typography>
            <Typography variant="body1">{po.description}</Typography>
          </Box>
        )}

        <Box>
          <Typography variant="subtitle2" color="text.secondary">
            Delivery Address
          </Typography>
          <Typography variant="body1">{po.deliveryAddress}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
}
