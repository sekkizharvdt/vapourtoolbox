Start with phas# Phase 7: Auth/Permissions + Admin Audit

**Status**: PENDING
**Priority**: High (cross-cutting security, access control)

## Scope

### Auth

#### Service Files (`apps/web/src/lib/auth/`)

- [ ] Auth context (`contexts/AuthContext.tsx`)
- [ ] Auth service

#### Pages

- [ ] Login page
- [ ] Signup page
- [ ] Unauthorized page
- [ ] Pending approval page

### Permissions

#### Constants (`packages/constants/`)

- [ ] `PERMISSION_FLAGS` — bitwise permission definitions
- [ ] `PERMISSION_FLAGS2` — extended permissions
- [ ] `canViewX()` helper functions
- [ ] Module access control (`MODULES` definition)

### Admin

#### Service Files (`apps/web/src/lib/admin/`)

- [ ] User management service
- [ ] Activity log service

#### Pages (`apps/web/src/app/admin/`)

- [ ] User management
- [ ] Company settings
- [ ] Feedback review
- [ ] Activity logs
- [ ] Audit trails
- [ ] Notification settings
- [ ] Task analytics
- [ ] HR setup

### Super Admin

#### Pages (`apps/web/src/app/super-admin/`)

- [ ] Module integration dashboard
- [ ] System status

## Audit Checklist

### Security

- [ ] Authentication flow is secure (token handling, session management)
- [ ] Password requirements enforced
- [ ] OAuth integration secure (if applicable)
- [ ] Custom claims are validated server-side (not just client)
- [ ] Permission flags can't be self-escalated
- [ ] Admin operations require MANAGE_ADMIN permission
- [ ] Super admin operations are properly gated
- [ ] User deactivation revokes access immediately
- [ ] API routes validate authentication tokens
- [ ] No sensitive data in client-side logs

### Data Integrity

- [ ] Permission changes propagate to Firebase custom claims
- [ ] User roles are consistent with permission flags
- [ ] Activity logs are append-only (can't be modified/deleted)
- [ ] Audit trail captures all critical operations
- [ ] User deactivation doesn't orphan assigned tasks/approvals
- [ ] Company settings changes are audited

### UX/Workflow

- [ ] Login error messages don't leak information
- [ ] Unauthorized page suggests next action
- [ ] Pending approval page shows admin contact
- [ ] Permission changes take effect without re-login (or notify to re-login)
- [ ] User management has bulk operations (if needed)
- [ ] Activity log is searchable/filterable
- [ ] Dashboard stats are accurate

### Code Quality

- [ ] `hasPermission()` is used consistently (not ad-hoc checks)
- [ ] `canViewX()` functions cover all modules
- [ ] ModuleLayout permission check pattern is consistent
- [ ] Auth context doesn't re-render unnecessarily
- [ ] Permission flag naming is clear and documented
- [ ] No magic numbers for permissions

## Critical Notes

- This is the **foundation layer** — bugs here affect every module
- Permission escalation is the highest-risk category
- Custom claims sync between client and Firebase needs special attention
- Test with multiple permission combinations (admin, manager, regular user, dual-role)

## Findings

_To be filled during audit execution._
