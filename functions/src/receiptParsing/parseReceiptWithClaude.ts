/**
 * Receipt Parsing with Claude AI
 *
 * Uses Anthropic Claude AI to parse receipt images/PDFs and extract
 * structured data for travel expense items.
 *
 * This parser uses Claude's vision capabilities for document understanding
 * and structured data extraction.
 */

import { logger } from 'firebase-functions/v2';
import Anthropic from '@anthropic-ai/sdk';

// ============================================
// Types
// ============================================

export interface ClaudeReceiptParseRequest {
  fileContent: Buffer;
  mimeType: string;
  fileName: string;
  companyGstin: string | null;
  /** API key for Anthropic - should be passed from Firebase Secrets */
  apiKey: string;
}

export interface ParsedReceiptData {
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

// ============================================
// Claude Parsing Prompt
// ============================================

const RECEIPT_PARSING_PROMPT = `You are an expert at parsing Indian receipts and invoices. Extract structured data from this receipt/invoice document.

IMPORTANT CONTEXT:
- This is a receipt from India, so amounts are in INR (Indian Rupees)
- GST (Goods and Services Tax) may be shown as CGST + SGST (intra-state) or IGST (inter-state)
- GSTIN (GST Identification Number) format: 2-digit state code + 10-char PAN + 1 entity number + 1 Z + 1 checksum (e.g., 27AABCU9603R1ZM)
- Common date formats: DD/MM/YYYY, DD-MM-YYYY, DD MMM YYYY

EXTRACT THE FOLLOWING (return null for fields not found):

1. **vendorName**: Business/merchant name (look at header or logo area)
2. **invoiceNumber**: Invoice/receipt number, PNR, booking ID, trip ID, order ID
3. **transactionDate**: Date of transaction (in YYYY-MM-DD format)
4. **totalAmount**: Final total amount paid (include GST)
5. **taxableAmount**: Amount before tax/GST (if shown separately)
6. **cgstAmount**: CGST amount (if shown)
7. **cgstRate**: CGST rate percentage (if shown)
8. **sgstAmount**: SGST amount (if shown)
9. **sgstRate**: SGST rate percentage (if shown)
10. **igstAmount**: IGST amount (if shown)
11. **igstRate**: IGST rate percentage (if shown)
12. **vendorGstin**: Vendor's GSTIN (15-character alphanumeric)
13. **allGstinsFound**: Array of ALL GSTINs found on the receipt

14. **category**: Suggest one category based on content:
    - TRAVEL: Airlines, railways, bus tickets, boarding passes
    - ACCOMMODATION: Hotels, resorts, lodges, OYO, Fab, Treebo
    - LOCAL_CONVEYANCE: Uber, Ola, taxi, auto, metro, parking, tolls
    - FOOD: Restaurants, cafes, Swiggy, Zomato, food delivery
    - OTHER: Anything else

15. **confidence**: Your confidence in the extraction (0.0 to 1.0)

RESPOND WITH ONLY VALID JSON in this exact format:
{
  "vendorName": "string or null",
  "invoiceNumber": "string or null",
  "transactionDate": "YYYY-MM-DD or null",
  "totalAmount": number or null,
  "taxableAmount": number or null,
  "cgstAmount": number or null,
  "cgstRate": number or null,
  "sgstAmount": number or null,
  "sgstRate": number or null,
  "igstAmount": number or null,
  "igstRate": number or null,
  "vendorGstin": "string or null",
  "allGstinsFound": ["array of GSTINs"] or [],
  "category": "TRAVEL" | "ACCOMMODATION" | "LOCAL_CONVEYANCE" | "FOOD" | "OTHER",
  "confidence": number between 0 and 1
}`;

// ============================================
// Main Parsing Function
// ============================================

export async function parseReceiptWithClaude(
  request: ClaudeReceiptParseRequest
): Promise<ParsedReceiptData> {
  const startTime = Date.now();

  // Use API key from request (passed from Firebase Secrets)
  const apiKey = request.apiKey;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not provided');
  }

  // Initialize Anthropic client
  const client = new Anthropic({ apiKey });

  // Convert file content to base64
  const base64Content = request.fileContent.toString('base64');

