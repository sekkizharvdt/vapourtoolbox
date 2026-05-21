# Proposals — Complete Workflow Design (3rd Rework)

Date: 2026-04-25
Primary user: Sekkizhar
Status: **DRAFT for review** — no code changes yet. Mark this up; I'll iterate.

---

## Why this document exists

This is the third pass at the proposals module. The first two reworks left dual models active (legacy + unified scope, legacy + new pricing) and incomplete connective tissue (no send action, no PR auto-create, no engagement-type awareness). Three concrete proposal types we know we need to support — Narippaiyur baseline survey, BARC mechanical detailing, NIOT 35 KLD solar-MED EPC — span shapes the current model can't cleanly hold.

The goal of this doc: agree on the **end-to-end workflow first**, then map every step to either _reuse existing code_ or _build/refactor_, then commit to a staged build order. Code follows alignment.

---

## Engagement types — the new dimension

Naming: **Engagement Type**. (Avoids clash with the `SHAPES` collection in estimation.) Stored as a single enum on the `Proposal` document; controls which pricing/scope blocks are enabled by default and how the PDF lays out.

| Engagement Type    | When to use                                            | Default blocks                                                                                                                            |
| ------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `SERVICE_SURVEY`   | Site survey, audit, condition assessment (Narippaiyur) | Manpower roster + Per-manday site costs + Lump-sum lines + Deliverables + Schedule + Qualification + Tax + Terms                          |
| `ENGINEERING_ONLY` | Design / detailing / drawings (BARC)                   | Lump-sum lines (client-visible) + Manpower roster (internal) + Deliverables + Schedule + Qualification + Tax + Terms                      |
| `EPC_SUPPLY`       | Equipment supply ± install (current sweet spot)        | Scope matrix + BOM cost sheet + Manpower roster (commissioning) + Markup + Performance guarantee + Schedule + Qualification + Tax + Terms |
| `EPC_PLUS_OM`      | EPC with multi-year O&M (NIOT)                         | All EPC blocks + extended Manpower roster (years 1..N) + LumpSumLines for O&M                                                             |
| `OM_ONLY`          | Standalone operations & maintenance                    | Manpower roster (years 1..N) + Lump-sum lines + Schedule + Tax + Terms                                                                    |
| `CUSTOM`           | Hybrid                                                 | All blocks selectable manually                                                                                                            |

Engagement type is **a preset, not a schema split**. The Proposal document has one schema; blocks are optional fields. Switching engagement type only changes which blocks are pre-populated and the default PDF layout.

---

## End-to-end workflow

