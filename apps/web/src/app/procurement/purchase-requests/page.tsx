'use client';

/**
 * Purchase Requests List Page
 *
 * Search-first list. Status is the ONE control for the workflow dimension —
 * the old stats card, its six clickable count chips and the Active/Converted
 * tab strip were three controls for that same dimension and could disagree
 * with each other. Counts now ride on the Status options.
 *
 * Rationale + the sibling-page gap list: docs/reviews/2026-08-10-pr-list-ia-plan.md
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Stack,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as VisibilityIcon,
  Home as HomeIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  PictureAsPdf as PdfIcon,
  TableChart as CsvIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { createLogger } from '@vapour/logger';
import {
  PageHeader,
  FilterBar,
  DataTable,
  StatusChip,
  TableActionCell,
  type DataTableColumn,
} from '@vapour/ui';
import {
  PURCHASE_REQUEST_STATUS_LABELS,
  PURCHASE_REQUEST_TYPE_LABELS,
  PURCHASE_REQUEST_CATEGORY_LABELS,
  PRIORITY_LABELS,
  getPriorityColor,
} from '@vapour/constants';
import type { PurchaseRequest, PurchaseRequestStatus } from '@vapour/types';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import { useAuth } from '@/contexts/AuthContext';
import { listPurchaseRequests } from '@/lib/procurement/purchaseRequest';
import { purchaseRequestListHelp } from '@/lib/help/pageHelpContent';
import { formatDate } from '@/lib/utils/formatters';
import { useConfirmDialog } from '@/components/common/ConfirmDialog';
import { useToast } from '@/components/common/Toast';
import { getFirebase } from '@/lib/firebase';
import { softDeletePurchaseRequest } from '@/lib/procurement/procurementDeleteService';
import { downloadPRListCSV } from '@/lib/procurement/purchaseRequest/exportPRList';
import { downloadPRListPDF } from '@/lib/procurement/purchaseRequest/prListPDF';

const logger = createLogger({ context: 'PurchaseRequestsPage' });

/** Synthetic Status options — everything except converted, and no filter. */
const STATUS_ACTIVE = 'ACTIVE';
const STATUS_ALL = 'ALL';

/** Page size per fetch, and the ceiling on how many pages we will walk. */
const FETCH_PAGE_SIZE = 100;
const MAX_FETCH_PAGES = 10;

const ALL_STATUSES = Object.keys(PURCHASE_REQUEST_STATUS_LABELS) as PurchaseRequestStatus[];

/** Statuses that may still be moved to Trash from the list. */
const DELETABLE_STATUSES: PurchaseRequestStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'CONVERTED_TO_RFQ',
];

/**
 * Row view-model: `createdAtMs` exists purely so DataTable's generic sorter
 * compares numbers instead of stringifying a Firestore Timestamp.
 */
type PurchaseRequestRow = PurchaseRequest & { createdAtMs: number };

