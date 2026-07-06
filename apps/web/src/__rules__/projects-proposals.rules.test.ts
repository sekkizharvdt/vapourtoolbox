/**
 * Firestore rules tests: projects, proposals
 *
 * Encodes the 15c4ca88 regression (missing tenantId on project create bounced
 * off firestore.rules with "Missing or insufficient permissions", latent
 * until proposal-acceptance made conversion reachable) as a permanent test —
 * the CLAUDE.md rule-4 discipline this phase adds: a rules change ships with
 * a rules test for the touched match block.
 */

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { PERMISSION_FLAGS } from '@vapour/constants';
import {
  checkEmulatorRunning,
  clearFirestore,
  initRulesTestEnv,
  teardownRulesTestEnv,
  authedContext,
  unauthedContext,
  withAdmin,
  internalUserClaims,
} from './setup';

const OTHER_TENANT = 'other-entity';

describe('Firestore rules: projects', () => {
  let emulatorsRunning: boolean;

  beforeAll(async () => {
    emulatorsRunning = await checkEmulatorRunning();
    if (!emulatorsRunning) {
      console.warn('\n⚠️  Firestore emulator not running. Skipping rules tests.\n');
      return;
    }
    await initRulesTestEnv();
  });

  beforeEach(async () => {
    if (emulatorsRunning) await clearFirestore();
  });

  afterAll(async () => {
    if (emulatorsRunning) await teardownRulesTestEnv();
  });

  const itWithEmulator = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (!emulatorsRunning) {
        // eslint-disable-next-line no-console
        console.log(`  ⏭️  Skipping: ${name} (emulator not running)`);
        return;
      }
      await fn();
    });
  };

  itWithEmulator(
    'rejects project create with a missing tenantId (the 15c4ca88 regression)',
    async () => {
      const db = authedContext(
        'pm-1',
        internalUserClaims(PERMISSION_FLAGS.MANAGE_PROJECTS)
      ).firestore();

      await assertFails(
        setDoc(doc(db, 'projects', 'proj-no-tenant'), {
          name: 'No Tenant Project',
          status: 'PLANNING',
          // tenantId deliberately omitted
        })
      );
    }
  );

  itWithEmulator(
    'rejects project create when tenantId does not match the caller token',
    async () => {
      const db = authedContext(
        'pm-1',
        internalUserClaims(PERMISSION_FLAGS.MANAGE_PROJECTS, { tenantId: 'default-entity' })
      ).firestore();

      await assertFails(
        setDoc(doc(db, 'projects', 'proj-wrong-tenant'), {
          name: 'Wrong Tenant Project',
          status: 'PLANNING',
          tenantId: OTHER_TENANT,
        })
      );
    }
  );

  itWithEmulator('allows project create with MANAGE_PROJECTS and a matching tenantId', async () => {
    const db = authedContext(
      'pm-1',
      internalUserClaims(PERMISSION_FLAGS.MANAGE_PROJECTS, { tenantId: 'default-entity' })
    ).firestore();

    await assertSucceeds(
      setDoc(doc(db, 'projects', 'proj-ok'), {
        name: 'Valid Project',
        status: 'PLANNING',
        tenantId: 'default-entity',
      })
    );
  });

  itWithEmulator(
    'rejects project create from an internal user without MANAGE_PROJECTS',
    async () => {
      const db = authedContext('viewer-1', internalUserClaims(0)).firestore();

      await assertFails(
        setDoc(doc(db, 'projects', 'proj-denied'), {
          name: 'Denied Project',
          status: 'PLANNING',
          tenantId: 'default-entity',
        })
      );
    }
  );

  itWithEmulator('rejects reads from an unauthenticated caller', async () => {
    await withAdmin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'projects', 'proj-seeded'), {
        name: 'Seeded',
        status: 'PLANNING',
        tenantId: 'default-entity',
      });
    });

    const db = unauthedContext().firestore();
    await assertFails(getDoc(doc(db, 'projects', 'proj-seeded')));
  });

  itWithEmulator(
    'allows an internal user with VIEW_PROJECTS to read a project they are not assigned to',
    async () => {
      await withAdmin(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'projects', 'proj-viewable'), {
          name: 'Viewable',
          status: 'PLANNING',
          tenantId: 'default-entity',
        });
      });

      const db = authedContext(
        'viewer-2',
        internalUserClaims(PERMISSION_FLAGS.VIEW_PROJECTS)
      ).firestore();
      await assertSucceeds(getDoc(doc(db, 'projects', 'proj-viewable')));
    }
  );
});

describe('Firestore rules: proposals', () => {
  let emulatorsRunning: boolean;

  beforeAll(async () => {
    emulatorsRunning = await checkEmulatorRunning();
    if (!emulatorsRunning) return;
    await initRulesTestEnv();
  });

  beforeEach(async () => {
    if (emulatorsRunning) await clearFirestore();
  });

  afterAll(async () => {
    if (emulatorsRunning) await teardownRulesTestEnv();
  });

  const itWithEmulator = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (!emulatorsRunning) {
        // eslint-disable-next-line no-console
        console.log(`  ⏭️  Skipping: ${name} (emulator not running)`);
        return;
      }
      await fn();
    });
  };

  const validProposal = (overrides: Record<string, unknown> = {}) => ({
    title: 'Test Proposal',
    status: 'DRAFT',
    revision: 1,
    tenantId: 'default-entity',
    createdBy: 'pm-1',
    ...overrides,
  });

  itWithEmulator(
    'allows create with MANAGE_PROPOSALS when tenantId/createdBy/status/revision all match the caller',
    async () => {
      const db = authedContext(
        'pm-1',
        internalUserClaims(PERMISSION_FLAGS.MANAGE_PROPOSALS, { tenantId: 'default-entity' })
      ).firestore();

      await assertSucceeds(setDoc(doc(db, 'proposals', 'prop-ok'), validProposal()));
    }
  );

  itWithEmulator('rejects create where createdBy does not match the caller uid', async () => {
    const db = authedContext(
      'pm-1',
      internalUserClaims(PERMISSION_FLAGS.MANAGE_PROPOSALS, { tenantId: 'default-entity' })
    ).firestore();

    await assertFails(
      setDoc(doc(db, 'proposals', 'prop-spoofed'), validProposal({ createdBy: 'someone-else' }))
    );
  });

  itWithEmulator('rejects create with a status other than DRAFT', async () => {
    const db = authedContext(
      'pm-1',
      internalUserClaims(PERMISSION_FLAGS.MANAGE_PROPOSALS, { tenantId: 'default-entity' })
    ).firestore();

    await assertFails(
      setDoc(doc(db, 'proposals', 'prop-not-draft'), validProposal({ status: 'ACCEPTED' }))
    );
  });

  itWithEmulator('rejects reads without VIEW_PROPOSALS even for internal users', async () => {
    await withAdmin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'proposals', 'prop-seeded'), validProposal());
    });

    const db = authedContext('viewer-1', internalUserClaims(0)).firestore();
    await assertFails(getDoc(doc(db, 'proposals', 'prop-seeded')));
  });

  itWithEmulator('allows update (e.g. approval workflow) with MANAGE_PROPOSALS', async () => {
    await withAdmin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'proposals', 'prop-update'), validProposal());
    });

    const db = authedContext(
      'approver-1',
      internalUserClaims(PERMISSION_FLAGS.MANAGE_PROPOSALS, { tenantId: 'default-entity' })
    ).firestore();
    await assertSucceeds(updateDoc(doc(db, 'proposals', 'prop-update'), { status: 'SUBMITTED' }));
  });
});
