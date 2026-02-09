/**
 * Logistics Type Definitions
 *
 * Types for packing lists and goods receipts in procurement workflow.
 */

import type { Timestamp } from 'firebase/firestore';

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

  // Entity (for multi-tenancy) — required for tenant isolation
  entityId: string;

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

  // Sent to accounting for bill creation
  sentToAccountingAt?: Timestamp;
  accountingAssigneeId?: string;
  accountingAssigneeName?: string;
  sentToAccountingById?: string;
  sentToAccountingByName?: string;

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
