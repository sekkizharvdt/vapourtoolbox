/**
 * Material CRUD Operations
 *
 * Provides create, read, update, and delete operations for materials.
 */

import {
  collection,
  query,
  where,
  limit,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { docToTyped } from '../firebase/typeHelpers';
import type { Material, MaterialCategory, EquipmentSpec } from '@vapour/types';
import { getMaterialCodeParts } from '@vapour/types';
import { logAuditEvent, type AuditContext } from '../audit/clientAuditService';

const EQUIPMENT_CATEGORY_FAMILY: Partial<
  Record<MaterialCategory, 'VALVE' | 'PUMP' | 'INSTRUMENT'>
> = {
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

/** Map an instrument category enum to the short subtype code used in the
 *  generated material code (`INST-PG-0001`, `INST-TS-0001`, etc.). */
const INSTRUMENT_SUBTYPE_CODE: Partial<Record<MaterialCategory, string>> = {
  INSTRUMENT_PRESSURE_GAUGE: 'PG',
  INSTRUMENT_TEMPERATURE_SENSOR: 'TS',
  INSTRUMENT_FLOW_METER: 'FM',
  INSTRUMENT_LEVEL_TRANSMITTER: 'LT',
  INSTRUMENT_CONTROL_VALVE: 'CV',
  INSTRUMENT_OTHER: 'OTH',
};

export function getEquipmentFamily(
  category: MaterialCategory
): 'VALVE' | 'PUMP' | 'INSTRUMENT' | undefined {
  return EQUIPMENT_CATEGORY_FAMILY[category];
}

const logger = createLogger({ context: 'materialService:crud' });

/**
 * Options for material CRUD operations with optional audit logging
 */
export interface MaterialCrudOptions {
  /** Optional audit context for logging. If provided, audit events will be logged. */
  auditContext?: AuditContext;
}

/**
 * Create a new material
 *
 * @param db - Firestore instance
 * @param materialData - Material data (without id)
 * @param userId - ID of user creating the material
 * @param options - Optional settings including audit context
 * @returns Created material with generated ID
 */
export async function createMaterial(
  db: Firestore,
  materialData: Omit<Material, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
  userId: string,
  options?: MaterialCrudOptions
): Promise<Material> {
  try {
    logger.info('Creating material', { name: materialData.name, category: materialData.category });

    // Generate material code if not provided
    // Requires grade from specification
    if (!materialData.materialCode && !materialData.specification.grade) {
      throw new Error('Material grade is required for code generation');
    }

    const materialCode =
      materialData.materialCode ||
      (await generateMaterialCode(
        db,
        materialData.category,
        materialData.specification.grade as string
      ));

    const now = Timestamp.now();
    const tenantId = (materialData as { tenantId?: string }).tenantId;
    const newMaterial: Omit<Material, 'id'> = {
      ...materialData,
      materialCode,
      priceHistory: [],
      preferredVendors: materialData.preferredVendors || [],
      tags: materialData.tags || [],
      certifications: materialData.certifications || [],
      isActive: materialData.isActive ?? true,
      isStandard: materialData.isStandard ?? false,
      trackInventory: materialData.trackInventory ?? false,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.MATERIALS), {
      ...newMaterial,
      // Explicit tenantId pass-through for the tenant-ID safety audit
      // (CLAUDE.md rule #1). Caller may or may not supply it; we don't
      // fabricate one — undefined stays undefined, which is the same
      // as not setting the field.
      ...(tenantId && { tenantId }),
    });

    logger.info('Material created successfully', { id: docRef.id, materialCode });

    // Log audit event if context provided
    if (options?.auditContext) {
      await logAuditEvent(
        db,
        options.auditContext,
        'MATERIAL_CREATED',
        'MATERIAL',
        docRef.id,
        `Created material "${materialData.name}" (${materialCode})`,
        {
          entityName: materialData.name,
          metadata: {
            materialCode,
            category: materialData.category,
            grade: materialData.specification.grade,
          },
        }
      );
    }

    return {
      ...newMaterial,
      id: docRef.id,
    };
  } catch (error) {
    logger.error('Failed to create material', { error });
    throw new Error(
      `Failed to create material: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate material code (PL-SS-304 format)
 * Format: {FORM}-{MATERIAL}-{GRADE}
 * Example: PL-SS-304 (Plate - Stainless Steel - 304)
 *
 * Note: Each grade has exactly ONE material code.
 * All thickness/finish variations are stored as variants within that material.
 *
 * @param db - Firestore instance
 * @param category - Material category (e.g., PLATES_STAINLESS_STEEL)
 * @param grade - Material grade (e.g., "304", "304L", "316", "316L")
 * @returns Promise<string> - Generated material code
 */
/**
 * Build a deterministic equipment code from an EquipmentSpec.
 *
 * - Valves and pumps: same spec → same code (no sequence). Two parsed lines
 *   with identical (type, material, size, rating, actuation) collapse onto
 *   one material doc.
 * - Instruments: spec doesn't fully identify a unit (no rating/material
 *   axes), so we fall back to a per-subtype sequence — `INST-PG-0001`.
 *
 * Throws on missing required fields per family — callers should validate
 * before calling, or surface the error to the user.
 */
export async function generateEquipmentCode(
  db: Firestore,
  category: MaterialCategory,
  spec: EquipmentSpec
): Promise<string> {
  const family = getEquipmentFamily(category);
  if (!family) {
    throw new Error(`Category ${category} is not an equipment category`);
  }

  if (family === 'VALVE') {
    const { valveType, valveMaterial, valveSize, valveRating, valveActuation } = spec;
    if (!valveType || !valveMaterial || !valveSize || !valveRating || !valveActuation) {
      throw new Error(
        'Valve code requires type, material, size, rating, and actuation. ' +
          `Got type=${valveType ?? '∅'}, material=${valveMaterial ?? '∅'}, size=${
            valveSize ?? '∅'
          }, rating=${valveRating ?? '∅'}, actuation=${valveActuation ?? '∅'}.`
      );
    }
    const size = valveSize.replace(/\s+/g, '').toUpperCase();
    const rating = valveRating.replace(/\s+/g, '').toUpperCase();
    const material = valveMaterial.replace(/\s+/g, '').toUpperCase();
    return `VLV-${valveType}-${material}-${size}-${rating}-${valveActuation}`;
  }

  if (family === 'PUMP') {
    const { pumpType, pumpFlowM3H, pumpHeadM } = spec;
    if (!pumpType || pumpFlowM3H == null || pumpHeadM == null) {
      throw new Error(
        'Pump code requires type, flow (m³/hr), and head (m). ' +
          `Got type=${pumpType ?? '∅'}, flow=${pumpFlowM3H ?? '∅'}, head=${pumpHeadM ?? '∅'}.`
      );
    }
    const flow = roundForCode(pumpFlowM3H);
    const head = roundForCode(pumpHeadM);
    return `PUMP-${pumpType}-${flow}M3H-${head}M`;
  }

  // INSTRUMENT — sequence-based per subtype.
  const subtype = spec.instrumentSubtype || INSTRUMENT_SUBTYPE_CODE[category] || 'OTH';
  const prefix = `INST-${subtype}-`;
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.MATERIALS),
      where('materialCode', '>=', prefix),
      where('materialCode', '<', prefix + '')
    )
  );
  let maxSeq = 0;
  for (const d of snap.docs) {
    const code = (d.data() as { materialCode?: string }).materialCode ?? '';
    const m = code.match(
      new RegExp(`^${prefix.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}(\\d+)$`)
    );
    if (m && m[1]) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > maxSeq) maxSeq = n;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
}

/** Strip trailing zeros from a number for cleaner code segments — `50` not
 *  `50.0`, `12.5` stays `12.5`. */
function roundForCode(n: number): string {
  if (!Number.isFinite(n)) return '0';
  // Round to one decimal, strip trailing zero/decimal.
  return Number(n.toFixed(1)).toString().replace(/\.0$/, '');
}

/**
 * Find an existing material by equipment code, or create it. Used by the
 * AI quote parser so a 20-line valve offer can resolve each line to a master
 * record automatically — exact-match by deterministic code, not fuzzy.
 *
 * Returns the material plus a flag indicating whether it was newly created
 * (so the caller can flag rows for human review and surface a banner).
 */
export async function findOrCreateMaterialByEquipmentSpec(
  db: Firestore,
  args: {
    category: MaterialCategory;
    spec: EquipmentSpec;
    name: string;
    baseUnit: string;
    userId: string;
    tenantId?: string;
  }
): Promise<{ material: Material; created: boolean }> {
  const code = await generateEquipmentCode(db, args.category, args.spec);

  // Look up existing material with this code.
  const existingSnap = await getDocs(
    query(collection(db, COLLECTIONS.MATERIALS), where('materialCode', '==', code), limit(1))
  );
  const existingDoc = existingSnap.docs[0];
  if (existingDoc) {
    return {
      material: docToTyped<Material>(existingDoc.id, existingDoc.data()),
      created: false,
    };
  }

  // Not found — create. Mark needsReview so a human can verify the spec.
  const newMaterial: Omit<Material, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'> =
    {
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
      ...(args.tenantId && { tenantId: args.tenantId }),
    };
  const created = await createMaterial(db, newMaterial, args.userId);

  return { material: created, created: true };
}

async function generateMaterialCode(
  db: Firestore,
  category: MaterialCategory,
  grade: string
): Promise<string> {
  const codeParts = getMaterialCodeParts(category);

  if (!codeParts) {
    throw new Error(`Material code generation not supported for category: ${category}`);
  }

  const [form, material] = codeParts;

  // Normalize grade (remove spaces, convert to uppercase)
  const normalizedGrade = grade.replace(/\s+/g, '').toUpperCase();

  // Simple format: PL-SS-304 (no sequence number)
  const materialCode = `${form}-${material}-${normalizedGrade}`;

  // Check if this material code already exists
  const q = query(
    collection(db, COLLECTIONS.MATERIALS),
    where('materialCode', '==', materialCode),
    limit(1)
  );

  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    throw new Error(
      `Material code ${materialCode} already exists. Each grade should have only one material entry. Use variants for different thicknesses/finishes.`
    );
  }

  return materialCode;
}

/**
 * Update an existing material
 *
 * @param db - Firestore instance
 * @param materialId - Material ID to update
 * @param updates - Partial material data to update
 * @param userId - ID of user updating the material
 * @param options - Optional settings including audit context
 */
export async function updateMaterial(
  db: Firestore,
  materialId: string,
  updates: Partial<Omit<Material, 'id' | 'materialCode' | 'createdAt' | 'createdBy'>>,
  userId: string,
  options?: MaterialCrudOptions
): Promise<void> {
  try {
    logger.info('Updating material', { materialId });

    const materialRef = doc(db, COLLECTIONS.MATERIALS, materialId);
    await updateDoc(materialRef, {
      ...updates,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    logger.info('Material updated successfully', { materialId });

    // Log audit event if context provided
    if (options?.auditContext) {
      await logAuditEvent(
        db,
        options.auditContext,
        'MATERIAL_UPDATED',
        'MATERIAL',
        materialId,
        `Updated material "${updates.name || materialId}"`,
        {
          entityName: updates.name,
          metadata: {
            updatedFields: Object.keys(updates),
          },
        }
      );
    }
  } catch (error) {
    logger.error('Failed to update material', { materialId, error });
    throw new Error(
      `Failed to update material: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get material by ID
 *
 * @param db - Firestore instance
 * @param materialId - Material ID
 * @returns Material or null if not found
 */
export async function getMaterialById(db: Firestore, materialId: string): Promise<Material | null> {
  try {
    const materialRef = doc(db, COLLECTIONS.MATERIALS, materialId);
    const materialSnap = await getDoc(materialRef);

    if (!materialSnap.exists()) {
      return null;
    }

    return docToTyped<Material>(materialSnap.id, materialSnap.data());
  } catch (error) {
    logger.error('Failed to get material', { materialId, error });
    throw new Error(
      `Failed to get material: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Soft delete a material (set isActive = false)
 *
 * @param db - Firestore instance
 * @param materialId - Material ID to delete
 * @param userId - ID of user deleting the material
 * @param options - Optional settings including audit context
 */
export async function deleteMaterial(
  db: Firestore,
  materialId: string,
  userId: string,
  options?: MaterialCrudOptions
): Promise<void> {
  try {
    logger.info('Soft deleting material', { materialId });

    // Get material name before deleting for audit log
    let materialName = materialId;
    if (options?.auditContext) {
      const material = await getMaterialById(db, materialId);
      if (material) {
        materialName = material.name;
      }
    }

    const materialRef = doc(db, COLLECTIONS.MATERIALS, materialId);
    await updateDoc(materialRef, {
      isActive: false,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    logger.info('Material soft deleted successfully', { materialId });

    // Log audit event if context provided
    if (options?.auditContext) {
      await logAuditEvent(
        db,
        options.auditContext,
        'MATERIAL_DELETED',
        'MATERIAL',
        materialId,
        `Deleted material "${materialName}"`,
        {
          entityName: materialName,
          severity: 'WARNING',
        }
      );
    }
  } catch (error) {
    logger.error('Failed to delete material', { materialId, error });
    throw new Error(
      `Failed to delete material: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
