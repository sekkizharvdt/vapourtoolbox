# Admin, Permissions & Cross-Cutting — User Workflows

> Generated 2026-07-03 from code inspection (routes, services, Cloud Functions). Part of the [module workflow docs](README.md).

Ground truth for this document comes from the files cited inline. Everything is a static-export Next.js client app talking directly to Firestore, with a small set of Cloud Functions doing privileged/scheduled work.

---

## 1. Signing in & what determines access

### 1.1 Sign-in flow

Sign-in is handled by `apps/web/src/contexts/AuthContext.tsx` and surfaced on `apps/web/src/app/login/page.tsx`. Two methods are offered:

- **Google sign-in** (`signInWithGoogle`) — popup OAuth.
- **Passwordless email link** (`sendEmailLink` → `apps/web/src/app/auth/email-link/page.tsx` → `completeEmailLinkSignIn`).

On sign-in the app enforces a **domain gate** (`isAuthorizedDomain`, from `@vapour/constants`): the email must be `@vapourdesal.com` (internal) **OR** the user must have a pending, non-expired invitation (`invitations` collection) **OR** an existing `users/{uid}` doc. Otherwise it signs out with `UNAUTHORIZED_DOMAIN` (`AuthContext.tsx` ~lines 468, 640).

First-time provisioning writes a `users/{uid}` doc (`AuthContext.tsx` ~531 / ~712):

- **Invitation present** → `status: 'active'`, permissions taken from the invitation.
- **Internal domain, no invitation** → `status: 'active'` with the `VIEWER` preset.
- **External, no invitation** → `status: 'pending'`, `permissions: 0` (waits for admin approval; user is routed to `apps/web/src/app/pending-approval`).

Every sign-in / sign-out / failure is audit-logged (`LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`).

### 1.2 Permissions become the source of truth (not the client)

The client-written `permissions` field on a brand-new user doc is **not trusted**. The Cloud Function `functions/src/userManagement.ts` (`onUserUpdate`, triggers on any `users/{userId}` write) recomputes the grant from admin-controlled sources (`resolveInitialGrant`) and then writes the authoritative values into **Firebase custom claims** via `setCustomUserClaims`. It also stamps `lastClaimUpdate`.

The client listens to its own user doc; when `lastClaimUpdate` changes it force-refreshes the ID token so new permissions take effect **without sign-out** (`AuthContext.tsx` ~298). Claims carry: `tenantId` (default `default-entity`), `permissions`, `permissions2`, `domain` (`internal`/`external`), `allowedModules`, `assignedProjects`, `department`.

`validateClaims` (`AuthContext.tsx` ~55) treats a user with **both** permission fields at 0 as `pending` (no access yet); a malformed `domain` claim as `invalid` (forced sign-out).

### 1.3 There are no "roles" — just a 64-bit permission bitmask

Permissions are two bitwise integer fields defined in `packages/constants/src/permissions.ts`:

- `permissions` — `PERMISSION_FLAGS` (bits 0–30; bit 31 reserved).
- `permissions2` — `PERMISSION_FLAGS_2` (the original field ran out of bits).

Checks are `(userPerms & flag) === flag` via `hasPermission` / `hasPermission2`. `PERMISSION_PRESETS` (VIEWER, MANAGER, FINANCE, ENGINEERING, PROJECT_MANAGER, PROCUREMENT, FULL_ACCESS) are just convenience bit-combos, not roles. The old `MANAGE_ROLES`/`VIEW_USERS` flags are `@deprecated`.

