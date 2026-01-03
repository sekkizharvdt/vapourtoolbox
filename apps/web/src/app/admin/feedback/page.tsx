'use client';

/**
 * Feedback Management Page
 *
 * Admin page for reviewing user feedback, bug reports, and feature requests.
 * Permission check is handled by the parent admin layout.
 */

import { Box, Typography, Stack, Skeleton, Breadcrumbs, Link } from '@mui/material';
import { Home as HomeIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { FeedbackStats } from '@/components/admin/feedback';

// Lazy load FeedbackList - admin-only component (700+ lines)
const FeedbackList = dynamic(
  () => import('@/components/admin/FeedbackList').then((mod) => mod.FeedbackList),
  {
    ssr: false,
    loading: () => (
      <Box>
        <Skeleton variant="rectangular" height={56} sx={{ mb: 2, borderRadius: 1 }} />
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 1 }} />
      </Box>
    ),
  }
);

export default function FeedbackManagementPage() {
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
        <Typography color="text.primary">Feedback</Typography>
      </Breadcrumbs>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4">Feedback Management</Typography>
          <Typography variant="body1" color="text.secondary">
            Review and manage user feedback, bug reports, and feature requests
          </Typography>
        </Box>
      </Stack>

      {/* Statistics Dashboard */}
      <FeedbackStats />

      {/* Feedback List */}
      <FeedbackList />
    </Box>
  );
}
