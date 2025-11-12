/**
 * Document Requirements Cloud Functions
 * Automatically links uploaded documents to charter requirements
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions/v2';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const db = getFirestore();

interface DocumentRecord {
  id: string;
  projectId?: string;
  projectName?: string;
  projectCode?: string;
  entityType: string;
  entityId: string;
  documentType?: string;
  documentCategory?: string;
  status: string;
}

interface DocumentRequirement {
  id: string;
  documentType: string;
  documentCategory: string;
  description: string;
  isRequired: boolean;
  status: string;
  linkedDocumentId?: string;
  submittedDate?: Timestamp;
}

/**
 * Triggered when a document is uploaded to the documents collection
 * Attempts to auto-link it to matching DocumentRequirements
 */
export const onDocumentUploaded = onDocumentCreated(
  { document: 'documents/{documentId}' },
  async (event) => {
    const documentId = event.params.documentId;
    const documentData = event.data?.data() as DocumentRecord | undefined;

    if (!documentData) {
      logger.warn(`[onDocumentUploaded] No document data for ${documentId}`);
      return;
    }

    // Only process documents linked to projects
    if (!documentData.projectId) {
      logger.debug(`[onDocumentUploaded] Document ${documentId} has no projectId, skipping`);
      return;
    }

    // Only process active documents
    if (documentData.status !== 'ACTIVE') {
      logger.debug(`[onDocumentUploaded] Document ${documentId} is not active, skipping`);
      return;
    }

    const projectId = documentData.projectId;
    const docCategory = documentData.documentCategory || documentData.entityType;

    logger.info(
      `[onDocumentUploaded] Processing document ${documentId} for project ${projectId}, category: ${docCategory}`
    );

    try {
      // Get project document requirements
      const projectRef = db.collection('projects').doc(projectId);
      const projectSnap = await projectRef.get();

      if (!projectSnap.exists) {
        logger.warn(`[onDocumentUploaded] Project ${projectId} not found`);
        return;
      }

      const projectData = projectSnap.data();
      const documentRequirements = (projectData?.documentRequirements ||
        []) as DocumentRequirement[];

      if (documentRequirements.length === 0) {
        logger.info(`[onDocumentUploaded] No document requirements for project ${projectId}`);
        return;
      }

      // Find matching requirements
      // Match by:
      // 1. Same document category
      // 2. Status is NOT_SUBMITTED
      // 3. Not already linked
      const matchingRequirements = documentRequirements.filter(
        (req: DocumentRequirement) =>
          req.documentCategory === docCategory &&
          req.status === 'NOT_SUBMITTED' &&
          !req.linkedDocumentId
      );

      if (matchingRequirements.length === 0) {
        logger.info(
          `[onDocumentUploaded] No matching requirements for document ${documentId}, category: ${docCategory}`
        );
        return;
      }

      // Link the document to the first matching requirement
      // (If multiple requirements match, link to the first one)
      const requirementToLink = matchingRequirements[0];

      logger.info(
        `[onDocumentUploaded] Linking document ${documentId} to requirement ${requirementToLink.id}`
      );

      // Update the requirement
      const updatedRequirements = documentRequirements.map((req: DocumentRequirement) => {
        if (req.id === requirementToLink.id) {
          return {
            ...req,
            linkedDocumentId: documentId,
            status: 'SUBMITTED',
            submittedDate: Timestamp.now(),
          };
        }
        return req;
      });

      // Save back to project
      await projectRef.update({
        documentRequirements: updatedRequirements,
        updatedAt: Timestamp.now(),
      });

      logger.info(
        `[onDocumentUploaded] Successfully linked document ${documentId} to requirement ${requirementToLink.id} in project ${projectId}`
      );
    } catch (error) {
      logger.error(`[onDocumentUploaded] Error processing document ${documentId}:`, error);
      // Don't throw - let the document upload succeed even if linking fails
    }
  }
);
