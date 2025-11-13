/**
 * Cloud Functions for Business Entity Operations
 *
 * Provides server-side validation and processing for business entities
 * with comprehensive input validation, duplicate detection, and security checks.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import {
  validatePAN,
  validateGSTIN,
  checkEntityDuplicates,
  stripHtml,
  sanitizeEmail,
} from '@vapour/validation';
import { validateOrThrow } from './utils/validation';
import { z } from 'zod';

const db = admin.firestore();

/**
 * Validation schema for entity creation
 */
const createEntitySchema = z.object({
  name: z.string().min(1, 'Entity name is required').max(200),
  legalName: z.string().min(1, 'Legal name is required').max(200),
  pan: z.string().optional(),
  gstin: z.string().optional(),
  tan: z.string().optional(),
  email: z.string().email('Invalid email format').optional(),
  phone: z.string().optional(),
  address: z
    .object({
      line1: z.string(),
      line2: z.string().optional(),
      city: z.string(),
      state: z.string(),
      postalCode: z.string(),
      country: z.string().default('India'),
    })
    .optional(),
  roles: z.array(z.enum(['VENDOR', 'CUSTOMER', 'SUPPLIER'])).min(1, 'At least one role required'),
  status: z.enum(['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED']).default('PENDING'),
});

/**
 * Validation schema for entity updates
 */
const updateEntitySchema = createEntitySchema.partial().extend({
  entityId: z.string().min(1, 'Entity ID is required'),
});

/**
 * Create Business Entity (with validation)
 *
 * Validates all inputs including PAN/GSTIN checksums,
 * checks for duplicates, and sanitizes user input.
 *
 * Required permission: CREATE_ENTITIES
 */
export const createEntity = onCall(async (request) => {
  // 1. Authentication check
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  // 2. Permission check (bit 4: CREATE_ENTITIES = 8)
  const userPermissions = (request.auth.token.permissions as number) || 0;
  const CREATE_ENTITIES = 8;

  if ((userPermissions & CREATE_ENTITIES) !== CREATE_ENTITIES) {
    throw new HttpsError(
      'permission-denied',
      'CREATE_ENTITIES permission required to create entities'
    );
  }

  // 3. Sanitize input data
  const sanitizedData = {
    name: stripHtml(request.data.name),
    legalName: stripHtml(request.data.legalName),
    pan: request.data.pan ? stripHtml(request.data.pan).toUpperCase() : undefined,
    gstin: request.data.gstin ? stripHtml(request.data.gstin).toUpperCase() : undefined,
    tan: request.data.tan ? stripHtml(request.data.tan).toUpperCase() : undefined,
    email: request.data.email ? sanitizeEmail(request.data.email) : undefined,
    phone: request.data.phone,
    address: request.data.address,
    roles: request.data.roles,
    status: request.data.status || 'PENDING',
  };

  // 4. Validate schema
  const validData = validateOrThrow(createEntitySchema, sanitizedData);

  // 5. Validate PAN if provided
  if (validData.pan) {
    const panValidation = validatePAN(validData.pan);
    if (!panValidation.valid) {
      throw new HttpsError('invalid-argument', `Invalid PAN: ${panValidation.error}`);
    }
  }

  // 6. Validate GSTIN if provided (includes PAN validation)
  if (validData.gstin) {
    const gstinValidation = validateGSTIN(validData.gstin);
    if (!gstinValidation.valid) {
      throw new HttpsError('invalid-argument', `Invalid GSTIN: ${gstinValidation.error}`);
    }

    // Cross-validate PAN from GSTIN
    if (validData.pan && gstinValidation.pan && validData.pan !== gstinValidation.pan) {
      throw new HttpsError('invalid-argument', 'PAN in GSTIN does not match provided PAN');
    }
  }

  // 7. Check for duplicates
  try {
    const duplicateCheck = await checkEntityDuplicates(
      db,
      validData.pan,
      validData.gstin,
      validData.email
    );

    if (duplicateCheck.hasDuplicates) {
      const duplicateFields = Object.keys(duplicateCheck.duplicates).join(', ');
      throw new HttpsError('already-exists', `Entity with same ${duplicateFields} already exists`, {
        duplicates: duplicateCheck.duplicates,
      });
    }
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error('Error checking duplicates', { error });
    throw new HttpsError('internal', 'Failed to check for duplicate entities');
  }

  // 8. Create entity document
  try {
    const entityData = {
      ...validData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: request.auth.uid,
      updatedBy: request.auth.uid,
      isActive: validData.status === 'ACTIVE',
    };

    const entityRef = await db.collection('businessEntities').add(entityData);

    logger.info('Entity created successfully', {
      entityId: entityRef.id,
      name: validData.name,
      createdBy: request.auth.uid,
    });

    return {
      success: true,
      entityId: entityRef.id,
      message: 'Entity created successfully',
    };
  } catch (error) {
    logger.error('Error creating entity', { error });
    throw new HttpsError('internal', 'Failed to create entity');
  }
});

