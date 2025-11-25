/**
 * Document Transmittal Cloud Functions
 *
 * Handles server-side transmittal operations:
 * - PDF generation for transmittal cover sheets
 * - ZIP file creation with all documents
 * - File gathering from Storage
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import * as puppeteer from 'puppeteer';
import archiver from 'archiver';

interface GenerateTransmittalRequest {
  transmittalId: string;
  projectId: string;
}

interface TransmittalDocument {
  documentNumber: string;
  documentTitle: string;
  revision: string;
  submissionDate: string;
  status: string;
  purposeOfIssue?: string;
  remarks?: string;
  disciplineCode?: string;
}

/**
 * Generate PDF for transmittal cover sheet
 */
async function generateTransmittalPDF(transmittalData: {
  transmittalNumber: string;
  transmittalDate: string;
  projectName: string;
  clientName: string;
  clientContact?: string;
  subject?: string;
  coverNotes?: string;
  purposeOfIssue?: string;
  createdByName: string;
  documents: TransmittalDocument[];
}): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    // Generate HTML for the transmittal
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      margin: 2cm;
      size: A4;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #333;
    }
    .header {
      border-bottom: 3px solid #1976d2;
      padding-bottom: 15px;
      margin-bottom: 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 24pt;
      color: #1976d2;
    }
    .header .transmittal-number {
      font-size: 18pt;
      font-weight: bold;
      color: #666;
      margin-top: 5px;
    }
    .info-section {
      margin-bottom: 20px;
    }
    .info-row {
      display: flex;
      margin-bottom: 8px;
    }
    .info-label {
      font-weight: bold;
      width: 150px;
      color: #555;
    }
    .info-value {
      flex: 1;
    }
    .cover-notes {
      background: #f5f5f5;
      padding: 15px;
      border-left: 4px solid #1976d2;
      margin: 20px 0;
      white-space: pre-wrap;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      font-size: 9pt;
    }
    th {
      background: #1976d2;
      color: white;
      padding: 10px 8px;
      text-align: left;
      font-weight: 600;
    }
    td {
      padding: 8px;
      border-bottom: 1px solid #ddd;
    }
    tr:nth-child(even) {
      background: #f9f9f9;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 2px solid #ddd;
      font-size: 9pt;
      color: #666;
    }
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 8pt;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>DOCUMENT TRANSMITTAL</h1>
    <div class="transmittal-number">${transmittalData.transmittalNumber}</div>
  </div>

  <div class="info-section">
    <div class="info-row">
      <div class="info-label">Project:</div>
      <div class="info-value">${transmittalData.projectName}</div>
    </div>
    <div class="info-row">
      <div class="info-label">To:</div>
      <div class="info-value">${transmittalData.clientName}${transmittalData.clientContact ? ` (${transmittalData.clientContact})` : ''}</div>
    </div>
    <div class="info-row">
      <div class="info-label">Date:</div>
      <div class="info-value">${transmittalData.transmittalDate}</div>
    </div>
    ${
      transmittalData.subject
        ? `
    <div class="info-row">
      <div class="info-label">Subject:</div>
      <div class="info-value">${transmittalData.subject}</div>
    </div>
    `
        : ''
    }
    ${
      transmittalData.purposeOfIssue
        ? `
    <div class="info-row">
      <div class="info-label">Purpose:</div>
      <div class="info-value">${transmittalData.purposeOfIssue}</div>
    </div>
    `
        : ''
    }
    <div class="info-row">
      <div class="info-label">From:</div>
      <div class="info-value">${transmittalData.createdByName}</div>
    </div>
  </div>

  ${
    transmittalData.coverNotes
      ? `
  <div class="cover-notes">
    <strong>Cover Notes:</strong><br>
    ${transmittalData.coverNotes}
  </div>
  `
      : ''
  }

  <h3>Documents Transmitted (${transmittalData.documents.length})</h3>
  <table>
    <thead>
      <tr>
        <th style="width: 15%">Document No.</th>
        <th style="width: 35%">Title</th>
        <th style="width: 10%">Rev</th>
        <th style="width: 10%">Discipline</th>
        <th style="width: 15%">Status</th>
        <th style="width: 15%">Purpose</th>
      </tr>
    </thead>
    <tbody>
      ${transmittalData.documents
        .map(
          (doc) => `
      <tr>
        <td><strong>${doc.documentNumber}</strong></td>
        <td>${doc.documentTitle}</td>
        <td>${doc.revision}</td>
        <td>${doc.disciplineCode || '-'}</td>
        <td><span class="status-badge">${doc.status.replace(/_/g, ' ')}</span></td>
        <td>${doc.purposeOfIssue || '-'}</td>
      </tr>
      ${doc.remarks ? `<tr><td colspan="6" style="font-size: 8pt; color: #666; padding-left: 20px;">Note: ${doc.remarks}</td></tr>` : ''}
      `
        )
        .join('')}
    </tbody>
  </table>

  <div class="footer">
    <p><strong>Note:</strong> This transmittal includes ${transmittalData.documents.length} document(s).
    Please review and acknowledge receipt.</p>
    <p>Generated on ${new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}</p>
  </div>
