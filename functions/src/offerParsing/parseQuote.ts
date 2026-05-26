/**
 * Parse Vendor Quote (no RFQ context)
 *
 * Lighter sibling of `parseOffer` for the "Log Vendor Quote" flow.
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
import {
  resolveBoughtOutItem,
  type ParsedBoughtOutSpec,
  type ValveSpecMin,
  type PumpSpecMin,
  type InstrumentSpecMin,
} from './boughtOutResolver';

interface ParseQuoteRequest {
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  /** Optional — used to scope auto-created materials to the right tenant. */
  tenantId?: string;
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
  /** General item name only, e.g. "Centrifugal Pump", "Motorized Control Valve". */
  description: string;
  /** Detailed technical specification text, kept separate from the name. */
  specification?: string;
  /** Best-effort category guess from the description. The user can override. */
  itemType: QuoteItemType;
  quantity: number;
  unit: string;
  unitPrice: number;
  /** May be negative for footer discounts emitted as NOTE rows. */
  amount: number;
  gstRate?: number;
  /** Per-line discount captured separately from unitPrice (applied before GST). */
  discountType?: 'PERCENT' | 'ABSOLUTE';
  discountValue?: number;
  deliveryPeriod?: string;
  makeModel?: string;
  vendorNotes?: string;
  /**
   * Bought-out category — set when Claude detected a valve/pump/instrument line.
   * Drives the auto-link/create lookup against the bought_out_items collection.
   */
  boughtOutCategory?: 'VALVE' | 'PUMP' | 'INSTRUMENT';
  /** Per-category spec (only the field for the matching category is set). */
  valveSpec?: ValveSpecMin;
  pumpSpec?: PumpSpecMin;
  instrumentSpec?: InstrumentSpecMin;
  manufacturer?: string;
  model?: string;
  /** Set after server-side resolution. Drives the UI badge per row. */
  linkStatus?: 'linked' | 'auto-created' | 'manual-needed';
  /** Populated when linkStatus is linked or auto-created. */
  boughtOutItemId?: string;
  boughtOutCode?: string;
  /** Why we couldn't auto-resolve (manual-needed only). */
  linkReason?: string;
}

interface ParseQuoteResult {
  success: boolean;
  header: ParsedQuoteHeader;
  items: ParsedQuoteItem[];
  warnings: string[];
  error?: string;
}

type ParsedQuotePayload = { header?: ParsedQuoteHeader; items?: ParsedQuoteItem[] };

/**
 * Pull a JSON object out of a model response that may be wrapped in prose or
 * markdown code fences. Scans for the first balanced `{...}` object, ignoring
 * braces inside string literals, so trailing commentary doesn't break parsing.
 * Returns the parsed payload or null (caller decides whether to retry).
 */
