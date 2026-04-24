# Projects — Revival Plan

Date: 2026-04-24

## Where we stand

10 projects in Firestore, newest created Mar 13 2026. Of those 10, sampled for subcollection data:

| Subcollection                                                                | Projects with data | Total docs |
| ---------------------------------------------------------------------------- | ------------------ | ---------- |
| `masterDocuments`                                                            | 1 / 10             | 10         |
| `transmittals`                                                               | 1 / 10             | 1          |
| `boms`                                                                       | 0 / 10             | 0          |
| `equipment`                                                                  | 0 / 10             | 0          |
| `lines`                                                                      | 0 / 10             | 0          |
| `instruments`                                                                | 0 / 10             | 0          |
| `valves`                                                                     | 0 / 10             | 0          |
| `streams`                                                                    | 0 / 10             | 0          |
| `procurement_stats` / `time_stats` / `accounting_stats` / `estimation_stats` | 0 / 10             | 0          |

The engineering data side of projects is empty for every project. The stats rollup subcollections (that project dashboards should read) are empty. One project has master documents and one transmittal — i.e. document control works for the user who found it; nobody else has.

## Why it isn't used — diagnosed

**1. Engineering data lives in a different module.** SSOT (streams / equipment / lines / instruments / valves) is a full-featured UI at [/ssot](apps/web/src/app/ssot) with create/edit dialogs and tabs — but it is **not surfaced inside the project detail page**. The collections are defined as `projects/{projectId}/streams` etc. in [packages/firebase/src/collections.ts:183-188](packages/firebase/src/collections.ts#L183), but the project detail page does not link out to them and SSOT isn't linked to a project.

**2. BOM editor lives in Estimation, not Projects.** [/estimation/[id]/BOMEditorClient](apps/web/src/app/estimation/[id]/BOMEditorClient.tsx) is where BOMs actually get built. A project has no "Create BOM" button.

**3. No stats rollups are written.** The four `*_stats` subcollections that project dashboards would read — procurement, time, accounting, estimation — have **no Cloud Functions writing them**. Grepping [functions/src/index.ts](functions/src/index.ts) finds no trigger that populates them. The dashboard widgets that read them therefore show nothing or aren't built.

**4. No bulk import for engineering lists.** Even if the UI were linked, a 200-line line list is not realistic to enter by form. There's no Excel paste / CSV import anywhere in the engineering data flow.

**5. The Technical tab on a project edits project-level metadata, not engineering data.** See [TechnicalPageClient.tsx](apps/web/src/app/projects/[id]/technical/TechnicalPageClient.tsx) — it exposes project type and thermal-desalination specs, which is useful but not what users look for when they click "Technical".

**6. No onboarding path.** A new project has no nudge telling you to set up the charter, upload the P&IDs, import the equipment list. It renders as an empty shell.

## What does work

- **Project creation** — the 10 projects got created fine.
- **Master documents / transmittals** — for the one project that has them, the flow is functional. Cloud Functions generate transmittal PDFs.
- **Procurement-project sync** — [functions/src/procurementProjectSync.ts](functions/src/procurementProjectSync.ts) keeps charter procurement items' status in sync with the PO/RFQ they reference. **But only if charter items are manually created first.** No project in the audit has created them.

---

## Revival plan

Three tracks, in order.

### Track A — plumb what's built (days, not weeks)

Get the user to the features that already exist.

#### A1. Surface SSOT inside the project detail page

Add an "Engineering" tab on [projects/[id]](apps/web/src/app/projects/[id]) that renders the existing SSOT tabs (Streams, Equipment, Lines, Instruments, Valves), scoped to this project. The SSOT components can likely be reused — they already know about `projectId` in the collection path.

Remove standalone `/ssot` from the primary nav; make it project-scoped only. SSOT as a standalone area disconnected from projects is what caused this.

#### A2. Move BOM editor under project

Add a "BOM" tab on the project detail page that uses the [BOMEditorClient](apps/web/src/app/estimation/[id]/BOMEditorClient.tsx) component. Keep Estimation as a separate workflow for proposal-stage BOMs, but make "BOM on a won project" first-class under the project.

#### A3. Fix the "Technical" tab framing

Rename the existing Technical tab to "Project Settings" (since that's what it does — project type, thermal specs). Put engineering data under "Engineering" (A1) and BOM under "BOM" (A2). Three tabs users actually want.

#### A4. Add an onboarding checklist on an empty project

On project detail, if subcollections are empty, show a top banner:

- [ ] Upload master document list
- [ ] Import equipment list (CSV)
- [ ] Import line list (CSV)
- [ ] Create charter procurement items
- [ ] Set up BOM

Each checked off when the relevant collection has ≥1 doc. Low-tech, high-signal.

### Track B — fill the stats pipe (a week)

Without rollups, the project detail page can't tell you anything useful. Build four Cloud Functions triggered on writes in the source modules:

| Trigger                                                                 | Writes to                                        | Computes                                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------- |
| `onPurchaseRequestWrite`, `onPurchaseOrderWrite`, `onGoodsReceiptWrite` | `projects/{projectId}/procurement_stats/current` | PR count, RFQ count, PO count + value, GR count + value, outstanding commitments |
| `onTransactionWrite` (accounting)                                       | `projects/{projectId}/accounting_stats/current`  | cost-centre-tagged actuals, budget vs actual, open AP, open AR                   |
| `onTimeEntryWrite`                                                      | `projects/{projectId}/time_stats/current`        | hours by user, hours by phase                                                    |
| `onBOMItemWrite`                                                        | `projects/{projectId}/estimation_stats/current`  | BOM total, BOM category breakdown                                                |

These power the project dashboard widgets. Write them as idempotent `.set({ merge: true })` with the rolled-up totals, not incremental diffs — simpler and correct under concurrent triggers.

### Track C — make data entry realistic (a week each)

#### C1. Engineering-list CSV import

Equipment and line lists will not be hand-entered 200 rows at a time. Add a CSV upload on the Engineering tab for each list type. Template header rows in the repo, single-sheet spreadsheet, validate required columns before write. Reject the whole file on validation error so users get a clean dry-run.

#### C2. Transmittal flow discoverability

The one user who used this found it. Move the "New Transmittal" button to the project's Documents tab, make it visible even when master documents is empty (currently may be hidden). Make the master documents view the default on empty.

#### C3. Charter → procurement seeding

When a charter procurement item is created, offer "Create PR from this item" that pre-fills a `purchaseRequests` document with `projectId` and the item details. Inverts today's flow where users create a PR manually and then have to remember to link it to the project charter.

---

## What's missing that would make the module sticky

Beyond plumbing, three net-new features would shift the module from "place to park data" to "primary workspace":

1. **Project dashboard with real numbers** — once stats (Track B) exist, the dashboard becomes: "Committed ₹X, spent ₹Y (Z% of budget); 8 POs open, 2 overdue; 5 documents pending submission; 12 hours logged this week." Without this, "project" is just a folder name.

2. **Drawing register with revision control** — master documents does this for docs; extend to drawings: revisions A/B/C, current-revision pointer, auto-transmittal when revision changes.

3. **Project timeline / gantt derived from charter milestones** — if charter has milestones, render a timeline. Easy once charter items exist.

---

## Suggested sequence

- **Week 1** — Track A (A1–A4) — this is almost entirely UI re-plumbing of existing features. End-of-week result: a project detail page a user would actually want to open.
- **Week 2** — Track B — four Cloud Function rollups, one dashboard widget per rollup.
- **Week 3** — Track C (CSV import for engineering lists) — unlocks real data entry.
- **Week 4** — New project dashboard (use the rollups) + timeline.

After week 1 alone, the module stops looking broken. After week 4, it becomes the thing you open first when starting the day.

---

## Cross-module dependencies

- Track B is the same ask as **Proposal → Project auto-population** ([PROPOSALS-ROADMAP-2026-04-24.md](PROPOSALS-ROADMAP-2026-04-24.md) Tier 1 #4) — building projects properly is what makes proposal conversion worth the click.
- Track C charter → PR seeding depends on procurement blockers being resolved first ([PROCUREMENT-BLOCKERS-2026-04-24.md](PROCUREMENT-BLOCKERS-2026-04-24.md)) — no point creating a PR if the downstream GR/WCC buttons don't exist.

In practice: fix procurement UI first (1–2 days) → revive projects (this doc, weeks 1–2) → then proposals roadmap lands with both downstream modules ready to receive its output.
