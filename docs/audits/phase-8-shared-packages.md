# Phase 8: Shared Packages + API Routes Audit

**Status**: PENDING
**Priority**: Medium (foundation layer, but less risk than auth)

## Scope

### Shared Packages (`packages/`)

#### @vapour/types

- [ ] All exported interfaces and types
- [ ] Consistency between types and Firestore documents
- [ ] Optional vs required field correctness

#### @vapour/firebase

- [ ] `COLLECTIONS` constants — naming, completeness
- [ ] Firebase initialization
- [ ] Firestore helpers (docToTyped, etc.)

#### @vapour/constants

- [ ] Permission flags completeness
- [ ] Module definitions
- [ ] Status enums
- [ ] Configuration constants

#### @vapour/functions (Cloud Functions)

- [ ] Server-side validation
- [ ] Security rules enforcement
- [ ] Batch processing
- [ ] Trigger functions (onCreate, onUpdate, onDelete)

#### @vapour/logger

- [ ] Log levels and context
- [ ] No PII in logs

#### @vapour/ui

- [ ] Reusable components (PageHeader, StatCard, etc.)
- [ ] Accessibility (a11y)

#### @vapour/utils

- [ ] Utility function correctness
- [ ] Edge case handling

#### @vapour/validation

- [ ] Validation schema completeness
- [ ] Client-server validation parity

### API Routes (`apps/web/src/app/api/`)

- [ ] All API route handlers
- [ ] Authentication on each route
- [ ] Input validation
- [ ] Error handling
- [ ] CORS configuration

## Audit Checklist

### Security

- [ ] API routes validate Firebase auth tokens
- [ ] API routes don't expose internal errors to clients
- [ ] Cloud Functions enforce Firestore security rules
- [ ] No secrets in client-accessible packages
- [ ] Logger doesn't log sensitive data (passwords, tokens, PII)
- [ ] CORS is properly configured (no wildcard in production)
- [ ] File upload APIs validate content type and size

### Data Integrity

- [ ] COLLECTIONS constants match actual Firestore collection names
- [ ] Type definitions match Firestore document structure
- [ ] Validation schemas match type definitions
- [ ] Cloud Function triggers handle edge cases (deleted documents, partial updates)
- [ ] Batch operations in Cloud Functions are idempotent
- [ ] Number generation (PO, GR, Invoice numbers) handles concurrency

### UX/Workflow

- [ ] UI components have proper loading states
- [ ] UI components handle error states
- [ ] Formatters handle edge cases (null dates, zero amounts, long strings)
- [ ] UI components are responsive

### Code Quality

- [ ] No circular dependencies between packages
- [ ] Package exports are clean (no internal implementation leaking)
- [ ] Consistent patterns across packages
- [ ] Type definitions don't use `any`
- [ ] Utility functions have clear names
- [ ] Validation schemas are reusable
- [ ] Cloud Functions follow consistent patterns

## Critical Notes

- Changes to shared packages affect ALL modules
- Type changes require checking all consumers
- COLLECTIONS renaming would require migration
- Cloud Functions need special attention for idempotency

## Findings

_To be filled during audit execution._
