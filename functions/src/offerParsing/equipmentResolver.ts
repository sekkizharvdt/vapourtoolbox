/**
 * Equipment material resolver — server-side mirror of
 * `findOrCreateMaterialByEquipmentSpec` in apps/web/src/lib/materials/crud.ts.
 *
 * Cloud Functions can't import the client-SDK helpers directly (they need
 * `firebase/firestore`, not `firebase-admin/firestore`). This module
 * duplicates the small amount of code-generation + lookup logic so the
 * `parseQuote` function can resolve parsed equipment lines to master
 * records without round-tripping through the client.
 *
 * Kept deliberately small — vocabularies + format must stay in lockstep
 * with crud.ts. A unit test on the same input ensures both produce the
 * same code.
 */

import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';

export type EquipmentFamily = 'VALVE' | 'PUMP' | 'INSTRUMENT';

export interface EquipmentSpec {
  family: EquipmentFamily;
  // Valves
  valveType?: 'GATE' | 'GLOBE' | 'BALL' | 'BUTTERFLY' | 'CHECK' | 'OTHER';
  valveMaterial?: string;
  valveSize?: string;
  valveRating?: string;
  valveActuation?: 'MAN' | 'PNE' | 'ELE' | 'HYD';
  // Pumps
  pumpType?: 'CF' | 'PD' | 'OTHER';
  pumpFlowM3H?: number;
  pumpHeadM?: number;
  // Instruments
  instrumentSubtype?: string;
}

const EQUIPMENT_CATEGORY_FAMILY: Record<string, EquipmentFamily> = {
  VALVE_GATE: 'VALVE',
  VALVE_GLOBE: 'VALVE',
  VALVE_BALL: 'VALVE',
  VALVE_BUTTERFLY: 'VALVE',
  VALVE_CHECK: 'VALVE',
  VALVE_OTHER: 'VALVE',
  PUMP_CENTRIFUGAL: 'PUMP',
  PUMP_POSITIVE_DISPLACEMENT: 'PUMP',
  INSTRUMENT_PRESSURE_GAUGE: 'INSTRUMENT',
  INSTRUMENT_TEMPERATURE_SENSOR: 'INSTRUMENT',
  INSTRUMENT_FLOW_METER: 'INSTRUMENT',
  INSTRUMENT_LEVEL_TRANSMITTER: 'INSTRUMENT',
  INSTRUMENT_CONTROL_VALVE: 'INSTRUMENT',
  INSTRUMENT_OTHER: 'INSTRUMENT',
};

const INSTRUMENT_SUBTYPE_CODE: Record<string, string> = {
  INSTRUMENT_PRESSURE_GAUGE: 'PG',
  INSTRUMENT_TEMPERATURE_SENSOR: 'TS',
  INSTRUMENT_FLOW_METER: 'FM',
  INSTRUMENT_LEVEL_TRANSMITTER: 'LT',
  INSTRUMENT_CONTROL_VALVE: 'CV',
  INSTRUMENT_OTHER: 'OTH',
};

export function getEquipmentFamily(category: string): EquipmentFamily | undefined {
  return EQUIPMENT_CATEGORY_FAMILY[category];
}

function roundForCode(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return Number(n.toFixed(1)).toString().replace(/\.0$/, '');
}

/**
 * Build a deterministic equipment code from spec. Throws if required fields
 * are missing — caller should fall back to "manual pick" status for that line.
 */
export async function generateEquipmentCode(
  db: admin.firestore.Firestore,
  category: string,
  spec: EquipmentSpec
): Promise<string> {
  const family = getEquipmentFamily(category);
  if (!family) throw new Error(`Category ${category} is not an equipment category`);

  if (family === 'VALVE') {
    const { valveType, valveMaterial, valveSize, valveRating, valveActuation } = spec;
    if (!valveType || !valveMaterial || !valveSize || !valveRating || !valveActuation) {
      throw new Error('Valve code requires type, material, size, rating, and actuation.');
    }
    const size = valveSize.replace(/\s+/g, '').toUpperCase();
    const rating = valveRating.replace(/\s+/g, '').toUpperCase();
    const material = valveMaterial.replace(/\s+/g, '').toUpperCase();
    return `VLV-${valveType}-${material}-${size}-${rating}-${valveActuation}`;
  }

  if (family === 'PUMP') {
    const { pumpType, pumpFlowM3H, pumpHeadM } = spec;
    if (!pumpType || pumpFlowM3H == null || pumpHeadM == null) {
      throw new Error('Pump code requires type, flow (m³/hr), and head (m).');
    }
    return `PUMP-${pumpType}-${roundForCode(pumpFlowM3H)}M3H-${roundForCode(pumpHeadM)}M`;
  }

  // INSTRUMENT — sequence-based per subtype
  const subtype = spec.instrumentSubtype || INSTRUMENT_SUBTYPE_CODE[category] || 'OTH';
  const prefix = `INST-${subtype}-`;
  const snap = await db
    .collection('materials')
    .where('materialCode', '>=', prefix)
    .where('materialCode', '<', prefix + '')
    .get();
  let maxSeq = 0;
  for (const d of snap.docs) {
    const code = (d.data().materialCode as string | undefined) ?? '';
    const m = code.match(/-(\d+)$/);
    if (m && m[1]) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
}

/**
 * Look up a material by equipment code, or create it on the server side.
 * Returns the resolved id, the code, whether it was newly created, and any
 * warning that bubbled up from the generator.
 */
export async function resolveEquipmentMaterial(
  db: admin.firestore.Firestore,
  args: {
    category: string;
    spec: EquipmentSpec;
    name: string;
    baseUnit: string;
    userId: string;
    tenantId?: string;
  }
): Promise<
  | { status: 'linked' | 'auto-created'; materialId: string; materialCode: string }
  | { status: 'manual-needed'; reason: string }
> {
  let code: string;
  try {
    code = await generateEquipmentCode(db, args.category, args.spec);
  } catch (err) {
    return {
      status: 'manual-needed',
      reason: err instanceof Error ? err.message : 'Equipment code could not be generated',
    };
  }

  const existing = await db
    .collection('materials')
    .where('materialCode', '==', code)
    .limit(1)
    .get();
  const existingDoc = existing.docs[0];
  if (existingDoc) {
    return { status: 'linked', materialId: existingDoc.id, materialCode: code };
  }

  const now = admin.firestore.Timestamp.now();
  const newDoc = await db.collection('materials').add({
    materialCode: code,
    name: args.name,
    description: '',
    category: args.category,
    materialType: 'EQUIPMENT',
    specification: {},
    properties: {},
    hasVariants: false,
    baseUnit: args.baseUnit,
    preferredVendors: [],
    priceHistory: [],
    trackInventory: false,
    tags: [],
    isActive: true,
    isStandard: false,
    equipmentSpec: args.spec,
    needsReview: true,
    createdBy: args.userId,
    createdByName: 'AI Quote Parser',
    updatedBy: args.userId,
    createdAt: now,
    updatedAt: now,
    ...(args.tenantId && { tenantId: args.tenantId }),
  });
  logger.info('[parseQuote] Auto-created material', {
    code,
    name: args.name,
    family: args.spec.family,
  });
  return { status: 'auto-created', materialId: newDoc.id, materialCode: code };
}
