# Proposal/Enquiry Module - Detailed Requirements

**Document Version**: 1.0
**Created**: November 14, 2025
**Status**: Draft - For Review
**Priority**: Critical (Entire pre-award phase)

---

## 1. Module Overview

### 1.1 Purpose

The Proposal/Enquiry Module enables the organization to:

- Receive and track client enquiries
- Define scope of work and scope of supply
- Estimate costs and generate pricing
- Create and submit formal offers to clients
- Track proposal status through to award/rejection
- Convert accepted proposals into projects with automatic data transfer

### 1.2 Business Value

- **Centralized enquiry management** - No lost enquiries or duplicates
- **Faster proposal generation** - Reuse templates and historical data
- **Accurate cost estimation** - Link to procurement and resource databases
- **Seamless project handoff** - Accepted proposals become projects automatically
- **Audit trail** - Complete history from enquiry to project award

### 1.3 User Permissions

The module will use the existing permission system. Users with appropriate permissions can:

- **CREATE_PROPOSAL**: Create and manage enquiries and proposals
- **EDIT_PROPOSAL**: Edit proposal details, scope, and pricing
- **APPROVE_PROPOSAL**: Review and approve proposals before submission
- **VIEW_ALL_PROPOSALS**: View all proposals (Super Admin)
- **GENERATE_REPORTS**: Access analytics and conversion reports

---

## 2. Data Model

### 2.1 Core Entities

#### 2.1.1 Enquiry

```typescript
interface Enquiry {
  // Identity
  id: string;
  enquiryNumber: string; // Auto-generated: ENQ-YYYY-NNNN

  // Client Information
  clientId: string; // Link to BusinessEntity
  clientName: string; // Denormalized
  clientContactPerson: string;
  clientEmail: string;
  clientPhone: string;
  clientReferenceNumber?: string;

  // Enquiry Details
  title: string;
  description: string;
  receivedDate: Timestamp;
  receivedVia: 'EMAIL' | 'PHONE' | 'MEETING' | 'WEBSITE' | 'REFERRAL' | 'OTHER';
  referenceSource?: string; // If received via referral/website

  // Requirements (High-level)
  projectType?: 'SUPPLY_ONLY' | 'SUPPLY_AND_INSTALL' | 'ENGINEERING_DESIGN' | 'TURNKEY' | 'OTHER';
  industry?: string; // e.g., "Manufacturing", "Oil & Gas", "Power"
  location?: string; // Project site location
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  estimatedBudget?: Money; // Client's budget if provided
  requiredDeliveryDate?: Timestamp;

  // Status & Workflow
  status:
    | 'NEW'
    | 'UNDER_REVIEW'
    | 'PROPOSAL_IN_PROGRESS'
    | 'PROPOSAL_SUBMITTED'
    | 'WON'
    | 'LOST'
    | 'CANCELLED';
  assignedToUserId?: string; // Sales/BD person assigned
  assignedToUserName?: string; // Denormalized

  // Documents
  attachedDocuments: string[]; // Document IDs (RFQ from client, specs, drawings)

  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;

  // Lifecycle tracking
  proposalCreatedAt?: Timestamp;
  proposalSubmittedAt?: Timestamp;
  outcomeDate?: Timestamp; // When WON/LOST/CANCELLED
  outcomeReason?: string; // Why lost/cancelled
}
```

#### 2.1.2 Proposal

