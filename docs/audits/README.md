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

| Phase | Module(s)                    | Status                           | Report                                                       |
| ----- | ---------------------------- | -------------------------------- | ------------------------------------------------------------ |
| 0     | GRN Bills (narrow)           | COMPLETE (15 findings, 9 fixed)  | [phase-0-grn-bills.md](phase-0-grn-bills.md)                 |
| 1     | Accounting                   | COMPLETE (24 findings, 5 fixed)  | [phase-1-accounting.md](phase-1-accounting.md)               |
| 2     | Procurement                  | COMPLETE (22 findings, 11 fixed) | [phase-2-procurement.md](phase-2-procurement.md)             |
| 3     | Proposals + Estimation/BOM   | COMPLETE (20 findings, 5 fixed)  | [phase-3-proposals-bom.md](phase-3-proposals-bom.md)         |
| 4     | HR                           | COMPLETE (20 findings, 10 fixed) | [phase-4-hr.md](phase-4-hr.md)                               |
| 5     | Flow (Tasks/Inbox/Meetings)  | COMPLETE (23 findings, 10 fixed) | [phase-5-flow.md](phase-5-flow.md)                           |
| 6     | Projects + Entities + SSOT   | COMPLETE (20 findings, 3 fixed)  | [phase-6-projects-entities.md](phase-6-projects-entities.md) |
| 7     | Auth/Permissions + Admin     | COMPLETE (20 findings, 6 fixed)  | [phase-7-auth-admin.md](phase-7-auth-admin.md)               |
| 8     | Shared Packages + API Routes | COMPLETE (26 findings, 3 fixed)  | [phase-8-shared-packages.md](phase-8-shared-packages.md)     |

## Overall Summary

| Severity  | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 | Phase 7 | Phase 8 | **Total** |
| --------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | --------- |
| CRITICAL  | 4       | 5       | 6       | 1       | 2       | 4       | 4       | 1       | 0       | **27**    |
| HIGH      | 6       | 5       | 5       | 4       | 8       | 7       | 3       | 1       | 4       | **43**    |
| MEDIUM    | 5       | 7       | 6       | 8       | 9       | 9       | 12      | 8       | 18      | **82**    |
| LOW       | 0       | 7       | 5       | 7       | 1       | 3       | 1       | 10      | 4       | **38**    |
| **Total** | 15      | 24      | 22      | 20      | 20      | 23      | 20      | 20      | 26      | **190**   |

## Fix Progress

**53 of 190 findings fixed** (28%) across 9 commits + 7 verified as already resolved.

| Commit    | Description                                      | Findings Fixed                                                | Count |
| --------- | ------------------------------------------------ | ------------------------------------------------------------- | ----- |
| `d8e6570` | Flow security rules + vendor entity query fix    | FL-1, PE-1                                                    | 2     |
| `3cb25cc` | EntityId multi-tenancy filtering (Cluster A)     | AC-2, PR-3, PR-11, BP-3, HR-1                                 | 5     |
| `29f684f` | Consolidate duplicate permissions (Cluster B)    | AA-1, SP-1, SP-7, SP-13                                       | 4     |
| `6489217` | Authorization checks & self-approval (Cluster F) | AC-3, AC-4, PR-1, PR-2, PR-4, PR-6, FL-2, FL-5, FL-11         | 9     |
| `0443df1` | Data validation & integrity (Cluster D)          | AC-1, AC-5, PR-5, HR-2                                        | 4     |
| `e063816` | Types, permissions, and validation fixes         | BP-1, BP-2, BP-4, BP-5, FL-4, PE-2, PE-17, Phase 0 (entityId) | 8     |
| `5bafc70` | Permission flag, validation & conflict checks    | AA-18, PR-8, PR-9, FL-7, HR-6, HR-7                           | 6     |
| `58f8d40` | Task auth, project validation, approver config   | FL-3, PR-10, FL-10, HR-5                                      | 4     |
| `024218c` | Field validation, entityId filters, UX fixes     | PR-7, HR-9, HR-10, FL-15                                      | 4     |
| verified  | Already resolved (indexes exist, code has fixes) | FL-9, HR-3, HR-4, AA-3, AA-12, AA-2, AA-19                    | 7     |