```
[Phase 0] CAPTURE
   ├─ Enquiry created (form / email-in / portal future)
   ├─ Documents attached (RFP PDF, BOQ Excel, drawings)
   └─ Status: NEW

[Phase 1] TRIAGE & BID/NO-BID
   ├─ 5-axis evaluation (existing, keep)
   ├─ Decision: BID → PROPOSAL_IN_PROGRESS  |  NO_BID (terminal)
   └─ Status synced both ways enquiry ↔ proposal

[Phase 2] PROPOSAL CREATE — pick engagement type
   ├─ Engagement type → loads default blocks
   ├─ Optional: pick whole-proposal template OR scope-snippet(s)
   ├─ Native currency + optional display currency
   └─ Status: DRAFT, revision 1

[Phase 3] SCOPE DRAFTING
   ├─ Discipline-organised scope categories (existing matrix, refined)
   ├─ Scope items in/out, classification SERVICE/SUPPLY
   ├─ BOM linkage where applicable (estimation module)
   └─ Deliverables register (drawings, reports, tests, certifications)

[Phase 3.5] ESTIMATION HANDOFF (equipment-supply scope items only)
   ├─ From a scope item: "Link BOM" → existing BOM picker  OR
   │     "New BOM for this item" → opens /estimation/new with
   │     proposalId + enquiryId pre-filled
   ├─ Estimation lives in the estimation module — proposals never
   │     duplicate component-level estimation (shells, tubes, services)
   ├─ BOM goes through DRAFT → UNDER_REVIEW → APPROVED (separate workflow)
   ├─ Scope item shows the linked BOM's status; warns if DRAFT
   └─ When BOM hits APPROVED, BOMCostSheet block (Phase 4) reflects totals

[Phase 4] INTERNAL PRICING BUILDUP  ←─ private to team
   ├─ Manpower roster (mandays × day-rates)
   ├─ Per-manday site costs (deployment, accom., food, conveyance)
   ├─ BOM cost sheet (linked from estimation)
   ├─ Markup (overhead %, contingency %, profit %) — optional
   ├─ Tax block (currency-aware)
   └─ Computed: target client price

[Phase 5] CLIENT-FACING PRICING COMPOSITION
   ├─ Decide what the customer sees:
   │     • Detailed roster (Narippaiyur)  OR
   │     • Lump-sum lines (BARC, NIOT)    OR
   │     • Hybrid (NIOT: 3 lump sums + price-bid template)
   ├─ Performance guarantee (if applicable)
   ├─ Schedule with milestone payment %
   └─ Validity, payment terms, advance %

[Phase 6] QUALIFICATION
   ├─ Pull references from reusable registry
   ├─ Pull CVs of named team members
   └─ Attach completion certificates / GST cert / insurance

[Phase 7] INTERNAL REVIEW / APPROVAL
   ├─ Status: DRAFT → PENDING_APPROVAL
   ├─ Reviewer sees full proposal (internal + client blocks)
   ├─ Margin / exposure / T&C check
   ├─ Approve / Reject / Request Changes
   └─ Status: → APPROVED  or  → DRAFT (revision)

[Phase 8] PDF GENERATION
   ├─ Layout chosen by engagement type
   ├─ Internal-audience blocks suppressed
   ├─ Watermark toggle (DRAFT) before final
   └─ PDF saved to Storage, versioned

[Phase 9] SEND TO CLIENT
   ├─ Status: APPROVED → SUBMITTED
   ├─ Email via Gmail MCP (PDF attached, signed link)
   ├─ Log: sentAt, sentTo[], openedAt (tracking pixel)
   └─ Enquiry status bubbles: PROPOSAL_SUBMITTED

[Phase 10] NEGOTIATE
   ├─ Status: SUBMITTED → UNDER_NEGOTIATION
   ├─ Client requests revision → revision++ (existing)
   ├─ Each revision re-enters Phase 7
   └─ Multiple variants supported per enquiry

[Phase 11] OUTCOME
   ├─ ACCEPTED  | REJECTED + reason | EXPIRED | WITHDRAWN
   ├─ Reason captured on terminal transitions
   └─ Enquiry status: WON | LOST | CANCELLED

[Phase 12] CONVERSION (on ACCEPTED)
   ├─ Create Project (existing)
   ├─ Create draft PRs from BOM/supply items (NEW)
   ├─ Seed project tasks from schedule milestones (NEW)
   └─ Hand-off to accounting: customer invoice schedule

[Phase 13] POST-MORTEM (on Lost / Won)
   ├─ Archive
   ├─ Win/loss analytics by client / type / category
   └─ Quoted vs actual margin comparison (after project closes)

[Phase 14] PIPELINE VIEW  (cross-cutting)
   └─ Kanban by status; aging warnings; filters
```

---

## Phase-by-phase: reuse vs build

Legend: **R** = reuse as-is · **R+** = reuse with small extension · **N** = new build · **D** = delete (vestigial)

### Phase 0 — Capture

| What                               | Status | Notes                                 |
| ---------------------------------- | ------ | ------------------------------------- |
| Enquiry CRUD service               | **R**  | `enquiryService.ts` is solid          |
| `CreateEnquiryDialog` (3-tab form) | **R**  | Already production-ready              |
| Document upload to enquiry         | **R**  | `uploadEnquiryDocument` works         |
| Inbound from email / portal        | **N**  | Future. Out of scope for this rework. |

### Phase 1 — Triage & bid/no-bid

| What                               | Status | Notes                                                                                                                                                         |
| ---------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5-axis bid evaluation UI + service | **R**  | `BidDecisionDialog`, `recordBidDecision`                                                                                                                      |
| Bid revision history               | **R**  | `previousDecision` field                                                                                                                                      |
| Enquiry → Proposal status sync     | **R+** | Wire `markProposalCreated`, `markProposalSubmitted`, `markEnquiryOutcome` into proposal state transitions (currently called manually). H2 from prior roadmap. |

### Phase 2 — Proposal create + engagement type

| What                           | Status | Notes                                                                                               |
| ------------------------------ | ------ | --------------------------------------------------------------------------------------------------- |
| `createProposal` service       | **R+** | Add `engagementType`, `nativeCurrency`, `displayCurrency`, `displayFxRate` to `CreateProposalInput` |
| `CreateProposalDialog`         | **R+** | Add engagement-type selector at top; rest of form adapts                                            |
| Whole-proposal templates       | **R**  | Existing `proposalTemplates` collection works                                                       |
| Scope-snippet library          | **N**  | Save/insert individual scope categories. H5 from prior roadmap.                                     |
| "Create template from scratch" | **N**  | H1 from prior roadmap — small fix to templates page                                                 |

### Phase 3 — Scope drafting

