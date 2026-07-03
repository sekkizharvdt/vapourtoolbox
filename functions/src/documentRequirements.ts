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
      const projectRef = db.collection('projects').doc(projectId);

      // Read-modify-write on the project's documentRequirements array MUST be
      // transactional (CLAUDE.md rule 19). Two documents of the same category
      // uploaded together fire this trigger concurrently; without a transaction
      // both read the same snapshot and the second update() clobbers the first
      // (lost link) or both grab matchingRequirements[0] (double-link).
      const linkedRequirementId = await db.runTransaction(async (tx) => {
        const projectSnap = await tx.get(projectRef);
        if (!projectSnap.exists) {
          logger.warn(`[onDocumentUploaded] Project ${projectId} not found`);
          return null;
        }

        const projectData = projectSnap.data();
        const documentRequirements = (projectData?.documentRequirements ||
          []) as DocumentRequirement[];

        if (documentRequirements.length === 0) {
          logger.info(`[onDocumentUploaded] No document requirements for project ${projectId}`);
          return null;
        }

        // Match by: same category, NOT_SUBMITTED, not already linked.
        const requirementToLink = documentRequirements.find(
          (req: DocumentRequirement) =>
            req.documentCategory === docCategory &&
            req.status === 'NOT_SUBMITTED' &&
            !req.linkedDocumentId
        );

        if (!requirementToLink) {
          logger.info(
            `[onDocumentUploaded] No matching requirements for document ${documentId}, category: ${docCategory}`
          );
          return null;
        }

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

        tx.update(projectRef, {
          documentRequirements: updatedRequirements,
          updatedAt: Timestamp.now(),
        });

        return requirementToLink.id;
      });

      if (linkedRequirementId) {
        logger.info(
          `[onDocumentUploaded] Successfully linked document ${documentId} to requirement ${linkedRequirementId} in project ${projectId}`
        );
      }
    } catch (error) {
      logger.error(`[onDocumentUploaded] Error processing document ${documentId}:`, error);
      // Don't throw - let the document upload succeed even if linking fails
    }
  }
);
