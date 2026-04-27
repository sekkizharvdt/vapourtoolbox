/**
 * Parse Vendor Quote (no RFQ context)
 *
 * Lighter sibling of `parseOfferDocument` for the "Log Vendor Quote" flow.
 * Used when a quote is received outside the in-app RFQ flow (phone, email,
 * WhatsApp, walk-in, trade show), and so there's no RFQ items array to match
 * against. Returns extracted header metadata plus free-text line items.
 *
 * The user picks the master record (material / service / bought-out) for
 * each row in the UI — Claude does NOT propose matches here, by design.
 *
 * Footer-level charges and discounts (freight, P&F, "less 5% on subtotal")
 * are emitted as `NOTE` line items so the grand-total math collapses to a
 * single rule across every row: `amount = quantity × unitPrice`.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import Anthropic from '@anthropic-ai/sdk';
import { anthropicApiKey } from './parseOfferWithClaude';

interface ParseQuoteRequest {
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

interface ParsedQuoteHeader {
  vendorOfferNumber?: string;
  vendorOfferDate?: string;
  validityDate?: string;
  currency?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  warrantyTerms?: string;
  remarks?: string;
}

type QuoteItemType = 'MATERIAL' | 'SERVICE' | 'BOUGHT_OUT' | 'NOTE';

interface ParsedQuoteItem {
  lineNumber: number;
  description: string;
  /** Best-effort category guess from the description. The user can override. */
  itemType: QuoteItemType;
  quantity: number;
  unit: string;
  unitPrice: number;
  /** May be negative for footer discounts emitted as NOTE rows. */
  amount: number;
  gstRate?: number;
  deliveryPeriod?: string;
  makeModel?: string;
  vendorNotes?: string;
}

interface ParseQuoteResult {
  success: boolean;
  header: ParsedQuoteHeader;
  items: ParsedQuoteItem[];
  warnings: string[];
  error?: string;
}

const PROMPT = `You are a document-parsing assistant for vendor quotations / offers (often Indian EPC vendors).

Extract the header and line-item pricing from the document. Do NOT invent data — return null / empty arrays if a field isn't present.

Return ONLY valid JSON in this exact shape (no prose before or after):

{
  "header": {
    "vendorOfferNumber": "string or null",
    "vendorOfferDate": "string DD/MM/YYYY or null",
    "validityDate": "string DD/MM/YYYY or null",
    "currency": "INR / USD / EUR / GBP / SGD / AED — default INR if unclear",
    "paymentTerms": "string or null",
    "deliveryTerms": "string or null",
    "warrantyTerms": "string or null",
    "remarks": "string or null — anything noteworthy that doesn't fit elsewhere"
  },
  "items": [
    {
      "lineNumber": 1,
      "description": "exactly as the vendor wrote it",
      "itemType": "MATERIAL | SERVICE | BOUGHT_OUT | NOTE",
      "quantity": number,
      "unit": "NOS | KG | MTR | SET | LOT | EA | HR | DAY",
      "unitPrice": number,
      "amount": number,
      "gstRate": number or null,
      "deliveryPeriod": "string or null",
      "makeModel": "string or null",
      "vendorNotes": "string or null"
    }
  ]
}

Critical rules:
1. ALWAYS include EVERY priced line from the document.
2. If validity is given as "30 days from offer date", compute the absolute date (DD/MM/YYYY) using vendorOfferDate.
3. Per-line discounts: fold into the line's unitPrice. E.g. "list 100, net 95" → unitPrice = 95. Do NOT emit a separate row.
4. Footer discounts: emit a separate row with itemType "NOTE", description like "Discount – 5% on subtotal", quantity 1, unit "LOT", unitPrice = NEGATIVE value of the discount. Same for any "Less:" lines.
5. Footer charges (freight, P&F, packing, insurance, transportation, erection, installation when listed separately): emit as itemType "NOTE" rows with positive unitPrice.
6. GST stays per-line on gstRate — never emit GST as its own NOTE row.
7. Best-effort itemType classification:
   - SERVICE for testing, inspection, design, engineering, erection, commissioning, training, supervision, AMC, study, consulting.
   - BOUGHT_OUT for branded standard equipment (pumps, valves, motors, instruments where vendor is reselling a manufacturer's product).
   - MATERIAL for raw materials, plates, pipes, fasteners, fabricated parts.
   - NOTE only for footer charges / discounts / non-priced clarifications (rule 4 & 5).
   When unclear, prefer MATERIAL — the user can override.
8. unitPrice and amount must be plain numbers (no currency symbols, no commas).
9. If quantity is missing, assume 1.
10. If unit is missing, default to "NOS".`;