/** Firestore hands back a Timestamp even where the type says Date (rule 14). */
function toMillis(raw: unknown): number {
  if (raw && typeof raw === 'object' && 'toDate' in raw) {
    return (raw as { toDate: () => Date }).toDate().getTime();
  }
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === 'string' || typeof raw === 'number') {
    const parsed = new Date(raw).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export default function PurchaseRequestsPage() {
  const router = useRouter();
  const { user, claims } = useAuth();
  const { confirm } = useConfirmDialog();
  const { toast } = useToast();
  const { db } = getFirebase();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);

  // Filters — Status defaults to Active, which is what the old default tab showed.
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(STATUS_ACTIVE);
  const [projectFilter, setProjectFilter] = useState<string>(STATUS_ALL);
  const [typeFilter, setTypeFilter] = useState<string>(STATUS_ALL);
  const [categoryFilter, setCategoryFilter] = useState<string>(STATUS_ALL);

  const [exportingPDF, setExportingPDF] = useState(false);

  // Deliberately not a useCallback: `useToast()` hands back a fresh object
  // whenever a toast opens, so a memoised loader depending on it would turn the
  // error path into a loop (toast → new identity → refetch → error → toast).
  const loadRequests = async () => {
    setLoading(true);
    try {
      // Every filter below is client-side, so a partial first page would
      // under-report the Status counts and silently hide older PRs — walk
      // the cursor to the end (bounded, so a bad cursor can't spin forever).
      const all: PurchaseRequest[] = [];
      let afterId: string | undefined;
      let pagesFetched = 0;

      while (pagesFetched < MAX_FETCH_PAGES) {
        const result = await listPurchaseRequests({ limit: FETCH_PAGE_SIZE, afterId });
        all.push(...result.items);
        pagesFetched++;
        if (!result.hasMore || !result.lastDocId) break;
        afterId = result.lastDocId;
        if (pagesFetched === MAX_FETCH_PAGES) {
          logger.warn('Purchase request fetch hit the page ceiling; list is truncated', {
            loaded: all.length,
            maxPages: MAX_FETCH_PAGES,
          });
        }
      }

      setRequests(all);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to load purchase requests', { error: message });
      toast.error(`Failed to load purchase requests: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  // Keyed on the uid, not the `user` object: an auth context that hands back a
  // fresh object per render would otherwise refetch on every render.
  useEffect(() => {
    if (!user?.uid) return;
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  /** Per-status counts, plus the two synthetic buckets. */
  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>([
      [STATUS_ALL, requests.length],
      [STATUS_ACTIVE, 0],
      ...ALL_STATUSES.map((status) => [status, 0] as const),
    ]);

    requests.forEach((req) => {
      counts.set(req.status, (counts.get(req.status) ?? 0) + 1);
      if (req.status !== 'CONVERTED_TO_RFQ') {
        counts.set(STATUS_ACTIVE, (counts.get(STATUS_ACTIVE) ?? 0) + 1);
      }
    });

    return counts;
  }, [requests]);

  /**
   * Status options carry their count. UNDER_REVIEW is a legacy state nothing
   * writes any more — it only appears when a document still sits in it.
   */
  const statusOptions = useMemo(() => {
    const workflowOptions = ALL_STATUSES.filter(
      (status) => status !== 'UNDER_REVIEW' || (statusCounts.get('UNDER_REVIEW') ?? 0) > 0
    ).map((status) => ({ value: status as string, label: PURCHASE_REQUEST_STATUS_LABELS[status] }));

    return [
      { value: STATUS_ACTIVE, label: 'Active' },
      { value: STATUS_ALL, label: 'All' },
      ...workflowOptions,
    ];
  }, [statusCounts]);

  /** Distinct project names across the loaded PRs, for the Project filter. */
  const projectOptions = useMemo(
    () =>
      [
        ...new Set(
          requests
            .map((req) => req.projectName)
            .filter((name): name is string => Boolean(name && name.trim()))
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [requests]
  );

  const rows = useMemo<PurchaseRequestRow[]>(() => {
    const query = searchQuery.trim().toLowerCase();

    return requests
      .filter((req) => {
        if (statusFilter === STATUS_ACTIVE) {
          if (req.status === 'CONVERTED_TO_RFQ') return false;
        } else if (statusFilter !== STATUS_ALL && req.status !== statusFilter) {
          return false;
        }

        if (projectFilter !== STATUS_ALL && req.projectName !== projectFilter) return false;
        if (typeFilter !== STATUS_ALL && req.type !== typeFilter) return false;
        if (categoryFilter !== STATUS_ALL && req.category !== categoryFilter) return false;

        if (query) {
          const haystack = [
            req.number,
            req.title,
            req.description,
            req.projectName,
            req.submittedByName,
          ];
          if (!haystack.some((field) => field?.toLowerCase().includes(query))) return false;
        }

        return true;
      })
      .map((req) => ({ ...req, createdAtMs: toMillis(req.createdAt) }));
  }, [requests, searchQuery, statusFilter, projectFilter, typeFilter, categoryFilter]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setStatusFilter(STATUS_ACTIVE);
    setProjectFilter(STATUS_ALL);
    setTypeFilter(STATUS_ALL);
    setCategoryFilter(STATUS_ALL);
  };

  const handleDelete = async (pr: PurchaseRequest) => {
    const confirmed = await confirm({
      title: 'Delete Purchase Request',
      message: `Move "${pr.number}" to Trash? You can restore it later from the Trash.`,
      confirmText: 'Move to Trash',
      confirmColor: 'error',
    });
    if (!confirmed) return;

    const result = await softDeletePurchaseRequest(db, {
      id: pr.id,
      userId: user?.uid || 'unknown',
      userName: user?.displayName || user?.email || 'Unknown',
      userPermissions: claims?.permissions || 0,
    });
    if (result.success) {
      setRequests((prev) => prev.filter((r) => r.id !== pr.id));
    } else {
      toast.error(result.error || 'Failed to delete purchase request');
    }
  };

  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      await downloadPRListPDF(rows);
    } finally {
      setExportingPDF(false);
    }
  };

  const columns: DataTableColumn<PurchaseRequestRow>[] = [
    {
      key: 'number',
      label: 'PR Number',
      minWidth: 130,
      render: (row) => (
        <Typography variant="body2" fontWeight={600}>
          {row.number}
        </Typography>
      ),
    },
    {
      key: 'projectName',
      label: 'Project',
      minWidth: 160,
      render: (row) => row.projectName || '-',
    },
    {
      key: 'title',
      label: 'Title / Description',
      minWidth: 260,
      render: (row) => (
        <Box>
          <Typography variant="body2" fontWeight={500}>
            {row.title || '-'}
          </Typography>
          {row.description && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {row.description}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      sortable: false,
      render: (row) => (
        <StatusChip status={row.type} labels={PURCHASE_REQUEST_TYPE_LABELS} variant="outlined" />
      ),
    },
    {
      key: 'category',
      label: 'Category',
      sortable: false,
      render: (row) => (
        <StatusChip
          status={row.category}
          labels={PURCHASE_REQUEST_CATEGORY_LABELS}
          variant="outlined"
        />
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: false,
      // Priority has its own color scale (getPriorityColor), which StatusChip
      // does not read — the label still comes from the canonical map.
      render: (row) => (
        <Chip
          label={PRIORITY_LABELS[row.priority] ?? row.priority}
          size="small"
          color={getPriorityColor(row.priority)}
        />
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: false,
      render: (row) => (
        <StatusChip
          status={row.status}
          labels={PURCHASE_REQUEST_STATUS_LABELS}
          context="purchaseRequest"
        />
      ),
    },
    {
      key: 'createdAtMs',
      label: 'Date',
      minWidth: 110,
      render: (row) => formatDate(row.createdAt),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <PageBreadcrumbs
          items={[
            { label: 'Procurement', href: '/procurement', icon: <HomeIcon fontSize="small" /> },
            { label: 'Purchase Requests' },
          ]}
        />

        <PageHeader
          title="Purchase Requests"
          subtitle="Manage and track all purchase requests"
          help={purchaseRequestListHelp}
          action={
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/procurement/purchase-requests/new')}
            >
              New Purchase Request
            </Button>
          }
        />

        <FilterBar onClear={handleClearFilters}>
          <TextField
            size="small"
            placeholder="Search PR number, title, description, project, or requester"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="disabled" />
                </InputAdornment>
              ),
            }}
            sx={{ flexGrow: 1, minWidth: 320 }}
          />

          <FormControl size="small" sx={{ minWidth: 190 }}>
            <InputLabel id="pr-status-filter-label">Status</InputLabel>
            <Select
              labelId="pr-status-filter-label"
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {statusOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {`${option.label} (${statusCounts.get(option.value) ?? 0})`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 190 }}>
            <InputLabel id="pr-project-filter-label">Project</InputLabel>
            <Select
              labelId="pr-project-filter-label"
              value={projectFilter}
              label="Project"
              onChange={(e) => setProjectFilter(e.target.value)}
            >
              <MenuItem value={STATUS_ALL}>All Projects</MenuItem>
              {projectOptions.map((name) => (
                <MenuItem key={name} value={name}>
                  {name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="pr-type-filter-label">Type</InputLabel>
            <Select
              labelId="pr-type-filter-label"
              value={typeFilter}
              label="Type"
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <MenuItem value={STATUS_ALL}>All Types</MenuItem>
              {Object.entries(PURCHASE_REQUEST_TYPE_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="pr-category-filter-label">Category</InputLabel>
            <Select
              labelId="pr-category-filter-label"
              value={categoryFilter}
              label="Category"
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <MenuItem value={STATUS_ALL}>All Categories</MenuItem>
              {Object.entries(PURCHASE_REQUEST_CATEGORY_LABELS).map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
            <Button
              size="small"
              startIcon={<CsvIcon />}
              onClick={() => downloadPRListCSV(rows)}
              disabled={rows.length === 0}
            >
              CSV
            </Button>
            <Button
              size="small"
              startIcon={<PdfIcon />}
              onClick={handleExportPDF}
              disabled={rows.length === 0 || exportingPDF}
            >
              {exportingPDF ? 'Generating...' : 'PDF'}
            </Button>
          </Stack>
        </FilterBar>

        <DataTable<PurchaseRequestRow>
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.id}
          loading={loading}
          sortable
          defaultSortKey="createdAtMs"
          defaultSortDirection="desc"
          emptyMessage={
            requests.length === 0
              ? 'No purchase requests found. Create your first one!'
              : 'No requests match the current filters'
          }
          onRowClick={(row) => router.push(`/procurement/purchase-requests/${row.id}`)}
          renderActions={(row) => (
            <TableActionCell
              actions={[
                {
                  icon: <VisibilityIcon />,
                  label: 'View details',
                  onClick: (event) => {
                    event?.stopPropagation();
                    router.push(`/procurement/purchase-requests/${row.id}`);
                  },
                },
                {
                  icon: <DeleteIcon />,
                  label: 'Move to Trash',
                  color: 'error',
                  show: DELETABLE_STATUSES.includes(row.status),
                  onClick: (event) => {
                    event?.stopPropagation();
                    handleDelete(row);
                  },
                },
              ]}
            />
          )}
        />
      </Stack>
    </Box>
  );
}
