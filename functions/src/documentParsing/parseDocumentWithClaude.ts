/**
 * Purchase Request Document Parsing with Claude AI
 *
 * Uses Anthropic Claude API to parse PR source documents (PDF/DOC) and
 * extract structured line-item data. Mirrors the offer-parsing pattern in
 * parseOfferWithClaude.ts — Claude is the primary parser because Google
 * Document AI Form Parser has historically returned INVALID_ARGUMENT or
 * empty results on real-world line-item documents.
 */

import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import Anthropic from '@anthropic-ai/sdk';
import * as admin from 'firebase-admin';

// Reuse the same secret the offer parser uses
export const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

interface ParsedPRLineItem {
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

export interface ClaudePRParsingResult {
  success: boolean;
  header?: ParsedPRHeader;
  items: ParsedPRLineItem[];
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

export interface ClaudePRParseRequest {
  fileName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  context?: {
    projectName?: string;
    category?: 'SERVICE' | 'RAW_MATERIAL' | 'BOUGHT_OUT';
    existingEquipmentCodes?: string[];
  };
  userId: string;
}

const PR_PARSING_PROMPT = `You are a document parsing assistant specialized in extracting structured data from internal Purchase Request source documents (engineering BOMs, material take-offs, spec sheets, drawings) for EPC projects.

Your task is to analyze the provided document and extract:
1. Header information (title, required-by date, document reference, priority hints)
2. Line items with descriptions, specifications, quantities, units, and any equipment tag/code references

Return ONLY valid JSON in exactly this format (no other text before or after):

{
  "header": {
    "title": "string or null — a short title for the PR (use document title or the item group heading)",
    "description": "string or null — a one-paragraph summary of what is being requested",
    "priority": "LOW | MEDIUM | HIGH | URGENT | null — infer from explicit markers or urgency phrases",
    "requiredBy": "string (DD/MM/YYYY) or null — required-by / delivery-by date if stated",
    "documentDate": "string (DD/MM/YYYY) or null — date on the document",
    "documentReference": "string or null — document number / reference",
    "vendor": "string or null — preferred vendor if stated",
    "customer": "string or null — end customer if stated"
  },
  "items": [
    {
      "lineNumber": 1,
      "description": "string — concise item description",
      "specification": "string or null — detailed spec / size / grade / material",
      "quantity": number,
      "unit": "NOS | KG | MTR | MM | CM | FT | SET | LOT | LTR | ML | SQM | SQFT | HR | DAY | MONTH | UNIT | EA | GM | TON | MT | INCH",
      "equipmentCode": "string or null — tag number / equipment code / item code if present",
      "makeModel": "string or null — make/model/brand if specified",
      "technicalSpec": "string or null — any technical data/datasheet reference beyond the basic description",
      "deliveryLocation": "string or null — if a site/location is specified per item",
      "remarks": "string or null — any notes or remarks against the line"
    }
  ]
}

Important rules:
- Extract ALL line items from the document, including those spanning multiple tables or pages
- Quantities must be numeric (e.g. 10, not "10 Nos") — the unit goes in the \`unit\` field
- If a quantity column contains combined text like "10 Nos", split into quantity=10 and unit=NOS
- Normalize units to the list above (NOS = numbers/pieces/pcs; MTR = m/meter/metre; etc.)
- If quantity is not specified, assume 1
- If unit is not specified, use "NOS"
- Description must be at least 3 characters and meaningful — skip filler rows, section headers, subtotals
- Equipment codes are typically short alphanumeric (e.g. "P-101", "V-02B", "HX-301/A")
- Do not invent or hallucinate data — only extract what the document states
- Return null for fields that cannot be found
- For Indian date formats, always return DD/MM/YYYY`;

export async function parseDocumentWithClaude(
  request: ClaudePRParseRequest
): Promise<ClaudePRParsingResult> {
  const startTime = Date.now();
  const warnings: string[] = [];

  logger.info('[parseDocumentWithClaude] Request received', {
    fileName: request.fileName,
    storagePath: request.storagePath,
    mimeType: request.mimeType,
  });

  const apiKey = anthropicApiKey.value();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY secret not configured');
  }

