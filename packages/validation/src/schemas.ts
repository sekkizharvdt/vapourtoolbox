// Zod validation schemas

import { z } from 'zod';
import {
  PHONE_REGEX,
  GST_REGEX,
  PAN_REGEX,
  PINCODE_REGEX,
  IFSC_REGEX,
} from './regex';
import {
  sanitizeEmail,
  sanitizePhone,
  sanitizeDisplayName,
  sanitizeEntityName,
  sanitizeCode,
} from './sanitize';

/**
 * Common field schemas with sanitization
 * Using Zod's built-in email validation which is more robust than regex
 */
export const emailSchema = z
  .string()
  .transform(sanitizeEmail)
  .pipe(z.string().email('Invalid email format'));

export const phoneSchema = z
  .string()
  .transform(sanitizePhone)
  .pipe(z.string().regex(PHONE_REGEX, 'Invalid phone number'));

export const gstSchema = z
  .string()
  .transform(sanitizeCode)
  .pipe(z.string().regex(GST_REGEX, 'Invalid GST number'))
  .optional();

export const panSchema = z
  .string()
  .transform(sanitizeCode)
  .pipe(z.string().regex(PAN_REGEX, 'Invalid PAN number'))
  .optional();

export const pincodeSchema = z.string().regex(PINCODE_REGEX, 'Invalid postal code');

export const ifscSchema = z.string().regex(IFSC_REGEX, 'Invalid IFSC code').optional();

/**
 * Address schema
 */
export const addressSchema = z.object({
  line1: z.string().min(1, 'Address line 1 is required'),
  line2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: pincodeSchema,
  country: z.string().default('India'),
});

/**
 * Money schema
 */
export const moneySchema = z.object({
  amount: z.number().min(0, 'Amount must be positive'),
  currency: z.enum(['INR', 'USD', 'EUR', 'GBP', 'AED']).default('INR'),
});

/**
 * User schema
 */
export const userSchema = z.object({
  email: emailSchema,
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .transform(sanitizeDisplayName)
    .pipe(z.string().min(1, 'Display name cannot be empty after sanitization')),
  phone: phoneSchema.optional(),
  mobile: phoneSchema.optional(),
  department: z
    .enum(['MANAGEMENT', 'FINANCE', 'HR', 'ENGINEERING', 'PROCUREMENT', 'OPERATIONS', 'SALES'])
    .optional(),
  jobTitle: z.string().optional(),
});

/**
 * Entity schema
 */
export const entitySchema = z.object({
  name: z
    .string()
    .min(1, 'Entity name is required')
    .transform(sanitizeEntityName)
    .pipe(z.string().min(1, 'Entity name cannot be empty after sanitization')),
  legalName: z.string().transform(sanitizeEntityName).optional(),
  contactPerson: z
    .string()
    .min(1, 'Contact person is required')
    .transform(sanitizeDisplayName)
    .pipe(z.string().min(1, 'Contact person cannot be empty after sanitization')),
  email: emailSchema,
  phone: phoneSchema,
  mobile: phoneSchema.optional(),
  billingAddress: addressSchema,
  shippingAddress: addressSchema.optional(),
  taxIdentifiers: z
    .object({
      gstin: gstSchema,
      pan: panSchema,
    })
    .optional(),
});

/**
 * Project schema
 */
export const projectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  status: z.enum(['PROPOSAL', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'ARCHIVED']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  client: z.object({
    entityId: z.string().min(1, 'Client is required'),
    entityName: z.string(),
    contactPerson: z.string(),
    contactEmail: emailSchema,
    contactPhone: phoneSchema,
  }),
});
