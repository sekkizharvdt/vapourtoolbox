# Proposal Scope Matrix Redesign — Implementation Plan

## Summary

Replace the current 3-tab scope editor (Services | Supply | Exclusions) with a **unified EPC scope matrix** inspired by the reference PDF. The matrix organizes scope by discipline categories, each with either a simple checklist or a full activity-column matrix. Items have row-level include/exclude toggles and cell-level activity toggles.

---

## Data Model (Phase 1)

### New Types in `packages/types/src/proposal.ts`

**Scope Categories** — Each proposal's scope is organized into discipline categories:

```
SITE_PREPARATION     → Checklist (simple include/exclude)
PROCESS_DESIGN       → Checklist
MANUFACTURED         → Matrix (activity columns: Design → Fabrication → Inspection → Shipping)
BOUGHT_OUT           → Matrix (activity columns: Data Sheet → RFQ → Order → Inspection → Shipping)
PIPING_ENGINEERING   → Checklist
PIPING_FABRICATION   → Matrix (same columns as MANUFACTURED)
STRUCTURAL           → Checklist
STRUCTURAL_FAB       → Matrix (same columns as MANUFACTURED)
SITE_WORK            → Checklist
ELECTRICAL           → Checklist
INSTRUMENTATION      → Checklist
```

**New Interfaces:**

```typescript
// Category type determines whether it's a simple checklist or activity matrix
type ScopeCategoryType = 'CHECKLIST' | 'MATRIX';

// Predefined activity column templates per matrix category
type MatrixCategoryTemplate =
  | 'MANUFACTURED' // Design → Engineering → Fab Dwg → QAP → RM Proc → RM TDC → RM Insp → Fab & Test → Supervision → Stage Insp → Final Insp → Packing → Loading → Transport → Ship Dwg
  | 'BOUGHT_OUT' // Data Sheet → RFQ → Offer Comp → Order → Follow Up → Stage Insp → Transport → Ship Dwg
  | 'FABRICATION'; // QAP → RM Proc → RM TDC → RM Insp → Fab & Test → Supervision → Stage Insp → Final Insp → Packing → Loading → Transport

// A scope category in the proposal
interface ScopeCategoryEntry {
  id: string;
  categoryKey: string; // e.g. 'MANUFACTURED', 'ELECTRICAL'
  label: string; // Display name
  categoryType: ScopeCategoryType;
  matrixTemplate?: MatrixCategoryTemplate; // Only for MATRIX types
  items: UnifiedScopeItem[];
  order: number; // Display order
}

// Unified scope item (replaces old ScopeItem)
interface UnifiedScopeItem {
  id: string;
  itemNumber: string; // "1", "2", etc. (within category)
  name: string;
  description?: string;
  included: boolean; // Row-level toggle (false = excluded)

  // For MATRIX categories: which activities are toggled on
  activityToggles?: Record<string, boolean>; // key = activity column ID

  // Sub-items (e.g., "Component 1", "Component 2" under MANUFACTURED)
  subItems?: UnifiedScopeItem[];

  // Estimation linkage (carried over from current model)
  linkedBOMs?: LinkedBOM[];
  estimationSummary?: { totalCost: Money; bomCount: number; lastUpdated?: Timestamp };

  order: number;
  notes?: string;
}

// The new top-level scope structure on a Proposal
interface UnifiedScopeMatrix {
  categories: ScopeCategoryEntry[];
  lastUpdatedAt?: Timestamp;
  lastUpdatedBy?: string;
  isComplete?: boolean;
}
```

**Activity column templates** defined as constants in `packages/types/src/proposal.ts`:

