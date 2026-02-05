/**
 * Proposal Types
 * Complete proposal/quotation management with versioning and approval workflow
 */

import { Timestamp } from 'firebase/firestore';
import { TimestampFields, Money, CurrencyCode } from './common';

// ============================================================================
// Scope Matrix Types
// ============================================================================

/**
 * Scope Item Type
 * Defines the three categories of scope items in a proposal
 */
export type ScopeItemType = 'SERVICE' | 'SUPPLY' | 'EXCLUSION';

/**
 * Scope Item Type Labels
 */
export const SCOPE_ITEM_TYPE_LABELS: Record<ScopeItemType, string> = {
  SERVICE: 'Service',
  SUPPLY: 'Supply',
  EXCLUSION: 'Exclusion',
};

/**
 * Project Phase
 * Defines the phases of an EPC/manufacturing project lifecycle
 */
export type ProjectPhase =
  | 'ENGINEERING'
  | 'PROCUREMENT'
  | 'MANUFACTURING'
  | 'LOGISTICS'
  | 'SITE'
  | 'COMMISSIONING'
  | 'DOCUMENTATION';

/**
 * Project Phase Labels
 */
export const PROJECT_PHASE_LABELS: Record<ProjectPhase, string> = {
  ENGINEERING: 'Engineering',
  PROCUREMENT: 'Procurement',
  MANUFACTURING: 'Manufacturing',
  LOGISTICS: 'Logistics',
  SITE: 'Site',
  COMMISSIONING: 'Commissioning',
  DOCUMENTATION: 'Documentation',
};

/**
 * Project Phase Order (for sorting)
 */
export const PROJECT_PHASE_ORDER: ProjectPhase[] = [
  'ENGINEERING',
  'PROCUREMENT',
  'MANUFACTURING',
  'LOGISTICS',
  'SITE',
  'COMMISSIONING',
  'DOCUMENTATION',
];

/**
 * Linked BOM Reference
 * Reference to a BOM (Bill of Materials) linked to a scope item for cost estimation
 */
export interface LinkedBOM {
  bomId: string;
  bomCode: string; // Denormalized for display (e.g., "EST-2025-0001")
  bomName: string; // Denormalized for display
  category?: string; // BOM category (e.g., "Heat Exchanger", "Engineering")
  totalCost: Money; // Snapshot of total cost at time of linking
  linkedAt: Timestamp;
  linkedBy: string;
}

/**
 * Scope Item
 * Individual item in the scope matrix (service, supply, or exclusion)
 * Note: No costing fields - estimation is done via linked BOMs
 */
export interface ScopeItem {
  id: string;
  itemNumber: string; // Hierarchical: "1.1", "1.2", "2.1"
  type: ScopeItemType; // SERVICE, SUPPLY, or EXCLUSION

  // Basic information
  name: string;
  description: string;

  // Phase grouping (optional for exclusions)
  phase?: ProjectPhase;

  // For SUPPLY items
  quantity?: number;
  unit?: string; // nos, kg, m, lot, etc.

  // For SERVICE items
  deliverable?: string; // What output is produced

  // Relationships
  dependsOn?: string[]; // IDs of items this depends on
  relatedItems?: string[]; // IDs of related service/supply items

  // Display order within phase
  order: number;

  // Optional notes
  notes?: string;

  // Estimation - Linked BOMs for cost calculation
  linkedBOMs?: LinkedBOM[];

  // Calculated estimation summary (derived from linked BOMs)
  estimationSummary?: {
    totalCost: Money;
    bomCount: number;
    lastUpdated?: Timestamp;
  };
}

/**
 * Scope Matrix
 * Complete scope definition for a proposal
 */
export interface ScopeMatrix {
  services: ScopeItem[];
  supply: ScopeItem[];
  exclusions: ScopeItem[];

  // Metadata
  lastUpdatedAt?: Timestamp;
  lastUpdatedBy?: string;
  isComplete?: boolean; // Flag to mark scope as "iron-clad"
}

// ============================================================================
// Proposal Status & Workflow Types
// ============================================================================

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
 * Proposal Workflow Stage
 * Tracks which step of the proposal creation process a proposal is in
 */
export type ProposalWorkflowStage =
  | 'ENQUIRY' // Initial stage - linked to enquiry
  | 'SCOPE_DEFINITION' // Defining scope of work and supply
  | 'ESTIMATION' // Cost estimation in progress
  | 'PRICING' // Final pricing with taxes/terms
  | 'REVIEW' // Internal review before submission
  | 'GENERATION' // Generating proposal document
  | 'SUBMITTED'; // Proposal submitted to client

/**
 * Proposal Workflow Stage Labels
 */
export const PROPOSAL_WORKFLOW_STAGE_LABELS: Record<ProposalWorkflowStage, string> = {
  ENQUIRY: 'Enquiry Received',
  SCOPE_DEFINITION: 'Scope Definition',
  ESTIMATION: 'Cost Estimation',
  PRICING: 'Final Pricing',
  REVIEW: 'Internal Review',
  GENERATION: 'Document Generation',
  SUBMITTED: 'Submitted to Client',
};

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
 * Proposal Pricing Configuration
 * Margin percentages and calculated values for proposal pricing
 */
export interface ProposalPricingConfig {
  // Cost basis from estimation (sum of all linked BOMs)
  estimationSubtotal: Money;

  // Markup percentages
  overheadPercent: number;
  contingencyPercent: number;
  profitMarginPercent: number;

