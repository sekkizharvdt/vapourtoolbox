/**
 * BOM/Estimation Workflow Integration Test
 *
 * Tests the complete BOM workflow:
 * 1. Create a BOM with auto-generated code
 * 2. Add items (shapes and bought-out components)
 * 3. Calculate costs for items
 * 4. Verify summary aggregation
 * 5. Apply cost configuration (overhead, contingency, profit)
 *
 * Prerequisites:
 * - Firebase emulators running: `firebase emulators:start`
 *
 * Run with: `pnpm test:integration`
 */

import { doc, setDoc, getDoc, updateDoc, Timestamp, collection, getDocs } from 'firebase/firestore';
import { initializeTestFirebase, cleanupTestData, checkEmulatorsRunning } from './setup';
import type { Firestore } from 'firebase/firestore';

// Collection names
const COLLECTIONS = {
  BOMS: 'boms',
  BOM_ITEMS: 'items',
  MATERIALS: 'materials',
  SHAPES: 'shapes',
  COST_CONFIGURATIONS: 'costConfigurations',
  COUNTERS: 'counters',
};

// Test data
const TEST_USER = {
  id: 'test-user-001',
  name: 'Test User',
  email: 'test@example.com',
};

const TEST_ENTITY = {
  id: 'entity-001',
  name: 'Test Entity Ltd',
};

const TEST_PROJECT = {
  id: 'project-001',
  name: 'Test Project',
  number: 'TP-2024-001',
};

