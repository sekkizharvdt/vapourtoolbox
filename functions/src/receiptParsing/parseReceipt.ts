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
import { getProjectId } from '../utils/getProjectId';

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

// Prioritized patterns - "grand total" and "amount paid" come first
const TOTAL_AMOUNT_PATTERNS = [
  // High priority - final amounts
  /(?:grand\s*total|amount\s*paid|final\s*amount|total\s*payable)\s*:?\s*₹?\s*([\d,]+\.?\d*)/i,
  /(?:you\s*paid|paid\s*amount|payment)\s*:?\s*₹?\s*([\d,]+\.?\d*)/i,
  // Medium priority - general totals
  /(?:total|net\s*amount|amount\s*payable|bill\s*amount)\s*:?\s*₹?\s*([\d,]+\.?\d*)/i,
  /₹\s*([\d,]+\.?\d*)\s*(?:total|only)/i,
  // Low priority - currency amounts (fallback)
  /(?:rs\.?|inr)\s*([\d,]+\.?\d*)/i,
];

// Patterns for amounts to EXCLUDE (sub-totals, pre-tax)
const EXCLUDE_AMOUNT_PATTERNS = [
  /(?:sub\s*total|subtotal|base\s*amount|taxable\s*value|before\s*tax)\s*:?\s*₹?\s*([\d,]+\.?\d*)/i,
];

function extractAmounts(text: string): { totalAmount?: number; taxableAmount?: number } {
  let totalAmount: number | undefined;
  let taxableAmount: number | undefined;
  const excludedAmounts = new Set<number>();

  // First, identify amounts to exclude (sub-totals)
  for (const pattern of EXCLUDE_AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      if (amount > 0) {
        excludedAmounts.add(amount);
        taxableAmount = amount; // This is likely the taxable amount
      }
    }
  }

  // Find total amount using prioritized patterns
  for (const pattern of TOTAL_AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseFloat(match[1].replace(/,/g, ''));
      // Only accept if positive and not in excluded list
      if (amount > 0 && !excludedAmounts.has(amount)) {
        totalAmount = amount;
        break; // Use first match from prioritized list
      }
    }
  }

  // If no total found but we have taxable amount, look for it differently
  if (!totalAmount && taxableAmount) {
    // Try to find any amount larger than taxable (likely includes tax)
    const allAmounts = text.match(/₹?\s*([\d,]+\.?\d*)/g) || [];
    for (const amountStr of allAmounts) {
      const amount = parseFloat(amountStr.replace(/[₹,\s]/g, ''));
      if (amount > taxableAmount && !excludedAmounts.has(amount)) {
        totalAmount = amount;
        break;
      }
    }
  }

  // Fallback: if still no taxable amount, try to extract it
  if (!taxableAmount) {
    const taxableMatch = text.match(/(?:taxable|sub\s*total|base)\s*:?\s*₹?\s*([\d,]+\.?\d*)/i);
    if (taxableMatch) {
      taxableAmount = parseFloat(taxableMatch[1].replace(/,/g, ''));
    }
  }

  return { totalAmount, taxableAmount };
}

// ============================================
// Invoice/Receipt Details
// ============================================

// Known vendor patterns for better extraction
const VENDOR_SPECIFIC_PATTERNS: Record<
  string,
  { invoicePatterns: RegExp[]; vendorName: string; category: string }