function extractQuoteJson(text: string): ParsedQuotePayload | null {
  if (!text) return null;

  // Strip a ```json ... ``` (or bare ```) fence if Claude wrapped the output.
  let cleaned = text.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) cleaned = fence[1].trim();

  const start = cleaned.indexOf('{');
  if (start === -1) return null;

  // Walk the string tracking brace depth, skipping over string contents.
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(cleaned.slice(start, i + 1)) as ParsedQuotePayload;
        } catch {
          break; // balanced but invalid — fall through to the lenient attempt
        }
      }
    }
  }

  // Fallback: parse from the first brace to the end (handles already-clean JSON).
  try {
    return JSON.parse(cleaned.slice(start)) as ParsedQuotePayload;
  } catch {
    return null;
  }
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
      "description": "the GENERAL item name only — e.g. Centrifugal Pump, Motorized Control Valve, Expansion Joint",
      "specification": "the detailed technical spec text (size, rating, material, model, tag, etc.) or null",
      "itemType": "MATERIAL | SERVICE | BOUGHT_OUT | NOTE",
      "quantity": number,
      "unit": "NOS | KG | MTR | SET | LOT | EA | HR | DAY",
      "unitPrice": number,
      "amount": number,
      "gstRate": number or null,
      "discountType": "PERCENT | ABSOLUTE | null",
      "discountValue": number or null,
      "deliveryPeriod": "string or null",
      "makeModel": "string or null",
      "vendorNotes": "string or null",

      // Bought-out auto-resolution (valves, pumps, instruments).
      // Set boughtOutCategory + the matching spec block when the line is
      // clearly one of these. Leave them null for plates, pipes, fittings,
      // raw materials, services, fasteners, gaskets, NOTE rows.
      // The system uses these to build a deterministic spec code and
      // auto-link (or auto-create) the matching bought-out item record.
      "boughtOutCategory": "VALVE | PUMP | INSTRUMENT | null",
      "manufacturer": "string or null — vendor's brand if mentioned",
      "model": "string or null — model number / series if mentioned",

      // VALVE — fill ONLY when boughtOutCategory=VALVE
      "valveSpec": {
        "valveType": "GATE | GLOBE | BALL | BUTTERFLY | CHECK_SWING | CHECK_DUAL_PLATE | CHECK_LIFT | PLUG | NEEDLE | DIAPHRAGM | CONTROL | null",
        "size": "string — DN50 / 2\" / 100MM (use the form the vendor used) | null",
        "pressureRating": "string — 150# / 300# / PN16 | null",
        "bodyMaterial": "string — short code preferred: SS316 / SS304 / CS / CI / DI / BRZ | null",
        "endConnection": "FLANGED_RF | FLANGED_FF | BUTT_WELD | SOCKET_WELD | THREADED | WAFER | LUG | null  — for check valves default to WAFER if not specified",
        "operation": "MANUAL | GEAR | PNEUMATIC | ELECTRIC | HYDRAULIC | SELF_ACTUATED | null  — default MANUAL if vendor didn't specify"
      },

      // PUMP — fill ONLY when boughtOutCategory=PUMP
      "pumpSpec": {
        "pumpType": "CENTRIFUGAL | GEAR | DIAPHRAGM | SCREW | RECIPROCATING | DOSING | null",
        "flowRate": "number — m³/h, convert from GPM (×0.227) or LPM (×0.06) | null",
        "head": "number — metres, convert from feet (×0.3048) | null"
      },

      // INSTRUMENT — fill ONLY when boughtOutCategory=INSTRUMENT
      "instrumentSpec": {
        "instrumentType": "TRANSMITTER | SWITCH | ANALYSER | INDICATOR | RECORDER | CONTROLLER | null",
        "variable": "PRESSURE | TEMPERATURE | FLOW | LEVEL | CONDUCTIVITY | PH | TURBIDITY | DISSOLVED_O2 | null"
      }
    }
  ]
}

Critical rules:
1. ALWAYS include EVERY priced line from the document.
1a. SPLIT each line's text into two fields: "description" = the short general item name (Centrifugal Pump, Motorized Control Valve, Expansion Joint, Pressure Gauge, etc.); "specification" = everything else (size, pressure rating, material/grade, end connection, model/tag numbers, make, technical detail). Put the GENERIC name in description and the DETAIL in specification. If a line has no separable detail, set specification to null. For NOTE rows, keep the text in description and set specification null.
2. If validity is given as "30 days from offer date", compute the absolute date (DD/MM/YYYY) using vendorOfferDate.
3. Per-line discounts: keep unitPrice as the vendor's LIST price and capture the discount separately on the SAME row. If the vendor shows a percentage ("10% off", "less 10%"), set discountType="PERCENT" and discountValue=10. If they show an absolute amount per line ("less Rs. 500"), set discountType="ABSOLUTE" and discountValue=500. If there's no per-line discount, set both to null. Do NOT emit a separate row and do NOT bake the discount into unitPrice.
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
10. If unit is missing, default to "NOS".
11. BOUGHT-OUT detection — valves, pumps, instruments only. These map to
    the dedicated 'bought_out_items' collection (NOT the materials collection):
    - Set itemType = "BOUGHT_OUT" for these lines.
    - Populate boughtOutCategory and the matching valveSpec / pumpSpec /
      instrumentSpec block with as much detail as the vendor provided.
    - Convert pump flow to m³/h (1 GPM = 0.227 m³/h; 1 LPM = 0.06 m³/h).
    - Convert pump head to metres (1 ft = 0.3048 m).
    - For valves, prefer SHORT material codes (SS316, SS304, CS, CI, DI, BRZ)
      over long forms ("Stainless Steel 316"). The deterministic code uses the
      bodyMaterial verbatim — short codes give cleaner codes.
    - If valve operation isn't mentioned, default to MANUAL.
    - For check (NRV) valves: end connection is almost always WAFER unless
      the vendor explicitly says otherwise.
    - If ANY required field for the bought-out category is missing in the
      document, leave boughtOutCategory NULL — the system will surface those
      rows for manual picking. Don't guess.
