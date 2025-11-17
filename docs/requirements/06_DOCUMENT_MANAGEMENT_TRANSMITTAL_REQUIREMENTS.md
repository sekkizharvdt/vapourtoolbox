# Document Management & Transmittal System Requirements

**Document Version**: 1.0
**Created**: November 14, 2025
**Status**: Draft - For Review
**Priority**: 🔴 CRITICAL (Phase 1, Module 5 - Build FIFTH)
**Estimated Effort**: 60-80 hours

**Dependencies**:

- ✅ Material Database (COMPLETE)
- ✅ Shape Database (COMPLETE)
- ✅ BOM Generator (COMPLETE)
- ✅ Proposal Module Integration (COMPLETE)

---

## 1. Overview

### 1.1 Purpose

The Document Management & Transmittal System serves as the **complete repository** for all project-related documents, providing:

1. **Centralized Document Storage**: Single source of truth for all documents
2. **Version Control**: Track all revisions with complete audit trail
3. **Document Transmittals**: Formal submission workflow to clients
4. **Client Portal**: Secure area for clients to view/download documents
5. **Drawing Register**: Engineering drawing management with revision tracking
6. **Document Requirements Tracking**: Ensure all required documents delivered
7. **Approval Workflows**: Multi-stage review and approval process

### 1.2 Business Context

**From User's Vision**:

> "The document management module will have a complete repository of the documents related to that project. Right from the inputs provided by the client, engineering drawings submitted, its revisions, should be able to generate document transmittals based on what is to be submitted."

**Current State** (75% implemented):

- ✅ Document upload to Firebase Storage
- ✅ Version control (basic)
- ✅ Multi-level linking (project, equipment, entity)
- ✅ Document types (60+)
- ✅ Search and filtering
- ⚠️ **MISSING**: Document transmittals (0%)
- ⚠️ **MISSING**: Client portal (0%)
- ⚠️ **MISSING**: Drawing register with revision tracking (0%)
- ⚠️ **MISSING**: Document approval workflow (0%)

**Target State**:

- Complete document lifecycle management
- Formal transmittal workflow with client acknowledgment
- Drawing register with revision tracking and supersession
- Client self-service portal for document access
- Automated reminders for overdue documents
- Integration with project requirements from BOM/Proposal

### 1.3 Document Lifecycle

```
1. Document Requirement Created
   (from Project creation, BOM, Manual)
   ↓
2. Document Created/Uploaded
   (by assigned user)
   ↓
3. Internal Review & Approval
   (optional, based on document type)
   ↓
4. Document Transmittal Created
   (group documents for client submission)
   ↓
5. Transmittal Sent to Client
   (email notification with secure link)
   ↓
6. Client Reviews Document
   (client portal access)
   ↓
7. Client Acknowledgment/Comments
   (approve, approve with comments, reject)
   ↓
8. Revision (if needed)
   (loop back to step 2)
   ↓
9. Final Approval & Archival
```

---

## 2. Data Model

### 2.1 Enhanced Document Model

```typescript
interface Document {
  // Identity
  id: string;
  documentNumber: string; // Auto-generated: DOC-YYYY-NNNN or custom
  customDocumentNumber?: string; // User-defined (e.g., DRG-HX-101-GA-001)
  title: string;
  description?: string;

  // Type & Category
  documentType: DocumentType; // DRAWING, CALCULATION, REPORT, etc.
  category: DocumentCategory; // ENGINEERING, QUALITY, COMMERCIAL, etc.
  subCategory?: string; // "Fabrication Drawing", "Stress Analysis"

  // File Information
  fileName: string;
  fileSize: number; // bytes
  mimeType: string;
  storagePath: string; // Firebase Storage path
  downloadUrl: string; // Signed URL (time-limited)
  thumbnailUrl?: string; // For PDFs/images

  // Version Control
  version: string; // "A", "B", "C" or "1.0", "1.1", "2.0"
  revision: number; // Numeric revision (0, 1, 2, ...)
  isLatest: boolean;
  previousVersionId?: string; // Link to previous version
  supersedes?: string[]; // Document IDs this replaces
  supersededBy?: string; // Document ID that replaces this

  // Status & Workflow
  status: DocumentStatus;
  internalApprovalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  clientApprovalStatus?:
    | 'NOT_SUBMITTED'
    | 'SUBMITTED'
    | 'APPROVED'
    | 'APPROVED_WITH_COMMENTS'
    | 'REJECTED';

  // Linking
  projectId?: string;
  projectNumber?: string;
  equipmentId?: string; // Link to BOM item, if applicable
  entityId?: string; // Organization
  relatedDocuments?: string[]; // Related document IDs

  // Requirements
  documentRequirementId?: string; // If created from requirement
  isMandatory: boolean;
  dueDate?: Timestamp;
  submittedDate?: Timestamp;

  // Assignment
  preparedBy: string; // User ID
  preparedByName: string;
  reviewedBy?: string[]; // User IDs
  approvedBy?: string[]; // User IDs
  assignedTo?: string; // For pending documents

  // Transmittal
  transmittalIds: string[]; // List of transmittals this doc was sent in
  lastTransmittalDate?: Timestamp;

  // Metadata
  tags: string[];
  folder?: string; // Logical folder path
  keywords?: string[]; // For search
  language?: string; // EN, HI, etc.
  confidential: boolean; // Restrict access

  // Drawing-specific (if documentType = DRAWING)
  drawingDetails?: {
    drawingNumber: string; // Per company standard
    sheetNumber?: string; // "1 of 5"
    scale?: string; // "1:100", "NTS"
    drawingSize?: 'A0' | 'A1' | 'A2' | 'A3' | 'A4';
    discipline?: 'MECHANICAL' | 'ELECTRICAL' | 'CIVIL' | 'INSTRUMENTATION' | 'PIPING';
    revisionHistory: DrawingRevision[];
  };

  // Quality Documents (if category = QUALITY)
  qualityDetails?: {
    testDate?: Timestamp;
    testResult?: 'PASS' | 'FAIL';
    certificateNumber?: string;
    inspector?: string;
    expiryDate?: Timestamp;
  };

  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
  uploadedAt: Timestamp;
  uploadedBy: string;

  // Access Control
  isPublic: boolean; // Visible to client
  sharedWith?: string[]; // User IDs with special access
  downloadCount: number;
  lastDownloadedAt?: Timestamp;
  lastDownloadedBy?: string;
}
```

