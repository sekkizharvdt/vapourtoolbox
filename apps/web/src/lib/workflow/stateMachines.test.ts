/**
 * Entity State Machines Tests
 *
 * Tests for workflow state machine definitions.
 */

import {
  purchaseOrderStateMachine,
  proposalStateMachine,
  goodsReceiptStateMachine,
  offerStateMachine,
  packingListStateMachine,
  purchaseRequestStateMachine,
  isTerminalStatus,
  getTransitionLabels,
} from './stateMachines';
import { PermissionFlag } from '@vapour/types';

describe('purchaseOrderStateMachine', () => {
  describe('valid transitions', () => {
    it('should allow DRAFT -> PENDING_APPROVAL', () => {
      expect(purchaseOrderStateMachine.canTransitionTo('DRAFT', 'PENDING_APPROVAL')).toBe(true);
    });

    it('should allow PENDING_APPROVAL -> APPROVED', () => {
      expect(purchaseOrderStateMachine.canTransitionTo('PENDING_APPROVAL', 'APPROVED')).toBe(true);
    });

    it('should allow PENDING_APPROVAL -> REJECTED', () => {
      expect(purchaseOrderStateMachine.canTransitionTo('PENDING_APPROVAL', 'REJECTED')).toBe(true);
    });

    it('should allow REJECTED -> DRAFT for revision', () => {
      expect(purchaseOrderStateMachine.canTransitionTo('REJECTED', 'DRAFT')).toBe(true);
    });

    it('should allow APPROVED -> ISSUED', () => {
      expect(purchaseOrderStateMachine.canTransitionTo('APPROVED', 'ISSUED')).toBe(true);
    });

    it('should allow ISSUED -> ACKNOWLEDGED', () => {
      expect(purchaseOrderStateMachine.canTransitionTo('ISSUED', 'ACKNOWLEDGED')).toBe(true);
    });

    it('should allow IN_PROGRESS -> COMPLETED', () => {
      expect(purchaseOrderStateMachine.canTransitionTo('IN_PROGRESS', 'COMPLETED')).toBe(true);
    });

    it('should allow cancellation from multiple states', () => {
      expect(purchaseOrderStateMachine.canTransitionTo('DRAFT', 'CANCELLED')).toBe(true);
      expect(purchaseOrderStateMachine.canTransitionTo('PENDING_APPROVAL', 'CANCELLED')).toBe(true);
      expect(purchaseOrderStateMachine.canTransitionTo('APPROVED', 'CANCELLED')).toBe(true);
      expect(purchaseOrderStateMachine.canTransitionTo('ISSUED', 'CANCELLED')).toBe(true);
    });

    it('should allow amendments from issued states', () => {
      expect(purchaseOrderStateMachine.canTransitionTo('ISSUED', 'AMENDED')).toBe(true);
      expect(purchaseOrderStateMachine.canTransitionTo('ACKNOWLEDGED', 'AMENDED')).toBe(true);
      expect(purchaseOrderStateMachine.canTransitionTo('IN_PROGRESS', 'AMENDED')).toBe(true);
    });
  });

  describe('invalid transitions', () => {
    it('should not allow skipping approval', () => {
      expect(purchaseOrderStateMachine.canTransitionTo('DRAFT', 'APPROVED')).toBe(false);
      expect(purchaseOrderStateMachine.canTransitionTo('DRAFT', 'ISSUED')).toBe(false);
    });

    it('should not allow transitions from terminal states', () => {
      expect(purchaseOrderStateMachine.canTransitionTo('COMPLETED', 'DRAFT')).toBe(false);
      expect(purchaseOrderStateMachine.canTransitionTo('CANCELLED', 'DRAFT')).toBe(false);
    });

    it('should not allow backwards transitions', () => {
      expect(purchaseOrderStateMachine.canTransitionTo('APPROVED', 'PENDING_APPROVAL')).toBe(false);
      expect(purchaseOrderStateMachine.canTransitionTo('ISSUED', 'APPROVED')).toBe(false);
    });
  });

  describe('terminal states', () => {
    it('should identify COMPLETED as terminal', () => {
      expect(purchaseOrderStateMachine.isTerminal('COMPLETED')).toBe(true);
    });

    it('should identify CANCELLED as terminal', () => {
      expect(purchaseOrderStateMachine.isTerminal('CANCELLED')).toBe(true);
    });

    it('should not identify working states as terminal', () => {
      expect(purchaseOrderStateMachine.isTerminal('DRAFT')).toBe(false);
      expect(purchaseOrderStateMachine.isTerminal('IN_PROGRESS')).toBe(false);
    });
  });

  describe('permissions', () => {
    it('should require APPROVE_PO for approval', () => {
      expect(purchaseOrderStateMachine.getRequiredPermission('PENDING_APPROVAL', 'APPROVED')).toBe(
        PermissionFlag.APPROVE_PO
      );
    });

    it('should require APPROVE_PO for rejection', () => {
      expect(purchaseOrderStateMachine.getRequiredPermission('PENDING_APPROVAL', 'REJECTED')).toBe(
        PermissionFlag.APPROVE_PO
      );
    });
  });
});

