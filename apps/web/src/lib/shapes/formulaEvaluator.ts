/**
 * Formula Evaluation Service
 *
 * Evaluates mathematical expressions for shape calculations using mathjs
 */

import { create, all, type MathJsInstance } from 'mathjs';
import type { FormulaDefinition } from '@vapour/types';

// Create mathjs instance with safe configuration
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const math: MathJsInstance = create(all as any, {
  number: 'BigNumber', // Use BigNumber for precision
  precision: 64, // High precision for engineering calculations
});

// Mathematical constants
const CONSTANTS = {
  PI: Math.PI,
  E: Math.E,
};

export interface EvaluationContext {
  [key: string]: number;
}

export interface EvaluationResult {
  result: number;
  unit: string;
  expression: string;
  variables: Record<string, number>;
}

/**
 * Evaluate a formula with given parameter values
 *
 * @param formula - Formula definition with expression and variables
 * @param context - Variable values (parameter names → values)
 * @param density - Optional material density (kg/m³) for weight calculations
 * @returns Calculated result with metadata
 */
export function evaluateFormula(
  formula: FormulaDefinition,
  context: EvaluationContext,
  density?: number
): EvaluationResult {
  try {
    // Build evaluation scope with constants, variables, and density
    const scope: Record<string, number> = {
      ...CONSTANTS,
      ...context,
    };

    // Add density if formula requires it
    if (formula.requiresDensity && density !== undefined) {
      scope.density = density;
    }

    // Check that all required variables are provided
    const missingVars = formula.variables.filter((v) => !(v in scope));
    if (missingVars.length > 0) {
      throw new Error(`Missing required variables: ${missingVars.join(', ')}`);
    }

    // Evaluate the expression
    const result = math.evaluate(formula.expression, scope);

    // Convert BigNumber to regular number
    const numericResult =
      typeof result === 'object' && 'toNumber' in result ? result.toNumber() : Number(result);

    // Validate result is in expected range if defined
    if (formula.expectedRange) {
      const { min, max, warning } = formula.expectedRange;
      if (numericResult < min || numericResult > max) {
        console.warn(
          `Result ${numericResult} ${formula.unit} outside expected range [${min}, ${max}]. ${warning || ''}`
        );
      }
    }

    return {
      result: numericResult,
      unit: formula.unit,
      expression: formula.expression,
      variables: { ...context, ...(density ? { density } : {}) },
    };
  } catch (error) {
    throw new Error(
      `Formula evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validate formula syntax without evaluating
 *
 * @param expression - Mathematical expression to validate
 * @returns true if valid, throws error if invalid
 */
export function validateFormulaSyntax(expression: string): boolean {
  try {
    // Parse the expression (without evaluating)
    math.parse(expression);
    return true;
  } catch (error) {
    throw new Error(
      `Invalid formula syntax: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Extract variables from a formula expression
 *
 * @param expression - Mathematical expression
 * @returns Array of variable names used in the expression
 */
export function extractVariables(expression: string): string[] {
  try {
    const node = math.parse(expression);
    const vars = new Set<string>();

    // Traverse the expression tree to find variable nodes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    node.traverse((node: any) => {
      if (node.type === 'SymbolNode' && !Object.keys(CONSTANTS).includes(node.name)) {
        vars.add(node.name);
      }
    });

    return Array.from(vars);
  } catch (error) {
    throw new Error(
      `Failed to extract variables: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Evaluate multiple formulas at once (for complete shape calculation)
 *
 * @param formulas - Object with formula definitions
 * @param context - Variable values
 * @param density - Optional material density
 * @returns Object with all calculated results
 */
export function evaluateMultipleFormulas(
  formulas: Record<string, FormulaDefinition>,
  context: EvaluationContext,
  density?: number
): Record<string, EvaluationResult> {
  const results: Record<string, EvaluationResult> = {};

  for (const [key, formula] of Object.entries(formulas)) {
    try {
      results[key] = evaluateFormula(formula, context, density);
    } catch (error) {
      console.error(`Failed to evaluate formula "${key}":`, error);
      // Continue with other formulas even if one fails
    }
  }

  return results;
}
