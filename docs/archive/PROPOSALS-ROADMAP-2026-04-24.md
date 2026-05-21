# Proposals — Roadmap to Unlock Potential

Date: 2026-04-24
Primary user: Sekkizhar

## Where we stand

- `proposals`: 2 docs, last Feb 16 2026 (~9 weeks ago)
- `enquiries`: 2 docs, last Feb 15 2026
- `proposalTemplates`: 0 docs

The module is **~60% feature-complete** — the core is solid but the flow has dead-ends that kill real-world adoption. The proposal type definition at [packages/types/src/proposal.ts](packages/types/src/proposal.ts) runs ~900 lines, which tells you how much thought has gone into the model. The gap is connective tissue, not core features.

## What already works well

- **Enquiry intake with a bid/no-bid decision** — 5-axis evaluation (strategic alignment, win probability, commercial viability, risk, capacity). Good.
- **Unified scope editor** — 11-category EPC matrix (manufactured, bought-out, fabrication, piping, structural, electrical, instrumentation, site prep, process design, site work) with checklist and matrix display types, BOM linkage. Strong foundation.
- **Pricing editor** — margin-based (overhead, contingency, profit %, tax %) with BOM cost refresh.
- **Delivery, terms, milestones** — complete.
- **PDF generation** — branded proposal PDF with scope, pricing, T&Cs.
- **Revision tracking** — `previousRevisionId`, reason capture, comparison logic.
- **Proposal → Project conversion** — creates a project, carries over client info and budget lines from supply items. See [proposals/projectConversion.ts](apps/web/src/lib/proposals/projectConversion.ts).
- **Internal approval workflow** — submit → approve/reject with reasons.

## Half-built — finish these before building new features

### H1. Templates can't be created from scratch

The `/proposals/templates` page lists and deletes templates. It **cannot create one from blank** — templates can only be forked from existing proposals via "Save as Template" on proposal detail. Since you have 2 proposals and 0 templates, this is why the template library never seeded.

Fix — add a "New Template" button on [proposals/templates](apps/web/src/app/proposals/templates) that opens the same form as proposal-create but saves to `proposalTemplates` instead. Or if you prefer, require forking from an existing proposal but make it obvious.

### H2. Enquiry → Proposal is a one-shot, no status sync

Creating a proposal from an enquiry doesn't flip the enquiry status to `PROPOSAL_SUBMITTED`. The enquiry looks stale after, which makes you think you haven't acted on it.

Fix — when a proposal is created with `enquiryId` set, update the enquiry's status in the same write. When the proposal transitions to `SUBMITTED` / `ACCEPTED` / `REJECTED`, bubble the outcome back to the enquiry.

### H3. No send-to-customer action

Today you download the PDF and presumably email it from your own client. There's no "Send Proposal" button, no delivery log, no read receipt. This is invisible to you: you don't know if the client even opened it.

Fix — add "Send Proposal" on proposal detail: (a) generate a signed shareable link, (b) send email via Gmail MCP with the PDF attached, (c) log `sentAt`, `sentTo`, `openedAt` on the proposal.

### H4. PDF watermark flag exists but isn't surfaced

`watermark` param is supported by the PDF generator but no UI toggle. Useful for preview/draft versions before final.

Fix — small toggle on the PDF download button: "Watermark as DRAFT".

### H5. Templates can save a whole proposal but not individual scope categories

Your work repeats at the scope-category level (a heat-exchanger scope, a standard piping-fabrication scope, a process-design scope). Today, templates are all-or-nothing — you can't mix and match.

Fix — save/insert individual scope categories as snippets. Same underlying data, different granularity.

### H6. Manual cash flow table and other TODOs

There's a TODO in the codebase around [proposals/pricing](apps/web/src/app/proposals/[id]/pricing) for line-item margins. Margin is only set at aggregate %, not per scope category. For any proposal with a mix of engineering (30%+ margin) and bought-out items (10%) this matters.

---

## Missing features, ranked by impact

### Tier 1 — highest-impact (build these first)

#### 1. Proposal-to-Procurement bridge

When a proposal is accepted, nothing creates the purchase requests that'll source the bought-out items you promised. You're copy-pasting between modules.

Build — on `ACCEPTED` transition (or a manual "Create PRs from Proposal" button on the accepted proposal):

