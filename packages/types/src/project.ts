// Project Management Types

import { Timestamp } from 'firebase/firestore';
import { ProjectStatus, ProjectPriority } from './core';
import { TimestampFields, SoftDeleteFields, Money, CurrencyCode } from './common';

/**
 * Project team member
 */
export interface ProjectMember {
  userId: string;
  userName: string;
  role: string; // Project-specific role
  assignedAt: Timestamp;
  isActive: boolean;
}

/**
 * Project client information
 */
export interface ProjectClient {
  entityId: string; // Reference to BusinessEntity
  entityName: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
}

/**
 * Project dates
 */
export interface ProjectDates {
  startDate: Timestamp;
  endDate?: Timestamp;
  actualStartDate?: Timestamp;
  actualEndDate?: Timestamp;
}

/**
 * Project budget
 */
export interface ProjectBudget {
  // Forex conversion (if order value is in foreign currency)
  originalCurrency?: CurrencyCode; // Original contract currency (USD, EUR, etc.)
  originalAmount?: number; // Amount in original currency
  exchangeRate?: number; // User-entered or from currency module
  exchangeRateDate?: Timestamp; // When rate was locked

  // All budget tracking in INR
  estimated: Money; // Total budget in INR
  actual?: Money; // Actual spent in INR
  currency: string; // Always 'INR'
}

/**
 * Main Project interface
 */
export interface Project extends TimestampFields, SoftDeleteFields {
  id: string;
  code: string; // PRJ-001, PRJ-002

  // Tenant scoping — firestore.rules requires tenantId on project create
  // (request.resource.data.tenantId == request.auth.token.tenantId).
  // Optional in the type because legacy documents may predate the field.
  tenantId?: string;

  // Basic info
  name: string;
  description?: string;
  status: ProjectStatus;
  priority: ProjectPriority;

  // Project Type & Classification
  projectType?: ProjectType;

  // Client
  client: ProjectClient;

  // Team
  projectManager: {
    userId: string;
    userName: string;
  };
  team: ProjectMember[];

  // Timeline
  dates: ProjectDates;

  // Budget
  budget?: ProjectBudget;

  // Accounting Integration
  costCentreId?: string; // Reference to CostCentre (auto-created when charter approved)

  // Project Charter (comprehensive authorization & planning)
  charter?: ProjectCharter;

  // Outsourcing & Vendors
  vendors?: OutsourcingVendor[];

  // Document Requirements Tracking
  documentRequirements?: DocumentRequirement[];

  // Procurement Planning
  procurementItems?: ProcurementItem[];

  // Technical Specifications
  technicalSpecs?: ProjectTechnicalSpecs;

  // Progress Report Configuration
  progressReportConfig?: ProgressReportConfig;

  // Source Tracking (links to proposal/enquiry)
  proposalId?: string; // Link back to source proposal
  proposalNumber?: string; // Denormalized for display
  enquiryId?: string; // Link back to source enquiry (via proposal)
  enquiryNumber?: string; // Denormalized for display

  // Metadata
  tags?: string[];
  category?: string;
  location?: string;

  // RBAC (Project-level permissions)
  ownerId: string;
  visibility: 'private' | 'team' | 'company' | 'public';

  // Activity tracking
  lastActivityAt?: Timestamp;
  lastActivityBy?: string;

  // Progress — derived from charter deliverables (accepted / total).
  // Written by the deliverable service on every deliverable change.
  progress?: {
    percentage: number;
    completedMilestones: number;
    totalMilestones: number;
  };

  // Budget threshold alert stamps (one-shot; written by the
  // projectFinancials Cloud Function when utilization first crosses the
  // threshold — never cleared if utilization later drops back below).
  budgetAlert90SentAt?: Timestamp;
  budgetAlert100SentAt?: Timestamp;
}

/**
 * Project activity log entry
 */
export interface ProjectActivity {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  action: string;
  description: string;
  timestamp: Timestamp;
  metadata?: Record<string, unknown>;
}

/**
 * Project milestone
 */
export interface ProjectMilestone extends TimestampFields {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  dueDate: Timestamp;
  completedAt?: Timestamp;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo?: string[];
}

/**
 * Project Type Categories
 */
export type ProjectType = 'THERMAL_DESALINATION' | 'MANUFACTURING' | 'CONSTRUCTION' | 'OTHER';

/**
 * Charter approval workflow status.
 *
 * DRAFT → PENDING_APPROVAL → APPROVED; rejection returns the charter to
 * DRAFT with a rejectionReason (house pattern — mirrors proposals).
 * There is no terminal REJECTED state (verified zero such records in prod
 * before removal, 2026-07-14).
 */
export type CharterApprovalStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED';

/**
 * Project Authorization & Approval
 */
