# Feature Recommendations for Vapour Toolbox

**Date:** December 18, 2025
**Purpose:** Roadmap for future development to improve workflows and productivity

---

## Executive Summary

This document outlines recommended features, integrations, and automations to enhance the Vapour Toolbox platform. Recommendations are organized by priority and effort level.

---

## 1. HIGH-PRIORITY AUTOMATIONS

### 1.1 Automatic Bill Creation from Goods Receipts

**Current State:** After GR approval, vendor bills are created manually.

**Recommendation:** Auto-generate draft bills when GR is approved with three-way match validation.

```
GR Approved → Auto-create Bill Draft → Three-Way Match Check → Ready for Approval
```

**Impact:** Reduces 5-10 minutes per bill, eliminates data entry errors.

**Implementation:**

- Add Cloud Function trigger on GR status change to APPROVED
- Create bill with line items from GR
- Link to PO for three-way match validation
- Set bill status to DRAFT for review

---

### 1.2 Smart Payment Reconciliation

**Current State:** Manual matching of bank transactions to invoices.

**Recommendation:** Enhance the existing auto-matching engine with:

- UTR/Reference number matching
- Partial payment detection and allocation
- Vendor pattern learning (e.g., "HDFC NEFT" → specific vendor)
- Bulk payment splitting across multiple invoices

**External Tool Option:** Consider **Plaid** or **Yodlee** for direct bank feeds instead of manual statement uploads.

---

### 1.3 Recurring Purchase Order Templates

**Current State:** Repeat purchases require manual PR creation each time.

**Recommendation:** Add a "Recurring PO" feature:

- Define frequency (monthly, quarterly)
- Auto-generate PRs based on schedule
- Pre-filled line items from templates
- Auto-approval for below-threshold amounts

**Implementation:**

- New collection: `recurringPurchases`
- Cloud Function scheduled trigger (daily check)
- Template system for line items

---

## 2. EXTERNAL INTEGRATIONS

### 2.1 WhatsApp Business API Integration

**Use Cases:**

- Vendor quote reminders ("RFQ due in 2 days")
- Approval notifications for managers on the go
- Delivery confirmations from vendors
- Payment receipt confirmations

**Tools:**
| Provider | Pricing | Notes |
|----------|---------|-------|
| Twilio WhatsApp | Pay per message (~₹0.50/msg) | Most reliable |
| Interakt | ₹999/month starter | Good for SMBs |
| WATI | ₹2,499/month | Feature-rich |

**Implementation:**

- Create notification service abstraction
- Add WhatsApp as notification channel
- User preference for notification channels

---

### 2.2 Email Parsing for Vendor Quotes

**Current State:** Quotes received via email are manually entered.

**Recommendation:** Auto-extract quote data from emails.

**Flow:**

```
Email received → Parse PDF attachment → Extract line items → Create Draft Offer → Notify user
```

**Tools:**
| Tool | Purpose | Pricing |
|------|---------|---------|
| Parseur | Email parsing | $30-100/month |
| Mailparser | Email parsing | $30-100/month |
| Google Document AI | PDF extraction | Pay per page |

**Implementation:**

- Set up dedicated email inbox (quotes@company.com)
- Configure email forwarding to parsing service
- Webhook to create Offer records

---

### 2.3 GST Portal Integration

**Current State:** GST reports are generated but manually uploaded to portal.

**Recommendation:** Direct API integration for filing.

**Tools:**
| Provider | Features | Pricing |
|----------|----------|---------|
| ClearTax API | GSTR filing, E-invoicing | Transaction-based |
| Zoho GST | Reconciliation, filing | Subscription |
| Masters India | E-invoicing, E-way bill | Transaction-based |

**Benefits:**

- Auto-file GSTR-1, GSTR-3B
- Auto-validate ITC claims
- Real-time GSTIN verification

---

### 2.4 E-Way Bill Generation

**If shipping goods:** Integrate with NIC E-Way Bill portal.

**Flow:**

```
Invoice Created (Value > ₹50,000) → Generate E-Way Bill → Print with Invoice
```

**Tools:** ClearTax, Masters India, or direct NIC API

---

### 2.5 Tally Integration

