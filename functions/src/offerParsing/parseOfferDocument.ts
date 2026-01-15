/**
 * Offer Document Parsing Cloud Function
 *
 * Uses Google Cloud Document AI to parse vendor offer PDF files and extract
 * structured pricing data for comparison against RFQ items.
 *
 * Flow:
 * 1. User uploads vendor offer document to Firebase Storage
 * 2. Frontend calls this function with storage path and RFQ context
 * 3. Function downloads file, sends to Document AI
 * 4. Document AI extracts text and tables
 * 5. Function processes extracted data into offer items with pricing
 * 6. Function matches extracted items to RFQ items
 * 7. Returns structured data for offer creation
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

// Types for offer parsing
interface RFQItemContext {
  id: string;
  lineNumber: number;
  description: string;
  quantity: number;
  unit: string;
}

interface OfferParsingRequest {
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  rfqId: string;
  rfqNumber: string;
  vendorId: string;
  vendorName: string;
  rfqItems: RFQItemContext[];
}

interface ParsedOfferItem {
  lineNumber: number;
  matchedRfqItemId?: string;
  matchConfidence: number;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
  gstRate?: number;
  gstAmount?: number;
  deliveryPeriod?: string;
  makeModel?: string;
  meetsSpec: boolean;
  deviations?: string;
  vendorNotes?: string;
  confidence: {
    description: number;
    unitPrice: number;
    quantity: number;
    overall: number;
  };
  sourceText?: string;
}

interface ParsedOfferHeader {
  vendorOfferNumber?: string;
  vendorOfferDate?: string;
  validityDate?: string;
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  currency?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  warrantyTerms?: string;
  remarks?: string;
  confidence: number;
}

interface OfferParsingResult {
  success: boolean;
  header?: ParsedOfferHeader;
  items: ParsedOfferItem[];
  totalItemsFound: number;
  matchedItems: number;
  unmatchedItems: number;
  highConfidenceItems: number;
  lowConfidenceItems: number;
  calculatedSubtotal: number;
  calculatedTax: number;
  calculatedTotal: number;
  warnings?: string[];
  errors?: string[];
  processingTimeMs: number;
  modelUsed: string;
  sourceFileName: string;
  sourceFileSize: number;
  pageCount?: number;
}

// Standard units mapping
const STANDARD_UNITS: Record<string, string> = {
  nos: 'NOS',
  no: 'NOS',
  pcs: 'NOS',
  pieces: 'NOS',
  ea: 'EA',
  each: 'EA',
  unit: 'UNIT',
  units: 'UNIT',
  set: 'SET',
  sets: 'SET',
  lot: 'LOT',
  kg: 'KG',
  kgs: 'KG',
  m: 'MTR',
  mtr: 'MTR',
  meter: 'MTR',
  meters: 'MTR',
  mm: 'MM',
  cm: 'CM',
  ft: 'FT',
  l: 'LTR',
  ltr: 'LTR',
};

function normalizeUnit(unit: string): string {
  const normalized = unit.toLowerCase().trim();
  return STANDARD_UNITS[normalized] || unit.toUpperCase();
}

/**
 * Parse quantity string to number
 */
function parseQuantity(quantityStr: string): number {
  const cleaned = quantityStr.replace(/,/g, '').replace(/\s/g, '').trim();
  const parsed = parseFloat(cleaned);
  if (!isNaN(parsed) && parsed > 0) {
    return parsed;
  }
  return 0;
}

/**
 * Parse price string to number (handles currency symbols, commas)
 */
function parsePrice(priceStr: string): number {
  // Remove currency symbols (₹, $, Rs, INR, etc.) and commas
  const cleaned = priceStr
    .replace(/[₹$€£]/g, '')
    .replace(/Rs\.?/gi, '')
    .replace(/INR/gi, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim();

  const parsed = parseFloat(cleaned);
  if (!isNaN(parsed) && parsed >= 0) {
    return parsed;
  }
  return 0;
}

/**
 * Calculate string similarity using word overlap
 */
function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.8;
  }

  // Word overlap
  const words1 = new Set(s1.split(/\s+/).filter((w) => w.length > 2));
  const words2 = new Set(s2.split(/\s+/).filter((w) => w.length > 2));
  const intersection = [...words1].filter((w) => words2.has(w));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;
  return intersection.length / union.size;
}

/**
 * Match parsed items to RFQ items
 */
