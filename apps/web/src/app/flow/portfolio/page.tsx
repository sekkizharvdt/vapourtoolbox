'use client';

/**
 * Portfolio Review Dashboard (Track B3)
 *
 * One cross-project view of everything a weekly review needs: per active
 * project, open tasks, overdue tasks, upcoming/overdue charter deliverables,
 * in-flight procurement, budget utilization, delivery progress, and days
 * since the last finalized review meeting.
 *
 * This page IS the weekly meeting agenda (makes B2's review cadence
 * effective) — it defaults to sorting by "days since review" descending, so
 * the project most overdue for a check-in (or never reviewed at all) sits
 * at the top. Every row deep-links to the project detail page to actually
 * run the review.
 *
 * One-time fetch on mount (no live listeners) — matches the "recompute on
 * load" performance approach used elsewhere (e.g. BOM cost sheet blocks).
 * Query design needs no new Firestore composite indexes — see
 * `apps/web/src/lib/projects/portfolioDashboard.ts` header comment.
 */

import { useState, useEffect, useCallback } from 'react';
import { Box, Button, Chip, Stack, Tooltip, Typography } from '@mui/material';
import { Home as HomeIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import { PageHeader, LoadingState, EmptyState, DataTable, type DataTableColumn } from '@vapour/ui';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import { canViewProjects, PROCUREMENT_ITEM_STATUS_LABELS } from '@vapour/constants';
import {
  loadPortfolioDashboard,
  getBudgetUtilizationColor,
  type PortfolioProjectRow,
} from '@/lib/projects/portfolioDashboard';
import { formatDate } from '@/lib/utils/formatters';

function formatProcurementBreakdown(row: PortfolioProjectRow): string {
  const entries = Object.entries(row.procurementBreakdown) as [
    keyof typeof PROCUREMENT_ITEM_STATUS_LABELS,
    number,
  ][];
  if (entries.length === 0) return 'None in flight';
  return entries
    .map(([status, count]) => `${count} ${PROCUREMENT_ITEM_STATUS_LABELS[status] ?? status}`)
    .join(', ');
}

export default function PortfolioReviewPage() {
  const router = useRouter();
  const { claims } = useAuth();
  const { db } = getFirebase();

  const [rows, setRows] = useState<PortfolioProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tenantId = claims?.tenantId || 'default-entity';
  const permissions = claims?.permissions || 0;
  const canView = canViewProjects(permissions);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await loadPortfolioDashboard(db, tenantId);
      setRows(result);
    } catch (err) {
      // Rule 27: surface the real error, no silent catch.
      const message = err instanceof Error ? err.message : String(err);
      console.error('[PortfolioReviewPage] loadPortfolioDashboard failed:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [db, tenantId]);

  useEffect(() => {
    if (!canView) return;
    void load();
  }, [canView, load]);

  const columns: DataTableColumn<PortfolioProjectRow>[] = [
    {
      key: 'code',
      label: 'Project',
      sortable: true,
      minWidth: 200,
      render: (row) => (
        <Box>
          <Typography variant="body2" fontWeight="medium">
            {row.code}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {row.name}
          </Typography>
        </Box>
      ),
    },
    {
      key: 'openTasksCount',
      label: 'Open Tasks',
      align: 'center',
      sortable: true,
      render: (row) => row.openTasksCount,
    },
    {
      key: 'overdueTasksCount',
      label: 'Overdue Tasks',
      align: 'center',
      sortable: true,
      render: (row) => (
        <Typography
          variant="body2"
          color={row.overdueTasksCount > 0 ? 'error.main' : 'text.primary'}
          fontWeight={row.overdueTasksCount > 0 ? 600 : 400}
        >
          {row.overdueTasksCount}
        </Typography>
      ),
    },
    {
      key: 'deliverablesUpcoming',
      label: 'Deliverables Due (14d)',
      align: 'center',
      sortable: true,
      render: (row) => (
        <Typography
          variant="body2"
          color={row.deliverablesUpcoming > 0 ? 'warning.main' : 'text.primary'}
        >
          {row.deliverablesUpcoming}
        </Typography>
      ),
    },
    {
      key: 'deliverablesOverdue',
      label: 'Deliverables Overdue',
      align: 'center',
      sortable: true,
      render: (row) => (
        <Typography
          variant="body2"
          color={row.deliverablesOverdue > 0 ? 'error.main' : 'text.primary'}
          fontWeight={row.deliverablesOverdue > 0 ? 600 : 400}
        >
          {row.deliverablesOverdue}
        </Typography>
      ),
    },
    {
      key: 'procurementInFlight',
      label: 'Procurement In-Flight',
      align: 'center',
      sortable: true,
      render: (row) => (
        <Tooltip title={formatProcurementBreakdown(row)}>
          <span>{row.procurementInFlight}</span>
        </Tooltip>
      ),
    },
    {
      key: 'budgetUtilizationPercentage',
      label: 'Budget Util.',
      align: 'right',
      sortable: true,
      render: (row) =>
        row.budgetUtilizationPercentage == null ? (
          <Typography variant="body2" color="text.secondary">
            —
          </Typography>
        ) : (
          <Chip
            label={`${row.budgetUtilizationPercentage.toFixed(0)}%`}
            size="small"
            color={getBudgetUtilizationColor(row.budgetUtilizationPercentage)}
          />
        ),
    },
    {
      key: 'progressPercentage',
      label: 'Progress',
      align: 'right',
      sortable: true,
      render: (row) =>
        row.progressPercentage == null ? (
          <Typography variant="body2" color="text.secondary">
            —
          </Typography>
        ) : (
          `${row.progressPercentage}%`
        ),
    },
    {
      key: 'daysSinceReview',
      label: 'Days Since Review',
      align: 'right',
      sortable: true,
      render: (row) =>
        row.lastReviewDate === null ? (
          <Chip label="Never reviewed" size="small" color="error" variant="outlined" />
        ) : (
          <Tooltip title={`Last review: ${formatDate(row.lastReviewDate)}`}>
            <span>{row.daysSinceReview}d</span>
          </Tooltip>
        ),
    },
  ];

  if (!canView) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="h5" color="error">
          Access Denied
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
          You do not have permission to view the portfolio review dashboard.
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <PageBreadcrumbs
          items={[
            { label: 'Flow', href: '/flow', icon: <HomeIcon fontSize="small" /> },
            { label: 'Portfolio Review' },
          ]}
        />

        <PageHeader
          title="Portfolio Review"
          subtitle="Weekly review agenda — every active project's open work, deliverables, procurement, and budget at a glance. Sorted by days since last review."
        />
      </Box>

      {error && (
        <EmptyState
          title="Could not load the portfolio"
          message={error}
          variant="paper"
          action={
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => void load()}>
              Retry
            </Button>
          }
        />
      )}

      {!error &&
        (loading ? (
          <LoadingState message="Loading portfolio..." variant="page" />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No active projects"
            message="Projects with status ACTIVE will appear here once they exist."
            variant="paper"
          />
        ) : (
          <Stack spacing={2}>
            <DataTable<PortfolioProjectRow>
              columns={columns}
              rows={rows}
              getRowKey={(row) => row.projectId}
              pagination={false}
              sortable
              defaultSortKey="daysSinceReview"
              defaultSortDirection="desc"
              onRowClick={(row) => router.push(`/projects/${row.projectId}`)}
            />
          </Stack>
        ))}
    </>
  );
}