> = {
  uber: {
    invoicePatterns: [
      /trip\s*(?:id|#)\s*:?\s*([A-Za-z0-9\-]+)/i,
      /uber\s*(?:trip|ride)\s*(?:id|#)?\s*:?\s*([A-Za-z0-9\-]+)/i,
    ],
    vendorName: 'Uber',
    category: 'LOCAL_CONVEYANCE',
  },
  ola: {
    invoicePatterns: [
      /(?:crn|booking\s*id|ride\s*id)\s*:?\s*([A-Za-z0-9\-]+)/i,
      /ola\s*(?:booking|ride)\s*:?\s*([A-Za-z0-9\-]+)/i,
    ],
    vendorName: 'Ola',
    category: 'LOCAL_CONVEYANCE',
  },
  indigo: {
    invoicePatterns: [
      /pnr\s*:?\s*([A-Z0-9]{6})/i,
      /booking\s*(?:ref|reference)\s*:?\s*([A-Z0-9]+)/i,
    ],
    vendorName: 'IndiGo',
    category: 'TRAVEL',
  },
  spicejet: {
    invoicePatterns: [
      /pnr\s*:?\s*([A-Z0-9]{6})/i,
      /booking\s*(?:ref|reference)\s*:?\s*([A-Z0-9]+)/i,
    ],
    vendorName: 'SpiceJet',
    category: 'TRAVEL',
  },
  airindia: {
    invoicePatterns: [/pnr\s*:?\s*([A-Z0-9]{6})/i, /ticket\s*(?:no|number)\s*:?\s*([0-9\-]+)/i],
    vendorName: 'Air India',
    category: 'TRAVEL',
  },
  vistara: {
    invoicePatterns: [
      /pnr\s*:?\s*([A-Z0-9]{6})/i,
      /booking\s*(?:ref|reference)\s*:?\s*([A-Z0-9]+)/i,
    ],
    vendorName: 'Vistara',
    category: 'TRAVEL',
  },
  irctc: {
    invoicePatterns: [/pnr\s*:?\s*(\d{10})/i, /ticket\s*(?:no|number)\s*:?\s*(\d+)/i],
    vendorName: 'IRCTC',
    category: 'TRAVEL',
  },
  oyo: {
    invoicePatterns: [
      /(?:booking\s*id|confirmation)\s*:?\s*([A-Z0-9]+)/i,
      /oyo\s*(?:booking|id)\s*:?\s*([A-Z0-9]+)/i,
    ],
    vendorName: 'OYO',
    category: 'ACCOMMODATION',
  },
  makemytrip: {
    invoicePatterns: [/booking\s*id\s*:?\s*([A-Z0-9]+)/i, /trip\s*id\s*:?\s*([A-Z0-9]+)/i],
    vendorName: 'MakeMyTrip',
    category: 'TRAVEL',
  },
  swiggy: {
    invoicePatterns: [/order\s*(?:id|#)\s*:?\s*([A-Za-z0-9\-]+)/i],
    vendorName: 'Swiggy',
    category: 'FOOD',
  },
  zomato: {
    invoicePatterns: [/order\s*(?:id|#)\s*:?\s*([A-Za-z0-9\-]+)/i],
    vendorName: 'Zomato',
    category: 'FOOD',
  },
};

function extractInvoiceDetails(text: string): {
  invoiceNumber?: string;
  transactionDate?: string;
  vendorName?: string;
  detectedVendorType?: string;
} {
  const result: ReturnType<typeof extractInvoiceDetails> = {};
  const lowerText = text.toLowerCase();

  // First, try to detect known vendors
  for (const [vendorKey, config] of Object.entries(VENDOR_SPECIFIC_PATTERNS)) {
    if (lowerText.includes(vendorKey)) {
      result.vendorName = config.vendorName;
      result.detectedVendorType = vendorKey;

      // Use vendor-specific invoice patterns
      for (const pattern of config.invoicePatterns) {
        const match = text.match(pattern);
        if (match) {
          result.invoiceNumber = match[1].trim().toUpperCase();
          break;
        }
      }
      break;
    }
  }

  // If no vendor-specific match, use generic patterns
  if (!result.invoiceNumber) {
    const invoicePatterns = [
      // Airline/Train PNR
      /pnr\s*(?:no\.?|number|#)?\s*:?\s*([A-Z0-9]{6,10})/i,
      // Hotel/Booking confirmation
      /(?:confirmation|booking)\s*(?:no\.?|number|#|id)?\s*:?\s*([A-Z0-9\-]+)/i,
      // Standard invoice
      /(?:invoice|bill|receipt)\s*(?:no\.?|number|#)\s*:?\s*([A-Z0-9\-\/]+)/i,
      /(?:inv|rcpt)\s*:?\s*([A-Z0-9\-\/]+)/i,
      // Trip/Order ID
      /(?:trip|order|ride)\s*(?:id|#)\s*:?\s*([A-Za-z0-9\-]+)/i,
      // Folio (hotels)
      /folio\s*(?:no\.?|number|#)?\s*:?\s*([A-Z0-9\-]+)/i,
      // Ticket number
      /ticket\s*(?:no\.?|number|#)\s*:?\s*([0-9\-]+)/i,
    ];
    for (const pattern of invoicePatterns) {
      const match = text.match(pattern);
      if (match) {
        result.invoiceNumber = match[1].trim();
        break;
      }
    }
  }

  // Date patterns - expanded for more formats
  const datePatterns = [
    // Explicit date labels
    /(?:date|dated|trip\s*date|check[\-\s]?in|booking\s*date)\s*:?\s*(\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})/i,
    // Month name formats
    /(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s,]+\d{2,4})/i,
    /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})[\s,]+(\d{2,4})/i,
    // ISO format
    /(\d{4}[\-\/]\d{2}[\-\/]\d{2})/,
    // Generic date
    /(\d{1,2}[\-\/]\d{1,2}[\-\/]\d{2,4})/,
  ];
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      result.transactionDate = match[1].trim();
      break;
    }
  }

  // If no vendor detected yet, extract from first lines
  if (!result.vendorName) {
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length > 0) {
      // Skip common headers like "TAX INVOICE", "RECEIPT"
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
    }
  }

  return result;
}

// ============================================
// Main Processing Function
// ============================================

/**
 * Parse currency string to number
 */
function parseCurrency(value: string): number | undefined {
  if (!value) return undefined;
  // Remove currency symbols, spaces, and commas
  const cleaned = value.replace(/[₹$,\s]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

/**
 * Extract data from Document AI entities (for custom-trained processors)
 */
function extractFromEntities(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entities: any[]
): Partial<ParsedReceiptData> {
  const result: Partial<ParsedReceiptData> = {};

  for (const entity of entities) {
    const value = entity.mentionText || '';
    const confidence = entity.confidence || 0;
    const type = entity.type || '';

    // Only use high-confidence extractions
    if (confidence < 0.6) continue;

    switch (type) {
      case 'total_amount':
      case 'grand_total':
      case 'amount_paid':
        result.totalAmount = parseCurrency(value);
        break;

      case 'taxable_amount':
      case 'sub_total':
      case 'base_amount':
        result.taxableAmount = parseCurrency(value);
        break;

      case 'invoice_number':
      case 'receipt_number':
      case 'trip_id':
      case 'pnr_number':
      case 'booking_reference':
      case 'order_id':
        result.invoiceNumber = value.trim();
        break;

      case 'vendor_name':
      case 'supplier_name':
      case 'merchant_name':
        result.vendorName = value.trim();
        break;

      case 'transaction_date':
      case 'invoice_date':
      case 'receipt_date':
        result.transactionDate = value.trim();
        break;

      case 'cgst_amount':
        result.cgstAmount = parseCurrency(value);
        break;

      case 'sgst_amount':
        result.sgstAmount = parseCurrency(value);
        break;

      case 'igst_amount':
        result.igstAmount = parseCurrency(value);
        break;

      case 'gst_rate':
      case 'tax_rate':
        result.gstRate = parseFloat(value.replace(/[%\s]/g, ''));
        break;

      case 'vendor_gstin':
      case 'supplier_gstin':
        result.vendorGstin = value.toUpperCase().trim();
        break;

      case 'buyer_gstin':
      case 'customer_gstin':
        // This would be company's GSTIN - handled separately
        break;
    }
  }

  // Calculate total GST if components are available
  if (result.cgstAmount || result.sgstAmount || result.igstAmount) {
    result.gstAmount =
      (result.cgstAmount || 0) + (result.sgstAmount || 0) + (result.igstAmount || 0);
  }

  return result;
}

async function processReceiptWithDocumentAI(
  fileContent: Buffer,
  mimeType: string,
  companyGstin: string | null
): Promise<ParsedReceiptData> {
  const startTime = Date.now();

  // Initialize Document AI client
  const client = new DocumentProcessorServiceClient();
  const projectId = getProjectId();
  const processorId =
    process.env.DOCUMENT_AI_EXPENSE_PROCESSOR_ID || process.env.DOCUMENT_AI_PROCESSOR_ID;

  if (!processorId) {
    throw new HttpsError('failed-precondition', 'Document AI processor not configured');
  }

  const processorLocation = process.env.DOCUMENT_AI_LOCATION || 'us';
  const processorVersion = process.env.DOCUMENT_AI_EXPENSE_PROCESSOR_VERSION;

  const processorName = processorVersion
    ? `projects/${projectId}/locations/${processorLocation}/processors/${processorId}/processorVersions/${processorVersion}`
    : `projects/${projectId}/locations/${processorLocation}/processors/${processorId}`;

  // Process document
  const request = {
    name: processorName,
    rawDocument: {
      content: fileContent.toString('base64'),
      mimeType,
    },
  };

  logger.info('Processing receipt with Document AI', {
    processorName,
    projectId,
    processorId,
    processorLocation,
    mimeType,
    fileSize: fileContent.length,
    hasVersion: !!processorVersion,
  });

  const [result] = await client.processDocument(request);
  const document = result.document;

  if (!document || !document.text) {
    throw new HttpsError('internal', 'Document AI returned empty response');
  }

  const fullText = document.text;
  logger.info('Receipt text extracted', {
    textLength: fullText.length,
    entityCount: document.entities?.length || 0,
  });

  // First, try to extract from Document AI entities (custom-trained processors)
  let entityData: Partial<ParsedReceiptData> = {};
  if (document.entities && document.entities.length > 0) {
    entityData = extractFromEntities(document.entities);
    logger.info('Extracted from Document AI entities', {
      hasTotal: !!entityData.totalAmount,
      hasVendor: !!entityData.vendorName,
      hasInvoice: !!entityData.invoiceNumber,
    });
  }

  // Fall back to regex extraction for any missing fields
  const invoiceDetails = extractInvoiceDetails(fullText);
  const amounts = extractAmounts(fullText);
  const gstInfo = extractGSTInfo(fullText);
  const categoryInfo = detectCategory(fullText);

  // Use vendor-specific category if detected
  let suggestedCategory = categoryInfo.category;
  if (
    invoiceDetails.detectedVendorType &&
    VENDOR_SPECIFIC_PATTERNS[invoiceDetails.detectedVendorType]
  ) {
    suggestedCategory = VENDOR_SPECIFIC_PATTERNS[invoiceDetails.detectedVendorType].category;
  }

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

  // Merge entity data with regex data (entity data takes precedence)
  const finalTotalAmount = entityData.totalAmount ?? amounts.totalAmount;
  const finalTaxableAmount = entityData.taxableAmount ?? amounts.taxableAmount;
  const finalVendorName = entityData.vendorName ?? invoiceDetails.vendorName;
  const finalInvoiceNumber = entityData.invoiceNumber ?? invoiceDetails.invoiceNumber;
  const finalTransactionDate = entityData.transactionDate ?? invoiceDetails.transactionDate;

  // Calculate confidence based on what was extracted
  let confidence = 0;
  if (finalTotalAmount) confidence += 0.3;
  if (finalVendorName) confidence += 0.2;
  if (finalInvoiceNumber) confidence += 0.1;
  if (finalTransactionDate) confidence += 0.1;
  if (gstInfo.gstAmount || gstInfo.vendorGstin || entityData.gstAmount) confidence += 0.2;
  if (suggestedCategory !== 'OTHER') confidence += 0.1;

  // Boost confidence if using entity extraction
  if (Object.keys(entityData).length > 2) {
    confidence = Math.min(confidence + 0.1, 1.0);
  }

  const processingTimeMs = Date.now() - startTime;

  return {
    vendorName: finalVendorName,
    invoiceNumber: finalInvoiceNumber,
    transactionDate: finalTransactionDate,
    totalAmount: finalTotalAmount,
    taxableAmount: finalTaxableAmount,
    currency: 'INR',
    // GST info: prefer entity data, fall back to regex
    gstAmount: entityData.gstAmount ?? gstInfo.gstAmount,
    gstRate: entityData.gstRate ?? gstInfo.gstRate,
    cgstAmount: entityData.cgstAmount ?? gstInfo.cgstAmount,
    cgstRate: gstInfo.cgstRate,
    sgstAmount: entityData.sgstAmount ?? gstInfo.sgstAmount,
    sgstRate: gstInfo.sgstRate,
    igstAmount: entityData.igstAmount ?? gstInfo.igstAmount,
    igstRate: gstInfo.igstRate,
    vendorGstin: entityData.vendorGstin ?? gstInfo.vendorGstin,
    companyGstinFound,
    companyGstinOnReceipt,
    suggestedCategory,
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
