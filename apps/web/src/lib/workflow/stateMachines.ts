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
  AmendmentStatus,
  QuoteStatus as OfferStatus,
  GoodsReceiptStatus,
  PackingListStatus,
  PurchaseRequestStatus,
  RFQStatus,
  PaymentBatchStatus,
  TravelExpenseStatus,
  AssetStatus,
  MasterDocumentStatus,
  AgentRunStatus,
  AgentTaskStatus,
} from '@vapour/types';
import type { ProposalStatus, CharterApprovalStatus, OrderAcceptanceStatus } from '@vapour/types';
import { PERMISSION_FLAGS } from '@vapour/constants';

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
 *
 * AMENDED is legacy-only (feedback wsvWR2UnRSlwYmxMTi4w): applying an
 * amendment no longer changes the PO status — amendments are tracked via
 * lastAmendmentNumber/lastAmendmentDate instead. The AMENDED state keeps
 * exit transitions so POs stuck in it can return to the lifecycle.
 *
 * IN_PROGRESS is auto-set when a Packing List is created or a payment is
 * recorded against the PO; DELIVERED is auto-set when a Goods Receipt fully
 * receives the ordered quantity (see advancePOStatusIfAllowed in
 * purchaseOrder/workflow.ts and the Cloud Function in
 * functions/src/procurementPaymentStatus.ts). COMPLETED stays a manual
 * action — closing a PO can involve steps beyond delivery/payment.
 */
export const purchaseOrderStateMachine: StateMachine<PurchaseOrderStatus> =
  createStateMachine<PurchaseOrderStatus>({
    transitions: {
      DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
      // Two named approvers, sequential (review 2.3): first → final → approved.
      // DRAFT from either pending stage is "Return with Comments" — a named
      // approver sends the PO back for revision (feedback sUjQ9E0O9tS9YZHqEtox).
      PENDING_APPROVAL: ['PENDING_FINAL_APPROVAL', 'REJECTED', 'DRAFT', 'CANCELLED'],
      PENDING_FINAL_APPROVAL: ['APPROVED', 'REJECTED', 'DRAFT', 'CANCELLED'],
      APPROVED: ['ISSUED', 'CANCELLED'],
      REJECTED: ['DRAFT'], // Allow revision
      // DELIVERED direct from ISSUED covers a GR fully receiving a PO whose
      // IN_PROGRESS auto-advance (on PL creation / payment) didn't fire yet.
      ISSUED: ['ACKNOWLEDGED', 'IN_PROGRESS', 'DELIVERED', 'CANCELLED'],
      ACKNOWLEDGED: ['IN_PROGRESS', 'DELIVERED'],
      IN_PROGRESS: ['DELIVERED', 'COMPLETED'],
      DELIVERED: ['COMPLETED'],
      COMPLETED: [], // Terminal
      CANCELLED: [], // Terminal
      // Legacy exits only — nothing transitions INTO AMENDED anymore.
      AMENDED: ['ISSUED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'DELIVERED', 'DRAFT'],
    },
    transitionPermissions: {
      // Key format: "FROM_TO". Approval transitions are gated by APPROVER IDENTITY
      // (the two designated approvers), not a permission flag, so they're not
      // listed here — see requireApprover() in the workflow.
      APPROVED_ISSUED: PERMISSION_FLAGS.MANAGE_PROCUREMENT, // Or could be CREATE_PO
    },
    terminalStates: ['COMPLETED', 'CANCELLED'],
  });

// ============================================================================
// PO Amendment State Machine
// ============================================================================

/**
 * PO Amendment workflow states:
 *
 * DRAFT -> PENDING_APPROVAL -> APPROVED (applied to PO)
 *                          \-> REJECTED
 *
 * APPROVED and REJECTED are terminal — a rejected amendment is re-raised as a
 * new amendment rather than re-opened.
 */
export const amendmentStateMachine: StateMachine<AmendmentStatus> =
  createStateMachine<AmendmentStatus>({
    transitions: {
      DRAFT: ['PENDING_APPROVAL'],
      PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
      APPROVED: [], // Terminal — changes applied to the PO
      REJECTED: [], // Terminal — raise a new amendment instead
    },
    transitionPermissions: {
      PENDING_APPROVAL_APPROVED: PERMISSION_FLAGS.MANAGE_PROCUREMENT,
      PENDING_APPROVAL_REJECTED: PERMISSION_FLAGS.MANAGE_PROCUREMENT,
    },
    terminalStates: ['APPROVED', 'REJECTED'],
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
    PENDING_APPROVAL_APPROVED: PERMISSION_FLAGS.MANAGE_PROPOSALS,
    PENDING_APPROVAL_DRAFT: PERMISSION_FLAGS.MANAGE_PROPOSALS, // Return for revision
  },
  terminalStates: ['ACCEPTED', 'EXPIRED', 'REJECTED'],
});

