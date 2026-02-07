# Phase 3: Proposals + Estimation/BOM Audit

**Status**: PENDING
**Priority**: Medium (revenue pipeline, cost estimation)

## Scope

### Proposals

#### Service Files (`apps/web/src/lib/proposals/`)

- [ ] Enquiry service
- [ ] Scope matrix service
- [ ] Pricing service
- [ ] Generation/PDF service
- [ ] Template service

#### Pages (`apps/web/src/app/proposals/`)

- [ ] Enquiries (list, create, detail)
- [ ] Scope Matrix
- [ ] Pricing configuration
- [ ] PDF Generation
- [ ] Templates

### Estimation/BOM

#### Service Files (`apps/web/src/lib/bom/`)

- [ ] `bomService.ts` — BOM CRUD and calculations

#### Pages (`apps/web/src/app/estimation/`)

- [ ] BOM list
- [ ] BOM create/edit

### Bought-Out Items

#### Service Files (`apps/web/src/lib/boughtOut/`)

- [ ] `boughtOutService.ts` — Equipment/component inventory

#### Pages (`apps/web/src/app/bought-out/`)

- [ ] Item list
- [ ] Item create/edit

## Audit Checklist

### Security

- [ ] All queries filter by entityId
- [ ] Proposal data not visible to unauthorized users
- [ ] Template sharing respects entity boundaries
- [ ] PDF generation doesn't include data from other entities
- [ ] Price data is only visible to users with appropriate permissions

### Data Integrity

- [ ] BOM cost calculations are accurate (subtotals, margins, contingencies)
- [ ] Proposal versioning tracks changes
- [ ] Enquiry-to-proposal linkage is maintained
- [ ] BOM categories have correct specifications per type
- [ ] Bought-out item pricing is up to date
- [ ] Composite indexes for BOM/proposal queries
- [ ] No orphaned BOM items when parent BOM deleted
- [ ] Scope matrix changes propagate to pricing

### UX/Workflow

- [ ] Enquiry -> Scope -> Pricing -> Generation flow is clear
- [ ] BOM creation wizard guides user through categories
- [ ] Pricing shows clear breakdown (material, labor, overhead, margin)
- [ ] PDF preview matches final output
- [ ] Form validation on all inputs
- [ ] Loading states on calculations
- [ ] Empty states on lists
- [ ] Dynamic specs per bought-out category work correctly

### Code Quality

- [ ] BOM calculation logic is unit-testable
- [ ] No hardcoded rates or margins
- [ ] Consistent currency handling
- [ ] Type safety in cost calculations (no floating point issues)
- [ ] Proposal template rendering is clean

## Findings

_To be filled during audit execution._
