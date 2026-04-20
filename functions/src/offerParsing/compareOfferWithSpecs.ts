/**
 * Compare Offer With PR/RFQ Specs (Claude technical validation)
 *
 * Procurement review item #27. After an offer has been uploaded and parsed,
 * the buyer can ask Claude to read the offer together with every PR / RFQ
 * attachment (technical specs, drawings, datasheets, certificates) and flag
 * deviations — wrong material grade, missing items, quantity mismatches,
 * make/model substitutions, etc.
 *
 * The function is a separate callable (not folded into the parser) because
 * downloading and feeding multiple PDFs into Claude takes longer than a
 * plain parse and the buyer should be able to skip the check when they
 * already trust the vendor.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import Anthropic from '@anthropic-ai/sdk';
import { anthropicApiKey } from './parseOfferWithClaude';

/** Maximum supporting documents we'll hand to Claude in one call. Each adds
 *  to the token budget and processing time; most RFQs have 1–5 attachments. */
const MAX_SPEC_DOCUMENTS = 8;
/** Per-document size cap (bytes). 20 MB matches the upload ceiling on the
 *  `parsing/` storage bucket; past that we drop the doc with a warning. */
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

interface RFQItemContext {
  id: string;
  lineNumber: number;
  description: string;
  quantity: number;
  unit: string;
}

interface SpecAttachment {
  storagePath: string;
  fileName: string;
  attachmentType?: string; // e.g. TECHNICAL_SPEC, DATASHEET, DRAWING
  mimeType?: string;
}

interface CompareOfferWithSpecsRequest {
  offerStoragePath: string;
  offerFileName: string;
  offerMimeType: string;
  specAttachments: SpecAttachment[];
  rfqNumber: string;
  vendorName: string;
  rfqItems: RFQItemContext[];
}

interface ParsedDeviation {
  category?: string;
  severity?: string;
  rfqItemLineNumber?: number;
  field?: string;
  specValue?: string;
  offerValue?: string;
  message?: string;
  recommendation?: string;
}

interface CompareOfferWithSpecsResponse {
  success: boolean;
  error?: string;
  deviations: ParsedDeviation[];
  modelUsed: string;
  processingTimeMs: number;
  /** Attachments we actually sent to Claude (fileName only, for traceability). */
  documentsConsidered: string[];
  /** Attachments we skipped and why — surfaced in the UI as warnings. */
  documentsSkipped: Array<{ fileName: string; reason: string }>;
}

const SYSTEM_PROMPT = `You are a procurement technical validation assistant for an EPC (Engineering, Procurement, Construction) contractor.

You will be given:
1. A vendor's quotation / offer PDF.
2. One or more PR/RFQ specification documents (technical specifications, datasheets, engineering drawings, and compliance certificates) the buyer sent to the vendor.

Your job is to compare the offer against the specifications and return a structured list of deviations — any place where the vendor is proposing something different from what was specified.

What counts as a deviation:
- Material grade / composition different from spec (e.g. SS304 offered where SS316 was specified).
- Quantity in the offer doesn't match the RFQ quantity.
- Make / model / brand different from what the spec required or approved.
- Dimensions, capacity, rating, or performance below what the spec calls for.
- Missing items (spec lists 5 items, offer only quotes 4).
- Extra items in the offer that weren't requested.
- Missing test certificates, quality markings, or compliance documents.
- Commercial terms that diverge from the RFQ (warranty shorter, delivery longer, etc.).

What is NOT a deviation:
- Items that match the spec or are clearly improvements the buyer asked for.
- Minor wording differences in descriptions when the technical intent is the same.
- Pricing differences (handled separately by the comparison flow).

For each deviation, grade severity:
- HIGH: compromises fit/function/safety; the offer should be rejected or clarified before award.
- MEDIUM: functional impact — needs buyer confirmation but may be acceptable.
- LOW: cosmetic or minor — note but not blocking.

Return ONLY valid JSON in this exact shape (no prose before or after):

{
  "deviations": [
    {
      "category": "MATERIAL_SPEC | QUANTITY | MAKE_MODEL | DIMENSION | MISSING_ITEM | EXTRA_ITEM | PERFORMANCE | CERTIFICATION | COMMERCIAL | OTHER",
      "severity": "HIGH | MEDIUM | LOW",
      "rfqItemLineNumber": number or null,
      "field": "short human label, e.g. 'Material grade', 'Nominal diameter', 'Warranty'",
      "specValue": "what the PR/RFQ spec required (null if unknown)",
      "offerValue": "what the offer proposes (null if item is missing from offer)",
      "message": "one-sentence summary of the deviation",
      "recommendation": "suggested next action for the buyer (optional)"
    }
  ]
}

If nothing meaningful is different, return {"deviations": []}. Do not invent deviations to fill the list.`;

