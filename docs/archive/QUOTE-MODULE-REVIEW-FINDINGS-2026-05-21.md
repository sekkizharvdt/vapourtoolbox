# Quote Module — Review Findings (2026-05-21)

Consolidated review of the vendor-quote module: material/bought-out code hygiene, the
user-feedback PDF (`inputs/Quote module - toolbox.pdf`), and the root cause of the
"can't link / can't create offer" failures. Read-only review — no code was changed.

> Consolidates and supersedes `VENDOR-QUOTE-MATERIAL-CODE-AUDIT-2026-05-19.md` (the
> earlier material-code-only audit, now removed). All findings re-verified against current
> `main` (HEAD `04e1cb9a`).

---

## HEADLINE: the bought-out picker index — FIXED in repo, pending deploy

> **Status (2026-05-21):** the three missing composite indexes have been added to
> `firestore.indexes.json`. They take effect only after
> `firebase deploy --only firestore:indexes` — until that runs and the indexes finish
> building, the live picker still throws. See "The fix" below for what was added.

The user feedback (PDF Image 3.1.2) shows the real error when linking a quote line to a
bought-out item:

> **"The query requires an index. You can create it here: …/firestore/indexes?create_composite=…"**

### Root cause — verified

The picker query at
[ItemLinkDialog.tsx:134-139](apps/web/src/app/procurement/quotes/components/ItemLinkDialog.tsx#L134-L139)
is:

```ts
collection(db, 'bought_out_items'); // snake_case — the canonical collection
where('isActive', '==', true);
orderBy('name');
limit(50);
```

This `where + orderBy` needs a composite index. Until 2026-05-21 **`firestore.indexes.json`
had zero indexes for `bought_out_items`.** The Material and Service tabs in the same dialog
use the identical query shape and _do_ have their `isActive + name` indexes — which is
exactly why material/service linking worked and bought-out linking threw.

| Picker tab     | query                                        | `isActive + name` index?          | Works? |
| -------------- | -------------------------------------------- | --------------------------------- | ------ |
| Material       | `materials` + isActive + orderBy name        | YES (3)                           | ✅     |
| Service        | `services` + isActive + orderBy name         | YES (2)                           | ✅     |
| **Bought Out** | `bought_out_items` + isActive + orderBy name | added 2026-05-21 (pending deploy) | ⏳     |

### Why a previous "fix" didn't fix it

This was attempted before and missed, twice over:

1. **`eed7548d` "fix(quotes): boughtOut picker indexes"** added two indexes — but on the
   **wrong collection name** (`boughtOutItems`, camelCase) and with the **wrong fields**
   (`tenantId + isActive + createdAt`, `tenantId + category + isActive + createdAt`). The
   real query hits `bought_out_items` (snake_case) and orders by `name`, not `createdAt`,
   with no `tenantId` filter. So the index never matched the query even when deployed.
2. **`82d65189` "remove shadow collections (rule 32)"** correctly identified
   `boughtOutItems` (camelCase) as a dead shadow of `bought_out_items`, migrated its 1
   orphan doc across, and **dropped those 2 stale indexes**. Net: the real query has
   _never_ had a matching index.

This is a classic [[rule 32 / rule 2]] interaction — a parallel-named collection led the
fix to the wrong target, then the cleanup swept the mismatched index away.

### The fix (applied 2026-05-21)

`bought_out_items` is queried by three components with three distinct shapes, so three
composite indexes were added to `firestore.indexes.json` (all verified against live
callers — no speculative indexes, rule 31):

| Index (fields)                                             | Serves                                                                                                                                                |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isActive ASC, name ASC`                                   | quotes picker — [ItemLinkDialog.tsx:134](apps/web/src/app/procurement/quotes/components/ItemLinkDialog.tsx#L134) (**the reported 3.1.2 / 3.1.3 bug**) |
| `tenantId ASC, isActive ASC, createdAt DESC`               | `BoughtOutPickerDialog` + bought-out master page (no category filter)                                                                                 |
| `tenantId ASC, category ASC, isActive ASC, createdAt DESC` | same two, with category filter                                                                                                                        |

Only the first matches the quotes-module bug in the PDF; the other two were also missing
(0 indexes existed) and would throw on the bought-out master page / picker, so they were
added in the same pass.

**Remaining step:** run `firebase deploy --only firestore:indexes` and wait for the
indexes to finish building in the Firebase console. The repo change alone does not fix the
live picker. This clears the 3.1.2 _and_ 3.1.3 failures (same bug).

---

## How the user feedback maps to causes

The PDF groups quote creation into Working / Error / Manual, with 7 screenshots. Mapped:

| #   | Feedback                                                                                                                   | Root cause                                                                                                                                                                                                                                             | Status          |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| 1   | AI parse + auto-link works for some offers                                                                                 | OK path                                                                                                                                                                                                                                                | ✅ works        |
| 2   | "Could not parse the document — Claude returned an unexpected response" (Image 3.1.1)                                      | `parseQuote` cloud function response-robustness; model occasionally returns prose/truncated JSON. Intermittent — same file/screen.                                                                                                                     | ⚠️ intermittent |
| 3.1 | Manual link fails: "query requires an index" (Image 3.1.2); "No bought-out items in the master" (false — there are **62**) | Missing `bought_out_items` index, above. The "empty master" message is the failed query returning nothing.                                                                                                                                             | ❌ **broken**   |
| 3.1 | Can't create offer: "Line 1: pick a bought_out from the master" (Image 3.1.3)                                              | `handleSubmit` ([new/page.tsx:530-540](apps/web/src/app/procurement/quotes/new/page.tsx#L530-L540)) blocks creation until every non-NOTE row is linked. Picker can't return results → row can't be linked → offer can't be created. Same bug as 3.1.2. | ❌ **broken**   |
| 3.1 | No Save-as-Draft during creation                                                                                           | There is one `handleSubmit`; "draft" only happens when the header is saved with **zero** line items (empty array is allowed). No intermediate persistence once a line exists.                                                                          | ⚠️ by design    |
| 3.2 | Data lost on refresh/retry                                                                                                 | Parsed/entered state isn't persisted before Create; refresh after a parse error loses everything.                                                                                                                                                      | ⚠️ gap          |
| —   | Wishlist: per-line discount, more attachments, stabler parsing                                                             | Feature requests                                                                                                                                                                                                                                       | 📋 backlog      |

The recurring theme: **everything downstream of the bought-out picker is blocked by the
missing index.** Fix the index and the "manual processing is broken" half of the report
largely resolves.

---

## Material-code hygiene (the original question)

System reviewed against live Firestore. Verdict: **sound for new quotes, with an
early-period gap and an uncurated bought-out catalog.**

### Materials side — clean since May

- Flow: AI parser extracts lines but does **not** invent a code; user picks from the
  catalog via `MaterialPickerDialog`, which writes `materialId` / `materialCode` /
  `materialName`. Submit gate (`isRowLinked`) requires `materialId` for MATERIAL rows.
- 23 MATERIAL line items across 23 quotes: **12 properly linked, 11 broken.**
- All 11 broken rows (`materialId: undefined`, blank code) are Jan–Feb 2026, before the
  picker gate existed. They can't be price-accepted and are invisible to price history.
- The 12 clean rows are all May 2026 (Starflex `EB-UNSS2205*`, Flowtech `ST-SS316*`),
  following a consistent `{FORM}-{GRADE}-{SEQ}` pattern.
- Catalog cross-check: of 12 referenced `materialId`s — **0 missing, 0 stuck on
  `needsReview`, 0 code mismatches.** When the picker is used, data is clean.

### Bought-out side — uncurated and duplicated

- Collection is `bought_out_items` (snake_case). **62 docs, all 62 `needsReview: true`** —
  none curated since auto-creation. (camelCase shadow `boughtOutItems` is now empty after
  `82d65189`.)
- The AI auto-creator dumps the **entire vendor descriptor into `name`** (149–306 chars);
  the schema's `description` / `specifications` fields sit empty. This is what makes the
  "Linked Item" column look absurdly long in the Quote Detail screen
  ([QuoteDetailClient.tsx:586-598](apps/web/src/app/procurement/quotes/[id]/QuoteDetailClient.tsx#L586-L598)).
  The **code** itself (e.g. `INST-PI-0002`) is fine; the `name` is the bloat.
- **41 of 62 docs (67%) are name-duplicates** — the same physical item ingested repeatedly
  because the code generator formats specs inconsistently (`PN10-16/CL150` vs
  `/CLASS150` vs `/150#`) and flips `SS316`↔`SS316L`. GESTRA non-return valves alone:
  ~23 docs for ~5 physical items.

The duplicate pile-up has a direct cause: **the manual picker into `bought_out_items` has
been broken the whole time (the missing index), so the only way items enter the catalog is
auto-create-on-parse — which never reuses an existing record.** Fixing the index is also
the precondition for the catalog to stop growing duplicates.

---

## Recommended order of work

1. ~~**Add the `bought_out_items` composite indexes**~~ — **done 2026-05-21** in
   `firestore.indexes.json` (3 indexes). Still needs `firebase deploy --only
firestore:indexes` to take effect. Single highest-leverage fix; unblocks manual linking
   and offer creation.
2. Harden the `parseQuote` response handling so a malformed model reply degrades to a
   retry/partial-fill instead of a dead-end error (covers feedback #2, "data loss").
3. Decide on real Save-as-Draft that tolerates unlinked rows (covers #3.1 draft + refresh).
4. Curate `bought_out_items`: dedupe the 67% duplicate clusters, move long descriptors out
   of `name` into `description`/`specifications`, clear `needsReview`. Best done _after_
   step 1 so the picker can reuse curated entries going forward.
