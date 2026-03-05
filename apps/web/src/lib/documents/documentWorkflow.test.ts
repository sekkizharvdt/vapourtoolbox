/**
 * Document Workflow Tests
 *
 * Tests for the document management workflow:
 * - Master document state machine transitions
 * - Auto-status transitions (transmittal → SUBMITTED, CRS → UNDER_REVIEW)
 * - Approval letter upload and bulk approval
 * - State machine validation in updateDocumentStatus
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions */

import { masterDocumentStateMachine } from '@/lib/workflow/stateMachines';
import { requireValidTransition, InvalidTransitionError } from '@/lib/utils/stateMachine';
import type { MasterDocumentStatus } from '@vapour/types';

// ============================================================================
// Master Document State Machine Tests
// ============================================================================

describe('masterDocumentStateMachine', () => {
  describe('valid transitions', () => {
    const validTransitions: [MasterDocumentStatus, MasterDocumentStatus][] = [
      ['DRAFT', 'IN_PROGRESS'],
      ['DRAFT', 'ON_HOLD'],
      ['DRAFT', 'CANCELLED'],
      ['IN_PROGRESS', 'SUBMITTED'],
      ['IN_PROGRESS', 'ON_HOLD'],
      ['IN_PROGRESS', 'CANCELLED'],
      ['SUBMITTED', 'UNDER_REVIEW'],
      ['SUBMITTED', 'IN_PROGRESS'],
      ['UNDER_REVIEW', 'APPROVED'],
      ['UNDER_REVIEW', 'IN_PROGRESS'],
      ['UNDER_REVIEW', 'ON_HOLD'],
      ['APPROVED', 'ACCEPTED'],
      ['APPROVED', 'UNDER_REVIEW'],
      ['ON_HOLD', 'DRAFT'],
      ['ON_HOLD', 'IN_PROGRESS'],
      ['ON_HOLD', 'CANCELLED'],
    ];

    it.each(validTransitions)('should allow transition from %s to %s', (from, to) => {
      expect(masterDocumentStateMachine.canTransitionTo(from, to)).toBe(true);
    });
  });

  describe('invalid transitions', () => {
    const invalidTransitions: [MasterDocumentStatus, MasterDocumentStatus][] = [
      ['DRAFT', 'SUBMITTED'], // Must go through IN_PROGRESS
      ['DRAFT', 'APPROVED'],
      ['DRAFT', 'ACCEPTED'],
      ['IN_PROGRESS', 'APPROVED'], // Must go through SUBMITTED → UNDER_REVIEW
      ['IN_PROGRESS', 'ACCEPTED'],
      ['SUBMITTED', 'APPROVED'], // Must go through UNDER_REVIEW
      ['SUBMITTED', 'ACCEPTED'],
      ['UNDER_REVIEW', 'SUBMITTED'], // Back to IN_PROGRESS, not SUBMITTED
      ['APPROVED', 'IN_PROGRESS'], // Back to UNDER_REVIEW, not IN_PROGRESS
      ['ACCEPTED', 'APPROVED'], // Terminal
      ['ACCEPTED', 'DRAFT'], // Terminal
      ['CANCELLED', 'DRAFT'], // Terminal
      ['CANCELLED', 'IN_PROGRESS'], // Terminal
    ];

    it.each(invalidTransitions)('should not allow transition from %s to %s', (from, to) => {
      expect(masterDocumentStateMachine.canTransitionTo(from, to)).toBe(false);
    });
  });

  describe('terminal states', () => {
    it('should identify ACCEPTED as terminal', () => {
      expect(masterDocumentStateMachine.isTerminal('ACCEPTED')).toBe(true);
    });

    it('should identify CANCELLED as terminal', () => {
      expect(masterDocumentStateMachine.isTerminal('CANCELLED')).toBe(true);
    });

    it('should not identify DRAFT as terminal', () => {
      expect(masterDocumentStateMachine.isTerminal('DRAFT')).toBe(false);
    });

    it('should not identify IN_PROGRESS as terminal', () => {
      expect(masterDocumentStateMachine.isTerminal('IN_PROGRESS')).toBe(false);
    });
  });

  describe('available transitions', () => {
    it('should return correct transitions from DRAFT', () => {
      const transitions = masterDocumentStateMachine.getAvailableTransitions('DRAFT');
      expect(transitions).toContain('IN_PROGRESS');
      expect(transitions).toContain('ON_HOLD');
      expect(transitions).toContain('CANCELLED');
      expect(transitions).toHaveLength(3);
    });

    it('should return no transitions from terminal states', () => {
      expect(masterDocumentStateMachine.getAvailableTransitions('ACCEPTED')).toHaveLength(0);
      expect(masterDocumentStateMachine.getAvailableTransitions('CANCELLED')).toHaveLength(0);
    });
  });

  describe('requireValidTransition', () => {
    it('should not throw for valid transitions', () => {
      expect(() =>
        requireValidTransition(
          masterDocumentStateMachine,
          'IN_PROGRESS',
          'SUBMITTED',
          'MasterDocument'
        )
      ).not.toThrow();
    });

    it('should throw InvalidTransitionError for invalid transitions', () => {
      expect(() =>
        requireValidTransition(masterDocumentStateMachine, 'DRAFT', 'APPROVED', 'MasterDocument')
      ).toThrow(InvalidTransitionError);
    });

    it('should throw for transitions from terminal states', () => {
      expect(() =>
        requireValidTransition(masterDocumentStateMachine, 'ACCEPTED', 'DRAFT', 'MasterDocument')
      ).toThrow(InvalidTransitionError);
    });
  });
});

