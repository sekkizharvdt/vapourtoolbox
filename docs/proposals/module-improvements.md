# Proposal Module Improvements

## Overview

This document outlines the required improvements to the Proposal Management module to align with the intended phased workflow and fix existing issues.

---

## Current Issues

### 1. Missing Bid/No-Bid Decision Gate

**Problem:** Currently, clicking "Create Proposal" on an enquiry immediately starts a 6-step wizard. There's no evaluation step to decide whether to bid on an enquiry.

**Impact:** Every enquiry becomes a proposal draft by default, wasting effort on opportunities that shouldn't be pursued.

### 2. Duplicate/Competing UIs for Scope Definition

**Problem:** Scope is defined in THREE places with different data structures:

| Location | Data Field | Structure |
|----------|-----------|-----------|
| Wizard Step 2 (Scope of Work) | `scopeOfWork` | Free-text lists (summary, objectives, deliverables, etc.) |
| Wizard Step 3 (Scope of Supply) | `scopeOfSupply` | Line items with pricing |
| Scope Matrix Sub-module | `scopeMatrix` | Structured services/supply/exclusions by phase |

**Impact:** Data inconsistency, user confusion, and maintenance burden.

### 3. Wizard vs. Hub Sub-Modules Mismatch

**Problem:** The hub shows a phased approach:
```
Enquiries → Scope Matrix → Estimation → Pricing → Generation
```

But the 6-step wizard tries to capture everything at once (scope, supply, pricing, terms).

**Impact:** The wizard duplicates functionality that should be in dedicated sub-modules.

### 4. Enquiry Data Not Pre-filled

**Problem:** When creating a proposal from an enquiry, the wizard doesn't auto-populate fields from the enquiry (title, description, client, etc.).

**Impact:** Users must re-enter information that's already captured in the enquiry.

---

## Proposed Solution

### New Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                        ENQUIRY MODULE                           │
├─────────────────────────────────────────────────────────────────┤
│  1. Enquiry Received (NEW status)                               │
│  2. Review & Evaluate                                           │
│  3. BID / NO-BID DECISION (new step)                           │
│     - If NO-BID → Enquiry marked CANCELLED with reason          │
│     - If BID → Create Proposal (minimal info)                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    PROPOSAL MODULE (Phased)                     │
├─────────────────────────────────────────────────────────────────┤
│  1. SCOPE MATRIX (existing, needs integration)                  │
│     - Services, Supply, Exclusions                              │
│     - Organized by project phases                               │
│     - Mark as "iron-clad" when complete                        │
│                                                                 │
│  2. ESTIMATION (to be built)                                    │
│     - Add internal costs to scope items                         │
│     - Material costs, labor costs, overhead                     │
│     - NOT client-facing - internal cost estimation             │
│                                                                 │
│  3. PRICING (to be built)                                       │
│     - Apply margins, contingency, profit                        │
│     - Generate client-facing prices                             │
│     - Payment terms, validity period                            │
│                                                                 │
│  4. GENERATION (to be built)                                    │
│     - Review complete proposal                                  │
│     - Generate PDF document                                     │
│     - Submit to client                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Tasks

### Phase 1: Bid/No-Bid Decision

#### Task 1.1: Add Bid Decision Fields to Enquiry Type
**File:** `packages/types/src/enquiry.ts`

Add new fields:
```typescript
interface Enquiry {
  // ... existing fields ...

  // Bid decision
  bidDecision?: {
    decision: 'BID' | 'NO_BID';
    rationale: string;  // Required text explaining the decision
    decidedBy: string;  // User ID
    decidedAt: Timestamp;
  };
}
```

#### Task 1.2: Add Enquiry Status for No-Bid
**File:** `packages/types/src/enquiry.ts`

Update `EnquiryStatus` to include:
```typescript
type EnquiryStatus =
  | 'NEW'
  | 'UNDER_REVIEW'
  | 'BID_DECISION_PENDING'  // New
  | 'NO_BID'                // New - terminal state
  | 'PROPOSAL_IN_PROGRESS'
  | 'PROPOSAL_SUBMITTED'
  | 'WON'
  | 'LOST'
  | 'CANCELLED';
```

