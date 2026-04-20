# Vapour Toolbox — UI Standards

Companion to `CLAUDE.md`. These rules govern the user-facing surface: dialogs, forms, tables, navigation, feedback, accessibility. They are derived from a UI/UX audit (2026-04-20) of Procurement, Accounting, Flow, Thermal, and Documents modules.

**Principle:** the "right way" is already built. If a shared primitive exists, use it — do not roll a local variant. Gaps in adoption, not missing primitives, are the main problem today.

---

## 1. Shared Primitives (use these, don't recreate)

| Need                       | Use                                                                                         | Location                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Form dialog shell          | `FormDialog`                                                                                | [components/common/forms/FormDialog.tsx](apps/web/src/components/common/forms/FormDialog.tsx)           |
| Dialog footer buttons      | `StandardDialogActions`                                                                     | [components/common/StandardDialogActions.tsx](apps/web/src/components/common/StandardDialogActions.tsx) |
| Confirm before destructive | `useConfirmDialog()` (or `<ConfirmDialog>`)                                                 | [components/common/ConfirmDialog.tsx](apps/web/src/components/common/ConfirmDialog.tsx)                 |
| Empty list/table/search    | `EmptyState`, `NoResultsFound`, `EmptyFolder`                                               | [components/common/EmptyState.tsx](apps/web/src/components/common/EmptyState.tsx)                       |
| Module page shell          | `ModuleLayout`                                                                              | [components/layouts/ModuleLayout.tsx](apps/web/src/components/layouts/ModuleLayout.tsx)                 |
| Module hub page            | `ModuleLandingPage`                                                                         | [components/modules/ModuleLandingPage.tsx](apps/web/src/components/modules/ModuleLandingPage.tsx)       |
| Entity / account / project | `EntitySelector`, `AccountSelector`, `ProjectSelector`, `ApproverSelector`, `StateSelector` | [components/common/forms/](apps/web/src/components/common/forms/)                                       |
| Toast / snackbar           | `Toast`                                                                                     | [components/common/Toast.tsx](apps/web/src/components/common/Toast.tsx)                                 |

**Rule 1.1** — Never import `DialogActions` from `@mui/material` directly in feature code. Use `StandardDialogActions` or the `actions` slot of `FormDialog`. Exceptions require a comment citing why the standard footer is insufficient.

**Rule 1.2** — Never call `window.confirm()` / `window.alert()` / `window.prompt()`. Use `useConfirmDialog()`. The pre-commit review will reject `window.confirm(` matches.

---

## 2. Dialogs

**Rule 2.1 — Button order and labels come from `StandardDialogActions`.**

| Variant       | Left   | Middle         | Right (primary)   |
| ------------- | ------ | -------------- | ----------------- |
| `default`     | Cancel | —              | Save (primary)    |
| `approval`    | Cancel | Reject (error) | Approve (success) |
| `destructive` | Cancel | —              | Delete (error)    |

Loading states (`Saving...`, `Approving...`, `Deleting...`) come for free — do not reimplement.

