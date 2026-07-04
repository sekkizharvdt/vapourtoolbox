# Enquiries, Proposals & Projects — User Workflows

> Generated 2026-07-03 from code inspection (routes, services, state machines, Cloud Functions). Part of the [module workflow docs](README.md).

## 1. Pipeline Overview

The sales-to-delivery pipeline spans three Firestore collections — `enquiries`, `proposals`, `projects` — plus downstream procurement/accounting artifacts created automatically by Cloud Functions.

```
Enquiry (intake, AI parse, bid decision)
   │  BID decision  →  PROPOSAL_IN_PROGRESS
   ▼
Proposal (scope → costing → pricing → terms → PDF)
   │  DRAFT → PENDING_APPROVAL → APPROVED → SUBMITTED (to client)
   │  → UNDER_NEGOTIATION → ACCEPTED
   ▼  convertProposalToProject (requires ACCEPTED)
Project (charter DRAFT)
   │  charter DRAFT → APPROVED
   ▼  (Cloud Function side-effects on approval)
Execution:  Cost Centre  ·  auto-drafted Purchase Requests (BOM/procurement)
            ·  Document Requirements  ·  Budget actuals roll-up
```

Key handoffs, each grounded in code:

- **Enquiry → Proposal**: `createMinimalProposal` inherits `workComponents`, `requestedScope` (AI-parsed scope → `unifiedScopeMatrix`), client details, and seeds costing/pricing/terms blocks; then flips the enquiry to `PROPOSAL_IN_PROGRESS` (`apps/web/src/lib/proposals/proposalService.ts:243`).
- **Proposal → Project**: `convertProposalToProject` builds a `Project` with charter, budget line items (from supply scope items), objectives/deliverables/scope from the proposal (`apps/web/src/lib/proposals/projectConversion.ts:22`).
- **Project charter approval → Procurement/Accounting**: `onCharterApproved` auto-drafts PRs; `CharterTab` + `onProjectCreated` create a cost centre; `onTransactionWriteUpdateProjectFinancials` rolls actual costs back into the project budget.

---

## 2. Step-by-step "How to..." guides

### 2.1 Log an enquiry (manual)

Route: `apps/web/src/app/proposals/enquiries/page.tsx` → opens `CreateEnquiryDialog` (there is no `/new` route by design; see `rule28-exempt` note at top of the list page).

1. Click **New Enquiry** on the enquiries list.
2. Fill client (existing entity), title, description, received-via, work components, conditions, urgency, etc. Validated by `createEnquiryFormSchema` (`@vapour/validation`).
3. Optionally add conditions by hand via the `ConditionsEditor` (`CreateEnquiryDialog.tsx:856`).
4. Save → `createEnquiry` (`enquiryService.ts:88`) generates number `ENQ-YY-NN`, sets `status: 'NEW'`, `attachedDocuments: []`.

### 2.2 Log an enquiry (AI-parsed from an SOW/RFP PDF)

1. In `CreateEnquiryDialog`, use the "SOW reader" — it calls the callable Cloud Function `parseEnquiryDocument` with the PDF inline as base64 (`CreateEnquiryDialog.tsx:286`).
2. `functions/src/enquiryParsing/parseEnquiryDocument.ts` sends the PDF to Claude (`asia-south1`, 10 MB max, PDF-only) and returns three blocks: `fields`, `conditions` (categorised buyer stipulations with verbatim quotes), and `scope` (discipline-grouped work items classified SERVICE/SUPPLY). It logs a job doc to `enquiryParsingJobs`.
3. The dialog pre-fills the form fields, seeds `conditions[]`, and stores `requestedScope` (a `UnifiedScopeMatrix`) which is saved onto the enquiry (`CreateEnquiryDialog.tsx:393`).
4. You can also parse an SOW after creation from the enquiry detail page via `ParseExistingPdf` (`EnquiryDetailClient.tsx:553`).
5. **Scope triage**: `apps/web/src/app/proposals/enquiries/[id]/scope-triage/ScopeTriageClient.tsx` lets a user refine the parsed matrix and writes it back to `enquiry.requestedScope` via `updateEnquiry`.

### 2.3 Record a bid / no-bid decision

On the enquiry detail page, **Bid Decision** button (hidden once WON/LOST/CANCELLED/NO_BID) opens `BidDecisionDialog`.

