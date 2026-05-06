/**
 * Agent Identity
 *
 * Phase 0 of AI-AGENT-ROADMAP-2026-04-25.md — "Agent identity" workstream.
 *
 * Single source of truth for the agent's email, display name, and the
 * Firebase Auth custom claim (`agent: true`) that distinguishes it from
 * human users in firestore.rules.
 *
 * The actual Firebase user is provisioned by
 * scripts/provision-agent-identity.js (admin SDK). This module exposes
 * the constants the rest of the app — orchestrator runtime, audit
 * logging, admin UIs — references at runtime.
 */

import type { CustomClaims } from '@vapour/types';

/**
 * The agent's email. Stable across deployments — used as the lookup key
 * by the provisioning script and as the `actorEmail` on every
 * agent-origin audit row.
 *
 * `.internal` is intentional: it's a non-routable TLD that signals "not
 * a human inbox" to anyone reading the audit log.
 */
export const AGENT_EMAIL = 'agent@vapourtoolbox.internal';

/**
 * The agent's display name shown in the audit viewer + the "Actor" chip
 * on agent-origin rows.
 */
export const AGENT_DISPLAY_NAME = 'Vapour Agent';

/**
 * Returns true when the supplied custom claims belong to the agent
 * identity. Used by client-side code to gate "you can configure the
 * agent" admin surfaces and to distinguish agent vs human flows.
 *
 * Server-side / firestore.rules: use the `isAgent()` helper there
 * (request.auth.token.agent == true).
 */
export function isAgentUser(claims: CustomClaims | null | undefined): boolean {
  return claims?.agent === true;
}

/**
 * The agent's restricted permission set. Designed so that the agent
 * can READ broadly across the app (so it can answer questions and
 * draft work), but every WRITE that matters routes through:
 *   - firestore.rules' destructive-op blocks (delete + soft-delete are
 *     denied for actorType='agent' on financial / GL collections); and
 *   - the HITL queue (Phase 0 follow-up — agentTasks).
 *
 * The bitset values mirror PERMISSION_FLAGS in @vapour/constants. We
 * recompute them here as a literal because:
 *   1. the provisioning script needs the bitset without bringing in
 *      the full @vapour/constants build (it runs as a plain node
 *      script under firebase-admin); and
 *   2. an agent-permission grant is a security decision that should be
 *      visibly listed at one site rather than computed from elsewhere.
 *
 * If a flag value changes in @vapour/constants, recompute here and
 * re-run the provisioning script.
 */
export const AGENT_PERMISSIONS = {
  // VIEW_*  flags — let the agent read the modules it operates over.
  VIEW_PROJECTS: 16,
  VIEW_PROCUREMENT: 64,
  VIEW_ACCOUNTING: 32768,
  VIEW_ESTIMATION: 524288,
  // (More VIEW flags get added here as the agent's tool surface grows.)
} as const;

/**
 * Combined bitfield the provisioning script writes to claims.permissions.
 * Equal to the bitwise OR of every value in AGENT_PERMISSIONS.
 */
export const AGENT_PERMISSIONS_BITFIELD: number = Object.values(AGENT_PERMISSIONS).reduce(
  (acc, bit) => acc | bit,
  0
);
