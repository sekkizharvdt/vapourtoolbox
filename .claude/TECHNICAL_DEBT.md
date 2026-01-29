# Technical Debt Tracker

This document tracks TODO comments and technical debt items identified in the codebase.

**Last Updated:** 2026-01-29
**Total Items:** 9

---

## High Priority

### 1. Upload Dialog Integration (5 occurrences)

**Pattern:** Open upload dialog - integrate with existing upload component

**Files:**

- [src/app/projects/files/page.tsx:46](src/app/projects/files/page.tsx#L46)
- [src/app/projects/[id]/files/ProjectFilesClient.tsx:93](src/app/projects/[id]/files/ProjectFilesClient.tsx#L93)
- [src/app/proposals/files/page.tsx:46](src/app/proposals/files/page.tsx#L46)
- [src/app/accounting/files/page.tsx:52](src/app/accounting/files/page.tsx#L52)
- [src/app/procurement/files/page.tsx:46](src/app/procurement/files/page.tsx#L46)

**Suggested Fix:** Create a reusable `useFileUpload` hook that can be integrated with all file browser pages.

---

## Medium Priority

### 2. Folder-Based Document Filtering

**File:** [src/components/documents/browser/hooks/useDocumentBrowser.ts:168](src/components/documents/browser/hooks/useDocumentBrowser.ts#L168)
**Comment:** `// TODO: Implement proper folder-based filtering in documentService`

**Suggested Fix:** Extend `documentService` to support folder-based filtering queries for better performance.

---

### 3. Bank Account Selector for Payment Batches

**File:** [src/app/accounting/payment-batches/[id]/PaymentBatchDetailClient.tsx:133](src/app/accounting/payment-batches/[id]/PaymentBatchDetailClient.tsx#L133)
**Comment:** `// TODO: Add bank account selector before creating`

**Suggested Fix:** Add a dropdown selector for bank accounts in the payment batch creation flow.

---

## Low Priority

### 4. Drag-and-Drop Reordering for Scope Items

**File:** [src/app/proposals/[id]/scope/components/ScopeItemList.tsx:425](src/app/proposals/[id]/scope/components/ScopeItemList.tsx#L425)
**Comment:** `// TODO: Implement drag-and-drop reordering`

**Suggested Fix:** Implement using `@dnd-kit/core` or similar library for accessible drag-and-drop.

---

### 5. Comp-Off Metadata Tracking

**File:** [src/lib/hr/onDuty/compOffService.ts:277](src/lib/hr/onDuty/compOffService.ts#L277)
**Comment:** `// TODO: Implement when metadata tracking is added to leaveBalances`

**Suggested Fix:** Enhance `leaveBalances` collection with metadata tracking fields, then implement comp-off metadata.

---

## Summary by Priority

| Priority | Count | Description                                 |
| -------- | ----- | ------------------------------------------- |
| High     | 5     | Upload dialog integration across file pages |
| Medium   | 2     | Document filtering + bank account selector  |
| Low      | 2     | Drag-drop + metadata tracking               |

---

---

## High Priority - New Items

### 6. Form Validation Standardization

**Issue:** 95 form/dialog components exist, but only 4 use the `@vapour/validation` package.

**Current State:**

- `@vapour/validation` package has comprehensive Zod schemas
- `inputValidation.ts` has sanitization utilities
- Most forms rely on basic HTML5 validation or none at all

**Files Needing Validation:**

- All `*Dialog.tsx` components (create/edit operations)
- All `*Form.tsx` components (user input)

**Suggested Fix:**

1. Prioritize forms handling financial data (accounting, procurement)
2. Add Zod schemas to forms handling sensitive data
3. Use `zodResolver` with react-hook-form consistently
4. Create shared validation hooks

**Example Pattern:**

```typescript
import { zodResolver } from '@hookform/resolvers/zod';
import { entitySchema } from '@vapour/validation';

const form = useForm({
  resolver: zodResolver(entitySchema),
  defaultValues: { ... }
});
```

---

## Resolution Process

1. Create GitHub issue for each item or group
2. Remove TODO comment when issue is created
3. Reference issue number in code if placeholder is needed
4. Update this document when items are resolved