```typescript
interface Proposal {
  // Identity
  id: string;
  proposalNumber: string; // Auto-generated: PROP-YYYY-NNNN
  revision: number; // Starts at 1, increments on revisions
  enquiryId: string; // Link to parent enquiry
  enquiryNumber: string; // Denormalized

  // Client Information (copied from enquiry)
  clientId: string;
  clientName: string;
  clientContactPerson: string;
  clientEmail: string;
  clientAddress: string;

  // Proposal Details
  title: string;
  validityDate: Timestamp; // Offer valid until
  preparationDate: Timestamp;

  // Scope of Work
  scopeOfWork: {
    summary: string; // High-level description
    objectives: string[]; // What the project aims to achieve
    deliverables: string[]; // What will be delivered
    inclusions: string[]; // What's included
    exclusions: string[]; // What's explicitly NOT included
    assumptions: string[]; // Assumptions made in the proposal
  };

  // Scope of Supply
  scopeOfSupply: ProposalLineItem[];

  // Delivery & Timeline
  deliveryPeriod: {
    durationInWeeks: number;
    description: string; // e.g., "12 weeks from purchase order"
    milestones: ProposalMilestone[];
  };

  // Pricing
  pricing: {
    currency: CurrencyCode;
    lineItems: PriceLineItem[];
    subtotal: Money;
    taxItems: TaxLineItem[]; // GST, etc.
    totalAmount: Money;
    paymentTerms: string;
    advancePaymentPercentage?: number;
  };

  // Terms & Conditions
  terms: {
    warranty?: string;
    guaranteeBank?: string;
    performanceBond?: string;
    liquidatedDamages?: string;
    forcemajeure?: string;
    disputeResolution?: string;
    customTerms?: string[];
  };

  // Status & Workflow
  status:
    | 'DRAFT'
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'SUBMITTED'
    | 'UNDER_NEGOTIATION'
    | 'ACCEPTED'
    | 'REJECTED'
    | 'EXPIRED';
  submittedAt?: Timestamp;
  submittedByUserId?: string;
  submittedByUserName?: string;

  approvalHistory: ApprovalRecord[];

  // Outcome
  acceptedAt?: Timestamp;
  rejectedAt?: Timestamp;
  rejectionReason?: string;
  negotiationNotes?: string;

  // Project Link (if accepted)
  projectId?: string; // Created when status = ACCEPTED
  projectNumber?: string;

  // Documents
  attachedDocuments: string[]; // Supporting docs, catalogs, drawings
  generatedPdfUrl?: string; // Generated proposal PDF

  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;

  // Revision tracking
  previousRevisionId?: string; // Link to previous revision
  revisionReason?: string;
  isLatestRevision: boolean;
}
```

#### 2.1.3 ProposalLineItem (Scope of Supply)

```typescript
interface ProposalLineItem {
  id: string;
  itemNumber: string; // e.g., "1.1", "2.3"

  // Item Details
  category:
    | 'EQUIPMENT'
    | 'MATERIAL'
    | 'SERVICE'
    | 'DESIGN'
    | 'INSTALLATION'
    | 'COMMISSIONING'
    | 'TRAINING'
    | 'OTHER';
  itemName: string;
  description: string;
  technicalSpecification?: string;

  // Quantity
  quantity: number;
  unit: string; // e.g., "nos", "kg", "m", "lot"

  // Pricing (if broken down)
  unitPrice?: Money;
  totalPrice: Money;

  // Delivery
  deliveryWeeks?: number; // Delivery time for this item
  requiredByDate?: Timestamp;

  // Source
  sourceType?: 'MANUFACTURED' | 'PROCURED' | 'SUBCONTRACTED';
  estimatedProcurementCost?: Money; // Internal cost
  margin?: number; // Profit margin %

  // Links
  vendorId?: string; // If sourced from specific vendor
  catalogReference?: string;

  // Notes
  notes?: string;
}
```

#### 2.1.4 ProposalMilestone

```typescript
interface ProposalMilestone {
  id: string;
  milestoneNumber: number; // 1, 2, 3...
  description: string;
  deliverable: string; // What gets delivered
  durationInWeeks: number; // From project start or previous milestone
  paymentPercentage?: number; // % of total payment tied to this milestone
}
```

#### 2.1.5 PriceLineItem