12. NEVER set boughtOutCategory for items that are clearly NOT valves /
    pumps / instruments (plates, pipes, fittings, fasteners, gaskets,
    services, motors, NOTE rows).`;

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

    // One Claude call. `strictNote` swaps the user instruction on the retry to
    // demand bare JSON. max_tokens is generous (8192) so large quotes don't get
    // truncated mid-array — the most common cause of unparseable output.
    const runParse = (strictNote?: string) =>
      client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
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
                text:
                  strictNote ??
                  'Parse this vendor quotation. Return only the JSON described in the system prompt.',
              },
            ],
          },
        ],
      });

    const responseTextOf = (resp: Anthropic.Message): string => {
      const block = resp.content.find((b) => b.type === 'text');
      return block?.type === 'text' ? block.text : '';
    };

    let response: Anthropic.Message;
    try {
      response = await runParse();
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

    let responseText = responseTextOf(response);
    let parsed = extractQuoteJson(responseText);

    // Bounded retry: if the first reply was prose / fenced / truncated, ask once
    // more for bare JSON. Only fires on failure, so the common path stays single-call.
    if (!parsed) {
      logger.warn('[parseQuote] first response unparseable — retrying with strict instruction', {
        fileName: data.fileName,
        stopReason: response.stop_reason,
        responseTextLength: responseText.length,
      });
      try {
        response = await runParse(
          'Your previous reply could not be parsed as JSON. Re-read the document and output ONLY the JSON object described in the system prompt — no prose, no explanation, no markdown code fences, nothing before or after the JSON.'
        );
        responseText = responseTextOf(response);
        parsed = extractQuoteJson(responseText);
      } catch (err) {
        logger.error('[parseQuote] retry Claude call failed', {
          error: err instanceof Error ? err.message : String(err),
          fileName: data.fileName,
        });
      }
    }

    if (!parsed) {
      // Capture full diagnostic context — stop_reason tells us about truncation,
      // content block types reveal refusal/tool_use returns, usage shows token spend.
      logger.error('[parseQuote] Failed to parse Claude response as JSON (after retry)', {
        fileName: data.fileName,
        stopReason: response.stop_reason,
        contentBlockTypes: response.content.map((b) => b.type),
        responseTextLength: responseText.length,
        responseTextHead: responseText.slice(0, 2000),
        responseTextTail: responseText.slice(-2000),
        usage: response.usage,
      });
      return {
        success: false,
        header: {},
        items: [],
        warnings: [],
        error:
          'Could not parse the document — the AI returned an unexpected response. Please try again, or enter the line items manually.',
      };
    }

    // If the model stopped because it hit the token ceiling, the tail of the
    // item list may be missing — warn the user to spot-check.
    if (response.stop_reason === 'max_tokens') {
      warnings.push(
        'The document was long and AI extraction may be incomplete — please verify the last few line items.'
      );
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
        ...(typeof item.specification === 'string' &&
          item.specification.trim() && { specification: item.specification.trim() }),
        itemType,
        quantity: validQty,
        unit: (item.unit ?? 'NOS').toUpperCase(),
        unitPrice: validPrice,
        amount: validAmount,
        ...(item.gstRate != null &&
          Number.isFinite(Number(item.gstRate)) && { gstRate: Number(item.gstRate) }),
        ...((item.discountType === 'PERCENT' || item.discountType === 'ABSOLUTE') &&
          item.discountValue != null &&
          Number.isFinite(Number(item.discountValue)) &&
          Number(item.discountValue) > 0 && {
            discountType: item.discountType,
            discountValue: Number(item.discountValue),
          }),
        ...(item.deliveryPeriod && { deliveryPeriod: item.deliveryPeriod }),
        ...(item.makeModel && { makeModel: item.makeModel }),
        ...(item.vendorNotes && { vendorNotes: item.vendorNotes }),
        // Propagate bought-out fields when Claude detected a valve / pump /
        // instrument line. The resolver below routes them at the
        // bought_out_items collection.
        ...(item.boughtOutCategory && { boughtOutCategory: item.boughtOutCategory }),
        ...(item.valveSpec && { valveSpec: item.valveSpec }),
        ...(item.pumpSpec && { pumpSpec: item.pumpSpec }),
        ...(item.instrumentSpec && { instrumentSpec: item.instrumentSpec }),
        ...(item.manufacturer && { manufacturer: item.manufacturer }),
        ...(item.model && { model: item.model }),
      };
    });

    if (items.length === 0) {
      warnings.push(
        'No line items were extracted. The document may not have a standard quotation layout.'
      );
    }

    // Resolve bought-out lines against the bought_out_items collection —
    // auto-link existing matches by deterministic spec code, auto-create
    // new ones (flagged needsReview). Non-equipment lines pass through; the
    // user picks manually for materials and services.
    //
    // Auto-create is unconditional for any authenticated procurement user.
    // New records are flagged `needsReview: true`; the master-data steward
    // (MANAGE_BOUGHT_OUT_DB) clears that flag once the spec is verified.
    // Gating creation itself was rejected because it leaves users stuck
    // mid-quote when the master is incomplete — the review queue is the
    // right control surface for keeping the catalog clean.
    const db = admin.firestore();
    let linkedCount = 0;
    let manualCount = 0;
    const currency = (header.currency ?? 'INR').toUpperCase();
    // AI proposes, the human disposes (Phase 5B). The resolver still auto-LINKS
    // a line to an existing item on an exact spec match (reuse, no duplicate),
    // but never silently CREATES a new catalog record — an unmatched line is
    // flagged 'manual-needed' so the user creates/links it via the picker,
    // where the duplicate-check (5C) runs. This is the only call site, so this
    // flag fully disables silent auto-create.
    const canAutoCreate = false;

    for (const item of items) {
      if (!item.boughtOutCategory) continue;

      let parsed: ParsedBoughtOutSpec | null = null;
      if (item.boughtOutCategory === 'VALVE' && item.valveSpec) {
        parsed = {
          category: 'VALVE',
          valve: item.valveSpec,
          ...(item.manufacturer && { manufacturer: item.manufacturer }),
          ...(item.model && { model: item.model }),
        };
      } else if (item.boughtOutCategory === 'PUMP' && item.pumpSpec) {
        parsed = {
          category: 'PUMP',
          pump: item.pumpSpec,
          ...(item.manufacturer && { manufacturer: item.manufacturer }),
          ...(item.model && { model: item.model }),
        };
      } else if (item.boughtOutCategory === 'INSTRUMENT' && item.instrumentSpec) {
        parsed = {
          category: 'INSTRUMENT',
          instrument: item.instrumentSpec,
          ...(item.manufacturer && { manufacturer: item.manufacturer }),
          ...(item.model && { model: item.model }),
        };
      }
      if (!parsed) continue;

      const result = await resolveBoughtOutItem(db, {
        parsed,
        name: item.description,
        unitPrice: item.unitPrice,
        currency,
        userId: request.auth.uid,
        canAutoCreate,
        ...(data.tenantId && { tenantId: data.tenantId }),
      });

      if (result.status === 'manual-needed') {
        item.linkStatus = 'manual-needed';
        item.linkReason = result.reason;
        manualCount++;
      } else {
        // Only 'linked' is reachable now (canAutoCreate is false).
        item.linkStatus = 'linked';
        item.boughtOutItemId = result.itemId;
        item.boughtOutCode = result.specCode;
        linkedCount++;
      }
    }

    logger.info('[parseQuote] Parsed successfully', {
      fileName: data.fileName,
      itemCount: items.length,
      hasHeader: Object.keys(header).length > 0,
      boughtOutResolution: { linked: linkedCount, manual: manualCount },
      usage: response.usage,
    });

    return { success: true, header, items, warnings };
  }
);
