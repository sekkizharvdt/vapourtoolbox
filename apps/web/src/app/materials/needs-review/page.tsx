// rule28-exempt: review queue is a filtered view of /materials, not a separate module — opens existing /materials/[id] for the actual edit (Save Changes there clears needsReview)

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Alert,
  TextField,
  InputAdornment,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { PageHeader, LoadingState, EmptyState } from '@vapour/ui';
import { PageBreadcrumbs } from '@/components/common/PageBreadcrumbs';
import { Home as HomeIcon, Search as SearchIcon } from '@mui/icons-material';
import { getFirebase } from '@/lib/firebase';
import { queryMaterials } from '@/lib/materials/queries';
import { type Material, MATERIAL_CATEGORY_LABELS } from '@vapour/types';

function toJsDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'object' && val !== null && 'toDate' in val) {
    return (val as { toDate: () => Date }).toDate();
  }
  return null;
}

export default function MaterialsNeedsReviewPage() {
  const router = useRouter();
  const { db } = getFirebase();

  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const load = useCallback(async () => {
    if (!db) return;
    try {
      setLoading(true);
      const result = await queryMaterials(db, {
        needsReviewOnly: true,
        sortField: 'updatedAt',
        sortDirection: 'desc',
        limitResults: 200,
      });
      setMaterials(result.materials);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load review queue');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = searchTerm.trim()
    ? materials.filter((m) => {
        const t = searchTerm.toLowerCase();
        return (
          m.materialCode.toLowerCase().includes(t) ||
          m.name.toLowerCase().includes(t) ||
          (m.description ?? '').toLowerCase().includes(t)
        );
      })
    : materials;

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <PageBreadcrumbs
          items={[
            { label: 'Materials', href: '/materials', icon: <HomeIcon fontSize="small" /> },
            { label: 'Needs Review' },
          ]}
        />
        <PageHeader
          title="Materials — Needs Review"
          subtitle="AI-auto-created records from PR / quote imports. Open each, normalize the spec, then clear the review flag on the detail page."
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search by code, name, description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 320 }}
        />
      </Box>

      {loading ? (
        <LoadingState message="Loading review queue..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={searchTerm ? 'No matches' : 'Nothing to review'}
          message={
            searchTerm
              ? 'Try a different search term.'
              : 'Auto-created materials from PR / quote imports will appear here for spec verification.'
          }
        />
      ) : (
        <Card>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Base Unit</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell>By</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow
                    key={m.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/materials/${m.id}`)}
                  >
                    <TableCell sx={{ fontWeight: 500 }}>
                      <Typography variant="body2" fontWeight="medium">
                        {m.materialCode}
                      </Typography>
                      <Chip label="needs review" size="small" color="warning" sx={{ mt: 0.5 }} />
                    </TableCell>
                    <TableCell>{m.name}</TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {MATERIAL_CATEGORY_LABELS[m.category] ?? m.category}
                      </Typography>
                    </TableCell>
                    <TableCell>{m.baseUnit}</TableCell>
                    <TableCell>
                      {toJsDate(m.createdAt)?.toLocaleDateString('en-IN') ?? '-'}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {m.createdBy === 'AI PR Parser' ? 'AI PR Parser' : m.createdBy}
                      </Typography>
                    </TableCell>
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
