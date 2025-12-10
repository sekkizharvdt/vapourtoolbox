/**
 * Charter Validation Service Tests
 *
 * Tests for project charter validation including:
 * - Authorization validation
 * - Objectives validation
 * - Deliverables validation
 * - Scope validation
 * - Budget validation
 * - Risk validation
 * - Completion percentage calculation
 */

import {
  validateCharterForApproval,
  getValidationSummary,
  isCharterSectionComplete,
} from './charterValidationService';
import type { ProjectCharter, CharterBudgetLineItem } from '@vapour/types';
import { Timestamp } from 'firebase/firestore';

// Helper to create a minimal valid charter for testing
// Note: Uses type assertion since validation service handles partial data gracefully
const createValidCharter = (): ProjectCharter =>
  ({
    authorization: {
      sponsorName: 'John Doe',
      sponsorTitle: 'VP Engineering',
      budgetAuthority: '$500,000',
      approvalStatus: 'DRAFT',
    },
    objectives: [
      {
        id: 'obj-001',
        description: 'Deliver project on time',
        successCriteria: ['Meet deadline', 'Within budget'],
        status: 'NOT_STARTED',
        priority: 'HIGH',
      },
    ],
    deliverables: [
      {
        id: 'del-001',
        name: 'Final Report',
        description: 'Comprehensive project report',
        acceptanceCriteria: ['Reviewed by stakeholders'],
        status: 'NOT_STARTED',
      },
    ],
    scope: {
      inScope: ['Feature A', 'Feature B'],
      outOfScope: ['Feature C'],
      assumptions: ['Team available'],
      constraints: [{ description: 'Budget limit', type: 'BUDGET' }],
    },
    budgetLineItems: [
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      {
        id: 'budget-001',
        lineNumber: 1,
        description: 'Development',
        estimatedCost: 100000,
        currency: 'INR',
        executionType: 'IN_HOUSE',
        status: 'PLANNED',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: 'user-001',
      } as CharterBudgetLineItem,
    ],
    risks: [
      {
        id: 'risk-001',
        description: 'Resource availability',
        probability: 'MEDIUM',
        impact: 'HIGH',
        mitigation: 'Cross-train team members',
        status: 'OPEN',
      },
    ],
    stakeholders: [],
  }) as unknown as ProjectCharter;

