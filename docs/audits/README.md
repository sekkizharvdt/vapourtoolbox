# Codebase Audit Plan

Systematic module-by-module audit of the Vapour Toolbox codebase.

## Audit Categories

Each module is audited against these categories:

| Category           | What We Check                                                              |
| ------------------ | -------------------------------------------------------------------------- |
| **Security**       | Multi-tenancy isolation, permission checks, injection risks, data exposure |
| **Data Integrity** | Firestore indexes, atomic operations, race conditions, orphaned references |
| **UX/Workflow**    | Dead ends, missing feedback, permission edge cases, error handling         |
| **Code Quality**   | Duplicate logic, type safety, error handling patterns, consistency         |

## Severity Levels

- **CRITICAL**: Data leak, security bypass, data corruption, workflow completely blocked
- **HIGH**: Race condition, missing validation, poor UX that blocks users
- **MEDIUM**: Inconsistency, missing feature, minor UX gap
- **LOW**: Code style, minor improvement, nice-to-have

## Phases

| Phase | Module(s)                    | Status                          | Report                                                       |
| ----- | ---------------------------- | ------------------------------- | ------------------------------------------------------------ |
| 0     | GRN Bills (narrow)           | COMPLETE (15 findings, 8 fixed) | [phase-0-grn-bills.md](phase-0-grn-bills.md)                 |
| 1     | Accounting                   | COMPLETE (24 findings, 5 fixed) | [phase-1-accounting.md](phase-1-accounting.md)               |
| 2     | Procurement                  | COMPLETE (22 findings, 7 fixed) | [phase-2-procurement.md](phase-2-procurement.md)             |
| 3     | Proposals + Estimation/BOM   | COMPLETE (20 findings, 1 fixed) | [phase-3-proposals-bom.md](phase-3-proposals-bom.md)         |
| 4     | HR                           | COMPLETE (20 findings, 2 fixed) | [phase-4-hr.md](phase-4-hr.md)                               |
| 5     | Flow (Tasks/Inbox/Meetings)  | COMPLETE (23 findings, 4 fixed) | [phase-5-flow.md](phase-5-flow.md)                           |
| 6     | Projects + Entities + SSOT   | COMPLETE (20 findings, 1 fixed) | [phase-6-projects-entities.md](phase-6-projects-entities.md) |
| 7     | Auth/Permissions + Admin     | COMPLETE (20 findings, 1 fixed) | [phase-7-auth-admin.md](phase-7-auth-admin.md)               |
| 8     | Shared Packages + API Routes | COMPLETE (26 findings, 3 fixed) | [phase-8-shared-packages.md](phase-8-shared-packages.md)     |

## Overall Summary

| Severity  | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 | Phase 7 | Phase 8 | **Total** |
| --------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | --------- |
| CRITICAL  | 4       | 5       | 6       | 1       | 2       | 4       | 4       | 1       | 0       | **27**    |
| HIGH      | 6       | 5       | 5       | 4       | 8       | 7       | 3       | 1       | 4       | **43**    |
| MEDIUM    | 5       | 7       | 6       | 8       | 9       | 9       | 12      | 8       | 18      | **82**    |
| LOW       | 0       | 7       | 5       | 7       | 1       | 3       | 1       | 10      | 4       | **38**    |
| **Total** | 15      | 24      | 22      | 20      | 20      | 23      | 20      | 20      | 26      | **190**   |

## Fix Progress

**24 of 190 findings fixed** (13%) across 6 commits.

| Commit    | Description                                      | Findings Fixed                                        | Count |
| --------- | ------------------------------------------------ | ----------------------------------------------------- | ----- |
| `d8e6570` | Flow security rules + vendor entity query fix    | FL-1, PE-1                                            | 2     |
| `3cb25cc` | EntityId multi-tenancy filtering (Cluster A)     | AC-2, PR-3, PR-11, BP-3, HR-1                         | 5     |
| `29f684f` | Consolidate duplicate permissions (Cluster B)    | AA-1, SP-1, SP-7, SP-13                               | 4     |
| `6489217` | Authorization checks & self-approval (Cluster F) | AC-3, AC-4, PR-1, PR-2, PR-4, PR-6, FL-2, FL-5, FL-11 | 9     |
| `0443df1` | Data validation & integrity (Cluster D)          | AC-1, AC-5, PR-5, HR-2                                | 4     |

