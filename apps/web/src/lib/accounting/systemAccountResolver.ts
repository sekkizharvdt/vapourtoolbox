/**
 * System Account Resolver
 * Maps transaction types to required GL accounts
 *
 * This utility fetches system account IDs from Firestore by querying
 * the Chart of Accounts for specific account types and properties.
 */

import { collection, getDocs, query, where, type Firestore } from 'firebase/firestore';
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

  // Intercompany
  intercompanyReceivable?: string;
  intercompanyPayable?: string;
  interestIncome?: string;
  interestExpense?: string;

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
    // Fetch all system accounts in a single query using code-based lookup.
    // This avoids composite index requirements from multi-field where clauses.
    const systemCodes = [
      '1200', // Trade Receivables (Debtors)
      '4100', // Sales Revenue
      '2201', // CGST Output
      '2202', // SGST Output
      '2203', // IGST Output
      '2100', // Trade Payables (Creditors)
      '5100', // Cost of Goods Sold
      '1301', // CGST Input
      '1302', // SGST Input
      '1303', // IGST Input
      '2300', // TDS Payable
      '1400', // Intercompany Loan Receivable
      '2400', // Intercompany Loan Payable
      '4200', // Interest Income
      '6100', // Interest Expense
    ];

    const q = query(accountsRef, where('code', 'in', systemCodes));
    const snapshot = await getDocs(q);

    // Build a lookup map: code -> doc
    const docsByCode = new Map<string, { id: string; data: Record<string, unknown> }>();
    snapshot.docs.forEach((d) => {
      const data = d.data() as Record<string, unknown>;
      const code = data.code as string;
      docsByCode.set(code, { id: d.id, data });
    });

    // Map accounts by code with client-side property validation
    const ar = docsByCode.get('1200');
    if (ar && ar.data.isSystemAccount) accounts.accountsReceivable = ar.id;

    const rev = docsByCode.get('4100');
    if (rev && rev.data.isSystemAccount) accounts.revenue = rev.id;

    const cgstOut = docsByCode.get('2201');
    if (cgstOut && cgstOut.data.gstType === 'CGST' && cgstOut.data.gstDirection === 'OUTPUT') {
      accounts.cgstPayable = cgstOut.id;
    }

    const sgstOut = docsByCode.get('2202');
    if (sgstOut && sgstOut.data.gstType === 'SGST' && sgstOut.data.gstDirection === 'OUTPUT') {
      accounts.sgstPayable = sgstOut.id;
    }

    const igstOut = docsByCode.get('2203');
    if (igstOut && igstOut.data.gstType === 'IGST' && igstOut.data.gstDirection === 'OUTPUT') {
      accounts.igstPayable = igstOut.id;
    }

    const ap = docsByCode.get('2100');
    if (ap && ap.data.isSystemAccount) accounts.accountsPayable = ap.id;

    const exp = docsByCode.get('5100');
    if (exp && exp.data.isSystemAccount) accounts.expenses = exp.id;

    const cgstIn = docsByCode.get('1301');
    if (cgstIn && cgstIn.data.gstType === 'CGST' && cgstIn.data.gstDirection === 'INPUT') {
      accounts.cgstInput = cgstIn.id;
    }

    const sgstIn = docsByCode.get('1302');
    if (sgstIn && sgstIn.data.gstType === 'SGST' && sgstIn.data.gstDirection === 'INPUT') {
      accounts.sgstInput = sgstIn.id;
    }

    const igstIn = docsByCode.get('1303');
    if (igstIn && igstIn.data.gstType === 'IGST' && igstIn.data.gstDirection === 'INPUT') {
      accounts.igstInput = igstIn.id;
    }

    const tds = docsByCode.get('2300');
    if (tds && tds.data.isTDSAccount) accounts.tdsPayable = tds.id;

    const icReceivable = docsByCode.get('1400');
    if (icReceivable) accounts.intercompanyReceivable = icReceivable.id;

    const icPayable = docsByCode.get('2400');
    if (icPayable) accounts.intercompanyPayable = icPayable.id;

    const intIncome = docsByCode.get('4200');
    if (intIncome) accounts.interestIncome = intIncome.id;

    const intExpense = docsByCode.get('6100');
    if (intExpense) accounts.interestExpense = intExpense.id;

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
