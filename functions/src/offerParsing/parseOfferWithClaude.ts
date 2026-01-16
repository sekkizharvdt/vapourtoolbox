/**
 * Offer Document Parsing with Claude AI
 *
 * Uses Anthropic Claude API to parse vendor offer PDF files and extract
 * structured pricing data. This provides an alternative to Document AI
 * for comparison purposes.
 */

import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import Anthropic from '@anthropic-ai/sdk';
import * as admin from 'firebase-admin';

// Define the secret
export const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

// Types
interface RFQItemContext {
  id: string;
  lineNumber: number;
  description: string;
  quantity: number;
  unit: string;
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

interface ClaudeParseRequest {
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  rfqId: string;
  rfqNumber: string;
  vendorId: string;
  vendorName: string;
  rfqItems: RFQItemContext[];
  userId: string;
}

// System prompt for Claude to parse offer documents
const OFFER_PARSING_PROMPT = `You are a document parsing assistant specialized in extracting structured data from vendor quotations and offers.

Your task is to analyze the provided document and extract:
1. Header information (quotation number, dates, terms, totals)
2. Line items with pricing details

Return ONLY valid JSON in exactly this format (no other text before or after):

{
  "header": {
    "vendorOfferNumber": "string or null",
    "vendorOfferDate": "string (DD/MM/YYYY format) or null",
    "validityDate": "string (DD/MM/YYYY format) or null",
    "subtotal": number or null,
    "taxAmount": number or null,
    "totalAmount": number or null,
    "currency": "INR",
    "paymentTerms": "string or null",
    "deliveryTerms": "string or null",
    "warrantyTerms": "string or null"
  },
  "items": [
    {
      "lineNumber": 1,
      "description": "Item description as stated in document",
      "quantity": number,
      "unit": "NOS/KG/MTR/SET/LOT/EA",
      "unitPrice": number (numeric value only, no currency symbols),
      "amount": number (quantity * unitPrice),
      "gstRate": number or null (percentage value like 18),
      "deliveryPeriod": "string or null",
      "makeModel": "string or null"
    }
  ]
}

Important rules:
- Extract ALL line items with pricing from the document
- Unit prices and amounts should be numeric values only (no currency symbols)
- If GST/tax rate is mentioned per item, include it
- Normalize units: NOS (numbers/pieces), KG, MTR (meters), SET, LOT, EA (each)
- If quantity is not specified, assume 1
- Calculate amount as quantity * unitPrice if not explicitly stated
- Do not make up data - only extract what's in the document
- Return null for fields that cannot be found`;

/**
 * Parse offer document using Claude AI
 */
export async function parseOfferWithClaude(
  request: ClaudeParseRequest
): Promise<OfferParsingResult> {
  const startTime = Date.now();
  const warnings: string[] = [];

  logger.info('Claude parsing request received', {
    fileName: request.fileName,
    storagePath: request.storagePath,
    rfqId: request.rfqId,
    rfqNumber: request.rfqNumber,
  });

  // Get API key
  const apiKey = anthropicApiKey.value();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY secret not configured');
  }