#### Task 1.3: Create Bid Decision Dialog
**File:** `apps/web/src/app/proposals/enquiries/components/BidDecisionDialog.tsx`

Dialog with:
- Radio buttons: BID / NO-BID
- Text area for rationale (required)
- Confirm button

#### Task 1.4: Update Enquiry Detail Page
**File:** `apps/web/src/app/proposals/enquiries/[id]/EnquiryDetailClient.tsx`

- Replace "Create Proposal" button with "Make Bid Decision" button
- Show bid decision status if already made
- Only show "Create Proposal" after BID decision is made

#### Task 1.5: Update Enquiry Service
**File:** `apps/web/src/lib/enquiry/enquiryService.ts`

Add function:
```typescript
async function recordBidDecision(
  db: Firestore,
  enquiryId: string,
  decision: 'BID' | 'NO_BID',
  rationale: string,
  userId: string
): Promise<void>
```

---

### Phase 2: Simplify Proposal Creation

#### Task 2.1: Create Simple Proposal Conversion Dialog
**File:** `apps/web/src/app/proposals/enquiries/components/CreateProposalDialog.tsx`

Replace the 6-step wizard with a simple dialog that captures:
- Proposal title (pre-filled from enquiry)
- Validity date (default: 30 days from now)
- Any initial notes

#### Task 2.2: Update Proposal Service - Create Minimal Proposal
**File:** `apps/web/src/lib/proposals/proposalService.ts`

Update `createProposal` to:
- Auto-populate from enquiry data
- Create proposal with status `DRAFT`
- Initialize empty `scopeMatrix`
- Skip the wizard entirely

#### Task 2.3: Remove or Deprecate ProposalWizard
**Files:** `apps/web/src/app/proposals/components/ProposalWizard/`

Options:
- **Option A:** Remove entirely and redirect `/proposals/new` to enquiries
- **Option B:** Keep for editing existing proposals but simplify
- **Option C:** Convert to a "quick entry" mode for simple proposals

**Recommendation:** Option A - Remove wizard, use sub-modules instead.

#### Task 2.4: Update /proposals/new Route
**File:** `apps/web/src/app/proposals/new/page.tsx`

Redirect to `/proposals/enquiries` with a message to select an enquiry first.

---

### Phase 3: Integrate Scope Matrix

#### Task 3.1: Update Proposal Detail to Show Scope Matrix Status
**File:** `apps/web/src/app/proposals/[id]/ProposalDetailClient.tsx`

Add:
- Scope Matrix completion status
- Quick link to edit scope
- Warning if scope is incomplete

#### Task 3.2: Add "Edit Scope" Action to Proposal List
**File:** `apps/web/src/app/proposals/components/ProposalList.tsx`

Add action button to go directly to scope editor.

#### Task 3.3: Block Estimation Until Scope is Complete
Add validation: Cannot proceed to estimation unless `scopeMatrix.isComplete === true`

---

### Phase 4: Build Estimation Sub-Module

#### Task 4.1: Add Estimation Types
**File:** `packages/types/src/proposal.ts`

```typescript
interface EstimationItem {
  scopeItemId: string;  // Links to ScopeItem

  // Cost breakdown
  materialCost?: Money;
  laborCost?: Money;
  overheadCost?: Money;

  // Calculated
  totalCost: Money;

  notes?: string;
}

interface ProposalEstimation {
  items: EstimationItem[];

  // Summary
  totalMaterialCost: Money;
  totalLaborCost: Money;
  totalOverheadCost: Money;
  grandTotal: Money;

  // Metadata
  isComplete: boolean;
  lastUpdatedAt: Timestamp;
  lastUpdatedBy: string;
}
```

#### Task 4.2: Add estimation Field to Proposal
**File:** `packages/types/src/proposal.ts`

```typescript
interface Proposal {
  // ... existing fields ...
  estimation?: ProposalEstimation;
}
```

#### Task 4.3: Create Estimation Hub Page
**File:** `apps/web/src/app/proposals/estimation/page.tsx`

List proposals where:
- `scopeMatrix.isComplete === true`
- `estimation.isComplete !== true`

#### Task 4.4: Create Estimation Editor
**File:** `apps/web/src/app/proposals/[id]/estimation/page.tsx`

