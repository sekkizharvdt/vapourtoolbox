'use client';

/**
 * Audit Logs Page
 *
 * Admin page for viewing system activity and tracking changes.
 * Permission check is handled by the parent admin layout.
 */

import { Box, Typography, Stack } from '@mui/material';
import { AuditLogList } from '@/components/admin/AuditLogList';

export default function AuditLogsPage() {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4">Audit Logs</Typography>
          <Typography variant="body1" color="text.secondary">
            View system activity and track changes across all modules
          </Typography>
        </Box>
      </Stack>

      <AuditLogList />
    </Box>
  );
}
