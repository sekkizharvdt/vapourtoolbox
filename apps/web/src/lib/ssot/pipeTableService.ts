/**
 * Pipe Table Service for SSOT
 *
 * Handles CRUD operations for pipe sizing lookup table.
 * Maps calculated inner diameter to standard pipe sizes.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { SSOT_COLLECTIONS } from '@vapour/firebase';
import type { PipeSize, PipeSizeInput } from '@vapour/types';
import { createLogger } from '@vapour/logger';
import { validateSSOTWriteAccess, type SSOTAccessCheck } from './ssotAuth';

const logger = createLogger({ context: 'pipeTableService' });

// ============================================================================
// HELPERS
// ============================================================================

function getPipeTableCollection(projectId: string) {
  const { db } = getFirebase();
  return collection(db, SSOT_COLLECTIONS.PIPE_TABLE(projectId));
}

function getPipeTableDoc(projectId: string, pipeId: string) {
  const { db } = getFirebase();
  return doc(db, SSOT_COLLECTIONS.PIPE_TABLE(projectId), pipeId);
}

function docToPipeSize(docSnapshot: {
  id: string;
  data: () => Record<string, unknown> | undefined;
}): PipeSize | null {
  const data = docSnapshot.data();
  if (!data) return null;

  const outerDiameter = data.outerDiameter as number;
  const thicknessSch40 = data.thicknessSch40 as number;

  return {
    id: docSnapshot.id,
    projectId: data.projectId as string,
    idRangeMin: data.idRangeMin as number,
    idRangeMax: data.idRangeMax as number,
    pipeSizeNB: data.pipeSizeNB as number,
    outerDiameter,
    thicknessSch40,
    innerDiameter: outerDiameter - 2 * thicknessSch40,
    createdAt: data.createdAt as Timestamp,
    createdBy: data.createdBy as string,
  };
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

export async function listPipeSizes(projectId: string): Promise<PipeSize[]> {
  logger.debug('listPipeSizes', { projectId });

  const pipeTableRef = getPipeTableCollection(projectId);
  const q = query(pipeTableRef, orderBy('pipeSizeNB', 'asc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(docToPipeSize).filter((p): p is PipeSize => p !== null);
}

export async function getPipeSize(projectId: string, pipeId: string): Promise<PipeSize | null> {
  logger.debug('getPipeSize', { projectId, pipeId });

  const docRef = getPipeTableDoc(projectId, pipeId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;
  return docToPipeSize(snapshot);
}

export function subscribeToPipeSizes(
  projectId: string,
  onUpdate: (pipes: PipeSize[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const pipeTableRef = getPipeTableCollection(projectId);
  const q = query(pipeTableRef, orderBy('pipeSizeNB', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const pipes = snapshot.docs.map(docToPipeSize).filter((p): p is PipeSize => p !== null);
      onUpdate(pipes);
    },
    (error) => {
      logger.error('subscribeToPipeSizes error', { error });
      onError?.(error);
    }
  );
}

// ============================================================================
// LOOKUP FUNCTIONS
// ============================================================================

/**
 * Find the appropriate pipe size for a given inner diameter
 *
 * @param pipes - Array of pipe sizes
 * @param innerDiameter - Required inner diameter in mm
 * @returns Matching PipeSize or null if not found
 */
export function findPipeSizeForID(pipes: PipeSize[], innerDiameter: number): PipeSize | null {
  // Sort by NB ascending (should already be sorted)
  const sorted = [...pipes].sort((a, b) => a.pipeSizeNB - b.pipeSizeNB);

  // Find the first pipe size where ID range includes the required diameter
  for (const pipe of sorted) {
    if (innerDiameter >= pipe.idRangeMin && innerDiameter < pipe.idRangeMax) {
      return pipe;
    }
  }

  // If larger than all ranges, return the largest size
  const lastPipe = sorted[sorted.length - 1];
  if (sorted.length > 0 && lastPipe && innerDiameter >= lastPipe.idRangeMax) {
    return lastPipe;
  }

  return null;
}

/**
 * Calculate inner diameter from outer diameter and wall thickness
 *
 * ID = OD - 2 × thickness
 */
export function calculateInnerDiameter(outerDiameter: number, wallThickness: number): number {
  return outerDiameter - 2 * wallThickness;
}

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

export async function createPipeSize(
  projectId: string,
  input: PipeSizeInput,
  userId: string,
  accessCheck?: SSOTAccessCheck
): Promise<string> {
  logger.debug('createPipeSize', { projectId, input });

  // PE-14/PE-18: Validate write access
  validateSSOTWriteAccess(userId, projectId, accessCheck);

  const pipeTableRef = getPipeTableCollection(projectId);
  const now = Timestamp.now();

  const pipeData = {
    projectId,
    ...input,
    createdAt: now,
    createdBy: userId,
  };

  const docRef = await addDoc(pipeTableRef, pipeData);
  logger.info('PipeSize created', { projectId, pipeId: docRef.id });

  return docRef.id;
}