  // Map MIME type
  let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf';
  switch (request.mimeType) {
    case 'image/jpeg':
    case 'image/jpg':
      mediaType = 'image/jpeg';
      break;
    case 'image/png':
      mediaType = 'image/png';
      break;
    case 'image/webp':
      mediaType = 'image/webp';
      break;
    case 'application/pdf':
      mediaType = 'application/pdf';
      break;
    default:
      throw new Error(`Unsupported file type: ${request.mimeType}`);
  }

  logger.info('[Claude Receipt Parser] Processing document', {
    fileName: request.fileName,
    mimeType: mediaType,
    fileSize: request.fileContent.length,
    hasCompanyGstin: !!request.companyGstin,
  });

  try {
    // Build content blocks based on file type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentBlocks: any[] = [];

    if (mediaType === 'application/pdf') {
      contentBlocks.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf' as const,
          data: base64Content,
        },
      });
    } else {
      contentBlocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
          data: base64Content,
        },
      });
    }

    contentBlocks.push({
      type: 'text',
      text: 'Parse this receipt and extract the structured data as specified.',
    });

    // Call Claude API with document
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: contentBlocks,
        },
      ],
      system: RECEIPT_PARSING_PROMPT,
    });

    // Extract the text response
    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON response
    let extractedData;
    try {
      // Try to extract JSON from the response (handle markdown code blocks)
      let jsonText = textContent.text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }
      extractedData = JSON.parse(jsonText);
    } catch {
      logger.error('[Claude Receipt Parser] Failed to parse JSON response', {
        response: textContent.text.substring(0, 500),
      });
      throw new Error('Invalid JSON response from Claude');
    }

    logger.info('[Claude Receipt Parser] Extracted data', {
      vendorName: extractedData.vendorName,
      totalAmount: extractedData.totalAmount,
      category: extractedData.category,
      confidence: extractedData.confidence,
      gstinsFound: extractedData.allGstinsFound?.length || 0,
    });

    // Calculate total GST
    let gstAmount: number | undefined;
    if (extractedData.cgstAmount || extractedData.sgstAmount || extractedData.igstAmount) {
      gstAmount =
        (extractedData.cgstAmount || 0) +
        (extractedData.sgstAmount || 0) +
        (extractedData.igstAmount || 0);
    }

    // Calculate GST rate
    let gstRate: number | undefined;
    if (extractedData.cgstRate && extractedData.sgstRate) {
      gstRate = extractedData.cgstRate + extractedData.sgstRate;
    } else if (extractedData.igstRate) {
      gstRate = extractedData.igstRate;
    }

    // Check for company GSTIN on receipt
    let companyGstinFound = false;
    let companyGstinOnReceipt: string | undefined;

    if (request.companyGstin && extractedData.allGstinsFound?.length > 0) {
      const normalizedCompanyGstin = request.companyGstin.toUpperCase().replace(/\s/g, '');
      for (const gstin of extractedData.allGstinsFound) {
        if (gstin.toUpperCase() === normalizedCompanyGstin) {
          companyGstinFound = true;
          companyGstinOnReceipt = gstin.toUpperCase();
          break;
        }
      }
    }

    const processingTimeMs = Date.now() - startTime;

    return {
      vendorName: extractedData.vendorName || undefined,
      invoiceNumber: extractedData.invoiceNumber || undefined,
      transactionDate: extractedData.transactionDate || undefined,
      totalAmount: extractedData.totalAmount || undefined,
      taxableAmount: extractedData.taxableAmount || undefined,
      currency: 'INR',
      gstAmount,
      gstRate,
      cgstAmount: extractedData.cgstAmount || undefined,
      cgstRate: extractedData.cgstRate || undefined,
      sgstAmount: extractedData.sgstAmount || undefined,
      sgstRate: extractedData.sgstRate || undefined,
      igstAmount: extractedData.igstAmount || undefined,
      igstRate: extractedData.igstRate || undefined,
      vendorGstin: extractedData.vendorGstin || undefined,
      companyGstinFound,
      companyGstinOnReceipt,
      suggestedCategory: extractedData.category || 'OTHER',
      categoryConfidence: extractedData.confidence || 0.5,
      confidence: extractedData.confidence || 0.5,
      processingTimeMs,
    };
  } catch (error) {
    logger.error('[Claude Receipt Parser] Error processing receipt', {
      error: error instanceof Error ? error.message : 'Unknown error',
      fileName: request.fileName,
    });
    throw error;
  }
}