// ============================================================================
// Project Charter Approval State Machine
// ============================================================================

/**
 * Project charter authorization workflow (charter.authorization.approvalStatus):
 *
 * DRAFT -> PENDING_APPROVAL -> APPROVED
 *                          \-> DRAFT (rejected — returned for revision with a reason)
 *
 * APPROVED is terminal: the onCharterApproved Cloud Function auto-drafts PRs
 * and the client creates the project cost centre on the transition TO
 * APPROVED, so an approved charter is never reopened.
 */
export const charterApprovalStateMachine: StateMachine<CharterApprovalStatus> = createStateMachine({
  transitions: {
    DRAFT: ['PENDING_APPROVAL'],
    PENDING_APPROVAL: ['APPROVED', 'DRAFT'], // DRAFT = rejection / return for revision
    APPROVED: [], // Terminal
  },
  transitionPermissions: {
    DRAFT_PENDING_APPROVAL: PERMISSION_FLAGS.MANAGE_PROJECTS,
    PENDING_APPROVAL_APPROVED: PERMISSION_FLAGS.MANAGE_PROJECTS,
    PENDING_APPROVAL_DRAFT: PERMISSION_FLAGS.MANAGE_PROJECTS,
  },
  terminalStates: ['APPROVED'],
});

// ============================================================================
// Order Acceptance State Machine
// ============================================================================

/**
 * Order Acceptance workflow (charter.orderAcceptance.status):
 *
 * DRAFT -> PENDING_APPROVAL -> APPROVED (terms applied to charter)
 *                          \-> REJECTED -> DRAFT (reopened for revision)
 *
 * Unlike the charter authorization machine above, rejection lands on a
 * distinct REJECTED state (not DRAFT directly) so the rejection reason
 * persists until someone explicitly reopens it — see
 * apps/web/src/lib/projects/orderAcceptanceService.ts `reopenOrderAcceptance`.
 * APPROVED is terminal: approval is the one-shot "apply to charter" step.
 */
export const orderAcceptanceStateMachine: StateMachine<OrderAcceptanceStatus> = createStateMachine({
  transitions: {
    DRAFT: ['PENDING_APPROVAL'],
    PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
    APPROVED: [], // Terminal — terms applied to the charter
    REJECTED: ['DRAFT'], // Reopened for revision
  },
  transitionPermissions: {
    DRAFT_PENDING_APPROVAL: PERMISSION_FLAGS.MANAGE_PROJECTS,
    PENDING_APPROVAL_APPROVED: PERMISSION_FLAGS.MANAGE_PROJECTS,
    PENDING_APPROVAL_REJECTED: PERMISSION_FLAGS.MANAGE_PROJECTS,
    REJECTED_DRAFT: PERMISSION_FLAGS.MANAGE_PROJECTS,
  },
  terminalStates: ['APPROVED'],
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
    DRAFT: ['UPLOADED', 'REJECTED', 'WITHDRAWN'],
    UPLOADED: ['UNDER_REVIEW', 'EVALUATED', 'SELECTED', 'REJECTED', 'WITHDRAWN'],
    UNDER_REVIEW: ['EVALUATED', 'SELECTED', 'REJECTED', 'WITHDRAWN'],
    EVALUATED: ['SELECTED', 'REJECTED', 'WITHDRAWN'],
    SELECTED: ['PO_CREATED'], // PO creation transitions to PO_CREATED
    PO_CREATED: ['ARCHIVED'],
    REJECTED: ['ARCHIVED'],
    WITHDRAWN: ['ARCHIVED'],
    ARCHIVED: [],
  },
  terminalStates: ['ARCHIVED'],
};
export const offerStateMachine: StateMachine<OfferStatus> = createStateMachine(offerConfig);

// ============================================================================
// RFQ State Machine
// ============================================================================

/**
 * RFQ workflow states:
 *
 * DRAFT -> ISSUED -> OFFERS_RECEIVED -> UNDER_EVALUATION -> COMPLETED -> PO_PROCESSED
 *
 * CANCELLED is reachable from DRAFT, ISSUED, OFFERS_RECEIVED, UNDER_EVALUATION
 * PO_PROCESSED is set automatically when a PO is created from an offer
 */