export const parseQuote = onCall(
  {
    region: 'asia-south1',
    memory: '1GiB',
    timeoutSeconds: 300,
    maxInstances: 10,
    secrets: [anthropicApiKey],
  },
  async (request): Promise<ParseQuoteResult> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const data = request.data as ParseQuoteRequest;
    const warnings: string[] = [];

    if (!data.storagePath) {
      throw new HttpsError('invalid-argument', 'Storage path is required');
    }

    const supportedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];
    if (!supportedTypes.includes(data.mimeType)) {
      throw new HttpsError(
        'invalid-argument',
        `Unsupported file type: ${data.mimeType}. Supported: PDF, JPEG, PNG, GIF, WEBP.`
      );
    }

    const maxSize = 20 * 1024 * 1024;
    if (data.fileSize > maxSize) {
      throw new HttpsError(
        'invalid-argument',
        `File too large: ${data.fileSize} bytes. Maximum: 20 MB.`
      );
    }

    const apiKey = anthropicApiKey.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'ANTHROPIC_API_KEY secret not configured');
    }

    const bucket = admin.storage().bucket();
    const file = bucket.file(data.storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      throw new HttpsError('not-found', `File not found at ${data.storagePath}`);
    }

    const [fileContent] = await file.download();
    const base64Content = fileContent.toString('base64');

    const client = new Anthropic({ apiKey });

    let response;
    try {
      response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: data.mimeType as 'application/pdf',
                  data: base64Content,
                },
              },
              {
                type: 'text',
                text: 'Parse this vendor quotation. Return only the JSON described in the system prompt.',
              },
            ],
          },
        ],
      });
    } catch (err) {
      logger.error('[parseQuote] Claude API call failed', {
        error: err instanceof Error ? err.message : String(err),
        fileName: data.fileName,
      });
      throw new HttpsError(
        'internal',
        `Claude parsing failed: ${err instanceof Error ? err.message : 'unknown error'}`
      );
    }

    const textBlock = response.content.find((b) => b.type === 'text');
    const responseText = textBlock?.type === 'text' ? textBlock.text : '';

    let parsed: { header?: ParsedQuoteHeader; items?: ParsedQuoteItem[] };
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON object found in Claude response');
      }
      parsed = JSON.parse(jsonMatch[0]);
    } catch (err) {
      logger.error('[parseQuote] Failed to parse Claude response as JSON', {
        responseText: responseText.slice(0, 500),
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        success: false,
        header: {},
        items: [],
        warnings: [],
        error: 'Could not parse the document — Claude returned an unexpected response.',
      };
    }

    const header: ParsedQuoteHeader = parsed.header ?? {};
    const rawItems = Array.isArray(parsed.items) ? parsed.items : [];

    // Light validation pass: ensure required numeric fields parse, and renumber
    // line numbers in case Claude duplicated or skipped any.
    const items: ParsedQuoteItem[] = rawItems.map((item, idx): ParsedQuoteItem => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const amount = Number(item.amount);
      const validQty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
      const validPrice = Number.isFinite(unitPrice) ? unitPrice : 0;
      const validAmount = Number.isFinite(amount) ? amount : validQty * validPrice;
      const itemType: QuoteItemType =
        item.itemType === 'SERVICE' ||
        item.itemType === 'BOUGHT_OUT' ||
        item.itemType === 'NOTE' ||
        item.itemType === 'MATERIAL'
          ? item.itemType
          : 'MATERIAL';

      return {
        lineNumber: idx + 1,
        description: (item.description ?? '').trim() || `Line ${idx + 1}`,
        itemType,
        quantity: validQty,
        unit: (item.unit ?? 'NOS').toUpperCase(),
        unitPrice: validPrice,
        amount: validAmount,
        ...(item.gstRate != null &&
          Number.isFinite(Number(item.gstRate)) && { gstRate: Number(item.gstRate) }),
        ...(item.deliveryPeriod && { deliveryPeriod: item.deliveryPeriod }),
        ...(item.makeModel && { makeModel: item.makeModel }),
        ...(item.vendorNotes && { vendorNotes: item.vendorNotes }),
      };
    });

    if (items.length === 0) {
      warnings.push(
        'No line items were extracted. The document may not have a standard quotation layout.'
      );
    }

    logger.info('[parseQuote] Parsed successfully', {
      fileName: data.fileName,
      itemCount: items.length,
      hasHeader: Object.keys(header).length > 0,
      usage: response.usage,
    });

    return { success: true, header, items, warnings };
  }
);