describe('proposalStateMachine', () => {
  describe('valid transitions', () => {
    it('should allow DRAFT -> PENDING_APPROVAL', () => {
      expect(proposalStateMachine.canTransitionTo('DRAFT', 'PENDING_APPROVAL')).toBe(true);
    });

    it('should allow PENDING_APPROVAL -> APPROVED', () => {
      expect(proposalStateMachine.canTransitionTo('PENDING_APPROVAL', 'APPROVED')).toBe(true);
    });

    it('should allow PENDING_APPROVAL -> DRAFT for revision', () => {
      expect(proposalStateMachine.canTransitionTo('PENDING_APPROVAL', 'DRAFT')).toBe(true);
    });

    it('should allow APPROVED -> SUBMITTED', () => {
      expect(proposalStateMachine.canTransitionTo('APPROVED', 'SUBMITTED')).toBe(true);
    });

    it('should allow SUBMITTED -> ACCEPTED', () => {
      expect(proposalStateMachine.canTransitionTo('SUBMITTED', 'ACCEPTED')).toBe(true);
    });

    it('should allow SUBMITTED -> EXPIRED', () => {
      expect(proposalStateMachine.canTransitionTo('SUBMITTED', 'EXPIRED')).toBe(true);
    });

    it('should allow negotiation flow', () => {
      expect(proposalStateMachine.canTransitionTo('SUBMITTED', 'UNDER_NEGOTIATION')).toBe(true);
      expect(proposalStateMachine.canTransitionTo('UNDER_NEGOTIATION', 'ACCEPTED')).toBe(true);
    });
  });

  describe('terminal states', () => {
    it('should identify ACCEPTED as terminal', () => {
      expect(proposalStateMachine.isTerminal('ACCEPTED')).toBe(true);
    });

    it('should identify EXPIRED as terminal', () => {
      expect(proposalStateMachine.isTerminal('EXPIRED')).toBe(true);
    });

    it('should identify REJECTED as terminal', () => {
      expect(proposalStateMachine.isTerminal('REJECTED')).toBe(true);
    });
  });

  describe('permissions', () => {
    it('should require APPROVE_ESTIMATES for approval', () => {
      expect(proposalStateMachine.getRequiredPermission('PENDING_APPROVAL', 'APPROVED')).toBe(
        PermissionFlag.APPROVE_ESTIMATES
      );
    });
  });
});

