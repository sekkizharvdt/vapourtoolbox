/**
 * SSOT provenance tracking on update.
 *
 * Half of the "regeneration preserves your edits" guarantee lives in the sync
 * planner (it refuses to overwrite fields listed in `manualOverrides`). This is
 * the other half: when a user edits a *generated* record in the SSOT tabs, the
 * fields they touched have to be added to that list, or the planner has nothing
 * to protect and the next regeneration silently reverts their work.
 *
 * ── Telling the two callers apart ────────────────────────────────────────
 * The MED→SSOT sync and the SSOT edit dialogs both call the same
 * `updateStream`/`updateEquipment`/`updateLine` services. They are distinguished
 * by whether the caller supplies `provenance` in the update payload:
 *
 *   provenance supplied     → the sync is writing; take its provenance verbatim
 *   provenance not supplied → a human is editing; record the changed fields
 *
 * That keeps the services' signatures unchanged and makes the common case (a
 * hand edit) the one that needs no ceremony at the call site.
 */

import type { SSOTProvenance } from '@vapour/types';

/** Fields that are bookkeeping, not engineering data — never recorded as overrides */
const NON_OVERRIDE_FIELDS = new Set([
  'provenance',
  'updatedAt',
  'updatedBy',
  'createdAt',
  'createdBy',
  'id',
  'projectId',
]);

/**
 * Work out the provenance to store on an update.
 *
 * Returns `undefined` when nothing needs to change — the caller should then omit
 * the field entirely rather than writing `undefined` (rule 12).
 *
 * @param current    provenance already on the stored record
 * @param input      the update payload as supplied by the caller
 */
export function resolveProvenanceOnUpdate(
  current: SSOTProvenance | undefined,
  input: Record<string, unknown>
): SSOTProvenance | undefined {
  // The sync supplies provenance explicitly — it owns the value.
  const supplied = input.provenance as SSOTProvenance | undefined;
  if (supplied) return supplied;

  // Hand edits to hand-entered records need no provenance bookkeeping.
  if (!current || current.source !== 'MED_DESIGN') return undefined;

  const touched = Object.keys(input).filter(
    (field) => !NON_OVERRIDE_FIELDS.has(field) && input[field] !== undefined
  );
  if (touched.length === 0) return undefined;

  const existing = current.manualOverrides ?? [];
  const merged = Array.from(new Set([...existing, ...touched])).sort();

  // Nothing new — avoid a pointless write.
  if (merged.length === existing.length && merged.every((f, i) => f === [...existing].sort()[i])) {
    return undefined;
  }

  return { ...current, manualOverrides: merged };
}
