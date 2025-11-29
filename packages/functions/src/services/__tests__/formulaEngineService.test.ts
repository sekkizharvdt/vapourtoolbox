/**
 * Formula Engine Service Tests
 *
 * Tests for parsing, validating, and evaluating mathematical formulas.
 */

import {
  parseFormula,
  validateFormulaSyntax,
  getFormulaVariables,
  evaluateExpression,
  evaluateFormula,
  evaluateFormulas,
  testFormula,
  COMMON_FORMULAS,
  validateFormulaVariables,
} from '../formulaEngineService';
import type { FormulaDefinition } from '@vapour/types';

describe('formulaEngineService', () => {
  describe('parseFormula', () => {
    it('should parse a simple expression', () => {
      const node = parseFormula('2 + 2');
      expect(node).toBeDefined();
      expect(node.type).toBe('OperatorNode');
    });

    it('should parse an expression with variables', () => {
      const node = parseFormula('pi * (D/2)^2');
      expect(node).toBeDefined();
    });

    it('should throw on invalid syntax', () => {
      expect(() => parseFormula('2 + ')).toThrow('Formula parsing error');
    });
  });

  describe('validateFormulaSyntax', () => {
    it('should validate a correct formula', () => {
      const result = validateFormulaSyntax('sqrt(x) + pow(y, 2)');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject disallowed functions', () => {
      const result = validateFormulaSyntax('eval("malicious")');
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('not allowed'))).toBe(true);
    });

    it('should warn about assignment operators', () => {
      const result = validateFormulaSyntax('x = 5');
      expect(result.warnings.some((w) => w.includes('assignment'))).toBe(true);
    });
  });

  describe('getFormulaVariables', () => {
    it('should extract variables from expression', () => {
      const variables = getFormulaVariables('L * W * t');
      expect(variables).toEqual(['L', 'W', 't']);
    });

    it('should exclude math constants', () => {
      const variables = getFormulaVariables('pi * (D/2)^2');
      expect(variables).toEqual(['D']);
      expect(variables).not.toContain('pi');
    });

    it('should handle complex expressions', () => {
      const variables = getFormulaVariables('pi * ((D/2)^2 - ((D - 2*t)/2)^2) * L * density');
      expect(variables).toContain('D');
      expect(variables).toContain('L');
      expect(variables).toContain('t');
      expect(variables).toContain('density');
    });
  });

  describe('evaluateExpression', () => {
    it('should evaluate a simple expression', () => {
      const result = evaluateExpression('2 + 2', {});
      expect(result).toBe(4);
    });

    it('should evaluate with variables', () => {
      const result = evaluateExpression('L * W', { L: 10, W: 5 });
      expect(result).toBe(50);
    });

    it('should handle trigonometric functions', () => {
      const result = evaluateExpression('sin(pi/2)', {});
      expect(result).toBeCloseTo(1, 10);
    });

    it('should handle constants', () => {
      const result = evaluateExpression('x + FACTOR', { x: 5 }, [{ name: 'FACTOR', value: 10 }]);
      expect(result).toBe(15);
    });

    it('should throw on undefined variable', () => {
      expect(() => evaluateExpression('x + y', { x: 5 })).toThrow();
    });
  });

  describe('evaluateFormula', () => {
    it('should evaluate a formula definition', () => {
      const formula: FormulaDefinition = {
        expression: 'L * W * t',
        variables: ['L', 'W', 't'],
        unit: 'mm³',
      };

      const result = evaluateFormula(formula, { L: 100, W: 50, t: 10 });
      expect(result.result).toBe(50000);
      expect(result.unit).toBe('mm³');
      expect(result.withinExpectedRange).toBe(true);
    });

    it('should warn when result is outside expected range', () => {
      const formula: FormulaDefinition = {
        expression: 'x * 10',
        variables: ['x'],
        unit: 'kg',
        expectedRange: { min: 0, max: 50 },
      };

      const result = evaluateFormula(formula, { x: 10 });
      expect(result.result).toBe(100);
      expect(result.withinExpectedRange).toBe(false);
      expect(result.rangeWarning).toBeDefined();
    });

    it('should throw when density is required but not provided', () => {
      const formula: FormulaDefinition = {
        expression: 'volume * density',
        variables: ['volume'],
        unit: 'kg',
        requiresDensity: true,
      };

      expect(() => evaluateFormula(formula, { volume: 1000 })).toThrow('density is required');
    });

    it('should include density when provided', () => {
      const formula: FormulaDefinition = {
        expression: 'volume * density',
        variables: ['volume'],
        unit: 'kg',
        requiresDensity: true,
      };

      const result = evaluateFormula(formula, { volume: 1000 }, 7.85);
      expect(result.result).toBe(7850);
    });
  });

  describe('evaluateFormulas', () => {
    it('should evaluate multiple formulas', () => {
      const formulas: Record<string, FormulaDefinition> = {
        area: {
          expression: 'L * W',
          variables: ['L', 'W'],
          unit: 'mm²',
        },
        perimeter: {
          expression: '2 * (L + W)',
          variables: ['L', 'W'],
          unit: 'mm',
        },
      };

      const results = evaluateFormulas(formulas, { L: 100, W: 50 });

      expect(results.area.result).toBe(5000);
      expect(results.perimeter.result).toBe(300);
    });

    it('should handle errors in individual formulas', () => {
      const formulas: Record<string, FormulaDefinition> = {
        valid: {
          expression: 'x + 1',
          variables: ['x'],
          unit: '',
        },
        invalid: {
          expression: 'y + 1', // y not provided
          variables: ['y'],
          unit: '',
        },
      };

      const results = evaluateFormulas(formulas, { x: 5 });

      expect(results.valid.result).toBe(6);
      expect(results.invalid.error).toBeDefined();
    });
  });

  describe('testFormula', () => {
    it('should pass all test cases for correct formula', () => {
      const result = testFormula('x * 2', [
        { variables: { x: 1 }, expectedResult: 2 },
        { variables: { x: 5 }, expectedResult: 10 },
        { variables: { x: 3 }, expectedResult: 6 },
      ]);

      expect(result.passed).toBe(3);
      expect(result.failed).toBe(0);
    });

    it('should fail for incorrect results', () => {
      const result = testFormula('x * 2', [
        { variables: { x: 5 }, expectedResult: 11 }, // Wrong
      ]);

      expect(result.passed).toBe(0);
      expect(result.failed).toBe(1);
    });

    it('should respect tolerance', () => {
      const result = testFormula('pi', [{ variables: {}, expectedResult: 3.14, tolerance: 0.01 }]);

      expect(result.passed).toBe(1);
    });
  });

  describe('COMMON_FORMULAS', () => {
    it('should have cylinder volume formula', () => {
      const result = evaluateExpression(COMMON_FORMULAS.cylinderVolume, { D: 100, L: 200 });
      // Expected: pi * (100/2)^2 * 200 = pi * 2500 * 200 = 1,570,796.33
      expect(result).toBeCloseTo(Math.PI * 2500 * 200, 2);
    });

    it('should have rectangular plate area formula', () => {
      const result = evaluateExpression(COMMON_FORMULAS.rectangularPlateArea, { L: 100, W: 50 });
      expect(result).toBe(5000);
    });

    it('should have rectangular plate weight formula', () => {
      const result = evaluateExpression(COMMON_FORMULAS.rectangularPlateWeight, {
        L: 1, // 1m
        W: 1, // 1m
        t: 0.01, // 10mm = 0.01m
        density: 7850, // kg/m³
      });
      // Expected: 1 * 1 * 0.01 * 7850 = 78.5 kg
      expect(result).toBeCloseTo(78.5, 2);
    });
  });

  describe('validateFormulaVariables', () => {
    it('should validate when all variables are available', () => {
      const formula: FormulaDefinition = {
        expression: 'L * W * t',
        variables: ['L', 'W', 't'],
        unit: 'mm³',
      };

      const result = validateFormulaVariables(formula, ['L', 'W', 't']);
      expect(result.isValid).toBe(true);
      expect(result.missingVariables).toHaveLength(0);
    });

    it('should report missing variables', () => {
      const formula: FormulaDefinition = {
        expression: 'L * W * t',
        variables: ['L', 'W', 't'],
        unit: 'mm³',
      };

      const result = validateFormulaVariables(formula, ['L', 'W']);
      expect(result.isValid).toBe(false);
      expect(result.missingVariables).toContain('t');
    });

    it('should report unused parameters', () => {
      const formula: FormulaDefinition = {
        expression: 'L * W',
        variables: ['L', 'W'],
        unit: 'mm²',
      };

      const result = validateFormulaVariables(formula, ['L', 'W', 'H', 'D']);
      expect(result.unusedParameters).toContain('H');
      expect(result.unusedParameters).toContain('D');
    });
  });
});
