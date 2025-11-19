/**
 * Cost Configuration Service
 * Phase 4: Costing Configuration (Overhead, Contingency, Profit)
 *
 * CRUD operations for managing entity-level cost configurations
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  Firestore,
} from 'firebase/firestore';
import {
  CostConfiguration,
  CreateCostConfigurationInput,
  UpdateCostConfigurationInput,
  DEFAULT_OVERHEAD_CONFIG,
  DEFAULT_CONTINGENCY_CONFIG,
  DEFAULT_PROFIT_CONFIG,
} from '@vapour/types';
import { COLLECTIONS } from '@vapour/firebase';

/**
 * Create a new cost configuration for an entity
 */
export async function createCostConfiguration(
  db: Firestore,
  data: CreateCostConfigurationInput,
  userId: string
): Promise<CostConfiguration> {
  const now = Timestamp.now();

  const configData = {
    entityId: data.entityId,
    overhead: data.overhead || DEFAULT_OVERHEAD_CONFIG,
    contingency: data.contingency || DEFAULT_CONTINGENCY_CONFIG,
    profit: data.profit || DEFAULT_PROFIT_CONFIG,
    laborRates: data.laborRates,
    fabricationRates: data.fabricationRates,
    name: data.name,
    description: data.description,
    isActive: true,
    effectiveFrom: data.effectiveFrom || now,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    updatedBy: userId,
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.COST_CONFIGURATIONS), configData);

  const result = {
    id: docRef.id,
    ...configData,
  } satisfies CostConfiguration;
  return result;
}

/**
 * Get the active cost configuration for an entity
 * Returns the most recent configuration where:
 * - isActive = true
 * - effectiveFrom <= now
 */
export async function getActiveCostConfiguration(
  db: Firestore,
  entityId: string
): Promise<CostConfiguration | null> {
  const now = Timestamp.now();

  const q = query(
    collection(db, COLLECTIONS.COST_CONFIGURATIONS),
    where('entityId', '==', entityId),
    where('isActive', '==', true),
    where('effectiveFrom', '<=', now),
    orderBy('effectiveFrom', 'desc'),
    limit(1)
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return null;
  }

  const docSnap = querySnapshot.docs[0];
  if (!docSnap) {
    return null;
  }

  const result = {
    id: docSnap.id,
    ...(docSnap.data() as Omit<CostConfiguration, 'id'>),
  } satisfies CostConfiguration;
  return result;
}

/**
 * Get a specific cost configuration by ID
 */
export async function getCostConfiguration(
  db: Firestore,
  configId: string
): Promise<CostConfiguration | null> {
  const docRef = doc(db, COLLECTIONS.COST_CONFIGURATIONS, configId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  const result = {
    id: docSnap.id,
    ...(docSnap.data() as Omit<CostConfiguration, 'id'>),
  } satisfies CostConfiguration;
  return result;
}

/**
 * Update an existing cost configuration
 */
export async function updateCostConfiguration(
  db: Firestore,
  configId: string,
  data: UpdateCostConfigurationInput,
  userId: string
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.COST_CONFIGURATIONS, configId);

  const updateData: Record<string, unknown> = {
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  };

  // Only include fields that are provided
  if (data.overhead !== undefined) updateData.overhead = data.overhead;
  if (data.contingency !== undefined) updateData.contingency = data.contingency;
  if (data.profit !== undefined) updateData.profit = data.profit;
  if (data.laborRates !== undefined) updateData.laborRates = data.laborRates;
  if (data.fabricationRates !== undefined) updateData.fabricationRates = data.fabricationRates;
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  await updateDoc(docRef, updateData);
}

/**
 * List all cost configurations for an entity
 * Returns configurations ordered by effectiveFrom (newest first)
 */
export async function listCostConfigurations(
  db: Firestore,
  entityId: string
): Promise<CostConfiguration[]> {
  const q = query(
    collection(db, COLLECTIONS.COST_CONFIGURATIONS),
    where('entityId', '==', entityId),
    orderBy('effectiveFrom', 'desc')
  );

  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map((doc) => {
    const result = {
      id: doc.id,
      ...(doc.data() as Omit<CostConfiguration, 'id'>),
    } satisfies CostConfiguration;
    return result;
  });
}

/**
 * Deactivate a cost configuration
 * Sets isActive to false (soft delete)
 */
export async function deactivateCostConfiguration(
  db: Firestore,
  configId: string,
  userId: string
): Promise<void> {
  await updateCostConfiguration(db, configId, { isActive: false }, userId);
}

/**
 * Get the default cost configuration structure
 * Used when creating new configurations or when no active config exists
 */
export function getDefaultCostConfiguration(
  entityId: string
): Omit<CostConfiguration, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'> {
  return {
    entityId,
    overhead: DEFAULT_OVERHEAD_CONFIG,
    contingency: DEFAULT_CONTINGENCY_CONFIG,
    profit: DEFAULT_PROFIT_CONFIG,
    isActive: false,
    effectiveFrom: Timestamp.now(),
  };
}
