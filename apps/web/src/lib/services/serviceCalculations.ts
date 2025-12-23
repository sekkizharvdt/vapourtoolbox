/**
 * Service Cost Calculation Engine
 * Phase 3: Service Costs
 *
 * Handles all service cost calculations for BOM items with support for:
 * - Percentage of Material Cost
 * - Percentage of Total Cost (Material + Fabrication)
 * - Fixed Amount per Item
 * - Rate per Unit
 * - Custom Formula Evaluation
 */

import { Timestamp } from 'firebase/firestore';
import { createLogger } from '@vapour/logger';
import type {
  BOMItemService,
  ServiceCostBreakdown,
  ServiceCostCalculationInput,
  ServiceCostCalculationResult,
  Money,
  CurrencyCode,
} from '@vapour/types';

const logger = createLogger({ context: 'serviceCalculations' });

/**
 * Calculate service costs for a BOM item
 *
 * @param services - Array of services assigned to the item
 * @param materialCost - Material cost per unit
 * @param fabricationCost - Fabrication cost per unit
 * @param quantity - Item quantity
 * @param currency - Currency code for calculations
 * @returns Aggregated service cost and detailed breakdown
 */
export function calculateAllServiceCosts(
  services: BOMItemService[] | undefined,
  materialCost: number,
  fabricationCost: number,
  quantity: number,
  currency: CurrencyCode
): {
  serviceCostPerUnit: Money;
  totalServiceCost: Money;
  serviceBreakdown: ServiceCostBreakdown[];
} {
  // If no services assigned, return zero costs
  if (!services || services.length === 0) {
    return {
      serviceCostPerUnit: { amount: 0, currency },
      totalServiceCost: { amount: 0, currency },
      serviceBreakdown: [],
    };
  }

  const breakdown: ServiceCostBreakdown[] = [];
  let totalServiceCostPerUnit = 0;

  // Calculate cost for each service
  for (const service of services) {
    try {
      const result = calculateServiceCost({
        service,
        materialCost,
        fabricationCost,
        quantity,
        currency,
      });

      breakdown.push(result.breakdown);
      totalServiceCostPerUnit += result.costPerUnit.amount;
    } catch (error) {
      logger.error('Error calculating service cost', {
        serviceId: service.serviceId,
        error,
      });
      // Continue with other services even if one fails
    }
  }

  return {
    serviceCostPerUnit: { amount: totalServiceCostPerUnit, currency },
    totalServiceCost: { amount: totalServiceCostPerUnit * quantity, currency },
    serviceBreakdown: breakdown,
  };
}

/**
 * Calculate cost for a single service
 */
export function calculateServiceCost(
  input: ServiceCostCalculationInput
): ServiceCostCalculationResult {
  const { service, materialCost, fabricationCost, quantity, currency } = input;

  // Determine which rate to use (override or default from service)
  const rateValue = service.rateOverride?.rateValue ?? 0;
  const customFormula = service.rateOverride?.customFormula;
  const rateCurrency = service.rateOverride?.currency || currency;

  let costPerUnit = 0;
  let calculationDetails = '';
  let baseCost: Money | undefined;

  // Calculate based on method
  switch (service.calculationMethod) {
    case 'PERCENTAGE_OF_MATERIAL':
      ({ costPerUnit, calculationDetails, baseCost } = calculatePercentageOfMaterial(
        rateValue,
        materialCost,
        currency
      ));
      break;

    case 'PERCENTAGE_OF_TOTAL':
      ({ costPerUnit, calculationDetails, baseCost } = calculatePercentageOfTotal(
        rateValue,
        materialCost,
        fabricationCost,
        currency
      ));
      break;

    case 'FIXED_AMOUNT':
      ({ costPerUnit, calculationDetails } = calculateFixedAmount(rateValue, rateCurrency));
      break;

    case 'PER_UNIT':
      ({ costPerUnit, calculationDetails } = calculatePerUnit(rateValue, rateCurrency));
      break;

    case 'CUSTOM_FORMULA':
      ({ costPerUnit, calculationDetails } = evaluateCustomFormula(
        customFormula || '',
        materialCost,
        fabricationCost,
        quantity,
        currency
      ));
      break;

    default:
      logger.warn('Unknown calculation method', {
        method: service.calculationMethod,
        serviceId: service.serviceId,
      });
      break;
  }

  // Create breakdown
  const breakdown: ServiceCostBreakdown = {
    serviceId: service.serviceId,
    serviceName: service.serviceName,
    serviceCategory: service.serviceCategory,
    calculationMethod: service.calculationMethod,
    rateApplied: rateValue,
    baseCost,
    costPerUnit: { amount: costPerUnit, currency },
    totalCost: { amount: costPerUnit * quantity, currency },
    calculationDetails,
    isOverridden: !!service.rateOverride,
    calculatedAt: Timestamp.now(),
  };

  return {
    serviceId: service.serviceId,
    serviceName: service.serviceName,
    costPerUnit: { amount: costPerUnit, currency },
    totalCost: { amount: costPerUnit * quantity, currency },
    breakdown,
  };
}

