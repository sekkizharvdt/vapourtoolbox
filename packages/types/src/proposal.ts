/**
 * Proposal Types
 * Complete proposal/quotation management with versioning and approval workflow
 */

import { Timestamp } from 'firebase/firestore';
import { TimestampFields, Money, CurrencyCode } from './common';

/**
 * Proposal Status
 */
export type ProposalStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SUBMITTED'
  | 'UNDER_NEGOTIATION'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED';

/**
 * Proposal Line Item Category
 */
export type ProposalLineItemCategory =
  | 'EQUIPMENT'
  | 'MATERIAL'
  | 'SERVICE'
  | 'DESIGN'
  | 'INSTALLATION'
  | 'COMMISSIONING'
  | 'TRAINING'
  | 'OTHER';

/**
 * Price Line Item Category
 */
export type PriceLineItemCategory =
  | 'EQUIPMENT'
  | 'MATERIAL'
  | 'LABOR'
  | 'SERVICES'
  | 'OVERHEAD'
  | 'CONTINGENCY'
  | 'PROFIT'
  | 'OTHER';

/**
 * Source Type for Line Items
 */
export type SourceType = 'MANUFACTURED' | 'PROCURED' | 'SUBCONTRACTED';

/**
 * Approval Action
 */
export type ApprovalAction = 'APPROVED' | 'REJECTED' | 'REQUESTED_CHANGES';

/**
 * Proposal Status Labels
 */
export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  SUBMITTED: 'Submitted',
  UNDER_NEGOTIATION: 'Under Negotiation',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
};

/**
 * Proposal Line Item Category Labels
 */
export const PROPOSAL_LINE_ITEM_CATEGORY_LABELS: Record<ProposalLineItemCategory, string> = {
  EQUIPMENT: 'Equipment',
  MATERIAL: 'Material',
  SERVICE: 'Service',
  DESIGN: 'Design',
  INSTALLATION: 'Installation',
  COMMISSIONING: 'Commissioning',
  TRAINING: 'Training',
  OTHER: 'Other',
};

/**
 * Scope of Work
 */
export interface ScopeOfWork {
  summary: string;
  objectives: string[];
  deliverables: string[];
  inclusions: string[];
  exclusions: string[];
  assumptions: string[];
}

/**
 * Proposal Line Item (Scope of Supply)
 */
export interface ProposalLineItem {
  id: string;
  itemNumber: string; // e.g., "1.1", "1.2", "2.1"
  category: ProposalLineItemCategory;
  itemName: string;
  description: string;
  technicalSpecification?: string;
  quantity: number;
  unit: string; // nos, kg, m, m², lot, etc.
  unitPrice?: Money;
  totalPrice: Money;
  deliveryWeeks?: number;
  requiredByDate?: Timestamp;
  sourceType?: SourceType;
  estimatedProcurementCost?: Money; // Internal cost
  margin?: number; // Profit margin %
  vendorId?: string; // If sourced from specific vendor
  catalogReference?: string;
  notes?: string;
  bomItemId?: string; // Link to BOM item if imported
}

/**
 * Proposal Milestone
 */
export interface ProposalMilestone {
  id: string;
  milestoneNumber: number; // 1, 2, 3...
  description: string;
  deliverable: string;
  durationInWeeks: number; // From project start or previous milestone
  paymentPercentage?: number; // % of total payment tied to this milestone
}

/**
 * Price Line Item
 */
export interface PriceLineItem {
  id: string;
  lineNumber: string;
  description: string;
  amount: Money;
  category: PriceLineItemCategory;
  linkedScopeItemId?: string; // Link to ProposalLineItem if applicable
}

/**
 * Tax Line Item
 */
export interface TaxLineItem {
  id: string;
  taxType: string; // GST, IGST, CGST, SGST, etc.
  taxRate: number; // 18 for 18%
  taxAmount: Money;
  appliedTo?: 'SUBTOTAL' | 'LINE_ITEM'; // Where tax is applied
}

/**
 * Delivery Period
 */
