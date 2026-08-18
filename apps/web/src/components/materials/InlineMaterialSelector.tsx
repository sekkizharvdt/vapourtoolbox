'use client';

import { useMemo } from 'react';
import { ListSubheader, MenuItem, Stack, TextField, Typography } from '@mui/material';
import type { CatalogLineDimensions, Material, MaterialVariant } from '@vapour/types';
import {
  buildCascade,
  buildMaterialOptions,
  getRawMaterialKinds,
  materialOptionIdFor,
  orderSizingForKind,
  parseMaterialOptionId,
  resolveMaterial,
  type RawMaterialKind,
} from '@/lib/catalog/inlineSizing';
import MaterialDimensionsForm, {
  initialDimensionsDraft,
  resolveDimensionsDraft,
  type DimensionsDraft,
} from './MaterialDimensionsForm';

/**
 * Inline catalogue selection on a procurement line — dropdowns instead of a
 * dialog, for the small structured set that raw material actually is.
 *
 * Everything is driven by `CATALOG_SIZING`, so this component has no
 * per-category branches. It renders two things:
 *
 *   1. the cascade for the kind's `discriminators`
 *      (plate: grade → thickness; pipe: family → NPS → schedule)
 *   2. whatever the kind's `orderSizing` asks for
 *      (SHAPE → shape + parameters; LENGTH → nothing, `quantity` is the
 *       length in metres; NONE → nothing)
 *
 * Anything not inline-selectable — bought-out items, services, the long tail —
 * still goes through the catalog picker. This is an express lane, not a
 * replacement.
 */

export interface InlineSelectorState {
  /** Group key, e.g. 'plates'. Empty until the user picks a kind. */
  kindKey: string;
  /** Chosen discriminator values, keyed by field. */
  chosen: Record<string, string>;
  /** Shape + parameters, for a kind whose orderSizing is SHAPE. */
  dimensions?: DimensionsDraft;
}

export const EMPTY_INLINE_STATE: InlineSelectorState = { kindKey: '', chosen: {} };

export interface InlineResolution {
  material: Material;
  variant?: MaterialVariant;
  dimensions?: CatalogLineDimensions;
  /** Quantity implied by the sizing (piece count for SHAPE). Undefined otherwise. */
  quantity?: number;
  /** The unit the line should carry, from the kind's pricing unit. */
  unit: string;
}

const UNIT_FOR_PRICING = { KG: 'KG', METER: 'METER', PIECE: 'NOS' } as const;

/** Resolve the current state, or null while it is incomplete. */
export function resolveInlineSelection(
  state: InlineSelectorState,
  materials: Material[]
): InlineResolution | null {
  const kind = getRawMaterialKinds().find((k) => k.key === state.kindKey);
  if (!kind) return null;

  const resolved = resolveMaterial(kind, materials, state.chosen);
  if (!resolved) return null;

  const sizing = orderSizingForKind(kind);
  if (sizing !== 'SHAPE') {
    // A pipe's length rides on `quantity` in metres; a NONE kind needs nothing.
    return { ...resolved, unit: UNIT_FOR_PRICING[kind.pricingUnit] };
  }

  if (!state.dimensions) return null;
  const dims = resolveDimensionsDraft(resolved.material, state.dimensions);
  if (!dims) return null;
  // A sized plate is ordered in pieces — the kg live on the dimensions record.
  return { ...resolved, dimensions: dims.dimensions, quantity: dims.quantity, unit: 'NOS' };
}

interface InlineMaterialSelectorProps {
  /** Raw materials already loaded by the page (plates + pipes). */
  materials: Material[];
  state: InlineSelectorState;
  onChange: (next: InlineSelectorState) => void;
  /** Hides the piece-count field inside the shape form; the row owns quantity. */
  showQuantity?: boolean;
  disabled?: boolean;
}

export default function InlineMaterialSelector({
  materials,
  state,
  onChange,
  showQuantity = false,
  disabled = false,
}: InlineMaterialSelectorProps) {
  const kinds = useMemo(() => getRawMaterialKinds(), []);
  const kind: RawMaterialKind | undefined = kinds.find((k) => k.key === state.kindKey);

  const materialOptions = useMemo(() => buildMaterialOptions(materials), [materials]);

  const steps = useMemo(
    () => (kind ? buildCascade(kind, materials, state.chosen) : []),
    [kind, materials, state.chosen]
  );

  const resolved = kind ? resolveMaterial(kind, materials, state.chosen) : null;
  const sizing = kind ? orderSizingForKind(kind) : 'NONE';

  /**
   * Choosing a value invalidates every LATER step — picking a different NPS
   * can leave a schedule that size doesn't offer. Drop the downstream choices
   * rather than silently resolving to nothing.
   */
  const handleCascadeChange = (field: string, value: string) => {
    const order = steps.map((s) => s.field);
    const index = order.indexOf(field);
    const kept: Record<string, string> = {};
    order.slice(0, index).forEach((f) => {
      if (state.chosen[f]) kept[f] = state.chosen[f];
    });
    kept[field] = value;
    onChange({ ...state, chosen: kept, dimensions: undefined });
  };

  // Seed the shape draft as soon as the material is known.
  const dimensionsDraft =
    state.dimensions ?? (resolved ? initialDimensionsDraft(resolved.material) : undefined);

  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start" flexWrap="wrap" useFlexGap>
      {/* Kind and grade are one question, not two — nobody picks "Plates" as an
          end in itself. One grouped control, 16 plate grades and 6 pipe
          families, so the row asks for the material once. */}
      <TextField
        select
        label="Material"
        size="small"
        value={materialOptionIdFor(state)}
        onChange={(e) => {
          const parsed = parseMaterialOptionId(e.target.value);
          if (!parsed) return;
          onChange({
            kindKey: parsed.kindKey,
            chosen: { [parsed.field]: parsed.value },
            dimensions: undefined,
          });
        }}
        disabled={disabled}
        sx={{ minWidth: 250 }}
      >
        {materialOptions.flatMap((group) => [
          <ListSubheader key={group.kindKey}>{group.label}</ListSubheader>,
          ...group.options.map((option) => (
            <MenuItem key={option.id} value={option.id}>
              {option.label}
            </MenuItem>
          )),
        ])}
      </TextField>

      {/* Remaining discriminators — thickness for a plate, NPS + schedule for a
          pipe. The first step is already answered by the control above. */}
      {steps.slice(1).map((step) => (
        <TextField
          key={step.field}
          select
          label={step.label}
          size="small"
          value={state.chosen[step.field] ?? ''}
          onChange={(e) => handleCascadeChange(step.field, e.target.value)}
          disabled={disabled || step.options.length === 0}
          sx={{ minWidth: 120 }}
        >
          {step.options.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      ))}

      {/* Order sizing — only a SHAPE kind asks for anything extra. */}
      {sizing === 'SHAPE' && resolved && dimensionsDraft && (
        <MaterialDimensionsForm
          material={resolved.material}
          draft={{ ...dimensionsDraft, variantId: resolved.variant?.id ?? '' }}
          onChange={(dimensions) => onChange({ ...state, dimensions })}
          showQuantity={showQuantity}
          showVariantSelect={false}
          inline
        />
      )}

      {sizing === 'LENGTH' && resolved && (
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
          Length goes in the Qty column, in metres.
        </Typography>
      )}
    </Stack>
  );
}
