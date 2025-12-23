/**
 * RFQ PDF Generation
 * Firebase Function to generate professional RFQ PDFs to send to vendors
 *
 * Supports:
 * - Individual PDFs per vendor
 * - Combined PDF for all vendors
 * - Both modes together
 * - Customizable terms and conditions
 * - Integration with Document Management module
 * - Revision tracking with version history
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

// Types
interface RFQPDFGenerationRequest {
  rfqId: string;
  options: {
    mode: 'INDIVIDUAL' | 'COMBINED' | 'BOTH';
    vendorIds?: string[];
    companyName: string;
    companyAddress?: string;
    companyPhone?: string;
    companyEmail?: string;
    companyWebsite?: string;
    companyLogoUrl?: string;
    companyGSTIN?: string;
    companyPAN?: string;
    generalTerms?: string[];
    paymentTerms?: string[];
    deliveryTerms?: string[];
    warrantyTerms?: string[];
    complianceTerms?: string[];
    penaltyTerms?: string[];
    showItemSpecifications?: boolean;
    showDeliveryDates?: boolean;
    showEquipmentCodes?: boolean;
    watermark?: string;
    customNotes?: string;
    contactPersonName?: string;
    contactPersonEmail?: string;
    contactPersonPhone?: string;
  };
  userId: string;
}

interface RFQPDFGenerationResult {
  success: boolean;
  vendorPdfs?: Array<{
    vendorId: string;
    vendorName: string;
    pdfUrl: string;
    pdfPath: string;
    documentId: string; // Document management system ID
  }>;
  combinedPdfUrl?: string;
  combinedPdfPath?: string;
  combinedDocumentId?: string; // Document management system ID
  expiresAt?: admin.firestore.Timestamp;
  error?: string;
  errors?: Array<{
    vendorId?: string;
    error: string;
  }>;
  generatedAt: admin.firestore.Timestamp;
  generatedBy: string;
  totalFiles: number;
  pdfVersion: number;
}

interface RFQData {
  id: string;
  number: string;
  title: string;
  description?: string;
  vendorIds: string[];
  vendorNames: string[];
  projectIds: string[];
  projectNames: string[];
  purchaseRequestIds: string[];
  issueDate?: admin.firestore.Timestamp;
  dueDate: admin.firestore.Timestamp;
  validityPeriod?: number;
  paymentTerms?: string;
  deliveryTerms?: string;
  warrantyTerms?: string;
  otherTerms?: string[];
  pdfVersion: number;
}

interface RFQItemData {
  id: string;
  lineNumber: number;
  description: string;
  specification?: string;
  quantity: number;
  unit: string;
  technicalSpec?: string;
  drawingNumbers?: string[];
  makeModel?: string;
  equipmentCode?: string;
  projectId?: string;
  requiredBy?: admin.firestore.Timestamp;
  deliveryLocation?: string;
  conditions?: string;
}

interface VendorData {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  billingAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

interface DocumentRecordData {
  fileName: string;
  fileUrl: string;
  storageRef: string;
  fileSize: number;
  mimeType: string;
  fileExtension: string;
  module: string;
  documentType: string;
  projectId?: string;
  projectName?: string;
  entityType: string;
  entityId: string;
  entityNumber: string;
  version: number;
  isLatest: boolean;
  previousVersionId?: string;
  revisionNotes?: string;
  title: string;
  description?: string;
  tags: string[];
  status: string;
  visibility: string;
  downloadCount: number;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: admin.firestore.Timestamp;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

/**
 * Create a document record in the documents collection
 * Returns the document ID
 */
