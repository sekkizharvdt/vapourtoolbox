'use client';

/**
 * Scope Editor Client Component
 *
 * Client-side wrapper that handles the scope matrix editing UI.
 */

import { Suspense, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
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
  const pathname = usePathname();
  const [proposalId, setProposalId] = useState<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    const match = pathname.match(/\/proposals\/([^/]+)(?:\/|$)/);
    const extracted = match?.[1];
    if (extracted && extracted !== 'placeholder') setProposalId(extracted);
  }, [pathname]);

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
        {proposalId ? (
          <UnifiedScopeEditor proposalId={proposalId} />
        ) : (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
            <CircularProgress />
          </Box>
        )}
      </Suspense>
    </Box>
  );
}
