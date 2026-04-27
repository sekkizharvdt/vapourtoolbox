'use client';

/**
 * Scope Triage Client
 *
 * Flat-list reorganiser for AI-parsed scope. Each row shows the AI's category
 * pick alongside a dropdown of all 11 discipline categories — switching the
 * dropdown moves the item between buckets in the local draft. On Save, the
 * draft is written back to enquiry.requestedScope and the enquiry is marked
 * scopeReviewedAt = now so the "Review parsed scope" banner clears.
 */

import { useState, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  AutoAwesome as AiIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { Timestamp } from 'firebase/firestore';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import { PageHeader } from '@vapour/ui';
import { useFirestore } from '@/lib/firebase/hooks';
import { useAuth } from '@/contexts/AuthContext';
import { getEnquiryById, updateEnquiry } from '@/lib/enquiry/enquiryService';
import { useToast } from '@/components/common/Toast';
import type {
  Enquiry,
  ScopeCategoryEntry,
  ScopeCategoryKey,
  UnifiedScopeItem,
  UnifiedScopeMatrix,
} from '@vapour/types';
import { SCOPE_CATEGORY_DEFAULTS, SCOPE_CATEGORY_ORDER } from '@vapour/types';

const ALL_CATEGORY_OPTIONS = SCOPE_CATEGORY_ORDER.map((key) => ({
  key,
  label: SCOPE_CATEGORY_DEFAULTS[key].label,
}));

interface FlatRow {
  item: UnifiedScopeItem;
  categoryKey: ScopeCategoryKey;
}

/**
 * Build a fresh, normalised matrix:
 *   - all 11 categories present, in canonical order
 *   - items renumbered 1, 2, 3, ... within each category
 *   - existing items preserved by id
 */
function normaliseMatrix(rows: FlatRow[]): UnifiedScopeMatrix {
  const byCategory = new Map<ScopeCategoryKey, UnifiedScopeItem[]>();
  for (const row of rows) {
    const list = byCategory.get(row.categoryKey) ?? [];
    list.push(row.item);
    byCategory.set(row.categoryKey, list);
  }
  const categories: ScopeCategoryEntry[] = SCOPE_CATEGORY_ORDER.map((key, index) => {
    const defaults = SCOPE_CATEGORY_DEFAULTS[key];
    const items = (byCategory.get(key) ?? []).map((item, idx) => ({
      ...item,
      itemNumber: `${index + 1}.${idx + 1}`,
      order: idx,
    }));
    return {
      id: crypto.randomUUID(),
      categoryKey: key,
      label: defaults.label,
      displayType: defaults.displayType,
      ...(defaults.activityTemplate && { activityTemplate: defaults.activityTemplate }),
      items,
      order: index,
    };
  });
  return { categories };
}

/** Flatten a matrix to one row per item, preserving category assignment. */
function flattenMatrix(matrix: UnifiedScopeMatrix): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const cat of matrix.categories) {
    for (const item of cat.items) {
      rows.push({ item, categoryKey: cat.categoryKey });
    }
  }
  return rows;
}