| What                                                    | Status | Notes                                                                                                                                      |
| ------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `UnifiedScopeMatrix` (11 categories, CHECKLIST/MATRIX)  | **R**  | Keep this — it's the right model                                                                                                           |
| `ScopeEditorClient` + matrix UI                         | **R**  | Production-ready                                                                                                                           |
| Legacy `ScopeOfWork` text fields                        | **D**  | Coexists with unified; remove. Migration: keep `ScopeOfWork.summary` as `proposal.summary` (free-text exec summary). Drop the rest.        |
| Legacy `scopeOfSupply: ProposalLineItem[]`              | **D**  | Comment in code says "legacy - being replaced"                                                                                             |
| Legacy `ScopeMatrix` (services[]/supply[]/exclusions[]) | **D**  | Replaced by `UnifiedScopeMatrix`                                                                                                           |
| Discipline sub-sections inside categories               | **N**  | Allow user-named sub-sections under a single ELECTRICAL or INSTRUMENTATION category. Helps RFP-style "3.1 Electrical / 3.2 I&C" structure. |
| `Deliverables` register block                           | **N**  | Structured rows: `{number, deliverable, format, maxRevisionCycles?, dueAt?}`. All three RFPs demand this.                                  |
| BOM linkage UI inside scope items                       | **R+** | Type supports `linkedBOMs[]`; need to verify the UI is wired (audit said unclear)                                                          |

### Phase 3.5 — Estimation handoff

| What                                                                                                            | Status                 | Notes                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BOM CRUD + editor at `/estimation`                                                                              | **R**                  | Already exists; `BOMCategory.PRESSURE_VESSEL`, `HEAT_EXCHANGER`, `STORAGE_TANK`, etc. are first-class                                                                                             |
| Shape system (parametric formulas, weight calc, fabrication cost)                                               | **R**                  | `Shape` + `ShapeFormulas` + `BlankDefinition` already model parametric components                                                                                                                 |
| Material + Service costing                                                                                      | **R**                  | `materialPrices`, `serviceRates` collections live                                                                                                                                                 |
| Bidirectional BOM ↔ proposal linkage                                                                            | **R**                  | `BOM.proposalId/proposalNumber/enquiryId` + `UnifiedScopeItem.linkedBOMs[]` already on schema                                                                                                     |
| `BOMStatus` (DRAFT → UNDER_REVIEW → APPROVED → RELEASED)                                                        | **R**                  | Exists but lightly enforced — verify approval workflow is wired                                                                                                                                   |
| "Link BOM" UI on scope item                                                                                     | **R+**                 | Type supports `linkedBOMs[]`; verify the scope-item dialog actually exposes it (audit said unclear)                                                                                               |
| "New BOM for this scope item" deep-link                                                                         | **N**                  | Open `/estimation/new?proposalId=…&enquiryId=…&scopeItemId=…` so reverse linkage is set on creation                                                                                               |
| BOM status badge on scope item + "out of date" warning                                                          | **N**                  | Show whether linked BOM is DRAFT/APPROVED; flag when BOM updated after link                                                                                                                       |
| Default rule: `BOMCostSheet` sums APPROVED+ BOMs only, warns on DRAFT                                           | **N**                  | Prevents quoting against unverified estimates while still allowing early linkage                                                                                                                  |
| **Future track**: assembly templates (parametric pressure-vessel, heat-exchanger, storage-tank, MED-evaporator) | **N (separate track)** | Not bundled into proposals rebuild — see project memory `estimation-module-audit-and-assembly-templates`. Goal: instantiate a full BOM tree from `{D, L, t, MOC, effects}` parameters in seconds. |

### Phase 4 — Internal pricing buildup

| What                                                    | Status | Notes                                                                                                          |
| ------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------- |
| `ProposalPricingConfig` (overhead/contingency/profit %) | **R+** | Becomes one of several blocks (`MarkupBlock`); make optional, not the only pricing path                        |
| Legacy `Pricing` (line items + tax line items)          | **D**  | Replaced by composable blocks below                                                                            |
| **NEW** `ManpowerRoster` block                          | **N**  | rows: `{role, person?, durationDays, headcount, mandays, dayRate, total, audience, remarks?}`; subtotal        |
| **NEW** `PerMandayCost` block                           | **N**  | rows: `{description, ratePerManday, mandays, total, audience}`; binds to a roster's manday count or free-typed |
| **NEW** `BOMCostSheet` block                            | **N**  | Wraps existing `linkedBOMs` aggregation; surfaces it as an internal cost source                                |
| **NEW** `LumpSumLines` block                            | **N**  | rows: `{description, amount, audience}`; for admin charges, profit (when lump-sum), travel, custom items       |
| **NEW** `audience` flag on each block                   | **N**  | `'CLIENT'                                                                                                      | 'INTERNAL' | 'BOTH'`. Internal blocks drive the price but are suppressed in PDF. |
| **NEW** `nativeCurrency` + display-currency on Proposal | **N**  | INR/USD/EUR/...; FX layer only at quote-output (per user — internal costs always INR)                          |
| Currency-aware `Tax` block                              | **N**  | Replaces hard-coded GST. Suppress GST when `nativeCurrency != 'INR'`; allow IGST 0% for export-of-services.    |

