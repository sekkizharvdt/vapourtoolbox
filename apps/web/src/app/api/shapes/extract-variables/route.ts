import { NextRequest, NextResponse } from 'next/server';
import { extractVariables } from '@/lib/shapes/formulaEvaluator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { expression } = body as { expression: string };

    if (!expression) {
      return NextResponse.json({ error: 'Expression is required' }, { status: 400 });
    }

    // Extract variables from the expression
    const variables = extractVariables(expression);

    return NextResponse.json({
      variables,
      expression,
    });
  } catch (error) {
    console.error('Variable extraction error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Variable extraction failed',
      },
      { status: 500 }
    );
  }
}
