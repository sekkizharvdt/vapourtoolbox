/**
 * Valve Service for SSOT
 *
 * Handles CRUD operations for process valves (LIST OF VALVES)
 * Valves include isolation, control, check, safety valves, etc.
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
import type { ProcessValve, ProcessValveInput } from '@vapour/types';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'valveService' });

// ============================================================================
// HELPERS
// ============================================================================

function getValvesCollection(projectId: string) {
  const { db } = getFirebase();
  return collection(db, SSOT_COLLECTIONS.VALVES(projectId));
}

function getValveDoc(projectId: string, valveId: string) {
  const { db } = getFirebase();
  return doc(db, SSOT_COLLECTIONS.VALVES(projectId), valveId);
}

function docToValve(docSnapshot: {
  id: string;
  data: () => Record<string, unknown> | undefined;
}): ProcessValve | null {
  const data = docSnapshot.data();
  if (!data) return null;

  return {
    id: docSnapshot.id,
    projectId: data.projectId as string,
    sNo: data.sNo as number,
    pidNo: data.pidNo as string,
    lineNumber: data.lineNumber as string,
    valveTag: data.valveTag as string,
    serviceLocation: data.serviceLocation as string,
    valveType: data.valveType as string,
    endConnection: data.endConnection as string,
    sizeNB: data.sizeNB as string,
    fluid: data.fluid as string,
    pressureMin: data.pressureMin as number | undefined,
    pressureNor: data.pressureNor as number | undefined,
    pressureMax: data.pressureMax as number | undefined,
    temperatureMin: data.temperatureMin as number | undefined,
    temperatureNor: data.temperatureNor as number | undefined,
    temperatureMax: data.temperatureMax as number | undefined,
    flowMin: data.flowMin as number | undefined,
    flowNor: data.flowNor as number | undefined,
    flowMax: data.flowMax as number | undefined,
    deltaPressure: data.deltaPressure as number | undefined,
    valveOperation: data.valveOperation as string | undefined,
    type: data.type as string | undefined,
    endConnectionDetail: data.endConnectionDetail as string | undefined,
    bodyMaterial: data.bodyMaterial as string | undefined,
    trimMaterial: data.trimMaterial as string | undefined,
    seatMaterial: data.seatMaterial as string | undefined,
    packingMaterial: data.packingMaterial as string | undefined,
    leakageClass: data.leakageClass as string | undefined,
    signalLocal: data.signalLocal as string | undefined,
    signalPLC: data.signalPLC as string | undefined,
    ioType: data.ioType as string | undefined,
    modelNo: data.modelNo as string | undefined,
    accessories: data.accessories as string | undefined,
    remarks: data.remarks as string | undefined,
    createdAt: data.createdAt as Timestamp,
    createdBy: data.createdBy as string,
    updatedAt: data.updatedAt as Timestamp,
    updatedBy: data.updatedBy as string,
  };
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

export async function listValves(projectId: string): Promise<ProcessValve[]> {
  logger.debug('listValves', { projectId });

  const valvesRef = getValvesCollection(projectId);
  const q = query(valvesRef, orderBy('sNo', 'asc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(docToValve).filter((v): v is ProcessValve => v !== null);
}

export async function getValve(projectId: string, valveId: string): Promise<ProcessValve | null> {
  logger.debug('getValve', { projectId, valveId });

  const docRef = getValveDoc(projectId, valveId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;
  return docToValve(snapshot);
}

export function subscribeToValves(
  projectId: string,
  onUpdate: (valves: ProcessValve[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const valvesRef = getValvesCollection(projectId);
  const q = query(valvesRef, orderBy('sNo', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const valves = snapshot.docs.map(docToValve).filter((v): v is ProcessValve => v !== null);
      onUpdate(valves);
    },
    (error) => {
      logger.error('subscribeToValves error', { error });
      onError?.(error);
    }
  );
}

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

export async function createValve(
  projectId: string,
  input: ProcessValveInput,
  userId: string
): Promise<string> {
  logger.debug('createValve', { projectId, input });

  const valvesRef = getValvesCollection(projectId);
  const now = Timestamp.now();

  const valveData = {
    projectId,
    ...input,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,
  };

  const docRef = await addDoc(valvesRef, valveData);
  logger.info('Valve created', { projectId, valveId: docRef.id });

  return docRef.id;
}

export async function updateValve(
  projectId: string,
  valveId: string,
  input: Partial<ProcessValveInput>,
  userId: string
): Promise<void> {
  logger.debug('updateValve', { projectId, valveId, input });

  const docRef = getValveDoc(projectId, valveId);

  await updateDoc(docRef, {
    ...input,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  logger.info('Valve updated', { projectId, valveId });
}

export async function deleteValve(projectId: string, valveId: string): Promise<void> {
  logger.debug('deleteValve', { projectId, valveId });

  const docRef = getValveDoc(projectId, valveId);
  await deleteDoc(docRef);

  logger.info('Valve deleted', { projectId, valveId });
}
