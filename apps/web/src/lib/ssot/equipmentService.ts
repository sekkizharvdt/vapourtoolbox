/**
 * Equipment Service for SSOT
 *
 * Handles CRUD operations for process equipment (LIST_OF_EQUIPMENT)
 * Equipment represents process units like vessels, heat exchangers,
 * pumps, etc. with inlet/outlet stream references.
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
import type { ProcessEquipment, ProcessEquipmentInput } from '@vapour/types';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'equipmentService' });

// ============================================================================
// HELPERS
// ============================================================================

function getEquipmentCollection(projectId: string) {
  const { db } = getFirebase();
  return collection(db, SSOT_COLLECTIONS.EQUIPMENT(projectId));
}

function getEquipmentDoc(projectId: string, equipmentId: string) {
  const { db } = getFirebase();
  return doc(db, SSOT_COLLECTIONS.EQUIPMENT(projectId), equipmentId);
}

function docToEquipment(docSnapshot: {
  id: string;
  data: () => Record<string, unknown> | undefined;
}): ProcessEquipment | null {
  const data = docSnapshot.data();
  if (!data) return null;

  return {
    id: docSnapshot.id,
    projectId: data.projectId as string,
    equipmentName: data.equipmentName as string,
    equipmentTag: data.equipmentTag as string,
    operatingPressure: data.operatingPressure as number,
    operatingTemperature: data.operatingTemperature as number,
    fluidIn: (data.fluidIn as string[]) || [],
    fluidOut: (data.fluidOut as string[]) || [],
    createdAt: data.createdAt as Timestamp,
    createdBy: data.createdBy as string,
    updatedAt: data.updatedAt as Timestamp,
    updatedBy: data.updatedBy as string,
  };
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

export async function listEquipment(projectId: string): Promise<ProcessEquipment[]> {
  logger.debug('listEquipment', { projectId });

  const equipmentRef = getEquipmentCollection(projectId);
  const q = query(equipmentRef, orderBy('equipmentTag', 'asc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(docToEquipment).filter((e): e is ProcessEquipment => e !== null);
}

export async function getEquipment(
  projectId: string,
  equipmentId: string
): Promise<ProcessEquipment | null> {
  logger.debug('getEquipment', { projectId, equipmentId });

  const docRef = getEquipmentDoc(projectId, equipmentId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;
  return docToEquipment(snapshot);
}

export function subscribeToEquipment(
  projectId: string,
  onUpdate: (equipment: ProcessEquipment[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const equipmentRef = getEquipmentCollection(projectId);
  const q = query(equipmentRef, orderBy('equipmentTag', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const equipment = snapshot.docs
        .map(docToEquipment)
        .filter((e): e is ProcessEquipment => e !== null);
      onUpdate(equipment);
    },
    (error) => {
      logger.error('subscribeToEquipment error', { error });
      onError?.(error);
    }
  );
}

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

export async function createEquipment(
  projectId: string,
  input: ProcessEquipmentInput,
  userId: string
): Promise<string> {
  logger.debug('createEquipment', { projectId, input });

  const equipmentRef = getEquipmentCollection(projectId);
  const now = Timestamp.now();

  const equipmentData = {
    projectId,
    ...input,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,
  };

  const docRef = await addDoc(equipmentRef, equipmentData);
  logger.info('Equipment created', { projectId, equipmentId: docRef.id });

  return docRef.id;
}

export async function updateEquipment(
  projectId: string,
  equipmentId: string,
  input: Partial<ProcessEquipmentInput>,
  userId: string
): Promise<void> {
  logger.debug('updateEquipment', { projectId, equipmentId, input });

  const docRef = getEquipmentDoc(projectId, equipmentId);

  await updateDoc(docRef, {
    ...input,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  logger.info('Equipment updated', { projectId, equipmentId });
}

export async function deleteEquipment(projectId: string, equipmentId: string): Promise<void> {
  logger.debug('deleteEquipment', { projectId, equipmentId });

  const docRef = getEquipmentDoc(projectId, equipmentId);
  await deleteDoc(docRef);

  logger.info('Equipment deleted', { projectId, equipmentId });
}
