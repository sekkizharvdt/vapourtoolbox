/**
 * Application Changelog — Single Source of Truth
 *
 * This file is consumed by:
 * - apps/web in-app guide (ChangelogSection.tsx)
 * - scripts/sync-changelog.js → generates root CHANGELOG.md
 *
 * To add a release:
 * 1. Add a new entry to the top of CHANGELOG array (most recent first)
 * 2. Update APP_META.VERSION and APP_META.LAST_UPDATED in config.ts
 * 3. Run `pnpm changelog:sync` to regenerate root CHANGELOG.md
 */

export type ChangeType = 'feature' | 'improvement' | 'fix' | 'removed';

export interface ChangelogChange {
  type: ChangeType;
  description: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  /** Optional short title describing the theme of the release */
  title?: string;
  changes: ChangelogChange[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.6.0',
    date: '2026-05-12',
    title: 'Proposals overhaul, AI Agent Phase 0, vendor quotes unification',
    changes: [
      // Proposals (major reorg)
      {
        type: 'feature',
        description:
          'Proposals: AI parser for enquiry SOW PDFs extracts fields + structured conditions',
      },
      {
        type: 'feature',
        description:
          'Proposals: multi-section customer pricing (manpower, per-manday, lump-sum, BOM, foreign quotes)',
      },
      {
        type: 'feature',
        description:
          'Proposals: structured terms & conditions clause blocks replace free-form text',
      },
      {
        type: 'feature',
        description:
          'Proposals: cover page, covering letter, and structured annexures in client PDF',
      },
      { type: 'feature', description: 'Proposals: technical compliance matrix section' },
      { type: 'feature', description: 'Proposals: qualifications & past-projects block' },
      {
        type: 'feature',
        description: 'Proposals: revision history card + create-revision workflow',
      },
      {
        type: 'feature',
        description:
          'Proposals: scope triage screen between AI parse and proposal editor, with inline exclusion-reason flow',
      },
      {
        type: 'feature',
        description:
          'Proposals: workflow redesign with engagement type, currency, and multi-select work components',
      },
      // Vendor quotes / materials / bought-out
      {
        type: 'feature',
        description:
          'Procurement: unified /procurement/quotes — retired separate offers + vendorOffers collections',
      },
      {
        type: 'feature',
        description:
          'Procurement: AI parser for log-vendor-quote with editable line items and auto-resolution status',
      },
      {
        type: 'feature',
        description:
          'Materials: auto-link or auto-create equipment materials when parsing vendor quotes',
      },
      {
        type: 'feature',
        description: 'Materials: equipment-spec schema with deterministic spec-code generator',
      },
      {
        type: 'feature',
        description: 'Bought-out: live spec-code preview + duplicate detection on manual entry',
      },
      {
        type: 'feature',
        description: 'Materials: review queue for master records auto-created from AI imports',
      },
      {
        type: 'feature',
        description:
          'Materials: all-quotes view per material (replaces price history); highlight accepted',
      },
      {
        type: 'feature',
        description: 'Procurement: RFQ zip bundle for vendor delivery + source-PR attachments',
      },
      { type: 'feature', description: 'Procurement: show-project-name toggle for vendor RFQ PDFs' },
      // AI Agent — Phase 0
      {
        type: 'feature',
        description:
          'AI Agent: identity (agent@vapourtoolbox.internal), custom claims, and Firestore rules gates',
      },
      {
        type: 'feature',
        description: 'AI Agent: tool framework + human-in-the-loop (HITL) infrastructure',
      },
      {
        type: 'feature',
        description: 'AI Agent: memory store — agentRuns, agentMemory, agentSessions collections',
      },
      {
        type: 'feature',
        description: 'AI Agent: observability dashboard + scheduled HITL expiry',
      },
      {
        type: 'improvement',
        description: 'Audit trail expanded with actorType, agentRunId, and agentToolName fields',
      },
      // Thermal
      {
        type: 'feature',
        description:
          'Thermal: expansion calculator with material database, install/operating temps, and free/restrained constraints',
      },
      {
        type: 'feature',
        description: 'Thermal: SS 316/316L and Duplex 2205 added to the expansion calculator',
      },
      // Email
      {
        type: 'feature',
        description: 'Email: pr_rejected notifications + delivery health card on admin/email',
      },
      {
        type: 'improvement',
        description: 'Email: per-recipient errors, idempotency, plaintext fallback, env-aware URLs',
      },
      {
        type: 'improvement',
        description: 'Email: leave-approved routed through configured recipients',
      },
      // Rule closures (CLAUDE.md audit)
      {
        type: 'improvement',
        description:
          'Audit: CLAUDE.md rule check suite added; closed rules #4 (security rules), #6 (self-approval), #18 (audit logging), #19 (transactions), #20 (batch chunking), #21 (amount fallbacks), #28 (module completeness), #30 (routing)',
      },
      // Fixes
      {
        type: 'fix',
        description: 'Procurement: preserve PR spec on match + materialType editable',
      },
      {
        type: 'fix',
        description: 'Procurement: amendments use conditional spreads for optional history fields',
      },
      {
        type: 'fix',
        description:
          'Procurement: replace "Log Vendor Quote" tile with "Quotes" opening the unified list',
      },
      {
        type: 'fix',
        description: 'Procurement: "Issue RFQ" renamed to "Mark as Sent" to match behaviour',
      },
      {
        type: 'fix',
        description: 'Materials: generic fallback for unmapped category code generation',
      },
      { type: 'fix', description: 'Accounting: /payment-batches/new redirect page' },
      { type: 'fix', description: 'HR: honour holiday working-day overrides in leave picker' },
      {
        type: 'fix',
        description: 'Feedback: reporter can close feedback from any non-terminal status',
      },
      {
        type: 'fix',
        description: 'Feedback: detail-page link exposed for in-progress items in user list',
      },
      {
        type: 'fix',
        description: 'Routing: proposal detail and vendor-offer detail work under static export',
      },
      {
        type: 'fix',
        description: 'CSP: firebasestorage allowed in frame-src so PDF viewer renders',
      },
      {
        type: 'fix',
        description: 'Security: Next.js bumped to ^15.5.18, closing 7 high-severity advisories',
      },
      {
        type: 'fix',
        description: 'Security: pnpm overrides close remaining critical and high audit findings',
      },
      // Removed
      {
        type: 'removed',
        description:
          'Bank Reconciliation module — page, services, types, Firestore rules/indexes, and RECONCILE_ACCOUNTS permission flag fully removed. Replaced by direct bank-API workflows; no production data was migrated.',
      },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-02-16',
    changes: [
      { type: 'feature', description: 'AI Help assistant powered by Claude for in-app guidance' },
      { type: 'feature', description: 'TDS rate categories with manual override on vendor bills' },
      { type: 'feature', description: 'Journal Entry balances included in Entity Ledger totals' },
      { type: 'feature', description: 'Payment batch categories (Salary, Taxes, Projects, etc.)' },
      {
        type: 'feature',
        description: 'Email notifications for 17+ business events via Nodemailer',
      },
      { type: 'feature', description: 'Manual backup trigger and backup history in Admin' },
      { type: 'feature', description: 'Entity opening balance linked to Entity Ledger' },
      {
        type: 'improvement',
        description: 'Command palette updated with HR, Accounting, and Flow actions',
      },
      {
        type: 'improvement',
        description: 'Data health tools for auditing GL entries and account mappings',
      },
      {
        type: 'fix',
        description: 'Forex aggregation uses base amount (INR) across accounting pages',
      },
    ],
  },
  {
    version: '1.4.0',
    date: '2026-02-01',
    changes: [
      {
        type: 'feature',
        description: 'Comprehensive security audit with 50+ fixes across all modules',
      },
      { type: 'feature', description: 'Audit logging for sensitive operations' },
      { type: 'feature', description: 'State machine enforcement for all status transitions' },
      { type: 'improvement', description: 'Authorization checks and self-approval prevention' },
      { type: 'improvement', description: 'Multi-tenancy entityId filtering on all queries' },
      { type: 'fix', description: 'PO PDF generation crash on legacy commercial terms' },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-01-20',
    changes: [
      {
        type: 'feature',
        description: 'Flow module redesign: My Tasks, Inbox, Team Board, Meeting Minutes',
      },
      {
        type: 'feature',
        description: 'Meeting Minutes with two-step creation and batch finalization',
      },
      { type: 'feature', description: 'PO PDF generation and document parse improvements' },
      { type: 'feature', description: 'GRN Send to Accounting workflow' },
      { type: 'improvement', description: 'Redesigned task cards for direct action navigation' },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-01-10',
    changes: [
      { type: 'feature', description: 'On-Duty requests with comp-off leave accrual' },
      { type: 'feature', description: 'Holiday working overrides for admins' },
      { type: 'feature', description: 'Contextual help system on page headers' },
      { type: 'improvement', description: 'Redesigned permissions UI with accordion layout' },
      { type: 'improvement', description: 'HR module opened to all users' },
    ],
  },
  {
    version: '1.1.0',
    date: '2025-12-30',
    changes: [
      {
        type: 'feature',
        description: 'Leave module redesign with 2-step approval and admin controls',
      },
      { type: 'feature', description: 'Enquiry contact person dropdown with auto-fill' },
      { type: 'feature', description: 'Employee Directory with team details' },
      { type: 'feature', description: 'Holiday Management with calendar' },
      { type: 'improvement', description: 'Standardized date format (dd/MM/yyyy) across the app' },
      { type: 'fix', description: 'Enquiries page infinite loading spinner' },
    ],
  },
  {
    version: '1.0.0',
    date: '2025-12-26',
    changes: [
      { type: 'feature', description: 'Travel Expenses module with receipt upload and PDF export' },
      { type: 'feature', description: 'Leave Management with approval workflow' },
      { type: 'feature', description: 'Version information displayed in footer' },
      { type: 'improvement', description: 'Updated User Guide with comprehensive documentation' },
      { type: 'improvement', description: 'Improved code organization and consistency' },
    ],
  },
  {
    version: '0.9.0',
    date: '2025-12-15',
    changes: [
      { type: 'feature', description: 'Bank Reconciliation with auto-matching' },
      { type: 'feature', description: 'Three-Way Match for PO/GR/Invoice verification' },
      { type: 'improvement', description: 'Enhanced procurement workflow' },
      { type: 'fix', description: 'Fixed document numbering sequence issues' },
    ],
  },
  {
    version: '0.8.0',
    date: '2025-12-01',
    changes: [
      { type: 'feature', description: 'Project Charter with milestone tracking' },
      { type: 'feature', description: 'Document transmittal system' },
      { type: 'improvement', description: 'Better task notification system' },
    ],
  },
];
