import {
  collection,
  doc,
  getDoc,
  setDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { CostCentre } from '@vapour/types';
import { logger } from '@vapour/logger';
import { docToTyped } from '@/lib/firebase/typeHelpers';

/**
 * Create a cost centre for a project when charter is approved
 */
export async function createProjectCostCentre(
  db: Firestore,
  projectId: string,
  projectCode: string,
  projectName: string,
  budgetAmount: number | null,
  userId: string,
  userName: string
): Promise<string> {
  try {
    // AC-14: Use deterministic ID to prevent race condition from concurrent creation
    const costCentreId = `CC-${projectId}`;
    const existingRef = doc(db, COLLECTIONS.COST_CENTRES, costCentreId);
    const existingDoc = await getDoc(existingRef);

    if (existingDoc.exists()) {
      logger.info('Cost centre already exists for project', {
        projectId,
        costCentreId,
      });
      return costCentreId;
    }

    // Generate cost centre code from project code
    // Example: Project PRJ-001 -> Cost Centre CC-PRJ-001
    const costCentreCode = `CC-${projectCode}`;

    // Create cost centre with deterministic ID (setDoc is idempotent on same ID)
    const costCentreData: Omit<CostCentre, 'id'> = {
      code: costCentreCode,
      name: `${projectName} - Cost Centre`,
      description: `Auto-created cost centre for project ${projectCode}`,
      category: 'PROJECT',
      projectId,
      budgetAmount,
      budgetCurrency: 'INR',
      actualSpent: 0,
      variance: budgetAmount !== null ? budgetAmount : null,
      isActive: true,
      autoCreated: true,
      // Note: serverTimestamp() returns a FieldValue that Firestore converts to Date on read
      createdAt: serverTimestamp() as ReturnType<typeof serverTimestamp> & Date,
      createdBy: userId,
      updatedAt: serverTimestamp() as ReturnType<typeof serverTimestamp> & Date,
      updatedBy: userId,
    };

    await setDoc(existingRef, costCentreData);

    logger.info('Cost centre created for project', {
      projectId,
      costCentreId,
      costCentreCode,
      userName,
    });

    return costCentreId;
  } catch (error) {
    logger.error('Failed to create cost centre for project', {
      error,
      projectId,
      projectCode,
      userName,
    });
    throw error;
  }
}

/**
 * Get cost centre for a project
 */
export async function getProjectCostCentre(
  db: Firestore,
  projectId: string
): Promise<CostCentre | null> {
  try {
    const costCentreQuery = query(
      collection(db, COLLECTIONS.COST_CENTRES),
      where('projectId', '==', projectId)
    );
    const snapshot = await getDocs(costCentreQuery);

    if (snapshot.empty) {
      return null;
    }

    const docSnapshot = snapshot.docs[0];
    if (!docSnapshot) {
      return null;
    }
    return docToTyped<CostCentre>(docSnapshot.id, docSnapshot.data());
  } catch (error) {
    logger.error('Failed to get cost centre for project', { error, projectId });
    throw error;
  }
}