function matchItemsToRFQ(
  parsedItems: ParsedOfferItem[],
  rfqItems: RFQItemContext[]
): ParsedOfferItem[] {
  const matchedItems: ParsedOfferItem[] = [];
  const usedRfqItems = new Set<string>();

  for (const item of parsedItems) {
    let bestMatch: RFQItemContext | null = null;
    let bestScore = 0;

    for (const rfqItem of rfqItems) {
      if (usedRfqItems.has(rfqItem.id)) continue;

      // Calculate similarity score
      const descSimilarity = stringSimilarity(item.description, rfqItem.description);
      const lineMatch = item.lineNumber === rfqItem.lineNumber ? 0.2 : 0;
      const qtyMatch = item.quantity === rfqItem.quantity ? 0.1 : 0;

      const score = descSimilarity * 0.7 + lineMatch + qtyMatch;

      if (score > bestScore && score > 0.3) {
        bestScore = score;
        bestMatch = rfqItem;
      }
    }

    if (bestMatch) {
      usedRfqItems.add(bestMatch.id);
      matchedItems.push({
        ...item,
        matchedRfqItemId: bestMatch.id,
        matchConfidence: bestScore,
      });
    } else {
      matchedItems.push({
        ...item,
        matchConfidence: 0,
      });
    }
  }

  return matchedItems;
}

/**
 * Extract text from a table cell using text anchors
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTextFromCell(cell: any, fullText: string): string {
  const textSegments = cell.layout?.textAnchor?.textSegments || [];
  let text = '';

  for (const segment of textSegments) {
    const startIndex = Number(segment.startIndex || 0);
    const endIndex = Number(segment.endIndex || 0);
    text += fullText.substring(startIndex, endIndex);
  }

  return text.trim();
}

/**
 * Detect column mapping from header texts for offer/quotation documents
 */
