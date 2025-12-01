/**
 * Audit Log Query Service
 *
 * Provides query utilities for fetching and filtering audit logs.
 * Used by the admin audit log viewer.
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  doc,
  getDoc,
  type Query,
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import type { AuditLog, AuditAction, AuditEntityType, AuditSeverity } from '@vapour/types';

/**
 * Options for building an audit log query
 */
export interface AuditLogQueryOptions {
  action?: AuditAction;
  entityType?: AuditEntityType;
  severity?: AuditSeverity;
  actorId?: string;
  entityId?: string;
  limitCount?: number;
}

/**
 * Build a Firestore query for audit logs with filters
 *
 * Note: Firestore has limitations on compound queries.
 * Only one inequality filter per query is allowed, and
 * composite indexes must exist for the field combinations.
 *
 * @param db - Firestore database instance
 * @param options - Query options/filters
 * @returns Firestore Query object
 */
export function buildAuditLogQuery(db: Firestore, options: AuditLogQueryOptions = {}): Query {
  const constraints: QueryConstraint[] = [];

  // Add filters based on options
  // Note: Each filter combination requires a composite index
  if (options.actorId) {
    constraints.push(where('actorId', '==', options.actorId));
  }

  if (options.action) {
    constraints.push(where('action', '==', options.action));
  }

  if (options.entityType) {
    constraints.push(where('entityType', '==', options.entityType));
  }

  if (options.severity) {
    constraints.push(where('severity', '==', options.severity));
  }

  if (options.entityId) {
    constraints.push(where('entityId', '==', options.entityId));
  }

  // Always order by timestamp descending (newest first)
  constraints.push(orderBy('timestamp', 'desc'));

  // Apply limit
  const queryLimit = options.limitCount || 500;
  constraints.push(limit(queryLimit));

  return query(collection(db, COLLECTIONS.AUDIT_LOGS), ...constraints);
}

/**
 * Get a single audit log entry by ID
 *
 * @param db - Firestore database instance
 * @param id - Audit log document ID
 * @returns AuditLog or null if not found
 */