- `recordBidDecision` (`enquiryService.ts:505`) requires current status ∈ {NEW, UNDER_REVIEW, BID_DECISION_PENDING}, stores a 5-criteria `BidEvaluationCriteria` + rationale, and sets status to `PROPOSAL_IN_PROGRESS` (BID) or `NO_BID` (terminal).
- `reviseBidDecision` (`enquiryService.ts:621`) allows changing the decision **only before a proposal exists** and before terminal state; it keeps a `previousDecision` audit trail.

### 2.4 Create a proposal from an enquiry

On the enquiry detail page, **Create Proposal** opens `CreateProposalDialog` → `createMinimalProposal` (`proposalService.ts:243`):

- Requires `enquiry.bidDecision.decision === 'BID'` (throws otherwise).
- Guards against a parallel active proposal via `findActiveProposalForEnquiry` (active = DRAFT/PENDING_APPROVAL/APPROVED/SUBMITTED/UNDER_NEGOTIATION); revisions live under the existing proposal.
- Generates `PROP-YY-NN`, `revision: 1`, `status: 'DRAFT'`, `workflowStage: 'SCOPE_DEFINITION'`.
- Seeds: `pricingBlocks` from work components, `clientPricing` defaults (INR, GST 18%, fxRate 1), `termsBlocks` (`buildDefaultTermsBlocks`), `qualifications`, `projectBrief`, `coverLetter`, and inherits `unifiedScopeMatrix` from `enquiry.requestedScope`.
- Flips enquiry → `PROPOSAL_IN_PROGRESS`.

The proposal detail page (`ProposalDetailClient.tsx`) exposes tabs: Overview, Description, Qualifications, Scope, Compliance, Costing, Pricing, Delivery, Terms, Cover Letter, Preview. **All tabs are read-only unless `status === 'DRAFT'`** (`isLocked`, `ProposalDetailClient.tsx:524`; server-enforced in `updateProposal`, `proposalService.ts:593`).

### 2.5 Build pricing (costing vs pricing blocks)

`apps/web/src/lib/proposals/pricingBlocks.ts`:

- **Costing tab** (internal, always INR): `seedPricingBlocksForComponents` maps work components → blocks: SURVEY → Manpower roster + Per-manday; ENGINEERING → Manpower; SUPPLY → BOM cost sheet; INSTALLATION → Manpower; OM → Manpower. Every block is `audience: 'INTERNAL'`.
- Block types: `MANPOWER_ROSTER` (mandays × dayRate), `PER_MANDAY_COST` (mandays × ratePerManday), `LUMP_SUM_LINES` (sum of amounts), `BOM_COST_SHEET` (subtotal from linked BOM IDs). `recomputeBlockSubtotal` recomputes row + block totals (pure).
- **Pricing tab** (client-facing): `createDefaultClientPricing` seeds `ClientPricing` with `overhead/contingency/profit` %, `priceSections`, `taxRate 18 / GST 18%`, `currency INR`, `fxRate 1`. The user can switch quote currency/fx here for foreign clients. Editors: `pricing/PricingBlocksEditor.tsx`, `pricing/PricingEditor.tsx`.
- The canonical roll-up is `computeCommercialSummary` (`lib/proposals/commercialSummary.ts`), used by the Overview pricing summary, revision diffs, and project-conversion budget.

### 2.6 Generate the proposal PDF

`apps/web/src/lib/proposals/proposalPDF.ts`:

- `downloadProposalPDF` / `generateProposalPDF` render `ProposalPDFDocument`, pulling **live** company profile (`company/settings`), logo, and client entity address (`loadClientProfile` rebuilds address from the entity, not the denormalised string).
- `saveProposalPDF` uploads to `entities/{tenantId}/proposals/{id}/generated/{PROP-..._RevN}.pdf` and writes `generatedPdfUrl` + `generatedPdfStoragePath` back to the proposal.
- In the UI, the header **Download PDF** offers download-only or download-and-save (`ProposalDetailClient.tsx:564`). `getAvailableActions.canDownloadPDF` is true for APPROVED/SUBMITTED/ACCEPTED (`approvalWorkflow.ts:667`).

### 2.7 Submit for approval / approve / reject / request changes

All in `apps/web/src/lib/proposals/approvalWorkflow.ts`; every function validates via `proposalStateMachine` and requires `PERMISSION_FLAGS.MANAGE_PROPOSALS`.

