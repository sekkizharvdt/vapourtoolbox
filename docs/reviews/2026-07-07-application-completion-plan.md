# Application Completion Plan — Making the Modules Talk

**Date:** 2026-07-07
**Goal:** Close the missing integrations so the app works as one machine: _thermal design → priced BOM → proposal → project → procurement → accounting_, with procurement prices feeding back into estimation and a weekly review cadence driving project execution.
**Sources:** [known-gaps.md](../workflows/known-gaps.md) (code-verified 2026-07-03), [thermal calculators review](2026-07-06-thermal-calculators-review.md), three seam audits run 2026-07-07 (thermal→BOM→proposal, procurement→pricing, flow→projects), and status checks against the working tree on 2026-07-07.
**Status:** Plan for review — no code written.

---

## 0. What is already built (verified — do not rebuild)

- **Procurement → price feedback for materials is LIVE.** PO creation (`purchaseOrder/crud.ts:594`), quote evaluation (`vendorQuoteWorkflow.ts:349`), per-line quote accept (`vendorQuoteService.ts:877`), and GR→vendor-bill (`accountingIntegration.ts:376`, landed cost as `VENDOR_INVOICE`) all write `materialPrices` → denormalized to `material.currentPrice` → read by BOM costing (`bomCalculations.ts:67`). The estimate-accuracy flywheel exists for catalog-linked material lines.
- **Proposal outcome actions + conversion path** (gap 0.1) — fixed, shipped (`bfa8013a`, `734f1e1c`, `576e40f8`, `15c4ca88`). Scope matrix and payment milestones carry into the charter.
- **Duplicate cost-centre at charter approval** — fixed (`0dca8184`). (Self-approval half of gap 0.2 still open — see B4.)
- **Procurement feedback round 4** — implemented (`c4fed8df` PL-before-GR + qty guards, `8effeb78` PO status auto-advance, `eedef7be` return-with-comments + REJECTED recovery). Decisions locked; don't re-litigate.
- **Verification harness** — GL invariant tests, security-rules tests, e2e money-path smoke + deploy gate, nightly data-integrity audit, test-presence ratchet (`30dd2dad`…`0d2c39dc`).
- **Meetings → tasks**: `finalizeMeeting` (`meetingService.ts:365`) already creates `manualTasks` from action items transactionally. Meetings already link to projects.
- **Project roll-ups**: procurement statuses and budget actuals already sync onto the project doc via `procurementProjectSync.ts` and `projectFinancials.ts`.

**NOT implemented despite existing plan docs:** the scope-aware pricing model from `2026-05-25-proposal-scope-pricing-link-and-ui.md` (no `breakdownMode`/`scopeCategoryKeys` in `proposalPricing.ts`) and payment-batch execution (no `executeBatch` anywhere).

---

## Track A — Commercial spine: design → estimate → quote (the revenue path)

The single most valuable track. After A1–A3 the sequence "run MED designer → priced BOM → proposal → PDF" exists end-to-end.

### A1. Wire BOM → Proposal cost basis — **S (≈1 day), do first**

The placeholder is waiting: `BOMCostSheetBlock.linkedBomIds` exists (`proposalPricing.ts:101-105`), `recomputeBlockSubtotal` deliberately no-ops it (`pricingBlocks.ts:171-174`), and `PricingBlocksEditor.tsx:667-677` renders "BOM linking comes in the next ship".

1. BOM picker dialog on the block (list `boms` filtered to non-deleted, show `bomCode`/`name`/`summary.totalCost`; rule 3 client-side soft-delete filter).
2. Subtotal = Σ linked `BOM.summary.totalCost.amount` (INR; blocks are INR-basis). Recompute on proposal open and on a "Refresh from BOM" action — no live listener needed.
3. Stamp `proposalId` on linked BOMs (field exists, `bom.ts:113-147`); show back-link on the BOM editor.
4. **Delete the legacy type-only path** (rule 32): `LinkedBOM` / `ScopeItem.linkedBOMs` / `estimationSummary` (`proposal.ts:63-115`) — only `projectConversion.ts:71` reads it defensively; repoint that read at the pricing block or remove.
5. Round-trip test: link → subtotal → commercial summary → conversion budget.

### A2. Plug the three pricing-feed leaks — **M (2–3 days), decision needed first**

> **DECISION (user):** BOM `BOUGHT_OUT` component lines read the **materials** collection (`bomCalculations.ts:48-58`), while the separate `bought_out_items` catalog carries its own `pricing.listPrice` + `bought_out_prices` history that the BOM never sees. Options:
> (a) **Consolidate** — bought-out catalog items become/reference material-master entries so one price pipeline serves everything; or
> (b) **Bridge** — BOM items gain `boughtOutItemId` and the cost calc reads `bought_out_items.pricing`.
> Recommendation: **(a)** long-term one-pipeline, but it's a data/model consolidation project; **(b)** is the pragmatic near-term fix. Decide before A3, because MED BOMs are full of bought-out items (instruments, valves, pumps).

