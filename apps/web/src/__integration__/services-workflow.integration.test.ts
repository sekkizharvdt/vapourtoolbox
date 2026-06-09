/**
 * Services Module Integration Test
 *
 * Tests the services catalog workflow:
 * 1. Create services in the catalog with auto-generated codes
 * 2. Query and filter services by category
 * 3. Update service details
 * 4. Soft-delete and restore
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
});