```typescript
interface PriceLineItem {
  id: string;
  lineNumber: string;
  description: string;
  amount: Money;
  category: 'EQUIPMENT' | 'MATERIAL' | 'LABOR' | 'SERVICES' | 'OVERHEAD' | 'CONTINGENCY' | 'OTHER';
  linkedScopeItemId?: string; // Link to ProposalLineItem if applicable
}
```

#### 2.1.6 ApprovalRecord

```typescript
interface ApprovalRecord {
  approverUserId: string;
  approverUserName: string;
  action: 'APPROVED' | 'REJECTED' | 'REQUESTED_CHANGES';
  comments?: string;
  timestamp: Timestamp;
}
```

---

## 3. Functional Requirements

### 3.1 Enquiry Management

#### 3.1.1 Create Enquiry

**Actor**: User with CREATE_PROPOSAL permission
**Trigger**: Client contact received
**Flow**:

1. Navigate to Enquiries → New Enquiry
2. Fill in client information (select existing client or create new)
3. Enter enquiry details (title, description, received date, urgency)
4. Upload client documents (RFQ, specifications, drawings)
5. Assign to sales person
6. Save as NEW status

**Validations**:

- Client information required
- Received date cannot be future
- If client doesn't exist, create BusinessEntity first

**Outputs**:

- Enquiry created with auto-generated ENQ-YYYY-NNNN number
- Notification sent to assigned user
- Task created: "Review Enquiry ENQ-XXXX"

#### 3.1.2 Enquiry List & Filtering

**Actor**: Users with CREATE_PROPOSAL or VIEW_ALL_PROPOSALS permission
**Features**:

- List view with columns: Enquiry #, Client, Title, Received Date, Status, Assigned To, Urgency
- Filters:
  - Status (multi-select)
  - Assigned to (user dropdown)
  - Date range (received date)
  - Urgency level
  - Client name (search)
- Sorting by any column
- Pagination (50/100/200 per page)
- Export to Excel

#### 3.1.3 Update Enquiry Status

**Actor**: User with EDIT_PROPOSAL permission
**Transitions**:

- NEW → UNDER_REVIEW (when user reviews enquiry)
- UNDER_REVIEW → PROPOSAL_IN_PROGRESS (when proposal creation starts)
- PROPOSAL_IN_PROGRESS → PROPOSAL_SUBMITTED (when proposal sent to client)
- PROPOSAL_SUBMITTED → WON (when client accepts)
- PROPOSAL_SUBMITTED → LOST (when client rejects)
- Any status → CANCELLED (if enquiry becomes invalid)

**Business Rules**:

- Status changes logged in audit trail
- Outcome date and reason required for WON/LOST/CANCELLED

---

### 3.2 Proposal Creation

#### 3.2.1 Create Proposal from Enquiry

**Actor**: User with CREATE_PROPOSAL permission
**Trigger**: Enquiry status = UNDER_REVIEW
**Flow**:

1. Open enquiry detail view
2. Click "Create Proposal"
3. System pre-fills:
   - Client information from enquiry
   - Title from enquiry
   - Validity date (default: 30 days from today)
4. User fills in:
   - Scope of Work (summary, deliverables, inclusions, exclusions, assumptions)
   - Scope of Supply (add line items)
   - Delivery period and milestones
   - Pricing (line items, taxes, payment terms)
   - Terms & Conditions
5. Save as DRAFT

**Features**:

- Template library for common proposal types
- Copy from previous proposals
- Import scope of supply from Excel
- Inline cost estimation calculator
- Auto-calculate totals, taxes

**Outputs**:

- Proposal created with PROP-YYYY-NNNN number
- Enquiry status updated to PROPOSAL_IN_PROGRESS
- Proposal saved as DRAFT

#### 3.2.2 Scope of Supply Builder

**Actor**: User with EDIT_PROPOSAL permission
**Features**:

- Add/Edit/Delete line items
- Item categories dropdown
- Quantity calculator (supports formulas)
- Unit selection from predefined list
- Technical specification text editor (rich text)
- Cost estimation integration:
  - Search historical procurement costs
  - Link to vendor catalogs
  - Calculate margin (cost + % markup)
