/**
 * State Machine Utility Tests
 */

import {
  createStateMachine,
  InvalidTransitionError,
  requireValidTransition,
  type StateTransitionConfig,
  type StateMachine,
} from './stateMachine';
import { PermissionFlag } from '@vapour/types';

// Test status type
type TestStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';

const testConfig: StateTransitionConfig<TestStatus> = {
  transitions: {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['APPROVED', 'REJECTED'],
    APPROVED: ['COMPLETED', 'CANCELLED'],
    REJECTED: ['DRAFT'],
    COMPLETED: [],
    CANCELLED: [],
  },
  transitionPermissions: {
    SUBMITTED_APPROVED: PermissionFlag.APPROVE_PR,
    SUBMITTED_REJECTED: PermissionFlag.APPROVE_PR,
  },
  terminalStates: ['COMPLETED', 'CANCELLED'],
};

describe('stateMachine', () => {
  let stateMachine: StateMachine<TestStatus>;

  beforeEach(() => {
    stateMachine = createStateMachine(testConfig);
  });

  describe('createStateMachine', () => {
    it('should create a state machine with all required methods', () => {
      expect(stateMachine).toHaveProperty('canTransitionTo');
      expect(stateMachine).toHaveProperty('validateTransition');
      expect(stateMachine).toHaveProperty('getAvailableTransitions');
      expect(stateMachine).toHaveProperty('getAvailableActions');
      expect(stateMachine).toHaveProperty('isTerminal');
      expect(stateMachine).toHaveProperty('getRequiredPermission');
    });
  });

  describe('canTransitionTo', () => {
    it('should return true for valid transitions', () => {
      expect(stateMachine.canTransitionTo('DRAFT', 'SUBMITTED')).toBe(true);
      expect(stateMachine.canTransitionTo('SUBMITTED', 'APPROVED')).toBe(true);
      expect(stateMachine.canTransitionTo('SUBMITTED', 'REJECTED')).toBe(true);
      expect(stateMachine.canTransitionTo('REJECTED', 'DRAFT')).toBe(true);
    });

    it('should return false for invalid transitions', () => {
      expect(stateMachine.canTransitionTo('DRAFT', 'APPROVED')).toBe(false);
      expect(stateMachine.canTransitionTo('DRAFT', 'COMPLETED')).toBe(false);
      expect(stateMachine.canTransitionTo('APPROVED', 'DRAFT')).toBe(false);
    });

    it('should return false for transitions from terminal states', () => {
      expect(stateMachine.canTransitionTo('COMPLETED', 'DRAFT')).toBe(false);
      expect(stateMachine.canTransitionTo('CANCELLED', 'DRAFT')).toBe(false);
    });

    it('should handle unknown statuses gracefully', () => {
      expect(stateMachine.canTransitionTo('UNKNOWN' as TestStatus, 'DRAFT')).toBe(false);
    });
  });

  describe('validateTransition', () => {
    it('should return allowed=true for valid transitions', () => {
      const result = stateMachine.validateTransition('DRAFT', 'SUBMITTED');
      expect(result.allowed).toBe(true);
      expect(result.fromStatus).toBe('DRAFT');
      expect(result.toStatus).toBe('SUBMITTED');
      expect(result.reason).toBeUndefined();
    });

    it('should return allowed=false with reason for invalid transitions', () => {
      const result = stateMachine.validateTransition('DRAFT', 'APPROVED');
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Cannot transition from DRAFT to APPROVED');
    });

    it('should return specific reason for terminal state transitions', () => {
      const result = stateMachine.validateTransition('COMPLETED', 'DRAFT');
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('terminal status');
    });

    it('should return specific reason for invalid target status', () => {
      const result = stateMachine.validateTransition('DRAFT', 'INVALID' as TestStatus);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not a valid status');
    });
  });

  describe('getAvailableTransitions', () => {
    it('should return all available transitions for a status', () => {
      expect(stateMachine.getAvailableTransitions('DRAFT')).toEqual(['SUBMITTED']);
      expect(stateMachine.getAvailableTransitions('SUBMITTED')).toEqual(['APPROVED', 'REJECTED']);
      expect(stateMachine.getAvailableTransitions('APPROVED')).toEqual(['COMPLETED', 'CANCELLED']);
    });

    it('should return empty array for terminal states', () => {
      expect(stateMachine.getAvailableTransitions('COMPLETED')).toEqual([]);
      expect(stateMachine.getAvailableTransitions('CANCELLED')).toEqual([]);
    });

    it('should return empty array for unknown statuses', () => {
      expect(stateMachine.getAvailableTransitions('UNKNOWN' as TestStatus)).toEqual([]);
    });
  });

  describe('getAvailableActions', () => {
    it('should return transitions and terminal status', () => {
      const actions = stateMachine.getAvailableActions('SUBMITTED');
      expect(actions.availableTransitions).toEqual(['APPROVED', 'REJECTED']);
      expect(actions.isTerminal).toBe(false);
    });

    it('should indicate terminal status correctly', () => {
      const actions = stateMachine.getAvailableActions('COMPLETED');
      expect(actions.availableTransitions).toEqual([]);
      expect(actions.isTerminal).toBe(true);
    });
  });

  describe('isTerminal', () => {
    it('should return true for explicit terminal states', () => {
      expect(stateMachine.isTerminal('COMPLETED')).toBe(true);
      expect(stateMachine.isTerminal('CANCELLED')).toBe(true);
    });

    it('should return false for non-terminal states', () => {
      expect(stateMachine.isTerminal('DRAFT')).toBe(false);
      expect(stateMachine.isTerminal('SUBMITTED')).toBe(false);
      expect(stateMachine.isTerminal('APPROVED')).toBe(false);
    });

    it('should return true for states with no outgoing transitions', () => {
      // Even if not in terminalStates, a state with no transitions is terminal
      const minimalMachine = createStateMachine<'A' | 'B'>({
        transitions: {
          A: ['B'],
          B: [],
        },
      });
      expect(minimalMachine.isTerminal('B')).toBe(true);
    });
  });

  describe('getRequiredPermission', () => {
    it('should return permission for protected transitions', () => {
      expect(stateMachine.getRequiredPermission('SUBMITTED', 'APPROVED')).toBe(
        PermissionFlag.APPROVE_PR
      );
      expect(stateMachine.getRequiredPermission('SUBMITTED', 'REJECTED')).toBe(
        PermissionFlag.APPROVE_PR
      );
    });

    it('should return undefined for unprotected transitions', () => {
      expect(stateMachine.getRequiredPermission('DRAFT', 'SUBMITTED')).toBeUndefined();
      expect(stateMachine.getRequiredPermission('REJECTED', 'DRAFT')).toBeUndefined();
    });

    it('should return undefined when no permissions are configured', () => {
      const noPerm = createStateMachine<'A' | 'B'>({
        transitions: { A: ['B'], B: [] },
      });
      expect(noPerm.getRequiredPermission('A', 'B')).toBeUndefined();
    });
  });
});

