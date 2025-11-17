import { NextRequest, NextResponse } from 'next/server';
import { evaluateFormula, type EvaluationContext } from '@/lib/shapes/formulaEvaluator';
import type { FormulaDefinition } from '@vapour/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { formula, context, density } = body as {
      formula: FormulaDefinition;
      context: EvaluationContext;
      density?: number;
    };

    if (!formula || !formula.expression) {
      return NextResponse.json({ error: 'Formula definition is required' }, { status: 400 });
    }

    if (!context) {
      return NextResponse.json({ error: 'Variable context is required' }, { status: 400 });
    }

    // Evaluate the formula
    const result = evaluateFormula(formula, context, density);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Formula evaluation error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Formula evaluation failed',
      },
      { status: 500 }
    );
  }
}
