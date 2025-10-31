/**
 * Chart of Accounts Initialization Utility
 * Automatically populates the Indian COA template on first access
 */

import { collection, doc, serverTimestamp, getDocs, writeBatch } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { INDIAN_COA_TEMPLATE } from '@vapour/types';

export interface InitializationResult {
  success: boolean;
  accountsCreated: number;
  error?: string;
}

/**
 * Check if Chart of Accounts is empty and initialize with template
 * @param userId - ID of the user triggering initialization (for audit trail)
 * @returns Promise with initialization result
 */
export async function initializeChartOfAccounts(userId: string): Promise<InitializationResult> {
  try {
    const { db } = getFirebase();
    const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);

    // Check if accounts already exist
    const snapshot = await getDocs(accountsRef);
    if (!snapshot.empty) {
      return {
        success: true,
        accountsCreated: 0,
      };
    }

    // Initialize with Indian COA template using batch writes
    // Firestore batch limit is 500 operations, we have 48 accounts
    const batch = writeBatch(db);
    let accountsCreated = 0;

    for (const templateAccount of INDIAN_COA_TEMPLATE) {
      const accountId = `acc-${templateAccount.code}`;
      const accountDocRef = doc(accountsRef, accountId);

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
        parentAccountId: null,
        createdAt: serverTimestamp(),
        createdBy: userId,
        updatedAt: serverTimestamp(),
      });

      accountsCreated++;
    }

    // Commit the batch
    await batch.commit();

    console.log(`[initializeChartOfAccounts] Successfully initialized ${accountsCreated} accounts`);

    return {
      success: true,
      accountsCreated,
    };
  } catch (error) {
    console.error('[initializeChartOfAccounts] Error:', error);
    return {
      success: false,
      accountsCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
