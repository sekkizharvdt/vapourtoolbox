'use client';

/**
 * Procurement Section
 */

import { Box, Typography, Chip } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

export function ProcurementSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        The Procurement module streamlines your purchasing workflow from request to delivery.
      </Typography>

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Procurement Workflow
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
        <Chip icon={<ArrowForwardIcon />} label="Purchase Request" />
        <Chip icon={<ArrowForwardIcon />} label="RFQ" />
        <Chip icon={<ArrowForwardIcon />} label="Vendor Offers" />
        <Chip icon={<ArrowForwardIcon />} label="Purchase Order" />
        <Chip label="Delivery" color="success" />
      </Box>

      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Purchase Requests (PR)
      </Typography>
      <Typography variant="body2" paragraph>
        Start by creating a Purchase Request for items you need. Include specifications, quantities,
        and required delivery dates. PRs require approval before proceeding.
      </Typography>

      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Request for Quotation (RFQ)
      </Typography>
      <Typography variant="body2" paragraph>
        Send RFQs to multiple vendors to get competitive quotes. The system tracks all vendor
        responses in one place for easy comparison.
      </Typography>

      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Offer Comparison
      </Typography>
      <Typography variant="body2" paragraph>
        Compare vendor offers side-by-side. The comparison view highlights price differences,
        delivery times, and terms to help you make the best decision.
      </Typography>

      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Purchase Orders (PO)
      </Typography>
      <Typography variant="body2" paragraph>
        Create Purchase Orders to finalize procurement. POs can be created from approved RFQs or
        directly. Track delivery status and manage vendor communications.
      </Typography>
    </Box>
  );
}
