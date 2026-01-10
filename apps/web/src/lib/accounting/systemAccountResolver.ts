/**
 * System Account Resolver
 * Maps transaction types to required GL accounts
 *
 * This utility fetches system account IDs from Firestore by querying
 * the Chart of Accounts for specific account types and properties.
 */

import { collection, query, where, getDocs, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'systemAccountResolver' });

export interface SystemAccountIds {
  // Receivables & Revenue (for invoices)
  accountsReceivable?: string;
  revenue?: string;
  cgstPayable?: string;
  sgstPayable?: string;
  igstPayable?: string;

  // Payables & Expenses (for bills)
  accountsPayable?: string;
  expenses?: string;
  cgstInput?: string;
  sgstInput?: string;
  igstInput?: string;
  tdsPayable?: string;

  // Cash & Bank
  cashInHand?: string;
  bankAccounts?: Map<string, string>; // id -> name mapping
}

/**
 * Fetch system accounts from Firestore
 * Caches results in memory for performance during a session
 */
let cachedAccounts: SystemAccountIds | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getSystemAccountIds(
  db: Firestore,
  forceRefresh = false
): Promise<SystemAccountIds> {
  // Return cached result if valid
  const now = Date.now();
  if (!forceRefresh && cachedAccounts && now - cacheTimestamp < CACHE_TTL) {
    return cachedAccounts;
  }

  const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);
  const accounts: SystemAccountIds = {};

  try {
    // Find Trade Receivables (Asset -> Current Assets)
    // Code: 1200, Name: "Trade Receivables (Debtors)"
    const arQuery = query(
      accountsRef,
      where('code', '==', '1200'),
      where('isSystemAccount', '==', true)
    );
    const arDocs = await getDocs(arQuery);
    if (!arDocs.empty && arDocs.docs[0]) {
      accounts.accountsReceivable = arDocs.docs[0].id;
    }

    // Find Revenue account
    // Code: 4100, Name: "Sales Revenue"
    const revenueQuery = query(
      accountsRef,
      where('code', '==', '4100'),
      where('isSystemAccount', '==', true)
    );
    const revDocs = await getDocs(revenueQuery);
    if (!revDocs.empty && revDocs.docs[0]) {
      accounts.revenue = revDocs.docs[0].id;
    }

    // Find GST Output accounts (Payable - for sales/invoices)
    // CGST Output: Code 2201
    const cgstPayableQuery = query(
      accountsRef,
      where('code', '==', '2201'),
      where('gstType', '==', 'CGST'),
      where('gstDirection', '==', 'OUTPUT')
    );
    const cgstPayableDocs = await getDocs(cgstPayableQuery);
    if (!cgstPayableDocs.empty && cgstPayableDocs.docs[0]) {
      accounts.cgstPayable = cgstPayableDocs.docs[0].id;
    }

    // SGST Output: Code 2202
    const sgstPayableQuery = query(
      accountsRef,
      where('code', '==', '2202'),
      where('gstType', '==', 'SGST'),
      where('gstDirection', '==', 'OUTPUT')
    );
    const sgstPayableDocs = await getDocs(sgstPayableQuery);
    if (!sgstPayableDocs.empty && sgstPayableDocs.docs[0]) {
      accounts.sgstPayable = sgstPayableDocs.docs[0].id;
    }

    // IGST Output: Code 2203
    const igstPayableQuery = query(
      accountsRef,
      where('code', '==', '2203'),
      where('gstType', '==', 'IGST'),
      where('gstDirection', '==', 'OUTPUT')
    );
    const igstPayableDocs = await getDocs(igstPayableQuery);
    if (!igstPayableDocs.empty && igstPayableDocs.docs[0]) {
      accounts.igstPayable = igstPayableDocs.docs[0].id;
    }

    // Find Trade Payables (Liability -> Current Liabilities)
    // Code: 2100, Name: "Trade Payables (Creditors)"
    const apQuery = query(
      accountsRef,
      where('code', '==', '2100'),
      where('isSystemAccount', '==', true)
    );
    const apDocs = await getDocs(apQuery);
    if (!apDocs.empty && apDocs.docs[0]) {
      accounts.accountsPayable = apDocs.docs[0].id;
    }

    // Find Expense account
    // Code: 5100, Name: "Cost of Goods Sold"
    const expenseQuery = query(
      accountsRef,
      where('code', '==', '5100'),
      where('isSystemAccount', '==', true)
    );
    const expDocs = await getDocs(expenseQuery);
    if (!expDocs.empty && expDocs.docs[0]) {
      accounts.expenses = expDocs.docs[0].id;
    }

    // Find GST Input accounts (for purchases/bills)
    // CGST Input: Code 1301
    const cgstInputQuery = query(
      accountsRef,
      where('code', '==', '1301'),
      where('gstType', '==', 'CGST'),
      where('gstDirection', '==', 'INPUT')
    );
    const cgstInputDocs = await getDocs(cgstInputQuery);
    if (!cgstInputDocs.empty && cgstInputDocs.docs[0]) {
      accounts.cgstInput = cgstInputDocs.docs[0].id;
    }

    // SGST Input: Code 1302
    const sgstInputQuery = query(
      accountsRef,
      where('code', '==', '1302'),
      where('gstType', '==', 'SGST'),
      where('gstDirection', '==', 'INPUT')
    );
    const sgstInputDocs = await getDocs(sgstInputQuery);
    if (!sgstInputDocs.empty && sgstInputDocs.docs[0]) {
      accounts.sgstInput = sgstInputDocs.docs[0].id;
    }

    // IGST Input: Code 1303
    const igstInputQuery = query(
      accountsRef,
      where('code', '==', '1303'),
      where('gstType', '==', 'IGST'),
      where('gstDirection', '==', 'INPUT')
    );
    const igstInputDocs = await getDocs(igstInputQuery);
    if (!igstInputDocs.empty && igstInputDocs.docs[0]) {
      accounts.igstInput = igstInputDocs.docs[0].id;
    }

    // Find TDS Payable
    // Code: 2300
    const tdsQuery = query(
      accountsRef,
      where('code', '==', '2300'),
      where('isTDSAccount', '==', true)
    );
    const tdsDocs = await getDocs(tdsQuery);
    if (!tdsDocs.empty && tdsDocs.docs[0]) {
      accounts.tdsPayable = tdsDocs.docs[0].id;
    }

    // Cache the results
    cachedAccounts = accounts;
    cacheTimestamp = now;

    return accounts;
  } catch (error) {
    logger.error('Error fetching system accounts', { error });
    throw error;
  }
}

