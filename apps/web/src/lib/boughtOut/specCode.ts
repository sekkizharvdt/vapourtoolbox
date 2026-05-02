/**
 * Bought-Out Item Spec-Code Generation (client-side)
 *
 * Builds the deterministic `specCode` used to match equipment by content
 * across the AI quote parser and manual entry. Same spec → same code,
 * every time. Two records with the identical valve/pump/instrument spec
 * collapse onto one bought-out item.
 *
 * Format conventions:
 *   Valves:       `VLV-{TYPE}-{MATL}-{SIZE}-{RATING}-{END}-{OP}`
 *                 e.g. `VLV-GATE-SS316-DN50-150-FLG-MAN`
 *   Pumps:        `PUMP-{TYPE}-{N}M3H-{N}M`
 *                 e.g. `PUMP-CF-50M3H-30M`
 *   Instruments:  `INST-{VAR}{TYPE}-{seq}` (sequence per (variable, type) pair)
 *                 e.g. `INST-PT-0001` (pressure transmitter)
 *
 * Vocabularies must stay in lockstep with the server-side resolver at
 * `functions/src/offerParsing/boughtOutResolver.ts`. If you change a code
 * here, change it there too — and back-fill / migrate any records that
 * already have the old code.
 */

import { collection, getDocs, query, where, type Firestore } from 'firebase/firestore';
import type { ValveSpecs, PumpSpecs, InstrumentSpecs } from '@vapour/types';

// Bought-out items live in the `bought_out_items` collection (snake_case,
// matching firestore.rules and the existing boughtOutService). Centralized
// here so all callers — UI, service, AI parser resolver — query the same
// collection. The Cloud Function resolver imports its own copy of this
// literal; if you ever rename the collection, update both.
export const BOUGHT_OUT_COLLECTION = 'bought_out_items';

/* ─── Vocabulary ─────────────────────────────────────────────── */

export const VALVE_END_SHORT: Record<NonNullable<ValveSpecs['endConnection']>, string> = {
  FLANGED_RF: 'FLG',
  FLANGED_FF: 'FLG-FF',
  BUTT_WELD: 'BW',
  SOCKET_WELD: 'SW',
  THREADED: 'THD',
  WAFER: 'WAF',
  LUG: 'LUG',
};

export const VALVE_OP_SHORT: Record<NonNullable<ValveSpecs['operation']>, string> = {
  MANUAL: 'MAN',
  GEAR: 'GR',
  PNEUMATIC: 'PNE',
  ELECTRIC: 'ELE',
  HYDRAULIC: 'HYD',
  SELF_ACTUATED: 'SA',
};

export const PUMP_TYPE_SHORT: Record<NonNullable<PumpSpecs['pumpType']>, string> = {
  CENTRIFUGAL: 'CF',
  GEAR: 'GR',
  DIAPHRAGM: 'DPH',
  SCREW: 'SCR',
  RECIPROCATING: 'REC',
  DOSING: 'DOS',
};

export const INSTRUMENT_VAR_SHORT: Record<NonNullable<InstrumentSpecs['variable']>, string> = {
  PRESSURE: 'P',
  TEMPERATURE: 'T',
  FLOW: 'F',
  LEVEL: 'L',
  CONDUCTIVITY: 'COND',
  PH: 'PH',
  TURBIDITY: 'TURB',
  DISSOLVED_O2: 'DO2',
};

export const INSTRUMENT_TYPE_SHORT: Record<
  NonNullable<InstrumentSpecs['instrumentType']>,
  string
> = {
  TRANSMITTER: 'T',
  SWITCH: 'S',
  ANALYSER: 'A',
  INDICATOR: 'I',
  RECORDER: 'R',
  CONTROLLER: 'C',
};

/* ─── Code building ──────────────────────────────────────────── */

function roundForCode(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return Number(n.toFixed(1)).toString().replace(/\.0$/, '');
}

/**
 * Result of attempting to build a spec code. `code` is set when all
 * required attributes for the family are present. `reason` explains
 * what's missing when they aren't.
 */
export type SpecCodeBuildResult = { ok: true; code: string } | { ok: false; reason: string };

/**
 * Build a deterministic spec code for a valve. Returns ok:false with a
 * specific reason if any required attribute is missing — callers use this
 * for the live preview ("3 fields missing") and to gate save.
 */
