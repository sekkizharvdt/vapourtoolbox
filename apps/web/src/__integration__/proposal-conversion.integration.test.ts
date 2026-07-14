/**
 * Proposal → Project Conversion Integration Test
 *
 * `projectConversion.test.ts` already unit-tests the conversion payload
 * shape exhaustively (with mocked Firestore calls) — including the two
 * regressions this repo has actually shipped: a service-only proposal
 * writing `charter.budgetLineItems: undefined` (734f1e1c) and a missing
 * `tenantId` bouncing off firestore.rules (15c4ca88, not reproducible here
 * since the integration emulator runs permissive test rules — see Phase 3).
 *
 * This suite covers what only a real Firestore instance can prove:
 * - the write is genuinely accepted (not a hand-rolled undefined-scan
 *   approximating what Firestore would do)
 * - the transactional double-conversion guard (`tx.get` re-read inside
 *   `runTransaction`) works against real persisted state, not a mock that
 *   always answers "not yet converted"
 * - the persisted project + proposal documents carry the rule-26 parent
 *   link fields (tenantId, projectId, projectNumber) after a real round trip
 *
 * Prerequisites: Firebase emulators running (`firebase emulators:start`).
 * Run with: `pnpm test:integration`
 */

import { doc, setDoc, getDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { initializeTestFirebase, cleanupTestData, checkEmulatorsRunning } from './setup';
import { convertProposalToProject } from '@/lib/proposals/projectConversion';
import type { Proposal } from '@vapour/types';

const COLLECTIONS = {
  PROPOSALS: 'proposals',
  PROJECTS: 'projects',
};

const USER_ID = 'user-pm-001';
const USER_NAME = 'Project Manager';
const TENANT_ID = 'entity-001';

function findUndefinedPath(value: unknown, path = ''): string | null {
  if (value === undefined) return path || '<root>';
  if (value === null || typeof value !== 'object') return null;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const hit = findUndefinedPath(v, path ? `${path}.${k}` : k);
    if (hit) return hit;
  }
  return null;
}

/** Minimal ACCEPTED proposal covering both a SUPPLY and a SERVICE scope item. */
function buildProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: 'proposal-conv-1',
    proposalNumber: 'PROP-26-0099',
    revision: 1,
    tenantId: TENANT_ID,
    clientId: 'client-001',
    clientName: 'Acme Client',
    title: 'Test Conversion Proposal',
    status: 'ACCEPTED',
    deliveryPeriod: {
      durationInWeeks: 6,
      description: 'Six weeks',
      milestones: [],
    },
    unifiedScopeMatrix: {
      categories: [
        {
          id: 'cat-1',
          categoryKey: 'MANUFACTURED',
          label: 'Manufactured',
          displayType: 'MATRIX',
          items: [
            {
              id: 'item-supply-1',
              itemNumber: '1',
              name: 'Pump Skid',
              classification: 'SUPPLY',
              included: true,
              order: 0,
            },
            {
              id: 'item-service-1',
              itemNumber: '2',
              name: 'Site Survey',
              classification: 'SERVICE',
              included: true,
              order: 1,
            },
          ],
          order: 0,
        },
      ],
    },
    createdAt: Timestamp.now(),
    createdBy: USER_ID,
    updatedAt: Timestamp.now(),
    updatedBy: USER_ID,
    ...overrides,
  } as unknown as Proposal;
}

