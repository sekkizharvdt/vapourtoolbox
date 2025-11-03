# Procurement Module - Implementation Progress

**Date Started**: 2025-11-02
**Current Status**: Foundation Layer Complete
**Timeline**: 10 Weeks Total (Week 1 in progress)

---

## Overview

Building a custom Procurement module from scratch (NOT migrating from VDT-Procure) based on the actual business workflow at Vapour Desal Technologies.

### Complete Workflow

```
Purchase Request → Engineering Approval → RFQ Creation →
Vendor Offers → Offer Comparison → PO Generation →
Director Approval → Order Acknowledgement → Packing List →
Goods Receipt/Testing → Payment Approval → Work Completion Certificate
```

---

## Week 1 Progress (Current)

### ✅ Completed

1. **Type Definitions** (`packages/types/src/`)
   - ✅ `procurement.ts` - Complete procurement workflow types
     - Purchase Request & Items
     - RFQ & Items
     - Offer & Items
     - Purchase Order & Items
     - Packing List & Items
     - Goods Receipt & Items
     - Work Completion Certificate
     - Procurement Notifications

   - ✅ `documents.ts` - Document management types
     - Document Record with versioning
     - Multi-level linking (project/equipment/entity)
     - Document search and filters
     - Version history tracking
     - Equipment document summary

2. **Firebase Collections** (`packages/firebase/src/collections.ts`)
   - ✅ Added all procurement collections
   - ✅ Added document management collections
   - ✅ Proper naming conventions (camelCase)

3. **Document Management Service** (`apps/web/src/lib/documents/documentService.ts`)
   - ✅ Upload documents to Firebase Storage
   - ✅ Version control (track revisions)
   - ✅ Multi-level linking (project → equipment → entity)
   - ✅ Search and filter documents
   - ✅ Get document version history
   - ✅ Get equipment document summary
   - ✅ Soft delete support
   - ✅ Download tracking

### 🔄 In Progress

4. **Purchase Request Service**
   - Starting implementation

5. **Purchase Request UI Pages**
   - To be created

### ⏳ Pending This Week

6. **Excel Upload Service**
   - Hybrid parsing (client-side <5MB, Cloud Function >5MB)

7. **Engineering Approval UI**
   - Approval dashboard
   - Approve/Reject/Comment workflow

---

## Key Design Decisions

### ✅ Confirmed Approach

1. **No Email Notifications**
   - In-app notifications only
   - Users check notification bell for updates
   - No automated email sending

2. **No Vendor Email Integration**
   - PDFs generated in-app
   - Procurement Manager downloads and emails manually
   - System tracks "sent date" via manual entry

3. **Centralized Document Management**
   - All generated PDFs stored in DMS
   - Document types: RFQ, PO, OA, Packing List, WCC, offers, attachments
   - Complete document trail per equipment/item
   - Version control for all revisions

4. **Excel Upload - Hybrid Parsing**
   - Small files (<5MB): Client-side parsing (xlsx library)
   - Large files (>5MB): Cloud Function parsing
   - Automatic fallback based on file size

5. **Offer Comparison - Manual Initially**
   - Structured comparison UI
   - Manual entry of offer details
   - System designed for future AI enhancement
   - Claude API integration planned for Phase 2

6. **Material Database**
   - Basic structure for now
   - Details to be specified later
   - Placeholder for future expansion

7. **Accounting Integration**
   - Notification-based initially
   - GL automation can be added later in Phase 2

---

## File Structure Created

```
VDT-Unified/
├── packages/
│   ├── types/src/
│   │   ├── procurement.ts ✅
│   │   ├── documents.ts ✅
│   │   └── index.ts ✅ (updated)
│   │
│   └── firebase/src/
│       └── collections.ts ✅ (updated)
│
└── apps/web/src/
    └── lib/
        └── documents/
            └── documentService.ts ✅
```

---

## Next Steps (Rest of Week 1-2)

### Week 1 Remaining Tasks

1. **Purchase Request Service** (`apps/web/src/lib/procurement/purchaseRequestService.ts`)
   - CRUD operations
   - Number generation (PR/YYYY/MM/XXXX)
   - Status workflow
   - Line item management

2. **Purchase Request Pages**

   ```
   apps/web/src/app/procurement/
   ├── purchase-requests/
   │   ├── page.tsx (list)
   │   ├── new/page.tsx (create)
   │   └── [id]/page.tsx (view/edit)
   ```

3. **Engineering Approval Dashboard**

   ```
   apps/web/src/app/procurement/
   └── engineering-approval/
       └── page.tsx (approval dashboard)
   ```

