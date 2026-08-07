/**
 * Default bank account resolution.
 *
 * Payment dialogs pre-select the operating bank account so the user does not
 * pick it every time (feedback 2CzHpyR8). Of the 516 payments on record, 512
 * used 1102; the other bank/cash accounts (1101 Cash in Hand, 1103 SBI Savings)
 * exist and stay selectable, so this is a default rather than a hard-coded
 * account — swapping banks must not require a code change.
 *
 * Resolved by ACCOUNT CODE, never by document id: ids differ between projects
 * and are meaningless to the domain user, whereas the code is the thing the
 * accountant actually names.
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'defaultBankAccount' });

/** Operating bank account — "1102 - SBI Current Account". */
export const DEFAULT_BANK_ACCOUNT_CODE = '1102';

export interface DefaultBankAccount {
  id: string;
  code: string;
  name: string;
}

/**
 * Look up the default bank account.
 *
 * Returns null when the account is missing, inactive or soft-deleted, so the
 * caller simply leaves the selector empty and the user picks one — the field is
 * already required, so a failed lookup degrades to the previous behaviour
 * rather than blocking the dialog.
 */
export async function getDefaultBankAccount(db: Firestore): Promise<DefaultBankAccount | null> {
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTIONS.ACCOUNTS), where('code', '==', DEFAULT_BANK_ACCOUNT_CODE))
    );

    const match = snap.docs.find((d) => {
      const data = d.data();
      // Rule 3: filtered client-side so accounts predating the field still match.
      return !data.isDeleted && data.isActive !== false && !data.isGroup;
    });

    if (!match) {
      logger.warn('Default bank account not found', { code: DEFAULT_BANK_ACCOUNT_CODE });
      return null;
    }

    const data = match.data();
    return { id: match.id, code: String(data.code ?? ''), name: String(data.name ?? '') };
  } catch (error) {
    // Non-fatal: the selector stays empty and the user chooses. Surfacing the
    // real message rather than a generic string (rule 27).
    logger.warn('Could not resolve the default bank account', {
      code: DEFAULT_BANK_ACCOUNT_CODE,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
