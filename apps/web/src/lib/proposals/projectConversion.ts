/**
 * Project Conversion Service
 *
 * Converts accepted proposals into active projects with linked data.
 */

import { collection, doc, runTransaction, Timestamp, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { Proposal, Project, CharterBudgetLineItem } from '@vapour/types';
import { deriveIncludedByClassification, deriveExclusions } from './proposalHelpers';

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
  // rule8-exempt: workflow function called by an upstream gate that already validates the transition; firestore.rules + caller-side state machine cover the safety check
  // rule5-exempt: firestore.rules enforce per-collection permission (VIEW/MANAGE flags + project-scoped checks); client-side requirePermission is defense-in-depth deferred to future hardening
  // The project create + proposal projectId-link are wrapped in a single
  // runTransaction below so a double-click on "Convert to Project" can't
  // produce two project documents racing to write back the same proposal.
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
    const projectNumber = await generateProjectNumber(db, proposal.tenantId);

    // Calculate dates
    const startDate = Timestamp.now();
    const estimatedEndDate = calculateEstimatedEndDate(
      startDate,
      proposal.deliveryPeriod.durationInWeeks
    );

    // Generate budget line items from unified scope matrix supply items
    const now = Timestamp.now();
    const supplyItems = proposal.unifiedScopeMatrix
      ? deriveIncludedByClassification(proposal.unifiedScopeMatrix).supply
      : [];
    const budgetLineItems: CharterBudgetLineItem[] = supplyItems.map((item, idx) => ({
      id: `budget-${idx + 1}`,
      lineNumber: idx + 1,
      description: item.name || `Line Item ${idx + 1}`,
      executionType: 'IN_HOUSE' as const,
      estimatedCost: item.estimationSummary?.totalCost?.amount ?? 0,
      currency: 'INR' as const,
      status: 'PLANNED' as const,
      scopeLinkage: {
        type: 'IN_SCOPE_ITEM' as const,
        id: item.id,
        description: item.description,
      },
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    }));

    // Create project
    const newProject: Omit<Project, 'id'> = {
      // Basic Info
      code: projectNumber,
      name: proposal.title,
      description: proposal.scopeOfWork?.summary || proposal.title,
      status: 'PLANNING',
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
        endDate: estimatedEndDate,
      },

      // Budget (prefer pricingConfig, fall back to legacy pricing)
      budget: {
        estimated: proposal.pricingConfig?.totalPrice ?? proposal.pricing.totalAmount,
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
        objectives: (proposal.scopeOfWork?.objectives || []).map((obj, idx) => ({
          id: `obj-${idx}`,
          description: obj,
          successCriteria: [],
          status: 'NOT_STARTED',
          priority: 'MEDIUM',
        })),
        deliverables: (proposal.scopeOfWork?.deliverables || []).map((del, idx) => ({
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
          inScope: proposal.scopeOfWork?.inclusions || [],
          outOfScope: proposal.unifiedScopeMatrix
            ? deriveExclusions(proposal.unifiedScopeMatrix)
            : proposal.scopeOfWork?.exclusions || [],
          assumptions: proposal.scopeOfWork?.assumptions || [],
          constraints: [],
        },
        // Budget line items from unified scope matrix
        budgetLineItems: budgetLineItems.length > 0 ? budgetLineItems : undefined,
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
    // Remove undefined values before sending to Firestore
    const cleanedProject = Object.fromEntries(
      Object.entries(newProject).filter(([, value]) => value !== undefined)
    );

    // Pre-allocate the project document id so the transaction can set
    // both the new project and the proposal->projectId link atomically.
    const projectRef = doc(collection(db, COLLECTIONS.PROJECTS));
    const proposalRef = doc(db, COLLECTIONS.PROPOSALS, proposalId);

    await runTransaction(db, async (tx) => {
      // Re-read the proposal inside the transaction so a parallel call
      // (e.g. a double-click) that already set projectId is caught.
      const freshSnap = await tx.get(proposalRef);
      if (!freshSnap.exists()) {
        throw new Error('Proposal not found');
      }
      const fresh = freshSnap.data() as Proposal;
      if (fresh.projectId) {
        throw new Error('Proposal has already been converted to a project');
      }

      tx.set(projectRef, cleanedProject);
      tx.update(proposalRef, {
        projectId: projectRef.id,
        projectNumber,
        convertedToProjectAt: Timestamp.now(),
        convertedToProjectBy: userId,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });
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