export interface DeliveryPeriod {
  durationInWeeks: number;
  description: string; // e.g., "12 weeks from purchase order"
  milestones: ProposalMilestone[];
}

/**
 * Pricing
 */
export interface Pricing {
  currency: CurrencyCode;
  lineItems: PriceLineItem[];
  subtotal: Money;
  taxItems: TaxLineItem[];
  totalAmount: Money;
  paymentTerms: string;
  advancePaymentPercentage?: number;
}

/**
 * Terms & Conditions
 */
export interface TermsAndConditions {
  warranty?: string;
  guaranteeBank?: string;
  performanceBond?: string;
  liquidatedDamages?: string;
  forceMajeure?: string;
  disputeResolution?: string;
  customTerms?: string[];
}

/**
 * Approval Record
 */
export interface ApprovalRecord {
  approverUserId: string;
  approverUserName: string;
  action: ApprovalAction;
  comments?: string;
  timestamp: Timestamp;
}

/**
 * Proposal Entity
 */
export interface Proposal extends TimestampFields {
  id: string;
  proposalNumber: string; // PROP-2025-0001
  revision: number; // 1, 2, 3...
  enquiryId: string;
  enquiryNumber: string; // Denormalized

  // Organization
  entityId: string;

  // Client Information (copied from enquiry)
  clientId: string;
  clientName: string;
  clientContactPerson: string;
  clientEmail: string;
  clientAddress: string;

  // Proposal Details
  title: string;
  validityDate: Timestamp; // Offer valid until
  preparationDate: Timestamp;

  // Scope of Work
  scopeOfWork: ScopeOfWork;

  // Scope of Supply
  scopeOfSupply: ProposalLineItem[];

  // Delivery & Timeline
  deliveryPeriod: DeliveryPeriod;

  // Pricing
  pricing: Pricing;

  // Terms & Conditions
  terms: TermsAndConditions;

  // Status & Workflow
  status: ProposalStatus;
  submittedAt?: Timestamp;
  submittedByUserId?: string;
  submittedByUserName?: string;
  approvalHistory: ApprovalRecord[];

  // Outcome
  acceptedAt?: Timestamp;
  rejectedAt?: Timestamp;
  rejectionReason?: string;
  negotiationNotes?: string;

  // Project Link (if accepted)
  projectId?: string;
  projectNumber?: string;

  // Documents
  attachedDocuments: string[];
  generatedPdfUrl?: string;

  // Audit
  createdBy: string;
  updatedBy: string;

  // Revision tracking
  previousRevisionId?: string;
  revisionReason?: string;
  isLatestRevision: boolean;
}

/**
 * Create Proposal Input
 */
export interface CreateProposalInput {
  entityId: string;
  enquiryId: string;
  title: string;
  clientId: string;
  validityDate: Timestamp;
  scopeOfWork: ScopeOfWork;
  deliveryPeriod: DeliveryPeriod;
  paymentTerms: string;
}

/**
 * Update Proposal Input
 */
export interface UpdateProposalInput {
  title?: string;
  validityDate?: Timestamp;
  scopeOfWork?: Partial<ScopeOfWork>;
  scopeOfSupply?: ProposalLineItem[];
  deliveryPeriod?: Partial<DeliveryPeriod>;
  pricing?: Partial<Pricing>;
  terms?: Partial<TermsAndConditions>;
  status?: ProposalStatus;
  negotiationNotes?: string;
}

/**
 * List Proposals Options
 */
export interface ListProposalsOptions {
  entityId: string;
  enquiryId?: string;
  status?: ProposalStatus | ProposalStatus[];
  clientId?: string;
  createdBy?: string;
  dateFrom?: Timestamp;
  dateTo?: Timestamp;
  searchTerm?: string;
  isLatestRevision?: boolean;
  limit?: number;
  startAfter?: string;
}

/**
 * Import BOM to Proposal Input
 */
export interface ImportBOMToProposalInput {
  bomId: string;
  proposalId: string;
  categoryMapping?: Record<string, ProposalLineItemCategory>; // Map BOM categories to proposal categories
  includeServiceCosts?: boolean;
  applyMargin?: number; // Default margin % to apply
}
