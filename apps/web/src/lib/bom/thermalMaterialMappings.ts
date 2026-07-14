/**
 * Thermal Material Mappings — persistent lookup table from a thermal
 * calculator's free-text material/item string (e.g. "Duplex SS UNS S32304")
 * to a real catalog item (materials or bought_out_items doc).
 *
 * Completion plan A3 (Thermal → BOM export). Mapping once is enough: the doc
 * id is derived deterministically from the normalized source string, so
 * upserts are idempotent and every later export resolves the same string
 * without re-asking the user.
 *
 * The stored shape is a CatalogRef (kind/id/code/name, rule 26 denormalized)
 * plus the source key it maps from.
 */

import { doc, getDoc, runTransaction, Timestamp, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { CatalogRef } from '@vapour/types';

const logger = createLogger({ context: 'thermalMaterialMappings' });

/**
 * A physical BOM component can only map to a material or a bought-out item —
 * never a service (mirrors AddBOMItemDialog's picker restriction).
 */
export type ThermalMappingKind = 'RAW_MATERIAL' | 'BOUGHT_OUT';

/** Firestore document: thermalMaterialMappings/{thermalMappingDocId(normalizedKey)} */
export interface ThermalMaterialMapping {
  /** Original free-text string as produced by the thermal generator. */
  sourceText: string;
  /** normalizeThermalKey(sourceText) — the lookup key. */
  normalizedKey: string;
  /** Which backing collection the target lives in. */
  kind: ThermalMappingKind;
  /** Doc id in materials / bought_out_items. */
  targetId: string;
  /** materialCode | itemCode (rule 26 denormalization). */
  targetCode: string;
  /** Display name (rule 26 denormalization). */
  targetName: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedBy: string;
  updatedAt: Timestamp;
}

export interface UpsertThermalMappingInput {
  sourceText: string;
  kind: ThermalMappingKind;
  targetId: string;
  targetCode: string;
  targetName: string;
}

/**
 * Normalize a free-text thermal material string into its lookup key:
 * lowercase, trim, collapse internal whitespace. Idempotent.
 */
export function normalizeThermalKey(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/** djb2 string hash → unsigned hex. Stable across sessions (no randomness). */
function djb2Hex(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Deterministic Firestore doc id for a normalized key: a readable slug plus a
 * hash of the full key. The hash disambiguates keys whose slugs collide
 * ("ss 316l" vs "ss-316l") and keeps ids valid regardless of source
 * characters (no '/', never '.' or '..').
 */
export function thermalMappingDocId(normalizedKey: string): string {
  const slug = normalizedKey
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'key'}-${djb2Hex(normalizedKey)}`;
}

/** Convert a stored mapping to the CatalogRef written on BOM item components. */
export function mappingToCatalogRef(mapping: ThermalMaterialMapping): CatalogRef {
  return {
    kind: mapping.kind,
    id: mapping.targetId,
    code: mapping.targetCode,
    name: mapping.targetName,
  };
}

/**
 * Fetch mappings for a set of normalized keys. Doc ids are deterministic, so
 * this is a parallel by-id lookup (no query → no composite index, rule 2 n/a).
 * Returns a Map keyed by normalizedKey; missing keys are simply absent.
 */
export async function getThermalMappings(
  db: Firestore,
  normalizedKeys: string[]
): Promise<Map<string, ThermalMaterialMapping>> {
  const uniqueKeys = Array.from(new Set(normalizedKeys));
  const result = new Map<string, ThermalMaterialMapping>();

  try {
    const snaps = await Promise.all(
      uniqueKeys.map((key) =>
        getDoc(doc(db, COLLECTIONS.THERMAL_MATERIAL_MAPPINGS, thermalMappingDocId(key)))
      )
    );

    snaps.forEach((snap, i) => {
      if (snap.exists()) {
        result.set(uniqueKeys[i]!, snap.data() as ThermalMaterialMapping);
      }
    });

    return result;
  } catch (error) {
    logger.error('Error fetching thermal material mappings', {
      keyCount: uniqueKeys.length,
      error,
    });
    throw error;
  }
}

/**
 * Create or update the mapping for one source string. Idempotent — the doc id
 * derives from the normalized key, so remapping the same string overwrites
 * the previous target. Transaction preserves createdAt/createdBy on update
 * (rule 19: conditional read-modify-write).
 */
export async function upsertThermalMapping(
  db: Firestore,
  input: UpsertThermalMappingInput,
  userId: string
): Promise<ThermalMaterialMapping> {
  // rule5-exempt: estimation-adjacent write; firestore.rules gate the
  // thermalMaterialMappings collection with MANAGE_ESTIMATION — server-side gated
  const normalizedKey = normalizeThermalKey(input.sourceText);
  if (!normalizedKey) {
    throw new Error('Cannot map an empty material string');
  }

  const mappingRef = doc(
    db,
    COLLECTIONS.THERMAL_MATERIAL_MAPPINGS,
    thermalMappingDocId(normalizedKey)
  );

  try {
    const saved = await runTransaction(db, async (tx) => {
      const snap = await tx.get(mappingRef);
      const now = Timestamp.now();
      const existing = snap.exists() ? (snap.data() as ThermalMaterialMapping) : null;

      const mapping: ThermalMaterialMapping = {
        sourceText: input.sourceText.trim(),
        normalizedKey,
        kind: input.kind,
        targetId: input.targetId,
        targetCode: input.targetCode,
        targetName: input.targetName,
        createdBy: existing?.createdBy ?? userId,
        createdAt: existing?.createdAt ?? now,
        updatedBy: userId,
        updatedAt: now,
      };

      tx.set(mappingRef, mapping);
      return mapping;
    });

    logger.info('Thermal material mapping upserted', {
      normalizedKey,
      kind: input.kind,
      targetCode: input.targetCode,
    });
    return saved;
  } catch (error) {
    logger.error('Error upserting thermal material mapping', { normalizedKey, error });
    throw error;
  }
}
