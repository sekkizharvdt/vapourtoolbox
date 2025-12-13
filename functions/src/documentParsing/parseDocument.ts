/**
 * Document Parsing Cloud Function
 *
 * Uses Google Cloud Document AI to parse PDF/DOC files and extract
 * structured data for Purchase Request creation.
 *
 * Flow:
 * 1. User uploads document to Firebase Storage
 * 2. Frontend calls this function with storage path
 * 3. Function downloads file, sends to Document AI
 * 4. Document AI extracts text and tables
 * 5. Function processes extracted data into PR line items
 * 6. Returns structured data to frontend for PR creation
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

// Types for document parsing
interface DocumentParsingRequest {
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  context?: {
    projectName?: string;
    category?: 'SERVICE' | 'RAW_MATERIAL' | 'BOUGHT_OUT';
    existingEquipmentCodes?: string[];
  };
}

interface ParsedLineItem {
  lineNumber: number;
  description: string;
  specification?: string;
  quantity: number;
  unit: string;
  equipmentCode?: string;
  makeModel?: string;
  technicalSpec?: string;
  deliveryLocation?: string;
  remarks?: string;
  confidence: {
    description: number;
    quantity: number;
    unit: number;
    overall: number;
  };
  sourceText?: string;
}

interface ParsedPRHeader {
  title?: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  requiredBy?: string;
  documentDate?: string;
  documentReference?: string;
  vendor?: string;
  customer?: string;
  confidence: number;
}

interface DocumentParsingResult {
  success: boolean;
  header?: ParsedPRHeader;
  items: ParsedLineItem[];
  totalItemsFound: number;
  highConfidenceItems: number;
  lowConfidenceItems: number;
  warnings?: string[];
  errors?: string[];
  processingTimeMs: number;
  modelUsed: string;
  sourceFileName: string;
  sourceFileSize: number;
  pageCount?: number;
}

// Standard units mapping for normalization
const STANDARD_UNITS: Record<string, string> = {
  // Count
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
  lots: 'LOT',
  // Length
  m: 'MTR',
  mtr: 'MTR',
  meter: 'MTR',
  meters: 'MTR',
  metre: 'MTR',
  metres: 'MTR',
  mm: 'MM',
  cm: 'CM',
  ft: 'FT',
  feet: 'FT',
  inch: 'INCH',
  inches: 'INCH',
  // Weight
  kg: 'KG',
  kgs: 'KG',
  kilogram: 'KG',
  kilograms: 'KG',
  g: 'GM',
  gm: 'GM',
  gram: 'GM',
  grams: 'GM',
  ton: 'TON',
  tons: 'TON',
  mt: 'MT',
  // Volume
  l: 'LTR',
  ltr: 'LTR',
  liter: 'LTR',
  liters: 'LTR',
  litre: 'LTR',
  litres: 'LTR',
  ml: 'ML',
  // Area
  sqm: 'SQM',
  sqft: 'SQFT',
  // Time
  hr: 'HR',
  hrs: 'HR',
  hour: 'HR',
  hours: 'HR',
  day: 'DAY',
  days: 'DAY',
  month: 'MONTH',
  months: 'MONTH',
};

function normalizeUnit(unit: string): string {
  const normalized = unit.toLowerCase().trim();
  return STANDARD_UNITS[normalized] || unit.toUpperCase();
}

/**
 * Parse quantity string to number
 */
function parseQuantity(quantityStr: string): number {
  // Remove commas and spaces
  const cleaned = quantityStr.replace(/,/g, '').replace(/\s/g, '').trim();

  // Try to parse as number
  const parsed = parseFloat(cleaned);
  if (!isNaN(parsed) && parsed > 0) {
    return parsed;
  }

  return 0;
}

/**
 * Extract quantity and unit from a combined string like "10 nos" or "5.5 kg"
 */
