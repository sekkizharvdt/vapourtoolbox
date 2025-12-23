/**
 * Business Entity Service Tests
 *
 * Tests for business entity querying, filtering, and cascade deletion.
 */

import {
  queryEntities,
  getEntityById,
  getActiveEntitiesByRole,
  getVendors,
  getCustomers,
  searchEntities,
  checkEntityCascadeDelete,
} from './businessEntityService';
import { getDocs, getDoc, where, orderBy, limit, collection, Timestamp } from 'firebase/firestore';
import type { BusinessEntity } from '@vapour/types';

// Helper to create mock timestamp
function createMockTimestamp(date: Date = new Date()): Timestamp {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return {
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  } as Timestamp;
}

// Mock Firebase
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn((q) => q),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  doc: jest.fn(),
}));

jest.mock('@vapour/firebase', () => ({
  COLLECTIONS: {
    ENTITIES: 'entities',
    TRANSACTIONS: 'transactions',
    PROJECTS: 'projects',
    PURCHASE_ORDERS: 'purchaseOrders',
  },
}));

jest.mock('@vapour/logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('@/lib/firebase/typeHelpers', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  docToTyped: jest.fn((id: string, data: any) => ({ id, ...data })),
}));

// Helper to create mock entity
function createMockEntity(overrides: Partial<BusinessEntity> = {}): BusinessEntity {
  const entity: BusinessEntity = {
    id: 'entity-1',
    code: 'ENT001',
    name: 'Test Entity',
    nameNormalized: 'test entity',
    roles: ['VENDOR'],
    contactPerson: 'John Doe',
    email: 'john@example.com',
    phone: '1234567890',
    isActive: true,
    isDeleted: false,
    billingAddress: {
      line1: '123 Test St',
      city: 'Test City',
      state: 'Test State',
      country: 'India',
      postalCode: '123456',
    },
    createdAt: createMockTimestamp(),
    updatedAt: createMockTimestamp(),
    ...overrides,
  };
  return entity;
}

// Helper to create mock query snapshot
function createMockSnapshot(entities: BusinessEntity[]) {
  return {
    docs: entities.map((entity) => ({
      id: entity.id,
      data: () => entity,
      exists: () => true,
    })),
    size: entities.length,
  };
}

