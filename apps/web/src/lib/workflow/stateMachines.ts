/**
 * Entity State Machines
 *
 * Centralized state machine definitions for workflow entities.
 * These define valid status transitions for each entity type.
 *
 * Usage:
 * ```typescript
 * import { purchaseOrderStateMachine } from '@/lib/workflow/stateMachines';
 *
 * // Check if transition is allowed
 * if (!purchaseOrderStateMachine.canTransitionTo(po.status, 'APPROVED')) {
 *   throw new Error('Invalid transition');
 * }
 *
 * // Get available actions
 * const actions = purchaseOrderStateMachine.getAvailableActions(po.status);
 * ```
 */

import {
  createStateMachine,
  type StateMachine,
  type StateTransitionConfig,
} from '@/lib/utils/stateMachine';
import type {
  PurchaseOrderStatus,
  OfferStatus,
  GoodsReceiptStatus,
  PackingListStatus,
  PurchaseRequestStatus,
} from '@vapour/types';
import type { ProposalStatus } from '@vapour/types';
import { PermissionFlag } from '@vapour/types';

// ============================================================================
// Purchase Order State Machine
// ============================================================================

/**
 * Purchase Order workflow states:
 *
 * DRAFT -> PENDING_APPROVAL -> APPROVED -> ISSUED -> ACKNOWLEDGED -> IN_PROGRESS -> DELIVERED -> COMPLETED
 *                          \-> REJECTED -> DRAFT (revision)
 *
 * CANCELLED is reachable from DRAFT, PENDING_APPROVAL, APPROVED, ISSUED
 * AMENDED is reachable from ISSUED, ACKNOWLEDGED, IN_PROGRESS
 */
export const purchaseOrderStateMachine: StateMachine<PurchaseOrderStatus> = createStateMachine({
  transitions: {
    DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
    PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED'],
    APPROVED: ['ISSUED', 'CANCELLED'],
    REJECTED: ['DRAFT'], // Allow revision
    ISSUED: ['ACKNOWLEDGED', 'IN_PROGRESS', 'CANCELLED', 'AMENDED'],
    ACKNOWLEDGED: ['IN_PROGRESS', 'DELIVERED', 'AMENDED'],
    IN_PROGRESS: ['DELIVERED', 'COMPLETED', 'AMENDED'],
    DELIVERED: ['COMPLETED'],
    COMPLETED: [], // Terminal
    CANCELLED: [], // Terminal
    AMENDED: ['DRAFT'], // Amended PO can be revised
  },
  transitionPermissions: {
    // Key format: "FROM_TO"
    PENDING_APPROVAL_APPROVED: PermissionFlag.APPROVE_PO,
    PENDING_APPROVAL_REJECTED: PermissionFlag.APPROVE_PO,
    APPROVED_ISSUED: PermissionFlag.APPROVE_PO, // Or could be CREATE_PO
  },
  terminalStates: ['COMPLETED', 'CANCELLED'],
});

// ============================================================================
// Proposal State Machine
// ============================================================================

/**
 * Proposal workflow states:
 *
 * DRAFT -> PENDING_APPROVAL -> APPROVED -> SUBMITTED -> UNDER_NEGOTIATION -> ACCEPTED
 *                          \-> REJECTED                                  \-> REJECTED
 *
 * EXPIRED can happen from SUBMITTED, UNDER_NEGOTIATION
 */
