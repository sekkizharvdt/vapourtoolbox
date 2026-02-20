// Proposal Validation Schemas

import { z } from 'zod';
import { moneySchema } from './common';

/**
 * Proposal Status enum schema
 */
export const proposalStatusSchema = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'SUBMITTED',
  'UNDER_NEGOTIATION',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
]);

/**
 * Proposal Line Item Category enum schema
 */
export const proposalLineItemCategorySchema = z.enum([
  'EQUIPMENT',
  'MATERIAL',
  'SERVICE',
  'DESIGN',
  'INSTALLATION',
  'COMMISSIONING',
  'TRAINING',
  'OTHER',
]);

/**
 * Proposal Line Item schema
 */
export const proposalLineItemSchema = z.object({
  itemName: z.string().min(1, 'Item name is required'),
  description: z.string().min(1, 'Description is required'),
  category: proposalLineItemCategorySchema,
  quantity: z.number().positive('Quantity must be positive'),
  unit: z.string().min(1, 'Unit is required'),
  unitPrice: moneySchema.optional(),
  totalPrice: moneySchema,
  technicalSpecification: z.string().optional(),
  deliveryWeeks: z.number().int().positive().optional(),
  margin: z.number().min(0).max(100).optional(),
  bomItemId: z.string().optional(),
});

/**
 * Scope of Work schema
 */
export const scopeOfWorkSchema = z.object({
  summary: z.string().min(10, 'Summary must be at least 10 characters'),
  objectives: z.array(z.string()).min(1, 'At least one objective is required'),
  deliverables: z.array(z.string()).min(1, 'At least one deliverable is required'),
  inclusions: z.array(z.string()).default([]),
  exclusions: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
});

/**
 * Proposal Milestone schema
 */
export const proposalMilestoneSchema = z.object({
  milestoneNumber: z.number().int().positive('Milestone number must be positive'),
  description: z.string().min(1, 'Description is required'),
  deliverable: z.string().min(1, 'Deliverable is required'),
  durationInWeeks: z.number().int().positive('Duration must be positive'),
  paymentPercentage: z.number().min(0).max(100).optional(),
  taxType: z.enum(['INCLUSIVE', 'EXCLUSIVE', 'NOT_APPLICABLE']).optional(),
});

/**
 * Create Proposal Input schema
 */
export const createProposalSchema = z.object({
  enquiryId: z.string().min(1, 'Enquiry ID is required'),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  clientId: z.string().min(1, 'Client is required'),
  validityDate: z.date(), // UI uses Date
  scopeOfWork: z.object({
    summary: z.string().min(10, 'Summary must be at least 10 characters'),
    objectives: z.array(z.string()).min(1, 'At least one objective is required'),
    deliverables: z.array(z.string()).min(1, 'At least one deliverable is required'),
    inclusions: z.array(z.string()).default([]),
    exclusions: z.array(z.string()).default([]),
    assumptions: z.array(z.string()).default([]),
  }),
  deliveryPeriod: z.object({
    durationInWeeks: z.number().positive(),
    description: z.string(),
    milestones: z
      .array(proposalMilestoneSchema)
      .default([])
      .superRefine((milestones, ctx) => {
        const withPayment = milestones.filter((m) => (m.paymentPercentage ?? 0) > 0);
        if (withPayment.length > 0) {
          const total = withPayment.reduce((sum, m) => sum + (m.paymentPercentage ?? 0), 0);
          if (Math.abs(total - 100) > 0.01) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Payment percentages must sum to 100% (currently ${total.toFixed(1)}%)`,
            });
          }
        }
      }),
  }),
  paymentTerms: z.string().optional(),
  terms: z
    .object({
      warranty: z.string().optional(),
      guaranteeBank: z.string().optional(),
      performanceBond: z.string().optional(),
      liquidatedDamages: z.string().optional(),
      forceMajeure: z.string().optional(),
      disputeResolution: z.string().optional(),
      customTerms: z.array(z.string()).default([]),
    })
    .optional(),
});

/**
 * Delivery Period schema
 */
export const deliveryPeriodSchema = z.object({
  durationInWeeks: z.number().int().positive('Duration must be at least 1 week'),
  description: z.string().min(1, 'Description is required'),
  milestones: z.array(proposalMilestoneSchema).default([]),
});

/**
 * Price line item schema (matches PriceLineItem from types)
 */
export const priceLineItemSchema = z.object({
  id: z.string(),
  lineNumber: z.string(),
  description: z.string().min(1, 'Description is required'),
  amount: moneySchema,
  category: z.enum([
    'EQUIPMENT',
    'MATERIAL',
    'LABOR',
    'SERVICES',
    'OVERHEAD',
    'CONTINGENCY',
    'PROFIT',
    'OTHER',
  ]),
  linkedScopeItemId: z.string().optional(),
});

/**
 * Tax line item schema (matches TaxLineItem from types)
 */
export const taxLineItemSchema = z.object({
  id: z.string(),
  taxType: z.string().min(1, 'Tax type is required'),
  taxRate: z.number().min(0).max(100),
  taxAmount: moneySchema,
  appliedTo: z.enum(['SUBTOTAL', 'LINE_ITEM']).optional(),
});

/**
 * Update Proposal Input schema
 */
export const updateProposalSchema = z.object({
  title: z.string().min(3).optional(),
  scopeOfWork: scopeOfWorkSchema.partial().optional(),
  scopeOfSupply: z.array(proposalLineItemSchema).optional(),
  deliveryPeriod: deliveryPeriodSchema.partial().optional(),
  pricing: z
    .object({
      currency: moneySchema.shape.currency.optional(),
      lineItems: z.array(priceLineItemSchema).optional(),
      subtotal: moneySchema.optional(),
      taxItems: z.array(taxLineItemSchema).optional(),
      totalAmount: moneySchema.optional(),
      paymentTerms: z.string().optional(),
      advancePaymentPercentage: z.number().optional(),
    })
    .optional(),
  terms: z
    .object({
      warranty: z.string().optional(),
      guaranteeBank: z.string().optional(),
      performanceBond: z.string().optional(),
      liquidatedDamages: z.string().optional(),
      disputeResolution: z.string().optional(),
      customTerms: z.array(z.string()).optional(),
      status: proposalStatusSchema.optional(),
    })
    .optional(),
  status: proposalStatusSchema.optional(),
});

/**
 * Create Proposal Input schema
 */
export const createProposalInputSchema = z.object({
  entityId: z.string().min(1, 'Entity ID is required'),
  enquiryId: z.string().min(1, 'Enquiry ID is required'),
  title: z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title too long'),
  clientId: z.string().min(1, 'Client ID is required'),
  scopeOfWork: scopeOfWorkSchema,
  deliveryPeriod: deliveryPeriodSchema,
  paymentTerms: z.string().min(10, 'Payment terms must be at least 10 characters'),
});

/**
 * Update Proposal Input schema (Strict)
 */
export const updateProposalInputSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  scopeOfWork: scopeOfWorkSchema.partial().optional(),
  scopeOfSupply: z.array(proposalLineItemSchema).optional(),
  deliveryPeriod: deliveryPeriodSchema.partial().optional(),
  status: proposalStatusSchema.optional(),
  negotiationNotes: z.string().optional(),
});

/**
 * Import BOM to Proposal schema
 */
export const importBOMToProposalSchema = z.object({
  bomId: z.string().min(1, 'BOM ID is required'),
  proposalId: z.string().min(1, 'Proposal ID is required'),
  includeServiceCosts: z.boolean().default(true),
  applyMargin: z.number().min(0).max(100).default(20),
});
