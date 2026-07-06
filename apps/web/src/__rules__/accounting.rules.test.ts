/**
 * Firestore rules tests: transactions, accounts
 *
 * Covers VIEW_ACCOUNTING/MANAGE_ACCOUNTING gating, tenantId enforcement on
 * account create, and the AI-agent write block on transactions (agent must
 * route financial postings through the HITL queue, never write directly —
 * AI-AGENT-ROADMAP Phase 0).
 */

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
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

describe('Firestore rules: accounts', () => {
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

  itWithEmulator('rejects read without VIEW_ACCOUNTING', async () => {
    await withAdmin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'accounts', 'acc-1'), {
        code: '1000',
        name: 'Cash',
        tenantId: 'default-entity',
      });
    });

    const db = authedContext('user-1', internalUserClaims(0)).firestore();
    await assertFails(getDoc(doc(db, 'accounts', 'acc-1')));
  });

  itWithEmulator('allows read with VIEW_ACCOUNTING', async () => {
    await withAdmin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'accounts', 'acc-2'), {
        code: '1001',
        name: 'Bank',
        tenantId: 'default-entity',
      });
    });

    const db = authedContext(
      'user-2',
      internalUserClaims(PERMISSION_FLAGS.VIEW_ACCOUNTING)
    ).firestore();
    await assertSucceeds(getDoc(doc(db, 'accounts', 'acc-2')));
  });

  itWithEmulator('rejects account create with a missing tenantId', async () => {
    const db = authedContext(
      'accountant-1',
      internalUserClaims(PERMISSION_FLAGS.MANAGE_ACCOUNTING)
    ).firestore();

    await assertFails(
      setDoc(doc(db, 'accounts', 'acc-no-tenant'), { code: '1002', name: 'No Tenant' })
    );
  });

  itWithEmulator(
    'allows account create with MANAGE_ACCOUNTING and a matching tenantId',
    async () => {
      const db = authedContext(
        'accountant-1',
        internalUserClaims(PERMISSION_FLAGS.MANAGE_ACCOUNTING, { tenantId: 'default-entity' })
      ).firestore();

      await assertSucceeds(
        setDoc(doc(db, 'accounts', 'acc-ok'), {
          code: '1003',
          name: 'Valid Account',
          tenantId: 'default-entity',
        })
      );
    }
  );
});

describe('Firestore rules: transactions', () => {
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

  itWithEmulator('rejects create without MANAGE_ACCOUNTING', async () => {
    const db = authedContext(
      'viewer-1',
      internalUserClaims(PERMISSION_FLAGS.VIEW_ACCOUNTING)
    ).firestore();

    await assertFails(
      setDoc(doc(db, 'transactions', 'txn-denied'), {
        type: 'JOURNAL_ENTRY',
        status: 'POSTED',
        entries: [],
      })
    );
  });

  itWithEmulator('allows create with MANAGE_ACCOUNTING for a non-agent internal user', async () => {
    const db = authedContext(
      'accountant-1',
      internalUserClaims(PERMISSION_FLAGS.MANAGE_ACCOUNTING)
    ).firestore();

    await assertSucceeds(
      setDoc(doc(db, 'transactions', 'txn-ok'), {
        type: 'JOURNAL_ENTRY',
        status: 'POSTED',
        entries: [],
      })
    );
  });

  itWithEmulator(
    'rejects create from the AI agent identity even with MANAGE_ACCOUNTING (HITL-only writes)',
    async () => {
      const db = authedContext(
        'agent-identity',
        internalUserClaims(PERMISSION_FLAGS.MANAGE_ACCOUNTING, { agent: true })
      ).firestore();

      await assertFails(
        setDoc(doc(db, 'transactions', 'txn-agent-blocked'), {
          type: 'JOURNAL_ENTRY',
          status: 'POSTED',
          entries: [],
        })
      );
    }
  );

  itWithEmulator('rejects external users from reading transactions entirely', async () => {
    await withAdmin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'transactions', 'txn-seeded'), {
        type: 'JOURNAL_ENTRY',
        status: 'POSTED',
        entries: [],
      });
    });

    const db = authedContext('client-pm-1', {
      domain: 'external',
      permissions: PERMISSION_FLAGS.VIEW_ACCOUNTING,
      assignedProjects: [],
    }).firestore();
    await assertFails(getDoc(doc(db, 'transactions', 'txn-seeded')));
  });
});

describe('Firestore rules: dataAuditRuns', () => {
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

  itWithEmulator('allows read with VIEW_ACCOUNTING', async () => {
    await withAdmin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'dataAuditRuns', 'run-1'), {
        status: 'CLEAN',
        findingsCount: 0,
      });
    });

    const db = authedContext(
      'viewer-1',
      internalUserClaims(PERMISSION_FLAGS.VIEW_ACCOUNTING)
    ).firestore();
    await assertSucceeds(getDoc(doc(db, 'dataAuditRuns', 'run-1')));
  });

  itWithEmulator('rejects read without VIEW_ACCOUNTING', async () => {
    await withAdmin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'dataAuditRuns', 'run-2'), { status: 'CLEAN' });
    });

    const db = authedContext('user-1', internalUserClaims(0)).firestore();
    await assertFails(getDoc(doc(db, 'dataAuditRuns', 'run-2')));
  });

  itWithEmulator('rejects client writes even with MANAGE_ACCOUNTING (function-only)', async () => {
    const db = authedContext(
      'accountant-1',
      internalUserClaims(PERMISSION_FLAGS.MANAGE_ACCOUNTING)
    ).firestore();

    await assertFails(
      setDoc(doc(db, 'dataAuditRuns', 'run-forged'), { status: 'CLEAN', findingsCount: 0 })
    );
  });
});
