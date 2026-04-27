/**
 * Enquiry Types
 * Tracks incoming client enquiries from receipt to conversion
 */

import { Timestamp } from 'firebase/firestore';
import { TimestampFields, Money } from './common';
import type { WorkComponent, UnifiedScopeMatrix } from './proposal';

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
 * Enquiry Urgency Level
 * Simplified to 2 levels for clearer prioritization
 */
export type EnquiryUrgency = 'STANDARD' | 'URGENT';

/**
 * Categories used to classify conditions/stipulations the buyer puts on a
 * bidder in an RFP/SOW. Drives the conditions section of an enquiry.
 */
export type ConditionCategory =
  | 'BIDDER_QUALIFICATION' // Years of experience, prior projects, in-house team, CVs, references
  | 'COMMERCIAL' // Validity, payment terms, currency, advance, retention
  | 'COMPLIANCE' // GST, statutory codes (ASME/ISO), insurance, warranty
  | 'CONFIDENTIALITY' // NDA, IP, data ownership
  | 'HSE' // Site safety, PPE, training, induction
  | 'REPORTING' // Daily reports, review meetings, progress cadence
  | 'SUBMISSION' // Bid format, references count, CV attachments
  | 'PENALTY' // Liquidated damages, performance bond, guarantee bank
  | 'OTHER';

/**
 * A single condition / stipulation captured on an enquiry. Either parsed by
 * AI from the SOW or added manually.
 */
export interface EnquiryCondition {
  id: string;
  category: ConditionCategory;
  /** Short summary, ~10 words. Editable by the user. */
  summary: string;
  /** Exact quote from the source document, for traceability. */
  verbatim?: string;
  /** Where this condition came from. */
  source: 'AI_PARSED' | 'MANUAL';
}

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
export const RISK_EXPOSURE_LABELS: Record<BidEvaluationCriteria['riskExposure']['rating'], string> =
  {
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
 * Enquiry Urgency Labels
 */
export const ENQUIRY_URGENCY_LABELS: Record<EnquiryUrgency, string> = {
  STANDARD: 'Standard',
  URGENT: 'Urgent',
};

/**
 * Pre-proposal statuses — enquiries that haven't yet progressed to a proposal
 */
export const ENQUIRY_PRE_PROPOSAL_STATUSES: EnquiryStatus[] = [
  'NEW',
  'UNDER_REVIEW',
  'BID_DECISION_PENDING',
];

/**
 * Active statuses — anything still in flight (not yet won/lost/cancelled).
 * Covers pre-decision, in-progress, and submitted. Used as the default
 * filter on the enquiries list so an enquiry doesn't fall off the page
 * the moment a bid decision is made.
 */
export const ENQUIRY_ACTIVE_STATUSES: EnquiryStatus[] = [
  'NEW',
  'UNDER_REVIEW',
  'BID_DECISION_PENDING',
  'PROPOSAL_IN_PROGRESS',
  'PROPOSAL_SUBMITTED',
];

/**
 * Lost-bucket statuses — enquiries that didn't convert, regardless of why.
 */
export const ENQUIRY_LOST_STATUSES: EnquiryStatus[] = ['LOST', 'NO_BID', 'CANCELLED'];

/**
 * Enquiry Entity
 */
export interface Enquiry extends TimestampFields {
  id: string;
  enquiryNumber: string; // ENQ-2025-0001

  // Organization
  tenantId: string; // Company/entity this enquiry belongs to

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
  workComponents?: WorkComponent[];
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

  // Conditions / stipulations parsed from the SOW or added manually
  conditions?: EnquiryCondition[];

  // Scope outline parsed from the SOW. Each item carries source: 'AI_PARSED'.
  // On proposal creation, this is copied into proposal.unifiedScopeMatrix as
  // the starting point — the proposal team then refines (adds, excludes with
  // a reason, links BOMs, etc.).
  requestedScope?: UnifiedScopeMatrix;

  // Set when the user has at least once visited the scope-triage screen and
  // saved. Drives the "Review parsed scope" banner on the enquiry detail.
  scopeReviewedAt?: Timestamp;
  scopeReviewedBy?: string;

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
  tenantId: string;
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
  workComponents?: WorkComponent[];
  industry?: string;
  location?: string;
  urgency: EnquiryUrgency;
  estimatedBudget?: Money;
  requiredDeliveryDate?: Timestamp;
  requirements?: string[];
  attachments?: EnquiryDocument[];
  conditions?: EnquiryCondition[];
  requestedScope?: UnifiedScopeMatrix;
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
  workComponents?: WorkComponent[];
  industry?: string;
  location?: string;
  urgency?: EnquiryUrgency;
  estimatedBudget?: Money;
  requiredDeliveryDate?: Timestamp;
  assignedToUserId?: string;
  status?: EnquiryStatus;
  conditions?: EnquiryCondition[];
  requestedScope?: UnifiedScopeMatrix;
  scopeReviewedAt?: Timestamp;
  scopeReviewedBy?: string;
}

/**
 * List Enquiries Options
 */
export interface ListEnquiriesOptions {
  tenantId: string;
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