- **Submit** (`submitProposalForApproval:30`): DRAFT → PENDING_APPROVAL. Submitter picks an approver (`SubmitForApprovalDialog`); **cannot pick themselves** (separation of duty). Sets `submittedByUserId/Name`, `approverUserId/Name`; creates an actionable task for the chosen approver (or broadcasts to all `MANAGE_PROPOSALS` users via `getProposalApprovers` if none chosen).
- **Cancel submission** (`cancelProposalSubmission:153`): PENDING_APPROVAL → DRAFT, **only the original submitter** may cancel; dismisses the approver's task.
- **Approve** (`approveProposal:231`): PENDING_APPROVAL → APPROVED. `preventSelfApproval` blocks the submitter from approving; appends an `ApprovalRecord`, completes the review task, notifies the submitter. Approve/Reject/Request-Changes buttons are hidden from the submitter (`canAct = !isSubmitter`, `ProposalDetailClient.tsx:508`).
- **Reject** (`rejectProposal:343`): PENDING_APPROVAL → DRAFT (internal return-for-revision, not terminal). Also `preventSelfApproval`. (REJECTED terminal is reserved for client rejection.)
- **Request changes** (`requestProposalChanges:453`): PENDING_APPROVAL → DRAFT with a `REQUESTED_CHANGES` record.

### 2.8 Submit to client

Preview page (`apps/web/src/app/proposals/[id]/preview/PreviewClient.tsx:171`): **Submit to Client** calls `updateProposal(..., { allowWorkflowChange: true })` writing `status: 'SUBMITTED'` + `submittedAt`. (Note: it bypasses the dedicated `markProposalAsSubmitted` helper.) `submittedAt` = date sent to client (distinct from internal approval submission).

### 2.9 Revise a proposal

- Menu **Create Revision** (`CreateRevisionDialog`) → `createProposalRevision` (`proposalService.ts:654`). In a transaction it marks the current record `isLatestRevision: false` and creates a new doc: same `proposalNumber`, `revision+1`, `status: 'DRAFT'`, `previousRevisionId`, cleared workflow/PDF/approval fields.
- Only the **latest revision** in states APPROVED/SUBMITTED/UNDER_NEGOTIATION/REJECTED/ACCEPTED/EXPIRED can spawn a revision (`canCreateRevision`, `ProposalDetailClient.tsx:518`); a plain DRAFT is just edited.
- `compareRevisions` (`revisionManagement.ts:34`) diffs pricing (via commercial summary), scope matrix, terms, delivery.
- Related: **Clone** (`cloneProposal`, `proposalService.ts:807`) makes an independent new proposal with copy toggles; **Save as Template** (`proposalTemplateService`).

### 2.10 Mark won / lost (record the client outcome)

- **On the proposal (canonical path, added 2026-07-03)**: when the proposal is SUBMITTED or UNDER_NEGOTIATION, the detail page shows a **Mark as Awarded** header button plus **Mark Under Negotiation / Mark as Lost / Mark as Expired** in the More menu. All call `recordProposalOutcome` (`approvalWorkflow.ts`): requires `MANAGE_PROPOSALS`, validates the transition via `proposalStateMachine`, writes the status + optional reason, **syncs the linked enquiry** (ACCEPTED → WON, REJECTED → LOST, stamping `outcomeDate`), and audit-logs (`PROPOSAL_ACCEPTED` / `PROPOSAL_MARKED_LOST` / `PROPOSAL_MARKED_UNDER_NEGOTIATION` / `PROPOSAL_MARKED_EXPIRED`). "Mark as Lost" requires a reason.
- **On the enquiry**: detail-page overflow menu **Mark as Won / Mark as Lost** → `updateEnquiryStatus` (`enquiryService.ts:310`), which stamps `outcomeDate`/`outcomeReason` for WON/LOST/CANCELLED. ⚠ **Known gap (residual)**: this direction updates only the enquiry — it does **not** transition the linked proposal. Prefer recording the outcome on the proposal, which syncs both.

### 2.11 Convert a proposal to a project