export async function getAuditLogById(db: Firestore, id: string): Promise<AuditLog | null> {
  try {
    const docRef = doc(db, COLLECTIONS.AUDIT_LOGS, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const docData = docSnap.data() as Omit<AuditLog, 'id'>;
    const result: AuditLog = {
      id: docSnap.id,
      ...docData,
    };
    return result;
  } catch (error) {
    console.error('[AuditLogService] Error fetching audit log:', error);
    return null;
  }
}

/**
 * Action category groupings for filter UI
 */
export const ACTION_CATEGORIES: Record<string, AuditAction[]> = {
  'User Management': [
    'USER_CREATED',
    'USER_UPDATED',
    'USER_DELETED',
    'USER_APPROVED',
    'USER_REJECTED',
    'USER_ACTIVATED',
    'USER_DEACTIVATED',
  ],
  'Roles & Permissions': [
    'ROLE_ASSIGNED',
    'ROLE_REMOVED',
    'PERMISSION_GRANTED',
    'PERMISSION_REVOKED',
    'CLAIMS_UPDATED',
  ],
  Authentication: ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGED', 'PASSWORD_RESET'],
  Projects: [
    'PROJECT_CREATED',
    'PROJECT_UPDATED',
    'PROJECT_DELETED',
    'PROJECT_STATUS_CHANGED',
    'PROJECT_ASSIGNED',
    'PROJECT_UNASSIGNED',
    'CHARTER_SUBMITTED',
    'CHARTER_APPROVED',
    'CHARTER_REJECTED',
  ],
  Entities: ['ENTITY_CREATED', 'ENTITY_UPDATED', 'ENTITY_DELETED'],
  'Purchase Requests': [
    'PR_CREATED',
    'PR_UPDATED',
    'PR_SUBMITTED',
    'PR_APPROVED',
    'PR_REJECTED',
    'PR_CANCELLED',
  ],
  RFQ: [
    'RFQ_CREATED',
    'RFQ_UPDATED',
    'RFQ_ISSUED',
    'RFQ_CANCELLED',
    'QUOTATION_RECEIVED',
    'QUOTATION_EVALUATED',
  ],
  'Purchase Orders': [
    'PO_CREATED',
    'PO_UPDATED',
    'PO_APPROVED',
    'PO_REJECTED',
    'PO_ISSUED',
    'PO_AMENDED',
    'PO_CANCELLED',
  ],
  'Goods Receipt': ['GR_CREATED', 'GR_UPDATED', 'GR_COMPLETED', 'GR_REJECTED'],
  'Three-Way Match': [
    'MATCH_CREATED',
    'MATCH_APPROVED',
    'MATCH_REJECTED',
    'MATCH_DISCREPANCY_RESOLVED',
  ],
  'Invoices & Bills': [
    'INVOICE_CREATED',
    'INVOICE_UPDATED',
    'INVOICE_APPROVED',
    'INVOICE_PAID',
    'INVOICE_CANCELLED',
    'BILL_CREATED',
    'BILL_UPDATED',
    'BILL_APPROVED',
    'BILL_PAID',
  ],
  Payments: ['PAYMENT_CREATED', 'PAYMENT_APPROVED', 'PAYMENT_COMPLETED', 'PAYMENT_CANCELLED'],
  Accounting: [
    'TRANSACTION_CREATED',
    'TRANSACTION_UPDATED',
    'TRANSACTION_APPROVED',
    'TRANSACTION_VOIDED',
    'GL_ENTRY_CREATED',
    'ACCOUNT_CREATED',
    'ACCOUNT_UPDATED',
    'COST_CENTRE_CREATED',
    'COST_CENTRE_UPDATED',
  ],
  Documents: [
    'DOCUMENT_CREATED',
    'DOCUMENT_UPDATED',
    'DOCUMENT_DELETED',
    'DOCUMENT_ASSIGNED',
    'DOCUMENT_SUBMITTED',
    'DOCUMENT_APPROVED',
    'DOCUMENT_REJECTED',
    'DOCUMENT_REVISION_CREATED',
    'COMMENT_CREATED',
    'COMMENT_RESOLVED',
    'COMMENT_APPROVED',
  ],
  Materials: [
    'MATERIAL_CREATED',
    'MATERIAL_UPDATED',
    'MATERIAL_DELETED',
    'BOM_CREATED',
    'BOM_UPDATED',
    'BOM_DELETED',
    'BOM_ITEM_ADDED',
    'BOM_ITEM_UPDATED',
    'BOM_ITEM_DELETED',
  ],
  Proposals: [
    'PROPOSAL_CREATED',
    'PROPOSAL_UPDATED',
    'PROPOSAL_SUBMITTED',
    'PROPOSAL_APPROVED',
    'PROPOSAL_REJECTED',
    'PROPOSAL_REVISION_CREATED',
    'ENQUIRY_CREATED',
    'ENQUIRY_UPDATED',
  ],
  Tasks: [
    'TASK_CREATED',
    'TASK_UPDATED',
    'TASK_STARTED',
    'TASK_COMPLETED',
    'TASK_REASSIGNED',
    'TIME_ENTRY_STARTED',
    'TIME_ENTRY_STOPPED',
  ],
  System: [
    'CONFIG_CHANGED',
    'BACKUP_CREATED',
    'DATA_EXPORTED',
    'DATA_IMPORTED',
    'INVITATION_SENT',
    'INVITATION_ACCEPTED',
    'INVITATION_REJECTED',
  ],
};

/**
 * Entity type groupings for filter UI
 */
export const ENTITY_TYPE_CATEGORIES: Record<string, AuditEntityType[]> = {
  'Users & Access': ['USER', 'ROLE', 'PERMISSION', 'INVITATION'],
  'Business Entities': ['ENTITY', 'VENDOR', 'CUSTOMER', 'PARTNER', 'COMPANY'],
  Projects: ['PROJECT', 'PROJECT_CHARTER'],
  Procurement: [
    'PURCHASE_REQUEST',
    'PURCHASE_REQUEST_ITEM',
    'RFQ',
    'QUOTATION',
    'PURCHASE_ORDER',
    'PURCHASE_ORDER_ITEM',
    'PURCHASE_ORDER_AMENDMENT',
    'GOODS_RECEIPT',
    'PACKING_LIST',
    'THREE_WAY_MATCH',
  ],
  Accounting: [
    'TRANSACTION',
    'INVOICE',
    'BILL',
    'PAYMENT',
    'GL_ACCOUNT',
    'GL_ENTRY',
    'COST_CENTRE',
  ],
  Documents: ['MASTER_DOCUMENT', 'DOCUMENT_SUBMISSION', 'DOCUMENT_COMMENT', 'TRANSMITTAL'],
  Materials: ['MATERIAL', 'SHAPE', 'BOM', 'BOM_ITEM', 'BOUGHT_OUT_ITEM'],
  Proposals: ['PROPOSAL', 'ENQUIRY'],
  Tasks: ['TASK_NOTIFICATION', 'TIME_ENTRY'],
  System: ['SYSTEM'],
};

/**
 * Severity level configuration for display
 */
export const SEVERITY_CONFIG: Record<
  AuditSeverity,
  { label: string; color: 'info' | 'warning' | 'error' | 'default' }
> = {
  INFO: { label: 'Info', color: 'info' },
  WARNING: { label: 'Warning', color: 'warning' },
  ERROR: { label: 'Error', color: 'error' },
  CRITICAL: { label: 'Critical', color: 'error' },
};