1. **Service rates:** BOM service cost currently uses `rateOverride ?? 0` (`serviceCalculations.ts:98`) and never falls back to `Service.defaultRateValue`; the `serviceRates` collection is write-only (written by quote accept `vendorQuoteService.ts:898-913`, read by nothing). Fix: fallback chain `rateOverride → latest active serviceRate → defaultRateValue`, and surface which source priced the line.
2. **Bought-out feedback:** add `boughtOutItemId` to `PurchaseOrderItem` (`purchaseOrder.ts:192-251` — quote items already carry it, `vendorQuote.ts:216`) and extend `recordProcurementPrices` + the GR/bill path to write `bought_out_prices` for those lines.
3. **Free-text leakage visibility:** `recordProcurementPrices` silently drops lines without `materialId` (`pricing.ts:220`). Log a count and show a soft nudge in PO/quote UIs ("3 lines not linked to a catalog item — their prices won't improve future estimates").

### A3. Thermal → BOM export — **L (4–6 days)**

`generateMEDBOM` output (`medBOMGenerator.ts:225`, weight-only, free-text materials, no ids) is consumed only by the MED wizard PDF. Nothing persists it.

1. **"Export to Estimation BOM"** action in the MED wizard: creates a real `boms` doc + items subcollection via `bomService`.
2. **Material-mapping step** (the real work): resolve each `MEDBOMItem.material` + form to a materials-master `materialId`. Build a small persistent mapping table (`thermal material string → materialId`) so mapping is one-time per material, not per export. Unmapped lines land as flagged zero-cost items — never block the export.
3. Instruments/valves/accessories map to bought-out lines (per the A2 decision).
4. Design the converter generically (`ThermalBOMItem[] → BOMItem[]`), MED as the first caller — this is the first concrete step of the parked **assembly-templates** ambition; don't hardcode MED.
5. Prereq from the thermal review: **H4** (MED wizard save/load drops 8 design inputs) must be fixed first, or an exported BOM can't be traced back to the design that produced it.

### A4. Scope ↔ pricing link (existing plan) — **M–L, after A1**

Adopt `2026-05-25-proposal-scope-pricing-link-and-ui.md` as written (scope-aware `PriceSection` with optional itemization, `scopeCategoryKey` on pricing blocks, merged Commercials view). It was blocked behind procurement work that has since shipped. A1's BOM block slots into that model unchanged.

### A5. BOM → Purchase Request handoff (gap 1.7) — **M**

BOMs are cost sheets only: no BOM→PR service/button, BOM statuses beyond DRAFT unused. After a proposal wins and converts, the project's procurement should be seedable from the BOM:

1. BOM submit/approve flow (statuses exist; add the two transitions to `stateMachines.ts`, rule 8).
2. "Create PR from BOM" on an approved, project-linked BOM → drafts a PR with material/bought-out lines (`linkedPurchaseRequestId` back-refs; denormalize per rule 26).
3. This closes the loop: the same BOM that priced the proposal drives the buying, and the resulting POs feed prices back into the next estimate.

---

## Track B — Execution loop: flow, meetings, project tracking

### B1. Two one-line link fixes — **S (hours)**

- `finalizeMeeting` drops the meeting's `projectId` when creating tasks (`meetingService.ts:433-448`) — propagate it.
- `CreateTaskDialog.tsx` doesn't expose project linkage though `ManualTask.projectId` + service filter exist — add an optional project selector.

### B2. Weekly review cadence — **M (2–3 days)**

No recurrence concept exists. Don't build RRULE. Instead:

1. **"Start next review"** action on a finalized meeting: creates next week's meeting pre-filled with attendees, project link, and an agenda seeded with **open action items carried forward** (query `meetingActionItems` where `generatedTaskId`'s task ≠ done).
2. Meeting detail shows live status of generated tasks (join on `generatedTaskId`).
3. Optional later: a scheduled function that nudges when a project's last review meeting is > 7 days old.

### B3. Review/portfolio dashboard — **M (2–3 days)**

No cross-project view exists; all the data is already on the project docs (synced by Cloud Functions). One page (`/flow` or `/projects` tab): per active project — open tasks, overdue action items, upcoming/overdue charter deliverables, procurement item statuses, budget utilization %, days since last review meeting. This page **is** the weekly meeting agenda; it makes B2 effective. Composite indexes per rule 2 for any new queries.

### B4. Charter approval hygiene (rest of gap 0.2) — **S**

