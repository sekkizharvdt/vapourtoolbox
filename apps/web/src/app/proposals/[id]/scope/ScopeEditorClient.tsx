'use client';

/**
 * Scope Editor Client Component
 *
 * Client-side wrapper that handles the scope matrix editing UI.
 */

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Box, Typography, Breadcrumbs, Link as MuiLink, CircularProgress } from '@mui/material';
import Link from 'next/link';
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
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 1 }}>
          <MuiLink component={Link} href="/proposals" color="inherit">
            Proposals
          </MuiLink>
          <MuiLink component={Link} href="/proposals/list" color="inherit">
            All Proposals
          </MuiLink>
          <Typography color="text.primary">Edit Scope</Typography>
        </Breadcrumbs>
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
