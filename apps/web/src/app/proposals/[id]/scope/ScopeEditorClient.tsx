'use client';

/**
 * Scope Editor Client Component
 *
 * Client-side wrapper that handles the scope matrix editing UI.
 */

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Box, Typography, CircularProgress } from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import dynamic from 'next/dynamic';

// Dynamically import the editor to avoid SSR issues
const UnifiedScopeEditor = dynamic(
  () => import('./UnifiedScopeEditor').then((mod) => ({ default: mod.UnifiedScopeEditor })),
  {
    ssr: false,
    loading: () => (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    ),
  }
);

export default function ScopeEditorClient() {
  const params = useParams();
  const proposalId = params.id as string;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <PageBreadcrumbs
          items={[
            { label: 'Proposals', href: '/proposals' },
            { label: 'All Proposals', href: '/proposals/list' },
            { label: 'Edit Scope' },
          ]}
          sx={{ mb: 1 }}
        />
        <Typography variant="h4" component="h1" fontWeight="bold">
          Edit Scope Matrix
        </Typography>
      </Box>

      <Suspense
        fallback={
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
            <CircularProgress />
          </Box>
        }
      >
        <UnifiedScopeEditor proposalId={proposalId} />
      </Suspense>
    </Box>
  );
}
