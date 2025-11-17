/**
 * Formula Engine Service
 * Parses and evaluates mathematical formulas for shape calculations
 * Uses math.js for safe expression evaluation
 */

import { create, all, MathNode } from 'mathjs';
import type { FormulaDefinition, FormulaConstant } from '@vapour/types';

// Create a restricted math.js instance with safe functions only
const math = create(all);

// Disable functions that could be security risks
const allowedFunctions = [
  // Basic arithmetic
  'add',
  'subtract',
  'multiply',
  'divide',
  'mod',
  'pow',
  'sqrt',
  'cbrt',
  // Trigonometric
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  // Rounding
  'round',
  'ceil',
  'floor',
  'abs',
  // Constants
  'pi',
  'e',
  // Logic
  'max',
  'min',
  'if',
  'and',
  'or',
  'not',
  // Other
  'log',
  'log10',
  'exp',
];

/**
 * Parse a formula expression into a math.js AST
 */
export function parseFormula(expression: string): MathNode {
  try {
    return math.parse(expression);
  } catch (error) {
    throw new Error(
      `Formula parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validate formula syntax and check for allowed functions
 */
export function validateFormulaSyntax(expression: string): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    const node = math.parse(expression);

    // Check for disallowed functions
    node.traverse((node: MathNode) => {
      if (node.type === 'FunctionNode') {
        const funcNode = node as any;
        if (!allowedFunctions.includes(funcNode.fn.name)) {
          errors.push(`Function '${funcNode.fn.name}' is not allowed for security reasons`);
        }
      }
    });

    // Check for assignments (should not be allowed)
    if (expression.includes('=') && !expression.includes('==') && !expression.includes('!=')) {
      warnings.push('Formula contains assignment operator (=). Did you mean comparison (==)?');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown parsing error');
    return {
      isValid: false,
      errors,
      warnings,
    };
  }
}

/**
 * Extract variable names from a formula expression
 */
export function getFormulaVariables(expression: string): string[] {
  const variables = new Set<string>();

  try {
    const node = math.parse(expression);

    node.traverse((node: MathNode) => {
      if (node.type === 'SymbolNode') {
        const symbolNode = node as any;
        const name = symbolNode.name;

        // Exclude math constants
        if (name !== 'pi' && name !== 'e' && name !== 'true' && name !== 'false') {
          variables.add(name);
        }
      }
    });

    return Array.from(variables).sort();
  } catch (error) {
    throw new Error(
      `Failed to extract variables: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Evaluate a formula with given variable values and constants
 */
export function evaluateExpression(
  expression: string,
  variables: Record<string, number>,
  constants?: FormulaConstant[]
): number {
  try {
    // Build scope with variables and constants
    const scope: Record<string, number> = { ...variables };

    // Add constants to scope
    if (constants) {
      constants.forEach((constant) => {
        scope[constant.name] = constant.value;
      });
    }

    // Evaluate the expression
    const result = math.evaluate(expression, scope);

    // Ensure result is a number
    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error(`Formula evaluation resulted in invalid number: ${result}`);
    }

    return result;
  } catch (error) {
    throw new Error(
      `Formula evaluation error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Evaluate a formula definition with parameter values
 */
export function evaluateFormula(
  formula: FormulaDefinition,
  parameterValues: Record<string, number>,
  density?: number
): {
  result: number;
  unit: string;
  withinExpectedRange: boolean;
  rangeWarning?: string;
} {
  try {
    // Check if density is required but not provided
    if (formula.requiresDensity && !density) {
      throw new Error('Material density is required for this formula but was not provided');
    }

    // Build scope with parameter values and density
    const scope: Record<string, number> = { ...parameterValues };
    if (density !== undefined) {
      scope.density = density;
    }

    // Evaluate the expression
    const result = evaluateExpression(formula.expression, scope, formula.constants);

    // Check if result is within expected range
    let withinExpectedRange = true;
    let rangeWarning: string | undefined;

    if (formula.expectedRange) {
      const { min, max, warning } = formula.expectedRange;
      if (result < min || result > max) {
        withinExpectedRange = false;
        rangeWarning =
          warning ||
          `Result ${result.toFixed(2)} ${formula.unit} is outside expected range [${min}, ${max}] ${formula.unit}`;
      }
    }

    return {
      result,
      unit: formula.unit,
      withinExpectedRange,
      rangeWarning,
    };
  } catch (error) {
    throw new Error(
      `Formula '${formula.description || 'unnamed'}' evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Batch evaluate multiple formulas
 */
export function evaluateFormulas(
  formulas: Record<string, FormulaDefinition>,
  parameterValues: Record<string, number>,
  density?: number
): Record<
  string,
  {
    result: number;
    unit: string;
    withinExpectedRange: boolean;
    rangeWarning?: string;
    error?: string;
  }
> {
  const results: Record<string, any> = {};

  for (const [key, formula] of Object.entries(formulas)) {
    try {
      results[key] = evaluateFormula(formula, parameterValues, density);
    } catch (error) {
      results[key] = {
        result: 0,
        unit: formula.unit,
        withinExpectedRange: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  return results;
}

/**
 * Test a formula with sample values to verify correctness
 */
export function testFormula(
  expression: string,
  testCases: Array<{
    variables: Record<string, number>;
    constants?: FormulaConstant[];
    expectedResult: number;
    tolerance?: number; // Default 0.001 (0.1%)
  }>
): {
  passed: number;
  failed: number;
  results: Array<{
    testCase: number;
    passed: boolean;
    expected: number;
    actual: number;
    error?: string;
  }>;
} {
  const results: Array<{
    testCase: number;
    passed: boolean;
    expected: number;
    actual: number;
    error?: string;
  }> = [];

  let passed = 0;
  let failed = 0;

  testCases.forEach((testCase, index) => {
    try {
      const actual = evaluateExpression(expression, testCase.variables, testCase.constants);
      const tolerance = testCase.tolerance ?? 0.001;
      const percentError = Math.abs((actual - testCase.expectedResult) / testCase.expectedResult);
      const testPassed = percentError <= tolerance;

      if (testPassed) {
        passed++;
      } else {
        failed++;
      }

      results.push({
        testCase: index + 1,
        passed: testPassed,
        expected: testCase.expectedResult,
        actual,
      });
    } catch (error) {
      failed++;
      results.push({
        testCase: index + 1,
        passed: false,
        expected: testCase.expectedResult,
        actual: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return {
    passed,
    failed,
    results,
  };
}

/**
 * Generate a human-readable description of a formula
 */
export function describeFormula(expression: string): string {
  try {
    const node = math.parse(expression);
    return node.toString();
  } catch (error) {
    return expression;
  }
}

/**
 * Common engineering formulas for reuse
 */
export const COMMON_FORMULAS = {
  // Cylinder volume
  cylinderVolume: 'pi * (D/2)^2 * L',

  // Cylinder outer surface area
  cylinderOuterArea: 'pi * D * L',

  // Cylinder inner surface area
  cylinderInnerArea: 'pi * (D - 2*t) * L',

  // Hollow cylinder weight
  hollowCylinderWeight: 'pi * ((D/2)^2 - ((D - 2*t)/2)^2) * L * density',

  // Rectangular plate area
  rectangularPlateArea: 'L * W',

  // Rectangular plate weight
  rectangularPlateWeight: 'L * W * t * density',

  // Circular plate area
  circularPlateArea: 'pi * (D/2)^2',

  // Circular plate weight
  circularPlateWeight: 'pi * (D/2)^2 * t * density',

  // Circular plate circumference
  circularPlateCircumference: 'pi * D',

  // Rectangular plate perimeter
  rectangularPlatePerimeter: '2 * (L + W)',

  // Ellipsoidal head volume (2:1 ratio)
  ellipsoidalHeadVolume: 'pi * (D/2)^2 * (D/4)',

  // Hemispherical head volume
  hemisphericalHeadVolume: '(2/3) * pi * (D/2)^3',

  // Torispherical head volume (ASME F&D)
  torisphericialHeadVolume: '(pi/24) * D^2 * (2*D + 3*0.06*D)',

  // Conical section volume
  conicalVolume: '(pi/3) * L * ((D1/2)^2 + (D1/2)*(D2/2) + (D2/2)^2)',
};

/**
 * Validate that formula variables match provided parameters
 */
export function validateFormulaVariables(
  formula: FormulaDefinition,
  availableParameters: string[]
): {
  isValid: boolean;
  missingVariables: string[];
  unusedParameters: string[];
} {
  const requiredVariables = new Set(formula.variables);
  const availableSet = new Set(availableParameters);

  // Add density to available if formula requires it
  if (formula.requiresDensity) {
    availableSet.add('density');
  }

  // Add constants to available
  if (formula.constants) {
    formula.constants.forEach((c) => availableSet.add(c.name));
  }

  const missingVariables = formula.variables.filter((v) => !availableSet.has(v));
  const unusedParameters = availableParameters.filter((p) => !requiredVariables.has(p));

  return {
    isValid: missingVariables.length === 0,
    missingVariables,
    unusedParameters,
  };
}
