# Phase 4: HR Module Audit

**Status**: PENDING
**Priority**: Medium (employee data, leave management)

## Scope

### Service Files (`apps/web/src/lib/hr/`)

- [ ] Leave service (applications, balances, approvals)
- [ ] Travel expense service
- [ ] Employee service
- [ ] On-duty service
- [ ] Holiday service

### Pages (`apps/web/src/app/hr/`)

- [ ] Leaves (list, apply, approve)
- [ ] On-duty applications
- [ ] Travel expenses (list, create, approve)
- [ ] Calendar (team calendar, holidays)
- [ ] Holidays management
- [ ] Employee directory

### Types

- [ ] Leave types (casual, sick, earned, etc.)
- [ ] Travel expense types
- [ ] Employee types

## Audit Checklist

### Security

- [ ] Leave balances visible only to employee + HR + manager
- [ ] Travel expense amounts can't be modified after approval
- [ ] Employee personal data (contact, address) protected
- [ ] Manager can only see their direct reports' leaves
- [ ] HR admin can see all, regular users see only their own
- [ ] Salary/compensation data not exposed (if present)
- [ ] All queries filter by entityId

### Data Integrity

- [ ] Leave balance calculations are correct
  - [ ] Carry-forward logic works at fiscal year boundary
  - [ ] Half-day leaves deduct 0.5 correctly
  - [ ] Concurrent leave approvals don't over-deduct balance
- [ ] Travel expense totals match line items
- [ ] Holiday list doesn't have duplicates
- [ ] Leave overlap detection works (can't apply for same dates twice)
- [ ] On-duty applications don't conflict with approved leaves
- [ ] Composite indexes for date-range queries

### UX/Workflow

- [ ] Leave application flow is clear (apply -> approve/reject)
- [ ] Calendar shows approved leaves, holidays, on-duty
- [ ] Travel expense receipt upload works
- [ ] Rejection shows reason
- [ ] Manager approval queue is filtered correctly
- [ ] Employee directory search works
- [ ] Date picker enforces valid ranges (no past-date for new applications unless backdated)
- [ ] Loading/empty states on all pages

### Code Quality

- [ ] Leave balance calculation is centralized (not duplicated)
- [ ] Date range utilities are reused
- [ ] Consistent approval workflow pattern (shared with procurement?)
- [ ] Type safety on leave types and statuses

## Findings

_To be filled during audit execution._
