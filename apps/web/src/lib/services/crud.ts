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

const logger = createLogger({ context: 'serviceService:crud' });

/**
 * Create a new service in the catalog
 */
export async function createService(
  db: Firestore,
  serviceData: Omit<Service, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
  userId: string
): Promise<Service> {
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
    const newService: Omit<Service, 'id'> = {
      ...serviceData,
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

/**
 * Generate a service code based on category
 * Format: SVC-{CATEGORY_PREFIX}-{SEQUENCE}
 */
async function generateServiceCode(db: Firestore, category: ServiceCategory): Promise<string> {
  const prefixMap: Record<string, string> = {
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

  const prefix = prefixMap[category] || 'GEN';

  // Count existing services in this category to determine next sequence
  const q = query(collection(db, COLLECTIONS.SERVICES), where('category', '==', category));
  const snap = await getDocs(q);
  const seq = String(snap.size + 1).padStart(3, '0');

  return `SVC-${prefix}-${seq}`;
}
