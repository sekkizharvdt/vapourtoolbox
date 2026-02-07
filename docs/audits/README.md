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
| 1     | Accounting                   | COMPLETE (24 findings)          | [phase-1-accounting.md](phase-1-accounting.md)               |
| 2     | Procurement                  | COMPLETE (22 findings)          | [phase-2-procurement.md](phase-2-procurement.md)             |
| 3     | Proposals + Estimation/BOM   | COMPLETE (20 findings)          | [phase-3-proposals-bom.md](phase-3-proposals-bom.md)         |
| 4     | HR                           | COMPLETE (20 findings)          | [phase-4-hr.md](phase-4-hr.md)                               |
| 5     | Flow (Tasks/Inbox/Meetings)  | COMPLETE (23 findings)          | [phase-5-flow.md](phase-5-flow.md)                           |
| 6     | Projects + Entities + SSOT   | COMPLETE (20 findings)          | [phase-6-projects-entities.md](phase-6-projects-entities.md) |
| 7     | Auth/Permissions + Admin     | COMPLETE (20 findings)          | [phase-7-auth-admin.md](phase-7-auth-admin.md)               |
| 8     | Shared Packages + API Routes | COMPLETE (26 findings)          | [phase-8-shared-packages.md](phase-8-shared-packages.md)     |

## Overall Summary

| Severity  | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 | Phase 7 | Phase 8 | **Total** |
| --------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | --------- |
| CRITICAL  | 4       | 5       | 6       | 1       | 2       | 4       | 4       | 1       | 0       | **27**    |
| HIGH      | 6       | 5       | 5       | 4       | 8       | 7       | 3       | 1       | 4       | **43**    |
| MEDIUM    | 5       | 7       | 6       | 8       | 9       | 9       | 12      | 8       | 18      | **82**    |
| LOW       | 0       | 7       | 5       | 7       | 1       | 3       | 1       | 10      | 4       | **38**    |
| **Total** | 15      | 24      | 22      | 20      | 20      | 23      | 20      | 20      | 26      | **190**   |

## Cross-Cutting Concerns

Issues that span multiple modules are tracked separately:

- **Multi-tenancy (entityId)**: Most Firestore queries lack entityId filtering. Found in Accounting (AC-2), Procurement (PR-3), HR (HR-1), Proposals (BP-3), Flow (FL-15), and Projects (PE-6). GoodsReceipt type doesn't even have the field. Needs a systematic pass across all collections.
- **Firestore indexes**: Every composite query needs a corresponding index in `firestore.indexes.json`. Missing indexes found in Accounting (AC-9), Procurement (PR-11), HR (HR-3, HR-11), Flow (FL-9, FL-12), and Proposals (BP-10).
- **Permission checks**: Client-side only in most modules. No server-side enforcement in Cloud Functions for most operations. Found in Procurement (PR-1, PR-2, PR-4), Flow (FL-2, FL-3, FL-5), and HR (HR-18).
- **Duplicate permission systems**: `packages/types/permissions.ts` and `packages/constants/permissions.ts` define incompatible systems (AA-1, SP-1, SP-7, SP-13). Must consolidate.
- **permissions2 not synced to claims**: Cloud Functions don't include `permissions2` in custom claims (AA-3, AA-12, SP-4, SP-12). Extended permissions (HR, SSOT, etc.) don't work in Firestore rules.
- **Denormalized data staleness**: Vendor names, project names, equipment names stored in documents but never synced when source changes (PE-7, PE-13, PE-20).
- **Missing audit logging**: Permission changes (AA-8), employee updates (HR-14), and Cloud Function operations (SP-26) lack audit trail entries.
