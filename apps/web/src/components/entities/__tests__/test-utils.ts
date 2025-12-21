/**
 * Test Utilities for Entities Module
 *
 * Provides mock factories, helpers, and common test setup for entity tests.
 */

import { Timestamp } from 'firebase/firestore';
import type { BusinessEntity, BankDetails, TaxIdentifiers, CreditTerms } from '@vapour/types';
import type { EntityContactData } from '../ContactsManager';
import type { BankDetailsData } from '../BankDetailsManager';

/**
 * Create a mock Firestore Timestamp
 */
export function mockTimestamp(date: Date = new Date()): Timestamp {
  return {
    toDate: () => date,
    toMillis: () => date.getTime(),
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
    isEqual: () => false,
    valueOf: () => '',
    toJSON: () => ({ seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 }),
  } as unknown as Timestamp;
}

/**
 * Create a mock EntityContactData for ContactsManager tests
 */
export function createMockContactData(
  overrides: Partial<EntityContactData> = {}
): EntityContactData {
  return {
    id: `contact-${Math.random().toString(36).slice(2, 10)}`,
    name: 'John Doe',
    designation: 'Manager',
    email: 'john.doe@example.com',
    phone: '+91 9876543210',
    mobile: '+91 9876543211',
    isPrimary: false,
    notes: 'Test contact notes',
    ...overrides,
  };
}

/**
 * Create a mock BankDetailsData for BankDetailsManager tests
 */
export function createMockBankDetailsData(
  overrides: Partial<BankDetailsData> = {}
): BankDetailsData {
  return {
    id: `bank-${Math.random().toString(36).slice(2, 10)}`,
    bankName: 'State Bank of India',
    accountNumber: '1234567890',
    accountName: 'Test Company',
    ifscCode: 'SBIN0001234',
    swiftCode: 'SBININBB',
    iban: undefined,
    branchName: 'Main Branch',
    branchAddress: '123 Bank Street, Mumbai',
    ...overrides,
  };
}

/**
 * Create a mock BankDetails for BusinessEntity
 */
export function createMockBankDetails(overrides: Partial<BankDetails> = {}): BankDetails {
  return {
    bankName: 'State Bank of India',
    accountNumber: '1234567890',
    accountName: 'Test Company',
    ifscCode: 'SBIN0001234',
    swiftCode: 'SBININBB',
    branchName: 'Main Branch',
    branchAddress: '123 Bank Street, Mumbai',
    ...overrides,
  };
}

/**
 * Create mock TaxIdentifiers
 */
export function createMockTaxIdentifiers(overrides: Partial<TaxIdentifiers> = {}): TaxIdentifiers {
  return {
    gstin: '22AAAAA0000A1Z5',
    pan: 'AAAAA0000A',
    ...overrides,
  };
}

/**
 * Create mock CreditTerms
 */
export function createMockCreditTerms(overrides: Partial<CreditTerms> = {}): CreditTerms {
  return {
    creditDays: 30,
    creditLimit: 100000,
    currency: 'INR',
    ...overrides,
  };
}

/**
 * Create a mock BusinessEntity
 */
export function createMockEntity(overrides: Partial<BusinessEntity> = {}): BusinessEntity {
  const now = new Date();
  const entity: BusinessEntity = {
    id: `entity-${Math.random().toString(36).slice(2, 10)}`,
    code: 'ENT-001',
    name: 'Test Entity Pvt Ltd',
    nameNormalized: 'test entity pvt ltd',
    legalName: 'Test Entity Private Limited',
    roles: ['VENDOR'],
    contactPerson: 'John Doe',
    email: 'contact@testentity.com',
    phone: '+91 9876543210',
    mobile: '+91 9876543211',
    contacts: [
      {
        id: 'contact-1',
        name: 'John Doe',
        designation: 'Manager',
        email: 'john@testentity.com',
        phone: '+91 9876543210',
        mobile: '+91 9876543211',
        isPrimary: true,
        notes: 'Primary contact',
      },
    ],
    billingAddress: {
      line1: '123 Test Street',
      line2: 'Test Area',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      postalCode: '400001',
    },
    shippingAddress: {
      line1: '456 Warehouse Road',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      postalCode: '400002',
    },
    taxIdentifiers: {
      gstin: '22AAAAA0000A1Z5',
      pan: 'AAAAA0000A',
    },
    bankDetails: [createMockBankDetails()],
    creditTerms: {
      creditDays: 30,
      creditLimit: 100000,
      currency: 'INR',
    },
    notes: 'Test entity notes',
    isActive: true,
    isDeleted: false,
    isArchived: false,
    createdAt: mockTimestamp(now),
    updatedAt: mockTimestamp(now),
    ...overrides,
  };

  return entity;
}

/**
 * Create a mock archived entity
 */
export function createMockArchivedEntity(overrides: Partial<BusinessEntity> = {}): BusinessEntity {
  const archiveDate = new Date();
  return createMockEntity({
    isActive: false,
    isArchived: true,
    archivedAt: archiveDate,
    archivedBy: 'user-123',
    archivedByName: 'Admin User',
    archiveReason: 'Company closed operations',
    ...overrides,
  });
}

/**
 * Create a mock entity with legacy contact format (no contacts array)
 */
export function createMockLegacyEntity(overrides: Partial<BusinessEntity> = {}): BusinessEntity {
  const entity = createMockEntity(overrides);
  // Remove the contacts array to simulate legacy format
  delete entity.contacts;
  return entity;
}

/**
 * Create mock cascade delete check result
 */
export function createMockCascadeResult(
  canDelete: boolean,
  overrides: {
    transactions?: number;
    projects?: number;
    purchaseOrders?: number;
  } = {}
) {
  const { transactions = 0, projects = 0, purchaseOrders = 0 } = overrides;
  const totalReferences = transactions + projects + purchaseOrders;

  const blockingParts: string[] = [];
  if (transactions > 0) blockingParts.push(`${transactions} transaction(s)`);
  if (projects > 0) blockingParts.push(`${projects} project(s)`);
  if (purchaseOrders > 0) blockingParts.push(`${purchaseOrders} purchase order(s)`);

  return {
    canDelete,
    totalReferences,
    blockingReferences: {
      transactions,
      projects,
      purchaseOrders,
    },
    message: canDelete
      ? 'Entity can be safely deleted'
      : `Cannot delete: entity is referenced by ${blockingParts.join(', ')}`,
  };
}

/**
 * Mock user for AuthContext
 */
export const mockUser = {
  uid: 'test-user-123',
  email: 'test@vapourdesal.com',
  displayName: 'Test User',
  emailVerified: true,
};

/**
 * Mock admin user for AuthContext
 */
export const mockAdminUser = {
  uid: 'admin-user-123',
  email: 'admin@vapourdesal.com',
  displayName: 'Admin User',
  emailVerified: true,
};

/**
 * Create a wrapper for rendering components with necessary providers
 * (Used when React Query or other context providers are needed)
 */
export function createWrapper() {
  // eslint-disable-next-line react/display-name
  return ({ children }: { children: React.ReactNode }) => children;
}

/**
 * Wait for async operations in tests
 */
export function waitForAsync(ms: number = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