**If using Tally for statutory compliance:**

**Recommendation:** Export transactions in Tally XML format.

**Implementation:**

- Add "Export to Tally" button on transactions page
- Generate Tally-compatible XML
- Support for voucher types: Sales, Purchase, Payment, Receipt, Journal

**Effort:** 3-5 days

---

## 3. AI-POWERED FEATURES

### 3.1 Document AI for Purchase Requests

**Current State:** DocumentParseDialog exists but is basic.

**Recommendation:** Use advanced AI for document understanding.

**Capabilities:**

- Extract line items from vendor quotes/catalogs
- Auto-fill PR forms from uploaded documents
- Detect material specifications and match to catalog
- OCR for scanned documents

**Tools:**
| Tool | Accuracy | Pricing |
|------|----------|---------|
| Google Document AI | High | $1.50/1000 pages |
| Azure Form Recognizer | High | $1/1000 pages |
| AWS Textract | Medium-High | $1.50/1000 pages |

---

### 3.2 Intelligent Vendor Recommendation

**When creating RFQ:** Suggest vendors based on performance.

**Metrics to Calculate:**

- On-time delivery percentage
- Price competitiveness (avg quote vs. selected)
- Quality score (from GR inspections)
- Current workload (open POs)
- Payment terms offered

**Implementation:**

- Create `vendorMetrics` collection
- Cloud Function to update metrics on GR/PO completion
- Show recommendations in RFQ vendor selection

---

### 3.3 Budget Forecasting

**Current State:** Budget vs actual tracking exists.

**Recommendation:** Add predictive analytics.

**Features:**

- Forecast spend based on open PRs/POs
- Alert when projected spend exceeds budget
- Seasonal pattern detection
- Cash flow projection

**Tools:**

- Simple: Rolling averages in Cloud Functions
- Advanced: Google BigQuery ML for time-series forecasting

---

### 3.4 Anomaly Detection

**Use Cases:**

- Unusual transaction amounts
- Duplicate payments
- Price variance from historical data
- Suspicious activity patterns

**Implementation:**

- Calculate statistical bounds for transaction types
- Flag outliers for review
- Dashboard for anomaly review

---

## 4. WORKFLOW ENHANCEMENTS

### 4.1 Approval Delegation

**Current State:** Fixed approvers; if unavailable, workflow stalls.

**Recommendation:** Add delegation rules.

**Features:**

- "Out of Office" delegation
- Date-range based delegation
- Escalation after X days of no action
- Backup approver chains
- Notification to delegator

**Data Model:**

```typescript
interface ApprovalDelegation {
  delegatorId: string;
  delegateId: string;
  startDate: Timestamp;
  endDate: Timestamp;
  modules: string[]; // 'procurement', 'accounting', etc.
  active: boolean;
}
```

---

### 4.2 Bulk Operations

**Current State:** Individual approvals only.

**Recommendation:** Add bulk actions.

**Features:**

- Select multiple PRs/POs for bulk approval
- Bulk status update
- Bulk export to Excel
- Bulk print

**Implementation:**

- Add checkbox column to list views
- Floating action bar for selected items
- Batch API endpoints

---

### 4.3 Mobile Approval App (PWA)

**Current State:** Web-only approvals.

**Recommendation:** Progressive Web App for mobile.

**Features:**

- Push notifications for pending approvals
- Quick approve/reject with comments
- Photo attachment for GR inspections
- Offline capability for field use
- Biometric authentication

**Implementation:**

- Create `/mobile` route with simplified UI
- Service worker for offline support
- Push notification integration (Firebase Cloud Messaging)

---

### 4.4 Vendor Self-Service Portal

**Current State:** Vendors managed internally; no self-service.

**Recommendation:** Vendor-facing portal.

**Features:**

- Quote submission in response to RFQs
- PO acknowledgment
- Delivery schedule updates
- Invoice submission with document upload
- Payment status visibility
- Profile management

**Benefits:**

- Reduces phone calls and emails
- Eliminates manual data entry
- Faster quote turnaround

**Implementation:**

- Separate Next.js app or route group
- Vendor authentication (email/OTP)
- Limited Firestore access via security rules

---