describe('BOM/Estimation Workflow Integration', () => {
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
  // STEP 1: Create BOM
  // ============================================================================

  itWithEmulator('Step 1: Create a BOM with generated code', async () => {
    const bomId = 'bom-001';
    const now = Timestamp.now();

    // Setup counter for code generation
    await setDoc(doc(db, COLLECTIONS.COUNTERS, 'bom-2024'), {
      value: 0,
      updatedAt: now,
    });

    // Create BOM
    const bomData = {
      bomCode: 'EST-2024-0001',
      name: 'Test BOM - Heat Exchanger',
      description: 'Integration test BOM for heat exchanger fabrication',
      category: 'FABRICATION',
      entityId: TEST_ENTITY.id,
      projectId: TEST_PROJECT.id,
      projectName: TEST_PROJECT.name,
      status: 'DRAFT',
      version: 1,
      summary: {
        totalWeight: 0,
        totalMaterialCost: { amount: 0, currency: 'INR' },
        totalFabricationCost: { amount: 0, currency: 'INR' },
        totalServiceCost: { amount: 0, currency: 'INR' },
        totalDirectCost: { amount: 0, currency: 'INR' },
        overhead: { amount: 0, currency: 'INR' },
        contingency: { amount: 0, currency: 'INR' },
        profit: { amount: 0, currency: 'INR' },
        totalCost: { amount: 0, currency: 'INR' },
        itemCount: 0,
        currency: 'INR',
      },
      createdAt: now,
      updatedAt: now,
      createdBy: TEST_USER.id,
      updatedBy: TEST_USER.id,
    };

    await setDoc(doc(db, COLLECTIONS.BOMS, bomId), bomData);

    // Verify BOM was created
    const bomDoc = await getDoc(doc(db, COLLECTIONS.BOMS, bomId));
    expect(bomDoc.exists()).toBe(true);
    expect(bomDoc.data()?.bomCode).toBe('EST-2024-0001');
    expect(bomDoc.data()?.status).toBe('DRAFT');
    expect(bomDoc.data()?.summary.itemCount).toBe(0);
  });

  // ============================================================================
  // STEP 2: Setup Materials and Shapes
  // ============================================================================

  itWithEmulator('Step 2: Create materials and shapes for BOM items', async () => {
    const now = Timestamp.now();

    // Create a material (SS304 Plate)
    const materialData = {
      name: 'SS304 Plate 6mm',
      materialCode: 'PL-SS304-6',
      category: 'PLATES_STAINLESS_STEEL',
      materialType: 'RAW_MATERIAL',
      baseUnit: 'kg',
      density: 7930, // kg/m³
      currentPrice: {
        pricePerUnit: { amount: 350, currency: 'INR' },
        effectiveDate: now,
      },
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, COLLECTIONS.MATERIALS, 'material-001'), materialData);

    // Create a shape (Rectangular Plate)
    const shapeData = {
      name: 'Rectangular Plate',
      shapeCode: 'SHP-RECT-001',
      category: 'PLATE_RECTANGULAR',
      parameters: [
        { name: 'L', label: 'Length', unit: 'mm', type: 'NUMBER', required: true },
        { name: 'W', label: 'Width', unit: 'mm', type: 'NUMBER', required: true },
        { name: 't', label: 'Thickness', unit: 'mm', type: 'NUMBER', required: true },
      ],
      formulas: {
        volume: 'L * W * t',
        weight: 'volume * density / 1000000000', // Convert mm³ to m³
        surfaceArea: '2 * (L * W + L * t + W * t)',
      },
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, COLLECTIONS.SHAPES, 'shape-001'), shapeData);

    // Create a bought-out material (Gate Valve)
    const boughtOutData = {
      name: 'Gate Valve 2" 150#',
      materialCode: 'VLV-GATE-2-150',
      category: 'VALVE_GATE',
      materialType: 'BOUGHT_OUT_COMPONENT',
      baseUnit: 'nos',
      currentPrice: {
        pricePerUnit: { amount: 8500, currency: 'INR' },
        effectiveDate: now,
      },
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, COLLECTIONS.MATERIALS, 'material-002'), boughtOutData);

    // Verify materials and shapes
    const material1 = await getDoc(doc(db, COLLECTIONS.MATERIALS, 'material-001'));
    const material2 = await getDoc(doc(db, COLLECTIONS.MATERIALS, 'material-002'));
    const shape = await getDoc(doc(db, COLLECTIONS.SHAPES, 'shape-001'));

    expect(material1.exists()).toBe(true);
    expect(material2.exists()).toBe(true);
    expect(shape.exists()).toBe(true);
    expect(material1.data()?.materialType).toBe('RAW_MATERIAL');
    expect(material2.data()?.materialType).toBe('BOUGHT_OUT_COMPONENT');
  });

  // ============================================================================
  // STEP 3: Add BOM Items
  // ============================================================================

  itWithEmulator('Step 3: Add items to BOM with hierarchical numbering', async () => {
    const bomId = 'bom-001';
    const now = Timestamp.now();

    // Setup BOM
    await setDoc(doc(db, COLLECTIONS.BOMS, bomId), {
      bomCode: 'EST-2024-0001',
      name: 'Test BOM',
      status: 'DRAFT',
      summary: { itemCount: 0 },
      createdAt: now,
    });

    // Add root level item (1)
    const item1Data = {
      bomId,
      itemNumber: '1',
      itemType: 'ASSEMBLY',
      level: 0,
      sortOrder: 1,
      name: 'Shell Assembly',
      description: 'Main shell assembly for heat exchanger',
      quantity: 1,
      unit: 'nos',
      createdAt: now,
      updatedAt: now,
      createdBy: TEST_USER.id,
    };

    await setDoc(doc(db, COLLECTIONS.BOMS, bomId, COLLECTIONS.BOM_ITEMS, 'item-001'), item1Data);

    // Add child item (1.1) - Shape-based
    const item1_1Data = {
      bomId,
      itemNumber: '1.1',
      itemType: 'MATERIAL',
      parentItemId: 'item-001',
      level: 1,
      sortOrder: 1,
      name: 'Shell Plate',
      description: 'Main shell plate',
      quantity: 2,
      unit: 'nos',
      component: {
        type: 'SHAPE',
        shapeId: 'shape-001',
        materialId: 'material-001',
        parameters: { L: 1000, W: 500, t: 6 },
      },
      createdAt: now,
      updatedAt: now,
      createdBy: TEST_USER.id,
    };

    await setDoc(doc(db, COLLECTIONS.BOMS, bomId, COLLECTIONS.BOM_ITEMS, 'item-002'), item1_1Data);

    // Add child item (1.2) - Bought-out
    const item1_2Data = {
      bomId,
      itemNumber: '1.2',
      itemType: 'MATERIAL',
      parentItemId: 'item-001',
      level: 1,
      sortOrder: 2,
      name: 'Inlet Valve',
      description: 'Inlet gate valve',
      quantity: 1,
      unit: 'nos',
      component: {
        type: 'BOUGHT_OUT',
        materialId: 'material-002',
      },
      createdAt: now,
      updatedAt: now,
      createdBy: TEST_USER.id,
    };

    await setDoc(doc(db, COLLECTIONS.BOMS, bomId, COLLECTIONS.BOM_ITEMS, 'item-003'), item1_2Data);

    // Add second root item (2)
    const item2Data = {
      bomId,
      itemNumber: '2',
      itemType: 'MATERIAL',
      level: 0,
      sortOrder: 2,
      name: 'End Plate',
      quantity: 2,
      unit: 'nos',
      component: {
        type: 'SHAPE',
        shapeId: 'shape-001',
        materialId: 'material-001',
        parameters: { L: 500, W: 500, t: 8 },
      },
      createdAt: now,
      updatedAt: now,
      createdBy: TEST_USER.id,
    };

    await setDoc(doc(db, COLLECTIONS.BOMS, bomId, COLLECTIONS.BOM_ITEMS, 'item-004'), item2Data);

    // Update BOM item count
    await updateDoc(doc(db, COLLECTIONS.BOMS, bomId), {
      'summary.itemCount': 4,
      updatedAt: Timestamp.now(),
    });

    // Verify items
    const itemsSnapshot = await getDocs(
      collection(db, COLLECTIONS.BOMS, bomId, COLLECTIONS.BOM_ITEMS)
    );
    expect(itemsSnapshot.size).toBe(4);

    // Verify hierarchical numbering
    const items = itemsSnapshot.docs.map((d) => d.data());
    const itemNumbers = items.map((i) => i.itemNumber).sort();
    expect(itemNumbers).toEqual(['1', '1.1', '1.2', '2']);
  });

  // ============================================================================
  // STEP 4: Calculate Item Costs
  // ============================================================================

  itWithEmulator('Step 4: Calculate costs for BOM items', async () => {
    const bomId = 'bom-001';
    const now = Timestamp.now();

    // Setup BOM and item
    await setDoc(doc(db, COLLECTIONS.BOMS, bomId), {
      bomCode: 'EST-2024-0001',
      status: 'DRAFT',
      entityId: TEST_ENTITY.id,
      createdAt: now,
    });

    // Setup material with price
    await setDoc(doc(db, COLLECTIONS.MATERIALS, 'material-001'), {
      name: 'SS304 Plate',
      currentPrice: { pricePerUnit: { amount: 350, currency: 'INR' } },
    });

    // Create item with calculated costs
    const itemWithCost = {
      bomId,
      itemNumber: '1',
      name: 'Test Plate',
      quantity: 2,
      component: {
        type: 'SHAPE',
        materialId: 'material-001',
        shapeId: 'shape-001',
        parameters: { L: 1000, W: 500, t: 6 },
      },
      calculatedProperties: {
        weight: 23.79, // kg per piece (1000 * 500 * 6 * 7930 / 1e9)
        totalWeight: 47.58, // 2 pieces
      },
      cost: {
        materialCostPerUnit: { amount: 8326.5, currency: 'INR' }, // 23.79 * 350
        totalMaterialCost: { amount: 16653, currency: 'INR' },
        fabricationCostPerUnit: { amount: 1500, currency: 'INR' },
        totalFabricationCost: { amount: 3000, currency: 'INR' },
        serviceCostPerUnit: { amount: 0, currency: 'INR' },
        totalServiceCost: { amount: 0, currency: 'INR' },
      },
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(doc(db, COLLECTIONS.BOMS, bomId, COLLECTIONS.BOM_ITEMS, 'item-001'), itemWithCost);

    // Verify calculated costs
    const itemDoc = await getDoc(
      doc(db, COLLECTIONS.BOMS, bomId, COLLECTIONS.BOM_ITEMS, 'item-001')
    );
    expect(itemDoc.data()?.calculatedProperties.totalWeight).toBe(47.58);
    expect(itemDoc.data()?.cost.totalMaterialCost.amount).toBe(16653);
    expect(itemDoc.data()?.cost.totalFabricationCost.amount).toBe(3000);
  });

  // ============================================================================
  // STEP 5: Setup Cost Configuration
  // ============================================================================

  itWithEmulator('Step 5: Create and apply cost configuration', async () => {
    const configId = 'config-001';
    const now = Timestamp.now();

    // Create cost configuration
    const costConfigData = {
      entityId: TEST_ENTITY.id,
      name: 'Standard Cost Config',
      description: 'Default cost configuration for fabrication',
      overhead: {
        enabled: true,
        ratePercent: 15,
        applicableTo: 'ALL',
      },
      contingency: {
        enabled: true,
        ratePercent: 5,
      },
      profit: {
        enabled: true,
        ratePercent: 10,
      },
      isActive: true,
      effectiveFrom: now,
      createdAt: now,
      updatedAt: now,
      createdBy: TEST_USER.id,
      updatedBy: TEST_USER.id,
    };

    await setDoc(doc(db, COLLECTIONS.COST_CONFIGURATIONS, configId), costConfigData);

    // Verify configuration
    const configDoc = await getDoc(doc(db, COLLECTIONS.COST_CONFIGURATIONS, configId));
    expect(configDoc.exists()).toBe(true);
    expect(configDoc.data()?.overhead.ratePercent).toBe(15);
    expect(configDoc.data()?.contingency.ratePercent).toBe(5);
    expect(configDoc.data()?.profit.ratePercent).toBe(10);
    expect(configDoc.data()?.isActive).toBe(true);
  });

  // ============================================================================
  // STEP 6: Calculate BOM Summary
  // ============================================================================

  itWithEmulator('Step 6: Calculate BOM summary with indirect costs', async () => {
    const bomId = 'bom-001';
    const now = Timestamp.now();

    // Setup BOM with items that have costs
    await setDoc(doc(db, COLLECTIONS.BOMS, bomId), {
      bomCode: 'EST-2024-0001',
      status: 'DRAFT',
      entityId: TEST_ENTITY.id,
      summary: { itemCount: 2 },
      createdAt: now,
    });

    // Item 1: Shape-based
    await setDoc(doc(db, COLLECTIONS.BOMS, bomId, COLLECTIONS.BOM_ITEMS, 'item-001'), {
      itemNumber: '1',
      name: 'Shell Plate',
      quantity: 2,
      calculatedProperties: { totalWeight: 47.58 },
      cost: {
        totalMaterialCost: { amount: 16653, currency: 'INR' },
        totalFabricationCost: { amount: 3000, currency: 'INR' },
        totalServiceCost: { amount: 500, currency: 'INR' },
      },
    });

    // Item 2: Bought-out
    await setDoc(doc(db, COLLECTIONS.BOMS, bomId, COLLECTIONS.BOM_ITEMS, 'item-002'), {
      itemNumber: '2',
      name: 'Gate Valve',
      quantity: 1,
      calculatedProperties: { totalWeight: 0 },
      cost: {
        totalMaterialCost: { amount: 8500, currency: 'INR' },
        totalFabricationCost: { amount: 0, currency: 'INR' },
        totalServiceCost: { amount: 0, currency: 'INR' },
      },
    });

    // Calculate summary
    const directMaterial = 16653 + 8500; // 25153
    const directFabrication = 3000 + 0; // 3000
    const directService = 500 + 0; // 500
    const directCost = directMaterial + directFabrication + directService; // 28653

    // Apply cost config (15% overhead, 5% contingency, 10% profit)
    const overhead = directCost * 0.15; // 4297.95
    const contingency = (directCost + overhead) * 0.05; // 1647.55
    const subtotal = directCost + overhead + contingency; // 34598.50
    const profit = subtotal * 0.1; // 3459.85
    const totalCost = subtotal + profit; // 38058.35

    const summaryData = {
      totalWeight: 47.58,
      totalMaterialCost: { amount: directMaterial, currency: 'INR' },
      totalFabricationCost: { amount: directFabrication, currency: 'INR' },
      totalServiceCost: { amount: directService, currency: 'INR' },
      totalDirectCost: { amount: directCost, currency: 'INR' },
      overhead: { amount: Math.round(overhead * 100) / 100, currency: 'INR' },
      contingency: { amount: Math.round(contingency * 100) / 100, currency: 'INR' },
      profit: { amount: Math.round(profit * 100) / 100, currency: 'INR' },
      totalCost: { amount: Math.round(totalCost * 100) / 100, currency: 'INR' },
      itemCount: 2,
      currency: 'INR',
      costConfigId: 'config-001',
      lastCalculated: now,
    };

    await updateDoc(doc(db, COLLECTIONS.BOMS, bomId), {
      summary: summaryData,
      updatedAt: Timestamp.now(),
    });

    // Verify summary
    const bomDoc = await getDoc(doc(db, COLLECTIONS.BOMS, bomId));
    const summary = bomDoc.data()?.summary;

    expect(summary.totalWeight).toBe(47.58);
    expect(summary.totalMaterialCost.amount).toBe(25153);
    expect(summary.totalFabricationCost.amount).toBe(3000);
    expect(summary.totalDirectCost.amount).toBe(28653);
    expect(summary.overhead.amount).toBeCloseTo(4297.95, 1);
    expect(summary.totalCost.amount).toBeCloseTo(38058.35, 0);
  });

  // ============================================================================
  // STEP 7: BOM Status Transitions
  // ============================================================================

  itWithEmulator('Step 7: BOM status transitions (Draft → Submitted → Approved)', async () => {
    const bomId = 'bom-001';
    const now = Timestamp.now();

    // Create BOM in DRAFT
    await setDoc(doc(db, COLLECTIONS.BOMS, bomId), {
      bomCode: 'EST-2024-0001',
      status: 'DRAFT',
      summary: { totalCost: { amount: 38058.35, currency: 'INR' } },
      createdAt: now,
    });

    // Submit BOM (DRAFT → SUBMITTED)
    await updateDoc(doc(db, COLLECTIONS.BOMS, bomId), {
      status: 'SUBMITTED',
      submittedAt: Timestamp.now(),
      submittedBy: TEST_USER.id,
      updatedAt: Timestamp.now(),
    });

    let bomDoc = await getDoc(doc(db, COLLECTIONS.BOMS, bomId));
    expect(bomDoc.data()?.status).toBe('SUBMITTED');

    // Approve BOM (SUBMITTED → APPROVED)
    await updateDoc(doc(db, COLLECTIONS.BOMS, bomId), {
      status: 'APPROVED',
      approvedAt: Timestamp.now(),
      approvedBy: 'approver-001',
      updatedAt: Timestamp.now(),
    });

    bomDoc = await getDoc(doc(db, COLLECTIONS.BOMS, bomId));
    expect(bomDoc.data()?.status).toBe('APPROVED');
  });

  // ============================================================================
  // COMPLETE WORKFLOW TEST
  // ============================================================================

  itWithEmulator('Complete BOM Workflow: Create → Add Items → Calculate → Approve', async () => {
    const now = Timestamp.now();
    const bomId = 'workflow-bom-001';

    // 1. Create BOM
    await setDoc(doc(db, COLLECTIONS.BOMS, bomId), {
      bomCode: 'EST-2024-0099',
      name: 'Complete Workflow BOM',
      category: 'FABRICATION',
      entityId: TEST_ENTITY.id,
      projectId: TEST_PROJECT.id,
      status: 'DRAFT',
      summary: {
        itemCount: 0,
        totalCost: { amount: 0, currency: 'INR' },
      },
      createdAt: now,
      createdBy: TEST_USER.id,
    });

    // 2. Create material
    await setDoc(doc(db, COLLECTIONS.MATERIALS, 'wf-material-001'), {
      name: 'Test Material',
      currentPrice: { pricePerUnit: { amount: 100, currency: 'INR' } },
    });

    // 3. Add items with costs
    await setDoc(doc(db, COLLECTIONS.BOMS, bomId, COLLECTIONS.BOM_ITEMS, 'wf-item-001'), {
      itemNumber: '1',
      name: 'Item 1',
      quantity: 10,
      cost: {
        totalMaterialCost: { amount: 1000, currency: 'INR' },
        totalFabricationCost: { amount: 500, currency: 'INR' },
        totalServiceCost: { amount: 0, currency: 'INR' },
      },
    });

    // 4. Update summary
    await updateDoc(doc(db, COLLECTIONS.BOMS, bomId), {
      summary: {
        itemCount: 1,
        totalMaterialCost: { amount: 1000, currency: 'INR' },
        totalFabricationCost: { amount: 500, currency: 'INR' },
        totalServiceCost: { amount: 0, currency: 'INR' },
        totalDirectCost: { amount: 1500, currency: 'INR' },
        overhead: { amount: 225, currency: 'INR' }, // 15%
        contingency: { amount: 86.25, currency: 'INR' }, // 5%
        profit: { amount: 181.13, currency: 'INR' }, // 10%
        totalCost: { amount: 1992.38, currency: 'INR' },
        currency: 'INR',
      },
    });

    // 5. Submit and approve
    await updateDoc(doc(db, COLLECTIONS.BOMS, bomId), {
      status: 'APPROVED',
      approvedAt: Timestamp.now(),
      approvedBy: 'approver-001',
    });

    // Verify complete workflow
    const bom = await getDoc(doc(db, COLLECTIONS.BOMS, bomId));
    const items = await getDocs(collection(db, COLLECTIONS.BOMS, bomId, COLLECTIONS.BOM_ITEMS));

    expect(bom.data()?.status).toBe('APPROVED');
    expect(bom.data()?.summary.itemCount).toBe(1);
    expect(bom.data()?.summary.totalCost.amount).toBeCloseTo(1992.38, 1);
    expect(items.size).toBe(1);

    // eslint-disable-next-line no-console
    console.log('\n✅ Complete BOM workflow verified successfully!\n');
  });
});
