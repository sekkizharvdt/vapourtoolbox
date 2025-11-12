/**
 * Charter Validation Service
 *
 * Validates project charters before approval to ensure all required
 * sections are completed and meet minimum quality standards.
 */

import type { ProjectCharter } from '@vapour/types';
import { createLogger } from '@vapour/logger';

const logger = createLogger({ context: 'charterValidationService' });

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  completionPercentage: number;
}

/**
 * Validate project charter for approval
 *
 * Checks that all required sections are completed and contain minimum data:
 * - Authorization: sponsor name, title, and budget authority
 * - Objectives: at least one objective with success criteria
 * - Deliverables: at least one deliverable with acceptance criteria
 * - Scope: in-scope and out-of-scope items defined
 * - Budget: at least one budget line item
 * - Risks: at least one risk identified
 *
 * @param charter - Project charter to validate
 * @returns Validation result with errors, warnings, and completion percentage
 */
export function validateCharterForApproval(charter: ProjectCharter | undefined): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!charter) {
    return {
      isValid: false,
      errors: ['Project charter has not been created'],
      warnings: [],
      completionPercentage: 0,
    };
  }

  const sections: Record<string, boolean> = {
    authorization: false,
    objectives: false,
    deliverables: false,
    scope: false,
    budget: false,
    risks: false,
  };

  // 1. Validate Authorization Section
  if (!charter.authorization) {
    errors.push('Authorization section is missing');
  } else {
    const auth = charter.authorization;

    if (!auth.sponsorName?.trim()) {
      errors.push('Sponsor name is required');
    }

    if (!auth.sponsorTitle?.trim()) {
      errors.push('Sponsor title/designation is required');
    }

    if (!auth.budgetAuthority?.trim()) {
      errors.push('Budget authority is required');
    }

    // Check if authorization section is complete
    if (auth.sponsorName && auth.sponsorTitle && auth.budgetAuthority) {
      sections.authorization = true;
    }
  }

  // 2. Validate Objectives Section
  if (!charter.objectives || charter.objectives.length === 0) {
    errors.push('At least one project objective is required');
  } else {
    let objectivesValid = true;

    charter.objectives.forEach((obj, index) => {
      if (!obj.description?.trim()) {
        errors.push(`Objective ${index + 1}: Description is required`);
        objectivesValid = false;
      }

      if (!obj.successCriteria || obj.successCriteria.length === 0) {
        warnings.push(`Objective ${index + 1}: No success criteria defined`);
      }
    });

    if (objectivesValid && charter.objectives.length > 0) {
      sections.objectives = true;
    }
  }

  // 3. Validate Deliverables Section
  if (!charter.deliverables || charter.deliverables.length === 0) {
    errors.push('At least one project deliverable is required');
  } else {
    let deliverablesValid = true;

    charter.deliverables.forEach((del, index) => {
      if (!del.name?.trim()) {
        errors.push(`Deliverable ${index + 1}: Name is required`);
        deliverablesValid = false;
      }

      if (!del.description?.trim()) {
        errors.push(`Deliverable ${index + 1}: Description is required`);
        deliverablesValid = false;
      }

      if (!del.acceptanceCriteria || del.acceptanceCriteria.length === 0) {
        warnings.push(`Deliverable ${index + 1}: No acceptance criteria defined`);
      }
    });

    if (deliverablesValid && charter.deliverables.length > 0) {
      sections.deliverables = true;
    }
  }

  // 4. Validate Scope Section
  if (!charter.scope) {
    errors.push('Scope section is missing');
  } else {
    let scopeValid = true;

    if (!charter.scope.inScope || charter.scope.inScope.length === 0) {
      errors.push('In-scope items must be defined');
      scopeValid = false;
    }

    if (!charter.scope.outOfScope || charter.scope.outOfScope.length === 0) {
      warnings.push('Out-of-scope items not defined (recommended to avoid scope creep)');
    }

    if (!charter.scope.assumptions || charter.scope.assumptions.length === 0) {
      warnings.push('Project assumptions not documented');
    }

    if (!charter.scope.constraints || charter.scope.constraints.length === 0) {
      warnings.push('Project constraints not documented');
    }

    if (scopeValid && charter.scope.inScope.length > 0) {
      sections.scope = true;
    }
  }

  // 5. Validate Budget Section
  if (!charter.budgetLineItems || charter.budgetLineItems.length === 0) {
    errors.push('At least one budget line item is required');
  } else {
    let budgetValid = true;

    charter.budgetLineItems.forEach((item, index) => {
      if (!item.description?.trim()) {
        errors.push(`Budget line item ${index + 1}: Description is required`);
        budgetValid = false;
      }

      if (!item.estimatedCost || item.estimatedCost <= 0) {
        errors.push(`Budget line item ${index + 1}: Estimated cost must be greater than zero`);
        budgetValid = false;
      }

      if (!item.executionType) {
        errors.push(
          `Budget line item ${index + 1}: Execution type (IN_HOUSE/OUTSOURCED) is required`
        );
        budgetValid = false;
      }

      if (item.executionType === 'OUTSOURCED' && !item.linkedVendorId) {
        warnings.push(
          `Budget line item ${index + 1}: Outsourced item should be linked to a vendor`
        );
      }
    });

    if (budgetValid && charter.budgetLineItems.length > 0) {
      sections.budget = true;
    }
  }

  // 6. Validate Risks Section
  if (!charter.risks || charter.risks.length === 0) {
    warnings.push('No risks identified (recommended for risk management)');
  } else {
    let risksValid = true;

    charter.risks.forEach((risk, index) => {
      if (!risk.description?.trim()) {
        warnings.push(`Risk ${index + 1}: Description is missing`);
        risksValid = false;
      }

      if (!risk.mitigation?.trim()) {
        warnings.push(`Risk ${index + 1}: No mitigation strategy defined`);
      }
    });

    if (risksValid && charter.risks.length > 0) {
      sections.risks = true;
    }
  }

  // Calculate completion percentage
  const completedSections = Object.values(sections).filter(Boolean).length;
  const totalSections = Object.keys(sections).length;
  const completionPercentage = Math.round((completedSections / totalSections) * 100);

  // Log validation result
  logger.info('Charter validation completed', {
    isValid: errors.length === 0,
    errorCount: errors.length,
    warningCount: warnings.length,
    completionPercentage,
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    completionPercentage,
  };
}