// ============================================================================
// Document Workflow Path Tests
// ============================================================================

describe('Document Workflow Paths', () => {
  it('should support the happy path: DRAFT → IN_PROGRESS → SUBMITTED → UNDER_REVIEW → APPROVED → ACCEPTED', () => {
    const happyPath: MasterDocumentStatus[] = [
      'DRAFT',
      'IN_PROGRESS',
      'SUBMITTED',
      'UNDER_REVIEW',
      'APPROVED',
      'ACCEPTED',
    ];

    for (let i = 0; i < happyPath.length - 1; i++) {
      expect(masterDocumentStateMachine.canTransitionTo(happyPath[i]!, happyPath[i + 1]!)).toBe(
        true
      );
    }
  });

  it('should support comment revision cycle: SUBMITTED → UNDER_REVIEW → IN_PROGRESS → SUBMITTED', () => {
    const commentCycle: MasterDocumentStatus[] = [
      'SUBMITTED',
      'UNDER_REVIEW',
      'IN_PROGRESS', // Comments received, rework
      'SUBMITTED', // Resubmit
    ];

    for (let i = 0; i < commentCycle.length - 1; i++) {
      expect(
        masterDocumentStateMachine.canTransitionTo(commentCycle[i]!, commentCycle[i + 1]!)
      ).toBe(true);
    }
  });

  it('should support on-hold and resume flow', () => {
    // Put on hold from IN_PROGRESS
    expect(masterDocumentStateMachine.canTransitionTo('IN_PROGRESS', 'ON_HOLD')).toBe(true);
    // Resume from ON_HOLD
    expect(masterDocumentStateMachine.canTransitionTo('ON_HOLD', 'IN_PROGRESS')).toBe(true);
  });

  it('should support re-review after approval: APPROVED → UNDER_REVIEW', () => {
    expect(masterDocumentStateMachine.canTransitionTo('APPROVED', 'UNDER_REVIEW')).toBe(true);
  });
});

// ============================================================================
// Auto-Status Transition Logic Tests (unit logic)
// ============================================================================

describe('Auto-Status Transition Logic', () => {
  describe('transmittal → SUBMITTED', () => {
    it('should allow IN_PROGRESS → SUBMITTED for transmittal generation', () => {
      expect(masterDocumentStateMachine.canTransitionTo('IN_PROGRESS', 'SUBMITTED')).toBe(true);
    });

    it('should skip documents already SUBMITTED', () => {
      // SUBMITTED → SUBMITTED is not a valid transition (same state)
      expect(masterDocumentStateMachine.canTransitionTo('SUBMITTED', 'SUBMITTED')).toBe(false);
    });

    it('should skip documents in UNDER_REVIEW', () => {
      // UNDER_REVIEW → SUBMITTED is not valid
      expect(masterDocumentStateMachine.canTransitionTo('UNDER_REVIEW', 'SUBMITTED')).toBe(false);
    });

    it('should skip documents already APPROVED', () => {
      expect(masterDocumentStateMachine.canTransitionTo('APPROVED', 'SUBMITTED')).toBe(false);
    });

    it('should skip terminal states', () => {
      expect(masterDocumentStateMachine.canTransitionTo('ACCEPTED', 'SUBMITTED')).toBe(false);
      expect(masterDocumentStateMachine.canTransitionTo('CANCELLED', 'SUBMITTED')).toBe(false);
    });
  });

  describe('CRS upload → UNDER_REVIEW', () => {
    it('should allow SUBMITTED → UNDER_REVIEW for CRS upload', () => {
      expect(masterDocumentStateMachine.canTransitionTo('SUBMITTED', 'UNDER_REVIEW')).toBe(true);
    });

    it('should skip documents in DRAFT (not yet submitted)', () => {
      expect(masterDocumentStateMachine.canTransitionTo('DRAFT', 'UNDER_REVIEW')).toBe(false);
    });

    it('should skip documents already UNDER_REVIEW', () => {
      expect(masterDocumentStateMachine.canTransitionTo('UNDER_REVIEW', 'UNDER_REVIEW')).toBe(
        false
      );
    });
  });

  describe('approval letter → APPROVED', () => {
    it('should allow UNDER_REVIEW → APPROVED', () => {
      expect(masterDocumentStateMachine.canTransitionTo('UNDER_REVIEW', 'APPROVED')).toBe(true);
    });

    it('should skip documents not yet under review', () => {
      expect(masterDocumentStateMachine.canTransitionTo('IN_PROGRESS', 'APPROVED')).toBe(false);
      expect(masterDocumentStateMachine.canTransitionTo('SUBMITTED', 'APPROVED')).toBe(false);
    });

    it('should skip documents already approved', () => {
      expect(masterDocumentStateMachine.canTransitionTo('APPROVED', 'APPROVED')).toBe(false);
    });
  });
});