export interface ProjectAuthorization {
  sponsorName: string;
  sponsorUserId?: string;
  sponsorTitle: string;
  authorizedDate?: Timestamp;
  approvalStatus: CharterApprovalStatus;
  /** User who submitted the charter for approval (separation of duty — cannot approve it themselves) */
  submittedBy?: string;
  submittedByName?: string;
  submittedAt?: Timestamp;
  approvedBy?: string;
  approvedAt?: Timestamp;
  /** Reason given by the approver when returning the charter to DRAFT */
  rejectionReason?: string;
  budgetAuthority: string; // Person/department authorizing budget
}

/**
 * Project Objective with Success Criteria
 */
export interface ProjectObjective {
  id: string;
  description: string;
  successCriteria: string[];
  targetDate?: Timestamp;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'ACHIEVED' | 'AT_RISK';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  kpis?: {
    name: string;
    target: string;
    current?: string;
  }[];
}

/**
 * Project Deliverable with Acceptance Criteria
 */
export interface ProjectDeliverable {
  id: string;
  name: string;
  description: string;
  type: 'DOCUMENT' | 'PRODUCT' | 'SERVICE' | 'MILESTONE';
  acceptanceCriteria: string[];
  dueDate?: Timestamp;
  deliveredDate?: Timestamp;
  status: 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED';
  assignedTo?: string[];
  linkedDocumentId?: string; // Reference to DocumentRecord
}

/**
 * Charter Budget Line Item
 * Detailed budget breakdown linked to scope items
 */
export interface CharterBudgetLineItem {
  id: string;
  lineNumber: number; // For ordering

  // Description & Category
  description: string;

  // Execution Type
  executionType: 'IN_HOUSE' | 'OUTSOURCED';

  // Vendor Linkage (for OUTSOURCED items)
  linkedVendorId?: string; // References OutsourcingVendor.id
  linkedVendorName?: string; // Denormalized for display

  // Scope Linkage (optional)
  scopeLinkage?: {
    type: 'OBJECTIVE' | 'DELIVERABLE' | 'IN_SCOPE_ITEM';
    id: string; // ID of the linked scope item
    description?: string; // Denormalized description
  };

  // Budget (all in INR)
  estimatedCost: number; // Estimated cost in INR
  currency: 'INR'; // Always INR
  actualCost?: number; // Calculated from accounting transactions
  variance?: number; // estimatedCost - actualCost

  // Status
  status: 'PLANNED' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED';

  // Closure tracking
  closedAt?: Timestamp;
  closedBy?: string;
  closureNotes?: string;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy?: string;
}

/**
 * Budget Summary for Charter
 */
export interface CharterBudgetSummary {
  totalEstimated: number; // Sum of all line items estimated cost
  totalActual: number; // Sum of all line items actual cost
  totalVariance: number; // totalEstimated - totalActual
  utilizationPercentage: number; // (totalActual / totalEstimated) * 100
  currency: 'INR'; // Always INR
}

/**
 * Outsourcing Vendor Assignment
 */
export interface OutsourcingVendor {
  id: string;
  vendorEntityId: string; // Reference to BusinessEntity
  vendorName: string;
  scopeOfWork: string;
  contractValue?: Money;
  contractStartDate?: Timestamp;
  contractEndDate?: Timestamp;
  contractStatus: 'DRAFT' | 'NEGOTIATION' | 'ACTIVE' | 'COMPLETED' | 'TERMINATED';
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  deliverables: string[];
  performanceRating?: number; // 1-5 stars
  notes?: string;
}

/**
 * Document Requirement Tracking
 */
export interface DocumentRequirement {
  id: string;
  documentType: string; // e.g., "Technical Specification", "As-Built Drawings"
  documentCategory:
    | 'PROJECT_PLAN'
    | 'TECHNICAL_DRAWING'
    | 'SPECIFICATION'
    | 'CONTRACT'
    | 'PROGRESS_REPORT'
    | 'MEETING_MINUTES'
    | 'COMPLIANCE'
    | 'OTHER';
  description: string;
  isRequired: boolean;
  dueDate?: Timestamp;
  status: 'NOT_SUBMITTED' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
  submittedDate?: Timestamp;
  linkedDocumentId?: string; // Reference to DocumentRecord when submitted
  assignedTo?: string[];
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  notes?: string;
}

/**
 * Procurement Item for Charter Planning
 */
export interface ProcurementItem {
  id: string;
  itemName: string;
  description: string;
  category: 'RAW_MATERIAL' | 'COMPONENT' | 'EQUIPMENT' | 'SERVICE' | 'OTHER';
  quantity: number;
  unit: string;
  estimatedUnitPrice?: Money;
  estimatedTotalPrice?: Money;
  requiredByDate?: Timestamp;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PLANNING' | 'PR_DRAFTED' | 'RFQ_ISSUED' | 'PO_PLACED' | 'DELIVERED' | 'CANCELLED';