### Phase 5 — Client-facing pricing composition

| What                                         | Status | Notes                                                                 |
| -------------------------------------------- | ------ | --------------------------------------------------------------------- |
| Compose blocks with `audience='CLIENT'`      | **N**  | Driven by Phase 4 blocks where audience is CLIENT or BOTH             |
| `PerformanceGuarantee` block                 | **N**  | `{period, parameters[], tests[]}`. NIOT explicit; common to most EPC. |
| `DeliveryEditor` (milestones with payment %) | **R**  | Production-ready, keep                                                |
| `TermsEditor` (warranty, LD, force majeure)  | **R**  | Production-ready, keep                                                |
| Validity, payment terms, advance %           | **R**  | Already on Pricing/PricingConfig                                      |

### Phase 6 — Qualification

| What                                  | Status | Notes                                                                                                                                             |
| ------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Free-text `ProposalAttachment` upload | **R**  | Keep for misc supporting docs                                                                                                                     |
| **NEW** `Qualification` block         | **N**  | Pulls references[], CVs[], certifications[] from a reusable registry                                                                              |
| **NEW** Qualifications registry       | **N**  | New collections: `companyReferences`, `employeeCVs`, `certifications`. Each carries metadata; one source of truth referenced from many proposals. |

### Phase 7 — Internal review / approval

| What                                                            | Status | Notes                                                                                                                                                                                                                                     |
| --------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `submitProposalForApproval`                                     | **R**  | Works                                                                                                                                                                                                                                     |
| `approveProposal` / `rejectProposal` / `requestProposalChanges` | **R**  | Works                                                                                                                                                                                                                                     |
| `proposalStateMachine`                                          | **R+** | Add states: `WITHDRAWN` (we pulled the offer), `EXPIRED` (already exists), and explicit `LOST` (replaces `REJECTED` for client-side rejections; keep `REJECTED` for internal rejection of submission) — see "State machine" section below |
| Approval task notifications                                     | **R**  | Existing tasks integration works                                                                                                                                                                                                          |

### Phase 8 — PDF generation

| What                            | Status | Notes                                                                                                           |
| ------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| `generateProposalPDF` framework | **R+** | Keep the rendering pipeline                                                                                     |
| Single PDF layout               | **R+** | Refactor `ProposalPDFDocument` to dispatch on `engagementType` and render only `audience !== 'INTERNAL'` blocks |
| Watermark toggle UI             | **N**  | H4 from roadmap — small fix                                                                                     |
| Dual-currency display in PDF    | **N**  | When `displayCurrency` set, render side-by-side amounts                                                         |

### Phase 9 — Send to client

| What                                 | Status | Notes                                                            |
| ------------------------------------ | ------ | ---------------------------------------------------------------- |
| Send action UI                       | **N**  | "Send Proposal" button on detail                                 |
| Gmail MCP integration                | **N**  | MCP available in workspace — wire send + log                     |
| Signed shareable link                | **N**  | Firebase Storage signed URL with expiry                          |
| Open tracking pixel                  | **N**  | Tracking pixel pings a Cloud Function endpoint to set `openedAt` |
| Status: APPROVED → SUBMITTED on send | **R+** | Wire send action into `markProposalAsSubmitted`                  |
| Bubble status to enquiry             | **R+** | `markProposalSubmitted` exists, needs wiring                     |

### Phase 10 — Negotiate

| What                          | Status | Notes                                             |
| ----------------------------- | ------ | ------------------------------------------------- |
| Revision creation + tracking  | **R**  | `createProposalRevision`, `compareRevisions` work |
| Clone proposal for variant    | **R**  | `CloneProposalDialog` works                       |
| Multiple-variants-per-enquiry | **R**  | Already supported via revision system             |

### Phase 11 — Outcome

| What                      | Status | Notes                                                                                                                                                      |
| ------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mark accepted             | **R**  | Status transition exists                                                                                                                                   |
| Mark lost + reason        | **R+** | Status transition exists; add **structured reason capture** (price/scope/competitor/timing/relationship/other + notes). Today only `rejectionReason` text. |
| Mark expired              | **R**  | Status transition exists                                                                                                                                   |
| Mark withdrawn (by us)    | **N**  | New terminal state in state machine                                                                                                                        |
| Bubble outcome to enquiry | **R+** | `markEnquiryOutcome` exists, needs wiring                                                                                                                  |

### Phase 12 — Conversion (on Accepted)

| What                               | Status | Notes                                                                 |
| ---------------------------------- | ------ | --------------------------------------------------------------------- |
| `convertProposalToProject`         | **R+** | Works; extend to also seed PRs and tasks                              |
| Project creation with budget lines | **R**  | Works                                                                 |
| **NEW** Auto-create draft PRs      | **N**  | From BOM/supply scope items. Tier 1 from prior roadmap.               |
| **NEW** Seed project tasks         | **N**  | From schedule milestones / scope phases. Tier 1.4 from prior roadmap. |
| **NEW** Hand-off to accounting     | **N**  | Customer invoice schedule from milestone payment %. Optional.         |

