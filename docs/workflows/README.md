# Vapour Toolbox — User Workflow Documentation

Per-module documentation of every workflow a user can perform in the app: entry points (routes), step-by-step "how to" guides, status/lifecycle transition tables, permissions per action, automatic behaviours (Cloud Functions, numbering, notifications), and cross-module handoffs.

Generated 2026-07-03 by tracing the actual code — routes under `apps/web/src/app/`, services under `apps/web/src/lib/`, the shared state machines in `apps/web/src/lib/workflow/stateMachines.ts`, and Cloud Functions under `functions/src/`. Every claim cites the file it came from. Anything found to be unwired or broken is flagged **⚠ Known gap** rather than described as working.

## The documents

| Doc                                                                                  | Covers                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Procurement](procurement.md)                                                        | Purchase requests → RFQs → vendor quotes/offer comparison → POs (two-tier Manager→Director approval) → goods receipts → three-way match / work completion certificates; packing lists; PO amendments; procurement numbering                             |
| [Accounting](accounting.md)                                                          | All 9 transaction types, invoice/bill approval and void, customer/vendor payments and allocation, payment batches, journal entries, chart of accounts, fiscal years/periods, fixed assets, recurring transactions, GST/TDS, reports, data health, trash |
| [Enquiries, Proposals & Projects](enquiries-proposals-projects.md)                   | Enquiry intake (manual + AI-parsed SOW), bid decisions, proposal drafting/pricing/PDF/approval/revision, conversion to project, project charter + approval, budget, milestones, document requirements, procurement items                                |
| [Documents, Estimation/BOM, Materials & Catalogs](documents-estimation-materials.md) | Master documents, revisions/submissions, transmittals (PDF/ZIP), CRS; BOM editor and cost calculation; materials master, prices, stock; bought-out catalog; services rate catalog                                                                       |
| [Entities, SSOT & Thermal Calculators](entities-ssot-thermal.md)                     | Vendor/customer master (contacts, bank details, opening balances, ledger), P&ID single source of truth (streams/equipment/lines/instruments/valves), and the full thermal calculator suite (MED designer, flash chamber, ~30 calculators, save/load)    |
| [HR & Flow](hr-and-flow.md)                                                          | Employees, leave requests and balances, holidays and comp-off, on-duty requests, travel expenses with AI receipt parsing; tasks, threads/@mentions, meetings with action items, inbox; in-app + email notifications                                     |
| [Admin, Permissions & Cross-Cutting](admin-and-permissions.md)                       | Sign-in and the permission bitmask (full flag tables), user invitation/approval/permission grants, audit logs and the activity feed, feedback, AI agent runs and HITL approvals, dashboard, trash conventions, super-admin                              |
| [Known Gaps & Problems](known-gaps.md)                                               | **Consolidated, prioritized list of every ⚠ gap found across the module docs** — from workflow-blocking (proposal acceptance unreachable) down to polish items                                                                                          |

## Conventions used throughout

- **Lifecycle tables** are written as _From → Action → To → Who/permission_, extracted from `stateMachines.ts` or the owning service where transitions are enforced inline.
- **Permissions** name the exact flag (`PERMISSION_FLAGS.*` / `PERMISSION_FLAGS_2.*` from `@vapour/constants`). Where the client intentionally defers to `firestore.rules` (`rule5-exempt` comments), that is stated.
- **Separation of duties**: `preventSelfApproval` / `requireApprover` gates are called out on every approval flow that has them — and flagged where they are missing.
- **⚠ Known gap** marks behaviour that is coded but unwired, stubbed, mismatched (e.g. a trigger listening on the wrong collection), or otherwise not working as a user would expect. Each module doc ends with a consolidated gap list.

## Keeping these current

These docs describe the code as of the generation date above. When a workflow, state machine, permission gate, or Cloud Function changes, update the corresponding section (and the gap list — several gaps here are candidates for fixes that would make parts of these docs stale).