### By Severity

| Severity  | Total   | Fixed  | Remaining |
| --------- | ------- | ------ | --------- |
| CRITICAL  | 27      | 10     | 17        |
| HIGH      | 43      | 10     | 33        |
| MEDIUM    | 82      | 4      | 78        |
| LOW       | 38      | 0      | 38        |
| **Total** | **190** | **24** | **166**   |

### Remaining CRITICAL Findings

| ID      | Phase | Issue                                                                                                   |
| ------- | ----- | ------------------------------------------------------------------------------------------------------- |
| AC-6    | 1     | Missing GL balance validation on fiscal year close                                                      |
| AC-7    | 1     | No trial balance reconciliation before period close                                                     |
| AC-8    | 1     | Void transaction doesn't lock original GL entries (partial — entriesLocked added but no cascading lock) |
| PR-7    | 2     | No PO amount validation against budget                                                                  |
| PR-8    | 2     | Missing procurement approval workflow                                                                   |
| PR-9    | 2     | GoodsReceipt type missing entityId field                                                                |
| BP-1    | 3     | Missing type definition fields (approval workflow)                                                      |
| BP-2    | 3     | Missing type definition fields (project conversion)                                                     |
| BP-4    | 3     | No permission check on proposal list page                                                               |
| BP-5    | 3     | Missing entityId validation in BOM service                                                              |
| FL-3    | 5     | Missing permission checks on task CRUD                                                                  |
| FL-4    | 5     | No validation of meeting action items before finalize                                                   |
| PE-2    | 6     | Archived entities selectable as vendors                                                                 |
| PE-6    | 6     | No SSOT access control scoping                                                                          |
| PE-17   | 6     | Missing vendor role validation before assignment                                                        |
| AA-18   | 7     | Missing MANAGE_ADMIN permission flag                                                                    |
| Phase 0 | 0     | GRN multi-tenancy (entityId missing from GoodsReceipt)                                                  |

## Cross-Cutting Concerns

Issues that span multiple modules are tracked separately:

- **Multi-tenancy (entityId)**: ~~Most Firestore queries lack entityId filtering.~~ **Partially fixed** (`3cb25cc`): Added entityId filtering to Accounting (AC-2), Procurement (PR-3), HR (HR-1), Proposals (BP-3). **Remaining**: GoodsReceipt type still lacks `entityId` field (PR-9). Projects (PE-6) and Flow (FL-15) still need filtering.
- **Firestore indexes**: ~~Missing indexes~~ **Partially fixed** (`3cb25cc`): Added missing composite indexes for Procurement (PR-11). **Remaining**: HR (HR-3, HR-11), Flow (FL-9, FL-12), Proposals (BP-10), Accounting (AC-9).
- **Permission checks**: ~~Client-side only in most modules.~~ **Partially fixed** (`6489217`): Added authorization checks in Procurement (PR-1, PR-2, PR-4) and Flow (FL-2, FL-5). **Remaining**: Flow (FL-3), HR (HR-18).
- **Duplicate permission systems**: ~~Incompatible systems in types and constants.~~ **Fixed** (`29f684f`): Consolidated to single `PERMISSION_FLAGS` in `@vapour/constants`. Removed duplicate `PermissionFlag` enum (AA-1, SP-1, SP-7, SP-13).
- **permissions2 not synced to claims**: Cloud Functions don't include `permissions2` in custom claims (AA-3, AA-12, SP-4, SP-12). Extended permissions (HR, SSOT, etc.) don't work in Firestore rules. **Not yet fixed.**
- **Denormalized data staleness**: Vendor names, project names, equipment names stored in documents but never synced when source changes (PE-7, PE-13, PE-20). **Not yet fixed.**
- **Missing audit logging**: Permission changes (AA-8), employee updates (HR-14), and Cloud Function operations (SP-26) lack audit trail entries. **Not yet fixed.**
