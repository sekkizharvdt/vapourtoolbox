/**
 * Inline catalogue selection for a procurement line.
 *
 * The picker dialog is the right tool for browsing 800 items; it is the wrong
 * tool for "carbon steel plate, 6mm, 2000×1000". Once the taxonomy is honest,
 * raw material is a small, structured set — 16 plate grades and 6 pipe
 * families — so the line can offer dropdowns directly and reserve the dialog
 * for the long tail.
 *
 * Everything here is driven by `CATALOG_SIZING` (@vapour/types), so a row
 * never branches on category. It asks two questions:
 *
 *   1. Which article? → the category's `discriminators`, as a cascade
 *      (plate: grade → thickness; pipe: family → NPS → schedule)
 *   2. What size on the line? → the category's `orderSizing`
 *      (SHAPE → shape + parameters; LENGTH → quantity in metres; NONE → nothing)
 *
 * Pure functions only — the component layer supplies the loaded materials.
 */

import type { CatalogPricingUnit, Material, MaterialVariant } from '@vapour/types';
import { MATERIAL_CATEGORY_GROUPS, getCatalogSizing } from '@vapour/types';
import { filterAvailableVariants, sortVariantsByThickness } from '@/lib/materials/variantUtils';

/**
 * A selectable kind on a raw-material line — one entry per category group
 * whose members are priced by weight or length. Bought-out groups are
 * excluded: they reach the line through the catalog picker, not this cascade.
 */
export interface RawMaterialKind {
  /** Group key from MATERIAL_CATEGORY_GROUPS, e.g. 'plates'. */
  key: string;
  label: string;
  categories: string[];
  pricingUnit: CatalogPricingUnit;
}

/**
 * Kinds offered inline, derived from the sizing model rather than hardcoded.
 * A group qualifies when every one of its categories is priced by weight or
 * length — i.e. it is raw material under the agreed rule.
 */
export function getRawMaterialKinds(): RawMaterialKind[] {
  const kinds: RawMaterialKind[] = [];
  for (const group of MATERIAL_CATEGORY_GROUPS) {
    const sizings = group.categories.map((c) => getCatalogSizing(c));
    if (sizings.length === 0) continue;
    const units = new Set(sizings.map((s) => s.pricingUnit));
    if (units.size !== 1) continue; // mixed group — not a clean inline kind
    const [unit] = [...units];
    if (unit === 'PIECE') continue; // bought-out; belongs in the picker
    kinds.push({
      key: group.key,
      label: group.label,
      categories: group.categories.map(String),
      pricingUnit: unit as CatalogPricingUnit,
    });
  }
  return kinds;
}

/** The kind a material belongs to, or null if it isn't inline-selectable. */
export function getKindForMaterial(material: Material): RawMaterialKind | null {
  return getRawMaterialKinds().find((k) => k.categories.includes(material.category)) ?? null;
}

/** How the line asks for size, for a given kind. */
export function orderSizingForKind(kind: RawMaterialKind): 'NONE' | 'LENGTH' | 'SHAPE' {
  const first = kind.categories[0];
  return first ? getCatalogSizing(first).orderSizing : 'NONE';
}

// ---------------------------------------------------------------------------
// Cascade construction
// ---------------------------------------------------------------------------

export interface CascadeOption {
  value: string;
  label: string;
}

/**
 * One step of the "which article?" cascade. `field` is the discriminator being
 * chosen; `options` are the values still reachable given earlier choices.
 */
export interface CascadeStep {
  field: string;
  label: string;
  options: CascadeOption[];
}

const FIELD_LABELS: Record<string, string> = {
  grade: 'Grade',
  thickness: 'Thickness',
  nps: 'Size (NPS)',
  schedule: 'Schedule',
  pressureClass: 'Class',
  size: 'Size',
};

