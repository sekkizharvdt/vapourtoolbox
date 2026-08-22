'use client';

/**
 * PO-Wise Payment Details (feature request §3)
 *
 * One row per purchase order: value, paid, pending and payment status, with
 * the milestone breakdown on the PO detail page.
 *
 * Queries `purchaseOrders` and NOTHING from `transactions`. Procurement cannot
 * read that collection — it requires VIEW_ACCOUNTING, which four of the nine
 * live users do not have — so every figure comes from the `paymentSummary`
 * projection the `syncPOPaymentSummary` Cloud Function writes onto each PO.
 *
 * Search-first layout following the purchase-requests page: one Status control
 * carrying per-status counts, no stats card, no tab strip
 * (docs/reviews/2026-08-10-pr-list-ia-plan.md).
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Home as HomeIcon,
  Search as SearchIcon,
  TableChart as CsvIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { createLogger } from '@vapour/logger';
import {
  DataTable,
  FilterBar,
  PageHeader,
  StatusChip,
  TableActionCell,
  type DataTableColumn,
} from '@vapour/ui';
import { PO_PAYMENT_STATUS_LABELS } from '@vapour/constants';
import type { POPaymentStatus, PurchaseOrder } from '@vapour/types';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import { listPOs } from '@/lib/procurement/purchaseOrder';
import { formatCurrencyCode, formatDate } from '@/lib/utils/formatters';
import { downloadPOPaymentsCSV } from '@/lib/procurement/exportPOPaymentsList';
import { useToast } from '@/components/common/Toast';

const logger = createLogger({ context: 'po-payments' });

/** Synthetic filter value meaning "no status filter". */
const ALL = 'ALL';

/** A PO with no projection yet — never synced, or synced before it had activity. */
const NOT_SYNCED = 'NOT_SYNCED';

type StatusFilter = typeof ALL | typeof NOT_SYNCED | POPaymentStatus;

export default function POPaymentsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(ALL);
  const [projectFilter, setProjectFilter] = useState<string>(ALL);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const rows = await listPOs({});
        if (!cancelled) setPOs(rows);
      } catch (error) {
        // Surface the real message: "failed to load" tells the user nothing
        // they can act on, and a permission error here would be a real finding
        // (rule 27).
        const message = error instanceof Error ? error.message : String(error);
        logger.error('Failed to load purchase orders for payment list', { error: message });
        if (!cancelled) toast.error(`Could not load purchase orders: ${message}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // toast is stable from context; re-running on it would refetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Only POs that can actually carry payments — a draft has no commitment yet. */
  const payablePOs = useMemo(
    () => pos.filter((po) => po.status !== 'DRAFT' && po.status !== 'CANCELLED'),
    [pos]
  );

  const statusOf = (po: PurchaseOrder): StatusFilter => po.paymentSummary?.status ?? NOT_SYNCED;

  /** Counts ride on the Status options so the control cannot disagree with the rows. */
  const statusCounts = useMemo(() => {
    const counts = new Map<StatusFilter, number>();
    for (const po of payablePOs) {
      const key = statusOf(po);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [payablePOs]);

  /** Derived from the loaded rows, so it can never offer a project with no POs. */
  const projectOptions = useMemo(() => {
    const names = new Set<string>();
    for (const po of payablePOs) for (const name of po.projectNames || []) names.add(name);
    return Array.from(names).sort();
  }, [payablePOs]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return payablePOs.filter((po) => {
      if (statusFilter !== ALL && statusOf(po) !== statusFilter) return false;
      if (projectFilter !== ALL && !(po.projectNames || []).includes(projectFilter)) return false;
      if (!term) return true;
      return [po.number, po.vendorName, po.title, ...(po.projectNames || [])]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(term));
    });
  }, [payablePOs, search, statusFilter, projectFilter]);

  const columns: DataTableColumn<PurchaseOrder>[] = [
    { key: 'number', label: 'PO Number', sortable: true },
    { key: 'vendorName', label: 'Vendor', render: (po) => po.vendorName || '—' },
    {
      key: 'projects',
      label: 'Project',
      render: (po) => (po.projectNames || []).join(', ') || '—',
    },
    {
      key: 'totalAmount',
      label: 'PO Value',
      align: 'right',
      // Always known from the order itself, whether or not the projection has run.
      render: (po) => formatCurrencyCode(po.grandTotal, po.currency),
    },
    {
      key: 'paidAmount',
      label: 'Paid',
      align: 'right',
      // Em-dash, not zero, before the first sync: "0 paid" is a claim, and the
      // honest state of an unsynced PO is that we do not know yet.
      render: (po) =>
        po.paymentSummary ? formatCurrencyCode(po.paymentSummary.paidAmount, po.currency) : '—',
    },
    {
      key: 'pendingAmount',
      label: 'Pending',
      align: 'right',
      render: (po) =>
        po.paymentSummary ? formatCurrencyCode(po.paymentSummary.pendingAmount, po.currency) : '—',
    },
    {
      key: 'paymentStatus',
      label: 'Payment Status',
      render: (po) =>
        po.paymentSummary ? (
          <StatusChip
            status={po.paymentSummary.status}
            labels={PO_PAYMENT_STATUS_LABELS}
            context="poPayment"
            size="small"
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            Not synced
          </Typography>
        ),
    },
    {
      key: 'syncedAt',
      label: 'Updated',
      render: (po) => (po.paymentSummary ? formatDate(po.paymentSummary.syncedAt) : '—'),
    },
  ];

  const statusOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: ALL, label: `All (${payablePOs.length})` },
    ...(Object.keys(PO_PAYMENT_STATUS_LABELS) as POPaymentStatus[]).map((status) => ({
      value: status,
      label: `${PO_PAYMENT_STATUS_LABELS[status]} (${statusCounts.get(status) ?? 0})`,
    })),
    { value: NOT_SYNCED, label: `Not synced (${statusCounts.get(NOT_SYNCED) ?? 0})` },
  ];

  return (
    <>
      <PageBreadcrumbs
        items={[
          { label: 'Home', href: '/dashboard', icon: <HomeIcon fontSize="small" /> },
          { label: 'Procurement', href: '/procurement' },
          { label: 'PO Payments' },
        ]}
      />

      <PageHeader
        title="PO-Wise Payment Details"
        subtitle="Paid and pending amounts for every purchase order, with milestone breakdown on each PO"
      />

      <FilterBar>
        <TextField
          size="small"
          placeholder="Search PO number, vendor, title, project…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: 320, flexGrow: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Payment Status</InputLabel>
          <Select
            value={statusFilter}
            label="Payment Status"
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            {statusOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Project</InputLabel>
          <Select
            value={projectFilter}
            label="Project"
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <MenuItem value={ALL}>All projects</MenuItem>
            {projectOptions.map((name) => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ flexGrow: 1 }} />

        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<CsvIcon />}
            onClick={() => downloadPOPaymentsCSV(rows)}
            disabled={rows.length === 0}
          >
            CSV
          </Button>
        </Stack>
      </FilterBar>

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(po) => po.id}
        loading={loading}
        emptyMessage="No purchase orders match these filters."
        onRowClick={(po) => router.push(`/procurement/pos/${po.id}`)}
        renderActions={(po) => (
          <TableActionCell
            actions={[
              {
                icon: <VisibilityIcon fontSize="small" />,
                label: 'View PO',
                onClick: () => router.push(`/procurement/pos/${po.id}`),
              },
            ]}
          />
        )}
      />
    </>
  );
}