function detectOfferColumnMapping(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};

  const patterns: Record<string, RegExp[]> = {
    lineNumber: [/^(s\.?\s*no|sr\.?\s*no|sl\.?\s*no|#|line|item\s*no)/i],
    description: [/^(description|item|particulars|details|material|name|product)/i],
    quantity: [/^(qty|quantity|qnty|q'ty)/i],
    unit: [/^(unit|uom|u\/m)/i],
    unitPrice: [/^(unit\s*price|rate|price|unit\s*rate|per\s*unit)/i],
    amount: [/^(amount|total|value|line\s*total|ext\s*price)/i],
    gst: [/^(gst|tax|igst|cgst|sgst|vat)/i],
    delivery: [/^(delivery|lead\s*time|eta|dispatch)/i],
    makeModel: [/^(make|model|brand|manufacturer)/i],
    remarks: [/^(remark|note|comment)/i],
  };

  headers.forEach((header, index) => {
    for (const [field, fieldPatterns] of Object.entries(patterns)) {
      if (fieldPatterns.some((pattern) => pattern.test(header))) {
        mapping[field] = index;
        break;
      }
    }
  });

  return mapping;
}

/**
 * Extract offer item from a table row
 */
function extractOfferItemFromRow(
  cells: string[],
  columnMap: Record<string, number>,
  lineNumber: number
): ParsedOfferItem | null {
  // Get description - this is required
  const descriptionIdx = columnMap.description ?? -1;
  const description = descriptionIdx >= 0 ? cells[descriptionIdx] : '';

  if (!description || description.trim().length < 3) {
    return null;
  }

  // Get quantity
  let quantity = 1;
  const quantityIdx = columnMap.quantity ?? -1;
  if (quantityIdx >= 0 && cells[quantityIdx]) {
    quantity = parseQuantity(cells[quantityIdx]) || 1;
  }

  // Get unit
  let unit = 'NOS';
  const unitIdx = columnMap.unit ?? -1;
  if (unitIdx >= 0 && cells[unitIdx]) {
    unit = normalizeUnit(cells[unitIdx]);
  }

  // Get unit price
  let unitPrice = 0;
  const unitPriceIdx = columnMap.unitPrice ?? -1;
  if (unitPriceIdx >= 0 && cells[unitPriceIdx]) {
    unitPrice = parsePrice(cells[unitPriceIdx]);
  }

  // Get total amount
  let amount = 0;
  const amountIdx = columnMap.amount ?? -1;
  if (amountIdx >= 0 && cells[amountIdx]) {
    amount = parsePrice(cells[amountIdx]);
  }

  // If no amount but we have unit price and quantity, calculate
  if (amount === 0 && unitPrice > 0 && quantity > 0) {
    amount = unitPrice * quantity;
  }

  // If no unit price but we have amount and quantity, calculate
  if (unitPrice === 0 && amount > 0 && quantity > 0) {
    unitPrice = amount / quantity;
  }

  // Get GST rate
  let gstRate: number | undefined;
  const gstIdx = columnMap.gst ?? -1;
  if (gstIdx >= 0 && cells[gstIdx]) {
    const gstText = cells[gstIdx];
    const gstMatch = gstText.match(/(\d+(?:\.\d+)?)\s*%?/);
    if (gstMatch) {
      gstRate = parseFloat(gstMatch[1]);
    }
  }

  // Calculate GST amount
  const gstAmount = gstRate ? (amount * gstRate) / 100 : undefined;

  // Get delivery period
  let deliveryPeriod: string | undefined;
  const deliveryIdx = columnMap.delivery ?? -1;
  if (deliveryIdx >= 0 && cells[deliveryIdx]) {
    deliveryPeriod = cells[deliveryIdx].trim();
  }

  // Get make/model
  let makeModel: string | undefined;
  const makeModelIdx = columnMap.makeModel ?? -1;
  if (makeModelIdx >= 0 && cells[makeModelIdx]) {
    makeModel = cells[makeModelIdx].trim();
  }

  // Calculate confidence scores
  const descConfidence = description.length > 10 ? 0.9 : 0.6;
  const priceConfidence = unitPrice > 0 ? 0.9 : 0.3;
  const qtyConfidence = quantity > 0 ? 0.9 : 0.5;

  return {
    lineNumber,
    description: description.trim(),
    quantity,
    unit,
    unitPrice,
    amount,
    gstRate,
    gstAmount,
    deliveryPeriod,
    makeModel,
    meetsSpec: true, // Default to true
    matchConfidence: 0,
    confidence: {
      description: descConfidence,
      unitPrice: priceConfidence,
      quantity: qtyConfidence,
      overall: (descConfidence + priceConfidence + qtyConfidence) / 3,
    },
    sourceText: cells.join(' | '),
  };
}

/**
 * Extract header information from document entities and text
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractOfferHeader(document: any, fullText: string): ParsedOfferHeader {
  const header: ParsedOfferHeader = { confidence: 0.5 };

  // Try to extract from entities first
  const entities = document.entities || [];
  for (const entity of entities) {
    const type = entity.type?.toLowerCase() || '';
    const text = entity.mentionText?.trim() || '';

    if (type.includes('quotation') && type.includes('number')) {
      header.vendorOfferNumber = text;
    } else if (type.includes('date')) {
      header.vendorOfferDate = text;
    } else if (type.includes('total') && type.includes('amount')) {
      header.totalAmount = parsePrice(text);
    } else if (type.includes('subtotal')) {
      header.subtotal = parsePrice(text);
    } else if (type.includes('tax') || type.includes('gst')) {
      header.taxAmount = parsePrice(text);
    }
  }

  // Extract from text patterns
  const patterns = {
    quotationNumber: /(?:quotation|quote|offer|ref)\s*(?:no|number|#)?[:\s]*([A-Z0-9\-\/]+)/i,
    date: /(?:date|dated)[:\s]*(\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})/i,
    validity: /(?:valid|validity)[:\s]*(?:till|until|upto)?[:\s]*(\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})/i,
    totalAmount: /(?:grand\s*)?total[:\s]*(?:amount)?[:\s]*(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{2})?)/i,
    paymentTerms: /(?:payment\s*terms?)[:\s]*([^\n]+)/i,
    deliveryTerms: /(?:delivery\s*terms?)[:\s]*([^\n]+)/i,
    warranty: /(?:warranty)[:\s]*([^\n]+)/i,
  };

  if (!header.vendorOfferNumber) {
    const match = fullText.match(patterns.quotationNumber);
    if (match) header.vendorOfferNumber = match[1];
  }

  if (!header.vendorOfferDate) {
    const match = fullText.match(patterns.date);
    if (match) header.vendorOfferDate = match[1];
  }

  if (!header.validityDate) {
    const match = fullText.match(patterns.validity);
    if (match) header.validityDate = match[1];
  }

  if (!header.totalAmount) {
    const match = fullText.match(patterns.totalAmount);
    if (match) header.totalAmount = parsePrice(match[1]);
  }

  if (!header.paymentTerms) {
    const match = fullText.match(patterns.paymentTerms);
    if (match) header.paymentTerms = match[1].trim();
  }

  if (!header.deliveryTerms) {
    const match = fullText.match(patterns.deliveryTerms);
    if (match) header.deliveryTerms = match[1].trim();
  }

  if (!header.warrantyTerms) {
    const match = fullText.match(patterns.warranty);
    if (match) header.warrantyTerms = match[1].trim();
  }

  header.currency = 'INR'; // Default

  return header;
}

/**
 * Process Document AI response and extract offer items
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function processDocumentAIResponse(
  document: any,
  warnings: string[]
): { header: ParsedOfferHeader; items: ParsedOfferItem[] } {
  const items: ParsedOfferItem[] = [];
  const fullText = document.text || '';

  // Extract header information
  const header = extractOfferHeader(document, fullText);

  // Process tables
  const pages = document.pages || [];
  let lineNumber = 1;

  for (const page of pages) {
    const tables = page.tables || [];

    for (const table of tables) {
      // Get header row to understand column structure
      const headerRows = table.headerRows || [];
      const columnHeaders: string[] = [];

      for (const headerRow of headerRows) {
        for (const cell of headerRow.cells || []) {
          const cellText = extractTextFromCell(cell, fullText);
          columnHeaders.push(cellText.toLowerCase().trim());
        }
      }

      // Map column indices for offer-specific fields (includes pricing)
      const columnMap = detectOfferColumnMapping(columnHeaders);

      // Check if this table has pricing columns
      const hasPricingColumns =
        columnMap.unitPrice !== undefined || columnMap.amount !== undefined;

      if (!hasPricingColumns) {
        // Skip tables without pricing (likely not the quotation table)
        continue;
      }

      // Process body rows
      const bodyRows = table.bodyRows || [];
      for (const row of bodyRows) {
        const cells = row.cells || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cellTexts: string[] = cells.map((cell: any) =>
          extractTextFromCell(cell, fullText)
        );

        const item = extractOfferItemFromRow(cellTexts, columnMap, lineNumber);
        if (item && item.unitPrice > 0) {
          items.push(item);
          lineNumber++;
        }
      }
    }
  }

  // If no items found from tables, add a warning
  if (items.length === 0) {
    warnings.push(
      'No pricing items could be extracted from tables. The document may not have a standard quotation format.'
    );
  }

  return { header, items };
}

/**
 * Main Cloud Function: Parse Offer Document
 */
export const parseOfferDocument = onCall(
  {
    region: 'asia-south1',
    memory: '1GiB',
    timeoutSeconds: 300,
    maxInstances: 10,
  },
  async (request): Promise<OfferParsingResult> => {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];

    // Validate auth
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const data = request.data as OfferParsingRequest;
    logger.info('Offer parsing request received', {
      fileName: data.fileName,
      storagePath: data.storagePath,
      rfqId: data.rfqId,
      rfqNumber: data.rfqNumber,
      vendorId: data.vendorId,
      vendorName: data.vendorName,
      rfqItemCount: data.rfqItems?.length,
      userId: request.auth.uid,
    });

    // Validate request
    if (!data.storagePath) {
      throw new HttpsError('invalid-argument', 'Storage path is required');
    }

    if (!data.rfqId || !data.rfqNumber) {
      throw new HttpsError('invalid-argument', 'RFQ ID and number are required');
    }

    if (!data.vendorId || !data.vendorName) {
      throw new HttpsError('invalid-argument', 'Vendor ID and name are required');
    }

    if (!data.rfqItems || data.rfqItems.length === 0) {
      throw new HttpsError('invalid-argument', 'RFQ items are required for matching');
    }

    // Validate file type
    const supportedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!supportedTypes.includes(data.mimeType)) {
      throw new HttpsError(
        'invalid-argument',
        `Unsupported file type: ${data.mimeType}. Supported types: PDF, DOC, DOCX`
      );
    }

    // Validate file size (max 20MB)
    const maxSize = 20 * 1024 * 1024;
    if (data.fileSize > maxSize) {
      throw new HttpsError(
        'invalid-argument',
        `File too large: ${data.fileSize} bytes. Maximum size: 20MB`
      );
    }

    try {
      // Download file from Firebase Storage
      const bucket = admin.storage().bucket();
      const file = bucket.file(data.storagePath);

      const [exists] = await file.exists();
      if (!exists) {
        throw new HttpsError('not-found', `File not found: ${data.storagePath}`);
      }

      const [fileContent] = await file.download();
      logger.info('File downloaded', { size: fileContent.length });

      // Initialize Document AI client
      const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
      const location = 'us'; // Document AI processor location
      const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;

      if (!processorId) {
        throw new HttpsError(
          'failed-precondition',
          'Document AI processor not configured. Set DOCUMENT_AI_PROCESSOR_ID environment variable.'
        );
      }

      const client = new DocumentProcessorServiceClient();
      const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`;

      // Convert MIME type for Document AI
      let docAIMimeType = data.mimeType;
      if (data.mimeType === 'application/msword') {
        warnings.push('DOC format may have reduced parsing accuracy. PDF recommended.');
        docAIMimeType = 'application/pdf';
      }

      logger.info('Sending to Document AI', {
        processor: processorName,
        mimeType: docAIMimeType,
      });

      // Process document
      const [result] = await client.processDocument({
        name: processorName,
        rawDocument: {
          content: fileContent.toString('base64'),
          mimeType: docAIMimeType,
        },
      });

      const document = result.document;
      if (!document) {
        throw new HttpsError('internal', 'Document AI returned empty response');
      }

      logger.info('Document AI response received', {
        textLength: document.text?.length,
        pageCount: document.pages?.length,
        entityCount: document.entities?.length,
      });

      // Process the response
      const { header, items } = processDocumentAIResponse(document, warnings);

      // Match items to RFQ items
      const matchedItems = matchItemsToRFQ(items, data.rfqItems);

      // Calculate statistics
      const matchedCount = matchedItems.filter((i) => i.matchedRfqItemId).length;
      const unmatchedCount = matchedItems.length - matchedCount;
      const highConfidenceItems = matchedItems.filter((i) => i.confidence.overall > 0.8).length;
      const lowConfidenceItems = matchedItems.filter((i) => i.confidence.overall < 0.5).length;

      // Calculate financial totals
      const calculatedSubtotal = matchedItems.reduce((sum, item) => sum + item.amount, 0);
      const calculatedTax = matchedItems.reduce(
        (sum, item) => sum + (item.gstAmount || 0),
        0
      );
      const calculatedTotal = calculatedSubtotal + calculatedTax;

      // Add warnings
      if (unmatchedCount > 0) {
        warnings.push(
          `${unmatchedCount} item(s) could not be matched to RFQ items. Please review manually.`
        );
      }

      if (lowConfidenceItems > 0) {
        warnings.push(
          `${lowConfidenceItems} item(s) have low confidence and may need manual review.`
        );
      }

      // Compare extracted total with header total
      if (header.totalAmount && Math.abs(header.totalAmount - calculatedTotal) > 1) {
        warnings.push(
          `Extracted total (${calculatedTotal.toFixed(2)}) differs from document total (${header.totalAmount}). Please verify.`
        );
      }

      const processingTimeMs = Date.now() - startTime;

      // Log parsing job to Firestore
      const db = admin.firestore();
      await db.collection('OFFER_PARSING_JOBS').add({
        fileName: data.fileName,
        storagePath: data.storagePath,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        rfqId: data.rfqId,
        rfqNumber: data.rfqNumber,
        vendorId: data.vendorId,
        vendorName: data.vendorName,
        status: 'COMPLETED',
        itemsFound: matchedItems.length,
        matchedItems: matchedCount,
        unmatchedItems: unmatchedCount,
        highConfidenceItems,
        lowConfidenceItems,
        calculatedTotal,
        processingTimeMs,
        requestedBy: request.auth.uid,
        requestedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info('Offer parsing completed', {
        itemsFound: matchedItems.length,
        matchedItems: matchedCount,
        unmatchedItems: unmatchedCount,
        calculatedTotal,
        processingTimeMs,
      });

      return {
        success: true,
        header,
        items: matchedItems,
        totalItemsFound: matchedItems.length,
        matchedItems: matchedCount,
        unmatchedItems: unmatchedCount,
        highConfidenceItems,
        lowConfidenceItems,
        calculatedSubtotal,
        calculatedTax,
        calculatedTotal,
        warnings: warnings.length > 0 ? warnings : undefined,
        errors: errors.length > 0 ? errors : undefined,
        processingTimeMs,
        modelUsed: 'Google Document AI - Form Parser',
        sourceFileName: data.fileName,
        sourceFileSize: data.fileSize,
        pageCount: document.pages?.length,
      };
    } catch (error) {
      logger.error('Offer parsing failed', { error });

      // Log failed job
      const db = admin.firestore();
      await db.collection('OFFER_PARSING_JOBS').add({
        fileName: data.fileName,
        storagePath: data.storagePath,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        rfqId: data.rfqId,
        rfqNumber: data.rfqNumber,
        vendorId: data.vendorId,
        vendorName: data.vendorName,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: request.auth.uid,
        requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        'internal',
        `Offer parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);
