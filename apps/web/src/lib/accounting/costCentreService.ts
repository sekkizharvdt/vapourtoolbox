/**
 * Cost Centre Service
 *
 * Handles cost centre operations:
 * - List cost centres
 * - Create cost centres (manual, non-project-linked)
 * - Update cost centres
 * - Get cost centre details
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
  Timestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';

export interface CostCentre {
  id: string;
  code: string;
  name: string;
  description?: string;
  projectId?: string; // Optional: Link to project if auto-created

  // Budget tracking
  budgetAmount: number | null;
  budgetCurrency: string;
  actualSpent: number;
  variance: number | null;

  // Status
  isActive: boolean;
  autoCreated?: boolean; // Flag indicating if auto-created from project

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}

export interface CreateCostCentreInput {
  code: string;
  name: string;
  description?: string;
  budgetAmount?: number;
  budgetCurrency?: string;
  isActive?: boolean;
}

export interface UpdateCostCentreInput {
  name?: string;
  description?: string;
  budgetAmount?: number;
  budgetCurrency?: string;
  isActive?: boolean;
}

export interface ListCostCentresFilters {
  isActive?: boolean;
  autoCreated?: boolean;
  projectId?: string;
}

/**
 * List all cost centres with optional filters
 */
export async function listCostCentres(filters: ListCostCentresFilters = {}): Promise<CostCentre[]> {
  const { db } = getFirebase();

  try {
    const constraints: QueryConstraint[] = [];

    // Apply filters
    if (filters.isActive !== undefined) {
      constraints.push(where('isActive', '==', filters.isActive));
    }

    if (filters.autoCreated !== undefined) {
      constraints.push(where('autoCreated', '==', filters.autoCreated));
    }

    if (filters.projectId) {
      constraints.push(where('projectId', '==', filters.projectId));
    }

    // Order by code
    constraints.push(orderBy('code', 'asc'));

    const q = query(collection(db, 'costCentres'), ...constraints);
    const snapshot = await getDocs(q);

    const costCentres: CostCentre[] = [];
    snapshot.forEach((doc) => {
      const costCentre: CostCentre = {
        id: doc.id,
        ...doc.data(),
      } as unknown as CostCentre;
      costCentres.push(costCentre);
    });

    return costCentres;
  } catch (error) {
    console.error('[listCostCentres] Error:', error);
    throw new Error('Failed to list cost centres');
  }
}

/**
 * Get a single cost centre by ID
 */
export async function getCostCentreById(id: string): Promise<CostCentre | null> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, 'costCentres', id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const costCentre: CostCentre = {
      id: docSnap.id,
      ...docSnap.data(),
    } as unknown as CostCentre;
    return costCentre;
  } catch (error) {
    console.error('[getCostCentreById] Error:', error);
    throw new Error('Failed to get cost centre');
  }
}

/**
 * Create a new cost centre (manual, not linked to project)
 */
export async function createCostCentre(
  input: CreateCostCentreInput,
  userId: string
): Promise<{ id: string }> {
  const { db } = getFirebase();

  try {
    const now = Timestamp.now();

    const costCentreData = {
      code: input.code,
      name: input.name,
      description: input.description || '',
      projectId: null, // Manual cost centres don't have project linkage
      budgetAmount: input.budgetAmount || null,
      budgetCurrency: input.budgetCurrency || 'INR',
      actualSpent: 0,
      variance: null,
      isActive: input.isActive !== undefined ? input.isActive : true,
      autoCreated: false, // Manual cost centre
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    };

    const docRef = await addDoc(collection(db, 'costCentres'), costCentreData);

    return { id: docRef.id };
  } catch (error) {
    console.error('[createCostCentre] Error:', error);
    throw new Error('Failed to create cost centre');
  }
}

/**
 * Update an existing cost centre
 */
export async function updateCostCentre(
  id: string,
  input: UpdateCostCentreInput,
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const docRef = doc(db, 'costCentres', id);

    const updateData: Record<string, unknown> = {
      ...input,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error('[updateCostCentre] Error:', error);
    throw new Error('Failed to update cost centre');
  }
}

/**
 * Check if a cost centre code already exists
 */
export async function costCentreCodeExists(code: string): Promise<boolean> {
  const { db } = getFirebase();

  try {
    const q = query(collection(db, 'costCentres'), where('code', '==', code));
    const snapshot = await getDocs(q);

    return !snapshot.empty;
  } catch (error) {
    console.error('[costCentreCodeExists] Error:', error);
    return false;
  }
}
