/**
 * Storage rules tests (G1 security-gap closure)
 *
 * Runs the REAL storage.rules against the Storage emulator (port 9199,
 * per firebase.json). Covers the permission gating added for the
 * 2026-03-15 / 2026-05-23 review finding that several prefixes allowed
 * any authenticated user to read, overwrite and delete:
 *   - accounting/           : read VIEW_ACCOUNTING, write/delete MANAGE_ACCOUNTING
 *   - invoices/             : read VIEW_ACCOUNTING, write/delete MANAGE_ACCOUNTING
 *   - rfq-pdfs/             : write/delete MANAGE_PROCUREMENT
 *   - enquiries/            : write/delete MANAGE_PROPOSALS
 *   - templates/, documents/: write/delete MANAGE_DOCUMENTS or module manage flags
 *   - projects/{id}/documents/ : write/delete document-workflow flags
 *                                (MANAGE/SUBMIT/APPROVE_DOCUMENTS)
 *
 * Prerequisites: Storage emulator running (`firebase emulators:start`).
 * Tests skip gracefully (same pattern as the Firestore rules suites)
 * when the emulator is not reachable.
 */

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, uploadBytes, deleteObject, getBytes } from 'firebase/storage';
import { PERMISSION_FLAGS } from '@vapour/constants';
import {
  checkStorageEmulatorRunning,
  initStorageRulesTestEnv,
  teardownStorageRulesTestEnv,
  clearStorage,
  authedStorageContext,
  withStorageAdmin,
  internalUserClaims,
} from './setup';

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // "%PDF"
const PDF_META = { contentType: 'application/pdf' };

