/**
 * useEntities Hook Tests
 *
 * Tests for React Query hooks that fetch business entities.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import type { BusinessEntity } from '@vapour/types';

// Mock Firebase hooks
const mockDb = {};
jest.mock('@/lib/firebase/hooks', () => ({
  useFirestore: jest.fn(() => mockDb),
}));

// Mock business entity service
const mockQueryEntities = jest.fn();
const mockGetEntityById = jest.fn();
const mockGetActiveEntitiesByRole = jest.fn();
const mockGetVendors = jest.fn();
const mockGetCustomers = jest.fn();
const mockSearchEntities = jest.fn();

jest.mock('../../businessEntityService', () => ({
  queryEntities: (...args: unknown[]) => mockQueryEntities(...args),
  getEntityById: (...args: unknown[]) => mockGetEntityById(...args),
  getActiveEntitiesByRole: (...args: unknown[]) => mockGetActiveEntitiesByRole(...args),
  getVendors: (...args: unknown[]) => mockGetVendors(...args),
  getCustomers: (...args: unknown[]) => mockGetCustomers(...args),
  searchEntities: (...args: unknown[]) => mockSearchEntities(...args),
}));

// Mock logger
jest.mock('@vapour/utils', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Import hooks after mocks
import {
  useEntities,
  useEntity,
  useActiveEntitiesByRole,
  useVendors,
  useCustomers,
  useSearchEntities,
} from '../useEntities';

// Helper to create a mock entity
function createMockEntity(overrides: Partial<BusinessEntity> = {}): BusinessEntity {
  const now = new Date();
  // Using object spread to merge defaults with overrides
  const baseEntity = {
    id: 'entity-1',
    name: 'Test Entity',
    code: 'ENT-001',
    roles: ['VENDOR'] as const,
    isActive: true,
    isArchived: false,
    contacts: [],
    bankDetails: [],
    createdAt: now,
    createdBy: 'user-1',
    updatedAt: now,
    updatedBy: 'user-1',
  };
  return { ...baseEntity, ...overrides } as unknown as BusinessEntity;
}

// Create a wrapper for QueryClientProvider
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useEntities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useEntities hook', () => {
    it('should fetch entities successfully', async () => {
      const mockEntities = [createMockEntity({ id: '1' }), createMockEntity({ id: '2' })];
      mockQueryEntities.mockResolvedValue(mockEntities);

      const { result } = renderHook(() => useEntities(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockEntities);
      expect(mockQueryEntities).toHaveBeenCalledWith(mockDb, undefined);
    });

    it('should pass query options to queryEntities', async () => {
      mockQueryEntities.mockResolvedValue([]);

      const options = { status: 'active' as const, role: 'VENDOR' as const };
      const { result } = renderHook(() => useEntities(options), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockQueryEntities).toHaveBeenCalledWith(mockDb, options);
    });

    it('should not fetch when enabled is false', () => {
      const { result } = renderHook(() => useEntities(undefined, { enabled: false }), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(mockQueryEntities).not.toHaveBeenCalled();
    });

    it('should handle error state', async () => {
      mockQueryEntities.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useEntities(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeInstanceOf(Error);
    });

    it('should start with loading state', () => {
      mockQueryEntities.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useEntities(), { wrapper: createWrapper() });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
    });
  });

  describe('useEntity hook', () => {
    it('should fetch single entity by ID', async () => {
      const mockEntity = createMockEntity({ id: 'entity-123' });
      mockGetEntityById.mockResolvedValue(mockEntity);

      const { result } = renderHook(() => useEntity('entity-123'), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockEntity);
      expect(mockGetEntityById).toHaveBeenCalledWith(mockDb, 'entity-123');
    });

    it('should return null for missing entity', async () => {
      mockGetEntityById.mockResolvedValue(null);

      const { result } = renderHook(() => useEntity('nonexistent'), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeNull();
    });

    it('should not fetch when entityId is null', () => {
      const { result } = renderHook(() => useEntity(null), { wrapper: createWrapper() });

      expect(result.current.isFetching).toBe(false);
      expect(mockGetEntityById).not.toHaveBeenCalled();
    });

    it('should not fetch when entityId is undefined', () => {
      const { result } = renderHook(() => useEntity(undefined), { wrapper: createWrapper() });

      expect(result.current.isFetching).toBe(false);
      expect(mockGetEntityById).not.toHaveBeenCalled();
    });

    it('should not fetch when enabled is false', () => {
      const { result } = renderHook(() => useEntity('entity-123', { enabled: false }), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(mockGetEntityById).not.toHaveBeenCalled();
    });
  });

  describe('useActiveEntitiesByRole hook', () => {
    it('should fetch active entities by VENDOR role', async () => {
      const mockVendors = [
        createMockEntity({ id: '1', roles: ['VENDOR'] }),
        createMockEntity({ id: '2', roles: ['VENDOR'] }),
      ];
      mockGetActiveEntitiesByRole.mockResolvedValue(mockVendors);

      const { result } = renderHook(() => useActiveEntitiesByRole('VENDOR'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockVendors);
      expect(mockGetActiveEntitiesByRole).toHaveBeenCalledWith(mockDb, 'VENDOR');
    });

    it('should fetch active entities by CUSTOMER role', async () => {
      const mockCustomers = [createMockEntity({ id: '1', roles: ['CUSTOMER'] })];
      mockGetActiveEntitiesByRole.mockResolvedValue(mockCustomers);

      const { result } = renderHook(() => useActiveEntitiesByRole('CUSTOMER'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGetActiveEntitiesByRole).toHaveBeenCalledWith(mockDb, 'CUSTOMER');
    });

    it('should not fetch when enabled is false', () => {
      const { result } = renderHook(() => useActiveEntitiesByRole('VENDOR', { enabled: false }), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(mockGetActiveEntitiesByRole).not.toHaveBeenCalled();
    });
  });

  describe('useVendors hook', () => {
    it('should fetch active vendors by default', async () => {
      const mockVendors = [createMockEntity({ roles: ['VENDOR'] })];
      mockGetVendors.mockResolvedValue(mockVendors);

      const { result } = renderHook(() => useVendors(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockVendors);
      expect(mockGetVendors).toHaveBeenCalledWith(mockDb, true);
    });

    it('should fetch all vendors when activeOnly is false', async () => {
      mockGetVendors.mockResolvedValue([]);

      const { result } = renderHook(() => useVendors(false), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGetVendors).toHaveBeenCalledWith(mockDb, false);
    });

    it('should not fetch when enabled is false', () => {
      const { result } = renderHook(() => useVendors(true, { enabled: false }), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(mockGetVendors).not.toHaveBeenCalled();
    });
  });

  describe('useCustomers hook', () => {
    it('should fetch active customers by default', async () => {
      const mockCustomers = [createMockEntity({ roles: ['CUSTOMER'] })];
      mockGetCustomers.mockResolvedValue(mockCustomers);

      const { result } = renderHook(() => useCustomers(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockCustomers);
      expect(mockGetCustomers).toHaveBeenCalledWith(mockDb, true);
    });

    it('should fetch all customers when activeOnly is false', async () => {
      mockGetCustomers.mockResolvedValue([]);

      const { result } = renderHook(() => useCustomers(false), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockGetCustomers).toHaveBeenCalledWith(mockDb, false);
    });

    it('should not fetch when enabled is false', () => {
      const { result } = renderHook(() => useCustomers(true, { enabled: false }), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(mockGetCustomers).not.toHaveBeenCalled();
    });
  });

  describe('useSearchEntities hook', () => {
    it('should search entities with term', async () => {
      const mockResults = [createMockEntity({ name: 'ABC Company' })];
      mockSearchEntities.mockResolvedValue(mockResults);

      const { result } = renderHook(() => useSearchEntities('ABC'), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResults);
      expect(mockSearchEntities).toHaveBeenCalledWith(mockDb, 'ABC', undefined);
    });

    it('should not search when term is too short', () => {
      const { result } = renderHook(() => useSearchEntities('A'), { wrapper: createWrapper() });

      expect(result.current.isFetching).toBe(false);
      expect(mockSearchEntities).not.toHaveBeenCalled();
    });

    it('should search with exactly 2 characters', async () => {
      mockSearchEntities.mockResolvedValue([]);

      const { result } = renderHook(() => useSearchEntities('AB'), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockSearchEntities).toHaveBeenCalledWith(mockDb, 'AB', undefined);
    });

    it('should respect custom minSearchLength', () => {
      const { result } = renderHook(
        () => useSearchEntities('AB', undefined, { minSearchLength: 3 }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isFetching).toBe(false);
      expect(mockSearchEntities).not.toHaveBeenCalled();
    });

    it('should pass options to searchEntities', async () => {
      mockSearchEntities.mockResolvedValue([]);

      const options = { role: 'VENDOR' as const };
      const { result } = renderHook(() => useSearchEntities('Test', options), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockSearchEntities).toHaveBeenCalledWith(mockDb, 'Test', options);
    });

    it('should not search when enabled is false', () => {
      const { result } = renderHook(
        () => useSearchEntities('Test', undefined, { enabled: false }),
        { wrapper: createWrapper() }
      );

      expect(result.current.isFetching).toBe(false);
      expect(mockSearchEntities).not.toHaveBeenCalled();
    });
  });

  describe('Database unavailable', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const firebaseHooks = require('@/lib/firebase/hooks');

    beforeEach(() => {
      // Mock useFirestore to return null (no db connection)
      jest.spyOn(firebaseHooks, 'useFirestore').mockReturnValue(null);
    });

    afterEach(() => {
      jest.spyOn(firebaseHooks, 'useFirestore').mockReturnValue(mockDb);
    });

    it('useEntities should not fetch when db is null', () => {
      const { result } = renderHook(() => useEntities(), { wrapper: createWrapper() });

      expect(result.current.isFetching).toBe(false);
      expect(mockQueryEntities).not.toHaveBeenCalled();
    });

    it('useEntity should not fetch when db is null', () => {
      const { result } = renderHook(() => useEntity('entity-123'), { wrapper: createWrapper() });

      expect(result.current.isFetching).toBe(false);
      expect(mockGetEntityById).not.toHaveBeenCalled();
    });

    it('useVendors should not fetch when db is null', () => {
      const { result } = renderHook(() => useVendors(), { wrapper: createWrapper() });

      expect(result.current.isFetching).toBe(false);
      expect(mockGetVendors).not.toHaveBeenCalled();
    });
  });
});
