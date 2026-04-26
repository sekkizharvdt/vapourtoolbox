# AI Agent Roadmap — Vapour Toolbox

**Goal:** Turn the existing Vapour Toolbox codebase into the backbone for an AI agent that operates as an internal employee — with scoped access to the application and Firestore, capable of executing multi-step procurement / accounting / project workflows, hosted on-premises at the office.

**Date:** 2026-04-25
**Scope:** Whole codebase — 1 web app, 8 packages, 50+ Cloud Functions, ~25 Firestore collections, 20 module routes, 2 existing MCP servers.

---

## 1. Executive summary

The codebase is unusually agent-ready. The hard parts that most teams retrofit — permissions, state machines, approval workflows, audit trails, denormalization sync, document parsing — are already built. The work is **not "build an agent"**; it is **"build the safety, oversight, and tool-surface layer around the existing system so an agent can use it without breaking things."**

**Estimated effort:** 16–22 engineer-weeks for a production-ready v1 across procurement + accounting + projects, plus ongoing expansion. Breaks down as:

- **Phase 0 — Foundations** (~4 weeks): agent identity, tool framework, HITL gates, audit expansion, memory, observability, inbox.
- **Phase 1 — Read-only assistant** (~2 weeks): agent answers questions, drafts text, summarizes — never writes.
- **Phase 2 — Procurement co-pilot** (~4 weeks): drafts PRs/RFQs/POs/GRs; humans approve.
- **Phase 3 — Accounting co-pilot** (~4 weeks): allocates payments, drafts JEs, reconciles bank statements; humans approve.
- **Phase 4 — Cross-domain workflows** (~4 weeks): proposal-to-project, leave processing, transmittal generation.
- **Phase 5 — Incoming triggers** (~3 weeks): Gmail, scheduled jobs, webhook-driven work.
- **Phase 6 — Hardening** (ongoing): expand tool coverage, tune HITL thresholds, broaden domain reach.

**Prerequisites that block agentification** (must close in Phase 0):

1. Rule #28 violations — `vendorQuotes` (no list/view/edit), `entities` (no detail/edit), missing leave/on-duty/BOM state machines.
2. Audit trail coverage is "in progress" — needs broad expansion to every write path the agent will touch.
3. No incoming-message system — agent has no way to _receive_ work.

**Self-hosted topology recommendation:** on-prem orchestrator + LLM API (Claude). True air-gapped (local model) is feasible only with severe quality regression and is not recommended.

---

## 2. Architecture

### 2.1 Topology

```
┌──────────────────────────────────────────────────────────────────┐
│  OFFICE PREMISES (self-hosted)                                   │
│                                                                  │
│  ┌────────────────────┐     ┌────────────────────────────┐       │
│  │  Agent Orchestrator│◀───▶│  Tool Servers (MCP / HTTP) │       │
│  │  (Node.js,          │     │  - procurement-tools       │       │
│  │   Claude Agent SDK) │     │  - accounting-tools        │       │
│  │                    │     │  - accounting-audit (exists)│      │
│  │  - Run loop        │     │  - firebase-feedback (exists)│     │
│  │  - Memory          │     │  - projects-tools          │       │
│  │  - HITL gating     │     │  - hr-tools                │       │
│  │  - Cost tracking   │     │  - email-tools (Gmail)     │       │
│  └────────┬───────────┘     │  - documents-tools         │       │
│           │                 └────────────────────────────┘       │
│           ▼                                                      │
│  ┌────────────────────┐                                          │
│  │  Inbox / Trigger   │                                          │
│  │  - Gmail polling   │                                          │
│  │  - agentTasks Queue│                                          │
│  │  - Scheduled cron  │                                          │
│  └────────────────────┘                                          │
└──────────────────────────────┬───────────────────────────────────┘
                               │ HTTPS
                               ▼
       ┌────────────────────────────────────────────┐
       │  CLOUD                                     │
       │  - Anthropic Claude API (LLM inference)    │
       │  - Firebase Auth + Firestore               │
       │  - Cloud Functions (existing)              │
       │  - Cloud Storage (file uploads)            │
       │  - Document AI (existing)                  │
       │  - Gmail (existing SMTP)                   │
       └────────────────────────────────────────────┘
```

**What runs on-prem:**

- Agent orchestrator (Node.js process, Claude Agent SDK).
- Tool servers (MCP, exposed locally to the orchestrator).
- Inbox/trigger watcher (polls Gmail, watches `agentTasks`).
- Local cache + agent memory (SQLite or Postgres).
- Observability dashboard (Grafana / simple Next.js).

**What stays in cloud:**

- Claude API (LLM inference) — the only outbound dependency.
- Firestore + Cloud Functions + Storage (already cloud — would require a full re-architecture to repatriate).
- Gmail SMTP (existing).

### 2.2 Components