**Rule 2.2 — A destructive action MUST be a `destructive` variant OR go through `useConfirmDialog()` with `confirmColor: 'error'` and `focusConfirm: false` (so Enter doesn't trigger delete).**

```tsx
const confirmed = await confirm({
  title: 'Delete Bill',
  message: 'This will reverse the GL entries. This action cannot be undone.',
  confirmText: 'Delete',
  confirmColor: 'error',
  focusConfirm: false, // Enter selects Cancel
});
if (!confirmed) return;
```

**Rule 2.3 — Dialog state MUST sync via `useEffect` when props change** (see CLAUDE.md rule 14b). `useState(prop)` captures first render only — reopening for a different item shows stale data.

**Rule 2.4 — Errors inside a dialog surface as `<Alert severity="error">`**, not red `Typography`. `FormDialog` already renders the `error` prop as an Alert — pass it through instead of adding bespoke error UI inside children.

**Rule 2.5 — Multi-step dialogs MUST use MUI `<Stepper>`** with per-step validation. The Next button is disabled until the current step's required fields are valid. Example of what NOT to do: `GenerateTransmittalDialog` (4 steps, no progress indicator, no gating) — migrate when touched.

**Rule 2.6 — Dialogs with more than ~6 inputs MUST be sectioned** using headings or dividers: "Basic Info", "Line Items", "Tax & Deductions", etc. Don't present a dense wall of fields (`CreateBillDialog`, `CreateInvoiceDialog` are current offenders).

---

## 3. Forms & Inputs

**Rule 3.1 — Required fields MUST be visually marked.** Use MUI's built-in `required` prop on `<TextField>`, which renders the `*`. For custom selectors that accept `required`, render the asterisk in the label:

```tsx
<TextField required label="Bill Date" />
// Custom selector
<AccountSelector required label="Debit Account" /> // must render `*`
```

Selectors in `components/common/forms/` that accept a `required` prop MUST render the asterisk — this is a selector-side requirement, not a caller-side one.

**Rule 3.2 — Form validation MUST null-coalesce before string methods** (CLAUDE.md rule 14c). `(field ?? '').trim()`, never `field.trim()`.

**Rule 3.3 — In edit mode, restore every saved field in the reset effect** (CLAUDE.md rules 14b, 15, 22). Selector `onSelect` callbacks do NOT fire for pre-populated values — restore derived state (e.g. `entityName`, `openingBalance`) directly.

**Rule 3.4 — Dates bound to `<input type="date">` MUST convert Firestore Timestamps first** (CLAUDE.md rule 14). Build a `toDate()` helper at module boundary; never call `.toDate()` inside JSX.

**Rule 3.5 — Every input MUST have a label linked to its `id`.** If you provide `label`, you MUST either use `<TextField label="...">` (MUI handles it) or wire `<FormLabel htmlFor={id}>` yourself. No floating labels without association — screen readers cannot resolve them.

**Rule 3.6 — Validation errors MUST appear adjacent to the offending field**, not only at the top of the form. Use `error` and `helperText` on `<TextField>`. A top-level Alert is for cross-field / submission errors.

---

## 4. Tables & Lists

**Rule 4.1 — Tables with ≥6 columns MUST be wrapped in a horizontal-scroll container** and tested at `xs`:

```tsx
<TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
  <Table sx={{ minWidth: 720 }}> ... </Table>
</TableContainer>
```

Ellipsis-truncated cells without a scroll container are forbidden — the user has no way to see the hidden content.

**Rule 4.2 — Empty table bodies MUST render `<EmptyState variant="compact">`**, never a blank `<TableBody>`. Use `<NoResultsFound>` when the emptiness is due to a filter / search.

**Rule 4.3 — Destructive row actions (delete, void, cancel) MUST go through `useConfirmDialog()`** before executing. Inline icon-button deletes with no confirmation are forbidden (current offender: `LineItemsTable`).

**Rule 4.4 — Filter state MUST provide feedback.** If filtering is debounced, show a subtle "Filtering…" indicator or a chip count of applied filters. The user should never wonder whether filters are active (current offender: `procurement/pos/page.tsx`).

**Rule 4.5 — Bulk actions MUST show a selection-count toolbar**, not a dialog-per-item. Follow the pattern MUI recommends (sticky toolbar appears above the table when rows are selected).

---

## 5. Navigation & Page Structure

**Rule 5.1 — Every module page MUST be wrapped in `ModuleLayout`** (auth, permissions, sidebar are free). Do not build bespoke layouts.

**Rule 5.2 — Every module hub MUST use `ModuleLandingPage`** with `sections: ModuleSection[]`. Do not hand-roll card grids per module.

**Rule 5.3 — "Coming Soon" items MUST be non-clickable.** Apply `pointerEvents: 'none'`, `cursor: 'not-allowed'`, and a "Coming Soon" badge. Opacity alone is not sufficient feedback (current offender: `Sidebar.tsx:395-402`).

**Rule 5.4 — Breadcrumbs are layout-owned.** Use the shared `<PageBreadcrumbs>` primitive ([components/common/PageBreadcrumbs.tsx](apps/web/src/components/common/PageBreadcrumbs.tsx)) everywhere; never import `Breadcrumbs` from `@mui/material` in feature code.

- If a route tree has a parent layout that already renders breadcrumbs (currently `/admin/*` via `admin/layout.tsx`, and any project sub-page wrapped in `ProjectSubPageWrapper`), the page itself MUST NOT render its own breadcrumbs. Adding a second set on those pages is the cause of the "two breadcrumb bars" bug.
- If a page sits in a route tree _without_ auto-breadcrumbs and is ≥3 levels from the module root, render a single `<PageBreadcrumbs>` at the top of the page.
- Items take `{ label, href?, icon? }`. Omit `href` on the last (current) item. First crumb usually carries a `HomeIcon`.

**Rule 5.5 — Primary page action lives in the top-right of the page header.** "Create New X" is always top-right; inline "+" buttons inside tables are secondary, not primary.

---

## 6. Feedback & Status

**Rule 6.1 — Transient success / info MUST use `Toast`** (snackbar). Do not use `alert()`, do not render a persistent Alert for a one-off success. 4-second auto-dismiss by default.

**Rule 6.2 — Persistent warnings / errors MUST use MUI `<Alert>`** inside the page or dialog. Colour alone is not a signal — the Alert's severity icon is required.

**Rule 6.3 — Status indicators MUST include text, not color alone.** Chips for payment status, PO status, task status MUST have a `label` that names the status. Colour-blind users and exported screenshots both break otherwise.

**Rule 6.4 — Loading conventions:**

- Table / list data loading → `<Skeleton>` rows (not a centered spinner on a blank page).
- Dialog / form submission → `LoadingButton` or the `loading` prop on `StandardDialogActions`.
- Page-level data fetch → top `<LinearProgress>` bar under the app bar.
  Pick the matching primitive; do not mix spinners and skeletons for the same surface type.

**Rule 6.5 — Terminal states MUST disable the action UI** (CLAUDE.md rule 10). A cancelled PO cannot show an "Amend" button enabled.

---

## 7. Accessibility

**Rule 7.1 — Every icon-only button MUST have an `aria-label`** describing the action (`aria-label="Delete row"`, not just the icon).

**Rule 7.2 — Dialogs MUST set `aria-labelledby` on the `<Dialog>` pointing at the title id.** `FormDialog` does this — using `FormDialog` satisfies the rule.

**Rule 7.3 — Keyboard Enter on the primary dialog button MUST be safe.** For destructive dialogs, `focusConfirm: false` so Enter cancels, not deletes.

**Rule 7.4 — Focus MUST return to the triggering element when a dialog closes.** MUI handles this if you don't fight it — don't call `blur()` manually.

**Rule 7.5 — Minimum contrast is WCAG AA (4.5:1 for body text).** Do not use `text.disabled` for information the user needs to read.

---

## 8. Responsive

**Rule 8.1 — Every page MUST be tested at `xs` (mobile) and `md` (tablet/desktop).** A UI change is not done until the developer has resized the window.

**Rule 8.2 — Dense tables get a card fallback at `xs`** when the natural width is unusable. Example target: PO list, bill list, invoice list. Wide tables that cannot be sensibly carded must at minimum scroll horizontally (rule 4.1).

**Rule 8.3 — The sidebar MUST collapse at `md` and expose a close affordance at `xs`** (either a visible close button or a swipe-to-close). Current offender: `Sidebar.tsx` (no close affordance on mobile).

---

## 9. Writing & Copy

**Rule 9.1 — Button labels are verbs in title case:** `Save`, `Delete`, `Approve`, `Submit for Approval`. Not `OK`, not `Yes`, not `Submit` (ambiguous).

**Rule 9.2 — Error messages state what's wrong and what to do.** "Amount must be ≤ outstanding (₹12,340.00)" beats "Invalid amount".

**Rule 9.3 — Empty-state descriptions offer a next step.** Not "No bills" — "No bills yet. Create a vendor bill to track outstanding payables."

**Rule 9.4 — Currency always displays with `₹` prefix and thousands separators** via `Intl.NumberFormat('en-IN')`. Don't hand-format.

---

## 10. Review Checklist

Before merging a UI change, confirm:

- [ ] Dialog uses `FormDialog` + `StandardDialogActions` (rules 1.1, 2.1)
- [ ] Destructive action prompts via `useConfirmDialog()` (rule 1.2)
- [ ] Required fields render `*` (rule 3.1)
- [ ] Edit mode restores every field (rule 3.3)
- [ ] Empty states use `EmptyState` / `NoResultsFound` (rule 4.2)
- [ ] Table scrolls or cards at `xs` (rules 4.1, 8.2)
- [ ] Status chips carry text labels (rule 6.3)
- [ ] Icon buttons have `aria-label` (rule 7.1)
- [ ] Tested at `xs` and `md` (rule 8.1)
- [ ] No `window.confirm`, no raw `DialogActions`, no `alert()` (rules 1.1, 1.2)

---

## 11. Migration Stance

Do NOT undertake a big-bang refactor. Instead:

1. When touching a module for any reason, bring it up to these standards before closing the task.
2. New code MUST comply on day one.
3. Quick wins (asterisks on required fields, replacing `window.confirm`, wrapping tables in scroll containers) can be picked up as standalone small PRs.

Keep this file updated as primitives evolve. When a new shared primitive lands, add it to §1 and deprecate the ad-hoc pattern it replaces.
