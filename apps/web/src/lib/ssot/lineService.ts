/**
 * Line Service for SSOT
 *
 * Handles CRUD operations for process lines (LIST OF LINES)
 * Lines represent piping with flow data and calculated sizing.
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
import type { ProcessLine, ProcessLineInput } from '@vapour/types';
import { createLogger } from '@vapour/logger';
import { enrichLineInput } from './lineCalculations';

const logger = createLogger({ context: 'lineService' });

// ============================================================================
// HELPERS
// ============================================================================

function getLinesCollection(projectId: string) {
  const { db } = getFirebase();
  return collection(db, SSOT_COLLECTIONS.LINES(projectId));
}

function getLineDoc(projectId: string, lineId: string) {
  const { db } = getFirebase();
  return doc(db, SSOT_COLLECTIONS.LINES(projectId), lineId);
}

function docToLine(docSnapshot: {
  id: string;
  data: () => Record<string, unknown> | undefined;
}): ProcessLine | null {
  const data = docSnapshot.data();
  if (!data) return null;

  return {
    id: docSnapshot.id,
    projectId: data.projectId as string,
    sNo: data.sNo as number,
    lineNumber: data.lineNumber as string,
    fluid: data.fluid as string,
    inputDataTag: data.inputDataTag as string,
    flowRateKgS: data.flowRateKgS as number,
    density: data.density as number,
    designVelocity: data.designVelocity as number,
    calculatedID: data.calculatedID as number,
    selectedID: data.selectedID as number,
    actualVelocity: data.actualVelocity as number,
    pipeSize: data.pipeSize as string | undefined,
    schedule: data.schedule as string | undefined,
    createdAt: data.createdAt as Timestamp,
    createdBy: data.createdBy as string,
    updatedAt: data.updatedAt as Timestamp,
    updatedBy: data.updatedBy as string,
  };
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

export async function listLines(projectId: string): Promise<ProcessLine[]> {
  logger.debug('listLines', { projectId });

  const linesRef = getLinesCollection(projectId);
  const q = query(linesRef, orderBy('sNo', 'asc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(docToLine).filter((l): l is ProcessLine => l !== null);
}

export async function getLine(projectId: string, lineId: string): Promise<ProcessLine | null> {
  logger.debug('getLine', { projectId, lineId });

  const docRef = getLineDoc(projectId, lineId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;
  return docToLine(snapshot);
}

export function subscribeToLines(
  projectId: string,
  onUpdate: (lines: ProcessLine[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const linesRef = getLinesCollection(projectId);
  const q = query(linesRef, orderBy('sNo', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const lines = snapshot.docs.map(docToLine).filter((l): l is ProcessLine => l !== null);
      onUpdate(lines);
    },
    (error) => {
      logger.error('subscribeToLines error', { error });
      onError?.(error);
    }
  );
}

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

export async function createLine(
  projectId: string,
  input: ProcessLineInput,
  userId: string
): Promise<string> {
  logger.debug('createLine', { projectId, input });

  // Enrich input with calculated properties
  const enrichedInput = enrichLineInput(input);

  const linesRef = getLinesCollection(projectId);
  const now = Timestamp.now();

  // Filter out undefined values (Firestore doesn't accept undefined)
  const filteredInput = Object.fromEntries(
    Object.entries(enrichedInput).filter(([, value]) => value !== undefined)
  );

  const lineData = {
    projectId,
    ...filteredInput,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,
  };

  const docRef = await addDoc(linesRef, lineData);
  logger.info('Line created', { projectId, lineId: docRef.id });

  return docRef.id;
}

export async function updateLine(
  projectId: string,
  lineId: string,
  input: Partial<ProcessLineInput>,
  userId: string
): Promise<void> {
  logger.debug('updateLine', { projectId, lineId, input });

  const docRef = getLineDoc(projectId, lineId);

  // Get current line to merge
  const current = await getLine(projectId, lineId);
  if (!current) {
    throw new Error(`Line ${lineId} not found`);
  }

  // Merge and recalculate
  const merged: ProcessLineInput = {
    sNo: input.sNo ?? current.sNo,
    lineNumber: input.lineNumber ?? current.lineNumber,
    fluid: input.fluid ?? current.fluid,
    inputDataTag: input.inputDataTag ?? current.inputDataTag,
    flowRateKgS: input.flowRateKgS ?? current.flowRateKgS,
    density: input.density ?? current.density,
    designVelocity: input.designVelocity ?? current.designVelocity,
    calculatedID: input.calculatedID ?? current.calculatedID,
    selectedID: input.selectedID ?? current.selectedID,
    actualVelocity: input.actualVelocity ?? current.actualVelocity,
    pipeSize: input.pipeSize ?? current.pipeSize,
    schedule: input.schedule ?? current.schedule,
  };

  const needsRecalc =
    input.flowRateKgS !== undefined ||
    input.density !== undefined ||
    input.designVelocity !== undefined ||
    input.selectedID !== undefined;

  const enriched = needsRecalc ? enrichLineInput(merged) : merged;

  // Filter out undefined values (Firestore doesn't accept undefined)
  const filteredEnriched = Object.fromEntries(
    Object.entries(enriched).filter(([, value]) => value !== undefined)
  );

  await updateDoc(docRef, {
    ...filteredEnriched,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  logger.info('Line updated', { projectId, lineId });
}

export async function deleteLine(projectId: string, lineId: string): Promise<void> {
  logger.debug('deleteLine', { projectId, lineId });

  const docRef = getLineDoc(projectId, lineId);
  await deleteDoc(docRef);

  logger.info('Line deleted', { projectId, lineId });
}
