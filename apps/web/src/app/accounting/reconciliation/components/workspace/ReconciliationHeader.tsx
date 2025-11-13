/**
 * Reconciliation Header Component
 *
 * Stats cards and action buttons for reconciliation workspace
 */

'use client';

import { Typography, Card, CardContent, Stack, Chip, LinearProgress, Button } from '@mui/material';
import { Grid } from '@mui/material';
import {
  AutoAwesome as AutoAwesomeIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';
import type { BankStatement, MatchSuggestion } from '@vapour/types';
import { formatCurrency } from '@/lib/accounting/transactionHelpers';
import type { ReconciliationStats } from './useReconciliationData';

interface ReconciliationHeaderProps {
  statement: BankStatement;
  stats: ReconciliationStats;
  suggestions: MatchSuggestion[];
  onAutoMatch: () => void;
  onMarkAsReconciled: () => void;
}

export function ReconciliationHeader({
  statement,
  stats,
  suggestions,
  onAutoMatch,
  onMarkAsReconciled,
}: ReconciliationHeaderProps) {
  const highConfidenceSuggestions = suggestions.filter((s) => s.confidence === 'HIGH');

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, md: 3 }}>
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Reconciliation Progress
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
              <Typography variant="h5">
                {stats.reconciledCount} / {stats.totalCount}
              </Typography>
              <Chip
                label={`${stats.percentage.toFixed(0)}%`}
                size="small"
                color={stats.percentage === 100 ? 'success' : 'warning'}
              />
            </Stack>
            <LinearProgress
              variant="determinate"
              value={stats.percentage}
              sx={{ mt: 1, height: 8, borderRadius: 1 }}
            />
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 3 }}>
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Suggested Matches
            </Typography>
            <Typography variant="h5">{suggestions.length}</Typography>
            <Typography variant="caption" color="text.secondary">
              {highConfidenceSuggestions.length} high confidence
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 3 }}>
        <Card>
          <CardContent>
            <Typography variant="body2" color="text.secondary">
              Closing Balance
            </Typography>
            <Typography variant="h5">{formatCurrency(statement.closingBalance)}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, md: 3 }}>
        <Stack spacing={1}>
          <Button
            variant="contained"
            startIcon={<AutoAwesomeIcon />}
            onClick={onAutoMatch}
            disabled={suggestions.length === 0}
            fullWidth
          >
            Auto Match ({highConfidenceSuggestions.length})
          </Button>
          <Button
            variant="outlined"
            startIcon={<CheckCircleIcon />}
            onClick={onMarkAsReconciled}
            disabled={stats.percentage < 100}
            fullWidth
          >
            Mark as Reconciled
          </Button>
        </Stack>
      </Grid>
    </Grid>
  );
}
