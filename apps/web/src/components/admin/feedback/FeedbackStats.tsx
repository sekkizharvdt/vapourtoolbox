'use client';

/**
 * Feedback Statistics Component
 *
 * Displays aggregated feedback statistics including:
 * - Summary cards (total, by status)
 * - Breakdown by module (bar chart)
 * - Breakdown by type
 * - Severity distribution (for bugs)
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Stack,
  LinearProgress,
  Skeleton,
  Alert,
} from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

import { getFirebase } from '@/lib/firebase';
import { getFeedbackStats } from '@/lib/feedback/feedbackStatsService';
import { MODULE_OPTIONS } from '@/components/common/FeedbackForm/types';
import type { FeedbackStats as FeedbackStatsType, FeedbackModule } from './types';

/**
 * Summary card component
 */
function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: 'primary' | 'secondary' | 'warning' | 'success' | 'error' | 'info';
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: `${color}.50`,
              color: `${color}.main`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={700}>
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

/**
 * Progress bar for module breakdown
 */
function ModuleBar({ count, total, label }: { count: number; total: number; label: string }) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <Box sx={{ mb: 1.5 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {count}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={percentage}
        sx={{
          height: 8,
          borderRadius: 4,
          bgcolor: 'action.hover',
          '& .MuiLinearProgress-bar': {
            borderRadius: 4,
          },
        }}
      />
    </Box>
  );
}

/**
 * Main FeedbackStats component
 */
export function FeedbackStats() {
  const [stats, setStats] = useState<FeedbackStatsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const { db } = getFirebase();
        const feedbackStats = await getFeedbackStats(db);
        setStats(feedbackStats);
      } catch (err) {
        console.error('Failed to load feedback stats:', err);
        setError('Failed to load statistics');
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  if (loading) {
    return (
      <Box sx={{ mb: 4 }}>
        <Grid container spacing={2}>
          {[1, 2, 3, 4].map((i) => (
            <Grid size={{ xs: 6, md: 3 }} key={i}>
              <Skeleton variant="rounded" height={100} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        {error}
      </Alert>
    );
  }

  if (!stats) {
    return null;
  }

  // Get module label from options
  const getModuleLabel = (module: FeedbackModule): string => {
    return MODULE_OPTIONS.find((m) => m.value === module)?.label || module;
  };

  // Sort modules by count descending
  const sortedModules = Object.entries(stats.byModule)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6); // Top 6 modules

  return (
    <Box sx={{ mb: 4 }}>
      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            title="Total Feedback"
            value={stats.total}
            icon={<ChatBubbleIcon />}
            color="primary"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            title="New"
            value={stats.byStatus.new}
            icon={<NewReleasesIcon />}
            color="warning"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            title="In Progress"
            value={stats.byStatus.in_progress}
            icon={<HourglassEmptyIcon />}
            color="secondary"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard
            title="Resolved"
            value={stats.byStatus.resolved + stats.byStatus.closed}
            icon={<CheckCircleIcon />}
            color="success"
          />
        </Grid>
      </Grid>

      {/* Type and Module Breakdown */}
      <Grid container spacing={3}>
        {/* By Type */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                By Type
              </Typography>
              <Stack spacing={1.5}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <BugReportIcon color="error" fontSize="small" />
                    <Typography variant="body2">Bugs</Typography>
                  </Stack>
                  <Chip label={stats.byType.bug} size="small" color="error" />
                </Stack>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <LightbulbIcon color="info" fontSize="small" />
                    <Typography variant="body2">Features</Typography>
                  </Stack>
                  <Chip label={stats.byType.feature} size="small" color="info" />
                </Stack>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <ChatBubbleIcon fontSize="small" />
                    <Typography variant="body2">General</Typography>
                  </Stack>
                  <Chip label={stats.byType.general} size="small" />
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* By Module */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                By Module
              </Typography>
              {sortedModules.length > 0 ? (
                sortedModules.map(([moduleKey, count]) => (
                  <ModuleBar
                    key={moduleKey}
                    count={count}
                    total={stats.total}
                    label={getModuleLabel(moduleKey as FeedbackModule)}
                  />
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No module data available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Bug Severity */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Bug Severity
              </Typography>
              {stats.byType.bug > 0 ? (
                <Stack spacing={1.5}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <ErrorIcon color="error" fontSize="small" />
                      <Typography variant="body2">Critical</Typography>
                    </Stack>
                    <Chip label={stats.bySeverity.critical || 0} size="small" color="error" />
                  </Stack>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <ErrorIcon color="warning" fontSize="small" />
                      <Typography variant="body2">Major</Typography>
                    </Stack>
                    <Chip label={stats.bySeverity.major || 0} size="small" color="warning" />
                  </Stack>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <ErrorIcon color="info" fontSize="small" />
                      <Typography variant="body2">Minor</Typography>
                    </Stack>
                    <Chip label={stats.bySeverity.minor || 0} size="small" color="info" />
                  </Stack>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <ErrorIcon color="disabled" fontSize="small" />
                      <Typography variant="body2">Cosmetic</Typography>
                    </Stack>
                    <Chip label={stats.bySeverity.cosmetic || 0} size="small" />
                  </Stack>
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No bug reports yet
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
