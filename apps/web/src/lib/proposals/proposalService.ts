/**
 * Proposal Service
 * Handles CRUD operations for proposals including revisions and approval workflow
 */

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
  Firestore,
  startAfter as firestoreStartAfter,
  runTransaction,
} from 'firebase/firestore';
import { createLogger } from '@vapour/logger';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import type {
  Proposal,
  CreateProposalInput,
  UpdateProposalInput,
  ListProposalsOptions,
  ProposalStatus,
  Enquiry,
  ProposalWorkflowStage,
  ProposalTemplate,
  CreateProposalTemplateInput,
  ListProposalTemplatesOptions,
  ScopeItem,
} from '@vapour/types';

const logger = createLogger({ context: 'proposalService' });

const COLLECTIONS = {
  PROPOSALS: 'proposals',
  ENQUIRIES: 'enquiries',
  ENTITIES: 'entities',
  PROPOSAL_TEMPLATES: 'proposalTemplates',
};

/**
 * Generate next proposal number: PROP-YY-NN
 * Format: PROP-25-01, PROP-25-02, etc.
 */
async function generateProposalNumber(db: Firestore): Promise<string> {
  const year = new Date().getFullYear();
  const twoDigitYear = year.toString().slice(-2); // Get last 2 digits
  const prefix = `PROP-${twoDigitYear}-`;

  const q = query(
    collection(db, COLLECTIONS.PROPOSALS),
    where('proposalNumber', '>=', prefix),
    where(
      'proposalNumber',
      '<',
      `PROP-${(parseInt(twoDigitYear) + 1).toString().padStart(2, '0')}-`
    ),
    orderBy('proposalNumber', 'desc'),
    limit(1)
  );

  const snapshot = await getDocs(q);
  let nextNumber = 1;

  if (!snapshot.empty) {
    const firstDoc = snapshot.docs[0];
    if (firstDoc) {
      const lastProposalNumber = firstDoc.data().proposalNumber as string;
      if (lastProposalNumber) {
        const parts = lastProposalNumber.split('-');
        if (parts.length >= 3 && parts[2]) {
          const lastNumber = parseInt(parts[2], 10);
          if (!isNaN(lastNumber)) {
            nextNumber = lastNumber + 1;
          }
        }
      }
    }
  }

  return `${prefix}${nextNumber.toString().padStart(2, '0')}`;
}

/**
 * Create new proposal
 */
export async function createProposal(
  db: Firestore,
  input: CreateProposalInput,
  userId: string
): Promise<Proposal> {
  try {
    // Get enquiry details
    const enquiryDoc = await getDoc(doc(db, COLLECTIONS.ENQUIRIES, input.enquiryId));
    if (!enquiryDoc.exists()) {
      throw new Error('Enquiry not found');
    }
    const enquiryData = enquiryDoc.data() as Omit<Enquiry, 'id'>;
    const enquiry: Enquiry = { id: enquiryDoc.id, ...enquiryData };

    // Get client details
    const clientDoc = await getDoc(doc(db, COLLECTIONS.ENTITIES, input.clientId));
    if (!clientDoc.exists()) {
      throw new Error('Client not found');
    }
    const client = clientDoc.data();

    // Generate proposal number
    const proposalNumber = await generateProposalNumber(db);

    const now = Timestamp.now();
    const proposal: Omit<Proposal, 'id'> = {
      proposalNumber,
      revision: 1,
      enquiryId: input.enquiryId,
      enquiryNumber: enquiry.enquiryNumber,
      entityId: input.entityId,
      clientId: input.clientId,
      clientName: client.name || '',
      clientContactPerson: enquiry.clientContactPerson,
      clientEmail: enquiry.clientEmail,
      clientAddress: client.billingAddress
        ? `${client.billingAddress.line1}, ${client.billingAddress.city}, ${client.billingAddress.state} ${client.billingAddress.postalCode}`
        : '',
      title: input.title,
      validityDate: input.validityDate,
      preparationDate: now,
      scopeOfWork: input.scopeOfWork,
      scopeOfSupply: [],
      deliveryPeriod: input.deliveryPeriod,
      pricing: {
        currency: 'INR',
        lineItems: [],
        subtotal: { amount: 0, currency: 'INR' },
        taxItems: [],
        totalAmount: { amount: 0, currency: 'INR' },
        paymentTerms: input.paymentTerms,
      },
      terms: {},
      status: 'DRAFT',
      approvalHistory: [],
      attachments: [],
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
      isLatestRevision: true,
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.PROPOSALS), proposal);

    // Update enquiry status
    await updateDoc(doc(db, COLLECTIONS.ENQUIRIES, input.enquiryId), {
      status: 'PROPOSAL_IN_PROGRESS',
      proposalCreatedAt: now,
      updatedAt: now,
      updatedBy: userId,
    });

    logger.info('Proposal created', { proposalId: docRef.id, proposalNumber });

    return { id: docRef.id, ...proposal };
  } catch (error) {
    logger.error('Error creating proposal', { error });
    throw error;
  }
}

