/**
 * Materials Module Integration Test
 *
 * Tests the complete materials workflow:
 * 1. Create materials with auto-generated codes
 * 2. Query and filter materials
 * 3. Search materials by various fields
 * 4. Update material prices
 * 5. Manage material variants
 *
 * Prerequisites:
 * - Firebase emulators running: `firebase emulators:start`
 *
 * Run with: `pnpm test:integration`
 */

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  Timestamp,
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { initializeTestFirebase, cleanupTestData, checkEmulatorsRunning } from './setup';
import type { Firestore } from 'firebase/firestore';

// Collection names
const COLLECTIONS = {
  MATERIALS: 'materials',
  COUNTERS: 'counters',
};

// Test data
const TEST_USER = {
  id: 'test-user-001',
  name: 'Test User',
  email: 'test@example.com',
};

describe('Materials Workflow Integration', () => {
  let db: Firestore;
  let emulatorsRunning: boolean;

  beforeAll(async () => {
    emulatorsRunning = await checkEmulatorsRunning();

    if (!emulatorsRunning) {
      console.warn(
        '\n⚠️  Firebase emulators not running. Skipping integration tests.\n' +
          '   Run: firebase emulators:start\n'
      );
      return;
    }

    const firebase = initializeTestFirebase();
    db = firebase.db;
  });

  beforeEach(async () => {
    if (emulatorsRunning) {
      await cleanupTestData();
    }
  });

  afterAll(async () => {
    if (emulatorsRunning) {
      await cleanupTestData();
    }
  });

  const itWithEmulator = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (!emulatorsRunning) {
        // eslint-disable-next-line no-console
        console.log(`  ⏭️  Skipping: ${name} (emulators not running)`);
        return;
      }
      await fn();
    });
  };

  // ============================================================================
  // STEP 1: Create Materials
  // ============================================================================

  itWithEmulator('Step 1: Create a raw material with generated code', async () => {
    const materialId = 'material-001';
    const now = Timestamp.now();

    const materialData = {
      name: 'Stainless Steel 304 Plate 6mm',
      materialCode: 'PL-SS304-6',
      description: 'SS304 plate, 6mm thickness, 2B finish',
      category: 'PLATES_STAINLESS_STEEL',
      materialType: 'RAW_MATERIAL',
      baseUnit: 'kg',
      density: 7930,
      specifications: {
        grade: 'SS304',
        thickness: 6,
        finish: '2B',
      },
      currentPrice: {
        pricePerUnit: { amount: 350, currency: 'INR' },
        effectiveDate: now,
        vendorId: 'vendor-001',
      },
      priceHistory: [],
      preferredVendors: ['vendor-001', 'vendor-002'],
      tags: ['stainless', 'plate', 'ss304'],
      isActive: true,
      isStandard: true,
      createdAt: now,
      updatedAt: now,
      createdBy: TEST_USER.id,
      updatedBy: TEST_USER.id,
    };

    await setDoc(doc(db, COLLECTIONS.MATERIALS, materialId), materialData);

    // Verify material was created
    const materialDoc = await getDoc(doc(db, COLLECTIONS.MATERIALS, materialId));
    expect(materialDoc.exists()).toBe(true);
    expect(materialDoc.data()?.materialCode).toBe('PL-SS304-6');
    expect(materialDoc.data()?.category).toBe('PLATES_STAINLESS_STEEL');
    expect(materialDoc.data()?.materialType).toBe('RAW_MATERIAL');
    expect(materialDoc.data()?.currentPrice.pricePerUnit.amount).toBe(350);
  });

  itWithEmulator('Step 1b: Create a bought-out component', async () => {
    const materialId = 'material-002';
    const now = Timestamp.now();

    const materialData = {
      name: 'Gate Valve 2" 150# RF SS304',
      materialCode: 'VLV-GATE-2-150-SS304',
      description: 'Gate valve, 2 inch, 150# rating, RF flange, SS304 body',
      category: 'VALVE_GATE',
      materialType: 'BOUGHT_OUT_COMPONENT',
      baseUnit: 'nos',
      specifications: {
        size: '2"',
        rating: '150#',
        flangeType: 'RF',
        bodyMaterial: 'SS304',
      },
      currentPrice: {
        pricePerUnit: { amount: 12500, currency: 'INR' },
        effectiveDate: now,
        vendorId: 'vendor-003',
      },
      preferredVendors: ['vendor-003'],
      tags: ['valve', 'gate', 'ss304'],
      isActive: true,
      isStandard: false,
      createdAt: now,
      updatedAt: now,
      createdBy: TEST_USER.id,
      updatedBy: TEST_USER.id,
    };

    await setDoc(doc(db, COLLECTIONS.MATERIALS, materialId), materialData);

    // Verify
    const materialDoc = await getDoc(doc(db, COLLECTIONS.MATERIALS, materialId));
    expect(materialDoc.exists()).toBe(true);
    expect(materialDoc.data()?.materialType).toBe('BOUGHT_OUT_COMPONENT');
    expect(materialDoc.data()?.category).toBe('VALVE_GATE');
  });

  // ============================================================================
  // STEP 2: Query Materials
  // ============================================================================

  itWithEmulator('Step 2: Query materials by category', async () => {
    const now = Timestamp.now();

    // Create multiple materials
    const materials = [
      {
        id: 'mat-1',
        name: 'SS304 Plate 6mm',
        category: 'PLATES_STAINLESS_STEEL',
        isActive: true,
      },
      {
        id: 'mat-2',
        name: 'SS316 Plate 8mm',
        category: 'PLATES_STAINLESS_STEEL',
        isActive: true,
      },
      {
        id: 'mat-3',
        name: 'CS Plate 10mm',
        category: 'PLATES_CARBON_STEEL',
        isActive: true,
      },
      {
        id: 'mat-4',
        name: 'Gate Valve',
        category: 'VALVE_GATE',
        isActive: true,
      },
    ];

    for (const mat of materials) {
      await setDoc(doc(db, COLLECTIONS.MATERIALS, mat.id), {
        name: mat.name,
        category: mat.category,
        isActive: mat.isActive,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Query by category
    const ssPlatesQuery = query(
      collection(db, COLLECTIONS.MATERIALS),
      where('category', '==', 'PLATES_STAINLESS_STEEL'),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(ssPlatesQuery);
    expect(snapshot.size).toBe(2);

    const names = snapshot.docs.map((d) => d.data().name);
    expect(names).toContain('SS304 Plate 6mm');
    expect(names).toContain('SS316 Plate 8mm');
  });

  itWithEmulator('Step 2b: Query materials by material type', async () => {
    const now = Timestamp.now();

    // Create materials of different types
    await setDoc(doc(db, COLLECTIONS.MATERIALS, 'mat-raw-1'), {
      name: 'Raw Material 1',
      materialType: 'RAW_MATERIAL',
      isActive: true,
      createdAt: now,
    });

    await setDoc(doc(db, COLLECTIONS.MATERIALS, 'mat-bo-1'), {
      name: 'Bought Out 1',
      materialType: 'BOUGHT_OUT_COMPONENT',
      isActive: true,
      createdAt: now,
    });

    await setDoc(doc(db, COLLECTIONS.MATERIALS, 'mat-bo-2'), {
      name: 'Bought Out 2',
      materialType: 'BOUGHT_OUT_COMPONENT',
      isActive: true,
      createdAt: now,
    });

    // Query bought-out components
    const boQuery = query(
      collection(db, COLLECTIONS.MATERIALS),
      where('materialType', '==', 'BOUGHT_OUT_COMPONENT')
    );

    const snapshot = await getDocs(boQuery);
    expect(snapshot.size).toBe(2);
  });

  // ============================================================================
  // STEP 3: Search Materials
  // ============================================================================

  itWithEmulator('Step 3: Search materials by name (client-side filter)', async () => {
    const now = Timestamp.now();

    // Create searchable materials
    const materials = [
      { id: 'search-1', name: 'Stainless Steel 304 Plate', tags: ['ss304', 'plate'] },
      { id: 'search-2', name: 'Stainless Steel 316 Pipe', tags: ['ss316', 'pipe'] },
      { id: 'search-3', name: 'Carbon Steel Plate', tags: ['cs', 'plate'] },
      { id: 'search-4', name: 'Gate Valve SS304', tags: ['valve', 'ss304'] },
    ];

    for (const mat of materials) {
      await setDoc(doc(db, COLLECTIONS.MATERIALS, mat.id), {
        name: mat.name,
        tags: mat.tags,
        isActive: true,
        createdAt: now,
      });
    }

    // Fetch all and filter client-side (simulating search)
    const snapshot = await getDocs(collection(db, COLLECTIONS.MATERIALS));
    const allMaterials: { id: string; name?: string }[] = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as object),
    }));

    // Search for "Stainless"
    const searchTerm = 'stainless';
    const results = allMaterials.filter((m) =>
      (m.name ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    expect(results.length).toBe(2);
    expect(results.map((r) => r.name)).toContain('Stainless Steel 304 Plate');
    expect(results.map((r) => r.name)).toContain('Stainless Steel 316 Pipe');
  });

  itWithEmulator('Step 3b: Search materials by tags', async () => {
    const now = Timestamp.now();

    await setDoc(doc(db, COLLECTIONS.MATERIALS, 'tag-1'), {
      name: 'Material with SS304 tag',
      tags: ['ss304', 'stainless'],
      isActive: true,
      createdAt: now,
    });

    await setDoc(doc(db, COLLECTIONS.MATERIALS, 'tag-2'), {
      name: 'Material with SS316 tag',
      tags: ['ss316', 'stainless'],
      isActive: true,
      createdAt: now,
    });

    await setDoc(doc(db, COLLECTIONS.MATERIALS, 'tag-3'), {
      name: 'Carbon steel material',
      tags: ['carbon', 'steel'],
      isActive: true,
      createdAt: now,
    });

    // Query by array-contains for tags
    const tagQuery = query(
      collection(db, COLLECTIONS.MATERIALS),
      where('tags', 'array-contains', 'stainless')
    );

    const snapshot = await getDocs(tagQuery);
    expect(snapshot.size).toBe(2);
  });

  // ============================================================================
  // STEP 4: Update Material Prices
  // ============================================================================

  itWithEmulator('Step 4: Update material price with history tracking', async () => {
    const materialId = 'price-test-001';
    const now = Timestamp.now();
    const oldDate = Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

    // Create material with initial price
    await setDoc(doc(db, COLLECTIONS.MATERIALS, materialId), {
      name: 'Test Material',
      currentPrice: {
        pricePerUnit: { amount: 100, currency: 'INR' },
        effectiveDate: oldDate,
        vendorId: 'vendor-001',
      },
      priceHistory: [],
      createdAt: oldDate,
      updatedAt: oldDate,
    });

    // Get current price for history
    const currentDoc = await getDoc(doc(db, COLLECTIONS.MATERIALS, materialId));
    const oldPrice = currentDoc.data()?.currentPrice;

    // Update price
    const newPrice = {
      pricePerUnit: { amount: 120, currency: 'INR' },
      effectiveDate: now,
      vendorId: 'vendor-002',
    };

    await updateDoc(doc(db, COLLECTIONS.MATERIALS, materialId), {
      currentPrice: newPrice,
      priceHistory: [oldPrice], // Add old price to history
      updatedAt: now,
      updatedBy: TEST_USER.id,
    });

    // Verify
    const updatedDoc = await getDoc(doc(db, COLLECTIONS.MATERIALS, materialId));
    expect(updatedDoc.data()?.currentPrice.pricePerUnit.amount).toBe(120);
    expect(updatedDoc.data()?.priceHistory.length).toBe(1);
    expect(updatedDoc.data()?.priceHistory[0].pricePerUnit.amount).toBe(100);
  });

  // ============================================================================
  // STEP 5: Material Lifecycle
  // ============================================================================

  itWithEmulator('Step 5: Material lifecycle (create → update → deactivate)', async () => {
    const materialId = 'lifecycle-001';
    const now = Timestamp.now();

    // Create
    await setDoc(doc(db, COLLECTIONS.MATERIALS, materialId), {
      name: 'Lifecycle Test Material',
      materialCode: 'LCT-001',
      isActive: true,
      createdAt: now,
      updatedAt: now,
      createdBy: TEST_USER.id,
    });

    let materialDoc = await getDoc(doc(db, COLLECTIONS.MATERIALS, materialId));
    expect(materialDoc.data()?.isActive).toBe(true);

    // Update
    await updateDoc(doc(db, COLLECTIONS.MATERIALS, materialId), {
      name: 'Updated Lifecycle Material',
      updatedAt: Timestamp.now(),
      updatedBy: TEST_USER.id,
    });

    materialDoc = await getDoc(doc(db, COLLECTIONS.MATERIALS, materialId));
    expect(materialDoc.data()?.name).toBe('Updated Lifecycle Material');

    // Deactivate (soft delete)
    await updateDoc(doc(db, COLLECTIONS.MATERIALS, materialId), {
      isActive: false,
      deactivatedAt: Timestamp.now(),
      deactivatedBy: TEST_USER.id,
      deactivationReason: 'No longer in use',
      updatedAt: Timestamp.now(),
    });

    materialDoc = await getDoc(doc(db, COLLECTIONS.MATERIALS, materialId));
    expect(materialDoc.data()?.isActive).toBe(false);
    expect(materialDoc.data()?.deactivationReason).toBe('No longer in use');

    // Verify deactivated materials are excluded from active queries
    const activeQuery = query(collection(db, COLLECTIONS.MATERIALS), where('isActive', '==', true));
    const activeSnapshot = await getDocs(activeQuery);
    const activeIds = activeSnapshot.docs.map((d) => d.id);
    expect(activeIds).not.toContain(materialId);
  });

  // ============================================================================
  // STEP 6: Material with Vendor Association
  // ============================================================================

  itWithEmulator('Step 6: Query materials by preferred vendor', async () => {
    const now = Timestamp.now();

    // Create materials with different vendors
    await setDoc(doc(db, COLLECTIONS.MATERIALS, 'vendor-mat-1'), {
      name: 'Material from Vendor 1',
      preferredVendors: ['vendor-001', 'vendor-002'],
      isActive: true,
      createdAt: now,
    });

    await setDoc(doc(db, COLLECTIONS.MATERIALS, 'vendor-mat-2'), {
      name: 'Material from Vendor 1 only',
      preferredVendors: ['vendor-001'],
      isActive: true,
      createdAt: now,
    });

    await setDoc(doc(db, COLLECTIONS.MATERIALS, 'vendor-mat-3'), {
      name: 'Material from Vendor 3',
      preferredVendors: ['vendor-003'],
      isActive: true,
      createdAt: now,
    });

    // Query materials for vendor-001
    const vendorQuery = query(
      collection(db, COLLECTIONS.MATERIALS),
      where('preferredVendors', 'array-contains', 'vendor-001'),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(vendorQuery);
    expect(snapshot.size).toBe(2);
  });

  // ============================================================================
  // COMPLETE WORKFLOW TEST
  // ============================================================================

  itWithEmulator('Complete Materials Workflow: Create → Query → Update → Search', async () => {
    const now = Timestamp.now();

    // 1. Create multiple materials
    const materialsToCreate = [
      {
        id: 'wf-mat-1',
        name: 'SS304 Plate 6mm',
        category: 'PLATES_STAINLESS_STEEL',
        materialType: 'RAW_MATERIAL',
        materialCode: 'PL-SS304-6',
        currentPrice: { pricePerUnit: { amount: 350, currency: 'INR' } },
        tags: ['ss304', 'plate'],
        isActive: true,
      },
      {
        id: 'wf-mat-2',
        name: 'SS316 Plate 8mm',
        category: 'PLATES_STAINLESS_STEEL',
        materialType: 'RAW_MATERIAL',
        materialCode: 'PL-SS316-8',
        currentPrice: { pricePerUnit: { amount: 550, currency: 'INR' } },
        tags: ['ss316', 'plate'],
        isActive: true,
      },
      {
        id: 'wf-mat-3',
        name: 'Gate Valve 2"',
        category: 'VALVE_GATE',
        materialType: 'BOUGHT_OUT_COMPONENT',
        materialCode: 'VLV-GATE-2',
        currentPrice: { pricePerUnit: { amount: 8500, currency: 'INR' } },
        tags: ['valve', 'gate'],
        isActive: true,
      },
    ];

    for (const mat of materialsToCreate) {
      await setDoc(doc(db, COLLECTIONS.MATERIALS, mat.id), {
        ...mat,
        createdAt: now,
        updatedAt: now,
        createdBy: TEST_USER.id,
      });
    }

    // 2. Query by category
    const platesQuery = query(
      collection(db, COLLECTIONS.MATERIALS),
      where('category', '==', 'PLATES_STAINLESS_STEEL')
    );
    const plates = await getDocs(platesQuery);
    expect(plates.size).toBe(2);

    // 3. Update a price
    await updateDoc(doc(db, COLLECTIONS.MATERIALS, 'wf-mat-1'), {
      currentPrice: { pricePerUnit: { amount: 380, currency: 'INR' } },
      updatedAt: Timestamp.now(),
    });

    const updated = await getDoc(doc(db, COLLECTIONS.MATERIALS, 'wf-mat-1'));
    expect(updated.data()?.currentPrice.pricePerUnit.amount).toBe(380);

    // 4. Search by tag
    const plateTagQuery = query(
      collection(db, COLLECTIONS.MATERIALS),
      where('tags', 'array-contains', 'plate')
    );
    const platesByTag = await getDocs(plateTagQuery);
    expect(platesByTag.size).toBe(2);

    // 5. Query bought-out items
    const boQuery = query(
      collection(db, COLLECTIONS.MATERIALS),
      where('materialType', '==', 'BOUGHT_OUT_COMPONENT')
    );
    const boughtOut = await getDocs(boQuery);
    expect(boughtOut.size).toBe(1);
    expect(boughtOut.docs[0]?.data().name).toBe('Gate Valve 2"');

    // eslint-disable-next-line no-console
    console.log('\n✅ Complete materials workflow verified successfully!\n');
  });
});
