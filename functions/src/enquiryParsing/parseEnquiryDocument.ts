/**
 * Parse Enquiry Document with Claude
 *
 * Reads an SOW / RFP PDF and extracts structured fields + conditions
 * suitable for prefilling the Create Enquiry form. The PDF is sent
 * inline as base64 so we don't need a Storage round-trip at create time.
 *
 * Returns:
 *   - `fields` — the basic enquiry attributes (title, client, location, etc.)
 *   - `conditions` — every stipulation the buyer places on the bidder,
 *     categorised (Bidder qualification, Commercial, Compliance, ...)
 *
 * Companion to functions/src/offerParsing/parseOfferWithClaude.ts
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import Anthropic from '@anthropic-ai/sdk';
import * as admin from 'firebase-admin';
import { anthropicApiKey } from '../offerParsing/parseOfferWithClaude';

/* ─── Types ───────────────────────────────────────────────────────────── */

type WorkComponent = 'SURVEY' | 'ENGINEERING' | 'SUPPLY' | 'INSTALLATION' | 'OM';

type ConditionCategory =
  | 'BIDDER_QUALIFICATION'
  | 'COMMERCIAL'
  | 'COMPLIANCE'
  | 'CONFIDENTIALITY'
  | 'HSE'
  | 'REPORTING'
  | 'SUBMISSION'
  | 'PENALTY'
  | 'OTHER';

interface ParsedEnquiryFields {
  title?: string;
  description?: string;
  clientName?: string;
  clientContactPerson?: string;
  clientEmail?: string;
  clientPhone?: string;
  location?: string;
  industry?: string;
  workComponents?: WorkComponent[];
  /** ISO date (yyyy-mm-dd) if mentioned */
  requiredDeliveryDate?: string;
  /** ISO date (yyyy-mm-dd) when the document was issued, if mentioned */
  documentDate?: string;
  /** Bullet list of deliverables / outputs the buyer is asking for. */
  requirements?: string[];
  urgency?: 'STANDARD' | 'URGENT';
}

interface ParsedCondition {
  category: ConditionCategory;
  /** ~10 word summary, plain English. */
  summary: string;
  /** Exact quote from the source document. Optional but strongly preferred. */
  verbatim?: string;
}

interface ParseEnquiryRequest {
  fileName: string;
  mimeType: string;
  /** Base64-encoded raw bytes of the document. */
  fileBase64: string;
  fileSize: number;
}

interface ParseEnquiryResult {
  success: boolean;
  fields: ParsedEnquiryFields;
  conditions: ParsedCondition[];
  warnings?: string[];
  modelUsed: string;
  processingTimeMs: number;
  inputTokens?: number;
  outputTokens?: number;
}

/* ─── Prompt ─────────────────────────────────────────────────────────── */