/**
 * Minimal proposal creation input (simplified for Phase 2 workflow)
 */
export interface CreateMinimalProposalInput {
  entityId: string;
  enquiryId: string;
  title: string;
  clientId: string;
  validityDate: Date;
  notes?: string;
}

/**
 * Create minimal proposal from enquiry (Phase 2 simplified workflow)
 *
 * Creates a proposal with minimal information, pre-populating from the enquiry.
 * The proposal starts in SCOPE_DEFINITION workflow stage, ready for scope matrix work.
 */
export async function createMinimalProposal(
  db: Firestore,
  input: CreateMinimalProposalInput,
  userId: string
): Promise<Proposal> {
  try {
    // Get enquiry details
    const enquiryDoc = await getDoc(doc(db, COLLECTIONS.ENQUIRIES, input.enquiryId));
    if (!enquiryDoc.exists()) {
      throw new Error('Enquiry not found');
    }
    const enquiryData = enquiryDoc.data() as Omit<Enquiry, 'id'>;
    const enquiry: Enquiry = { id: enquiryDoc.id, ...enquiryData };

    // Verify enquiry has bid decision
    if (!enquiry.bidDecision || enquiry.bidDecision.decision !== 'BID') {
      throw new Error('Cannot create proposal without a BID decision on the enquiry');
    }

    // Get client details
    const clientDoc = await getDoc(doc(db, COLLECTIONS.ENTITIES, input.clientId));
    if (!clientDoc.exists()) {
      throw new Error('Client not found');
    }
    const client = clientDoc.data();

    // Generate proposal number
    const proposalNumber = await generateProposalNumber(db);

    const now = Timestamp.now();
    const proposal: Omit<Proposal, 'id'> = {
      proposalNumber,
      revision: 1,
      enquiryId: input.enquiryId,
      enquiryNumber: enquiry.enquiryNumber,
      entityId: input.entityId,
      clientId: input.clientId,
      clientName: client.name || '',
      clientContactPerson: enquiry.clientContactPerson,
      clientEmail: enquiry.clientEmail,
      clientAddress: client.billingAddress
        ? `${client.billingAddress.line1}, ${client.billingAddress.city}, ${client.billingAddress.state} ${client.billingAddress.postalCode}`
        : '',
      title: input.title,
      validityDate: Timestamp.fromDate(input.validityDate),
      preparationDate: now,

      // Empty scope of work - will be filled via scope matrix
      scopeOfWork: {
        summary: enquiry.description || '',
        objectives: [],
        deliverables: [],
        inclusions: [],
        exclusions: [],
        assumptions: [],
      },

      // Empty scope of supply - will be filled via scope matrix
      scopeOfSupply: [],

      // Initialize empty scope matrix
      scopeMatrix: {
        services: [],
        supply: [],
        exclusions: [],
        isComplete: false,
      },

      // Default delivery period
      deliveryPeriod: {
        durationInWeeks: 0,
        description: 'To be determined during scope definition',
        milestones: [],
      },

      // Empty pricing - will be filled in pricing module
      pricing: {
        currency: 'INR',
        lineItems: [],
        subtotal: { amount: 0, currency: 'INR' },
        taxItems: [],
        totalAmount: { amount: 0, currency: 'INR' },
        paymentTerms: 'To be determined',
      },

      // Empty terms
      terms: {},

      // Status & Workflow
      status: 'DRAFT',
      workflowStage: 'SCOPE_DEFINITION' as ProposalWorkflowStage,
      approvalHistory: [],
      attachments: [],

      // Audit
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
      isLatestRevision: true,
    };

    // Remove undefined values before sending to Firestore
    const cleanedProposal = Object.fromEntries(
      Object.entries(proposal).filter(([, value]) => value !== undefined)
    );

    const docRef = await addDoc(collection(db, COLLECTIONS.PROPOSALS), cleanedProposal);

    // Update enquiry status to PROPOSAL_IN_PROGRESS
    await updateDoc(doc(db, COLLECTIONS.ENQUIRIES, input.enquiryId), {
      status: 'PROPOSAL_IN_PROGRESS',
      proposalCreatedAt: now,
      updatedAt: now,
      updatedBy: userId,
    });

    logger.info('Minimal proposal created', {
      proposalId: docRef.id,
      proposalNumber,
      enquiryId: input.enquiryId,
    });

    return { id: docRef.id, ...proposal };
  } catch (error) {
    logger.error('Error creating minimal proposal', { error });
    throw error;
  }
}