### Phase 13 — Post-mortem

| What                                                       | Status | Notes                                               |
| ---------------------------------------------------------- | ------ | --------------------------------------------------- |
| Archive in same proposals collection (no separate archive) | **R**  | Status filter handles this                          |
| Win/loss analytics page                                    | **N**  | After 20+ proposals to be useful — defer to Stage 6 |
| Quoted vs actual margin                                    | **N**  | Requires project-close numbers — defer              |

### Phase 14 — Pipeline view

| What                                | Status | Notes                                                   |
| ----------------------------------- | ------ | ------------------------------------------------------- |
| List view with filters              | **R**  | `/proposals/list` works                                 |
| **NEW** Kanban by status            | **N**  | Tier 1.2 from roadmap. New route `/proposals/pipeline`. |
| Aging warnings (>14 days submitted) | **N**  | Render hint, computed at view time                      |

---

## State machine (proposed)

Replace current state machine with this:

```
DRAFT
  ├─→ PENDING_APPROVAL  (submit for review)
  └─→ WITHDRAWN          (we abandoned before submitting)

PENDING_APPROVAL
  ├─→ APPROVED          (reviewer signs off)
  └─→ DRAFT              (changes requested / rejected internally)

APPROVED
  ├─→ SUBMITTED         (sent to client)
  └─→ WITHDRAWN          (we pulled it after approval but before sending)

SUBMITTED
  ├─→ UNDER_NEGOTIATION (client engaging)
  ├─→ ACCEPTED          (client said yes)
  ├─→ LOST              (client said no — reason captured)
  ├─→ EXPIRED           (validity passed without response)
  └─→ WITHDRAWN          (we pulled it after sending)

UNDER_NEGOTIATION
  ├─→ ACCEPTED
  ├─→ LOST              (client said no — reason captured)
  ├─→ EXPIRED
  └─→ WITHDRAWN

Terminal: ACCEPTED, LOST, EXPIRED, WITHDRAWN
```

Differences from today:

- Splits client-rejection (`LOST`) from internal-rejection (already handled by going back to `DRAFT`). Today both end at `REJECTED`, which conflates two things.
- Adds `WITHDRAWN` for proposals we pull (different from `EXPIRED`).
- All terminal transitions require structured reason capture for `LOST` and `WITHDRAWN`.

---

## Data model: what's added, what's removed

### Added

```typescript
type EngagementType =
  | 'SERVICE_SURVEY'
  | 'ENGINEERING_ONLY'
  | 'EPC_SUPPLY'
  | 'EPC_PLUS_OM'
  | 'OM_ONLY'
  | 'CUSTOM';

type Audience = 'CLIENT' | 'INTERNAL' | 'BOTH';

interface ManpowerRosterRow {
  id: string;
  rowNumber: string;          // 1.1, 1.2, ...
  role: string;               // e.g., "Electrical Engineer"
  personName?: string;        // optional named individual
  headcount: number;          // qty
  durationDays: number;
  mandays: number;            // = headcount × durationDays (computed/stored)
  dayRate: number;            // in nativeCurrency
  total: number;              // = mandays × dayRate
  remarks?: string;
}
interface ManpowerRosterBlock {
  id: string;
  audience: Audience;
  rows: ManpowerRosterRow[];
  subtotal: number;
}

interface PerMandayCostRow {
  id: string;
  description: string;        // "Accommodation", "Food", ...
  ratePerManday: number;
  mandays: number;            // can bind to a roster's total mandays
  total: number;
}
interface PerMandayCostBlock {
  id: string;
  audience: Audience;
  rows: PerMandayCostRow[];
  boundRosterId?: string;     // optional: derives mandays from a roster
  subtotal: number;
}

interface LumpSumLine {
  id: string;
  description: string;
  amount: number;
  audience: Audience;
  category?: 'ADMIN' | 'PROFIT' | 'TRAVEL' | 'OTHER';
}
interface LumpSumLinesBlock {
  id: string;
  rows: LumpSumLine[];
  subtotal: number;
}

interface DeliverableRow {
  id: string;
  number: string;             // 6.1, 6.2, ...
  deliverable: string;
  format?: string;            // "PDF + DWG", "Hard copy", etc.
  maxRevisionCycles?: number;
  dueAt?: Timestamp;
}
interface DeliverablesBlock {
  id: string;
  rows: DeliverableRow[];
}

interface PerformanceGuaranteeBlock {
  id: string;
  period: { value: number; unit: 'MONTHS' | 'YEARS' };
  startsFrom: 'COMMISSIONING' | 'DELIVERY' | 'ACCEPTANCE';
  parameters: { name: string; value: string; testMethod?: string }[];
}

interface QualificationBlock {
  id: string;
  referenceProjectIds: string[];   // → companyReferences collection
  cvEmployeeIds: string[];         // → employeeCVs collection
  certificationIds: string[];      // → certifications collection
}

interface OutcomeReason {
  category: 'PRICE' | 'SCOPE' | 'COMPETITOR' | 'TIMING' | 'RELATIONSHIP' | 'TECHNICAL' | 'OTHER';
  notes: string;
  competitorName?: string;
  competitorPrice?: number;
}

// On Proposal
{
  engagementType: EngagementType;
  nativeCurrency: CurrencyCode;
  displayCurrency?: CurrencyCode;
  displayFxRate?: number;
  fxSnapshotDate?: Timestamp;

  manpowerRosters?: ManpowerRosterBlock[];
  perMandayCosts?: PerMandayCostBlock[];
  lumpSumLines?: LumpSumLinesBlock;
  deliverables?: DeliverablesBlock;
  performanceGuarantee?: PerformanceGuaranteeBlock;
  qualification?: QualificationBlock;

  outcomeReason?: OutcomeReason;     // set on LOST / WITHDRAWN
  withdrawnReason?: string;
  sentAt?: Timestamp;
  sentTo?: { email: string; name?: string }[];
  openedAt?: Timestamp;
}
```