  // Calculated markup amounts
  overheadAmount: Money;
  contingencyAmount: Money;
  profitAmount: Money;

  // Subtotal before tax (estimation + markups)
  subtotalBeforeTax: Money;

  // Tax configuration
  taxPercent: number; // e.g., 18 for GST
  taxAmount: Money;

  // Final client-facing price
  totalPrice: Money;

  // Terms
  validityDays: number;

  // Metadata
  isComplete: boolean;
  lastUpdatedAt?: Timestamp;
  lastUpdatedBy?: string;
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
 * Proposal Attachment
 * Represents a file attached to a proposal (drawings, specs, etc.)
 */
export interface ProposalAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  storagePath: string;
  fileSize: number;
  mimeType: string;
  fileType: ProposalAttachmentType;
  description?: string;
  uploadedAt: Timestamp;
  uploadedBy: string;
  uploadedByName: string;
}

/**
 * Proposal Attachment Type
 */
export type ProposalAttachmentType =
  | 'DRAWING'
  | 'SPECIFICATION'
  | 'DATASHEET'
  | 'SUPPORTING'
  | 'OTHER';

/**
 * Proposal Attachment Type Labels
 */
export const PROPOSAL_ATTACHMENT_TYPE_LABELS: Record<ProposalAttachmentType, string> = {
  DRAWING: 'Drawing',
  SPECIFICATION: 'Specification',
  DATASHEET: 'Data Sheet',
  SUPPORTING: 'Supporting Document',
  OTHER: 'Other',
};

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

  // Scope of Supply (legacy - being replaced by scopeMatrix)
  scopeOfSupply: ProposalLineItem[];

  // Scope Matrix (new structured scope definition)
  scopeMatrix?: ScopeMatrix;

  // Delivery & Timeline
  deliveryPeriod: DeliveryPeriod;

  // Pricing (legacy)
  pricing: Pricing;

  // Pricing Configuration (new - margin-based pricing from estimation)
  pricingConfig?: ProposalPricingConfig;

  // Terms & Conditions
  terms: TermsAndConditions;

  // Status & Workflow
  status: ProposalStatus;
  workflowStage?: ProposalWorkflowStage; // Optional for backward compatibility
  scopeCompletedAt?: Timestamp;
  estimationCompletedAt?: Timestamp;
  pricingCompletedAt?: Timestamp;
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

  // Documents & Attachments
  attachments: ProposalAttachment[];
  /** @deprecated Use attachments instead */
  attachedDocuments?: string[];
  generatedPdfUrl?: string;
  generatedPdfStoragePath?: string;

  // Audit
  createdBy: string;
  updatedBy: string;

  // Revision tracking
  previousRevisionId?: string;
  revisionReason?: string;
  isLatestRevision: boolean;

  // Clone tracking
  clonedFrom?: {
    proposalId: string;
    proposalNumber: string;
    clonedAt: Timestamp;
    clonedBy: string;
    clonedByName: string;
  };
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
  scopeMatrix?: ScopeMatrix;
  deliveryPeriod?: Partial<DeliveryPeriod>;
  pricing?: Partial<Pricing>;
  pricingConfig?: ProposalPricingConfig;
  terms?: Partial<TermsAndConditions>;
  status?: ProposalStatus;
  negotiationNotes?: string;
  // Workflow timestamps
  scopeCompletedAt?: Timestamp;
  estimationCompletedAt?: Timestamp;
  pricingCompletedAt?: Timestamp;
  submittedAt?: Timestamp;
  submittedByUserId?: string;
  submittedByUserName?: string;
}

/**
 * List Proposals Options
 */
export interface ListProposalsOptions {
  entityId?: string;
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

// ============================================================================
// Proposal Template Types
// ============================================================================

/**
 * Proposal Template
 * Reusable templates for quickly creating new proposals
 */
export interface ProposalTemplate {
  id: string;
  name: string;
  description?: string;
  category?: string; // e.g., "Heat Exchanger", "Condenser", "General"

  // Organization
  entityId: string;

  // Template content
  scopeMatrix?: {
    services: Omit<ScopeItem, 'id' | 'itemNumber' | 'linkedBOMs' | 'estimationSummary'>[];
    supply: Omit<ScopeItem, 'id' | 'itemNumber' | 'linkedBOMs' | 'estimationSummary'>[];
    exclusions: Omit<ScopeItem, 'id' | 'itemNumber' | 'linkedBOMs' | 'estimationSummary'>[];
  };
  pricingDefaults?: {
    overheadPercent: number;
    contingencyPercent: number;
    profitMarginPercent: number;
    taxPercent: number;
    validityDays: number;
  };
  terms?: TermsAndConditions;
  deliveryPeriod?: {
    durationInWeeks: number;
    description: string;
  };

  // Metadata
  isActive: boolean;
  usageCount: number;
  createdAt: Timestamp;
  createdBy: string;
  createdByName: string;
  updatedAt: Timestamp;
  updatedBy?: string;

  // Source tracking
  sourceProposalId?: string;
  sourceProposalNumber?: string;
}

/**
 * Create Proposal Template Input
 */
export interface CreateProposalTemplateInput {
  name: string;
  description?: string;
  category?: string;
  sourceProposalId?: string;
  includeScope?: boolean;
  includePricing?: boolean;
  includeTerms?: boolean;
  includeDelivery?: boolean;
}

/**
 * List Proposal Templates Options
 */
export interface ListProposalTemplatesOptions {
  entityId?: string;
  category?: string;
  isActive?: boolean;
  searchTerm?: string;
  limit?: number;
}
