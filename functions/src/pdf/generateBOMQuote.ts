/**
 * BOM Quote PDF Generation
 * Firebase Function to generate professional techno-commercial offer PDFs
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

interface PDFGenerationRequest {
  bomId: string;
  options: Record<string, unknown>;
  userId: string;
}

interface PDFGenerationResult {
  success: boolean;
  pdfUrl?: string;
  pdfPath?: string;
  expiresAt?: admin.firestore.Timestamp;
  error?: string;
  generatedAt: admin.firestore.Timestamp;
  fileSize?: number;
}

/**
 * Generate BOM Quote PDF
 * Callable Firebase Function
 */
export const generateBOMQuotePDF = onCall<PDFGenerationRequest, Promise<PDFGenerationResult>>(
  {
    region: 'asia-south1',
    timeoutSeconds: 540, // 9 minutes (Puppeteer can be slow)
    memory: '2GiB', // Puppeteer needs more memory
  },
  async (request): Promise<PDFGenerationResult> => {
    try {
      // Authentication check
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
      }

      const { bomId, options } = request.data;

      if (!bomId) {
        throw new HttpsError('invalid-argument', 'BOM ID is required');
      }

      logger.info('Generating PDF for BOM', { bomId, userId: request.auth.uid });

      // Fetch BOM data from Firestore
      const db = admin.firestore();
      const bomDoc = await db.collection('boms').doc(bomId).get();

      if (!bomDoc.exists) {
        throw new HttpsError('not-found', 'BOM not found');
      }

      const bom = { id: bomDoc.id, ...bomDoc.data() } as Record<string, unknown>;

      // Fetch BOM items
      const itemsSnapshot = await db
        .collection('boms')
        .doc(bomId)
        .collection('items')
        .orderBy('sortOrder', 'asc')
        .get();

      const items = itemsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Record<string, unknown>[];

      // Fetch cost configuration if referenced
      let costConfig: Record<string, unknown> | null = null;
      const summary = bom.summary as Record<string, unknown> | undefined;
      if (summary?.costConfigId) {
        const configDoc = await db
          .collection('costConfigurations')
          .doc(summary.costConfigId as string)
          .get();
        if (configDoc.exists) {
          costConfig = { id: configDoc.id, ...configDoc.data() } as Record<string, unknown>;
        }
      }

      // Prepare PDF data
      const pdfData = preparePDFData(bom, items, costConfig, options);

      // Generate PDF using Puppeteer
      const pdfBuffer = await renderPDF(pdfData);

      // Upload to Firebase Storage
      const storage = admin.storage();
      const bucket = storage.bucket();
      const fileName = `bom-quotes/${bomId}/${Date.now()}-quote.pdf`;
      const file = bucket.file(fileName);

      await file.save(pdfBuffer, {
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            bomId,
            generatedBy: request.auth.uid,
            generatedAt: new Date().toISOString(),
          },
        },
      });

      // Generate signed URL (valid for 7 days)
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      const expiresAt = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      );

      logger.info('PDF generated successfully', {
        bomId,
        fileName,
        fileSize: pdfBuffer.length,
      });

      return {
        success: true,
        pdfUrl: signedUrl,
        pdfPath: fileName,
        expiresAt,
        generatedAt: admin.firestore.Timestamp.now(),
        fileSize: pdfBuffer.length,
      };
    } catch (error) {
      logger.error('Error generating PDF', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        generatedAt: admin.firestore.Timestamp.now(),
      };
    }
  }
);

/**
 * Prepare data for PDF template
 */