const rfqConfig: StateTransitionConfig<RFQStatus> = {
  transitions: {
    DRAFT: ['ISSUED', 'CANCELLED'],
    ISSUED: ['OFFERS_RECEIVED', 'CANCELLED'],
    OFFERS_RECEIVED: ['UNDER_EVALUATION', 'COMPLETED', 'PO_PROCESSED', 'CANCELLED'],
    UNDER_EVALUATION: ['COMPLETED', 'PO_PROCESSED', 'CANCELLED'],
    COMPLETED: ['PO_PROCESSED'], // Auto-transition when PO is created
    PO_PROCESSED: [], // Terminal
    CANCELLED: [], // Terminal
  },
  transitionPermissions: {
    DRAFT_ISSUED: PERMISSION_FLAGS.MANAGE_PROCUREMENT,
  },
  terminalStates: ['PO_PROCESSED', 'CANCELLED'],
};
export const rfqStateMachine: StateMachine<RFQStatus> = createStateMachine(rfqConfig);

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
    UNDER_REVIEW_APPROVED: PERMISSION_FLAGS.MANAGE_PROCUREMENT,
    UNDER_REVIEW_REJECTED: PERMISSION_FLAGS.MANAGE_PROCUREMENT,
    SUBMITTED_APPROVED: PERMISSION_FLAGS.MANAGE_PROCUREMENT,
    SUBMITTED_REJECTED: PERMISSION_FLAGS.MANAGE_PROCUREMENT,
  },
  terminalStates: ['CONVERTED_TO_RFQ'],
};
export const purchaseRequestStateMachine: StateMachine<PurchaseRequestStatus> =
  createStateMachine(prConfig);

// ============================================================================
// Payment Batch State Machine
// ============================================================================

/**
 * Payment Batch workflow states:
 *
 * DRAFT -> PENDING_APPROVAL -> APPROVED -> EXECUTING -> COMPLETED
 *                          \-> REJECTED -> DRAFT (re-submit) or CANCELLED
 *
 * CANCELLED is reachable from DRAFT, REJECTED
 */
const pbConfig: StateTransitionConfig<PaymentBatchStatus> = {
  transitions: {
    DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
    PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
    APPROVED: ['EXECUTING'],
    EXECUTING: ['COMPLETED'],
    REJECTED: ['DRAFT', 'CANCELLED'],
    COMPLETED: [], // Terminal
    CANCELLED: [], // Terminal
  },
  transitionPermissions: {
    PENDING_APPROVAL_APPROVED: PERMISSION_FLAGS.MANAGE_ACCOUNTING,
    PENDING_APPROVAL_REJECTED: PERMISSION_FLAGS.MANAGE_ACCOUNTING,
  },
  terminalStates: ['COMPLETED', 'CANCELLED'],
};
export const paymentBatchStateMachine: StateMachine<PaymentBatchStatus> =
  createStateMachine(pbConfig);

// ============================================================================
// Travel Expense State Machine
// ============================================================================

/**
 * Travel Expense Report workflow states:
 *
 * DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED -> REIMBURSED
 *                   \-> APPROVED (direct)
 *                   \-> REJECTED -> DRAFT (re-edit and resubmit)
 */
const teConfig: StateTransitionConfig<TravelExpenseStatus> = {
  transitions: {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['UNDER_REVIEW', 'APPROVED', 'REJECTED'],
    UNDER_REVIEW: ['APPROVED', 'REJECTED'],
    APPROVED: ['REIMBURSED'],
    REJECTED: ['DRAFT'], // Allow re-edit and resubmission
    REIMBURSED: [], // Terminal
  },
  terminalStates: ['REIMBURSED'],
};
export const travelExpenseStateMachine: StateMachine<TravelExpenseStatus> =
  createStateMachine(teConfig);

// ============================================================================
// Fixed Asset State Machine
// ============================================================================

/**
 * Fixed Asset lifecycle states:
 *
 * ACTIVE -> DISPOSED (sale/transfer)
 * ACTIVE -> WRITTEN_OFF (damage/loss/obsolescence)
 */
const faConfig: StateTransitionConfig<AssetStatus> = {
  transitions: {
    ACTIVE: ['DISPOSED', 'WRITTEN_OFF'],
    DISPOSED: [], // Terminal
    WRITTEN_OFF: [], // Terminal
  },
  transitionPermissions: {
    ACTIVE_DISPOSED: PERMISSION_FLAGS.MANAGE_ACCOUNTING,
    ACTIVE_WRITTEN_OFF: PERMISSION_FLAGS.MANAGE_ACCOUNTING,
  },
  terminalStates: ['DISPOSED', 'WRITTEN_OFF'],
};
export const fixedAssetStateMachine: StateMachine<AssetStatus> = createStateMachine(faConfig);

// ============================================================================
// Master Document State Machine
// ============================================================================

/**
 * Master Document workflow states:
 *
 * DRAFT -> IN_PROGRESS -> SUBMITTED -> UNDER_REVIEW -> APPROVED -> ACCEPTED
 *                                                  \-> IN_PROGRESS (comments)
 * ON_HOLD is reachable from DRAFT, IN_PROGRESS, SUBMITTED, UNDER_REVIEW
 * CANCELLED is reachable from DRAFT, IN_PROGRESS, ON_HOLD
 */