### 2.2 Document Enums

```typescript
enum DocumentType {
  // Engineering Documents
  DRAWING = 'DRAWING',
  CALCULATION = 'CALCULATION',
  SPECIFICATION = 'SPECIFICATION',
  DATASHEET = 'DATASHEET',
  PROCEDURE = 'PROCEDURE',

  // Quality Documents
  TEST_CERTIFICATE = 'TEST_CERTIFICATE',
  INSPECTION_REPORT = 'INSPECTION_REPORT',
  MTC = 'MTC', // Material Test Certificate
  WELD_LOG = 'WELD_LOG',
  NDT_REPORT = 'NDT_REPORT',

  // Commercial Documents
  QUOTATION = 'QUOTATION',
  INVOICE = 'INVOICE',
  PURCHASE_ORDER = 'PURCHASE_ORDER',
  DELIVERY_NOTE = 'DELIVERY_NOTE',

  // Manuals & Reports
  OPERATION_MANUAL = 'OPERATION_MANUAL',
  MAINTENANCE_MANUAL = 'MAINTENANCE_MANUAL',
  TECHNICAL_REPORT = 'TECHNICAL_REPORT',

  // Other
  CORRESPONDENCE = 'CORRESPONDENCE',
  PHOTOGRAPH = 'PHOTOGRAPH',
  OTHER = 'OTHER',
}

enum DocumentCategory {
  ENGINEERING = 'ENGINEERING',
  QUALITY = 'QUALITY',
  PROCUREMENT = 'PROCUREMENT',
  COMMERCIAL = 'COMMERCIAL',
  PROJECT_MANAGEMENT = 'PROJECT_MANAGEMENT',
  HEALTH_SAFETY = 'HEALTH_SAFETY',
  CLIENT_DELIVERABLE = 'CLIENT_DELIVERABLE',
  INTERNAL = 'INTERNAL',
}

enum DocumentStatus {
  DRAFT = 'DRAFT', // Being prepared
  UNDER_REVIEW = 'UNDER_REVIEW', // Internal review
  APPROVED = 'APPROVED', // Internally approved
  SUBMITTED = 'SUBMITTED', // Sent to client
  ACCEPTED = 'ACCEPTED', // Client accepted
  REJECTED = 'REJECTED', // Client rejected
  SUPERSEDED = 'SUPERSEDED', // Replaced by newer version
  ARCHIVED = 'ARCHIVED', // No longer active
}
```

### 2.3 Drawing Revision

```typescript
interface DrawingRevision {
  revision: string; // "A", "B", "C" or "0", "1", "2"
  date: Timestamp;
  description: string; // "Initial issue", "Updated dimensions"
  preparedBy: string;
  reviewedBy?: string;
  approvedBy?: string;
  documentId: string; // Link to Document version
}
```

### 2.4 Document Transmittal

```typescript
interface DocumentTransmittal {
  // Identity
  id: string;
  transmittalNumber: string; // TRN-YYYY-NNNN or custom format
  customTransmittalNumber?: string; // Per company standard (e.g., TRN-HX101-001)

  // Project & Client
  projectId: string;
  projectNumber: string;
  projectName: string;
  clientId: string;
  clientName: string;
  clientContactPerson: string;
  clientEmail: string;

  // Transmittal Details
  subject: string; // "Submittal of GA Drawings for Heat Exchanger HX-101"
  description?: string;
  transmittalDate: Timestamp;
  dueDate?: Timestamp; // Response expected by
  purpose: TransmittalPurpose; // FOR_APPROVAL, FOR_INFORMATION, AS_BUILT, etc.

  // Documents
  documents: TransmittalDocument[]; // List of documents being transmitted
  documentCount: number;
  totalFileSize: number; // bytes

  // Cover Letter
  coverLetter?: string; // Rich text message to client
  remarks?: string;

  // Status
  status: TransmittalStatus;
  sentAt?: Timestamp;
  sentBy?: string;
  sentByName?: string;

  // Client Response
  clientAcknowledgedAt?: Timestamp;
  clientAcknowledgedBy?: string; // Client user name
  clientResponse?: 'APPROVED' | 'APPROVED_WITH_COMMENTS' | 'REJECTED' | 'RESUBMIT_REQUIRED';
  clientComments?: string;
  clientResponseDate?: Timestamp;

  // Reminders
  reminderSentAt?: Timestamp[];
  reminderCount: number;

  // Links
  generatedPdfUrl?: string; // Transmittal cover sheet PDF
  clientPortalUrl?: string; // Unique URL for client access

  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

enum TransmittalPurpose {
  FOR_APPROVAL = 'FOR_APPROVAL', // Client must approve
  FOR_INFORMATION = 'FOR_INFORMATION', // FYI only
  FOR_REVIEW_AND_COMMENT = 'FOR_REVIEW_AND_COMMENT', // Client feedback requested
  AS_BUILT = 'AS_BUILT', // Final as-built documents
  FOR_CONSTRUCTION = 'FOR_CONSTRUCTION', // Approved for construction
  FOR_RECORD = 'FOR_RECORD', // Archive copy
}

enum TransmittalStatus {
  DRAFT = 'DRAFT', // Being prepared
  READY_TO_SEND = 'READY_TO_SEND', // Ready but not sent
  SENT = 'SENT', // Sent to client
  ACKNOWLEDGED = 'ACKNOWLEDGED', // Client acknowledged receipt
  RESPONDED = 'RESPONDED', // Client provided response
  CLOSED = 'CLOSED', // Transmittal closed (accepted/filed)
  CANCELLED = 'CANCELLED', // Cancelled before sending
}

interface TransmittalDocument {
  documentId: string;
  documentNumber: string;
  title: string;
  version: string;
  fileSize: number;
  action: 'NEWLY_SUBMITTED' | 'RESUBMITTED' | 'REVISED' | 'CANCELLED';
  remarks?: string;
}
```

### 2.5 Drawing Register