  // Linkages
  linkedPurchaseRequestId?: string; // Auto-created PR on charter approval
  linkedRFQId?: string;
  linkedPOId?: string;
  preferredVendors?: string[]; // BusinessEntity IDs

  // Equipment linkage (for PR integration)
  equipmentId?: string;
  equipmentCode?: string;
  equipmentName?: string;

  // Additional details
  technicalSpecs?: string;
  notes?: string;
}

/**
 * Thermal Desalination Specific Fields
 */
export interface ThermalDesalSpecs {
  technology: 'MSF' | 'MED' | 'RO' | 'HYBRID' | 'OTHER';
  capacity: {
    value: number;
    unit: 'M3_PER_DAY' | 'GALLONS_PER_DAY';
  };
  feedWaterSource: string;
  operatingTemperature?: {
    min: number;
    max: number;
    unit: 'CELSIUS' | 'FAHRENHEIT';
  };
  energySource: string;
  complianceStandards: string[]; // e.g., "ISO 9001", "ASME Boiler Code"
}

/**
 * Project Type-Specific Technical Specifications
 */
export interface ProjectTechnicalSpecs {
  projectType: ProjectType;
  thermalDesalSpecs?: ThermalDesalSpecs;
  // Can add manufacturing, construction specs later
  toolsRequired?: string[];
  equipmentRequired?: string[];
  facilitiesRequired?: string[];
  technicalRequirements?: string;
  qualityStandards?: string[];
  safetyRequirements?: string;
  environmentalConsiderations?: string;
}

/**
 * Progress Report Section Selector
 */
export type ProgressReportSection =
  | 'EXECUTIVE_SUMMARY'
  | 'MILESTONES_TIMELINE'
  | 'BUDGET_COST'
  | 'PROCUREMENT_STATUS'
  | 'DOCUMENT_SUBMISSIONS'
  | 'RISKS_ISSUES'
  | 'NEXT_PERIOD_OUTLOOK';

/**
 * Progress Report Configuration
 */
export interface ProgressReportConfig {
  frequency?: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'NONE';
  scheduledDay?: number; // Day of week (1-7) or day of month (1-31)
  includedSections: ProgressReportSection[];
  recipients?: string[]; // User IDs to notify
  autoSaveToDocuments: boolean;
}

/**
 * Generated Progress Report
 */
export interface ProgressReport extends TimestampFields {
  id: string;
  projectId: string;
  reportPeriodStart: Timestamp;
  reportPeriodEnd: Timestamp;
  generatedBy: string;
  generatedAt: Timestamp;
  reportType: 'INTERNAL' | 'EXTERNAL';
  includedSections: ProgressReportSection[];

  // Report Data
  executiveSummary: string;
  milestonesData?: {
    completed: number;
    inProgress: number;
    pending: number;
    overdue: number;
    details: ProjectMilestone[];
  };
  budgetData?: {
    budgetAmount: number;
    actualSpent: number;
    variance: number;
    utilizationPercentage: number;
    currency: string;
  };
  procurementData?: {
    totalItems: number;
    delivered: number;
    inProgress: number;
    pending: number;
    details: ProcurementItem[];
  };
  documentData?: {
    required: number;
    submitted: number;
    approved: number;
    pending: number;
    details: DocumentRequirement[];
  };
  risksIssues?: string[];
  nextPeriodOutlook?: string;

  // Document Management Integration
  savedDocumentId?: string; // Reference to saved DocumentRecord
  status: 'DRAFT' | 'FINALIZED';
}

/**
 * Project Constraint
 * Limitations and restrictions affecting the project
 */
export interface ProjectConstraint {
  id: string;
  description: string;
  category:
    | 'BUDGET'
    | 'SCHEDULE'
    | 'RESOURCE'
    | 'TECHNICAL'
    | 'REGULATORY'
    | 'ENVIRONMENTAL'
    | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impact?: string; // Optional: describe how this constrains the project
}

/**
 * Order Acceptance workflow status.
 *
 * DRAFT -> PENDING_APPROVAL -> APPROVED, with rejection to REJECTED and a
 * `reopenOrderAcceptance` action returning REJECTED -> DRAFT for revision.
 * Unlike `CharterApprovalStatus`, REJECTED is a distinct (non-terminal)
 * state here — mirrors `AmendmentStatus`, not the charter authorization
 * shape, because a rejected order-acceptance record legitimately needs a
 * "why" that outlives the DRAFT bounce (@vapour/types procurement/amendments.ts).
 */
export type OrderAcceptanceStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

/**
 * A single payment milestone recorded against the signed order/agreement —
 * distinct from `CharterBudgetLineItem` (internal cost breakdown); this is
 * the customer-facing billing schedule.
 */
