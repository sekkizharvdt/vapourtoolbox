# Feature Triage — Backend Without UI & Other Disconnects

Review each item and mark: **BUILD** | **DELETE** | **SKIP**

---

## Documents Module

| #   | Feature                                             | Backend Status           | Decision | Notes |
| --- | --------------------------------------------------- | ------------------------ | -------- | ----- |
| 1   | Transmittals tab (7 components built, needs wiring) | Full UI + Service        | BUILD    |       |
| 2   | Comment Resolution Tables                           | Full service, no UI      | BUILD    |       |
| 3   | Document Submissions                                | Full service, no UI      | BUILD    |       |
| 4   | Document Templates                                  | Full CRUD service, no UI | BUILD    |       |

## Materials Module

| #   | Feature                     | Backend Status                                | Decision | Notes |
| --- | --------------------------- | --------------------------------------------- | -------- | ----- |
| 5   | Stock/Inventory tracking    | Full service (movements, levels, adjustments) |          |       |
| 6   | Price history management    | Full service (price history, lookups)         |          |       |
| 7   | Preferred vendor management | Full service                                  |          |       |

## Accounting Module

| #   | Feature                | Backend Status               | Decision | Notes                                |
| --- | ---------------------- | ---------------------------- | -------- | ------------------------------------ |
| 8   | Year-End Closing       | Full service + tests         |          |                                      |
| 9   | Exchange Rates / Forex | Types only, no service or UI |          | Indian Rupees only — may be obsolete |

## Notifications

| #   | Feature                    | Backend Status                 | Decision | Notes |
| --- | -------------------------- | ------------------------------ | -------- | ----- |
| 10  | Task Notification Bell     | 7 components, never mounted    |          |       |
| 11  | NotificationCenter drawer  | Full component, never imported |          |       |
| 12  | Legacy notification module | Service layer, entirely dead   |          |       |

## Flow Module

| #   | Feature                             | Backend Status              | Decision | Notes                                                                   |
| --- | ----------------------------------- | --------------------------- | -------- | ----------------------------------------------------------------------- |
| 13  | Old Slack-like components (5 files) | Superseded by Flow redesign |          | WorkspaceSidebar, ChannelView, ChannelHeader, channelIcons, context.tsx |

## Dead Types (No Implementation)

| #   | Feature                            | Backend Status                     | Decision | Notes                           |
| --- | ---------------------------------- | ---------------------------------- | -------- | ------------------------------- |
| 14  | Document Parsing types (449 lines) | Types only, mostly unused          |          | Only OfferParsingResult is used |
| 15  | BankTransfer / ExpenseClaim types  | Types defined, zero implementation |          |                                 |
| 16  | ProgressReport type                | Never referenced anywhere          |          |                                 |
| 17  | Invitation type                    | Only in a test file                |          |                                 |

## Orphaned UI Components

| #   | Feature                       | Backend Status                      | Decision | Notes                                                  |
| --- | ----------------------------- | ----------------------------------- | -------- | ------------------------------------------------------ |
| 18  | ProjectCharterDialog          | Redundant — charter page exists     |          |                                                        |
| 19  | Old shape selectors (3 files) | Replaced by calculator dropdowns    |          | MaterialSelector, ShapeCategorySelector, ShapeSelector |
| 20  | Proposal revision comparison  | Service never called from UI        |          |                                                        |
| 21  | Time tracking                 | Full service, intentionally unwired |          | User preference: no time tracking                      |

## State Machines Not Enforced in UI

| #   | Feature                        | Backend Status                       | Decision | Notes |
| --- | ------------------------------ | ------------------------------------ | -------- | ----- |
| 22  | Packing list state machine     | Defined, uses ad-hoc checks instead  |          |       |
| 23  | Purchase request state machine | Defined, uses local workflow instead |          |       |
| 24  | Travel expense state machine   | Used in service, not in UI           |          |       |
| 25  | Goods receipt state machine    | Used in service, not in UI           |          |       |

## Authorization Gaps (Permission flags without service enforcement)

| #   | Feature                                              | Notes                                                                                                                      | Decision |     |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------- | --- |
| 26  | 30 of 41 permission flags lack `requirePermission()` | Notable: MANAGE_COMPANY_SETTINGS, APPROVE_LEAVES, SUBMIT/REVIEW/APPROVE_DOCUMENTS, all material/shape/thermal MANAGE flags |          |     |

## Unreachable Pages

| #   | Feature          | Notes                                 | Decision |     |
| --- | ---------------- | ------------------------------------- | -------- | --- |
| 27  | /company/costing | Exists but not linked from navigation |          |     |
| 28  | /company         | Only reachable via admin redirect     |          |     |
