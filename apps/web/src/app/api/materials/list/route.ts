import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase/clientApp';
import { queryMaterials } from '@/lib/materials/materialService';
import type { MaterialCategory } from '@vapour/types';

// Mark as dynamic to work with static export
export const dynamic = 'force-static';
export const revalidate = false;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') as MaterialCategory | null;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam) : 50;

    // Initialize Firestore
    const db = getFirestore(firebaseApp);

    // Query materials
    const result = await queryMaterials(db, {
      categories: category ? [category] : undefined,
      isActive: true,
      limitResults: limit,
      sortField: 'name',
      sortDirection: 'asc',
    });

    return NextResponse.json({
      materials: result.materials,
      hasMore: result.hasMore,
      count: result.materials.length,
    });
  } catch (error) {
    console.error('Failed to fetch materials:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to load materials',
        materials: [],
      },
      { status: 500 }
    );
  }
}