export interface OrderAcceptanceMilestone {
  description: string;
  paymentPercentage: number;
  triggerType: 'SUBMISSION' | 'ACCEPTANCE' | 'DATE' | 'OTHER';
  /** e.g. "30-day deemed-acceptance window" */
  triggerDescription?: string;
}

/**
 * A deliverable entry captured from the signed order/agreement's
 * deliverables register. On approval these are folded into
 * `ProjectCharter.deliverables` via `saveDeliverablesBatch` /
 * `mergeDeliverablesBatch` (apps/web/src/lib/projects/deliverableService.ts).
 */
export interface OrderAcceptanceDeliverable {
  name: string;
  description?: string;
  type: ProjectDeliverable['type'];
}

/**
 * Structured terms captured from the signed customer order/agreement,
 * grouped by category (schedule / payment / scope) — conceptually mirrors
 * `PurchaseOrderChange`'s per-category granularity
 * (packages/types/src/procurement/amendments.ts) without a full amendment
 * ledger, since this is a single embedded record, not a change history.
 */
export interface OrderAcceptanceTerms {
  scheduleDurationDays?: number;
  scheduleStartDate?: Timestamp;
  scheduleNotes?: string;
  paymentTermsDays?: number;
  retentionPercentage?: number;
  paymentMilestones?: OrderAcceptanceMilestone[];
  deliverables?: OrderAcceptanceDeliverable[];
  keyPersonnel?: { name: string; role: string }[];
  otherTermsNotes?: string;
}

/**
 * Order Acceptance record — the delta between what was proposed and what
 * the customer actually signed. Embedded on `ProjectCharter.orderAcceptance`
 * with its own DRAFT -> PENDING_APPROVAL -> APPROVED/REJECTED lifecycle
 * (mirrors `charter.authorization`'s embedded-object pattern, not a
 * top-level collection). Approval is the "apply" step: it writes `terms`
 * onto the charter's authoritative fields (`deliveryPeriod`, `paymentTerms`,
 * `keyPersonnel`, `deliverables`) — see
 * apps/web/src/lib/projects/orderAcceptanceService.ts `approveOrderAcceptance`.
 */
export interface OrderAcceptanceRecord {
  /** e.g. "PO26XP062901" */
  documentReference?: string;
  /** Signature date of the order/agreement */
  documentDate?: Timestamp;
  contractValue?: Money;
  terms: OrderAcceptanceTerms;
  status: OrderAcceptanceStatus;
  submittedBy?: string;
  submittedByName?: string;
  submittedAt?: Timestamp;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: Timestamp;
  rejectionReason?: string;
  /** Whether `terms` have been written onto the charter's authoritative fields */
  applied: boolean;
  appliedAt?: Timestamp;
  createdBy: string;
  createdAt: Timestamp;
  updatedBy?: string;
  updatedAt?: Timestamp;
}

/**
 * Project Charter (comprehensive project authorization document)
 */
export interface ProjectCharter {
  authorization: ProjectAuthorization;
  objectives: ProjectObjective[];
  deliverables: ProjectDeliverable[];

  // Delivery Period
  deliveryPeriod?: {
    startDate?: Timestamp;
    endDate?: Timestamp;
    duration?: number; // In days
    description?: string; // e.g., "12 months from order date"
  };

  scope: {
    inScope: string[];
    outOfScope: string[];
    assumptions: string[];
    constraints: ProjectConstraint[];
  };

  // Budget Line Items
  budgetLineItems?: CharterBudgetLineItem[];
  budgetSummary?: CharterBudgetSummary;

  risks: {
    id: string;
    description: string;
    probability: 'LOW' | 'MEDIUM' | 'HIGH';
    impact: 'LOW' | 'MEDIUM' | 'HIGH';
    mitigation?: string;
    status: 'OPEN' | 'MITIGATED' | 'CLOSED';
  }[];
  stakeholders: {
    name: string;
    role: string;
    interest: 'LOW' | 'MEDIUM' | 'HIGH';
    influence: 'LOW' | 'MEDIUM' | 'HIGH';
    communicationPlan?: string;
  }[];
  qualityStandards?: string[];
  complianceRequirements?: string[];

  // Order Acceptance — the signed customer order/agreement, when it differs
  // from the proposal the charter was seeded from. See OrderAcceptanceRecord.
  orderAcceptance?: OrderAcceptanceRecord;

  // Authoritative once orderAcceptance.applied === true (written by
  // approveOrderAcceptance). Until then, payment terms live only in the
  // proposal / budget line items the charter was created from.
  paymentTerms?: {
    termsDays?: number;
    retentionPercentage?: number;
    milestones?: OrderAcceptanceMilestone[];
  };

  // Authoritative once orderAcceptance.applied === true.
  keyPersonnel?: { name: string; role: string }[];
}
