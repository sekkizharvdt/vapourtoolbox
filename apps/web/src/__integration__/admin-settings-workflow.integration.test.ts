/**
 * Admin Settings & Entity Management Workflow Integration Tests
 *
 * Tests the complete workflow for managing business entities and admin settings
 * using real Firebase emulators.
 *
 * Prerequisites:
 * - Firebase emulators must be running (npm run emulators)
 * - Emulator ports: Auth (9099), Firestore (8080)
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions */

import { initializeTestFirebase, cleanupTestData, checkEmulatorsRunning } from './setup';
import type { Firestore, Timestamp } from 'firebase/firestore';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  addDoc,
  Timestamp as FirestoreTimestamp,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { BusinessEntity } from '@vapour/types';

describe('Admin Settings & Entity Management Workflow Integration Tests', () => {
  let db: Firestore;
  let emulatorsRunning = false;
  const testEntityIds: string[] = [];

  // Helper to conditionally run tests
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

  beforeAll(async () => {
    emulatorsRunning = await checkEmulatorsRunning();
    if (emulatorsRunning) {
      const firebase = await initializeTestFirebase();
      db = firebase.db;
    }
  });

  afterAll(async () => {
    if (emulatorsRunning && db) {
      // Clean up test entities
      for (const entityId of testEntityIds) {
        try {
          await deleteDoc(doc(db, COLLECTIONS.ENTITIES, entityId));
        } catch {
          // Ignore cleanup errors
        }
      }
      await cleanupTestData();
    }
  });

  // Helper to create test entity
  const createTestEntity = async (data: Partial<BusinessEntity>): Promise<BusinessEntity> => {
    const now = FirestoreTimestamp.now();
    const entityData = {
      name: data.name || 'Test Entity',
      nameNormalized: (data.name || 'Test Entity').toLowerCase(),
      code: data.code || `TEST-${Date.now()}`,
      roles: data.roles || ['VENDOR'],
      isActive: data.isActive !== undefined ? data.isActive : true,
      isDeleted: data.isDeleted || false,
      contactPerson: data.contactPerson || 'Test Contact',
      email: data.email || 'test@example.com',
      phone: data.phone || '+91-1234567890',
      billingAddress: data.billingAddress || {
        line1: '123 Test St',
        city: 'Test City',
        state: 'Test State',
        postalCode: '123456',
        country: 'India',
      },
      createdAt: now as unknown as Timestamp,
      updatedAt: now as unknown as Timestamp,
      createdBy: 'integration-test',
      updatedBy: 'integration-test',
      ...data,
    } as Omit<BusinessEntity, 'id'>;

    const docRef = await addDoc(collection(db, COLLECTIONS.ENTITIES), entityData);
    testEntityIds.push(docRef.id);

    const result: BusinessEntity = {
      id: docRef.id,
      ...entityData,
    } as BusinessEntity;
    return result;
  };

  describe('Business Entity CRUD Operations', () => {
    itWithEmulator('Step 1: Should create a vendor entity', async () => {
      const entity = await createTestEntity({
        name: 'ABC Steel Suppliers',
        code: 'ABC-001',
        roles: ['VENDOR'],
        isActive: true,
        contactPerson: 'John Doe',
        email: 'john@abcsteel.com',
        phone: '+91-1234567890',
      });

      expect(entity.id).toBeDefined();
      expect(entity.name).toBe('ABC Steel Suppliers');
      expect(entity.roles).toContain('VENDOR');
      expect(entity.isActive).toBe(true);

      // Verify in Firestore
      const docSnap = await getDoc(doc(db, COLLECTIONS.ENTITIES, entity.id));
      expect(docSnap.exists()).toBe(true);
      expect(docSnap.data()?.name).toBe('ABC Steel Suppliers');
    });

    itWithEmulator('Step 2: Should create a customer entity', async () => {
      const entity = await createTestEntity({
        name: 'XYZ Industries',
        code: 'XYZ-001',
        roles: ['CUSTOMER'],
        isActive: true,
        contactPerson: 'Jane Smith',
        email: 'jane@xyzindustries.com',
      });

      expect(entity.id).toBeDefined();
      expect(entity.name).toBe('XYZ Industries');
      expect(entity.roles).toContain('CUSTOMER');
    });

    itWithEmulator('Step 3: Should create a dual-role entity (Vendor + Customer)', async () => {
      const entity = await createTestEntity({
        name: 'Dual Role Company',
        code: 'DUAL-001',
        roles: ['VENDOR', 'CUSTOMER'],
        isActive: true,
      });

      expect(entity.roles).toContain('VENDOR');
      expect(entity.roles).toContain('CUSTOMER');
      expect(entity.roles).toHaveLength(2);
    });
  });

  describe('Entity Query Operations', () => {
    itWithEmulator('Step 4: Should query entities by role', async () => {
      // Create entities with different roles
      await createTestEntity({
        name: 'Vendor A',
        code: `VENDOR-A-${Date.now()}`,
        roles: ['VENDOR'],
      });
      await createTestEntity({
        name: 'Customer A',
        code: `CUSTOMER-A-${Date.now()}`,
        roles: ['CUSTOMER'],
      });

      // Query vendors
      const vendorQuery = query(
        collection(db, COLLECTIONS.ENTITIES),
        where('roles', 'array-contains', 'VENDOR')
      );
      const vendorSnapshot = await getDocs(vendorQuery);

      expect(vendorSnapshot.docs.length).toBeGreaterThan(0);
      vendorSnapshot.docs.forEach((docSnap) => {
        const entity = docSnap.data() as BusinessEntity;
        expect(entity.roles).toContain('VENDOR');
      });
    });

    itWithEmulator('Step 5: Should query active entities', async () => {
      // Create active and inactive entities
      await createTestEntity({
        name: 'Active Entity',
        code: `ACTIVE-${Date.now()}`,
        isActive: true,
      });
      await createTestEntity({
        name: 'Inactive Entity',
        code: `INACTIVE-${Date.now()}`,
        isActive: false,
      });

      // Query active entities
      const activeQuery = query(
        collection(db, COLLECTIONS.ENTITIES),
        where('isActive', '==', true)
      );
      const activeSnapshot = await getDocs(activeQuery);

      expect(activeSnapshot.docs.length).toBeGreaterThan(0);
      activeSnapshot.docs.forEach((docSnap) => {
        expect(docSnap.data().isActive).toBe(true);
      });
    });

    itWithEmulator('Step 6: Should search entities by normalized name', async () => {
      // Create searchable entities
      await createTestEntity({
        name: 'Unique Search Term Corp',
        code: `SEARCH-${Date.now()}`,
        nameNormalized: 'unique search term corp',
      });

      // Query by normalized name prefix
      const searchQuery = query(
        collection(db, COLLECTIONS.ENTITIES),
        where('nameNormalized', '>=', 'unique search'),
        where('nameNormalized', '<=', 'unique search\uf8ff')
      );
      const searchSnapshot = await getDocs(searchQuery);

      expect(searchSnapshot.docs.length).toBeGreaterThan(0);
      const found = searchSnapshot.docs.find(
        (docSnap) => docSnap.data().name === 'Unique Search Term Corp'
      );
      expect(found).toBeDefined();
    });
  });

  describe('Entity Status Management', () => {
    itWithEmulator('Step 7: Should deactivate an entity', async () => {
      const entity = await createTestEntity({
        name: 'Entity To Deactivate',
        code: `DEACTIVATE-${Date.now()}`,
        isActive: true,
      });

      // Deactivate
      await setDoc(
        doc(db, COLLECTIONS.ENTITIES, entity.id),
        { isActive: false, updatedAt: FirestoreTimestamp.now() },
        { merge: true }
      );

      // Verify
      const docSnap = await getDoc(doc(db, COLLECTIONS.ENTITIES, entity.id));
      expect(docSnap.data()?.isActive).toBe(false);
    });

    itWithEmulator('Step 8: Should soft delete an entity', async () => {
      const entity = await createTestEntity({
        name: 'Entity To Soft Delete',
        code: `SOFTDEL-${Date.now()}`,
        isDeleted: false,
      });

      // Soft delete
      await setDoc(
        doc(db, COLLECTIONS.ENTITIES, entity.id),
        { isDeleted: true, updatedAt: FirestoreTimestamp.now() },
        { merge: true }
      );

      // Verify
      const docSnap = await getDoc(doc(db, COLLECTIONS.ENTITIES, entity.id));
      expect(docSnap.data()?.isDeleted).toBe(true);
    });
  });

  describe('System Status Management', () => {
    itWithEmulator('Step 9: Should read system status document', async () => {
      // Create a system status document
      const statusDoc = {
        lastUpdated: FirestoreTimestamp.now(),
        auditResults: {
          vulnerabilities: { low: 0, moderate: 2, high: 0, critical: 0 },
          total: 2,
        },
        outdatedPackages: {
          total: 5,
          packages: [{ name: 'lodash', current: '4.17.0', wanted: '4.17.21' }],
        },
        buildStatus: 'passing',
        environment: 'production',
      };

      await setDoc(doc(db, COLLECTIONS.SYSTEM_STATUS, 'current'), statusDoc);

      // Read status
      const docSnap = await getDoc(doc(db, COLLECTIONS.SYSTEM_STATUS, 'current'));
      expect(docSnap.exists()).toBe(true);
      expect(docSnap.data()?.buildStatus).toBe('passing');
      expect(docSnap.data()?.auditResults.total).toBe(2);

      // Cleanup
      await deleteDoc(doc(db, COLLECTIONS.SYSTEM_STATUS, 'current'));
    });

    itWithEmulator('Step 10: Should handle missing system status gracefully', async () => {
      // Ensure no status document exists
      try {
        await deleteDoc(doc(db, COLLECTIONS.SYSTEM_STATUS, 'current'));
      } catch {
        // Ignore if doesn't exist
      }

      const docSnap = await getDoc(doc(db, COLLECTIONS.SYSTEM_STATUS, 'current'));
      expect(docSnap.exists()).toBe(false);
    });
  });

  describe('Entity Cascade Deletion Check', () => {
    itWithEmulator('Step 11: Should allow deletion of unreferenced entity', async () => {
      const entity = await createTestEntity({
        name: 'Unreferenced Entity',
        code: `UNREF-${Date.now()}`,
      });

      // Check for references
      const transactionsQuery = query(
        collection(db, COLLECTIONS.TRANSACTIONS),
        where('entityId', '==', entity.id)
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);

      const projectsQuery = query(
        collection(db, COLLECTIONS.PROJECTS),
        where('client.entityId', '==', entity.id)
      );
      const projectsSnapshot = await getDocs(projectsQuery);

      expect(transactionsSnapshot.size).toBe(0);
      expect(projectsSnapshot.size).toBe(0);

      // Entity can be deleted
      await deleteDoc(doc(db, COLLECTIONS.ENTITIES, entity.id));
      testEntityIds.splice(testEntityIds.indexOf(entity.id), 1);

      const docSnap = await getDoc(doc(db, COLLECTIONS.ENTITIES, entity.id));
      expect(docSnap.exists()).toBe(false);
    });
  });

  describe('Entity Complete Lifecycle', () => {
    itWithEmulator('Step 12: Should complete full entity lifecycle', async () => {
      // 1. Create
      const entity = await createTestEntity({
        name: 'Lifecycle Test Entity',
        code: `LIFECYCLE-${Date.now()}`,
        roles: ['VENDOR'],
        isActive: true,
      });
      expect(entity.id).toBeDefined();

      // 2. Update contact info
      await setDoc(
        doc(db, COLLECTIONS.ENTITIES, entity.id),
        {
          contactPerson: 'Updated Contact',
          email: 'updated@example.com',
          phone: '+91-9876543210',
          updatedAt: FirestoreTimestamp.now(),
        },
        { merge: true }
      );

      let docSnap = await getDoc(doc(db, COLLECTIONS.ENTITIES, entity.id));
      expect(docSnap.data()?.contactPerson).toBe('Updated Contact');

      // 3. Add additional role
      await setDoc(
        doc(db, COLLECTIONS.ENTITIES, entity.id),
        {
          roles: ['VENDOR', 'CUSTOMER'],
          updatedAt: FirestoreTimestamp.now(),
        },
        { merge: true }
      );

      docSnap = await getDoc(doc(db, COLLECTIONS.ENTITIES, entity.id));
      expect(docSnap.data()?.roles).toContain('CUSTOMER');

      // 4. Deactivate
      await setDoc(
        doc(db, COLLECTIONS.ENTITIES, entity.id),
        {
          isActive: false,
          updatedAt: FirestoreTimestamp.now(),
        },
        { merge: true }
      );

      docSnap = await getDoc(doc(db, COLLECTIONS.ENTITIES, entity.id));
      expect(docSnap.data()?.isActive).toBe(false);

      // 5. Soft delete
      await setDoc(
        doc(db, COLLECTIONS.ENTITIES, entity.id),
        {
          isDeleted: true,
          updatedAt: FirestoreTimestamp.now(),
        },
        { merge: true }
      );

      docSnap = await getDoc(doc(db, COLLECTIONS.ENTITIES, entity.id));
      expect(docSnap.data()?.isDeleted).toBe(true);
    });
  });
});
