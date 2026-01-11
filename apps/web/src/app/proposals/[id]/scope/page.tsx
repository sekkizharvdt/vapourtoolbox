'use client';

/**
 * Scope Matrix Editor Page
 *
 * Allows editing the scope matrix (services, supply, exclusions) for a proposal.
 * This is linked from the Scope Matrix list and proposal detail pages.
 */

import { use } from 'react';
import { Suspense } from 'react';
import {
  Box,
  Typography,
  Breadcrumbs,
  Link as MuiLink,
  CircularProgress,
} from '@mui/material';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Dynamically import the editor to avoid SSR issues
const ScopeMatrixEditor = dynamic(
  () => import('./ScopeMatrixEditor').then((mod) => ({ default: mod.ScopeMatrixEditor })),
  {
    ssr: false,
    loading: () => (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    ),
  }
);

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ScopeEditorPage({ params }: PageProps) {
  const { id: proposalId } = use(params);

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 1 }}>
          <MuiLink component={Link} href="/proposals" color="inherit">
            Proposals
          </MuiLink>
          <MuiLink component={Link} href="/proposals/scope-matrix" color="inherit">
            Scope Matrix
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
        <ScopeMatrixEditor proposalId={proposalId} />
      </Suspense>
    </Box>
  );
}
