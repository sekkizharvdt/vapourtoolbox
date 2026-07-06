/**
 * Firestore rules tests: purchaseOrders, goodsReceipts
 *
 * Covers tenantId enforcement on create, the two-approver update carve-out
 * on purchaseOrders (a named approver may update the PO even without
 * MANAGE_PROCUREMENT — review 2.3), and external CLIENT_PM project-scoped
 * read access.
 */

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { PERMISSION_FLAGS } from '@vapour/constants';
import {
  checkEmulatorRunning,
  clearFirestore,
  initRulesTestEnv,
  teardownRulesTestEnv,
  authedContext,
  withAdmin,
  internalUserClaims,
} from './setup';

describe('Firestore rules: purchaseOrders', () => {
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

  itWithEmulator('rejects create with a missing tenantId', async () => {
    const db = authedContext(
      'proc-1',
      internalUserClaims(PERMISSION_FLAGS.MANAGE_PROCUREMENT)
    ).firestore();

    await assertFails(
      setDoc(doc(db, 'purchaseOrders', 'po-no-tenant'), {
        poNumber: 'PO-1',
        status: 'DRAFT',
        projectId: 'proj-1',
      })
    );
  });

  itWithEmulator('allows create with MANAGE_PROCUREMENT and a matching tenantId', async () => {
    const db = authedContext(
      'proc-1',
      internalUserClaims(PERMISSION_FLAGS.MANAGE_PROCUREMENT, { tenantId: 'default-entity' })
    ).firestore();

    await assertSucceeds(
      setDoc(doc(db, 'purchaseOrders', 'po-ok'), {
        poNumber: 'PO-2',
        status: 'DRAFT',
        projectId: 'proj-1',
        tenantId: 'default-entity',
      })
    );
  });

  itWithEmulator(
    'allows a named approver to update the PO even without MANAGE_PROCUREMENT',
    async () => {
      await withAdmin(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'purchaseOrders', 'po-approve'), {
          poNumber: 'PO-3',
          status: 'PENDING_APPROVAL',
          projectId: 'proj-1',
          tenantId: 'default-entity',
          approverId: 'approver-a',
          secondApproverId: 'approver-b',
        });
      });

      const db = authedContext('approver-a', internalUserClaims(0)).firestore();
      await assertSucceeds(
        updateDoc(doc(db, 'purchaseOrders', 'po-approve'), { status: 'APPROVED' })
      );
    }
  );

  itWithEmulator(
    'rejects an update from an internal user who is neither a named approver nor MANAGE_PROCUREMENT',
    async () => {
      await withAdmin(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'purchaseOrders', 'po-deny'), {
          poNumber: 'PO-4',
          status: 'PENDING_APPROVAL',
          projectId: 'proj-1',
          tenantId: 'default-entity',
          approverId: 'approver-a',
          secondApproverId: 'approver-b',
        });
      });

      const db = authedContext('random-user', internalUserClaims(0)).firestore();
      await assertFails(updateDoc(doc(db, 'purchaseOrders', 'po-deny'), { status: 'APPROVED' }));
    }
  );

  itWithEmulator(
    'allows an external CLIENT_PM with VIEW_PROCUREMENT to read a PO on their assigned project',
    async () => {
      await withAdmin(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'purchaseOrders', 'po-client'), {
          poNumber: 'PO-5',
          status: 'APPROVED',
          projectId: 'proj-client',
          tenantId: 'default-entity',
        });
      });

      const db = authedContext('client-pm-1', {
        domain: 'external',
        permissions: PERMISSION_FLAGS.VIEW_PROCUREMENT,
        assignedProjects: ['proj-client'],
      }).firestore();
      await assertSucceeds(getDoc(doc(db, 'purchaseOrders', 'po-client')));
    }
  );

  itWithEmulator(
    'rejects an external CLIENT_PM reading a PO on a project they are NOT assigned to',
    async () => {
      await withAdmin(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'purchaseOrders', 'po-other-project'), {
          poNumber: 'PO-6',
          status: 'APPROVED',
          projectId: 'proj-other',
          tenantId: 'default-entity',
        });
      });

      const db = authedContext('client-pm-2', {
        domain: 'external',
        permissions: PERMISSION_FLAGS.VIEW_PROCUREMENT,
        assignedProjects: ['proj-client'],
      }).firestore();
      await assertFails(getDoc(doc(db, 'purchaseOrders', 'po-other-project')));
    }
  );
});

describe('Firestore rules: goodsReceipts', () => {
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

  itWithEmulator('rejects create with a missing tenantId', async () => {
    const db = authedContext(
      'proc-1',
      internalUserClaims(PERMISSION_FLAGS.MANAGE_PROCUREMENT)
    ).firestore();

    await assertFails(
      setDoc(doc(db, 'goodsReceipts', 'gr-no-tenant'), {
        grNumber: 'GR-1',
        status: 'DRAFT',
        projectId: 'proj-1',
      })
    );
  });

  itWithEmulator('allows create with MANAGE_PROCUREMENT and a matching tenantId', async () => {
    const db = authedContext(
      'proc-1',
      internalUserClaims(PERMISSION_FLAGS.MANAGE_PROCUREMENT, { tenantId: 'default-entity' })
    ).firestore();

    await assertSucceeds(
      setDoc(doc(db, 'goodsReceipts', 'gr-ok'), {
        grNumber: 'GR-2',
        status: 'DRAFT',
        projectId: 'proj-1',
        tenantId: 'default-entity',
      })
    );
  });

  itWithEmulator('rejects delete from a non-super-admin internal user', async () => {
    await withAdmin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'goodsReceipts', 'gr-delete'), {
        grNumber: 'GR-3',
        status: 'DRAFT',
        projectId: 'proj-1',
        tenantId: 'default-entity',
      });
    });

    const db = authedContext(
      'proc-1',
      internalUserClaims(PERMISSION_FLAGS.MANAGE_PROCUREMENT)
    ).firestore();
    await assertFails(deleteDoc(doc(db, 'goodsReceipts', 'gr-delete')));
  });
});
