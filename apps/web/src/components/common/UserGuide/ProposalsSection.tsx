'use client';

/**
 * Proposals Section
 */

import { Box, Typography, Chip, Stack } from '@mui/material';
import { StepGuide } from './helpers';

export function ProposalsSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        The Proposals module helps you create, manage, and track customer proposals from enquiry to
        award.
      </Typography>

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Creating a Proposal
      </Typography>

      <StepGuide
        steps={[
          {
            title: 'Start from an Enquiry or Create New',
            description:
              'You can create a proposal from an existing enquiry or start fresh. Enquiries capture initial customer requirements.',
          },
          {
            title: 'Fill in Proposal Details',
            description:
              'Enter customer information, project scope, timeline, and pricing. Use the rich text editor for detailed descriptions.',
          },
          {
            title: 'Add Line Items',
            description:
              'Break down your proposal into work items and supply items with quantities and rates.',
          },
          {
            title: 'Internal Review',
            description:
              'Submit for internal review before sending to the customer. Team members can add comments.',
          },
          {
            title: 'Submit to Customer',
            description:
              'Once approved internally, submit the proposal to the customer for their review.',
          },
        ]}
      />

      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Proposal Statuses
      </Typography>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <Chip label="Draft" color="default" size="small" />
        <Chip label="Internal Review" color="info" size="small" />
        <Chip label="Submitted" color="primary" size="small" />
        <Chip label="Under Negotiation" color="warning" size="small" />
        <Chip label="Awarded" color="success" size="small" />
        <Chip label="Lost" color="error" size="small" />
      </Stack>
    </Box>
  );
}
