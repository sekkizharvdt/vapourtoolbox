# Receipt Parsing Implementation Guide

This document describes the implementation of OCR-based receipt parsing for travel expenses using Google Cloud Document AI.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Web Client    │────▶│  Firebase Cloud  │────▶│  Document AI        │
│   (React)       │     │  Functions       │     │  (OCR Processor)    │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
        │                        │
        ▼                        ▼
┌─────────────────┐     ┌──────────────────┐
│ Firebase Storage│     │    Firestore     │
│ (Receipt PDFs)  │     │ (Parsing Jobs)   │
└─────────────────┘     └──────────────────┘
```

## Components

### 1. Client Component: `ReceiptParsingUploader.tsx`

**Location**: `apps/web/src/components/hr/travelExpenses/ReceiptParsingUploader.tsx`

**Features**:

- Three-step flow: Upload → Parsing → Review
- Real-time upload progress
- Auto-fills form with parsed data
- Allows manual correction before submission
- GST breakdown fields (CGST/SGST/IGST)
- Company GSTIN verification badge

**Key Code Pattern** - Calling regional Cloud Function:

```typescript
// Get the app instance and create a functions instance for asia-south1 region
const { app } = getFirebase();
const functionsAsiaSouth1 = getFunctions(app, 'asia-south1');
const parseReceiptFn = httpsCallable<RequestType, ResponseType>(
  functionsAsiaSouth1,
  'parseReceiptForExpense'
);
```

### 2. Cloud Function: `parseReceiptForExpense`

**Location**: `functions/src/receiptParsing/parseReceipt.ts`

**Configuration**:

- Region: `asia-south1` (for lower latency in India)
- Memory: 512MiB
- Timeout: 120 seconds
- Max instances: 20

**Extraction Features**:

- Vendor name detection
- Invoice/Bill number extraction
- Transaction date parsing (multiple formats)
- Total amount extraction (INR)
- GST breakdown (CGST, SGST, IGST rates and amounts)
- GSTIN extraction and validation
- Company GSTIN matching
- Expense category suggestion (Travel, Accommodation, Food, Local Conveyance)

### 3. Firebase Storage Rules

**Location**: `storage.rules`

```javascript
// HR Travel Expense Receipts
// Path: hr/travel-expenses/{reportId}/receipts/{filename}
match /hr/travel-expenses/{reportId}/receipts/{allPaths=**} {
  allow read: if isAuthenticated();
  allow write: if isAuthenticated() &&
                 request.resource.size < 5 * 1024 * 1024 &&
                 (request.resource.contentType.matches('image/.*') ||
                  request.resource.contentType == 'application/pdf');
  allow delete: if isAuthenticated();
}
```

## Deployment Requirements

### 1. Enable Document AI API

```bash
gcloud services enable documentai.googleapis.com --project=vapour-toolbox
```

### 2. Create Document AI Processor

1. Go to Google Cloud Console → Document AI
2. Create a new processor of type "Expense Parser" or "Form Parser"
3. Note the Processor ID

### 3. Set Environment Variables

In `functions/.env` or Firebase Functions config:

```
DOCUMENT_AI_PROCESSOR_ID=your-processor-id
DOCUMENT_AI_EXPENSE_PROCESSOR_ID=your-expense-processor-id  # Optional, more specific
```

### 4. Deploy Functions

```bash
firebase deploy --only functions:parseReceiptForExpense
```

### 5. Deploy Storage Rules

```bash
firebase deploy --only storage
```

### 6. Deploy Web App

```bash
pnpm --filter @vapour/web build
firebase deploy --only hosting
```

## Data Flow

### Upload Flow

1. User selects receipt file (PDF, JPG, PNG, WebP)
2. Client validates file type and size (max 5MB)
3. File uploads to `hr/travel-expenses/{reportId}/receipts/{timestamp}_{filename}`
4. On upload complete, client calls `parseReceiptForExpense` Cloud Function

### Parsing Flow

1. Cloud Function validates authentication
2. Downloads file from Firebase Storage
3. Retrieves company GSTIN from `company/settings`
4. Sends file to Document AI for OCR
5. Extracts structured data using regex patterns
6. Detects expense category from keywords
7. Checks for company GSTIN on receipt
8. Creates audit record in `receiptParsingJobs` collection
9. Returns parsed data to client

### Review Flow

1. Client displays parsed data in editable form
2. User can modify any auto-filled values
3. Shows confidence score and company GSTIN badge
4. On submit, expense item is created with receipt attachment

## Type Definitions

### ParsedReceiptData

```typescript
interface ParsedReceiptData {
  vendorName?: string;
  invoiceNumber?: string;
  transactionDate?: string;
  totalAmount?: number;
  taxableAmount?: number;
  currency?: string;

  // GST breakdown
  gstAmount?: number;
  gstRate?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;

  // GSTIN
  vendorGstin?: string;
  companyGstinFound: boolean;