</body>
</html>
    `;

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Gather document files from Storage
 */
async function gatherDocumentFiles(
  projectId: string,
  documentIds: string[]
): Promise<{ path: string; filename: string; buffer: Buffer }[]> {
  const bucket = admin.storage().bucket();
  const files: { path: string; filename: string; buffer: Buffer }[] = [];

  for (const docId of documentIds) {
    try {
      // Get master document to find latest submission
      const docRef = admin
        .firestore()
        .collection('projects')
        .doc(projectId)
        .collection('masterDocuments')
        .doc(docId);

      const docSnapshot = await docRef.get();
      if (!docSnapshot.exists) {
        logger.warn(`Document not found: ${docId}`);
        continue;
      }

      const docData = docSnapshot.data();
      if (!docData) continue;

      // Get latest submission
      const submissionsRef = docRef.collection('submissions');
      const submissionsSnapshot = await submissionsRef.orderBy('createdAt', 'desc').limit(1).get();

      if (submissionsSnapshot.empty) {
        logger.warn(`No submissions found for document: ${docId}`);
        continue;
      }

      const latestSubmission = submissionsSnapshot.docs[0].data();

      // Download document file if it exists
      if (latestSubmission.documentFileUrl) {
        const filePath = latestSubmission.documentFileUrl
          .replace('gs://', '')
          .split('/')
          .slice(1)
          .join('/');
        const file = bucket.file(filePath);

        const [exists] = await file.exists();
        if (exists) {
          const [buffer] = await file.download();
          const filename = `${docData.documentNumber}_R${latestSubmission.revision}.pdf`;
          files.push({ path: filePath, filename, buffer });
        }
      }

      // Download CRT file if it exists
      if (latestSubmission.crtFileUrl) {
        const crtPath = latestSubmission.crtFileUrl
          .replace('gs://', '')
          .split('/')
          .slice(1)
          .join('/');
        const crtFile = bucket.file(crtPath);

        const [exists] = await crtFile.exists();
        if (exists) {
          const [buffer] = await crtFile.download();
          const filename = `${docData.documentNumber}_R${latestSubmission.revision}_CRT.xlsx`;
          files.push({ path: crtPath, filename, buffer });
        }
      }
    } catch (error) {
      logger.error(`Error gathering files for document ${docId}:`, error);
    }
  }

  return files;
}

/**
 * Create ZIP archive with all files
 */
async function createZipArchive(files: { filename: string; buffer: Buffer }[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);

    // Add files to archive
    for (const file of files) {
      archive.append(file.buffer, { name: file.filename });
    }

    archive.finalize();
  });
}

/**
 * Cloud Function: Generate Transmittal
 *
 * Generates PDF and ZIP file for a transmittal
 * Updates Firestore with file URLs
 */
export const generateTransmittal = onCall(async (request) => {
  // Check authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const { transmittalId, projectId } = request.data as GenerateTransmittalRequest;

  if (!transmittalId || !projectId) {
    throw new HttpsError('invalid-argument', 'transmittalId and projectId are required');
  }

  logger.info(`Generating transmittal: ${transmittalId} for project: ${projectId}`);

  try {
    // Get transmittal document
    const transmittalRef = admin
      .firestore()
      .collection('projects')
      .doc(projectId)
      .collection('transmittals')
      .doc(transmittalId);

    const transmittalSnapshot = await transmittalRef.get();
    if (!transmittalSnapshot.exists) {
      throw new HttpsError('not-found', 'Transmittal not found');
    }

    const transmittalData = transmittalSnapshot.data();
    if (!transmittalData) {
      throw new HttpsError('internal', 'Transmittal data is empty');
    }

    // Get document details
    const documents: TransmittalDocument[] = [];
    for (const docId of transmittalData.documentIds) {
      const docRef = admin
        .firestore()
        .collection('projects')
        .doc(projectId)
        .collection('masterDocuments')
        .doc(docId);

      const docSnapshot = await docRef.get();
      if (docSnapshot.exists) {
        const docData = docSnapshot.data();
        if (docData) {
          documents.push({
            documentNumber: docData.documentNumber,
            documentTitle: docData.documentTitle,
            revision: docData.currentRevision,
            submissionDate: docData.lastSubmissionDate?.toDate().toLocaleDateString() || '-',
            status: docData.status,
            purposeOfIssue: docData.purposeOfIssue,
            remarks: docData.remarks,
            disciplineCode: docData.disciplineCode,
          });
        }
      }
    }

    // Generate PDF
    logger.info('Generating transmittal PDF...');
    const pdfBuffer = await generateTransmittalPDF({
      transmittalNumber: transmittalData.transmittalNumber,
      transmittalDate: transmittalData.transmittalDate.toDate().toLocaleDateString(),
      projectName: transmittalData.projectName,
      clientName: transmittalData.clientName,
      clientContact: transmittalData.clientContact,
      subject: transmittalData.subject,
      coverNotes: transmittalData.coverNotes,
      purposeOfIssue: transmittalData.purposeOfIssue,
      createdByName: transmittalData.createdByName,
      documents,
    });

    // Upload PDF to Storage
    const bucket = admin.storage().bucket();
    const pdfPath = `projects/${projectId}/transmittals/${transmittalId}/transmittal.pdf`;
    const pdfFile = bucket.file(pdfPath);

    await pdfFile.save(pdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
        metadata: {
          transmittalNumber: transmittalData.transmittalNumber,
          projectId,
        },
      },
    });

    const pdfUrl = `gs://${bucket.name}/${pdfPath}`;
    logger.info(`PDF uploaded: ${pdfUrl}`);

    // Gather document files
    logger.info('Gathering document files...');
    const documentFiles = await gatherDocumentFiles(projectId, transmittalData.documentIds);

    // Add PDF to files for ZIP
    const allFiles = [
      { filename: `${transmittalData.transmittalNumber}.pdf`, buffer: pdfBuffer },
      ...documentFiles.map((f) => ({ filename: f.filename, buffer: f.buffer })),
    ];

    // Create ZIP
    logger.info('Creating ZIP archive...');
    const zipBuffer = await createZipArchive(allFiles);

    // Upload ZIP to Storage
    const zipPath = `projects/${projectId}/transmittals/${transmittalId}/transmittal.zip`;
    const zipFile = bucket.file(zipPath);

    await zipFile.save(zipBuffer, {
      metadata: {
        contentType: 'application/zip',
        metadata: {
          transmittalNumber: transmittalData.transmittalNumber,
          projectId,
          fileCount: allFiles.length.toString(),
        },
      },
    });

    const zipUrl = `gs://${bucket.name}/${zipPath}`;
    logger.info(`ZIP uploaded: ${zipUrl}`);

    // Update transmittal document
    await transmittalRef.update({
      status: 'GENERATED',
      transmittalPdfUrl: pdfUrl,
      zipFileUrl: zipUrl,
      zipFileSize: zipBuffer.length,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`Transmittal generation complete: ${transmittalId}`);

    return {
      success: true,
      transmittalNumber: transmittalData.transmittalNumber,
      pdfUrl,
      zipUrl,
      zipSize: zipBuffer.length,
      fileCount: allFiles.length,
    };
  } catch (error) {
    logger.error('Error generating transmittal:', error);
    throw new HttpsError('internal', 'Failed to generate transmittal');
  }
});

/**
 * Cloud Function: Download Transmittal File
 *
 * Returns a signed URL for downloading PDF or ZIP
 */
export const getTransmittalDownloadUrl = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  const { fileUrl } = request.data;

  if (!fileUrl || typeof fileUrl !== 'string') {
    throw new HttpsError('invalid-argument', 'fileUrl is required');
  }

  try {
    const bucket = admin.storage().bucket();
    const filePath = fileUrl.replace(`gs://${bucket.name}/`, '');
    const file = bucket.file(filePath);

    const [exists] = await file.exists();
    if (!exists) {
      throw new HttpsError('not-found', 'File not found');
    }

    // Generate signed URL valid for 1 hour
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    return { downloadUrl: url };
  } catch (error) {
    logger.error('Error getting download URL:', error);
    throw new HttpsError('internal', 'Failed to get download URL');
  }
});
