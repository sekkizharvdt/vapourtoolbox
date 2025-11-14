/**
 * Material Database Cloud Functions
 *
 * Provides server-side functions for Material Database operations including
 * catalog seeding with standard carbon steel materials.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import {
  generateStainlessSteelPlates,
  generateStainlessSeamlessPipes,
} from './materials_stainless';

const db = getFirestore();

// Collection name constant
const MATERIALS_COLLECTION = 'materials';

// Type definitions
type MaterialCategory =
  | 'PLATES_CARBON_STEEL'
  | 'PLATES_STAINLESS_STEEL'
  | 'PIPES_SEAMLESS'
  | 'PIPES_WELDED'
  | 'PIPES_STAINLESS';

type MaterialType = 'RAW_MATERIAL' | 'CONSUMABLE' | 'COMPONENT';

// ============================================================================
// Material Catalog Seeding
// ============================================================================

/**
 * Seed Material Database with standard carbon steel catalog
 *
 * Creates ~140-150 materials including:
 * - Carbon Steel Plates (SA 516 Gr 70, SA 36)
 * - Seamless Pipes (ASTM A106 Gr B) with full schedule matrix
 * - Welded Pipes (ASTM A53 Gr B) with full schedule matrix
 *
 * Includes density, mechanical properties, and temperature ratings.
 *
 * @security Super-admin only (all 27 permission bits required)
 * @rateLimit Once per 24 hours
 */
