/**
 * Agent Memory Service
 *
 * Phase 0 of AI-AGENT-ROADMAP-2026-04-25.md — "Memory store" workstream.
 *
 * CRUD for the `agentMemory` collection. The orchestrator loads relevant
 * facts at run start (filtered by tenant + category, optionally by
 * entity); humans curate facts via the admin UI; the agent itself can
 * write what it has learned.
 *
 * Upsert semantics: keyed by `(tenantId, key)`. A repeated upsert
 * overwrites value/confidence/citation but preserves provenance unless
 * the new write supplies it.
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import type { AgentMemory, AgentMemoryCategory, UpsertAgentMemoryInput } from '@vapour/types';

const logger = createLogger({ context: 'agentMemoryService' });

/**
 * Deterministic doc id from `(tenantId, key)` so upserts overwrite the
 * same row without a read-then-write race.
 *
 * Strategy: replace any non-alphanumeric chars with `_` and prefix with
 * the tenant. Firestore doc ids accept up to 1500 bytes; keys far short
 * of that in practice.
 */
function memoryDocId(tenantId: string, key: string): string {
  const safeTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeKey = key.replace(/[^a-zA-Z0-9_.-]/g, '_');
  return `${safeTenant}__${safeKey}`;
}

/**
 * Insert or update a memory row keyed by `(tenantId, key)`.
 */
export async function upsertAgentMemory(
  db: Firestore,
  input: UpsertAgentMemoryInput
): Promise<string> {
  // rule5-exempt: agent infrastructure write; firestore.rules require tenantId on agentMemory.create. The orchestrator and human curators are gated by the surrounding workflow.
  if (input.confidence < 0 || input.confidence > 1) {
    throw new Error(`confidence must be in [0, 1]; got ${input.confidence}`);
  }

  const id = memoryDocId(input.tenantId, input.key);
  const ref = doc(db, COLLECTIONS.AGENT_MEMORY, id);
  const now = Timestamp.now();

  const data: Omit<AgentMemory, 'id'> = {
    tenantId: input.tenantId,
    key: input.key,
    value: input.value,
    category: input.category,
    ...(input.entityType !== undefined && { entityType: input.entityType }),
    ...(input.entityId !== undefined && { entityId: input.entityId }),
    confidence: input.confidence,
    source: input.source,
    ...(input.sourceRunId !== undefined && { sourceRunId: input.sourceRunId }),
    ...(input.sourceCitation !== undefined && { sourceCitation: input.sourceCitation }),
    ...(input.expiresAt !== undefined && { expiresAt: input.expiresAt }),
    isActive: true,
    createdAt: now,
    createdBy: input.writtenBy,
    updatedAt: now,
    updatedBy: input.writtenBy,
  };

  await setDoc(ref, data, { merge: true });
  logger.info('agent memory upserted', { id, key: input.key, source: input.source });
  return id;
}

/**
 * Mark a memory row as verified by a human. Promotes its weight when
 * agent-learned facts are loaded into a prompt.
 */
export async function verifyAgentMemory(
  db: Firestore,
  memoryId: string,
  verifiedBy: string
): Promise<void> {
  // rule5-exempt: human-curation write; firestore.rules require internal-user. Verification touches one row's audit fields.
  await updateDoc(doc(db, COLLECTIONS.AGENT_MEMORY, memoryId), {
    verifiedAt: Timestamp.now(),
    verifiedBy,
    updatedAt: Timestamp.now(),
    updatedBy: verifiedBy,
  });
}

/**
 * Soft-delete a memory row. The orchestrator filters `isActive == false`
 * out of prompt loads.
 */
export async function deactivateAgentMemory(
  db: Firestore,
  memoryId: string,
  deactivatedBy: string
): Promise<void> {
  // rule5-exempt: soft-delete write; rule3 — single-field flag update, last-write-wins is correct.
  await updateDoc(doc(db, COLLECTIONS.AGENT_MEMORY, memoryId), {
    isActive: false,
    updatedAt: Timestamp.now(),
    updatedBy: deactivatedBy,
  });
}

/**
 * List active memory rows for a tenant, optionally narrowed by category
 * or by domain entity. The orchestrator uses this at run start.
 */
export interface ListAgentMemoryOptions {
  tenantId: string;
  category?: AgentMemoryCategory;
  entityType?: string;
  entityId?: string;
  /** Include inactive (soft-deleted) rows. Default false. */
  includeInactive?: boolean;
}

export async function listAgentMemory(
  db: Firestore,
  options: ListAgentMemoryOptions
): Promise<AgentMemory[]> {
  const constraints: QueryConstraint[] = [where('tenantId', '==', options.tenantId)];
  if (options.category) constraints.push(where('category', '==', options.category));
  if (options.entityType) constraints.push(where('entityType', '==', options.entityType));
  if (options.entityId) constraints.push(where('entityId', '==', options.entityId));
  if (!options.includeInactive) constraints.push(where('isActive', '==', true));
  constraints.push(orderBy('updatedAt', 'desc'));

  const q = query(collection(db, COLLECTIONS.AGENT_MEMORY), ...constraints);
  const snap = await getDocs(q);
  const rows = snap.docs.map((d) => docToTyped<AgentMemory>(d.id, d.data()));

  // Filter expired rows client-side (Firestore requires a separate index
  // for `expiresAt > now` AND we want to avoid that fan-out).
  const now = Timestamp.now();
  return rows.filter((r) => !r.expiresAt || r.expiresAt.toMillis() > now.toMillis());
}
