// Enquiry Validation Schemas

import { z } from 'zod';
import { emailSchema, phoneSchema, moneySchema } from './common';
import { sanitizeDisplayName } from '../sanitize';

/**
 * Enquiry Status enum schema
 */
export const enquiryStatusSchema = z.enum([
  'NEW',
  'UNDER_REVIEW',
  'BID_DECISION_PENDING',
  'NO_BID',
  'PROPOSAL_IN_PROGRESS',
  'PROPOSAL_SUBMITTED',
  'WON',
  'LOST',
  'CANCELLED',
]);

/**
 * Enquiry Source enum schema
 */
export const enquirySourceSchema = z.enum([
  'EMAIL',
  'PHONE',
  'MEETING',
  'WEBSITE',
  'REFERRAL',
  'OTHER',
]);

/**
 * Enquiry Project Type enum schema
 */
export const enquiryProjectTypeSchema = z.enum([
  'SUPPLY_ONLY',
  'SUPPLY_AND_INSTALL',
  'ENGINEERING_DESIGN',
  'TURNKEY',
  'OTHER',
]);

/**
 * Enquiry Urgency enum schema
 * Simplified to 2 levels for clearer prioritization
 */
export const enquiryUrgencySchema = z.enum(['STANDARD', 'URGENT']);

/**
 * Enquiry attachment schema (matches EnquiryDocument from types)
 */
export const attachmentSchema = z.object({
  id: z.string().optional(),
  fileName: z.string().min(1, 'File name is required'),
  fileUrl: z.string().url('Must be a valid URL'),
  fileSize: z.number().positive('File size must be positive'),
  fileType: z.string().min(1, 'File type is required'),
});

/**
 * Create Enquiry Input schema
 */
export const createEnquiryInputSchema = z.object({
  entityId: z.string().min(1, 'Entity ID is required'),
  clientId: z.string().min(1, 'Client is required'),
  clientContactPerson: z
    .string()
    .min(1, 'Contact person is required')
    .transform(sanitizeDisplayName),
  clientEmail: emailSchema,
  clientPhone: phoneSchema,
  clientReferenceNumber: z.string().optional(),
  title: z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title too long'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  receivedVia: enquirySourceSchema,
  referenceSource: z.string().optional(),
  projectType: enquiryProjectTypeSchema.optional(),
  industry: z.string().optional(),
  location: z.string().optional(),
  urgency: enquiryUrgencySchema,
  estimatedBudget: moneySchema.optional(),
  receivedDate: z.date(),
  requirements: z.array(z.string()).default([]),
  attachments: z.array(attachmentSchema).default([]),
  assignedToUserId: z.string().optional(),
});

/**
 * Create Enquiry Form schema (for UI with Date objects)
 * Used with react-hook-form - converts to CreateEnquiryInput on submit
 * Note: entityId is omitted from form (added programmatically from claims)
 */
export const createEnquiryFormSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  clientContactPerson: z
    .string()
    .min(1, 'Contact person is required')
    .transform(sanitizeDisplayName),
  clientEmail: emailSchema,
  clientPhone: phoneSchema,
  clientReferenceNumber: z.string().optional(),
  title: z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title too long'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  receivedVia: enquirySourceSchema,
  referenceSource: z.string().optional(),
  projectType: enquiryProjectTypeSchema.optional(),
  industry: z.string().optional(),
  location: z.string().optional(),
  urgency: enquiryUrgencySchema,
  estimatedBudget: moneySchema.optional(),
  receivedDate: z.date(), // UI uses Date objects
  requiredDeliveryDate: z.date().optional(),
  requirements: z.array(z.string()).default([]),
  attachments: z.array(attachmentSchema).default([]),
  assignedToUserId: z.string().optional(),
});

/**
 * Update Enquiry Input schema
 */
export const updateEnquiryInputSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(10).optional(),
  clientContactPerson: z.string().min(1).transform(sanitizeDisplayName).optional(),
  clientEmail: emailSchema.optional(),
  clientPhone: phoneSchema.optional(),
  clientReferenceNumber: z.string().optional(),
  receivedVia: enquirySourceSchema.optional(),
  referenceSource: z.string().optional(),
  projectType: enquiryProjectTypeSchema.optional(),
  industry: z.string().optional(),
  location: z.string().optional(),
  urgency: enquiryUrgencySchema.optional(),
  estimatedBudget: moneySchema.optional(),
  assignedToUserId: z.string().optional(),
  status: enquiryStatusSchema.optional(),
});
