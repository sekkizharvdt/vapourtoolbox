import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { getAuth } from 'firebase-admin/auth';
import * as path from 'path';
import * as fs from 'fs';

// Helper function to load seed data
function loadSeedData(dataType: 'pipes' | 'fittings' | 'flanges'): SeedData {
  const seedDataDir = path.join(__dirname, 'seed-data');
  const fileMap = {
    pipes: 'pipes-carbon-steel.json',
    fittings: 'fittings-butt-weld.json',
    flanges: 'flanges-weld-neck.json',
  };

  const filePath = path.join(seedDataDir, fileMap[dataType]);
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data) as SeedData;
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
 * Seed materials data - HTTPS endpoint with CORS
 */
export const seedMaterialsHttp = onRequest(
  {
    region: 'asia-south1',
    timeoutSeconds: 540,
    memory: '512MiB',
    cors: true, // Enable CORS
  },
  async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.status(204).send('');
      return;
    }

    // Set CORS headers for actual request
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    try {
      // Verify authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized - No token provided' });
        return;
      }

      const token = authHeader.split('Bearer ')[1];
      if (!token) {
        res.status(401).json({ error: 'Unauthorized - Invalid token format' });
        return;
      }

      try {
        await getAuth().verifyIdToken(token);
      } catch (error) {
        logger.error('Token verification failed', error);
        res.status(401).json({ error: 'Unauthorized - Invalid token' });
        return;
      }

      // Parse request body
      const { dataType, deleteExisting = false } = req.body as SeedMaterialsRequest;

      if (!dataType || !['pipes', 'fittings', 'flanges', 'all'].includes(dataType)) {
        res
          .status(400)
          .json({ error: 'Invalid dataType. Must be: pipes, fittings, flanges, or all' });
        return;
      }

      logger.info('Starting materials seed operation', { dataType, deleteExisting });

      const db = getFirestore();
      const result: SeedMaterialsResult = {
        success: false,
        materialsCreated: 0,
        variantsCreated: 0,
        details: {},
      };

      // Determine which data to seed
      const dataSources: Array<{ type: 'pipes' | 'fittings' | 'flanges'; data: SeedData }> = [];

      if (dataType === 'pipes' || dataType === 'all') {
        dataSources.push({ type: 'pipes', data: loadSeedData('pipes') });
      }
      if (dataType === 'fittings' || dataType === 'all') {
        dataSources.push({ type: 'fittings', data: loadSeedData('fittings') });
      }
      if (dataType === 'flanges' || dataType === 'all') {
        dataSources.push({ type: 'flanges', data: loadSeedData('flanges') });
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

      res.status(200).json(result);
    } catch (error) {
      logger.error('Error seeding materials', error);
      res.status(500).json({
        error: `Failed to seed materials: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
);
