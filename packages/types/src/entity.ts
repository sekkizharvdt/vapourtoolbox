// Entity Management Types (Vendors, Customers, Partners)

import { EntityRole } from './core';
import { TimestampFields, SoftDeleteFields, Address } from './common';

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

  // Role(s)
  roles: EntityRole[];

  // Contact (legacy single contact fields for backward compatibility)
  contactPerson: string;
  email: string;
  phone: string;
  mobile?: string;

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

  // Opening Balance for Accounting
  openingBalance?: number;
  openingBalanceType?: 'DR' | 'CR'; // Debit or Credit

  // Notes
  notes?: string;

  // Status
  isActive: boolean;

  // Archive info (entities are never deleted, only archived)
  isArchived?: boolean;
  archivedAt?: Date;
  archivedBy?: string;
  archivedByName?: string;
  archiveReason?: string;

  // Relationships
  primaryContactId?: string;
  assignedToUserId?: string;
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
