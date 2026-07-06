/**
 * Firestore rules tests: users, taskNotifications, and the default-deny
 * catch-all.
 *
 * users/taskNotifications are scoped by userId (not a permission flag) —
 * these tests cover the isOwner()-based checks and the security-sensitive
 * fact that a self-created user profile can only ever grant itself zero
 * effective permissions (the `permissions` field on `users` is NOT trusted
 * for authorization — see the comment on that match block).
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

describe('Firestore rules: users', () => {
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
    'allows a user to create their own pending profile with zero permissions',
    async () => {
      const db = authedContext('new-user-1', {}).firestore();

      await assertSucceeds(
        setDoc(doc(db, 'users', 'new-user-1'), {
          status: 'pending',
          isActive: false,
          permissions: 0,
        })
      );
    }
  );

  itWithEmulator(
    'rejects a user self-creating a pending profile with nonzero permissions (spoofing attempt)',
    async () => {
      const db = authedContext('new-user-2', {}).firestore();

      await assertFails(
        setDoc(doc(db, 'users', 'new-user-2'), {
          status: 'pending',
          isActive: false,
          permissions: PERMISSION_FLAGS.MANAGE_USERS, // spoofed — must be rejected
        })
      );
    }
  );

  itWithEmulator('rejects a user creating a profile for a different uid', async () => {
    const db = authedContext('user-a', {}).firestore();

    await assertFails(
      setDoc(doc(db, 'users', 'user-b'), {
        status: 'pending',
        isActive: false,
        permissions: 0,
      })
    );
  });

  itWithEmulator(
    'allows a user to update only their own preferences/photoURL/lastLoginAt',
    async () => {
      await withAdmin(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'users', 'user-c'), {
          status: 'active',
          isActive: true,
          permissions: 0,
          preferences: {},
        });
      });

      const db = authedContext('user-c', {}).firestore();
      await assertSucceeds(
        updateDoc(doc(db, 'users', 'user-c'), { preferences: { theme: 'dark' } })
      );
    }
  );

  itWithEmulator('rejects a user updating their own permissions field directly', async () => {
    await withAdmin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'user-d'), {
        status: 'active',
        isActive: true,
        permissions: 0,
      });
    });

    const db = authedContext('user-d', {}).firestore();
    await assertFails(
      updateDoc(doc(db, 'users', 'user-d'), { permissions: PERMISSION_FLAGS.MANAGE_USERS })
    );
  });

  itWithEmulator('allows an internal user to read another user profile (selectors)', async () => {
    await withAdmin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'user-e'), {
        status: 'active',
        isActive: true,
        permissions: 0,
      });
    });

    const db = authedContext('internal-viewer', internalUserClaims(0)).firestore();
    await assertSucceeds(getDoc(doc(db, 'users', 'user-e')));
  });
});

describe('Firestore rules: taskNotifications', () => {
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

  itWithEmulator('allows the recipient (userId) to read their own notification', async () => {
    await withAdmin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'taskNotifications', 'notif-1'), {
        userId: 'recipient-1',
        category: 'APPROVAL',
      });
    });

    const db = authedContext('recipient-1', {}).firestore();
    await assertSucceeds(getDoc(doc(db, 'taskNotifications', 'notif-1')));
  });

  itWithEmulator('allows the assignee (assigneeId) to read the same notification', async () => {
    await withAdmin(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'taskNotifications', 'notif-2'), {
        userId: 'recipient-2',
        assigneeId: 'assignee-2',
        category: 'APPROVAL',
      });
    });

    const db = authedContext('assignee-2', {}).firestore();
    await assertSucceeds(getDoc(doc(db, 'taskNotifications', 'notif-2')));
  });

  itWithEmulator(
    'rejects a third party from reading a notification not addressed to them',
    async () => {
      await withAdmin(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'taskNotifications', 'notif-3'), {
          userId: 'recipient-3',
          category: 'APPROVAL',
        });
      });

      const db = authedContext('bystander', {}).firestore();
      await assertFails(getDoc(doc(db, 'taskNotifications', 'notif-3')));
    }
  );

  itWithEmulator('rejects create from an external (non-internal) user', async () => {
    const db = authedContext('client-pm-1', { domain: 'external' }).firestore();

    await assertFails(
      setDoc(doc(db, 'taskNotifications', 'notif-external'), {
        userId: 'recipient-4',
        category: 'APPROVAL',
      })
    );
  });
});

describe('Firestore rules: default deny', () => {
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

  itWithEmulator(
    'denies read/write on a collection with no match block, even for an authenticated admin',
    async () => {
      const db = authedContext(
        'admin-1',
        internalUserClaims(PERMISSION_FLAGS.MANAGE_USERS)
      ).firestore();

      await assertFails(setDoc(doc(db, 'someRandomUnknownCollection', 'doc-1'), { foo: 'bar' }));
      await assertFails(getDoc(doc(db, 'someRandomUnknownCollection', 'doc-1')));
    }
  );

  itWithEmulator('denies an unauthenticated caller on every collection', async () => {
    const db = unauthedContext().firestore();
    await assertFails(getDoc(doc(db, 'projects', 'anything')));
  });
});