Table showing:
- Scope items (from scopeMatrix)
- Input fields for costs
- Running totals

---

### Phase 5: Build Pricing Sub-Module

#### Task 5.1: Add Pricing Types
**File:** `packages/types/src/proposal.ts`

```typescript
interface ProposalPricing {
  // Markup percentages
  overheadPercent: number;
  contingencyPercent: number;
  profitMarginPercent: number;

  // Calculated values
  subtotal: Money;           // From estimation
  overheadAmount: Money;
  contingencyAmount: Money;
  profitAmount: Money;
  totalPrice: Money;         // Client-facing price

  // Terms
  paymentTerms: string;
  validityDays: number;
  currency: string;

  // Metadata
  isComplete: boolean;
  lastUpdatedAt: Timestamp;
  lastUpdatedBy: string;
}
```

#### Task 5.2: Create Pricing Hub Page
**File:** `apps/web/src/app/proposals/pricing/page.tsx`

#### Task 5.3: Create Pricing Editor
**File:** `apps/web/src/app/proposals/[id]/pricing/page.tsx`

---

### Phase 6: Build Generation Sub-Module

#### Task 6.1: Create Proposal Preview Component
**File:** `apps/web/src/app/proposals/[id]/preview/page.tsx`

Show complete proposal preview before PDF generation.

#### Task 6.2: Add PDF Generation
Use existing PDF generation capabilities or integrate a library.

#### Task 6.3: Add Submit to Client Workflow
- Update status to SUBMITTED
- Record submission date
- Optional: Email notification

---

### Phase 7: Enable Hub Modules

#### Task 7.1: Update Proposals Hub
**File:** `apps/web/src/app/proposals/page.tsx`

Remove `comingSoon: true` from:
- Estimation
- Pricing
- Proposal Generation

---

## Data Migration Considerations

### Existing Proposals

Proposals created with the old wizard will have:
- `scopeOfWork` - text-based scope
- `scopeOfSupply` - line items with pricing

These should continue to work. The new `scopeMatrix` and `estimation` fields are optional.

### Recommended Approach

1. Keep old fields for backward compatibility
2. New proposals use the new phased approach
3. Consider a migration script later to convert old proposals

---

## Files to Modify/Create

### Types Package
- `packages/types/src/enquiry.ts` - Add bid decision fields
- `packages/types/src/proposal.ts` - Add estimation, pricing types

### Web App - Enquiries
- `apps/web/src/app/proposals/enquiries/components/BidDecisionDialog.tsx` (new)
- `apps/web/src/app/proposals/enquiries/[id]/EnquiryDetailClient.tsx` (modify)
- `apps/web/src/lib/enquiry/enquiryService.ts` (modify)

### Web App - Proposals
- `apps/web/src/app/proposals/new/page.tsx` (simplify/remove)
- `apps/web/src/app/proposals/components/ProposalWizard/` (deprecate)
- `apps/web/src/app/proposals/page.tsx` (enable modules)

### Web App - New Sub-Modules
- `apps/web/src/app/proposals/estimation/page.tsx` (new)
- `apps/web/src/app/proposals/[id]/estimation/page.tsx` (new)
- `apps/web/src/app/proposals/pricing/page.tsx` (new)
- `apps/web/src/app/proposals/[id]/pricing/page.tsx` (new)
- `apps/web/src/app/proposals/[id]/preview/page.tsx` (new)

---

## Priority Order

1. **Phase 1: Bid/No-Bid Decision** - Critical business process gap
2. **Phase 2: Simplify Proposal Creation** - Reduces confusion
3. **Phase 3: Integrate Scope Matrix** - Already built, needs integration
4. **Phase 4: Estimation** - Core functionality
5. **Phase 5: Pricing** - Core functionality
6. **Phase 6: Generation** - Final output
7. **Phase 7: Enable Hub** - Flip the switches

---

## Questions to Resolve

1. **Wizard fate:** Remove entirely or keep for quick/simple proposals?
2. **Old proposals:** Should they be migrated to new structure?
3. **Approval workflow:** When should internal approvals happen?
4. **PDF template:** What should the generated proposal look like?

---

*Document created: 2026-01-14*
*Last updated: 2026-01-14*