- Walk `scope` for items in `BOUGHT_OUT` / `MANUFACTURED` / etc. categories
- Group by vendor (where known) or leave vendor blank
- Create draft `purchaseRequests` pre-filled with qty, delivery dates from scope milestones, notes referencing `proposalId` and `proposalNumber`
- Link PR → proposal for traceability on both sides

This is the single most valuable feature you could build. It closes the loop from sales to sourcing and makes the module sticky because procurement becomes downstream of proposals.

#### 2. Pipeline kanban + win/loss tracking

You have 2 proposals. You can't see "3 in draft, 2 submitted, 1 in negotiation, 4 expired." A kanban replaces the list with columns by status and lets you drag-drop transitions.

Build — `/proposals/pipeline` route with columns (Draft, Submitted, Negotiating, Won, Lost). On every transition to Won/Lost, force capture of a reason (price, scope, competitor, timing, relationship, other). After 20 proposals you'll have actionable win-rate analytics.

#### 3. Send + track

Covered in H3 above but worth repeating — until proposals can be sent with tracking, the module won't feel like a sales tool. Gmail MCP is already available in this workspace; a send action that uses it + logs `openedAt` from a tracking pixel is a few hours of work.

#### 4. Scope → project task automation on conversion

Today's conversion carries budget. It doesn't carry execution structure. The scope matrix has phases (engineering, procurement, manufacturing, site, commissioning) — those should become project milestones/tasks on conversion, not be re-entered.

Build — in [projectConversion.ts](apps/web/src/lib/proposals/projectConversion.ts), after creating the project, also write charter tasks mapped from scope delivery phases, with start/end dates derived from the delivery schedule.

### Tier 2 — high value, less urgent

#### 5. Excel paste / bulk scope import

Enquiries arrive as Excel BOMs. Forcing you to type 50 line items into a matrix is a dealbreaker. Paste-from-Excel with header-mapping would lower the bar.

#### 6. Per-line-item margin

Aggregate margin hides the mix. Let engineering bill at 30%, bought-out at 10%, site work at 20% per scope category, then roll up. This is straightforward on the current data model.

#### 7. Scope-category library (finishing H5)

Save categories like "Standard MED Effect Scope" or "Standard P&ID Engineering" as library entries that any new proposal can insert. Feels small, but in practice this is where proposal-speed wins live.

### Tier 3 — nice to have

- Multi-level approval (value-based: >N lakh needs CFO).
- Competitor/market-rate notes per line item.
- Follow-up reminder cron (ping you when a submitted proposal has gone 7/14/30 days without response).
- Customer portal with a shared link (requires auth design — defer).
- Margin analytics dashboard (by client, category, quarter) — requires volume first.
- Auto-extract line items from PDF in the enquiry attachment — parser-heavy; worth it later.

---

## Why the module isn't sticky today — pattern analysis

Looking at how you actually work (small engineering-services / procurement firm, BOMs and projects downstream of wins), four things specifically break the flywheel:

1. **Nothing happens when you win.** You convert to a project manually, copy scope into a PR manually, start execution manually. A proposal win should automate at least one of those.
2. **You can't see your pipeline.** 2 proposals make a table look empty; a kanban makes it feel like a tool.
3. **Starting from blank every time.** No template library means each proposal is a 2-hour task. Templates + category snippets pull that under 30 minutes.
4. **You don't know if anyone read it.** No send-tracking means the proposal exits your system the moment the PDF downloads.

Fix 1-4 and a proposal becomes a thing you use weekly, not twice a quarter.

---

## Suggested build order

1. **Week 1** — H2 (enquiry status sync) + H1 (create template from scratch) + in-place fixes.
2. **Week 2** — Tier 1.2 pipeline kanban + Tier 1.3 send/track.
3. **Week 3** — Tier 1.1 PR auto-create on accept. (The big one; do it last because it needs procurement blockers fixed — see [PROCUREMENT-BLOCKERS-2026-04-24.md](PROCUREMENT-BLOCKERS-2026-04-24.md) — so downstream PRs actually move.)
4. **Week 4** — Tier 1.4 scope → project tasks on conversion.
5. **Month 2** — Tier 2 (Excel paste, per-line-item margin, scope snippet library).

By the end of month 2, proposals → projects → procurement → accounting becomes a single connected workflow, and the module stops being optional.
