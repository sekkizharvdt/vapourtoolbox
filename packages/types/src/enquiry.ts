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
  | 'BID_DECISION_PENDING' // Awaiting bid/no-bid decision
  | 'NO_BID' // Decision made not to bid - terminal state
  | 'PROPOSAL_IN_PROGRESS'
  | 'PROPOSAL_SUBMITTED'
  | 'WON'
  | 'LOST'
  | 'CANCELLED';

/**
 * Bid Decision Type
 */
export type BidDecision = 'BID' | 'NO_BID';

/**
 * Bid Evaluation Rating
 */
export type BidEvaluationRating =
  | 'STRONG_FIT'
  | 'MODERATE_FIT'
  | 'WEAK_FIT'
  | 'NO_FIT'
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'UNKNOWN'
  | 'HIGHLY_VIABLE'
  | 'VIABLE'
  | 'MARGINAL'
  | 'NOT_VIABLE'
  | 'LOW_RISK'
  | 'MODERATE_RISK'
  | 'HIGH_RISK'
  | 'UNACCEPTABLE_RISK'
  | 'FULLY_CAPABLE'
  | 'CAPABLE_WITH_PLANNING'
  | 'STRETCHED'
  | 'NOT_CAPABLE';

/**
 * Bid Evaluation Criteria
 */
export interface BidEvaluationCriteria {
  /** Strategic Alignment - Does this align with our strategy and competencies? */
  strategicAlignment: {
    rating: 'STRONG_FIT' | 'MODERATE_FIT' | 'WEAK_FIT' | 'NO_FIT';
    notes?: string;
  };
  /** Win Probability - Do we have a realistic chance of winning? */
  winProbability: {
    rating: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
    notes?: string;
  };
  /** Commercial Viability - Will this deliver acceptable margins? */
  commercialViability: {
    rating: 'HIGHLY_VIABLE' | 'VIABLE' | 'MARGINAL' | 'NOT_VIABLE';
    notes?: string;
  };
  /** Risk Exposure - Are the risks manageable? */
  riskExposure: {
    rating: 'LOW_RISK' | 'MODERATE_RISK' | 'HIGH_RISK' | 'UNACCEPTABLE_RISK';
    notes?: string;
  };
  /** Capacity and Capability - Do we have the resources? */
  capacityCapability: {
    rating: 'FULLY_CAPABLE' | 'CAPABLE_WITH_PLANNING' | 'STRETCHED' | 'NOT_CAPABLE';
    notes?: string;
  };
}

/**
 * Previous Bid Decision (for revision tracking)
 */
export interface PreviousBidDecision {
  decision: BidDecision;
  decidedBy: string;
  decidedByName: string;
  decidedAt: Timestamp;
  rationale: string;
}

/**
 * Bid Decision Record
 */
export interface BidDecisionRecord {
  decision: BidDecision;
  evaluation: BidEvaluationCriteria;
  rationale: string; // Required summary explaining the decision
  decidedBy: string; // User ID
  decidedByName: string; // Denormalized user name
  decidedAt: Timestamp;
  // Optional: tracks the previous decision if this is a revision
  previousDecision?: PreviousBidDecision;
}

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
  BID_DECISION_PENDING: 'Bid Decision Pending',
  NO_BID: 'No Bid',
  PROPOSAL_IN_PROGRESS: 'Proposal In Progress',
  PROPOSAL_SUBMITTED: 'Proposal Submitted',
  WON: 'Won',
  LOST: 'Lost',
  CANCELLED: 'Cancelled',
};

/**
 * Bid Decision Labels
 */
export const BID_DECISION_LABELS: Record<BidDecision, string> = {
  BID: 'Bid',
  NO_BID: 'No Bid',
};

/**
 * Strategic Alignment Rating Labels
 */
export const STRATEGIC_ALIGNMENT_LABELS: Record<
  BidEvaluationCriteria['strategicAlignment']['rating'],
  string
> = {
  STRONG_FIT: 'Strong Fit',
  MODERATE_FIT: 'Moderate Fit',
  WEAK_FIT: 'Weak Fit',
  NO_FIT: 'No Fit',
};

/**
 * Win Probability Rating Labels
 */
export const WIN_PROBABILITY_LABELS: Record<
  BidEvaluationCriteria['winProbability']['rating'],
  string
> = {
  HIGH: 'High (>60%)',
  MEDIUM: 'Medium (30-60%)',
  LOW: 'Low (<30%)',
  UNKNOWN: 'Unknown',
};

/**
 * Commercial Viability Rating Labels
 */
export const COMMERCIAL_VIABILITY_LABELS: Record<
  BidEvaluationCriteria['commercialViability']['rating'],
  string
> = {
  HIGHLY_VIABLE: 'Highly Viable',
  VIABLE: 'Viable',
  MARGINAL: 'Marginal',
  NOT_VIABLE: 'Not Viable',
};

/**
 * Risk Exposure Rating Labels
 */
export const RISK_EXPOSURE_LABELS: Record<
  BidEvaluationCriteria['riskExposure']['rating'],
  string
> = {
  LOW_RISK: 'Low Risk',
  MODERATE_RISK: 'Moderate Risk',
  HIGH_RISK: 'High Risk',
  UNACCEPTABLE_RISK: 'Unacceptable Risk',
};

/**
 * Capacity Capability Rating Labels
 */
export const CAPACITY_CAPABILITY_LABELS: Record<
  BidEvaluationCriteria['capacityCapability']['rating'],
  string
> = {
  FULLY_CAPABLE: 'Fully Capable',
  CAPABLE_WITH_PLANNING: 'Capable with Planning',
  STRETCHED: 'Stretched',
  NOT_CAPABLE: 'Not Capable',
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

  // Bid Decision
  bidDecision?: BidDecisionRecord;
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
