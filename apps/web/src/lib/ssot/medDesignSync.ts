/**
 * MED Design → SSOT Sync
 *
 * Persists the output of `medDesignGenerator` into a project's SSOT registers,
 * merging with whatever is already there.
 *
 * ── The merge contract ───────────────────────────────────────────────────
 * Regeneration must never cost the user work they did by hand, or they will
 * stop regenerating. So:
 *
 *   MANUAL records          → never touched, reported as skipped
 *   MED_DESIGN records      → calculated fields refreshed, EXCEPT any field
 *                             listed in `provenance.manualOverrides`
 *   Generated but now gone  → reported as orphaned, never auto-deleted
 *                             (deleting a user's records without asking is not
 *                             this function's call to make)
 *
 * Records are matched on `provenance.generatedKey`, not on the visible tag or
 * line number — line numbers carry a sequence that shifts when the effect count
 * changes, and matching on those would create duplicates instead of updates.
 *
 * ── Two phases ───────────────────────────────────────────────────────────
 * `planMEDSSOTSync()` reads and decides (no writes) so the dialog can show
 * exactly what will happen. `applyMEDSSOTSync()` executes an approved plan.
 */

import { Timestamp } from 'firebase/firestore';
import type {
  SSOTProvenance,
  ProcessStream,
  ProcessStreamInput,
  ProcessEquipment,
  ProcessEquipmentInput,
  ProcessLine,
  ProcessLineInput,
} from '@vapour/types';
import { createLogger } from '@vapour/logger';
import { retryOnStaleToken } from '@/lib/firebase/retryOnStaleToken';
import type { SSOTAccessCheck } from './ssotAuth';
import { listStreams, createStream, updateStream } from './streamService';
import { listEquipment, createEquipment, updateEquipment } from './equipmentService';
import { listLines, createLine, updateLine } from './lineService';
import type { MEDSSOTGeneration } from './medDesignGenerator';

const logger = createLogger({ context: 'medDesignSync' });

// ============================================================================
// Types
// ============================================================================

export type SSOTRegister = 'streams' | 'equipment' | 'lines';

/** One record that will be created */
export interface SyncCreate<TInput> {
  /** Stable generated key */
  key: string;
  /** Display label for the preview, e.g. "S1" or "MED-E3" */
  label: string;
  input: TInput;
}

/** One record that will be updated in place */
export interface SyncUpdate<TInput> {
  key: string;
  label: string;
  /** Firestore document id */
  id: string;
  /** The fields that will actually change, already stripped of overrides */
  changes: Partial<TInput>;
  /** Field names left alone because the user edited them by hand */
  preservedFields: string[];
  /**
   * Provenance to write with this update — carries the existing
   * `manualOverrides` forward so a hand edit is preserved across every future
   * regeneration, not just this one.
   */
  nextProvenance: SSOTProvenance;
}

/** One record left alone entirely */
export interface SyncSkip {
  key: string;
  label: string;
  id: string;
  reason: 'MANUAL_RECORD';
}

/** A previously-generated record the current design no longer produces */
export interface SyncOrphan {
  key: string;
  label: string;
  id: string;
}

export interface RegisterPlan<TInput> {
  creates: SyncCreate<TInput>[];
  updates: SyncUpdate<TInput>[];
  skips: SyncSkip[];
  orphans: SyncOrphan[];
}

export interface MEDSSOTSyncPlan {
  projectId: string;
  streams: RegisterPlan<ProcessStreamInput>;
  equipment: RegisterPlan<ProcessEquipmentInput>;
  lines: RegisterPlan<ProcessLineInput>;
}

export interface MEDSSOTSyncResult {
  created: Record<SSOTRegister, number>;
  updated: Record<SSOTRegister, number>;
  skipped: Record<SSOTRegister, number>;
  /** Per-record failures — the sync continues past them and reports at the end */
  failures: { register: SSOTRegister; label: string; error: string }[];
}

// ============================================================================
// Merge core (pure — unit-testable without Firestore)
// ============================================================================

/** Fields never overwritten by a regeneration, on any register */
const IMMUTABLE_FIELDS = new Set(['id', 'projectId', 'createdAt', 'createdBy', 'sNo']);

/**
 * Decide which fields of an existing generated record should change.
 *
 * Returns only the fields whose value actually differs, minus anything the user
 * has hand-edited. An empty result means the record is already up to date and
 * no write is needed.
 */
export function diffGeneratedRecord<TInput extends Record<string, unknown>>(
  existing: Record<string, unknown>,
  generated: TInput,
  manualOverrides: string[]
): { changes: Partial<TInput>; preservedFields: string[] } {
  const overrides = new Set(manualOverrides);
  const changes: Record<string, unknown> = {};
  const preservedFields: string[] = [];

  for (const [field, value] of Object.entries(generated)) {
    if (IMMUTABLE_FIELDS.has(field)) continue;
    // Provenance is rewritten wholesale by the caller, not diffed field by field
    if (field === 'provenance') continue;

    if (overrides.has(field)) {
      // Only report it as preserved if the design actually wanted to change it
      if (!valuesEqual(existing[field], value)) preservedFields.push(field);
      continue;
    }
    if (!valuesEqual(existing[field], value)) {
      changes[field] = value;
    }
  }

  return { changes: changes as Partial<TInput>, preservedFields };
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => valuesEqual(v, b[i]));
  }
  // Treat a missing value and an explicit undefined as the same thing
  if (a === undefined && b === undefined) return true;
  if (typeof a === 'number' && typeof b === 'number') {
    // Guard against float noise re-writing identical values every run
    return Math.abs(a - b) < 1e-9;
  }
  return false;
}