```typescript
const MANUFACTURED_ACTIVITIES = [
  { id: 'mech_design', label: 'Mechanical Design' },
  { id: 'detail_eng', label: 'Detail Engineering' },
  { id: 'fab_dwg', label: 'Fabrication Drawings' },
  { id: 'qap', label: 'Draft QAP Preparation' },
  { id: 'rm_proc', label: 'Raw Material Procurement' },
  { id: 'rm_tdc', label: 'Raw Material TDC' },
  { id: 'rm_assist', label: 'RM Procurement Assistance' },
  { id: 'rm_insp', label: 'Raw Material Inspection' },
  { id: 'fab_test', label: 'Fabrication and Testing' },
  { id: 'fab_supv', label: 'Fabrication Supervision' },
  { id: 'stage_insp', label: 'Stage Wise Inspection' },
  { id: 'final_insp', label: 'Final Inspection' },
  { id: 'packing', label: 'Packing' },
  { id: 'loading', label: 'Loading' },
  { id: 'transport', label: 'Transportation' },
  { id: 'ship_dwg', label: 'Shipping Drawing' },
];

const BOUGHT_OUT_ACTIVITIES = [
  { id: 'datasheet', label: 'Preparation of Data Sheet' },
  { id: 'rfq', label: 'Preparation of RFQ' },
  { id: 'offer_comp', label: 'Offer Comparison' },
  { id: 'order', label: 'Order Placement' },
  { id: 'followup', label: 'Follow Up' },
  { id: 'stage_insp', label: 'Stage Inspection' },
  { id: 'transport', label: 'Transportation' },
  { id: 'ship_dwg', label: 'Shipping Drawing' },
];

const FABRICATION_ACTIVITIES = [
  { id: 'qap', label: 'Draft QAP Preparation' },
  { id: 'rm_proc', label: 'Raw Material Procurement' },
  { id: 'rm_tdc', label: 'Raw Material TDC' },
  { id: 'rm_assist', label: 'RM Procurement Assistance' },
  { id: 'rm_insp', label: 'Raw Material Inspection' },
  { id: 'fab_test', label: 'Fabrication and Testing' },
  { id: 'fab_supv', label: 'Fabrication Supervision' },
  { id: 'stage_insp', label: 'Stage Wise Inspection' },
  { id: 'final_insp', label: 'Final Inspection' },
  { id: 'packing', label: 'Packing' },
  { id: 'loading', label: 'Loading' },
  { id: 'transport', label: 'Transportation' },
];
```

### Default category template

When creating a new proposal, the scope matrix is seeded with all 11 categories (empty items). Users add items to each category as needed.

---

## Phase 2: Scope Matrix Editor UI