describe('goodsReceiptStateMachine', () => {
  describe('valid transitions', () => {
    it('should allow PENDING -> IN_PROGRESS', () => {
      expect(goodsReceiptStateMachine.canTransitionTo('PENDING', 'IN_PROGRESS')).toBe(true);
    });

    it('should allow IN_PROGRESS -> COMPLETED', () => {
      expect(goodsReceiptStateMachine.canTransitionTo('IN_PROGRESS', 'COMPLETED')).toBe(true);
    });

    it('should allow IN_PROGRESS -> ISSUES_FOUND', () => {
      expect(goodsReceiptStateMachine.canTransitionTo('IN_PROGRESS', 'ISSUES_FOUND')).toBe(true);
    });

    it('should allow retry after issues found', () => {
      expect(goodsReceiptStateMachine.canTransitionTo('ISSUES_FOUND', 'IN_PROGRESS')).toBe(true);
      expect(goodsReceiptStateMachine.canTransitionTo('ISSUES_FOUND', 'COMPLETED')).toBe(true);
    });
  });

  describe('terminal states', () => {
    it('should identify COMPLETED as terminal', () => {
      expect(goodsReceiptStateMachine.isTerminal('COMPLETED')).toBe(true);
    });

    it('should not identify ISSUES_FOUND as terminal', () => {
      expect(goodsReceiptStateMachine.isTerminal('ISSUES_FOUND')).toBe(false);
    });
  });
});

describe('offerStateMachine', () => {
  describe('valid transitions', () => {
    it('should allow UPLOADED -> UNDER_REVIEW', () => {
      expect(offerStateMachine.canTransitionTo('UPLOADED', 'UNDER_REVIEW')).toBe(true);
    });

    it('should allow UNDER_REVIEW -> EVALUATED', () => {
      expect(offerStateMachine.canTransitionTo('UNDER_REVIEW', 'EVALUATED')).toBe(true);
    });

    it('should allow EVALUATED -> SELECTED', () => {
      expect(offerStateMachine.canTransitionTo('EVALUATED', 'SELECTED')).toBe(true);
    });

    it('should allow EVALUATED -> REJECTED', () => {
      expect(offerStateMachine.canTransitionTo('EVALUATED', 'REJECTED')).toBe(true);
    });

    it('should allow withdrawal from any non-terminal state', () => {
      expect(offerStateMachine.canTransitionTo('UPLOADED', 'WITHDRAWN')).toBe(true);
      expect(offerStateMachine.canTransitionTo('UNDER_REVIEW', 'WITHDRAWN')).toBe(true);
      expect(offerStateMachine.canTransitionTo('EVALUATED', 'WITHDRAWN')).toBe(true);
    });
  });

  describe('terminal states', () => {
    it('should identify all final states as terminal', () => {
      expect(offerStateMachine.isTerminal('PO_CREATED')).toBe(true);
      expect(offerStateMachine.isTerminal('REJECTED')).toBe(true);
      expect(offerStateMachine.isTerminal('WITHDRAWN')).toBe(true);
    });

    it('should not consider SELECTED as terminal (can transition to PO_CREATED)', () => {
      expect(offerStateMachine.isTerminal('SELECTED')).toBe(false);
      expect(offerStateMachine.canTransitionTo('SELECTED', 'PO_CREATED')).toBe(true);
    });
  });
});

describe('packingListStateMachine', () => {
  describe('valid transitions', () => {
    it('should follow linear workflow', () => {
      expect(packingListStateMachine.canTransitionTo('DRAFT', 'FINALIZED')).toBe(true);
      expect(packingListStateMachine.canTransitionTo('FINALIZED', 'SHIPPED')).toBe(true);
      expect(packingListStateMachine.canTransitionTo('SHIPPED', 'DELIVERED')).toBe(true);
    });
  });

  describe('invalid transitions', () => {
    it('should not allow skipping steps', () => {
      expect(packingListStateMachine.canTransitionTo('DRAFT', 'SHIPPED')).toBe(false);
      expect(packingListStateMachine.canTransitionTo('FINALIZED', 'DELIVERED')).toBe(false);
    });

    it('should not allow backwards transitions', () => {
      expect(packingListStateMachine.canTransitionTo('SHIPPED', 'FINALIZED')).toBe(false);
      expect(packingListStateMachine.canTransitionTo('DELIVERED', 'SHIPPED')).toBe(false);
    });
  });

  describe('terminal states', () => {
    it('should identify DELIVERED as terminal', () => {
      expect(packingListStateMachine.isTerminal('DELIVERED')).toBe(true);
    });
  });
});

