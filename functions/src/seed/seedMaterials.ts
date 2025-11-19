import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';

// Import seed data from the copied location in lib/seed-data
// The build-postprocess.js script copies these files from scripts/seed-data to lib/seed-data
import pipesData from '../../seed-data/pipes-carbon-steel.json';
import fittingsData from '../../seed-data/fittings-butt-weld.json';
import flangesData from '../../seed-data/flanges-weld-neck.json';

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
}

interface SeedData {
  metadata: SeedDataMetadata;
  material: MaterialDefinition;
  variants: Record<string, unknown>[];
}

interface SeedMaterialsRequest {
  dataType: 'pipes' | 'fittings' | 'flanges' | 'all';
  deleteExisting?: boolean;
}

interface SeedMaterialsResult {
  success: boolean;
  materialsCreated: number;
  variantsCreated: number;
  details: {
    pipes?: { materialId: string; variants: number };
    fittings?: { materialId: string; variants: number };
    flanges?: { materialId: string; variants: number };
  };
}

/**
 * Seed materials data from JSON files into Firestore
 *
 * This function imports pipes, fittings, and flanges data based on ASME standards:
 * - ASME B36.10-2022 (Pipes)
 * - ASME B16.9-2024 (Fittings)
 * - ASME B16.5-2025 (Flanges)
 */
export const seedMaterials = onCall<SeedMaterialsRequest, Promise<SeedMaterialsResult>>(
  {
    region: 'asia-south1',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async (request) => {
    const { dataType, deleteExisting = false } = request.data;

    logger.info('Starting materials seed operation', { dataType, deleteExisting });

    // Check if user is authenticated (optional - remove if you want public access)
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
      // Determine which data to seed
      const dataSources: Array<{ type: 'pipes' | 'fittings' | 'flanges'; data: SeedData }> = [];

      if (dataType === 'pipes' || dataType === 'all') {
        dataSources.push({ type: 'pipes', data: pipesData as SeedData });
      }
      if (dataType === 'fittings' || dataType === 'all') {
        dataSources.push({ type: 'fittings', data: fittingsData as SeedData });
      }
      if (dataType === 'flanges' || dataType === 'all') {
        dataSources.push({ type: 'flanges', data: flangesData as SeedData });
      }

      // Process each data source
      for (const source of dataSources) {
        logger.info(`Processing ${source.type} data`);

        const { metadata, material, variants } = source.data;

        // Check if material already exists
        const existingMaterialQuery = await db
          .collection('materials')
          .where('materialCode', '==', material.materialCode)
          .limit(1)
          .get();

        let materialId: string;

        if (!existingMaterialQuery.empty) {
          materialId = existingMaterialQuery.docs[0].id;

          if (deleteExisting) {
            logger.info(`Deleting existing ${source.type} material and variants`, { materialId });

            // Delete existing variants
            const variantsSnapshot = await db
              .collection('materials')
              .doc(materialId)
              .collection('variants')
              .get();

            const batch = db.batch();
            variantsSnapshot.docs.forEach((doc) => {
              batch.delete(doc.ref);
            });
            await batch.commit();

            // Update material document
            await db
              .collection('materials')
              .doc(materialId)
              .update({
                ...material,
                metadata,
                updatedAt: FieldValue.serverTimestamp(),
              });

            logger.info(`Updated existing ${source.type} material`, { materialId });
          } else {
            logger.warn(
              `Material ${material.materialCode} already exists. Use deleteExisting=true to overwrite.`
            );
            continue;
          }
        } else {
          // Create new material document
          const materialDoc = await db.collection('materials').add({
            ...material,
            metadata,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });

          materialId = materialDoc.id;
          result.materialsCreated++;
          logger.info(`Created new ${source.type} material`, { materialId });
        }

        // Add variants
        const variantsCollection = db
          .collection('materials')
          .doc(materialId)
          .collection('variants');
        let variantCount = 0;

        // Batch write variants (Firestore allows max 500 operations per batch)
        const batchSize = 500;
        for (let i = 0; i < variants.length; i += batchSize) {
          const batch = db.batch();
          const batchVariants = variants.slice(i, i + batchSize);

          for (const variant of batchVariants) {
            const variantRef = variantsCollection.doc();
            batch.set(variantRef, {
              ...variant,
              createdAt: FieldValue.serverTimestamp(),
            });
            variantCount++;
          }

          await batch.commit();
          logger.info(`Created batch of ${batchVariants.length} variants for ${source.type}`);
        }

        result.variantsCreated += variantCount;
        result.details[source.type] = { materialId, variants: variantCount };

        logger.info(`Completed seeding ${source.type}`, {
          materialId,
          variantCount,
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