/**
 * Validate that required accounts exist for a transaction type
 */
export function validateSystemAccounts(
  accounts: SystemAccountIds,
  transactionType: 'CUSTOMER_INVOICE' | 'VENDOR_BILL'
): { valid: boolean; missingAccounts: string[] } {
  const missing: string[] = [];

  if (transactionType === 'CUSTOMER_INVOICE') {
    if (!accounts.accountsReceivable) missing.push('Trade Receivables (Debtors)');
    if (!accounts.revenue) missing.push('Sales Revenue');
    if (!accounts.cgstPayable) missing.push('CGST Output');
    if (!accounts.sgstPayable) missing.push('SGST Output');
    if (!accounts.igstPayable) missing.push('IGST Output');
  } else if (transactionType === 'VENDOR_BILL') {
    if (!accounts.accountsPayable) missing.push('Trade Payables (Creditors)');
    if (!accounts.expenses) missing.push('Cost of Goods Sold');
    if (!accounts.cgstInput) missing.push('CGST Input');
    if (!accounts.sgstInput) missing.push('SGST Input');
    if (!accounts.igstInput) missing.push('IGST Input');
    if (!accounts.tdsPayable) missing.push('TDS Payable');
  }

  return {
    valid: missing.length === 0,
    missingAccounts: missing,
  };
}

/**
 * Clear the cache (useful for testing or after Chart of Accounts changes)
 */
export function clearSystemAccountsCache(): void {
  cachedAccounts = null;
  cacheTimestamp = 0;
}

/**
 * Get the control account for an entity based on its role
 *
 * Business logic:
 * - Customers → Use Accounts Receivable (Trade Receivables)
 * - Vendors → Use Accounts Payable (Trade Payables)
 * - BOTH/Partner → Determine based on transaction context (debit/credit)
 *
 * @param db - Firestore instance
 * @param entityRoles - The entity's roles array
 * @param isDebit - Whether this is a debit entry (helps determine account for dual-role entities)
 * @returns The control account ID and details
 */
export async function getEntityControlAccount(
  db: Firestore,
  entityRoles: string[],
  isDebit: boolean
): Promise<{
  accountId: string;
  accountCode: string;
  accountName: string;
} | null> {
  const accounts = await getSystemAccountIds(db);

  // Determine which control account to use based on entity role and transaction type
  const isCustomer = entityRoles.includes('CUSTOMER');
  const isVendor = entityRoles.includes('VENDOR');
  const isBoth = entityRoles.includes('BOTH') || (isCustomer && isVendor);

  if (isBoth) {
    // For dual-role entities, use transaction direction to determine account:
    // - Debit entry = We're owed money = Accounts Receivable
    // - Credit entry = We owe money = Accounts Payable
    if (isDebit && accounts.accountsReceivable) {
      return {
        accountId: accounts.accountsReceivable,
        accountCode: '1200',
        accountName: 'Trade Receivables (Debtors)',
      };
    } else if (!isDebit && accounts.accountsPayable) {
      return {
        accountId: accounts.accountsPayable,
        accountCode: '2100',
        accountName: 'Trade Payables (Creditors)',
      };
    }
  } else if (isCustomer && accounts.accountsReceivable) {
    // Customers always use Accounts Receivable
    return {
      accountId: accounts.accountsReceivable,
      accountCode: '1200',
      accountName: 'Trade Receivables (Debtors)',
    };
  } else if (isVendor && accounts.accountsPayable) {
    // Vendors always use Accounts Payable
    return {
      accountId: accounts.accountsPayable,
      accountCode: '2100',
      accountName: 'Trade Payables (Creditors)',
    };
  }

  // Fallback: If we can't determine, return null (validation will catch this)
  logger.warn('Could not determine control account for entity', { entityRoles, isDebit });
  return null;
}