export function buildValveSpecCode(spec: ValveSpecs): SpecCodeBuildResult {
  const missing: string[] = [];
  if (!spec.valveType) missing.push('type');
  if (!spec.bodyMaterial?.trim()) missing.push('body material');
  if (!spec.size?.trim()) missing.push('size');
  if (!spec.pressureRating?.trim()) missing.push('rating');
  if (!spec.endConnection) missing.push('end connection');
  if (!spec.operation) missing.push('operation');
  if (missing.length > 0) {
    return { ok: false, reason: `Missing: ${missing.join(', ')}` };
  }
  const matl = spec.bodyMaterial!.replace(/\s+/g, '').toUpperCase();
  const size = spec.size!.replace(/\s+/g, '').toUpperCase();
  const rating = spec.pressureRating!.replace(/\s+/g, '').toUpperCase();
  return {
    ok: true,
    code: `VLV-${spec.valveType}-${matl}-${size}-${rating}-${VALVE_END_SHORT[spec.endConnection!]}-${VALVE_OP_SHORT[spec.operation!]}`,
  };
}

/**
 * Build a deterministic spec code for a pump. Same shape as valve.
 */
export function buildPumpSpecCode(spec: PumpSpecs): SpecCodeBuildResult {
  const missing: string[] = [];
  if (!spec.pumpType) missing.push('type');
  if (spec.flowRate == null || !Number.isFinite(spec.flowRate)) missing.push('flow rate');
  if (spec.head == null || !Number.isFinite(spec.head)) missing.push('head');
  if (missing.length > 0) {
    return { ok: false, reason: `Missing: ${missing.join(', ')}` };
  }
  return {
    ok: true,
    code: `PUMP-${PUMP_TYPE_SHORT[spec.pumpType!]}-${roundForCode(spec.flowRate!)}M3H-${roundForCode(spec.head!)}M`,
  };
}

/**
 * Build a deterministic spec code for an instrument. Sequence-based per
 * (variable, type) pair — needs a Firestore round-trip to find next seq.
 *
 * Returns ok:false synchronously if variable/type are missing; otherwise
 * use `nextInstrumentSpecCode` which queries Firestore.
 */
export function checkInstrumentSpecComplete(spec: InstrumentSpecs): SpecCodeBuildResult {
  const missing: string[] = [];
  if (!spec.variable) missing.push('variable');
  if (!spec.instrumentType) missing.push('instrument type');
  if (missing.length > 0) {
    return { ok: false, reason: `Missing: ${missing.join(', ')}` };
  }
  const varCode = INSTRUMENT_VAR_SHORT[spec.variable!];
  const typeCode = INSTRUMENT_TYPE_SHORT[spec.instrumentType!];
  // Live preview shows the prefix; the actual seq number is appended at save time.
  return { ok: true, code: `INST-${varCode}${typeCode}-XXXX` };
}

export async function nextInstrumentSpecCode(
  db: Firestore,
  spec: InstrumentSpecs
): Promise<string> {
  if (!spec.variable || !spec.instrumentType) {
    throw new Error('Instrument spec needs both variable and instrumentType to build a code');
  }
  const prefix = `INST-${INSTRUMENT_VAR_SHORT[spec.variable]}${INSTRUMENT_TYPE_SHORT[spec.instrumentType]}-`;
  const snap = await getDocs(
    query(
      collection(db, BOUGHT_OUT_COLLECTION),
      where('specCode', '>=', prefix),
      where('specCode', '<', prefix + '')
    )
  );
  let maxSeq = 0;
  for (const d of snap.docs) {
    const code = (d.data() as { specCode?: string }).specCode ?? '';
    const m = code.match(/-(\d+)$/);
    if (m && m[1]) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
}

/* ─── Find-existing helpers ──────────────────────────────────── */

/**
 * Returns the existing bought-out item id with this specCode, or null.
 * Used by the manual-entry form to detect duplicates BEFORE creating.
 */
export async function findBoughtOutBySpecCode(
  db: Firestore,
  specCode: string
): Promise<{ id: string; itemCode?: string; name?: string } | null> {
  const snap = await getDocs(
    query(collection(db, BOUGHT_OUT_COLLECTION), where('specCode', '==', specCode))
  );
  const doc = snap.docs[0];
  if (!doc) return null;
  const data = doc.data() as { itemCode?: string; name?: string };
  return { id: doc.id, itemCode: data.itemCode, name: data.name };
}