/**
 * Calculate service cost as percentage of material cost
 */
function calculatePercentageOfMaterial(
  percentage: number,
  materialCost: number,
  currency: CurrencyCode
): {
  costPerUnit: number;
  calculationDetails: string;
  baseCost: Money;
} {
  const costPerUnit = (materialCost * percentage) / 100;
  const formattedMaterialCost = formatMoney(materialCost, currency);
  const formattedResult = formatMoney(costPerUnit, currency);

  return {
    costPerUnit,
    baseCost: { amount: materialCost, currency },
    calculationDetails: `${percentage}% of material cost (${formattedMaterialCost}) = ${formattedResult}`,
  };
}

/**
 * Calculate service cost as percentage of total cost (material + fabrication)
 */
function calculatePercentageOfTotal(
  percentage: number,
  materialCost: number,
  fabricationCost: number,
  currency: CurrencyCode
): {
  costPerUnit: number;
  calculationDetails: string;
  baseCost: Money;
} {
  const totalCost = materialCost + fabricationCost;
  const costPerUnit = (totalCost * percentage) / 100;
  const formattedTotalCost = formatMoney(totalCost, currency);
  const formattedResult = formatMoney(costPerUnit, currency);

  return {
    costPerUnit,
    baseCost: { amount: totalCost, currency },
    calculationDetails: `${percentage}% of total cost (${formattedTotalCost}) = ${formattedResult}`,
  };
}

/**
 * Calculate service cost as fixed amount
 */
function calculateFixedAmount(
  amount: number,
  currency: CurrencyCode
): {
  costPerUnit: number;
  calculationDetails: string;
} {
  const formattedAmount = formatMoney(amount, currency);

  return {
    costPerUnit: amount,
    calculationDetails: `Fixed amount: ${formattedAmount} per item`,
  };
}

/**
 * Calculate service cost per unit (same as fixed amount)
 */
function calculatePerUnit(
  rate: number,
  currency: CurrencyCode
): {
  costPerUnit: number;
  calculationDetails: string;
} {
  const formattedRate = formatMoney(rate, currency);

  return {
    costPerUnit: rate,
    calculationDetails: `Rate: ${formattedRate} per unit`,
  };
}

/**
 * Safe expression parser for custom formulas
 *
 * Supports:
 * - Numbers (integers and decimals)
 * - Variables: materialCost, fabricationCost, quantity, total
 * - Operators: +, -, *, /, (, )
 * - Functions: min, max, abs, round, ceil, floor
 *
 * This is a secure alternative to new Function() that prevents code injection.
 */
function safeEvaluateExpression(expression: string, variables: Record<string, number>): number {
  // Tokenize the expression
  const tokens = tokenize(expression);

  // Parse and evaluate using recursive descent parser
  let pos = 0;

  function peek(): string | undefined {
    return tokens[pos];
  }

  function consume(): string {
    const token = tokens[pos++];
    if (token === undefined) {
      throw new Error('Unexpected end of expression');
    }
    return token;
  }

  function parseExpression(): number {
    return parseAddSub();
  }

  function parseAddSub(): number {
    let left = parseMulDiv();

    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseMulDiv();
      left = op === '+' ? left + right : left - right;
    }

    return left;
  }

  function parseMulDiv(): number {
    let left = parseUnary();

    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parseUnary();
      if (op === '/' && right === 0) {
        throw new Error('Division by zero');
      }
      left = op === '*' ? left * right : left / right;
    }

    return left;
  }

  function parseUnary(): number {
    if (peek() === '-') {
      consume();
      return -parsePrimary();
    }
    if (peek() === '+') {
      consume();
      return parsePrimary();
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    const token = peek();

    if (token === undefined) {
      throw new Error('Unexpected end of expression');
    }

    // Parentheses
    if (token === '(') {
      consume();
      const result = parseExpression();
      if (consume() !== ')') {
        throw new Error('Missing closing parenthesis');
      }
      return result;
    }

    // Number
    if (/^[\d.]+$/.test(token)) {
      consume();
      const num = parseFloat(token);
      if (isNaN(num)) {
        throw new Error(`Invalid number: ${token}`);
      }
      return num;
    }

    // Function call
    if (/^(min|max|abs|round|ceil|floor)$/.test(token)) {
      const funcName = consume();
      if (consume() !== '(') {
        throw new Error(`Expected '(' after function ${funcName}`);
      }

      const args: number[] = [parseExpression()];
      while (peek() === ',') {
        consume();
        args.push(parseExpression());
      }

      if (consume() !== ')') {
        throw new Error(`Missing closing parenthesis for function ${funcName}`);
      }

      // Ensure we have at least one argument for single-arg functions
      const firstArg = args[0];
      if (firstArg === undefined) {
        throw new Error(`Function ${funcName} requires at least one argument`);
      }

      switch (funcName) {
        case 'min':
          return Math.min(...args);
        case 'max':
          return Math.max(...args);
        case 'abs':
          return Math.abs(firstArg);
        case 'round':
          return Math.round(firstArg);
        case 'ceil':
          return Math.ceil(firstArg);
        case 'floor':
          return Math.floor(firstArg);
        default:
          throw new Error(`Unknown function: ${funcName}`);
      }
    }

    // Variable
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token)) {
      consume();
      if (!(token in variables)) {
        throw new Error(`Unknown variable: ${token}`);
      }
      return variables[token] as number;
    }

    throw new Error(`Unexpected token: ${token}`);
  }

  const result = parseExpression();

  if (pos < tokens.length) {
    throw new Error(`Unexpected token: ${tokens[pos]}`);
  }

  return result;
}