describe('Proposal → Project Conversion Integration', () => {
  let db: Firestore;
  let emulatorsRunning: boolean;

  beforeAll(async () => {
    emulatorsRunning = await checkEmulatorsRunning();
    if (!emulatorsRunning) {
      console.warn(
        '\n⚠️  Firebase emulators not running. Skipping integration tests.\n' +
          '   Run: firebase emulators:start\n'
      );
      return;
    }
    db = initializeTestFirebase().db;
  });

  beforeEach(async () => {
    if (emulatorsRunning) await cleanupTestData();
  });

  afterAll(async () => {
    if (emulatorsRunning) await cleanupTestData();
  });

  const itWithEmulator = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (!emulatorsRunning) {
        // eslint-disable-next-line no-console
        console.log(`  ⏭️  Skipping: ${name} (emulators not running)`);
        return;
      }
      await fn();
    });
  };

  itWithEmulator(
    'converts an accepted proposal into a real project with rule-26 parent links',
    async () => {
      const proposal = buildProposal();
      await setDoc(doc(db, COLLECTIONS.PROPOSALS, proposal.id), proposal);

      const projectId = await convertProposalToProject(
        db,
        proposal.id,
        USER_ID,
        USER_NAME,
        proposal
      );

      const projectSnap = await getDoc(doc(db, COLLECTIONS.PROJECTS, projectId));
      expect(projectSnap.exists()).toBe(true);
      const project = projectSnap.data()!;

      // Rule 26: parent identifying fields denormalized onto the child
      expect(project.tenantId).toBe(TENANT_ID);
      expect(project.name).toBe(proposal.title);
      expect(project.client.entityId).toBe(proposal.clientId);
      expect(project.client.entityName).toBe(proposal.clientName);

      // Only the SUPPLY item becomes a budget line item
      expect(project.charter.budgetLineItems).toHaveLength(1);
      expect(project.charter.budgetLineItems[0].description).toBe('Pump Skid');

      // Real Firestore accepted the write — no undefined anywhere (rule 12)
      expect(findUndefinedPath(project)).toBeNull();

      // The proposal itself carries the reverse link back to the project
      const proposalSnap = await getDoc(doc(db, COLLECTIONS.PROPOSALS, proposal.id));
      const proposalData = proposalSnap.data()!;
      expect(proposalData.projectId).toBe(projectId);
      expect(proposalData.projectNumber).toMatch(/^PROJ-/);
      expect(proposalData.convertedToProjectBy).toBe(USER_ID);
    }
  );

  itWithEmulator('omits budgetLineItems entirely for a service-only proposal', async () => {
    const proposal = buildProposal({
      id: 'proposal-conv-service-only',
      unifiedScopeMatrix: {
        categories: [
          {
            id: 'cat-1',
            categoryKey: 'ELECTRICAL',
            label: 'Services',
            displayType: 'CHECKLIST',
            items: [
              {
                id: 'item-service-1',
                itemNumber: '1',
                name: 'Baseline Survey',
                classification: 'SERVICE',
                included: true,
                order: 0,
              },
            ],
            order: 0,
          },
        ],
      },
    });
    await setDoc(doc(db, COLLECTIONS.PROPOSALS, proposal.id), proposal);

    const projectId = await convertProposalToProject(db, proposal.id, USER_ID, USER_NAME, proposal);

    const projectSnap = await getDoc(doc(db, COLLECTIONS.PROJECTS, projectId));
    const project = projectSnap.data()!;
    expect('budgetLineItems' in project.charter).toBe(false);
    expect(findUndefinedPath(project)).toBeNull();
  });

  itWithEmulator(
    'rejects converting the same proposal twice (transactional double-conversion guard)',
    async () => {
      const proposal = buildProposal({ id: 'proposal-conv-race' });
      await setDoc(doc(db, COLLECTIONS.PROPOSALS, proposal.id), proposal);

      // First conversion succeeds and writes projectId back onto the proposal.
      await convertProposalToProject(db, proposal.id, USER_ID, USER_NAME, proposal);

      // Second call is passed the SAME in-memory proposal object (as if a
      // double-click raced in before the UI refetched) — the guard must
      // catch it via runTransaction's tx.get() re-read of the real document,
      // not the stale `proposal.projectId` on the caller's copy.
      await expect(
        convertProposalToProject(db, proposal.id, USER_ID, USER_NAME, proposal)
      ).rejects.toThrow(/already been converted/i);
    }
  );
});
