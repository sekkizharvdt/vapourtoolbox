---
description: Before building any new collection/route/service/component/utility, sweep the repo for an existing implementation of the same concept (CLAUDE.md rule 32).
argument-hint: <concept, e.g. "quote", "payment approval", "formatCurrency">
---

# Check Duplicates

Rule 32 exists because this repo has repeatedly paid days of consolidation work for parallel implementations (`offers` vs `vendorQuotes`, two quote UIs, 8 void-approval services, 4 number generators, `PermissionFlag` vs `PERMISSION_FLAGS`). Run this BEFORE creating anything new.

## Arguments

- `$ARGUMENTS` — the concept about to be built (required). E.g. "quote", "leave approval", "currency formatter".

## Steps

1. Derive 3–6 search stems from the concept: the word itself, synonyms, and domain aliases. Examples: quote → `quote|offer|bid`; payment approval → `paymentApproval|approvePayment|submitForApproval`; formatter → `formatCurrency|formatDate|formatters`.

2. Sweep each surface (case-insensitive, one pass each):

   ```bash
   # Services & utilities
   grep -riEl "<stems>" apps/web/src/lib packages/*/src --include="*.ts" | grep -v test | head -20
   # Components & routes
   grep -riEl "<stems>" apps/web/src/components apps/web/src/app --include="*.tsx" | head -20
   # Cloud Functions
   grep -riEl "<stems>" functions/src | head -10
   # Firestore collections & types
   grep -iE "<stems>" packages/firebase/src/collections.ts packages/types/src -r | head -10
   # Security rules (collection already ruled?)
   grep -inE "match /.*(<stems>)" firestore.rules | head
   ```

3. Read the closest 1–3 matches (the actual files, not just names) and decide:
   - **Same concept exists** → the work is "extend/rename the existing implementation", NOT "add a new one alongside". Say so explicitly.
   - **Adjacent but different** → note the boundary in one sentence so the new code doesn't drift into overlap.
   - **Nothing found** → proceed; state which stems were swept so the clearance is auditable.

4. Report a short verdict: what exists, where, and whether to extend or create. Do not paste file contents.
