import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import { createAuditLog, getActorFromAuth } from '../utils/audit';

/**
 * Cloud Function to create a new business entity with duplicate checking
 *
 * This function ensures:
 * 1. User is authenticated
 * 2. No duplicate entity names exist (case-insensitive)
 * 3. No duplicate tax identifiers (GSTIN, PAN) exist
 * 4. Deleted entities don't block creation (soft-delete support)
 * 5. All input is sanitized and validated
 */
export const createEntity = onCall(async (request) => {
  // 1. Authentication check
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to create entities');
  }

  const userId = request.auth.uid;
  const data = request.data;

  // 2. Input validation
  if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
    throw new HttpsError('invalid-argument', 'Entity name is required');
  }

  if (!Array.isArray(data.roles) || data.roles.length === 0) {
    throw new HttpsError('invalid-argument', 'At least one entity role is required');
  }

  // 3. Sanitize and normalize inputs
  const sanitizedName = sanitizeEntityName(data.name);
  const nameNormalized = sanitizedName.toLowerCase();

  const sanitizedData = {
    name: sanitizedName,
    nameNormalized,
    legalName: data.legalName ? sanitizeEntityName(data.legalName) : undefined,
    displayName: data.displayName ? sanitizeEntityName(data.displayName) : undefined,
    roles: data.roles,
    contactPerson: data.contactPerson || '',
    email: data.email || '',
    phone: data.phone || '',
    mobile: data.mobile,
    website: data.website,
    billingAddress: data.billingAddress || {},
    shippingAddress: data.shippingAddress,
    taxIdentifiers: sanitizeTaxIdentifiers(data.taxIdentifiers),
    bankDetails: data.bankDetails,
    creditTerms: data.creditTerms,
    paymentTerms: data.paymentTerms,
    industry: data.industry,
    category: data.category,
    tags: data.tags,
    notes: data.notes,
    status: data.status || 'ACTIVE',
    isActive: data.isActive !== undefined ? data.isActive : true,
    primaryContactId: data.primaryContactId,
    assignedToUserId: data.assignedToUserId,
  };

  const db = admin.firestore();
  const entitiesRef = db.collection('entities');

  try {
    // 4. Check for duplicate entity name (case-insensitive, excluding soft-deleted)
    const nameQuery = await entitiesRef
      .where('nameNormalized', '==', nameNormalized)
      .where('isDeleted', '==', false)
      .limit(1)
      .get();

    if (!nameQuery.empty) {
      throw new HttpsError(
        'already-exists',
        `An entity with the name "${sanitizedName}" already exists. Please use a different name.`
      );
    }

    // 5. Check for duplicate GSTIN if provided
    if (sanitizedData.taxIdentifiers?.gstin) {
      const gstinQuery = await entitiesRef
        .where('taxIdentifiers.gstin', '==', sanitizedData.taxIdentifiers.gstin)
        .where('isDeleted', '==', false)
        .limit(1)
        .get();

      if (!gstinQuery.empty) {
        throw new HttpsError(
          'already-exists',
          `An entity with GSTIN "${sanitizedData.taxIdentifiers.gstin}" already exists.`
        );
      }
    }

    // 6. Check for duplicate PAN if provided
    if (sanitizedData.taxIdentifiers?.pan) {
      const panQuery = await entitiesRef
        .where('taxIdentifiers.pan', '==', sanitizedData.taxIdentifiers.pan)
        .where('isDeleted', '==', false)
        .limit(1)
        .get();

      if (!panQuery.empty) {
        throw new HttpsError(
          'already-exists',
          `An entity with PAN "${sanitizedData.taxIdentifiers.pan}" already exists.`
        );
      }
    }

    // 7. Generate entity code
    const code = await generateEntityCode(db);

    // 8. Create the entity document
    const now = FieldValue.serverTimestamp();
    const entityData = {
      ...sanitizedData,
      code,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
    };

    // Remove undefined values to comply with Firestore requirements
    const cleanedEntityData = Object.fromEntries(
      Object.entries(entityData).filter(([_, value]) => value !== undefined)
    );

    const docRef = await entitiesRef.add(cleanedEntityData);

    // 9. Audit the creation
    // Get actor information from the authenticated user
    const actor = await getActorFromAuth(userId);

    await createAuditLog({
      action: 'ENTITY_CREATED',
      severity: 'INFO',
      entityType: 'ENTITY',
      entityId: docRef.id,
      entityName: sanitizedName,
      description: `Created entity "${sanitizedName}" with roles: ${data.roles.join(', ')}`,
      metadata: {
        name: sanitizedName,
        roles: data.roles,
        code,
      },
      actorId: actor.actorId,
      actorEmail: actor.actorEmail,
      actorName: actor.actorName,
      actorPermissions: actor.actorPermissions,
    });

    // 10. Return the created entity
    return {
      id: docRef.id,
      ...entityData,
      createdAt: Date.now(), // Convert timestamp for response
      updatedAt: Date.now(),
    };
  } catch (error) {
    // Re-throw HttpsErrors as-is
    if (error instanceof HttpsError) {
      throw error;
    }

    // Log and throw generic error for unexpected issues
    console.error('Error creating entity:', error);
    throw new HttpsError('internal', 'Failed to create entity. Please try again.');
  }
});

/**
 * Generate unique entity code (ENT-001, ENT-002, etc.)
 */
async function generateEntityCode(db: admin.firestore.Firestore): Promise<string> {
  const counterRef = db.collection('counters').doc('entities');

  return db.runTransaction(async (transaction) => {
    const counterDoc = await transaction.get(counterRef);

    let nextNumber = 1;
    if (counterDoc.exists) {
      nextNumber = (counterDoc.data()?.lastNumber || 0) + 1;
    }

    transaction.set(
      counterRef,
      { lastNumber: nextNumber, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    return `ENT-${String(nextNumber).padStart(3, '0')}`;
  });
}

/**
 * Sanitize entity name
 * - Trims whitespace
 * - Normalizes internal whitespace
 * - Limits length to 200 characters
 */
function sanitizeEntityName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, 200);
}

/**
 * Sanitize tax identifiers
 * - Uppercases and trims
 * - Removes invalid characters
 */
function sanitizeTaxIdentifiers(taxIds: any): any {
  if (!taxIds || typeof taxIds !== 'object') {
    return undefined;
  }

  const sanitized: any = {};

  if (taxIds.gstin) {
    sanitized.gstin = taxIds.gstin.toString().trim().toUpperCase().slice(0, 15);
  }

  if (taxIds.pan) {
    sanitized.pan = taxIds.pan.toString().trim().toUpperCase().slice(0, 10);
  }

  if (taxIds.ein) {
    sanitized.ein = taxIds.ein.toString().trim().toUpperCase();
  }

  if (taxIds.trn) {
    sanitized.trn = taxIds.trn.toString().trim().toUpperCase();
  }

  if (taxIds.vatNumber) {
    sanitized.vatNumber = taxIds.vatNumber.toString().trim().toUpperCase();
  }

  if (taxIds.taxId) {
    sanitized.taxId = taxIds.taxId.toString().trim().toUpperCase();
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}
