/**
 * Bought-out item resolver for the AI quote parser.
 *
 * The vendor-quote PDF gets parsed by Claude into structured spec data;
 * for valves / pumps / instruments / motors we then look up an existing
 * BoughtOutItem with a matching `specCode` (deterministic, built from the
 * spec attributes). On a miss we create a new one with `needsReview: true`
 * so a human verifies the spec extraction before the data spreads.
 *
 * Cloud Functions can't import the client-side `boughtOutService` directly
 * (different Firestore SDK), so the small bit of code-generation + lookup
 * lives here. Vocabularies must stay in sync with the type defs in
 * `packages/types/src/boughtOut.ts` — `ValveSpecs`, `PumpSpecs`, etc.
 */

import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

export type BoughtOutCategory = 'VALVE' | 'PUMP' | 'INSTRUMENT' | 'MOTOR' | 'OTHER';

/**
 * Subset of ValveSpecs needed to build a deterministic spec code. The full
 * type lives in `packages/types/src/boughtOut.ts` — this is intentionally
 * narrower so the parser only has to extract what feeds the code, plus a
 * couple of human-friendly attributes.
 */
export interface ValveSpecMin {
  valveType?:
    | 'GATE'
    | 'GLOBE'
    | 'BALL'
    | 'BUTTERFLY'
    | 'CHECK_SWING'
    | 'CHECK_DUAL_PLATE'
    | 'CHECK_LIFT'
    | 'PLUG'
    | 'NEEDLE'
    | 'DIAPHRAGM'
    | 'CONTROL';
  size?: string; // DN50, 2"
  pressureRating?: string; // 150#, 300#, PN16
  bodyMaterial?: string; // Free text — short codes preferred (SS316, CS, etc.)
  endConnection?:
    | 'FLANGED_RF'
    | 'FLANGED_FF'
    | 'BUTT_WELD'
    | 'SOCKET_WELD'
    | 'THREADED'
    | 'WAFER'
    | 'LUG';
  operation?: 'MANUAL' | 'GEAR' | 'PNEUMATIC' | 'ELECTRIC' | 'HYDRAULIC' | 'SELF_ACTUATED';
}

export interface PumpSpecMin {
  pumpType?: 'CENTRIFUGAL' | 'GEAR' | 'DIAPHRAGM' | 'SCREW' | 'RECIPROCATING' | 'DOSING';
  flowRate?: number; // m³/h
  head?: number; // metres
}

export interface InstrumentSpecMin {
  instrumentType?: 'TRANSMITTER' | 'SWITCH' | 'ANALYSER' | 'INDICATOR' | 'RECORDER' | 'CONTROLLER';
  variable?:
    | 'PRESSURE'
    | 'TEMPERATURE'
    | 'FLOW'
    | 'LEVEL'
    | 'CONDUCTIVITY'
    | 'PH'
    | 'TURBIDITY'
    | 'DISSOLVED_O2';
}

export type ParsedBoughtOutSpec =
  | { category: 'VALVE'; valve: ValveSpecMin; manufacturer?: string; model?: string }
  | { category: 'PUMP'; pump: PumpSpecMin; manufacturer?: string; model?: string }
  | {
      category: 'INSTRUMENT';
      instrument: InstrumentSpecMin;
      manufacturer?: string;
      model?: string;
    };

/* ─── Code generation ────────────────────────────────────────── */

const VALVE_END_SHORT: Record<NonNullable<ValveSpecMin['endConnection']>, string> = {
  FLANGED_RF: 'FLG',
  FLANGED_FF: 'FLG-FF',
  BUTT_WELD: 'BW',
  SOCKET_WELD: 'SW',
  THREADED: 'THD',
  WAFER: 'WAF',
  LUG: 'LUG',
};

const VALVE_OP_SHORT: Record<NonNullable<ValveSpecMin['operation']>, string> = {
  MANUAL: 'MAN',
  GEAR: 'GR',
  PNEUMATIC: 'PNE',
  ELECTRIC: 'ELE',
  HYDRAULIC: 'HYD',
  SELF_ACTUATED: 'SA',
};

const PUMP_TYPE_SHORT: Record<NonNullable<PumpSpecMin['pumpType']>, string> = {
  CENTRIFUGAL: 'CF',
  GEAR: 'GR',
  DIAPHRAGM: 'DPH',
  SCREW: 'SCR',
  RECIPROCATING: 'REC',
  DOSING: 'DOS',
};

const INSTRUMENT_VAR_SHORT: Record<NonNullable<InstrumentSpecMin['variable']>, string> = {
  PRESSURE: 'P',
  TEMPERATURE: 'T',
  FLOW: 'F',
  LEVEL: 'L',
  CONDUCTIVITY: 'COND',
  PH: 'PH',
  TURBIDITY: 'TURB',
  DISSOLVED_O2: 'DO2',
};

const INSTRUMENT_TYPE_SHORT: Record<NonNullable<InstrumentSpecMin['instrumentType']>, string> = {
  TRANSMITTER: 'T',
  SWITCH: 'S',
  ANALYSER: 'A',
  INDICATOR: 'I',
  RECORDER: 'R',
  CONTROLLER: 'C',
};

function roundForCode(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return Number(n.toFixed(1)).toString().replace(/\.0$/, '');
}