const ENQUIRY_PARSING_PROMPT = `You are a document parsing assistant for an Indian engineering services and equipment supply firm. The firm receives RFP / Scope-of-Work documents from clients (industrial, government, research, infrastructure) and needs to capture them as structured enquiries before deciding whether to bid.

Your task is to read the attached document and produce a single JSON object with two top-level keys: "fields" and "conditions".

### "fields" — basic enquiry attributes
All fields are optional. Only include a key when you are confident; omit otherwise. Use these keys exactly:
- title           — short title of the project / enquiry, e.g. "Baseline MEP Survey – Solar MED Plant"
- description     — 2–4 sentence summary of the project (intro + objective combined). No bullet points.
- clientName      — the buyer / client organisation name, e.g. "Desolenator B.V."
- clientContactPerson — name of the named representative, if present
- clientEmail     — contact email if present
- clientPhone     — contact phone if present
- location        — project / site location, e.g. "Narippaiyur, Ramanathapuram District, Tamil Nadu, India"
- industry        — industry classification (e.g. "Desalination", "Power", "Petrochemical")
- workComponents  — array of any of: "SURVEY", "ENGINEERING", "SUPPLY", "INSTALLATION", "OM". Multi-select. Infer from the scope:
    SURVEY = inspection/audit/condition assessment of an existing site/equipment
    ENGINEERING = design, drawings, calculations, technical documentation
    SUPPLY = fabrication / procurement / supply of equipment
    INSTALLATION = erection, mechanical/electrical install, commissioning at site
    OM = operations & maintenance of an existing or new plant
- requiredDeliveryDate — ISO date (yyyy-mm-dd) for when the work is to be completed, if explicitly mentioned. Don't include offer-validity dates here.
- documentDate    — ISO date the document is dated/issued, if visible in the header
- requirements    — array of strings, each a single deliverable the buyer wants from the contractor (e.g. "Daily progress reports by 18:00 IST", "Equipment register tagged with photos"). Limit to ~10 most material items.
- urgency         — "STANDARD" or "URGENT". Mark URGENT only if the document explicitly signals urgency (the words "urgent", "expedited", or a deadline shorter than 30 days).

### "conditions" — every stipulation the buyer places on the bidder
This is the most important part. Capture EVERY requirement / condition / stipulation, not just the headline ones. Look across all sections, especially: Eligibility, Vendor Qualification, Commercial Requirements, Health & Safety, Reporting, Confidentiality, Submission. Capture sentences containing "shall", "must", "minimum", "required", "preferred", "valid".

Categorise each condition into exactly one of:
- BIDDER_QUALIFICATION — years of experience, prior similar projects, in-house team, CV requirements, references, certifications the bidder must hold
- COMMERCIAL          — offer validity, payment terms, currency, advance, retention, discount handling
- COMPLIANCE          — code/standard compliance (ASME, ISO, IBR, NACE), GST/statutory registration, insurance, warranty
- CONFIDENTIALITY     — NDA requirements, ownership of data/drawings, IP handling
- HSE                 — site safety, PPE, induction, HSE compliance
- REPORTING           — daily/weekly/monthly progress reports, review meetings, communication cadence
- SUBMISSION          — bid format/structure, references attached, CVs of key personnel, sample drawings, language
- PENALTY             — liquidated damages, performance bond, guarantee bank, warranty period
- OTHER               — anything that doesn't fit cleanly above

For each condition return:
- category   — one of the categories above
- summary    — short plain-English phrase (~10 words) describing the condition
- verbatim   — the exact quote from the document, no rewording. ALWAYS include a verbatim when you can find one.

Be exhaustive. A typical SOW will have 8–20 conditions. Don't summarise multiple conditions into one — split them.

### Output format
Return ONLY a JSON object, no preamble, no Markdown fences. Shape:

{
  "fields": { ... },
  "conditions": [
    { "category": "BIDDER_QUALIFICATION", "summary": "Min 5 yr MEP survey experience", "verbatim": "Minimum 5 years of experience conducting MEP condition surveys..." },
    ...
  ]
}

If a field is unknown, omit it. If you found no conditions, return an empty array.`;

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function safeParseJson(text: string): {
  fields?: ParsedEnquiryFields;
  conditions?: ParsedCondition[];
} {
  // Try whole text first, then a regex fallback that grabs the outer-most braces.
  try {
    return JSON.parse(text);
  } catch {
    // intentionally try the fallback
  }
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]);
  } catch (err) {
    logger.warn('[parseEnquiryDocument] JSON parse fallback failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {};
  }
}

function normaliseFields(raw: Partial<ParsedEnquiryFields> = {}): ParsedEnquiryFields {
  const allowedComponents: WorkComponent[] = [
    'SURVEY',
    'ENGINEERING',
    'SUPPLY',
    'INSTALLATION',
    'OM',
  ];
  const wc = Array.isArray(raw.workComponents)
    ? raw.workComponents.filter((c): c is WorkComponent =>
        allowedComponents.includes(c as WorkComponent)
      )
    : undefined;
  const urgency =
    raw.urgency === 'URGENT' ? 'URGENT' : raw.urgency === 'STANDARD' ? 'STANDARD' : undefined;
  return {
    ...(raw.title && { title: String(raw.title).trim() }),
    ...(raw.description && { description: String(raw.description).trim() }),
    ...(raw.clientName && { clientName: String(raw.clientName).trim() }),
    ...(raw.clientContactPerson && { clientContactPerson: String(raw.clientContactPerson).trim() }),
    ...(raw.clientEmail && { clientEmail: String(raw.clientEmail).trim() }),
    ...(raw.clientPhone && { clientPhone: String(raw.clientPhone).trim() }),
    ...(raw.location && { location: String(raw.location).trim() }),
    ...(raw.industry && { industry: String(raw.industry).trim() }),
    ...(wc && wc.length > 0 && { workComponents: wc }),
    ...(raw.requiredDeliveryDate && {
      requiredDeliveryDate: String(raw.requiredDeliveryDate).trim(),
    }),
    ...(raw.documentDate && { documentDate: String(raw.documentDate).trim() }),
    ...(Array.isArray(raw.requirements) && {
      requirements: raw.requirements.map((r) => String(r).trim()).filter(Boolean),
    }),
    ...(urgency && { urgency }),
  };
}

