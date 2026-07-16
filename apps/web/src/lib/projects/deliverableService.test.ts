/**
 * Tests for computeProjectProgress — Project.progress derived from
 * charter deliverable acceptance (B5) — and mergeDeliverablesBatch /
 * saveDeliverablesBatch, the batch counterpart to saveDeliverable used by
 * orderAcceptanceService.approveOrderAcceptance to seed a deliverables
 * register in one atomic write.
 */

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: { PROJECTS: 'projects' },
}));

const mockRunTransaction = jest.fn();
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db, _collection, id) => ({ id, path: `projects/${id}` })),
  runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
  },
}));

jest.mock('@/lib/auth/authorizationService', () => ({
  requirePermission: jest.fn(),
}));

jest.mock('@/lib/audit/clientAuditService', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
  createAuditContext: jest.fn((userId: string, email: string, name: string) => ({
    userId,
    userEmail: email,
    userName: name,
  })),
}));

jest.mock('@/lib/firebase/retryOnStaleToken', () => ({
  retryOnStaleToken: (op: () => Promise<unknown>) => op(),
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));

import {
  computeProjectProgress,
  mergeDeliverablesBatch,
  saveDeliverablesBatch,
  type DeliverableInput,
} from './deliverableService';
import type { ProjectDeliverable } from '@vapour/types';
import type { Firestore } from 'firebase/firestore';
import { requirePermission } from '@/lib/auth/authorizationService';

function d(status: ProjectDeliverable['status']): Pick<ProjectDeliverable, 'status'> {
  return { status };
}

function fullDeliverable(overrides: Partial<ProjectDeliverable> = {}): ProjectDeliverable {
  return {
    id: 'del-existing',
    name: 'Existing Deliverable',
    description: 'desc',
    type: 'DOCUMENT',
    acceptanceCriteria: [],
    status: 'PENDING',
    ...overrides,
  };
}

function input(overrides: Partial<DeliverableInput> = {}): DeliverableInput {
  return {
    name: 'New Deliverable',
    description: '',
    type: 'DOCUMENT',
    acceptanceCriteria: [],
    status: 'PENDING',
    ...overrides,
  };
}

describe('computeProjectProgress', () => {
  it('returns 0% with zero counts for an empty deliverable list', () => {
    expect(computeProjectProgress([])).toEqual({
      percentage: 0,
      completedMilestones: 0,
      totalMilestones: 0,
    });
  });

  it('counts only ACCEPTED deliverables as complete', () => {
    const result = computeProjectProgress([
      d('ACCEPTED'),
      d('SUBMITTED'),
      d('IN_PROGRESS'),
      d('PENDING'),
      d('REJECTED'),
    ]);
    expect(result).toEqual({
      percentage: 20,
      completedMilestones: 1,
      totalMilestones: 5,
    });
  });

  it('returns 100% when all deliverables are accepted', () => {
    expect(computeProjectProgress([d('ACCEPTED'), d('ACCEPTED')])).toEqual({
      percentage: 100,
      completedMilestones: 2,
      totalMilestones: 2,
    });
  });

  it('rounds to the nearest integer percentage', () => {
    // 1/3 => 33.33 -> 33
    expect(computeProjectProgress([d('ACCEPTED'), d('PENDING'), d('PENDING')]).percentage).toBe(33);
    // 2/3 => 66.67 -> 67
    expect(computeProjectProgress([d('ACCEPTED'), d('ACCEPTED'), d('PENDING')]).percentage).toBe(
      67
    );
  });

  it('returns 0% when nothing is accepted yet', () => {
    expect(computeProjectProgress([d('PENDING'), d('SUBMITTED')])).toEqual({
      percentage: 0,
      completedMilestones: 0,
      totalMilestones: 2,
    });
  });
});

describe('mergeDeliverablesBatch', () => {
  it('appends new deliverables (no id) with generated ids, preserving existing ones', () => {
    const existing = [fullDeliverable()];
    const inputs: DeliverableInput[] = [
      input({ name: 'New A', type: 'DOCUMENT' }),
      input({ name: 'New B', type: 'PRODUCT' }),
    ];

    const result = mergeDeliverablesBatch(existing, inputs);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(existing[0]);
    expect(result[1]!.name).toBe('New A');
    expect(result[1]!.id).toMatch(/^del-/);
    expect(result[2]!.name).toBe('New B');
    // Every generated id is unique
    expect(new Set(result.map((item) => item.id)).size).toBe(3);
  });

  it('upserts an existing deliverable by id, merging fields onto it', () => {
    const existing = [fullDeliverable()];
    const inputs: DeliverableInput[] = [
      input({ id: 'del-existing', description: 'updated', status: 'SUBMITTED' }),
    ];

    const result = mergeDeliverablesBatch(existing, inputs);

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('del-existing');
    expect(result[0]!.description).toBe('updated');
    expect(result[0]!.status).toBe('SUBMITTED');
  });

  it('throws when a batch entry references an id that does not exist', () => {
    expect(() => mergeDeliverablesBatch([], [input({ id: 'missing' })])).toThrow(
      'Deliverable missing not found'
    );
  });
});

describe('saveDeliverablesBatch', () => {
  const mockDb = {} as unknown as Firestore;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('seeds N deliverables in one call and recomputes progress once', async () => {
    const mockUpdate = jest.fn();
    mockRunTransaction.mockImplementation(
      async (_db: unknown, callback: (tx: unknown) => Promise<void>) => {
        const tx = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({ charter: { deliverables: [] } }),
          }),
          update: mockUpdate,
        };
        return callback(tx);
      }
    );

    const inputs: DeliverableInput[] = [
      input({ name: 'Del 1', status: 'ACCEPTED' }),
      input({ name: 'Del 2', status: 'PENDING' }),
    ];

    await saveDeliverablesBatch(mockDb, 'project-1', inputs, 'user-1', 0);

    expect(requirePermission).toHaveBeenCalledTimes(1);
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    const updateData = mockUpdate.mock.calls[0][1];
    expect(updateData['charter.deliverables']).toHaveLength(2);
    expect(updateData.progress).toEqual({
      percentage: 50,
      completedMilestones: 1,
      totalMilestones: 2,
    });
  });

  it('preserves and merges existing deliverables alongside newly seeded ones', async () => {
    const mockUpdate = jest.fn();
    mockRunTransaction.mockImplementation(
      async (_db: unknown, callback: (tx: unknown) => Promise<void>) => {
        const tx = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({ charter: { deliverables: [fullDeliverable()] } }),
          }),
          update: mockUpdate,
        };
        return callback(tx);
      }
    );

    await saveDeliverablesBatch(mockDb, 'project-1', [input({ name: 'New Del' })], 'user-1', 0);

    const updateData = mockUpdate.mock.calls[0][1];
    const savedDeliverables = updateData['charter.deliverables'] as ProjectDeliverable[];
    expect(savedDeliverables).toHaveLength(2);
    expect(savedDeliverables[0]!.id).toBe('del-existing');
    expect(savedDeliverables[1]!.name).toBe('New Del');
  });

  it('does not start a transaction for an empty batch', async () => {
    await saveDeliverablesBatch(mockDb, 'project-1', [], 'user-1', 0);
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });
});
