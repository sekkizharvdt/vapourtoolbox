'use client';

/**
 * Entities & Process Data Section
 */

import { Box, Typography } from '@mui/material';
import { WorkflowGuide } from './WorkflowGuide';

export function EntitiesSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        Entities is the master list of everyone you trade with — vendors, customers, and partners.
        Everything downstream reads from it: a purchase order picks its vendor here, an invoice
        picks its customer here, and the entity ledger shows every transaction against that company
        in one place.
      </Typography>

      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Vendors & customers
      </Typography>
      <Typography variant="body2" paragraph>
        Each entity carries its contacts, bank details, tax registrations, and an opening balance.
        One company can be both a vendor and a customer — give it both roles rather than creating it
        twice.
      </Typography>

      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Process Data (SSOT)
      </Typography>
      <Typography variant="body2" paragraph>
        The single source of truth for a plant&apos;s process design: streams, equipment, lines,
        instruments, and valves. Line sizing is calculated from the stream it carries, so the pipe
        table and the stream data have to be right before the lines will be.
      </Typography>

      <WorkflowGuide moduleId="entities" />
    </Box>
  );
}
