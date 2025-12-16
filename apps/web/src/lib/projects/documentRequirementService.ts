/**
 * Document Requirement Service
 * Manages document requirements in project charters
 */

import { doc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
import { getFirebase } from '../firebase';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { DocumentRequirement, Project } from '@vapour/types';

const logger = createLogger({ context: 'documentRequirementService' });

/**
 * Add document requirement to project charter
 */
export async function addDocumentRequirement(
  projectId: string,
  requirement: Omit<DocumentRequirement, 'id' | 'status'>,
  userId: string
): Promise<string> {
  const { db } = getFirebase();

  try {
    // Get current project
    const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
      throw new Error('Project not found');
    }

    const project = projectSnap.data() as Project;
    const currentRequirements = project.documentRequirements || [];

    // Generate ID for new requirement
    const requirementId = `DOC-${crypto.randomUUID().slice(0, 8)}`;

    // Create new requirement with defaults
    const newRequirement: DocumentRequirement = {
      ...requirement,
      id: requirementId,
      status: 'NOT_SUBMITTED',
    };

    // Add to array
    const updatedRequirements = [...currentRequirements, newRequirement];

    // Update project
    await updateDoc(projectRef, {
      documentRequirements: updatedRequirements,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    return requirementId;
  } catch (error) {
    logger.error('Failed to add document requirement', { error, projectId });
    throw new Error('Failed to add document requirement');
  }
}

/**
 * Update document requirement in project charter
 */
export async function updateDocumentRequirement(
  projectId: string,
  requirementId: string,
  updates: Partial<DocumentRequirement>,
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    // Get current project
    const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
      throw new Error('Project not found');
    }

    const project = projectSnap.data() as Project;
    const currentRequirements = project.documentRequirements || [];

    // Find and update requirement
    const updatedRequirements = currentRequirements.map((req) =>
      req.id === requirementId ? { ...req, ...updates } : req
    );

    // Update project
    await updateDoc(projectRef, {
      documentRequirements: updatedRequirements,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  } catch (error) {
    logger.error('Failed to update document requirement', { error, projectId, requirementId });
    throw new Error('Failed to update document requirement');
  }
}

/**
 * Delete document requirement from project charter
 */
export async function deleteDocumentRequirement(
  projectId: string,
  requirementId: string,
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    // Get current project
    const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
      throw new Error('Project not found');
    }

    const project = projectSnap.data() as Project;
    const currentRequirements = project.documentRequirements || [];

    // Filter out deleted requirement
    const updatedRequirements = currentRequirements.filter((req) => req.id !== requirementId);

    // Update project
    await updateDoc(projectRef, {
      documentRequirements: updatedRequirements,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  } catch (error) {
    logger.error('Failed to delete document requirement', { error, projectId, requirementId });
    throw new Error('Failed to delete document requirement');
  }
}

/**
 * Link document to requirement and update status
 */
export async function linkDocumentToRequirement(
  projectId: string,
  requirementId: string,
  documentId: string,
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
      throw new Error('Project not found');
    }

    const project = projectSnap.data() as Project;
    const currentRequirements = project.documentRequirements || [];

    const updatedRequirements = currentRequirements.map((req) => {
      if (req.id === requirementId) {
        return {
          ...req,
          linkedDocumentId: documentId,
          status: 'SUBMITTED' as const,
          submittedDate: Timestamp.now(),
        };
      }
      return req;
    });

    await updateDoc(projectRef, {
      documentRequirements: updatedRequirements,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  } catch (error) {
    logger.error('Failed to link document to requirement', {
      error,
      projectId,
      requirementId,
      documentId,
    });
    throw new Error('Failed to link document to requirement');
  }
}

/**
 * Update requirement status when document is approved/rejected
 */
export async function updateRequirementFromDocumentStatus(
  projectId: string,
  requirementId: string,
  newStatus: 'APPROVED' | 'REJECTED',
  userId: string
): Promise<void> {
  const { db } = getFirebase();

  try {
    const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
      throw new Error('Project not found');
    }

    const project = projectSnap.data() as Project;
    const currentRequirements = project.documentRequirements || [];

    const updatedRequirements = currentRequirements.map((req) => {
      if (req.id === requirementId) {
        return {
          ...req,
          status: newStatus,
        };
      }
      return req;
    });

    await updateDoc(projectRef, {
      documentRequirements: updatedRequirements,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  } catch (error) {
    logger.error('Failed to update requirement from document status', {
      error,
      projectId,
      requirementId,
      newStatus,
    });
    throw new Error('Failed to update requirement status');
  }
}

/**
 * Find matching requirements for a document by type/category
 */
export async function findMatchingRequirements(
  projectId: string,
  documentCategory: string
): Promise<DocumentRequirement[]> {
  const { db } = getFirebase();

  try {
    const projectRef = doc(db, COLLECTIONS.PROJECTS, projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
      return [];
    }

    const project = projectSnap.data() as Project;
    const currentRequirements = project.documentRequirements || [];

    // Find requirements matching the document category and not yet submitted
    return currentRequirements.filter(
      (req) =>
        req.documentCategory === documentCategory &&
        req.status === 'NOT_SUBMITTED' &&
        !req.linkedDocumentId
    );
  } catch (error) {
    logger.error('Failed to find matching requirements', { error, projectId, documentCategory });
    return [];
  }
}