describe('InvalidTransitionError', () => {
  it('should create error with correct message', () => {
    const error = new InvalidTransitionError('DRAFT', 'APPROVED');
    expect(error.message).toBe('Cannot transition from DRAFT to APPROVED');
    expect(error.name).toBe('InvalidTransitionError');
    expect(error.fromStatus).toBe('DRAFT');
    expect(error.toStatus).toBe('APPROVED');
  });

  it('should include entity type in message when provided', () => {
    const error = new InvalidTransitionError('DRAFT', 'APPROVED', 'PurchaseOrder');
    expect(error.message).toBe('[PurchaseOrder] Cannot transition from DRAFT to APPROVED');
    expect(error.entityType).toBe('PurchaseOrder');
  });

  it('should be an instance of Error', () => {
    const error = new InvalidTransitionError('A', 'B');
    expect(error).toBeInstanceOf(Error);
  });
});

describe('requireValidTransition', () => {
  let stateMachine: StateMachine<TestStatus>;

  beforeEach(() => {
    stateMachine = createStateMachine(testConfig);
  });

  it('should not throw for valid transitions', () => {
    expect(() => {
      requireValidTransition(stateMachine, 'DRAFT', 'SUBMITTED');
    }).not.toThrow();
  });

  it('should throw InvalidTransitionError for invalid transitions', () => {
    expect(() => {
      requireValidTransition(stateMachine, 'DRAFT', 'APPROVED');
    }).toThrow(InvalidTransitionError);
  });

  it('should include entity type in error when provided', () => {
    try {
      requireValidTransition(stateMachine, 'DRAFT', 'APPROVED', 'TestEntity');
      fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidTransitionError);
      expect((error as InvalidTransitionError).entityType).toBe('TestEntity');
    }
  });
});

describe('edge cases', () => {
  it('should handle state machine with single state', () => {
    const single = createStateMachine<'ONLY'>({
      transitions: { ONLY: [] },
      terminalStates: ['ONLY'],
    });
    expect(single.isTerminal('ONLY')).toBe(true);
    expect(single.getAvailableTransitions('ONLY')).toEqual([]);
  });

  it('should handle circular transitions', () => {
    const circular = createStateMachine<'A' | 'B' | 'C'>({
      transitions: {
        A: ['B'],
        B: ['C'],
        C: ['A'],
      },
    });
    expect(circular.canTransitionTo('A', 'B')).toBe(true);
    expect(circular.canTransitionTo('B', 'C')).toBe(true);
    expect(circular.canTransitionTo('C', 'A')).toBe(true);
    // None are terminal since they all have outgoing transitions
    expect(circular.isTerminal('A')).toBe(false);
    expect(circular.isTerminal('B')).toBe(false);
    expect(circular.isTerminal('C')).toBe(false);
  });

  it('should handle self-transitions', () => {
    const selfLoop = createStateMachine<'STATE'>({
      transitions: { STATE: ['STATE'] },
    });
    expect(selfLoop.canTransitionTo('STATE', 'STATE')).toBe(true);
  });

  it('should handle multiple targets from one state', () => {
    const multi = createStateMachine<'START' | 'A' | 'B' | 'C' | 'D'>({
      transitions: {
        START: ['A', 'B', 'C', 'D'],
        A: [],
        B: [],
        C: [],
        D: [],
      },
    });
    expect(multi.getAvailableTransitions('START')).toHaveLength(4);
    expect(multi.canTransitionTo('START', 'A')).toBe(true);
    expect(multi.canTransitionTo('START', 'D')).toBe(true);
  });
});