function labelFor(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/** Sort NPS strings numerically — "1/2" before "2" before "10". */
export function compareNpsValues(a: string, b: string): number {
  const toNumber = (v: string): number => {
    const text = String(v).replace(/-/g, ' ').trim();
    const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    const fraction = text.match(/^(\d+)\/(\d+)$/);
    if (fraction) return Number(fraction[1]) / Number(fraction[2]);
    return Number(text) || 0;
  };
  return toNumber(a) - toNumber(b);
}

function sortOptions(field: string, options: CascadeOption[]): CascadeOption[] {
  if (field === 'nps') return [...options].sort((a, b) => compareNpsValues(a.value, b.value));
  if (field === 'schedule' || field === 'pressureClass') {
    return [...options].sort(
      (a, b) => (Number(a.value) || 0) - (Number(b.value) || 0) || a.value.localeCompare(b.value)
    );
  }
  return [...options].sort((a, b) => a.label.localeCompare(b.label));
}

/** Read a discriminator off a material document. */
function discriminatorValue(material: Material, field: string): string | undefined {
  if (field === 'grade') return material.materialCode;
  const raw = (material as unknown as Record<string, unknown>)[field];
  return raw === undefined || raw === null ? undefined : String(raw);
}

/**
 * Build the cascade for a kind, narrowed by whatever has been chosen so far.
 *
 * Plates discriminate on `thickness`, which lives on variants rather than the
 * document, so their first step is the grade (one material per grade) and the
 * thickness step is built from that material's variants.
 */
export function buildCascade(
  kind: RawMaterialKind,
  materials: Material[],
  chosen: Record<string, string>
): CascadeStep[] {
  const inKind = materials.filter((m) => kind.categories.includes(m.category));
  const sizing = getCatalogSizing(kind.categories[0] ?? '');
  const isPlate = sizing.discriminators.includes('thickness');

  // Plates: one document per grade, thickness held as variants.
  if (isPlate) {
    const steps: CascadeStep[] = [
      {
        field: 'grade',
        label: labelFor('grade'),
        options: sortOptions(
          'grade',
          inKind.map((m) => ({ value: m.id, label: m.name }))
        ),
      },
    ];
    const material = inKind.find((m) => m.id === chosen.grade);
    if (material) {
      const variants = sortVariantsByThickness(filterAvailableVariants(material.variants ?? []));
      steps.push({
        field: 'thickness',
        label: labelFor('thickness'),
        // `variantCode` ("6mm"), not `displayName` ("6mm thickness"): the step
        // is already labelled Thickness, so the stored displayName repeats the
        // field name on every one of the 29 options.
        options: variants.map((v) => ({ value: v.id, label: v.variantCode || v.displayName })),
      });
    }
    return steps;
  }

  // Piping: every discriminator is a field on the document, so each step
  // filters the candidate set for the next.
  const steps: CascadeStep[] = [];
  let candidates = inKind;

  // Family first — it is what makes "6 pipe families" rather than 344 rows.
  const families = [...new Set(candidates.map((m) => m.familyCode).filter(Boolean))] as string[];
  if (families.length > 1 || sizing.discriminators.length > 0) {
    steps.push({
      field: 'family',
      label: 'Type',
      options: sortOptions(
        'family',
        families.map((f) => ({
          value: f,
          label: familyLabel(
            f,
            candidates.filter((m) => m.familyCode === f)
          ),
        }))
      ),
    });
    if (chosen.family) candidates = candidates.filter((m) => m.familyCode === chosen.family);
  }

  for (const field of sizing.discriminators) {
    const values = [
      ...new Set(candidates.map((m) => discriminatorValue(m, field)).filter(Boolean)),
    ] as string[];
    steps.push({
      field,
      label: labelFor(field),
      options: sortOptions(
        field,
        values.map((v) => ({ value: v, label: field === 'schedule' ? `Sch ${v}` : v }))
      ),
    });
    if (chosen[field]) {
      candidates = candidates.filter((m) => discriminatorValue(m, field) === chosen[field]);
    }
  }

  return steps;
}

/** Human label for a piping family, derived from a member's name. */
function familyLabel(familyCode: string, members: Material[]): string {
  const first = members[0];
  if (!first) return familyCode;
  // "Carbon Steel Pipe ASTM A106 Seamless NPS 1 Sch 10" → drop the size tail.
  return String(first.name)
    .replace(/\s+NPS\s+.*$/i, '')
    .trim();
}

/**
 * The single material a set of choices resolves to, or null while the cascade
 * is incomplete or ambiguous.
 */
export function resolveMaterial(
  kind: RawMaterialKind,
  materials: Material[],
  chosen: Record<string, string>
): { material: Material; variant?: MaterialVariant } | null {
  const inKind = materials.filter((m) => kind.categories.includes(m.category));
  const sizing = getCatalogSizing(kind.categories[0] ?? '');

  if (sizing.discriminators.includes('thickness')) {
    const material = inKind.find((m) => m.id === chosen.grade);
    if (!material) return null;
    const variant = (material.variants ?? []).find((v) => v.id === chosen.thickness);
    return variant ? { material, variant } : null;
  }

  let candidates = chosen.family
    ? inKind.filter((m) => m.familyCode === chosen.family)
    : inKind.slice();
  for (const field of sizing.discriminators) {
    const value = chosen[field];
    if (!value) return null;
    candidates = candidates.filter((m) => discriminatorValue(m, field) === value);
  }
  return candidates.length === 1 && candidates[0] ? { material: candidates[0] } : null;
}

// ---------------------------------------------------------------------------
// Merged material picker
// ---------------------------------------------------------------------------

/** One selectable material, carrying the kind and first cascade step it implies. */
export interface MaterialOption {
  /** Encoded as `kindKey|field|value` so a single Select can carry it. */
  id: string;
  kindKey: string;
  field: string;
  value: string;
  label: string;
}

export interface MaterialOptionGroup {
  kindKey: string;
  label: string;
  options: MaterialOption[];
}

/**
 * Every inline-selectable material as ONE grouped list — 16 plate grades under
 * "Plates", 6 pipe families under "Pipes".
 *
 * Kind and grade were separate dropdowns at first, which made the row ask two
 * questions to answer one: nobody picks "Plates" as an end in itself, they pick
 * a plate. Choosing a grade implies its kind, so the two collapse into a single
 * control and the row loses a step.
 */
export function buildMaterialOptions(materials: Material[]): MaterialOptionGroup[] {
  const groups: MaterialOptionGroup[] = [];
  for (const kind of getRawMaterialKinds()) {
    const [first] = buildCascade(kind, materials, {});
    if (!first || first.options.length === 0) continue;
    groups.push({
      kindKey: kind.key,
      label: kind.label,
      options: first.options.map((o) => ({
        id: `${kind.key}|${first.field}|${o.value}`,
        kindKey: kind.key,
        field: first.field,
        value: o.value,
        label: o.label,
      })),
    });
  }
  return groups;
}

/** Decode what the merged Select produced. */
export function parseMaterialOptionId(
  id: string
): { kindKey: string; field: string; value: string } | null {
  const [kindKey, field, ...rest] = id.split('|');
  if (!kindKey || !field || rest.length === 0) return null;
  return { kindKey, field, value: rest.join('|') };
}

/** The merged Select's current value, rebuilt from cascade state. */
export function materialOptionIdFor(state: {
  kindKey: string;
  chosen: Record<string, string>;
}): string {
  const kind = getRawMaterialKinds().find((k) => k.key === state.kindKey);
  if (!kind) return '';
  // The first cascade field is whichever of the kind's steps was chosen first;
  // for plates that is `grade`, for piping `family`.
  const field = state.chosen.grade !== undefined ? 'grade' : 'family';
  const value = state.chosen[field];
  return value ? `${state.kindKey}|${field}|${value}` : '';
}