/**
 * Get user-friendly validation summary
 */
export function getValidationSummary(result: ValidationResult): string {
  if (result.isValid) {
    return `Charter validation passed (${result.completionPercentage}% complete)`;
  }

  let summary = `Charter validation failed (${result.completionPercentage}% complete)\n\n`;

  if (result.errors.length > 0) {
    summary += `Errors (${result.errors.length}):\n`;
    result.errors.forEach((error, index) => {
      summary += `${index + 1}. ${error}\n`;
    });
  }

  if (result.warnings.length > 0) {
    summary += `\nWarnings (${result.warnings.length}):\n`;
    result.warnings.forEach((warning, index) => {
      summary += `${index + 1}. ${warning}\n`;
    });
  }

  return summary.trim();
}

/**
 * Check if charter section is complete
 */
export function isCharterSectionComplete(
  charter: ProjectCharter | undefined,
  section: 'authorization' | 'objectives' | 'deliverables' | 'scope' | 'budget' | 'risks'
): boolean {
  if (!charter) return false;

  switch (section) {
    case 'authorization':
      return (
        !!charter.authorization?.sponsorName &&
        !!charter.authorization?.sponsorTitle &&
        !!charter.authorization?.budgetAuthority
      );

    case 'objectives':
      return (
        charter.objectives !== undefined &&
        charter.objectives.length > 0 &&
        charter.objectives.every((obj) => !!obj.description)
      );

    case 'deliverables':
      return (
        charter.deliverables !== undefined &&
        charter.deliverables.length > 0 &&
        charter.deliverables.every((del) => !!del.name && !!del.description)
      );

    case 'scope':
      return charter.scope !== undefined && charter.scope.inScope.length > 0;

    case 'budget':
      return (
        charter.budgetLineItems !== undefined &&
        charter.budgetLineItems.length > 0 &&
        charter.budgetLineItems.every(
          (item) => !!item.description && item.estimatedCost > 0 && !!item.executionType
        )
      );

    case 'risks':
      return (
        charter.risks !== undefined &&
        charter.risks.length > 0 &&
        charter.risks.every((risk) => !!risk.description)
      );

    default:
      return false;
  }
}