/**
 * Build the plan for one register.
 *
 * `keyOf` extracts the stable generated key from an existing record;
 * `generatedKeyOf`/`labelOf` do the same for the freshly generated input.
 */
export function planRegister<TExisting extends { id: string }, TInput extends object>(
  existingRecords: TExisting[],
  generatedRecords: TInput[],
  accessors: {
    existingKey: (record: TExisting) => string | undefined;
    existingIsManual: (record: TExisting) => boolean;
    existingOverrides: (record: TExisting) => string[];
    generatedKey: (input: TInput) => string;
    generatedProvenance: (input: TInput) => SSOTProvenance;
    label: (input: TInput) => string;
    existingLabel: (record: TExisting) => string;
  }
): RegisterPlan<TInput> {
  const plan: RegisterPlan<TInput> = { creates: [], updates: [], skips: [], orphans: [] };

  const existingByKey = new Map<string, TExisting>();
  for (const record of existingRecords) {
    const key = accessors.existingKey(record);
    if (key) existingByKey.set(key, record);
  }

  const seenKeys = new Set<string>();

  for (const input of generatedRecords) {
    const key = accessors.generatedKey(input);
    const label = accessors.label(input);
    seenKeys.add(key);

    const existing = existingByKey.get(key);
    if (!existing) {
      plan.creates.push({ key, label, input });
      continue;
    }

    if (accessors.existingIsManual(existing)) {
      plan.skips.push({ key, label, id: existing.id, reason: 'MANUAL_RECORD' });
      continue;
    }

    const { changes, preservedFields } = diffGeneratedRecord(
      existing as unknown as Record<string, unknown>,
      input as unknown as Record<string, unknown>,
      accessors.existingOverrides(existing)
    );

    if (Object.keys(changes).length > 0 || preservedFields.length > 0) {
      const existingOverrides = accessors.existingOverrides(existing);
      plan.updates.push({
        key,
        label,
        id: existing.id,
        changes: changes as Partial<TInput>,
        preservedFields,
        nextProvenance: {
          ...accessors.generatedProvenance(input),
          ...(existingOverrides.length > 0 && { manualOverrides: existingOverrides }),
        },
      });
    }
  }

  // Previously generated, no longer produced by this design
  for (const [key, record] of existingByKey) {
    if (seenKeys.has(key)) continue;
    if (accessors.existingIsManual(record)) continue;
    plan.orphans.push({ key, label: accessors.existingLabel(record), id: record.id });
  }

  return plan;
}

// ============================================================================
// Plan (reads only)
// ============================================================================

const isManual = (record: { provenance?: { source?: string } }): boolean =>
  (record.provenance?.source ?? 'MANUAL') === 'MANUAL';

const overridesOf = (record: { provenance?: { manualOverrides?: string[] } }): string[] =>
  record.provenance?.manualOverrides ?? [];

const keyOf = (record: { provenance?: { generatedKey?: string } }): string | undefined =>
  record.provenance?.generatedKey;

const generatedKeyOf = (input: { provenance?: { generatedKey?: string } }): string =>
  input.provenance?.generatedKey ?? '';

const generatedProvenanceOf = (input: { provenance?: SSOTProvenance }): SSOTProvenance =>
  input.provenance ?? { source: 'MED_DESIGN' };

/**
 * Read the project's current registers and work out what the generated design
 * would change. Performs no writes.
 */
export async function planMEDSSOTSync(
  projectId: string,
  generation: MEDSSOTGeneration
): Promise<MEDSSOTSyncPlan> {
  logger.debug('planMEDSSOTSync', { projectId });

  const [existingStreams, existingEquipment, existingLines] = await Promise.all([
    retryOnStaleToken(() => listStreams(projectId)),
    retryOnStaleToken(() => listEquipment(projectId)),
    retryOnStaleToken(() => listLines(projectId)),
  ]);

  const streams = planRegister<ProcessStream, ProcessStreamInput>(
    existingStreams,
    generation.streams,
    {
      existingKey: keyOf,
      existingIsManual: isManual,
      existingOverrides: overridesOf,
      generatedKey: generatedKeyOf,
      generatedProvenance: generatedProvenanceOf,
      label: (s) => s.lineTag,
      existingLabel: (s) => s.lineTag,
    }
  );

  const equipment = planRegister<ProcessEquipment, ProcessEquipmentInput>(
    existingEquipment,
    generation.equipment,
    {
      existingKey: keyOf,
      existingIsManual: isManual,
      existingOverrides: overridesOf,
      generatedKey: generatedKeyOf,
      generatedProvenance: generatedProvenanceOf,
      label: (e) => e.equipmentTag,
      existingLabel: (e) => e.equipmentTag,
    }
  );

  const lines = planRegister<ProcessLine, ProcessLineInput>(existingLines, generation.lines, {
    existingKey: keyOf,
    existingIsManual: isManual,
    existingOverrides: overridesOf,
    generatedKey: generatedKeyOf,
    generatedProvenance: generatedProvenanceOf,
    label: (l) => l.lineNumber,
    existingLabel: (l) => l.lineNumber,
  });

  logger.info('MED → SSOT sync planned', {
    projectId,
    creates: streams.creates.length + equipment.creates.length + lines.creates.length,
    updates: streams.updates.length + equipment.updates.length + lines.updates.length,
    skips: streams.skips.length + equipment.skips.length + lines.skips.length,
    orphans: streams.orphans.length + equipment.orphans.length + lines.orphans.length,
  });

  return { projectId, streams, equipment, lines };
}

