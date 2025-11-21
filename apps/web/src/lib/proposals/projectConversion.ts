/**
 * Project Conversion Service
 *
 * Converts accepted proposals into active projects with linked data.
 */

import { collection, doc, addDoc, updateDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { Proposal, Project, ProjectStatus } from '@vapour/types';

const logger = createLogger({ context: 'projectConversion' });

/**
 * Convert proposal to project
 *
 * Creates a new project from an accepted proposal.
 * Links proposal to project and updates proposal status.
 */
export async function convertProposalToProject(
  db: Firestore,
  proposalId: string,
  userId: string,
  userName: string,
  proposal: Proposal
): Promise<string> {
  try {
    logger.info('Converting proposal to project', { proposalId, userId });

    // Validate proposal status
    if (proposal.status !== 'ACCEPTED') {
      throw new Error(`Cannot convert proposal with status: ${proposal.status}`);
    }

    // Check if already converted
    if (proposal.projectId) {
      throw new Error('Proposal has already been converted to a project');
    }

    // Generate project number
    const projectNumber = await generateProjectNumber(db, proposal.entityId);

    // Calculate dates
    const startDate = Timestamp.now();
    const estimatedEndDate = calculateEstimatedEndDate(
      startDate,
      proposal.deliveryPeriod.durationInWeeks
    );

    // Create project
    const newProject: Omit<Project, 'id'> = {
      // Basic Info
      code: projectNumber,
      name: proposal.title,
      description: proposal.scopeOfWork.summary,
      status: 'PLANNING' as ProjectStatus,
      priority: 'MEDIUM',

      // Organization
      ownerId: userId,
      visibility: 'team',

      // Client Info (from proposal)
      client: {
        entityId: proposal.clientId,
        entityName: proposal.clientName,
        contactPerson: proposal.clientContactPerson,
        contactEmail: proposal.clientEmail,
        contactPhone: '',
      },

      // Project Manager (assigned to creator initially)
      projectManager: {
        userId,
        userName,
      },

      // Team (initially just the creator)
      team: [
        {
          userId,
          userName,
          role: 'Project Manager',
          assignedAt: Timestamp.now(),
          isActive: true,
        },
      ],

      // Dates
      dates: {
        startDate,
      },

      // Budget (from proposal pricing)
      budget: {
        estimated: proposal.pricing.totalAmount,
        currency: 'INR',
      },

      // Project Charter
      charter: {
        authorization: {
          sponsorName: userName,
          sponsorUserId: userId,
          sponsorTitle: 'Project Creator',
          approvalStatus: 'DRAFT',
          budgetAuthority: userName,
        },
        objectives: proposal.scopeOfWork.objectives.map((obj, idx) => ({
          id: `obj-${idx}`,
          description: obj,
          successCriteria: [],
          status: 'NOT_STARTED',
          priority: 'MEDIUM',
        })),
        deliverables: proposal.scopeOfWork.deliverables.map((del, idx) => ({
          id: `del-${idx}`,
          name: del,
          description: del,
          type: 'PRODUCT',
          acceptanceCriteria: [],
          status: 'PENDING',
          dueDate: estimatedEndDate,
        })),
        deliveryPeriod: {
          startDate,
          endDate: estimatedEndDate,
          duration: proposal.deliveryPeriod.durationInWeeks * 7,
          description: proposal.deliveryPeriod.description,
        },
        scope: {
          inScope: proposal.scopeOfWork.inclusions || [],
          outOfScope: proposal.scopeOfWork.exclusions || [],
          assumptions: proposal.scopeOfWork.assumptions || [],
          constraints: [],
        },
        risks: [],
        stakeholders: [
          {
            name: proposal.clientName,
            role: 'Client',
            interest: 'HIGH',
            influence: 'HIGH',
          },
        ],
      },

      // Metadata
      tags: [],
      isDeleted: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    // Add project to Firestore
    const projectRef = await addDoc(collection(db, COLLECTIONS.PROJECTS), newProject);

    // Update proposal with project link
    const proposalRef = doc(db, COLLECTIONS.PROPOSALS, proposalId);
    await updateDoc(proposalRef, {
      projectId: projectRef.id,
      projectNumber,
      convertedToProjectAt: Timestamp.now(),
      convertedToProjectBy: userId,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    logger.info('Proposal converted to project', {
      proposalId,
      projectId: projectRef.id,
      projectNumber,
    });

    return projectRef.id;
  } catch (error) {
    logger.error('Error converting proposal to project', { proposalId, error });
    throw error;
  }
}

/**
 * Generate unique project number
 */
async function generateProjectNumber(_db: Firestore, _entityId: string): Promise<string> {
  // Simple implementation - in production, use a counter or more sophisticated logic
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  return `PROJ-${year}-${timestamp}`;
}

/**
 * Calculate estimated end date based on duration
 */
function calculateEstimatedEndDate(startDate: Timestamp, durationInWeeks: number): Timestamp {
  const start = startDate.toDate();
  const end = new Date(start.getTime() + durationInWeeks * 7 * 24 * 60 * 60 * 1000);
  return Timestamp.fromDate(end);
}

/**
 * Check if proposal can be converted
 */
export function canConvertToProject(proposal: Proposal): {
  canConvert: boolean;
  reason?: string;
} {
  if (proposal.status !== 'ACCEPTED') {
    return {
      canConvert: false,
      reason: 'Proposal must be in ACCEPTED status to convert to project',
    };
  }

  if (proposal.projectId) {
    return {
      canConvert: false,
      reason: 'Proposal has already been converted to a project',
    };
  }

  return { canConvert: true };
}
