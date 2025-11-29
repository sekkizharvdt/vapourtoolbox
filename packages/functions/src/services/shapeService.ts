/**
 * Shape Service Layer
 * CRUD operations for shapes collection in Firestore
 */

import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import type { Shape, ShapeCategory, ShapeType, MaterialCategory } from '@vapour/types';
import { COLLECTIONS } from '@vapour/firebase';
import { generateDocumentCode } from './codeGenerationService';

const db = getFirestore();

/**
 * Generate a unique shape code using the code generation service
 */
async function generateShapeCode(): Promise<string> {
  return generateDocumentCode('SHAPE');
}

/**
 * Create a new shape
 */
export async function createShape(
  shapeData: Omit<
    Shape,
    'id' | 'shapeCode' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
  >,
  userId: string
): Promise<Shape> {
  try {
    // Generate shape code
    const shapeCode = await generateShapeCode();

    // Create audit info
    const now = Timestamp.now();
    const auditInfo = {
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    };

    // Create shape document
    const shape: Omit<Shape, 'id'> = {
      ...shapeData,
      shapeCode,
      isActive: shapeData.isActive ?? true,
      usageCount: 0,
      tags: shapeData.tags || [],
      ...auditInfo,
    } as Omit<Shape, 'id'>;

    // Add to Firestore
    const docRef = await db.collection(COLLECTIONS.SHAPES).add(shape);

    return {
      id: docRef.id,
      ...shape,
    };
  } catch (error) {
    throw new Error(
      `Failed to create shape: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get a shape by ID
 */
export async function getShapeById(shapeId: string): Promise<Shape | null> {
  try {
    const doc = await db.collection(COLLECTIONS.SHAPES).doc(shapeId).get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data(),
    } as Shape;
  } catch (error) {
    throw new Error(
      `Failed to get shape: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get a shape by code
 */
export async function getShapeByCode(shapeCode: string): Promise<Shape | null> {
  try {
    const snapshot = await db
      .collection(COLLECTIONS.SHAPES)
      .where('shapeCode', '==', shapeCode)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    } as Shape;
  } catch (error) {
    throw new Error(
      `Failed to get shape by code: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * List shapes with filters and pagination
 */
export async function listShapes(options?: {
  category?: ShapeCategory;
  shapeType?: ShapeType;
  isStandard?: boolean;
  isActive?: boolean;
  materialCategory?: MaterialCategory;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'usageCount' | 'updatedAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}): Promise<{
  shapes: Shape[];
  total: number;
  hasMore: boolean;
}> {
  try {
    let query = db.collection(COLLECTIONS.SHAPES) as any;

    // Apply filters
    if (options?.category) {
      query = query.where('category', '==', options.category);
    }

    if (options?.shapeType) {
      query = query.where('shapeType', '==', options.shapeType);
    }

    if (options?.isStandard !== undefined) {
      query = query.where('isStandard', '==', options.isStandard);
    }

    if (options?.isActive !== undefined) {
      query = query.where('isActive', '==', options.isActive);
    }

    if (options?.materialCategory) {
      query = query.where('allowedMaterialCategories', 'array-contains', options.materialCategory);
    }

    if (options?.tags && options.tags.length > 0) {
      // Firestore only supports one array-contains per query
      query = query.where('tags', 'array-contains', options.tags[0]);
    }

    // Apply sorting
    const sortBy = options?.sortBy || 'updatedAt';
    const sortOrder = options?.sortOrder || 'desc';
    query = query.orderBy(sortBy, sortOrder);

    // Get total count (without pagination)
    const countSnapshot = await query.count().get();
    const total = countSnapshot.data().count;

    // Apply pagination
    if (options?.offset) {
      query = query.offset(options.offset);
    }

    const limit = options?.limit || 50;
    query = query.limit(limit + 1); // Get one extra to check if there are more

    // Execute query
    const snapshot = await query.get();

    const shapes: Shape[] = [];
    let count = 0;

    snapshot.forEach((doc: any) => {
      if (count < limit) {
        shapes.push({
          id: doc.id,
          ...doc.data(),
        } as Shape);
      }
      count++;
    });

    return {
      shapes,
      total,
      hasMore: count > limit,
    };
  } catch (error) {
    throw new Error(
      `Failed to list shapes: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Update a shape
 */
export async function updateShape(
  shapeId: string,
  updates: Partial<Omit<Shape, 'id' | 'shapeCode' | 'createdAt' | 'createdBy'>>,
  userId: string
): Promise<Shape> {
  try {
    const docRef = db.collection(COLLECTIONS.SHAPES).doc(shapeId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error('Shape not found');
    }

    // Update audit info
    const updateData = {
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    };

    await docRef.update(updateData);

    // Get updated shape
    const updatedDoc = await docRef.get();
    return {
      id: updatedDoc.id,
      ...updatedDoc.data(),
    } as Shape;
  } catch (error) {
    throw new Error(
      `Failed to update shape: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Delete a shape (soft delete by setting isActive to false)
 */
export async function deleteShape(shapeId: string, userId: string): Promise<void> {
  try {
    await updateShape(shapeId, { isActive: false }, userId);
  } catch (error) {
    throw new Error(
      `Failed to delete shape: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Hard delete a shape (permanently remove from database)
 */
export async function hardDeleteShape(shapeId: string): Promise<void> {
  try {
    await db.collection(COLLECTIONS.SHAPES).doc(shapeId).delete();
  } catch (error) {
    throw new Error(
      `Failed to hard delete shape: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Increment shape usage count
 */
export async function incrementShapeUsage(shapeId: string): Promise<void> {
  try {
    const docRef = db.collection(COLLECTIONS.SHAPES).doc(shapeId);
    await docRef.update({
      usageCount: (await docRef.get()).data()?.usageCount || 0 + 1,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    throw new Error(
      `Failed to increment shape usage: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Search shapes by name or description
 */
export async function searchShapes(
  searchTerm: string,
  options?: {
    category?: ShapeCategory;
    isActive?: boolean;
    limit?: number;
  }
): Promise<Shape[]> {
  try {
    let query = db.collection(COLLECTIONS.SHAPES) as any;

    // Apply filters
    if (options?.category) {
      query = query.where('category', '==', options.category);
    }

    if (options?.isActive !== undefined) {
      query = query.where('isActive', '==', options.isActive);
    }

    // Firestore doesn't support full-text search natively
    // We'll get all matching documents and filter in memory
    const snapshot = await query.get();

    const shapes: Shape[] = [];
    const searchLower = searchTerm.toLowerCase();

    snapshot.forEach((doc: any) => {
      const data = doc.data();
      const name = (data.name || '').toLowerCase();
      const description = (data.description || '').toLowerCase();
      const shapeCode = (data.shapeCode || '').toLowerCase();
      const customCode = (data.customCode || '').toLowerCase();

      if (
        name.includes(searchLower) ||
        description.includes(searchLower) ||
        shapeCode.includes(searchLower) ||
        customCode.includes(searchLower)
      ) {
        shapes.push({
          id: doc.id,
          ...data,
        } as Shape);
      }
    });

    // Apply limit
    const limit = options?.limit || 50;
    return shapes.slice(0, limit);
  } catch (error) {
    throw new Error(
      `Failed to search shapes: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get shapes compatible with a material category
 */
export async function getShapesByMaterialCategory(
  materialCategory: MaterialCategory,
  options?: {
    isActive?: boolean;
    limit?: number;
  }
): Promise<Shape[]> {
  try {
    let query = db
      .collection(COLLECTIONS.SHAPES)
      .where('allowedMaterialCategories', 'array-contains', materialCategory) as any;

    if (options?.isActive !== undefined) {
      query = query.where('isActive', '==', options.isActive);
    }

    query = query.orderBy('usageCount', 'desc');

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();

    const shapes: Shape[] = [];
    snapshot.forEach((doc: any) => {
      shapes.push({
        id: doc.id,
        ...doc.data(),
      } as Shape);
    });

    return shapes;
  } catch (error) {
    throw new Error(
      `Failed to get shapes by material category: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get standard shapes
 */
export async function getStandardShapes(options?: {
  category?: ShapeCategory;
  isActive?: boolean;
  limit?: number;
}): Promise<Shape[]> {
  try {
    let query = db.collection(COLLECTIONS.SHAPES).where('isStandard', '==', true) as any;

    if (options?.category) {
      query = query.where('category', '==', options.category);
    }

    if (options?.isActive !== undefined) {
      query = query.where('isActive', '==', options.isActive);
    }

    query = query.orderBy('usageCount', 'desc');

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const snapshot = await query.get();

    const shapes: Shape[] = [];
    snapshot.forEach((doc: any) => {
      shapes.push({
        id: doc.id,
        ...doc.data(),
      } as Shape);
    });

    return shapes;
  } catch (error) {
    throw new Error(
      `Failed to get standard shapes: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Duplicate a shape
 */
export async function duplicateShape(
  shapeId: string,
  userId: string,
  customizations?: {
    name?: string;
    customCode?: string;
    description?: string;
  }
): Promise<Shape> {
  try {
    const originalShape = await getShapeById(shapeId);
    if (!originalShape) {
      throw new Error('Original shape not found');
    }

    // Create duplicate with new code
    const duplicateData = {
      ...originalShape,
      name: customizations?.name || `${originalShape.name} (Copy)`,
      customCode: customizations?.customCode,
      description: customizations?.description || originalShape.description,
      isStandard: false, // Duplicates are never standard
      usageCount: 0,
    };

    // Remove fields that will be auto-generated
    delete (duplicateData as any).id;
    delete (duplicateData as any).shapeCode;
    delete (duplicateData as any).createdAt;
    delete (duplicateData as any).updatedAt;
    delete (duplicateData as any).createdBy;
    delete (duplicateData as any).updatedBy;

    return createShape(duplicateData, userId);
  } catch (error) {
    throw new Error(
      `Failed to duplicate shape: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
