'use client';

/**
 * React Query Hooks for Chart of Accounts
 *
 * Provides cached and efficient data fetching for the Chart of Accounts.
 * Accounts are the most frequently-read data in the accounting module,
 * used by every transaction form, report, and selector.
 *
 * Aggressive caching is used since the CoA rarely changes:
 * - 10 minute stale time
 * - 30 minute garbage collection time
 */

import { useQuery } from '@tanstack/react-query';
import { collection, query, getDocs, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/lib/firebase/hooks';
import { COLLECTIONS } from '@vapour/firebase';
import { accountKeys, type AccountFilters } from '@/lib/queryKeys';
import type { Account, AccountType } from '@vapour/types';

/**
 * Fetch all accounts with optional filters
 */
async function fetchAccounts(
  db: ReturnType<typeof useFirestore>,
  filters?: AccountFilters
): Promise<Account[]> {
  if (!db) throw new Error('Firestore not initialized');

  const accountsRef = collection(db, COLLECTIONS.ACCOUNTS);

  // Build query with filters
  const constraints = [];

  if (filters?.isActive !== undefined) {
    constraints.push(where('isActive', '==', filters.isActive));
  } else {
    // Default to active accounts
    constraints.push(where('isActive', '==', true));
  }

  if (filters?.type) {
    const types = Array.isArray(filters.type) ? filters.type : [filters.type];
    if (types.length === 1) {
      constraints.push(where('accountType', '==', types[0]));
    } else if (types.length > 1 && types.length <= 10) {
      constraints.push(where('accountType', 'in', types));
    }
  }

  if (filters?.isGroup !== undefined) {
    constraints.push(where('isGroup', '==', filters.isGroup));
  }

  if (filters?.isBankAccount !== undefined) {
    constraints.push(where('isBankAccount', '==', filters.isBankAccount));
  }

  constraints.push(orderBy('code', 'asc'));

  const q = query(accountsRef, ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as Account[];
}

/**
 * Hook to fetch all accounts
 *
 * Features:
 * - 10-minute stale time (CoA rarely changes)
 * - Automatic caching and deduplication
 * - Optional filtering by type, active status, etc.
 *
 * @param filters - Optional filters for accounts
 * @param options - Additional query options
 */
export function useAccounts(
  filters?: AccountFilters,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  const db = useFirestore();

  return useQuery({
    queryKey: accountKeys.list(filters),
    queryFn: () => fetchAccounts(db, filters),
    enabled: (options?.enabled ?? true) && !!db,
    // Chart of Accounts rarely changes - cache aggressively
    staleTime: options?.staleTime ?? 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Hook to fetch a single account by ID
 *
 * @param accountId - Account ID to fetch
 * @param options - Additional query options
 */
export function useAccount(
  accountId: string | null | undefined,
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  const db = useFirestore();

  return useQuery({
    queryKey: accountId ? accountKeys.detail(accountId) : ['accounts', 'null'],
    queryFn: async () => {
      if (!db || !accountId) return null;

      const docRef = doc(db, COLLECTIONS.ACCOUNTS, accountId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return null;

      const data = docSnap.data() as Omit<Account, 'id'>;
      return { id: docSnap.id, ...data };
    },
    enabled: (options?.enabled ?? true) && !!db && !!accountId,
    staleTime: options?.staleTime ?? 10 * 60 * 1000,
  });
}

/**
 * Hook to fetch accounts by type
 *
 * @param type - Account type to filter by
 * @param options - Additional query options
 */
export function useAccountsByType(
  type: AccountType,
  options?: {
    enabled?: boolean;
    staleTime?: number;
    excludeGroups?: boolean;
  }
) {
  const db = useFirestore();

  const filters: AccountFilters = {
    type,
    isActive: true,
    isGroup: options?.excludeGroups ? false : undefined,
  };

  return useQuery({
    queryKey: accountKeys.byType(type),
    queryFn: () => fetchAccounts(db, filters),
    enabled: (options?.enabled ?? true) && !!db,
    staleTime: options?.staleTime ?? 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to fetch bank accounts only
 *
 * @param options - Additional query options
 */
export function useBankAccounts(options?: { enabled?: boolean; staleTime?: number }) {
  const db = useFirestore();

  const filters: AccountFilters = {
    isBankAccount: true,
    isActive: true,
  };

  return useQuery({
    queryKey: accountKeys.bankAccounts(),
    queryFn: () => fetchAccounts(db, filters),
    enabled: (options?.enabled ?? true) && !!db,
    staleTime: options?.staleTime ?? 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to fetch postable accounts (non-group accounts for transaction entry)
 *
 * @param type - Optional account type filter
 * @param options - Additional query options
 */
export function usePostableAccounts(
  type?: AccountType | AccountType[],
  options?: {
    enabled?: boolean;
    staleTime?: number;
  }
) {
  const db = useFirestore();

  const filters: AccountFilters = {
    type,
    isActive: true,
    isGroup: false,
  };

  return useQuery({
    queryKey: accountKeys.list({ ...filters, isGroup: false }),
    queryFn: () => fetchAccounts(db, filters),
    enabled: (options?.enabled ?? true) && !!db,
    staleTime: options?.staleTime ?? 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