1. **Agent runtime** — `apps/agent/` (new). Long-running Node.js process. Uses Claude Agent SDK. Loop: receive task → plan → call tools → checkpoint → resume on HITL response.
2. **Tool servers** — MCP servers (extending the existing `mcp-servers/` pattern). Each exposes 5–25 tools per domain. Agent connects via stdio or HTTP+SSE.
3. **Agent identity** — `agent@vapourtoolbox.internal` Firebase user with curated permission flags. Server-side check `claims.agent === true` blocks dangerous flags (hard delete, role grant).
4. **HITL gating layer** — `apps/web/src/lib/agent/hitl.ts`. Every "risky" tool write goes through `agentTasks` collection in `PENDING_APPROVAL` state. Web UI surfaces them in an inbox.
5. **Audit trail** — extend existing `auditLogs` collection (rule #18 "in progress"). Every agent action writes one row with `actor: 'agent'`, `runId`, `toolName`, `inputs`, `outputs`, `decision`.
6. **Memory** — `agentMemory` collection: long-term facts (vendor preferences, recurring task patterns), `agentRuns` collection: per-run transcripts, `agentSessions`: ongoing multi-turn work.
7. **Inbox / trigger** — `agentTasks` collection (`PENDING | IN_PROGRESS | COMPLETED | FAILED | NEEDS_HUMAN`). Sources: Gmail polling, web UI button, Cloud Function trigger, cron.
8. **Observability** — `agentRuns` Firestore collection + on-prem Grafana board. Metrics: runs/day, tool calls/run, cost/run, HITL rate, error rate per tool, time-to-completion.

### 2.3 Self-hosted considerations

**On-prem orchestrator + cloud LLM** is the recommended setup. Justification:

- Office-premises requirement is met for the "agent brain" and tool servers — the part that actually touches your business logic.
- Firestore is already cloud and would be a 6-month rewrite to repatriate. Trying to make this air-gapped means re-platforming the entire app.
- Local-model alternatives (Llama 70B, Qwen, etc.) cannot reliably drive 7-step procurement or accounting workflows today. Quality drop is not subtle.
- If a hard data-residency mandate emerges later, the agent code is portable — you can swap Claude API for a self-hosted inference endpoint without rewriting tools.

**Hardware sizing for on-prem orchestrator** (modest):

- 1 mid-tier server, 16 GB RAM, 8 cores, 200 GB SSD.
- Optional: GPU box (only if local-model inference becomes a requirement later).
- Outbound HTTPS to `api.anthropic.com`, `firestore.googleapis.com`, `gmail.googleapis.com`.

**Concession to security:** all credentials (Anthropic key, Firebase service account) live in on-prem secret manager (HashiCorp Vault, or simpler: encrypted file with `age`). Never in git, never in the agent's prompt.

---

## 3. Domain coverage matrix

This section maps every entity / workflow in the codebase to its agent-readiness. Status legend:

- ✅ **Ready** — fully implemented, has state machine, has Cloud Function sync, can be safely agent-driven.
- ⚠️ **Partial** — module works but missing pages, state machine, or sync; agent can read but writes need workarounds.
- ❌ **Blocked** — missing infrastructure; agent cannot use without prep work.

### 3.1 Procurement (most mature; recommended starting domain)

| Entity                      | Status | State machine                                        | Agent capability (target)                                            | HITL gate                                       |
| --------------------------- | ------ | ---------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------- |
| `purchaseRequests`          | ✅     | DRAFT→SUBMITTED→APPROVED→CONVERTED_TO_RFQ            | Draft from project scope; submit on user approval                    | Always: approval beyond DRAFT                   |
| `rfq`                       | ✅     | DRAFT→ISSUED→OFFERS_RECEIVED→COMPLETED               | Draft from approved PRs; suggest vendor list; issue on user approval | Always: ISSUED transition                       |
| `vendorQuotes` (offers)     | ⚠️     | DRAFT→UPLOADED→SELECTED→PO_CREATED                   | Parse vendor PDFs; score offers; recommend selection                 | List/View/Edit pages missing — fix first        |
| `purchaseOrders`            | ✅     | DRAFT→PENDING_APPROVAL→APPROVED→ISSUED→...→COMPLETED | Draft from selected offer; suggest commercial terms                  | Always: APPROVED transition; >₹X requires human |
| `goodsReceipts`             | ✅     | PENDING→IN_PROGRESS→COMPLETED                        | Pre-fill from packing list parsing; flag over/under-delivery         | INSPECT_GOODS only after physical check         |
| `packingLists`              | ✅     | DRAFT→FINALIZED→SHIPPED→DELIVERED                    | Parse from vendor docs                                               | Optional                                        |
| `workCompletionCerts`       | ✅     | (none — single-shot)                                 | Generate from PO + delivery confirmation                             | Always: human signs                             |
| `serviceOrders`             | ✅     | DRAFT→...→COMPLETED                                  | Track sample status, results                                         | Optional                                        |
| `poAmendments`              | ✅     | (none)                                               | Draft amendment with diff vs original PO                             | Always: amendment = financial change            |
| `threeWayMatches`           | ✅     | (derived)                                            | Auto-resolve discrepancies within tolerance                          | >tolerance: human                               |
| `transactions[VENDOR_BILL]` | ✅     | (status field)                                       | Create from approved GR; parse invoice PDF                           | Always: posting to GL                           |

**Manual tasks the agent can take over (procurement):**

- Draft RFQ from approved PR (auto-suggest vendors based on past performance + entity tags).
- Score vendor offers and recommend selection (price + delivery + spec compliance + history).
- Pre-fill GR from packing list + delivery photos.
- Flag three-way-match discrepancies; auto-resolve within tolerance, escalate above.
- Chase vendors for missing bills (5 days post-delivery → email reminder via Gmail tool).
- Reconcile vendor statements monthly (compare your records vs vendor's).

**Critical Cloud Function dependencies (must respect):**

- `procurementProjectSync.ts` — PO/RFQ/GR status changes propagate to project charters. Don't bypass.
- `procurementPaymentStatus.ts` — vendor payment events update GR `paymentStatus`. Read-only for the agent.
- `denormalizationSync.ts` — agent writes denormalized fields per rule #26 — never edits cached `vendorName` directly.

### 3.2 Accounting

| Entity                                 | Status | State machine                                       | Agent capability (target)                          | HITL gate                    |
| -------------------------------------- | ------ | --------------------------------------------------- | -------------------------------------------------- | ---------------------------- |
| `transactions[CUSTOMER_INVOICE]`       | ✅     | DRAFT/POSTED/PAID (field)                           | Draft from project milestones; suggest GST codes   | Always: posting              |
| `transactions[CUSTOMER_PAYMENT]`       | ✅     | (field)                                             | Allocate to invoices; flag unallocated             | >₹X: human                   |
| `transactions[VENDOR_BILL]`            | ✅     | (field)                                             | Create from GR + parsed invoice PDF                | Always: posting              |
| `transactions[VENDOR_PAYMENT]`         | ✅     | (field)                                             | Allocate to bills; group into payment batch        | Always: posting              |
| `transactions[JOURNAL_ENTRY]`          | ✅     | DRAFT/POSTED                                        | Draft from receipts, accruals, recurring patterns  | Always: posting              |
| `transactions[BANK_TRANSFER]`          | ✅     | (field)                                             | Match bank statement lines                         | Always: posting              |
| `transactions[EXPENSE_CLAIM]`          | ✅     | (field)                                             | Pre-fill from receipt parsing                      | Always: posting              |
| `transactions[DIRECT_PAYMENT/RECEIPT]` | ✅     | (field)                                             | Same as above                                      | Always: posting              |
| `paymentBatches`                       | ✅     | DRAFT→PENDING_APPROVAL→APPROVED→EXECUTING→COMPLETED | Group overdue bills; suggest fund sources          | Always: APPROVED             |
| `recurringTransactions`                | ✅     | ACTIVE/PAUSED/COMPLETED                             | Generate next occurrence on schedule               | Optional below threshold     |
| `fixedAssets`                          | ✅     | ACTIVE→DISPOSED/WRITTEN_OFF                         | Run depreciation batch monthly; preview GL entries | Always: posting              |
| `bankReconciliations`                  | ✅     | (process state)                                     | Auto-match deposits/withdrawals; flag unmatched    | Always: final reconciliation |
| Year-end close                         | ✅     | (process via `yearEndClosingService.ts`)            | Validate periods closed; preview closing JEs       | Always: human commits        |

**Manual tasks the agent can take over (accounting):**

- Auto-match payments to bills/invoices (by ID, then amount, then date proximity).
- Detect duplicate vendor bills (same vendor + similar invoice number + similar amount + within 30 days).
- Chase overdue invoices (read `find_overdue_items` MCP, draft email per customer, send via Gmail tool).
- Draft monthly recurring JEs (rent, depreciation, accruals).
- Pre-fill GST returns from `gstReportGenerator.ts` data; flag inconsistencies.
- Reconcile bank statement (match by amount within 1 paisa, date within 3 days).

**Critical:**

- `onTransactionWrite` Cloud Function recalculates `accountBalances` via `FieldValue.increment()`. Agent must NEVER write directly to `accounts.currentBalance` — only write transactions.
- Rule #21 (financial math) — round to paisa, derive outstanding from `total - paid`, never trust cached `outstandingAmount`.
- Rule #24 (transaction type safety) — if agent code switches on `TransactionType`, all 9 cases must be handled.

### 3.3 Projects

| Entity                                                             | Status | State machine                                                  | Agent capability                                   | HITL gate                |
| ------------------------------------------------------------------ | ------ | -------------------------------------------------------------- | -------------------------------------------------- | ------------------------ |
| `projects`                                                         | ⚠️     | (none — gap)                                                   | Create from accepted proposal; rollup stats        | Always: budget changes   |
| `projectCharter` (subdoc)                                          | ✅     | (procurementItems sync via Cloud Functions)                    | Draft from proposal scope                          | Always: approval         |
| `streams/equipment/lines/instruments/valves` (SSOT subcollections) | ⚠️     | (none)                                                         | CSV import / parse from project specs              | Optional                 |
| `boms` (subcollection)                                             | ⚠️     | DRAFT/UNDER_REVIEW/APPROVED — not yet a state machine          | Draft from past projects; suggest assemblies       | Always: approval         |
| `masterDocuments` (subcollection)                                  | ✅     | DRAFT→IN_PROGRESS→...→ACCEPTED                                 | Draft transmittal from selected docs               | Always: send transmittal |
| `transmittals` (subcollection)                                     | ⚠️     | DRAFT/GENERATED/SENT/ACKNOWLEDGED — not a formal state machine | Generate from doc selection; chase acknowledgments | Always: send             |

**Manual tasks the agent can take over (projects):**

- Draft project from accepted proposal (charter, scope, budget — Track A1 in `PROJECTS-REVIVAL-2026-04-24.md`).
- Compute project stats rollups (procurement / time / accounting / estimation) — currently no Cloud Function does this; agent could either trigger one or compute on-demand.
- Suggest BOM line items from past similar projects.
- Draft progress reports weekly.
- Chase pending master document submissions.
- Generate transmittals from a list of approved master documents.

**Gaps to close before agentification:**

- BOM state machine (rule #8 violation).
- Project edit flow incomplete.
- SSOT subcollections not surfaced in project detail UI.

### 3.4 HR

| Entity             | Status | State machine                          | Agent capability                                          | HITL gate        |
| ------------------ | ------ | -------------------------------------- | --------------------------------------------------------- | ---------------- |
| `hrLeaveRequests`  | ⚠️     | (inline if-checks — rule #8 violation) | Pre-validate balance, draft response                      | Always: approval |
| `hrLeaveBalances`  | ✅     | (admin-only edits)                     | Read-only; report nearing-expiry comp-off                 | n/a              |
| `hrCompOffGrants`  | ✅     | (none)                                 | Calculate from holiday-work overrides                     | n/a              |
| `onDutyRecords`    | ❌     | (none — module unused, 0 docs)         | Define use-case first; possibly auto-create from calendar | TBD              |
| `hrTravelExpenses` | ⚠️     | DRAFT→SUBMITTED→...→REIMBURSED         | Pre-fill from receipt parsing; draft claim                | Always: approval |
| `hrHolidays`       | ⚠️     | (none — FY27 not populated)            | Seed from calendar config                                 | n/a              |

**Manual tasks the agent can take over (HR):**

- Process leave requests (validate balance, check team coverage, draft approver email, await approval).
- Calculate utilization reports from on-duty + leave + holidays.
- Parse travel-expense receipts (Document AI already exists at `functions/src/receiptParsing/`); draft claim.
- Send comp-off-expiring reminders.
- Populate next-year holidays from calendar config.

**Gaps:**

- Leave + on-duty state machines missing.
- Travel-expense module under-used; agent automation may revive it.

### 3.5 Materials

| Entity           | Status                     | Agent capability                                           | HITL gate                     |
| ---------------- | -------------------------- | ---------------------------------------------------------- | ----------------------------- |
| `materials`      | ⚠️ (0 docs — never seeded) | Bulk-import from vendor catalog PDFs (Document AI primary) | Approval before catalog write |
| `materialPrices` | ⚠️                         | Sync from vendor quotes                                    | Optional                      |
| `vendorQuotes`   | ⚠️                         | (covered in procurement)                                   | (covered)                     |
| `stockMovements` | ⚠️                         | (no automation today)                                      | n/a                           |

**Manual tasks the agent can take over (materials):**

- Parse vendor catalog PDFs into Material entries with specs + pricing.
- Normalize material grade variants (`SS316L` ≡ `SS 316L` ≡ `316L`).
- Suggest substitutes when BOM item is unavailable.

**Note:** the materials module is a 0-doc module today. An agent loading the catalog is potentially the highest single-task ROI in the entire roadmap (turns weeks of manual data entry into hours of supervised parsing).

### 3.6 Estimation

| Entity                 | Status                | Agent capability                                 | HITL gate                |
| ---------------------- | --------------------- | ------------------------------------------------ | ------------------------ |
| `estimates`            | ✅                    | Search past similar estimates; draft new         | Always: pricing approval |
| `boms` (in estimation) | ⚠️ (no state machine) | Generate from past projects + assembly templates | Always: approval         |

**Manual tasks the agent can take over:**

- Draft BOM from project specs + past similar BOMs.
- Suggest assembly templates (referenced in memory: pressure vessel, heat exchanger, MED evaporator).
- Roll up BOM cost into proposal pricing block.

### 3.7 Proposals

| Entity              | Status                                 | State machine                                          | Agent capability                                                                      | HITL gate                   |
| ------------------- | -------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------- | --------------------------- |
| `enquiries`         | ✅                                     | NEW→PROPOSAL_IN_PROGRESS→SUBMITTED→WON/LOST/NO_BID     | Parse RFP PDF (Document AI) into enquiry; score (5-axis evaluation already in schema) | Always: NO_BID              |
| `proposals`         | ✅                                     | DRAFT→PENDING_APPROVAL→APPROVED→SUBMITTED→...→ACCEPTED | Draft from enquiry + template; track follow-ups; auto-create PRs on ACCEPTED          | Always: APPROVED, SUBMITTED |
| `proposalTemplates` | ⚠️ (0 docs, can't create from scratch) | Build templates from past won proposals                | Approval                                                                              |

**Manual tasks the agent can take over (proposals):**

- Parse incoming RFP from Gmail → create enquiry → score 5-axis evaluation.
- Draft proposal from enquiry + scope template (referenced in `PROPOSALS-WORKFLOW-DESIGN-2026-04-25.md`).
- Track SUBMITTED proposals with no response after 7/14/30 days; send reminder via Gmail.
- On ACCEPTED, auto-create project + draft PRs for BOUGHT_OUT/MANUFACTURED scope items.
- On REJECTED/LOST, prompt for win-loss reason; aggregate for analytics.

**Gaps:**

- "Send Proposal" action missing (H3 in `PROPOSALS-ROADMAP`).
- Enquiry status not synced when proposal status changes (H2).
- Template creation from scratch not possible (H1).

### 3.8 Documents / Transmittals

| Entity                | Status                            | State machine                       | Agent capability                                             | HITL gate        |
| --------------------- | --------------------------------- | ----------------------------------- | ------------------------------------------------------------ | ---------------- |
| `documents`           | ⚠️ (no "New" button discoverable) | Upload + classify; tag with project | Optional                                                     |
| `companyDocuments`    | ✅                                | (n/a)                               | (read-only knowledge source for agent)                       | n/a              |
| `masterDocuments`     | ✅                                | DRAFT→IN_PROGRESS→...→ACCEPTED      | Draft revision from prior version + edits; chase submissions | Always: ACCEPTED |
| `transmittals`        | ⚠️                                | (linear, not formalized)            | Bundle docs, generate cover letter, render PDF, send         | Always: send     |
| `documentSubmissions` | ✅                                | (revision history)                  | Track and chase                                              | n/a              |

### 3.9 Other modules

- **`boughtOut`** ✅ — agent can suggest from catalog when proposal scope item lacks vendor; bulk-import from brochures.
- **`thermal`** ✅ (read-mostly calculators) — agent can pre-fill calculator inputs from project SSOT and embed results in proposals/specs.
- **`entities`** ⚠️ (no detail/edit page) — agent can dedupe candidates, enrich from communication history. Block: pages missing (rule #28).
- **`feedback`** ✅ — `firebase-feedback` MCP already exposes this; agent can triage incoming feedback, route to module owners.

---

## 4. Pre-requisites — gaps to close before agentification

These are existing rule-violations or missing pieces that any AI agent will trip over. Close in **Phase 0** before any write-capable agent is enabled.

### 4.1 Rule #28 (module completeness) violations

1. **`vendorQuotes`** — no list/view/edit pages. Agent cannot show its work. **Effort:** 3 days.
2. **`entities`** — no detail/edit page. Agent dedup/enrich workflow has no UI surface. **Effort:** 3 days.
3. **`documents`** — no "New" button discoverable from main nav. **Effort:** 1 day.
4. **`projects`** — full edit flow incomplete; SSOT not surfaced; no "New project" from dashboard. **Effort:** 1 week (covered separately in `PROJECTS-REVIVAL-2026-04-24.md`).

### 4.2 Rule #8 (state machine) violations

5. **`hrLeaveRequests`** — inline if-checks; needs explicit `leaveRequestStateMachine`. **Effort:** 1 day.
6. **`onDutyRecords`** — no state machine, module unused. **Effort:** 1 day (or defer until use-case clarified).
7. **`boms`** — no state machine for DRAFT→UNDER_REVIEW→APPROVED. **Effort:** 1 day.
8. **`transmittals`** — implicit linear flow not formalized. **Effort:** 0.5 days.

### 4.3 Audit trail expansion (rule #18)

9. `auditLogs` collection exists; helpers `createAuditLog()`, `auditUserAction()` exist. Coverage is sparse. Every write path the agent will touch must call `createAuditLog` with `actor: 'agent' | 'user'`, `runId`, `decision`. **Effort:** 1 week (touch every service function the agent will call).

### 4.4 Composite indexes for agent queries

10. Agent queries will combine `where` + `orderBy` in patterns the UI doesn't currently use. After Phase 1, monitor Firestore "missing index" errors and add to `firestore.indexes.json`. **Effort:** ongoing.

### 4.5 Tenant cleanup

11. CLAUDE.md rule #1 — confirm all collections have `tenantId` (not `entityId` for tenant scoping). `scripts/migrate-entityid-to-tenantid.js` exists; verify it has been run on production. **Effort:** 0.5 days verification.

### 4.6 Inbox / triggers

12. **`agentTasks` collection** — needs to be designed and built. Schema, Firestore rules, security rules, indexes, UI surfaces. **Effort:** 1 week (covered in Phase 0).

---

## 5. Phased implementation plan

### Phase 0 — Foundations (4 weeks)

**Goal:** make the agent _possible_. No actual agent task automation yet.

| Workstream                | Deliverable                                                                                                                                                                                                                                         | Effort |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Agent identity            | `agent@vapourtoolbox.internal` Firebase user; `claims.agent: true`; restricted permission set; Firestore rules block destructive operations even when permission flag would otherwise allow                                                         | 3 days |
| Tool framework            | New package `packages/agent-tools/` with shared `defineTool()` helper (Zod schema, audit logging, HITL check, error wrapping). New MCP server skeleton at `mcp-servers/agent-core/`.                                                                | 5 days |
| HITL infrastructure       | `agentTasks` collection schema + Firestore rules + composite indexes. New library `apps/web/src/lib/agent/hitl.ts`: `requestApproval()`, `awaitApproval()`. UI inbox at `/admin/agent-tasks` showing pending approvals with Approve/Reject buttons. | 5 days |
| Audit trail expansion     | Wrap every accounting + procurement service write in `createAuditLog`. Add `actor: 'agent' \| 'user'` everywhere. Add `runId` propagation.                                                                                                          | 5 days |
| Memory store              | `agentMemory` collection (long-term facts), `agentRuns` collection (per-run transcripts), `agentSessions` collection (multi-turn state).                                                                                                            | 3 days |
| Observability             | `agentRuns` reporting page at `/admin/agent-runs`; basic metrics: runs/day, tools/run, cost/run, HITL rate, errors.                                                                                                                                 | 3 days |
| Inbox triggers            | Cron-based `agentTasks` poller; Gmail polling watcher (uses existing Gmail OAuth).                                                                                                                                                                  | 5 days |
| Module completeness fixes | Close all Rule #28 violations from Section 4.1 (vendorQuotes pages, entities pages, documents new button).                                                                                                                                          | 5 days |
| State machine fixes       | Close Rule #8 violations from Section 4.2 (leave, BOM, transmittal).                                                                                                                                                                                | 3 days |

**Phase 0 exit criteria:**

- Agent identity can read every collection it needs and is provably blocked from destructive ops.
- Any tool call produces an `auditLogs` row.
- Any "risky" tool call routes through `agentTasks` and the human-approver UI.
- A test agent run completes end-to-end (read-only), with full transcript visible at `/admin/agent-runs/{id}`.

### Phase 1 — Read-only assistant (2 weeks)

**Goal:** prove the agent loop works, with zero blast radius.

Tools: read-only over the whole database.

Use-cases:

1. **Q&A** — "what's the outstanding AR balance for ACME Pumps?" "show me POs over ₹5 lakh issued this month" "which proposals are awaiting approval?"
2. **Summaries** — daily standup report; weekly procurement digest; monthly vendor scorecard.
3. **Drafts (no save)** — "draft an email to vendor X about the overdue PO".
4. **Data quality flags** — surface `accounting-audit` MCP findings as a daily report.

**MCP coverage required:**

- `accounting-audit` (exists, 9 tools).
- `firebase-feedback` (exists, 5 tools).
- New `procurement-readonly` MCP — list PRs, RFQs, POs, GRs, bills with filters.
- New `accounting-readonly` MCP — list transactions, accounts, balances with filters.
- New `projects-readonly` MCP — list projects, charter status, BOMs.
- New `hr-readonly` MCP — leave balances, holidays, on-duty.
- New `email-tools` MCP — _draft only_, no send. Uses Gmail API in read mode.

**Phase 1 exit criteria:**

- Agent answers 20 hand-curated questions with >90% accuracy.
- Agent runs 7 days without an unhandled error.
- Cost per query <₹10 (target).

### Phase 2 — Procurement co-pilot (4 weeks)

**Goal:** agent drafts and submits all procurement workflow steps; humans approve every state transition.

| Workstream                          | Deliverable                                                                                                                                                   | Effort |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Procurement-write MCP               | Tools: `createDraftPR`, `submitPR`, `createDraftRFQ`, `parseVendorQuote`, `scoreOffers`, `createDraftPO`, `createGR`, `flagThreeWayMatchDiscrepancy`          | 1 week |
| HITL gates                          | All state transitions beyond DRAFT route through `agentTasks` with `requireHumanApproval: true`. Approver = current owner of `MANAGE_PROCUREMENT` permission. | 3 days |
| Document AI integration             | Wrap `parseDocumentForPR`, `parseOfferDocument` as agent tools. Agent must check confidence; <0.8 → escalate to HITL.                                         | 3 days |
| Email integration                   | Agent can send vendor reminders via Gmail (after HITL approval first 5 times, then auto if pattern is stable).                                                | 3 days |
| Vendor scoring                      | Heuristic in agent prompt: price (30%) + delivery (25%) + spec compliance (25%) + history (20%). Confirm with operations lead before deploying.               | 2 days |
| Use-case: chase missing bills       | Daily cron: agent finds POs with status=DELIVERED >5 days, no bill. Drafts vendor email. After 5 successful runs, sends without HITL.                         | 3 days |
| Use-case: recommend offer selection | When RFQ has 3+ offers in OFFERS_RECEIVED, agent scores them, writes recommendation to `agentTasks`. Human selects winner.                                    | 3 days |

**Phase 2 exit criteria:**

- Agent has drafted 50 PRs, 50 POs, 50 GRs across one month.
- HITL approval rate ≥95% (i.e. agent's drafts are usually correct).
- Three-way-match auto-resolution works for ≥80% of PO+GR+Bill triples within tolerance.
- Zero financial impact incidents.

### Phase 3 — Accounting co-pilot (4 weeks)

**Goal:** agent allocates payments, drafts JEs, reconciles bank statements; never posts directly.

| Workstream             | Deliverable                                                                                                                                                      | Effort |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Accounting-write MCP   | Tools: `createDraftInvoice`, `createDraftBill`, `createDraftJE`, `allocatePayment`, `runDepreciationBatch`, `createPaymentBatch`, `proposeReconciliationMatches` | 1 week |
| Posting gate           | All `*-post` operations through HITL. ≤₹X straight-through; >₹X requires human; >₹Y requires two humans. Thresholds configurable per company.                    | 3 days |
| Recurring transactions | Agent generates next occurrence on schedule; previews before posting; auto-posts after 5 successful HITL approvals (configurable per template).                  | 3 days |
| Bank reconciliation    | Agent matches deposits/withdrawals to transactions by amount + date proximity. Flags unmatched.                                                                  | 4 days |
| Payment allocation     | Agent matches received payments to invoices (by ID, amount, date). Routes to HITL when ambiguous.                                                                | 3 days |
| Duplicate detection    | Daily cron: scan `transactions[VENDOR_BILL]` for likely duplicates (same vendor, similar invoice number, similar amount, within 30 days). Draft consolidation.   | 2 days |
| Overdue chasing        | Daily cron: agent reads `find_overdue_items`, drafts customer-by-customer reminder emails. HITL first time per customer; auto after.                             | 2 days |
| Tax compliance prep    | Monthly: agent pre-fills GSTR-1, GSTR-3B from `gstReportGenerator.ts`. Flags inconsistencies. Human files.                                                       | 4 days |

**Phase 3 exit criteria:**

- Agent has handled 200 payment allocations, 50 bank reconciliations, 100 recurring entries.
- Zero unbalanced GL entries from agent-drafted JEs (rule #19, #21).
- GSTR-1 prep saves 80%+ of manual time.

### Phase 4 — Cross-domain workflows (4 weeks)

**Goal:** agent handles workflows that span multiple modules.

| Workflow                                                               | Modules touched                                                                            | Effort |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------ |
| **Proposal accepted → project created**                                | proposals → projects → procurement (PRs)                                                   | 1 week |
| **Project completed → fixed asset created**                            | projects → accounting (fixed assets)                                                       | 3 days |
| **Travel expense submitted → bill posted → reimbursement issued**      | hr → accounting                                                                            | 3 days |
| **Master document approved → transmittal generated → email sent**      | projects → documents → email                                                               | 3 days |
| **Leave request → balance check → approver email → approval reminder** | hr → email                                                                                 | 3 days |
| **Materials catalog import**                                           | materials → vendorQuotes (parse vendor PDFs in bulk)                                       | 1 week |
| **Vendor scorecard**                                                   | procurement + accounting (combine on-time delivery, payment terms compliance, defect rate) | 4 days |

**Phase 4 exit criteria:**

- 80%+ of proposal-to-project conversions handled without manual data entry.
- Materials catalog populated to 1000+ items.

### Phase 5 — Incoming triggers (3 weeks)

**Goal:** agent doesn't wait for users to give it tasks — it pulls work from the world.

| Trigger source         | Use-case                                                                   | Effort |
| ---------------------- | -------------------------------------------------------------------------- | ------ |
| Gmail polling          | Vendor invoice arrives → agent parses → drafts bill → HITL                 | 4 days |
| Gmail polling          | RFP from new client → agent creates enquiry → drafts proposal              | 4 days |
| Gmail polling          | Vendor quote response → agent attaches to RFQ                              | 2 days |
| Cloud Function trigger | New PO issued → agent emails vendor with PO PDF                            | 1 day  |
| Cloud Function trigger | Project budget over 80% → agent drafts variance report for PM              | 2 days |
| Scheduled cron         | Daily 8 AM: digest of overdue items, pending approvals, upcoming deadlines | 2 days |
| Scheduled cron         | Monthly 1st: depreciation, recurring JEs, vendor statement reconciliation  | 3 days |
| Scheduled cron         | Weekly: project progress reports for active projects                       | 2 days |

**Phase 5 exit criteria:**

- Agent picks up ≥10 work items per day from Gmail without manual prompting.
- 95%+ of triggered work completes within SLA (varies per task type).

### Phase 6 — Hardening & expansion (ongoing)

- Tune HITL thresholds based on accuracy data.
- Expand to Thermal calculator integration (auto-fill from project SSOT).
- Build proposal-template authoring tool.
- Build vendor onboarding workflow.
- Expand audit-trail dashboards.
- Build "agent self-review" — once per week, agent reviews its own past actions and surfaces patterns.

---

## 6. Tool inventory (full MCP/HTTP catalog to build)

This is the complete list. Building it incrementally is fine; tracking it as one inventory prevents duplication.

### 6.1 Existing MCP servers (keep + extend)

- **`accounting-audit`** — 9 tools — _no changes needed._
- **`firebase-feedback`** — 5 tools — _no changes needed._

### 6.2 New MCP servers (Phase 1)

- **`procurement-readonly`** — list/get for PR, RFQ, vendorQuote, PO, GR, packingList, WCC, ServiceOrder, Amendment, ThreeWayMatch.
- **`accounting-readonly`** — list/get transactions (filtered by type, date, account, entity); list accounts with balances; trial balance; entity ledger; project financial.
- **`projects-readonly`** — list/get projects, charter, masterDocs, transmittals, BOMs.
- **`hr-readonly`** — list/get leave requests, balances, holidays, on-duty, travel-expenses.
- **`materials-readonly`** — list/get materials, prices, stock movements.
- **`proposals-readonly`** — list/get enquiries, proposals, templates.
- **`email-readonly`** — search inbox, list threads (Gmail).
- **`agent-state`** — read agent's own memory, sessions, recent runs (for self-reference).

### 6.3 New MCP servers (Phase 2 — procurement-write)

- **`procurement-write`** —
  - `createDraftPR(items, projectId)` → returns `{prId}`.
  - `submitPRForApproval(prId)` → HITL.
  - `createDraftRFQ(prIds, vendorIds)` → `{rfqId}`.
  - `issueRFQ(rfqId)` → HITL.
  - `parseVendorQuote(filePath, rfqId)` → `{vendorQuoteId, confidence}`.
  - `scoreOffers(rfqId)` → `{recommendations[]}`.
  - `selectOffer(offerId)` → HITL.
  - `createDraftPO(offerId, terms)` → `{poId}`.
  - `submitPOForApproval(poId)` → HITL.
  - `approvePO(poId)` → HITL (and self-approval prevention).
  - `issuePO(poId)` → HITL.
  - `createGR(poId, items)` → requires `INSPECT_GOODS` + HITL.
  - `flagThreeWayMatchDiscrepancy(matchId, reason, suggestedResolution)` → HITL.
  - `chaseVendorForBill(poId)` → drafts email, HITL on first per vendor, then auto.
  - `parseInvoicePDF(filePath, vendorId)` → `{billDraft, confidence}`.

### 6.4 New MCP servers (Phase 3 — accounting-write)

- **`accounting-write`** —
  - `createDraftInvoice(customerId, items, taxes)` → `{txnId}`.
  - `createDraftBill(vendorId, items, taxes, poId?)` → `{txnId}`.
  - `createDraftJE(entries[], description)` → `{txnId}` (validates double-entry).
  - `postTransaction(txnId)` → HITL.
  - `allocatePayment(paymentId, allocations[])` → HITL when ambiguous.
  - `proposeReconciliationMatches(bankStatementId)` → `{matches[]}`.
  - `commitReconciliation(reconciliationId)` → HITL.
  - `runDepreciationBatch(period)` → preview-only; HITL to commit.
  - `createPaymentBatch(billIds[], fundSourceId)` → HITL.
  - `executePaymentBatch(batchId)` → HITL.
  - `generateRecurringOccurrence(recurringId)` → preview-only; HITL to post.
  - `prepGSTR1(period)` / `prepGSTR3B(period)` → returns filing draft.

### 6.5 New MCP servers (Phase 4 — cross-domain)

- **`projects-write`** —
  - `createProjectFromProposal(proposalId)` → HITL.
  - `updateCharterItemStatus(...)` → for items not auto-synced.
  - `draftBOM(projectId, fromTemplate?)` → preview.
  - `commitBOM(bomId)` → HITL.
  - `generateTransmittal(projectId, masterDocIds[])` → HITL.
  - `sendTransmittal(transmittalId)` → HITL.

- **`hr-write`** —
  - `processLeaveRequest(requestId, decision, reason)` → HITL when approver.
  - `parseExpenseReceipt(filePath)` → `{expenseDraft}`.
  - `submitTravelExpense(...)` → HITL.

- **`materials-write`** —
  - `parseVendorCatalog(filePath, vendorId)` → `{materialDrafts[]}`.
  - `commitMaterialBatch(materials[])` → HITL.
  - `findSubstitutes(materialId, criteria)` → list.

- **`proposals-write`** —
  - `parseRFP(filePath)` → `{enquiryDraft}`.
  - `createEnquiry(...)` → HITL.
  - `draftProposal(enquiryId, templateId?)` → preview.
  - `submitProposalForApproval(...)` → HITL.
  - `sendProposal(proposalId)` → HITL.

- **`email-write`** —
  - `draftEmail(to, subject, body)` → `{draftId}`.
  - `sendEmail(draftId)` → HITL first 5 times per recipient pattern, then conditional auto.
  - `replyToThread(threadId, body)` → same gating.

### 6.6 Total tool count

**Estimated 130–160 tools** across all MCP servers. Build incrementally; Phase 1 needs ~50, Phase 2 adds ~25, Phase 3 adds ~25, Phase 4 adds ~30, Phase 5 adds ~10.

---

## 7. HITL gate catalog

A complete enumeration of human-in-the-loop checkpoints. Default: agent never executes a "risky" action without one of these gates.

### 7.1 Always-HITL (no exceptions)

- All state transitions to APPROVED, ISSUED, POSTED, COMMITTED, SENT, EXECUTED, ACCEPTED.
- All money movements (payments, payment batches, depreciation commits).
- All emails to external parties (until trust is established per recipient pattern, then conditional auto).
- All hard deletes (rule: agent never hard-deletes; only soft-deletes via the Trash flow).
- All permission grants / role changes (rule: agent forbidden by claims).
- All schema changes / migrations (rule: agent forbidden).
- All approvals where agent itself drafted the originating item — `preventSelfApproval` enforced server-side via `claims.agent` check.

### 7.2 Threshold-HITL (config per company)

- Vendor bills > ₹X.
- Payment allocations > ₹Y.
- POs > ₹Z requires senior approver.
- JEs touching specific accounts (Retained Earnings, Inter-project loans) always HITL regardless of amount.

### 7.3 Confidence-HITL

- Document AI extractions with confidence < 0.8 → HITL review required.
- Three-way-match discrepancies > tolerance → HITL.
- Payment allocation when more than one invoice candidate matches → HITL.
- Vendor selection when scores are within 5% of each other → HITL.

### 7.4 Pattern-HITL → auto

- First 5 instances of a pattern (e.g., chasing PO/123/ABC for late delivery) require HITL approval; after 5 successful approvals, agent may execute autonomously, but every Nth (configurable) is sampled back for human review.

### 7.5 HITL response paths

For every gate, the human reviewer can:

1. **Approve** — agent executes the action.
2. **Reject** — agent abandons; logs reason; updates memory to avoid pattern.
3. **Edit-and-approve** — human modifies the proposal; agent executes the modified version; agent learns the diff.
4. **Escalate** — agent re-routes to a different approver.

All four paths log to `auditLogs` and `agentRuns`.

---

## 8. Security model

**Defense-in-depth, four layers:**

1. **Permission flags** — agent identity has `permissions = curated_subset`. No `MANAGE_USERS`, no `MANAGE_COMPANY_SETTINGS`, no `MANAGE_ADMIN`. Cannot grant itself more.

2. **Custom claims** — `claims.agent: true`. Firestore rules special-case agent: cannot hard-delete (`isDeleted` write only), cannot write to `users` (other than self), cannot modify `auditLogs` (append-only).

3. **HITL gates** — every "risky" tool checks `agentTasks` before executing. Server-side enforcement, not client-side.

4. **Service-layer validation** — every service function still runs `requirePermission`, `requireValidTransition`, `preventSelfApproval`. Agent identity has no special bypass.

**Failure modes covered:**

- Prompt injection in incoming Gmail → agent treats email content as untrusted; tool outputs that include user-controlled text are sanitized; sensitive tools (sendEmail, postTransaction) require HITL anyway.
- Agent attempts to escalate privileges → claims-based block + Firestore rules block.
- Agent loops on a failing tool → orchestrator enforces per-run tool-call limit (default 50), per-run cost limit (default ₹100), per-run wall-clock limit (default 10 min). Exceeding these stops the run and surfaces to ops dashboard.
- LLM hallucinates a tool call → tool framework rejects unknown tool names; rejects malformed input via Zod.
- Agent generates incorrect financial calc → rule #21 enforced in service layer; rule #19 (transactional reads) enforced; agent cannot bypass.

**Auditing:**

- Every tool call: `auditLogs` row with full input/output/decision/runId.
- Agent run transcripts: `agentRuns/{runId}` with all messages, tool calls, costs.
- Daily ops review: dashboard at `/admin/agent-health` showing run count, error rate, cost, HITL rate, sampled transcripts.

---

## 9. Risks & mitigations

| Risk                                            | Likelihood     | Impact | Mitigation                                                                                                     |
| ----------------------------------------------- | -------------- | ------ | -------------------------------------------------------------------------------------------------------------- |
| Agent posts incorrect JE that corrupts books    | Low            | High   | All JE posts HITL; rule #21 financial math; sample audit weekly                                                |
| Agent sends bad email to vendor/customer        | Medium         | Medium | All external emails HITL initially; per-recipient pattern learning                                             |
| Document AI / LLM hallucinates line items       | Medium         | Medium | Confidence-HITL gate; sampled human review of extracted data                                                   |
| Prompt injection via incoming email             | Medium         | Medium | Treat email content as untrusted; HITL still enforced for downstream actions                                   |
| Agent racks up Anthropic bill                   | Medium         | Low    | Per-run cost limit; daily total budget; alerting at 80%                                                        |
| Cloud Function divergence — agent bypasses sync | Medium         | Medium | Rule #19, #20, #26 enforced; only write through service functions, never raw Firestore                         |
| HITL inbox becomes overwhelming                 | High initially | Medium | Pattern-learning auto-approval after N successful approvals; tuned thresholds                                  |
| Agent's memory becomes stale or wrong           | Medium         | Low    | Memory entries have TTL; weekly memory review; user can prune                                                  |
| On-prem orchestrator goes down                  | Low            | Medium | Health-check, auto-restart; degraded mode where users continue manually                                        |
| Agent identity leaked / abused                  | Low            | High   | Strong service-account key rotation (90 days); IP-restricted Firestore rules; audit alerts on unusual activity |
| Codebase rule violations missed                 | Medium         | Medium | Run audit script (`scripts/audit/`) on agent-touched code paths; integrate into CI                             |

---

## 10. Open questions / decisions needed

These should be resolved before the team commits to a phase plan.

1. **Agent ownership** — who is responsible for agent behavior in production? (suggest: a designated "agent operator" role, separate from app users, with access to ops dashboards).
2. **HITL thresholds** — what monetary thresholds for routing? Need finance lead's input on amounts and account-specific rules.
3. **Recipient trust model** — for emails: how many successful HITL approvals before auto-send? Per-recipient or per-recipient-pattern? (suggest: per-recipient, N=5, with sampling thereafter).
4. **Local model fallback** — if Anthropic API is down, do we want a local fallback (lower quality) or just defer? (suggest: defer; agent is not real-time critical).
5. **Multi-agent vs single-agent** — should there be one big agent, or specialized agents (procurement-agent, accounting-agent, etc.)? (suggest: single orchestrator agent with specialized tool sets; subagents only for parallelizable searches).
6. **Working hours** — does agent run 24/7 or only office hours? (suggest: triggers run 24/7; HITL queue filled around the clock; humans drain it during office hours).
7. **Vendor-facing actions** — comfort level with agent-drafted emails going to vendors with company branding? Need legal sign-off.
8. **Engagement type for proposals** — confirm `PROPOSALS-WORKFLOW-DESIGN-2026-04-25.md` workflow is final before agent drafts.
9. **Cost budget** — what's the monthly Anthropic spend ceiling? (informs rate-limiting and HITL trade-offs).
10. **Disaster recovery** — agent action in flight when system fails: how do we ensure idempotency? (rule #9 covers idempotency; agent runs must be re-startable from `agentRuns` checkpoint).

---

## 11. Quick-start: the first thing to build

If you want a single concrete first commit that moves this forward, build this:

1. Create `apps/agent/` directory with a minimal Claude Agent SDK loop.
2. Create `packages/agent-tools/` with the `defineTool()` helper.
3. Create `mcp-servers/procurement-readonly/` with one tool: `listPurchaseOrders(filters)`.
4. Create `agent@vapourtoolbox.internal` Firebase user with read-only permissions.
5. Run the agent from CLI with the prompt: _"How many POs are pending approval today?"_
6. Verify the response is correct.

This is ~3 days of work. It validates the architecture end-to-end before committing to the larger plan.

---

## 12. References

- `CLAUDE.md` — coding standards and rule-numbered constraints.
- `PROCUREMENT-REVIEW-2026-04-17.md`, `PROCUREMENT-BLOCKERS-2026-04-24.md`, `PROCUREMENT-MATERIALS-AUDIT-2026-04-24.md` — procurement state.
- `ACCOUNTING-FEATURE-GUIDE-2026-04-24.md` — accounting state.
- `PROJECTS-REVIVAL-2026-04-24.md` — known project-module gaps.
- `HR-MODULE-NOTES-2026-04-24.md` — HR module status.
- `PROPOSALS-ROADMAP-2026-04-24.md`, `PROPOSALS-WORKFLOW-DESIGN-2026-04-25.md` — proposals.
- `STANDARDISATION-SWEEP.md`, `UI-STANDARDS.md` — cross-cutting patterns.
- `AUDIT-2026-03-26.md` — original 190-finding audit that produced the rules in `CLAUDE.md`.

Existing infrastructure to extend:

- [packages/constants/src/permissions.ts](packages/constants/src/permissions.ts)
- [apps/web/src/lib/auth/authorizationService.ts](apps/web/src/lib/auth/authorizationService.ts)
- [apps/web/src/lib/workflow/stateMachines.ts](apps/web/src/lib/workflow/stateMachines.ts)
- [functions/src/utils/audit.ts](functions/src/utils/audit.ts)
- [packages/firebase/src/collections.ts](packages/firebase/src/collections.ts)
- [mcp-servers/accounting-audit/index.js](mcp-servers/accounting-audit/index.js)
- [mcp-servers/firebase-feedback/index.js](mcp-servers/firebase-feedback/index.js)
- [functions/src/documentParsing/parseDocument.ts](functions/src/documentParsing/parseDocument.ts)
