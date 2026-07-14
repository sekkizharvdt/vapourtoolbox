/**
 * Thermal → Estimation BOM import (completion plan A3).
 *
 * Generic converter from a thermal calculator's weight-based bill lines
 * (`ThermalBOMLine`) into real estimation `CreateBOMItemInput`s, using the
 * persistent thermalMaterialMappings table to resolve free-text material
 * strings to catalog items.
 *
 * The converter is calculator-agnostic — MED is just the first caller via
 * the `medEquipmentToThermalLines` adapter. Future assembly templates
 * (pressure vessel, heat exchanger) feed the same shape.
 *
 * Quantity semantics (this is what makes pricing correct — see
 * bomCalculations.calculateBoughtOutItemCost):
 * - A line mapped to a RAW_MATERIAL prices as
 *   `material.currentPrice.pricePerUnit × quantity`. Fabricated thermal lines
 *   are weight-based and raw stock (plate/tube) is priced per kg
 *   (baseUnit 'kg'), so the BOM item quantity becomes the line's TOTAL weight
 *   in kg (unit 'kg'). The original piece count is preserved in the
 *   description.
 * - A line mapped to a BOUGHT_OUT item prices as
 *   `pricing.listPrice × quantity` (per piece), so quantity stays the piece
 *   count with the line's own unit.
 * - Unmapped lines export as flagged zero-cost items: no component linkage at
 *   all (cost calculation skips them), name prefixed with [UNMAPPED] and the
 *   source material string kept in the description so they render sanely in
 *   the BOM editor and can be linked later.
 */

import { BOMItemType, type CreateBOMItemInput } from '@vapour/types';
import type { MEDCompleteBOM } from '@/lib/thermal/medBOMGenerator';
import {
  normalizeThermalKey,
  mappingToCatalogRef,
  type ThermalMaterialMapping,
  type ThermalMappingKind,
} from './thermalMaterialMappings';

// ============================================================================
// Generic input shape
// ============================================================================

/** One line of a thermal calculator's bill, calculator-agnostic. */
export interface ThermalBOMLine {
  /** Line description (becomes the BOM item name). */
  description: string;
  /** Free-text material / item string — the mapping key. */
  materialText: string;
  /** Optional form/category hint (e.g. "8mm plate", "25.4mm tube"). */
  formHint?: string;
  /**
   * TOTAL weight for the line in kg (all pieces, incl. wastage), 0 when the
   * generator has no weight (e.g. vendor-weighed pumps).
   */
  weightKg: number;
  /** Piece count (or lot count) as stated by the generator. */
  quantity: number;
  /** Unit for `quantity` ("nos", "lot", "m", ...). */
  unit: string;
  /**
   * Kind hint for the mapping picker's default tab. The SAVED mapping's kind
   * wins over this hint when converting.
   */
  kindHint: ThermalMappingKind;
  /** Extra notes carried into the BOM item description. */
  notes?: string;
}

// ============================================================================
// Converter
// ============================================================================

export interface ConvertThermalLinesResult {
  /** Ready for bomService.createBOMWithItems, in input order. */
  items: CreateBOMItemInput[];
  /** Lines that had no mapping — exported unpriced (also present in items). */
  unmappedLines: ThermalBOMLine[];
}

/** Prefix marking exported lines that still need a catalog mapping. */
export const UNMAPPED_ITEM_PREFIX = '[UNMAPPED]';

const round2 = (n: number): number => Math.round(n * 100) / 100;

function buildDescription(line: ThermalBOMLine, mapped: boolean): string {
  const parts: string[] = [];
  parts.push(
    mapped ? `Material: ${line.materialText}` : `Material (unmapped): ${line.materialText}`
  );
  if (line.formHint) parts.push(`Form: ${line.formHint}`);
  // Weight-based items carry the design piece count here since the BOM
  // quantity becomes kilograms.
  if (line.weightKg > 0) {
    parts.push(`Design qty: ${line.quantity} ${line.unit}, total ${round2(line.weightKg)} kg`);
  }
  if (line.notes) parts.push(line.notes);
  return parts.join(' | ');
}

/**
 * Convert thermal lines to BOM item inputs using the given mappings
 * (keyed by `normalizeThermalKey(line.materialText)`).
 *
 * Unmapped lines DO NOT block conversion — they become flagged zero-cost
 * items and are also returned in `unmappedLines`.
 */
