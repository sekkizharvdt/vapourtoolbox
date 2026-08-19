/**
 * Material specification formatting.
 *
 * Turns the structured MaterialSpecification object into a short human-readable
 * string for display when a material is linked to a line item (feedback
 * CxERG78 — show the spec, not just the code). One canonical implementation
 * (rule 32) shared across the PR / quote linking surfaces.
 */

import type { MaterialSpecification } from '@vapour/types';

/**
 * Build a one-line spec string, e.g. "ASTM A240 · 316L · Sch 40 · DN 50".
 * Omits empty parts; returns '' when nothing is set.
 */
export function formatMaterialSpec(
  spec?: MaterialSpecification,
  options?: { includeForm?: boolean }
): string {
  if (!spec) return '';
  // `form` ("Plate", "Pipe") is dropped on a procurement line, where the
  // description already states it — otherwise the two fields repeat each other.
  const includeForm = options?.includeForm ?? true;
  return [
    spec.standard,
    spec.grade,
    spec.schedule,
    spec.nominalSize,
    spec.finish,
    ...(includeForm ? [spec.form] : []),
  ]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(' · ');
}

/**
 * Short material-class prefix for a procurement line — "CS", "SS", "DS", "AS".
 *
 * Derived from the CATEGORY, not the material code: plate codes encode the
 * class in their second segment (`PL-CS-516-70`) but pipe codes do not
 * (`PP-SS316L-A312-SMLS`, `PP-SDX2507-A790-SMLS`), so the code is not a
 * reliable source. Returns '' for anything unmapped, and the caller simply
 * omits the prefix rather than guessing.
 */
export function materialClassAbbreviation(category: string): string {
  if (/CARBON_STEEL/.test(category)) return 'CS';
  if (/SUPER_DUPLEX/.test(category)) return 'SDX';
  if (/DUPLEX/.test(category)) return 'DX';
  if (/STAINLESS/.test(category)) return 'SS';
  if (/ALLOY_STEEL/.test(category)) return 'AS';
  return '';
}

/**
 * The line description a reader of the PR sees: class, form, then size —
 * "CS Plate 6000 × 1500 × 6 mm", "SS Pipe NPS 4 Sch 40".
 *
 * Deliberately NOT the stored material name. "Carbon Steel SA 516 Gr 70 Plate"
 * states the class twice (SA 516 Gr 70 is a carbon steel plate spec) and says
 * nothing about size, while the grade it does carry belongs in `specification`.
 * Splitting them gives the buyer "what and how big" and the vendor "to what
 * standard", with neither field repeating the other.
 *
 * @param sizeText Already-formatted size, e.g. from `formatLineDimensions`.
 *                 Omitted when the article has no stated size.
 */
export function formatLineItemDescription(
  category: string,
  form: string | undefined,
  sizeText?: string
): string {
  return [materialClassAbbreviation(category), form?.trim(), sizeText?.trim()]
    .filter(Boolean)
    .join(' ');
}
