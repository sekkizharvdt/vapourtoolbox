/**
 * Compare Receipt Parsers Cloud Function
 *
 * Runs both Google Document AI and Claude AI parsers on the same receipt
 * and returns both results for side-by-side comparison.
 *
 * This helps evaluate which parser performs better for different receipt types.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { parseReceiptWithClaude, ParsedReceiptData } from './parseReceiptWithClaude';

// Define secret for Anthropic API key
const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

// ============================================
// Types
// ============================================

interface CompareReceiptParsingRequest {
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  reportId: string;
}

interface SingleParserResult {
  success: boolean;
  error?: string;
  data?: ParsedReceiptData;
  processingTimeMs: number;
  modelUsed: string;
}

interface CompareReceiptParsingResult {
  success: boolean;
  googleDocumentAI: SingleParserResult;
  claudeAI: SingleParserResult;
  sourceFileName: string;
  sourceFileSize: number;
  totalProcessingTimeMs: number;
  attachmentId: string;
}

// ============================================
// Category Detection (from parseReceipt.ts)
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

  const confidence = bestScore > 0 ? Math.min(bestScore / 3, 1) : 0;
  return { category: bestCategory, confidence };
}

// ============================================
// GSTIN Pattern
// ============================================

const GSTIN_PATTERN = /\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}/gi;

// ============================================
// GST Extraction
// ============================================

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

  const gstinMatches = text.match(GSTIN_PATTERN);
  if (gstinMatches && gstinMatches.length > 0) {
    result.vendorGstin = gstinMatches[0].toUpperCase();
  }

  const cgstAmountMatch = text.match(/CGST\s*@?\s*\d*%?\s*:?\s*₹?\s*([\d,]+\.?\d*)/i);
  if (cgstAmountMatch) {
    result.cgstAmount = parseFloat(cgstAmountMatch[1].replace(/,/g, ''));
  }

  const cgstRateMatch = text.match(/CGST\s*@?\s*(\d+(?:\.\d+)?)\s*%/i);
  if (cgstRateMatch) {
    result.cgstRate = parseFloat(cgstRateMatch[1]);
  }

  const sgstAmountMatch = text.match(/SGST\s*@?\s*\d*%?\s*:?\s*₹?\s*([\d,]+\.?\d*)/i);
  if (sgstAmountMatch) {
    result.sgstAmount = parseFloat(sgstAmountMatch[1].replace(/,/g, ''));
  }

  const sgstRateMatch = text.match(/SGST\s*@?\s*(\d+(?:\.\d+)?)\s*%/i);
  if (sgstRateMatch) {
    result.sgstRate = parseFloat(sgstRateMatch[1]);
  }

  const igstAmountMatch = text.match(/IGST\s*@?\s*\d*%?\s*:?\s*₹?\s*([\d,]+\.?\d*)/i);
  if (igstAmountMatch) {
    result.igstAmount = parseFloat(igstAmountMatch[1].replace(/,/g, ''));
  }

  const igstRateMatch = text.match(/IGST\s*@?\s*(\d+(?:\.\d+)?)\s*%/i);
  if (igstRateMatch) {
    result.igstRate = parseFloat(igstRateMatch[1]);
  }

  if (result.cgstAmount || result.sgstAmount || result.igstAmount) {
    result.gstAmount =
      (result.cgstAmount || 0) + (result.sgstAmount || 0) + (result.igstAmount || 0);
  }

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
  /(?:grand\s*total|amount\s*paid|final\s*amount|total\s*payable)\s*:?\s*₹?\s*([\d,]+\.?\d*)/i,
  /(?:you\s*paid|paid\s*amount|payment)\s*:?\s*₹?\s*([\d,]+\.?\d*)/i,
  /(?:total|net\s*amount|amount\s*payable|bill\s*amount)\s*:?\s*₹?\s*([\d,]+\.?\d*)/i,
  /₹\s*([\d,]+\.?\d*)\s*(?:total|only)/i,
  /(?:rs\.?|inr)\s*([\d,]+\.?\d*)/i,
];

const EXCLUDE_AMOUNT_PATTERNS = [
  /(?:sub\s*total|subtotal|base\s*amount|taxable\s*value|before\s*tax)\s*:?\s*₹?\s*([\d,]+\.?\d*)/i,
];

function extractAmounts(text: string): { totalAmount?: number; taxableAmount?: number } {
  let totalAmount: number | undefined;
  let taxableAmount: number | undefined;
  const excludedAmounts = new Set<number>();

  for (const pattern of EXCLUDE_AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount > 0) {
        excludedAmounts.add(amount);
        taxableAmount = amount;
      }
    }
  }

  for (const pattern of TOTAL_AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount > 0 && !excludedAmounts.has(amount)) {
        totalAmount = amount;
        break;
      }
    }
  }

  if (!totalAmount && taxableAmount) {
    const allAmounts = text.match(/₹?\s*([\d,]+\.?\d*)/g) || [];
    for (const amountStr of allAmounts) {
      const amount = parseFloat(amountStr.replace(/[₹,\s]/g, ''));
      if (amount > taxableAmount && !excludedAmounts.has(amount)) {
        totalAmount = amount;
        break;
      }
    }
  }

  if (!taxableAmount) {
    const taxableMatch = text.match(/(?:taxable|sub\s*total|base)\s*:?\s*₹?\s*([\d,]+\.?\d*)/i);
    if (taxableMatch) {
      taxableAmount = parseFloat(taxableMatch[1].replace(/,/g, ''));
    }
  }

  return { totalAmount, taxableAmount };
}

// ============================================
// Invoice Details Extraction
// ============================================

function extractInvoiceDetails(text: string): {
  invoiceNumber?: string;
  transactionDate?: string;
  vendorName?: string;
} {
  const result: ReturnType<typeof extractInvoiceDetails> = {};

  // Invoice patterns
  const invoicePatterns = [
    /pnr\s*(?:no\.?|number|#)?\s*:?\s*([A-Z0-9]{6,10})/i,
    /(?:confirmation|booking)\s*(?:no\.?|number|#|id)?\s*:?\s*([A-Z0-9\-]+)/i,
    /(?:invoice|bill|receipt)\s*(?:no\.?|number|#)\s*:?\s*([A-Z0-9\-\/]+)/i,
    /(?:trip|order|ride)\s*(?:id|#)\s*:?\s*([A-Za-z0-9\-]+)/i,
    /ticket\s*(?:no\.?|number|#)\s*:?\s*([0-9\-]+)/i,
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
    /(?:date|dated|trip\s*date|check[\-\s]?in|booking\s*date)\s*:?\s*(\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})/i,
    /(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]+\d{2,4})/i,
    /(\d{4}[\-\/]\d{2}[\-\/]\d{2})/,
    /(\d{1,2}[\-\/]\d{1,2}[\-\/]\d{2,4})/,
  ];
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.transactionDate = match[1].trim();
      break;
    }
  }

  // Vendor name from first lines
  const lines = text.split('\n').filter((l) => l.trim());
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    if (
      line.length > 3 &&
      line.length < 100 &&
      !/^(tax|invoice|receipt|bill|gst|cash|original|duplicate)/i.test(line) &&
      !/^\d/.test(line) &&
      !/^(date|gstin|address)/i.test(line)
    ) {
      result.vendorName = line;
      break;
    }
  }

  return result;
}

// ============================================
// Google Document AI Processing
// ============================================

async function processWithGoogleDocumentAI(
  fileContent: Buffer,
  mimeType: string,
  companyGstin: string | null
): Promise<ParsedReceiptData> {
  const startTime = Date.now();

  const client = new DocumentProcessorServiceClient();
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  const processorId =
    process.env.DOCUMENT_AI_EXPENSE_PROCESSOR_ID || process.env.DOCUMENT_AI_PROCESSOR_ID;

  if (!processorId) {
    throw new Error('Document AI processor not configured');
  }

  const processorLocation = process.env.DOCUMENT_AI_LOCATION || 'us';
  const processorVersion = process.env.DOCUMENT_AI_EXPENSE_PROCESSOR_VERSION;

  const processorName = processorVersion
    ? `projects/${projectId}/locations/${processorLocation}/processors/${processorId}/processorVersions/${processorVersion}`
    : `projects/${projectId}/locations/${processorLocation}/processors/${processorId}`;

  const request = {
    name: processorName,
    rawDocument: {
      content: fileContent.toString('base64'),
      mimeType,
    },
  };

  logger.info('[Google Document AI] Processing receipt', { processorName, mimeType });

  const [result] = await client.processDocument(request);
  const document = result.document;

  if (!document || !document.text) {
    throw new Error('Document AI returned empty response');
  }

  const fullText = document.text;

  // Extract using regex patterns
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

  // Calculate confidence
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
    gstAmount: gstInfo.gstAmount,
    gstRate: gstInfo.gstRate,
    cgstAmount: gstInfo.cgstAmount,
    cgstRate: gstInfo.cgstRate,
    sgstAmount: gstInfo.sgstAmount,
    sgstRate: gstInfo.sgstRate,
    igstAmount: gstInfo.igstAmount,
    igstRate: gstInfo.igstRate,
    vendorGstin: gstInfo.vendorGstin,
    companyGstinFound,
    companyGstinOnReceipt,
    suggestedCategory: categoryInfo.category,
    categoryConfidence: categoryInfo.confidence,
    confidence,
    rawText: fullText.substring(0, 2000),
    processingTimeMs,
  };
}

// ============================================
// Cloud Function
// ============================================

export const compareReceiptParsers = onCall(
  {
    region: 'asia-south1',
    memory: '1GiB',
    timeoutSeconds: 180,
    maxInstances: 10,
    secrets: [anthropicApiKey],
  },
  async (request): Promise<CompareReceiptParsingResult> => {
    const startTime = Date.now();

    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const data = request.data as CompareReceiptParsingRequest;

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

    logger.info('[Compare Receipt Parsers] Request received', {
      userId: request.auth.uid,
      fileName: data.fileName,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
    });

    try {
      // Get company GSTIN from settings
      const db = admin.firestore();
      const companyDoc = await db.doc('company/settings').get();
      const companyGstin = companyDoc.exists ? companyDoc.data()?.taxIds?.gstin : null;

      // Download file from Storage
      const bucket = admin.storage().bucket();
      const file = bucket.file(data.storagePath);

      const [exists] = await file.exists();
      if (!exists) {
        throw new HttpsError('not-found', 'File not found in storage');
      }

      const [fileContent] = await file.download();
      logger.info('[Compare Receipt Parsers] File downloaded', { size: fileContent.length });

      // Run both parsers in parallel
      const [googleResult, claudeResult] = await Promise.all([
        // Google Document AI
        processWithGoogleDocumentAI(fileContent, data.mimeType, companyGstin)
          .then(
            (result): SingleParserResult => ({
              success: true,
              data: result,
              processingTimeMs: result.processingTimeMs,
              modelUsed: 'Google Document AI (Form Parser)',
            })
          )
          .catch(
            (error): SingleParserResult => ({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              processingTimeMs: Date.now() - startTime,
              modelUsed: 'Google Document AI (Form Parser)',
            })
          ),

        // Claude AI
        parseReceiptWithClaude({
          fileContent,
          mimeType: data.mimeType,
          fileName: data.fileName,
          companyGstin,
          apiKey: anthropicApiKey.value(),
        })
          .then(
            (result): SingleParserResult => ({
              success: true,
              data: result,
              processingTimeMs: result.processingTimeMs,
              modelUsed: 'Claude claude-sonnet-4-20250514',
            })
          )
          .catch(
            (error): SingleParserResult => ({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
              processingTimeMs: Date.now() - startTime,
              modelUsed: 'Claude claude-sonnet-4-20250514',
            })
          ),
      ]);

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
        status: 'COMPLETED_COMPARISON',
        comparisonResults: {
          googleSuccess: googleResult.success,
          claudeSuccess: claudeResult.success,
          googleConfidence: googleResult.data?.confidence,
          claudeConfidence: claudeResult.data?.confidence,
        },
        processingTimeMs: Date.now() - startTime,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const totalProcessingTimeMs = Date.now() - startTime;

      logger.info('[Compare Receipt Parsers] Comparison completed', {
        jobId: jobRef.id,
        googleSuccess: googleResult.success,
        claudeSuccess: claudeResult.success,
        totalProcessingTimeMs,
      });

      return {
        success: true,
        googleDocumentAI: googleResult,
        claudeAI: claudeResult,
        sourceFileName: data.fileName,
        sourceFileSize: data.fileSize,
        totalProcessingTimeMs,
        attachmentId: jobRef.id,
      };
    } catch (error) {
      logger.error('[Compare Receipt Parsers] Comparison failed', {
        error,
        fileName: data.fileName,
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', 'Failed to compare receipt parsers');
    }
  }
);
