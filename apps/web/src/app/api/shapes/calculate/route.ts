import { NextRequest, NextResponse } from 'next/server';
import { calculateShape, type CalculateShapeInput } from '@/lib/shapes/shapeCalculator';
import type { Shape, Material } from '@vapour/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shape, material, parameterValues, quantity } = body as {
      shape: Shape;
      material: Material;
      parameterValues: Record<string, number>;
      quantity?: number;
    };

    // Validate inputs
    if (!shape) {
      return NextResponse.json({ error: 'Shape is required' }, { status: 400 });
    }

    if (!material) {
      return NextResponse.json({ error: 'Material is required' }, { status: 400 });
    }

    if (!parameterValues) {
      return NextResponse.json({ error: 'Parameter values are required' }, { status: 400 });
    }

    // Validate required parameters
    const requiredParams = shape.parameters.filter((p) => p.required);
    const missingParams = requiredParams.filter((p) => !(p.name in parameterValues));

    if (missingParams.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required parameters: ${missingParams.map((p) => p.label).join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Calculate shape properties
    const input: CalculateShapeInput = {
      shape,
      material,
      parameterValues,
      quantity: quantity || 1,
    };

    const result = calculateShape(input);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Shape calculation error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Calculation failed',
      },
      { status: 500 }
    );
  }
}