- Header **Convert to Project** appears when `canConvertToProject` is true, i.e. `status === 'ACCEPTED'` and no existing `projectId` (`projectConversion.ts:265`). Reached via **Mark as Awarded** (§2.10).
- `ConvertToProjectDialog` → `convertProposalToProject` (`projectConversion.ts:22`), in a `runTransaction` (guards double-click). It creates a `Project` and links `proposal.projectId/projectNumber/convertedToProjectAt/By`.
- **What gets created on the project**: number `PROJ-YYYY-XXXXXX`; `status: 'PLANNING'`; client block, PM = creator, team = [creator]; dates from `deliveryPeriod.durationInWeeks`; `budget.estimated` = `computeCommercialSummary().targetRevenueInr`; a full `charter` with authorization (`approvalStatus: 'DRAFT'`, sponsor = creator), objectives/deliverables/scope from the proposal, `budgetLineItems` derived from included **supply** scope items (`deriveIncludedByClassification(...).supply`), a client stakeholder.

### 2.12 Fill and submit a project charter

Route: `apps/web/src/app/projects/[id]/charter/*`, tabbed (`CharterTab`, `ScopeTab`, `BudgetTab`, `ProcurementTab`, `DocumentsTab`, `TeamTab`, `TimelineTab`, `VendorsTab`, `TechnicalTab`, `ReportsTab`, `OverviewTab`).

- **CharterTab** (`components/CharterTab.tsx`): edit the Authorization section (sponsor name/title, budget authority) via `handleSaveAuthorization` → writes `charter.authorization` with `approvalStatus: 'DRAFT'`. Editing requires `canManageProjects` and is blocked once APPROVED.
- Completeness is scored by `validateCharterForApproval` (`charterValidationService.ts:34`): required = authorization (sponsor name/title + budget authority), ≥1 objective (with description), ≥1 deliverable (name+description), scope in-scope items, ≥1 budget line item (description + cost>0 + executionType), risks are a warning. Returns `completionPercentage` + errors/warnings.
- ⚠ **Known gap**: there is **no `PENDING_APPROVAL` submit step** in the charter UI. The charter goes straight DRAFT → APPROVED (or REJECTED). `PENDING_APPROVAL` only appears in a status-color switch, never written.

### 2.13 Charter approval

- **CharterTab.handleApprove → proceedWithApproval** (`CharterTab.tsx:110`): runs `validateCharterForApproval`; blocks on errors, confirms through warnings, then writes `charter.authorization.approvalStatus: 'APPROVED'` + `approvedBy/approvedAt/authorizedDate`, and calls `createProjectCostCentre` (accounting) storing `costCentreId` on the project.
- Gate: `canApprove = hasManageAccess && approvalStatus !== 'APPROVED'` where `hasManageAccess = canManageProjects(permissions)`. ⚠ **No self-approval prevention** and **no separate approver** — the same user who drafted can approve, gated only by `MANAGE_PROJECTS`.
- **Reject** (`confirmRejection:195`): writes `approvalStatus: 'REJECTED'` + rejectionReason.
- **Automatic side effects on approval** — Cloud Function `onCharterApproved` (`functions/src/charterApproval.ts:189`) fires on the DRAFT→APPROVED transition and auto-drafts Purchase Requests for `procurementItems` that are HIGH/CRITICAL, `status: 'PLANNING'`, and not yet linked; it then flips those items to `PR_DRAFTED` with `linkedPurchaseRequestId`.

### 2.14 Set up budget

- **BudgetTab** (`components/BudgetTab.tsx`): manage `charter.budgetLineItems` (description, `executionType` IN_HOUSE/OUTSOURCED, `estimatedCost`, currency, `linkedVendorId`). `isBudgetLocked = isCharterApproved` — editing is frozen once the charter is approved.
- Actuals: `calculateProjectTotalActualCost` (`budgetCalculationService.ts`) aggregates posted expense transactions (`VENDOR_BILL`/`VENDOR_PAYMENT`/`EXPENSE_CLAIM`, status APPROVED/POSTED) by `budgetLineItemId`, matched on `costCentreId === projectId`.

### 2.15 Manage milestones

- **Proposal milestones**: `deliveryPeriod.milestones` on the Delivery tab (`DeliveryEditor.tsx`); each carries `milestoneNumber`, description, `paymentPercentage` (drives `generatePaymentTermsFromMilestones`).
- **Project charter deliverables & timeline**: charter `deliverables` (with `dueDate`) and the Timeline page (`projects/[id]/timeline`, "Timeline & Milestones") derive events from deliverables + document requirements.

