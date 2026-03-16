# Security Review Findings - March 15, 2026

## Overview

A comprehensive security review of the Vapour Toolbox application covering authentication, authorization, data validation, infrastructure, and external integrations.

**Reviewed by**: Claude (AI-assisted review)
**Date**: March 15, 2026
**Scope**: Full application — Firestore rules, Cloud Functions, client services, storage, HTTP headers

---

## Current Security Posture

### Strengths

| Area                         | Detail                                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Defense-in-depth**         | Dual enforcement: Firestore security rules (1,826 lines) + service-layer `requirePermission()` checks                   |
| **Granular permissions**     | Bitwise system with 32+ flags across two permission words (`permissions`, `permissions2`), with role presets            |
| **Input sanitization**       | DOMPurify + Zod validation in shared `@vapour/validation` package with per-field sanitizers                             |
| **HTTP headers**             | HSTS (preload), CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, strict Permissions-Policy                    |
| **Secret management**        | Firebase Secrets for all API keys (Anthropic, Gmail, Document AI) — nothing hardcoded in source                         |
| **Audit logging**            | Financial operations, permission changes, and approval workflows tracked in `auditLogs` collection                      |
| **Self-approval prevention** | `preventSelfApproval()` enforced across all approval workflows                                                          |
| **Custom claims sync**       | Reactive `onSnapshot` listener forces token refresh when permissions change; inactive/deleted users have claims removed |
| **Codebase audit**           | 190-finding audit completed across 9 phases, all CRITICAL and HIGH findings resolved                                    |

---

## Findings

### HIGH Priority

#### 1. Storage Rules Too Permissive

**Risk**: A compromised low-privilege account could upload malicious files to shared paths.

**Detail**: Firebase Storage rules allow any authenticated user to write to most paths:

- `procurement/pr/{prId}/attachments` — all authenticated users (25MB limit)
- `rfq-offers/{rfqId}/` — all authenticated users (25MB limit)
- `rfq-pdfs/{rfqId}/` — all authenticated users (25MB limit)

Permission checks happen only at the service layer, which can be bypassed by direct Storage SDK calls.

**Recommendation**: Add permission-based write guards in `storage.rules` mirroring the Firestore permission model. At minimum, require `MANAGE_PROCUREMENT` for procurement paths and `MANAGE_ACCOUNTING` for accounting paths.

---

#### 2. Rate Limiting is In-Memory Only

**Risk**: Cloud Functions (especially `aiHelp()` and `parseOfferDocument()`) can be abused since rate limits reset on every cold start and don't share state across instances.

**Detail**: The `RateLimiter` class in `@vapour/firebase` uses a JS `Map` — unsuitable for serverless. Each Cloud Function instance has its own counter, and counters reset on cold start.

**Recommendation**: Replace with Firestore-backed rate limiting (write a counter doc per user per time window) or use Upstash Redis for serverless-compatible rate limiting.

---

### MEDIUM Priority

#### 3. CSP Allows `unsafe-inline` and `unsafe-eval`

**Risk**: Weakens XSS protection provided by Content-Security-Policy.

**Detail**: The `script-src` directive in `firebase.json` includes `'unsafe-inline'` and `'unsafe-eval'`. While DOMPurify sanitization mitigates most XSS vectors, these directives reduce the effectiveness of CSP as a defense layer.

**Recommendation**: Migrate to nonce-based inline scripts or hash-based CSP. This may require changes to how Next.js injects inline scripts during static export.

---

#### 4. Firebase App Check Not Enforced

**Risk**: API abuse from non-app clients (scripts, bots, scraped tokens).

**Detail**: App Check is referenced in CSP `frame-src` (for the reCAPTCHA provider) but does not appear to be enforced on Cloud Functions or Firestore. Without App Check, anyone with the public Firebase config can call Cloud Functions or query Firestore directly.

**Recommendation**: Enable App Check with reCAPTCHA Enterprise provider. Enforce on all Cloud Functions (`onCall` automatically supports it) and optionally on Firestore/Storage.

---

#### 5. Soft-Delete Filtering Gap Risk

**Risk**: Deleted transactions could corrupt account balances if Cloud Function triggers don't filter `isDeleted`.

**Detail**: The `onTransactionWrite` trigger recalculates account balances using `FieldValue.increment()`. If a soft-deleted transaction is not filtered before processing, it could be counted in balance calculations. The CLAUDE.md coding standards document this requirement, but there's no automated enforcement.

**Recommendation**: Create a shared guard utility (e.g., `isSoftDeleted(data)`) used by all Cloud Function triggers. Add a unit test that verifies triggers skip soft-deleted documents.

---

#### 6. Gmail App Password for Email

**Risk**: Fragile authentication tied to a personal Google account. App passwords can be revoked if Google detects unusual activity.

