'use client';

/**
 * Audit Logs Page
 *
 * Admin page for viewing system activity and tracking changes.
 * Permission check is handled by the parent admin layout.
 */

import { Box, Typography, Stack, Breadcrumbs, Link } from '@mui/material';
import { Home as HomeIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { AuditLogList } from '@/components/admin/AuditLogList';

export default function AuditLogsPage() {
  const router = useRouter();

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          color="inherit"
          href="/admin"
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            router.push('/admin');
          }}
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Administration
        </Link>
        <Typography color="text.primary">Audit Logs</Typography>
      </Breadcrumbs>
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