/**
 * Update Business Entity (with validation)
 *
 * Validates updates and checks for duplicates if PAN/GSTIN/email changed.
 *
 * Required permission: EDIT_ENTITIES
 */
export const updateEntity = onCall(async (request) => {
  // 1. Authentication check
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }

  // 2. Permission check (bit 5: EDIT_ENTITIES = 16)
  const userPermissions = (request.auth.token.permissions as number) || 0;
  const EDIT_ENTITIES = 16;

  if ((userPermissions & EDIT_ENTITIES) !== EDIT_ENTITIES) {
    throw new HttpsError(
      'permission-denied',
      'EDIT_ENTITIES permission required to update entities'
    );
  }

  // 3. Sanitize input (only provided fields)
  const sanitizedData: Record<string, unknown> = {
    entityId: request.data.entityId,
  };

  if (request.data.name !== undefined) {
    sanitizedData.name = stripHtml(request.data.name);
  }
  if (request.data.legalName !== undefined) {
    sanitizedData.legalName = stripHtml(request.data.legalName);
  }
  if (request.data.pan !== undefined) {
    sanitizedData.pan = stripHtml(request.data.pan).toUpperCase();
  }
  if (request.data.gstin !== undefined) {
    sanitizedData.gstin = stripHtml(request.data.gstin).toUpperCase();
  }
  if (request.data.email !== undefined) {
    sanitizedData.email = sanitizeEmail(request.data.email);
  }

  // Copy other fields as-is
  const otherFields = ['phone', 'address', 'roles', 'status', 'tan'];
  otherFields.forEach((field) => {
    if (request.data[field] !== undefined) {
      sanitizedData[field] = request.data[field];
    }
  });

  // 4. Validate schema
  const validData = validateOrThrow(updateEntitySchema, sanitizedData);
  const { entityId, ...updateData } = validData;

  // 5. Check entity exists
  const entityRef = db.collection('businessEntities').doc(entityId);
  const entityDoc = await entityRef.get();

  if (!entityDoc.exists) {
    throw new HttpsError('not-found', 'Entity not found');
  }

  // 6. Validate PAN if provided
  if (updateData.pan) {
    const panValidation = validatePAN(updateData.pan);
    if (!panValidation.valid) {
      throw new HttpsError('invalid-argument', `Invalid PAN: ${panValidation.error}`);
    }
  }

  // 7. Validate GSTIN if provided
  if (updateData.gstin) {
    const gstinValidation = validateGSTIN(updateData.gstin);
    if (!gstinValidation.valid) {
      throw new HttpsError('invalid-argument', `Invalid GSTIN: ${gstinValidation.error}`);
    }
  }

  // 8. Check for duplicates (exclude current entity)
  if (updateData.pan || updateData.gstin || updateData.email) {
    try {
      const duplicateCheck = await checkEntityDuplicates(
        db,
        updateData.pan,
        updateData.gstin,
        updateData.email,
        entityId
      );

      if (duplicateCheck.hasDuplicates) {
        const duplicateFields = Object.keys(duplicateCheck.duplicates).join(', ');
        throw new HttpsError(
          'already-exists',
          `Entity with same ${duplicateFields} already exists`,
          {
            duplicates: duplicateCheck.duplicates,
          }
        );
      }
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }
      logger.error('Error checking duplicates', { error });
      throw new HttpsError('internal', 'Failed to check for duplicate entities');
    }
  }

  // 9. Update entity
  try {
    const finalUpdateData = {
      ...updateData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: request.auth.uid,
    };

    // Update isActive based on status if status is being updated
    if (updateData.status) {
      finalUpdateData.isActive = updateData.status === 'ACTIVE';
    }

    await entityRef.update(finalUpdateData);

    logger.info('Entity updated successfully', {
      entityId,
      updatedBy: request.auth.uid,
      fields: Object.keys(updateData),
    });

    return {
      success: true,
      entityId,
      message: 'Entity updated successfully',
    };
  } catch (error) {
    logger.error('Error updating entity', { error, entityId });
    throw new HttpsError('internal', 'Failed to update entity');
  }
});
