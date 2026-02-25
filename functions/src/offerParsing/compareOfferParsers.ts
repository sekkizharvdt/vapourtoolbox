/**
 * Compare Offer Parsers Cloud Function
 *
 * Runs both Google Document AI and Claude AI parsers on the same document
 * and returns results side by side for comparison.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { parseOfferWithClaude, anthropicApiKey } from './parseOfferWithClaude';
import { getProjectId } from '../utils/getProjectId';

// Types
interface RFQItemContext {
  id: string;
  lineNumber: number;
  description: string;
  quantity: number;
  unit: string;
}

interface CompareParsingRequest {
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

interface SingleParserResult {
  success: boolean;
  error?: string;
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
  processingTimeMs: number;
  modelUsed: string;
}

interface CompareParsingResult {
  success: boolean;
  googleDocumentAI: SingleParserResult;
  claudeAI: SingleParserResult;
  sourceFileName: string;
  sourceFileSize: number;
  totalProcessingTimeMs: number;
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

function parseQuantity(quantityStr: string): number {
  const cleaned = quantityStr.replace(/,/g, '').replace(/\s/g, '').trim();
  const parsed = parseFloat(cleaned);
  return !isNaN(parsed) && parsed > 0 ? parsed : 0;
}

function parsePrice(priceStr: string): number {
  const cleaned = priceStr
    .replace(/[₹$€£]/g, '')
    .replace(/Rs\.?/gi, '')
    .replace(/INR/gi, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim();
  const parsed = parseFloat(cleaned);
  return !isNaN(parsed) && parsed >= 0 ? parsed : 0;
}

function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  const words1 = new Set(s1.split(/\s+/).filter((w) => w.length > 2));
  const words2 = new Set(s2.split(/\s+/).filter((w) => w.length > 2));
  const intersection = [...words1].filter((w) => words2.has(w));
  const union = new Set([...words1, ...words2]);

  return union.size === 0 ? 0 : intersection.length / union.size;
}

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
      matchedItems.push({ ...item, matchedRfqItemId: bestMatch.id, matchConfidence: bestScore });
    } else {
      matchedItems.push({ ...item, matchConfidence: 0 });
    }
  }

  return matchedItems;
}

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

function extractOfferItemFromRow(
  cells: string[],
  columnMap: Record<string, number>,
  lineNumber: number
): ParsedOfferItem | null {
  const descriptionIdx = columnMap.description ?? -1;
  const description = descriptionIdx >= 0 ? cells[descriptionIdx] : '';
  if (!description || description.trim().length < 3) return null;

  let quantity = 1;
  const quantityIdx = columnMap.quantity ?? -1;
  if (quantityIdx >= 0 && cells[quantityIdx]) {
    quantity = parseQuantity(cells[quantityIdx]) || 1;
  }

  let unit = 'NOS';
  const unitIdx = columnMap.unit ?? -1;
  if (unitIdx >= 0 && cells[unitIdx]) {
    unit = normalizeUnit(cells[unitIdx]);
  }

  let unitPrice = 0;
  const unitPriceIdx = columnMap.unitPrice ?? -1;
  if (unitPriceIdx >= 0 && cells[unitPriceIdx]) {
    unitPrice = parsePrice(cells[unitPriceIdx]);
  }

  let amount = 0;
  const amountIdx = columnMap.amount ?? -1;
  if (amountIdx >= 0 && cells[amountIdx]) {
    amount = parsePrice(cells[amountIdx]);
  }

  if (amount === 0 && unitPrice > 0 && quantity > 0) {
    amount = unitPrice * quantity;
  }
  if (unitPrice === 0 && amount > 0 && quantity > 0) {
    unitPrice = amount / quantity;
  }

  let gstRate: number | undefined;
  const gstIdx = columnMap.gst ?? -1;
  if (gstIdx >= 0 && cells[gstIdx]) {
    const gstMatch = cells[gstIdx].match(/(\d+(?:\.\d+)?)\s*%?/);
    if (gstMatch) gstRate = parseFloat(gstMatch[1]);
  }

  const gstAmount = gstRate ? (amount * gstRate) / 100 : undefined;

  let deliveryPeriod: string | undefined;
  const deliveryIdx = columnMap.delivery ?? -1;
  if (deliveryIdx >= 0 && cells[deliveryIdx]) {
    deliveryPeriod = cells[deliveryIdx].trim();
  }

  let makeModel: string | undefined;
  const makeModelIdx = columnMap.makeModel ?? -1;
  if (makeModelIdx >= 0 && cells[makeModelIdx]) {
    makeModel = cells[makeModelIdx].trim();
  }

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
    meetsSpec: true,
    matchConfidence: 0,
    confidence: {
      description: description.length > 10 ? 0.9 : 0.6,
      unitPrice: unitPrice > 0 ? 0.9 : 0.3,
      quantity: quantity > 0 ? 0.9 : 0.5,
      overall: 0,
    },
    sourceText: cells.join(' | '),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractOfferHeader(document: any, fullText: string): ParsedOfferHeader {
  const header: ParsedOfferHeader = { confidence: 0.5 };
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
    }
  }

  const patterns = {
    quotationNumber: /(?:quotation|quote|offer|ref)\s*(?:no|number|#)?[:\s]*([A-Z0-9\-\/]+)/i,
    date: /(?:date|dated)[:\s]*(\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})/i,
    validity:
      /(?:valid|validity)[:\s]*(?:till|until|upto)?[:\s]*(\d{1,2}[\-\/\.]\d{1,2}[\-\/\.]\d{2,4})/i,
    totalAmount:
      /(?:grand\s*)?total[:\s]*(?:amount)?[:\s]*(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{2})?)/i,
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

  header.currency = 'INR';
  return header;
}

/**
 * Parse with Google Document AI
 */
