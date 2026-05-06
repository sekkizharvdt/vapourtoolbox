#!/usr/bin/env node
/**
 * Provision the AI agent's Firebase Auth identity.
 *
 * AI-AGENT-ROADMAP-2026-04-25.md Phase 0 — "Agent identity" workstream.
 *
 * Creates (or updates) `agent@vapourtoolbox.internal` and stamps the custom
 * claims that firestore.rules and the admin viewer rely on:
 *   - agent: true               — the discriminator gates isAgent()
 *   - tenantId: <tenant>         — multi-tenant scope (defaults to 'default-entity')
 *   - permissions: <bitfield>   — restricted VIEW-only set; mirrors
 *     AGENT_PERMISSIONS in apps/web/src/lib/agent/identity.ts
 *   - domain: 'internal'         — so isInternalUser() in firestore.rules accepts
 *
 * Idempotent — safe to re-run; it looks up the user by email, creates
 * if missing, and overwrites the custom claims either way.
 *
 * Usage:
 *   node scripts/provision-agent-identity.js [--dry-run] [--tenant <id>]
 *
 * Output: the agent's Firebase UID. Save it somewhere durable (e.g.
 * 1Password) — the orchestrator runtime needs it to mint tokens for
 * its sessions.
 */

const admin = require('firebase-admin');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.resolve(
  __dirname,
  '../mcp-servers/firebase-feedback/service-account-key.json'
);

const AGENT_EMAIL = 'agent@vapourtoolbox.internal';
const AGENT_DISPLAY_NAME = 'Vapour Agent';

// Mirrors AGENT_PERMISSIONS_BITFIELD in apps/web/src/lib/agent/identity.ts.
// Updating the agent's permissions: change there AND here, then re-run
// this script so the live custom claims match the source of truth.
const AGENT_PERMISSIONS = {
  VIEW_PROJECTS: 16,
  VIEW_PROCUREMENT: 64,
  VIEW_ACCOUNTING: 32768,
  VIEW_ESTIMATION: 524288,
};
const AGENT_PERMISSIONS_BITFIELD = Object.values(AGENT_PERMISSIONS).reduce((a, b) => a | b, 0);

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const tenantArgIdx = args.indexOf('--tenant');
const TENANT_ID = tenantArgIdx >= 0 ? args[tenantArgIdx + 1] : 'default-entity';

admin.initializeApp({
  credential: admin.credential.cert(require(SERVICE_ACCOUNT_PATH)),
});

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== PROVISIONING AGENT ===');
  console.log(`email:       ${AGENT_EMAIL}`);
  console.log(`tenant:      ${TENANT_ID}`);
  console.log(
    `permissions: ${AGENT_PERMISSIONS_BITFIELD} (${Object.keys(AGENT_PERMISSIONS).join(' + ')})`
  );

  let user;
  try {
    user = await admin.auth().getUserByEmail(AGENT_EMAIL);
    console.log(`\nFound existing agent user: ${user.uid}`);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    console.log('\nNo agent user found — creating');
    if (DRY_RUN) {
      console.log('(dry run — skipping create)');
      return;
    }
    user = await admin.auth().createUser({
      email: AGENT_EMAIL,
      emailVerified: true,
      displayName: AGENT_DISPLAY_NAME,
      disabled: false,
    });
    console.log(`Created agent user: ${user.uid}`);
  }

  const claims = {
    agent: true,
    tenantId: TENANT_ID,
    permissions: AGENT_PERMISSIONS_BITFIELD,
    domain: 'internal',
  };

  console.log('\nClaims to apply:');
  console.log(JSON.stringify(claims, null, 2));

  if (DRY_RUN) {
    console.log('\n(dry run — skipping setCustomUserClaims)');
    return;
  }

  await admin.auth().setCustomUserClaims(user.uid, claims);
  console.log('\n✅ Custom claims applied');
  console.log(`\nAgent UID: ${user.uid}`);
  console.log('Save this UID — the orchestrator needs it to mint session tokens.');
}

main().catch((err) => {
  console.error('Failed to provision agent identity:', err);
  process.exit(1);
});