  try {
    // Download file from Firebase Storage
    const bucket = admin.storage().bucket();
    const file = bucket.file(request.storagePath);

    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`File not found: ${request.storagePath}`);
    }

    const [fileContent] = await file.download();
    logger.info('File downloaded for Claude parsing', { size: fileContent.length });

    // Convert to base64 for Claude
    const base64Content = fileContent.toString('base64');

    // Determine media type
    let mediaType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' =
      'application/pdf';
    if (request.mimeType === 'application/pdf') {
      mediaType = 'application/pdf';
    }

    // Initialize Claude client
    const client = new Anthropic({ apiKey });

    // Build the RFQ context for matching
    const rfqContext = request.rfqItems
      .map(
        (item) =>
          `Line ${item.lineNumber}: ${item.description} (Qty: ${item.quantity} ${item.unit})`
      )
      .join('\n');

    const userPrompt = `Please parse this vendor quotation document and extract the pricing information.

For reference, here are the RFQ items this quotation should be responding to:
${rfqContext}

After extracting the items, try to match each extracted item to the corresponding RFQ item based on description similarity.

Return the JSON with an additional "matchedRfqItemId" field for each item that matches an RFQ item (use the line number to identify).`;

    logger.info('Sending document to Claude', { mimeType: mediaType });

    // Call Claude API with the document
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Content,
              },
            },
            {
              type: 'text',
              text: userPrompt,
            },
          ],
        },
      ],
      system: OFFER_PARSING_PROMPT,
    });

    // Extract text response
    const textContent = response.content.find((block) => block.type === 'text');
    const responseText = textContent?.type === 'text' ? textContent.text : '';

    logger.info('Claude response received', {
      responseLength: responseText.length,
      usage: response.usage,
    });

    // Parse JSON from response
    let parsedData: {
      header?: {
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
      };
      items?: Array<{
        lineNumber?: number;
        description?: string;
        quantity?: number;
        unit?: string;
        unitPrice?: number;
        amount?: number;
        gstRate?: number;
        deliveryPeriod?: string;
        makeModel?: string;
        matchedRfqItemId?: string;
      }>;
    };

    try {
      // Try to extract JSON from response (might have extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      logger.error('Failed to parse Claude response as JSON', { responseText });
      warnings.push('Claude response parsing failed. Results may be incomplete.');
      parsedData = { header: {}, items: [] };
    }

    // Process header
    const header: ParsedOfferHeader = {
      vendorOfferNumber: parsedData.header?.vendorOfferNumber || undefined,
      vendorOfferDate: parsedData.header?.vendorOfferDate || undefined,
      validityDate: parsedData.header?.validityDate || undefined,
      subtotal: parsedData.header?.subtotal || undefined,
      taxAmount: parsedData.header?.taxAmount || undefined,
      totalAmount: parsedData.header?.totalAmount || undefined,
      currency: parsedData.header?.currency || 'INR',
      paymentTerms: parsedData.header?.paymentTerms || undefined,
      deliveryTerms: parsedData.header?.deliveryTerms || undefined,
      warrantyTerms: parsedData.header?.warrantyTerms || undefined,
      confidence: 0.85, // Claude generally has good confidence
    };

    // Process items and match to RFQ
    const items: ParsedOfferItem[] = (parsedData.items || []).map((item, index) => {
      const lineNumber = item.lineNumber || index + 1;
      const quantity = item.quantity || 1;
      const unitPrice = item.unitPrice || 0;
      const amount = item.amount || quantity * unitPrice;

      // Try to match to RFQ item
      let matchedRfqItemId: string | undefined;
      let matchConfidence = 0;

      if (item.matchedRfqItemId) {
        // Claude provided a match - find the RFQ item
        const rfqItem = request.rfqItems.find(
          (r) =>
            r.lineNumber === parseInt(item.matchedRfqItemId || '0') ||
            r.id === item.matchedRfqItemId
        );
        if (rfqItem) {
          matchedRfqItemId = rfqItem.id;
          matchConfidence = 0.8;
        }
      }

      // If no match from Claude, try to match by description similarity
      if (!matchedRfqItemId && item.description) {
        const bestMatch = findBestMatch(item.description, request.rfqItems);
        if (bestMatch.score > 0.3) {
          matchedRfqItemId = bestMatch.item.id;
          matchConfidence = bestMatch.score;
        }
      }

      return {
        lineNumber,
        matchedRfqItemId,
        matchConfidence,
        description: item.description || '',
        quantity,
        unit: normalizeUnit(item.unit || 'NOS'),
        unitPrice,
        amount,
        gstRate: item.gstRate,
        gstAmount: item.gstRate ? (amount * item.gstRate) / 100 : undefined,
        deliveryPeriod: item.deliveryPeriod,
        makeModel: item.makeModel,
        meetsSpec: true,
        confidence: {
          description: item.description ? 0.9 : 0.3,
          unitPrice: unitPrice > 0 ? 0.9 : 0.3,
          quantity: quantity > 0 ? 0.9 : 0.5,
          overall: 0.85,
        },
      };
    });

    // Calculate statistics
    const matchedCount = items.filter((i) => i.matchedRfqItemId).length;
    const unmatchedCount = items.length - matchedCount;
    const highConfidenceItems = items.filter((i) => i.confidence.overall > 0.8).length;
    const lowConfidenceItems = items.filter((i) => i.confidence.overall < 0.5).length;

    // Calculate totals
    const calculatedSubtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const calculatedTax = items.reduce((sum, item) => sum + (item.gstAmount || 0), 0);
    const calculatedTotal = calculatedSubtotal + calculatedTax;

    // Add warnings
    if (unmatchedCount > 0) {
      warnings.push(
        `${unmatchedCount} item(s) could not be matched to RFQ items. Please review manually.`
      );
    }

    const processingTimeMs = Date.now() - startTime;

    // Log parsing job
    const db = admin.firestore();
    await db.collection('OFFER_PARSING_JOBS').add({
      fileName: request.fileName,
      storagePath: request.storagePath,
      mimeType: request.mimeType,
      fileSize: request.fileSize,
      rfqId: request.rfqId,
      rfqNumber: request.rfqNumber,
      vendorId: request.vendorId,
      vendorName: request.vendorName,
      status: 'COMPLETED',
      parser: 'CLAUDE',
      itemsFound: items.length,
      matchedItems: matchedCount,
      unmatchedItems: unmatchedCount,
      calculatedTotal,
      processingTimeMs,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      requestedBy: request.userId,
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info('Claude parsing completed', {
      itemsFound: items.length,
      matchedItems: matchedCount,
      calculatedTotal,
      processingTimeMs,
    });

    return {
      success: true,
      header,
      items,
      totalItemsFound: items.length,
      matchedItems: matchedCount,
      unmatchedItems: unmatchedCount,
      highConfidenceItems,
      lowConfidenceItems,
      calculatedSubtotal,
      calculatedTax,
      calculatedTotal,
      warnings: warnings.length > 0 ? warnings : undefined,
      processingTimeMs,
      modelUsed: 'Claude AI (claude-sonnet-4)',
      sourceFileName: request.fileName,
      sourceFileSize: request.fileSize,
    };
  } catch (error) {
    logger.error('Claude parsing failed', { error });

    // Log failed job
    const db = admin.firestore();
    await db.collection('OFFER_PARSING_JOBS').add({
      fileName: request.fileName,
      storagePath: request.storagePath,
      mimeType: request.mimeType,
      fileSize: request.fileSize,
      rfqId: request.rfqId,
      rfqNumber: request.rfqNumber,
      vendorId: request.vendorId,
      vendorName: request.vendorName,
      status: 'FAILED',
      parser: 'CLAUDE',
      error: error instanceof Error ? error.message : 'Unknown error',
      requestedBy: request.userId,
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    throw error;
  }
}

/**
 * Normalize unit string
 */
function normalizeUnit(unit: string): string {
  const unitMap: Record<string, string> = {
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
  const normalized = unit.toLowerCase().trim();
  return unitMap[normalized] || unit.toUpperCase();
}

/**
 * Find best matching RFQ item for a description
 */
function findBestMatch(
  description: string,
  rfqItems: RFQItemContext[]
): { item: RFQItemContext; score: number } {
  let bestItem = rfqItems[0];
  let bestScore = 0;

  for (const item of rfqItems) {
    const score = stringSimilarity(description, item.description);
    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  return { item: bestItem, score: bestScore };
}

/**
 * Calculate string similarity using word overlap
 */
function stringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.8;
  }

  const words1 = new Set(s1.split(/\s+/).filter((w) => w.length > 2));
  const words2 = new Set(s2.split(/\s+/).filter((w) => w.length > 2));
  const intersection = [...words1].filter((w) => words2.has(w));
  const union = new Set([...words1, ...words2]);

  if (union.size === 0) return 0;
  return intersection.length / union.size;
}
