/**
 * RFQ PDF Service
 *
 * Client-side service for generating RFQ PDFs using @react-pdf/renderer.
 * Replaces the previous Puppeteer Cloud Function approach.
 *
 * Flow:
 * 1. Fetch RFQ + items + vendors + PR attachments from Firestore
 * 2. Transform data into RFQPDFData shape
 * 3. Render via @react-pdf and generate blob
 * 4. Upload blob to Firebase Storage
 * 5. Create document records in Firestore
 * 6. Return result with download URLs
 */

import React from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import type {
  RFQPDFGenerationOptions,
  RFQPDFGenerationResult,
  RFQPDFData,
  RFQPDFItem,
} from '@vapour/types';
import { generatePDFBlob } from '@/lib/pdf/pdfUtils';
import { fetchLogoAsDataUri } from '@/lib/pdf/logoUtils';
import { RFQPDFDocument } from '@/components/pdf/RFQPDFDocument';

/* ─── Interfaces ─────────────────────────────────────────── */

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

interface PRAttachment {
  fileName: string;
  attachmentType: string;
  description?: string;
  publicUrl?: string;
}

/* ─── Helpers ────────────────────────────────────────────── */

function formatTimestamp(ts: unknown): string {
  if (!ts) return 'N/A';
  const date =
    ts && typeof ts === 'object' && 'toDate' in ts
      ? (ts as { toDate: () => Date }).toDate()
      : ts instanceof Date
        ? ts
        : new Date(ts as string);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatAddress(address?: VendorData['billingAddress']): string {
  if (!address) return '';
  return [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ]
    .filter(Boolean)
    .join(', ');
}

/* ─── Document Record Management ─────────────────────────── */

async function findLatestRFQDocument(
  db: Firestore,
  rfqId: string,
  vendorId?: string
): Promise<{ documentId: string; version: number } | null> {
  const constraints = [
    where('entityType', '==', 'RFQ'),
    where('entityId', '==', rfqId),
    where('documentType', '==', 'RFQ_PDF'),
    where('isLatest', '==', true),
    vendorId
      ? where('tags', 'array-contains', vendorId)
      : where('tags', 'array-contains', 'combined'),
  ];

  const q = query(collection(db, 'documents'), ...constraints, limit(1));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  const docSnap = snapshot.docs[0]!;
  return { documentId: docSnap.id, version: docSnap.data().version || 1 };
}

async function createDocumentRecord(
  db: Firestore,
  data: {
    fileName: string;
    downloadUrl: string;
    storageRef: string;
    fileSize: number;
    rfqId: string;
    rfqNumber: string;
    tenantId?: string;
    projectId?: string;
    projectName?: string;
    vendorId?: string;
    vendorName?: string;
    userId: string;
    userName: string;
    version: number;
    previousDocumentId?: string;
    revisionNotes?: string;
  }
): Promise<string> {
  const now = Timestamp.now();

  // Supersede previous version
  if (data.previousDocumentId) {
    await updateDoc(doc(db, 'documents', data.previousDocumentId), {
      isLatest: false,
      status: 'SUPERSEDED',
      supersededBy: data.userId,
      supersededAt: now,
      updatedAt: now,
    });
  }

  const record = {
    fileName: data.fileName,
    fileUrl: data.downloadUrl,
    storageRef: data.storageRef,
    fileSize: data.fileSize,
    mimeType: 'application/pdf',
    fileExtension: 'pdf',
    module: 'PROCUREMENT',
    documentType: 'RFQ_PDF',
    ...(data.tenantId && { tenantId: data.tenantId }),
    ...(data.projectId !== undefined && { projectId: data.projectId }),
    ...(data.projectName !== undefined && { projectName: data.projectName }),
    entityType: 'RFQ',
    entityId: data.rfqId,
    entityNumber: data.rfqNumber,
    version: data.version,
    isLatest: true,
    ...(data.previousDocumentId !== undefined && { previousVersionId: data.previousDocumentId }),
    ...(data.revisionNotes !== undefined && { revisionNotes: data.revisionNotes }),
    title: data.vendorName
      ? `${data.rfqNumber} - ${data.vendorName}`
      : `${data.rfqNumber} - Combined`,
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

  const docRef = await addDoc(collection(db, 'documents'), record);

  // Link previous version forward
  if (data.previousDocumentId) {
    await updateDoc(doc(db, 'documents', data.previousDocumentId), {
      nextVersionId: docRef.id,
    });
  }

  return docRef.id;
}

/* ─── Upload helper ──────────────────────────────────────── */

async function uploadPDFBlob(
  storage: FirebaseStorage,
  blob: Blob,
  storagePath: string
): Promise<{ downloadUrl: string; fileSize: number; isLocalBlob?: boolean }> {
  try {
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, blob, { contentType: 'application/pdf' });
    const downloadUrl = await getDownloadURL(storageRef);
    return { downloadUrl, fileSize: blob.size };
  } catch (error) {
    // Fallback: if storage upload fails (e.g., 403 permission error),
    // create a local blob URL so the user can still download the PDF
    console.warn(
      `[rfqPdfService] Storage upload failed for ${storagePath}, falling back to local blob URL:`,
      error instanceof Error ? error.message : error
    );
    const localUrl = URL.createObjectURL(blob);
    return { downloadUrl: localUrl, fileSize: blob.size, isLocalBlob: true };
  }
}

/* ─── Data Preparation ───────────────────────────────────── */

function preparePDFData(
  rfq: {
    id: string;
    number: string;
    title: string;
    description?: string;
    projectNames: string[];
    dueDate: unknown;
    issueDate?: unknown;
    validityPeriod?: number;
    paymentTerms?: string;
    deliveryTerms?: string;
    warrantyTerms?: string;
  },
  items: RFQPDFItem[],
  prNumbers: string[],
  prAttachments: PRAttachment[],
  options: RFQPDFGenerationOptions,
  vendor?: VendorData,
  isIndividual = true,
  allVendors?: VendorData[]
): RFQPDFData {
  return {
    rfqNumber: rfq.number,
    issueDate: formatTimestamp(rfq.issueDate) || formatTimestamp(Timestamp.now()),
    dueDate: formatTimestamp(rfq.dueDate),
    validityPeriod: rfq.validityPeriod ? `${rfq.validityPeriod} days` : '30 Days',
    generatedAt: new Date().toLocaleString('en-IN'),

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

    vendor: vendor
      ? {
          name: vendor.name,
          address: formatAddress(vendor.billingAddress),
          contactPerson: vendor.contactPerson,
          email: vendor.email,
          phone: vendor.phone,
        }
      : undefined,

    vendors: allVendors?.map((v) => ({ name: v.name, email: v.email })),

    rfq: {
      title: rfq.title,
      description: rfq.description,
      projectNames: rfq.projectNames || [],
      purchaseRequestNumbers: prNumbers,
      attachments: prAttachments,
    },

    items,

    generalTerms: options.generalTerms || [
      'All specifications mentioned in this RFQ are minimum requirements.',
      'Vendor must provide detailed technical specifications with the quotation.',
      'Prices should be inclusive of all applicable taxes unless stated otherwise.',
      'Quotation validity should be minimum 30 days from submission date.',
    ],
    paymentTerms: options.paymentTerms || (rfq.paymentTerms ? [rfq.paymentTerms] : undefined),
    deliveryTerms: options.deliveryTerms || (rfq.deliveryTerms ? [rfq.deliveryTerms] : undefined),
    warrantyTerms: options.warrantyTerms || (rfq.warrantyTerms ? [rfq.warrantyTerms] : undefined),

    contact: options.contactPersonName
      ? {
          name: options.contactPersonName,
          email: options.contactPersonEmail || options.companyEmail || '',
          phone: options.contactPersonPhone,
        }
      : undefined,

    showItemSpecifications: options.showItemSpecifications !== false,
    showDeliveryDates: options.showDeliveryDates !== false,
    showEquipmentCodes: options.showEquipmentCodes !== false,
    isIndividualVendor: isIndividual && vendor !== undefined,

    customNotes: options.customNotes,
    watermark: options.watermark,
  };
}

/* ─── Main Entry Point ───────────────────────────────────── */

export async function generateRFQPDFs(
  db: Firestore,
  storage: FirebaseStorage,
  options: RFQPDFGenerationOptions,
  userId: string
): Promise<RFQPDFGenerationResult> {
  const errors: Array<{ vendorId?: string; error: string }> = [];
  let totalFiles = 0;

  try {
    // Fetch logo
    const logoDataUri = await fetchLogoAsDataUri();

    // Fetch RFQ
    const rfqDoc = await getDoc(doc(db, 'rfqs', options.rfqId));
    if (!rfqDoc.exists()) {
      throw new Error('RFQ not found');
    }
    const rfqData = rfqDoc.data();
    const rfq = {
      id: rfqDoc.id,
      number: rfqData.number,
      title: rfqData.title,
      description: rfqData.description,
      tenantId: rfqData.tenantId as string | undefined,
      projectNames: rfqData.projectNames || [],
      projectIds: rfqData.projectIds || [],
      purchaseRequestIds: rfqData.purchaseRequestIds || [],
      dueDate: rfqData.dueDate,
      issueDate: rfqData.issueDate,
      validityPeriod: rfqData.validityPeriod,
      paymentTerms: rfqData.paymentTerms,
      deliveryTerms: rfqData.deliveryTerms,
      warrantyTerms: rfqData.warrantyTerms,
      vendorIds: rfqData.vendorIds || [],
      pdfVersion: rfqData.pdfVersion || 0,
    };

    // Fetch items
    const itemsQ = query(
      collection(db, 'rfqItems'),
      where('rfqId', '==', options.rfqId),
      orderBy('lineNumber', 'asc')
    );
    const itemsSnap = await getDocs(itemsQ);
    const items: RFQPDFItem[] = itemsSnap.docs.map((d) => {
      const data = d.data();
      return {
        lineNumber: data.lineNumber,
        description: data.description,
        specification: data.specification,
        quantity: data.quantity,
        unit: data.unit,
        technicalSpec: data.technicalSpec,
        drawingNumbers: data.drawingNumbers,
        makeModel: data.makeModel,
        equipmentCode: data.equipmentCode,
        requiredBy: formatTimestamp(data.requiredBy),
        deliveryLocation: data.deliveryLocation,
        conditions: data.conditions,
      };
    });

    // Fetch PR numbers
    const prNumbers: string[] = [];
    for (const prId of rfq.purchaseRequestIds) {
      const prDoc = await getDoc(doc(db, 'purchaseRequests', prId));
      if (prDoc.exists()) {
        const prData = prDoc.data();
        if (prData?.number) prNumbers.push(prData.number);
      }
    }

    // Fetch PR attachments and resolve a public download URL for each so vendors
    // receiving the RFQ PDF can click through and download the technical specs,
    // drawings, and datasheets that came with the source PR. Without the URL,
    // the PDF only lists filenames — useless to external recipients.
    const prAttachments: PRAttachment[] = [];
    for (const prId of rfq.purchaseRequestIds) {
      const attachQ = query(
        collection(db, 'purchaseRequestAttachments'),
        where('purchaseRequestId', '==', prId)
      );
      const attachSnap = await getDocs(attachQ);
      for (const d of attachSnap.docs) {
        const data = d.data();
        let publicUrl: string | undefined;
        if (data.storagePath) {
          try {
            publicUrl = await getDownloadURL(ref(storage, data.storagePath));
          } catch (err) {
            console.warn(
              `[rfqPdfService] Could not generate download URL for attachment ${d.id} (${data.fileName}):`,
              err
            );
          }
        }
        prAttachments.push({
          fileName: data.fileName || '',
          attachmentType: data.attachmentType || 'OTHER',
          description: data.description,
          ...(publicUrl && { publicUrl }),
        });
      }
    }

    // Fetch vendors
    const vendorIdsToProcess = options.vendorIds || rfq.vendorIds;
    const vendors: VendorData[] = [];
    for (const vendorId of vendorIdsToProcess) {
      const vendorDoc = await getDoc(doc(db, 'entities', vendorId));
      if (vendorDoc.exists()) {
        const vd = vendorDoc.data();
        vendors.push({
          id: vendorDoc.id,
          name: vd.name || 'Unknown Vendor',
          contactPerson: vd.contactPerson,
          email: vd.email,
          phone: vd.phone,
          billingAddress: vd.billingAddress,
        });
      }
    }

    // Fetch user name
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userName = userDoc.exists()
      ? userDoc.data()?.displayName || 'Unknown User'
      : 'Unknown User';

    const newPdfVersion = rfq.pdfVersion + 1;

    const result: RFQPDFGenerationResult = {
      success: true,
      generatedAt: Timestamp.now(),
      generatedBy: userId,
      totalFiles: 0,
      pdfVersion: newPdfVersion,
    };

    // Generate Individual PDFs
    if (options.mode === 'INDIVIDUAL' || options.mode === 'BOTH') {
      result.vendorPdfs = [];

      for (const vendor of vendors) {
        try {
          const pdfData = preparePDFData(
            rfq,
            items,
            prNumbers,
            prAttachments,
            options,
            vendor,
            true,
            undefined
          );

          const element = React.createElement(RFQPDFDocument, { data: pdfData, logoDataUri });
          const blob = await generatePDFBlob(element);

          const sanitizedName = vendor.name.replace(/[^a-zA-Z0-9]/g, '_');
          const storagePath = `rfq-pdfs/${options.rfqId}/${Date.now()}-${sanitizedName}.pdf`;

          const uploadResult = await uploadPDFBlob(storage, blob, storagePath);

          // Only create document records if upload succeeded (not a local blob fallback)
          let documentId: string | undefined;
          if (!uploadResult.isLocalBlob) {
            const previousDoc = await findLatestRFQDocument(db, options.rfqId, vendor.id);
            documentId = await createDocumentRecord(db, {
              fileName: `${rfq.number}-${sanitizedName}.pdf`,
              downloadUrl: uploadResult.downloadUrl,
              storageRef: storagePath,
              fileSize: uploadResult.fileSize,
              rfqId: rfq.id,
              rfqNumber: rfq.number,
              tenantId: rfq.tenantId,
              projectId: rfq.projectIds?.[0],
              projectName: rfq.projectNames?.[0],
              vendorId: vendor.id,
              vendorName: vendor.name,
              userId,
              userName,
              version: previousDoc ? previousDoc.version + 1 : 1,
              previousDocumentId: previousDoc?.documentId,
              revisionNotes: newPdfVersion > 1 ? `PDF Version ${newPdfVersion}` : undefined,
            });
          }

          result.vendorPdfs.push({
            vendorId: vendor.id,
            vendorName: vendor.name,
            pdfUrl: uploadResult.downloadUrl,
            pdfPath: storagePath,
            documentId,
          });

          totalFiles++;
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`Error generating PDF for vendor ${vendor.id}:`, msg);
          errors.push({ vendorId: vendor.id, error: msg });
        }
      }
    }

    // Generate Combined PDF
    if (options.mode === 'COMBINED' || options.mode === 'BOTH') {
      try {
        const pdfData = preparePDFData(
          rfq,
          items,
          prNumbers,
          prAttachments,
          options,
          undefined,
          false,
          vendors
        );

        const element = React.createElement(RFQPDFDocument, { data: pdfData, logoDataUri });
        const blob = await generatePDFBlob(element);

        const storagePath = `rfq-pdfs/${options.rfqId}/${Date.now()}-combined.pdf`;
        const uploadResult = await uploadPDFBlob(storage, blob, storagePath);

        let documentId: string | undefined;
        if (!uploadResult.isLocalBlob) {
          const previousDoc = await findLatestRFQDocument(db, options.rfqId);
          documentId = await createDocumentRecord(db, {
            fileName: `${rfq.number}-combined.pdf`,
            downloadUrl: uploadResult.downloadUrl,
            storageRef: storagePath,
            fileSize: uploadResult.fileSize,
            rfqId: rfq.id,
            rfqNumber: rfq.number,
            tenantId: rfq.tenantId,
            projectId: rfq.projectIds?.[0],
            projectName: rfq.projectNames?.[0],
            userId,
            userName,
            version: previousDoc ? previousDoc.version + 1 : 1,
            previousDocumentId: previousDoc?.documentId,
            revisionNotes: newPdfVersion > 1 ? `PDF Version ${newPdfVersion}` : undefined,
          });
        }

        result.combinedPdfUrl = uploadResult.downloadUrl;
        result.combinedPdfPath = storagePath;
        result.combinedDocumentId = documentId;
        totalFiles++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error generating combined PDF:', msg);
        errors.push({ error: msg });
      }
    }

    // Update RFQ with latest PDF info
    const latestPdfUrl = result.combinedPdfUrl || result.vendorPdfs?.[0]?.pdfUrl;
    const latestPdfDocumentId = result.combinedDocumentId || result.vendorPdfs?.[0]?.documentId;
    await updateDoc(doc(db, 'rfqs', options.rfqId), {
      pdfVersion: newPdfVersion,
      ...(latestPdfUrl !== undefined && { latestPdfUrl }),
      ...(latestPdfDocumentId !== undefined && { latestPdfDocumentId }),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    // Save audit record (use conditional spreads to avoid undefined values)
    await addDoc(collection(db, 'rfqPdfRecords'), {
      rfqId: options.rfqId,
      rfqNumber: rfq.number,
      ...(rfq.tenantId && { tenantId: rfq.tenantId }),
      mode: options.mode,
      version: newPdfVersion,
      vendorPdfs: result.vendorPdfs || [],
      ...(result.combinedPdfUrl !== undefined && { combinedPdfUrl: result.combinedPdfUrl }),
      ...(result.combinedPdfPath !== undefined && { combinedPdfPath: result.combinedPdfPath }),
      ...(result.combinedDocumentId !== undefined && {
        combinedDocumentId: result.combinedDocumentId,
      }),
      termsSnapshot: {
        ...(options.generalTerms !== undefined && { general: options.generalTerms }),
        ...(options.paymentTerms !== undefined && { payment: options.paymentTerms }),
        ...(options.deliveryTerms !== undefined && { delivery: options.deliveryTerms }),
        ...(options.warrantyTerms !== undefined && { warranty: options.warrantyTerms }),
      },
      downloadCount: 0,
      generatedBy: userId,
      generatedAt: serverTimestamp(),
    });

    result.totalFiles = totalFiles;
    result.success = errors.length === 0;
    if (errors.length > 0) result.errors = errors;

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      errors,
      generatedAt: Timestamp.now(),
      generatedBy: userId,
      totalFiles,
      pdfVersion: 0,
    };
  }
}