New collections:

| Collection              | Purpose                                                                          |
| ----------------------- | -------------------------------------------------------------------------------- |
| `companyReferences`     | Past project references (one record per past project, reusable across proposals) |
| `employeeCVs`           | Structured CV records (qualifications, experience, projects)                     |
| `certifications`        | Company certifications (GST, ISO, insurance, etc.)                               |
| `proposalScopeSnippets` | Save individual scope categories as reusable snippets (H5)                       |

### Removed (vestigial)

| Field / type                                                                     | Why                                                                                                       |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `Proposal.scopeOfWork` (legacy text)                                             | Replaced by `unifiedScopeMatrix` for structured scope; keep only `summary` as `proposal.executiveSummary` |
| `Proposal.scopeOfSupply: ProposalLineItem[]`                                     | Marked legacy; replaced by `unifiedScopeMatrix` items                                                     |
| `Proposal.scopeMatrix: ScopeMatrix`                                              | Old services/supply/exclusions arrays; replaced by `unifiedScopeMatrix`                                   |
| `Proposal.pricing: Pricing`                                                      | Replaced by composable blocks (manpower + per-manday + bom + lumpsum + markup + tax)                      |
| `ProposalLineItem`                                                               | Subsumed by `UnifiedScopeItem`                                                                            |
| `Pricing` interface                                                              | Subsumed by composable blocks                                                                             |
| `ProposalWorkflowStage` enum + `workflowStage` field + `*CompletedAt` timestamps | Never enforced, no UI sets them; remove                                                                   |
| `Proposal.attachedDocuments`                                                     | Already deprecated; `attachments[]` is canonical                                                          |

Migration: a one-shot script reads existing 2 proposals, maps `scopeMatrix → unifiedScopeMatrix` (already done if `unifiedScopeMatrix` exists), maps `pricing.totalAmount → pricingConfig.totalPrice`, sets `engagementType: 'EPC_SUPPLY'` and `nativeCurrency: 'INR'`, then drops the legacy fields. Easy because the dataset is small.

---

## Mapping the three real proposals to the unified model

### Narippaiyur — `SERVICE_SURVEY`

```
engagementType: 'SERVICE_SURVEY'
nativeCurrency: 'INR'
displayCurrency: 'USD'
displayFxRate: 0.012  (1 INR ≈ 0.012 USD)

unifiedScopeMatrix.categories:
  - ELECTRICAL          (CHECKLIST: panels, cables, motors, ...)
  - INSTRUMENTATION     (CHECKLIST: 60 instruments, control loops, ...)
  - PIPING_ENGINEERING  (CHECKLIST: pumps, piping, vessels, boiler — re-labelled "Mechanical & Piping")
  - SITE_WORK           (CHECKLIST: civil + CSP brief)

deliverables: 7 rows (Equipment Register, Instrument Schedule, Cable Register, Photo log, Daily Reports, Baseline Report, Exit Briefing)

manpowerRosters[0] (audience=CLIENT):
  Sudhakar — 12 mandays @ ₹15,000 = ₹1.80L
  Subramani — 12 mandays @ ₹3,000 = ₹0.36L
  Mecanroe — 7 mandays @ ₹10,000 = ₹0.70L
  Raajah — 7 mandays @ ₹10,000 = ₹0.70L
  SEK — 12 mandays @ ₹15,000 = ₹1.80L
  Sathiyamoorthi — 7 mandays @ ₹15,000 = ₹1.05L
  Subtotal: ₹6.41L (31 mandays at lead, 57 effective)

perMandayCosts[0] (audience=CLIENT, boundRosterId=…):
  Deployment — 6 × ₹5,000 = ₹0.30L
  Accommodation — 57 × ₹3,000 = ₹1.71L
  Food — 57 × ₹1,000 = ₹0.57L
  Local conveyance — 57 × ₹1,000 = ₹0.57L

lumpSumLines (audience=CLIENT):
  Admin Charges — ₹1.00L
  Profit — ₹2.00L

tax: GST 18% on INR-domestic supply = ₹2.26L
total: ₹14.82L (₹INR) / $15,600 USD

schedule: 10 days on-site + 5 days draft + 3 days review + 3 days final
qualification: references + CVs (per RFP §10)
```