/**
 * Get proposal by ID
 */
export async function getProposalById(db: Firestore, proposalId: string): Promise<Proposal | null> {
  try {
    const docSnap = await getDoc(doc(db, COLLECTIONS.PROPOSALS, proposalId));
    if (!docSnap.exists()) {
      logger.warn('Proposal not found', { proposalId });
      return null;
    }
    const proposalData = docSnap.data() as Omit<Proposal, 'id'>;
    const proposal: Proposal = { id: docSnap.id, ...proposalData };
    return proposal;
  } catch (error) {
    logger.error('Error fetching proposal', { proposalId, error });
    throw error;
  }
}

/**
 * Get proposal by number
 */
export async function getProposalByNumber(
  db: Firestore,
  proposalNumber: string,
  revision?: number
): Promise<Proposal | null> {
  try {
    let q = query(
      collection(db, COLLECTIONS.PROPOSALS),
      where('proposalNumber', '==', proposalNumber)
    );

    if (revision !== undefined) {
      q = query(q, where('revision', '==', revision));
    } else {
      // Get latest revision
      q = query(q, where('isLatestRevision', '==', true));
    }

    q = query(q, limit(1));

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const firstDoc = snapshot.docs[0];
    if (!firstDoc) {
      return null;
    }

    const proposalData = firstDoc.data() as Omit<Proposal, 'id'>;
    const proposal: Proposal = { id: firstDoc.id, ...proposalData };
    return proposal;
  } catch (error) {
    logger.error('Error fetching proposal by number', { proposalNumber, error });
    throw error;
  }
}

/**
 * List proposals with filters
 */
export async function listProposals(
  db: Firestore,
  options: ListProposalsOptions
): Promise<Proposal[]> {
  try {
    let q = query(collection(db, COLLECTIONS.PROPOSALS));

    // Entity filter (optional for Superadmin)
    if (options.entityId) {
      q = query(q, where('entityId', '==', options.entityId));
    }

    // Only latest revisions by default
    if (options.isLatestRevision !== false) {
      q = query(q, where('isLatestRevision', '==', true));
    }

    // Enquiry filter
    if (options.enquiryId) {
      q = query(q, where('enquiryId', '==', options.enquiryId));
    }

    // Status filter
    if (options.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      if (statuses.length > 0) {
        q = query(q, where('status', 'in', statuses));
      }
    }

    // Client filter
    if (options.clientId) {
      q = query(q, where('clientId', '==', options.clientId));
    }

    // Created by filter
    if (options.createdBy) {
      q = query(q, where('createdBy', '==', options.createdBy));
    }

    // Date range filter
    if (options.dateFrom) {
      q = query(q, where('createdAt', '>=', options.dateFrom));
    }
    if (options.dateTo) {
      q = query(q, where('createdAt', '<=', options.dateTo));
    }

    // Order by created date (most recent first)
    q = query(q, orderBy('createdAt', 'desc'));

    // Pagination
    if (options.startAfter) {
      const startDoc = await getDoc(doc(db, COLLECTIONS.PROPOSALS, options.startAfter));
      if (startDoc.exists()) {
        q = query(q, firestoreStartAfter(startDoc));
      }
    }

    if (options.limit) {
      q = query(q, limit(options.limit));
    }

    const snapshot = await getDocs(q);
    const proposals: Proposal[] = snapshot.docs.map((d) => docToTyped<Proposal>(d.id, d.data()));

    // Client-side search filter
    if (options.searchTerm) {
      const searchLower = options.searchTerm.toLowerCase();
      return proposals.filter(
        (p) =>
          p.proposalNumber.toLowerCase().includes(searchLower) ||
          p.title.toLowerCase().includes(searchLower) ||
          p.clientName.toLowerCase().includes(searchLower) ||
          p.enquiryNumber.toLowerCase().includes(searchLower)
      );
    }

    return proposals;
  } catch (error) {
    logger.error('Error listing proposals', { error });
    throw error;
  }
}

