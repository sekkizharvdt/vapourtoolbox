/**
 * Receipt Parsing Cloud Function
 *
 * Uses Google Cloud Document AI to parse receipt images/PDFs and extract
 * structured data for travel expense items.
 *
 * Flow:
 * 1. User uploads receipt to Firebase Storage
 * 2. Frontend calls this function with storage path
 * 3. Function downloads file, sends to Document AI
 * 4. Document AI extracts text and entities
 * 5. Function processes extracted data and checks for company GSTIN
 * 6. Returns structured data for expense item creation
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

// ============================================
// Types
// ============================================

interface ReceiptParsingRequest {
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  reportId: string;
}

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
  cgstRate?: number;
  sgstAmount?: number;
  sgstRate?: number;
  igstAmount?: number;
  igstRate?: number;

  // GSTIN
  vendorGstin?: string;
  companyGstinFound: boolean;
  companyGstinOnReceipt?: string;

  // Categorization
  suggestedCategory?: string;
  categoryConfidence?: number;

  // Metadata
  confidence: number;
  rawText?: string;
  processingTimeMs: number;
}

interface ReceiptParsingResult {
  success: boolean;
  data?: ParsedReceiptData;
  error?: string;
  attachmentId: string;
  fileName: string;
}

// ============================================
// Category Detection
// ============================================

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  TRAVEL: [
    'airline',
    'airways',
    'flight',
    'airport',
    'aviation',
    'railway',
    'train',
    'irctc',
    'rail',
    'bus',
    'travels',
    'transport',
    'redbus',
    'abhibus',
    'boarding pass',
    'ticket',
    'pnr',
  ],
  ACCOMMODATION: [
    'hotel',
    'resort',
    'inn',
    'lodge',
    'motel',
    'oyo',
    'fab',
    'treebo',
    'ginger',
    'room',
    'accommodation',
    'stay',
    'check-in',
    'check-out',
  ],
  LOCAL_CONVEYANCE: [
    'uber',
    'ola',
    'rapido',
    'auto',
    'taxi',
    'cab',
    'metro',
    'local',
    'parking',
    'toll',
  ],
  FOOD: [
    'restaurant',
    'cafe',
    'food',
    'meal',
    'swiggy',
    'zomato',
    'dominos',
    'pizza',
    'burger',
    'breakfast',
    'lunch',
    'dinner',
    'snack',
    'canteen',
    'mess',
  ],
};

function detectCategory(text: string): { category: string; confidence: number } {
  const lowerText = text.toLowerCase();
  let bestCategory = 'OTHER';
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  // Confidence based on number of matching keywords
  const confidence = bestScore > 0 ? Math.min(bestScore / 3, 1) : 0;
  return { category: bestCategory, confidence };
}

// ============================================
// GST Pattern Detection
// ============================================

// GSTIN format: 2 digit state code + 10 char PAN + 1 entity number + 1 Z + 1 checksum
const GSTIN_PATTERN = /\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}/gi;

// Note: GST amounts and rates are extracted inline using specific patterns
// for CGST, SGST, IGST in the extractGSTInfo function below

function extractGSTInfo(text: string): {
  gstAmount?: number;
  gstRate?: number;
  cgstAmount?: number;
  cgstRate?: number;
  sgstAmount?: number;
  sgstRate?: number;
  igstAmount?: number;
  igstRate?: number;
  vendorGstin?: string;
} {
  const result: ReturnType<typeof extractGSTInfo> = {};

  // Find all GSTINs
  const gstinMatches = text.match(GSTIN_PATTERN);
  if (gstinMatches && gstinMatches.length > 0) {
    // First GSTIN is usually vendor's
    result.vendorGstin = gstinMatches[0].toUpperCase();
  }

  // Extract CGST amount
  const cgstAmountMatch = text.match(/CGST\s*@?\s*\d*%?\s*:?\s*₹?\s*([\d,]+\.?\d*)/i);
  if (cgstAmountMatch) {
    result.cgstAmount = parseFloat(cgstAmountMatch[1].replace(/,/g, ''));
  }

  // Extract CGST rate
  const cgstRateMatch = text.match(/CGST\s*@?\s*(\d+(?:\.\d+)?)\s*%/i);
  if (cgstRateMatch) {
    result.cgstRate = parseFloat(cgstRateMatch[1]);
  }

  // Extract SGST amount
  const sgstAmountMatch = text.match(/SGST\s*@?\s*\d*%?\s*:?\s*₹?\s*([\d,]+\.?\d*)/i);
  if (sgstAmountMatch) {
    result.sgstAmount = parseFloat(sgstAmountMatch[1].replace(/,/g, ''));
  }

  // Extract SGST rate
  const sgstRateMatch = text.match(/SGST\s*@?\s*(\d+(?:\.\d+)?)\s*%/i);
  if (sgstRateMatch) {
    result.sgstRate = parseFloat(sgstRateMatch[1]);
  }

  // Extract IGST amount
  const igstAmountMatch = text.match(/IGST\s*@?\s*\d*%?\s*:?\s*₹?\s*([\d,]+\.?\d*)/i);
  if (igstAmountMatch) {
    result.igstAmount = parseFloat(igstAmountMatch[1].replace(/,/g, ''));
  }

  // Extract IGST rate
  const igstRateMatch = text.match(/IGST\s*@?\s*(\d+(?:\.\d+)?)\s*%/i);
  if (igstRateMatch) {
    result.igstRate = parseFloat(igstRateMatch[1]);
  }

  // Calculate total GST
  if (result.cgstAmount || result.sgstAmount || result.igstAmount) {
    result.gstAmount =
      (result.cgstAmount || 0) + (result.sgstAmount || 0) + (result.igstAmount || 0);
  }

  // Calculate total GST rate
  if (result.cgstRate && result.sgstRate) {
    result.gstRate = result.cgstRate + result.sgstRate;
  } else if (result.igstRate) {
    result.gstRate = result.igstRate;
  }

  return result;
}

// ============================================
// Amount Extraction
// ============================================

const TOTAL_AMOUNT_PATTERNS = [
  /(?:total|grand\s*total|net\s*amount|amount\s*payable|bill\s*amount)\s*:?\s*₹?\s*([\d,]+\.?\d*)/i,
  /₹\s*([\d,]+\.?\d*)\s*(?:total|only)/i,
  /(?:rs\.?|inr)\s*([\d,]+\.?\d*)/i,
];

function extractAmounts(text: string): { totalAmount?: number; taxableAmount?: number } {
  let totalAmount: number | undefined;
  let taxableAmount: number | undefined;

  // Find total amount
  for (const pattern of TOTAL_AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount > 0 && (!totalAmount || amount > totalAmount)) {
        totalAmount = amount;
      }
    }
  }

  // Find taxable amount
  const taxableMatch = text.match(/(?:taxable|sub\s*total|base)\s*:?\s*₹?\s*([\d,]+\.?\d*)/i);
  if (taxableMatch) {
    taxableAmount = parseFloat(taxableMatch[1].replace(/,/g, ''));
  }

  return { totalAmount, taxableAmount };
}

// ============================================
// Invoice/Receipt Details
// ============================================

function extractInvoiceDetails(text: string): {
  invoiceNumber?: string;
  transactionDate?: string;
  vendorName?: string;
} {
  const result: ReturnType<typeof extractInvoiceDetails> = {};

  // Invoice number patterns
  const invoicePatterns = [
    /(?:invoice|bill|receipt)\s*(?:no\.?|number|#)\s*:?\s*([A-Z0-9\-\/]+)/i,
    /(?:inv|rcpt)\s*:?\s*([A-Z0-9\-\/]+)/i,
  ];
  for (const pattern of invoicePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.invoiceNumber = match[1].trim();
      break;
    }
  }

  // Date patterns
  const datePatterns = [
    /(?:date|dated)\s*:?\s*(\d{1,2}[\-\/]\d{1,2}[\-\/]\d{2,4})/i,
    /(\d{1,2}[\-\/]\d{1,2}[\-\/]\d{2,4})/,
    /(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})/i,
  ];
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.transactionDate = match[1].trim();
      break;
    }
  }

  // Vendor name - usually in first few lines
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length > 0) {
    // Skip common headers like "TAX INVOICE", "RECEIPT"
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      if (
        line.length > 3 &&
        line.length < 100 &&
        !/^(tax|invoice|receipt|bill|gst|cash)/i.test(line) &&
        !/^\d/.test(line)
      ) {
        result.vendorName = line;
        break;
      }
    }
  }

  return result;
}

// ============================================
// Main Processing Function
// ============================================

async function processReceiptWithDocumentAI(
  fileContent: Buffer,
  mimeType: string,
  companyGstin: string | null
): Promise<ParsedReceiptData> {
  const startTime = Date.now();

  // Initialize Document AI client
  const client = new DocumentProcessorServiceClient();
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  const processorId =
    process.env.DOCUMENT_AI_EXPENSE_PROCESSOR_ID || process.env.DOCUMENT_AI_PROCESSOR_ID;

  if (!processorId) {
    throw new HttpsError('failed-precondition', 'Document AI processor not configured');
  }

  const processorName = `projects/${projectId}/locations/us/processors/${processorId}`;

  // Process document
  const request = {
    name: processorName,
    rawDocument: {
      content: fileContent.toString('base64'),
      mimeType,
    },
  };

  logger.info('Processing receipt with Document AI', { processorName, mimeType });

  const [result] = await client.processDocument(request);
  const document = result.document;

  if (!document || !document.text) {
    throw new HttpsError('internal', 'Document AI returned empty response');
  }

  const fullText = document.text;
  logger.info('Receipt text extracted', { textLength: fullText.length });

  // Extract all information
  const invoiceDetails = extractInvoiceDetails(fullText);
  const amounts = extractAmounts(fullText);
  const gstInfo = extractGSTInfo(fullText);
  const categoryInfo = detectCategory(fullText);

  // Check for company GSTIN
  let companyGstinFound = false;
  let companyGstinOnReceipt: string | undefined;

  if (companyGstin) {
    const normalizedCompanyGstin = companyGstin.toUpperCase().replace(/\s/g, '');
    const gstinMatches = fullText.match(GSTIN_PATTERN);
    if (gstinMatches) {
      for (const match of gstinMatches) {
        if (match.toUpperCase() === normalizedCompanyGstin) {
          companyGstinFound = true;
          companyGstinOnReceipt = match.toUpperCase();
          break;
        }
      }
    }
  }

  // Calculate confidence based on what was extracted
  let confidence = 0;
  if (amounts.totalAmount) confidence += 0.3;
  if (invoiceDetails.vendorName) confidence += 0.2;
  if (invoiceDetails.invoiceNumber) confidence += 0.1;
  if (invoiceDetails.transactionDate) confidence += 0.1;
  if (gstInfo.gstAmount || gstInfo.vendorGstin) confidence += 0.2;
  if (categoryInfo.category !== 'OTHER') confidence += 0.1;

  const processingTimeMs = Date.now() - startTime;

  return {
    vendorName: invoiceDetails.vendorName,
    invoiceNumber: invoiceDetails.invoiceNumber,
    transactionDate: invoiceDetails.transactionDate,
    totalAmount: amounts.totalAmount,
    taxableAmount: amounts.taxableAmount,
    currency: 'INR',
    ...gstInfo,
    companyGstinFound,
    companyGstinOnReceipt,
    suggestedCategory: categoryInfo.category,
    categoryConfidence: categoryInfo.confidence,
    confidence,
    rawText: fullText.substring(0, 2000), // Truncate for storage
    processingTimeMs,
  };
}

// ============================================
// Cloud Function
// ============================================

export const parseReceiptForExpense = onCall(
  {
    region: 'asia-south1',
    memory: '512MiB',
    timeoutSeconds: 120,
    maxInstances: 20,
  },
  async (request): Promise<ReceiptParsingResult> => {
    const startTime = Date.now();

    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const data = request.data as ReceiptParsingRequest;

    // Validate request
    if (!data.storagePath || !data.fileName || !data.mimeType) {
      throw new HttpsError('invalid-argument', 'Missing required fields');
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(data.mimeType)) {
      throw new HttpsError('invalid-argument', `Unsupported file type: ${data.mimeType}`);
    }

    // Validate file size (5MB max)
    if (data.fileSize > 5 * 1024 * 1024) {
      throw new HttpsError('invalid-argument', 'File size exceeds 5MB limit');
    }

    logger.info('Receipt parsing request', {
      userId: request.auth.uid,
      fileName: data.fileName,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
      reportId: data.reportId,
    });

    try {
      // Get company GSTIN from settings
      const db = admin.firestore();
      const companyDoc = await db.doc('company/settings').get();
      const companyGstin = companyDoc.exists ? companyDoc.data()?.taxIds?.gstin : null;

      logger.info('Company GSTIN', { hasGstin: !!companyGstin });

      // Download file from Storage
      const bucket = admin.storage().bucket();
      const file = bucket.file(data.storagePath);

      const [exists] = await file.exists();
      if (!exists) {
        throw new HttpsError('not-found', 'File not found in storage');
      }

      const [fileContent] = await file.download();
      logger.info('File downloaded', { size: fileContent.length });

      // Process with Document AI
      const parsedData = await processReceiptWithDocumentAI(
        fileContent,
        data.mimeType,
        companyGstin
      );

      // Create parsing job record for audit
      const jobRef = db.collection('receiptParsingJobs').doc();
      await jobRef.set({
        id: jobRef.id,
        userId: request.auth.uid,
        reportId: data.reportId,
        fileName: data.fileName,
        storagePath: data.storagePath,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        status: 'COMPLETED',
        parsedData: {
          vendorName: parsedData.vendorName,
          totalAmount: parsedData.totalAmount,
          gstAmount: parsedData.gstAmount,
          companyGstinFound: parsedData.companyGstinFound,
          suggestedCategory: parsedData.suggestedCategory,
          confidence: parsedData.confidence,
        },
        processingTimeMs: parsedData.processingTimeMs,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info('Receipt parsing completed', {
        jobId: jobRef.id,
        confidence: parsedData.confidence,
        totalAmount: parsedData.totalAmount,
        companyGstinFound: parsedData.companyGstinFound,
        processingTimeMs: parsedData.processingTimeMs,
      });

      return {
        success: true,
        data: parsedData,
        attachmentId: jobRef.id,
        fileName: data.fileName,
      };
    } catch (error) {
      logger.error('Receipt parsing failed', { error, fileName: data.fileName });

      // Create failed job record
      const db = admin.firestore();
      const jobRef = db.collection('receiptParsingJobs').doc();
      await jobRef.set({
        id: jobRef.id,
        userId: request.auth.uid,
        reportId: data.reportId,
        fileName: data.fileName,
        storagePath: data.storagePath,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: Date.now() - startTime,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', 'Failed to parse receipt');
    }
  }
);