4. **Excel Upload Component**
   - File upload UI
   - Client-side parser (xlsx)
   - Cloud Function trigger for large files
   - Line item preview before submission

5. **Document Upload Component**
   - Reusable document upload widget
   - Preview uploaded documents
   - Link documents to PR items

### Week 2 Tasks

6. **Raw Material Database (Basic)**
   - Simple material master
   - Category, unit, basic specs
   - Material selector in PR creation

7. **In-App Notification System**
   - Notification bell component
   - Notification list panel
   - Mark as read/unread
   - Notification creation service

8. **Testing & Bug Fixes**
   - Test complete PR workflow
   - Test document upload/versioning
   - Test approval workflow

---

## Technical Stack

### Frontend

- Next.js 15 (App Router)
- TypeScript 5.7+ (strict mode)
- Material-UI v7.3.4
- React Hook Form (for forms)
- xlsx library (Excel parsing)

### Backend

- Firebase Firestore (database)
- Firebase Storage (documents)
- Firebase Cloud Functions (large file parsing, PDF generation)

### Document Generation

- jsPDF or Puppeteer (for PDF generation)
- QR code generation (for packing lists)

---

## Firestore Collections Structure

### Purchase Request Collections

```typescript
purchaseRequests: {
  id: PR-{timestamp}
  number: "PR/2025/11/0001"
  type: "PROJECT" | "BUDGETARY" | "INTERNAL"
  category: "SERVICE" | "RAW_MATERIAL" | "BOUGHT_OUT"
  projectId: string
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | ...
  ...
}

purchaseRequestItems: {
  id: auto-generated
  purchaseRequestId: string
  lineNumber: number
  description: string
  quantity: number
  unit: string
  equipmentId?: string  // Link to specific equipment
  ...
}
```

### Document Collection

```typescript
documents: {
  id: auto-generated
  fileName: string
  fileUrl: string  // Firebase Storage URL
  storageRef: string  // /documents/{projectId}/{equipmentId}/...

  // Categorization
  module: "PROCUREMENT"
  documentType: "PR_DRAWING" | "RFQ_PDF" | ...

  // Multi-level linking
  projectId: string
  equipmentId?: string
  entityType: "PURCHASE_REQUEST"
  entityId: string

  // Version control
  version: number
  isLatest: boolean
  previousVersionId?: string

  ...
}
```

---

## Document Storage Structure

```
/documents/
  /{projectId}/
    /{equipmentId}/  (optional, for equipment-specific docs)
      /procurement/
        /purchase-requests/{prId}/
          - 1699999999-pr-001-drawing.pdf
          - 1699999999-pr-001-catalogue.xlsx
        /rfqs/{rfqId}/
          - 1700000000-rfq-202501-001-v1.pdf
          - 1700000001-rfq-202501-001-v2.pdf (revision)
        /offers/{offerId}/
          - 1700100000-vendor-a-offer.pdf
        /purchase-orders/{poId}/
          - 1700200000-po-202501-001-v1.pdf
          - 1700200001-po-202501-001-v2.pdf
          - 1700200002-oa-form.pdf
          - 1700200003-vendor-signed-oa.pdf
        /packing-lists/{packingListId}/
          - 1700300000-packing-list.pdf
        /goods-receipts/{grId}/
          - 1700400000-receipt-photo-1.jpg
          - 1700400001-test-certificate.pdf
        /work-completion/
          - 1700500000-wcc-po-001.pdf
```

---

## Success Metrics

### Week 1-2 Completion Criteria

- ✅ All type definitions complete
- ✅ Document management service functional
- ⏳ Purchase Request creation working (single line + Excel upload)
- ⏳ Engineering approval workflow functional
- ⏳ Documents uploading and versioning correctly
- ⏳ In-app notifications working
- ⏳ Zero TypeScript errors
- ⏳ Basic testing complete

---

## Known Limitations (To Address in Future Phases)

1. **No AI-powered offer parsing** - Manual entry for now
2. **No automated email** - Manual send by Procurement Manager
3. **Basic material database** - Minimal structure
4. **No GL automation** - Notifications only for now
5. **No advanced search** - Basic filtering only
6. **No mobile optimization** - Desktop-first

---

## Notes

- Following VDT-Unified patterns and conventions
- Reusing existing modules where possible (User Management, Entity Management, Project Management)
- NO MOCK DATA - All components require real data or show empty states
- Desktop-first responsive design
- Strict TypeScript throughout

---

**Last Updated**: 2025-11-02
**Next Update**: End of Week 1 (2025-11-08)