/**
 * Tokenize expression into tokens
 */
function tokenize(expression: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < expression.length) {
    const char = expression[i]!; // Safe: checked i < expression.length

    // Skip whitespace
    if (/\s/.test(char)) {
      i++;
      continue;
    }

    // Operators and parentheses
    if ('+-*/(),'.includes(char)) {
      tokens.push(char);
      i++;
      continue;
    }

    // Numbers (including decimals)
    if (/[\d.]/.test(char)) {
      let num = '';
      while (i < expression.length) {
        const c = expression[i]!; // Safe: checked i < expression.length
        if (!/[\d.]/.test(c)) break;
        num += c;
        i++;
      }
      tokens.push(num);
      continue;
    }

    // Identifiers (variables and function names)
    if (/[a-zA-Z_]/.test(char)) {
      let id = '';
      while (i < expression.length) {
        const c = expression[i]!; // Safe: checked i < expression.length
        if (!/[a-zA-Z0-9_]/.test(c)) break;
        id += c;
        i++;
      }
      tokens.push(id);
      continue;
    }

    throw new Error(`Invalid character in expression: ${char}`);
  }

  return tokens;
}

/**
 * Evaluate custom formula
 *
 * Supported variables:
 * - materialCost: Material cost per unit
 * - fabricationCost: Fabrication cost per unit
 * - quantity: Item quantity
 * - total: materialCost + fabricationCost
 *
 * Example formulas:
 * - "materialCost * 0.05 + fabricationCost * 0.03"
 * - "total * 0.10"
 * - "quantity * 100" (flat fee per quantity)
 *
 * Security: Uses a safe expression parser instead of new Function() to prevent code injection.
 */
function evaluateCustomFormula(
  formula: string,
  materialCost: number,
  fabricationCost: number,
  quantity: number,
  currency: CurrencyCode
): {
  costPerUnit: number;
  calculationDetails: string;
} {
  if (!formula || formula.trim() === '') {
    logger.warn('Empty custom formula provided');
    return {
      costPerUnit: 0,
      calculationDetails: 'Error: Empty formula',
    };
  }

  try {
    const total = materialCost + fabricationCost;

    // Create variable context for safe evaluation
    const variables: Record<string, number> = {
      materialCost,
      fabricationCost,
      quantity,
      total,
    };

    // Evaluate using safe expression parser (no code injection possible)
    const result = safeEvaluateExpression(formula, variables);

    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
      throw new Error('Formula did not evaluate to a valid number');
    }

    const formattedResult = formatMoney(result, currency);

    return {
      costPerUnit: result,
      calculationDetails: `Custom formula: ${formula} = ${formattedResult}`,
    };
  } catch (error) {
    logger.error('Error evaluating custom formula', { formula, error });
    return {
      costPerUnit: 0,
      calculationDetails: `Error evaluating formula: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Format money for display
 */
function formatMoney(amount: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Validate service can be applied to item
 * (Based on applicability rules)
 */
export function canApplyServiceToItem(
  service: {
    applicableToCategories?: string[];
    applicableToItemTypes?: string[];
    applicableToComponentTypes?: string[];
  },
  item: {
    category?: string;
    itemType?: string;
    componentType?: string;
  }
): boolean {
  // If no applicability rules, service applies to all
  const hasRules =
    (service.applicableToCategories && service.applicableToCategories.length > 0) ||
    (service.applicableToItemTypes && service.applicableToItemTypes.length > 0) ||
    (service.applicableToComponentTypes && service.applicableToComponentTypes.length > 0);

  if (!hasRules) {
    return true;
  }

  // Check category
  if (
    service.applicableToCategories &&
    service.applicableToCategories.length > 0 &&
    item.category
  ) {
    if (!service.applicableToCategories.includes(item.category)) {
      return false;
    }
  }

  // Check item type
  if (service.applicableToItemTypes && service.applicableToItemTypes.length > 0 && item.itemType) {
    if (!service.applicableToItemTypes.includes(item.itemType)) {
      return false;
    }
  }

  // Check component type
  if (
    service.applicableToComponentTypes &&
    service.applicableToComponentTypes.length > 0 &&
    item.componentType
  ) {
    if (!service.applicableToComponentTypes.includes(item.componentType)) {
      return false;
    }
  }

  return true;
}