async function createDocumentRecord(
  db: admin.firestore.Firestore,
  data: {
    fileName: string;
    storagePath: string;
    fileSize: number;
    rfq: RFQData;
    vendorId?: string;
    vendorName?: string;
    userId: string;
    userName: string;
    version: number;
    previousDocumentId?: string;
    revisionNotes?: string;
  }
): Promise<{ documentId: string; downloadUrl: string }> {
  const now = admin.firestore.Timestamp.now();

  // Get download URL (permanent, not signed)
  const bucket = admin.storage().bucket();
  const file = bucket.file(data.storagePath);
  await file.makePublic(); // Make file publicly accessible
  const downloadUrl = `https://storage.googleapis.com/${bucket.name}/${data.storagePath}`;

  // Mark previous version as superseded if exists
  if (data.previousDocumentId) {
    await db.collection('documents').doc(data.previousDocumentId).update({
      isLatest: false,
      status: 'SUPERSEDED',
      supersededBy: data.userId,
      supersededAt: now,
      updatedAt: now,
    });
  }

  const documentRecord: DocumentRecordData = {
    fileName: data.fileName,
    fileUrl: downloadUrl,
    storageRef: data.storagePath,
    fileSize: data.fileSize,
    mimeType: 'application/pdf',
    fileExtension: 'pdf',
    module: 'PROCUREMENT',
    documentType: 'RFQ_PDF',
    projectId: data.rfq.projectIds?.[0],
    projectName: data.rfq.projectNames?.[0],
    entityType: 'RFQ',
    entityId: data.rfq.id,
    entityNumber: data.rfq.number,
    version: data.version,
    isLatest: true,
    previousVersionId: data.previousDocumentId,
    revisionNotes:
      data.revisionNotes || (data.version > 1 ? `Revision ${data.version}` : undefined),
    title: data.vendorName
      ? `${data.rfq.number} - ${data.vendorName}`
      : `${data.rfq.number} - Combined`,
    description: data.vendorName
      ? `RFQ PDF for vendor: ${data.vendorName}`
      : `Combined RFQ PDF for all vendors`,
    tags: data.vendorId ? ['vendor-specific', data.vendorId] : ['combined'],
    status: 'ACTIVE',
    visibility: 'PROJECT_TEAM',
    downloadCount: 0,
    uploadedBy: data.userId,
    uploadedByName: data.userName,
    uploadedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await db.collection('documents').add(documentRecord);

  // Update previous version with next version ID
  if (data.previousDocumentId) {
    await db.collection('documents').doc(data.previousDocumentId).update({
      nextVersionId: docRef.id,
    });
  }

  return { documentId: docRef.id, downloadUrl };
}

/**
 * Find the latest document for an RFQ (optionally for a specific vendor)
 */
async function findLatestRFQDocument(
  db: admin.firestore.Firestore,
  rfqId: string,
  vendorId?: string
): Promise<{ documentId: string; version: number } | null> {
  let query = db
    .collection('documents')
    .where('entityType', '==', 'RFQ')
    .where('entityId', '==', rfqId)
    .where('documentType', '==', 'RFQ_PDF')
    .where('isLatest', '==', true);

  if (vendorId) {
    query = query.where('tags', 'array-contains', vendorId);
  } else {
    query = query.where('tags', 'array-contains', 'combined');
  }

  const snapshot = await query.limit(1).get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  const data = doc.data();
  return {
    documentId: doc.id,
    version: data.version || 1,
  };
}

/**
 * Generate RFQ PDF
 * Callable Firebase Function
 */
export const generateRFQPDF = onCall<RFQPDFGenerationRequest, Promise<RFQPDFGenerationResult>>(
  {
    region: 'asia-south1',
    timeoutSeconds: 540, // 9 minutes (Puppeteer can be slow)
    memory: '2GiB', // Puppeteer needs more memory
  },
  async (request): Promise<RFQPDFGenerationResult> => {
    const errors: Array<{ vendorId?: string; error: string }> = [];
    let totalFiles = 0;

    try {
      // Authentication check
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
      }

      const { rfqId, options } = request.data;
      const userId = request.auth.uid;

      if (!rfqId) {
        throw new HttpsError('invalid-argument', 'RFQ ID is required');
      }

      logger.info('Generating RFQ PDF', { rfqId, mode: options.mode, userId });

      const db = admin.firestore();

      // Fetch RFQ data
      const rfqDoc = await db.collection('rfqs').doc(rfqId).get();
      if (!rfqDoc.exists) {
        throw new HttpsError('not-found', 'RFQ not found');
      }
      const rfq = { id: rfqDoc.id, ...rfqDoc.data() } as RFQData;

      // Fetch RFQ items
      const itemsSnapshot = await db
        .collection('rfqItems')
        .where('rfqId', '==', rfqId)
        .orderBy('lineNumber', 'asc')
        .get();

      const items = itemsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as RFQItemData[];

      // Fetch PR numbers for reference
      const prNumbers: string[] = [];
      if (rfq.purchaseRequestIds && rfq.purchaseRequestIds.length > 0) {
        const prDocs = await Promise.all(
          rfq.purchaseRequestIds.map((prId) => db.collection('purchaseRequests').doc(prId).get())
        );
        prDocs.forEach((doc) => {
          if (doc.exists) {
            const prData = doc.data();
            if (prData?.number) {
              prNumbers.push(prData.number);
            }
          }
        });
      }

      // Determine which vendors to generate PDFs for
      const vendorIdsToProcess = options.vendorIds || rfq.vendorIds;

      // Fetch vendor details
      const vendorDocs = await Promise.all(
        vendorIdsToProcess.map((vendorId) => db.collection('entities').doc(vendorId).get())
      );

      const vendors: VendorData[] = vendorDocs
        .filter((doc) => doc.exists)
        .map((doc) => ({
          id: doc.id,
          name: doc.data()?.name || 'Unknown Vendor',
          contactPerson: doc.data()?.contactPerson,
          email: doc.data()?.email,
          phone: doc.data()?.phone,
          billingAddress: doc.data()?.billingAddress,
        }));

      const storage = admin.storage();
      const bucket = storage.bucket();

      // Fetch user name for document records
      const userDoc = await db.collection('users').doc(userId).get();
      const userName = userDoc.exists
        ? userDoc.data()?.displayName || 'Unknown User'
        : 'Unknown User';

      // Calculate new version number
      const newPdfVersion = (rfq.pdfVersion || 0) + 1;

      const result: RFQPDFGenerationResult = {
        success: true,
        generatedAt: admin.firestore.Timestamp.now(),
        generatedBy: userId,
        totalFiles: 0,
        pdfVersion: newPdfVersion,
      };

      // Generate Individual PDFs
      if (options.mode === 'INDIVIDUAL' || options.mode === 'BOTH') {
        result.vendorPdfs = [];

        for (const vendor of vendors) {
          try {
            const revisionNotes = newPdfVersion > 1 ? `PDF Version ${newPdfVersion}` : undefined;
            const pdfData = preparePDFData(
              rfq,
              items,
              prNumbers,
              options,
              vendor,
              true,
              undefined,
              newPdfVersion,
              revisionNotes
            );
            const pdfBuffer = await renderPDF(pdfData);

            const sanitizedVendorName = vendor.name.replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `rfq-pdfs/${rfqId}/${Date.now()}-${sanitizedVendorName}.pdf`;
            const file = bucket.file(fileName);

            await file.save(pdfBuffer, {
              metadata: {
                contentType: 'application/pdf',
                metadata: {
                  rfqId,
                  vendorId: vendor.id,
                  generatedBy: userId,
                  generatedAt: new Date().toISOString(),
                  version: newPdfVersion.toString(),
                },
              },
            });

            // Find previous document version for this vendor
            const previousDoc = await findLatestRFQDocument(db, rfqId, vendor.id);

            // Create document record in the document management system
            const { documentId, downloadUrl } = await createDocumentRecord(db, {
              fileName: `${rfq.number}-${sanitizedVendorName}.pdf`,
              storagePath: fileName,
              fileSize: pdfBuffer.length,
              rfq,
              vendorId: vendor.id,
              vendorName: vendor.name,
              userId,
              userName,
              version: previousDoc ? previousDoc.version + 1 : 1,
              previousDocumentId: previousDoc?.documentId,
              revisionNotes: newPdfVersion > 1 ? `PDF Version ${newPdfVersion}` : undefined,
            });

            result.vendorPdfs.push({
              vendorId: vendor.id,
              vendorName: vendor.name,
              pdfUrl: downloadUrl,
              pdfPath: fileName,
              documentId,
            });

            totalFiles++;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const errorStack = error instanceof Error ? error.stack : undefined;
            logger.error('Error generating PDF for vendor', {
              vendorId: vendor.id,
              errorMessage,
              errorStack,
            });
            errors.push({
              vendorId: vendor.id,
              error: errorMessage,
            });
          }
        }
      }

      // Generate Combined PDF
      if (options.mode === 'COMBINED' || options.mode === 'BOTH') {
        try {
          const revisionNotes = newPdfVersion > 1 ? `PDF Version ${newPdfVersion}` : undefined;
          const pdfData = preparePDFData(
            rfq,
            items,
            prNumbers,
            options,
            undefined,
            false,
            vendors,
            newPdfVersion,
            revisionNotes
          );
          const pdfBuffer = await renderPDF(pdfData);

          const fileName = `rfq-pdfs/${rfqId}/${Date.now()}-combined.pdf`;
          const file = bucket.file(fileName);

          await file.save(pdfBuffer, {
            metadata: {
              contentType: 'application/pdf',
              metadata: {
                rfqId,
                type: 'combined',
                vendorCount: vendors.length.toString(),
                generatedBy: userId,
                generatedAt: new Date().toISOString(),
                version: newPdfVersion.toString(),
              },
            },
          });

          // Find previous combined document version
          const previousDoc = await findLatestRFQDocument(db, rfqId);

          // Create document record in the document management system
          const { documentId, downloadUrl } = await createDocumentRecord(db, {
            fileName: `${rfq.number}-combined.pdf`,
            storagePath: fileName,
            fileSize: pdfBuffer.length,
            rfq,
            userId,
            userName,
            version: previousDoc ? previousDoc.version + 1 : 1,
            previousDocumentId: previousDoc?.documentId,
            revisionNotes: newPdfVersion > 1 ? `PDF Version ${newPdfVersion}` : undefined,
          });

          result.combinedPdfUrl = downloadUrl;
          result.combinedPdfPath = fileName;
          result.combinedDocumentId = documentId;
          totalFiles++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const errorStack = error instanceof Error ? error.stack : undefined;
          logger.error('Error generating combined PDF', {
            errorMessage,
            errorStack,
          });
          errors.push({
            error: errorMessage || 'Unknown error generating combined PDF',
          });
        }
      }

      // Update RFQ with latest PDF info and document IDs
      await db
        .collection('rfqs')
        .doc(rfqId)
        .update({
          pdfVersion: newPdfVersion,
          latestPdfUrl: result.combinedPdfUrl || result.vendorPdfs?.[0]?.pdfUrl,
          latestPdfDocumentId: result.combinedDocumentId || result.vendorPdfs?.[0]?.documentId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: userId,
        });

      // Save PDF record for audit trail (legacy support)
      await db.collection('rfqPdfRecords').add({
        rfqId,
        rfqNumber: rfq.number,
        mode: options.mode,
        version: newPdfVersion,
        vendorPdfs: result.vendorPdfs || [],
        combinedPdfUrl: result.combinedPdfUrl,
        combinedPdfPath: result.combinedPdfPath,
        combinedDocumentId: result.combinedDocumentId,
        termsSnapshot: {
          general: options.generalTerms,
          payment: options.paymentTerms,
          delivery: options.deliveryTerms,
          warranty: options.warrantyTerms,
        },
        downloadCount: 0,
        generatedBy: userId,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      result.totalFiles = totalFiles;
      result.success = errors.length === 0;
      if (errors.length > 0) {
        result.errors = errors;
      }

      logger.info('RFQ PDF generation completed', {
        rfqId,
        totalFiles,
        errors: errors.length,
      });

      return result;
    } catch (error) {
      logger.error('Error in RFQ PDF generation', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errors,
        generatedAt: admin.firestore.Timestamp.now(),
        generatedBy: request.auth?.uid || 'unknown',
        totalFiles,
        pdfVersion: 0,
      };
    }
  }
);

/**
 * Prepare data for PDF template
 */
function preparePDFData(
  rfq: RFQData,
  items: RFQItemData[],
  prNumbers: string[],
  options: RFQPDFGenerationRequest['options'],
  vendor?: VendorData,
  isIndividual = true,
  allVendors?: VendorData[],
  pdfVersion = 1,
  revisionNotes?: string
): Record<string, unknown> {
  const formatDate = (timestamp: admin.firestore.Timestamp | undefined): string => {
    if (!timestamp) return 'N/A';
    return timestamp.toDate().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatAddress = (address?: VendorData['billingAddress']): string => {
    if (!address) return '';
    const parts = [
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.postalCode,
      address.country,
    ].filter(Boolean);
    return parts.join(', ');
  };

  return {
    // RFQ Number
    rfqNumber: rfq.number,
    issueDate: formatDate(rfq.issueDate) || formatDate(admin.firestore.Timestamp.now()),
    dueDate: formatDate(rfq.dueDate),
    validityPeriod: rfq.validityPeriod ? `${rfq.validityPeriod} days` : undefined,
    generatedAt: new Date().toLocaleString('en-IN'),

    // Company information
    company: {
      name: options.companyName,
      address: options.companyAddress,
      phone: options.companyPhone,
      email: options.companyEmail,
      website: options.companyWebsite,
      logoUrl: options.companyLogoUrl,
      gstin: options.companyGSTIN,
      pan: options.companyPAN,
    },

    // Vendor information (for individual PDFs)
    vendor: vendor
      ? {
          name: vendor.name,
          address: formatAddress(vendor.billingAddress),
          contactPerson: vendor.contactPerson,
          email: vendor.email,
          phone: vendor.phone,
        }
      : undefined,

    // Vendors list (for combined PDF)
    vendors: allVendors?.map((v) => ({
      name: v.name,
      email: v.email,
    })),

    // RFQ details
    rfq: {
      title: rfq.title,
      description: rfq.description,
      projectNames: rfq.projectNames || [],
      purchaseRequestNumbers: prNumbers,
    },

    // Items
    items: items.map((item) => ({
      lineNumber: item.lineNumber,
      description: item.description,
      specification: item.specification,
      quantity: item.quantity,
      unit: item.unit,
      technicalSpec: item.technicalSpec,
      drawingNumbers: item.drawingNumbers,
      makeModel: item.makeModel,
      equipmentCode: item.equipmentCode,
      requiredBy: formatDate(item.requiredBy),
      deliveryLocation: item.deliveryLocation,
      conditions: item.conditions,
    })),

    // Terms (use provided options or defaults from RFQ)
    generalTerms: options.generalTerms || [
      'All specifications mentioned in this RFQ are minimum requirements.',
      'Vendor must provide detailed technical specifications with the quotation.',
      'Prices should be inclusive of all applicable taxes unless stated otherwise.',
      'Quotation validity should be minimum 30 days from submission date.',
    ],
    paymentTerms:
      options.paymentTerms || (rfq.paymentTerms ? [rfq.paymentTerms] : undefined) || undefined,
    deliveryTerms:
      options.deliveryTerms || (rfq.deliveryTerms ? [rfq.deliveryTerms] : undefined) || undefined,
    warrantyTerms:
      options.warrantyTerms || (rfq.warrantyTerms ? [rfq.warrantyTerms] : undefined) || undefined,
    complianceTerms: options.complianceTerms || undefined,
    penaltyTerms: options.penaltyTerms || undefined,

    // Contact
    contact: options.contactPersonName
      ? {
          name: options.contactPersonName,
          email: options.contactPersonEmail || options.companyEmail,
          phone: options.contactPersonPhone,
        }
      : undefined,

    // Display options
    showItemSpecifications: options.showItemSpecifications !== false,
    showDeliveryDates: options.showDeliveryDates !== false,
    showEquipmentCodes: options.showEquipmentCodes !== false,
    isIndividualVendor: isIndividual && vendor !== undefined,

    // Additional
    customNotes: options.customNotes,
    watermark: options.watermark,

    // Revision information
    pdfVersion,
    isRevision: pdfVersion > 1,
    revisionNotes,
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
  const templatePath = path.join(__dirname, 'templates', 'rfq.html');
  logger.info('Loading template from:', { templatePath });

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template file not found at: ${templatePath}`);
  }

  const templateSource = fs.readFileSync(templatePath, 'utf8');

  // Compile template
  const template = Handlebars.compile(templateSource);
  const html = template(data);

  logger.info('Template compiled, launching browser...');

  // Launch Puppeteer with @sparticuz/chromium for Cloud Functions compatibility
  let browser;
  try {
    // Configure chromium for serverless environment
    chromium.setHeadlessMode = 'shell';
    chromium.setGraphicsMode = false;

    const executablePath = await chromium.executablePath();
    logger.info('Using chromium executable:', { executablePath });

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });

    logger.info('Browser launched, creating page...');

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });

    logger.info('Page content set, generating PDF...');

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

    logger.info('PDF generated successfully', { size: pdf.length });

    return Buffer.from(pdf);
  } finally {
    if (browser) {
      await browser.close();
      logger.info('Browser closed');
    }
  }
}
