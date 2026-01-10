import { Timestamp } from 'firebase/firestore';

/**
 * Audit Actions - All trackable operations
 */
export type AuditAction =
  // User Management
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'USER_APPROVED'
  | 'USER_REJECTED'
  | 'USER_ACTIVATED'
  | 'USER_DEACTIVATED'
  // Role & Permission Management
  | 'ROLE_ASSIGNED'
  | 'ROLE_REMOVED'
  | 'PERMISSION_GRANTED'
  | 'PERMISSION_REVOKED'
  | 'CLAIMS_UPDATED'
  // Project Management
  | 'PROJECT_ASSIGNED'
  | 'PROJECT_UNASSIGNED'
  | 'PROJECT_CREATED'
  | 'PROJECT_UPDATED'
  | 'PROJECT_DELETED'
  | 'PROJECT_STATUS_CHANGED'
  | 'CHARTER_SUBMITTED'
  | 'CHARTER_APPROVED'
  | 'CHARTER_REJECTED'
  // Authentication
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET'
  // Entity Management
  | 'ENTITY_CREATED'
  | 'ENTITY_UPDATED'
  | 'ENTITY_DELETED'
  // Procurement - Purchase Requests
  | 'PR_CREATED'
  | 'PR_UPDATED'
  | 'PR_SUBMITTED'
  | 'PR_APPROVED'
  | 'PR_REJECTED'
  | 'PR_CANCELLED'
  // Procurement - RFQ
  | 'RFQ_CREATED'
  | 'RFQ_UPDATED'
  | 'RFQ_ISSUED'
  | 'RFQ_CANCELLED'
  | 'QUOTATION_RECEIVED'
  | 'QUOTATION_EVALUATED'
  // Procurement - Offers
  | 'OFFER_CREATED'
  | 'OFFER_UPDATED'
  | 'OFFER_SELECTED'
  | 'OFFER_REJECTED'
  | 'OFFER_WITHDRAWN'
  // Procurement - Purchase Orders
  | 'PO_CREATED'
  | 'PO_UPDATED'
  | 'PO_APPROVED'
  | 'PO_REJECTED'
  | 'PO_ISSUED'
  | 'PO_AMENDED'
  | 'PO_CANCELLED'
  // Procurement - Goods Receipt
  | 'GR_CREATED'
  | 'GR_UPDATED'
  | 'GR_COMPLETED'
  | 'GR_REJECTED'
  // Procurement - Packing List
  | 'PACKING_LIST_CREATED'
  | 'PACKING_LIST_FINALIZED'
  | 'PACKING_LIST_SHIPPED'
  | 'PACKING_LIST_DELIVERED'
  // Procurement - Three-Way Match
  | 'MATCH_CREATED'
  | 'MATCH_APPROVED'
  | 'MATCH_REJECTED'
  | 'MATCH_DISCREPANCY_RESOLVED'
  // Accounting - Transactions
  | 'TRANSACTION_CREATED'
  | 'TRANSACTION_UPDATED'
  | 'TRANSACTION_APPROVED'
  | 'TRANSACTION_VOIDED'
  // Accounting - Invoices & Bills
  | 'INVOICE_CREATED'
  | 'INVOICE_UPDATED'
  | 'INVOICE_SUBMITTED'
  | 'INVOICE_APPROVED'
  | 'INVOICE_REJECTED'
  | 'INVOICE_POSTED'
  | 'INVOICE_PAID'
  | 'INVOICE_VOIDED'
  | 'INVOICE_CANCELLED'
  | 'BILL_CREATED'
  | 'BILL_UPDATED'
  | 'BILL_SUBMITTED'
  | 'BILL_APPROVED'
  | 'BILL_REJECTED'
  | 'BILL_POSTED'
  | 'BILL_PAID'
  | 'BILL_VOIDED'
  // Accounting - Payments
  | 'PAYMENT_CREATED'
  | 'PAYMENT_UPDATED'
  | 'PAYMENT_APPROVED'
  | 'PAYMENT_POSTED'
  | 'PAYMENT_COMPLETED'
  | 'PAYMENT_CANCELLED'
  | 'PAYMENT_VOIDED'
  // Accounting - Journal Entries
  | 'JOURNAL_ENTRY_CREATED'
  | 'JOURNAL_ENTRY_UPDATED'
  | 'JOURNAL_ENTRY_POSTED'
  | 'JOURNAL_ENTRY_REVERSED'
  // Accounting - GL & Cost Centres
  | 'GL_ENTRY_CREATED'
  | 'ACCOUNT_CREATED'
  | 'ACCOUNT_UPDATED'
  | 'ACCOUNT_DEACTIVATED'
  | 'COST_CENTRE_CREATED'
  | 'COST_CENTRE_UPDATED'
  | 'COST_CENTRE_CLOSED'
  // Accounting - Fiscal Year & Period Management
  | 'FISCAL_YEAR_CREATED'
  | 'FISCAL_YEAR_CLOSED'
  | 'PERIOD_OPENED'
  | 'PERIOD_CLOSED'
  | 'PERIOD_LOCKED'
  | 'PERIOD_UNLOCKED'
  | 'YEAR_END_CLOSING_CREATED'
  | 'YEAR_END_CLOSING_POSTED'
  | 'YEAR_END_CLOSING_REVERSED'
  // Accounting - Bank Reconciliation
  | 'BANK_STATEMENT_UPLOADED'
  | 'BANK_RECONCILIATION_MATCHED'
  | 'BANK_RECONCILIATION_UNMATCHED'
  | 'BANK_RECONCILIATION_COMPLETED'
  // Accounting - Reports
  | 'REPORT_GENERATED'
  | 'REPORT_EXPORTED'
  // Documents
  | 'DOCUMENT_CREATED'
  | 'DOCUMENT_UPDATED'
  | 'DOCUMENT_DELETED'
  | 'DOCUMENT_ASSIGNED'
  | 'DOCUMENT_SUBMITTED'
  | 'DOCUMENT_APPROVED'
  | 'DOCUMENT_REJECTED'
  | 'DOCUMENT_REVISION_CREATED'
  | 'COMMENT_CREATED'
  | 'COMMENT_RESOLVED'
  | 'COMMENT_APPROVED'
  // Materials & BOM
  | 'MATERIAL_CREATED'
  | 'MATERIAL_UPDATED'
  | 'MATERIAL_DELETED'
  | 'BOM_CREATED'
  | 'BOM_UPDATED'
  | 'BOM_DELETED'
  | 'BOM_ITEM_ADDED'
  | 'BOM_ITEM_UPDATED'
  | 'BOM_ITEM_DELETED'
  // Proposals
  | 'PROPOSAL_CREATED'
  | 'PROPOSAL_UPDATED'
  | 'PROPOSAL_SUBMITTED'
  | 'PROPOSAL_APPROVED'
  | 'PROPOSAL_REJECTED'
  | 'PROPOSAL_REVISION_CREATED'
  | 'ENQUIRY_CREATED'
  | 'ENQUIRY_UPDATED'
  // Tasks
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_STARTED'
  | 'TASK_COMPLETED'
  | 'TASK_REASSIGNED'
  | 'TIME_ENTRY_STARTED'
  | 'TIME_ENTRY_STOPPED'
  // System
  | 'CONFIG_CHANGED'
  | 'BACKUP_CREATED'
  | 'DATA_EXPORTED'
  | 'DATA_IMPORTED'
  // Invitation
  | 'INVITATION_SENT'
  | 'INVITATION_ACCEPTED'
  | 'INVITATION_REJECTED';