### BARC Mechanical Detailing — `ENGINEERING_ONLY`

```
engagementType: 'ENGINEERING_ONLY'
nativeCurrency: 'INR'

unifiedScopeMatrix.categories:
  - PROCESS_DESIGN        (CHECKLIST: design basis, calc dossiers — light)
  - MANUFACTURED          (CHECKLIST or MATRIX: vessel design specifics)
  Note: this is an engineering job, so MANUFACTURED is used to describe the
        thing being designed, not items being supplied.

deliverables: 7 rows (DBR-Mech, DR-Mech, Pipe stress report, Thermal datasheet,
                     Piping Material Spec, QAP+ITP, ~15 A1 drawings)
  + maxRevisionCycles: 2 (per RFP)

manpowerRosters[0] (audience=INTERNAL):  ← internal pricing buildup
  Sr. Mechanical Engineer — 4 months × ₹X
  Stress Analyst — 1.5 months × ₹X
  Draftsman — 3 months × ₹X
  Project Lead — 0.25 × 4 months × ₹X

lumpSumLines (audience=CLIENT):  ← what client sees
  Lump-sum design & detailing fee — ₹Y
  Travel & DA (BARC visits, max 2) — ₹Z

tax: GST 18% = …
total: ₹...L

schedule: 4 months from PO; review meetings fortnight/monthly
qualification: 5 yr exp + qualifying project + CVs of engineering manpower (per RFP §a)
```

### NIOT 35 KLD Solar-MED — `EPC_PLUS_OM`

```
engagementType: 'EPC_PLUS_OM'
nativeCurrency: 'INR'

unifiedScopeMatrix.categories: full 11 categories
  - PROCESS_DESIGN, MANUFACTURED, BOUGHT_OUT, PIPING_ENGINEERING,
    PIPING_FABRICATION, STRUCTURAL, STRUCTURAL_FABRICATION,
    SITE_WORK, ELECTRICAL, INSTRUMENTATION, SITE_PREPARATION

bomCostSheet[0] (audience=INTERNAL):
  - MED equipment BOM (flash chamber, evap × 8, condenser, vacuum sys, pumps × 7, …)
  - Solar ETC BOM (27,000 tubes, manifolds, mounts, hot water system)

manpowerRosters[0] (audience=INTERNAL): commissioning team for 4 weeks
manpowerRosters[1] (audience=BOTH): O&M team for 1 year (per RFP price-bid line 3)

markupBlock (audience=INTERNAL):
  overhead: 8%, contingency: 5%, profit: 12%

lumpSumLines (audience=CLIENT):  ← exactly matches NIOT price-bid template
  1. MED Process System — ₹A
  2. Solar Thermal System — ₹B
  3. O&M for 1 year (manpower + consumables + spares) — ₹C

performanceGuarantee:
  period: 12 months from COMMISSIONING
  parameters: capacity 35 KLD, recovery ratio, product water quality

tax: GST 18% on lump-sum total
total: ₹A+B+C + GST

schedule: design → fabrication → erection → commissioning → 12 mo O&M
qualification: prior 35+ KLD solar-MED with 1 yr O&M (per RFP §14)
```

The same data model holds all three.

---

## Build sequence (proposed)

Each stage is **independently shippable** and unblocks the next. Stages 1–4 are the rebuild; stages 5–8 are net-new features unlocked by the rebuild.

