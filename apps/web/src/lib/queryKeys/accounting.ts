/**
 * Accounting Module Query Keys
 *
 * Centralized query key factories for accounting-related queries.
 * Follows TanStack Query best practices for query key management.
 *
 * @see https://tanstack.com/query/latest/docs/react/guides/query-keys
 */

import type { AccountType, TransactionType, TransactionStatus } from '@vapour/types';

export interface AccountFilters {
  type?: AccountType | AccountType[];
  isActive?: boolean;
  isGroup?: boolean;
  isBankAccount?: boolean;
  isGSTAccount?: boolean;
  isTDSAccount?: boolean;
}

export interface TransactionFilters {
  type?: TransactionType;
  status?: TransactionStatus;
  entityId?: string;
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
  fiscalYear?: number;
}

/**
 * Chart of Accounts query keys
 * These are frequently read and should be cached aggressively
 */
export const accountKeys = {
  all: ['accounts'] as const,
  lists: () => [...accountKeys.all, 'list'] as const,
  list: (filters?: AccountFilters) => [...accountKeys.lists(), filters ?? {}] as const,
  details: () => [...accountKeys.all, 'detail'] as const,
  detail: (id: string) => [...accountKeys.details(), id] as const,
  byCode: (code: string) => [...accountKeys.all, 'byCode', code] as const,
  byType: (type: AccountType) => [...accountKeys.all, 'byType', type] as const,
  bankAccounts: () => [...accountKeys.all, 'bankAccounts'] as const,
  gstAccounts: () => [...accountKeys.all, 'gstAccounts'] as const,
  systemAccounts: () => [...accountKeys.all, 'systemAccounts'] as const,
};

/**
 * Transaction query keys
 */
export const transactionKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionKeys.all, 'list'] as const,
  list: (filters?: TransactionFilters) => [...transactionKeys.lists(), filters ?? {}] as const,
  details: () => [...transactionKeys.all, 'detail'] as const,
  detail: (id: string) => [...transactionKeys.details(), id] as const,
  byEntity: (entityId: string) => [...transactionKeys.all, 'byEntity', entityId] as const,
  byProject: (projectId: string) => [...transactionKeys.all, 'byProject', projectId] as const,
  ledger: (accountId: string, fiscalYear?: number) =>
    [...transactionKeys.all, 'ledger', accountId, fiscalYear ?? 'current'] as const,
};

/**
 * Cost Centre query keys
 */
export const costCentreKeys = {
  all: ['costCentres'] as const,
  lists: () => [...costCentreKeys.all, 'list'] as const,
  list: (filters?: { isActive?: boolean }) => [...costCentreKeys.lists(), filters ?? {}] as const,
  details: () => [...costCentreKeys.all, 'detail'] as const,
  detail: (id: string) => [...costCentreKeys.details(), id] as const,
};

/**
 * Fiscal Year query keys
 */
export const fiscalYearKeys = {
  all: ['fiscalYears'] as const,
  current: () => [...fiscalYearKeys.all, 'current'] as const,
  list: () => [...fiscalYearKeys.all, 'list'] as const,
  detail: (year: number) => [...fiscalYearKeys.all, 'detail', year] as const,
};

/**
 * Bank Reconciliation query keys
 */
export const bankReconciliationKeys = {
  all: ['bankReconciliation'] as const,
  statements: () => [...bankReconciliationKeys.all, 'statements'] as const,
  statement: (id: string) => [...bankReconciliationKeys.statements(), id] as const,
  unmatched: (accountId: string) =>
    [...bankReconciliationKeys.all, 'unmatched', accountId] as const,
};