- Bulk import from Excel/CSV
- Reorder items (drag-and-drop)
- Group items by category
- Item numbering auto-generated (1.1, 1.2, 2.1, etc.)

**Validations**:

- Quantity > 0
- Unit price ≥ 0
- Total price matches quantity × unit price

#### 3.2.3 Delivery Period & Milestones

**Actor**: User with EDIT_PROPOSAL permission
**Features**:

- Define overall delivery duration (weeks)
- Add milestones with:
  - Description
  - Deliverable
  - Duration (from start or previous milestone)
  - Payment % (if milestone-based payments)
- Visual timeline preview
- Auto-calculate milestone dates based on project start assumption

**Validations**:

- Total payment % ≤ 100%
- Milestone durations sum to overall delivery period

#### 3.2.4 Pricing Builder

**Actor**: User with EDIT_PROPOSAL permission
**Features**:

- Add pricing line items (equipment, material, labor, services, overhead, contingency)
- Link pricing lines to scope items (optional)
- Auto-calculate subtotal
- Tax configuration (GST %, TDS if applicable)
- Auto-calculate total
- Payment terms editor (text)
- Advance payment % (pre-fills payment schedule)
- Currency selection (defaults to INR)
- Multi-currency support (conversion rates)

**Validations**:

- All amounts ≥ 0
- Tax % between 0-100
- Advance % between 0-100

---

### 3.3 Proposal Approval Workflow

#### 3.3.1 Submit for Approval

**Actor**: User with CREATE_PROPOSAL permission
**Trigger**: Proposal status = DRAFT
**Flow**:

1. Click "Submit for Approval"
2. System validates:
   - Scope of work filled
   - At least one scope of supply item
   - Delivery period defined
   - Pricing completed (total > 0)
   - Terms & conditions reviewed (checkbox)
3. Select approver(s) from dropdown
4. Add approval request message
5. Submit

**Outputs**:

- Proposal status → PENDING_APPROVAL
- Notification sent to approver(s)
- Task created for approver: "Approve Proposal PROP-XXXX"
- Email sent to approver with proposal summary

#### 3.3.2 Approve/Reject Proposal

**Actor**: User with APPROVE_PROPOSAL permission
**Flow**:

1. Open proposal from task or notification
2. Review all sections
3. Choose action:
   - **Approve**: Proposal status → APPROVED
   - **Request Changes**: Proposal status → DRAFT, comment added
   - **Reject**: Proposal status → DRAFT, rejection reason required
4. Add comments
5. Submit decision

**Business Rules**:

- Multi-level approval supported (sequential)
- All approvers must approve before status = APPROVED
- Approval history logged with timestamp and comments

**Outputs**:

- Approval record created
- Notification sent to proposal creator
- If approved: Proposal ready for submission to client
- If changes requested: Task created for proposal creator

---

### 3.4 Proposal Submission to Client

#### 3.4.1 Generate Proposal PDF

**Actor**: User with CREATE_PROPOSAL permission
**Trigger**: Proposal status = APPROVED
**Flow**:

1. Click "Generate PDF"
2. System creates formatted PDF with:
   - Company letterhead
   - Proposal number, date, revision
   - Client details
   - Scope of work (formatted)
   - Scope of supply (table)
   - Delivery timeline (table or Gantt chart)
   - Pricing breakdown (table)
   - Terms & conditions
   - Signature block
3. PDF stored in Document Management
4. Download link provided

**Features**:

- PDF template customizable (company branding)
- Include/exclude sections (checkboxes)
- Watermark for draft versions
- Multi-language support (future)

#### 3.4.2 Submit Proposal to Client

**Actor**: User with CREATE_PROPOSAL permission
**Trigger**: PDF generated
**Flow**:

1. Click "Submit to Client"
2. Confirm:
   - Client email address
   - CC recipients
   - Email subject and body (editable template)
   - Attach PDF
3. Send email

**Outputs**:

- Proposal status → SUBMITTED
- Submitted timestamp and user recorded
- Email sent to client with PDF attachment
- Document transmittal record created
- Enquiry status → PROPOSAL_SUBMITTED

**Optional**:

- Client portal upload (if implemented)
- Hard copy dispatch tracking

---

### 3.5 Proposal Tracking & Follow-up

#### 3.5.1 Update Proposal Status

**Actor**: User with EDIT_PROPOSAL permission
**Transitions**:

- SUBMITTED → UNDER_NEGOTIATION (client requests changes)
- UNDER_NEGOTIATION → SUBMITTED (revised proposal sent)
- SUBMITTED → ACCEPTED (client awards project)
- SUBMITTED → REJECTED (client declines)
- SUBMITTED → EXPIRED (validity date passed)

**Business Rules**:

- ACCEPTED requires client PO/LOI upload
- REJECTED requires reason (dropdown + text)
- UNDER_NEGOTIATION allows proposal revision

#### 3.5.2 Proposal Revision

**Actor**: User with EDIT_PROPOSAL permission
**Trigger**: Status = UNDER_NEGOTIATION
**Flow**:

1. Click "Create Revision"
2. System creates new proposal:
   - Same proposal number
   - Revision incremented (Rev 1 → Rev 2)
   - All data copied from previous revision
   - Status = DRAFT
   - Links to previous revision (previousRevisionId)
3. User edits as needed
4. Re-submit for approval and send to client

**Features**:

- Revision comparison view (show what changed)
- Revision history table
- Only latest revision is active (isLatestRevision = true)

#### 3.5.3 Proposal Dashboard & Analytics

**Actor**: Users with VIEW_ALL_PROPOSALS or GENERATE_REPORTS permission
**Metrics**:

- Total enquiries (count by status)
- Conversion rate (proposals submitted → accepted)
- Average proposal value
- Win/loss ratio
- Average time from enquiry to proposal
- Average time from proposal to decision
- Top clients by proposal value
- Top users by conversion rate

**Charts**:

- Enquiries by month (bar chart)
- Proposal status distribution (pie chart)
- Win/loss trend (line chart)
- Proposal value by industry (bar chart)

**Filters**:

- Date range
- Assigned user
- Client
- Industry
- Status

---

### 3.6 Proposal to Project Conversion

#### 3.6.1 Create Project from Accepted Proposal

**Actor**: User with CREATE_PROJECT permission
**Trigger**: Proposal status = ACCEPTED
**Flow**:

1. Click "Create Project" from accepted proposal
2. System shows confirmation dialog with mapping preview:
   - Project name ← Proposal title
   - Client ← Proposal client
   - Budget ← Proposal pricing
   - Procurement items ← Scope of supply items
   - Milestones ← Proposal milestones
3. User confirms or adjusts:
   - Project code (auto-generated or manual)
   - Project manager assignment
   - Start date (default: today)
4. Click "Create Project"

**Automated Data Transfer**:

| Proposal Field                 | →   | Project Field              |
| ------------------------------ | --- | -------------------------- |
| proposalId                     | →   | sourceProposalId           |
| proposalNumber                 | →   | sourceProposalNumber       |
| title                          | →   | name                       |
| clientId                       | →   | clientId                   |
| scopeOfWork.summary            | →   | description                |
| scopeOfWork.deliverables       | →   | charter.deliverables       |
| scopeOfWork.objectives         | →   | charter.objectives         |
| scopeOfSupply items            | →   | charter.procurementItems   |
| deliveryPeriod.durationInWeeks | →   | estimatedDuration          |
| deliveryPeriod.milestones      | →   | milestones                 |
| pricing.lineItems              | →   | charter.budgetLineItems    |
| pricing.totalAmount            | →   | estimatedBudget            |
| pricing.currency               | →   | currency                   |
| terms                          | →   | charter.termsAndConditions |
| clientContactPerson            | →   | charter.projectSponsor     |

