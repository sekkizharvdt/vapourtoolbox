'use client';

import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import type { CatalogLineDimensions, Material } from '@vapour/types';
import { getFirebase } from '@/lib/firebase';
import { getMaterialById } from '@/lib/materials/crud';
import MaterialDimensionsForm, {
  initialDimensionsDraft,
  resolveDimensionsDraft,
  type DimensionsDraft,
} from './MaterialDimensionsForm';

/**
 * Adjust the shape / thickness / size of a line that already has them, without
 * reopening the catalog picker and re-choosing the material.
 *
 * The material document isn't on the line (only its id), so it is fetched on
 * open — the variants list and density both live there.
 */

interface EditLineDimensionsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Material the line points at. */
  materialId: string;
  /** Shown while the material loads. */
  materialName?: string;
  dimensions?: CatalogLineDimensions;
  quantity: number;
  onSave: (dimensions: CatalogLineDimensions, quantity: number) => void;
}

export default function EditLineDimensionsDialog({
  open,
  onClose,
  materialId,
  materialName,
  dimensions,
  quantity,
  onSave,
}: EditLineDimensionsDialogProps) {
  const [material, setMaterial] = useState<Material | null>(null);
  const [draft, setDraft] = useState<DimensionsDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync on every open — the dialog is reused across rows, so first-render
  // state would show the previous line's plate (rule 14b).
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setMaterial(null);
    setDraft(null);
    setError(null);
    setLoading(true);

    const { db } = getFirebase();
    if (!db) {
      setError('Not connected. Try again in a moment.');
      setLoading(false);
      return;
    }

    getMaterialById(db, materialId)
      .then((loaded) => {
        if (cancelled) return;
        if (!loaded) {
          setError('That material is no longer in the material master.');
          return;
        }
        setMaterial(loaded);
        setDraft(initialDimensionsDraft(loaded, dimensions, quantity));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, materialId, dimensions, quantity]);

  const resolved = material && draft ? resolveDimensionsDraft(material, draft) : null;

  const handleSave = () => {
    if (!resolved) return;
    onSave(resolved.dimensions, resolved.quantity);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Dimensions &mdash; {material?.name ?? materialName ?? 'Material'}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {loading && <Typography variant="body2">Loading material&hellip;</Typography>}
        {material && draft && (
          <MaterialDimensionsForm material={material} draft={draft} onChange={setDraft} />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!resolved}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
