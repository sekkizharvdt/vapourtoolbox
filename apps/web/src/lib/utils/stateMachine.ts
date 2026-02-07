/**
 * State Machine Utility
 *
 * Generic state machine for workflow status transitions.
 * Provides validation and transition checking to ensure valid status flows.
 *
 * Usage:
 * 1. Define allowed transitions with StateTransitionConfig
 * 2. Create state machine with createStateMachine
 * 3. Use canTransitionTo and validateTransition in workflow functions
 *
 * @example
 * ```typescript
 * const poStateMachine = createStateMachine<POStatus>({
 *   transitions: {
 *     DRAFT: ['PENDING_APPROVAL'],
 *     PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
 *     APPROVED: ['ISSUED'],
 *     // ...
 *   },
 *   terminalStates: ['COMPLETED', 'CANCELLED'],
 * });
 *
 * // In workflow function:
 * const result = poStateMachine.validateTransition(po.status, 'APPROVED');
 * if (!result.allowed) {
 *   throw new Error(result.reason);
 * }
 * ```
 */

/**
 * Configuration for a state machine
 */
export interface StateTransitionConfig<TStatus extends string> {
  /** Map of allowed transitions from each status */
  transitions: Record<TStatus, TStatus[]>;

  /**
   * Optional permission required for specific transitions
   * Key format: "FROM_STATUS_TO_STATUS" (e.g., "PENDING_APPROVAL_APPROVED")
   * Values are permission flag numbers from PERMISSION_FLAGS constants
   */
  transitionPermissions?: Record<string, number>;

  /** Terminal states (no further transitions allowed) */
  terminalStates?: TStatus[];
}

/**
 * Result of a transition validation
 */
export interface StateTransitionResult<TStatus> {
  /** Whether the transition is allowed */
  allowed: boolean;
  /** Current status */
  fromStatus: TStatus;
  /** Target status */
  toStatus: TStatus;
  /** Reason if not allowed */
  reason?: string;
}

/**
 * Available actions based on current status
 */
export interface AvailableActions<TStatus> {
  /** Available target statuses */
  availableTransitions: TStatus[];
  /** Whether current status is terminal */
  isTerminal: boolean;
}

/**
 * State machine instance
 */
export interface StateMachine<TStatus extends string> {
  /**
   * Check if a transition is allowed
   */
  canTransitionTo(current: TStatus, target: TStatus): boolean;

  /**
   * Validate and describe a transition attempt
   */
  validateTransition(current: TStatus, target: TStatus): StateTransitionResult<TStatus>;

  /**
   * Get available transitions from current status
   */
  getAvailableTransitions(current: TStatus): TStatus[];

  /**
   * Get available actions from current status
   */
  getAvailableActions(current: TStatus): AvailableActions<TStatus>;

  /**
   * Check if status is terminal (no outgoing transitions)
   */
  isTerminal(status: TStatus): boolean;

  /**
   * Get permission required for a transition (if any)
   */
  getRequiredPermission(from: TStatus, to: TStatus): number | undefined;
}

/**
 * Create a state machine for a specific entity type
 *
 * @param config - State machine configuration
 * @returns State machine instance
 */
export function createStateMachine<TStatus extends string>(
  config: StateTransitionConfig<TStatus>
): StateMachine<TStatus> {
  return {
    canTransitionTo(current: TStatus, target: TStatus): boolean {
      const allowed = config.transitions[current] ?? [];
      return allowed.includes(target);
    },

    validateTransition(current: TStatus, target: TStatus): StateTransitionResult<TStatus> {
      const allowed = this.canTransitionTo(current, target);

      if (!allowed) {
        // Check if current status is terminal
        if (this.isTerminal(current)) {
          return {
            allowed: false,
            fromStatus: current,
            toStatus: target,
            reason: `${current} is a terminal status - no further transitions allowed`,
          };
        }

        // Check if target is valid for any status
        const anyStatusHasTarget = Object.values(config.transitions).some((targets) =>
          (targets as TStatus[]).includes(target)
        );

        if (!anyStatusHasTarget) {
          return {
            allowed: false,
            fromStatus: current,
            toStatus: target,
            reason: `${target} is not a valid status`,
          };
        }

        return {
          allowed: false,
          fromStatus: current,
          toStatus: target,
          reason: `Cannot transition from ${current} to ${target}`,
        };
      }

      return {
        allowed: true,
        fromStatus: current,
        toStatus: target,
      };
    },

    getAvailableTransitions(current: TStatus): TStatus[] {
      return config.transitions[current] ?? [];
    },

    getAvailableActions(current: TStatus): AvailableActions<TStatus> {
      return {
        availableTransitions: this.getAvailableTransitions(current),
        isTerminal: this.isTerminal(current),
      };
    },

    isTerminal(status: TStatus): boolean {
      // Check explicit terminal states
      if (config.terminalStates?.includes(status)) {
        return true;
      }

      // Check if status has no outgoing transitions
      const transitions = config.transitions[status];
      return !transitions || transitions.length === 0;
    },

    getRequiredPermission(from: TStatus, to: TStatus): number | undefined {
      if (!config.transitionPermissions) {
        return undefined;
      }
      const key = `${from}_${to}`;
      return config.transitionPermissions[key];
    },
  };
}

/**
 * Error thrown when an invalid state transition is attempted
 */
export class InvalidTransitionError extends Error {
  constructor(
    public readonly fromStatus: string,
    public readonly toStatus: string,
    public readonly entityType?: string
  ) {
    const prefix = entityType ? `[${entityType}] ` : '';
    super(`${prefix}Cannot transition from ${fromStatus} to ${toStatus}`);
    this.name = 'InvalidTransitionError';
  }
}

/**
 * Validate transition and throw if not allowed
 *
 * @param stateMachine - State machine to use
 * @param current - Current status
 * @param target - Target status
 * @param entityType - Optional entity type for error messages
 * @throws InvalidTransitionError if transition is not allowed
 */
export function requireValidTransition<TStatus extends string>(
  stateMachine: StateMachine<TStatus>,
  current: TStatus,
  target: TStatus,
  entityType?: string
): void {
  const result = stateMachine.validateTransition(current, target);
  if (!result.allowed) {
    throw new InvalidTransitionError(current, target, entityType);
  }
}
