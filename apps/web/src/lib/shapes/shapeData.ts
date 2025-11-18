/**
 * Shape Data Service - Client-side shape data management
 *
 * Provides functions to filter and retrieve shapes from the local shape database
 */

import { Shape, ShapeCategory } from '@vapour/types';
import { allShapes } from '@/data/shapes';
import { Timestamp } from 'firebase/firestore';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'ShapeData' });

// Category mapping - maps UI category names to shape categories
const categoryMap: Record<string, ShapeCategory[]> = {
  plates: [
    ShapeCategory.PLATE_RECTANGULAR,
    ShapeCategory.PLATE_CIRCULAR,
    ShapeCategory.PLATE_CUSTOM,
  ],
  tubes: [ShapeCategory.TUBE_STRAIGHT],
  vessels: [
    ShapeCategory.SHELL_CYLINDRICAL,
    ShapeCategory.SHELL_CONICAL,
    ShapeCategory.HEAD_HEMISPHERICAL,
    ShapeCategory.HEAD_ELLIPSOIDAL,
    ShapeCategory.HEAD_TORISPHERICAL,
    ShapeCategory.HEAD_FLAT,
    ShapeCategory.HEAD_CONICAL,
  ],
  heatExchangers: [
    ShapeCategory.HX_TUBE_BUNDLE,
    ShapeCategory.HX_TUBE_SHEET,
    ShapeCategory.HX_BAFFLE,
    ShapeCategory.HX_TUBE_SUPPORT,
  ],
  nozzles: [
    ShapeCategory.NOZZLE_ASSEMBLY,
    ShapeCategory.NOZZLE_CUSTOM_CIRCULAR,
    ShapeCategory.NOZZLE_CUSTOM_RECTANGULAR,
    ShapeCategory.MANWAY_ASSEMBLY,
    ShapeCategory.REINFORCEMENT_PAD,
  ],
};

/**
 * Add database fields to shape definition for client-side use
 */
function addShapeMetadata(
  shape: Omit<Shape, 'id' | 'shapeCode' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>,
  index: number,
  categoryId?: string
): Shape {
  const now = Timestamp.now();
  return {
    ...shape,
    id: `shape-${categoryId || 'global'}-${index}`,
    shapeCode: `SHP-${(categoryId || 'GLOBAL').toUpperCase()}-${String(index + 1).padStart(3, '0')}`,
    createdAt: now,
    updatedAt: now,
    createdBy: 'system',
    updatedBy: 'system',
  };
}

/**
 * Get shapes by category
 */
export function getShapesByCategory(categoryId: string): Shape[] {
  const allowedCategories = categoryMap[categoryId];
  if (!allowedCategories) {
    logger.warn('Invalid category requested', { categoryId });
    return [];
  }

  return allShapes
    .filter((shape) => allowedCategories.includes(shape.category))
    .map((shape, index) => addShapeMetadata(shape, index, categoryId));
}

/**
 * Get all shapes
 */
export function getAllShapes(): Shape[] {
  return allShapes.map((shape, index) => addShapeMetadata(shape, index));
}

/**
 * Get shape by ID (returns shape with metadata added)
 */
export function getShapeById(shapeId: string): Shape | undefined {
  const index = allShapes.findIndex((_, i) => `shape-global-${i}` === shapeId);
  if (index === -1) return undefined;
  return addShapeMetadata(allShapes[index]!, index);
}

/**
 * Get available category IDs
 */
export function getAvailableCategories(): string[] {
  return Object.keys(categoryMap);
}