export const compareOfferWithSpecs = onCall(
  {
    region: 'asia-south1',
    memory: '1GiB',
    timeoutSeconds: 300,
    maxInstances: 5,
    secrets: [anthropicApiKey],
  },
  async (request): Promise<CompareOfferWithSpecsResponse> => {
    const startTime = Date.now();

    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const data = request.data as CompareOfferWithSpecsRequest;

    if (!data.offerStoragePath) {
      throw new HttpsError('invalid-argument', 'offerStoragePath is required');
    }
    if (!Array.isArray(data.specAttachments)) {
      throw new HttpsError('invalid-argument', 'specAttachments must be an array');
    }
    if (data.specAttachments.length === 0) {
      return {
        success: true,
        deviations: [],
        modelUsed: 'claude-sonnet-4-20250514',
        processingTimeMs: Date.now() - startTime,
        documentsConsidered: [],
        documentsSkipped: [],
      };
    }

    const bucket = admin.storage().bucket();
    const client = new Anthropic({ apiKey: anthropicApiKey.value() });

    // Download the offer PDF
    let offerBase64: string;
    try {
      const offerFile = bucket.file(data.offerStoragePath);
      const [offerBuffer] = await offerFile.download();
      offerBase64 = offerBuffer.toString('base64');
    } catch (err) {
      logger.error('[compareOfferWithSpecs] Failed to download offer', {
        path: data.offerStoragePath,
        error: err,
      });
      throw new HttpsError('internal', 'Could not download the offer document');
    }

    // Download each spec attachment (cap at MAX_SPEC_DOCUMENTS, skip oversized)
    const documentsConsidered: string[] = [];
    const documentsSkipped: Array<{ fileName: string; reason: string }> = [];
    const specBlocks: Array<{
      type: 'document';
      source: { type: 'base64'; media_type: 'application/pdf'; data: string };
      title?: string;
    }> = [];

    for (const att of data.specAttachments.slice(0, MAX_SPEC_DOCUMENTS)) {
      // Claude's document input currently supports PDFs only (via SDK).
      // Images / DWG / Office docs are skipped with a warning — the UI tells
      // the buyer which files Claude didn't look at.
      const isPdf =
        (att.mimeType || '').toLowerCase() === 'application/pdf' ||
        att.fileName.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        documentsSkipped.push({
          fileName: att.fileName,
          reason: 'Claude currently accepts PDF spec documents only',
        });
        continue;
      }
      try {
        const [buffer] = await bucket.file(att.storagePath).download();
        if (buffer.byteLength > MAX_DOCUMENT_BYTES) {
          documentsSkipped.push({
            fileName: att.fileName,
            reason: `Exceeds ${MAX_DOCUMENT_BYTES / (1024 * 1024)} MB size cap`,
          });
          continue;
        }
        specBlocks.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: buffer.toString('base64'),
          },
          title: att.attachmentType ? `${att.attachmentType} — ${att.fileName}` : att.fileName,
        });
        documentsConsidered.push(att.fileName);
      } catch (err) {
        logger.warn('[compareOfferWithSpecs] Failed to download spec attachment', {
          fileName: att.fileName,
          path: att.storagePath,
          error: err,
        });
        documentsSkipped.push({
          fileName: att.fileName,
          reason: 'Could not fetch from storage',
        });
      }
    }

    if (data.specAttachments.length > MAX_SPEC_DOCUMENTS) {
      for (const att of data.specAttachments.slice(MAX_SPEC_DOCUMENTS)) {
        documentsSkipped.push({
          fileName: att.fileName,
          reason: `Only the first ${MAX_SPEC_DOCUMENTS} attachments are sent to Claude in one pass`,
        });
      }
    }

    if (specBlocks.length === 0) {
      return {
        success: true,
        deviations: [],
        modelUsed: 'claude-sonnet-4-20250514',
        processingTimeMs: Date.now() - startTime,
        documentsConsidered,
        documentsSkipped,
      };
    }

    const rfqContext = data.rfqItems
      .map(
        (item) =>
          `Line ${item.lineNumber}: ${item.description} (Qty: ${item.quantity} ${item.unit})`
      )
      .join('\n');

    const userPrompt = `Compare the vendor offer against the specification documents and return deviations as JSON per the schema.

Vendor: ${data.vendorName}
RFQ: ${data.rfqNumber}

RFQ line items (use these to set \`rfqItemLineNumber\`):
${rfqContext}

The first document is the vendor offer. The remaining documents are PR/RFQ specifications.`;

    try {
      logger.info('[compareOfferWithSpecs] Calling Claude', {
        offerFile: data.offerFileName,
        specDocCount: specBlocks.length,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contentBlocks: any[] = [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: data.offerMimeType || 'application/pdf',
            data: offerBase64,
          },
          title: `Vendor Offer — ${data.offerFileName}`,
        },
        ...specBlocks,
        { type: 'text', text: userPrompt },
      ];

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: contentBlocks }],
      });

      const textContent = response.content.find((b) => b.type === 'text');
      const responseText = textContent?.type === 'text' ? textContent.text : '';
      logger.info('[compareOfferWithSpecs] Claude response received', {
        responseLength: responseText.length,
        usage: response.usage,
      });

      let parsed: { deviations?: ParsedDeviation[] } = {};
      try {
        const match = responseText.match(/\{[\s\S]*\}/);
        if (match) parsed = JSON.parse(match[0]);
      } catch (parseErr) {
        logger.error('[compareOfferWithSpecs] Claude response parse failed', {
          responseText,
          error: parseErr,
        });
        return {
          success: false,
          error: 'Claude response was not valid JSON',
          deviations: [],
          modelUsed: 'claude-sonnet-4-20250514',
          processingTimeMs: Date.now() - startTime,
          documentsConsidered,
          documentsSkipped,
        };
      }

      const deviations = Array.isArray(parsed.deviations) ? parsed.deviations : [];
      return {
        success: true,
        deviations,
        modelUsed: 'claude-sonnet-4-20250514',
        processingTimeMs: Date.now() - startTime,
        documentsConsidered,
        documentsSkipped,
      };
    } catch (err) {
      logger.error('[compareOfferWithSpecs] Claude call failed', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown Claude error',
        deviations: [],
        modelUsed: 'claude-sonnet-4-20250514',
        processingTimeMs: Date.now() - startTime,
        documentsConsidered,
        documentsSkipped,
      };
    }
  }
);
