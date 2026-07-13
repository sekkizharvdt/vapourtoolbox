/**
 * Project Conversion Service
 *
 * Converts accepted proposals into active projects with linked data.
 */

import { collection, doc, runTransaction, Timestamp, type Firestore } from 'firebase/firestore';
import { COLLECTIONS } from '@vapour/firebase';
import { createLogger } from '@vapour/logger';
import type { Proposal, Project, CharterBudgetLineItem } from '@vapour/types';
import {
  deriveIncludedByClassification,
  deriveIncludedItems,
  deriveExclusions,
} from './proposalHelpers';
import { computeCommercialSummary } from './commercialSummary';
import { generateCounterBackedNumber } from '@/lib/procurement/generateProcurementNumber';

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
        description: item.description ?? '',
      },
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
    }));

    // In-scope items: legacy proposals keep them in scopeOfWork.inclusions;
    // new-style proposals keep ALL scope in the unified matrix — carry every
    // included item's name so the charter isn't empty after conversion.
    const legacyInclusions = proposal.scopeOfWork?.inclusions ?? [];
    const inScopeItems =
      legacyInclusions.length > 0
        ? legacyInclusions
        : proposal.unifiedScopeMatrix
          ? deriveIncludedItems(proposal.unifiedScopeMatrix)
              .map((item) => item.name || item.description || '')
              .filter(Boolean)
          : [];

    // Deliverables: legacy scopeOfWork.deliverables when present; otherwise
    // derive from the proposal's payment milestones (type MILESTONE, due
    // dates from cumulative milestone durations).
    const legacyDeliverables = proposal.scopeOfWork?.deliverables ?? [];
    let cumulativeWeeks = 0;
    const milestoneDeliverables = (proposal.deliveryPeriod.milestones ?? []).map(
      (milestone, idx) => {
        cumulativeWeeks += milestone.durationInWeeks ?? 0;
        const name = milestone.description || `Milestone ${milestone.milestoneNumber ?? idx + 1}`;
        return {
          id: `del-${idx}`,
          name,
          description: milestone.paymentPercentage
            ? `${name} (${milestone.paymentPercentage}% payment milestone)`
            : name,
          type: 'MILESTONE' as const,
          acceptanceCriteria: [],
          status: 'PENDING' as const,
          dueDate: calculateEstimatedEndDate(startDate, cumulativeWeeks),
        };
      }
    );

    // Create project
    const newProject: Omit<Project, 'id'> = {
      // Tenant scoping — firestore.rules `projects` create requires
      // request.resource.data.tenantId == request.auth.token.tenantId;
      // omitting it makes the whole conversion transaction bounce with
      // "Missing or insufficient permissions".
      tenantId: proposal.tenantId ?? 'default-entity',
      // Basic Info
      code: projectNumber,
      name: proposal.title,
      description: proposal.scopeOfWork?.summary || proposal.title,
      status: 'PLANNING',
      priority: 'MEDIUM',

      // Organization
      ownerId: userId,
      visibility: 'team',

      // Client Info (from proposal). Optional proposal fields are
      // null-coalesced — nested `undefined` anywhere in this object makes
      // Transaction.set() reject the whole write (rule 12).
      client: {
        entityId: proposal.clientId,
        entityName: proposal.clientName,
        contactPerson: proposal.clientContactPerson ?? '',
        contactEmail: proposal.clientEmail ?? '',
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

      // Budget — read from the canonical commercial summary so new-style
      // proposals (priced via the Pricing tab / clientPricing) carry their
      // real total into the project. Falls back to 0 when the proposal
      // genuinely has no pricing yet (caller should have caught that).
      // We use targetRevenueInr (pre-tax revenue in INR) — that's what
      // the project earns; tax is the customer's separate problem.
      budget: {
        estimated: {
          amount: computeCommercialSummary(proposal)?.targetRevenueInr ?? 0,
          currency: 'INR' as const,
        },
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
        deliverables:
          legacyDeliverables.length > 0
            ? legacyDeliverables.map((del, idx) => ({
                id: `del-${idx}`,
                name: del,
                description: del,
                type: 'PRODUCT',
                acceptanceCriteria: [],
                status: 'PENDING',
                dueDate: estimatedEndDate,
              }))
            : milestoneDeliverables,
        deliveryPeriod: {
          startDate,
          endDate: estimatedEndDate,
          duration: proposal.deliveryPeriod.durationInWeeks * 7,
          description: proposal.deliveryPeriod.description ?? '',
        },
        scope: {
          inScope: inScopeItems,
          outOfScope: proposal.unifiedScopeMatrix
            ? deriveExclusions(proposal.unifiedScopeMatrix)
            : proposal.scopeOfWork?.exclusions || [],
          assumptions: proposal.scopeOfWork?.assumptions || [],
          constraints: [],
        },
        // Budget line items from unified scope matrix. Conditional spread —
        // a nested `undefined` is rejected by Firestore Transaction.set()
        // (rule 12), and the top-level cleanup below can't see inside
        // `charter`. Service-only proposals (no supply items) omit the
        // field; line items are added later on the project's Budget tab.
        ...(budgetLineItems.length > 0 && { budgetLineItems }),
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
 * Pure formatter for project numbers: PROJ-YYYY-NNNN.
 * Exported so tests can pin the byte-exact format.
 *
 * Note: the pre-counter implementation used a 6-digit `Date.now()` slice as
 * the suffix (e.g. PROJ-2026-483920). Counter-generated 4-digit suffixes can
 * never collide with those legacy 6-digit values, so no seed is needed.
 */
export function formatProjectNumber(year: number, sequence: number): string {
  return `PROJ-${year}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Generate unique project number via the shared counter-backed generator
 * (known-gaps 2.4 — the old Date.now()-slice suffix could collide).
 */
async function generateProjectNumber(_db: Firestore, _entityId: string): Promise<string> {
  const year = new Date().getFullYear();
  return generateCounterBackedNumber({
    counterKey: `project-${year}`,
    counterType: 'project',
    counterMeta: { year },
    format: (sequence) => formatProjectNumber(year, sequence),
  });
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