**Super admin** is not a flag — it is "has _every_ bit in both fields." `apps/web/src/app/super-admin/layout.tsx` computes `getAllPermissions()` / `getAllPermissions2()` and checks the user has them all (bitwise-subset, so adding new flags doesn't silently demote existing super admins).

**Admin panel access** is gated on `MANAGE_USERS` (`apps/web/src/app/admin/layout.tsx` ~75) — note this is the _only_ gate for the whole `/admin/*` tree, including agent-runs, audit-logs, feedback, settings (see ⚠ gaps below). There is a separate `MANAGE_ADMIN` flag in `permissions2` but the layout does **not** use it.

#### Permission flags — `permissions` field (`PERMISSION_FLAGS`)

| Flag (bit)                    | Group   | Unlocks                                                         |
| ----------------------------- | ------- | --------------------------------------------------------------- |
| `MANAGE_USERS` (0)            | MANAGE  | Create/edit/deactivate users; **gates entire `/admin` section** |
| `VIEW_USERS` (1)              | VIEW    | ⚠ Deprecated — admin is `MANAGE_USERS`-only                     |
| `MANAGE_ROLES` (2)            | MANAGE  | ⚠ Deprecated — role system removed                              |
| `MANAGE_PROJECTS` (3)         | MANAGE  | Create/edit/archive projects                                    |
| `VIEW_PROJECTS` (4)           | VIEW    | View projects                                                   |
| `VIEW_ENTITIES` (5)           | VIEW    | View vendors/customers/entities                                 |
| `CREATE_ENTITIES` (6)         | action  | Create entities                                                 |
| `EDIT_ENTITIES` (7)           | MANAGE  | Edit entities (admin-only in UI)                                |
| `DELETE_ENTITIES` (8)         | MANAGE  | Delete/archive entities (most sensitive)                        |
| `MANAGE_COMPANY_SETTINGS` (9) | MANAGE  | Company-wide settings                                           |
| `VIEW_ANALYTICS` (10)         | VIEW    | Analytics dashboards                                            |
| `EXPORT_DATA` (11)            | action  | Export data/reports                                             |
| `MANAGE_TIME_TRACKING` (12)   | MANAGE  | ⚠ Deprecated — Flow is open to all                              |
| `VIEW_TIME_TRACKING` (13)     | VIEW    | View task/time reports (admin-only)                             |
| `MANAGE_ACCOUNTING` (14)      | MANAGE  | Create transactions, manage accounts                            |
| `VIEW_ACCOUNTING` (15)        | VIEW    | View transactions/financial reports                             |
| `MANAGE_PROCUREMENT` (16)     | MANAGE  | Create/edit PRs, RFQs, POs                                      |
| `VIEW_PROCUREMENT` (17)       | VIEW    | View PRs/RFQs/POs                                               |
| `MANAGE_ESTIMATION` (18)      | MANAGE  | Create/edit estimates & BOMs                                    |
| `VIEW_ESTIMATION` (19)        | VIEW    | View estimates/BOMs                                             |
| `VIEW_PROPOSALS` (20)         | VIEW    | View proposals & enquiries                                      |
| `MANAGE_PROPOSALS` (21)       | MANAGE  | Create/edit proposals & enquiries                               |
| `MANAGE_DOCUMENTS` (27)       | MANAGE  | Master doc list, bulk imports, company docs                     |
| `SUBMIT_DOCUMENTS` (28)       | action  | Submit documents for review                                     |
| `REVIEW_DOCUMENTS` (29)       | action  | Client review/comment (external users)                          |
| `APPROVE_DOCUMENTS` (30)      | approve | Approve doc submissions & comment resolutions                   |

(Bits 22–26 are historical deprecated accounting flags, left documented but unused.)

#### Permission flags — `permissions2` field (`PERMISSION_FLAGS_2`)

| Flag (bit)                                            | Group       | Unlocks                                                                              |
| ----------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------ |
| `VIEW_MATERIAL_DB` (0) / `MANAGE_MATERIAL_DB` (1)     | VIEW/MANAGE | Material database (viewing open to all; manage gated)                                |
| `VIEW_SHAPE_DB` (2) / `MANAGE_SHAPE_DB` (3)           | VIEW/MANAGE | Shape database                                                                       |
| `VIEW_BOUGHT_OUT_DB` (4) / `MANAGE_BOUGHT_OUT_DB` (5) | VIEW/MANAGE | Bought-out catalog                                                                   |
| `VIEW_THERMAL_DESAL` (6) / `MANAGE_THERMAL_DESAL` (7) | VIEW/MANAGE | Thermal desalination (incl. flash chamber)                                           |
| `VIEW_THERMAL_CALCS` (8) / `MANAGE_THERMAL_CALCS` (9) | VIEW/MANAGE | Thermal calculators (config is admin-only)                                           |
| `VIEW_SSOT` (10) / `MANAGE_SSOT` (11)                 | VIEW/MANAGE | Process data (SSOT: lines/streams/equipment)                                         |
| `VIEW_HR` (12)                                        | VIEW        | HR module reports                                                                    |
| `MANAGE_HR_SETTINGS` (13)                             | MANAGE      | Leave types, policies, holidays                                                      |
| `APPROVE_LEAVES` (14)                                 | approve     | Approve/reject leave requests                                                        |
| `MANAGE_HR_PROFILES` (15)                             | MANAGE      | Edit employee HR profiles                                                            |
| `MANAGE_ADMIN` (16)                                   | MANAGE      | "Access admin panel / system settings" (declared but ⚠ not enforced by admin layout) |
| `INSPECT_GOODS` (17)                                  | action      | Create GRs, inspect received goods                                                   |
| `APPROVE_GR` (18)                                     | approve     | Approve GRs, send to accounting                                                      |

`OPEN_MODULES` (no permission needed): Flow (tasks & time), Company Documents (viewing), Thermal Calculators (viewing), Material/Shape/Bought-Out DBs (viewing), HR (My Leaves, Expenses, Calendar, Directory).

The **dashboard** (`apps/web/src/app/dashboard/page.tsx`) filters `MODULES` by `requiredPermissions`/`requiredPermissions2` against the user's claims, so each user only sees module cards they can access.

### 1.4 Service-layer enforcement

`apps/web/src/lib/auth/authorizationService.ts` provides the guards services call: `requirePermission`, `requireAnyPermission`, `requireApprover` (user must be in an approver list), `requireOwnerOrPermission`, and `preventSelfApproval` (separation of duties — you can't approve your own request). All throw `AuthorizationError`.

---

## 2. Step-by-step "How to…" guides

### 2.1 Create / manage a user and grant permissions

Page: `apps/web/src/app/admin/users/page.tsx` (requires `MANAGE_USERS`).

**Invite a new user**

1. Admin → User Management → **Invite User** (`InviteUserDialog`). This writes an `invitations` doc with pre-configured `permissions`/`permissions2`, department, job title. Invitation creation is gated by `MANAGE_USERS` in `firestore.rules`.
2. When the invitee signs in, provisioning auto-activates them with the invited permissions (`AuthContext.tsx` `checkAndAcceptInvitation`).

**Approve a pending user**

1. Pending users appear in the amber "Awaiting Approval" section at the top of the page.
2. Click **Review & Approve** → `ApproveUserDialog` (`apps/web/src/components/admin/ApproveUserDialog.tsx`). Pick regular + admin-only permissions (or "Full Access").
3. Saving sets `status: 'active'`, `isActive: true`, and the chosen `permissions`/`permissions2` on the user doc (~line 153). `onUserUpdate` then mints custom claims. Rejecting sets `status: 'inactive'`, `isActive: false` (~line 201).

**Edit an existing user's permissions**

1. Users table → row action **Edit User** → `EditUserDialog` (`apps/web/src/components/admin/EditUserDialog.tsx`).
2. It writes the new `permissions`, `permissions2`, `updatedAt`, and crucially `updatedBy: authUser.uid` (line 236), then calls `logAuditEvent` (line 267). The `onUserUpdate` function reads `updatedBy` to attribute the `CLAIMS_UPDATED` audit entry to the real admin.

**Permission Matrix** (`apps/web/src/app/admin/users/permissions/page.tsx`): a read/analysis view of `MODULE_PERMISSIONS` (dual view by module / by user).

Module access is visualized per user via chips (`getModuleAccess` over `RESTRICTED_MODULES` → manage/view/none). All-bits-set shows a "Full Access" star chip.

⚠ **Known gap:** `ApproveUserDialog` sets `updatedAt` but **not** `updatedBy` (grep shows no `updatedBy`), so approval-driven `USER_ACTIVATED`/`CLAIMS_UPDATED` audit rows fall back to actor `system` in `onUserUpdate` rather than the approving admin. `EditUserDialog` does it correctly.

**Admin safeguard:** `onUserUpdate` refuses to delete or deactivate the **last active admin** (`countActiveAdmins`, throws to abort).

### 2.2 Review activity / audit logs

Two surfaces, both reading the `auditLogs` collection:

- **Activity Feed** (`apps/web/src/app/admin/activity/page.tsx`) — human-friendly, date-grouped (Today/Yesterday/Earlier), last 100 entries via `onSnapshot`, filterable by module and user, with a summary strip (entries, critical, failed, **agent actions**, top module, top actor). Entities are bucketed into modules by `ENTITY_TO_MODULE`.
- **Audit Logs** (`apps/web/src/app/admin/audit-logs/page.tsx` → `AuditLogList`) — the raw, filterable log surface.

Both require `MANAGE_USERS` (parent admin layout). Errors surface as "you may not have permission to view audit logs."

### 2.3 Submit feedback (regular user) and triage it (admin)

**Submit** (`apps/web/src/app/feedback/page.tsx` → `apps/web/src/components/common/FeedbackForm/index.tsx`, open to any authenticated user):

1. Choose type (bug / feature), module, title, description; optionally severity/frequency/impact, steps-to-reproduce, expected/actual behavior, console errors, and screenshot uploads.
2. Submit writes a `feedback` doc with `status: 'new'`, `priority` defaulted (`bug`→medium, else low), plus `userId/userEmail/userName`, `pageUrl`, `browserInfo` (`index.tsx` ~190).
3. The same page shows "Your Submissions" (`UserFeedbackList`) so the user can track status.

**Triage** (`apps/web/src/app/admin/feedback/page.tsx` → `FeedbackStats` + lazy `FeedbackList`, requires `MANAGE_USERS`):

- Filter by status; open a feedback item; change its **status**, add **adminNotes**, adjust priority via `updateDoc` (`FeedbackList.tsx` ~129/152/165).
- Admin dashboard "Open Feedback" stat counts `status ∈ {new, in_progress}` (`apps/web/src/app/admin/page.tsx` ~73).

Note: an MCP tool set (`mcp__firebase-feedback__*`) also exists for listing/searching/updating feedback programmatically.

### 2.4 Approve / reject an AI agent action (HITL)

Concept (`apps/web/src/lib/agent/hitl.ts` header): any tool registered with `requireHumanApproval: true` calls `requestApproval()`, which writes a **PENDING** `agentTasks` row and either blocks (`awaitApproval`, polls every 2s, 5-min default timeout) or parks the run in `AWAITING_HITL`.

**As an approver:**

1. Go to **Admin → Agent Inbox** (`apps/web/src/app/admin/agent-tasks/page.tsx` → `apps/web/src/components/admin/AgentTaskList.tsx`).
2. The **Pending** tab lists requests (real-time `onSnapshot`, scoped to your `tenantId`, oldest-first) showing risk (LOW/MEDIUM/HIGH), tool name, description, affected entity, run id, and age.
3. **Approve** → `approveAgentTask` writes `status: APPROVED`, `decidedBy`/`decidedByName`, `decidedAt`. This unblocks the agent run.
4. **Reject** → opens a dialog for an optional reason → `rejectAgentTask` writes `status: REJECTED` + `decisionReason`. This cancels the run's action; the reason is stored and may resurface in future runs.
5. The **History** tab shows decided tasks with who decided and when.

Transitions are validated by `agentTaskStateMachine` (`decideAgentTask`), so a second concurrent decision on the same task is rejected — the first decision wins deterministically. Other terminal states: `CANCELLED` (orchestrator pulled the request), `EXPIRED` (TTL — see §4).

### 2.5 Review agent runs (observability)

Pages: `apps/web/src/app/admin/agent-runs/page.tsx` (list → `AgentRunList`) and `apps/web/src/app/admin/agent-runs/[id]/AgentRunDetailClient.tsx` (drill-down). Runs are **immutable from the UI** (written by the orchestrator; no create/edit routes — see the `rule28-exempt` note at the top of the list page).

The detail view joins three sources by `agentRunId`:

- The **run row** (`agentRuns`): trigger type/source, status (PENDING/RUNNING/AWAITING_HITL/COMPLETED/FAILED/CANCELLED), duration, cost (`$` + input/output tokens), tool call count, HITL request/pending counts, summary, error.
- **Human approvals** — the run's `agentTasks` with status/risk/decision.
- **Transcript** — every `auditLogs` row for the run, in time order, including the agent's side-effect writes (PR creates, status flips) inline with tool invocations. This works because agent writes go through `createAgentAuditContext` (`clientAuditService.ts` ~355), tagging every row `actorType: 'agent'` + `agentRunId` + `agentToolName`.

### 2.6 Use the dashboard

`apps/web/src/app/dashboard/page.tsx` (default post-login landing, per `login/page.tsx`):

- Personalized greeting; ⌘K search hint.
- `ActivityDashboard` component (recent activity for the user).
- **Available Modules** grid — only `category: 'application'` modules the user's permissions unlock, each with live stats (`useAllModuleStats`) and sorted by priority.
- A compact **Coming Soon** strip for `coming_soon` modules.
- "No modules available / contact your administrator" fallback for users with no grants.

### 2.7 Restore / purge items from trash (app-wide soft-delete convention)

**Convention:** destructive deletes are **soft** — a `deletedAt`/`isDeleted` marker is set rather than removing the doc; list queries filter these out; a per-module **Trash** page lets you restore, and (in accounting) permanently delete.

Trash routes that exist today: `apps/web/src/app/accounting/trash` and `apps/web/src/app/procurement/trash`.

- **Procurement trash** (`.../procurement/trash/page.tsx`): lists soft-deleted docs; **Restore** → `restoreProcurementDocument` (`apps/web/src/lib/procurement/procurementDeleteService.ts`, which also exports `softDeletePurchaseRequest`, `softDeleteRFQ`, `softDeletePurchaseOrder`, `softDeleteGoodsReceipt`, `softDeletePackingList`, `softDeleteAmendment`, `softDeleteVendorQuote`). No hard-delete here.
- **Accounting trash** (`.../accounting/trash/page.tsx`): **Restore** → `restoreTransaction`; **Delete Permanently** → `hardDeleteTransaction` (confirmation dialog; "data will be archived for audit purposes"). The audit taxonomy backs this: `TRANSACTION_SOFT_DELETED`, `TRANSACTION_RESTORED`, `TRANSACTION_HARD_DELETED`.

⚠ **Known gap / inconsistency:** the soft-delete convention is followed in services broadly, but dedicated **Trash UIs only exist for accounting and procurement**. Other modules soft-delete but have no restore surface. Only accounting exposes a permanent-purge action.

### 2.8 Super-admin capabilities

`apps/web/src/app/super-admin/` (requires _all_ permission bits — see §1.3). `super-admin/page.tsx` is a module-integration console (Accounting integrations active; others "coming soon") plus **System Status** (`super-admin/system-status`, package versions / vulnerabilities) and `super-admin/module-integrations`. The layout's access-denied panel even prints manual Firestore-console instructions for bootstrapping the first super admin (set `permissions`, `status: 'active'`, `isActive: true`, then re-login).

Note the admin dashboard's "System Status" card links into `/super-admin/system-status`, so a non-super `MANAGE_USERS` admin will hit the super-admin access gate there.

---

## 3. What gets audit-logged (and where to see it)

Writer: `logAuditEvent` in `apps/web/src/lib/audit/clientAuditService.ts` → `auditLogs` collection. Each row records actor (id/email/name/permissions), `actorType` (`user`|`agent`|`system`), optional `agentRunId`/`agentToolName`, action, auto-derived `severity` (DELETED/VOIDED→CRITICAL; REJECTED/DEACTIVATED/CANCELLED/EXPORTED/BACKUP→WARNING; else INFO), entity type/id/name, field-level `changes` (via `createFieldChanges`), best-effort IP + userAgent, metadata, success flag, and timestamp. Audit writes **never throw** — a failed log is swallowed so it can't block the underlying operation.

The full action taxonomy is `AuditAction` in `packages/types/src/audit.ts`. Categories logged include:

- **Auth:** `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `PASSWORD_CHANGED/RESET` (auth ones are emitted from `AuthContext.tsx`).
- **User/permission:** `USER_CREATED/UPDATED/DELETED/APPROVED/REJECTED/ACTIVATED/DEACTIVATED`, `PERMISSION_GRANTED/REVOKED`, `CLAIMS_UPDATED` (the last three emitted server-side by `onUserUpdate` / `functions/src/utils/audit.ts`).
- **Business modules:** full lifecycles for procurement (PR/RFQ/offer/PO/GR/packing/3-way-match), accounting (transactions incl. soft/hard delete + restore, invoices, bills, payments, journal entries, GL, fiscal periods, bank rec, reports), documents, materials/BOM, proposals/enquiries, projects/charters, tasks/time.
- **System/invitation/backup:** `CONFIG_CHANGED`, `BACKUP_CREATED`, `DATA_EXPORTED/IMPORTED`, `INVITATION_SENT/ACCEPTED/REJECTED`, `BATCH_SUBMITTED`.

**Where to view:** Admin → **Activity Feed** (`/admin/activity`, friendly), Admin → **Audit Logs** (`/admin/audit-logs`, raw/filterable), and — for agent work — the **Agent Run detail transcript** (`/admin/agent-runs/[id]`, filtered by `agentRunId`).

---

## 4. Automatic behaviours

- **Claims auto-sync:** `onUserUpdate` (`functions/src/userManagement.ts`) fires on every `users/{uid}` write — recomputes untrusted initial grants, sets/clears custom claims, revokes refresh tokens on deactivation/deletion (instant lockout), stamps `lastClaimUpdate`, and blocks removing the last admin. The client auto-refreshes its token when `lastClaimUpdate` changes.
- **Agent task expiry cron:** `functions/src/agentTaskExpiry.ts` (`expireStaleAgentTasks`) runs **every 10 minutes**. It scans PENDING `agentTasks`, and for any whose `expiresAt` has passed, batches a transition to `EXPIRED` (`decidedBy: 'system'`, reason "TTL elapsed…"), decrements the parent run's `hitlPendingCount`, and writes a `system`-actor audit row. It's deliberately separate from the orchestrator so timeouts stay deterministic even if the orchestrator is down. ⚠ Known gap noted in-code: no composite `(status, expiresAt)` index yet — it filters `expiresAt` client-side, fine only at Phase-0 volume.
- **Real-time UI:** users, feedback, activity feed, agent inbox, and agent-run views all use Firestore `onSnapshot`, so approvals/decisions/new items appear without refresh.
- **Admin dashboard live stats** (`/admin/page.tsx`): active-user count, open-feedback count, and pending-approvals count (POs `PENDING_APPROVAL` + PRs `SUBMITTED` + leave `PENDING_APPROVAL`) via live listeners / `getCountFromServer`.

### ⚠ Consolidated known gaps

- The whole `/admin/*` tree (agent-runs, audit-logs, feedback, settings, backup, email, HR-setup) is gated **only** on `MANAGE_USERS`; the dedicated `MANAGE_ADMIN` (`permissions2` bit 16) flag exists but the admin layout never checks it. Any `MANAGE_USERS` holder sees everything admin.
- `ApproveUserDialog` omits `updatedBy`, so user-approval audit rows are misattributed to `system`.
- Soft-delete is app-wide, but Trash restore UIs exist only for accounting & procurement; only accounting offers permanent purge.
- `functions/src/userManagement.ts` re-declares `PERMISSION_FLAGS` by hand (copy of `packages/constants`) with a "must be kept in sync / TODO auto-copy" warning — drift risk between client and Cloud Function.
