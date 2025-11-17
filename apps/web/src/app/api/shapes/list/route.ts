import { NextRequest, NextResponse } from 'next/server';
import { ShapeCategory } from '@vapour/types';

// Import shape definitions directly (TODO: Export from @vapour/functions package)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { allShapes } = require('../../../../../../packages/functions/src/data/shapes');

// Mark as dynamic to work with static export
export const dynamic = 'force-static';
export const revalidate = false;

// Category mapping
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('category');

    if (!categoryId) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    }

    const allowedCategories = categoryMap[categoryId];
    if (!allowedCategories) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    // Filter shapes by category
    const shapes = allShapes
      .filter((shape: any) => allowedCategories.includes(shape.category))
      .map((shape: any, index: number) => ({
        // Add temporary IDs since shapes don't have them yet
        id: `shape-${categoryId}-${index}`,
        shapeCode: `SHP-${categoryId.toUpperCase()}-${String(index + 1).padStart(3, '0')}`,
        ...shape,
        isStandard: true,
        isActive: true,
        usageCount: 0,
        tags: [categoryId, shape.category],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'system',
        updatedBy: 'system',
      }));

    return NextResponse.json({ shapes, count: shapes.length });
  } catch (error) {
    console.error('Failed to load shapes:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to load shapes',
      },
      { status: 500 }
    );
  }
}