export function convertThermalLinesToBOMItems(
  lines: ThermalBOMLine[],
  mappings: Map<string, ThermalMaterialMapping>
): ConvertThermalLinesResult {
  const items: CreateBOMItemInput[] = [];
  const unmappedLines: ThermalBOMLine[] = [];

  for (const line of lines) {
    const mapping = mappings.get(normalizeThermalKey(line.materialText));

    if (!mapping) {
      unmappedLines.push(line);
      const weightBased = line.kindHint === 'RAW_MATERIAL' && line.weightKg > 0;
      items.push({
        itemType: line.kindHint === 'RAW_MATERIAL' ? BOMItemType.MATERIAL : BOMItemType.PART,
        name: `${UNMAPPED_ITEM_PREFIX} ${line.description}`,
        description: buildDescription(line, false),
        // Weight-based fabricated lines keep kg quantities so mapping the
        // material later prices them without re-entering the weight.
        quantity: weightBased ? round2(line.weightKg) : line.quantity,
        unit: weightBased ? 'kg' : line.unit,
        // No componentType / materialId / boughtOutItemId — cost calculation
        // skips component-less items, so the line lands at zero cost.
      });
      continue;
    }

    if (mapping.kind === 'RAW_MATERIAL') {
      // Weight-priced when the line carries weight (raw stock per kg);
      // falls back to the generator's own quantity/unit otherwise.
      const weightBased = line.weightKg > 0;
      items.push({
        itemType: BOMItemType.MATERIAL,
        name: line.description,
        description: buildDescription(line, true),
        quantity: weightBased ? round2(line.weightKg) : line.quantity,
        unit: weightBased ? 'kg' : line.unit,
        // Material-backed line: same shape AddBOMItemDialog writes for a
        // Materials-tab pick — BOUGHT_OUT component with materialId prices
        // from material.currentPrice.
        componentType: 'BOUGHT_OUT',
        materialId: mapping.targetId,
        catalogRef: mappingToCatalogRef(mapping),
      });
    } else {
      items.push({
        itemType: BOMItemType.PART,
        name: line.description,
        description: buildDescription(line, true),
        quantity: line.quantity,
        unit: line.unit,
        // A2 bridge: boughtOutItemId + catalogRef, NO materialId — prices
        // from bought_out_items pricing.listPrice per piece.
        componentType: 'BOUGHT_OUT',
        boughtOutItemId: mapping.targetId,
        catalogRef: mappingToCatalogRef(mapping),
      });
    }
  }

  return { items, unmappedLines };
}

// ============================================================================
// Distinct-key helper (for the mapping dialog)
// ============================================================================

export interface DistinctThermalKey {
  normalizedKey: string;
  /** First-seen source text for display. */
  sourceText: string;
  /** First-seen kind hint — the picker's default tab. */
  kindHint: ThermalMappingKind;
  /** How many lines use this material string. */
  lineCount: number;
}

/** Distinct material strings across the lines, in first-seen order. */
export function distinctThermalKeys(lines: ThermalBOMLine[]): DistinctThermalKey[] {
  const byKey = new Map<string, DistinctThermalKey>();
  for (const line of lines) {
    const normalizedKey = normalizeThermalKey(line.materialText);
    if (!normalizedKey) continue;
    const existing = byKey.get(normalizedKey);
    if (existing) {
      existing.lineCount += 1;
    } else {
      byKey.set(normalizedKey, {
        normalizedKey,
        sourceText: line.materialText.trim(),
        kindHint: line.kindHint,
        lineCount: 1,
      });
    }
  }
  return Array.from(byKey.values());
}

// ============================================================================
// MED adapter (first caller) — MED specifics live HERE, not in the converter
// ============================================================================

/**
 * Map the MED generator's equipment lines into the generic shape.
 * Instruments/valves are schedules without weights or catalog-shaped
 * quantities and stay on their CSV exports for now.
 *
 * Kind hint: fabricated items (shape-backed, weighed) suggest a raw material;
 * everything else (pumps, vacuum skid, grommets, demisters, gaskets, tanks)
 * suggests a bought-out item. The user's saved mapping overrides the hint.
 */
export function medEquipmentToThermalLines(bom: MEDCompleteBOM): ThermalBOMLine[] {
  return bom.equipment
    .filter((item) => item.quantity > 0)
    .map((item) => {
      const isFabricated = Boolean(item.shapeType) && item.totalWeightKg > 0;
      return {
        description: item.description,
        materialText: item.material,
        formHint: item.size,
        weightKg: item.totalWeightKg,
        quantity: item.quantity,
        unit: item.unit,
        kindHint: isFabricated ? ('RAW_MATERIAL' as const) : ('BOUGHT_OUT' as const),
        notes: [
          item.tagNumber ? `Tag: ${item.tagNumber}` : '',
          item.specification ? `Spec: ${item.specification}` : '',
          item.notes ?? '',
        ]
          .filter(Boolean)
          .join(' | '),
      };
    });
}
