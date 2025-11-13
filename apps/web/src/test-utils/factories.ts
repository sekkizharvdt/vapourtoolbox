/**
 * Test Data Factories
 *
 * Factory functions for generating test data fixtures
 */

import { User as FirebaseUser } from 'firebase/auth';
import type { CustomClaims, User } from '@vapour/types';
import { RolePermissions } from '@vapour/types';
import { Timestamp } from 'firebase/firestore';

/**
 * Create a mock Firebase User
 */
export function createMockFirebaseUser(overrides?: Partial<FirebaseUser>): FirebaseUser {
  const defaults: Partial<FirebaseUser> = {
    uid: 'test-uid-123',
    email: 'test@vapourdesal.com',
    displayName: 'Test User',
    emailVerified: true,
    isAnonymous: false,
    metadata: {
      creationTime: new Date().toISOString(),
      lastSignInTime: new Date().toISOString(),
    },
    providerData: [],
    refreshToken: 'mock-refresh-token',
    tenantId: null,
    delete: jest.fn().mockResolvedValue(undefined),
    getIdToken: jest.fn().mockResolvedValue('mock-id-token'),
    getIdTokenResult: jest.fn().mockResolvedValue({
      token: 'mock-id-token',
      claims: {},
      authTime: new Date().toISOString(),
      issuedAtTime: new Date().toISOString(),
      expirationTime: new Date(Date.now() + 3600000).toISOString(),
      signInProvider: 'google.com',
    }),
    reload: jest.fn().mockResolvedValue(undefined),
    toJSON: jest.fn().mockReturnValue({}),
    phoneNumber: null,
    photoURL: 'https://example.com/photo.jpg',
    providerId: 'firebase',
  };

  return { ...defaults, ...overrides } as FirebaseUser;
}

/**
 * Create mock Custom Claims
 */
export function createMockCustomClaims(
  role: keyof typeof RolePermissions = 'TEAM_MEMBER',
  overrides?: Partial<CustomClaims>
): CustomClaims {
  const permissions = RolePermissions[role];

  return {
    permissions,
    domain: 'internal',
    department: 'ENGINEERING',
    ...overrides,
  };
}

/**
 * Create a mock Firebase User with Custom Claims
 */
export function createMockAuthenticatedUser(
  role: keyof typeof RolePermissions = 'TEAM_MEMBER',
  userOverrides?: Partial<FirebaseUser>,
  claimsOverrides?: Partial<CustomClaims>
): FirebaseUser {
  const claims = createMockCustomClaims(role, claimsOverrides);

  const mockUser = createMockFirebaseUser(userOverrides);

  // Mock getIdTokenResult to return claims
  mockUser.getIdTokenResult = jest.fn().mockResolvedValue({
    token: 'mock-id-token',
    claims,
    authTime: new Date().toISOString(),
    issuedAtTime: new Date().toISOString(),
    expirationTime: new Date(Date.now() + 3600000).toISOString(),
    signInProvider: 'google.com',
  });

  return mockUser;
}

/**
 * User role presets for common test scenarios
 */
export const UserRoles = {
  superAdmin: () =>
    createMockAuthenticatedUser('SUPER_ADMIN', {
      uid: 'super-admin-uid',
      email: 'admin@vapourdesal.com',
      displayName: 'Super Admin',
    }),

  director: () =>
    createMockAuthenticatedUser('DIRECTOR', {
      uid: 'director-uid',
      email: 'director@vapourdesal.com',
      displayName: 'Director',
    }),

  projectManager: () =>
    createMockAuthenticatedUser('PROJECT_MANAGER', {
      uid: 'pm-uid',
      email: 'pm@vapourdesal.com',
      displayName: 'Project Manager',
    }),

  procurementManager: () =>
    createMockAuthenticatedUser('PROCUREMENT_MANAGER', {
      uid: 'procurement-uid',
      email: 'procurement@vapourdesal.com',
      displayName: 'Procurement Manager',
    }),

  accountant: () =>
    createMockAuthenticatedUser('ACCOUNTANT', {
      uid: 'accountant-uid',
      email: 'accountant@vapourdesal.com',
      displayName: 'Accountant',
    }),

  financeManager: () =>
    createMockAuthenticatedUser('FINANCE_MANAGER', {
      uid: 'finance-uid',
      email: 'finance@vapourdesal.com',
      displayName: 'Finance Manager',
    }),

  engineeringHead: () =>
    createMockAuthenticatedUser('ENGINEERING_HEAD', {
      uid: 'eng-head-uid',
      email: 'enghead@vapourdesal.com',
      displayName: 'Engineering Head',
    }),

  engineer: () =>
    createMockAuthenticatedUser('ENGINEER', {
      uid: 'engineer-uid',
      email: 'engineer@vapourdesal.com',
      displayName: 'Engineer',
    }),

  siteEngineer: () =>
    createMockAuthenticatedUser('SITE_ENGINEER', {
      uid: 'site-eng-uid',
      email: 'siteeng@vapourdesal.com',
      displayName: 'Site Engineer',
    }),

  teamMember: () =>
    createMockAuthenticatedUser('TEAM_MEMBER', {
      uid: 'member-uid',
      email: 'member@vapourdesal.com',
      displayName: 'Team Member',
    }),

  clientPM: () =>
    createMockAuthenticatedUser(
      'CLIENT_PM',
      {
        uid: 'client-pm-uid',
        email: 'client@external.com',
        displayName: 'Client PM',
      },
      {
        domain: 'external',
      }
    ),

  pendingUser: () =>
    createMockFirebaseUser({
      uid: 'pending-uid',
      email: 'pending@vapourdesal.com',
      displayName: 'Pending User',
    }),
};

