/**
 * Chart of Accounts Initialization Utility
 * Automatically populates the Indian COA template on first access
 */

import {
  collection,
  doc,
  serverTimestamp,
  getDocs,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import { INDIAN_COA_TEMPLATE } from '@vapour/types';

const logger = createLogger({ context: 'initializeChartOfAccounts' });

export interface InitializationResult {
  success: boolean;
  accountsCreated: number;
  error?: string;
}

/**
 * Check if Chart of Accounts is empty and initialize with template
 * @param userId - ID of the user triggering initialization (for audit trail)
 * @param tenantId - Tenant ID for multi-tenancy scoping
 * @returns Promise with initialization result
 */
export async function initializeChartOfAccounts(
  userId: string,
  tenantId: string,
  forceReinit = false
): Promise<InitializationResult> {
  if (!tenantId) {
    return { success: false, accountsCreated: 0, error: 'tenantId is required' };
  }

  try {
    const { db } = getFirebase();
    const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);

    // Check if accounts already exist for this tenant
    const entityQuery = query(accountsRef, where('tenantId', '==', tenantId));
    const snapshot = await getDocs(entityQuery);
    if (!snapshot.empty && !forceReinit) {
      return {
        success: true,
        accountsCreated: 0,
      };
    }

    if (forceReinit && !snapshot.empty) {
      const batch = writeBatch(db);
      // rule20-exempt: bounded by INDIAN_COA_TEMPLATE size (~80 accounts).
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }

    // Initialize with Indian COA template using batch writes
    // Firestore batch limit is 500 operations, we have 48 accounts

    // First pass: Create a map to find parent accounts by name
    const accountNameToId = new Map<string, string>();
    for (const templateAccount of INDIAN_COA_TEMPLATE) {
      const accountId = `acc-${templateAccount.code}`;
      accountNameToId.set(templateAccount.name, accountId);
    }

    const batch = writeBatch(db);
    let accountsCreated = 0;

    for (const templateAccount of INDIAN_COA_TEMPLATE) {
      const accountId = `acc-${templateAccount.code}`;
      const accountDocRef = doc(accountsRef, accountId);

      // Determine parent account ID by looking up the accountGroup name
      let parentAccountId: string | null = null;
      if (templateAccount.accountGroup && templateAccount.accountGroup !== templateAccount.name) {
        // Find the parent account by name
        parentAccountId = accountNameToId.get(templateAccount.accountGroup) || null;
      }

      batch.set(accountDocRef, {
        code: templateAccount.code,
        name: templateAccount.name,
        description: templateAccount.description || '',
        accountType: templateAccount.accountType,
        accountCategory: templateAccount.accountCategory,
        accountGroup: templateAccount.accountGroup || null,
        level: templateAccount.level,
        isGroup: templateAccount.isGroup,
        isActive: true,
        isSystemAccount: templateAccount.isSystemAccount,
        openingBalance: 0,
        currentBalance: 0,
        currency: 'INR',
        isGSTAccount: templateAccount.isGSTAccount,
        gstType: templateAccount.gstType || null,
        gstDirection: templateAccount.gstDirection || null,
        isTDSAccount: templateAccount.isTDSAccount,
        tdsSection: templateAccount.tdsSection || null,
        isBankAccount: templateAccount.isBankAccount,
        bankName: templateAccount.bankName || null,
        accountNumber: null,
        ifscCode: null,
        branch: null,
        parentAccountId,
        tenantId: tenantId,
        createdAt: serverTimestamp(),
        createdBy: userId,
        updatedAt: serverTimestamp(),
      });

      accountsCreated++;
    }

    // Commit the batch
    await batch.commit();

    return {
      success: true,
      accountsCreated,
    };
  } catch (error) {
    logger.error('initializeChartOfAccounts failed', { error });
    return {
      success: false,
      accountsCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