/**
 * Update proposal
 */
export async function updateProposal(
  db: Firestore,
  proposalId: string,
  input: UpdateProposalInput,
  userId: string
): Promise<void> {
  try {
    const updates: Record<string, unknown> = {
      ...input,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    // Remove undefined values before sending to Firestore (Firestore doesn't accept undefined)
    const cleanedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );

    await updateDoc(doc(db, COLLECTIONS.PROPOSALS, proposalId), cleanedUpdates);

    logger.info('Proposal updated', { proposalId });
  } catch (error) {
    logger.error('Error updating proposal', { proposalId, error });
    throw error;
  }
}

/**
 * Create proposal revision
 */
export async function createProposalRevision(
  db: Firestore,
  proposalId: string,
  revisionReason: string,
  userId: string
): Promise<Proposal> {
  try {
    // Get current proposal
    const currentProposal = await getProposalById(db, proposalId);
    if (!currentProposal) {
      throw new Error('Proposal not found');
    }

    // Use transaction to ensure atomicity
    const newProposal = await runTransaction(db, async (transaction) => {
      // Mark current proposal as not latest
      transaction.update(doc(db, COLLECTIONS.PROPOSALS, proposalId), {
        isLatestRevision: false,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
      });

      // Create new revision
      const now = Timestamp.now();
      const newRevision: Omit<Proposal, 'id'> = {
        ...currentProposal,
        revision: currentProposal.revision + 1,
        status: 'DRAFT',
        previousRevisionId: proposalId,
        revisionReason,
        submittedAt: undefined,
        submittedByUserId: undefined,
        submittedByUserName: undefined,
        acceptedAt: undefined,
        rejectedAt: undefined,
        rejectionReason: undefined,
        generatedPdfUrl: undefined,
        approvalHistory: [],
        updatedAt: now,
        updatedBy: userId,
        isLatestRevision: true,
      };

      // Remove undefined values before sending to Firestore (Firestore doesn't accept undefined)
      const cleanedRevision = Object.fromEntries(
        Object.entries(newRevision).filter(([, value]) => value !== undefined)
      );

      const docRef = doc(collection(db, COLLECTIONS.PROPOSALS));
      transaction.set(docRef, cleanedRevision);

      return { id: docRef.id, ...newRevision };
    });

    logger.info('Proposal revision created', {
      originalId: proposalId,
      newId: newProposal.id,
      revision: newProposal.revision,
    });

    return newProposal;
  } catch (error) {
    logger.error('Error creating proposal revision', { proposalId, error });
    throw error;
  }
}

// NOTE: submitProposalForApproval, recordApprovalAction, submitProposalToClient,
// acceptProposal, and rejectProposal were removed as dead code — they duplicated
// functionality in @/lib/proposals/approvalWorkflow.ts which is the actual
// implementation used (with proper state machine validation).

/**
 * Get all revisions of a proposal
 */
