// rule28-exempt: header edits via EditQuoteHeaderDialog on the detail page; line items linked/edited inline through the per-type picker dialogs and AcceptPriceDialog — no separate edit route

'use client';

/**
 * Procurement → Quotes (unified list)
 *
 * Single list of every vendor quote, regardless of how it landed in the
 * system. The same `vendorQuotes` collection holds:
 *   - STANDING_QUOTE  (vendor's catalog / rate card)
 *   - RFQ_RESPONSE    (reply to an in-app RFQ)
 *   - OFFLINE_RFQ     (reply to an RFQ sent over email/WhatsApp)
 *   - UNSOLICITED     (cold quote from a vendor we didn't ask)
 *
 * The previous UI split this into a separate "Vendor Offers" page under
 * /materials/vendor-offers that showed only STANDING_QUOTE — the other
 * sourceTypes were effectively orphaned. This page is the canonical list;
 * the old materials path is removed.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  Chip,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
} from '@mui/material';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import { PageHeader, LoadingState, EmptyState } from '@vapour/ui';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Home as HomeIcon,
  BookmarkAdded as StandingIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebase } from '@/lib/firebase';
import type { VendorQuote, QuoteStatus, QuoteSourceType } from '@vapour/types';
import { listVendorQuotes } from '@/lib/vendorQuotes/vendorQuoteService';
import { softDeleteVendorQuote } from '@/lib/procurement/procurementDeleteService';
import { canManageEstimation, canManageProcurement, QUOTE_STATUS_LABELS } from '@vapour/constants';
import { formatDate } from '@/lib/utils/formatters';
import { useConfirmDialog } from '@/components/common/ConfirmDialog';

const STATUS_COLORS: Partial<Record<QuoteStatus, 'default' | 'info' | 'success' | 'warning'>> = {
  DRAFT: 'default',
  UPLOADED: 'info',
  UNDER_REVIEW: 'info',
  EVALUATED: 'success',
  ARCHIVED: 'success',
};

const SOURCE_LABELS: Record<QuoteSourceType, string> = {
  STANDING_QUOTE: 'Standing',
  RFQ_RESPONSE: 'RFQ Response',
  // "Offline" rather than "Offline RFQ" — covers replies to phone/email/
  // WhatsApp conversations whether or not an in-app RFQ is linked.
  OFFLINE_RFQ: 'Offline',
  UNSOLICITED: 'Unsolicited',
};

const SOURCE_COLORS: Record<
  QuoteSourceType,
  'default' | 'primary' | 'secondary' | 'info' | 'warning'
> = {
  STANDING_QUOTE: 'primary',
  RFQ_RESPONSE: 'secondary',
  OFFLINE_RFQ: 'info',
  UNSOLICITED: 'warning',
};

export default function QuotesListPage() {
  const router = useRouter();
  const { user, claims } = useAuth();
  const { db } = getFirebase();
  const { confirm } = useConfirmDialog();

  const [quotes, setQuotes] = useState<VendorQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | QuoteSourceType>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | QuoteStatus>('ALL');

  const hasActiveFilters = searchTerm !== '' || sourceFilter !== 'ALL' || statusFilter !== 'ALL';
  const clearFilters = () => {
    setSearchTerm('');
    setSourceFilter('ALL');
    setStatusFilter('ALL');
  };

  const canManage = claims?.permissions ? canManageEstimation(claims.permissions) : false;
  const canDelete = claims?.permissions ? canManageProcurement(claims.permissions) : false;

  const loadQuotes = useCallback(async () => {
    try {
      setLoading(true);
      // No sourceType filter at the query level — render everything and let
      // the user narrow down with the in-page filter. Quote volumes are low
      // enough that pulling all sourceTypes in one query is fine.
      const fetched = await listVendorQuotes(db, {});
      setQuotes(fetched);
    } catch (error) {
      console.error('Error loading quotes:', error);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  const handleDelete = useCallback(
    async (quote: VendorQuote, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!user) return;

      const confirmed = await confirm({
        title: 'Delete vendor quote',
        message: `Move quote ${quote.number} (${quote.vendorName}) to trash? You can restore it later from the Trash page.`,
        confirmText: 'Delete',
        confirmColor: 'error',
        focusConfirm: false,
      });
      if (!confirmed) return;

      setDeletingId(quote.id);
      try {
        const result = await softDeleteVendorQuote(db, {
          id: quote.id,
          userId: user.uid,
          userName: user.displayName || user.email || 'Unknown',
          ...(claims?.permissions !== undefined && { userPermissions: claims.permissions }),
        });
        if (!result.success) {
          await confirm({
            title: 'Delete failed',
            message: result.error || 'Could not delete the quote.',
            confirmText: 'OK',
            cancelText: '',
            focusConfirm: true,
          });
          return;
        }
        // Optimistic local removal so the row disappears without a full reload.
        setQuotes((prev) => prev.filter((q) => q.id !== quote.id));
      } finally {
        setDeletingId(null);
      }
    },
    [confirm, db, user, claims?.permissions]
  );

  const filtered = quotes.filter((q) => {
    if (sourceFilter !== 'ALL' && q.sourceType !== sourceFilter) return false;
    if (statusFilter !== 'ALL' && q.status !== statusFilter) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return q.number.toLowerCase().includes(term) || q.vendorName.toLowerCase().includes(term);
  });

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <PageBreadcrumbs
          items={[
            { label: 'Procurement', href: '/procurement', icon: <HomeIcon fontSize="small" /> },
            { label: 'Quotes' },
          ]}
        />

        <PageHeader
          title="Quotes"
          subtitle="Vendor quotes — RFQ responses, offline replies, unsolicited offers, and standing rate cards"
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search by number or vendor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
          sx={{ minWidth: 280 }}
        />

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Source</InputLabel>
          <Select
            value={sourceFilter}
            label="Source"
            onChange={(e) => setSourceFilter(e.target.value as 'ALL' | QuoteSourceType)}
          >
            <MenuItem value="ALL">All Sources</MenuItem>
            {(Object.keys(SOURCE_LABELS) as QuoteSourceType[]).map((s) => (
              <MenuItem key={s} value={s}>
                {SOURCE_LABELS[s]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | QuoteStatus)}
          >
            <MenuItem value="ALL">All Statuses</MenuItem>
            {(Object.keys(QUOTE_STATUS_LABELS) as QuoteStatus[]).map((s) => (
              <MenuItem key={s} value={s}>
                {QUOTE_STATUS_LABELS[s]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {hasActiveFilters && (
          <Button variant="text" size="small" startIcon={<ClearIcon />} onClick={clearFilters}>
            Clear filters
          </Button>
        )}

        <Box sx={{ flexGrow: 1 }} />

        {canManage && (
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<StandingIcon />}
              onClick={() => router.push('/procurement/quotes/new-standing')}
            >
              Add Standing Quote
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => router.push('/procurement/quotes/new')}
            >
              Log Quote
            </Button>
          </Stack>
        )}
      </Box>

      {loading ? (
        <LoadingState message="Loading quotes..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No quotes found"
          message={
            hasActiveFilters
              ? 'Try adjusting your search or filters.'
              : 'Log your first vendor quote to start tracking prices.'
          }
        />
      ) : (
        <Card>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Number</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Vendor</TableCell>
                  <TableCell>Quote Date</TableCell>
                  <TableCell align="center">Items</TableCell>
                  <TableCell align="center">Accepted</TableCell>
                  <TableCell align="right">Total ({quotes[0]?.currency ?? 'INR'})</TableCell>
                  <TableCell>Status</TableCell>
                  {canDelete && <TableCell align="right">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((q) => (
                  <TableRow
                    key={q.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/procurement/quotes/${q.id}`)}
                  >
                    <TableCell sx={{ fontWeight: 500 }}>{q.number}</TableCell>
                    <TableCell>
                      <Chip
                        label={SOURCE_LABELS[q.sourceType]}
                        size="small"
                        color={SOURCE_COLORS[q.sourceType]}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{q.vendorName}</TableCell>
                    <TableCell>{formatDate(q.vendorOfferDate)}</TableCell>
                    <TableCell align="center">{q.itemCount}</TableCell>
                    <TableCell align="center">{q.acceptedCount}</TableCell>
                    <TableCell align="right">
                      {q.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={QUOTE_STATUS_LABELS[q.status] ?? q.status}
                        size="small"
                        color={STATUS_COLORS[q.status] ?? 'default'}
                      />
                    </TableCell>
                    {canDelete && (
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Delete quote">
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              disabled={deletingId === q.id}
                              onClick={(e) => handleDelete(q, e)}
                              aria-label={`Delete quote ${q.number}`}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </>
  );
}
