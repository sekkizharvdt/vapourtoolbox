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
export function formatMaterialSpec(spec?: MaterialSpecification): string {
  if (!spec) return '';
  return [spec.standard, spec.grade, spec.schedule, spec.nominalSize, spec.finish, spec.form]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(' · ');
}