export async function getProposalRevisions(
  db: Firestore,
  proposalNumber: string
): Promise<Proposal[]> {
  try {
    const q = query(
      collection(db, COLLECTIONS.PROPOSALS),
      where('proposalNumber', '==', proposalNumber),
      orderBy('revision', 'desc')
    );

    const snapshot = await getDocs(q);
    const proposals: Proposal[] = snapshot.docs.map((d) => docToTyped<Proposal>(d.id, d.data()));
    return proposals;
  } catch (error) {
    logger.error('Error fetching proposal revisions', { proposalNumber, error });
    throw error;
  }
}

/**
 * Get proposals count by status (for dashboard)
 */
export async function getProposalsCountByStatus(
  db: Firestore,
  entityId: string
): Promise<Record<ProposalStatus, number>> {
  try {
    const q = query(
      collection(db, COLLECTIONS.PROPOSALS),
      where('entityId', '==', entityId),
      where('isLatestRevision', '==', true)
    );
    const snapshot = await getDocs(q);

    const counts: Record<string, number> = {};
    snapshot.docs.forEach((doc) => {
      const status = doc.data().status as ProposalStatus;
      counts[status] = (counts[status] || 0) + 1;
    });

    return counts as Record<ProposalStatus, number>;
  } catch (error) {
    logger.error('Error getting proposal counts', { error });
    throw error;
  }
}

/**
 * Clone proposal input
 */
export interface CloneProposalInput {
  sourceProposalId: string;
  newTitle: string;
  // Optional: link to different client/enquiry
  newClientId?: string;
  newEnquiryId?: string;
  // What to copy
  copyScope?: boolean;
  copyPricing?: boolean;
  copyTerms?: boolean;
  copyAttachments?: boolean;
}

/**
 * Clone an existing proposal to create a new one
 *
 * Creates a new proposal based on an existing one, copying scope, pricing,
 * and other configurable sections. Useful for similar projects or repeat clients.
 */
