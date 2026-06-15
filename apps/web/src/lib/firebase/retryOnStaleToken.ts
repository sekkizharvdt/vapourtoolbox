/**
 * Stale-token retry helper.
 *
 * Firebase custom claims (permissions, tenantId, domain) are baked into the
 * client's cached ID token. When an admin is granted a permission, the running
 * session keeps using its old token until the ~5-minute background refresh in
 * AuthContext rotates it — so a freshly-granted user can hit "Missing or
 * insufficient permissions" on a Firestore write even though the server already
 * has the correct claims (feedback hCiFXCR8RuuJeNdXJFkv).
 *
 * Wrap a write in `retryOnStaleToken()`: on `permission-denied`, it forces a
 * fresh ID token (picking up the latest claims) and retries the operation once.
 */

import { FirebaseError } from 'firebase/app';
import { getFirebase } from '@/lib/firebase';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'retryOnStaleToken' });

export async function retryOnStaleToken<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (err) {
    const code = err instanceof FirebaseError ? err.code : undefined;
    if (code !== 'permission-denied') throw err;

    const { auth } = getFirebase();
    const currentUser = auth.currentUser;
    if (!currentUser) throw err;

    logger.warn(
      '[retryOnStaleToken] Write hit permission-denied — forcing token refresh and retrying once',
      { uid: currentUser.uid }
    );
    // Force a fresh token so newly-granted claims take effect immediately.
    await currentUser.getIdToken(true);
    return op();
  }
}
