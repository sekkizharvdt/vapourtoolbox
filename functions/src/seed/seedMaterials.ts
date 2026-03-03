import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import * as path from 'path';
import * as fs from 'fs';

// Helper function to load seed data - called inside the handler, not at module level
function loadSeedData(
  dataType: 'pipes' | 'fittings' | 'flanges' | 'plates'
): SeedData | PlatesSeedData {
  const seedDataDir = path.join(__dirname, '..', 'seed-data');
  const fileMap = {
    pipes: 'pipes-carbon-steel.json',
    fittings: 'fittings-butt-weld.json',
    flanges: 'flanges-weld-neck.json',
    plates: 'plates-common.json',
  };

  const filePath = path.join(seedDataDir, fileMap[dataType]);
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data) as SeedData | PlatesSeedData;
}

interface SeedDataMetadata {
  standard: string;
  material: string;
  specification: string;
  description?: string;
  note?: string;
  pressureClasses?: string[];
}

interface MaterialDefinition {
  materialCode: string;
  name: string;
  category: string;
  hasVariants: boolean;
  baseUnit: string;
  materialType?: string;
  specification?: Record<string, string>;
  description?: string;
  tags?: string[];
  isActive?: boolean;
  isStandard?: boolean;
}

interface SeedData {
  metadata: SeedDataMetadata;
  material: MaterialDefinition;
  variants: Record<string, unknown>[];
}

// Plates seed data structure (multiple materials, no variants)
interface PlatesSeedData {
  metadata: {
    standard: string;
    title: string;
    description: string;
    createdAt: string;
    source: string;
  };
  materials: Array<Record<string, unknown>>;
}

interface SeedMaterialsRequest {
  dataType: 'pipes' | 'fittings' | 'flanges' | 'plates' | 'all';
  deleteExisting?: boolean;
}

interface SeedMaterialsResult {
  success: boolean;
  materialsCreated: number;
  variantsCreated: number;
  details: {
    pipes?: { materialsCreated: number };
    fittings?: { materialsCreated: number };
    flanges?: { materialsCreated: number };
    plates?: { materialsCount: number };
  };
}

// ============================================================================
// Material code generators for flat piping documents
// ============================================================================

/**
 * Normalize NPS for use in material codes.
 * "1/2" -> "0.5", "1 1/2" -> "1.5", "2" -> "2"
 */
function normalizeNPS(nps: string): string {
  const fractionMap: Record<string, string> = {
    '1/8': '0.125',
    '1/4': '0.25',
    '3/8': '0.375',
    '1/2': '0.5',
    '3/4': '0.75',
    '1 1/4': '1.25',
    '1 1/2': '1.5',
    '2 1/2': '2.5',
    '3 1/2': '3.5',
  };
  return fractionMap[nps] || nps;
}

/**
 * Generate a material code for a flat flange document.
 * Format: FL-WN-CS-A105-{NPS}-{CLASS}
 * Example: FL-WN-CS-A105-2-150
 */
function generateFlangeCode(
  baseMaterial: MaterialDefinition,
  variant: Record<string, unknown>
): string {
  const nps = normalizeNPS(String(variant.nps || ''));
  const pressureClass = String(variant.pressureClass || '').replace('#', '');
  return `${baseMaterial.materialCode}-${nps}-${pressureClass}`;
}

/**
 * Generate a material code for a flat pipe document.
 * Format: PP-CS-A106-SMLS-{NPS}-SCH{SCHEDULE}
 * Example: PP-CS-A106-SMLS-2-SCH40
 */
function generatePipeCode(
  baseMaterial: MaterialDefinition,
  variant: Record<string, unknown>
): string {
  const nps = normalizeNPS(String(variant.nps || ''));
  const schedule = String(variant.schedule || '');
  return `${baseMaterial.materialCode}-${nps}-SCH${schedule}`;
}

/**
 * Abbreviate fitting type for code generation.
 * "90° Elbow Long Radius" -> "90ELR", "Tee" -> "TEE"
 */