export const seedMaterialsCatalog = onCall(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 540,
  },
  async (request) => {
    const { auth } = request;

    // Security Check: Require authentication
    if (!auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Security Check: Require super-admin (all 27 bits = 134,217,727)
    const requiredPermissions = 134217727; // All permission bits
    const userPermissions = auth.token.permissions || 0;

    if (userPermissions !== requiredPermissions) {
      logger.warn('Unauthorized material catalog seed attempt', {
        userId: auth.uid,
        userPermissions,
        requiredPermissions,
      });
      throw new HttpsError(
        'permission-denied',
        'Super-admin permissions required to seed material catalog'
      );
    }

    // Rate Limiting Check
    const rateLimitRef = db.collection('_system').doc('materialSeedingRateLimit');
    const rateLimitDoc = await rateLimitRef.get();

    if (rateLimitDoc.exists) {
      const lastSeeded = rateLimitDoc.data()?.lastSeededAt;
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

      if (lastSeeded && lastSeeded.toMillis() > oneDayAgo) {
        throw new HttpsError(
          'resource-exhausted',
          'Material catalog can only be seeded once per 24 hours'
        );
      }
    }

    try {
      logger.info('Starting material catalog seeding', { userId: auth.uid });

      // Check for existing materials
      const existingSnapshot = await db.collection(MATERIALS_COLLECTION).limit(1).get();
      if (!existingSnapshot.empty) {
        logger.warn('Materials collection already has data', { userId: auth.uid });
        throw new HttpsError(
          'failed-precondition',
          'Materials collection already contains data. Clear existing materials before seeding.'
        );
      }

      const materials = [];
      let materialCode = 1;

      // Helper function to generate material code
      const getNextCode = () => {
        const code = `MAT-2025-${String(materialCode).padStart(4, '0')}`;
        materialCode++;
        return code;
      };

      // ============================================
      // Carbon Steel Plates
      // ============================================

      const carbonSteelPlates = generateCarbonSteelPlates(getNextCode);
      materials.push(...carbonSteelPlates);

      // ============================================
      // Stainless Steel Plates
      // ============================================

      const stainlessSteelPlates = generateStainlessSteelPlates(getNextCode);
      materials.push(...stainlessSteelPlates);

      // ============================================
      // Seamless Pipes - ASTM A106 Gr B
      // ============================================

      const seamlessPipes = generateSeamlessPipes(getNextCode);
      materials.push(...seamlessPipes);

      // ============================================
      // Welded Pipes - ASTM A53 Gr B
      // ============================================

      const weldedPipes = generateWeldedPipes(getNextCode);
      materials.push(...weldedPipes);

      // ============================================
      // Stainless Steel Seamless Pipes
      // ============================================

      const stainlessSeamlessPipes = generateStainlessSeamlessPipes(getNextCode);
      materials.push(...stainlessSeamlessPipes);

      // ============================================
      // Batch Write to Firestore
      // ============================================

      const batch = db.batch();
      const timestamp = FieldValue.serverTimestamp();

      materials.forEach((material) => {
        const docRef = db.collection(MATERIALS_COLLECTION).doc();
        batch.set(docRef, {
          ...material,
          createdAt: timestamp,
          updatedAt: timestamp,
          createdBy: 'system',
          updatedBy: 'system',
        });
      });

      await batch.commit();

      // Update rate limit
      await rateLimitRef.set({
        lastSeededAt: FieldValue.serverTimestamp(),
        lastSeededBy: auth.uid,
      });

      const stats = {
        carbonSteelPlates: carbonSteelPlates.length,
        stainlessSteelPlates: stainlessSteelPlates.length,
        carbonSeamlessPipes: seamlessPipes.length,
        carbonWeldedPipes: weldedPipes.length,
        stainlessSeamlessPipes: stainlessSeamlessPipes.length,
        total: materials.length,
      };

      logger.info('Material catalog seeding completed', { stats, userId: auth.uid });

      return {
        success: true,
        message: `Successfully seeded ${materials.length} materials`,
        stats,
      };
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error('Failed to seed material catalog', { error, userId: auth.uid });
      throw new HttpsError(
        'internal',
        `Failed to seed material catalog: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);

// ============================================================================
// Material Generation Functions
// ============================================================================

/**
 * Generate carbon steel plate materials
 * - SA 516 Gr 70 (pressure vessel quality)
 * - SA 36 (structural steel)
 */
function generateCarbonSteelPlates(getNextCode: () => string) {
  const plates = [];
  const thicknesses = [6, 8, 10, 12, 16, 20, 25, 30, 40, 50]; // mm

  // SA 516 Gr 70 Plates
  for (const thickness of thicknesses) {
    plates.push({
      materialCode: getNextCode(),
      name: `SA 516 Gr 70 Carbon Steel Plate - ${thickness}mm`,
      description: `ASME SA 516 Grade 70 carbon steel plate for moderate and lower temperature pressure vessel service. Thickness: ${thickness}mm. Suitable for welded pressure vessels where notch toughness is important.`,
      category: 'PLATES_CARBON_STEEL' as MaterialCategory,
      materialType: 'RAW_MATERIAL' as MaterialType,
      specification: {
        standard: 'ASME SA-516',
        grade: 'Gr 70',
        finish: 'Hot Rolled',
        form: 'Plate',
        nominalSize: `${thickness}mm`,
      },
      properties: {
        density: 7850,
        densityUnit: 'kg/m3' as 'kg/m3',
        tensileStrength: 485, // MPa (70 ksi)
        yieldStrength: 260, // MPa (38 ksi)
        maxOperatingTemp: 450, // °C
      },
      baseUnit: 'kg',
      tags: ['carbon-steel', 'pressure-vessel', 'ASME', 'ASTM', 'plate', 'sa516'],
      isStandard: true,
      isActive: true,
      trackInventory: false,
      preferredVendors: [],
      priceHistory: [],
      certifications: ['ASME', 'PED', 'IBR'],
    });
  }

  // SA 36 Plates
  for (const thickness of thicknesses) {
    plates.push({
      materialCode: getNextCode(),
      name: `SA 36 Carbon Steel Plate - ${thickness}mm`,
      description: `ASTM A36 carbon structural steel plate. Thickness: ${thickness}mm. General construction and structural applications. Good weldability and machinability.`,
      category: 'PLATES_CARBON_STEEL' as MaterialCategory,
      materialType: 'RAW_MATERIAL' as MaterialType,
      specification: {
        standard: 'ASTM A36',
        grade: 'A36',
        finish: 'Hot Rolled',
        form: 'Plate',
        nominalSize: `${thickness}mm`,
      },
      properties: {
        density: 7850,
        densityUnit: 'kg/m3' as 'kg/m3',
        tensileStrength: 400, // MPa (58 ksi)
        yieldStrength: 250, // MPa (36 ksi)
        maxOperatingTemp: 350, // °C
      },
      baseUnit: 'kg',
      tags: ['carbon-steel', 'structural', 'ASTM', 'plate', 'a36'],
      isStandard: false,
      isActive: true,
      trackInventory: false,
      preferredVendors: [],
      priceHistory: [],
      certifications: ['ASTM'],
    });
  }

  return plates;
}

/**
 * Generate seamless carbon steel pipes
 * ASTM A106 Gr B with full schedule matrix
 */
function generateSeamlessPipes(getNextCode: () => string) {
  const pipes = [];

  // Pipe sizes (DN) with corresponding NPS
  const pipeSizes = [
    { dn: 15, nps: '1/2' },
    { dn: 20, nps: '3/4' },
    { dn: 25, nps: '1' },
    { dn: 32, nps: '1-1/4' },
    { dn: 40, nps: '1-1/2' },
    { dn: 50, nps: '2' },
    { dn: 65, nps: '2-1/2' },
    { dn: 80, nps: '3' },
    { dn: 100, nps: '4' },
    { dn: 125, nps: '5' },
    { dn: 150, nps: '6' },
    { dn: 200, nps: '8' },
    { dn: 250, nps: '10' },
    { dn: 300, nps: '12' },
    { dn: 400, nps: '16' },
    { dn: 500, nps: '20' },
    { dn: 600, nps: '24' },
  ];

  const schedules = ['10', '20', '40', '80', '160', 'XXS'];

  for (const { dn, nps } of pipeSizes) {
    for (const schedule of schedules) {
      pipes.push({
        materialCode: getNextCode(),
        name: `ASTM A106 Gr B Seamless Pipe - DN ${dn} (NPS ${nps}) Sch ${schedule}`,
        description: `ASTM A106 Grade B seamless carbon steel pipe for high-temperature service. Size: DN ${dn} (NPS ${nps}), Schedule ${schedule}. Suitable for pressure piping systems in refineries, power plants, and petrochemical facilities.`,
        category: 'PIPES_SEAMLESS' as MaterialCategory,
        materialType: 'RAW_MATERIAL' as MaterialType,
        specification: {
          standard: 'ASTM A106',
          grade: 'Gr B',
          finish: 'Black',
          form: 'Seamless Pipe',
          schedule: `Sch ${schedule}`,
          nominalSize: `DN ${dn} (NPS ${nps})`,
        },
        properties: {
          density: 7850,
          densityUnit: 'kg/m3' as 'kg/m3',
          tensileStrength: 415, // MPa (60 ksi)
          yieldStrength: 240, // MPa (35 ksi)
          maxOperatingTemp: 400, // °C
        },
        baseUnit: 'meter',
        tags: [
          'carbon-steel',
          'piping',
          'seamless',
          'ASTM',
          'a106',
          'high-temp',
          `dn${dn}`,
          `sch${schedule}`,
        ],
        isStandard: schedule === '40', // Mark Sch 40 as standard
        isActive: true,
        trackInventory: false,
        preferredVendors: [],
        priceHistory: [],
        certifications: ['ASTM', 'ASME B31.1', 'ASME B31.3'],
      });
    }
  }

  return pipes;
}

/**
 * Generate welded carbon steel pipes
 * ASTM A53 Gr B with full schedule matrix
 */
function generateWeldedPipes(getNextCode: () => string) {
  const pipes = [];

  // Same pipe sizes as seamless
  const pipeSizes = [
    { dn: 15, nps: '1/2' },
    { dn: 20, nps: '3/4' },
    { dn: 25, nps: '1' },
    { dn: 32, nps: '1-1/4' },
    { dn: 40, nps: '1-1/2' },
    { dn: 50, nps: '2' },
    { dn: 65, nps: '2-1/2' },
    { dn: 80, nps: '3' },
    { dn: 100, nps: '4' },
    { dn: 125, nps: '5' },
    { dn: 150, nps: '6' },
    { dn: 200, nps: '8' },
    { dn: 250, nps: '10' },
    { dn: 300, nps: '12' },
    { dn: 400, nps: '16' },
    { dn: 500, nps: '20' },
    { dn: 600, nps: '24' },
  ];

  const schedules = ['10', '20', '40', '80', '160', 'XXS'];

  for (const { dn, nps } of pipeSizes) {
    for (const schedule of schedules) {
      pipes.push({
        materialCode: getNextCode(),
        name: `ASTM A53 Gr B Welded Pipe - DN ${dn} (NPS ${nps}) Sch ${schedule}`,
        description: `ASTM A53 Grade B welded (ERW) carbon steel pipe for mechanical and pressure applications. Size: DN ${dn} (NPS ${nps}), Schedule ${schedule}. Cost-effective alternative to seamless pipe for moderate pressure/temperature service.`,
        category: 'PIPES_WELDED' as MaterialCategory,
        materialType: 'RAW_MATERIAL' as MaterialType,
        specification: {
          standard: 'ASTM A53',
          grade: 'Gr B',
          finish: 'Black',
          form: 'ERW Pipe',
          schedule: `Sch ${schedule}`,
          nominalSize: `DN ${dn} (NPS ${nps})`,
        },
        properties: {
          density: 7850,
          densityUnit: 'kg/m3' as 'kg/m3',
          tensileStrength: 415, // MPa (60 ksi)
          yieldStrength: 240, // MPa (35 ksi)
          maxOperatingTemp: 350, // °C (lower than seamless)
        },
        baseUnit: 'meter',
        tags: [
          'carbon-steel',
          'piping',
          'welded',
          'ERW',
          'ASTM',
          'a53',
          `dn${dn}`,
          `sch${schedule}`,
        ],
        isStandard: schedule === '40', // Mark Sch 40 as standard
        isActive: true,
        trackInventory: false,
        preferredVendors: [],
        priceHistory: [],
        certifications: ['ASTM', 'ASME B31.1', 'ASME B31.3'],
      });
    }
  }

  return pipes;
}
