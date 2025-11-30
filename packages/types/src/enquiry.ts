/**
 * Enquiry Types
 * Tracks incoming client enquiries from receipt to conversion
 */

import { Timestamp } from 'firebase/firestore';
import { TimestampFields, Money } from './common';

/**
 * Enquiry Status
 */
export type EnquiryStatus =
  | 'NEW'
  | 'UNDER_REVIEW'
  | 'PROPOSAL_IN_PROGRESS'
  | 'PROPOSAL_SUBMITTED'
  | 'WON'
  | 'LOST'
  | 'CANCELLED';

/**
 * Enquiry Source
 */
export type EnquirySource = 'EMAIL' | 'PHONE' | 'MEETING' | 'WEBSITE' | 'REFERRAL' | 'OTHER';

/**
 * Enquiry Project Type (renamed from ProjectType to avoid collision with project.ts)
 */
export type EnquiryProjectType =
  | 'SUPPLY_ONLY'
  | 'SUPPLY_AND_INSTALL'
  | 'ENGINEERING_DESIGN'
  | 'TURNKEY'
  | 'OTHER';

/**
 * Enquiry Urgency Level
 * Simplified to 2 levels for clearer prioritization
 */
export type EnquiryUrgency = 'STANDARD' | 'URGENT';

/**
 * Enquiry Document
 */
export interface EnquiryDocument {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  fileType: string;
  uploadedAt: Timestamp;
  uploadedBy: string;
}

/**
 * Enquiry Status Labels
 */
export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  NEW: 'New',
  UNDER_REVIEW: 'Under Review',
  PROPOSAL_IN_PROGRESS: 'Proposal In Progress',
  PROPOSAL_SUBMITTED: 'Proposal Submitted',
  WON: 'Won',
  LOST: 'Lost',
  CANCELLED: 'Cancelled',
};

/**
 * Enquiry Source Labels
 */
export const ENQUIRY_SOURCE_LABELS: Record<EnquirySource, string> = {
  EMAIL: 'Email',
  PHONE: 'Phone',
  MEETING: 'Meeting',
  WEBSITE: 'Website',
  REFERRAL: 'Referral',
  OTHER: 'Other',
};

/**
 * Project Type Labels
 */
export const ENQUIRY_PROJECT_TYPE_LABELS: Record<EnquiryProjectType, string> = {
  SUPPLY_ONLY: 'Supply Only',
  SUPPLY_AND_INSTALL: 'Supply & Install',
  ENGINEERING_DESIGN: 'Engineering Design',
  TURNKEY: 'Turnkey',
  OTHER: 'Other',
};

/**
 * Enquiry Urgency Labels
 */
export const ENQUIRY_URGENCY_LABELS: Record<EnquiryUrgency, string> = {
  STANDARD: 'Standard',
  URGENT: 'Urgent',
};

/**
 * Enquiry Entity
 */
export interface Enquiry extends TimestampFields {
  id: string;
  enquiryNumber: string; // ENQ-2025-0001

  // Organization
  entityId: string; // Company/entity this enquiry belongs to

  // Client Information
  clientId: string; // Link to BusinessEntity
  clientName: string; // Denormalized for display
  clientContactPerson: string;
  clientEmail: string;
  clientPhone: string;
  clientReferenceNumber?: string; // Client's internal reference

  // Enquiry Details
  title: string;
  description: string;
  receivedDate: Timestamp;
  receivedVia: EnquirySource;
  referenceSource?: string; // If referral/website, specify source

  // Requirements
  projectType?: EnquiryProjectType;
  industry?: string; // e.g., Manufacturing, Oil & Gas, Power
  location?: string; // Project site location
  urgency: EnquiryUrgency;
  estimatedBudget?: Money;
  requiredDeliveryDate?: Timestamp;
  requirements?: string[];

  // Status & Workflow
  status: EnquiryStatus;
  assignedToUserId?: string; // Sales/BD person assigned
  assignedToUserName?: string; // Denormalized

  // Documents
  attachedDocuments: EnquiryDocument[]; // Document metadata

  // Audit
  createdBy: string;
  updatedBy: string;

  // Lifecycle Tracking
  proposalCreatedAt?: Timestamp;
  proposalSubmittedAt?: Timestamp;
  outcomeDate?: Timestamp; // When WON/LOST/CANCELLED
  outcomeReason?: string; // Why lost/cancelled
}

/**
 * Create Enquiry Input
 */
export interface CreateEnquiryInput {
  entityId: string;
  clientId: string;
  clientContactPerson: string;
  clientEmail: string;
  clientPhone: string;
  clientReferenceNumber?: string;
  title: string;
  description: string;
  receivedDate: Timestamp;
  receivedVia: EnquirySource;
  referenceSource?: string;
  projectType?: EnquiryProjectType;
  industry?: string;
  location?: string;
  urgency: EnquiryUrgency;
  estimatedBudget?: Money;
  requiredDeliveryDate?: Timestamp;
  requirements?: string[];
  attachments?: EnquiryDocument[];
  assignedToUserId?: string;
}

/**
 * Update Enquiry Input
 */
export interface UpdateEnquiryInput {
  title?: string;
  description?: string;
  clientContactPerson?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientReferenceNumber?: string;
  receivedDate?: Timestamp;
  receivedVia?: EnquirySource;
  referenceSource?: string;
  projectType?: EnquiryProjectType;
  industry?: string;
  location?: string;
  urgency?: EnquiryUrgency;
  estimatedBudget?: Money;
  requiredDeliveryDate?: Timestamp;
  assignedToUserId?: string;
  status?: EnquiryStatus;
}

/**
 * List Enquiries Options
 */
export interface ListEnquiriesOptions {
  entityId: string;
  status?: EnquiryStatus | EnquiryStatus[];
  assignedToUserId?: string;
  clientId?: string;
  urgency?: EnquiryUrgency;
  dateFrom?: Timestamp;
  dateTo?: Timestamp;
  searchTerm?: string;
  limit?: number;
  startAfter?: string;
}