### By Severity

| Severity  | Total   | Fixed  | Remaining |
| --------- | ------- | ------ | --------- |
| CRITICAL  | 27      | 16     | 11        |
| HIGH      | 43      | 30     | 13        |
| MEDIUM    | 82      | 7      | 75        |
| LOW       | 38      | 0      | 38        |
| **Total** | **190** | **53** | **137**   |

### Remaining CRITICAL & HIGH Findings

| ID    | Phase | Severity | Issue                                                        |
| ----- | ----- | -------- | ------------------------------------------------------------ |
| AC-6  | 1     | HIGH     | Recurring transaction edge cases (month-end, leap year, DST) |
| AC-7  | 1     | HIGH     | Payment allocations not validated before creation            |
| AC-8  | 1     | HIGH     | Floating point in financial calculations                     |
| AC-9  | 1     | HIGH     | Missing composite index for period validation                |
| AC-10 | 1     | HIGH     | GL validation only checks balance, not business logic        |
| FL-6  | 5     | HIGH     | Meeting action items orphaned if task creation fails         |
| FL-8  | 5     | HIGH     | Task auto-completion doesn't update parent task status       |
| PE-6  | 6     | CRITICAL | No SSOT access control scoping                               |
| PE-5  | 6     | HIGH     | Entity roles query not server-side filtered                  |
| PE-9  | 6     | HIGH     | No validation that project exists before SSOT operations     |
| PE-12 | 6     | HIGH     | Orphaned entity references in procurement documents          |
| HR-8  | 4     | HIGH     | Comp-off balance not tracked with expiry metadata            |

## Cross-Cutting Concerns

Issues that span multiple modules are tracked separately:

- **Multi-tenancy (entityId)**: ~~Most Firestore queries lack entityId filtering.~~ **Mostly fixed** (`3cb25cc`, `e063816`): Added entityId filtering to Accounting (AC-2), Procurement (PR-3), HR (HR-1, HR-10), Proposals (BP-3), Flow (FL-15). GoodsReceipt `entityId` made required and populated from PO (`e063816`). **Remaining**: Projects (PE-6) still needs filtering.
- **Firestore indexes**: ~~Missing indexes~~ **Mostly resolved** (`3cb25cc`): Added missing composite indexes for Procurement (PR-11). FL-9 and HR-3 verified as already present in `firestore.indexes.json`. **Remaining**: HR (HR-11), Flow (FL-12), Proposals (BP-10), Accounting (AC-9).
- **Permission checks**: ~~Client-side only in most modules.~~ **Mostly fixed** (`6489217`, `58f8d40`): Added authorization checks in Procurement (PR-1, PR-2, PR-4), Flow (FL-2, FL-5, FL-3). **Remaining**: HR (HR-18).
- **Duplicate permission systems**: ~~Incompatible systems in types and constants.~~ **Fixed** (`29f684f`): Consolidated to single `PERMISSION_FLAGS` in `@vapour/constants`. Removed duplicate `PermissionFlag` enum (AA-1, SP-1, SP-7, SP-13).
- **permissions2 not synced to claims**: ~~Cloud Functions don't include `permissions2` in custom claims (AA-3, AA-12).~~ **Verified as already fixed**: Both `onUserUpdate` and `syncUserClaims` Cloud Functions already include `permissions2` in custom claims with proper null-checking. **Remaining**: SP-4, SP-12 (shared packages audit references — may also be resolved).
- **Denormalized data staleness**: Vendor names, project names, equipment names stored in documents but never synced when source changes (PE-7, PE-13, PE-20). **Not yet fixed.**
- **Missing audit logging**: Permission changes (AA-8), employee updates (HR-14), and Cloud Function operations (SP-26) lack audit trail entries. **Not yet fixed.**