Charter still goes DRAFT → APPROVED by anyone with `MANAGE_PROJECTS`, author included (`CharterTab.tsx:137`, no `preventSelfApproval`, `PENDING_APPROVAL` never written). Add submit step + `preventSelfApproval` + audit event, matching every other approval flow (rule 6/18).

### B5. Real progress + alerts — **S–M**

- Populate `Project.progress` from charter-deliverable acceptance (field exists, `project.ts:133-137`, never written); Timeline currently shows elapsed-time % (`TimelineTab.tsx:214`).
- Budget 90 %/100 % thresholds: replace the `// TODO` logs (`projectFinancials.ts:162,168`) with `taskNotifications` (gap 4.4).
- Delete the dead `project_milestones` collection declaration (nothing reads/writes it; milestones live as charter deliverables).
- Verify **the Desolenator conversion end-to-end** (PO26XP062901, USD proposal, 3 payment milestones) — the acceptance checklist in known-gaps 0.1 stands.

---

## Track C — Money completion (accounting P1/P2)

### C1. Payment batch execution (gaps 1.1 + 2.7) — **M–L**

Still unwired (verified: no `executeBatch`; "Execute Payments" has no `onClick`, `PaymentBatchDetailClient.tsx:466`). Implement `executeBatch`: state machine APPROVED→EXECUTING→COMPLETED, per-payment `VENDOR_PAYMENT` transactions inside `runTransaction`, idempotent (rule 9), `retryOnStaleToken` on every call (rule 35), audit events, interproject-loan posting. Replace the hardcoded `'primary-bank'` account (2.7) with a real bank-account selector.

### C2. DRAFT transactions move GL balances (gap 2.1) — **M, high integrity value**

`onTransactionWrite` applies GL entries regardless of status. Decide the posting boundary (recommend: entries affect balances only at `APPROVED`/`POSTED`), change `accountBalanceLogic` accordingly, then run "Recalculate Balances". The nightly `dataIntegrityAudit` should gain a check for it. Coordinate with C4's POSTED concept.

### C3. Missing create UIs: Bank Transfer & Expense Claim (gap 1.2) — **M**

Types/numbering/labels/report handling exist; only dialogs are missing. Follow `/new-dialog` + rule 35 sweep; reuse `CreateInvoiceDialog` patterns.

### C4. Invoice "Send" + explicit POSTED step (gap 1.8) — **S–M**

Dead button at `invoices/page.tsx:614`. Define what "send" means now (mark SENT + PDF email later); align status machine with C2's posting boundary.

### C5. Fiscal period close (gap 1.3) — **M, schedule before FY-end**

Close/lock/reopen UI + the three stubbed year-end helpers (`fiscalYearService.ts:426-451`). Low urgency today, hard deadline ~March 2027.

### C6. Fixed-asset disposal GL (gap 2.2) — **S–M**

Disposal/write-off currently status-only; post the journal (gain/loss vs NBV).

---

## Track D — Reliability & trigger fixes (small, high-annoyance)

One batch of small verified bugs, each ≤ half a day:

| Item | Fix                                                                                                                                                                          | Ref                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| D1   | On-duty email trigger listens on `onDutyRecords`; data is in `hrOnDutyRequests`                                                                                              | gap 1.4, `functions/src/email/triggers.ts`                |
| D2   | Server `generateTransmittal` reads stale schema (`submissions`/`documentFileUrl` vs `documentSubmissions`/`files[]`)                                                         | gap 1.5                                                   |
| D3   | WCC notification deep-link 404 (`work-completions` vs `work-completion`)                                                                                                     | gap 1.6                                                   |
| D4   | GSTIN denorm sync reads top-level `gstin`; data at `taxIdentifiers.gstin`                                                                                                    | gap 2.5                                                   |
| D5   | `PERMISSION_FLAGS` hand-copied in `userManagement.ts` — import from a shared location or add a sync test                                                                     | gap 2.6                                                   |
| D6   | Best-effort procurement→accounting handoffs swallow errors — on failure create a `taskNotification` ("advance payment failed to draft — create manually") instead of silence | gap 2.3, rule 27                                          |
| D7   | Race-prone numbering: move enquiry/proposal/project/PR/TWM/BO/SVC generators to counter-backed transactions (pattern exists in `generateTransactionNumber`)                  | gap 2.4, rule 32 — consolidate, don't add a 5th generator |
| D8   | Comp-off lifecycle: expiry sweep + revoke-on-cancel + include COMP_OFF in annual reset                                                                                       | gap 2.8                                                   |

