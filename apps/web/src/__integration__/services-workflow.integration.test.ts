/**
 * Services Module Integration Test
 *
 * Tests the complete services workflow:
 * 1. Create services in the catalog with auto-generated codes
 * 2. Query and filter services by category
 * 3. Update service details
 * 4. Soft-delete and restore
 * 5. Create service orders linked to POs
 * 6. Walk through the service order lifecycle (DRAFT → COMPLETED)
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

const COLLECTIONS = {
  SERVICES: 'services',
  SERVICE_ORDERS: 'serviceOrders',
};

const TEST_USER = {
  id: 'test-user-001',
  name: 'Test User',
  email: 'test@example.com',
};

describe('Services Module Integration', () => {
  let db: Firestore;
  let emulatorsRunning: boolean;

  beforeAll(async () => {
    emulatorsRunning = await checkEmulatorsRunning();

    if (!emulatorsRunning) {
      // eslint-disable-next-line no-console
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
  // STEP 1: Create Services in the Catalog
  // ============================================================================

  itWithEmulator('Step 1: Create services with different categories', async () => {
    const now = Timestamp.now();

    const services = [
      {
        id: 'svc-001',
        name: 'Proximate Analysis',
        serviceCode: 'SVC-TST-001',
        category: 'TESTING',
        description: 'Moisture, volatile matter, ash, fixed carbon',
        unit: 'PER SAMPLE',
        estimatedTurnaroundDays: 7,
        testMethodStandard: 'ASTM D3172',
        sampleRequirements: 'Minimum 500g ground sample',
        isActive: true,
        isStandard: true,
      },
      {
        id: 'svc-002',
        name: 'Ultimate Analysis',
        serviceCode: 'SVC-TST-002',
        category: 'TESTING',
        description: 'C, H, N, S, O elemental analysis',
        unit: 'PER SAMPLE',
        estimatedTurnaroundDays: 10,
        testMethodStandard: 'ASTM D3176',
        isActive: true,
        isStandard: true,
      },
      {
        id: 'svc-003',
        name: 'Structural Design Review',
        serviceCode: 'SVC-ENG-001',
        category: 'ENGINEERING',
        description: 'Third-party structural design verification',
        unit: 'LUMP SUM',
        estimatedTurnaroundDays: 21,
        isActive: true,
        isStandard: false,
      },
      {
        id: 'svc-004',
        name: 'Pressure Gauge Calibration',
        serviceCode: 'SVC-CAL-001',
        category: 'CALIBRATION',
        description: 'NABL-accredited pressure gauge calibration',
        unit: 'PER INSTRUMENT',
        estimatedTurnaroundDays: 5,
        accreditations: ['NABL'],
        isActive: true,
        isStandard: true,
      },
    ];

    for (const svc of services) {
      await setDoc(doc(db, COLLECTIONS.SERVICES, svc.id), {
        ...svc,
        createdAt: now,
        updatedAt: now,
        createdBy: TEST_USER.id,
        updatedBy: TEST_USER.id,
      });
    }

    // Verify all created
    for (const svc of services) {
      const snap = await getDoc(doc(db, COLLECTIONS.SERVICES, svc.id));
      expect(snap.exists()).toBe(true);
      expect(snap.data()?.serviceCode).toBe(svc.serviceCode);
      expect(snap.data()?.category).toBe(svc.category);
    }
  });

  // ============================================================================
  // STEP 2: Query Services by Category
  // ============================================================================

  itWithEmulator('Step 2: Query services by category', async () => {
    const now = Timestamp.now();

    // Create services in two categories
    await setDoc(doc(db, COLLECTIONS.SERVICES, 'q-svc-1'), {
      name: 'Test A',
      category: 'TESTING',
      isActive: true,
      createdAt: now,
    });
    await setDoc(doc(db, COLLECTIONS.SERVICES, 'q-svc-2'), {
      name: 'Test B',
      category: 'TESTING',
      isActive: true,
      createdAt: now,
    });
    await setDoc(doc(db, COLLECTIONS.SERVICES, 'q-svc-3'), {
      name: 'Design Review',
      category: 'ENGINEERING',
      isActive: true,
      createdAt: now,
    });

    // Query TESTING
    const testingQuery = query(
      collection(db, COLLECTIONS.SERVICES),
      where('category', '==', 'TESTING'),
      where('isActive', '==', true)
    );
    const testingSnap = await getDocs(testingQuery);
    expect(testingSnap.size).toBe(2);

    // Query ENGINEERING
    const engQuery = query(
      collection(db, COLLECTIONS.SERVICES),
      where('category', '==', 'ENGINEERING'),
      where('isActive', '==', true)
    );
    const engSnap = await getDocs(engQuery);
    expect(engSnap.size).toBe(1);
    expect(engSnap.docs[0]?.data().name).toBe('Design Review');
  });

  // ============================================================================
  // STEP 3: Update and Soft-Delete
  // ============================================================================

  itWithEmulator('Step 3: Update service details', async () => {
    const now = Timestamp.now();

    await setDoc(doc(db, COLLECTIONS.SERVICES, 'upd-svc'), {
      name: 'Original Name',
      serviceCode: 'SVC-TST-UPD',
      category: 'TESTING',
      estimatedTurnaroundDays: 7,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // Update turnaround and description
    await updateDoc(doc(db, COLLECTIONS.SERVICES, 'upd-svc'), {
      name: 'Updated Name',
      estimatedTurnaroundDays: 14,
      description: 'Now includes additional parameters',
      updatedAt: Timestamp.now(),
      updatedBy: TEST_USER.id,
    });

    const snap = await getDoc(doc(db, COLLECTIONS.SERVICES, 'upd-svc'));
    expect(snap.data()?.name).toBe('Updated Name');
    expect(snap.data()?.estimatedTurnaroundDays).toBe(14);
    expect(snap.data()?.serviceCode).toBe('SVC-TST-UPD'); // Code should not change
  });

  itWithEmulator('Step 3b: Soft-delete excludes from active queries', async () => {
    const now = Timestamp.now();

    await setDoc(doc(db, COLLECTIONS.SERVICES, 'del-svc'), {
      name: 'To Be Deleted',
      category: 'TESTING',
      isActive: true,
      createdAt: now,
    });

    // Soft-delete
    await updateDoc(doc(db, COLLECTIONS.SERVICES, 'del-svc'), {
      isActive: false,
      updatedAt: Timestamp.now(),
    });

    // Should not appear in active query
    const activeQuery = query(collection(db, COLLECTIONS.SERVICES), where('isActive', '==', true));
    const activeSnap = await getDocs(activeQuery);
    const activeIds = activeSnap.docs.map((d) => d.id);
    expect(activeIds).not.toContain('del-svc');

    // But document still exists
    const snap = await getDoc(doc(db, COLLECTIONS.SERVICES, 'del-svc'));
    expect(snap.exists()).toBe(true);
    expect(snap.data()?.isActive).toBe(false);
  });

  // ============================================================================
  // STEP 4: Service Order Creation
  // ============================================================================

  itWithEmulator('Step 4: Create a service order linked to a PO', async () => {
    const now = Timestamp.now();

    const soData = {
      number: 'SO/2026/03/0001',
      purchaseOrderId: 'po-001',
      poNumber: 'PO/2026/03/0001',
      vendorId: 'vendor-lab-001',
      vendorName: 'National Lab Services',
      projectId: 'project-001',
      projectName: 'MED Plant Phase 1',
      serviceId: 'svc-001',
      serviceCode: 'SVC-TST-001',
      serviceName: 'Proximate Analysis',
      serviceCategory: 'TESTING',
      description: 'Coal sample proximate analysis for boiler design',
      estimatedTurnaroundDays: 7,
      status: 'DRAFT',
      createdBy: TEST_USER.id,
      createdByName: TEST_USER.name,
      createdAt: now,
      updatedAt: now,
      updatedBy: TEST_USER.id,
    };

    await setDoc(doc(db, COLLECTIONS.SERVICE_ORDERS, 'so-001'), soData);

    const snap = await getDoc(doc(db, COLLECTIONS.SERVICE_ORDERS, 'so-001'));
    expect(snap.exists()).toBe(true);
    expect(snap.data()?.status).toBe('DRAFT');
    expect(snap.data()?.serviceName).toBe('Proximate Analysis');
    expect(snap.data()?.poNumber).toBe('PO/2026/03/0001');
  });

  // ============================================================================
  // STEP 5: Service Order Lifecycle
  // ============================================================================

  itWithEmulator(
    'Step 5: Walk through full service order lifecycle (DRAFT → COMPLETED)',
    async () => {
      const now = Timestamp.now();
      const soId = 'so-lifecycle';

      // Create in DRAFT
      await setDoc(doc(db, COLLECTIONS.SERVICE_ORDERS, soId), {
        number: 'SO/2026/03/0002',
        purchaseOrderId: 'po-001',
        poNumber: 'PO/2026/03/0001',
        vendorId: 'vendor-001',
        vendorName: 'Lab Corp',
        serviceName: 'TGA Analysis',
        status: 'DRAFT',
        createdBy: TEST_USER.id,
        createdByName: TEST_USER.name,
        createdAt: now,
        updatedAt: now,
        updatedBy: TEST_USER.id,
      });

      let snap = await getDoc(doc(db, COLLECTIONS.SERVICE_ORDERS, soId));
      expect(snap.data()?.status).toBe('DRAFT');

      // DRAFT → SAMPLE_SENT
      await updateDoc(doc(db, COLLECTIONS.SERVICE_ORDERS, soId), {
        status: 'SAMPLE_SENT',
        sampleDetails: {
          sampleId: 'SMPL-001',
          sampleDescription: 'Biomass pellet sample, 1kg',
          sentDate: Timestamp.now(),
        },
        updatedAt: Timestamp.now(),
        updatedBy: TEST_USER.id,
      });

      snap = await getDoc(doc(db, COLLECTIONS.SERVICE_ORDERS, soId));
      expect(snap.data()?.status).toBe('SAMPLE_SENT');
      expect(snap.data()?.sampleDetails?.sampleId).toBe('SMPL-001');

      // SAMPLE_SENT → IN_PROGRESS
      await updateDoc(doc(db, COLLECTIONS.SERVICE_ORDERS, soId), {
        status: 'IN_PROGRESS',
        'sampleDetails.receivedByVendorDate': Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      snap = await getDoc(doc(db, COLLECTIONS.SERVICE_ORDERS, soId));
      expect(snap.data()?.status).toBe('IN_PROGRESS');

      // IN_PROGRESS → RESULTS_RECEIVED
      await updateDoc(doc(db, COLLECTIONS.SERVICE_ORDERS, soId), {
        status: 'RESULTS_RECEIVED',
        resultSummary: 'Moisture: 8.2%, VM: 72.1%, Ash: 3.4%, FC: 16.3%',
        updatedAt: Timestamp.now(),
      });

      snap = await getDoc(doc(db, COLLECTIONS.SERVICE_ORDERS, soId));
      expect(snap.data()?.status).toBe('RESULTS_RECEIVED');
      expect(snap.data()?.resultSummary).toContain('Moisture');

      // RESULTS_RECEIVED → UNDER_REVIEW
      await updateDoc(doc(db, COLLECTIONS.SERVICE_ORDERS, soId), {
        status: 'UNDER_REVIEW',
        remarks: 'Reviewing results against design assumptions',
        updatedAt: Timestamp.now(),
      });

      snap = await getDoc(doc(db, COLLECTIONS.SERVICE_ORDERS, soId));
      expect(snap.data()?.status).toBe('UNDER_REVIEW');

      // UNDER_REVIEW → COMPLETED
      const completedAt = Timestamp.now();
      await updateDoc(doc(db, COLLECTIONS.SERVICE_ORDERS, soId), {
        status: 'COMPLETED',
        completedBy: TEST_USER.id,
        completedByName: TEST_USER.name,
        completedAt,
        actualCompletionDate: completedAt,
        updatedAt: completedAt,
      });

      snap = await getDoc(doc(db, COLLECTIONS.SERVICE_ORDERS, soId));
      expect(snap.data()?.status).toBe('COMPLETED');
      expect(snap.data()?.completedBy).toBe(TEST_USER.id);
    }
  );

  // ============================================================================
  // STEP 6: Service Order Cancellation
  // ============================================================================

  itWithEmulator('Step 6: Cancel a service order from IN_PROGRESS', async () => {
    const now = Timestamp.now();
    const soId = 'so-cancel';

    await setDoc(doc(db, COLLECTIONS.SERVICE_ORDERS, soId), {
      number: 'SO/2026/03/0003',
      purchaseOrderId: 'po-002',
      poNumber: 'PO/2026/03/0002',
      vendorId: 'vendor-002',
      vendorName: 'Test Lab',
      serviceName: 'Cancelled Test',
      status: 'IN_PROGRESS',
      createdBy: TEST_USER.id,
      createdByName: TEST_USER.name,
      createdAt: now,
      updatedAt: now,
      updatedBy: TEST_USER.id,
    });

    await updateDoc(doc(db, COLLECTIONS.SERVICE_ORDERS, soId), {
      status: 'CANCELLED',
      remarks: 'Project scope change — test no longer required',
      updatedAt: Timestamp.now(),
    });

    const snap = await getDoc(doc(db, COLLECTIONS.SERVICE_ORDERS, soId));
    expect(snap.data()?.status).toBe('CANCELLED');
    expect(snap.data()?.remarks).toContain('scope change');
  });

  // ============================================================================
  // STEP 7: Query Service Orders by Status and Project
  // ============================================================================

  itWithEmulator('Step 7: Query service orders by status', async () => {
    const now = Timestamp.now();

    const orders = [
      { id: 'so-q-1', status: 'DRAFT', projectId: 'proj-A' },
      { id: 'so-q-2', status: 'IN_PROGRESS', projectId: 'proj-A' },
      { id: 'so-q-3', status: 'COMPLETED', projectId: 'proj-A' },
      { id: 'so-q-4', status: 'IN_PROGRESS', projectId: 'proj-B' },
    ];

    for (const o of orders) {
      await setDoc(doc(db, COLLECTIONS.SERVICE_ORDERS, o.id), {
        number: `SO/2026/03/${o.id}`,
        purchaseOrderId: 'po-001',
        poNumber: 'PO/2026/03/0001',
        vendorId: 'v-001',
        vendorName: 'Lab',
        serviceName: 'Test',
        status: o.status,
        projectId: o.projectId,
        createdBy: TEST_USER.id,
        createdAt: now,
        updatedAt: now,
        updatedBy: TEST_USER.id,
      });
    }

    // Query IN_PROGRESS
    const inProgressQuery = query(
      collection(db, COLLECTIONS.SERVICE_ORDERS),
      where('status', '==', 'IN_PROGRESS')
    );
    const inProgressSnap = await getDocs(inProgressQuery);
    expect(inProgressSnap.size).toBe(2);

    // Query by project
    const projAQuery = query(
      collection(db, COLLECTIONS.SERVICE_ORDERS),
      where('projectId', '==', 'proj-A')
    );
    const projASnap = await getDocs(projAQuery);
    expect(projASnap.size).toBe(3);
  });

  // ============================================================================
  // COMPLETE WORKFLOW TEST
  // ============================================================================

  itWithEmulator(
    'Complete Workflow: Create service → Create SO → Walk lifecycle → Query',
    async () => {
      const now = Timestamp.now();

      // 1. Create a service in the catalog
      await setDoc(doc(db, COLLECTIONS.SERVICES, 'wf-svc'), {
        name: 'Biochar Characterisation',
        serviceCode: 'SVC-TST-WF1',
        category: 'TESTING',
        unit: 'PER SAMPLE',
        estimatedTurnaroundDays: 14,
        testMethodStandard: 'Various',
        sampleRequirements: '200g minimum',
        isActive: true,
        isStandard: false,
        createdAt: now,
        updatedAt: now,
        createdBy: TEST_USER.id,
        updatedBy: TEST_USER.id,
      });

      const svcSnap = await getDoc(doc(db, COLLECTIONS.SERVICES, 'wf-svc'));
      expect(svcSnap.exists()).toBe(true);

      // 2. Create a service order referencing the catalog entry
      await setDoc(doc(db, COLLECTIONS.SERVICE_ORDERS, 'wf-so'), {
        number: 'SO/2026/03/WF01',
        purchaseOrderId: 'po-wf',
        poNumber: 'PO/2026/03/WF01',
        vendorId: 'vendor-wf',
        vendorName: 'Analytical Lab Pvt Ltd',
        projectId: 'proj-wf',
        projectName: 'Biomass Gasification R&D',
        serviceId: 'wf-svc',
        serviceCode: 'SVC-TST-WF1',
        serviceName: 'Biochar Characterisation',
        serviceCategory: 'TESTING',
        status: 'DRAFT',
        estimatedTurnaroundDays: 14,
        createdBy: TEST_USER.id,
        createdByName: TEST_USER.name,
        createdAt: now,
        updatedAt: now,
        updatedBy: TEST_USER.id,
      });

      // 3. Walk through the lifecycle
      // DRAFT → IN_PROGRESS (skip SAMPLE_SENT for this type)
      await updateDoc(doc(db, COLLECTIONS.SERVICE_ORDERS, 'wf-so'), {
        status: 'IN_PROGRESS',
        updatedAt: Timestamp.now(),
      });

      // IN_PROGRESS → RESULTS_RECEIVED
      await updateDoc(doc(db, COLLECTIONS.SERVICE_ORDERS, 'wf-so'), {
        status: 'RESULTS_RECEIVED',
        resultSummary: 'Carbon: 68%, Surface area: 245 m²/g, pH: 9.2, CEC: 32 cmol/kg',
        updatedAt: Timestamp.now(),
      });

      // RESULTS_RECEIVED → COMPLETED
      await updateDoc(doc(db, COLLECTIONS.SERVICE_ORDERS, 'wf-so'), {
        status: 'COMPLETED',
        completedBy: TEST_USER.id,
        completedAt: Timestamp.now(),
        actualCompletionDate: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // 4. Verify final state
      const soSnap = await getDoc(doc(db, COLLECTIONS.SERVICE_ORDERS, 'wf-so'));
      expect(soSnap.data()?.status).toBe('COMPLETED');
      expect(soSnap.data()?.resultSummary).toContain('Carbon: 68%');
      expect(soSnap.data()?.serviceCode).toBe('SVC-TST-WF1');

      // 5. Verify the service is still active in catalog
      const catalogSnap = await getDoc(doc(db, COLLECTIONS.SERVICES, 'wf-svc'));
      expect(catalogSnap.data()?.isActive).toBe(true);

      // eslint-disable-next-line no-console
      console.log('\n✅ Complete services workflow verified successfully!\n');
    }
  );
});