```typescript
interface DrawingRegister {
  // Project
  projectId: string;
  projectNumber: string;

  // Drawing
  drawingNumber: string; // Master drawing number
  title: string;
  discipline: 'MECHANICAL' | 'ELECTRICAL' | 'CIVIL' | 'INSTRUMENTATION' | 'PIPING';
  drawingType:
    | 'GENERAL_ARRANGEMENT'
    | 'FABRICATION'
    | 'ASSEMBLY'
    | 'DETAIL'
    | 'PIPING_ISOMETRIC'
    | 'PID';

  // Current Status
  latestRevision: string; // "C"
  latestDocumentId: string; // Link to current Document
  status: 'IN_PROGRESS' | 'UNDER_REVIEW' | 'APPROVED' | 'ISSUED_FOR_CONSTRUCTION' | 'AS_BUILT';

  // Revisions
  revisions: DrawingRevision[]; // All revisions (A, B, C, ...)
  revisionCount: number;

  // Approval Status
  internallyApproved: boolean;
  clientApproved: boolean;
  approvedForConstruction: boolean;

  // Transmittals
  transmittalHistory: {
    transmittalId: string;
    transmittalNumber: string;
    revision: string;
    sentDate: Timestamp;
    clientResponse?: string;
  }[];

  // Metadata
  preparedBy: string;
  lastUpdatedAt: Timestamp;
  createdAt: Timestamp;
}
```

### 2.6 Client Portal Access

```typescript
interface ClientPortalAccess {
  id: string;
  clientId: string;
  clientName: string;
  projectId: string;
  projectNumber: string;

  // Access Credentials
  accessToken: string; // Unique secure token
  accessUrl: string; // https://app.example.com/portal/{token}
  expiryDate?: Timestamp; // Optional expiry

  // Permissions
  canDownloadDocuments: boolean;
  canViewAllDocuments: boolean; // Or only submitted documents
  canCommentOnDocuments: boolean;
  canSubmitDocuments: boolean; // Upload client inputs

  // Activity
  lastAccessedAt?: Timestamp;
  accessCount: number;
  documentsDownloaded: number;

  // Status
  isActive: boolean;
  createdAt: Timestamp;
  createdBy: string;
}
```

---

## 3. Functional Requirements

### 3.1 Document Upload & Management

#### 3.1.1 Upload Document

**Actor**: User with CREATE_DOCUMENT permission

**Flow**:

1. Navigate to Documents → Upload
2. Select file (PDF, DWG, DOCX, XLSX, images)
3. System validates:
   - File size < 50 MB
   - Allowed file type
   - Virus scan (optional)
4. Fill metadata:
   - Document type, category
   - Title, description
   - Project/equipment link
   - Tags
   - Is mandatory? Due date?
   - Mark as client deliverable?
5. Upload file to Firebase Storage
6. System generates document number (DOC-2025-0001)
7. Create Document record
8. If drawing, populate drawing-specific fields
9. If linked to document requirement, update requirement status

**Validations**:

- Title required (max 200 characters)
- Document type required
- Project link required (if client deliverable)
- File size limit: 50 MB
- Allowed extensions: .pdf, .dwg, .dxf, .docx, .xlsx, .jpg, .png

**Outputs**:

- Document uploaded and indexed
- Thumbnail generated (if PDF/image)
- Document requirement status updated (if linked)
- Notification sent to project team

#### 3.1.2 Version Control (New Revision)

**Trigger**: Document needs to be revised

**Flow**:

1. Open existing document
2. Click "Upload New Revision"
3. Upload new file
4. Enter revision details:
   - Revision identifier (auto-incremented: A→B→C or 1.0→1.1→2.0)
   - Description of changes
   - Reason for revision
5. System creates new Document record:
   - version = next version
   - revision = previous revision + 1
   - previousVersionId = old document ID
   - isLatest = true
6. Update old document:
   - isLatest = false
   - supersededBy = new document ID
7. If drawing, add to DrawingRevision history
8. If document was in transmittal, mark for re-transmittal

**Revision Naming**:

- **Option 1**: Alphabetic (A, B, C, ..., Z, AA, AB)
- **Option 2**: Numeric (0, 1, 2, ...)
- **Option 3**: Decimal (1.0, 1.1, 1.2, 2.0)
- System supports all three, configurable per project

**Supersession Rules**:

- If document was APPROVED, new revision status = DRAFT
- If document was SUBMITTED to client, require re-approval before re-submission
- Drawing register automatically updated with new revision

#### 3.1.3 Document Search & Filtering

**Features**:

- **Full-text search**: Title, description, document number, tags
- **Filter by**:
  - Project
  - Document type
  - Category
  - Status
  - Due date range
  - Created date range
  - Prepared by, Reviewed by
  - Transmittal status (submitted, pending, not submitted)
  - Client approval status
- **Sort by**: Date, Document number, Title, Size
- **View options**: Grid (with thumbnails), List, Timeline
- **Quick filters**:
  - My documents (created by me)
  - Pending approval
  - Overdue (past due date)
  - Latest versions only

---

### 3.2 Drawing Register

#### 3.2.1 Create Drawing Register Entry

**Trigger**: First drawing uploaded for a project

**Flow**:

1. User uploads drawing (documentType = DRAWING)
2. System checks if drawing number exists in register
3. If new:
   - Create DrawingRegister entry
   - drawingNumber = user-entered or auto-generated
   - latestRevision = "A" (or "0")
   - Add first revision to revisions array
4. If exists:
   - Update latestRevision
   - Add new revision to revisions array
   - Update latestDocumentId

**Drawing Numbering Convention** (customizable):

```
Format: [PROJECT]-[DISCIPLINE]-[TYPE]-[SEQUENCE]-[SHEET]
Example: HX101-MECH-GA-001-1

Where:
- PROJECT: Project code (HX101)
- DISCIPLINE: MECH, ELEC, CIVIL, INST, PIPING
- TYPE: GA (General Arrangement), FAB (Fabrication), ASSY (Assembly), DTL (Detail), ISO (Isometric), PID
- SEQUENCE: 001, 002, 003
- SHEET: Sheet number (if multi-sheet drawing)
```

#### 3.2.2 View Drawing Register

**Layout**: Table view

**Columns**:

- Drawing Number
- Title
- Discipline
- Type
- Latest Revision
- Status
- Internal Approval (✓/✗)
- Client Approval (✓/✗)
- Last Transmittal Date
- Actions (View, Download, New Revision, Transmit)

**Features**:

- Group by discipline
- Filter by status, approval status
- Export to Excel
- Print drawing register report

**Revision History** (drill-down):

```
Drawing: HX101-MECH-GA-001
Title: Heat Exchanger General Arrangement

Revision History:
┌──────────┬────────────┬─────────────────────────────────┬────────────┬──────────────┐
│ Revision │ Date       │ Description                     │ Prepared By│ Client Status│
├──────────┼────────────┼─────────────────────────────────┼────────────┼──────────────┤
│ C        │ Nov 12, 25 │ Updated nozzle orientation      │ John Doe   │ Approved     │
│ B        │ Nov 5, 25  │ Revised shell thickness         │ John Doe   │ Approved w/C │
│ A        │ Oct 28, 25 │ Initial issue                   │ John Doe   │ Rejected     │
└──────────┴────────────┴─────────────────────────────────┴────────────┴──────────────┘

Current Status: APPROVED FOR CONSTRUCTION
Latest Transmittal: TRN-HX101-003 (Sent: Nov 12, 2025)
```

---

### 3.3 Document Transmittal System

#### 3.3.1 Create Transmittal

**Actor**: User with CREATE_TRANSMITTAL permission

**Flow**:

1. **Navigate to Transmittals → New Transmittal**