describe('purchaseRequestStateMachine', () => {
  describe('valid transitions', () => {
    it('should allow submission workflow', () => {
      expect(purchaseRequestStateMachine.canTransitionTo('DRAFT', 'SUBMITTED')).toBe(true);
      expect(purchaseRequestStateMachine.canTransitionTo('SUBMITTED', 'UNDER_REVIEW')).toBe(true);
      expect(purchaseRequestStateMachine.canTransitionTo('UNDER_REVIEW', 'APPROVED')).toBe(true);
    });

    it('should allow direct approval from submitted', () => {
      expect(purchaseRequestStateMachine.canTransitionTo('SUBMITTED', 'APPROVED')).toBe(true);
    });

    it('should allow conversion to RFQ', () => {
      expect(purchaseRequestStateMachine.canTransitionTo('APPROVED', 'CONVERTED_TO_RFQ')).toBe(
        true
      );
    });

    it('should allow revision after rejection', () => {
      expect(purchaseRequestStateMachine.canTransitionTo('REJECTED', 'DRAFT')).toBe(true);
    });
  });

  describe('terminal states', () => {
    it('should identify CONVERTED_TO_RFQ as terminal', () => {
      expect(purchaseRequestStateMachine.isTerminal('CONVERTED_TO_RFQ')).toBe(true);
    });
  });

  describe('permissions', () => {
    it('should require APPROVE_PR for approval transitions', () => {
      expect(purchaseRequestStateMachine.getRequiredPermission('UNDER_REVIEW', 'APPROVED')).toBe(
        PermissionFlag.APPROVE_PR
      );
      expect(purchaseRequestStateMachine.getRequiredPermission('SUBMITTED', 'APPROVED')).toBe(
        PermissionFlag.APPROVE_PR
      );
    });
  });
});

describe('isTerminalStatus', () => {
  it('should return true for terminal statuses', () => {
    expect(isTerminalStatus(purchaseOrderStateMachine, 'COMPLETED')).toBe(true);
    expect(isTerminalStatus(proposalStateMachine, 'ACCEPTED')).toBe(true);
    expect(isTerminalStatus(offerStateMachine, 'PO_CREATED')).toBe(true);
  });

  it('should return false for non-terminal statuses', () => {
    expect(isTerminalStatus(purchaseOrderStateMachine, 'DRAFT')).toBe(false);
    expect(isTerminalStatus(proposalStateMachine, 'SUBMITTED')).toBe(false);
    expect(isTerminalStatus(offerStateMachine, 'EVALUATED')).toBe(false);
  });
});

describe('getTransitionLabels', () => {
  it('should return labels for known transitions', () => {
    const labels = getTransitionLabels(['APPROVED', 'REJECTED', 'CANCELLED']);
    expect(labels['APPROVED']).toBe('Approve');
    expect(labels['REJECTED']).toBe('Reject');
    expect(labels['CANCELLED']).toBe('Cancel');
  });

  it('should return status as-is for unknown transitions', () => {
    const labels = getTransitionLabels(['UNKNOWN_STATUS']);
    expect(labels['UNKNOWN_STATUS']).toBe('UNKNOWN_STATUS');
  });

  it('should handle empty array', () => {
    const labels = getTransitionLabels([]);
    expect(labels).toEqual({});
  });

  it('should return all proposal labels', () => {
    const labels = getTransitionLabels(['SUBMITTED', 'UNDER_NEGOTIATION', 'ACCEPTED', 'EXPIRED']);
    expect(labels['SUBMITTED']).toBe('Submit to Client');
    expect(labels['UNDER_NEGOTIATION']).toBe('Under Negotiation');
    expect(labels['ACCEPTED']).toBe('Mark Accepted');
    expect(labels['EXPIRED']).toBe('Mark Expired');
  });

  it('should return all offer labels', () => {
    const labels = getTransitionLabels(['UPLOADED', 'UNDER_REVIEW', 'EVALUATED', 'SELECTED']);
    expect(labels['UPLOADED']).toBe('Upload');
    expect(labels['UNDER_REVIEW']).toBe('Start Review');
    expect(labels['EVALUATED']).toBe('Mark Evaluated');
    expect(labels['SELECTED']).toBe('Select Offer');
  });
});