function extractQuantityAndUnit(text: string): { quantity: number; unit: string } | null {
  // Pattern: number followed by optional space and unit
  const pattern = /^([\d,]+\.?\d*)\s*([a-zA-Z]+\.?)$/i;
  const match = text.trim().match(pattern);

  if (match) {
    const quantity = parseQuantity(match[1]);
    const unit = normalizeUnit(match[2]);
    if (quantity > 0) {
      return { quantity, unit };
    }
  }

  return null;
}

/**
 * Process Document AI response and extract line items
 * Uses 'any' type for document parameter to avoid complex nested type matching
 * with Google's protobuf-generated types
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function processDocumentAIResponse(
  document: any,
  warnings: string[]
): { header: ParsedPRHeader; items: ParsedLineItem[] } {
  const items: ParsedLineItem[] = [];
  const header: ParsedPRHeader = { confidence: 0.5 };
  const fullText = document.text || '';

  // Process tables if available
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

      // Map column indices
      const columnMap = detectColumnMapping(columnHeaders);

      // Process body rows
      const bodyRows = table.bodyRows || [];
      for (const row of bodyRows) {
        const cells = row.cells || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cellTexts: string[] = cells.map((cell: any) => extractTextFromCell(cell, fullText));

        // Extract item from row based on column mapping
        const item = extractItemFromRow(cellTexts, columnMap, lineNumber);
        if (item) {
          items.push(item);
          lineNumber++;
        }
      }
    }
  }

  // If no tables found, try to extract from entities
  if (items.length === 0 && document.entities) {
    const entityItems = extractFromEntities(document.entities, lineNumber);
    items.push(...entityItems);

    // Extract header info from entities
    for (const entity of document.entities) {
      if (entity.type === 'document_title' && entity.mentionText) {
        header.title = entity.mentionText;
      } else if (entity.type === 'document_date' && entity.mentionText) {
        header.documentDate = entity.mentionText;
      } else if (entity.type === 'vendor_name' && entity.mentionText) {
        header.vendor = entity.mentionText;
      }
    }
  }

  // If still no items, try text-based extraction
  if (items.length === 0) {
    warnings.push('No tables or entities detected. Attempting text-based extraction.');
    const textItems = extractFromText(fullText, lineNumber);
    items.push(...textItems);
  }

  return { header, items };
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
 * Detect column mapping from header texts
 */
