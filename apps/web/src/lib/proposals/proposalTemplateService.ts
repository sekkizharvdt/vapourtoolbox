/**
 * Proposal Template Service
 * CRUD operations for proposal templates (separate collection: proposalTemplates)
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
} from 'firebase/firestore';
import { createLogger } from '@vapour/logger';
import { docToTyped } from '@/lib/firebase/typeHelpers';
import type {
  Proposal,
  ProposalTemplate,
  CreateProposalTemplateInput,
  ListProposalTemplatesOptions,
} from '@vapour/types';

const logger = createLogger({ context: 'proposalTemplateService' });

const COLLECTION = 'proposalTemplates';

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

      // Copy unified scope matrix if requested
      unifiedScopeMatrix:
        input.includeScope !== false && proposal.unifiedScopeMatrix
          ? {
              ...proposal.unifiedScopeMatrix,
              isComplete: false,
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

    const docRef = await addDoc(collection(db, COLLECTION), template);

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
    let q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));

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
    const docRef = doc(db, COLLECTION, templateId);
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
    const docRef = doc(db, COLLECTION, templateId);
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
    const docRef = doc(db, COLLECTION, templateId);
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
