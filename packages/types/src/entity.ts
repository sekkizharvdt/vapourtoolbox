// Entity Management Types (Vendors, Customers, Partners)

import { EntityRole } from './core';
import { TimestampFields, SoftDeleteFields, Address, Status } from './common';

/**
 * Tax identifiers (extensible for different countries)
 */
export interface TaxIdentifiers {
  // India
  gstin?: string;
  pan?: string;

  // USA
  ein?: string;

  // UAE
  trn?: string;

  // Other
  vatNumber?: string;
  taxId?: string;
}

/**
 * Bank account details
 */
export interface BankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
  ifscCode?: string; // India
  swiftCode?: string; // International
  iban?: string; // International
  branchName?: string;
  branchAddress?: string;
}

/**
 * Credit terms
 */
export interface CreditTerms {
  creditDays: number;
  creditLimit?: number;
  currency?: string;
}

/**
 * Business Entity (Vendor/Customer/Partner)
 */
export interface BusinessEntity extends TimestampFields, SoftDeleteFields {
  id: string;
  code: string; // ENT-001, ENT-002

  // Basic info
  name: string;
  nameNormalized: string; // Lowercase for case-insensitive duplicate checking
  legalName?: string;
  displayName?: string;

  // Role(s)
  roles: EntityRole[];

  // Contact (legacy single contact fields for backward compatibility)
  contactPerson: string;
  email: string;
  phone: string;
  mobile?: string;
  website?: string;

  // Contacts array (new multiple contacts support)
  contacts?: Array<{
    id: string;
    name: string;
    designation?: string;
    email: string;
    phone: string;
    mobile?: string;
    isPrimary: boolean;
    notes?: string;
  }>;

  // Address
  billingAddress: Address;
  shippingAddress?: Address;

  // Tax & Banking
  taxIdentifiers?: TaxIdentifiers;
  bankDetails?: BankDetails[];

  // Terms
  creditTerms?: CreditTerms;
  paymentTerms?: string;

  // Metadata
  industry?: string;
  category?: string;
  tags?: string[];
  notes?: string;

  // Status
  status: Status;
  isActive: boolean;

  // Relationships
  primaryContactId?: string;
  assignedToUserId?: string;

  // Stats (optional, can be computed)
  totalProjects?: number;
  totalTransactions?: number;
  outstandingAmount?: number;
}

/**
 * Entity contact person
 */
export interface EntityContact extends TimestampFields {
  id: string;
  entityId: string;
  name: string;
  designation?: string;
  email: string;
  phone: string;
  mobile?: string;
  isPrimary: boolean;
  isActive: boolean;
}