**Business Rules**:

- One proposal can create only one project
- Project creation marks proposal as "converted" (projectId set)
- Budget line items created in APPROVED status (charter pre-approved)
- Procurement items created with status PLANNING
- Cost centre auto-created with code CC-{PROJECT_CODE}

**Outputs**:

- Project created with status INITIATION
- Charter created with status DRAFT (pre-filled)
- Budget line items created
- Procurement items created
- Proposal updated with projectId
- Enquiry status → WON
- Notification sent to project manager
- Task created: "Review and finalize project charter"

---

## 4. Non-Functional Requirements

### 4.1 Performance

- Enquiry list loading: < 2 seconds for 1000 records
- Proposal PDF generation: < 5 seconds
- Search/filter response: < 1 second

### 4.2 Security

- Role-based access:
  - Sales/BD: Create/edit enquiries and proposals
  - Estimator: View/edit pricing and scope
  - Approver: View/approve proposals
  - Super Admin: Full access
- Proposal PDF watermarked if status != SUBMITTED
- Audit trail for all status changes

### 4.3 Usability

- Mobile-responsive UI (enquiry tracking on mobile)
- Auto-save drafts every 60 seconds
- Inline validation with helpful error messages
- Keyboard shortcuts for common actions
- Breadcrumb navigation

### 4.4 Integration

- Link to BusinessEntity (clients)
- Link to Projects (conversion)
- Link to Document Management (attachments)
- Link to Tasks (approvals, follow-ups)
- Export to Excel/PDF

### 4.5 Data Retention

- Proposals retained for 7 years (compliance)
- Enquiries archived after 2 years if not converted
- Soft delete (status = ARCHIVED) with restore option

---

## 5. UI/UX Requirements

### 5.1 Navigation Structure

```
/proposals
  /enquiries
    /new
    /[enquiryId]
  /proposals
    /new
    /[proposalId]
      /edit
      /revisions
  /dashboard
  /templates
```

### 5.2 Key Screens

#### 5.2.1 Enquiry List Page

- Header: "Enquiries" + New Enquiry button
- Filters: Status, Assigned To, Date Range, Urgency
- Table: ENQ #, Client, Title, Received, Status, Assigned, Urgency, Actions
- Actions: View, Create Proposal, Edit, Archive

#### 5.2.2 Enquiry Detail Page

- Tabs: Details, Documents, Proposals, Activity Log
- Details: Client info, enquiry info, requirements
- Actions: Edit, Create Proposal, Change Status, Upload Documents

#### 5.2.3 Proposal List Page

- Header: "Proposals" + New Proposal button
- Filters: Status, Sales Person, Date Range, Client
- Table: PROP #, Enquiry #, Client, Title, Value, Status, Submitted Date, Actions
- Actions: View, Edit, Generate PDF, Submit, Create Revision

#### 5.2.4 Proposal Edit Page

- Wizard-style multi-step form:
  - Step 1: Basic Info (client, title, validity)
  - Step 2: Scope of Work (summary, deliverables, inclusions, exclusions)
  - Step 3: Scope of Supply (line items builder)
  - Step 4: Delivery & Milestones (timeline)
  - Step 5: Pricing (line items, taxes, totals)
  - Step 6: Terms & Conditions
  - Step 7: Review & Submit
- Auto-save indicator
- Save as Draft / Submit for Approval buttons

#### 5.2.5 Proposal View Page (Read-only)

- Header: PROP #, Revision, Status badge
- Sections (expandable):
  - Client Information
  - Scope of Work
  - Scope of Supply (table)
  - Delivery Timeline (Gantt chart)
  - Pricing Breakdown (table)
  - Terms & Conditions
