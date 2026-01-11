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

## Training a Custom Document AI Processor

For better accuracy with your specific receipt types (Uber, airlines, hotels, etc.), you can train a custom Document AI processor.

### Why Train a Custom Processor?

The pre-built expense parser is trained on generic receipts. A custom processor trained on YOUR receipts will:

- Better recognize your common vendors (Uber, IndiGo, OYO, etc.)
- Correctly identify "Total Amount" vs "Sub Total"
- Extract vendor-specific fields (Trip ID, PNR, Booking Ref)
- Handle Indian GST invoice formats accurately

### Step 1: Collect Training Data

**Minimum samples**: 50-100 receipts (more = better accuracy)

**Recommended distribution**:
| Category | Vendors | Sample Count |
|----------|---------|--------------|
| Ride-hailing | Uber, Ola, Rapido | 15-20 |
| Airlines | IndiGo, Air India, SpiceJet, Vistara | 15-20 |
| Hotels | OYO, Taj, ITC, local hotels | 10-15 |
| Food | Swiggy, Zomato, restaurants | 10-15 |
| Local Transport | Metro, taxi, auto | 5-10 |

**File requirements**:

- Format: PDF, JPEG, PNG
- Quality: Clear, legible (min 150 DPI for scans)
- Size: Under 20MB per file

### Step 2: Create Custom Document Extractor

1. Go to [Google Cloud Console → Document AI](https://console.cloud.google.com/ai/document-ai)

2. Click **Create Processor**

3. Select **Custom Document Extractor** (under "Specialized")

4. Configure:
   - **Name**: `vapour-expense-receipts`
   - **Region**: `us` (Document AI is limited to us/eu regions)

5. Click **Create**

6. Note the **Processor ID** (e.g., `abc123def456`)

### Step 3: Define Schema (Labels)

In the processor console, go to **Manage Versions → Create New Version → Define Schema**:

**Required Fields** (create these labels):

| Label Name         | Type     | Description                         |
| ------------------ | -------- | ----------------------------------- |
| `vendor_name`      | Text     | Business name (Uber, IndiGo, OYO)   |
| `total_amount`     | Currency | Final amount paid (including taxes) |
| `invoice_number`   | Text     | Invoice/Receipt/Trip ID/PNR         |
| `transaction_date` | Date     | Date of service/purchase            |
| `taxable_amount`   | Currency | Amount before tax                   |
| `cgst_amount`      | Currency | Central GST amount                  |
| `sgst_amount`      | Currency | State GST amount                    |
| `igst_amount`      | Currency | Integrated GST amount               |
| `gst_rate`         | Number   | GST percentage (5, 12, 18, etc.)    |
| `vendor_gstin`     | Text     | Vendor's GSTIN                      |
| `buyer_gstin`      | Text     | Your company's GSTIN on receipt     |

**Vendor-Specific Fields** (optional but recommended):

| Label Name          | Type | Used For              |
| ------------------- | ---- | --------------------- |
| `trip_id`           | Text | Uber/Ola receipts     |
| `pnr_number`        | Text | Airline/train tickets |
| `booking_reference` | Text | Hotel bookings        |
| `check_in_date`     | Date | Hotels                |
| `check_out_date`    | Date | Hotels                |
| `flight_number`     | Text | Airlines              |

### Step 4: Upload and Label Documents

1. In the processor, go to **Train** → **Upload Documents**

2. Upload your sample receipts (batch upload supported)

3. For each document, **label the fields**:
   - Click on the text in the document
   - Assign it to the appropriate label
   - Ensure you label the **FINAL total** (not sub-total)

**Labeling Tips**:

```
✅ CORRECT LABELING:
- "Grand Total: ₹1,234.00" → total_amount: 1234.00
- "Trip ID: abc123" → invoice_number: abc123 (or trip_id if using)
- "CGST @9%: ₹50.00" → cgst_amount: 50.00, gst_rate: 18

❌ COMMON MISTAKES:
- Labeling "Sub Total" as total_amount
- Missing the date because it's in a different format
- Not labeling GSTIN numbers
```

### Step 5: Train the Processor

1. After labeling 50+ documents, go to **Train** → **Start Training**

2. Training takes 2-4 hours depending on sample size

3. You'll receive an email when training completes

4. Review the **evaluation metrics**:
   - **Precision**: % of extracted values that are correct
   - **Recall**: % of actual values that were extracted
   - Target: >90% for both on key fields

### Step 6: Test the Processor

1. Go to **Evaluate** → **Test**

2. Upload a few receipts NOT used in training

3. Review the extracted data

4. If accuracy is poor on specific fields:
   - Add more training samples for that receipt type
   - Retrain the processor

### Step 7: Deploy to Production

1. Once satisfied with accuracy, get the **Processor Version ID**

2. Update `functions/.env`:

   ```
   DOCUMENT_AI_EXPENSE_PROCESSOR_ID=<new-processor-id>
   ```

3. If using a specific version:

   ```
   DOCUMENT_AI_EXPENSE_PROCESSOR_VERSION=<version-id>
   ```

4. Update GitHub Secrets for CI/CD deployment

5. Deploy:
   ```bash
   firebase deploy --only functions:parseReceiptForExpense
   ```

### Step 8: Update Extraction Code (Optional)

If you added custom fields like `trip_id` or `pnr_number`, update `parseReceipt.ts` to use Document AI's entity extraction instead of regex:

```typescript
// In processReceiptWithDocumentAI function
// After: const document = result.document;

// Use Document AI entities when available
if (document.entities && document.entities.length > 0) {
  for (const entity of document.entities) {
    const value = entity.mentionText;
    const confidence = entity.confidence || 0;

    switch (entity.type) {
      case 'total_amount':
        if (confidence > 0.7) {
          // Parse currency value
          parsedData.totalAmount = parseCurrency(value);
        }
        break;
      case 'invoice_number':
      case 'trip_id':
      case 'pnr_number':
        if (confidence > 0.7) {
          parsedData.invoiceNumber = value;
        }
        break;
      // ... handle other fields
    }
  }
}

// Fall back to regex extraction for any missing fields
```

### Maintenance & Retraining

**When to retrain**:

- New vendor types added (new airline, hotel chain)
- Accuracy drops below 85%
- Vendor changes their receipt format

**Recommended**: Review parsing accuracy monthly using the `receiptParsingJobs` collection. Filter by low confidence scores to identify problem areas.

### Cost Considerations

| Item       | Cost (as of 2026)                      |
| ---------- | -------------------------------------- |
| Training   | Free (first 1000 pages/month)          |
| Processing | $0.01-0.05 per page (volume discounts) |
| Storage    | Minimal (GCS pricing)                  |

For a company processing ~500 receipts/month, expect ~$5-25/month.

---

## Future Improvements

1. **Multi-language support**: Currently optimized for English/Hindi receipts
2. **Better date parsing**: Support more date formats
3. **Receipt validation**: Warn if receipt appears to be a duplicate
4. **Batch upload**: Parse multiple receipts at once
5. **ML-based categorization**: Train a model on historical expense data
6. **Confidence-based UI**: Highlight low-confidence fields for manual review