export async function cloneProposal(
  db: Firestore,
  input: CloneProposalInput,
  userId: string,
  userName: string
): Promise<Proposal> {
  try {
    // Load source proposal
    const sourceProposal = await getProposalById(db, input.sourceProposalId);
    if (!sourceProposal) {
      throw new Error('Source proposal not found');
    }

    // Generate new proposal number
    const proposalNumber = await generateProposalNumber(db);
    const now = Timestamp.now();

    // Determine client info - use new client if provided, otherwise copy from source
    let clientId = sourceProposal.clientId;
    let clientName = sourceProposal.clientName;
    let clientContactPerson = sourceProposal.clientContactPerson;
    let clientEmail = sourceProposal.clientEmail;
    let clientAddress = sourceProposal.clientAddress;
    let enquiryId = sourceProposal.enquiryId;
    let enquiryNumber = sourceProposal.enquiryNumber;

    if (input.newClientId && input.newClientId !== sourceProposal.clientId) {
      const clientDoc = await getDoc(doc(db, COLLECTIONS.ENTITIES, input.newClientId));
      if (clientDoc.exists()) {
        const client = clientDoc.data();
        clientId = input.newClientId;
        clientName = client.name || '';
        clientContactPerson = client.primaryContact?.name || '';
        clientEmail = client.primaryContact?.email || client.email || '';
        clientAddress = client.billingAddress
          ? `${client.billingAddress.line1}, ${client.billingAddress.city}, ${client.billingAddress.state} ${client.billingAddress.postalCode}`
          : '';
      }
    }

    if (input.newEnquiryId && input.newEnquiryId !== sourceProposal.enquiryId) {
      const enquiryDoc = await getDoc(doc(db, COLLECTIONS.ENQUIRIES, input.newEnquiryId));
      if (enquiryDoc.exists()) {
        const enquiry = enquiryDoc.data() as Omit<Enquiry, 'id'>;
        enquiryId = input.newEnquiryId;
        enquiryNumber = enquiry.enquiryNumber;
        // Also update client contact from enquiry if available
        if (enquiry.clientContactPerson) clientContactPerson = enquiry.clientContactPerson;
        if (enquiry.clientEmail) clientEmail = enquiry.clientEmail;
      }
    }

    // Build cloned proposal
    const clonedProposal: Omit<Proposal, 'id'> = {
      proposalNumber,
      revision: 1,
      enquiryId,
      enquiryNumber,
      entityId: sourceProposal.entityId,
      clientId,
      clientName,
      clientContactPerson,
      clientEmail,
      clientAddress,
      title: input.newTitle,
      validityDate: Timestamp.fromDate(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      ),
      preparationDate: now,

      // Conditionally copy sections
      scopeOfWork:
        input.copyScope !== false && sourceProposal.scopeOfWork
          ? sourceProposal.scopeOfWork
          : {
              summary: '',
              objectives: [],
              deliverables: [],
              inclusions: [],
              exclusions: [],
              assumptions: [],
            },
      scopeOfSupply: input.copyScope !== false ? sourceProposal.scopeOfSupply : [],
      scopeMatrix:
        input.copyScope !== false && sourceProposal.scopeMatrix
          ? {
              services: sourceProposal.scopeMatrix.services || [],
              supply: sourceProposal.scopeMatrix.supply || [],
              exclusions: sourceProposal.scopeMatrix.exclusions || [],
              isComplete: false, // Reset completion status
              lastUpdatedAt: now,
              lastUpdatedBy: userId,
            }
          : undefined,

      deliveryPeriod: sourceProposal.deliveryPeriod,

      pricing:
        input.copyPricing !== false
          ? {
              ...sourceProposal.pricing,
            }
          : {
              currency: 'INR',
              lineItems: [],
              subtotal: { amount: 0, currency: 'INR' },
              taxItems: [],
              totalAmount: { amount: 0, currency: 'INR' },
              paymentTerms: sourceProposal.pricing?.paymentTerms || '',
            },

      pricingConfig:
        input.copyPricing !== false && sourceProposal.pricingConfig
          ? {
              ...sourceProposal.pricingConfig,
              isComplete: false, // Reset completion status
              lastUpdatedAt: now,
              lastUpdatedBy: userId,
            }
          : undefined,

      terms: input.copyTerms !== false ? sourceProposal.terms : {},

      // Reset status and workflow
      status: 'DRAFT',
      approvalHistory: [],
      attachments: input.copyAttachments ? sourceProposal.attachments : [],

      // Metadata
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
      isLatestRevision: true,

      // Track cloning
      clonedFrom: {
        proposalId: sourceProposal.id,
        proposalNumber: sourceProposal.proposalNumber,
        clonedAt: now,
        clonedBy: userId,
        clonedByName: userName,
      },
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.PROPOSALS), clonedProposal);

    logger.info('Proposal cloned', {
      newProposalId: docRef.id,
      newProposalNumber: proposalNumber,
      sourceProposalId: input.sourceProposalId,
      sourceProposalNumber: sourceProposal.proposalNumber,
    });

    return { id: docRef.id, ...clonedProposal };
  } catch (error) {
    logger.error('Error cloning proposal', { error, input });
    throw error;
  }
}

// ============================================================================
// Proposal Template Functions
// ============================================================================

/**
 * Strip IDs and estimation data from scope items for template storage
 */
function stripScopeItemForTemplate(
  item: ScopeItem
): Omit<ScopeItem, 'id' | 'itemNumber' | 'linkedBOMs' | 'estimationSummary'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, itemNumber, linkedBOMs, estimationSummary, ...rest } = item;
  return rest;
}

/**
 * Create a proposal template from an existing proposal
 */