## 5. COMPLIANCE & AUDIT

### 5.1 Automated TDS Compliance

**Current State:** TDS calculations may be manual.

**Recommendation:** Full TDS automation.

**Features:**

- Auto-detect TDS applicable transactions by vendor category
- Auto-calculate TDS at invoice/payment time
- Generate Form 26Q/27Q data
- Track TDS deposit deadlines
- Challan generation

**Implementation:**

- TDS configuration per vendor category
- Auto-apply TDS on bill creation
- TDS liability tracking

---

### 5.2 E-Invoicing (Mandatory for B2B > ₹5Cr)

**If applicable:** Integrate with IRP (Invoice Registration Portal).

**Flow:**

```
Invoice Created → Generate JSON → Submit to IRP → Get IRN → Store on Invoice
```

**Tools:** ClearTax, Zoho, or direct NIC API

---

### 5.3 Audit Trail Dashboard

**Current State:** Audit logs exist but no visualization.

**Recommendation:** Visual audit interface.

**Features:**

- Timeline view of document changes
- User activity patterns
- Suspicious activity alerts (bulk deletes, unusual hours)
- Export for compliance audits
- Search and filter capabilities

---

## 6. PRODUCTIVITY TOOLS

### 6.1 Slack/Teams Integration

**For notifications and actions:**

**Features:**

- Channel alerts for high-value approvals
- Direct messages for assigned tasks
- Slash commands: `/approve PO-2024-001`
- Interactive buttons for quick actions

**Implementation:**

- Slack App with OAuth
- Webhook for notifications
- Slash command handlers

---

### 6.2 Calendar Integration (Google/Outlook)

**Use Cases:**

- Payment due date reminders
- Delivery schedule on calendar
- Project milestone deadlines
- Leave calendar sync
- Meeting scheduling for vendor visits

**Implementation:**

- Google Calendar API / Microsoft Graph API
- Sync selected events
- Two-way sync for updates

---

### 6.3 Advanced Search (Algolia/Elasticsearch)

**Current State:** Basic Firestore queries.

**Recommendation:** Full-text search infrastructure.

**Features:**

- Search across all documents by content
- Vendor communications
- Material descriptions
- Historical transactions
- Fuzzy matching
- Faceted filters

**Tools:**
| Tool | Pricing | Notes |
|------|---------|-------|
| Algolia | Free tier (10k records) | Easiest setup |
| Elasticsearch | Self-hosted or Elastic Cloud | More control |
| Meilisearch | Self-hosted, free | Good alternative |

---

## 7. ANALYTICS & REPORTING

### 7.1 Executive Dashboard

**Add real-time KPIs:**

| KPI                    | Description                           |
| ---------------------- | ------------------------------------- |
| Cash Flow Forecast     | 30/60/90 day projection               |
| AR Aging               | Outstanding receivables by age bucket |
| AP Aging               | Outstanding payables by age bucket    |
| Project Profitability  | Revenue vs cost by project            |
| Vendor Scorecard       | Performance metrics by vendor         |
| Procurement Cycle Time | Days from PR to delivery              |
| Budget Utilization     | By cost centre                        |

**Tool Option:** Embed **Metabase** or **Apache Superset** for self-service analytics.

---

### 7.2 Custom Report Builder

**Current State:** Fixed reports only.

**Recommendation:** User-configurable reports.

**Features:**

- Drag-and-drop field selection
- Filter builder
- Grouping and aggregation
- Save and share reports
- Schedule email delivery

---

## 8. QUICK WINS (Low Effort, High Impact)

| Feature                                   | Effort | Impact | Priority |
| ----------------------------------------- | ------ | ------ | -------- |
| Email notifications for payment due dates | 1 day  | High   | P1       |
| Bulk PR/PO approval                       | 2 days | High   | P1       |
| Duplicate vendor/material detection       | 2 days | Medium | P2       |
| Auto-archive completed projects           | 1 day  | Medium | P3       |
| Export to Tally XML format                | 3 days | High   | P2       |
| Material reorder alerts (low stock)       | 2 days | Medium | P2       |
| Print-friendly views                      | 2 days | Medium | P3       |
| Keyboard shortcuts for power users        | 1 day  | Low    | P4       |

