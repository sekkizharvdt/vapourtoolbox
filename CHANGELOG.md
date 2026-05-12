# Changelog

All notable changes to **Vapour Toolbox**.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> This file is generated from `packages/constants/src/changelog.ts`. Run `pnpm changelog:sync` to regenerate.

## [1.6.0] — 2026-05-12 — Proposals overhaul, AI Agent Phase 0, vendor quotes unification

### Added

- Proposals: AI parser for enquiry SOW PDFs extracts fields + structured conditions
- Proposals: multi-section customer pricing (manpower, per-manday, lump-sum, BOM, foreign quotes)
- Proposals: structured terms & conditions clause blocks replace free-form text
- Proposals: cover page, covering letter, and structured annexures in client PDF
- Proposals: technical compliance matrix section
- Proposals: qualifications & past-projects block
- Proposals: revision history card + create-revision workflow
- Proposals: scope triage screen between AI parse and proposal editor, with inline exclusion-reason flow
- Proposals: workflow redesign with engagement type, currency, and multi-select work components
- Procurement: unified /procurement/quotes — retired separate offers + vendorOffers collections
- Procurement: AI parser for log-vendor-quote with editable line items and auto-resolution status
- Materials: auto-link or auto-create equipment materials when parsing vendor quotes
- Materials: equipment-spec schema with deterministic spec-code generator
- Bought-out: live spec-code preview + duplicate detection on manual entry
- Materials: review queue for master records auto-created from AI imports
- Materials: all-quotes view per material (replaces price history); highlight accepted
- Procurement: RFQ zip bundle for vendor delivery + source-PR attachments
- Procurement: show-project-name toggle for vendor RFQ PDFs
- AI Agent: identity (agent@vapourtoolbox.internal), custom claims, and Firestore rules gates
- AI Agent: tool framework + human-in-the-loop (HITL) infrastructure
- AI Agent: memory store — agentRuns, agentMemory, agentSessions collections
- AI Agent: observability dashboard + scheduled HITL expiry
- Thermal: expansion calculator with material database, install/operating temps, and free/restrained constraints
- Thermal: SS 316/316L and Duplex 2205 added to the expansion calculator
- Email: pr_rejected notifications + delivery health card on admin/email

### Changed

- Audit trail expanded with actorType, agentRunId, and agentToolName fields
- Email: per-recipient errors, idempotency, plaintext fallback, env-aware URLs
- Email: leave-approved routed through configured recipients
- Audit: CLAUDE.md rule check suite added; closed rules #4 (security rules), #6 (self-approval), #18 (audit logging), #19 (transactions), #20 (batch chunking), #21 (amount fallbacks), #28 (module completeness), #30 (routing)

### Fixed

- Procurement: preserve PR spec on match + materialType editable
- Procurement: amendments use conditional spreads for optional history fields
- Procurement: replace "Log Vendor Quote" tile with "Quotes" opening the unified list
- Procurement: "Issue RFQ" renamed to "Mark as Sent" to match behaviour
- Materials: generic fallback for unmapped category code generation
- Accounting: /payment-batches/new redirect page
- HR: honour holiday working-day overrides in leave picker
- Feedback: reporter can close feedback from any non-terminal status
- Feedback: detail-page link exposed for in-progress items in user list
- Routing: proposal detail and vendor-offer detail work under static export
- CSP: firebasestorage allowed in frame-src so PDF viewer renders
- Security: Next.js bumped to ^15.5.18, closing 7 high-severity advisories
- Security: pnpm overrides close remaining critical and high audit findings

### Removed

- Bank Reconciliation module — page, services, types, Firestore rules/indexes, and RECONCILE_ACCOUNTS permission flag fully removed. Replaced by direct bank-API workflows; no production data was migrated.

## [1.5.0] — 2026-02-16

### Added

- AI Help assistant powered by Claude for in-app guidance
- TDS rate categories with manual override on vendor bills
- Journal Entry balances included in Entity Ledger totals
- Payment batch categories (Salary, Taxes, Projects, etc.)
- Email notifications for 17+ business events via Nodemailer
- Manual backup trigger and backup history in Admin
- Entity opening balance linked to Entity Ledger

### Changed

- Command palette updated with HR, Accounting, and Flow actions
- Data health tools for auditing GL entries and account mappings

### Fixed

- Forex aggregation uses base amount (INR) across accounting pages

## [1.4.0] — 2026-02-01

### Added

- Comprehensive security audit with 50+ fixes across all modules
- Audit logging for sensitive operations
- State machine enforcement for all status transitions

### Changed

- Authorization checks and self-approval prevention
- Multi-tenancy entityId filtering on all queries

### Fixed

- PO PDF generation crash on legacy commercial terms

## [1.3.0] — 2026-01-20

### Added

- Flow module redesign: My Tasks, Inbox, Team Board, Meeting Minutes
- Meeting Minutes with two-step creation and batch finalization
- PO PDF generation and document parse improvements
- GRN Send to Accounting workflow

### Changed

- Redesigned task cards for direct action navigation

## [1.2.0] — 2026-01-10

### Added

- On-Duty requests with comp-off leave accrual
- Holiday working overrides for admins
- Contextual help system on page headers

### Changed

- Redesigned permissions UI with accordion layout
- HR module opened to all users

## [1.1.0] — 2025-12-30

### Added

- Leave module redesign with 2-step approval and admin controls
- Enquiry contact person dropdown with auto-fill
- Employee Directory with team details
- Holiday Management with calendar

### Changed

- Standardized date format (dd/MM/yyyy) across the app

### Fixed

- Enquiries page infinite loading spinner

## [1.0.0] — 2025-12-26

### Added

- Travel Expenses module with receipt upload and PDF export
- Leave Management with approval workflow
- Version information displayed in footer

### Changed

- Updated User Guide with comprehensive documentation
- Improved code organization and consistency

## [0.9.0] — 2025-12-15

### Added

- Bank Reconciliation with auto-matching
- Three-Way Match for PO/GR/Invoice verification

### Changed

- Enhanced procurement workflow

### Fixed

- Fixed document numbering sequence issues

## [0.8.0] — 2025-12-01

### Added

- Project Charter with milestone tracking
- Document transmittal system

### Changed

- Better task notification system