  // Claude accepts PDFs natively via the document block. DOC/DOCX are not
  // directly supported — callers should convert them to PDF or rely on the
  // Document AI fallback.
  if (request.mimeType !== 'application/pdf') {
    return {
      success: false,
      items: [],
      totalItemsFound: 0,
      highConfidenceItems: 0,
      lowConfidenceItems: 0,
      errors: [
        `Claude AI parser currently supports PDF only. Received: ${request.mimeType}. Please save the document as a PDF and try again.`,
      ],
      processingTimeMs: Date.now() - startTime,
      modelUsed: 'Claude AI (claude-sonnet-4)',
      sourceFileName: request.fileName,
      sourceFileSize: request.fileSize,
    };
  }

  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(request.storagePath);

    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`File not found: ${request.storagePath}`);
    }

    const [fileContent] = await file.download();
    logger.info('[parseDocumentWithClaude] File downloaded', {
      size: fileContent.length,
    });

    const base64Content = fileContent.toString('base64');

    const client = new Anthropic({ apiKey });

    const contextNotes: string[] = [];
    if (request.context?.projectName) {
      contextNotes.push(`Project: ${request.context.projectName}`);
    }
    if (request.context?.category) {
      contextNotes.push(`Category: ${request.context.category}`);
    }
    if (request.context?.existingEquipmentCodes?.length) {
      const codes = request.context.existingEquipmentCodes.slice(0, 40).join(', ');
      contextNotes.push(`Known equipment codes on this project: ${codes}`);
    }
    const contextBlock = contextNotes.length
      ? `Context for this Purchase Request:\n${contextNotes.join('\n')}\n\n`
      : '';

    const userPrompt = `${contextBlock}Please parse this Purchase Request source document and extract the header + line items as specified.`;

    logger.info('[parseDocumentWithClaude] Sending document to Claude');

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
                media_type: 'application/pdf',
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
      system: PR_PARSING_PROMPT,
    });

    const textContent = response.content.find((block) => block.type === 'text');
    const responseText = textContent?.type === 'text' ? textContent.text : '';

    logger.info('[parseDocumentWithClaude] Claude response received', {
      responseLength: responseText.length,
      usage: response.usage,
    });

    let parsedData: {
      header?: {
        title?: string;
        description?: string;
        priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
        requiredBy?: string;
        documentDate?: string;
        documentReference?: string;
        vendor?: string;
        customer?: string;
      };
      items?: Array<{
        lineNumber?: number;
        description?: string;
        specification?: string;
        quantity?: number;
        unit?: string;
        equipmentCode?: string;
        makeModel?: string;
        technicalSpec?: string;
        deliveryLocation?: string;
        remarks?: string;
      }>;
    };

    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }
      parsedData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      logger.error('[parseDocumentWithClaude] Failed to parse Claude response as JSON', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        responsePreview: responseText.slice(0, 500),
      });
      warnings.push(
        'Claude response could not be parsed as JSON. Try again or enter items manually.'
      );
      parsedData = { header: {}, items: [] };
    }

    const header: ParsedPRHeader = {
      title: parsedData.header?.title || undefined,
      description: parsedData.header?.description || undefined,
      priority: parsedData.header?.priority || undefined,
      requiredBy: parsedData.header?.requiredBy || undefined,
      documentDate: parsedData.header?.documentDate || undefined,
      documentReference: parsedData.header?.documentReference || undefined,
      vendor: parsedData.header?.vendor || undefined,
      customer: parsedData.header?.customer || undefined,
      confidence: 0.85,
    };

    const rawItems = parsedData.items || [];
    const items: ParsedPRLineItem[] = rawItems
      .map((item, index) => {
        const description = (item.description || '').trim();
        if (description.length < 3) return null;

        const quantity = typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1;
        const unit = normalizeUnit(item.unit || 'NOS');
        const lineNumber = typeof item.lineNumber === 'number' ? item.lineNumber : index + 1;

        const descConfidence = description.length > 10 ? 0.9 : 0.7;
        const qtyConfidence = quantity > 0 ? 0.9 : 0.4;
        const unitConfidence = unit && unit !== 'NOS' ? 0.85 : 0.75;

        const line: ParsedPRLineItem = {
          lineNumber,
          description,
          quantity,
          unit,
          confidence: {
            description: descConfidence,
            quantity: qtyConfidence,
            unit: unitConfidence,
            overall: (descConfidence + qtyConfidence + unitConfidence) / 3,
          },
        };
        if (item.specification) line.specification = item.specification.trim();
        if (item.equipmentCode) line.equipmentCode = item.equipmentCode.trim();
        if (item.makeModel) line.makeModel = item.makeModel.trim();
        if (item.technicalSpec) line.technicalSpec = item.technicalSpec.trim();
        if (item.deliveryLocation) line.deliveryLocation = item.deliveryLocation.trim();
        if (item.remarks) line.remarks = item.remarks.trim();
        return line;
      })
      .filter((i): i is ParsedPRLineItem => i !== null)
      .map((item, index) => ({ ...item, lineNumber: index + 1 }));

    const highConfidenceItems = items.filter((i) => i.confidence.overall > 0.8).length;
    const lowConfidenceItems = items.filter((i) => i.confidence.overall < 0.5).length;

    if (items.length === 0) {
      warnings.push(
        'No line items could be extracted. The document may not contain a structured item list.'
      );
    }
    if (lowConfidenceItems > 0) {
      warnings.push(`${lowConfidenceItems} item(s) have low confidence and may need review.`);
    }

    const processingTimeMs = Date.now() - startTime;

    try {
      const db = admin.firestore();
      await db.collection('PARSING_JOBS').add({
        fileName: request.fileName,
        storagePath: request.storagePath,
        mimeType: request.mimeType,
        fileSize: request.fileSize,
        status: 'COMPLETED',
        parser: 'CLAUDE',
        itemsFound: items.length,
        highConfidenceItems,
        lowConfidenceItems,
        processingTimeMs,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        requestedBy: request.userId,
        requestedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (auditError) {
      // Audit log failure should not block the parse result
      logger.warn('[parseDocumentWithClaude] Failed to write audit log', {
        error: auditError instanceof Error ? auditError.message : String(auditError),
      });
    }

    logger.info('[parseDocumentWithClaude] Parsing completed', {
      itemsFound: items.length,
      highConfidenceItems,
      lowConfidenceItems,
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
      processingTimeMs,
      modelUsed: 'Claude AI (claude-sonnet-4)',
      sourceFileName: request.fileName,
      sourceFileSize: request.fileSize,
    };
  } catch (error) {
    logger.error('[parseDocumentWithClaude] Parsing failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    try {
      const db = admin.firestore();
      await db.collection('PARSING_JOBS').add({
        fileName: request.fileName,
        storagePath: request.storagePath,
        mimeType: request.mimeType,
        fileSize: request.fileSize,
        status: 'FAILED',
        parser: 'CLAUDE',
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: request.userId,
        requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (auditError) {
      logger.warn('[parseDocumentWithClaude] Failed to write failure audit log', {
        error: auditError instanceof Error ? auditError.message : String(auditError),
      });
    }

    throw error;
  }
}

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
    lots: 'LOT',
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
    l: 'LTR',
    ltr: 'LTR',
    liter: 'LTR',
    liters: 'LTR',
    litre: 'LTR',
    litres: 'LTR',
    ml: 'ML',
    sqm: 'SQM',
    sqft: 'SQFT',
    hr: 'HR',
    hrs: 'HR',
    hour: 'HR',
    hours: 'HR',
    day: 'DAY',
    days: 'DAY',
    month: 'MONTH',
    months: 'MONTH',
  };
  const normalized = unit.toLowerCase().trim();
  return unitMap[normalized] || unit.toUpperCase();
}