describe('Storage rules: G1 gated paths', () => {
  let emulatorRunning: boolean;

  beforeAll(async () => {
    emulatorRunning = await checkStorageEmulatorRunning();
    if (!emulatorRunning) {
      console.warn('\n⚠️  Storage emulator not running. Skipping storage rules tests.\n');
      return;
    }
    await initStorageRulesTestEnv();
  });

  beforeEach(async () => {
    if (emulatorRunning) await clearStorage();
  });

  afterAll(async () => {
    if (emulatorRunning) await teardownStorageRulesTestEnv();
  });

  const itWithEmulator = (name: string, fn: () => Promise<void>) => {
    it(name, async () => {
      if (!emulatorRunning) {
        // eslint-disable-next-line no-console
        console.log(`  ⏭️  Skipping: ${name} (storage emulator not running)`);
        return;
      }
      await fn();
    });
  };

  itWithEmulator('rejects accounting/ write without MANAGE_ACCOUNTING', async () => {
    const storage = authedStorageContext('user-noflag', internalUserClaims(0)).storage();
    await assertFails(
      uploadBytes(ref(storage, 'accounting/statements/2026-06.pdf'), PDF_BYTES, PDF_META)
    );
  });

  itWithEmulator('allows accounting/ write with MANAGE_ACCOUNTING', async () => {
    const storage = authedStorageContext(
      'user-acct-mgr',
      internalUserClaims(PERMISSION_FLAGS.MANAGE_ACCOUNTING)
    ).storage();
    await assertSucceeds(
      uploadBytes(ref(storage, 'accounting/statements/2026-06.pdf'), PDF_BYTES, PDF_META)
    );
  });

  itWithEmulator('rejects accounting/ read without VIEW_ACCOUNTING', async () => {
    await withStorageAdmin(async (ctx) => {
      await uploadBytes(
        ref(ctx.storage(), 'accounting/statements/seeded.pdf'),
        PDF_BYTES,
        PDF_META
      );
    });

    const storage = authedStorageContext('user-noflag', internalUserClaims(0)).storage();
    await assertFails(getBytes(ref(storage, 'accounting/statements/seeded.pdf')));
  });

  itWithEmulator('allows accounting/ read with VIEW_ACCOUNTING', async () => {
    await withStorageAdmin(async (ctx) => {
      await uploadBytes(
        ref(ctx.storage(), 'accounting/statements/seeded.pdf'),
        PDF_BYTES,
        PDF_META
      );
    });

    const storage = authedStorageContext(
      'user-acct-viewer',
      internalUserClaims(PERMISSION_FLAGS.VIEW_ACCOUNTING)
    ).storage();
    await assertSucceeds(getBytes(ref(storage, 'accounting/statements/seeded.pdf')));
  });

  itWithEmulator(
    'rejects rfq-pdfs/ delete for authenticated user without MANAGE_PROCUREMENT',
    async () => {
      await withStorageAdmin(async (ctx) => {
        await uploadBytes(ref(ctx.storage(), 'rfq-pdfs/rfq-1/generated.pdf'), PDF_BYTES, PDF_META);
      });

      const storage = authedStorageContext('user-noflag', internalUserClaims(0)).storage();
      await assertFails(deleteObject(ref(storage, 'rfq-pdfs/rfq-1/generated.pdf')));
    }
  );

  itWithEmulator('allows rfq-pdfs/ delete with MANAGE_PROCUREMENT', async () => {
    await withStorageAdmin(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), 'rfq-pdfs/rfq-2/generated.pdf'), PDF_BYTES, PDF_META);
    });

    const storage = authedStorageContext(
      'user-proc-mgr',
      internalUserClaims(PERMISSION_FLAGS.MANAGE_PROCUREMENT)
    ).storage();
    await assertSucceeds(deleteObject(ref(storage, 'rfq-pdfs/rfq-2/generated.pdf')));
  });

  itWithEmulator('rejects invoices/ write without MANAGE_ACCOUNTING', async () => {
    const storage = authedStorageContext('user-noflag', internalUserClaims(0)).storage();
    await assertFails(uploadBytes(ref(storage, 'invoices/INV-1/support.pdf'), PDF_BYTES, PDF_META));
  });

  itWithEmulator('allows invoices/ write with MANAGE_ACCOUNTING', async () => {
    const storage = authedStorageContext(
      'user-acct-mgr',
      internalUserClaims(PERMISSION_FLAGS.MANAGE_ACCOUNTING)
    ).storage();
    await assertSucceeds(
      uploadBytes(ref(storage, 'invoices/INV-1/support.pdf'), PDF_BYTES, PDF_META)
    );
  });

  itWithEmulator('rejects enquiries/ write without MANAGE_PROPOSALS', async () => {
    const storage = authedStorageContext('user-noflag', internalUserClaims(0)).storage();
    await assertFails(uploadBytes(ref(storage, 'enquiries/enq-1/spec.pdf'), PDF_BYTES, PDF_META));
  });

  itWithEmulator('allows enquiries/ write with MANAGE_PROPOSALS', async () => {
    const storage = authedStorageContext(
      'user-proposals-mgr',
      internalUserClaims(PERMISSION_FLAGS.MANAGE_PROPOSALS)
    ).storage();
    await assertSucceeds(
      uploadBytes(ref(storage, 'enquiries/enq-1/spec.pdf'), PDF_BYTES, PDF_META)
    );
  });

  itWithEmulator('rejects templates/ write without any manage flag', async () => {
    const storage = authedStorageContext('user-noflag', internalUserClaims(0)).storage();
    await assertFails(
      uploadBytes(ref(storage, 'templates/report-template.pdf'), PDF_BYTES, PDF_META)
    );
  });

  itWithEmulator('allows templates/ write with MANAGE_DOCUMENTS', async () => {
    const storage = authedStorageContext(
      'user-doc-mgr',
      internalUserClaims(PERMISSION_FLAGS.MANAGE_DOCUMENTS)
    ).storage();
    await assertSucceeds(
      uploadBytes(ref(storage, 'templates/report-template.pdf'), PDF_BYTES, PDF_META)
    );
  });

  itWithEmulator(
    'rejects projects/{id}/documents/ write without document-workflow flags',
    async () => {
      const storage = authedStorageContext('user-noflag', internalUserClaims(0)).storage();
      await assertFails(
        uploadBytes(
          ref(storage, 'projects/proj-1/documents/DOC-001/R0/native/drawing.pdf'),
          PDF_BYTES,
          PDF_META
        )
      );
    }
  );

  itWithEmulator(
    'allows projects/{id}/documents/ write with SUBMIT_DOCUMENTS (engineer submitting a revision)',
    async () => {
      const storage = authedStorageContext(
        'user-engineer',
        internalUserClaims(PERMISSION_FLAGS.SUBMIT_DOCUMENTS)
      ).storage();
      await assertSucceeds(
        uploadBytes(
          ref(storage, 'projects/proj-1/documents/DOC-001/R0/native/drawing.pdf'),
          PDF_BYTES,
          PDF_META
        )
      );
    }
  );

  itWithEmulator('rejects documents/ write without any manage flag', async () => {
    const storage = authedStorageContext('user-noflag', internalUserClaims(0)).storage();
    await assertFails(
      uploadBytes(ref(storage, 'documents/accounting/file/f-1/scan.pdf'), PDF_BYTES, PDF_META)
    );
  });

  itWithEmulator(
    'allows documents/ write with MANAGE_ACCOUNTING (module file browser)',
    async () => {
      const storage = authedStorageContext(
        'user-acct-mgr',
        internalUserClaims(PERMISSION_FLAGS.MANAGE_ACCOUNTING)
      ).storage();
      await assertSucceeds(
        uploadBytes(ref(storage, 'documents/accounting/file/f-1/scan.pdf'), PDF_BYTES, PDF_META)
      );
    }
  );
});
