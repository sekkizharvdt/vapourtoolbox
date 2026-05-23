# Devil's Advocate Review — Over-Engineering & Weaknesses

**Date:** 2026-05-23
**Reviewer role:** Adversarial / "devil's advocate" tester
**Scope:** Architecture, security, workflow, simplicity of usage, over-engineering
**Lens:** This is an internal tool for a **~10-person team**. Findings are judged against that team size, not against an enterprise SaaS product.

> **One-sentence verdict:** A genuinely well-built system carrying the machinery of a company 10× its size — and in several places it pays the _cost_ of enterprise-grade controls without the _benefit_, because the elaborate models are enforced inconsistently.

All headline numbers below were verified directly against the codebase at the time of review.

---

## The scale mismatch (root issue)

| Metric                   | Count                           | Note                               |
| ------------------------ | ------------------------------- | ---------------------------------- |
| Lines in `apps/web/src/` | ~454,000                        | ~45k LOC per employee              |
| Page routes              | 241                             |                                    |
| Top-level modules        | ~25                             |                                    |
| `firestore.rules`        | 2,206 lines / 96 KB             |                                    |
| `firestore.indexes.json` | 100 KB                          |                                    |
| Permission flags         | ~51 across **two** bitfields    | 1st bitfield exhausted its 31 bits |
| State machines           | 14 (92 states, 118 transitions) |                                    |
| Audit action types       | ~194, across 42 entity types    |                                    |

The domain complexity (thermal/MED design, double-entry accounting, EPC procurement) genuinely _is_ hard and justifies much of this. The over-engineering is concentrated in the **cross-cutting framework layers** — permissions, workflow, audit, tenancy, agents — not the domain logic.

---

## Finding 1 — Permission system is over-built _and_ unevenly enforced (worst of both worlds)

**Sharpest concern.** ~51 permission flags across two bitfields (`packages/constants/src/permissions.ts`) with VIEW/MANAGE/APPROVE granularity per module — including a 4-tier document workflow (MANAGE / SUBMIT / REVIEW / APPROVE_DOCUMENTS). But enforcement contradicts the model:

- **Storage rules are inconsistent.** `storage.rules:161-168` gates `vendor-quotes/` writes on `hasPermission(65536)` and `storage.rules:178-186` gates proposal PDFs on a permission bit — but the functionally identical `accounting/` (`storage.rules:40-43`), `offers/` (`118-129`), `vendor-offers/` (`144-151`), `rfq-pdfs/` (`133-140`), and `documents/` (`27-30`) paths allow **any logged-in user** to read, overwrite, and delete. A viewer can't touch a vendor _quote_ PDF but can delete every _accounting_ file.
- **Document permission tiers are half-applied.** The 4 document flags are checked for the project `masterDocuments` subcollection (`firestore.rules:1255-1294`), but the top-level `documents`, `documentFolders`, and `tasks` collections gate create/update on bare `isInternalUser()` — no permission bit at all (`firestore.rules:980-1037`).

**Implication:** the granular RBAC creates a _false sense_ of fine-grained control while the actual sensitive files sit behind "are you an employee?". For 10 trusted people, pick one: collapse to ~5 role-based flags (Admin / Finance / Procurement / Engineer / Viewer) enforced everywhere, **or** accept "logged-in = trusted" and delete the bit-math. Maintaining 51 flags honored in some files and ignored in adjacent ones is the costliest path.

---

## Finding 2 — 14 state machines for "someone makes it, someone okays it"

`apps/web/src/lib/workflow/stateMachines.ts` defines 14 machines. The PO machine alone has 11 states (DRAFT → PENDING_APPROVAL → APPROVED → ISSUED → ACKNOWLEDGED → IN_PROGRESS → DELIVERED → COMPLETED + AMENDED/CANCELLED). When the person issuing the PO sits across from the approver, most states are ceremony that generates support burden ("why is my PO stuck in ACKNOWLEDGED?"). The pattern is sound; the _quantity_ of distinct lifecycles is sized for a 200-person org with department handoffs.

---

## Finding 3 — Audit logging is SOX-grade forensics for an internal tool

