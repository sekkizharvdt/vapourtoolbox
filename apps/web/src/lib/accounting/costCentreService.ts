import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  Timestamp,
  Firestore,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { CostCentre } from '@vapour/types';
import { logger } from '@vapour/logger';

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
    // Check if cost centre already exists for this project
    const existingQuery = query(
      collection(db, COLLECTIONS.COST_CENTRES),
      where('projectId', '==', projectId)
    );
    const existingSnapshot = await getDocs(existingQuery);

    if (!existingSnapshot.empty) {
      const existingDoc = existingSnapshot.docs[0];
      if (existingDoc) {
        logger.info('Cost centre already exists for project', {
          projectId,
          costCentreId: existingDoc.id,
        });
        return existingDoc.id;
      }
    }

    // Generate cost centre code from project code
    // Example: Project PRJ-001 -> Cost Centre CC-PRJ-001
    const costCentreCode = `CC-${projectCode}`;

    // Create cost centre
    const costCentreData: Omit<CostCentre, 'id'> = {
      code: costCentreCode,
      name: `${projectName} - Cost Centre`,
      description: `Auto-created cost centre for project ${projectCode}`,
      projectId,
      budgetAmount,
      budgetCurrency: 'INR',
      actualSpent: 0,
      variance: budgetAmount !== null ? budgetAmount : null,
      isActive: true,
      autoCreated: true,
      createdAt: Timestamp.now() as unknown as Date,
      createdBy: userId,
      updatedAt: Timestamp.now() as unknown as Date,
      updatedBy: userId,
    };

    const costCentreRef = await addDoc(collection(db, COLLECTIONS.COST_CENTRES), costCentreData);

    logger.info('Cost centre created for project', {
      projectId,
      costCentreId: costCentreRef.id,
      costCentreCode,
      userName,
    });

    return costCentreRef.id;
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
    const data = docSnapshot.data();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return {
      id: docSnapshot.id,
      ...data,
    } as CostCentre;
  } catch (error) {
    logger.error('Failed to get cost centre for project', { error, projectId });
    throw error;
  }
}
