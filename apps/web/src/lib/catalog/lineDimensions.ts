/**
 * Structured line dimensions for procurement raw-material lines.
 *
 * Plates are the case this exists for. A plate material is one document per
 * grade with thickness as variants (`usesVariantModel`), so picking the
 * material alone leaves the size unstated — engineers used to type it into the
 * free-text `specification` ("114 dia x 4 thk x 6000 lg"), which nothing
 * downstream can read. Here the engineer picks a shape, a thickness variant,
 * and the remaining dimensions, and the weight is derived.
 *
 * Everything geometric is delegated: shapes come from the existing shapes
 * dataset (`@/data/shapes`) and the weight comes from the same
 * `calculateShape` the BOM editor uses. This module is a THIN adapter between
 * a procurement line and those two, not a second geometry model (rule 32).
 *
 * Piping deliberately has no place here: a pipe document IS its NPS +
 * schedule, and its length rides on `quantity` in metres.
 */

import type { CatalogLineDimensions, Material, MaterialVariant, Shape } from '@vapour/types';
import { usesVariantModel } from '@vapour/types';
import { getAllShapes, getShapeById } from '@/lib/shapes/shapeData';
import { calculateShape } from '@/lib/shapes/shapeCalculator';

/**
 * The shapes dataset names thickness `t` on every plate shape, and that is the
 * parameter the selected material variant fills in. Everything else on a shape
 * is user input.
 */
export const THICKNESS_PARAM = 't';

