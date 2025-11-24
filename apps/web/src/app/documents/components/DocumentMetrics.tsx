'use client';

/**
 * Document Metrics Component
 *
 * Displays summary cards showing document statistics:
 * - Total documents
 * - Overdue documents
 * - Documents in review
 * - Completed documents this month
 */

import { Box, Paper, Typography, Stack, Chip } from '@mui/material';
import {
  Description as DocumentIcon,
  Warning as WarningIcon,
  Visibility as ReviewIcon,
  CheckCircle as CompletedIcon,
} from '@mui/icons-material';
import type { MasterDocumentEntry } from '@vapour/types';

export type MetricFilter = 'all' | 'overdue' | 'review' | 'completed';

interface DocumentMetricsProps {
  documents: MasterDocumentEntry[];
  onMetricClick?: (filter: MetricFilter) => void;
}

export function DocumentMetrics({ documents, onMetricClick }: DocumentMetricsProps) {
  // Calculate metrics
  const total = documents.length;

  // Overdue: documents past due date and not accepted
  const overdue = documents.filter((doc) => {
    if (!doc.dueDate || doc.status === 'ACCEPTED') return false;
    const dueDate = new Date(doc.dueDate.seconds * 1000);
    return dueDate < new Date();
  }).length;

  // In Review: submitted, under client review, or commented
  const inReview = documents.filter(
    (doc) =>
      doc.status === 'SUBMITTED' ||
      doc.status === 'CLIENT_REVIEW' ||
      doc.status === 'COMMENTED' ||
      doc.status === 'INTERNAL_REVIEW'
  ).length;

  // Completed this month: accepted documents
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);

  const completedThisMonth = documents.filter((doc) => {
    if (doc.status !== 'ACCEPTED') return false;
    if (!doc.updatedAt) return false;
    const updatedDate = new Date(doc.updatedAt.seconds * 1000);
    return updatedDate >= thisMonthStart;
  }).length;

  const metrics = [
    {
      id: 'all',
      label: 'Total Documents',
      value: total,
      subtitle: 'All documents',
      icon: DocumentIcon,
      color: '#1976d2',
      bgColor: '#e3f2fd',
    },
    {
      id: 'overdue',
      label: 'Overdue',
      value: overdue,
      subtitle: 'Critical',
      icon: WarningIcon,
      color: '#d32f2f',
      bgColor: '#ffebee',
    },
    {
      id: 'review',
      label: 'In Review',
      value: inReview,
      subtitle: 'Pending',
      icon: ReviewIcon,
      color: '#ed6c02',
      bgColor: '#fff3e0',
    },
    {
      id: 'completed',
      label: 'Completed',
      value: completedThisMonth,
      subtitle: 'This month',
      icon: CompletedIcon,
      color: '#2e7d32',
      bgColor: '#e8f5e9',
    },
  ];

  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" spacing={2} sx={{ overflowX: 'auto', pb: 1 }}>
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const isClickable = onMetricClick && metric.id !== 'all';

          return (
            <Paper
              key={metric.id}
              sx={{
                minWidth: 200,
                p: 2.5,
                cursor: isClickable ? 'pointer' : 'default',
                transition: 'all 0.2s',
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': isClickable
                  ? {
                      transform: 'translateY(-2px)',
                      boxShadow: 3,
                      borderColor: metric.color,
                    }
                  : {},
              }}
              onClick={() => isClickable && onMetricClick(metric.id as MetricFilter)}
            >
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 1,
                      bgcolor: metric.bgColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon sx={{ color: metric.color, fontSize: 24 }} />
                  </Box>
                  {metric.id === 'overdue' && metric.value > 0 && (
                    <Chip label="Alert" size="small" color="error" />
                  )}
                </Stack>

                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 600, color: metric.color }}>
                    {metric.value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {metric.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {metric.subtitle}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
}
