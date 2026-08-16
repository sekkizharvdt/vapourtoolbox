'use client';

import { useEffect, useMemo } from 'react';
import { Alert, Box, MenuItem, Stack, TextField, Typography } from '@mui/material';
import type { CatalogLineDimensions, Material, MaterialVariant } from '@vapour/types';
import {
  buildLineDimensions,
  getShapesForMaterial,
  getUserParameters,
} from '@/lib/catalog/lineDimensions';
import {
  filterAvailableVariants,
  sortVariantsByThickness,
  getVariantDisplayName,
} from '@/lib/materials/variantUtils';

/**
 * Shape / thickness / size entry for a dimensioned raw-material line.
 *
 * Fully controlled — it owns no state, so the same component serves the
 * material picker (capturing dimensions at selection time) and the line-row
 * edit dialog (adjusting them afterwards) without either copy drifting.
 *
 * Shape and thickness are dropdowns over existing data — the shapes dataset
 * and the material's own variants. Only the sizes are typed.
 */

export interface DimensionsDraft {
  shapeId: string;
  variantId: string;
  /** Raw text per shape parameter, so a half-typed "20" doesn't snap to 20 mm. */
  parameters: Record<string, string>;
  /** Piece count. Text for the same reason. */
  quantity: string;
}

/** Empty draft, seeded with the material's first shape and thinnest variant. */
export function initialDimensionsDraft(
  material: Material,
  existing?: CatalogLineDimensions,
  quantity?: number
): DimensionsDraft {
  const shapes = getShapesForMaterial(material);
  const variants = sortVariantsByThickness(filterAvailableVariants(material.variants ?? []));

  const shapeId = existing?.shapeId ?? shapes[0]?.id ?? '';
  const variantId = existing?.variantId ?? variants[0]?.id ?? '';

  const parameters: Record<string, string> = {};
  const shape = shapes.find((s) => s.id === shapeId);
  if (shape) {
    for (const param of getUserParameters(shape)) {
      const stored = existing?.parameters?.[param.name];
      parameters[param.name] = String(stored ?? param.defaultValue ?? '');
    }
  }

  return { shapeId, variantId, parameters, quantity: String(quantity ?? 1) };
}

/**
 * Resolve a draft into the persisted record. Returns null while the draft is
 * incomplete, which is also the caller's "can't confirm yet" test.
 */
export function resolveDimensionsDraft(
  material: Material,
  draft: DimensionsDraft
): { dimensions: CatalogLineDimensions; quantity: number } | null {
  const shape = getShapesForMaterial(material).find((s) => s.id === draft.shapeId);
  if (!shape) return null;

  const quantity = Number(draft.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  const parameters: Record<string, number> = {};
  for (const param of getUserParameters(shape)) {
    const value = Number(draft.parameters[param.name]);
    if (!Number.isFinite(value) || value <= 0) return null;
    parameters[param.name] = value;
  }

  const variant = (material.variants ?? []).find((v) => v.id === draft.variantId);
  return {
    dimensions: buildLineDimensions({ shape, material, variant, parameters, quantity }),
    quantity,
  };
}

interface MaterialDimensionsFormProps {
  material: Material;
  draft: DimensionsDraft;
  onChange: (draft: DimensionsDraft) => void;
  /** Hide the piece-count field where the caller owns quantity (the PR row). */
  showQuantity?: boolean;
  /**
   * Hide the thickness dropdown where the caller already chose the variant —
   * the inline PR row picks grade and thickness in its own cascade, so
   * repeating the control here would be two controls for one value.
   */
  showVariantSelect?: boolean;
}

export default function MaterialDimensionsForm({
  material,
  draft,
  onChange,
  showQuantity = true,
  showVariantSelect = true,
}: MaterialDimensionsFormProps) {
  const shapes = useMemo(() => getShapesForMaterial(material), [material]);
  const variants = useMemo(
    () => sortVariantsByThickness(filterAvailableVariants(material.variants ?? [])),
    [material.variants]
  );

  const shape = useMemo(() => shapes.find((s) => s.id === draft.shapeId), [shapes, draft.shapeId]);
  const userParams = useMemo(() => (shape ? getUserParameters(shape) : []), [shape]);

  // Switching shape changes which parameters exist (a circular plate wants D,
  // not L × W). Re-seed the parameter map from the new shape's defaults,
  // keeping any value whose parameter survived the switch.
  useEffect(() => {
    if (!shape) return;
    const names = userParams.map((p) => p.name);
    const stale = names.some((name) => draft.parameters[name] === undefined);
    const extra = Object.keys(draft.parameters).some((name) => !names.includes(name));
    if (!stale && !extra) return;

    const parameters: Record<string, string> = {};
    for (const param of userParams) {
      parameters[param.name] = draft.parameters[param.name] ?? String(param.defaultValue ?? '');
    }
    onChange({ ...draft, parameters });
  }, [shape, userParams, draft, onChange]);

  const resolved = useMemo(() => resolveDimensionsDraft(material, draft), [material, draft]);

  const selectedVariant: MaterialVariant | undefined = variants.find(
    (v) => v.id === draft.variantId
  );

  if (shapes.length === 0) {
    return (
      <Alert severity="info">
        No shape in the shape database accepts {material.name}. Dimensions can&apos;t be captured
        for this material — describe the size in the specification field instead.
      </Alert>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          select
          label="Shape"
          value={draft.shapeId}
          onChange={(e) => onChange({ ...draft, shapeId: e.target.value })}
          size="small"
          fullWidth
          required
        >
          {shapes.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
        </TextField>

        {showVariantSelect && (
          <TextField
            select
            label="Thickness"
            value={draft.variantId}
            onChange={(e) => onChange({ ...draft, variantId: e.target.value })}
            size="small"
            fullWidth
            required
            disabled={variants.length === 0}
            helperText={
              variants.length === 0 ? 'This material has no thickness variants' : undefined
            }
          >
            {variants.map((variant) => (
              <MenuItem key={variant.id} value={variant.id}>
                {getVariantDisplayName(variant)}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        {userParams.map((param) => (
          <TextField
            key={param.name}
            type="number"
            label={param.label}
            value={draft.parameters[param.name] ?? ''}
            onChange={(e) =>
              onChange({
                ...draft,
                parameters: { ...draft.parameters, [param.name]: e.target.value },
              })
            }
            size="small"
            fullWidth
            required
            InputProps={{ endAdornment: <Typography variant="caption">{param.unit}</Typography> }}
            inputProps={{ min: param.minValue ?? 0, step: 'any' }}
          />
        ))}

        {showQuantity && (
          <TextField
            type="number"
            label="Pieces"
            value={draft.quantity}
            onChange={(e) => onChange({ ...draft, quantity: e.target.value })}
            size="small"
            fullWidth
            required
            inputProps={{ min: 1, step: 1 }}
          />
        )}
      </Stack>

      <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
        {resolved?.dimensions.totalWeightKg !== undefined ? (
          <Typography variant="body2">
            <strong>{resolved.dimensions.totalWeightKg} kg</strong> total
            {resolved.quantity > 1 && resolved.dimensions.unitWeightKg !== undefined && (
              <>
                {' '}
                &mdash; {resolved.dimensions.unitWeightKg} kg per piece &times; {resolved.quantity}
              </>
            )}
            {selectedVariant?.weightPerUnit !== undefined && (
              <Typography component="span" variant="caption" color="text.secondary">
                {' '}
                (at {material.properties?.density ?? 7850} kg/m³)
              </Typography>
            )}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Enter every dimension to see the weight.
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
