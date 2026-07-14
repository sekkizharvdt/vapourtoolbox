'use client';

/**
 * Export the MED design's equipment bill to a real estimation BOM
 * (completion plan A3 — Thermal → BOM export).
 *
 * Flow: on open, the dialog derives the generic thermal lines from the
 * current generateMEDBOM output, looks up saved material mappings
 * (thermalMaterialMappings), and lists each DISTINCT material/item string
 * with its resolution. Unresolved strings can be mapped via the unified
 * CatalogPickerDialog — saved mappings are one-time per material. Unmapped
 * strings do NOT block export: those lines land as flagged zero-cost items.
 *
 * The dialog is stateless per-open (rule 14b): everything re-derives from
 * the live BOM prop + a fresh mapping lookup each time it opens.
 */

import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { LoadingState } from '@vapour/ui';
import { Link as LinkIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/common/Toast';
import { getFirebase } from '@/lib/firebase';
import { retryOnStaleToken } from '@/lib/firebase/retryOnStaleToken';
import { formatDate } from '@/lib/utils/formatters';
import CatalogPickerDialog, {
  type CatalogSelection,
} from '@/components/catalog/CatalogPickerDialog';
import {
  medEquipmentToThermalLines,
  distinctThermalKeys,
  convertThermalLinesToBOMItems,
  type DistinctThermalKey,
} from '@/lib/bom/thermalBomImport';
import {
  getThermalMappings,
  upsertThermalMapping,
  type ThermalMaterialMapping,
} from '@/lib/bom/thermalMaterialMappings';
import { createBOMWithItems, getBOMItems, recalculateBOMSummary } from '@/lib/bom/bomService';
import { calculateAllItemCosts } from '@/lib/bom/bomCalculations';
import { BOMCategory } from '@vapour/types';
import type { MEDCompleteBOM } from '@/lib/thermal/medBOMGenerator';
import type { MEDDesignerResult } from '@/lib/thermal';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'ExportToBOMDialog' });

interface ExportToBOMDialogProps {
  open: boolean;
  onClose: () => void;
  bom: MEDCompleteBOM | null;
  designResult: MEDDesignerResult | null;
}

interface ExportResult {
  bomId: string;
  bomCode: string;
  unmappedCount: number;
}