### 2.16 Manage document requirements & procurement items

- **Document requirements** (`documentRequirementService.ts`): `addDocumentRequirement` (status `NOT_SUBMITTED`), `updateDocumentRequirement`, `deleteDocumentRequirement`, `linkDocumentToRequirement` (→ SUBMITTED), `updateRequirementFromDocumentStatus` (→ APPROVED/REJECTED). Managed on **DocumentsTab**.
- **Procurement items** (`charterProcurementService.ts`): `addProcurementItem` (validates preferred vendors exist/not archived, status `PLANNING`), `updateProcurementItem`, `deleteProcurementItem`, `createPRFromCharterItem` (manual PR draft, batched, links item → `PR_DRAFTED`), `syncProcurementItemStatus`. Managed on **ProcurementTab** (add/create disabled once charter APPROVED, per `ProcurementTab.tsx:350`).

---

## 3. Lifecycle / Status transition tables

### 3.1 Enquiry (`EnquiryStatus`, `packages/types/src/enquiry.ts:13`; transitions from `enquiryService.ts`)

| From                                      | Action                       | To                                                                           | Who / Gate                                                                                                                 |
| ----------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| —                                         | Create enquiry               | NEW                                                                          | Creatable per firestore.rules (client uses `createEnquiryFormSchema`; no explicit client permission gate — `rule5-exempt`) |
| NEW / UNDER_REVIEW / BID_DECISION_PENDING | Record bid decision = BID    | PROPOSAL_IN_PROGRESS                                                         | `recordBidDecision`                                                                                                        |
| NEW / UNDER_REVIEW / BID_DECISION_PENDING | Record bid decision = NO_BID | NO_BID (terminal)                                                            | `recordBidDecision`                                                                                                        |
| PROPOSAL_IN_PROGRESS                      | Create proposal              | PROPOSAL_IN_PROGRESS (set by `createMinimalProposal`)                        | MANAGE_PROPOSALS (create proposal)                                                                                         |
| any active                                | Submit proposal to client    | PROPOSAL_SUBMITTED (via `updateEnquiryStatus`, stamps `proposalSubmittedAt`) | — (helper)                                                                                                                 |
| any non-terminal                          | Mark as Won                  | WON (terminal, `outcomeDate`)                                                | Enquiry detail menu                                                                                                        |
| any non-terminal                          | Mark as Lost                 | LOST (terminal)                                                              | Enquiry detail menu                                                                                                        |
| any                                       | Delete (soft)                | CANCELLED                                                                    | owner or `EDIT_ENTITIES` (`deleteEnquiry`)                                                                                 |

No formal enquiry state machine object exists in `stateMachines.ts`; transitions are enforced ad-hoc in `enquiryService`.

### 3.2 Proposal (`proposalStateMachine`, `stateMachines.ts:122`)

| From              | Action                                            | To                                                | Who / Gate                                                         |
| ----------------- | ------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------ |
| —                 | Create from enquiry                               | DRAFT                                             | MANAGE_PROPOSALS (enquiry must be BID)                             |
| DRAFT             | Submit for approval                               | PENDING_APPROVAL                                  | MANAGE_PROPOSALS; submitter ≠ approver                             |
| PENDING_APPROVAL  | Approve                                           | APPROVED                                          | MANAGE_PROPOSALS; `preventSelfApproval`                            |
| PENDING_APPROVAL  | Reject / Request changes / Cancel                 | DRAFT                                             | MANAGE_PROPOSALS (reject/changes); submitter (cancel)              |
| APPROVED          | Submit to client                                  | SUBMITTED                                         | MANAGE_PROPOSALS (`allowWorkflowChange`)                           |
| SUBMITTED         | Mark Awarded / Under Negotiation / Lost / Expired | ACCEPTED / UNDER_NEGOTIATION / REJECTED / EXPIRED | `recordProposalOutcome`, MANAGE_PROPOSALS (syncs enquiry WON/LOST) |
| UNDER_NEGOTIATION | Mark Awarded / Lost / Expired                     | ACCEPTED / REJECTED / EXPIRED                     | `recordProposalOutcome`, MANAGE_PROPOSALS                          |
| ACCEPTED          | Convert to project                                | (proposal stays ACCEPTED, gains `projectId`)      | creates project                                                    |

Terminal: ACCEPTED, EXPIRED, REJECTED.