**Detail**: Email notifications use Nodemailer with `GMAIL_APP_PASSWORD` via SMTP. This is a single point of failure for all 17 notification triggers.

**Recommendation**: Migrate to a transactional email service (SendGrid, Resend, or Amazon SES) with proper domain authentication (SPF, DKIM, DMARC). This also improves deliverability and provides delivery analytics.

---

### LOW Priority

#### 7. No MFA or IP Restrictions

**Risk**: Credential compromise gives full access to financial data.

**Detail**: Firebase Auth uses email/password only. No multi-factor authentication is enforced, even for admin/finance roles with access to sensitive financial data.

**Recommendation**: Enable Firebase Auth MFA (TOTP or SMS) for users with `MANAGE_ACCOUNTING`, `MANAGE_USERS`, or super admin permissions. Consider IP allowlisting for production admin access.

---

#### 8. Console.log Statements in Production

**Risk**: Sensitive data could leak to browser console in production.

**Detail**: ~113 `console.log` statements exist in source files. While most are debug output, some may log user data, transaction details, or API responses visible in browser DevTools.

**Recommendation**: Audit and remove all `console.log` statements. Replace with `@vapour/logger` which respects environment (suppresses in production, reports to Sentry).

---

## Comparison with Similar Applications

| Category             | Competitor                   | Overlap                               | Vapour's Differentiator                                        |
| -------------------- | ---------------------------- | ------------------------------------- | -------------------------------------------------------------- |
| **India ERP**        | Tally Prime, Zoho Books      | Accounting, GST, payments             | Thermal engineering calculators + project-specific procurement |
| **Full ERP**         | ERPNext (open source)        | Procurement, accounting, HR, projects | Domain-specific MED/TVC design platform integrated into ERP    |
| **Project ERP**      | Oracle Primavera, MS Project | Project management, milestones        | Tight procurement + accounting integration per project         |
| **Engineering**      | SAP S/4HANA                  | Full ERP + engineering                | Purpose-built and lean vs enterprise-scale                     |
| **Document Control** | Aconex, Procore              | Transmittals, document management     | Bundled with accounting/procurement in one tool                |
| **Thermal Design**   | HTRI, Aspen EDR              | Heat exchanger / desalination design  | Simplified sizing calculators integrated into ERP workflow     |

**Niche advantage**: No off-the-shelf product combines Indian accounting (GST, INR), desalination engineering calculators, and project-based procurement in a single platform.

---

## Recommended External Service Integrations

### High Impact

| Service                 | Purpose                | Benefit                                                                          |
| ----------------------- | ---------------------- | -------------------------------------------------------------------------------- |
| **SendGrid / Resend**   | Replace Gmail SMTP     | Reliable transactional email with delivery tracking and domain auth              |
| **Upstash Redis**       | Rate limiting, caching | Serverless-compatible rate limiting for Cloud Functions                          |
| **Firebase App Check**  | API abuse prevention   | Prevents direct API calls from non-app clients                                   |
| **Algolia / Typesense** | Full-text search       | Search across transactions, entities, documents — beyond Firestore's query model |

### Medium Impact

| Service                    | Purpose            | Benefit                                                             |
| -------------------------- | ------------------ | ------------------------------------------------------------------- |
| **Google Cloud Scheduler** | Recurring tasks    | Auto-generate recurring invoices, payment reminders, overdue checks |
| **WhatsApp Business API**  | Notifications      | Indian business users prefer WhatsApp for approval notifications    |
| **Razorpay**               | Payment collection | Online payment links in customer invoices for faster collections    |
| **Google Sheets API**      | Bulk import/export | Two-way sync for users maintaining data in spreadsheets             |

### Lower Impact

| Service                 | Purpose                  | Benefit                                          |
| ----------------------- | ------------------------ | ------------------------------------------------ |
| **Tally XML Export**    | CA/auditor compatibility | Export data in Tally-compatible format           |
| **GST E-Invoice API**   | Tax compliance           | Auto-generate IRN and e-way bills                |
| **Slack / Google Chat** | Team notifications       | Push task assignments and approvals to team chat |

---

## Action Plan

| Priority | Finding                                          | Effort | Impact |
| -------- | ------------------------------------------------ | ------ | ------ |
| 1        | Enable Firebase App Check                        | Low    | High   |
| 2        | Move rate limiting to Firestore/Redis            | Medium | High   |
| 3        | Tighten Storage rules with permission checks     | Medium | High   |
| 4        | Create soft-delete guard utility + tests         | Low    | Medium |
| 5        | Migrate email from Gmail SMTP to SendGrid/Resend | Medium | Medium |
| 6        | Audit and remove console.log statements          | Low    | Low    |
| 7        | Investigate CSP nonce-based approach             | High   | Medium |
| 8        | Enable MFA for admin/finance roles               | Medium | Low    |