export function ExportToBOMDialog({ open, onClose, bom, designResult }: ExportToBOMDialogProps) {
  const router = useRouter();
  const { user, claims } = useAuth();
  const { toast } = useToast();
  const tenantId = claims?.tenantId || 'default-entity';

  const [rows, setRows] = useState<DistinctThermalKey[]>([]);
  const [mappings, setMappings] = useState<Map<string, ThermalMaterialMapping>>(new Map());
  const [loadingMappings, setLoadingMappings] = useState(false);
  const [pickerRow, setPickerRow] = useState<DistinctThermalKey | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lines = bom ? medEquipmentToThermalLines(bom) : [];

  // Rule 14b: re-derive everything each time the dialog opens — the design
  // (and therefore the material list) may have changed since the last open.
  useEffect(() => {
    if (!open) return;
    setExportResult(null);
    setError(null);
    setPickerRow(null);

    if (!bom) {
      setRows([]);
      setMappings(new Map());
      return;
    }

    const distinct = distinctThermalKeys(medEquipmentToThermalLines(bom));
    setRows(distinct);
    setMappings(new Map());
    setLoadingMappings(true);

    let cancelled = false;
    (async () => {
      try {
        const { db } = getFirebase();
        const found = await retryOnStaleToken(() =>
          getThermalMappings(
            db,
            distinct.map((row) => row.normalizedKey)
          )
        );
        if (!cancelled) setMappings(found);
      } catch (err) {
        logger.error('Failed to load thermal material mappings', { error: err });
        if (!cancelled) {
          setError(
            `Failed to load saved mappings: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      } finally {
        if (!cancelled) setLoadingMappings(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, bom]);

  const handleMappingSelect = async (selection: CatalogSelection) => {
    const row = pickerRow;
    setPickerRow(null);
    if (!row || !user) return;
    // Physical BOM components can only be materials or bought-out items; the
    // picker is restricted to those kinds below.
    if (selection.ref.kind === 'SERVICE') return;
    const kind = selection.ref.kind;

    try {
      const { db } = getFirebase();
      const saved = await retryOnStaleToken(() =>
        upsertThermalMapping(
          db,
          {
            sourceText: row.sourceText,
            kind,
            targetId: selection.ref.id,
            targetCode: selection.ref.code,
            targetName: selection.ref.name,
          },
          user.uid
        )
      );
      setMappings((prev) => {
        const next = new Map(prev);
        next.set(row.normalizedKey, saved);
        return next;
      });
      toast.success(`Mapped "${row.sourceText}" to ${saved.targetCode}`);
    } catch (err) {
      logger.error('Failed to save thermal material mapping', { error: err });
      toast.error(`Failed to save mapping: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const unmappedCount = rows.filter((row) => !mappings.has(row.normalizedKey)).length;

  const handleExport = async () => {
    if (!bom || !designResult || !user) return;

    setExporting(true);
    setError(null);
    try {
      const { db } = getFirebase();
      const { items, unmappedLines } = convertThermalLinesToBOMItems(lines, mappings);
      if (items.length === 0) {
        throw new Error('The design produced no exportable BOM lines');
      }

      const capacity = Math.round(designResult.totalDistillateM3Day);
      const name = `MED ${capacity} m³/day — ${formatDate(new Date())}`;

      // Rule 35: every Firestore-touching step is wrapped — the first call to
      // execute fails first on a stale token.
      const { bom: createdBOM } = await retryOnStaleToken(() =>
        createBOMWithItems(
          db,
          {
            name,
            description: `Exported from MED Plant Designer (${designResult.effects.length} effects, GOR ${designResult.achievedGOR.toFixed(1)}). ${unmappedLines.length} line(s) unmapped at export.`,
            category: BOMCategory.GENERAL_EQUIPMENT,
            tenantId,
          },
          items,
          user.uid
        )
      );

      // Price the mapped lines and fold costs into the summary (same steps as
      // the BOM editor's "Calculate Costs").
      const createdItems = await retryOnStaleToken(() => getBOMItems(db, createdBOM.id));
      await retryOnStaleToken(() =>
        calculateAllItemCosts(db, createdBOM.id, createdItems, user.uid)
      );
      await retryOnStaleToken(() => recalculateBOMSummary(db, createdBOM.id, user.uid));

      const unmappedLineCount = unmappedLines.length;
      setExportResult({
        bomId: createdBOM.id,
        bomCode: createdBOM.bomCode,
        unmappedCount: unmappedLineCount,
      });
      toast.success(
        unmappedLineCount > 0
          ? `BOM ${createdBOM.bomCode} created — ${unmappedLineCount} line(s) exported unpriced; map them in the BOM editor or this dialog`
          : `BOM ${createdBOM.bomCode} created with ${items.length} priced lines`
      );
    } catch (err) {
      logger.error('Thermal → BOM export failed', { error: err });
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>Export to Estimation BOM</DialogTitle>
        <DialogContent dividers>
          {!user && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Sign in to export the design to an estimation BOM.
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {exportResult ? (
            <Stack spacing={2} alignItems="flex-start">
              <Alert severity="success" sx={{ width: '100%' }}>
                BOM <strong>{exportResult.bomCode}</strong> created.
                {exportResult.unmappedCount > 0 && (
                  <>
                    {' '}
                    {exportResult.unmappedCount} line(s) exported unpriced — map them in the BOM
                    editor or this dialog, then recalculate costs.
                  </>
                )}
              </Alert>
              <Button
                variant="contained"
                startIcon={<OpenInNewIcon />}
                onClick={() => router.push(`/estimation/${exportResult.bomId}`)}
              >
                Open BOM
              </Button>
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {lines.length} equipment lines will be exported. Each distinct material below maps
                to a catalog item once — the mapping is remembered for every future export. Unmapped
                materials still export, as unpriced lines.
              </Typography>

              {loadingMappings ? (
                <LoadingState message="Loading saved material mappings..." />
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Material / Item</TableCell>
                      <TableCell align="right">Lines</TableCell>
                      <TableCell>Mapped To</TableCell>
                      <TableCell align="right" />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => {
                      const mapping = mappings.get(row.normalizedKey);
                      return (
                        <TableRow key={row.normalizedKey}>
                          <TableCell>{row.sourceText}</TableCell>
                          <TableCell align="right">{row.lineCount}</TableCell>
                          <TableCell>
                            {mapping ? (
                              <Chip
                                icon={<LinkIcon />}
                                label={`${mapping.targetCode} — ${mapping.targetName}`}
                                size="small"
                                color="success"
                                variant="outlined"
                              />
                            ) : (
                              <Chip
                                label="Not mapped (exports unpriced)"
                                size="small"
                                color="warning"
                                variant="outlined"
                              />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={!user}
                              onClick={() => setPickerRow(row)}
                            >
                              {mapping ? 'Remap' : 'Map'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>{exportResult ? 'Close' : 'Cancel'}</Button>
          {!exportResult && (
            <Button
              variant="contained"
              onClick={handleExport}
              disabled={!user || !bom || !designResult || exporting || loadingMappings}
            >
              {exporting
                ? 'Exporting…'
                : unmappedCount > 0
                  ? `Export (${unmappedCount} unmapped)`
                  : 'Export'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <CatalogPickerDialog
        open={pickerRow !== null}
        onClose={() => setPickerRow(null)}
        onSelect={handleMappingSelect}
        defaultKind={pickerRow?.kindHint ?? 'RAW_MATERIAL'}
        kinds={['RAW_MATERIAL', 'BOUGHT_OUT']}
      />
    </>
  );
}
