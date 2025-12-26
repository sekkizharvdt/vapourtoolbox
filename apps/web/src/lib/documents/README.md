# Documents Module

Document management system for the Vapour Toolbox application.

## Overview

The documents module provides:

1. **Document Registry** - Central document tracking and metadata
2. **Folder Management** - Hierarchical folder organization
3. **Comments & Resolution** - Document review workflow
4. **Transmittals** - Document submission tracking
5. **Links** - Document cross-references
6. **Supply/Work Lists** - Procurement item attachments

## Directory Structure

```
documents/
├── index.ts                      # Main barrel export
│
├── commentResolutionService.ts   # Comment resolution workflow
├── commentService.ts             # Document comments
├── crsService.ts                 # CRS (Comment Resolution Sheet)
├── documentNumberingService.ts   # Auto-numbering
├── documentService.ts            # Core document CRUD
├── documentSubmissionService.ts  # Submission tracking
├── documentTemplateService.ts    # Document templates
├── folderService.ts              # Folder management
├── linkService.ts                # Document links/references
├── masterDocumentService.ts      # Master document list
├── submissionService.ts          # Submission CRUD
├── supplyItemService.ts          # Supply list items
├── supplyListService.ts          # Supply lists
├── transmittalService.ts         # Transmittal management
├── workItemService.ts            # Work list items
└── workListService.ts            # Work lists
```

## Document Types

- **Drawing** - Engineering drawings
- **Specification** - Technical specifications
- **Report** - Analysis/study reports
- **Manual** - Operating/maintenance manuals
- **Procedure** - Work procedures
- **Correspondence** - Letters/emails
- **Other** - Miscellaneous documents

## Document Workflow

```
DRAFT → ISSUED_FOR_REVIEW → APPROVED / REJECTED
                    ↓
               SUPERSEDED (new revision)
```

## Key Services

### Document Management

```typescript
import { createDocument, getDocumentById, updateDocumentStatus } from '@/lib/documents';
```

### Comments

```typescript
import { addComment, resolveComment, getDocumentComments } from '@/lib/documents';
```

### Transmittals

```typescript
import { createTransmittal, getTransmittalById, generateTransmittalPDF } from '@/lib/documents';
```

## Document Numbering

Format: `PROJECT-TYPE-SEQUENCE-REV`

Example: `VDT-DWG-001-A`

- PROJECT: Project code
- TYPE: Document type code
- SEQUENCE: Sequential number
- REV: Revision letter (A, B, C...)

## Folder Structure

Documents are organized in a hierarchical folder structure:

- Project folders (auto-created)
- User-defined subfolders
- Document type groupings

## Comment Resolution Sheet (CRS)

1. Reviewer adds comments to document
2. Author responds with actions
3. Resolution marked (Agreed/Noted/Rejected)
4. Final approval closes CRS

## Transmittal Flow

1. Select documents to transmit
2. Choose recipients
3. Set purpose (For Review, For Approval, etc.)
4. Generate transmittal number
5. Track acknowledgments

## Testing

```bash
pnpm --filter @vapour/web test src/lib/documents
```

## Related Modules

- `@/lib/projects` - Project document requirements
- `@/lib/procurement` - Procurement attachments
- `@/lib/companyDocuments` - Company-wide documents