/**
 * Build the deterministic spec code. Same spec → same code, every time.
 *
 *   Valves:       VLV-{TYPE}-{MATL}-{SIZE}-{RATING}-{END}-{OP}
 *   Pumps:        PUMP-{TYPE}-{FLOW}M3H-{HEAD}M
 *   Instruments:  INST-{VAR}{TYPE}-{seq}        (seq-based — no rating axis)
 *
 * Throws if required attributes are missing — caller marks the row
 * "manual-needed" and surfaces the reason to the user.
 */
export async function generateBoughtOutSpecCode(
  db: admin.firestore.Firestore,
  parsed: ParsedBoughtOutSpec
): Promise<string> {
  if (parsed.category === 'VALVE') {
    const v = parsed.valve;
    if (
      !v.valveType ||
      !v.size ||
      !v.pressureRating ||
      !v.bodyMaterial ||
      !v.endConnection ||
      !v.operation
    ) {
      throw new Error(
        'Valve spec code requires type, size, rating, body material, end connection, and operation.'
      );
    }
    const matl = v.bodyMaterial.replace(/\s+/g, '').toUpperCase();
    const size = v.size.replace(/\s+/g, '').toUpperCase();
    const rating = v.pressureRating.replace(/\s+/g, '').toUpperCase();
    return `VLV-${v.valveType}-${matl}-${size}-${rating}-${VALVE_END_SHORT[v.endConnection]}-${VALVE_OP_SHORT[v.operation]}`;
  }

  if (parsed.category === 'PUMP') {
    const p = parsed.pump;
    if (!p.pumpType || p.flowRate == null || p.head == null) {
      throw new Error('Pump spec code requires type, flow rate (m³/h), and head (m).');
    }
    return `PUMP-${PUMP_TYPE_SHORT[p.pumpType]}-${roundForCode(p.flowRate)}M3H-${roundForCode(p.head)}M`;
  }

  // INSTRUMENT — sequence-based per (variable, type) pair. Range axes vary
  // too much to make a stable deterministic code without false collisions.
  const i = parsed.instrument;
  const varCode = i.variable ? INSTRUMENT_VAR_SHORT[i.variable] : 'X';
  const typeCode = i.instrumentType ? INSTRUMENT_TYPE_SHORT[i.instrumentType] : 'X';
  const prefix = `INST-${varCode}${typeCode}-`;
  const snap = await db
    .collection('boughtOutItems')
    .where('specCode', '>=', prefix)
    .where('specCode', '<', prefix + '')
    .get();
  let maxSeq = 0;
  for (const d of snap.docs) {
    const code = (d.data().specCode as string | undefined) ?? '';
    const m = code.match(/-(\d+)$/);
    if (m && m[1]) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
}

/* ─── Find or create ─────────────────────────────────────────── */

export async function resolveBoughtOutItem(
  db: admin.firestore.Firestore,
  args: {
    parsed: ParsedBoughtOutSpec;
    name: string;
    unitPrice: number;
    currency: string;
    userId: string;
    tenantId?: string;
  }
): Promise<
  | { status: 'linked' | 'auto-created'; itemId: string; specCode: string }
  | { status: 'manual-needed'; reason: string }
> {
  let specCode: string;
  try {
    specCode = await generateBoughtOutSpecCode(db, args.parsed);
  } catch (err) {
    return {
      status: 'manual-needed',
      reason: err instanceof Error ? err.message : 'Spec code could not be generated',
    };
  }

  const existing = await db
    .collection('boughtOutItems')
    .where('specCode', '==', specCode)
    .limit(1)
    .get();
  const existingDoc = existing.docs[0];
  if (existingDoc) {
    return { status: 'linked', itemId: existingDoc.id, specCode };
  }

  // Build the specifications block in the shape `BoughtOutItem.specifications`
  // expects (each category gets its own dedicated spec object).
  const specifications =
    args.parsed.category === 'VALVE'
      ? args.parsed.valve
      : args.parsed.category === 'PUMP'
        ? args.parsed.pump
        : args.parsed.instrument;

  const now = admin.firestore.Timestamp.now();
  const newDoc = await db.collection('boughtOutItems').add({
    itemCode: specCode, // Use specCode as the user-facing code too — deterministic
    // and stable across re-creation. Existing items created by hand keep their
    // BO-YYYY-NNNN format; new auto-created ones get the structured code.
    specCode,
    name: args.name,
    description: '',
    category: args.parsed.category,
    specifications: {
      ...specifications,
      ...(args.parsed.manufacturer && { manufacturer: args.parsed.manufacturer }),
      ...(args.parsed.model && { model: args.parsed.model }),
    },
    pricing: {
      listPrice: { amount: args.unitPrice, currency: args.currency },
      currency: args.currency,
      lastUpdated: now,
    },
    isActive: true,
    needsReview: true,
    createdBy: args.userId,
    createdByName: 'AI Quote Parser',
    updatedBy: args.userId,
    createdAt: now,
    updatedAt: now,
    ...(args.tenantId && { tenantId: args.tenantId }),
  });
  logger.info('[parseQuote] Auto-created bought-out item', {
    specCode,
    name: args.name,
    category: args.parsed.category,
  });
  return { status: 'auto-created', itemId: newDoc.id, specCode };
}
