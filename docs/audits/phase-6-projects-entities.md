# Phase 6: Projects + Entities + SSOT Audit

**Status**: PENDING
**Priority**: Medium (master data — referenced by all other modules)

## Scope

### Projects

#### Service Files (`apps/web/src/lib/projects/`)

- [ ] Project service (CRUD, status management)

#### Pages (`apps/web/src/app/projects/`)

- [ ] Project list (with status filters)
- [ ] Project files

### Entities (Vendors/Customers)

#### Pages (`apps/web/src/app/entities/`)

- [ ] Entity list (full-page table)
- [ ] Create/Edit/View/Archive dialogs

### SSOT (Single Source of Truth)

#### Pages (`apps/web/src/app/ssot/`)

- [ ] Tabbed interface (Streams, Equipment, Lines, Instruments, Valves, Pipe Table)

### Company Documents

#### Service Files (`apps/web/src/lib/companyDocuments/`)

- [ ] Document service

#### Pages (`apps/web/src/app/documents/`)

- [ ] Document list
- [ ] Document detail

## Audit Checklist

### Security

- [ ] Projects only visible to entity members
- [ ] Entity (vendor/customer) data scoped by entityId
- [ ] Archived entities can't be used in new transactions
- [ ] SSOT data scoped to project + entity
- [ ] Company documents respect role-based access
- [ ] File uploads validated and scoped

### Data Integrity

- [ ] Project status changes don't orphan related records (POs, GRs, tasks)
- [ ] Entity archive doesn't break existing transactions referencing the entity
- [ ] Entity roles (Vendor, Customer, Partner) are consistent
- [ ] SSOT data validates against engineering constraints
- [ ] Document versioning maintains history
- [ ] No duplicate entity entries (same company registered twice)
- [ ] Project IDs referenced in other modules are valid

### UX/Workflow

- [ ] Project status filters work (Active, Planning, On Hold, Completed)
- [ ] Entity search/filter by name, type, status
- [ ] Archive/unarchive flow has confirmation
- [ ] SSOT tab navigation preserves state
- [ ] Document upload shows progress
- [ ] Document categories filter correctly
- [ ] Empty states on all lists

### Code Quality

- [ ] Consistent entity reference pattern across modules
- [ ] Project name denormalization is consistent (projectName stored on related records)
- [ ] Entity type (Vendor/Customer/etc.) handling is clean
- [ ] SSOT tab components follow consistent pattern

## Critical Notes

- Projects and Entities are **master data** — bugs here cascade to all modules
- Entity deletion/archive must be carefully validated against referential integrity
- Project status changes may need to trigger notifications

## Findings

_To be filled during audit execution._