function abbreviateFittingType(fittingType: string): string {
  const map: Record<string, string> = {
    '90° Elbow Long Radius': '90ELR',
    '90° Elbow Short Radius': '90ESR',
    '45° Elbow Long Radius': '45ELR',
    '45° Elbow': '45E',
    'Equal Tee': 'TEE',
    Tee: 'TEE',
    'Reducing Tee': 'RTEE',
    'Concentric Reducer': 'CRED',
    'Eccentric Reducer': 'ERED',
    Cap: 'CAP',
    'Stub End': 'STBE',
    'Lap Joint Stub End': 'LJSE',
    Cross: 'CRS',
  };
  return (
    map[fittingType] ||
    fittingType
      .replace(/[^A-Za-z0-9]/g, '')
      .substring(0, 6)
      .toUpperCase()
  );
}

/**
 * Generate a material code for a flat fitting document.
 * Format: FT-BW-CS-A234-{TYPE}-{NPS}
 * Example: FT-BW-CS-A234-90ELR-2
 */
function generateFittingCode(
  baseMaterial: MaterialDefinition,
  variant: Record<string, unknown>
): string {
  const fittingType = abbreviateFittingType(String(variant.type || ''));
  const nps = normalizeNPS(String(variant.nps || ''));
  return `${baseMaterial.materialCode}-${fittingType}-${nps}`;
}

/**
 * Generate a display name for a flat material document.
 */
function generateFlatMaterialName(
  baseMaterial: MaterialDefinition,
  variant: Record<string, unknown>,
  type: 'flanges' | 'pipes' | 'fittings'
): string {
  switch (type) {
    case 'flanges':
      return `${baseMaterial.name} NPS ${variant.nps} ${variant.pressureClass}`;
    case 'pipes':
      return `${baseMaterial.name} NPS ${variant.nps} Sch ${variant.schedule}`;
    case 'fittings':
      return `${variant.type} ${baseMaterial.name.replace('Butt-Weld Fittings ', '')} NPS ${variant.nps}`;
    default:
      return baseMaterial.name;
  }
}

// ============================================================================
// Map variant data to flat Material top-level fields
// ============================================================================

function mapFlangeToMaterialFields(variant: Record<string, unknown>): Record<string, unknown> {
  return {
    nps: variant.nps,
    dn: variant.dn,
    pressureClass: variant.pressureClass,
    outsideDiameter_mm: variant.outsideDiameter_mm,
    thickness_mm: variant.thickness_mm,
    boltCircle_mm: variant.boltCircle_mm,
    boltHoles: variant.boltHoles,
    boltSize_inch: variant.boltSize_inch,
    raisedFace_mm: variant.raisedFace_mm,
    weightPerPiece_kg: variant.weight_kg,
    // Keep imperial for reference
    ...(variant.outsideDiameter_inch !== undefined && {
      outsideDiameter_inch: variant.outsideDiameter_inch,
    }),
    ...(variant.thickness_inch !== undefined && { thickness_inch: variant.thickness_inch }),
    ...(variant.boltCircle_inch !== undefined && { boltCircle_inch: variant.boltCircle_inch }),
    ...(variant.raisedFace_inch !== undefined && { raisedFace_inch: variant.raisedFace_inch }),
  };
}

function mapPipeToMaterialFields(variant: Record<string, unknown>): Record<string, unknown> {
  return {
    nps: variant.nps,
    dn: variant.dn,
    schedule: variant.schedule,
    outsideDiameter_mm: variant.od_mm,
    wallThickness_mm: variant.wt_mm,
    weightPerMeter_kg: variant.weight_kgm,
    // Keep imperial for reference
    ...(variant.od_inch !== undefined && { outsideDiameter_inch: variant.od_inch }),
    ...(variant.wt_inch !== undefined && { wallThickness_inch: variant.wt_inch }),
    ...(variant.weight_lbft !== undefined && { weight_lbft: variant.weight_lbft }),
    ...(variant.scheduleType !== undefined && { scheduleType: variant.scheduleType }),
  };
}