/**
 * Entity types that can be audited
 */
export type AuditEntityType =
  | 'USER'
  | 'ROLE'
  | 'PERMISSION'
  | 'PROJECT'
  | 'PROJECT_CHARTER'
  | 'ENTITY'
  | 'VENDOR'
  | 'CUSTOMER'
  | 'PARTNER'
  | 'COMPANY'
  | 'INVITATION'
  | 'SYSTEM'
  // Procurement
  | 'PURCHASE_REQUEST'
  | 'PURCHASE_REQUEST_ITEM'
  | 'RFQ'
  | 'QUOTATION'
  | 'OFFER'
  | 'PURCHASE_ORDER'
  | 'PURCHASE_ORDER_ITEM'
  | 'PURCHASE_ORDER_AMENDMENT'
  | 'GOODS_RECEIPT'
  | 'PACKING_LIST'
  | 'THREE_WAY_MATCH'
  // Accounting
  | 'TRANSACTION'
  | 'INVOICE'
  | 'BILL'
  | 'PAYMENT'
  | 'JOURNAL_ENTRY'
  | 'GL_ACCOUNT'
  | 'GL_ENTRY'
  | 'COST_CENTRE'
  | 'FISCAL_YEAR'
  | 'ACCOUNTING_PERIOD'
  | 'BANK_STATEMENT'
  | 'BANK_RECONCILIATION'
  | 'YEAR_END_CLOSING'
  // Documents
  | 'MASTER_DOCUMENT'
  | 'DOCUMENT_SUBMISSION'
  | 'DOCUMENT_COMMENT'
  | 'TRANSMITTAL'
  // Materials & BOM
  | 'MATERIAL'
  | 'SHAPE'
  | 'BOM'
  | 'BOM_ITEM'
  | 'BOUGHT_OUT_ITEM'
  // Proposals
  | 'PROPOSAL'
  | 'ENQUIRY'
  // Tasks
  | 'TASK_NOTIFICATION'
  | 'TIME_ENTRY';

