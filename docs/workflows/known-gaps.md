# Known Gaps & Problems — Consolidated List

> **Re-verified 2026-07-21** against the code, workflow by workflow, while writing the
> [user testing scripts](user-testing/README.md). That pass replaced this list wholesale: the
> previous version (extracted 2026-07-03) had drifted badly in both directions — roughly twenty
> items it listed as broken had since been fixed, and it was missing about fifty real ones.
>
> Every entry below names the workflow that exercises it (`UAT-…`), so you can reproduce it from
> the matching script under [user-testing/](user-testing/). Items are ordered by how much they
> hurt, not by how hard they are to fix.
>
> **The dominant pattern is "the service works, nothing calls it."** Most of Priority 1 is a
> supported operation with no button — the state machine allows the transition, the service
> function exists and is permission-checked, and no screen invokes it. These are mostly small
> fixes with disproportionate user impact.

**Counts:** 67 open · 5 by design · ~20 closed since 2026-07-03

| Priority                                         | Open | Theme                                                  |
| ------------------------------------------------ | ---- | ------------------------------------------------------ |
| [P0 — blocks work today](#priority-0)            | 1    | A charter that can never be approved                   |
| [P1 — no way to perform the action](#priority-1) | 31   | Backend exists, no UI                                  |
| [P2 — data integrity](#priority-2)               | 11   | Wrong, stale or silently discarded data                |
| [P3 — authorization & audit](#priority-3)        | 7    | Access is coarser than intended, or attributed wrongly |
| [P4 — polish](#priority-4)                       | 17   | Wrong labels, dead filters, missing confirmations      |

---

## Priority 0 — Blocks real work today

### 0.1 A services-only proposal produces a charter that can never be approved

**Charter budget line items cannot be created or edited anywhere in the app.** They are written
once, during proposal → project conversion, from the proposal's included **Supply** scope items.
Charter approval requires at least one budget line with a description, a cost above zero and an
execution type.

So a proposal with no supply scope items — any pure-services engagement, which is a large share
of the real pipeline — converts into a project whose charter can never be submitted or approved,
and there is no screen that can fix it.

**Where:** `projects/charter/**` (no budget line editor), `charterValidationService.ts` (the
requirement), `projectConversion.ts` (the only writer)
**Exercised by:** UAT-PROJ-06, UAT-PROJ-07

---

## Priority 1 — The action is supported but there is no way to perform it

Each of these has working, permission-checked service logic behind it and no control that calls
it. Grouped by module.

### Estimation — BOMs are one-shot cost sheets

| #   | Problem                                                                                                                                                                    | Exercised by           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 1.1 | **A BOM cannot leave Draft.** Under Review, Approved, Released and Archived have no controls anywhere, so the Draft-only delete rule can never be demonstrated either.     | UAT-EST-07, UAT-EST-08 |
| 1.2 | **BOM items cannot be edited or removed.** Once added an item is permanent — a mistake means rebuilding the BOM from scratch.                                              | UAT-EST-09             |
| 1.3 | **Services cannot be attached to a BOM item.** No control to add one, no rate override, so the Service cost line is always ₹0.00 despite a fully working services catalog. | UAT-EST-05, UAT-EST-09 |
| 1.4 | **Bought-out lines are never priced.** An item taken from the Bought Out catalog stays at _Not calculated_ after Calculate Costs; the dialog's own helper text admits it.  | UAT-EST-04, UAT-EST-05 |
| 1.5 | **No path from a BOM into a purchase request.** No service, no button, no trigger. Procurement is fed exclusively from charter procurement items.                          | UAT-EST-09             |

### Materials & catalogs

| #    | Problem                                                                                                                                                                                                         | Exercised by |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1.6  | **Materials have no price screen** — no Add Price, no effective date, no history. The only way a material gets a price is a vendor quote accepted in Procurement. (Bought-out items do have price history.)     | UAT-MAT-04   |
| 1.7  | **Materials have no stock screen.** Inventory tracking can be switched on, but no receipt, issue or adjustment can be recorded and there is no history.                                                         | UAT-MAT-05   |
| 1.8  | **Materials cannot be deactivated or deleted.**                                                                                                                                                                 | UAT-MAT-07   |
| 1.9  | **Pipes, Flanges and Fittings have no Add button** — those three categories are read-only in practice.                                                                                                          | UAT-MAT-03   |
| 1.10 | **The bought-out spec code never resolves.** However fully a valve, pump or instrument is specified, the preview stays on _"Missing: type"_, so the duplicate-detection warning that depends on it never fires. | UAT-MAT-09   |
| 1.11 | **Five bought-out categories have no specification fields** — Motors, Safety Devices, Local Gauges, Steam Traps, Accessories show only Manufacturer, Model and Notes.                                           | UAT-MAT-08   |
| 1.12 | **A deleted service cannot be restored,** despite the confirmation dialog promising it can. There is no way to list inactive services.                                                                          | UAT-MAT-15   |
| 1.13 | **Shape calculator Save, Export PDF and Export Excel do nothing** — no file, no message. Share works.                                                                                                           | UAT-MAT-16   |

### Document control

| #    | Problem                                                                                                                                                                                   | Exercised by |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1.14 | **Transmittals cannot be marked Sent or Acknowledged.** Both statuses exist, neither has a control, so every transmittal is stuck at Generated.                                           | UAT-DOC-14   |
| 1.15 | **A Comment Resolution Sheet cannot be marked complete,** and comments are not extracted from the sheet — they must be retyped by hand.                                                   | UAT-DOC-11   |
| 1.16 | **A submission's client-review status is display-only.** It always reads Pending; there is no way to record client approval or approval-with-comments.                                    | UAT-DOC-06   |
| 1.17 | **Auto-numbering can only be configured on an empty project.** After the first document exists — including one created by import — the project is locked to manual numbering permanently. | UAT-DOC-01   |

### HR & Flow

| #    | Problem                                                                                                                                                                                                                   | Exercised by             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1.18 | **The HR approver lists have no screen at all** — they are maintained directly in the database. Until they are seeded, no leave or on-duty request can be approved by anyone. This is a hard precondition for testing HR. | UAT-HR-07, UAT-HR-14     |
| 1.19 | **Travel expense claims can never be marked reimbursed.** No button exists, so an approved claim sits at Approved forever.                                                                                                | UAT-HR-21                |
| 1.20 | **A travel expense report header cannot be edited,** and neither can an individual expense line — lines can only be added or deleted.                                                                                     | UAT-HR-17, UAT-HR-18     |
| 1.21 | **A saved leave draft cannot be edited or deleted** — it can only be submitted or cancelled.                                                                                                                              | UAT-HR-06, UAT-HR-09     |
| 1.22 | **An approved on-duty request cannot be cancelled,** even though the rule permits it up to a day before.                                                                                                                  | UAT-HR-15                |
| 1.23 | **There is no list of on-duty requests or travel expense claims for approvers.** The only route in is the card in the Flow Inbox or the email link. Leave is the exception — it has a Team Requests tab.                  | UAT-HR-14, UAT-HR-19     |
| 1.24 | **Tasks cannot be edited, moved backwards or cancelled.** The status control only steps Todo → In Progress → Done.                                                                                                        | UAT-FLOW-01, UAT-FLOW-02 |
| 1.25 | **A draft meeting cannot be edited** after saving, and no action item can be added from the meeting page.                                                                                                                 | UAT-FLOW-04              |
| 1.26 | **Threads and @mentions are unreachable.** The components exist and are mounted on no page.                                                                                                                               | UAT-FLOW-10              |

### Procurement, thermal, SSOT, cross-cutting

| #    | Problem                                                                                                                                         | Exercised by             |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1.27 | **A vendor quote has no Withdraw control.** Losing quotes are rejected implicitly when a winner is selected; there is no explicit action.       | UAT-PROC-10              |
| 1.28 | **Six calculators have no Save or Load** — Steam Tables, Seawater Properties, Custom / Lateral / Central Tube Bundle, Thermal Expansion.        | UAT-THRM-06              |
| 1.29 | **Condenser and Ejector are on the hub but are Coming Soon placeholders.**                                                                      | UAT-THRM-01              |
| 1.30 | **Export Excel on Process Data does nothing** — it shows "Excel export coming soon".                                                            | UAT-SSOT-01, UAT-SSOT-09 |
| 1.31 | **Trash exists only for Procurement and Accounting.** Every module soft-deletes, but only these two can restore, and only Accounting can purge. | UAT-ADM-22               |

---

## Priority 2 — Data integrity

| #    | Module     | Problem                                                                                                                                                                                                                    | Exercised by |
| ---- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 2.1  | Accounting | **Fixed-asset disposal and write-off post no ledger entry.** Status changes and the gain or loss is recorded, but cost and accumulated depreciation stay on the Balance Sheet — the books diverge from the asset register. | UAT-ACCT-27  |
| 2.2  | Projects   | **Budget threshold alerts are never raised.** Spend passing 90% or 100% updates the figures but notifies nobody — no task, no email, no banner.                                                                            | UAT-PROJ-05  |
| 2.3  | Proposals  | **Marking an enquiry Won or Lost does not move its linked proposal.** Record outcomes on the proposal instead, which does sync both.                                                                                       | UAT-ENQ-06   |
| 2.4  | Entities   | **Changing an entity's GSTIN does not propagate to existing purchase orders.** Name and email do propagate; GSTIN does not.                                                                                                | UAT-ENT-11   |
| 2.5  | Entities   | **A duplicate entity name is only caught on submit** — the live check while typing covers email, PAN and GSTIN only.                                                                                                       | UAT-ENT-07   |
| 2.6  | SSOT       | **Nothing prevents deleting a stream a line or equipment still references.** No warning, no cascade; the line keeps a tag pointing at a record that no longer exists and nothing flags it.                                 | UAT-SSOT-08  |
| 2.7  | Estimation | **The BOM Summary panel lags Calculate Costs.** Item cards update at once; the summary catches up seconds later and only after a reload, and the overhead / contingency / profit lines only on the next item added.        | UAT-EST-05   |
| 2.8  | Documents  | **The CRS upload dialog's Notes box is discarded** — anything typed there is silently lost.                                                                                                                                | UAT-DOC-11   |
| 2.9  | HR         | **Clearing a saved optional field on an employee profile does not blank it** — the old value returns on reopen. Fields are only written when non-empty.                                                                    | UAT-HR-02    |
| 2.10 | Materials  | **Deleting a bought-out item gives no confirmation, and a failed delete gives no message.** Reload before concluding it failed.                                                                                            | UAT-MAT-11   |
| 2.11 | Thermal    | **Deleting a saved calculation happens instantly with no confirmation.** One mis-click on the bin icon and the case is gone.                                                                                               | UAT-THRM-05  |

---

## Priority 3 — Authorization & audit

| #   | Module   | Problem                                                                                                                                                                                                                                                                                                                                                                                                                                             | Exercised by           |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 3.1 | Admin    | **One permission opens the whole admin area.** Manage Users grants every Administration page — Users, Feedback, Activity, Audit Logs, HR Setup, Settings, Backup, Email, Agent pages. There is no way to grant audit-log access without also granting the ability to change everyone's permissions. **Manage Admin Panel is not a substitute** — a holder of only that reaches the landing page while sub-pages such as HR Setup still refuse them. | UAT-ADM-08, UAT-ADM-12 |
| 3.2 | HR       | **Approve / Reject appear for anyone holding Approve Leaves,** but the save is refused with a raw _"You are not authorized to approve this request"_ unless the user is on the database-maintained approver list. The button should not be there.                                                                                                                                                                                                   | UAT-HR-07, UAT-HR-11   |
| 3.3 | Entities | **There is no separate edit-entities permission.** Anyone who can create an entity can edit, archive and restore any entity.                                                                                                                                                                                                                                                                                                                        | UAT-ENT-12             |
| 3.4 | Entities | **Entity edits are written straight from the browser.** Creation goes through a checked server-side route; edits do not — so the duplicate guards that protect creation do not protect a rename.                                                                                                                                                                                                                                                    | UAT-ENT-07             |
| 3.5 | Admin    | **User-approval history is attributed to "system"** rather than the approving admin. The separate user-approved entry does name them correctly.                                                                                                                                                                                                                                                                                                     | UAT-ADM-16             |
| 3.6 | SSOT     | **A refused save is indistinguishable from a network failure** — no permission, not assigned to the project and connection lost all produce the generic "Failed to save …".                                                                                                                                                                                                                                                                         | UAT-SSOT-09            |
| 3.7 | Admin    | **The System Status card is shown to every admin but opens only for super admins** — ordinary admins hit Access Denied.                                                                                                                                                                                                                                                                                                                             | UAT-ADM-24             |

---

## Priority 4 — Polish

| #    | Module      | Problem                                                                                                                                                                                 | Exercised by           |
| ---- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 4.1  | Accounting  | Bank transfers do not appear on the Payments list (only under All Transactions) and cannot be reopened for editing.                                                                     | UAT-ACCT-19            |
| 4.2  | Accounting  | Expense claims — same: visible only under All Transactions, not reopenable.                                                                                                             | UAT-ACCT-20            |
| 4.3  | Accounting  | All Transactions has no type filter for Direct Payments or Direct Receipts; they are reachable only via All Types or a `DPAY-` / `DRCPT-` search.                                       | UAT-ACCT-36            |
| 4.4  | Procurement | The three-way match asks for the vendor bill's **record identifier**, copied out of the browser address bar, instead of offering a picker.                                              | UAT-PROC-26            |
| 4.5  | Procurement | A submitted amendment cannot be recalled — the approver must reject it and it must be raised again.                                                                                     | UAT-PROC-31            |
| 4.6  | Documents   | A transmittal's ZIP carries one file per document, not the native + PDF pair.                                                                                                           | UAT-DOC-12             |
| 4.7  | Documents   | The client name on every transmittal is the literal text "Client Name", not the project's customer — on the cover sheet PDF and in the detail dialog.                                   | UAT-DOC-12             |
| 4.8  | Documents   | The transmittal document filter's **Client Review** option always returns zero documents.                                                                                               | UAT-DOC-12             |
| 4.9  | Documents   | The grouped view's Submit shortcut lands on the document's Overview tab rather than the submission screen.                                                                              | UAT-DOC-05             |
| 4.10 | Documents   | Status text is rendered three ways for the same value — `IN PROGRESS` in the list, `IN_PROGRESS` in the detail header, `In Progress` in the dropdown.                                   | UAT-DOC-05, UAT-DOC-08 |
| 4.11 | Documents   | The transmittals empty state names a _"Create Transmittal"_ button; the real one is **Generate Transmittal**.                                                                           | UAT-DOC-13             |
| 4.12 | Materials   | The Needs Review page's instructions are wrong — it points at a detail-page control that does not exist; saving from the edit page is what clears the flag.                             | UAT-MAT-06             |
| 4.13 | Estimation  | BOM items sort as text, so past ten items they appear 1, 10, 11, 2, 3…                                                                                                                  | UAT-EST-03             |
| 4.14 | Estimation  | Company Name on the quote PDF dialog is marked required but never validated — clearing it still produces a PDF.                                                                         | UAT-EST-06             |
| 4.15 | Entities    | The Role filter offers **Supplier**, which nothing can ever match — the create form only offers Vendor, Customer and Partner.                                                           | UAT-ENT-01             |
| 4.16 | Flow        | The Team Leave Notice card in the Inbox opens a "Leave request not found" page — the link targets a route that does not exist.                                                          | UAT-FLOW-08            |
| 4.17 | Thermal     | Heat Transfer and Heat Duty still exist as routes but are deliberately off the hub, which points at the unified Heat Exchanger Calculator instead. Any surviving link to them is a bug. | UAT-THRM-01            |

---

## By design — not defects

Confirmed intentional. Listed so they stop being re-reported.

| Behaviour                                                                                                                                                                                                                                       | Where                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **Goods receipts never show Pending** — a new receipt is created directly as In Progress.                                                                                                                                                       | UAT-PROC-21              |
| **"Mark as Sent" on an RFQ does not email vendors** — it records the date and locks the RFQ; the PDF is sent outside the app, and the dialog says so.                                                                                           | UAT-PROC-05              |
| **Procurement → Accounting hand-overs are best-effort but never silent.** A failure lets procurement continue and raises a high-priority task to create the document by hand. Receiving that task is expected; report it _with_ its error text. | UAT-PROC-25, UAT-PROC-34 |
| **Permission changes are not instant** for an already-signed-in user — up to a couple of minutes, or immediate on sign-out and back in.                                                                                                         | UAT-ADM-08               |
| **The AI agent is switched off.** Agent Runs and Agent Inbox are empty and nothing in the app can populate them; the pages themselves should still load.                                                                                        | UAT-ADM-20, UAT-ADM-21   |

---

## Closed since the 2026-07-03 audit

Kept as a record — all verified fixed in code during the 2026-07-21 pass. Do not reopen without
re-checking; several older notes elsewhere still describe these as broken.

**Sales & projects** — proposal acceptance is reachable (**Mark as Awarded**), so Convert to
Project works; charter approval now has a Submit step with self-approval blocking; cost-centre
creation on approval is idempotent; enquiry, proposal, project and PR numbers are all
counter-backed.

**Accounting** — payment batch execution is wired (with resume-on-partial-failure); the batch
bank account is selected rather than hardcoded; fiscal period close / lock / reopen and year-end
close plus reversal are wired; Invoice Send works (Approved → Posted); Bank Transfer and Expense
Claim have create dialogs; draft transactions no longer move chart-of-accounts balances.

**Procurement** — the work completion certificate notification link resolves; three-way-match
numbers are counter-backed; amendment approver assignment is enforced; failed accounting
hand-overs raise a high-priority task.

**HR** — comp-off has a daily expiry sweep, cancellation revokes the grant, and the annual reset
covers comp-off (policy: no carry-forward); on-duty approval emails do fire (the "wrong
collection" claim was never true); employee edit always enforces permission.

**Entities & SSOT** — GSTIN denormalization reads the right field; SSOT write access genuinely
requires Manage SSOT on all six tabs.

**Admin** — the admin area honours the dedicated admin permission as an alternative gate; user
approval records the approver and writes an audit event; the client/claims permission flag copy
is re-synced with a drift test guarding it.

**Thermal** — MVC is live; GOR, Flash Chamber and Reference Projects are on the hub; save/load is
wired on desuperheating, TVC, vacuum breaker, heat transfer and MED plant.

---

## Notes

- **Where the previous list went wrong.** It was written by reading services and state machines,
  which is why it recorded transitions as working when nothing in the UI invoked them. This pass
  walked each workflow from the screen inwards, which is what surfaced the ~30 Priority-1 items.
- **Two clusters are worth fixing together** rather than one at a time: the estimation cluster
  (1.1–1.5) makes BOMs usable end to end, and the HR cluster (1.18–1.23) makes leave and expenses
  approvable by someone other than a developer with database access.
- Update this file and the matching [user-testing](user-testing/) script together — the scripts
  carry inline "known issue, expected to fail" banners that go stale the moment a fix lands, and
  they regenerate the in-app guide via `node scripts/generate-workflow-guide.mjs`.