// ============================================================================
// Apply (writes)
// ============================================================================

/**
 * Execute an approved plan.
 *
 * Every Firestore call goes through `retryOnStaleToken` (rule 35) — a user whose
 * SSOT permission was granted minutes ago would otherwise fail on whichever
 * write happens to run first.
 *
 * Per-record failures are collected rather than thrown, so one bad record does
 * not abandon a 200-record sync half-finished. The caller surfaces `failures`.
 */
export async function applyMEDSSOTSync(
  plan: MEDSSOTSyncPlan,
  userId: string,
  accessCheck?: SSOTAccessCheck
): Promise<MEDSSOTSyncResult> {
  const { projectId } = plan;
  logger.debug('applyMEDSSOTSync', { projectId });

  const result: MEDSSOTSyncResult = {
    created: { streams: 0, equipment: 0, lines: 0 },
    updated: { streams: 0, equipment: 0, lines: 0 },
    skipped: {
      streams: plan.streams.skips.length,
      equipment: plan.equipment.skips.length,
      lines: plan.lines.skips.length,
    },
    failures: [],
  };

  const stampedAt = Timestamp.now();

  /** Update payload = changed fields + refreshed provenance carrying overrides forward */
  const updatePayload = <T>(u: { changes: Partial<T>; nextProvenance: SSOTProvenance }) => ({
    ...u.changes,
    provenance: { ...u.nextProvenance, lastGeneratedAt: stampedAt },
  });

  const run = async (register: SSOTRegister, label: string, op: () => Promise<unknown>) => {
    try {
      await retryOnStaleToken(op);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`MED → SSOT sync failed for ${register} "${label}"`, { projectId, err });
      result.failures.push({ register, label, error: message });
      return false;
    }
  };

  // ── Streams first: equipment and lines reference their tags ────────────
  for (const c of plan.streams.creates) {
    if (await run('streams', c.label, () => createStream(projectId, c.input, userId, accessCheck)))
      result.created.streams++;
  }
  for (const u of plan.streams.updates) {
    if (Object.keys(u.changes).length === 0) continue;
    if (
      await run('streams', u.label, () =>
        updateStream(projectId, u.id, updatePayload(u), userId, accessCheck)
      )
    )
      result.updated.streams++;
  }

  for (const c of plan.equipment.creates) {
    if (
      await run('equipment', c.label, () =>
        createEquipment(projectId, c.input, userId, accessCheck)
      )
    )
      result.created.equipment++;
  }
  for (const u of plan.equipment.updates) {
    if (Object.keys(u.changes).length === 0) continue;
    if (
      await run('equipment', u.label, () =>
        updateEquipment(projectId, u.id, updatePayload(u), userId, accessCheck)
      )
    )
      result.updated.equipment++;
  }

  for (const c of plan.lines.creates) {
    if (await run('lines', c.label, () => createLine(projectId, c.input, userId, accessCheck)))
      result.created.lines++;
  }
  for (const u of plan.lines.updates) {
    if (Object.keys(u.changes).length === 0) continue;
    if (
      await run('lines', u.label, () =>
        updateLine(projectId, u.id, updatePayload(u), userId, accessCheck)
      )
    )
      result.updated.lines++;
  }

  logger.info('MED → SSOT sync applied', { projectId, ...result });
  return result;
}

// ============================================================================
// Summary helper for the UI
// ============================================================================

export interface SyncPlanTotals {
  creates: number;
  updates: number;
  skips: number;
  orphans: number;
  preservedFields: number;
}

export function summarisePlan(plan: MEDSSOTSyncPlan): SyncPlanTotals {
  const registers = [plan.streams, plan.equipment, plan.lines];
  return {
    creates: registers.reduce((n, r) => n + r.creates.length, 0),
    updates: registers.reduce((n, r) => n + r.updates.length, 0),
    skips: registers.reduce((n, r) => n + r.skips.length, 0),
    orphans: registers.reduce((n, r) => n + r.orphans.length, 0),
    preservedFields: registers.reduce(
      (n, r) => n + r.updates.reduce((m, u) => m + u.preservedFields.length, 0),
      0
    ),
  };
}