function mapFittingToMaterialFields(variant: Record<string, unknown>): Record<string, unknown> {
  return {
    nps: variant.nps,
    dn: variant.dn,
    fittingType: variant.type,
    outsideDiameter_mm: variant.outsideDiameter_mm,
    centerToEnd_mm: variant.centerToEnd_mm,
    ...(variant.applicableSchedules !== undefined && {
      applicableSchedules: variant.applicableSchedules,
    }),
    // Keep imperial for reference
    ...(variant.outsideDiameter_inch !== undefined && {
      outsideDiameter_inch: variant.outsideDiameter_inch,
    }),
    ...(variant.centerToEnd_inch !== undefined && { centerToEnd_inch: variant.centerToEnd_inch }),
    ...(variant.weight_kg !== undefined && { weightPerPiece_kg: variant.weight_kg }),
  };
}

/**
 * Seed materials data from JSON files into Firestore
 *
 * Pipes, fittings, and flanges are created as FLAT material documents
 * (one document per size/rating combo) with a familyCode field for grouping.
 *
 * Standards:
 * - ASME B36.10-2022 (Pipes)
 * - ASME B16.9-2024 (Fittings)
 * - ASME B16.5-2025 (Flanges)
 */
export const seedMaterials = onCall<SeedMaterialsRequest, Promise<SeedMaterialsResult>>(
  {
    region: 'us-central1',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async (request) => {
    const { dataType, deleteExisting = false } = request.data;

    logger.info('Starting materials seed operation', { dataType, deleteExisting });

    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated to seed data');
    }

    const db = getFirestore();
    const result: SeedMaterialsResult = {
      success: false,
      materialsCreated: 0,
      variantsCreated: 0,
      details: {},
    };

    try {
      // Handle plates separately (different structure — keeps variant model)
      if (dataType === 'plates' || dataType === 'all') {
        logger.info('Processing plates data');
        const platesData = loadSeedData('plates') as PlatesSeedData;

        let platesCreated = 0;
        for (const materialData of platesData.materials) {
          const existingQuery = await db
            .collection('materials')
            .where('materialCode', '==', materialData.materialCode)
            .limit(1)
            .get();

          if (!existingQuery.empty) {
            if (deleteExisting) {
              await db
                .collection('materials')
                .doc(existingQuery.docs[0].id)
                .update({
                  ...materialData,
                  updatedAt: FieldValue.serverTimestamp(),
                });
              logger.info(`Updated existing plate material: ${materialData.materialCode}`);
            } else {
              logger.warn(`Plate material ${materialData.materialCode} already exists. Skipping.`);
              continue;
            }
          } else {
            await db.collection('materials').add({
              ...materialData,
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            });
            platesCreated++;
            result.materialsCreated++;
            logger.info(`Created new plate material: ${materialData.materialCode}`);
          }
        }

        result.details.plates = { materialsCount: platesCreated };
        logger.info(`Completed seeding plates: ${platesCreated} materials created`);
      }

      // ================================================================
      // FLAT MODEL: Pipes, fittings, flanges — one document per size/rating
      // ================================================================

      const dataSources: Array<{ type: 'pipes' | 'fittings' | 'flanges'; data: SeedData }> = [];

      if (dataType === 'pipes' || dataType === 'all') {
        dataSources.push({ type: 'pipes', data: loadSeedData('pipes') as SeedData });
      }
      if (dataType === 'fittings' || dataType === 'all') {
        dataSources.push({ type: 'fittings', data: loadSeedData('fittings') as SeedData });
      }
      if (dataType === 'flanges' || dataType === 'all') {
        dataSources.push({ type: 'flanges', data: loadSeedData('flanges') as SeedData });
      }

      for (const source of dataSources) {
        logger.info(`Processing ${source.type} data (flat model)`);

        const { metadata, material: baseMaterial, variants } = source.data;
        const familyCode = baseMaterial.materialCode;
        let materialsCreated = 0;

        // If deleteExisting, remove all existing documents for this family
        if (deleteExisting) {
          const existingDocs = await db
            .collection('materials')
            .where('familyCode', '==', familyCode)
            .get();

          if (!existingDocs.empty) {
            const deleteBatchSize = 500;
            for (let i = 0; i < existingDocs.docs.length; i += deleteBatchSize) {
              const batch = db.batch();
              const batchDocs = existingDocs.docs.slice(i, i + deleteBatchSize);
              batchDocs.forEach((doc) => batch.delete(doc.ref));
              await batch.commit();
            }
            logger.info(
              `Deleted ${existingDocs.size} existing ${source.type} materials for family ${familyCode}`
            );
          }

          // Also mark old parent document as migrated (if it exists)
          const oldParentQuery = await db
            .collection('materials')
            .where('materialCode', '==', familyCode)
            .limit(1)
            .get();

          if (!oldParentQuery.empty) {
            await db.collection('materials').doc(oldParentQuery.docs[0].id).update({
              isMigrated: true,
              updatedAt: FieldValue.serverTimestamp(),
            });
            logger.info(`Marked old parent ${familyCode} as migrated`);
          }
        } else {
          // Check if flat documents already exist for this family
          const existingFlat = await db
            .collection('materials')
            .where('familyCode', '==', familyCode)
            .limit(1)
            .get();

          if (!existingFlat.empty) {
            logger.warn(
              `Flat materials for family ${familyCode} already exist. Use deleteExisting=true to overwrite.`
            );
            continue;
          }
        }

        // Create one material document per variant (size/rating combo)
        const batchSize = 500;
        for (let i = 0; i < variants.length; i += batchSize) {
          const batch = db.batch();
          const batchVariants = variants.slice(i, i + batchSize);

          for (const variant of batchVariants) {
            // Generate material code based on type
            let materialCode: string;
            let pipingFields: Record<string, unknown>;

            switch (source.type) {
              case 'flanges':
                materialCode = generateFlangeCode(baseMaterial, variant);
                pipingFields = mapFlangeToMaterialFields(variant);
                break;
              case 'pipes':
                materialCode = generatePipeCode(baseMaterial, variant);
                pipingFields = mapPipeToMaterialFields(variant);
                break;
              case 'fittings':
                materialCode = generateFittingCode(baseMaterial, variant);
                pipingFields = mapFittingToMaterialFields(variant);
                break;
            }

            const materialDoc: Record<string, unknown> = {
              // Core fields
              materialCode,
              name: generateFlatMaterialName(baseMaterial, variant, source.type),
              description: baseMaterial.description || metadata.description || '',
              category: baseMaterial.category,
              materialType: baseMaterial.materialType || 'BOUGHT_OUT_COMPONENT',
              baseUnit: baseMaterial.baseUnit,

              // Specification from parent
              ...(baseMaterial.specification && { specification: baseMaterial.specification }),

              // Family grouping
              familyCode,

              // Piping dimensions and engineering data
              ...pipingFields,

              // Metadata from seed file
              seedMetadata: {
                standard: metadata.standard,
                specification: metadata.specification,
              },

              // Flags
              hasVariants: false, // Flat model — no variants
              isActive: true,
              isStandard: baseMaterial.isStandard ?? true,
              trackInventory: false,

              // Defaults
              tags: baseMaterial.tags || [source.type],
              preferredVendors: [],
              priceHistory: [],

              // Audit
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            };

            const docRef = db.collection('materials').doc();
            batch.set(docRef, materialDoc);
            materialsCreated++;
          }

          await batch.commit();
          logger.info(
            `Created batch of ${batchVariants.length} flat ${source.type} materials (family: ${familyCode})`
          );
        }

        result.materialsCreated += materialsCreated;
        result.details[source.type] = { materialsCreated };

        logger.info(`Completed seeding ${source.type}: ${materialsCreated} materials created`, {
          familyCode,
        });
      }

      result.success = true;
      logger.info('Materials seed operation completed successfully', result);

      return result;
    } catch (error) {
      logger.error('Error seeding materials', error);
      throw new HttpsError(
        'internal',
        `Failed to seed materials: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
);