### 3.3 Project (`Project.status`; no dedicated state machine in `stateMachines.ts`)

Statuses seen in code: PLANNING (set at conversion), IN_PROGRESS, ON_HOLD, ACTIVE, plus completed/cancelled (used by `getActiveProjects`, cost-centre `isActive` mapping). Transitions are via direct `updateDoc` from project pages; no centralized guard.

### 3.4 Project Charter (`charter.authorization.approvalStatus`)

| From             | Action                      | To       | Who / Gate                                |
| ---------------- | --------------------------- | -------- | ----------------------------------------- |
| —                | Create (via conversion)     | DRAFT    | —                                         |
| DRAFT / REJECTED | Save authorization / edit   | DRAFT    | `canManageProjects` (MANAGE_PROJECTS)     |
| DRAFT            | Approve (passes validation) | APPROVED | MANAGE_PROJECTS; ⚠ no self-approval guard |
| DRAFT            | Reject                      | REJECTED | MANAGE_PROJECTS                           |

⚠ `PENDING_APPROVAL` is defined in the color map but never set — no submit-for-approval step exists.

### 3.5 Document Requirement / Procurement Item (embedded arrays)

- DocumentRequirement: NOT_SUBMITTED → SUBMITTED (on link) → APPROVED / REJECTED.
- ProcurementItem: PLANNING → PR_DRAFTED → RFQ_ISSUED → PO_PLACED → DELIVERED / CANCELLED (`charterProcurementService.syncProcurementItemStatus`).

---

## 4. Automatic behaviours & cross-module handoffs

**Numbering (all in-app, no shared counter service):**

- Enquiry `ENQ-YY-NN` — `generateEnquiryNumber` (`enquiryService.ts:50`), query "last + 1". ⚠ Not transactional → race-prone.
- Proposal `PROP-YY-NN` — `generateProposalNumber` (`proposalService.ts:96`). ⚠ Same race risk.
- Project `PROJ-YYYY-XXXXXX` — `generateProjectNumber` (`projectConversion.ts:246`), **timestamp-based** ("simple implementation"). ⚠ Not a real counter.
- Cost centre `CC-{projectCode}` — Cloud Function.
- Purchase Request `PR/YYYY/MM/XXXX` — timestamp-based in both `charterProcurementService.ts:167` and `functions/src/charterApproval.ts:43` (both carry TODO to implement a proper counter). ⚠ Collision-prone.

**Cloud Function triggers:**

- `onProjectCreated` (`functions/src/projects.ts:19`) — on project create, auto-creates a `costCentres` doc (`CC-…`, budget from `budget.estimated`, `autoCreated: true`), guarded against duplicates by `projectId`.
- `onProjectUpdated` (`projects.ts:107`) — syncs name/status/budget changes to the auto-created cost centre.
- `onCharterApproved` (`charterApproval.ts:189`) — on `approvalStatus` DRAFT→APPROVED, drafts PRs (+ `purchaseRequestItems`) for HIGH/CRITICAL PLANNING procurement items and links them (`PR_DRAFTED`). ⚠ `approvedByName` hard-coded `'System'` (TODO).
- `onDocumentUploaded` (`functions/src/documentRequirements.ts:39`) — on new `documents` doc with `projectId` + status ACTIVE, transactionally auto-links to the first matching NOT_SUBMITTED requirement (same `documentCategory`) → SUBMITTED.
- `onTransactionWriteUpdateProjectFinancials` (`functions/src/projectFinancials.ts:184`) — on any `transactions` write of an expense type/posted status, recomputes cost-centre `actualSpent`/`variance` and writes `budget.actual` on the project (with 90%/100% threshold warnings — task notifications are TODO).
- `onProjectBudgetChange` (`projectFinancials.ts:287`) — on `budget.estimated.amount` change, updates the cost centre `budgetAmount`/`variance`.

**Cross-module handoffs:**

- Enquiry `requestedScope` (AI-parsed) → proposal `unifiedScopeMatrix` → project charter `scope` + `budgetLineItems` (supply items).
- Proposal commercial summary → project `budget.estimated`.
- Charter procurement items → Purchase Requests → (downstream RFQ/PO sync via `syncProcurementItemStatus`, and `procurementProjectSync.ts` — see the [procurement doc](procurement.md)).
- Accounting transactions ↔ project budget actuals via cost centre.

---

