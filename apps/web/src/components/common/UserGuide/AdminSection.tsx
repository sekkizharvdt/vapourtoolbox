'use client';

/**
 * Administration Section
 */

import { Box, Alert, Typography } from '@mui/material';
import { WorkflowGuide } from './WorkflowGuide';

export function AdminSection() {
  return (
    <Box>
      <Typography variant="body1" paragraph>
        Administration is where accounts and access are managed: inviting people, approving those
        who sign up, and deciding what each of them can see and do.
      </Typography>

      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Permissions decide what appears
      </Typography>
      <Typography variant="body2" paragraph>
        A module only shows in the menu if the person has permission to view it. Most modules split
        into a view permission and a manage permission — view lets someone open and read, manage
        lets them create, edit and approve. If a colleague says a button is missing, check their
        permissions before treating it as a fault.
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        A permission change can take a few minutes to reach someone who is already signed in. Have
        them sign out and back in to apply it immediately.
      </Alert>

      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Keeping a record
      </Typography>
      <Typography variant="body2" paragraph>
        Sensitive actions — permission changes, approvals, deletions — are written to the audit log,
        and the activity feed shows what has been happening across the app. Deleted records go to
        Trash rather than disappearing.
      </Typography>

      <WorkflowGuide moduleId="admin" />
    </Box>
  );
}