/** Weights are stored to 3 dp — a plate is quoted to the kg, not the milligram. */
function roundKg(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Does this material need a dimensions step at all?
 *
 * True for the variants-model categories (plates). Piping and everything flat
 * answers false, so the picker stays a single click for them.
 */
export function needsDimensions(material: Material): boolean {
  return usesVariantModel(material.category);
}

/**
 * Shapes offered for a material, read off each shape's own
 * `allowedMaterialCategories`. Deriving it rather than hardcoding a plate list
 * means a new shape added to the dataset shows up here automatically.
 */
export function getShapesForMaterial(material: Material): Shape[] {
  return getAllShapes().filter(
    (shape) =>
      shape.isActive !== false && shape.allowedMaterialCategories.includes(material.category)
  );
}

/**
 * Parameters the PR form asks for: the shape's REQUIRED parameters, minus the
 * thickness that the material variant supplies. For a rectangular plate that
 * is exactly length and width.
 *
 * Optional parameters (`allowance` on a rectangular plate, `scrapPct` on a
 * custom one) are fabrication inputs, not a procurement callout — they keep
 * their dataset defaults via `buildLineDimensions` so every formula still
 * evaluates, but nobody is asked for them while raising a request.
 */
export function getUserParameters(shape: Shape): Shape['parameters'] {
  return [...shape.parameters]
    .filter((param) => param.required && param.name !== THICKNESS_PARAM)
    .sort((a, b) => a.order - b.order);
}

/** Dataset defaults for the parameters the form doesn't ask about. */
function optionalParameterDefaults(shape: Shape): Record<string, number> {
  const defaults: Record<string, number> = {};
  for (const param of shape.parameters) {
    if (param.required || param.name === THICKNESS_PARAM) continue;
    if (typeof param.defaultValue === 'number') defaults[param.name] = param.defaultValue;
  }
  return defaults;
}

/** Thickness in mm carried by a variant, if it states one. */
export function getVariantThickness(variant: MaterialVariant | undefined): number | undefined {
  return variant?.dimensions?.thickness;
}

export interface BuildLineDimensionsInput {
  shape: Shape;
  material: Material;
  /** Supplies the thickness parameter. Optional so a shape without one still computes. */
  variant?: MaterialVariant;
  /** User-entered parameter values in mm, keyed by shape parameter name (no `t`). */
  parameters: Record<string, number>;
  /** Piece count — drives `totalWeightKg`. */
  quantity: number;
}

/**
 * Build the persisted dimensions record, deriving both weights.
 *
 * Weight comes from `calculateShape`, which uses the material's own density
 * (`properties.density`, defaulting to 7850 kg/m³ for steel). We deliberately
 * do NOT read `variant.weightPerUnit` even though plates carry one: the two
 * disagree on a handful of curated records (PL-SS-304L states 47.58 kg/m² at
 * 6 mm where its 8000 kg/m³ density gives 48.0), and having one formula for
 * every shape beats agreeing with a per-variant figure that only plates have.
 */
export function buildLineDimensions({
  shape,
  material,
  variant,
  parameters,
  quantity,
}: BuildLineDimensionsInput): CatalogLineDimensions {
  const thickness = getVariantThickness(variant);

  // What gets STORED is what the engineer stated: the size parameters plus the
  // thickness the variant fixed. Fabrication defaults are folded in only for
  // the calculation, so a record never claims a cutting allowance nobody chose.
  const stated: Record<string, number> = {
    ...parameters,
    ...(thickness !== undefined && { [THICKNESS_PARAM]: thickness }),
  };
  const parameterValues: Record<string, number> = {
    ...optionalParameterDefaults(shape),
    ...stated,
  };

  const result = calculateShape({ shape, material, parameterValues, quantity });
  const unitWeightKg = result.calculatedValues.weight;

  return {
    shapeId: shape.id,
    shapeName: shape.name,
    ...(variant && { variantId: variant.id, variantCode: variant.variantCode }),
    parameters: stated,
    ...(unitWeightKg > 0 && {
      unitWeightKg: roundKg(unitWeightKg),
      totalWeightKg: roundKg(unitWeightKg * quantity),
    }),
  };
}

/**
 * Recompute `totalWeightKg` when only the piece count changed — cheaper and
 * safer than rebuilding, since it needs neither the shape nor the material.
 */
export function withQuantity(
  dimensions: CatalogLineDimensions,
  quantity: number
): CatalogLineDimensions {
  if (dimensions.unitWeightKg === undefined) return dimensions;
  return { ...dimensions, totalWeightKg: roundKg(dimensions.unitWeightKg * quantity) };
}

/**
 * Compact size string for tables, chips and PDFs — "2000 × 1000 × 6 mm".
 *
 * Parameters are printed in the shape's own declared order with thickness
 * last, which is how a fabricator reads a plate callout. Falls back to the
 * stored key order if the shape is no longer in the dataset.
 */
export function formatLineDimensions(dimensions: CatalogLineDimensions): string {
  const shape = getShapeById(dimensions.shapeId);
  let entries = Object.entries(dimensions.parameters);

  // Print size only. Optional fabrication parameters are never stored by
  // `buildLineDimensions`, but a hand-written or older record may carry one.
  if (shape) {
    entries = entries.filter(([name]) => {
      const param = shape.parameters.find((p) => p.name === name);
      return !param || param.required || name === THICKNESS_PARAM;
    });
  }
  if (entries.length === 0) return '';

  const ordered = shape
    ? entries.sort(([a], [b]) => {
        if (a === THICKNESS_PARAM) return 1;
        if (b === THICKNESS_PARAM) return -1;
        const orderA = shape.parameters.find((p) => p.name === a)?.order ?? Number.MAX_SAFE_INTEGER;
        const orderB = shape.parameters.find((p) => p.name === b)?.order ?? Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
      })
    : entries;

  return `${ordered.map(([, value]) => value).join(' × ')} mm`;
}

/**
 * Full one-line description for the RFQ/PO document text — shape, size and
 * weight together, e.g.
 * "Rectangular Plate 2000 × 1000 × 6 mm — 94.2 kg total".
 */
export function describeLineDimensions(dimensions: CatalogLineDimensions): string {
  const size = formatLineDimensions(dimensions);
  const parts = [dimensions.shapeName, size].filter(Boolean);
  const head = parts.join(' ');
  if (dimensions.totalWeightKg === undefined) return head;
  return `${head} — ${dimensions.totalWeightKg} kg total`;
}