function preparePDFData(
  bom: Record<string, unknown>,
  items: Record<string, unknown>[],
  costConfig: Record<string, unknown> | null,
  options: Record<string, unknown>
): Record<string, unknown> {
  const formatCurrency = (money: { amount: number; currency: string }) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: money.currency,
    }).format(money.amount);
  };

  const formatDate = (timestamp: admin.firestore.Timestamp | null | undefined) => {
    if (!timestamp) return new Date().toLocaleDateString('en-IN');
    return timestamp.toDate().toLocaleDateString('en-IN');
  };

  const summary = bom.summary as Record<string, unknown>;

  return {
    // Metadata
    quoteNumber: (options.quoteNumber as string) || `Q-${Date.now()}`,
    quoteDate: formatDate(options.quoteDate as admin.firestore.Timestamp),
    validUntil: formatDate(options.validUntil as admin.firestore.Timestamp),
    preparedBy: (options.preparedBy as string) || 'Vapour Toolbox',
    generatedAt: new Date().toLocaleString('en-IN'),

    // Company information
    company: {
      name: (options.companyName as string) || 'Your Company Name',
      address: options.companyAddress as string,
      phone: options.companyPhone as string,
      email: options.companyEmail as string,
      website: options.companyWebsite as string,
      logoUrl: options.companyLogoUrl as string,
      gstin: options.companyGSTIN as string,
      pan: options.companyPAN as string,
    },

    // Customer information
    customer: {
      name: (options.customerName as string) || 'Customer Name',
      address: options.customerAddress as string,
      attention: options.customerAttention as string,
      email: options.customerEmail as string,
      phone: options.customerPhone as string,
    },

    // BOM information
    bom: {
      bomCode: bom.bomCode as string,
      name: bom.name as string,
      description: bom.description as string,
      category: bom.category as string,
      projectName: bom.projectName as string,
    },

    // Items
    items: items.map((item) => ({
      itemNumber: item.itemNumber as string,
      name: item.name as string,
      description: item.description as string,
      quantity: `${item.quantity} ${item.unit}`,
      type: item.itemType as string,
      componentType: (item.component as Record<string, unknown>)?.type,
      materialCode: (item.component as Record<string, unknown>)?.materialCode,
      weight:
        (item.calculatedProperties as Record<string, unknown>)?.totalWeight !== undefined
          ? `${(item.calculatedProperties as Record<string, unknown>).totalWeight} kg`
          : '',
      totalPrice:
        (item.cost as Record<string, unknown>)?.totalMaterialCost !== undefined
          ? formatCurrency({
              amount:
                ((item.cost as Record<string, unknown>).totalMaterialCost as { amount: number })
                  .amount +
                ((item.cost as Record<string, unknown>).totalFabricationCost as { amount: number })
                  .amount +
                ((item.cost as Record<string, unknown>).totalServiceCost as { amount: number })
                  .amount,
              currency: (
                (item.cost as Record<string, unknown>).totalMaterialCost as {
                  currency: string;
                }
              ).currency,
            })
          : '',
      level: item.level as number,
      isSubItem: (item.level as number) > 0,
    })),

    // Summary
    summary: {
      totalWeight: `${summary.totalWeight} kg`,
      itemCount: summary.itemCount,
      totalMaterialCost: formatCurrency(
        summary.totalMaterialCost as { amount: number; currency: string }
      ),
      totalFabricationCost: formatCurrency(
        summary.totalFabricationCost as { amount: number; currency: string }
      ),
      totalServiceCost: formatCurrency(
        summary.totalServiceCost as { amount: number; currency: string }
      ),
      totalDirectCost: formatCurrency(
        summary.totalDirectCost as { amount: number; currency: string }
      ),
      overhead: formatCurrency(summary.overhead as { amount: number; currency: string }),
      contingency: formatCurrency(summary.contingency as { amount: number; currency: string }),
      profit: formatCurrency(summary.profit as { amount: number; currency: string }),
      totalCost: formatCurrency(summary.totalCost as { amount: number; currency: string }),
      currency: summary.currency,
      costConfigName: costConfig?.name as string,
    },

    // Display flags
    showCostBreakdown: options.showCostBreakdown !== false,
    showIndirectCosts: options.showIndirectCosts !== false,
    showItemDetails: options.showItemDetails !== false,
    showMaterialCodes: options.showMaterialCodes !== false,
    showServices: options.showServices !== false,

    // Optional sections
    customNotes: options.customNotes as string,
    termsAndConditions: (options.customTerms as string[]) || [
      'This quotation is valid for 30 days from the date of issue.',
      'Prices are subject to change based on material cost fluctuations.',
      'All prices are in Indian Rupees (INR) unless otherwise specified.',
      'Delivery schedule will be confirmed upon receipt of purchase order.',
    ],
    paymentTerms: (options.paymentTerms as string[]) || [
      '30% advance payment with purchase order',
      '40% payment before dispatch',
      '30% payment within 30 days of delivery',
    ],
    deliveryTerms: (options.deliveryTerms as string[]) || [
      'Delivery timeline: 8-12 weeks from receipt of advance payment',
      'Delivery location: As specified in purchase order',
      'Transportation: Ex-works (freight to be borne by customer)',
    ],
    watermark: options.watermark as string,
  };
}

/**
 * Render PDF using Puppeteer and Handlebars
 */
async function renderPDF(data: Record<string, unknown>): Promise<Buffer> {
  // Register Handlebars helpers
  Handlebars.registerHelper('eq', function (a: unknown, b: unknown) {
    return a === b;
  });

  // Read template
  const templatePath = path.join(__dirname, 'templates', 'bom-quote.html');
  const templateSource = fs.readFileSync(templatePath, 'utf8');

  // Compile template
  const template = Handlebars.compile(templateSource);
  const html = template(data);

  // Launch Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });

  // Generate PDF
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20mm',
      right: '15mm',
      bottom: '20mm',
      left: '15mm',
    },
  });

  await browser.close();

  return Buffer.from(pdf);
}