function detectColumnMapping(headers: string[]): Record<string, number> {
  const mapping: Record<string, number> = {};

  const patterns: Record<string, RegExp[]> = {
    lineNumber: [/^(s\.?\s*no|sr\.?\s*no|sl\.?\s*no|#|line|item\s*no)/i],
    description: [/^(description|item|particulars|details|material|name)/i],
    specification: [/^(spec|specification|technical)/i],
    quantity: [/^(qty|quantity|qnty|q'ty)/i],
    unit: [/^(unit|uom|u\/m)/i],
    equipmentCode: [/^(equipment|equip|tag|code|eq\.?\s*code)/i],
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
 * Extract item from a table row
 */
function extractItemFromRow(
  cells: string[],
  columnMap: Record<string, number>,
  lineNumber: number
): ParsedLineItem | null {
  // Get description - this is required
  const descriptionIdx = columnMap.description ?? -1;
  const description = descriptionIdx >= 0 ? cells[descriptionIdx] : '';

  if (!description || description.trim().length < 3) {
    return null;
  }

  // Get quantity and unit
  let quantity = 1;
  let unit = 'NOS';

  const quantityIdx = columnMap.quantity ?? -1;
  if (quantityIdx >= 0 && cells[quantityIdx]) {
    const qtyText = cells[quantityIdx].trim();

    // Check if quantity contains unit
    const extracted = extractQuantityAndUnit(qtyText);
    if (extracted) {
      quantity = extracted.quantity;
      unit = extracted.unit;
    } else {
      quantity = parseQuantity(qtyText);
    }
  }

  const unitIdx = columnMap.unit ?? -1;
  if (unitIdx >= 0 && cells[unitIdx]) {
    unit = normalizeUnit(cells[unitIdx]);
  }

  // Calculate confidence
  const descConfidence = description.length > 10 ? 0.9 : 0.6;
  const qtyConfidence = quantity > 0 ? 0.9 : 0.3;
  const unitConfidence = unit && unit !== 'NOS' ? 0.85 : 0.7;

  const item: ParsedLineItem = {
    lineNumber,
    description: description.trim(),
    quantity: quantity > 0 ? quantity : 1,
    unit,
    confidence: {
      description: descConfidence,
      quantity: qtyConfidence,
      unit: unitConfidence,
      overall: (descConfidence + qtyConfidence + unitConfidence) / 3,
    },
    sourceText: cells.join(' | '),
  };

  // Add optional fields
  const specIdx = columnMap.specification ?? -1;
  if (specIdx >= 0 && cells[specIdx]) {
    item.specification = cells[specIdx].trim();
  }

  const equipCodeIdx = columnMap.equipmentCode ?? -1;
  if (equipCodeIdx >= 0 && cells[equipCodeIdx]) {
    item.equipmentCode = cells[equipCodeIdx].trim();
  }

  const makeModelIdx = columnMap.makeModel ?? -1;
  if (makeModelIdx >= 0 && cells[makeModelIdx]) {
    item.makeModel = cells[makeModelIdx].trim();
  }

  const remarksIdx = columnMap.remarks ?? -1;
  if (remarksIdx >= 0 && cells[remarksIdx]) {
    item.remarks = cells[remarksIdx].trim();
  }

  return item;
}

/**
 * Extract items from Document AI entities
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFromEntities(entities: any[], startLineNumber: number): ParsedLineItem[] {
  const items: ParsedLineItem[] = [];
  let lineNumber = startLineNumber;

  // Group entities by potential line items
  const lineItems = entities.filter(
    (e) => e.type === 'line_item' || e.type === 'item' || e.type === 'product'
  );

  for (const entity of lineItems) {
    if (entity.mentionText && entity.mentionText.trim().length > 3) {
      items.push({
        lineNumber: lineNumber++,
        description: entity.mentionText.trim(),
        quantity: 1,
        unit: 'NOS',
        confidence: {
          description: entity.confidence ?? 0.5,
          quantity: 0.5,
          unit: 0.5,
          overall: entity.confidence ?? 0.5,
        },
        sourceText: entity.mentionText,
      });
    }
  }

  return items;
}

/**
 * Extract items from plain text (fallback)
 */
function extractFromText(text: string, startLineNumber: number): ParsedLineItem[] {
  const items: ParsedLineItem[] = [];
  let lineNumber = startLineNumber;

  // Split into lines and try to detect item patterns
  const lines = text.split('\n').filter((line) => line.trim().length > 10);

  // Pattern for numbered items: "1. Description" or "1) Description"
  const numberedPattern = /^\s*(\d+)[.\)]\s+(.+)/;

  // Pattern for bullet points
  const bulletPattern = /^\s*[-•*]\s+(.+)/;

  for (const line of lines) {
    let description = '';
    let isItem = false;

    // Check numbered pattern
    const numberedMatch = line.match(numberedPattern);
    if (numberedMatch) {
      description = numberedMatch[2].trim();
      isItem = true;
    }

    // Check bullet pattern
    if (!isItem) {
      const bulletMatch = line.match(bulletPattern);
      if (bulletMatch) {
        description = bulletMatch[1].trim();
        isItem = true;
      }
    }

    if (isItem && description.length > 5) {
      // Try to extract quantity from description
      let quantity = 1;
      let unit = 'NOS';

      // Pattern: "... qty: 10 nos" or "... (10 nos)"
      const qtyPattern = /(?:qty|quantity)?:?\s*(\d+)\s*([a-zA-Z]+)?/i;
      const qtyMatch = description.match(qtyPattern);
      if (qtyMatch) {
        quantity = parseQuantity(qtyMatch[1]);
        if (qtyMatch[2]) {
          unit = normalizeUnit(qtyMatch[2]);
        }
        // Remove quantity from description
        description = description.replace(qtyPattern, '').trim();
      }

      items.push({
        lineNumber: lineNumber++,
        description,
        quantity: quantity > 0 ? quantity : 1,
        unit,
        confidence: {
          description: 0.6,
          quantity: qtyMatch ? 0.7 : 0.3,
          unit: qtyMatch ? 0.7 : 0.3,
          overall: 0.5,
        },
        sourceText: line.trim(),
      });
    }
  }

  return items;
}

/**
 * Main Cloud Function: Parse Document for PR Creation
 */
export const parseDocumentForPR = onCall(
  {
    region: 'asia-south1',
    memory: '1GiB',
    timeoutSeconds: 300,
    maxInstances: 10,
  },
  async (request): Promise<DocumentParsingResult> => {
    const startTime = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];

    // Validate auth
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const data = request.data as DocumentParsingRequest;
    logger.info('Document parsing request received', {
      fileName: data.fileName,
      storagePath: data.storagePath,
      mimeType: data.mimeType,
      fileSize: data.fileSize,
      userId: request.auth.uid,
    });

    // Validate request
    if (!data.storagePath) {
      throw new HttpsError('invalid-argument', 'Storage path is required');
    }

    if (!data.mimeType) {
      throw new HttpsError('invalid-argument', 'MIME type is required');
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

      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        throw new HttpsError('not-found', `File not found: ${data.storagePath}`);
      }

      // Download file content
      const [fileContent] = await file.download();
      logger.info('File downloaded', { size: fileContent.length });

      // Initialize Document AI client
      // The processor must be created in Google Cloud Console:
      // 1. Enable Document AI API
      // 2. Create a Form Parser processor
      // 3. Set DOCUMENT_AI_PROCESSOR_ID in environment
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
        // Convert DOC to PDF first (Document AI doesn't support DOC directly)
        warnings.push('DOC format may have reduced parsing accuracy. PDF recommended.');
        docAIMimeType = 'application/pdf';
      }

      // Process document
      logger.info('Sending to Document AI', {
        processor: processorName,
        mimeType: docAIMimeType,
      });

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

      // Calculate statistics
      const highConfidenceItems = items.filter((i) => i.confidence.overall > 0.8).length;
      const lowConfidenceItems = items.filter((i) => i.confidence.overall < 0.5).length;

      // Add warnings for low confidence items
      if (lowConfidenceItems > 0) {
        warnings.push(
          `${lowConfidenceItems} item(s) have low confidence and may need manual review.`
        );
      }

      if (items.length === 0) {
        warnings.push(
          'No line items could be extracted. The document may not contain structured item data.'
        );
      }

      const processingTimeMs = Date.now() - startTime;

      // Log parsing job to Firestore for audit
      const db = admin.firestore();
      await db.collection('PARSING_JOBS').add({
        fileName: data.fileName,
        storagePath: data.storagePath,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        status: 'COMPLETED',
        itemsFound: items.length,
        highConfidenceItems,
        lowConfidenceItems,
        processingTimeMs,
        requestedBy: request.auth.uid,
        requestedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logger.info('Document parsing completed', {
        itemsFound: items.length,
        highConfidence: highConfidenceItems,
        lowConfidence: lowConfidenceItems,
        processingTimeMs,
      });

      return {
        success: true,
        header,
        items,
        totalItemsFound: items.length,
        highConfidenceItems,
        lowConfidenceItems,
        warnings: warnings.length > 0 ? warnings : undefined,
        errors: errors.length > 0 ? errors : undefined,
        processingTimeMs,
        modelUsed: 'Google Document AI - Form Parser',
        sourceFileName: data.fileName,
        sourceFileSize: data.fileSize,
        pageCount: document.pages?.length,
      };
    } catch (error) {
      logger.error('Document parsing failed', { error });

      // Log failed job
      const db = admin.firestore();
      await db.collection('PARSING_JOBS').add({
        fileName: data.fileName,
        storagePath: data.storagePath,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
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
        `Document parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
);
