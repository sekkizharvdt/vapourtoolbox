import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

/**
 * One-time migration: Convert existing subcollection-based piping materials
 * (flanges, pipes, fittings) into flat material documents.
 *
 * For each parent material with hasVariants=true and a piping category:
 * 1. Read all subcollection variants
 * 2. Create individual material documents with familyCode = parent materialCode
 * 3. Mark the parent as isMigrated=true
 *
 * Safe to run multiple times — skips families that already have flat documents.
 */

const PIPING_CATEGORY_PREFIXES = ['FLANGES', 'PIPES_', 'FITTINGS_'];

function isPipingCategory(category: string): boolean {
  return PIPING_CATEGORY_PREFIXES.some(
    (prefix) => category.startsWith(prefix) || category === 'FLANGES'
  );
}

/**
 * Normalize NPS for use in material codes.
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

function detectType(category: string): 'flanges' | 'pipes' | 'fittings' {
  if (category.startsWith('FLANGES')) return 'flanges';
  if (category.startsWith('PIPES_')) return 'pipes';
  return 'fittings';
}

function generateCode(
  familyCode: string,
  variant: Record<string, unknown>,
  type: 'flanges' | 'pipes' | 'fittings'
): string {
  const nps = normalizeNPS(String(variant.nps || ''));
  switch (type) {
    case 'flanges': {
      const pc = String(variant.pressureClass || '').replace('#', '');
      return `${familyCode}-${nps}-${pc}`;
    }
    case 'pipes': {
      const sch = String(variant.schedule || '');
      return `${familyCode}-${nps}-SCH${sch}`;
    }
    case 'fittings': {
      const ft = abbreviateFittingType(String(variant.type || ''));
      return `${familyCode}-${ft}-${nps}`;
    }
  }
}

function generateName(
  parentName: string,
  variant: Record<string, unknown>,
  type: 'flanges' | 'pipes' | 'fittings'
): string {
  switch (type) {
    case 'flanges':
      return `${parentName} NPS ${variant.nps} ${variant.pressureClass}`;
    case 'pipes':
      return `${parentName} NPS ${variant.nps} Sch ${variant.schedule}`;
    case 'fittings':
      return `${variant.type} ${parentName.replace(/Butt-Weld Fittings /i, '')} NPS ${variant.nps}`;
  }
}

function mapVariantFields(
  variant: Record<string, unknown>,
  type: 'flanges' | 'pipes' | 'fittings'
): Record<string, unknown> {
  switch (type) {
    case 'flanges':
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
        ...(variant.outsideDiameter_inch !== undefined && {
          outsideDiameter_inch: variant.outsideDiameter_inch,
        }),
        ...(variant.thickness_inch !== undefined && { thickness_inch: variant.thickness_inch }),
        ...(variant.boltCircle_inch !== undefined && { boltCircle_inch: variant.boltCircle_inch }),
      };
    case 'pipes':
      return {
        nps: variant.nps,
        dn: variant.dn,
        schedule: variant.schedule,
        outsideDiameter_mm: variant.od_mm,
        wallThickness_mm: variant.wt_mm,
        weightPerMeter_kg: variant.weight_kgm,
        ...(variant.od_inch !== undefined && { outsideDiameter_inch: variant.od_inch }),
        ...(variant.wt_inch !== undefined && { wallThickness_inch: variant.wt_inch }),
        ...(variant.scheduleType !== undefined && { scheduleType: variant.scheduleType }),
      };
    case 'fittings':
      return {
        nps: variant.nps,
        dn: variant.dn,
        fittingType: variant.type,
        outsideDiameter_mm: variant.outsideDiameter_mm,
        centerToEnd_mm: variant.centerToEnd_mm,
        ...(variant.applicableSchedules !== undefined && {
          applicableSchedules: variant.applicableSchedules,
        }),
        ...(variant.outsideDiameter_inch !== undefined && {
          outsideDiameter_inch: variant.outsideDiameter_inch,
        }),
        ...(variant.centerToEnd_inch !== undefined && {
          centerToEnd_inch: variant.centerToEnd_inch,
        }),
        ...(variant.weight_kg !== undefined && { weightPerPiece_kg: variant.weight_kg }),
      };
  }
}

interface MigrateResult {
  success: boolean;
  familiesMigrated: number;
  materialsCreated: number;
  familiesSkipped: number;
  errors: string[];
}

export const migratePipingMaterials = onCall<{ dryRun?: boolean }, Promise<MigrateResult>>(
  {
    region: 'us-central1',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const dryRun = request.data?.dryRun ?? false;
    const db = getFirestore();

    const result: MigrateResult = {
      success: false,
      familiesMigrated: 0,
      materialsCreated: 0,
      familiesSkipped: 0,
      errors: [],
    };

    try {
      // Find all parent materials with hasVariants=true
      const parentsSnapshot = await db
        .collection('materials')
        .where('hasVariants', '==', true)
        .get();

      logger.info(`Found ${parentsSnapshot.size} materials with hasVariants=true`);

      for (const parentDoc of parentsSnapshot.docs) {
        const parentData = parentDoc.data();
        const category = parentData.category as string;
        const familyCode = parentData.materialCode as string;

        // Skip non-piping categories (plates keep variants)
        if (!isPipingCategory(category)) {
          logger.info(`Skipping non-piping material: ${familyCode} (${category})`);
          continue;
        }

        // Skip already migrated
        if (parentData.isMigrated === true) {
          logger.info(`Skipping already-migrated material: ${familyCode}`);
          result.familiesSkipped++;
          continue;
        }

        // Check if flat docs already exist for this family
        const existingFlat = await db
          .collection('materials')
          .where('familyCode', '==', familyCode)
          .limit(1)
          .get();

        if (!existingFlat.empty) {
          logger.info(`Flat materials already exist for ${familyCode}. Skipping.`);
          result.familiesSkipped++;
          continue;
        }

        // Load subcollection variants
        const variantsSnapshot = await db
          .collection('materials')
          .doc(parentDoc.id)
          .collection('variants')
          .get();

        if (variantsSnapshot.empty) {
          logger.warn(`No variants found for ${familyCode}. Skipping.`);
          result.familiesSkipped++;
          continue;
        }

        const type = detectType(category);
        logger.info(
          `Migrating ${familyCode}: ${variantsSnapshot.size} variants -> flat docs (type: ${type})`
        );

        if (dryRun) {
          logger.info(
            `[DRY RUN] Would create ${variantsSnapshot.size} materials for ${familyCode}`
          );
          result.familiesMigrated++;
          result.materialsCreated += variantsSnapshot.size;
          continue;
        }

        // Create flat documents in batches
        const variantDocs = variantsSnapshot.docs;
        const batchSize = 500;

        for (let i = 0; i < variantDocs.length; i += batchSize) {
          const batch = db.batch();
          const batchDocs = variantDocs.slice(i, i + batchSize);

          for (const variantDoc of batchDocs) {
            const variantData = variantDoc.data();

            const materialCode = generateCode(familyCode, variantData, type);
            const name = generateName(parentData.name as string, variantData, type);
            const pipingFields = mapVariantFields(variantData, type);

            const materialDoc: Record<string, unknown> = {
              materialCode,
              name,
              description: parentData.description || '',
              category,
              materialType: parentData.materialType || 'BOUGHT_OUT_COMPONENT',
              baseUnit: parentData.baseUnit || 'piece',
              ...(parentData.specification && { specification: parentData.specification }),
              familyCode,
              ...pipingFields,
              hasVariants: false,
              isActive: true,
              isStandard: parentData.isStandard ?? true,
              trackInventory: false,
              tags: parentData.tags || [],
              preferredVendors: parentData.preferredVendors || [],
              priceHistory: [],
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            };

            const docRef = db.collection('materials').doc();
            batch.set(docRef, materialDoc);
            result.materialsCreated++;
          }

          await batch.commit();
        }

        // Mark parent as migrated
        await db.collection('materials').doc(parentDoc.id).update({
          isMigrated: true,
          updatedAt: FieldValue.serverTimestamp(),
        });

        result.familiesMigrated++;
        logger.info(`Migrated ${familyCode}: created ${variantDocs.length} flat materials`);
      }

      result.success = true;
      logger.info('Migration completed', result);
      return result;
    } catch (error) {
      logger.error('Migration failed', error);
      result.errors.push(error instanceof Error ? error.message : String(error));
      throw new HttpsError(
        'internal',
        `Migration failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
);