export async function updatePipeSize(
  projectId: string,
  pipeId: string,
  input: Partial<PipeSizeInput>,
  userId: string,
  accessCheck?: SSOTAccessCheck
): Promise<void> {
  logger.debug('updatePipeSize', { projectId, pipeId, input });

  // PE-14/PE-18: Validate write access
  validateSSOTWriteAccess(userId, projectId, accessCheck);

  const docRef = getPipeTableDoc(projectId, pipeId);

  await updateDoc(docRef, {
    ...input,
  });

  logger.info('PipeSize updated', { projectId, pipeId });
}

export async function deletePipeSize(
  projectId: string,
  pipeId: string,
  userId?: string,
  accessCheck?: SSOTAccessCheck
): Promise<void> {
  logger.debug('deletePipeSize', { projectId, pipeId });

  // PE-14/PE-18: Validate write access
  if (userId && accessCheck) {
    validateSSOTWriteAccess(userId, projectId, accessCheck);
  }

  const docRef = getPipeTableDoc(projectId, pipeId);
  await deleteDoc(docRef);

  logger.info('PipeSize deleted', { projectId, pipeId });
}

// ============================================================================
// SEED DATA
// ============================================================================

/**
 * Default pipe table based on ASME B36.10 Schedule 40
 * These can be seeded into a new project.
 */
export const DEFAULT_PIPE_TABLE: PipeSizeInput[] = [
  { idRangeMin: 0, idRangeMax: 15, pipeSizeNB: 15, outerDiameter: 21.3, thicknessSch40: 2.77 },
  { idRangeMin: 15, idRangeMax: 20, pipeSizeNB: 20, outerDiameter: 26.7, thicknessSch40: 2.87 },
  { idRangeMin: 20, idRangeMax: 27, pipeSizeNB: 25, outerDiameter: 33.4, thicknessSch40: 3.38 },
  { idRangeMin: 27, idRangeMax: 36, pipeSizeNB: 32, outerDiameter: 42.2, thicknessSch40: 3.56 },
  { idRangeMin: 36, idRangeMax: 43, pipeSizeNB: 40, outerDiameter: 48.3, thicknessSch40: 3.68 },
  { idRangeMin: 43, idRangeMax: 55, pipeSizeNB: 50, outerDiameter: 60.3, thicknessSch40: 3.91 },
  { idRangeMin: 55, idRangeMax: 69, pipeSizeNB: 65, outerDiameter: 73.0, thicknessSch40: 5.16 },
  { idRangeMin: 69, idRangeMax: 85, pipeSizeNB: 80, outerDiameter: 88.9, thicknessSch40: 5.49 },
  { idRangeMin: 85, idRangeMax: 105, pipeSizeNB: 100, outerDiameter: 114.3, thicknessSch40: 6.02 },
  { idRangeMin: 105, idRangeMax: 135, pipeSizeNB: 125, outerDiameter: 141.3, thicknessSch40: 6.55 },
  { idRangeMin: 135, idRangeMax: 160, pipeSizeNB: 150, outerDiameter: 168.3, thicknessSch40: 7.11 },
  { idRangeMin: 160, idRangeMax: 210, pipeSizeNB: 200, outerDiameter: 219.1, thicknessSch40: 8.18 },
  { idRangeMin: 210, idRangeMax: 260, pipeSizeNB: 250, outerDiameter: 273.1, thicknessSch40: 9.27 },
  { idRangeMin: 260, idRangeMax: 315, pipeSizeNB: 300, outerDiameter: 323.9, thicknessSch40: 9.53 },
  { idRangeMin: 315, idRangeMax: 365, pipeSizeNB: 350, outerDiameter: 355.6, thicknessSch40: 9.53 },
  { idRangeMin: 365, idRangeMax: 415, pipeSizeNB: 400, outerDiameter: 406.4, thicknessSch40: 9.53 },
  { idRangeMin: 415, idRangeMax: 470, pipeSizeNB: 450, outerDiameter: 457.0, thicknessSch40: 9.53 },
  { idRangeMin: 470, idRangeMax: 525, pipeSizeNB: 500, outerDiameter: 508.0, thicknessSch40: 9.53 },
  {
    idRangeMin: 525,
    idRangeMax: 1000,
    pipeSizeNB: 600,
    outerDiameter: 610.0,
    thicknessSch40: 9.53,
  },
];

/**
 * Seed default pipe table for a project
 */
export async function seedDefaultPipeTable(projectId: string, userId: string): Promise<void> {
  logger.info('Seeding default pipe table', { projectId });

  for (const pipe of DEFAULT_PIPE_TABLE) {
    await createPipeSize(projectId, pipe, userId);
  }

  logger.info('Default pipe table seeded', { projectId, count: DEFAULT_PIPE_TABLE.length });
}
