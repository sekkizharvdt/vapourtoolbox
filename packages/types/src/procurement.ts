/**
 * Procurement Module Type Definitions
 *
 * Defines all types for the procurement workflow:
 * Purchase Request → RFQ → Offer → Purchase Order → Delivery → Completion
 */

import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// PURCHASE REQUEST TYPES
// ============================================================================

export type PurchaseRequestType = 'PROJECT' | 'BUDGETARY' | 'INTERNAL';
export type PurchaseRequestCategory = 'SERVICE' | 'RAW_MATERIAL' | 'BOUGHT_OUT';
export type PurchaseRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CONVERTED_TO_RFQ';

export interface PurchaseRequest {
  id: string;
  number: string; // PR/YYYY/MM/XXXX

  // Classification
  type: PurchaseRequestType;
  category: PurchaseRequestCategory;

  // Project linkage
  projectId: string;
  projectName: string; // Denormalized

  // Header information
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  requiredBy?: Timestamp; // Target delivery date

  // Line items
  itemCount: number; // Denormalized count

  // Bulk upload tracking
  isBulkUpload: boolean;
  bulkUploadFileUrl?: string;

  // Workflow
  status: PurchaseRequestStatus;

  // Approval
  submittedBy: string;
  submittedByName: string; // Denormalized
  submittedAt?: Timestamp;

  reviewedBy?: string;
  reviewedByName?: string; // Denormalized
  reviewedAt?: Timestamp;
  reviewComments?: string;

  approvedBy?: string;
  approvedByName?: string; // Denormalized
  approvedAt?: Timestamp;
  approvalComments?: string;

  rejectionReason?: string;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}

export interface PurchaseRequestItem {
  id: string;
  purchaseRequestId: string;

  // Item details
  lineNumber: number;
  description: string;
  specification?: string;

  // Quantity
  quantity: number;
  unit: string; // e.g., 'pcs', 'kg', 'meter'

  // Material database linkage (optional)
  materialId?: string;
  materialCode?: string;
  materialName?: string;

  // Equipment linkage (optional)
  equipmentId?: string;
  equipmentCode?: string;
  equipmentName?: string;

  // Estimated cost
  estimatedUnitCost?: number;
  estimatedTotalCost?: number;

  // Technical requirements
  technicalSpec?: string;
  drawingNumbers?: string[];
  makeModel?: string;

  // Delivery
  requiredBy?: Timestamp;
  deliveryLocation?: string;

  // Documents attached to this item
  attachmentCount: number;

  // Status
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONVERTED';
  comments?: string;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// RFQ (REQUEST FOR QUOTATION) TYPES
// ============================================================================

export type RFQStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'OFFERS_RECEIVED'
  | 'UNDER_EVALUATION'
  | 'COMPLETED'
  | 'CANCELLED';

export interface RFQ {
  id: string;
  number: string; // RFQ/YYYY/MM/XXXX

  // Source PRs
  purchaseRequestIds: string[];

  // Project linkage (can span multiple projects)
  projectIds: string[];
  projectNames: string[]; // Denormalized

  // Header
  title: string;
  description: string;

  // Vendors invited
  vendorIds: string[];
  vendorNames: string[]; // Denormalized

  // Terms and conditions
  paymentTerms?: string;
  deliveryTerms?: string;
  warrantyTerms?: string;
  otherTerms?: string[];

  // Item-specific conditions
  itemConditions?: Record<string, string>; // itemId -> condition text

  // Timeline
  issueDate?: Timestamp;
  dueDate: Timestamp;
  validityPeriod?: number; // Days

  // Status
  status: RFQStatus;

  // Document management
  pdfVersion: number; // 1, 2, 3... (for revisions)
  latestPdfUrl?: string;
  sentToVendorsAt?: Timestamp; // Manual tracking
  sentBy?: string;

  // Offers tracking
  offersReceived: number;
  offersEvaluated: number;

  // Workflow
  createdBy: string;
  createdByName: string; // Denormalized
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy: string;

  // Completion
  completedAt?: Timestamp;
  selectedOfferId?: string;
  completionNotes?: string;
}

export interface RFQItem {
  id: string;
  rfqId: string;

  // Source PR item
  purchaseRequestId: string;
  purchaseRequestItemId: string;

  // Item details (copied from PR item)
  lineNumber: number;
  description: string;
  specification?: string;

  quantity: number;
  unit: string;

  // Equipment linkage
  projectId: string;
  equipmentId?: string;
  equipmentCode?: string;

  // Technical requirements
  technicalSpec?: string;
  drawingNumbers?: string[];
  makeModel?: string;