function normaliseConditions(raw: unknown): ParsedCondition[] {
  if (!Array.isArray(raw)) return [];
  const allowed: ConditionCategory[] = [
    'BIDDER_QUALIFICATION',
    'COMMERCIAL',
    'COMPLIANCE',
    'CONFIDENTIALITY',
    'HSE',
    'REPORTING',
    'SUBMISSION',
    'PENALTY',
    'OTHER',
  ];
  const out: ParsedCondition[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const obj = r as Record<string, unknown>;
    const category = allowed.includes(obj.category as ConditionCategory)
      ? (obj.category as ConditionCategory)
      : 'OTHER';
    const summary = typeof obj.summary === 'string' ? obj.summary.trim() : '';
    if (!summary) continue;
    const verbatim = typeof obj.verbatim === 'string' ? obj.verbatim.trim() : undefined;
    out.push({ category, summary, ...(verbatim && { verbatim }) });
  }
  return out;
}

/* ─── Cloud Function ──────────────────────────────────────────────────── */

const SUPPORTED_MIME_TYPES = ['application/pdf'];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB raw

export const parseEnquiryDocument = onCall(
  {
    region: 'asia-south1',
    memory: '1GiB',
    timeoutSeconds: 120,
    maxInstances: 5,
    secrets: [anthropicApiKey],
  },
  async (request): Promise<ParseEnquiryResult> => {
    const startTime = Date.now();
    const warnings: string[] = [];

    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in to use the parser.');
    }

    const data = request.data as ParseEnquiryRequest;

    if (!data?.fileBase64) {
      throw new HttpsError('invalid-argument', 'No document provided.');
    }
    if (!data.mimeType || !SUPPORTED_MIME_TYPES.includes(data.mimeType)) {
      throw new HttpsError('invalid-argument', 'Only PDF files are supported.');
    }
    if (typeof data.fileSize !== 'number' || data.fileSize <= 0) {
      throw new HttpsError('invalid-argument', 'Invalid file size.');
    }
    if (data.fileSize > MAX_FILE_BYTES) {
      throw new HttpsError('invalid-argument', 'File too large (max 10 MB).');
    }

    const apiKey = anthropicApiKey.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'AI parser is not configured.');
    }

    logger.info('[parseEnquiryDocument] start', {
      fileName: data.fileName,
      fileSize: data.fileSize,
      userId: request.auth.uid,
    });

    try {
      const client = new Anthropic({ apiKey });

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: ENQUIRY_PARSING_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: data.fileBase64,
                },
              },
              {
                type: 'text',
                text: 'Parse this document and return the JSON object as specified.',
              },
            ],
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      const responseText = textBlock?.type === 'text' ? textBlock.text : '';

      if (!responseText) {
        warnings.push('Model returned no text — try again or fill the form manually.');
      }

      const parsed = safeParseJson(responseText);
      const fields = normaliseFields(parsed.fields);
      const conditions = normaliseConditions(parsed.conditions);

      if (Object.keys(fields).length === 0 && conditions.length === 0) {
        warnings.push('No structured fields could be extracted. Please review the form manually.');
      }

      const processingTimeMs = Date.now() - startTime;

      // Best-effort logging — don't block on this.
      try {
        await admin
          .firestore()
          .collection('enquiryParsingJobs')
          .add({
            fileName: data.fileName,
            fileSize: data.fileSize,
            requestedBy: request.auth.uid,
            requestedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'COMPLETED',
            fieldsFound: Object.keys(fields).length,
            conditionsFound: conditions.length,
            processingTimeMs,
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          });
      } catch (logErr) {
        logger.warn('[parseEnquiryDocument] failed to write audit log', {
          error: logErr instanceof Error ? logErr.message : String(logErr),
        });
      }

      logger.info('[parseEnquiryDocument] done', {
        fieldsFound: Object.keys(fields).length,
        conditionsFound: conditions.length,
        processingTimeMs,
      });

      return {
        success: true,
        fields,
        conditions,
        warnings: warnings.length ? warnings : undefined,
        modelUsed: 'claude-sonnet-4-20250514',
        processingTimeMs,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
    } catch (error) {
      logger.error('[parseEnquiryDocument] failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Best-effort failure log
      try {
        await admin
          .firestore()
          .collection('enquiryParsingJobs')
          .add({
            fileName: data.fileName,
            fileSize: data.fileSize,
            requestedBy: request.auth.uid,
            requestedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'FAILED',
            error: error instanceof Error ? error.message : String(error),
          });
      } catch {
        // already logged above
      }
      throw new HttpsError(
        'internal',
        error instanceof Error ? error.message : 'Failed to parse document.'
      );
    }
  }
);
