#!/usr/bin/env node

/**
 * Direct Firestore seeder using firebase-admin SDK with service account key.
 *
 * Usage:
 *   node scripts/seed-materials-direct.js [dataType] [--delete-existing]
 *
 * dataType: pipes | fittings | flanges | plates | all (default: all)
 *
 * Examples:
 *   node scripts/seed-materials-direct.js all
 *   node scripts/seed-materials-direct.js flanges --delete-existing
 *   node scripts/seed-materials-direct.js pipes
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SERVICE_ACCOUNT_PATH = path.join(
  __dirname,
  '..',
  'mcp-servers',
  'firebase-feedback',
  'service-account-key.json'
);

const SEED_DATA_DIR = path.join(__dirname, 'seed-data');

const SEED_FILE_REGISTRY = {
  pipes: [
    'pipes-carbon-steel.json',
    'pipes-duplex-2205.json',
    'pipes-super-duplex-2507.json',
    'pipes-stainless-304l.json',
    'pipes-stainless-316l.json',
  ],
  fittings: ['fittings-butt-weld.json', 'fittings-butt-weld-ss.json'],
  flanges: [
    'flanges-weld-neck-cs.json',
    'flanges-weld-neck-ss.json',
    'flanges-slip-on-cs.json',
    'flanges-slip-on-ss.json',
    'flanges-blind-cs.json',
    'flanges-blind-ss.json',
  ],
  plates: ['plates-common.json'],
};

// ---------------------------------------------------------------------------
// Init Firebase Admin
// ---------------------------------------------------------------------------

const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ---------------------------------------------------------------------------
// Code generators (mirrored from seedMaterials.ts)
// ---------------------------------------------------------------------------

function normalizeNPS(nps) {
  const map = {
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
  return map[nps] || nps;
}

function generateFlangeCode(baseMaterial, variant) {
  const nps = normalizeNPS(String(variant.nps || ''));
  const pressureClass = String(variant.pressureClass || '').replace('#', '');
  return `${baseMaterial.materialCode}-${nps}-${pressureClass}`;
}

function generatePipeCode(baseMaterial, variant) {
  const nps = normalizeNPS(String(variant.nps || ''));
  const schedule = String(variant.schedule || '');
  return `${baseMaterial.materialCode}-${nps}-SCH${schedule}`;
}

function abbreviateFittingType(fittingType) {
  const map = {
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

function generateFittingCode(baseMaterial, variant) {
  const fittingType = abbreviateFittingType(String(variant.type || ''));
  const nps = normalizeNPS(String(variant.nps || ''));
  return `${baseMaterial.materialCode}-${fittingType}-${nps}`;
}

function generateFlatMaterialName(baseMaterial, variant, type) {
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

// ---------------------------------------------------------------------------
// Field mappers
// ---------------------------------------------------------------------------

function mapFlangeFields(v) {
  return {
    nps: v.nps,
    dn: v.dn,
    pressureClass: v.pressureClass,
    outsideDiameter_mm: v.outsideDiameter_mm,
    thickness_mm: v.thickness_mm,
    boltCircle_mm: v.boltCircle_mm,
    boltHoles: v.boltHoles,
    boltSize_inch: v.boltSize_inch,
    raisedFace_mm: v.raisedFace_mm,
    weightPerPiece_kg: v.weight_kg,
    ...(v.outsideDiameter_inch !== undefined && { outsideDiameter_inch: v.outsideDiameter_inch }),
    ...(v.thickness_inch !== undefined && { thickness_inch: v.thickness_inch }),
    ...(v.boltCircle_inch !== undefined && { boltCircle_inch: v.boltCircle_inch }),
    ...(v.raisedFace_inch !== undefined && { raisedFace_inch: v.raisedFace_inch }),
  };
}

function mapPipeFields(v) {
  return {
    nps: v.nps,
    dn: v.dn,
    schedule: v.schedule,
    outsideDiameter_mm: v.od_mm,
    wallThickness_mm: v.wt_mm,
    weightPerMeter_kg: v.weight_kgm,
    ...(v.od_inch !== undefined && { outsideDiameter_inch: v.od_inch }),
    ...(v.wt_inch !== undefined && { wallThickness_inch: v.wt_inch }),
    ...(v.weight_lbft !== undefined && { weight_lbft: v.weight_lbft }),
    ...(v.scheduleType !== undefined && { scheduleType: v.scheduleType }),
  };
}

function mapFittingFields(v) {
  const fields = {
    nps: v.nps,
    dn: v.dn,
    fittingType: v.type,
    ...(v.applicableSchedules !== undefined && { applicableSchedules: v.applicableSchedules }),
    ...(v.weight_kg !== undefined && { weightPerPiece_kg: v.weight_kg }),
  };

  // Elbows, tees, caps have outsideDiameter + centerToEnd
  if (v.outsideDiameter_mm !== undefined) {
    fields.outsideDiameter_mm = v.outsideDiameter_mm;
    if (v.outsideDiameter_inch !== undefined) fields.outsideDiameter_inch = v.outsideDiameter_inch;
  }
  if (v.centerToEnd_mm !== undefined) {
    fields.centerToEnd_mm = v.centerToEnd_mm;
    if (v.centerToEnd_inch !== undefined) fields.centerToEnd_inch = v.centerToEnd_inch;
  }

  // Reducers have largeEnd/smallEnd + endToEnd instead
  if (v.largeEnd_mm !== undefined) {
    fields.largeEnd_mm = v.largeEnd_mm;
    if (v.largeEnd_inch !== undefined) fields.largeEnd_inch = v.largeEnd_inch;
  }
  if (v.smallEnd_mm !== undefined) {
    fields.smallEnd_mm = v.smallEnd_mm;
    if (v.smallEnd_inch !== undefined) fields.smallEnd_inch = v.smallEnd_inch;
  }
  if (v.endToEnd_mm !== undefined) {
    fields.endToEnd_mm = v.endToEnd_mm;
    if (v.endToEnd_inch !== undefined) fields.endToEnd_inch = v.endToEnd_inch;
  }

  return fields;
}

// ---------------------------------------------------------------------------
// Load seed files
// ---------------------------------------------------------------------------

function loadSeedFile(fileName) {
  const filePath = path.join(SEED_DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    console.log(`  SKIP: ${fileName} (not found)`);
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadAllForType(dataType) {
  const files = SEED_FILE_REGISTRY[dataType] || [];
  const results = [];
  for (const fileName of files) {
    const data = loadSeedFile(fileName);
    if (data) results.push({ fileName, data });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Seed plates (variant model)
// ---------------------------------------------------------------------------

async function seedPlates(deleteExisting) {
  const files = loadAllForType('plates');
  let created = 0;

  for (const { fileName, data: platesData } of files) {
    console.log(`\n  Processing: ${fileName}`);

    for (const materialData of platesData.materials) {
      const existing = await db
        .collection('materials')
        .where('materialCode', '==', materialData.materialCode)
        .limit(1)
        .get();

      if (!existing.empty) {
        if (deleteExisting) {
          await db
            .collection('materials')
            .doc(existing.docs[0].id)
            .update({
              ...materialData,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          console.log(`    Updated: ${materialData.materialCode}`);
        } else {
          console.log(`    EXISTS: ${materialData.materialCode} (skipping)`);
          continue;
        }
      } else {
        await db.collection('materials').add({
          ...materialData,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        created++;
        console.log(`    Created: ${materialData.materialCode}`);
      }
    }
  }

  return created;
}

// ---------------------------------------------------------------------------
// Seed flat piping materials (pipes, fittings, flanges)
// ---------------------------------------------------------------------------

async function seedFlat(type, deleteExisting) {
  const files = loadAllForType(type);
  let totalCreated = 0;

  for (const { fileName, data: seedData } of files) {
    console.log(`\n  Processing: ${fileName}`);

    const { metadata, material: baseMaterial, variants } = seedData;
    const familyCode = baseMaterial.materialCode;

    // Check / delete existing
    if (deleteExisting) {
      const existingDocs = await db
        .collection('materials')
        .where('familyCode', '==', familyCode)
        .get();

      if (!existingDocs.empty) {
        const batchSize = 500;
        for (let i = 0; i < existingDocs.docs.length; i += batchSize) {
          const batch = db.batch();
          existingDocs.docs.slice(i, i + batchSize).forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
        console.log(`    Deleted ${existingDocs.size} existing docs for ${familyCode}`);
      }

      // Mark old parent as migrated
      const oldParent = await db
        .collection('materials')
        .where('materialCode', '==', familyCode)
        .limit(1)
        .get();
      if (!oldParent.empty) {
        await db.collection('materials').doc(oldParent.docs[0].id).update({
          isMigrated: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`    Marked old parent ${familyCode} as migrated`);
      }
    } else {
      const existingFlat = await db
        .collection('materials')
        .where('familyCode', '==', familyCode)
        .limit(1)
        .get();

      if (!existingFlat.empty) {
        console.log(`    EXISTS: family ${familyCode} (use --delete-existing to overwrite)`);
        continue;
      }
    }

    // Create flat documents in batches
    let materialsCreated = 0;
    const batchSize = 500;

    for (let i = 0; i < variants.length; i += batchSize) {
      const batch = db.batch();
      const batchVariants = variants.slice(i, i + batchSize);

      for (const variant of batchVariants) {
        let materialCode;
        let pipingFields;

        switch (type) {
          case 'flanges':
            materialCode = generateFlangeCode(baseMaterial, variant);
            pipingFields = mapFlangeFields(variant);
            break;
          case 'pipes':
            materialCode = generatePipeCode(baseMaterial, variant);
            pipingFields = mapPipeFields(variant);
            break;
          case 'fittings':
            materialCode = generateFittingCode(baseMaterial, variant);
            pipingFields = mapFittingFields(variant);
            break;
        }

        const materialDoc = {
          materialCode,
          name: generateFlatMaterialName(baseMaterial, variant, type),
          description: baseMaterial.description || metadata.description || '',
          category: baseMaterial.category,
          materialType: baseMaterial.materialType || 'BOUGHT_OUT_COMPONENT',
          baseUnit: baseMaterial.baseUnit,
          ...(baseMaterial.specification && { specification: baseMaterial.specification }),
          familyCode,
          ...pipingFields,
          seedMetadata: {
            standard: metadata.standard,
            specification: metadata.specification,
          },
          hasVariants: false,
          isActive: true,
          isStandard: baseMaterial.isStandard !== false,
          trackInventory: false,
          tags: baseMaterial.tags || [type],
          preferredVendors: [],
          priceHistory: [],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        const docRef = db.collection('materials').doc();
        batch.set(docRef, materialDoc);
        materialsCreated++;
      }

      await batch.commit();
    }

    totalCreated += materialsCreated;
    console.log(`    Created ${materialsCreated} materials (family: ${familyCode})`);
  }

  return totalCreated;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const dataType = process.argv[2] || 'all';
  const deleteExisting = process.argv.includes('--delete-existing');

  const validTypes = ['pipes', 'fittings', 'flanges', 'plates', 'all'];
  if (!validTypes.includes(dataType)) {
    console.error(`Invalid dataType: ${dataType}. Must be one of: ${validTypes.join(', ')}`);
    process.exit(1);
  }

  console.log(`\nSeed Materials (Direct Admin SDK)`);
  console.log(`  Project:         ${serviceAccount.project_id}`);
  console.log(`  Data type:       ${dataType}`);
  console.log(`  Delete existing: ${deleteExisting}`);
  console.log(`  Seed data dir:   ${SEED_DATA_DIR}`);

  const results = { pipes: 0, fittings: 0, flanges: 0, plates: 0 };

  // Plates
  if (dataType === 'plates' || dataType === 'all') {
    console.log('\n--- Plates (variant model) ---');
    results.plates = await seedPlates(deleteExisting);
  }

  // Flat piping types
  for (const flatType of ['pipes', 'fittings', 'flanges']) {
    if (dataType === flatType || dataType === 'all') {
      console.log(`\n--- ${flatType.charAt(0).toUpperCase() + flatType.slice(1)} (flat model) ---`);
      results[flatType] = await seedFlat(flatType, deleteExisting);
    }
  }

  const total = Object.values(results).reduce((a, b) => a + b, 0);

  console.log('\n========================================');
  console.log('Results:');
  if (results.plates) console.log(`  Plates:   ${results.plates}`);
  if (results.pipes) console.log(`  Pipes:    ${results.pipes}`);
  if (results.fittings) console.log(`  Fittings: ${results.fittings}`);
  if (results.flanges) console.log(`  Flanges:  ${results.flanges}`);
  console.log(`  TOTAL:    ${total} materials created`);
  console.log('========================================\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