  // Delivery requirements
  requiredBy?: Timestamp;
  deliveryLocation?: string;

  // Item-specific conditions
  conditions?: string;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// OFFER (VENDOR QUOTATION) TYPES
// ============================================================================

export type OfferStatus =
  | 'UPLOADED'
  | 'UNDER_REVIEW'
  | 'EVALUATED'
  | 'SELECTED'
  | 'REJECTED'
  | 'WITHDRAWN';

export interface Offer {
  id: string;
  number: string; // OFFER/YYYY/MM/XXXX

  // RFQ reference
  rfqId: string;
  rfqNumber: string; // Denormalized

  // Vendor
  vendorId: string;
  vendorName: string; // Denormalized

  // Vendor offer details
  vendorOfferNumber?: string;
  vendorOfferDate?: Timestamp;

  // Documents
  offerFileUrl: string; // Main offer PDF/image
  additionalDocuments?: string[]; // Supporting docs

  // Manual entry of offer details (AI parsing future)
  itemsParsed: boolean; // false until manually entered

  // Financial summary
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: string; // Default 'INR'

  // Terms
  paymentTerms?: string;
  deliveryTerms?: string;
  validityDate?: Timestamp;
  warrantyTerms?: string;

  // Evaluation
  status: OfferStatus;
  evaluationScore?: number; // 0-100
  evaluationNotes?: string;

  // Comparison
  isRecommended: boolean;
  recommendationReason?: string;

  // Red flags
  redFlags?: string[];

  // Workflow
  uploadedBy: string;
  uploadedByName: string; // Denormalized
  uploadedAt: Timestamp;

