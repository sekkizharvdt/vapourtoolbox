/**
 * Instrument Service for SSOT
 *
 * Handles CRUD operations for process instruments (LIST OF INSTRUMENTS)
 * Instruments include pressure gauges, transmitters, flow meters, etc.
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
import type { ProcessInstrument, ProcessInstrumentInput } from '@vapour/types';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'instrumentService' });

// ============================================================================
// HELPERS
// ============================================================================

function getInstrumentsCollection(projectId: string) {
  const { db } = getFirebase();
  return collection(db, SSOT_COLLECTIONS.INSTRUMENTS(projectId));
}

function getInstrumentDoc(projectId: string, instrumentId: string) {
  const { db } = getFirebase();
  return doc(db, SSOT_COLLECTIONS.INSTRUMENTS(projectId), instrumentId);
}

function docToInstrument(docSnapshot: {
  id: string;
  data: () => Record<string, unknown> | undefined;
}): ProcessInstrument | null {
  const data = docSnapshot.data();
  if (!data) return null;

  return {
    id: docSnapshot.id,
    projectId: data.projectId as string,
    sNo: data.sNo as number,
    pidNo: data.pidNo as string,
    lineNo: data.lineNo as string,
    tagNo: data.tagNo as string,
    instrumentValveNo: data.instrumentValveNo as string | undefined,
    serviceLocation: data.serviceLocation as string,
    instrumentType: data.instrumentType as string,
    fluid: data.fluid as string,
    pressureMin: data.pressureMin as number | undefined,
    pressureNor: data.pressureNor as number | undefined,
    pressureMax: data.pressureMax as number | undefined,
    temperatureMin: data.temperatureMin as number | undefined,
    temperatureNor: data.temperatureNor as number | undefined,
    temperatureMax: data.temperatureMax as number | undefined,
    flowRateMin: data.flowRateMin as number | undefined,
    flowRateNor: data.flowRateNor as number | undefined,
    flowRateMax: data.flowRateMax as number | undefined,
    tdsMin: data.tdsMin as number | undefined,
    tdsNor: data.tdsNor as number | undefined,
    tdsMax: data.tdsMax as number | undefined,
    instRange: data.instRange as string | undefined,
    type: data.type as string | undefined,
    endConnection: data.endConnection as string | undefined,
    moc: data.moc as string | undefined,
    installation: data.installation as string | undefined,
    accessories: data.accessories as string | undefined,
    hookupDiagram: data.hookupDiagram as string | undefined,
    signalLocal: data.signalLocal as string | undefined,
    signalPLC: data.signalPLC as string | undefined,
    ioType: data.ioType as string | undefined,
    modelNo: data.modelNo as string | undefined,
    accessoriesExtra: data.accessoriesExtra as string | undefined,
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

export async function listInstruments(projectId: string): Promise<ProcessInstrument[]> {
  logger.debug('listInstruments', { projectId });

  const instrumentsRef = getInstrumentsCollection(projectId);
  const q = query(instrumentsRef, orderBy('sNo', 'asc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(docToInstrument).filter((i): i is ProcessInstrument => i !== null);
}

export async function getInstrument(
  projectId: string,
  instrumentId: string
): Promise<ProcessInstrument | null> {
  logger.debug('getInstrument', { projectId, instrumentId });

  const docRef = getInstrumentDoc(projectId, instrumentId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;
  return docToInstrument(snapshot);
}

export function subscribeToInstruments(
  projectId: string,
  onUpdate: (instruments: ProcessInstrument[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const instrumentsRef = getInstrumentsCollection(projectId);
  const q = query(instrumentsRef, orderBy('sNo', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const instruments = snapshot.docs
        .map(docToInstrument)
        .filter((i): i is ProcessInstrument => i !== null);
      onUpdate(instruments);
    },
    (error) => {
      logger.error('subscribeToInstruments error', { error });
      onError?.(error);
    }
  );
}

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

export async function createInstrument(
  projectId: string,
  input: ProcessInstrumentInput,
  userId: string
): Promise<string> {
  logger.debug('createInstrument', { projectId, input });

  const instrumentsRef = getInstrumentsCollection(projectId);
  const now = Timestamp.now();

  const instrumentData = {
    projectId,
    ...input,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,
  };

  const docRef = await addDoc(instrumentsRef, instrumentData);
  logger.info('Instrument created', { projectId, instrumentId: docRef.id });

  return docRef.id;
}

export async function updateInstrument(
  projectId: string,
  instrumentId: string,
  input: Partial<ProcessInstrumentInput>,
  userId: string
): Promise<void> {
  logger.debug('updateInstrument', { projectId, instrumentId, input });

  const docRef = getInstrumentDoc(projectId, instrumentId);

  await updateDoc(docRef, {
    ...input,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  logger.info('Instrument updated', { projectId, instrumentId });
}

export async function deleteInstrument(projectId: string, instrumentId: string): Promise<void> {
  logger.debug('deleteInstrument', { projectId, instrumentId });

  const docRef = getInstrumentDoc(projectId, instrumentId);
  await deleteDoc(docRef);

  logger.info('Instrument deleted', { projectId, instrumentId });
}