| Stage                               | Scope                                                                                                                                                                                                           | Unlocks                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **1. Foundations**                  | Add `engagementType`, `nativeCurrency`, `displayCurrency`, `displayFxRate` to Proposal type. Selector on create. Migration script to back-fill existing 2 proposals. **No legacy removal yet** — additive only. | Engagement Type as a UI primitive                                              |
| **2. Pricing blocks**               | Add `ManpowerRoster`, `PerMandayCost`, `LumpSumLines`, `BOMCostSheet` blocks. Add `audience` flag. Add currency-aware Tax block. Wire into pricing editor with collapsible sections.                            | Quote all three real proposals                                                 |
| **3. Deliverables + Qualification** | New `Deliverables` block. New collections `companyReferences` / `employeeCVs` / `certifications`. New `Qualification` block consuming them.                                                                     | Match RFP demands for structured deliverables and qualifications               |
| **4. Cleanup**                      | Remove legacy `scopeOfWork` (text), `scopeOfSupply`, `scopeMatrix`, `Pricing`, `ProposalLineItem`, `ProposalWorkflowStage`, `attachedDocuments`. One PR with the migration script.                              | Single-model codebase. Stops the bleeding from prior reworks.                  |
| **5. PDF + send**                   | Engagement-type-aware PDF dispatcher. Watermark UI toggle. Send Proposal action with Gmail MCP, signed link, openedAt tracking.                                                                                 | Closes H3 + H4 from prior roadmap. Module becomes a sales tool.                |
| **6. Pipeline + outcome**           | `/proposals/pipeline` kanban. Structured `OutcomeReason` capture. State-machine update with `WITHDRAWN` and `LOST` (split from `REJECTED`). Status sync enquiry ↔ proposal.                                     | Closes Tier 1.2 + H2 from prior roadmap. Win/loss tracking.                    |
| **7. Conversion plus**              | Auto-create draft PRs from BOM/supply scope on accept. Seed project tasks from schedule milestones.                                                                                                             | Closes Tier 1.1 + Tier 1.4 from prior roadmap. Closes the sales→sourcing loop. |
| **8. Polish**                       | Scope-snippet library. Discipline sub-sections. Per-line-item margin override. Win/loss analytics. Pipeline aging. PerformanceGuarantee block.                                                                  | Closes H1, H5, H6 + Tier 2 from prior roadmap.                                 |

Order matters: **Stage 4 cleanup is gated on Stages 1–3 being shipped and working** — same pattern we used for offers→vendorQuotes. Don't drop legacy until the new model carries all live data.

---

## Open questions for you

Mark these up before I start building.

1. **Engagement type names** — are `SERVICE_SURVEY / ENGINEERING_ONLY / EPC_SUPPLY / EPC_PLUS_OM / OM_ONLY / CUSTOM` right? Any missing? (e.g., "Refurbishment", "Operations consulting")

2. **State machine — split `REJECTED`** — current `REJECTED` covers both internal rejection (during approval) and client rejection (after submission). I'm proposing `LOST` for client-side. OK to split?

3. **`WITHDRAWN` state** — do you ever pull a proposal after submitting? If yes, this is its own terminal state. If never, skip.

4. **Outcome reason categories** — proposed: `PRICE | SCOPE | COMPETITOR | TIMING | RELATIONSHIP | TECHNICAL | OTHER`. Add/remove?

5. **Scope-snippet library** — defer to Stage 8 (polish), or pull forward to Stage 3? Saves time per proposal once seeded but no urgency.

6. **PR auto-create on accept** — Stage 7 — single button "Create PRs from accepted proposal" vs. automatic on status change to ACCEPTED? I lean **manual button**, gives you a chance to review before draft PRs hit procurement.

7. **`workflowStage` enum** — currently exists but never enforced. **Delete?** Or do you want a visible "stepper" UI showing where in the editing flow you are? It's only useful if it gates progression (you can't go to Pricing until Scope marked complete). Today it doesn't gate anything.

8. **Customer references / CV registry** — who maintains it? Self-service per project lead, or one curated record per company project? Affects access pattern.

9. **Watermark vs. final** — only `'DRAFT'`, or also `'CONFIDENTIAL'`, `'PRELIMINARY'`?

10. **Build order** — does Stage 5 (PDF + send) come before or after Stage 6 (pipeline)? My order assumes you want to _use_ the new pricing first, then add send-tracking. If pipeline view is more pressing, swap.

---

## Effort estimate

Rough sizing — unblocked work, single dev (Claude Code).

| Stage                           | Effort             | Risk                                                     |
| ------------------------------- | ------------------ | -------------------------------------------------------- |
| 1. Foundations                  | 0.5 day            | Low                                                      |
| 2. Pricing blocks               | 2-3 days           | Medium (lots of UI surface)                              |
| 3. Deliverables + Qualification | 1-2 days           | Low (mostly CRUD)                                        |
| 4. Cleanup                      | 1 day              | Medium (touches many files; migration script needs care) |
| 5. PDF + send                   | 2 days             | Medium (Gmail MCP integration, signed link)              |
| 6. Pipeline + outcome           | 1.5 days           | Low                                                      |
| 7. Conversion plus              | 2 days             | Medium (PR creation needs procurement-side touchpoints)  |
| 8. Polish                       | 1-2 days each item | Low                                                      |

Total to single-model + send + pipeline + PR-conversion = **~10-12 days** of focused work. Stages 1-4 alone (the rebuild) = **~4-5 days**. After Stage 4 the codebase is cleaner than today even if no new features ship.
