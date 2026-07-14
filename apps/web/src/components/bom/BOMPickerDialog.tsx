'use client';

/**
 * BOM Picker Dialog
 *
 * Lets the user link one or more estimation BOMs to a proposal costing
 * block (BOM_COST_SHEET). Lists the tenant's BOMs with code / name /
 * total cost, client-side search on code+name, and checkbox multi-select.
 *
 * Already-linked BOMs (excludeIds) render checked + disabled. BOMs linked
 * to a *different* proposal show a warning chip but stay selectable —
 * linking re-points their back-link.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { LoadingState, EmptyState } from '@vapour/ui';
import { getFirebase } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { listBOMs } from '@/lib/bom/bomService';
import { formatCurrency } from '@/lib/utils/formatters';
import { createLogger } from '@vapour/logger';
import type { BOM } from '@vapour/types';

const logger = createLogger({ context: 'BOMPickerDialog' });

interface BOMPickerDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the full BOM docs the user chose to link. */
  onSelect: (boms: BOM[]) => void;
  /** BOM ids already linked to the block — shown checked + disabled. */
  excludeIds: string[];
  /** Current proposal id — used to flag BOMs linked to another proposal. */
  currentProposalId?: string;
}

export default function BOMPickerDialog({
  open,
  onClose,
  onSelect,
  excludeIds,
  currentProposalId,
}: BOMPickerDialogProps) {
  const { db } = getFirebase();
  const { claims } = useAuth();
  const tenantId = claims?.tenantId || 'default-entity';

  const [boms, setBOMs] = useState<BOM[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Rule 14b: re-sync dialog state every time it opens.
  useEffect(() => {
    if (!open) return;
    setSearch('');
    setSelectedIds([]);
    setLoadError(null);

    if (!db) return;
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const list = await listBOMs(db, { tenantId, limit: 100 });
        if (cancelled) return;
        // Rule 3: soft-delete filter client-side. BOMs are hard-deleted
        // today, but filter defensively so a future soft-delete can't leak.
        setBOMs(list.filter((b) => !(b as BOM & { isDeleted?: boolean }).isDeleted));
      } catch (err) {
        if (!cancelled) {
          logger.error('Failed to load BOMs for picker', { error: err });
          setLoadError('Failed to load BOMs. Please try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, db, tenantId]);

  const filtered = useMemo(() => {
    const term = (search ?? '').trim().toLowerCase();
    if (!term) return boms;
    return boms.filter(
      (b) =>
        (b.bomCode ?? '').toLowerCase().includes(term) ||
        (b.name ?? '').toLowerCase().includes(term)
    );
  }, [boms, search]);

  const toggle = (bomId: string) => {
    setSelectedIds((prev) =>
      prev.includes(bomId) ? prev.filter((id) => id !== bomId) : [...prev, bomId]
    );
  };

  const handleLink = () => {
    const chosen = boms.filter((b) => selectedIds.includes(b.id));
    onSelect(chosen);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Link BOMs from estimation</DialogTitle>
      <DialogContent dividers>
        <TextField
          fullWidth
          size="small"
          placeholder="Search by BOM code or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        {loading ? (
          <LoadingState message="Loading BOMs…" />
        ) : loadError ? (
          <EmptyState title="Could not load BOMs" message={loadError} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No BOMs found"
            message={
              search
                ? 'No BOMs match your search.'
                : 'No BOMs exist yet — create one in the Estimation module first.'
            }
          />
        ) : (
          <TableContainer sx={{ maxHeight: 420 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>BOM Code</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell align="right">Total Cost</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((bom) => {
                  const alreadyLinked = excludeIds.includes(bom.id);
                  const linkedElsewhere = !!bom.proposalId && bom.proposalId !== currentProposalId;
                  return (
                    <TableRow
                      key={bom.id}
                      hover
                      onClick={() => !alreadyLinked && toggle(bom.id)}
                      sx={{ cursor: alreadyLinked ? 'default' : 'pointer' }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={alreadyLinked || selectedIds.includes(bom.id)}
                          disabled={alreadyLinked}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggle(bom.id)}
                        />
                      </TableCell>
                      <TableCell>{bom.bomCode}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2">{bom.name}</Typography>
                          {alreadyLinked && <Chip label="Linked" size="small" variant="outlined" />}
                          {!alreadyLinked && linkedElsewhere && (
                            <Chip
                              label={`Linked to ${bom.proposalNumber ?? 'another proposal'}`}
                              size="small"
                              color="warning"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        {formatCurrency(
                          bom.summary?.totalCost?.amount ?? 0,
                          bom.summary?.totalCost?.currency ?? 'INR'
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleLink} disabled={selectedIds.length === 0}>
          Link {selectedIds.length > 0 ? `${selectedIds.length} ` : ''}BOM
          {selectedIds.length === 1 ? '' : 's'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
