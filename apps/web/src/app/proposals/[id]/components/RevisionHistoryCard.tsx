'use client';

/**
 * Revision History Card
 *
 * Lists every revision of a proposal number with status, submission /
 * acceptance date, and the reason captured at fork time. Only renders
 * when there are 2+ revisions (a sole revision adds no value).
 *
 * Surfaces on the Overview tab so the deal-history is visible without
 * digging into each revision separately.
 */

import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
  Button,
  Chip,
} from '@mui/material';
import { Visibility as ViewIcon, History as RevisionIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useFirestore } from '@/lib/firebase/hooks';
import { getProposalRevisions } from '@/lib/proposals/proposalService';
import { formatDate } from '@/lib/utils/formatters';
import type { Proposal } from '@vapour/types';
import { PROPOSAL_STATUS_LABELS } from '@vapour/types';

interface RevisionHistoryCardProps {
  proposalNumber: string;
  currentProposalId: string;
}

const STATUS_COLOR: Partial<
  Record<
    Proposal['status'],
    'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'
  >
> = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'info',
  SUBMITTED: 'primary',
  UNDER_NEGOTIATION: 'secondary',
  ACCEPTED: 'success',
  REJECTED: 'error',
  EXPIRED: 'error',
};

export default function RevisionHistoryCard({
  proposalNumber,
  currentProposalId,
}: RevisionHistoryCardProps) {
  const db = useFirestore();
  const router = useRouter();
  const [revisions, setRevisions] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !proposalNumber) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const list = await getProposalRevisions(db, proposalNumber);
        if (!cancelled) setRevisions(list);
      } catch (err) {
        console.error('Error loading revisions', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, proposalNumber]);

  if (loading) {
    return (
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </CardContent>
      </Card>
    );
  }

  // Don't bother rendering the card if there's only ever been one revision.
  if (revisions.length < 2) return null;

  const sorted = [...revisions].sort((a, b) => b.revision - a.revision);

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <RevisionIcon color="primary" fontSize="small" />
          <Typography variant="h6">Revision History</Typography>
          <Chip label={`${sorted.length} revisions`} size="small" variant="outlined" />
        </Stack>

        <Stack spacing={1.5}>
          {sorted.map((rev) => {
            const isCurrent = rev.id === currentProposalId;
            const dateForRow = rev.submittedAt ?? rev.createdAt;
            return (
              <Box
                key={rev.id}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 2,
                  p: 1.5,
                  borderRadius: 1,
                  border: 1,
                  borderColor: isCurrent ? 'primary.main' : 'divider',
                  bgcolor: isCurrent ? 'primary.50' : 'background.default',
                }}
              >
                <Box sx={{ minWidth: 60 }}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    Rev {rev.revision}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <Chip
                      label={PROPOSAL_STATUS_LABELS[rev.status] ?? rev.status}
                      size="small"
                      color={STATUS_COLOR[rev.status] ?? 'default'}
                      variant="outlined"
                    />
                    {isCurrent && <Chip label="Viewing" size="small" color="primary" />}
                    {rev.isLatestRevision && !isCurrent && (
                      <Chip label="Latest" size="small" color="success" variant="outlined" />
                    )}
                    <Typography variant="caption" color="text.secondary">
                      {dateForRow ? formatDate(dateForRow) : '—'}
                    </Typography>
                  </Stack>
                  {rev.revisionReason && (
                    <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                      “{rev.revisionReason}”
                    </Typography>
                  )}
                </Box>
                {!isCurrent && (
                  <Button
                    size="small"
                    startIcon={<ViewIcon fontSize="small" />}
                    onClick={() => router.push(`/proposals/${rev.id}`)}
                  >
                    View
                  </Button>
                )}
              </Box>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}