/**
 * Create a mock User document (Firestore)
 */
export function createMockUser(
  role: keyof typeof RolePermissions = 'TEAM_MEMBER',
  overrides?: Partial<User>
): User {
  const permissions = RolePermissions[role];
  const now = Timestamp.now();

  return {
    uid: 'test-uid-123',
    email: 'test@vapourdesal.com',
    displayName: 'Test User',
    department: 'ENGINEERING',
    permissions,
    status: 'active',
    isActive: true,
    assignedProjects: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Entity fixtures
 */
export function createMockVendor(overrides?: Partial<any>) {
  return {
    id: 'vendor-123',
    name: 'Test Vendor Ltd',
    role: 'VENDOR',
    type: 'COMPANY',
    status: 'ACTIVE',
    isActive: true,
    taxDetails: {
      gstNumber: '27AABCU9603R1ZM',
      panNumber: 'AABCU9603R',
    },
    contactInfo: {
      email: 'vendor@example.com',
      phone: '+91 98765 43210',
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  };
}

export function createMockCustomer(overrides?: Partial<any>) {
  return {
    id: 'customer-123',
    name: 'Test Customer Inc',
    role: 'CUSTOMER',
    type: 'COMPANY',
    status: 'ACTIVE',
    isActive: true,
    taxDetails: {
      gstNumber: '29AAFCD5862R1ZR',
      panNumber: 'AAFCD5862R',
    },
    contactInfo: {
      email: 'customer@example.com',
      phone: '+91 98765 12345',
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  };
}

/**
 * Project fixtures
 */
export function createMockProject(overrides?: Partial<any>) {
  return {
    id: 'project-123',
    name: 'Test Project',
    projectCode: 'PRJ-2025-001',
    description: 'Test project description',
    status: 'ACTIVE',
    priority: 'MEDIUM',
    customerId: 'customer-123',
    customerName: 'Test Customer Inc',
    startDate: Timestamp.now(),
    teamMembers: [],
    workAreas: ['DESIGN', 'PROCUREMENT'],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    createdBy: 'test-uid-123',
    ...overrides,
  };
}

/**
 * Transaction fixtures
 */
export function createMockBankTransaction(overrides?: Partial<any>) {
  return {
    id: 'bank-txn-123',
    statementId: 'statement-123',
    date: Timestamp.now(),
    description: 'Test bank transaction',
    debit: 0,
    credit: 10000,
    balance: 50000,
    referenceNumber: 'REF12345',
    matched: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  };
}

export function createMockAccountingTransaction(overrides?: Partial<any>) {
  return {
    id: 'acc-txn-123',
    type: 'VENDOR_PAYMENT',
    transactionNumber: 'PAY-001',
    transactionDate: Timestamp.now(),
    amount: 10000,
    currency: 'INR',
    entityId: 'vendor-123',
    status: 'POSTED',
    entries: [
      {
        accountId: 'acc-payable',
        accountCode: '2100',
        accountName: 'Accounts Payable',
        debit: 10000,
        credit: 0,
        description: 'Payment to vendor',
      },
      {
        accountId: 'bank-account',
        accountCode: '1100',
        accountName: 'Bank Account',
        debit: 0,
        credit: 10000,
        description: 'Payment made',
      },
    ],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    createdBy: 'test-uid-123',
    ...overrides,
  };
}

/**
 * Procurement fixtures
 */
export function createMockPurchaseRequest(overrides?: Partial<any>) {
  return {
    id: 'pr-123',
    requestNumber: 'PR-2025-001',
    title: 'Test Purchase Request',
    description: 'Test PR description',
    type: 'PROJECT',
    category: 'RAW_MATERIAL',
    status: 'PENDING',
    priority: 'MEDIUM',
    projectId: 'project-123',
    projectName: 'Test Project',
    items: [
      {
        description: 'Test Item 1',
        quantity: 10,
        unit: 'NOS',
      },
    ],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    createdBy: 'test-uid-123',
    ...overrides,
  };
}

export function createMockRFQ(overrides?: Partial<any>) {
  return {
    id: 'rfq-123',
    rfqNumber: 'RFQ-2025-001',
    title: 'Test RFQ',
    description: 'Test RFQ description',
    status: 'DRAFT',
    purchaseRequestId: 'pr-123',
    projectId: 'project-123',
    vendors: ['vendor-123'],
    items: [
      {
        description: 'Test Item 1',
        quantity: 10,
        unit: 'NOS',
      },
    ],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    createdBy: 'test-uid-123',
    ...overrides,
  };
}

export function createMockPurchaseOrder(overrides?: Partial<any>) {
  return {
    id: 'po-123',
    poNumber: 'PO-2025-001',
    title: 'Test PO',
    status: 'DRAFT',
    vendorId: 'vendor-123',
    vendorName: 'Test Vendor Ltd',
    projectId: 'project-123',
    items: [
      {
        description: 'Test Item 1',
        quantity: 10,
        unit: 'NOS',
        rate: 1000,
        amount: 10000,
      },
    ],
    subtotal: 10000,
    taxAmount: 1800,
    totalAmount: 11800,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    createdBy: 'test-uid-123',
    ...overrides,
  };
}