Replace `ScopeMatrixEditor.tsx` and its sub-components with a single-page unified editor.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Scope Matrix                          [Add Category] [Save] │
│  ─────────────────────────────────────────────────────────── │
│                                                               │
│  ▼ Site Preparation                              [+ Add Item] │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ ☑ Soil Bearing Test                                      │ │
│  │ ☑ Topographical Survey                                   │ │
│  │ ☐ Preparation of Layout                    (excluded)    │ │
│  │ ☑ Design Conditions                                      │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ▼ Manufactured Components                       [+ Add Item] │
│  ┌──────────────────────────────────────────────────────────┐│
│  │        │Design│Eng│FabDwg│QAP│RMProc│...│Insp│Pack│Ship ││
│  │ ☑ Comp1│  ✓   │ ✓ │  ✓   │ ✓ │  ✓   │...│ ✓  │ ✓  │ ✓  ││
│  │ ☐ Comp2│  -   │ - │  -   │ - │  -   │...│ -  │ -  │ -  ││
│  └──────────────────────────────────────────────────────────┘│
│                                                               │
│  ▼ Electrical                                    [+ Add Item] │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ ☑ Single Line Diagram (SLD)                              │ │
│  │ ☑ Cable Tray Layout                                      │ │
│  │ ☑ Earthing Layout                                        │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  Summary: 42 items included, 5 excluded                       │
│                                    [Mark Scope Complete →]    │
└─────────────────────────────────────────────────────────────┘
```

### Components to build

1. **`UnifiedScopeEditor.tsx`** — Main editor replacing `ScopeMatrixEditor.tsx`
   - Loads/saves the `UnifiedScopeMatrix`
   - Renders categories as collapsible sections
   - Summary bar (included/excluded counts)
   - Save, Mark Complete actions

2. **`ScopeCategorySection.tsx`** — Renders a single category
   - Collapse/expand header with item count
   - Add Item button
   - For CHECKLIST: renders `ChecklistItemList`
   - For MATRIX: renders `MatrixTable`

3. **`ChecklistItemList.tsx`** — Simple checklist
   - Checkbox + item name + optional description
   - Inline edit, delete, reorder
   - Excluded items shown with strikethrough/muted styling

4. **`MatrixTable.tsx`** — Activity matrix table
   - Horizontal scroll for many columns
   - Row: checkbox (master toggle) + item name + activity checkboxes
   - Excluded rows: all cells disabled/grayed
   - Column headers from the category's activity template
   - Sticky first column (item name)

5. **`AddScopeItemDialog.tsx`** — Reuse/adapt existing dialog
   - Name, description fields
   - For MATRIX categories: pre-check all activities by default

---

## Phase 3: Service Layer Updates

### `proposalService.ts` changes

- `updateProposal()` already handles the `scopeMatrix` field — update it to also accept the new `unifiedScopeMatrix` field
- Add a helper `deriveExclusions(matrix: UnifiedScopeMatrix): string[]` that extracts all excluded item names for the proposal preview/PDF
- Add a helper `deriveIncludedItems(matrix: UnifiedScopeMatrix): UnifiedScopeItem[]` for estimation linkage

### Backward compatibility

- Keep the old `scopeMatrix` field on the `Proposal` type (don't remove it)
- Add the new `unifiedScopeMatrix?: UnifiedScopeMatrix` field alongside it
- The editor reads `unifiedScopeMatrix` if present, falls back to `scopeMatrix` (with conversion)
- New proposals always use `unifiedScopeMatrix`

---

## Phase 4: Integration Updates

1. **Proposal Detail tabs** — Update the "Scope" tab in `ProposalDetailClient.tsx` to render the new matrix format (read-only view)
2. **Preview page** — Update `PreviewClient.tsx` to render included scope and exclusions from the unified matrix
3. **PDF generation** — Update `proposalPDF.ts` to generate from the new format
4. **Estimation linkage** — Update BOM linking to work with `UnifiedScopeItem` (the `linkedBOMs` field is carried over, so this should be minimal)

---

## Phase 5: Codebase Audit & Cleanup

- Audit the proposals module for CLAUDE.md violations (permission checks, Timestamp handling, etc.)
- Remove old scope components once migration is stable
- Update Firestore indexes if new query patterns are needed

---

## File Changes Summary

| Action     | File                                                                              |
| ---------- | --------------------------------------------------------------------------------- |
| **Modify** | `packages/types/src/proposal.ts` — Add new types, activity templates              |
| **Create** | `apps/web/src/app/proposals/[id]/scope/UnifiedScopeEditor.tsx`                    |
| **Create** | `apps/web/src/app/proposals/[id]/scope/components/ScopeCategorySection.tsx`       |
| **Create** | `apps/web/src/app/proposals/[id]/scope/components/ChecklistItemList.tsx`          |
| **Create** | `apps/web/src/app/proposals/[id]/scope/components/MatrixTable.tsx`                |
| **Modify** | `apps/web/src/app/proposals/[id]/scope/page.tsx` — Point to new editor            |
| **Modify** | `apps/web/src/app/proposals/[id]/ProposalDetailClient.tsx` — Read-only scope view |
| **Modify** | `apps/web/src/app/proposals/[id]/preview/PreviewClient.tsx` — Unified format      |
| **Modify** | `apps/web/src/lib/proposals/proposalService.ts` — Helpers for new format          |
| **Modify** | `apps/web/src/lib/proposals/proposalPDF.ts` — PDF from new format                 |
| **Keep**   | Old scope components (deprecated, removed in Phase 5)                             |

---

## Implementation Order

1. **Phase 1**: Types and activity templates (~1 session)
2. **Phase 2**: Scope editor UI — the bulk of the work (~2-3 sessions)
3. **Phase 3**: Service layer updates (~1 session)
4. **Phase 4**: Integration (detail view, preview, PDF) (~1 session)
5. **Phase 5**: Audit and cleanup (~1 session)

Each phase produces a working commit. Phase 2 is the largest and can be broken into sub-steps (checklist categories first, then matrix categories).
