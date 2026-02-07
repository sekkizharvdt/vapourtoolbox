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
| 3     | Proposals + Estimation/BOM   | PENDING                         | [phase-3-proposals-bom.md](phase-3-proposals-bom.md)         |
| 4     | HR                           | PENDING                         | [phase-4-hr.md](phase-4-hr.md)                               |
| 5     | Flow (Tasks/Inbox/Meetings)  | PENDING                         | [phase-5-flow.md](phase-5-flow.md)                           |
| 6     | Projects + Entities + SSOT   | PENDING                         | [phase-6-projects-entities.md](phase-6-projects-entities.md) |
| 7     | Auth/Permissions + Admin     | PENDING                         | [phase-7-auth-admin.md](phase-7-auth-admin.md)               |
| 8     | Shared Packages + API Routes | PENDING                         | [phase-8-shared-packages.md](phase-8-shared-packages.md)     |

## Cross-Cutting Concerns

Issues that span multiple modules are tracked separately:

- **Multi-tenancy (entityId)**: Most Firestore queries lack entityId filtering. GoodsReceipt type doesn't even have the field. Needs a systematic pass across all collections.
- **Firestore indexes**: Every composite query needs a corresponding index in `firestore.indexes.json`.
- **Permission checks**: Client-side only. No server-side enforcement in Cloud Functions for most operations.