export const proposalStateMachine: StateMachine<ProposalStatus> = createStateMachine({
  transitions: {
    DRAFT: ['PENDING_APPROVAL'],
    PENDING_APPROVAL: ['APPROVED', 'DRAFT'], // DRAFT = internal rejection (return for revision)
    APPROVED: ['SUBMITTED'],
    REJECTED: [], // Terminal - only for client rejection
    SUBMITTED: ['UNDER_NEGOTIATION', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
    UNDER_NEGOTIATION: ['ACCEPTED', 'REJECTED', 'EXPIRED'],
    ACCEPTED: [], // Terminal
    EXPIRED: [], // Terminal
  },
  transitionPermissions: {
    PENDING_APPROVAL_APPROVED: PermissionFlag.APPROVE_ESTIMATES,
    PENDING_APPROVAL_DRAFT: PermissionFlag.APPROVE_ESTIMATES, // Return for revision
  },
  terminalStates: ['ACCEPTED', 'EXPIRED', 'REJECTED'],
});

// ============================================================================
// Goods Receipt State Machine
// ============================================================================

/**
 * Goods Receipt workflow states:
 *
 * PENDING -> IN_PROGRESS -> COMPLETED
 *                       \-> ISSUES_FOUND -> IN_PROGRESS (retry)
 */
const grConfig: StateTransitionConfig<GoodsReceiptStatus> = {
  transitions: {
    PENDING: ['IN_PROGRESS'],
    IN_PROGRESS: ['COMPLETED', 'ISSUES_FOUND'],
    ISSUES_FOUND: ['IN_PROGRESS', 'COMPLETED'], // Can retry or complete anyway
    COMPLETED: [], // Terminal
  },
  terminalStates: ['COMPLETED'],
};
export const goodsReceiptStateMachine: StateMachine<GoodsReceiptStatus> =
  createStateMachine(grConfig);

// ============================================================================
// Offer State Machine
// ============================================================================

/**
 * Offer workflow states:
 *
 * UPLOADED -> UNDER_REVIEW -> EVALUATED -> SELECTED
 *         \-> SELECTED (direct selection for simple workflows)
 *                                      \-> REJECTED
 *
 * WITHDRAWN can happen from any non-terminal state
 * Direct SELECTED allowed from any active state for single-offer or expedited scenarios
 */
const offerConfig: StateTransitionConfig<OfferStatus> = {
  transitions: {
    UPLOADED: ['UNDER_REVIEW', 'SELECTED', 'REJECTED', 'WITHDRAWN'],
    UNDER_REVIEW: ['EVALUATED', 'SELECTED', 'REJECTED', 'WITHDRAWN'],
    EVALUATED: ['SELECTED', 'REJECTED', 'WITHDRAWN'],
    SELECTED: ['PO_CREATED'], // PO creation transitions to PO_CREATED
    PO_CREATED: [], // Terminal - PO has been created
    REJECTED: [], // Terminal
    WITHDRAWN: [], // Terminal
  },
  terminalStates: ['PO_CREATED', 'REJECTED', 'WITHDRAWN'],
};
export const offerStateMachine: StateMachine<OfferStatus> = createStateMachine(offerConfig);

// ============================================================================
// Packing List State Machine
// ============================================================================

/**
 * Packing List workflow states (mirroring existing packingListHelpers.ts):
 *
 * DRAFT -> FINALIZED -> SHIPPED -> DELIVERED
 */
const plConfig: StateTransitionConfig<PackingListStatus> = {
  transitions: {
    DRAFT: ['FINALIZED'],
    FINALIZED: ['SHIPPED'],
    SHIPPED: ['DELIVERED'],
    DELIVERED: [], // Terminal
  },
  terminalStates: ['DELIVERED'],
};
export const packingListStateMachine: StateMachine<PackingListStatus> =
  createStateMachine(plConfig);

// ============================================================================
// Purchase Request State Machine
// ============================================================================

/**
 * Purchase Request workflow states:
 *
 * DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED -> CONVERTED_TO_RFQ
 *                                   \-> REJECTED -> DRAFT (revision)
 */
const prConfig: StateTransitionConfig<PurchaseRequestStatus> = {
  transitions: {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['UNDER_REVIEW', 'APPROVED', 'REJECTED'],
    UNDER_REVIEW: ['APPROVED', 'REJECTED'],
    APPROVED: ['CONVERTED_TO_RFQ'],
    REJECTED: ['DRAFT'], // Allow revision
    CONVERTED_TO_RFQ: [], // Terminal
  },
  transitionPermissions: {
    UNDER_REVIEW_APPROVED: PermissionFlag.APPROVE_PR,
    UNDER_REVIEW_REJECTED: PermissionFlag.APPROVE_PR,
    SUBMITTED_APPROVED: PermissionFlag.APPROVE_PR,
    SUBMITTED_REJECTED: PermissionFlag.APPROVE_PR,
  },
  terminalStates: ['CONVERTED_TO_RFQ'],
};
export const purchaseRequestStateMachine: StateMachine<PurchaseRequestStatus> =
  createStateMachine(prConfig);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a status is a terminal state (no further transitions)
 */
export function isTerminalStatus<T extends string>(
  stateMachine: StateMachine<T>,
  status: T
): boolean {
  return stateMachine.isTerminal(status);
}

/**
 * Get user-friendly label for available transitions
 */
export function getTransitionLabels(transitions: string[]): Record<string, string> {
  const labels: Record<string, string> = {
    // PO
    PENDING_APPROVAL: 'Submit for Approval',
    APPROVED: 'Approve',
    REJECTED: 'Reject',
    ISSUED: 'Issue PO',
    ACKNOWLEDGED: 'Acknowledge Receipt',
    IN_PROGRESS: 'Mark In Progress',
    DELIVERED: 'Mark Delivered',
    COMPLETED: 'Complete',
    CANCELLED: 'Cancel',
    AMENDED: 'Amend',
    // Proposal
    SUBMITTED: 'Submit to Client',
    UNDER_NEGOTIATION: 'Under Negotiation',
    ACCEPTED: 'Mark Accepted',
    EXPIRED: 'Mark Expired',
    // Offer
    UPLOADED: 'Upload',
    UNDER_REVIEW: 'Start Review',
    EVALUATED: 'Mark Evaluated',
    SELECTED: 'Select Offer',
    WITHDRAWN: 'Withdraw',
    // GR
    PENDING: 'Pending',
    ISSUES_FOUND: 'Report Issues',
    // Packing List
    DRAFT: 'Draft',
    FINALIZED: 'Finalize',
    SHIPPED: 'Ship',
    // PR
    CONVERTED_TO_RFQ: 'Convert to RFQ',
  };

  return transitions.reduce(
    (acc, status) => {
      acc[status] = labels[status] || status;
      return acc;
    },
    {} as Record<string, string>
  );
}
