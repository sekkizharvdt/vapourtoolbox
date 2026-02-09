/**
 * Stream Service for SSOT
 *
 * Handles CRUD operations for process streams (INPUT_DATA)
 * Streams represent fluid flows in the process with properties like
 * flow rate, pressure, temperature, density, TDS, and enthalpy.
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
import { SSOT_COLLECTIONS, COLLECTIONS } from '@vapour/firebase';
import type { ProcessStream, ProcessStreamInput } from '@vapour/types';
import { createLogger } from '@vapour/logger';
import { enrichStreamInput } from './streamCalculations';

const logger = createLogger({ context: 'streamService' });

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get collection reference for streams subcollection
 */
function getStreamsCollection(projectId: string) {
  const { db } = getFirebase();
  return collection(db, SSOT_COLLECTIONS.STREAMS(projectId));
}

/**
 * Get document reference for a specific stream
 */
function getStreamDoc(projectId: string, streamId: string) {
  const { db } = getFirebase();
  return doc(db, SSOT_COLLECTIONS.STREAMS(projectId), streamId);
}

/**
 * Transform Firestore document to ProcessStream
 */
function docToStream(docSnapshot: {
  id: string;
  data: () => Record<string, unknown> | undefined;
}): ProcessStream | null {
  const data = docSnapshot.data();
  if (!data) return null;

  return {
    id: docSnapshot.id,
    projectId: data.projectId as string,
    lineTag: data.lineTag as string,
    description: data.description as string | undefined,
    flowRateKgS: data.flowRateKgS as number,
    flowRateKgHr: data.flowRateKgHr as number,
    pressureMbar: data.pressureMbar as number,
    pressureBar: data.pressureBar as number,
    temperature: data.temperature as number,
    density: data.density as number,
    tds: data.tds as number | undefined,
    enthalpy: data.enthalpy as number,
    fluidType: data.fluidType as ProcessStream['fluidType'],
    createdAt: data.createdAt as Timestamp,
    createdBy: data.createdBy as string,
    updatedAt: data.updatedAt as Timestamp,
    updatedBy: data.updatedBy as string,
  };
}

/**
 * PE-9: Validate that a project exists before SSOT operations
 */
async function validateProjectExists(projectId: string): Promise<void> {
  const { db } = getFirebase();
  const projectDoc = await getDoc(doc(db, COLLECTIONS.PROJECTS, projectId));
  if (!projectDoc.exists()) {
    throw new Error(
      `Project "${projectId}" not found. Cannot perform SSOT operation on a non-existent project.`
    );
  }
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Get all streams for a project
 */
export async function listStreams(projectId: string): Promise<ProcessStream[]> {
  logger.debug('listStreams', { projectId });

  const streamsRef = getStreamsCollection(projectId);
  const q = query(streamsRef, orderBy('lineTag', 'asc'));
  const snapshot = await getDocs(q);

  const streams = snapshot.docs.map(docToStream).filter((s): s is ProcessStream => s !== null);

  logger.debug('listStreams result', { count: streams.length });
  return streams;
}

/**
 * Get a single stream by ID
 */
export async function getStream(
  projectId: string,
  streamId: string
): Promise<ProcessStream | null> {
  logger.debug('getStream', { projectId, streamId });

  const docRef = getStreamDoc(projectId, streamId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    logger.warn('Stream not found', { projectId, streamId });
    return null;
  }

  return docToStream(snapshot);
}

/**
 * Subscribe to real-time stream updates
 */
export function subscribeToStreams(
  projectId: string,
  onUpdate: (streams: ProcessStream[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  logger.debug('subscribeToStreams', { projectId });

  const streamsRef = getStreamsCollection(projectId);
  const q = query(streamsRef, orderBy('lineTag', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const streams = snapshot.docs.map(docToStream).filter((s): s is ProcessStream => s !== null);
      onUpdate(streams);
    },
    (error) => {
      logger.error('subscribeToStreams error', { error });
      onError?.(error);
    }
  );
}

// ============================================================================
// WRITE OPERATIONS
// ============================================================================

/**
 * Create a new stream
 *
 * Automatically calculates derived properties (density, enthalpy)
 * based on fluid type and operating conditions.
 */
export async function createStream(
  projectId: string,
  input: ProcessStreamInput,
  userId: string
): Promise<string> {
  logger.debug('createStream', { projectId, input });

  // PE-9: Validate project exists before creating SSOT data
  await validateProjectExists(projectId);

  // Enrich input with calculated properties
  const enrichedInput = enrichStreamInput(input);

  const streamsRef = getStreamsCollection(projectId);
  const now = Timestamp.now();

  const streamData = {
    projectId,
    ...enrichedInput,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,
  };

  const docRef = await addDoc(streamsRef, streamData);
  logger.info('Stream created', { projectId, streamId: docRef.id });

  return docRef.id;
}

/**
 * Update an existing stream
 *
 * Recalculates derived properties if input conditions change.
 */
export async function updateStream(
  projectId: string,
  streamId: string,
  input: Partial<ProcessStreamInput>,
  userId: string
): Promise<void> {
  logger.debug('updateStream', { projectId, streamId, input });

  const docRef = getStreamDoc(projectId, streamId);

  // Get current stream to merge with updates
  const current = await getStream(projectId, streamId);
  if (!current) {
    throw new Error(`Stream ${streamId} not found`);
  }

  // Merge current with updates
  const merged: ProcessStreamInput = {
    lineTag: input.lineTag ?? current.lineTag,
    description: input.description ?? current.description,
    flowRateKgS: input.flowRateKgS ?? current.flowRateKgS,
    flowRateKgHr: input.flowRateKgHr ?? current.flowRateKgHr,
    pressureMbar: input.pressureMbar ?? current.pressureMbar,
    pressureBar: input.pressureBar ?? current.pressureBar,
    temperature: input.temperature ?? current.temperature,
    density: input.density ?? current.density,
    tds: input.tds ?? current.tds,
    enthalpy: input.enthalpy ?? current.enthalpy,
    fluidType: input.fluidType ?? current.fluidType,
  };

  // Recalculate if key inputs changed
  const needsRecalc =
    input.temperature !== undefined ||
    input.pressureMbar !== undefined ||
    input.flowRateKgS !== undefined ||
    input.tds !== undefined ||
    input.fluidType !== undefined;

  const enriched = needsRecalc ? enrichStreamInput(merged) : merged;

  await updateDoc(docRef, {
    ...enriched,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  logger.info('Stream updated', { projectId, streamId });
}

/**
 * Delete a stream
 */
export async function deleteStream(projectId: string, streamId: string): Promise<void> {
  logger.debug('deleteStream', { projectId, streamId });

  const docRef = getStreamDoc(projectId, streamId);
  await deleteDoc(docRef);

  logger.info('Stream deleted', { projectId, streamId });
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Create multiple streams at once
 *
 * Used for Excel import functionality.
 */
export async function createStreamsInBulk(
  projectId: string,
  inputs: ProcessStreamInput[],
  userId: string
): Promise<string[]> {
  logger.debug('createStreamsInBulk', { projectId, count: inputs.length });

  const ids: string[] = [];

  // Process in batches to avoid overwhelming Firestore
  for (const input of inputs) {
    const id = await createStream(projectId, input, userId);
    ids.push(id);
  }

  logger.info('Bulk streams created', { projectId, count: ids.length });
  return ids;
}