- Sidebar: Actions (Generate PDF, Submit, Create Revision, Approve/Reject)
- Approval History section
- Activity Log

#### 5.2.6 Proposal Dashboard

- KPI Cards: Total Enquiries, Active Proposals, Conversion Rate, Total Value
- Charts: Enquiries by Month, Proposal Status, Win/Loss Trend
- Recent Activity table
- Quick actions: New Enquiry, New Proposal

---

## 6. Technical Architecture

### 6.1 Firestore Collections

```
/enquiries/{enquiryId}
  - Enquiry document

/proposals/{proposalId}
  - Proposal document

/proposals/{proposalId}/scopeOfSupply/{itemId}
  - ProposalLineItem sub-collection

/proposals/{proposalId}/milestones/{milestoneId}
  - ProposalMilestone sub-collection

/proposals/{proposalId}/approvals/{approvalId}
  - ApprovalRecord sub-collection

/proposals/{proposalId}/revisions/{revisionId}
  - Previous revision snapshots (for comparison)
```

### 6.2 Firestore Indexes

```json
[
  {
    "collectionGroup": "enquiries",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "status", "order": "ASCENDING" },
      { "fieldPath": "receivedDate", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "enquiries",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "assignedToUserId", "order": "ASCENDING" },
      { "fieldPath": "receivedDate", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "proposals",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "status", "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "proposals",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "enquiryId", "order": "ASCENDING" },
      { "fieldPath": "isLatestRevision", "order": "DESCENDING" }
    ]
  },
  {
    "collectionGroup": "proposals",
    "queryScope": "COLLECTION",
    "fields": [
      { "fieldPath": "clientId", "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]
  }
]
```

### 6.3 Services

```typescript
// packages/firebase/src/proposalService.ts
-createEnquiry() -
  updateEnquiry() -
  getEnquiryById() -
  listEnquiries(filters) -
  createProposal() -
  updateProposal() -
  submitProposalForApproval() -
  approveProposal() -
  rejectProposal() -
  generateProposalPDF() -
  submitProposalToClient() -
  createProposalRevision() -
  acceptProposal() -
  rejectProposal() -
  convertProposalToProject() - // KEY INTEGRATION
  // packages/firebase/src/proposalCalculationService.ts
  calculateProposalTotals() -
  calculateLineItemMargin() -
  applyTaxes() -
  generatePaymentSchedule() -
  // packages/firebase/src/proposalTemplateService.ts
  listTemplates() -
  createTemplate() -
  applyTemplate();
```

### 6.4 Types

```typescript
// packages/types/src/proposal.ts
-Enquiry -
  Proposal -
  ProposalLineItem -
  ProposalMilestone -
  PriceLineItem -
  TaxLineItem -
  ApprovalRecord -
  ProposalTemplate;
```

### 6.5 UI Components

```typescript
// apps/web/src/app/proposals/enquiries/page.tsx
- EnquiryListPage

// apps/web/src/app/proposals/enquiries/[id]/page.tsx
- EnquiryDetailPage

// apps/web/src/app/proposals/proposals/page.tsx
- ProposalListPage

// apps/web/src/app/proposals/proposals/[id]/page.tsx
- ProposalViewPage

// apps/web/src/app/proposals/proposals/[id]/edit/page.tsx
- ProposalEditPage (wizard)

// apps/web/src/components/proposals/
- EnquiryForm.tsx
- ProposalWizard.tsx
- ScopeOfWorkEditor.tsx
- ScopeOfSupplyBuilder.tsx
- DeliveryTimelineEditor.tsx
- PricingBuilder.tsx
- TermsAndConditionsEditor.tsx
- ProposalApprovalDialog.tsx
- ProposalPDFGenerator.tsx (using react-pdf)
- ProposalRevisionComparison.tsx
```

---

## 7. Implementation Phases

### Phase 1: Enquiry Management (20-25 hours)

