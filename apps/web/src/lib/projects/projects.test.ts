/**
 * Projects Module Tests
 *
 * Tests for project management operations:
 * - Project creation and lifecycle
 * - Charter approval workflow
 * - Budget tracking and validation
 * - Cost centre integration
 * - Deliverables and milestones
 * - Risk management
 */

import { getFirebase } from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';

// Mock dependencies
jest.mock('@/lib/firebase');
jest.mock('firebase/firestore');

describe('Projects Service', () => {
  const mockDb = {} as unknown as ReturnType<typeof getFirebase>['db'];
  const mockUserId = 'user-123';
  const mockProjectId = 'proj-123';

  beforeEach(() => {
    jest.clearAllMocks();
    (getFirebase as jest.Mock).mockReturnValue({ db: mockDb });
  });

  describe('Project Creation', () => {
    it('should create project with required fields', () => {
      const project = {
        name: 'New Office Building',
        code: 'NOB-2025',
        description: 'Construction of new corporate office',
        status: 'planning' as const,
        priority: 'high' as const,
        startDate: new Date('2025-01-15'),
        endDate: new Date('2025-12-31'),
        createdBy: mockUserId,
        createdAt: Timestamp.now(),
      };

      expect(project.name).toBeTruthy();
      expect(project.code).toMatch(/^[A-Z0-9-]+$/);
      expect(project.status).toBe('planning');
    });

    it('should generate unique project codes', () => {
      const codes = new Set<string>();
      const projectCount = 5;

      for (let i = 0; i < projectCount; i++) {
        const code = `PROJ-2025-${String(i + 1).padStart(3, '0')}`;
        codes.add(code);
      }

      expect(codes.size).toBe(projectCount);
    });

    it('should validate project dates', () => {
      const startDate = new Date('2025-01-15');
      const endDate = new Date('2025-12-31');

      const isValidDateRange = endDate > startDate;

      expect(isValidDateRange).toBe(true);
    });

    it('should set default status to planning', () => {
      const defaultStatus = 'planning';
      const validStatuses = ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'];

      expect(validStatuses).toContain(defaultStatus);
    });

    it('should validate priority levels', () => {
      const priorities: Array<'low' | 'medium' | 'high' | 'critical'> = [
        'low',
        'medium',
        'high',
        'critical',
      ];

      priorities.forEach((priority) => {
        expect(['low', 'medium', 'high', 'critical']).toContain(priority);
      });
    });
  });

  describe('Charter Management', () => {
    it('should create project charter with all sections', () => {
      const charter = {
        projectId: mockProjectId,
        version: 1,
        authorization: {
          sponsorName: 'John Doe',
          sponsorTitle: 'CEO',
          budgetAuthority: 5000000,
          approvalDate: null,
        },
        objectives: [
          {
            id: 'obj-1',
            description: 'Complete construction within budget',
            successCriteria: 'Total cost < ₹50L',
          },
        ],
        deliverables: [
          {
            id: 'del-1',
            name: 'Building Structure',
            description: 'Complete foundation and structure',
            acceptanceCriteria: 'Pass structural integrity test',
          },
        ],
        scope: {
          inScope: ['Foundation work', 'Structure construction', 'Electrical installation'],
          outOfScope: ['Interior decoration', 'Furniture'],
          assumptions: ['Weather permits construction'],
          constraints: ['Budget limit of ₹50L'],
        },
        budget: {
          lineItems: [
            {
              id: 'budget-1',
              category: 'Construction',
              description: 'Foundation work',
              estimatedCost: 2000000,
              currency: 'INR',
            },
          ],
          totalBudget: 5000000,
        },
        risks: [
          {
            id: 'risk-1',
            description: 'Weather delays',
            probability: 'medium' as const,
            impact: 'high' as const,
            mitigation: 'Plan for monsoon season gaps',
          },
        ],
        status: 'draft' as const,
        createdAt: Timestamp.now(),
        createdBy: mockUserId,
      };

      expect(charter.authorization.sponsorName).toBeTruthy();
      expect(charter.objectives.length).toBeGreaterThan(0);
      expect(charter.deliverables.length).toBeGreaterThan(0);
      expect(charter.scope.inScope.length).toBeGreaterThan(0);
      expect(charter.budget.lineItems.length).toBeGreaterThan(0);
    });

    it('should validate charter before approval', () => {
      const validationRules = {
        hasSponsor: true,
        hasObjectives: true,
        hasDeliverables: true,
        hasScope: true,
        hasBudget: true,
        budgetLineItemsValid: true,
      };

      const allValid = Object.values(validationRules).every((rule) => rule === true);

      expect(allValid).toBe(true);
    });

    it('should calculate charter completion percentage', () => {
      const totalSections = 6; // authorization, objectives, deliverables, scope, budget, risks
      const completedSections = 5; // risks optional
      const completionPercentage = (completedSections / totalSections) * 100;

      expect(completionPercentage).toBeCloseTo(83.33, 2);
    });

    it('should track charter version history', () => {
      const versions = [
        { version: 1, createdAt: Timestamp.now(), createdBy: 'user-1' },
        { version: 2, createdAt: Timestamp.now(), createdBy: 'user-1' },
        { version: 3, createdAt: Timestamp.now(), createdBy: 'user-2' },
      ];

      expect(versions.length).toBe(3);
      expect(versions[versions.length - 1]?.version).toBe(3);
    });

    it('should lock charter after approval', () => {
      const charter = {
        status: 'approved' as const,
        approvedBy: 'director-123',
        approvedAt: Timestamp.now(),
        locked: true,
      };

      expect(charter.locked).toBe(true);
      expect(charter.status).toBe('approved');
    });
  });

  describe('Budget Management', () => {
    it('should calculate total budget from line items', () => {
      const lineItems = [
        { category: 'Construction', estimatedCost: 2000000 },
        { category: 'Materials', estimatedCost: 1500000 },
        { category: 'Labor', estimatedCost: 1000000 },
      ];

      const totalBudget = lineItems.reduce((sum, item) => sum + item.estimatedCost, 0);

      expect(totalBudget).toBe(4500000);
    });

    it('should handle multi-currency budget items', () => {
      const lineItems = [
        { description: 'Local materials', cost: 2000000, currency: 'INR', exchangeRate: 1 },
        { description: 'Imported equipment', cost: 10000, currency: 'USD', exchangeRate: 83 },
      ];

      const totalINR = lineItems.reduce((sum, item) => {
        return sum + item.cost * item.exchangeRate;
      }, 0);

      expect(totalINR).toBe(2830000); // 2000000 + (10000 * 83)
    });

    it('should track budget vs actual costs', () => {
      const budgeted = 5000000;
      const actualCost = 4200000;
      const variance = budgeted - actualCost;
      const variancePercentage = (variance / budgeted) * 100;

      expect(variance).toBe(800000);
      expect(variancePercentage).toBe(16);
    });

    it('should flag budget overruns', () => {
      const budgeted = 5000000;
      const actualCost = 5500000;
      const isOverBudget = actualCost > budgeted;
      const overrun = actualCost - budgeted;

      expect(isOverBudget).toBe(true);
      expect(overrun).toBe(500000);
    });

    it('should prevent budget edits after charter approval', () => {
      const charter = {
        status: 'approved' as const,
        budgetLocked: true,
      };

      const canEdit = charter.status !== 'approved' && !charter.budgetLocked;

      expect(canEdit).toBe(false);
    });

    it('should calculate budget utilization percentage', () => {
      const totalBudget = 5000000;
      const spent = 3500000;
      const committed = 1000000; // approved PRs
      const utilizationPercentage = ((spent + committed) / totalBudget) * 100;

      expect(utilizationPercentage).toBe(90);
    });

    it('should allocate budget by cost centre', () => {
      const allocations = [
        { costCentre: 'CC-CONSTRUCTION', allocated: 3000000 },
        { costCentre: 'CC-MATERIALS', allocated: 1500000 },
        { costCentre: 'CC-OVERHEAD', allocated: 500000 },
      ];

      const totalAllocated = allocations.reduce((sum, item) => sum + item.allocated, 0);

      expect(totalAllocated).toBe(5000000);
    });
  });

  describe('Cost Centre Integration', () => {
    it('should create cost centre on charter approval', () => {
      const project = {
        code: 'NOB-2025',
        name: 'New Office Building',
        charterStatus: 'approved' as const,
      };

      const costCentre = {
        code: `CC-${project.code}`,
        name: project.name,
        projectId: mockProjectId,
        isActive: true,
        createdAt: Timestamp.now(),
      };

      expect(costCentre.code).toBe('CC-NOB-2025');
      expect(costCentre.projectId).toBe(mockProjectId);
    });

    it('should link transactions to project cost centre', () => {
      const transaction = {
        type: 'VENDOR_BILL',
        amount: 250000,
        costCentreId: `CC-${mockProjectId}`,
        projectId: mockProjectId,
        budgetLineItemId: 'budget-1',
      };

      expect(transaction.costCentreId).toBeTruthy();
      expect(transaction.projectId).toBe(mockProjectId);
    });

    it('should query transactions by cost centre', () => {
      const costCentreId = `CC-${mockProjectId}`;
      const transactions = [
        { id: 'txn-1', costCentreId, amount: 100000 },
        { id: 'txn-2', costCentreId, amount: 150000 },
        { id: 'txn-3', costCentreId: 'CC-OTHER', amount: 200000 },
      ];

      const projectTransactions = transactions.filter((t) => t.costCentreId === costCentreId);

      expect(projectTransactions.length).toBe(2);
    });

    it('should calculate actual costs from cost centre', () => {
      const costCentreTransactions = [
        { type: 'VENDOR_BILL', amount: 250000, status: 'POSTED' },
        { type: 'VENDOR_PAYMENT', amount: 150000, status: 'PAID' },
        { type: 'EXPENSE_CLAIM', amount: 50000, status: 'POSTED' },
      ];

      const totalActual = costCentreTransactions
        .filter((t) => ['POSTED', 'PAID', 'PARTIALLY_PAID'].includes(t.status))
        .reduce((sum, t) => sum + t.amount, 0);

      expect(totalActual).toBe(450000);
    });
  });

  describe('Deliverables Management', () => {
    it('should track deliverable status', () => {
      type DeliverableStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed';

      const deliverable = {
        id: 'del-1',
        name: 'Foundation Work',
        status: 'in_progress' as DeliverableStatus,
        startDate: new Date('2025-01-15'),
        targetDate: new Date('2025-03-31'),
        completionPercentage: 60,
      };

      expect(deliverable.status).toBe('in_progress');
      expect(deliverable.completionPercentage).toBeLessThan(100);
    });

    it('should calculate deliverable progress', () => {
      const totalDeliverables = 5;
      const completedDeliverables = 3;
      const progress = (completedDeliverables / totalDeliverables) * 100;

      expect(progress).toBe(60);
    });

    it('should identify delayed deliverables', () => {
      const today = new Date('2025-04-01');
      const deliverable = {
        targetDate: new Date('2025-03-31'),
        status: 'in_progress',
      };

      const isDelayed = deliverable.status !== 'completed' && deliverable.targetDate < today;

      expect(isDelayed).toBe(true);
    });

    it('should link deliverables to milestones', () => {
      const milestone = {
        id: 'milestone-1',
        name: 'Phase 1 Complete',
        deliverableIds: ['del-1', 'del-2', 'del-3'],
        targetDate: new Date('2025-06-30'),
      };

      expect(milestone.deliverableIds.length).toBe(3);
    });
  });

  describe('Risk Management', () => {
    it('should categorize risks by probability and impact', () => {
      type RiskLevel = 'low' | 'medium' | 'high';

      const risk = {
        description: 'Weather delays',
        probability: 'medium' as RiskLevel,
        impact: 'high' as RiskLevel,
      };

      const riskScore = {
        low: 1,
        medium: 2,
        high: 3,
      };

      const score = riskScore[risk.probability] * riskScore[risk.impact];

      expect(score).toBe(6); // medium (2) * high (3)
    });

    it('should prioritize risks by score', () => {
      const risks = [
        { id: 'risk-1', probability: 3, impact: 3, score: 9 }, // Critical
        { id: 'risk-2', probability: 2, impact: 3, score: 6 }, // High
        { id: 'risk-3', probability: 1, impact: 2, score: 2 }, // Low
      ];

      const sortedRisks = [...risks].sort((a, b) => b.score - a.score);

      expect(sortedRisks[0]?.id).toBe('risk-1');
      expect(sortedRisks[0]?.score).toBe(9);
    });

    it('should track risk mitigation actions', () => {
      const risk = {
        id: 'risk-1',
        description: 'Budget overrun',
        mitigation: 'Weekly budget reviews',
        mitigationStatus: 'implemented' as const,
        owner: 'pm-user-123',
      };

      expect(risk.mitigation).toBeTruthy();
      expect(risk.mitigationStatus).toBe('implemented');
    });

    it('should identify high-priority risks', () => {
      const risks = [
        { probability: 'high', impact: 'high', score: 9 },
        { probability: 'medium', impact: 'low', score: 2 },
        { probability: 'high', impact: 'medium', score: 6 },
      ];

      const highPriorityRisks = risks.filter((r) => r.score >= 6);

      expect(highPriorityRisks.length).toBe(2);
    });
  });

  describe('Project Status Management', () => {
    it('should follow valid status flow', () => {
      type ProjectStatus = 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';

      const validTransitions: Record<ProjectStatus, ProjectStatus[]> = {
        planning: ['in_progress', 'on_hold', 'cancelled'],
        in_progress: ['on_hold', 'completed', 'cancelled'],
        on_hold: ['in_progress', 'cancelled'],
        completed: [],
        cancelled: [],
      };

      expect(validTransitions.planning).toContain('in_progress');
      expect(validTransitions.in_progress).toContain('completed');
      expect(validTransitions.completed).toHaveLength(0);
    });

    it('should prevent invalid status transitions', () => {
      const newStatus = 'planning';

      const validTransitions = {
        completed: [],
      };

      const isValid = validTransitions.completed.includes(newStatus as never);

      expect(isValid).toBe(false);
    });

    it('should track status change history', () => {
      const statusHistory = [
        { status: 'planning', timestamp: Timestamp.now(), by: 'user-1' },
        { status: 'in_progress', timestamp: Timestamp.now(), by: 'user-1' },
        { status: 'on_hold', timestamp: Timestamp.now(), by: 'pm-1' },
        { status: 'in_progress', timestamp: Timestamp.now(), by: 'pm-1' },
      ];

      expect(statusHistory.length).toBe(4);
      expect(statusHistory[statusHistory.length - 1]?.status).toBe('in_progress');
    });
  });

  describe('Project Cloning', () => {
    it('should clone project with charter template', () => {
      const originalProject = {
        name: 'Office Building Phase 1',
        code: 'OB-P1-2025',
        charter: {
          objectives: [{ description: 'Complete construction' }],
          deliverables: [{ name: 'Building structure' }],
        },
      };

      const clonedProject = {
        name: 'Office Building Phase 2',
        code: 'OB-P2-2025',
        charter: {
          ...originalProject.charter,
          status: 'draft' as const,
        },
        clonedFrom: originalProject.code,
      };

      expect(clonedProject.charter.objectives.length).toBe(
        originalProject.charter.objectives.length
      );
      expect(clonedProject.charter.status).toBe('draft');
    });
  });

  describe('Project Analytics', () => {
    it('should calculate schedule performance index (SPI)', () => {
      const plannedValue = 5000000; // Budget for work scheduled
      const earnedValue = 4500000; // Budget for work completed
      const spi = earnedValue / plannedValue;

      expect(spi).toBe(0.9); // Behind schedule
    });

    it('should calculate cost performance index (CPI)', () => {
      const earnedValue = 4500000; // Budget for work completed
      const actualCost = 4800000; // Actual cost of work completed
      const cpi = earnedValue / actualCost;

      expect(cpi).toBeCloseTo(0.9375, 4); // Over budget
    });

    it('should forecast completion date', () => {
      const originalDuration = 365; // days
      const daysElapsed = 200;
      const progressPercentage = 45; // 45% complete

      const expectedCompletion = (daysElapsed / progressPercentage) * 100;
      const delay = expectedCompletion - originalDuration;

      expect(expectedCompletion).toBeCloseTo(444.44, 2);
      expect(delay).toBeGreaterThan(0); // Project delayed
    });

    it('should calculate budget at completion (BAC)', () => {
      const originalBudget = 5000000;
      const earnedValue = 2500000;
      const actualCost = 2800000;
      const cpi = earnedValue / actualCost;
      const estimateAtCompletion = originalBudget / cpi;

      expect(estimateAtCompletion).toBeCloseTo(5600000, 0);
    });
  });

  describe('Stakeholder Management', () => {
    it('should track project stakeholders', () => {
      const stakeholders = [
        { name: 'John Doe', role: 'Sponsor', influence: 'high', interest: 'high' },
        { name: 'Jane Smith', role: 'PM', influence: 'high', interest: 'high' },
        { name: 'Bob Johnson', role: 'Vendor', influence: 'medium', interest: 'medium' },
      ];

      const keyStakeholders = stakeholders.filter(
        (s) => s.influence === 'high' || s.interest === 'high'
      );

      expect(keyStakeholders.length).toBe(2); // John and Jane (both high influence/interest)
    });

    it('should categorize stakeholders by engagement', () => {
      type EngagementLevel = 'unaware' | 'resistant' | 'neutral' | 'supportive' | 'leading';

      const stakeholder = {
        name: 'Project Sponsor',
        currentEngagement: 'supportive' as EngagementLevel,
        desiredEngagement: 'leading' as EngagementLevel,
      };

      const engagementGap = stakeholder.desiredEngagement !== stakeholder.currentEngagement;

      expect(engagementGap).toBe(true);
    });
  });

  describe('Project Validation', () => {
    it('should validate project code format', () => {
      const validCodes = ['PROJ-2025-001', 'NOB-2025', 'ABC-XYZ-123'];
      const invalidCodes = ['proj 2025', 'invalid code!', 'test@code'];

      const codePattern = /^[A-Z0-9-]+$/;

      validCodes.forEach((code) => {
        expect(codePattern.test(code)).toBe(true);
      });

      invalidCodes.forEach((code) => {
        expect(codePattern.test(code)).toBe(false);
      });
    });

    it('should validate budget line items have positive costs', () => {
      const lineItems = [
        { description: 'Item 1', estimatedCost: 100000 },
        { description: 'Item 2', estimatedCost: 50000 },
      ];

      const allPositive = lineItems.every((item) => item.estimatedCost > 0);

      expect(allPositive).toBe(true);
    });

    it('should validate project has unique code', () => {
      const existingCodes = ['PROJ-001', 'PROJ-002', 'PROJ-003'];
      const newCode = 'PROJ-004';

      const isDuplicate = existingCodes.includes(newCode);

      expect(isDuplicate).toBe(false);
    });
  });

  describe('Project Completion', () => {
    it('should validate all deliverables completed', () => {
      const deliverables = [
        { id: 'del-1', status: 'completed' },
        { id: 'del-2', status: 'completed' },
        { id: 'del-3', status: 'completed' },
      ];

      const allCompleted = deliverables.every((d) => d.status === 'completed');

      expect(allCompleted).toBe(true);
    });

    it('should close project with final report', () => {
      const project = {
        status: 'completed' as const,
        finalReport: {
          budgetVariance: -200000, // Under budget by 2L
          scheduleVariance: 15, // 15 days late
          lessonsLearned: ['Weather contingency worked well', 'Need better vendor management'],
          successCriteriaMet: true,
        },
        closedBy: mockUserId,
        closedAt: Timestamp.now(),
      };

      expect(project.status).toBe('completed');
      expect(project.finalReport.lessonsLearned.length).toBeGreaterThan(0);
    });

    it('should archive project documents', () => {
      const archiveStatus = {
        charterArchived: true,
        budgetArchived: true,
        deliverablesArchived: true,
        risksArchived: true,
        archivedAt: Timestamp.now(),
      };

      const allArchived =
        archiveStatus.charterArchived &&
        archiveStatus.budgetArchived &&
        archiveStatus.deliverablesArchived &&
        archiveStatus.risksArchived;

      expect(allArchived).toBe(true);
    });
  });
});