  // Categorization
  suggestedCategory?: string;
  categoryConfidence?: number;

  // Metadata
  confidence: number;
  processingTimeMs: number;
}
```

### ParsedExpenseData (Client)

```typescript
interface ParsedExpenseData {
  category: TravelExpenseCategory;
  description: string;
  expenseDate: Date;
  amount: number;
  vendorName?: string;
  invoiceNumber?: string;
  gstRate?: number;
  gstAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  taxableAmount?: number;
  vendorGstin?: string;
  ourGstinUsed?: boolean;
  receipt: ReceiptAttachment;
}
```

## Category Detection

The function detects expense categories based on keywords in the receipt text:

| Category         | Keywords                                                                   |
| ---------------- | -------------------------------------------------------------------------- |
| TRAVEL           | airline, airways, flight, railway, train, irctc, bus, travels, ticket, pnr |
| ACCOMMODATION    | hotel, resort, inn, lodge, oyo, treebo, room, stay, check-in               |
| LOCAL_CONVEYANCE | uber, ola, rapido, taxi, cab, metro, parking, toll                         |
| FOOD             | restaurant, cafe, food, swiggy, zomato, dominos, breakfast, lunch, dinner  |
| OTHER            | (default when no keywords match)                                           |

## GST Pattern Matching

### GSTIN Format

```
2 digit state code + 10 char PAN + 1 entity number + Z + 1 checksum
Example: 29AAQCS9602E1ZM
```

### Amount Extraction Patterns

- CGST: `/CGST\s*@?\s*\d*%?\s*:?\s*₹?\s*([\d,]+\.?\d*)/i`
- SGST: `/SGST\s*@?\s*\d*%?\s*:?\s*₹?\s*([\d,]+\.?\d*)/i`
- IGST: `/IGST\s*@?\s*\d*%?\s*:?\s*₹?\s*([\d,]+\.?\d*)/i`

## Audit Trail

All parsing jobs are logged to the `receiptParsingJobs` collection:

```typescript
{
  id: string;
  userId: string;
  reportId: string;
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  status: 'COMPLETED' | 'FAILED';
  parsedData?: {
    vendorName: string;
    totalAmount: number;
    gstAmount: number;
    companyGstinFound: boolean;
    suggestedCategory: string;
    confidence: number;
  };
  error?: string;
  processingTimeMs: number;
  createdAt: Timestamp;
}
```

## Troubleshooting

### CORS Error

**Symptom**: "Access to fetch at 'https://us-central1-...' blocked by CORS policy"

**Cause**: Client calling wrong region

**Fix**: Ensure client creates Functions instance with correct region:

```typescript
const functionsAsiaSouth1 = getFunctions(app, 'asia-south1');
```

### Storage Permission Denied

**Symptom**: "Failed to upload receipt. Please try again."

**Cause**: Storage rules not deployed

**Fix**: Deploy storage rules:

```bash
firebase deploy --only storage
```

### Document AI Not Configured

**Symptom**: "Document AI processor not configured"

**Cause**: Missing environment variable

**Fix**: Set `DOCUMENT_AI_PROCESSOR_ID` in Firebase Functions config via GitHub Secrets:

1. Add `DOCUMENT_AI_EXPENSE_PROCESSOR_ID` and `DOCUMENT_AI_PROCESSOR_ID` to GitHub repository secrets
2. The CI workflow automatically creates `functions/.env` with these values during deployment
3. Redeploy via GitHub Actions

### Document AI Region Mismatch

**Symptom**: "Invalid location: 'asia-south1' must match the server deployment 'us'"

**Cause**: Document AI processor was created in a different region than configured in code

**Important**: Document AI is only available in limited regions (`us`, `eu`). When you create a processor in Google Cloud Console, note the region it's created in.

**Fix**: Ensure `DOCUMENT_AI_LOCATION` environment variable matches where your processor was created (default: `us`)

### IAM Permission Denied

**Symptom**: "Permission 'documentai.processors.processOnline' denied on resource"

**Cause**: Cloud Functions service account doesn't have Document AI permissions

**Fix**: Grant `roles/documentai.apiUser` to the Cloud Functions service account:

```bash
gcloud projects add-iam-policy-binding vapour-toolbox \
  --member="serviceAccount:vapour-toolbox@appspot.gserviceaccount.com" \
  --role="roles/documentai.apiUser"
```

### Empty Parsing Results

**Symptom**: Form shows no auto-filled data

**Possible Causes**:

1. Poor image quality
2. Handwritten receipt
3. Unusual receipt format

**User Action**: Manually enter expense details in the review form

## Future Improvements

1. **Multi-language support**: Currently optimized for English/Hindi receipts
2. **Better date parsing**: Support more date formats
3. **Receipt validation**: Warn if receipt appears to be a duplicate
4. **Batch upload**: Parse multiple receipts at once
5. **ML-based categorization**: Train a model on historical expense data