~194 audit action types and 42 entity types (`packages/types/src/audit.ts`), with field-level change tracking, severity classification, and IP/user-agent capture. A 10-person team needs maybe a dozen verbs (CREATED/UPDATED/DELETED/APPROVED/REJECTED/POSTED) plus the actor. Today every new feature must invent and wire its bespoke audit action — pure tax.

---

## Finding 4 — Speculative AI-agent infrastructure shipped, then parked

The AI-agent roadmap is **parked** (per project memory / `AI-AGENT-ROADMAP-2026-04-25.md`), yet the live app already carries:

- `packages/agent-tools/` (408 LOC) + `apps/web/src/lib/agent/` (831 LOC: toolRuntime, HITL, identity, agentMemory, agentRunService)
- A whole `agentMemory` Firestore collection with security rules (and a TODO that it can be **spoofed** — see Finding 6)
- An `admin/agent-runs/[id]` detail UI (`AgentRunDetailClient.tsx`)
- 2 of the 14 state machines (`agentRunStateMachine`, `agentTaskStateMachine`) and 5 agent audit action types

That's well over 1,500 LOC plus a collection, rules, indexes, and UI for a feature that isn't running. This contradicts **`CLAUDE.md` rule 31** ("verify before writing… assume no legacy/future data unless verified"). Either commit to the agent now or pull this scaffolding until you do.

---

## Finding 5 — Multi-tenant plumbing in a single-tenant app

`tenantId` threads through custom claims, document fields, queries, and types — but `CLAUDE.md` itself states "Transaction queries should NOT filter by tenant (single-tenant system)." The app carries tenancy scaffolding (and the `entityId`→`tenantId` migration script) for a tenancy that doesn't exist and isn't queried. For one company, `tenantId` is a constant.

---

## Finding 6 — Genuine security gaps (smaller, but real)

- **Storage wide-open writes** (see Finding 1) — any employee can delete/overwrite accounting files, RFQ PDFs, vendor offers. Low malice risk in a trusted team, but it's an _accidental_-deletion footgun.
- **`agentMemory` source spoofing** — the rule comment admits it doesn't enforce that `source: 'agent'` rows come from the agent UID (`firestore.rules`, agentMemory block ~2131). If the agent goes live, any user can plant facts it will trust.

---

## Finding 7 — Workflow rigidity that hurts a small team

`preventSelfApproval()` on **leave requests** in a 750-line approval service (`apps/web/src/lib/hr/leaves/leaveApprovalService.ts`) can leave the most senior person unable to approve their own leave — the service even has special-case logic to _reduce_ the required approver count when the applicant is the only approver. That's complexity invented to work around complexity. In a 10-person company, leave approval is a Slack message.

---

## Where NOT to "simplify" (push-back on the obvious instinct)

- **Do not merge `services` / `bought-out` into `materials`.** In an EPC/engineering context these are genuinely distinct domain concepts (labor-with-rates vs raw goods vs complete sub-assemblies), and `CLAUDE.md`'s data dictionary already treats them as separate reference collections. Rule 32's history shows the _real_ duplicates (offers vs vendorQuotes) were already consolidated. Don't re-merge legitimately separate concepts to chase a LOC number.
- **Leave the domain logic alone** — thermal, accounting, and procurement complexity is mostly earned.

Lower-stakes maintenance smells worth a glance: duplicate logger (`@vapour/utils` re-wrapping `@vapour/logger`); whether `guide` / `estimation` modules are live or stubs.

---

## Recommended priority order

1. **Close the storage/document enforcement gap** — cheap; removes a real footgun and the inconsistency. _(hours)_
2. **Pull or finish the agent scaffolding** — dead weight with a security TODO attached. _(decision, then hours)_
3. **Decide the permission philosophy** — 51 inconsistently-enforced flags → either ~5 enforced-everywhere roles, or commit to the granularity. _(the big one)_
4. **Leave the domain logic alone** — complexity is mostly justified.

---

## Verification notes

Directly confirmed during review: scale metrics; `storage.rules` and `firestore.rules` document/task blocks (read in full); permission-flag count (45 in primary + extended bitfield); 14 state machines (enumerated); ~194 audit actions; 750-line leave service; agent-tools wired into `lib/agent/toolRuntime.ts` with a live `admin/agent-runs` UI. Module-consolidation suggestions from automated sub-agents were reviewed and partially rejected (see push-back section).