describe('businessEntityService', () => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const mockDb = {} as Parameters<typeof queryEntities>[0];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('queryEntities', () => {
    it('should return all active entities by default', async () => {
      const entities = [createMockEntity(), createMockEntity({ id: 'entity-2' })];
      (getDocs as jest.Mock).mockResolvedValue(createMockSnapshot(entities));

      const result = await queryEntities(mockDb);

      expect(result.items).toHaveLength(2);
      expect(collection).toHaveBeenCalledWith(mockDb, 'entities');
    });

    it('should filter by status', async () => {
      const entities = [createMockEntity()];
      (getDocs as jest.Mock).mockResolvedValue(createMockSnapshot(entities));

      await queryEntities(mockDb, { status: 'active' });

      expect(where).toHaveBeenCalledWith('status', '==', 'active');
    });

    it('should filter by multiple statuses using IN', async () => {
      const entities = [createMockEntity()];
      (getDocs as jest.Mock).mockResolvedValue(createMockSnapshot(entities));

      await queryEntities(mockDb, { status: ['active', 'draft'] });

      expect(where).toHaveBeenCalledWith('status', 'in', ['active', 'draft']);
    });

    it('should filter by isActive', async () => {
      const entities = [createMockEntity({ isActive: true })];
      (getDocs as jest.Mock).mockResolvedValue(createMockSnapshot(entities));

      await queryEntities(mockDb, { isActive: true });

      expect(where).toHaveBeenCalledWith('isActive', '==', true);
    });

    it('should filter by assignedToUserId', async () => {
      const entities = [createMockEntity()];
      (getDocs as jest.Mock).mockResolvedValue(createMockSnapshot(entities));

      await queryEntities(mockDb, { assignedToUserId: 'user-123' });

      expect(where).toHaveBeenCalledWith('assignedToUserId', '==', 'user-123');
    });

    it('should filter by role client-side', async () => {
      const vendorEntity = createMockEntity({ roles: ['VENDOR'] });
      const customerEntity = createMockEntity({ id: 'entity-2', roles: ['CUSTOMER'] });
      (getDocs as jest.Mock).mockResolvedValue(createMockSnapshot([vendorEntity, customerEntity]));

      const result = await queryEntities(mockDb, { role: 'VENDOR' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.roles).toContain('VENDOR');
    });

    it('should filter by multiple roles', async () => {
      const vendorEntity = createMockEntity({ roles: ['VENDOR'] });
      const customerEntity = createMockEntity({ id: 'entity-2', roles: ['CUSTOMER'] });
      const partnerEntity = createMockEntity({ id: 'entity-3', roles: ['PARTNER'] });
      (getDocs as jest.Mock).mockResolvedValue(
        createMockSnapshot([vendorEntity, customerEntity, partnerEntity])
      );

      const result = await queryEntities(mockDb, { role: ['VENDOR', 'CUSTOMER'] });

      expect(result.items).toHaveLength(2);
    });

    it('should exclude soft-deleted entities', async () => {
      const activeEntity = createMockEntity({ isDeleted: false });
      const deletedEntity = createMockEntity({ id: 'entity-2', isDeleted: true });
      (getDocs as jest.Mock).mockResolvedValue(createMockSnapshot([activeEntity, deletedEntity]));

      const result = await queryEntities(mockDb);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.isDeleted).toBe(false);
    });

    it('should apply custom ordering', async () => {
      const entities = [createMockEntity()];
      (getDocs as jest.Mock).mockResolvedValue(createMockSnapshot(entities));

      await queryEntities(mockDb, { orderByField: 'name', orderDirection: 'asc' });

      expect(orderBy).toHaveBeenCalledWith('name', 'asc');
    });

    it('should apply limit (with +1 for hasMore check)', async () => {
      const entities = [createMockEntity()];
      (getDocs as jest.Mock).mockResolvedValue(createMockSnapshot(entities));

      await queryEntities(mockDb, { limitResults: 50 });

      // Limit is pageSize + 1 to check if there are more results
      expect(limit).toHaveBeenCalledWith(51);
    });

    it('should throw error on Firestore failure', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('Firestore error'));

      await expect(queryEntities(mockDb)).rejects.toThrow('Failed to query entities');
    });
  });

  describe('getEntityById', () => {
    it('should return entity when found', async () => {
      const entity = createMockEntity();
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        id: entity.id,
        data: () => entity,
      });

      const result = await getEntityById(mockDb, 'entity-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('entity-1');
    });

    it('should return null when entity not found', async () => {
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => false,
      });

      const result = await getEntityById(mockDb, 'nonexistent');

      expect(result).toBeNull();
    });

    it('should return null for soft-deleted entity', async () => {
      const deletedEntity = createMockEntity({ isDeleted: true });
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        id: deletedEntity.id,
        data: () => deletedEntity,
      });

      const result = await getEntityById(mockDb, deletedEntity.id);

      expect(result).toBeNull();
    });

    it('should throw error on Firestore failure', async () => {
      (getDoc as jest.Mock).mockRejectedValue(new Error('Firestore error'));

      await expect(getEntityById(mockDb, 'entity-1')).rejects.toThrow('Failed to get entity');
    });
  });

  describe('getActiveEntitiesByRole', () => {
    it('should query active entities with specified role', async () => {
      const vendorEntities = [createMockEntity({ roles: ['VENDOR'] })];
      (getDocs as jest.Mock).mockResolvedValue(createMockSnapshot(vendorEntities));

      const result = await getActiveEntitiesByRole(mockDb, 'VENDOR');

      expect(result).toHaveLength(1);
      expect(where).toHaveBeenCalledWith('isActive', '==', true);
    });
  });

  describe('getVendors', () => {
    it('should return active vendors by default', async () => {
      const vendors = [createMockEntity({ roles: ['VENDOR'] })];
      (getDocs as jest.Mock).mockResolvedValue(createMockSnapshot(vendors));

      const result = await getVendors(mockDb);

      expect(result).toHaveLength(1);
      expect(where).toHaveBeenCalledWith('isActive', '==', true);
    });

    it('should return all vendors when activeOnly is false', async () => {
      const vendors = [
        createMockEntity({ roles: ['VENDOR'], isActive: true }),
        createMockEntity({ id: 'entity-2', roles: ['VENDOR'], isActive: false }),
      ];
      (getDocs as jest.Mock).mockResolvedValue(createMockSnapshot(vendors));

      const result = await getVendors(mockDb, false);

      expect(result).toHaveLength(2);
    });
  });

  describe('getCustomers', () => {
    it('should return active customers by default', async () => {
      const customers = [createMockEntity({ roles: ['CUSTOMER'] })];
      (getDocs as jest.Mock).mockResolvedValue(createMockSnapshot(customers));

      const result = await getCustomers(mockDb);

      expect(result).toHaveLength(1);
    });
  });

  describe('searchEntities', () => {
    it('should filter by name', async () => {
      // Use unique nameNormalized values to properly test name filtering
      const entities = [
        createMockEntity({
          name: 'ABC Corporation',
          nameNormalized: 'abc corporation',
          code: 'A001',
        }),
        createMockEntity({
          id: 'entity-2',
          name: 'XYZ Limited',
          nameNormalized: 'xyz limited',
          code: 'X001',
        }),
      ];
      (getDocs as jest.Mock).mockResolvedValue(createMockSnapshot(entities));

      // Use short search term to force client-side filtering
      const result = await searchEntities(mockDb, 'AB');

      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('ABC Corporation');
    });

    it('should filter by code', async () => {
      // Use unique nameNormalized values to properly test code filtering
      const entities = [
        createMockEntity({
          code: 'VND001',
          nameNormalized: 'vendor one',
        }),
        createMockEntity({
          id: 'entity-2',
          code: 'CUS001',
          nameNormalized: 'customer one',
        }),
      ];
      (getDocs as jest.Mock).mockResolvedValue(createMockSnapshot(entities));

      // Use short search term to force client-side filtering
      const result = await searchEntities(mockDb, 'VN');

      expect(result).toHaveLength(1);
    });

    it('should be case-insensitive', async () => {
      const entities = [
        createMockEntity({
          name: 'ABC Corporation',
          nameNormalized: 'abc corporation',
        }),
      ];
      (getDocs as jest.Mock).mockResolvedValue(createMockSnapshot(entities));

      // Use short search term to force client-side filtering
      const result = await searchEntities(mockDb, 'ab');

      expect(result).toHaveLength(1);
    });

    it('should filter by contactPerson', async () => {
      // Use completely unique values across all searchable fields
      const entities = [
        createMockEntity({
          code: 'X001',
          name: 'Alpha',
          nameNormalized: 'alpha',
          contactPerson: 'Bob Wilson',
          email: 'alpha@test.net',
        }),
        createMockEntity({
          id: 'entity-2',
          code: 'X002',
          name: 'Beta',
          nameNormalized: 'beta',
          contactPerson: 'Amy Davis',
          email: 'beta@test.net',
        }),
      ];
      (getDocs as jest.Mock).mockResolvedValue(createMockSnapshot(entities));

      // Search for 'Bo' which only matches 'Bob Wilson'
      const result = await searchEntities(mockDb, 'Bo');

      expect(result).toHaveLength(1);
      expect(result[0]!.contactPerson).toBe('Bob Wilson');
    });

    it('should filter by email', async () => {
      // Use completely unique values across all searchable fields
      const entities = [
        createMockEntity({
          code: 'Y001',
          name: 'Gamma',
          nameNormalized: 'gamma',
          contactPerson: 'Tim Ray',
          email: 'unique123@test.net',
        }),
        createMockEntity({
          id: 'entity-2',
          code: 'Y002',
          name: 'Delta',
          nameNormalized: 'delta',
          contactPerson: 'Sue Lin',
          email: 'other456@test.net',
        }),
      ];
      (getDocs as jest.Mock).mockResolvedValue(createMockSnapshot(entities));

      // Search for '123' which only matches 'unique123@test.net'
      const result = await searchEntities(mockDb, '12');

      expect(result).toHaveLength(1);
      expect(result[0]!.email).toBe('unique123@test.net');
    });

    it('should use nameNormalized when available', async () => {
      const entities = [createMockEntity({ nameNormalized: 'test entity normalized' })];
      (getDocs as jest.Mock).mockResolvedValue(createMockSnapshot(entities));

      const result = await searchEntities(mockDb, 'normalized');

      expect(result).toHaveLength(1);
    });

    it('should apply additional query options', async () => {
      const entities = [createMockEntity({ name: 'ABC', roles: ['VENDOR'] })];
      (getDocs as jest.Mock).mockResolvedValue(createMockSnapshot(entities));

      const result = await searchEntities(mockDb, 'ABC', { role: 'VENDOR' });

      expect(result).toHaveLength(1);
    });
  });

  describe('checkEntityCascadeDelete', () => {
    it('should return canDelete true when no references exist', async () => {
      // Mock all queries returning empty
      (getDocs as jest.Mock).mockResolvedValue(createMockSnapshot([]));

      const result = await checkEntityCascadeDelete(mockDb, 'entity-1');

      expect(result.canDelete).toBe(true);
      expect(result.totalReferences).toBe(0);
      expect(result.message).toContain('safely deleted');
    });

    it('should return canDelete false when transactions exist', async () => {
      (getDocs as jest.Mock)
        .mockResolvedValueOnce({ docs: [{}], size: 1 }) // transactions
        .mockResolvedValueOnce({ docs: [], size: 0 }) // projects
        .mockResolvedValueOnce({ docs: [], size: 0 }); // purchase orders

      const result = await checkEntityCascadeDelete(mockDb, 'entity-1');

      expect(result.canDelete).toBe(false);
      expect(result.blockingReferences.transactions).toBe(1);
      expect(result.message).toContain('transaction(s)');
    });

    it('should return canDelete false when projects exist', async () => {
      (getDocs as jest.Mock)
        .mockResolvedValueOnce({ docs: [], size: 0 }) // transactions
        .mockResolvedValueOnce({ docs: [{}], size: 1 }) // projects
        .mockResolvedValueOnce({ docs: [], size: 0 }); // purchase orders

      const result = await checkEntityCascadeDelete(mockDb, 'entity-1');

      expect(result.canDelete).toBe(false);
      expect(result.blockingReferences.projects).toBe(1);
      expect(result.message).toContain('project(s)');
    });

    it('should return canDelete false when purchase orders exist', async () => {
      (getDocs as jest.Mock)
        .mockResolvedValueOnce({ docs: [], size: 0 }) // transactions
        .mockResolvedValueOnce({ docs: [], size: 0 }) // projects
        .mockResolvedValueOnce({ docs: [{}], size: 1 }); // purchase orders

      const result = await checkEntityCascadeDelete(mockDb, 'entity-1');

      expect(result.canDelete).toBe(false);
      expect(result.blockingReferences.purchaseOrders).toBe(1);
      expect(result.message).toContain('purchase order(s)');
    });

    it('should list all blocking references in message', async () => {
      (getDocs as jest.Mock)
        .mockResolvedValueOnce({ docs: [{}], size: 1 }) // transactions
        .mockResolvedValueOnce({ docs: [{}], size: 1 }) // projects
        .mockResolvedValueOnce({ docs: [{}], size: 1 }); // purchase orders

      const result = await checkEntityCascadeDelete(mockDb, 'entity-1');

      expect(result.canDelete).toBe(false);
      expect(result.totalReferences).toBe(3);
      expect(result.message).toContain('transaction(s)');
      expect(result.message).toContain('project(s)');
      expect(result.message).toContain('purchase order(s)');
    });

    it('should throw error on Firestore failure', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('Firestore error'));

      await expect(checkEntityCascadeDelete(mockDb, 'entity-1')).rejects.toThrow(
        'Failed to check entity references'
      );
    });
  });
});