**Authorization hygiene batch (P3):** `/admin` gated on `MANAGE_USERS` only (3.1); `ApproveUserDialog` missing `updatedBy` (3.2); Preview page bypasses `markProposalAsSubmitted` (3.3); charter PR auto-draft attributed to 'System' (3.4); employee-edit optional permission param (3.5); SSOT write-access checks skipped client-side (3.6); entity edits bypass callable (3.7). All small; one sweep.

---

## Track E — Thermal correctness (from the 2026-07-06 review)

Independent of the integration tracks except E-H4 (prereq for A3). Order within the track:

1. **Quick wins batch** (hours): GOR calculator into the index + MVC → `available` (H5); PressureDrop viscosity one-liner; `saveCalculation` undefined-strip (rule 12, fixes 24 callers); required `calculatorType` on shared dialogs; the five missing warnings (motor cap, laminar Re, spray band, motive≤discharge, 24 h cap).
2. **H1 Bowman F-factor** — wrong formula, areas mis-sized up to ~2×; add F-chart reference tests.
3. **H2 wetting limit** — surface Γ_min = 0.03 as governing in falling-film/single-tube (gold standard; never relax the MED value).
4. **H3 lateral-bundle exclusion zones** — placement fix + draw zones in `BundleDiagram`.
5. **H4 MED wizard save/load round-trip** (8 dropped inputs) + payload-vs-memo-deps test — **before A3**.
6. **Paired condenser fixes** (wall-temp anchor + bundle correction; Chato + film-ΔT) — re-baseline against BARC.
7. **One external anchor test per calculator** (the review's highest-leverage test investment).
8. Remaining medium items (schedule dims, CIP density, circular design checks, dead inputs/code) as a cleanup batch.

---

## Track F — Polish (do opportunistically, never as a dedicated sprint)

P4 items from known-gaps (amendment recall, GR PENDING state, RFQ issue PDF/email, entity role filter, SSOT export/cascade, submission numbering), thermal feature adds (`useSavedCalculation` hook, My Calculations page, cross-calculator pipelines, report-shell consolidation), UI-standardisation ratchets (existing plan, keeps enforcing itself via `check-ui-standards.js`), Trash/restore surfaces beyond accounting/procurement (3.8), Flow email triggers if desired (4.10).

---

## Suggested sequence

Each phase is a coherent shippable unit (CI deploy per rule 33). Rough calendar assumes solo development with existing quality gates.

| Phase                               | Contents                                                     | Effort     | Value unlocked                                            |
| ----------------------------------- | ------------------------------------------------------------ | ---------- | --------------------------------------------------------- |
| **1. Quote spine**                  | A1 → A2 (decision first) → E-quick-wins + E-H4 → A3          | ~2 weeks   | MED design → priced BOM → proposal, prices auto-improving |
| **2. Execution loop**               | B1 → B4 → B2 → B3 → B5 (incl. Desolenator conversion verify) | ~1.5 weeks | Weekly review machine; projects visibly tracked           |
| **3. Money integrity**              | C1 → C2 → C4 → C3                                            | ~1.5 weeks | Payments actually execute; balances trustworthy           |
| **4. Reliability sweep**            | D1–D8 + P3 batch                                             | ~1 week    | Silent failures stop being silent                         |
| **5. Thermal correctness**          | E2–E7                                                        | ~1.5 weeks | Calculators safe to trust for design                      |
| **6. Scope-aware pricing + BOM→PR** | A4 → A5                                                      | ~1.5 weeks | Full scope↔cost↔price trace; estimate drives buying       |
| ongoing                             | C5 before FY-end; Track F opportunistic                      | —          | —                                                         |

Phases 2/5 can swap or interleave with 1/3 freely; 6 depends on 1. Within the first phase, **A1 is day one** — smallest change, immediate payoff, and it forces the A2 decision.

## Decisions needed from the user

1. **A2:** bought-out catalog — consolidate into materials master, or bridge BOM→`bought_out_items`? (Blocks A3 design.)
2. **C2:** confirm the GL posting boundary (recommend: balances move at APPROVED/POSTED only) — requires one recalculation pass after deploy.
3. **Phase order:** revenue spine first (as proposed) vs money integrity first — depends on whether estimating/quoting or accounting trust is the nearer pain.

## Cross-cutting rules for every item

- Follow CLAUDE.md rules; run `/check-duplicates` before any new collection/route/service; state machines in `stateMachines.ts`; permission + self-approval checks server-side; audit events for approvals/status transitions; composite indexes + security rules for new queries/collections; `retryOnStaleToken` on every Firestore call in save handlers; no migration/back-compat code without counting real records first.
- Every phase ends with `/verify` on the real flow it changed, and ships via the Deploy dispatch — no local deploys.
- Update `known-gaps.md` (check off) and `MODULE_MAP.md` as items land.