describe('Charter Validation Service', () => {
  describe('validateCharterForApproval', () => {
    describe('with valid charter', () => {
      it('should return valid for complete charter', () => {
        const charter = createValidCharter();
        const result = validateCharterForApproval(charter);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.completionPercentage).toBe(100);
      });

      it('should return 100% completion for all sections complete', () => {
        const charter = createValidCharter();
        const result = validateCharterForApproval(charter);

        expect(result.completionPercentage).toBe(100);
      });
    });

    describe('with undefined charter', () => {
      it('should return invalid for undefined charter', () => {
        const result = validateCharterForApproval(undefined);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Project charter has not been created');
        expect(result.completionPercentage).toBe(0);
      });
    });

    describe('authorization validation', () => {
      it('should error when authorization is missing', () => {
        const charter = createValidCharter();
        delete (charter as unknown as Record<string, unknown>).authorization;
        const result = validateCharterForApproval(charter);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Authorization section is missing');
      });

      it('should error when sponsor name is missing', () => {
        const charter = createValidCharter();
        charter.authorization.sponsorName = '';
        const result = validateCharterForApproval(charter);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Sponsor name is required');
      });

      it('should error when sponsor title is missing', () => {
        const charter = createValidCharter();
        charter.authorization.sponsorTitle = '';
        const result = validateCharterForApproval(charter);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Sponsor title/designation is required');
      });

      it('should error when budget authority is missing', () => {
        const charter = createValidCharter();
        charter.authorization.budgetAuthority = '';
        const result = validateCharterForApproval(charter);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Budget authority is required');
      });
    });

    describe('objectives validation', () => {
      it('should error when objectives array is empty', () => {
        const charter = createValidCharter();
        charter.objectives = [];
        const result = validateCharterForApproval(charter);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('At least one project objective is required');
      });

      it('should error when objectives is undefined', () => {
        const charter = createValidCharter();
        delete (charter as unknown as Record<string, unknown>).objectives;
        const result = validateCharterForApproval(charter);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('At least one project objective is required');
      });

      it('should error when objective description is empty', () => {
        const charter = createValidCharter();
        charter.objectives[0]!.description = '';
        const result = validateCharterForApproval(charter);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Objective 1: Description is required');
      });

      it('should warn when objective has no success criteria', () => {
        const charter = createValidCharter();
        charter.objectives[0]!.successCriteria = [];
        const result = validateCharterForApproval(charter);

        expect(result.warnings).toContain('Objective 1: No success criteria defined');
      });
    });

    describe('deliverables validation', () => {
      it('should error when deliverables array is empty', () => {
        const charter = createValidCharter();
        charter.deliverables = [];
        const result = validateCharterForApproval(charter);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('At least one project deliverable is required');
      });

      it('should error when deliverable name is empty', () => {
        const charter = createValidCharter();
        charter.deliverables[0]!.name = '';
        const result = validateCharterForApproval(charter);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Deliverable 1: Name is required');
      });

      it('should error when deliverable description is empty', () => {
        const charter = createValidCharter();
        charter.deliverables[0]!.description = '';
        const result = validateCharterForApproval(charter);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Deliverable 1: Description is required');
      });

      it('should warn when deliverable has no acceptance criteria', () => {
        const charter = createValidCharter();
        charter.deliverables[0]!.acceptanceCriteria = [];
        const result = validateCharterForApproval(charter);

        expect(result.warnings).toContain('Deliverable 1: No acceptance criteria defined');
      });
    });

    describe('scope validation', () => {
      it('should error when scope is missing', () => {
        const charter = createValidCharter();
        delete (charter as unknown as Record<string, unknown>).scope;
        const result = validateCharterForApproval(charter);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Scope section is missing');
      });

      it('should error when in-scope items are empty', () => {
        const charter = createValidCharter();
        charter.scope.inScope = [];
        const result = validateCharterForApproval(charter);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('In-scope items must be defined');
      });

      it('should warn when out-of-scope items are empty', () => {
        const charter = createValidCharter();
        charter.scope.outOfScope = [];
        const result = validateCharterForApproval(charter);

        expect(result.warnings).toContain(
          'Out-of-scope items not defined (recommended to avoid scope creep)'
        );
      });

      it('should warn when assumptions are empty', () => {
        const charter = createValidCharter();
        charter.scope.assumptions = [];
        const result = validateCharterForApproval(charter);

        expect(result.warnings).toContain('Project assumptions not documented');
      });

      it('should warn when constraints are empty', () => {
        const charter = createValidCharter();
        charter.scope.constraints = [];
        const result = validateCharterForApproval(charter);

        expect(result.warnings).toContain('Project constraints not documented');
      });
    });

    describe('budget validation', () => {
      it('should error when budget line items are empty', () => {
        const charter = createValidCharter();
        charter.budgetLineItems = [];
        const result = validateCharterForApproval(charter);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('At least one budget line item is required');
      });

      it('should error when budget line item description is empty', () => {
        const charter = createValidCharter();
        charter.budgetLineItems![0]!.description = '';
        const result = validateCharterForApproval(charter);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Budget line item 1: Description is required');
      });

      it('should error when estimated cost is zero', () => {
        const charter = createValidCharter();
        charter.budgetLineItems![0]!.estimatedCost = 0;
        const result = validateCharterForApproval(charter);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Budget line item 1: Estimated cost must be greater than zero'
        );
      });

      it('should error when estimated cost is negative', () => {
        const charter = createValidCharter();
        charter.budgetLineItems![0]!.estimatedCost = -100;
        const result = validateCharterForApproval(charter);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Budget line item 1: Estimated cost must be greater than zero'
        );
      });

      it('should error when execution type is missing', () => {
        const charter = createValidCharter();
        delete (charter.budgetLineItems![0] as unknown as Record<string, unknown>).executionType;
        const result = validateCharterForApproval(charter);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Budget line item 1: Execution type (IN_HOUSE/OUTSOURCED) is required'
        );
      });

      it('should warn when outsourced item has no linked vendor', () => {
        const charter = createValidCharter();
        charter.budgetLineItems![0]!.executionType = 'OUTSOURCED';
        delete charter.budgetLineItems![0]!.linkedVendorId;
        const result = validateCharterForApproval(charter);

        expect(result.warnings).toContain(
          'Budget line item 1: Outsourced item should be linked to a vendor'
        );
      });
    });

    describe('risks validation', () => {
      it('should warn when risks array is empty', () => {
        const charter = createValidCharter();
        charter.risks = [];
        const result = validateCharterForApproval(charter);

        // Note: Missing risks is a warning, not an error
        expect(result.warnings).toContain('No risks identified (recommended for risk management)');
      });

      it('should warn when risk description is missing', () => {
        const charter = createValidCharter();
        charter.risks[0]!.description = '';
        const result = validateCharterForApproval(charter);

        expect(result.warnings).toContain('Risk 1: Description is missing');
      });

      it('should warn when risk mitigation is missing', () => {
        const charter = createValidCharter();
        charter.risks[0]!.mitigation = '';
        const result = validateCharterForApproval(charter);

        expect(result.warnings).toContain('Risk 1: No mitigation strategy defined');
      });
    });

    describe('completion percentage', () => {
      it('should calculate correct percentage with partial completion', () => {
        const charter = createValidCharter();
        // Remove objectives to make that section incomplete
        charter.objectives = [];
        // Remove deliverables
        charter.deliverables = [];

        const result = validateCharterForApproval(charter);

        // 4 out of 6 sections complete = 67%
        expect(result.completionPercentage).toBe(67);
      });

      it('should return 0% for empty charter', () => {
        const charter = {} as unknown as ProjectCharter;
        const result = validateCharterForApproval(charter);

        expect(result.completionPercentage).toBe(0);
      });
    });
  });

  describe('getValidationSummary', () => {
    it('should return success message for valid charter', () => {
      const result = {
        isValid: true,
        errors: [],
        warnings: [],
        completionPercentage: 100,
      };

      const summary = getValidationSummary(result);
      expect(summary).toBe('Charter validation passed (100% complete)');
    });

    it('should include errors in summary', () => {
      const result = {
        isValid: false,
        errors: ['Error 1', 'Error 2'],
        warnings: [],
        completionPercentage: 50,
      };

      const summary = getValidationSummary(result);
      expect(summary).toContain('Charter validation failed (50% complete)');
      expect(summary).toContain('Error 1');
      expect(summary).toContain('Error 2');
    });

    it('should include warnings in summary', () => {
      const result = {
        isValid: false,
        errors: ['Error 1'],
        warnings: ['Warning 1'],
        completionPercentage: 50,
      };

      const summary = getValidationSummary(result);
      expect(summary).toContain('Warning 1');
    });
  });

  describe('isCharterSectionComplete', () => {
    describe('authorization section', () => {
      it('should return true when authorization is complete', () => {
        const charter = createValidCharter();
        expect(isCharterSectionComplete(charter, 'authorization')).toBe(true);
      });

      it('should return false when sponsor name is missing', () => {
        const charter = createValidCharter();
        charter.authorization.sponsorName = '';
        expect(isCharterSectionComplete(charter, 'authorization')).toBe(false);
      });

      it('should return false for undefined charter', () => {
        expect(isCharterSectionComplete(undefined, 'authorization')).toBe(false);
      });
    });

    describe('objectives section', () => {
      it('should return true when objectives are complete', () => {
        const charter = createValidCharter();
        expect(isCharterSectionComplete(charter, 'objectives')).toBe(true);
      });

      it('should return false when objectives array is empty', () => {
        const charter = createValidCharter();
        charter.objectives = [];
        expect(isCharterSectionComplete(charter, 'objectives')).toBe(false);
      });

      it('should return false when objective has no description', () => {
        const charter = createValidCharter();
        charter.objectives[0]!.description = '';
        expect(isCharterSectionComplete(charter, 'objectives')).toBe(false);
      });
    });

    describe('deliverables section', () => {
      it('should return true when deliverables are complete', () => {
        const charter = createValidCharter();
        expect(isCharterSectionComplete(charter, 'deliverables')).toBe(true);
      });

      it('should return false when deliverables array is empty', () => {
        const charter = createValidCharter();
        charter.deliverables = [];
        expect(isCharterSectionComplete(charter, 'deliverables')).toBe(false);
      });

      it('should return false when deliverable has no name', () => {
        const charter = createValidCharter();
        charter.deliverables[0]!.name = '';
        expect(isCharterSectionComplete(charter, 'deliverables')).toBe(false);
      });
    });

    describe('scope section', () => {
      it('should return true when scope is complete', () => {
        const charter = createValidCharter();
        expect(isCharterSectionComplete(charter, 'scope')).toBe(true);
      });

      it('should return false when in-scope is empty', () => {
        const charter = createValidCharter();
        charter.scope.inScope = [];
        expect(isCharterSectionComplete(charter, 'scope')).toBe(false);
      });
    });

    describe('budget section', () => {
      it('should return true when budget is complete', () => {
        const charter = createValidCharter();
        expect(isCharterSectionComplete(charter, 'budget')).toBe(true);
      });

      it('should return false when budget line items are empty', () => {
        const charter = createValidCharter();
        charter.budgetLineItems = [];
        expect(isCharterSectionComplete(charter, 'budget')).toBe(false);
      });

      it('should return false when budget item has invalid cost', () => {
        const charter = createValidCharter();
        charter.budgetLineItems![0]!.estimatedCost = 0;
        expect(isCharterSectionComplete(charter, 'budget')).toBe(false);
      });
    });

    describe('risks section', () => {
      it('should return true when risks are complete', () => {
        const charter = createValidCharter();
        expect(isCharterSectionComplete(charter, 'risks')).toBe(true);
      });

      it('should return false when risks array is empty', () => {
        const charter = createValidCharter();
        charter.risks = [];
        expect(isCharterSectionComplete(charter, 'risks')).toBe(false);
      });

      it('should return false when risk has no description', () => {
        const charter = createValidCharter();
        charter.risks[0]!.description = '';
        expect(isCharterSectionComplete(charter, 'risks')).toBe(false);
      });
    });
  });
});
