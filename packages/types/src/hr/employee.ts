/**
 * Employee HR Profile Types
 *
 * Extended employee information for HR management.
 * This data is stored in the user's hrProfile field.
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Blood group types
 */
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'UNKNOWN';

/**
 * Gender types
 */
export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';

/**
 * Marital status types
 */
export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED' | 'OTHER';

/**
 * Employment type
 */
export type EmploymentType = 'PERMANENT' | 'CONTRACT' | 'PROBATION' | 'INTERN' | 'CONSULTANT';

/**
 * Emergency contact information
 */
export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  address?: string;
}

/**
 * Bank account details for salary/reimbursements
 */
export interface EmployeeBankDetails {
  accountNumber: string;
  bankName: string;
  ifscCode: string;
  accountHolderName: string;
  branchName?: string;
}

/**
 * Address information
 */
export interface EmployeeAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/**
 * Document/ID information
 */
export interface IdentityDocument {
  type: 'PAN' | 'AADHAAR' | 'PASSPORT' | 'DRIVING_LICENSE' | 'VOTER_ID' | 'OTHER';
  number: string;
  expiryDate?: Timestamp;
  documentUrl?: string;
}

/**
 * Extended HR Profile stored in User document
 */
export interface HRProfile {
  // Basic Employment Info
  employeeId?: string; // Employee ID (e.g., VDT-001)
  employmentType?: EmploymentType;
  dateOfJoining?: Timestamp;
  dateOfBirth?: Timestamp;
  probationEndDate?: Timestamp;
  confirmationDate?: Timestamp;
  resignationDate?: Timestamp;
  lastWorkingDate?: Timestamp;

  // Personal Info
  gender?: Gender;
  bloodGroup?: BloodGroup;
  maritalStatus?: MaritalStatus;
  nationality?: string;
  personalEmail?: string;
  personalPhone?: string;

  // Reporting Structure
  reportingManagerId?: string; // Manager's UID for hierarchy
  reportingManagerName?: string; // Denormalized for display

  // Address
  currentAddress?: EmployeeAddress;
  permanentAddress?: EmployeeAddress;

  // Emergency Contact (primary)
  emergencyContact?: EmergencyContact;
  // Secondary emergency contact
  emergencyContact2?: EmergencyContact;

  // Bank Details
  bankDetails?: EmployeeBankDetails;

  // Identity Documents
  identityDocuments?: IdentityDocument[];
  panNumber?: string;
  aadhaarNumber?: string;

  // Insurance & Benefits
  insuranceNumber?: string;
  pfAccountNumber?: string; // Provident Fund
  uanNumber?: string; // Universal Account Number
  esicNumber?: string; // Employee State Insurance Corporation

  // Additional Info
  notes?: string;
}

/**
 * Employee listing item (for directory view)
 */
export interface EmployeeListItem {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  department?: string;
  jobTitle?: string;
  phone?: string;
  mobile?: string;
  isActive: boolean;
  status: string;

  // HR specific fields
  employeeId?: string;
  dateOfJoining?: Timestamp;
  bloodGroup?: BloodGroup;
  reportingManagerId?: string;
  reportingManagerName?: string;
}

/**
 * Employee detail view (full profile)
 */
export interface EmployeeDetail extends EmployeeListItem {
  hrProfile?: HRProfile;
  assignedProjects?: string[];
  lastLoginAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
