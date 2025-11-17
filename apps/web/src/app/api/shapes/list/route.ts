import { NextRequest, NextResponse } from 'next/server';

// Mark as dynamic to work with static export
export const dynamic = 'force-static';
export const revalidate = false;

// TODO: Import shapes from proper location once package exports are configured
// For now, return mock data
const categoryMap: Record<string, string[]> = {
  plates: ['PLATE_RECTANGULAR', 'PLATE_CIRCULAR', 'PLATE_CUSTOM'],
  tubes: ['TUBE_STRAIGHT'],
  vessels: [
    'SHELL_CYLINDRICAL',
    'SHELL_CONICAL',
    'HEAD_HEMISPHERICAL',
    'HEAD_ELLIPSOIDAL',
    'HEAD_TORISPHERICAL',
    'HEAD_FLAT',
    'HEAD_CONICAL',
  ],
  heatExchangers: ['HX_TUBE_BUNDLE', 'HX_TUBE_SHEET', 'HX_BAFFLE', 'HX_TUBE_SUPPORT'],
  nozzles: [
    'NOZZLE_ASSEMBLY',
    'NOZZLE_CUSTOM_CIRCULAR',
    'NOZZLE_CUSTOM_RECTANGULAR',
    'MANWAY_ASSEMBLY',
    'REINFORCEMENT_PAD',
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

    // TODO: Load actual shapes from database or shape definitions
    // For now, return empty array with proper structure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shapes: any[] = [];

    return NextResponse.json({ shapes, message: 'Shape loading coming soon' });
  } catch (error) {
    // Error logging for API route
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to load shapes',
      },
      { status: 500 }
    );
  }
}
