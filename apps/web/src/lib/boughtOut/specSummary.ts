/**
 * One-line specification summaries for bought-out items.
 *
 * `BoughtOutSpecifications` is a ten-way union keyed on category, so "show the
 * spec" needs a per-category answer. This is the single place that decides it
 * (rule 32): the picker's browse list and its search results both call it, which
 * is what stops them drifting apart the way they had.
 *
 * Feedback 9DQ3NavwViLutF8trF93 — the picker showed only the item code and name
 * when linking a PR line to the bought-out database, so two 6" gate valves in
 * different body materials were indistinguishable at the moment of choosing.
 *
 * Deliberately short: this is a scanning aid in a list row, not a datasheet.
 * The detail page remains the full record.
 */

import type { BoughtOutCategory, BoughtOutSpecifications } from '@vapour/types';

/** Human labels for the enum-valued fields that appear in summaries. */
const VALVE_OPERATION: Record<string, string> = {
  MANUAL: 'Manual',
  GEAR: 'Gear',
  PNEUMATIC: 'Pneumatic',
  ELECTRIC: 'Electric',
  HYDRAULIC: 'Hydraulic',
  SELF_ACTUATED: 'Self-actuated',
};

/**
 * Label for an ENUM-valued field — ours to prettify, because we chose the token.
 *
 * Never use this on free text. Vendor strings look identical to enums
 * ("WCB", "CGL", "DN50") and title-casing them into "Wcb" / "Cgl" makes the item
 * harder to identify, which is the opposite of the point. Real records caught
 * exactly that: valve bodyMaterial "WCB" and manufacturer "CGL".
 */
function enumLabel(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  if (!/^[A-Z0-9_]+$/.test(value)) return value;
  return value
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Free-text field, passed through verbatim apart from whitespace tidying.
 * Some records (notably OTHER) carry multi-line paragraphs; a list row needs one
 * short line, so collapse and clip rather than letting it wrap forever.
 */
function text(value: unknown, maxLength = 90): string | undefined {
  if (typeof value !== 'string') return undefined;
  const collapsed = value.replace(/\s+/g, ' ').trim();
  if (!collapsed) return undefined;
  return collapsed.length > maxLength ? `${collapsed.slice(0, maxLength).trimEnd()}…` : collapsed;
}

/** Numeric field with a unit, skipped when absent — never "undefined m³/hr". */
function withUnit(value: unknown, unit: string): string | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? `${value} ${unit}` : undefined;
}

/**
 * The fields worth showing per category, most identifying first. Each returns a
 * sparse list; empties are dropped before joining, so a half-filled record still
 * produces a useful line instead of a row of separators.
 */
function fieldsFor(
  category: BoughtOutCategory,
  specs: Record<string, unknown>
): Array<string | undefined> {
  switch (category) {
    case 'PUMP':
      return [
        enumLabel(specs.pumpType),
        withUnit(specs.flowRate, 'm³/hr'),
        withUnit(specs.head, 'm head'),
        withUnit(specs.power, 'kW'),
      ];
    case 'MOTOR':
      return [
        enumLabel(specs.motorType),
        withUnit(specs.ratedPowerKW, 'kW'),
        withUnit(specs.voltage, 'V'),
        specs.phase ? `${specs.phase}-phase` : undefined,
      ];
    case 'VALVE':
      return [
        enumLabel(specs.valveType),
        text(specs.size),
        text(specs.pressureRating),
        text(specs.bodyMaterial),
        typeof specs.operation === 'string' ? VALVE_OPERATION[specs.operation] : undefined,
      ];
    case 'SAFETY':
      return [
        enumLabel(specs.deviceType),
        text(specs.inletSize),
        withUnit(specs.setPressure, 'bar set'),
      ];
    case 'INSTRUMENT':
      return [
        enumLabel(specs.instrumentType),
        enumLabel(specs.variable),
        rangeOf(specs),
        text(specs.processConnection),
      ];
    case 'GAUGE':
      return [
        enumLabel(specs.gaugeType),
        withUnit(specs.dialSize, 'mm dial'),
        text(specs.range),
        text(specs.connection),
      ];
    case 'STEAM_TRAP':
      return [
        enumLabel(specs.trapType),
        text(specs.size),
        text(specs.pressureRating),
        text(specs.bodyMaterial),
      ];
    case 'ACCESSORY':
      return [
        enumLabel(specs.accessoryType),
        text(specs.size),
        text(specs.material),
        text(specs.pressureRating),
      ];
    case 'ELECTRICAL':
      return [
        enumLabel(specs.electricalType),
        text(specs.voltage),
        text(specs.powerRating),
        text(specs.frequency),
      ];
    default:
      // OTHER, and any category added later: fall back to the free-text spec so
      // a new category shows something rather than nothing.
      return [text(specs.specification)];
  }
}

/** "0 - 20 bar" from the instrument min/max/unit triple. */
function rangeOf(specs: Record<string, unknown>): string | undefined {
  const { rangeMin, rangeMax, unit } = specs;
  if (typeof rangeMin !== 'number' || typeof rangeMax !== 'number') return undefined;
  return `${rangeMin} - ${rangeMax}${typeof unit === 'string' && unit ? ` ${unit}` : ''}`;
}

/**
 * A short specification line, or undefined when the record carries nothing worth
 * showing — callers should render nothing rather than an empty separator run.
 *
 * Manufacturer and model are appended last: they identify the item once the
 * physical spec has narrowed it down.
 */
export function summariseBoughtOutSpec(
  category: BoughtOutCategory,
  specifications: BoughtOutSpecifications | undefined
): string | undefined {
  if (!specifications) return undefined;
  const specs = specifications as unknown as Record<string, unknown>;

  const parts = [...fieldsFor(category, specs), text(specs.manufacturer), text(specs.model)].filter(
    (p): p is string => typeof p === 'string' && p.trim().length > 0
  );

  return parts.length > 0 ? parts.join(' · ') : undefined;
}