async function parseWithGoogleDocumentAI(
  fileContent: Buffer,
  mimeType: string,
  rfqItems: RFQItemContext[]
): Promise<SingleParserResult> {
  const startTime = Date.now();
  const warnings: string[] = [];

  try {
    const projectId = getProjectId();
    const location = process.env.DOCUMENT_AI_LOCATION || 'us';
    const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;

    if (!processorId) {
      return {
        success: false,
        error: 'Document AI processor not configured',
        items: [],
        totalItemsFound: 0,
        matchedItems: 0,
        unmatchedItems: 0,
        highConfidenceItems: 0,
        lowConfidenceItems: 0,
        calculatedSubtotal: 0,
        calculatedTax: 0,
        calculatedTotal: 0,
        processingTimeMs: Date.now() - startTime,
        modelUsed: 'Google Document AI - Form Parser',
      };
    }

    const client = new DocumentProcessorServiceClient();
    const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`;

    // Google Document AI Form Parser supports: PDF, TIFF, GIF, JPEG, PNG, BMP, WEBP
    // It does NOT support DOC/DOCX formats directly
    const supportedMimeTypes = [
      'application/pdf',
      'image/tiff',
      'image/gif',
      'image/jpeg',
      'image/png',
      'image/bmp',
      'image/webp',
    ];

    if (!supportedMimeTypes.includes(mimeType)) {
      // Document AI doesn't support this format (DOC, DOCX, etc.)
      return {
        success: false,
        error: `Google Document AI does not support ${mimeType} format. Supported formats: PDF and images. Use Claude AI for Word documents.`,
        items: [],
        totalItemsFound: 0,
        matchedItems: 0,
        unmatchedItems: 0,
        highConfidenceItems: 0,
        lowConfidenceItems: 0,
        calculatedSubtotal: 0,
        calculatedTax: 0,
        calculatedTotal: 0,
        warnings: [
          'Word documents (.doc, .docx) are not supported by Google Document AI. Please use PDF format or rely on Claude AI results.',
        ],
        processingTimeMs: Date.now() - startTime,
        modelUsed: 'Google Document AI - Form Parser',
      };
    }

    logger.info('[Document AI] Processing offer document', {
      processorName,
      projectId,
      location,
      processorId,
      mimeType,
      fileSize: fileContent.length,
    });

    const [result] = await client.processDocument({
      name: processorName,
      rawDocument: {
        content: fileContent.toString('base64'),
        mimeType: mimeType,
      },
    });

    const document = result.document;
    if (!document) {
      throw new Error('Document AI returned empty response');
    }

    const fullText = document.text || '';
    const header = extractOfferHeader(document, fullText);
    const items: ParsedOfferItem[] = [];
    const pages = document.pages || [];
    let lineNumber = 1;

    for (const page of pages) {
      const tables = page.tables || [];
      for (const table of tables) {
        const headerRows = table.headerRows || [];
        const columnHeaders: string[] = [];

        for (const headerRow of headerRows) {
          for (const cell of headerRow.cells || []) {
            const cellText = extractTextFromCell(cell, fullText);
            columnHeaders.push(cellText.toLowerCase().trim());
          }
        }

        const columnMap = detectOfferColumnMapping(columnHeaders);
        const hasPricingColumns =
          columnMap.unitPrice !== undefined || columnMap.amount !== undefined;

        if (!hasPricingColumns) continue;

        const bodyRows = table.bodyRows || [];
        for (const row of bodyRows) {
          const cells = row.cells || [];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cellTexts: string[] = cells.map((cell: any) => extractTextFromCell(cell, fullText));
          const item = extractOfferItemFromRow(cellTexts, columnMap, lineNumber);
          if (item && item.unitPrice > 0) {
            items.push(item);
            lineNumber++;
          }
        }
      }
    }

    if (items.length === 0) {
      warnings.push('No pricing items extracted from tables.');
    }

    const matchedItems = matchItemsToRFQ(items, rfqItems);
    const matchedCount = matchedItems.filter((i) => i.matchedRfqItemId).length;
    const calculatedSubtotal = matchedItems.reduce((sum, item) => sum + item.amount, 0);
    const calculatedTax = matchedItems.reduce((sum, item) => sum + (item.gstAmount || 0), 0);

    return {
      success: true,
      header,
      items: matchedItems,
      totalItemsFound: matchedItems.length,
      matchedItems: matchedCount,
      unmatchedItems: matchedItems.length - matchedCount,
      highConfidenceItems: matchedItems.filter((i) => i.confidence.overall > 0.8).length,
      lowConfidenceItems: matchedItems.filter((i) => i.confidence.overall < 0.5).length,
      calculatedSubtotal,
      calculatedTax,
      calculatedTotal: calculatedSubtotal + calculatedTax,
      warnings: warnings.length > 0 ? warnings : undefined,
      processingTimeMs: Date.now() - startTime,
      modelUsed: 'Google Document AI - Form Parser',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      items: [],
      totalItemsFound: 0,
      matchedItems: 0,
      unmatchedItems: 0,
      highConfidenceItems: 0,
      lowConfidenceItems: 0,
      calculatedSubtotal: 0,
      calculatedTax: 0,
      calculatedTotal: 0,
      processingTimeMs: Date.now() - startTime,
      modelUsed: 'Google Document AI - Form Parser',
    };
  }
}

/**
 * Main Cloud Function: Compare Offer Parsers
 */
export const compareOfferParsers = onCall(
  {
    region: 'asia-south1',
    memory: '1GiB',
    timeoutSeconds: 300,
    maxInstances: 10,
    secrets: [anthropicApiKey],
  },
  async (request): Promise<CompareParsingResult> => {
    const startTime = Date.now();

    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const data = request.data as CompareParsingRequest;
    logger.info('Compare parsers request received', {
      fileName: data.fileName,
      storagePath: data.storagePath,
      rfqId: data.rfqId,
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

    // Download file once
    const bucket = admin.storage().bucket();
    const file = bucket.file(data.storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      throw new HttpsError('not-found', `File not found: ${data.storagePath}`);
    }

    const [fileContent] = await file.download();
    logger.info('File downloaded', { size: fileContent.length });

    // Run both parsers in parallel
    const [googleResult, claudeResult] = await Promise.all([
      parseWithGoogleDocumentAI(fileContent, data.mimeType, data.rfqItems),
      parseOfferWithClaude({
        fileName: data.fileName,
        storagePath: data.storagePath,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        rfqId: data.rfqId,
        rfqNumber: data.rfqNumber,
        vendorId: data.vendorId,
        vendorName: data.vendorName,
        rfqItems: data.rfqItems,
        userId: request.auth.uid,
      })
        .then((result) => ({
          success: result.success,
          header: result.header,
          items: result.items,
          totalItemsFound: result.totalItemsFound,
          matchedItems: result.matchedItems,
          unmatchedItems: result.unmatchedItems,
          highConfidenceItems: result.highConfidenceItems,
          lowConfidenceItems: result.lowConfidenceItems,
          calculatedSubtotal: result.calculatedSubtotal,
          calculatedTax: result.calculatedTax,
          calculatedTotal: result.calculatedTotal,
          warnings: result.warnings,
          processingTimeMs: result.processingTimeMs,
          modelUsed: result.modelUsed,
        }))
        .catch((error) => ({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          items: [],
          totalItemsFound: 0,
          matchedItems: 0,
          unmatchedItems: 0,
          highConfidenceItems: 0,
          lowConfidenceItems: 0,
          calculatedSubtotal: 0,
          calculatedTax: 0,
          calculatedTotal: 0,
          processingTimeMs: 0,
          modelUsed: 'Claude AI (claude-sonnet-4)',
        })),
    ]);

    const totalProcessingTimeMs = Date.now() - startTime;

    logger.info('Both parsers completed', {
      googleSuccess: googleResult.success,
      googleItems: googleResult.totalItemsFound,
      claudeSuccess: claudeResult.success,
      claudeItems: claudeResult.totalItemsFound,
      totalProcessingTimeMs,
    });

    return {
      success: googleResult.success || claudeResult.success,
      googleDocumentAI: googleResult,
      claudeAI: claudeResult,
      sourceFileName: data.fileName,
      sourceFileSize: data.fileSize,
      totalProcessingTimeMs,
    };
  }
);