## 5. Permissions required per action

| Action                             | Permission / gate                                                               | Source                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Create / edit enquiry              | firestore.rules (client `rule5-exempt`; no explicit flag check)                 | `enquiryService.ts:88,283`                               |
| Delete enquiry (soft)              | owner **or** `EDIT_ENTITIES`                                                    | `enquiryService.ts:397`                                  |
| Record / revise bid decision       | firestore.rules (client `rule5-exempt`)                                         | `enquiryService.ts:505,621`                              |
| Create / update proposal           | `MANAGE_PROPOSALS`                                                              | `proposalService.ts:611`                                 |
| Submit for approval                | `MANAGE_PROPOSALS`; submitter ≠ chosen approver                                 | `approvalWorkflow.ts:41,59`                              |
| Cancel submission                  | original submitter only                                                         | `approvalWorkflow.ts:175`                                |
| Approve proposal                   | `MANAGE_PROPOSALS` + `preventSelfApproval`                                      | `approvalWorkflow.ts:243,269`                            |
| Reject / Request changes           | `MANAGE_PROPOSALS` (+ self-check on reject)                                     | `approvalWorkflow.ts:355,465`                            |
| Submit to client                   | `MANAGE_PROPOSALS` (via `updateProposal` `allowWorkflowChange`)                 | `PreviewClient.tsx:171`                                  |
| Create revision / clone / template | `MANAGE_PROPOSALS` (client `rule5-exempt`)                                      | `proposalService.ts:654,807`                             |
| Convert proposal → project         | proposal ACCEPTED, no existing project (firestore.rules; client `rule5-exempt`) | `projectConversion.ts:22`                                |
| View projects (scoping)            | `MANAGE_PROJECTS` → all; else `assignedProjects` list                           | `projectService.ts:122`                                  |
| Edit / approve / reject charter    | `canManageProjects` (`MANAGE_PROJECTS`)                                         | `CharterTab.tsx:55,62`                                   |
| Edit budget line items             | `MANAGE_PROJECTS`; locked once charter APPROVED                                 | `BudgetTab.tsx:55`                                       |
| Add/manage procurement items       | `MANAGE_PROJECTS`; disabled once charter APPROVED (client `rule5-exempt`)       | `charterProcurementService.ts`; `ProcurementTab.tsx:350` |
| Add/manage document requirements   | firestore.rules (client `rule5-exempt`)                                         | `documentRequirementService.ts`                          |
| Parse enquiry PDF (Cloud Function) | authenticated user                                                              | `parseEnquiryDocument.ts:374`                            |

---

## ⚠ Consolidated Known Gaps

1. ~~**No UI to accept/negotiate/expire a proposal.**~~ **FIXED 2026-07-03** — `recordProposalOutcome` + proposal-page outcome actions (see §2.10); Convert to Project is now reachable.
2. **Enquiry "Mark as Won/Lost" doesn't touch the linked proposal** — residual one-way gap; the proposal-side outcome action is the canonical path and syncs both. (`EnquiryDetailClient.tsx:246`.)
3. **Charter approval has no PENDING_APPROVAL step and no self-approval prevention** — a single `MANAGE_PROJECTS` user drafts and approves; `PENDING_APPROVAL` status is defined but never written. (`CharterTab.tsx:110–188`.)
4. **Possible duplicate cost-centre creation**: `onProjectCreated` creates a cost centre at project creation, and `CharterTab.proceedWithApproval` calls `createProjectCostCentre` again on charter approval. (`projects.ts:19` vs `CharterTab.tsx:159`.)
5. **Timestamp-based numbering** for projects and PRs (explicit TODOs), and **non-transactional "last + 1"** numbering for enquiries/proposals — all collision/race prone under concurrency. (`projectConversion.ts:246`, `charterApproval.ts:43`, `charterProcurementService.ts:167`, `enquiryService.ts:50`, `proposalService.ts:96`.)
6. **`markProposalAsSubmitted` helper is bypassed** — the Preview page writes `status: 'SUBMITTED'` directly via `updateProposal`. (`PreviewClient.tsx:171`.)
7. **Charter-approval PR auto-draft attributes to `'System'`** (approver name lookup is a TODO). (`charterApproval.ts:219`.)
8. Budget-threshold alerts (90%/100%) are logged only — **task notifications are TODO**. (`projectFinancials.ts:162`.)
