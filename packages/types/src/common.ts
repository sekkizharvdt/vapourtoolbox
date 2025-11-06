// Common types used across all modules

import { Timestamp as FirestoreTimestamp } from 'firebase/firestore';

// Re-export Timestamp for use in other type modules
export type Timestamp = FirestoreTimestamp;

/**
 * Base timestamp fields for all documents
 */
export interface TimestampFields {
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Soft delete fields
 */
export interface SoftDeleteFields {
  isDeleted?: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
  deletionReason?: string;
}

/**
 * User status
 */
export type UserStatus = 'active' | 'inactive' | 'pending';

/**
 * Generic status
 */
export type Status = 'active' | 'inactive' | 'draft' | 'archived';

/**
 * Currency codes (ISO 4217)
 */
export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'SGD';

/**
 * Money amount with currency
 */
export interface Money {
  amount: number;
  currency: CurrencyCode;
}

/**
 * Address structure
 */
export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/**
 * Contact information
 */
export interface ContactInfo {
  email: string;
  phone: string;
  mobile?: string;
  fax?: string;
}

/**
 * Approval status
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

/**
 * Approval entry
 */
export interface Approval {
  userId: string;
  userName: string;
  status: ApprovalStatus;
  timestamp: Timestamp;
  comments?: string;
}