  evaluatedBy?: string;
  evaluatedByName?: string;
  evaluatedAt?: Timestamp;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface OfferItem {
  id: string;
  offerId: string;

  // RFQ item reference
  rfqItemId: string;

  // Item details
  lineNumber: number;
  description: string;

  // Quoted quantity and pricing
  quotedQuantity: number;
  unit: string;
  unitPrice: number;
  amount: number;

  // Tax breakdown
  gstRate?: number;
  gstAmount?: number;

  // Delivery
  deliveryPeriod?: string; // e.g., "30 days"
  deliveryDate?: Timestamp;

  // Make/model offered
  makeModel?: string;

  // Compliance
  meetsSpec: boolean;
  deviations?: string;

  // Notes
  vendorNotes?: string;
  evaluationNotes?: string;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Comparison helper type
export interface OfferComparison {
  rfqId: string;
  offers: Offer[];
  itemComparisons: {
    rfqItemId: string;
    description: string;
    offers: {
      offerId: string;
      vendorName: string;
      unitPrice: number;
      totalPrice: number;
      deliveryPeriod?: string;
      meetsSpec: boolean;
      deviations?: string;
    }[];
    lowestPrice: number;
    recommendation?: string;
  }[];
  overallRecommendation?: string;
  selectedOfferId?: string;
  comparisonDate: Timestamp;
  comparedBy: string;
}

// Offer comparison statistics for summary view
export interface OfferComparisonStat {
  offerId: string;
  vendorName: string;
  totalAmount: number;
  meetsAllSpecs: boolean;
  hasDeviations: boolean;
  isRecommended: boolean;
  evaluationScore?: number;
  redFlags?: string[];
}

// Item-level offer details for comparison
export interface ItemOfferComparison {
  offerId: string;
  vendorName: string;
  unitPrice: number;
  totalPrice: number;
  deliveryPeriod?: string;
  meetsSpec: boolean;
  deviations?: string;
  makeModel?: string;
}

// Item comparison with all vendor offers
export interface ItemComparison {
  rfqItemId: string;
  description: string;
  quantity: number;
  unit: string;
  offers: ItemOfferComparison[];
  lowestPrice: number;
}

// Complete offer comparison data structure
export interface OfferComparisonData {
  rfq: RFQ | null;
  offers: Offer[];
  itemComparisons: ItemComparison[];
  offerStats: OfferComparisonStat[];
  lowestTotal: number;
}

// ============================================================================
// PURCHASE ORDER TYPES
// ============================================================================

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'ISSUED'
  | 'ACKNOWLEDGED'
  | 'IN_PROGRESS'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface PurchaseOrder {
  id: string;
  number: string; // PO/YYYY/MM/XXXX

  // Source
  rfqId: string;
  offerId: string;
  selectedOfferNumber: string; // Denormalized

  // Vendor
  vendorId: string;
  vendorName: string; // Denormalized

  // Projects (can span multiple)
  projectIds: string[];
  projectNames: string[]; // Denormalized

  // Header
  title: string;
  description?: string;

  // Financial
  subtotal: number;

  // Tax breakdown
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;

  grandTotal: number;
  currency: string;

  // Terms and Conditions
  paymentTerms: string;
  deliveryTerms: string;
  warrantyTerms?: string;
  penaltyClause?: string;
  otherClauses: string[];

  // Delivery
  deliveryAddress: string;
  expectedDeliveryDate?: Timestamp;

  // Documents
  pdfVersion: number;
  latestPdfUrl?: string;

  // Order Acknowledgement
  oaFormUrl?: string;
  vendorSignedOaUrl?: string;
  oaReceivedAt?: Timestamp;
  oaComments?: string;

  // Status
  status: PurchaseOrderStatus;

  // Approval workflow
  submittedForApprovalAt?: Timestamp;
  submittedBy?: string;

  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: Timestamp;
  approvalSignature?: string; // Base64 or URL
  approvalComments?: string;

  rejectedBy?: string;
  rejectedByName?: string;
  rejectedAt?: Timestamp;
  rejectionReason?: string;

  // Issuance
  issuedAt?: Timestamp;
  issuedBy?: string;

  // Advance payment
  advancePaymentRequired: boolean;
  advancePercentage?: number;
  advanceAmount?: number;
  advancePaymentStatus?: 'PENDING' | 'REQUESTED' | 'PAID';
  advancePaymentId?: string; // Link to accounting payment

  // Progress tracking
  deliveryProgress: number; // 0-100%
  paymentProgress: number; // 0-100%

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;

  // Source
  offerItemId: string;
  rfqItemId: string;

  // Item details
  lineNumber: number;
  description: string;
  specification?: string;

  // Equipment linkage
  projectId: string;
  equipmentId?: string;
  equipmentCode?: string;

  // Quantity and pricing
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;

  // Tax
  gstRate: number;
  gstAmount: number;

  // Make/model
  makeModel?: string;

  // Delivery
  deliveryDate?: Timestamp;
  deliveryLocation?: string;

  // Status tracking
  quantityDelivered: number;
  quantityAccepted: number;
  quantityRejected: number;

  deliveryStatus: 'PENDING' | 'PARTIAL' | 'COMPLETE';

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// PACKING LIST TYPES
// ============================================================================

export type PackingListStatus = 'DRAFT' | 'FINALIZED' | 'SHIPPED' | 'DELIVERED';

export interface PackingList {
  id: string;
  number: string; // PL/YYYY/MM/XXXX

  // Purchase Order reference
  purchaseOrderId: string;
  poNumber: string; // Denormalized

  // Vendor
  vendorId: string;
  vendorName: string; // Denormalized

  // Project
  projectId: string;
  projectName: string; // Denormalized

  // Packing details
  numberOfPackages: number;
  totalWeight?: number; // kg
  totalVolume?: number; // cubic meters

  // Shipping
  shippingMethod?: 'AIR' | 'SEA' | 'ROAD' | 'COURIER';
  shippingCompany?: string;
  trackingNumber?: string;

  shippedDate?: Timestamp;
  estimatedDeliveryDate?: Timestamp;
  actualDeliveryDate?: Timestamp;

  // Delivery address
  deliveryAddress: string;
  contactPerson?: string;
  contactPhone?: string;

  // Special instructions
  packingInstructions?: string;
  handlingInstructions?: string;
  specialRequirements?: string;

  // Status
  status: PackingListStatus;

  // Documents
  pdfUrl?: string;

  // Workflow
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PackingListItem {
  id: string;
  packingListId: string;

  // PO item reference
  poItemId: string;

  // Item details
  lineNumber: number;
  description: string;

  // Quantity
  quantity: number;
  unit: string;

  // Equipment linkage
  equipmentId?: string;
  equipmentCode?: string;

  // Package assignment
  packageNumber: string; // e.g., "PKG-001"
  weight?: number;
  dimensions?: string; // e.g., "100x50x30 cm"

  // QR code (optional for tracking)
  qrCode?: string;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// GOODS RECEIPT TYPES
// ============================================================================

export type GoodsReceiptStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ISSUES_FOUND';
export type ItemCondition = 'GOOD' | 'DAMAGED' | 'DEFECTIVE' | 'INCOMPLETE';

export interface GoodsReceipt {
  id: string;
  number: string; // GR/YYYY/MM/XXXX

  // Purchase Order reference
  purchaseOrderId: string;
  poNumber: string; // Denormalized

  // Packing List reference (optional)
  packingListId?: string;
  packingListNumber?: string;

  // Project
  projectId: string;
  projectName: string; // Denormalized

  // Inspection details
  inspectionType: 'VENDOR_SITE' | 'DELIVERY_SITE' | 'THIRD_PARTY';
  inspectionLocation: string;
  inspectionDate: Timestamp;

  // Overall assessment
  overallCondition: 'ACCEPTED' | 'CONDITIONALLY_ACCEPTED' | 'REJECTED';
  overallNotes?: string;

  // Issues
  hasIssues: boolean;
  issuesSummary?: string;

  // Status
  status: GoodsReceiptStatus;

  // Approval for payment
  approvedForPayment: boolean;
  paymentApprovedBy?: string;
  paymentApprovedAt?: Timestamp;
  paymentRequestId?: string; // Link to accounting

  // Workflow
  inspectedBy: string;
  inspectedByName: string; // Denormalized

  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: Timestamp;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GoodsReceiptItem {
  id: string;
  goodsReceiptId: string;

  // PO item reference
  poItemId: string;

  // Item details
  lineNumber: number;
  description: string;

  // Equipment linkage
  equipmentId?: string;
  equipmentCode?: string;

  // Quantity verification
  orderedQuantity: number;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  unit: string;

  // Condition assessment
  condition: ItemCondition;
  conditionNotes?: string;

  // Testing/Inspection
  testingRequired: boolean;
  testingCompleted: boolean;
  testResult?: 'PASS' | 'FAIL' | 'CONDITIONAL';
  testCertificateUrl?: string;

  // Photo evidence count
  photoCount: number;

  // Issues
  hasIssues: boolean;
  issues?: string[];

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ReceiptPhoto {
  id: string;
  goodsReceiptId: string;
  goodsReceiptItemId?: string; // Optional: link to specific item

  // Photo details
  photoUrl: string;
  thumbnailUrl?: string;

  photoType:
    | 'OVERALL'
    | 'CLOSE_UP'
    | 'DAMAGE'
    | 'SERIAL_NUMBER'
    | 'PACKAGING'
    | 'TEST_SETUP'
    | 'OTHER';

  description?: string;
  tags?: string[];

  // Location in storage
  storageRef: string;

  // Metadata
  uploadedBy: string;
  uploadedAt: Timestamp;
}

// ============================================================================
// WORK COMPLETION CERTIFICATE TYPES
// ============================================================================

export interface WorkCompletionCertificate {
  id: string;
  number: string; // WCC/YYYY/MM/XXXX

  // Purchase Order reference
  purchaseOrderId: string;
  poNumber: string; // Denormalized

  // Vendor
  vendorId: string;
  vendorName: string; // Denormalized

  // Project
  projectId: string;
  projectName: string; // Denormalized

  // Completion details
  workDescription: string;
  completionDate: Timestamp;

  // Deliverables
  allItemsDelivered: boolean;
  allItemsAccepted: boolean;
  allPaymentsCompleted: boolean;

  // Certificate details
  certificateText: string;
  remarks?: string;

  // Documents
  pdfUrl?: string;

  // Workflow
  issuedBy: string;
  issuedByName: string; // Denormalized
  issuedAt: Timestamp;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// NOTIFICATION TYPES (In-App Only)
// ============================================================================

export type ProcurementNotificationType =
  | 'PR_CREATED'
  | 'PR_SUBMITTED'
  | 'PR_APPROVED'
  | 'PR_REJECTED'
  | 'PR_COMMENTED'
  | 'RFQ_CREATED'
  | 'RFQ_REVISED'
  | 'OFFER_UPLOADED'
  | 'OFFER_EVALUATED'
  | 'PO_CREATED'
  | 'PO_PENDING_APPROVAL'
  | 'PO_APPROVED'
  | 'PO_REJECTED'
  | 'PO_ISSUED'
  | 'OA_RECEIVED'
  | 'PACKING_LIST_CREATED'
  | 'GOODS_SHIPPED'
  | 'GOODS_RECEIVED'
  | 'PAYMENT_REQUESTED'
  | 'PAYMENT_APPROVED'
  | 'WCC_ISSUED';

export interface ProcurementNotification {
  id: string;
  type: ProcurementNotificationType;

  // Target user
  userId: string;

  // Message
  title: string;
  message: string;

  // Link to entity
  entityType: string; // 'PURCHASE_REQUEST', 'RFQ', 'OFFER', 'PO', etc.
  entityId: string;
  linkUrl: string; // Where to navigate when clicked

  // Status
  read: boolean;
  readAt?: Timestamp;

  // Priority
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  // Metadata
  metadata?: Record<string, any>;

  // Timestamps
  createdAt: Timestamp;
}