---

## 9. IMPLEMENTATION ROADMAP

### Phase 1: Quick Wins (1-2 weeks)

| Task                                      | Effort | Owner |
| ----------------------------------------- | ------ | ----- |
| Email notifications for payment due dates | 1 day  | -     |
| Bulk approval functionality               | 2 days | -     |
| Approval delegation/escalation            | 3 days | -     |
| Duplicate detection warnings              | 2 days | -     |

### Phase 2: Core Automations (2-4 weeks)

| Task                                 | Effort | Owner |
| ------------------------------------ | ------ | ----- |
| Auto-bill creation from approved GRs | 5 days | -     |
| WhatsApp notifications for approvals | 3 days | -     |
| Vendor performance metrics dashboard | 4 days | -     |
| TDS automation                       | 4 days | -     |

### Phase 3: Integrations (1-2 months)

| Task                            | Effort  | Owner |
| ------------------------------- | ------- | ----- |
| Vendor self-service portal      | 15 days | -     |
| Email parsing for vendor quotes | 5 days  | -     |
| GST portal integration          | 5 days  | -     |
| Tally export                    | 3 days  | -     |

### Phase 4: Advanced Features (2-3 months)

| Task                        | Effort  | Owner |
| --------------------------- | ------- | ----- |
| Document AI for PR creation | 10 days | -     |
| Advanced search (Algolia)   | 5 days  | -     |
| Mobile approval app (PWA)   | 10 days | -     |
| Custom report builder       | 15 days | -     |

---

## 10. EXTERNAL TOOLS REFERENCE

| Tool                   | Purpose                       | Pricing             | Website          |
| ---------------------- | ----------------------------- | ------------------- | ---------------- |
| **Twilio WhatsApp**    | Vendor/approval notifications | Pay per message     | twilio.com       |
| **Parseur**            | Email quote extraction        | $30-100/month       | parseur.com      |
| **Mailparser**         | Email parsing                 | $30-100/month       | mailparser.io    |
| **ClearTax API**       | GST filing, E-invoicing       | Transaction-based   | cleartax.in      |
| **Google Document AI** | Document parsing              | $1.50/1000 pages    | cloud.google.com |
| **Algolia**            | Full-text search              | Free tier available | algolia.com      |
| **Plaid**              | Bank feed integration         | Pay per connection  | plaid.com        |
| **Yodlee**             | Bank aggregation              | Enterprise pricing  | yodlee.com       |
| **Metabase**           | Self-service analytics        | Free (self-hosted)  | metabase.com     |
| **Meilisearch**        | Search engine                 | Free (self-hosted)  | meilisearch.com  |

---

## 11. ARCHITECTURE CONSIDERATIONS

### For New Features

When implementing new features, leverage the existing architecture:

1. **State Machines** - Use `lib/workflow/stateMachines.ts` pattern for new workflows
2. **Authorization** - Use `lib/auth/authorizationService.ts` for permission checks
3. **Transactions** - Use `lib/utils/transactionHelpers.ts` for atomic operations
4. **Idempotency** - Use `lib/utils/idempotencyService.ts` for duplicate prevention
5. **Audit Logging** - Use `lib/accounting/auditLogger.ts` for compliance
6. **Error Handling** - Use `lib/utils/errorHandling.ts` for consistent patterns

### For Integrations

- Create abstraction layers for external services
- Use environment variables for API keys
- Implement retry logic with exponential backoff
- Log all external API calls for debugging
- Consider rate limiting and quotas

---

## 12. SUCCESS METRICS

Track these metrics to measure feature impact:

| Metric                      | Current     | Target      | Measurement         |
| --------------------------- | ----------- | ----------- | ------------------- |
| Time to create bill         | ~10 min     | < 1 min     | Audit logs          |
| Payment reconciliation time | ~30 min/day | < 5 min/day | User survey         |
| Approval turnaround         | ~24 hours   | < 4 hours   | Workflow timestamps |
| Data entry errors           | Unknown     | -50%        | Audit corrections   |
| Vendor response time        | ~3 days     | < 1 day     | RFQ to quote time   |

---

_Document created December 18, 2025_
_For future development planning_
