/**
 * Entity Query Keys
 *
 * Centralized query key factories for business entity queries.
 * Follows TanStack Query best practices for query key management.
 *
 * @see https://tanstack.com/query/latest/docs/react/guides/query-keys
 */

import type { Status, EntityRole } from '@vapour/types';

export interface EntityFilters {
  type?: string;
  status?: Status | Status[];
  role?: EntityRole | EntityRole[];
  isActive?: boolean;
  search?: string;
}

/**
 * Business Entity query keys
 *
 * Used for caching vendor, customer, and supplier data
 */
export const entityKeys = {
  all: ['entities'] as const,
  lists: () => [...entityKeys.all, 'list'] as const,
  list: (filters?: EntityFilters) => [...entityKeys.lists(), filters ?? {}] as const,
  details: () => [...entityKeys.all, 'detail'] as const,
  detail: (id: string) => [...entityKeys.details(), id] as const,
  ledger: (id: string) => [...entityKeys.all, 'ledger', id] as const,
  transactions: (id: string) => [...entityKeys.all, 'transactions', id] as const,
  // Role-specific keys
  byRole: (role: EntityRole) => [...entityKeys.all, 'byRole', role] as const,
  vendors: (activeOnly?: boolean) => [...entityKeys.all, 'vendors', { activeOnly }] as const,
  customers: (activeOnly?: boolean) => [...entityKeys.all, 'customers', { activeOnly }] as const,
  // Search keys
  search: (term: string) => [...entityKeys.all, 'search', term] as const,
};

/**
 * User query keys
 */
export const userKeys = {
  all: ['users'] as const,
  lists: () => [...userKeys.all, 'list'] as const,
  list: (filters?: { role?: string; status?: string }) =>
    [...userKeys.lists(), filters ?? {}] as const,
  details: () => [...userKeys.all, 'detail'] as const,
  detail: (id: string) => [...userKeys.details(), id] as const,
  profile: (id: string) => [...userKeys.all, 'profile', id] as const,
  permissions: (id: string) => [...userKeys.all, 'permissions', id] as const,
};

/**
 * Company query keys
 */
export const companyKeys = {
  all: ['company'] as const,
  details: () => [...companyKeys.all, 'detail'] as const,
  settings: () => [...companyKeys.all, 'settings'] as const,
  employees: () => [...companyKeys.all, 'employees'] as const,
};