2. **Select Project & Client**:
   - Project dropdown (filters to client's projects)
   - Client auto-populated from project
   - Contact person dropdown (from client entity)

3. **Transmittal Details**:
   - Subject: [Auto-suggested based on documents, or manual entry]
   - Purpose: FOR_APPROVAL | FOR_INFORMATION | FOR_REVIEW_AND_COMMENT | AS_BUILT | FOR_CONSTRUCTION
   - Transmittal Date: [Default: Today]
   - Due Date (for response): [Optional, default: Today + 14 days]
   - Cover Letter: [Rich text editor]

4. **Select Documents** (multi-select table):

   ```
   ┌────────────────────────────────────────────────────────────────────────┐
   │ Select Documents to Transmit                                           │
   ├────────────────────────────────────────────────────────────────────────┤
   │ Filter: [Document Type ▼] [Status: Approved ▼] [Not Transmitted Yet]  │
   │                                                                         │
   │ ☑ DOC-2025-0042  General Arrangement Drawing     Rev C    2.5 MB      │
   │ ☑ DOC-2025-0045  Fabrication Drawing Shell       Rev B    1.8 MB      │
   │ ☑ DOC-2025-0048  Design Calculation               Rev A    0.5 MB      │
   │ ☐ DOC-2025-0051  Material Test Certificate       Rev 0    0.3 MB      │
   │                                                                         │
   │ Selected: 3 documents | Total Size: 4.8 MB                             │
   └────────────────────────────────────────────────────────────────────────┘
   ```

5. **Configure each document**:
   - Action: NEWLY_SUBMITTED | RESUBMITTED | REVISED | CANCELLED
   - Remarks (optional): Document-specific notes

6. **Preview Transmittal**:
   - Show cover sheet preview (PDF)
   - Document list table
   - Email notification preview

7. **Save as DRAFT or READY_TO_SEND**

**Auto-Suggested Subject Examples**:

- "Submittal of General Arrangement Drawings for Approval"
- "Revised Fabrication Drawings (Rev B)"
- "As-Built Drawings - Final Submission"

#### 3.3.2 Send Transmittal

**Trigger**: User clicks "Send Transmittal"

**Preconditions**:

- Transmittal status = DRAFT or READY_TO_SEND
- At least 1 document selected
- Client email configured
- All selected documents status = APPROVED (internal)

**Flow**:

1. **Final validation checks**:
   - All documents approved internally? (warn if not)
   - Client email valid?
   - Documents still latest versions? (warn if superseded)

2. **Generate Transmittal Cover Sheet (PDF)**:

   ```
   ┌─────────────────────────────────────────────────────────────────┐
   │                    DOCUMENT TRANSMITTAL                         │
   │                                                                 │
   │ From: [Your Company Name]                                       │
   │       [Address]                                                 │
   │                                                                 │
   │ To:   [Client Name]                                            │
   │       Attn: [Contact Person]                                   │
   │       [Email]                                                   │
   │                                                                 │
   │ Date: November 14, 2025                                        │
   │ Transmittal No: TRN-HX101-001                                  │
   │ Project: Heat Exchanger HX-101                                 │
   │ Purpose: FOR APPROVAL                                          │
   │ Response Due: November 28, 2025                                │
   │                                                                 │
   │ ──────────────────────────────────────────────────────────────│
   │                                                                 │
   │ Subject: Submittal of General Arrangement Drawings for Approval│
   │                                                                 │
   │ Dear Sir/Madam,                                                │
   │                                                                 │
   │ [Cover Letter Text]                                            │
   │                                                                 │
   │ Documents Transmitted:                                         │
   │                                                                 │
   │ ┌───┬────────────┬────────────────────┬─────┬────────────────┐│
   │ │No.│Doc Number  │Title               │Rev  │Action          ││
   │ ├───┼────────────┼────────────────────┼─────┼────────────────┤│
   │ │ 1 │DOC-2025-042│GA Drawing          │C    │Newly Submitted ││
   │ │ 2 │DOC-2025-045│Fabrication Drawing │B    │Revised         ││
   │ │ 3 │DOC-2025-048│Design Calculation  │A    │Newly Submitted ││
   │ └───┴────────────┴────────────────────┴─────┴────────────────┘│
   │                                                                 │
   │ Please review and provide your approval by November 28, 2025.  │
   │                                                                 │
   │ You can access these documents via our secure client portal:   │
   │ https://app.example.com/portal/abc123token                     │
   │                                                                 │
   │ For any queries, please contact [Contact Name, Phone, Email]   │
   │                                                                 │
   │ Sincerely,                                                     │
   │ [Your Name]                                                    │
   │ [Your Title]                                                   │
   │                                                                 │
   │ ──────────────────────────────────────────────────────────────│
   │ Acknowledgment (to be returned by client):                     │
   │                                                                 │
   │ ☐ Approved                                                     │
   │ ☐ Approved with Comments                                      │
   │ ☐ Rejected - Resubmit Required                                │
   │                                                                 │
   │ Comments: _______________________________________________      │
   │                                                                 │
   │ Signature: ________________  Date: ___________                 │
   │ Name: _____________________                                    │
   └─────────────────────────────────────────────────────────────────┘
   ```

3. **Create Client Portal Access** (if not exists):
   - Generate unique access token
   - Create secure URL
   - Grant access to project documents

4. **Send Email Notification**:

   ```
   To: client@example.com
   Subject: Document Transmittal TRN-HX101-001 - Heat Exchanger HX-101

   Dear [Client Contact Person],

   Please find attached Document Transmittal TRN-HX101-001 for your review and approval.

   Project: Heat Exchanger HX-101
   Purpose: FOR APPROVAL
   Documents: 3
   Response Due: November 28, 2025

   You can view and download the documents using our secure client portal:
   https://app.example.com/portal/abc123token

   Attached:
   - Transmittal Cover Sheet (PDF)

   Please acknowledge receipt and provide your response by the due date.

   Best regards,
   [Your Name]
   [Your Company Name]
   ```

5. **Update Transmittal Status**:
   - status = SENT
   - sentAt = NOW()
   - sentBy = currentUser.id

6. **Update Document Records**:
   - Add transmittalId to documents[].transmittalIds
   - Set documents[].lastTransmittalDate = NOW()
   - Set documents[].clientApprovalStatus = 'SUBMITTED'

7. **Create Audit Log Entry**

8. **Schedule Reminder** (if due date set):
   - Reminder 1: Due date - 3 days (if no response)
   - Reminder 2: Due date (if no response)
   - Reminder 3: Due date + 3 days (escalation)

**Outputs**:

- Transmittal sent to client
- Client portal access granted
- Email notification sent
- Transmittal PDF generated and stored
- Reminders scheduled

#### 3.3.3 Client Portal Access

**URL**: `https://app.example.com/portal/{accessToken}`

**Authentication**: Token-based (no login required)

**Layout**:

```
┌─────────────────────────────────────────────────────────────────────┐
│  [Company Logo]          Client Document Portal                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Project: Heat Exchanger HX-101                                     │
│  Client: ABC Industries Pvt Ltd                                     │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  📬 Transmittals                                                    │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ TRN-HX101-001 | Nov 14, 2025 | FOR APPROVAL | ⏳ PENDING     │  │
│  │ Submittal of General Arrangement Drawings for Approval        │  │
│  │ Documents: 3 | Due: Nov 28, 2025 | [View Details] [Respond]  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ TRN-HX101-002 | Nov 7, 2025 | FOR INFORMATION | ✅ ACKNOWLEDGED│
│  │ Material Test Certificates                                    │  │
│  │ Documents: 5 | [View Details]                                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  📄 All Documents                                                   │
├─────────────────────────────────────────────────────────────────────┤
│  Filter: [Document Type ▼] [Status ▼] [Date Range]                │
│                                                                      │
│  ┌───┬──────────────┬────────────────────┬─────┬─────┬─────────┐  │
│  │No.│Doc Number    │Title               │Rev  │Date │Download  │  │
│  ├───┼──────────────┼────────────────────┼─────┼─────┼─────────┤  │
│  │ 1 │DOC-2025-042  │GA Drawing          │C    │Nov14│⬇ 2.5 MB│  │
│  │ 2 │DOC-2025-045  │Fabrication Drawing │B    │Nov14│⬇ 1.8 MB│  │
│  │ 3 │DOC-2025-048  │Design Calculation  │A    │Nov14│⬇ 0.5 MB│  │
│  └───┴──────────────┴────────────────────┴─────┴─────┴─────────┘  │
│                                                                      │
│  [Download All as ZIP]                                              │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│  📤 Upload Documents (if enabled)                                   │
├─────────────────────────────────────────────────────────────────────┤
│  [Upload Client Inputs] [Upload Site Drawings]                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Client Actions**:

1. **View Transmittal Details**
2. **Download Individual Documents**
3. **Download All Documents (ZIP)**
4. **Respond to Transmittal** (Approve/Reject/Comment)
5. **Upload Documents** (if permission granted)

#### 3.3.4 Client Response (Transmittal Acknowledgment)

**Flow** (Client side):

1. **Client clicks "Respond" on transmittal**
2. **Response Form**:

   ```
   ┌─────────────────────────────────────────────────────────────┐
   │ Respond to Transmittal TRN-HX101-001                        │
   ├─────────────────────────────────────────────────────────────┤
   │                                                              │
   │ Your Response:                                               │
   │ ◉ Approved                                                  │
   │ ○ Approved with Comments                                    │
   │ ○ Rejected - Resubmit Required                             │
   │                                                              │
   │ Comments:                                                    │
   │ ┌──────────────────────────────────────────────────────┐   │
   │ │                                                        │   │
   │ │                                                        │   │
   │ │                                                        │   │
   │ └──────────────────────────────────────────────────────┘   │
   │                                                              │
   │ Document-Specific Comments (optional):                      │
   │ ┌───┬────────────┬────────────────────┬───────────────┐   │
   │ │No.│Doc Number  │Title               │Comments        │   │
   │ ├───┼────────────┼────────────────────┼───────────────┤   │
   │ │ 1 │DOC-2025-042│GA Drawing          │[OK           ]│   │
   │ │ 2 │DOC-2025-045│Fabrication Drawing │[Update dim X ]│   │
   │ │ 3 │DOC-2025-048│Design Calculation  │[              ]│   │
   │ └───┴────────────┴────────────────────┴───────────────┘   │
   │                                                              │
   │ Your Name: [________________]                               │
   │ Your Email: [________________]                              │
   │                                                              │
   │                                   [Cancel] [Submit Response] │
   └─────────────────────────────────────────────────────────────┘
   ```

3. **Client submits response**

4. **System processes**:
   - Update Transmittal:
     - clientResponse = 'APPROVED' | 'APPROVED_WITH_COMMENTS' | 'REJECTED'
     - clientComments = entered comments
     - clientAcknowledgedAt = NOW()
     - clientAcknowledgedBy = entered name
     - status = RESPONDED
   - Update Documents:
     - clientApprovalStatus = 'APPROVED' | 'APPROVED_WITH_COMMENTS' | 'REJECTED'
     - If APPROVED: status = ACCEPTED
     - If REJECTED: status = REJECTED
   - Send notification to project team
   - Create task for project team: "Review client response for TRN-HX101-001"

5. **Email Notification to Project Team**:

   ```
   Subject: Client Response Received - TRN-HX101-001

   Client has responded to Transmittal TRN-HX101-001.

   Response: APPROVED WITH COMMENTS
   Responded by: Jane Doe (jane.doe@client.com)
   Response Date: November 20, 2025

   General Comments:
   "Approved for fabrication. Please update dimension X on Sheet 2 of fabrication drawing DOC-2025-045."

   [View Full Response] [View Transmittal]
   ```

**Flow** (Internal team):

1. View client response
2. If comments/rejection:
   - Address comments
   - Create revised documents
   - Create new transmittal for resubmission
3. If approved:
   - Update project status
   - Proceed with fabrication/next phase

---

### 3.4 Document Approval Workflow (Internal)

#### 3.4.1 Submit Document for Internal Review

**Trigger**: Document status = DRAFT → User clicks "Submit for Review"

**Flow**:

1. Select reviewers (multi-select users)
2. Add review comments/instructions
3. Set review due date
4. Submit
5. System:
   - Update document status = UNDER_REVIEW
   - Create tasks for each reviewer: "Review Document DOC-2025-0042"
   - Send notifications

#### 3.4.2 Review Document

**Actor**: Reviewer (assigned user)

**Flow**:

1. Reviewer receives task notification
2. Open document for review
3. Download and review document
4. Provide feedback:
   - ◉ Approve
   - ◉ Request Changes
   - ◉ Reject
5. Add comments
6. Submit review

**System Actions**:

- If ALL reviewers approve:
  - status = APPROVED
  - internalApprovalStatus = APPROVED
  - approvedBy = [reviewer IDs]
  - Document now eligible for transmittal
- If ANY reviewer requests changes/rejects:
  - status = DRAFT
  - internalApprovalStatus = REJECTED
  - Notification sent to document creator
  - Creator must address comments and re-submit

---

### 3.5 Document Requirements Tracking

#### 3.5.1 Auto-Generate Document Requirements

**Trigger**: Project created from Proposal (via BOM Proposal Project Integration)

**Flow** (covered in Integration doc, but enhanced here):

**Engineering Documents** (from BOM):

```typescript
For each BOM item with procurementType = 'MAKE' and itemType = 'ASSEMBLY':
  Create DocumentRequirement:
    - documentType: FABRICATION_DRAWING
    - description: "Fabrication Drawing: {BOMItem.name}"
    - reference: "DRG-{projectCode}-{bomItemNumber}"
    - assignedTo: User with CREATE_ENGINEERING_DOCUMENT permission
    - dueDate: project.startDate + 21 days
    - priority: HIGH
    - isMandatory: true
```

**Quality Documents** (based on project type):

```typescript
If project involves pressure vessels or heat exchangers:
  Create DocumentRequirements:
    - Material Test Certificates (MTCs)
    - Hydro Test Report
    - NDT Reports (RT, UT, PT, MT)
    - Manufacturers Data Report (MDR)
    - Design Certificate (if ASME U-stamp required)
```

**Client Deliverables** (from proposal terms):

```typescript
Create DocumentRequirements:
  - Operation & Maintenance Manual (dueDate: completion - 14 days)
  - As-Built Drawings (complete set) (dueDate: completion)
  - Warranty Certificate (dueDate: completion)
```

#### 3.5.2 Track Document Requirement Status

**Dashboard View**:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Document Requirements: Project HX-101                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ Progress: ████████████░░░░░░░░░░  60% Complete (12 of 20 docs)     │
│                                                                      │
│ ┌─────────────────────────────────────────────────────────────┐    │
│ │ Status Breakdown:                                            │    │
│ │ ✅ Completed: 12                                            │    │
│ │ 🔄 In Progress: 5                                           │    │
│ │ ⏳ Pending: 3                                               │    │
│ │ ⚠️  Overdue: 0                                              │    │
│ └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│ Filter: [Status ▼] [Assigned To ▼] [Due This Week]                │
│                                                                      │
│ ┌───┬────────────────────┬──────────┬────────┬─────────┬──────┐   │
│ │No.│Document Type       │Assigned  │Due Date│Status   │Action │   │
│ ├───┼────────────────────┼──────────┼────────┼─────────┼──────┤   │
│ │ 1 │Fabrication Drawing│John Doe  │Nov 20  │✅ Done  │[View]│   │
│ │ 2 │Design Calculation │Jane Smith│Nov 22  │🔄 Draft │[View]│   │
│ │ 3 │MTC                │Vendor    │Dec 1   │⏳ Pend  │[Track│   │
│ │ 4 │O&M Manual         │Tech Writer│Feb 1  │⏳ Pend  │[Start│   │
│ └───┴────────────────────┴──────────┴────────┴─────────┴──────┘   │
│                                                                      │
│ [Export to Excel] [Generate Report]                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### 3.5.3 Link Document to Requirement

**Flow**:

1. User uploads document
2. System shows: "Does this fulfill a document requirement?"
3. User selects requirement from list
4. System links:
   - DocumentRequirement.actualDocumentId = document.id
   - DocumentRequirement.status = COMPLETED
   - Document.documentRequirementId = requirement.id
5. Requirement marked as fulfilled

**Auto-linking**:

- If document reference matches requirement reference exactly
- If document type matches requirement type AND same project
- User confirms the link

---

## 4. Technical Architecture

### 4.1 Firebase Storage Structure

```
/projects/{projectId}/
  /documents/
    /engineering/
      /{documentId}/
        /v1/
          - file.pdf
          - thumbnail.jpg
        /v2/
          - file.pdf
          - thumbnail.jpg
    /quality/
    /commercial/
    /client-deliverables/
  /transmittals/
    /{transmittalId}/
      - cover-sheet.pdf
      - transmittal-package.zip
```

### 4.2 Firestore Collections

```
/documents/{documentId}
/drawingRegisters/{registerId}
/transmittals/{transmittalId}
/clientPortalAccess/{accessId}
/documentRequirements/{requirementId}  // Already exists from Project module
```

### 4.3 Firestore Indexes

```json
{
  "indexes": [
    {
      "collectionGroup": "documents",
      "fields": [
        { "fieldPath": "projectId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "documents",
      "fields": [
        { "fieldPath": "projectId", "order": "ASCENDING" },
        { "fieldPath": "documentType", "order": "ASCENDING" },
        { "fieldPath": "isLatest", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "documents",
      "fields": [
        { "fieldPath": "isLatest", "order": "ASCENDING" },
        { "fieldPath": "dueDate", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "transmittals",
      "fields": [
        { "fieldPath": "projectId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "transmittalDate", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "drawingRegisters",
      "fields": [
        { "fieldPath": "projectId", "order": "ASCENDING" },
        { "fieldPath": "discipline", "order": "ASCENDING" },
        { "fieldPath": "drawingNumber", "order": "ASCENDING" }
      ]
    }
  ]
}
```

### 4.4 Cloud Functions

```typescript
// Storage triggers
export const onDocumentUploaded = onObjectFinalized(async (event) => {
  // Generate thumbnail for PDFs/images
  // Extract metadata (PDF page count, etc.)
  // Run virus scan
  // Update document record with file info
});

export const onDocumentDeleted = onObjectDeleted(async (event) => {
  // Clean up thumbnails
  // Update document record
});

// Firestore triggers
export const onTransmittalSent = onDocumentUpdated('transmittals/{id}', async (change) => {
  // If status changed to SENT:
  // - Send email to client
  // - Schedule reminder functions
  // - Update document records
});

export const onDocumentApproved = onDocumentUpdated('documents/{id}', async (change) => {
  // If status changed to APPROVED:
  // - Notify stakeholders
  // - Check if all documents in transmittal approved
  // - Update drawing register
});

// Scheduled functions
export const sendTransmittalReminders = onSchedule('every day 09:00', async () => {
  // Find transmittals with:
  //   - status = SENT
  //   - dueDate approaching or passed
  //   - No client response
  // Send reminder emails
});

export const checkOverdueDocuments = onSchedule('every day 09:00', async () => {
  // Find document requirements:
  //   - status != COMPLETED
  //   - dueDate < TODAY
  // Send overdue notifications to assigned users
});
```

### 4.5 Email Templates

**Transmittal Notification**:

- Subject: "Document Transmittal {transmittalNumber} - {projectName}"
- Body: Professional email with transmittal details, client portal link, attached cover sheet PDF
- Reply-to: Project contact email

**Transmittal Reminder**:

- Subject: "Reminder: Document Transmittal {transmittalNumber} - Response Due {dueDate}"
- Body: Polite reminder with days remaining, client portal link

**Client Response Notification**:

- Subject: "Client Response Received - {transmittalNumber}"
- Body: Response summary, comments, link to view full response

**Overdue Document Alert**:

- Subject: "Overdue Document: {documentType} - {projectName}"
- Body: Document details, original due date, days overdue, action required

---

## 5. Implementation Phases

### Phase 1: Enhanced Document Management (20-25 hours)

- [ ] Enhanced Document data model with all fields
- [ ] Version control improvements (supersession tracking)
- [ ] Drawing-specific fields and metadata
- [ ] Quality document fields
- [ ] Document upload UI improvements
- [ ] New revision upload flow
- [ ] Document search & filtering enhancements
- [ ] Document detail page with version history
- [ ] Unit tests (15 tests)

### Phase 2: Drawing Register (15-20 hours)

- [ ] DrawingRegister data model
- [ ] Drawing numbering convention (configurable)
- [ ] Auto-create register entry on drawing upload
- [ ] Drawing register view (table)
- [ ] Revision history view (per drawing)
- [ ] Filter by discipline, type, status
- [ ] Export to Excel
- [ ] Integration with document upload
- [ ] Unit tests (10 tests)

### Phase 3: Document Transmittals (20-25 hours)

- [ ] DocumentTransmittal data model
- [ ] Create transmittal wizard (3 steps)
- [ ] Document selection UI
- [ ] Transmittal cover sheet PDF generation
- [ ] Email notification service integration
- [ ] Send transmittal flow
- [ ] Transmittal list & detail views
- [ ] Document linking (add to transmittals array)
- [ ] Unit tests (12 tests)
- [ ] Integration tests (3 scenarios)

### Phase 4: Client Portal (15-20 hours)

- [ ] ClientPortalAccess data model
- [ ] Token generation & validation
- [ ] Client portal landing page
- [ ] Transmittal list view (client side)
- [ ] Document download (client side)
- [ ] Client response form
- [ ] Response processing & notifications
- [ ] Access logging
- [ ] Security: Rate limiting, token expiry
- [ ] Unit tests (8 tests)

**Total Estimated Effort**: **70-90 hours** (3-4 weeks)

**Note**: Original estimate was 60-80 hours. Increased to 70-90 hours due to comprehensive transmittal workflow and client portal.

---

## 6. Success Metrics

### 6.1 Efficiency Metrics

- **Document Upload Time**: < 30 seconds (including metadata entry)
- **Transmittal Creation Time**: < 10 minutes for 10-document transmittal
- **Client Portal Access**: < 2 seconds page load
- **PDF Generation**: < 5 seconds for transmittal cover sheet

### 6.2 User Adoption

- **Document Repository Usage**: 100% of project documents uploaded (after 1 month)
- **Transmittal Usage**: 80%+ of client document submissions via transmittals
- **Client Portal Usage**: 60%+ of clients access portal vs email attachments
- **Drawing Register Completeness**: 95%+ of drawings tracked in register

### 6.3 Quality Metrics

- **Version Control Accuracy**: 100% of revisions tracked correctly
- **Document Completeness**: 90%+ of document requirements fulfilled on time
- **Transmittal Response Time**: Average < 7 days (from client)
- **Overdue Documents**: < 10% of documents past due date

---

## 7. Security & Compliance

### 7.1 Access Control

**Internal Users**:

- Permission: CREATE_DOCUMENT, EDIT_DOCUMENT, DELETE_DOCUMENT, VIEW_DOCUMENT
- Project-based access: Users can only see documents for their projects
- Confidential documents: Additional permission required

**Client Portal**:

- Token-based authentication (no password required)
- Token expiry: Optional (default: no expiry, can be revoked)
- IP whitelisting: Optional (restrict to client IP range)
- Download logging: Track who downloaded what, when

### 7.2 Data Protection

**File Storage**:

- Firebase Storage with encryption at rest
- Signed URLs with time expiry (default: 1 hour)
- Virus scanning on upload (optional integration)
- File size limits enforced

**Audit Trail**:

- All document uploads logged
- All version changes logged
- All transmittals logged
- All client portal access logged
- All downloads tracked

### 7.3 Compliance

**ISO 9001** (Quality Management):

- Document control procedures
- Revision tracking
- Approval workflows
- Supersession management

**ASME Requirements** (if applicable):

- Manufacturers Data Reports (MDR)
- Design certificates
- Material test certificates
- Weld procedure specifications

---

## 8. User Interface Design

### 8.1 Document List Page

**URL**: `/documents`

**Layout**:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Documents                                       [+ Upload Document] │
├─────────────────────────────────────────────────────────────────────┤
│  Filters: [Project ▼] [Type ▼] [Status ▼] [Latest Only ☑] [Search] │
├──────────┬──────────────┬────────┬────────┬─────────┬──────────────┤
│ Doc No   │ Title        │ Type   │ Rev    │ Status  │ Actions       │
├──────────┼──────────────┼────────┼────────┼─────────┼──────────────┤
│ DOC-2025-│ GA Drawing   │ DRAWING│ C      │ APPROVED│ [View] [⬇]   │
│ 0042     │ HX-101       │        │        │         │ [New Rev]     │
├──────────┼──────────────┼────────┼────────┼─────────┼──────────────┤
│ DOC-2025-│ Design Calc  │ CALC   │ A      │ DRAFT   │ [View] [Edit]│
│ 0045     │              │        │        │         │               │
└──────────┴──────────────┴────────┴────────┴─────────┴──────────────┘
Pagination: [← Prev] [1] [2] [3] ... [Next →]
```

### 8.2 Transmittal List Page

**URL**: `/transmittals`

**Layout**:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Document Transmittals                       [+ New Transmittal]     │
├─────────────────────────────────────────────────────────────────────┤
│  Filters: [Project ▼] [Status ▼] [Date Range] [Search...]          │
├──────────────┬──────────────┬────────┬────────┬───────────────────┤
│ TRN No       │ Subject      │ Client │ Sent   │ Status            │
├──────────────┼──────────────┼────────┼────────┼───────────────────┤
│ TRN-HX101-001│ GA Drawings  │ ABC Ltd│ Nov 14 │ ✅ APPROVED      │
│              │ (3 docs)     │        │        │ [View] [Download] │
├──────────────┼──────────────┼────────┼────────┼───────────────────┤
│ TRN-HX101-002│ MTCs         │ ABC Ltd│ Nov 10 │ ⏳ SENT          │
│              │ (5 docs)     │        │        │ [View] [Remind]   │
└──────────────┴──────────────┴────────┴────────┴───────────────────┘
```

---

## 9. Testing Requirements

### 9.1 Test Scenarios

**Test 1: Document Upload & Version Control**

```
1. Upload document (PDF, 2.5 MB)
2. Verify document created with DOC-YYYY-NNNN number
3. Verify file stored in Firebase Storage
4. Verify thumbnail generated
5. Upload new revision
6. Verify version incremented (A → B)
7. Verify previousVersionId linked
8. Verify old document isLatest = false
9. Verify new document isLatest = true
```

**Test 2: Drawing Register**

```
1. Upload drawing (documentType = DRAWING)
2. Verify DrawingRegister entry created
3. Verify drawing number auto-generated or user-entered
4. Upload revision B
5. Verify DrawingRegister updated (latestRevision = B)
6. Verify revision history array updated
7. View drawing register
8. Verify drawing appears with Rev B
```

**Test 3: Create & Send Transmittal**

```
1. Create transmittal
2. Select project & client
3. Select 3 documents
4. Add cover letter
5. Preview transmittal
6. Send transmittal
7. Verify email sent to client
8. Verify transmittal status = SENT
9. Verify documents clientApprovalStatus = SUBMITTED
10. Verify client portal access created
11. Access client portal with token
12. Verify documents visible and downloadable
13. Submit client response (APPROVED WITH COMMENTS)
14. Verify transmittal status = RESPONDED
15. Verify notification sent to project team
```

**Test 4: Document Requirements Tracking**

```
1. Create project from proposal (with BOM)
2. Verify document requirements auto-generated
3. Upload document
4. Link document to requirement
5. Verify requirement status = COMPLETED
6. View document requirements dashboard
7. Verify progress percentage updated
```

---

## 10. Future Enhancements (Post-v1.0)

### 10.1 Advanced Features

**Document Comparison**:

- Visual diff between document versions
- Highlight changes (redline)
- Side-by-side comparison

**OCR & Text Extraction**:

- Extract text from PDFs for searchability
- Auto-tagging based on content
- Full-text search

**AI-Powered Features**:

- Auto-suggest document type based on content
- Auto-extract metadata (drawing number, revision, date)
- Smart document classification

**Advanced Transmittals**:

- Multi-project transmittals
- Transmittal templates (standard cover letters)
- Bulk transmittal creation

**Client Collaboration**:

- Client markup/annotation tools
- Real-time commenting
- Document approval workflow (multi-stage)

### 10.2 Integrations

**CAD Integration**:

- Import drawing metadata from AutoCAD/SolidWorks
- Auto-update drawing register from CAD files
- Thumbnail generation from DWG files

**Email Integration**:

- Receive client emails with attachments → Auto-create documents
- Reply to transmittals via email
- Email parsing for automatic acknowledgment

**ERP Integration**:

- Sync documents with SAP/Oracle
- Export transmittal logs to ERP
- Material certificates linked to inventory

---

**End of Document**