/**
 * Audit log severity levels
 */
export type AuditSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

/**
 * Field change tracking for audit logs
 */
export interface AuditFieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  fieldType?: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'timestamp';
}

/**
 * Main audit log entry
 */
export interface AuditLog {
  id: string;

  // Actor information (who performed the action)
  actorId: string;
  actorEmail: string;
  actorName: string;
  actorPermissions?: number; // Bitwise permission flags

  // Action details
  action: AuditAction;
  severity: AuditSeverity;

  // Target entity (what was affected)
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string;

  // Parent entity (for nested entities like PR items, PO items, etc.)
  parentEntityType?: AuditEntityType;
  parentEntityId?: string;

  // Change tracking
  changes?: AuditFieldChange[];
  changeCount?: number; // Denormalized for sorting

  // Context
  description: string;
  metadata?: Record<string, unknown>;

  // Request information
  ipAddress?: string;
  userAgent?: string;

  // Timestamps
  timestamp: Timestamp;

  // Status
  success: boolean;
  errorMessage?: string;

  // Compliance
  isComplianceSensitive?: boolean; // Flag for SOX, GDPR, etc.
  retentionDays?: number; // Override default retention
}

/**
 * Parameters for creating an audit log entry
 */
export interface CreateAuditLogParams {
  // Actor (optional - can be derived from context)
  actorId?: string;
  actorEmail?: string;
  actorName?: string;
  actorPermissions?: number; // Bitwise permission flags

  // Action details
  action: AuditAction;
  severity?: AuditSeverity; // Defaults to INFO

  // Target entity
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string;

  // Change tracking
  changes?: AuditFieldChange[];

  // Context
  description: string;
  metadata?: Record<string, unknown>;

  // Request information
  ipAddress?: string;
  userAgent?: string;

  // Status
  success?: boolean; // Defaults to true
  errorMessage?: string;
}

/**
 * Query parameters for filtering audit logs
 */
export interface AuditLogQuery {
  actorId?: string;
  action?: AuditAction;
  entityType?: AuditEntityType;
  entityId?: string;
  severity?: AuditSeverity;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}