const mdConfig: StateTransitionConfig<MasterDocumentStatus> = {
  transitions: {
    DRAFT: ['IN_PROGRESS', 'ON_HOLD', 'CANCELLED'],
    IN_PROGRESS: ['SUBMITTED', 'ON_HOLD', 'CANCELLED'],
    SUBMITTED: ['UNDER_REVIEW', 'IN_PROGRESS'],
    UNDER_REVIEW: ['APPROVED', 'IN_PROGRESS', 'ON_HOLD'],
    APPROVED: ['ACCEPTED', 'UNDER_REVIEW'],
    ACCEPTED: [], // Terminal
    ON_HOLD: ['DRAFT', 'IN_PROGRESS', 'CANCELLED'],
    CANCELLED: [], // Terminal
  },
  transitionPermissions: {
    UNDER_REVIEW_APPROVED: PERMISSION_FLAGS.MANAGE_DOCUMENTS,
    APPROVED_ACCEPTED: PERMISSION_FLAGS.MANAGE_DOCUMENTS,
  },
  terminalStates: ['ACCEPTED', 'CANCELLED'],
};
export const masterDocumentStateMachine: StateMachine<MasterDocumentStatus> =
  createStateMachine(mdConfig);

// ============================================================================
// Agent Run State Machine
// (AI-AGENT-ROADMAP-2026-04-25.md Phase 0 — Memory store)
// ============================================================================

/**
 * Agent run lifecycle:
 *
 * PENDING ──► RUNNING ──► AWAITING_HITL ──► RUNNING ──► COMPLETED
 *                  │            │                  ╲
 *                  │            └─► CANCELLED       └─► FAILED
 *                  └─► FAILED, CANCELLED
 *
 * - PENDING       — queued; orchestrator hasn't picked it up
 * - RUNNING       — actively executing tools
 * - AWAITING_HITL — paused for a human approval request
 * - COMPLETED     — terminal: succeeded
 * - FAILED        — terminal: hit an unrecoverable error
 * - CANCELLED     — terminal: HITL rejection or explicit abort
 */
const agentRunConfig: StateTransitionConfig<AgentRunStatus> = {
  transitions: {
    PENDING: ['RUNNING', 'CANCELLED'],
    RUNNING: ['AWAITING_HITL', 'COMPLETED', 'FAILED', 'CANCELLED'],
    AWAITING_HITL: ['RUNNING', 'CANCELLED', 'FAILED'],
    COMPLETED: [], // Terminal
    FAILED: [], // Terminal
    CANCELLED: [], // Terminal
  },
  terminalStates: ['COMPLETED', 'FAILED', 'CANCELLED'],
};
export const agentRunStateMachine: StateMachine<AgentRunStatus> =
  createStateMachine(agentRunConfig);

// ============================================================================
// Agent Task (HITL) State Machine
// (AI-AGENT-ROADMAP-2026-04-25.md Phase 0 — HITL infrastructure)
// ============================================================================

/**
 * Lifecycle of an HITL approval request:
 *
 *   PENDING ──► APPROVED  (human said yes)
 *           ├─► REJECTED  (human said no)
 *           ├─► EXPIRED   (TTL elapsed without a decision)
 *           └─► CANCELLED (orchestrator pulled the request)
 *
 * All non-PENDING states are terminal — agentTasks rows are append-only
 * once decided.
 */
const agentTaskConfig: StateTransitionConfig<AgentTaskStatus> = {
  transitions: {
    PENDING: ['APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'],
    APPROVED: [],
    REJECTED: [],
    EXPIRED: [],
    CANCELLED: [],
  },
  terminalStates: ['APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'],
};
export const agentTaskStateMachine: StateMachine<AgentTaskStatus> =
  createStateMachine(agentTaskConfig);

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
    // Master Document
    ON_HOLD: 'Put On Hold',
    // Fixed Asset
    DISPOSED: 'Dispose Asset',
    WRITTEN_OFF: 'Write Off',
    // RFQ (ISSUED already covered above)
    OFFERS_RECEIVED: 'Offers Received',
    UNDER_EVALUATION: 'Under Evaluation',
    PO_PROCESSED: 'PO Processed',
    // GR
    PENDING: 'Pending',
    ISSUES_FOUND: 'Report Issues',
    // Packing List
    DRAFT: 'Draft',
    FINALIZED: 'Finalize',
    SHIPPED: 'Ship',
    // PR
    CONVERTED_TO_RFQ: 'Convert to RFQ',
    // Service Order
    SAMPLE_SENT: 'Mark Sample Sent',
    RESULTS_RECEIVED: 'Results Received',
  };

  return transitions.reduce(
    (acc, status) => {
      acc[status] = labels[status] || status;
      return acc;
    },
    {} as Record<string, string>
  );
}
