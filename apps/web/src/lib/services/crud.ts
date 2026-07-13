/**
 * Service Catalog CRUD Operations
 *
 * Provides create, read, update, and soft-delete operations for the services collection.
 */

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  Timestamp,
  orderBy,
  limit,
  type Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { docToTyped } from '../firebase/typeHelpers';
import type { Service, ServiceCategory } from '@vapour/types';
import { generateCounterBackedNumber } from '@/lib/procurement/generateProcurementNumber';

const logger = createLogger({ context: 'serviceService:crud' });

/**
 * Create a new service in the catalog
 */
export async function createService(
  db: Firestore,
  serviceData: Omit<Service, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
  userId: string,
  tenantId: string
): Promise<Service> {
  // rule5-exempt: firestore.rules enforce the permission for this collection — client-side requirePermission is defense-in-depth deferred to a future hardening pass (the static-export build can't make client-side gates load-bearing)
  try {
    logger.info('Creating service', { name: serviceData.name, category: serviceData.category });

    // Check for duplicate service code
    if (serviceData.serviceCode) {
      const existing = await getServiceByCode(db, serviceData.serviceCode);
      if (existing) {
        throw new Error(`Service with code ${serviceData.serviceCode} already exists`);
      }
    }

    // Generate service code if not provided
    const serviceCode =
      serviceData.serviceCode || (await generateServiceCode(db, serviceData.category));

    const now = Timestamp.now();
    const newService: Omit<Service, 'id'> & { tenantId: string } = {
      ...serviceData,
      tenantId, // firestore.rules require this on services.create
      serviceCode,
      isActive: serviceData.isActive ?? true,
      isStandard: serviceData.isStandard ?? false,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.SERVICES), newService);

    logger.info('Service created', { id: docRef.id, serviceCode });
    const created: Service = { ...newService, id: docRef.id };
    return created;
  } catch (error) {
    logger.error('Failed to create service', { error });
    throw error;
  }
}

/**
 * Get a service by ID
 */
export async function getServiceById(db: Firestore, serviceId: string): Promise<Service | null> {
  const docSnap = await getDoc(doc(db, COLLECTIONS.SERVICES, serviceId));
  if (!docSnap.exists()) return null;
  return docToTyped<Service>(docSnap.id, docSnap.data());
}

/**
 * Get a service by service code
 */
export async function getServiceByCode(
  db: Firestore,
  serviceCode: string
): Promise<Service | null> {
  const q = query(
    collection(db, COLLECTIONS.SERVICES),
    where('serviceCode', '==', serviceCode),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty || !snap.docs[0]) return null;
  const d = snap.docs[0];
  return docToTyped<Service>(d.id, d.data());
}

/**
 * List all active services, optionally filtered by category
 */
export async function listServices(
  db: Firestore,
  options?: { category?: ServiceCategory; includeInactive?: boolean }
): Promise<Service[]> {
  const constraints = [];

  if (!options?.includeInactive) {
    constraints.push(where('isActive', '==', true));
  }

  if (options?.category) {
    constraints.push(where('category', '==', options.category));
  }

  constraints.push(orderBy('name', 'asc'));

  const q = query(collection(db, COLLECTIONS.SERVICES), ...constraints);
  const snap = await getDocs(q);

  return snap.docs.map((d) => docToTyped<Service>(d.id, d.data()));
}

/**
 * Update an existing service
 */
export async function updateService(
  db: Firestore,
  serviceId: string,
  updates: Partial<Omit<Service, 'id' | 'serviceCode' | 'createdAt' | 'createdBy'>>,
  userId: string
): Promise<void> {
  // rule5-exempt: firestore.rules enforce the permission for this collection — client-side requirePermission is defense-in-depth deferred to a future hardening pass (the static-export build can't make client-side gates load-bearing)
  try {
    logger.info('Updating service', { serviceId });

    const docRef = doc(db, COLLECTIONS.SERVICES, serviceId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    logger.info('Service updated', { serviceId });
  } catch (error) {
    logger.error('Failed to update service', { error, serviceId });
    throw error;
  }
}

/**
 * Soft-delete a service (set isActive = false)
 */
export async function deleteService(
  db: Firestore,
  serviceId: string,
  userId: string
): Promise<void> {
  await updateService(db, serviceId, { isActive: false }, userId);
  logger.info('Service soft-deleted', { serviceId });
}

/**
 * Restore a soft-deleted service
 */
export async function restoreService(
  db: Firestore,
  serviceId: string,
  userId: string
): Promise<void> {
  await updateService(db, serviceId, { isActive: true }, userId);
  logger.info('Service restored', { serviceId });
}

const SERVICE_CODE_PREFIXES: Record<string, string> = {
  ENGINEERING: 'ENG',
  FABRICATION: 'FAB',
  INSPECTION: 'INS',
  TESTING: 'TST',
  TRANSPORTATION: 'TRN',
  ERECTION: 'ERC',
  COMMISSIONING: 'COM',
  CONSULTING: 'CON',
  CALIBRATION: 'CAL',
  MAINTENANCE: 'MNT',
  TRAINING: 'TRG',
  OTHER: 'OTH',
};

/**
 * Pure formatter for service codes: SVC-{CATEGORY_PREFIX}-{SEQUENCE}.
 * Exported so tests can pin the byte-exact format.
 */
export function formatServiceCode(category: ServiceCategory | string, sequence: number): string {
  const prefix = SERVICE_CODE_PREFIXES[category] || 'GEN';
  return `SVC-${prefix}-${String(sequence).padStart(3, '0')}`;
}

/**
 * Generate a service code based on category, via the shared counter-backed
 * generator (known-gaps 2.4 — the old count-based scheme was race-prone and
 * collided after soft-deletes). On first use for a category the counter seeds
 * from the max existing code in that category so the sequence continues.
 */
async function generateServiceCode(db: Firestore, category: ServiceCategory): Promise<string> {
  const prefix = SERVICE_CODE_PREFIXES[category] || 'GEN';

  return generateCounterBackedNumber({
    counterKey: `svc-${prefix}`,
    counterType: 'service_code',
    counterMeta: { category },
    format: (sequence) => formatServiceCode(category, sequence),
    seed: async () => {
      // Max sequence across ALL services in the category, including
      // soft-deleted ones — a deleted service's code must not be reissued.
      const q = query(collection(db, COLLECTIONS.SERVICES), where('category', '==', category));
      const snap = await getDocs(q);
      let max = 0;
      for (const d of snap.docs) {
        const code = d.data().serviceCode;
        if (typeof code !== 'string') continue;
        const seq = parseInt(code.split('-')[2] || '', 10);
        if (!isNaN(seq) && seq > max) max = seq;
      }
      // Old scheme used count+1, so a category with N docs may have codes up
      // to SVC-XXX-NNN with N > max parsed — take the larger to be safe.
      return Math.max(max, snap.size);
    },
  });
}