- [ ] Data model (Enquiry type)
- [ ] Firestore collection and indexes
- [ ] Service functions (CRUD)
- [ ] Enquiry list page with filters
- [ ] Enquiry detail page
- [ ] Enquiry form (create/edit)
- [ ] Status workflow
- [ ] Document attachment

**Deliverable**: Enquiry tracking fully functional

### Phase 2: Basic Proposal Creation (30-35 hours)

- [ ] Data model (Proposal, ProposalLineItem)
- [ ] Firestore collections and indexes
- [ ] Service functions (CRUD)
- [ ] Proposal wizard UI (7 steps)
- [ ] Scope of Work editor
- [ ] Scope of Supply builder (with Excel import)
- [ ] Delivery timeline editor
- [ ] Pricing builder with calculations
- [ ] Terms & conditions editor

**Deliverable**: Create and save proposals

### Phase 3: Approval Workflow (15-20 hours)

- [ ] Approval data model
- [ ] Submit for approval function
- [ ] Approval/rejection functions
- [ ] Approval notification integration
- [ ] Task creation for approvers
- [ ] Multi-level approval support
- [ ] Approval history display

**Deliverable**: Proposal approval workflow complete

### Phase 4: PDF Generation & Submission (20-25 hours)

- [ ] PDF template design
- [ ] PDF generation service (react-pdf or similar)
- [ ] Company branding configuration
- [ ] Email integration for client submission
- [ ] Document transmittal record
- [ ] Proposal status tracking
- [ ] Revision management

**Deliverable**: Submit proposals to clients

### Phase 5: Proposal → Project Conversion (25-30 hours)

- [ ] Conversion function with field mapping
- [ ] Pre-approval logic for charter
- [ ] Budget line item creation
- [ ] Procurement item creation
- [ ] Cost centre auto-creation
- [ ] Notification to project manager
- [ ] Task creation for charter review
- [ ] Conversion UI with preview

**Deliverable**: Accepted proposals become projects automatically

### Phase 6: Analytics & Reporting (15-20 hours)

- [ ] Dashboard KPIs
- [ ] Conversion rate calculations
- [ ] Charts (enquiries, proposals, win/loss)
- [ ] Export to Excel
- [ ] Sales performance reports
- [ ] Client-wise proposal tracking

**Deliverable**: Proposal analytics dashboard

---

## 8. Total Effort Estimate

| Phase                       | Hours             | Priority |
| --------------------------- | ----------------- | -------- |
| Phase 1: Enquiry Management | 20-25             | Critical |
| Phase 2: Proposal Creation  | 30-35             | Critical |
| Phase 3: Approval Workflow  | 15-20             | High     |
| Phase 4: PDF & Submission   | 20-25             | High     |
| Phase 5: Proposal → Project | 25-30             | Critical |
| Phase 6: Analytics          | 15-20             | Medium   |
| **TOTAL**                   | **125-155 hours** | -        |

**Recommended Team**: 2 developers
**Timeline**: 8-10 weeks (at 30-35 hours/week)

---

## 9. Success Criteria

- [ ] Enquiries captured with zero data loss
- [ ] Proposals created in < 30 minutes (using templates)
- [ ] 100% of proposals tracked (no offline/email-only proposals)
- [ ] Conversion rate visible and accurate
- [ ] Accepted proposals create projects with 100% data transfer accuracy
- [ ] Zero manual re-entry of proposal data into projects
- [ ] Proposal PDF generation < 5 seconds
- [ ] User adoption: 100% of sales team using the module

---

## 10. Future Enhancements

- Client self-service portal (view proposals, upload PO)
- Proposal comparison (compare multiple proposals for same enquiry)
- AI-powered cost estimation (ML model based on historical data)
- E-signature integration (client signs proposal digitally)
- Multi-language proposal generation
- CRM integration (if separate CRM used)
- Proposal collaboration (multiple users edit simultaneously)
- Version control with Git-like branching

---

**End of Document**