export async function createProposalTemplate(
  db: Firestore,
  proposal: Proposal,
  input: CreateProposalTemplateInput,
  userId: string,
  userName: string
): Promise<ProposalTemplate> {
  try {
    const now = Timestamp.now();

    const template: Omit<ProposalTemplate, 'id'> = {
      name: input.name,
      description: input.description,
      category: input.category,
      entityId: proposal.entityId,

      // Copy scope matrix if requested
      scopeMatrix:
        input.includeScope !== false && proposal.scopeMatrix
          ? {
              services: (proposal.scopeMatrix.services || []).map(stripScopeItemForTemplate),
              supply: (proposal.scopeMatrix.supply || []).map(stripScopeItemForTemplate),
              exclusions: (proposal.scopeMatrix.exclusions || []).map(stripScopeItemForTemplate),
            }
          : undefined,

      // Copy pricing defaults if requested
      pricingDefaults:
        input.includePricing !== false && proposal.pricingConfig
          ? {
              overheadPercent: proposal.pricingConfig.overheadPercent,
              contingencyPercent: proposal.pricingConfig.contingencyPercent,
              profitMarginPercent: proposal.pricingConfig.profitMarginPercent,
              taxPercent: proposal.pricingConfig.taxPercent,
              validityDays: proposal.pricingConfig.validityDays,
            }
          : undefined,

      // Copy terms if requested
      terms: input.includeTerms !== false ? proposal.terms : undefined,

      // Copy delivery period if requested
      deliveryPeriod:
        input.includeDelivery !== false && proposal.deliveryPeriod
          ? {
              durationInWeeks: proposal.deliveryPeriod.durationInWeeks,
              description: proposal.deliveryPeriod.description,
            }
          : undefined,

      // Metadata
      isActive: true,
      usageCount: 0,
      createdAt: now,
      createdBy: userId,
      createdByName: userName,
      updatedAt: now,

      // Source tracking
      sourceProposalId: input.sourceProposalId || proposal.id,
      sourceProposalNumber: proposal.proposalNumber,
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.PROPOSAL_TEMPLATES), template);

    logger.info('Proposal template created', {
      templateId: docRef.id,
      templateName: input.name,
      sourceProposalId: proposal.id,
    });

    return { id: docRef.id, ...template };
  } catch (error) {
    logger.error('Error creating proposal template', { error, input });
    throw error;
  }
}

/**
 * List proposal templates
 */
export async function listProposalTemplates(
  db: Firestore,
  options: ListProposalTemplatesOptions = {}
): Promise<ProposalTemplate[]> {
  try {
    let q = query(collection(db, COLLECTIONS.PROPOSAL_TEMPLATES), orderBy('createdAt', 'desc'));

    if (options.entityId) {
      q = query(q, where('entityId', '==', options.entityId));
    }

    if (options.category) {
      q = query(q, where('category', '==', options.category));
    }

    if (options.isActive !== undefined) {
      q = query(q, where('isActive', '==', options.isActive));
    }

    if (options.limit) {
      q = query(q, limit(options.limit));
    }

    const snapshot = await getDocs(q);
    let templates = snapshot.docs.map((d) => docToTyped<ProposalTemplate>(d.id, d.data()));

    // Filter by search term if provided (client-side)
    if (options.searchTerm) {
      const term = options.searchTerm.toLowerCase();
      templates = templates.filter(
        (t) =>
          t.name.toLowerCase().includes(term) ||
          t.description?.toLowerCase().includes(term) ||
          t.category?.toLowerCase().includes(term)
      );
    }

    logger.info('Proposal templates listed', { count: templates.length });
    return templates;
  } catch (error) {
    logger.error('Error listing proposal templates', { error, options });
    throw error;
  }
}

/**
 * Get a proposal template by ID
 */
export async function getProposalTemplateById(
  db: Firestore,
  templateId: string
): Promise<ProposalTemplate | null> {
  try {
    const docRef = doc(db, COLLECTIONS.PROPOSAL_TEMPLATES, templateId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return docToTyped<ProposalTemplate>(docSnap.id, docSnap.data());
  } catch (error) {
    logger.error('Error getting proposal template', { error, templateId });
    throw error;
  }
}

/**
 * Delete a proposal template
 */
export async function deleteProposalTemplate(db: Firestore, templateId: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.PROPOSAL_TEMPLATES, templateId);
    await updateDoc(docRef, { isActive: false });

    logger.info('Proposal template deleted', { templateId });
  } catch (error) {
    logger.error('Error deleting proposal template', { error, templateId });
    throw error;
  }
}

/**
 * Increment template usage count
 */
export async function incrementTemplateUsage(db: Firestore, templateId: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTIONS.PROPOSAL_TEMPLATES, templateId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const template = docSnap.data() as ProposalTemplate;
      await updateDoc(docRef, {
        usageCount: (template.usageCount || 0) + 1,
        updatedAt: Timestamp.now(),
      });
    }
  } catch (error) {
    logger.error('Error incrementing template usage', { error, templateId });
    // Non-critical, don't throw
  }
}
