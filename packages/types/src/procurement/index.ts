/**
 * Procurement Module Type Definitions
 *
 * Defines all types for the procurement workflow:
 * Purchase Request → RFQ → Offer → Purchase Order → Delivery → Completion
 *
 * This module is split into logical sub-modules for maintainability:
 * - purchaseRequest: PR types and attachments
 * - rfq: Request for Quotation types
 * - offer: Vendor offer and comparison types
 * - purchaseOrder: PO and commercial terms types
 * - logistics: Packing list and goods receipt types
 * - completion: Work completion certificate types
 * - notifications: In-app notification types
 * - amendments: PO amendment and version history types
 * - threeWayMatching: PO/GR/Invoice matching types
 */

// Purchase Request types
export {
  type PurchaseRequestType,
  type PurchaseRequestCategory,
  type PurchaseRequestStatus,
  type PurchaseRequest,
  type PurchaseRequestItem,
  type PurchaseRequestAttachmentType,
  PR_ATTACHMENT_TYPE_LABELS,
  type PurchaseRequestAttachment,
} from './purchaseRequest';

// RFQ types
export { type RFQStatus, type RFQ, type RFQItem } from './rfq';

// Offer types
export {
  type OfferStatus,
  type Offer,
  type OfferItem,
  type OfferComparison,
  type OfferComparisonStat,
  type ItemOfferComparison,
  type ItemComparison,
  type OfferComparisonData,
} from './offer';

// Purchase Order types
export {
  type PurchaseOrderStatus,
  type PurchaseOrder,
  type PurchaseOrderItem,
  type PaymentMilestone,
  type POPriceBasis,
  type PODeliveryTrigger,
  type POScopeAssignment,
  type POErectionScope,
  type PORequiredDocument,
  type POInspectorType,
  type POCommercialTerms,
  type CommercialTermsTemplate,
} from './purchaseOrder';

// Logistics types (Packing List, Goods Receipt)
export {
  type PackingListStatus,
  type PackingList,
  type PackingListItem,
  type GoodsReceiptStatus,
  type ItemCondition,
  type GoodsReceipt,
  type GoodsReceiptItem,
  type ReceiptPhoto,
} from './logistics';

// Work Completion Certificate types
export { type WorkCompletionCertificate } from './completion';

// Notification types
export { type ProcurementNotificationType, type ProcurementNotification } from './notifications';

// Amendment types
export {
  type PurchaseOrderAmendment,
  type PurchaseOrderChange,
  type PurchaseOrderVersion,
  type AmendmentApprovalHistory,
} from './amendments';

// Three-Way Matching types
export {
  type ThreeWayMatchStatus,
  type DiscrepancyType,
  type ThreeWayMatch,
  type MatchLineItem,
  type MatchDiscrepancy,
  type MatchToleranceConfig,
} from './threeWayMatching';
