---
description: Create or edit a create/edit dialog or form component with the CLAUDE.md form rules (14b, 14c, 15, 22) baked in, so it passes review first time.
argument-hint: <component name or purpose, e.g. "EditVendorBillDialog">
---

# New Dialog / Form

Scaffold a dialog or form component that survives the form round-trip test (create → save → reopen edit → save again, all values intact) on the first attempt. These four rules cause most form rework in this repo — bake them in up front.

## Arguments

- `$ARGUMENTS` — component name or purpose (e.g. "EditVendorBillDialog", "leave request form").

## Steps

1. Run `/check-duplicates` on the concept first — a dialog for this entity may already exist.

2. Read the canonical exemplar: `apps/web/src/components/projects/EditProjectDialog.tsx`. Match its structure, naming, and MUI usage.

3. Build the component enforcing ALL of these:

   **Rule 14b — prop sync.** Never rely on `useState(prop.value)` alone. Re-sync every field when the dialog opens or the item changes:

   ```typescript
   useEffect(() => {
     if (open && editingItem) {
       setTitle(editingItem.title);
       setAmount(editingItem.amount);
       // ... EVERY field, including dates, arrays, and IDs
     }
   }, [open, editingItem]);
   ```

   **Rule 14 — Timestamp conversion.** Firestore returns `Timestamp` at runtime even when TS types say `Date`. When pre-filling or displaying dates:

   ```typescript
   const raw = doc.someDate;
   const date =
     raw && typeof raw === 'object' && 'toDate' in raw
       ? (raw as { toDate: () => Date }).toDate()
       : raw instanceof Date
         ? raw
         : new Date(raw as string);
   ```

   `instanceof Date` alone is insufficient — always check for `toDate` first.

   **Rule 14c — safe validation.** Optional Firestore fields may be `undefined`: `(field ?? '').trim()`, never `field.trim()`.

   **Rule 15 — selector callbacks don't fire in edit mode.** `onEntitySelect`/`onAccountSelect` only fire on user interaction. Restore derived state (names, balances) directly from the saved document in the reset effect; fetch with `getDoc()` if needed.

   **Rule 22 — round-trip completeness.** Every field the type requires is written on create; every saved field is restored on edit. Diff the type definition against both the create payload and the reset effect before finishing.

   **Rule 12 — no `undefined` to Firestore.** Conditional spreads for optional fields: `...(description !== undefined && { description })`.

4. **Enum/status dropdown values** (not plain field labels) come from `@vapour/constants/labels.ts` and render via `StatusChip` where the value is displayed as a chip (rule 29) — add missing constants there first. Plain field labels ("Vendor Name", "Amount") are free text, no constants-file entry needed.

5. **Use the shared kit for feedback and confirmation (rule 34)** — never hand-roll these:
   - Success/error/info messages after submit → `useToast()` from `@/components/common/Toast`, not a local `<Snackbar>` + `useState`.
   - Destructive or approval confirmations (delete, cancel, reject) → `useConfirmDialog()` from `@/components/common/ConfirmDialog`, not `window.confirm()` or a one-off dialog.
   - Loading/empty states inside the dialog → `LoadingState`/`EmptyState` from `@vapour/ui`.

6. Self-check before declaring done: list the type's fields in a scratch note and tick each against (a) create payload, (b) edit reset effect, (c) validation null-safety. Report the tick-list result in one line, not the whole table.