export default function ScopeTriageClient() {
  const pathname = usePathname();
  const router = useRouter();
  const db = useFirestore();
  const { user, claims } = useAuth();
  const { toast } = useToast();

  const [enquiryId, setEnquiryId] = useState<string | null>(null);
  const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
  const [rows, setRows] = useState<FlatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Resolve enquiry id from the URL on the client (static export pattern).
  useEffect(() => {
    if (!pathname) return;
    const match = pathname.match(/\/proposals\/enquiries\/([^/]+)\/scope-triage/);
    const extracted = match?.[1];
    if (extracted && extracted !== 'placeholder') {
      setEnquiryId(extracted);
    }
  }, [pathname]);

  // Load enquiry + seed rows from requestedScope.
  useEffect(() => {
    if (!db || !enquiryId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getEnquiryById(db, enquiryId);
        if (cancelled) return;
        if (!data) {
          setError('Enquiry not found.');
          return;
        }
        setEnquiry(data);
        if (!data.requestedScope || data.requestedScope.categories.length === 0) {
          setRows([]);
          return;
        }
        setRows(flattenMatrix(data.requestedScope));
      } catch (err) {
        console.error('Failed to load enquiry for triage', err);
        if (!cancelled) setError('Failed to load enquiry.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, enquiryId]);

  const grouped = useMemo(() => {
    const map = new Map<ScopeCategoryKey, FlatRow[]>();
    for (const row of rows) {
      const list = map.get(row.categoryKey) ?? [];
      list.push(row);
      map.set(row.categoryKey, list);
    }
    return SCOPE_CATEGORY_ORDER.map((key) => ({
      key,
      label: SCOPE_CATEGORY_DEFAULTS[key].label,
      displayType: SCOPE_CATEGORY_DEFAULTS[key].displayType,
      rows: map.get(key) ?? [],
    }));
  }, [rows]);

  const handleCategoryChange = (itemId: string, nextKey: ScopeCategoryKey) => {
    setRows((prev) => prev.map((r) => (r.item.id === itemId ? { ...r, categoryKey: nextKey } : r)));
  };

  const handleDelete = (itemId: string) => {
    setRows((prev) => prev.filter((r) => r.item.id !== itemId));
  };

  const handleSave = async () => {
    if (!db || !enquiry || !user) return;
    try {
      setSaving(true);
      const matrix = normaliseMatrix(rows);
      await updateEnquiry(
        db,
        enquiry.id,
        {
          requestedScope: matrix,
          scopeReviewedAt: Timestamp.now(),
          scopeReviewedBy: user.uid,
        },
        user.uid
      );
      toast.success('Scope reorganised.');
      router.push(`/proposals/enquiries/${enquiry.id}`);
    } catch (err) {
      console.error('Failed to save triaged scope', err);
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const totalItems = rows.length;
  const reviewedAt = enquiry?.scopeReviewedAt ?? null;

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Box display="flex" justifyContent="center">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!enquiry) {
    return null;
  }

  const claimsKnown = !!claims;

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <PageBreadcrumbs
        items={[
          { label: 'Proposals', href: '/proposals', icon: <HomeIcon fontSize="small" /> },
          { label: 'Enquiries', href: '/proposals/enquiries' },
          { label: enquiry.title || 'Enquiry', href: `/proposals/enquiries/${enquiry.id}` },
          { label: 'Reorganise scope' },
        ]}
      />
      <PageHeader
        title="Reorganise parsed scope"
        subtitle={
          totalItems === 0
            ? 'No scope was parsed for this enquiry yet.'
            : `${totalItems} item${totalItems === 1 ? '' : 's'} to triage. Move misplaced items to their correct discipline category before continuing.`
        }
      />

      {!reviewedAt && totalItems > 0 && (
        <Alert severity="info" icon={<AiIcon />} sx={{ mb: 2 }}>
          The AI parser groups items by best guess. Surveys / inspections of equipment are services
          and belong in the matching engineering bucket — not in <b>Manufactured</b> or{' '}
          <b>Bought Out</b>, which are reserved for items we will fabricate or procure.
        </Alert>
      )}

      {totalItems === 0 ? (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            Nothing to triage. Run the AI parser from the enquiry detail page first.
          </Typography>
          <Button
            startIcon={<BackIcon />}
            sx={{ mt: 2 }}
            onClick={() => router.push(`/proposals/enquiries/${enquiry.id}`)}
          >
            Back to enquiry
          </Button>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {grouped.map((group) => {
            if (group.rows.length === 0) return null;
            const isWrongBucketWarning =
              (group.key === 'MANUFACTURED' || group.key === 'BOUGHT_OUT') &&
              group.rows.some((r) => r.item.classification === 'SERVICE');
            return (
              <Card key={group.key} variant="outlined">
                <CardContent>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mb: 1.5 }}
                  >
                    <Typography variant="subtitle1" fontWeight={600}>
                      {group.label}
                    </Typography>
                    <Chip
                      label={`${group.rows.length} item${group.rows.length === 1 ? '' : 's'}`}
                      size="small"
                      variant="outlined"
                    />
                  </Stack>
                  {isWrongBucketWarning && (
                    <Alert severity="warning" sx={{ mb: 1.5 }}>
                      Service items in {group.label} are likely mis-categorised — these usually
                      belong in a discipline bucket (Process Design, Electrical, Instrumentation,
                      …).
                    </Alert>
                  )}
                  <Divider sx={{ mb: 1.5 }} />
                  <Stack spacing={1}>
                    {group.rows.map((row) => (
                      <Stack
                        key={row.item.id}
                        direction="row"
                        spacing={1.5}
                        alignItems="center"
                        sx={{
                          p: 1,
                          borderRadius: 1,
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <Chip
                          label={row.item.classification === 'SUPPLY' ? 'Supply' : 'Service'}
                          size="small"
                          variant="outlined"
                          color={row.item.classification === 'SUPPLY' ? 'secondary' : 'primary'}
                          sx={{ minWidth: 72 }}
                        />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={500} noWrap>
                            {row.item.name}
                          </Typography>
                          {row.item.description && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: 'block', mt: 0.25 }}
                            >
                              {row.item.description}
                            </Typography>
                          )}
                        </Box>
                        <FormControl size="small" sx={{ minWidth: 220 }}>
                          <Select
                            value={row.categoryKey}
                            onChange={(e) =>
                              handleCategoryChange(row.item.id, e.target.value as ScopeCategoryKey)
                            }
                          >
                            {ALL_CATEGORY_OPTIONS.map((opt) => (
                              <MenuItem key={opt.key} value={opt.key}>
                                {opt.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <Tooltip title="Drop this item from the parsed scope">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(row.item.id)}
                            aria-label="Drop item"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}

      <Stack
        direction="row"
        spacing={1.5}
        justifyContent="flex-end"
        sx={{ mt: 3, position: 'sticky', bottom: 16 }}
      >
        <Button
          variant="outlined"
          startIcon={<BackIcon />}
          onClick={() => router.push(`/proposals/enquiries/${enquiry.id}`)}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving || !claimsKnown || totalItems === 0}
        >
          Save &amp; continue
        </Button>
      </Stack>
    </Container>
  );
}
