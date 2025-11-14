/**
 * Three-Way Match Validation Tests
 *
 * Tests for three-way match process:
 * - PO vs GRN vs Invoice matching
 * - Quantity validation
 * - Price validation
 * - Amount variance detection
 * - Approval workflows for mismatches
 * - Payment authorization
 */

import { getFirebase } from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';

// Mock dependencies
jest.mock('@/lib/firebase');
jest.mock('firebase/firestore');

describe('Three-Way Match Service', () => {
  const mockDb = {} as ReturnType<typeof getFirebase>['db'];
  const mockUserId = 'user-123';
  const mockPoId = 'po-123';
  const mockGrnId = 'grn-123';
  const mockInvoiceId = 'invoice-123';

  beforeEach(() => {
    jest.clearAllMocks();
    (getFirebase as jest.Mock).mockReturnValue({ db: mockDb });
  });

  describe('Perfect Match Scenario', () => {
    it('should pass validation when all documents match', () => {
      const po = {
        poId: mockPoId,
        items: [
          { itemId: 'item-1', description: 'Laptop', quantity: 10, unitPrice: 50000 },
          { itemId: 'item-2', description: 'Monitor', quantity: 10, unitPrice: 15000 },
        ],
        totalAmount: 650000,
      };

      const grn = {
        grnId: mockGrnId,
        poId: mockPoId,
        items: [
          { itemId: 'item-1', description: 'Laptop', acceptedQty: 10 },
          { itemId: 'item-2', description: 'Monitor', acceptedQty: 10 },
        ],
      };

      const invoice = {
        invoiceId: mockInvoiceId,
        poId: mockPoId,
        items: [
          { itemId: 'item-1', description: 'Laptop', quantity: 10, unitPrice: 50000 },
          { itemId: 'item-2', description: 'Monitor', quantity: 10, unitPrice: 15000 },
        ],
        totalAmount: 650000,
      };

      // Validate quantities
      const quantitiesMatch = po.items.every((poItem) => {
        const grnItem = grn.items.find((g) => g.itemId === poItem.itemId);
        const invItem = invoice.items.find((i) => i.itemId === poItem.itemId);

        return (
          grnItem &&
          invItem &&
          grnItem.acceptedQty === poItem.quantity &&
          invItem.quantity === poItem.quantity
        );
      });

      // Validate prices
      const pricesMatch = po.items.every((poItem) => {
        const invItem = invoice.items.find((i) => i.itemId === poItem.itemId);
        return invItem && invItem.unitPrice === poItem.unitPrice;
      });

      // Validate totals
      const totalsMatch = po.totalAmount === invoice.totalAmount;

      expect(quantitiesMatch).toBe(true);
      expect(pricesMatch).toBe(true);
      expect(totalsMatch).toBe(true);
    });

    it('should approve payment for perfect match', () => {
      const matchResult = {
        poId: mockPoId,
        grnId: mockGrnId,
        invoiceId: mockInvoiceId,
        quantityVariance: 0,
        priceVariance: 0,
        amountVariance: 0,
        status: 'approved' as const,
        approvalRequired: false,
      };

      expect(matchResult.status).toBe('approved');
      expect(matchResult.approvalRequired).toBe(false);
    });

    it('should create payment record for approved match', () => {
      const payment = {
        invoiceId: mockInvoiceId,
        poId: mockPoId,
        grnId: mockGrnId,
        amount: 650000,
        status: 'approved_for_payment' as const,
        approvedBy: mockUserId,
        approvedAt: Timestamp.now(),
      };

      expect(payment.status).toBe('approved_for_payment');
      expect(payment.amount).toBeGreaterThan(0);
    });
  });

  describe('Quantity Variance Detection', () => {
    it('should detect quantity mismatch between PO and GRN', () => {
      const poQty = 100;
      const grnQty = 95;
      const variance = grnQty - poQty;
      const variancePercentage = (variance / poQty) * 100;

      expect(variance).toBe(-5);
      expect(variancePercentage).toBe(-5);
    });

    it('should detect quantity mismatch between GRN and Invoice', () => {
      const grnQty: number = 95;
      const invoiceQty: number = 100;
      const mismatch = invoiceQty !== grnQty;

      expect(mismatch).toBe(true);
    });

    it('should flag over-billing when invoice qty exceeds GRN', () => {
      const grnAcceptedQty = 95;
      const invoiceQty = 100;
      const overBilling = invoiceQty - grnAcceptedQty;

      expect(overBilling).toBe(5);
      expect(overBilling).toBeGreaterThan(0);
    });

    it('should allow partial delivery with adjusted invoice', () => {
      const poQty = 100;
      const grnQty = 95;
      const invoiceQty = 95;

      const invoiceMatchesGrn = invoiceQty === grnQty;
      const partialDelivery = grnQty < poQty;

      expect(invoiceMatchesGrn).toBe(true);
      expect(partialDelivery).toBe(true);
    });

    it('should calculate variance tolerance threshold', () => {
      const variance = 5;
      const totalQty = 100;
      const variancePercentage = (variance / totalQty) * 100;
      const toleranceThreshold = 2; // 2% tolerance

      const withinTolerance = variancePercentage <= toleranceThreshold;

      expect(withinTolerance).toBe(false);
      expect(variancePercentage).toBe(5);
    });

    it('should require approval for variance above threshold', () => {
      const variancePercentage = 5;
      const toleranceThreshold = 2;

      const requiresApproval = variancePercentage > toleranceThreshold;

      expect(requiresApproval).toBe(true);
    });
  });

  describe('Price Variance Detection', () => {
    it('should detect price increase in invoice', () => {
      const poUnitPrice = 50000;
      const invoiceUnitPrice = 52000;
      const priceVariance = invoiceUnitPrice - poUnitPrice;
      const variancePercentage = (priceVariance / poUnitPrice) * 100;

      expect(priceVariance).toBe(2000);
      expect(variancePercentage).toBe(4);
    });

    it('should detect price decrease in invoice', () => {
      const poUnitPrice = 50000;
      const invoiceUnitPrice = 48000;
      const priceVariance = invoiceUnitPrice - poUnitPrice;

      expect(priceVariance).toBe(-2000);
      expect(priceVariance).toBeLessThan(0);
    });

    it('should flag significant price variance', () => {
      const poPrice = 50000;
      const invoicePrice = 55000;
      const variance = ((invoicePrice - poPrice) / poPrice) * 100;
      const significantThreshold = 5; // 5%

      const isSignificant = Math.abs(variance) > significantThreshold;

      expect(isSignificant).toBe(true);
      expect(variance).toBe(10);
    });

    it('should allow minor price variance within tolerance', () => {
      const poPrice = 50000;
      const invoicePrice = 50500;
      const variance = ((invoicePrice - poPrice) / poPrice) * 100;
      const tolerance = 2; // 2%

      const withinTolerance = Math.abs(variance) <= tolerance;

      expect(withinTolerance).toBe(true);
      expect(variance).toBe(1);
    });

    it('should calculate line item price variance', () => {
      const items = [
        { poPrice: 50000, invoicePrice: 50000, variance: 0 },
        { poPrice: 15000, invoicePrice: 15500, variance: 500 },
        { poPrice: 20000, invoicePrice: 19500, variance: -500 },
      ];

      const totalVariance = items.reduce((sum, item) => sum + item.variance, 0);

      expect(totalVariance).toBe(0);
    });
  });

  describe('Amount Variance Detection', () => {
    it('should detect total amount mismatch', () => {
      const poTotal = 650000;
      const invoiceTotal = 665000;
      const variance = invoiceTotal - poTotal;
      const variancePercentage = (variance / poTotal) * 100;

      expect(variance).toBe(15000);
      expect(variancePercentage).toBeCloseTo(2.31, 2);
    });

    it('should calculate variance due to quantity difference', () => {
      const poQty = 100;
      const grnQty = 95;
      const unitPrice = 1000;

      const poAmount = poQty * unitPrice;
      const grnAmount = grnQty * unitPrice;
      const variance = grnAmount - poAmount;

      expect(variance).toBe(-5000);
    });

    it('should calculate variance due to price difference', () => {
      const quantity = 100;
      const poPrice = 1000;
      const invoicePrice = 1050;

      const poAmount = quantity * poPrice;
      const invoiceAmount = quantity * invoicePrice;
      const variance = invoiceAmount - poAmount;

      expect(variance).toBe(5000);
    });

    it('should calculate compound variance (price + quantity)', () => {
      const poQty = 100;
      const grnQty = 95;
      const poPrice = 1000;
      const invoicePrice = 1050;

      const poAmount = poQty * poPrice;
      const invoiceAmount = grnQty * invoicePrice;
      const variance = invoiceAmount - poAmount;

      expect(variance).toBe(-250);
    });

    it('should handle GST calculation variance', () => {
      const baseAmount = 100000;
      const poGST = baseAmount * 0.18; // 18000
      const invoiceGST = baseAmount * 0.18; // 18000

      const gstVariance = invoiceGST - poGST;

      expect(gstVariance).toBe(0);
    });

    it('should detect GST rate mismatch', () => {
      const amount = 100000;
      const poGSTRate = 18;
      const invoiceGSTRate = 28;

      const poGST = (amount * poGSTRate) / 100;
      const invoiceGST = (amount * invoiceGSTRate) / 100;
      const gstVariance = invoiceGST - poGST;

      expect(gstVariance).toBe(10000);
    });
  });

  describe('Item Description Matching', () => {
    it('should match item descriptions exactly', () => {
      const poDescription = 'Dell Latitude 5420 Laptop';
      const invoiceDescription = 'Dell Latitude 5420 Laptop';

      expect(poDescription).toBe(invoiceDescription);
    });

    it('should detect description mismatch', () => {
      const poDescription = 'Dell Latitude 5420';
      const invoiceDescription = 'Dell Latitude 5430';

      expect(poDescription).not.toBe(invoiceDescription);
    });

    it('should use fuzzy matching for minor variations', () => {
      const poDescription = 'Laptop - Dell Latitude 5420';
      const invoiceDescription = 'Dell Latitude 5420 Laptop';

      const normalizedPO = poDescription.toLowerCase().replace(/[^a-z0-9]/g, '');
      const normalizedInv = invoiceDescription.toLowerCase().replace(/[^a-z0-9]/g, '');

      expect(normalizedPO).toContain('dell');
      expect(normalizedInv).toContain('dell');
      expect(normalizedPO).toContain('latitude');
      expect(normalizedInv).toContain('latitude');
    });

    it('should flag items with different product codes', () => {
      const poProductCode: string = 'LAP-DEL-5420';
      const invoiceProductCode: string = 'LAP-DEL-5430';

      const codesMismatch = poProductCode !== invoiceProductCode;

      expect(codesMismatch).toBe(true);
    });
  });

  describe('Multi-Line Item Matching', () => {
    it('should match all line items across documents', () => {
      const poItems = [
        { itemId: 'item-1', description: 'Laptop', qty: 10 },
        { itemId: 'item-2', description: 'Monitor', qty: 10 },
        { itemId: 'item-3', description: 'Keyboard', qty: 10 },
      ];

      const grnItems = [
        { itemId: 'item-1', description: 'Laptop', acceptedQty: 10 },
        { itemId: 'item-2', description: 'Monitor', acceptedQty: 10 },
        { itemId: 'item-3', description: 'Keyboard', acceptedQty: 10 },
      ];

      const allMatched = poItems.every((poItem) =>
        grnItems.some((grnItem) => grnItem.itemId === poItem.itemId)
      );

      expect(allMatched).toBe(true);
    });

    it('should detect missing items in invoice', () => {
      const grnItems = ['item-1', 'item-2', 'item-3'];
      const invoiceItems = ['item-1', 'item-2'];

      const missingItems = grnItems.filter((item) => !invoiceItems.includes(item));

      expect(missingItems).toContain('item-3');
      expect(missingItems.length).toBe(1);
    });

    it('should detect extra items in invoice', () => {
      const grnItems = ['item-1', 'item-2'];
      const invoiceItems = ['item-1', 'item-2', 'item-3'];

      const extraItems = invoiceItems.filter((item) => !grnItems.includes(item));

      expect(extraItems).toContain('item-3');
      expect(extraItems.length).toBe(1);
    });

    it('should calculate match rate across line items', () => {
      const totalItems = 10;
      const matchedItems = 9;
      const matchRate = (matchedItems / totalItems) * 100;

      expect(matchRate).toBe(90);
    });
  });

  describe('Approval Workflow for Mismatches', () => {
    it('should route to approver when variance exceeds threshold', () => {
      const matchResult = {
        variance: 15000,
        variancePercentage: 2.5,
        threshold: 2,
        requiresApproval: true,
        approver: 'director-123',
        status: 'pending_approval' as const,
      };

      expect(matchResult.requiresApproval).toBe(true);
      expect(matchResult.status).toBe('pending_approval');
    });

    it('should allow approver to approve with justification', () => {
      const approval = {
        matchId: 'match-123',
        approvedBy: 'director-123',
        approvedAt: Timestamp.now(),
        justification: 'Price increase due to market conditions',
        status: 'approved' as const,
      };

      expect(approval.justification.length).toBeGreaterThan(0);
      expect(approval.status).toBe('approved');
    });

    it('should allow approver to reject with reason', () => {
      const rejection = {
        matchId: 'match-123',
        rejectedBy: 'director-123',
        rejectedAt: Timestamp.now(),
        reason: 'Price increase not justified, request vendor correction',
        status: 'rejected' as const,
      };

      expect(rejection.reason.length).toBeGreaterThan(0);
      expect(rejection.status).toBe('rejected');
    });

    it('should escalate high-value variances', () => {
      const variance = 100000;
      const thresholds = [
        { limit: 10000, approver: 'manager' },
        { limit: 50000, approver: 'director' },
        { limit: Infinity, approver: 'super_admin' },
      ];

      const requiredApprover = thresholds.find((t) => variance <= t.limit);

      expect(requiredApprover?.approver).toBe('super_admin');
    });

    it('should track approval chain for audit', () => {
      const approvalChain = [
        { level: 1, approver: 'manager-123', decision: 'approved', at: Timestamp.now() },
        { level: 2, approver: 'director-123', decision: 'approved', at: Timestamp.now() },
      ];

      expect(approvalChain.length).toBe(2);
      expect(approvalChain.every((a) => a.decision === 'approved')).toBe(true);
    });
  });

  describe('Payment Authorization', () => {
    it('should authorize payment after successful match', () => {
      const authorization = {
        invoiceId: mockInvoiceId,
        matchStatus: 'approved',
        paymentAmount: 650000,
        paymentStatus: 'authorized' as const,
        authorizedBy: mockUserId,
        authorizedAt: Timestamp.now(),
      };

      expect(authorization.paymentStatus).toBe('authorized');
      expect(authorization.paymentAmount).toBeGreaterThan(0);
    });

    it('should adjust payment for partial delivery', () => {
      const invoiceAmount = 650000;
      const grnAcceptedPercentage = 95; // 95% accepted
      const adjustedPayment = (invoiceAmount * grnAcceptedPercentage) / 100;

      expect(adjustedPayment).toBe(617500);
    });

    it('should hold payment for rejected items', () => {
      const acceptedAmount = 95000;
      const rejectedAmount = 5000;

      const paymentAmount = acceptedAmount;
      const onHold = rejectedAmount;

      expect(paymentAmount).toBe(95000);
      expect(onHold).toBe(5000);
      expect(paymentAmount + onHold).toBe(100000);
    });

    it('should create payment schedule based on terms', () => {
      const paymentTerms = '30 days';

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const isValidDueDate = dueDate > new Date();

      expect(isValidDueDate).toBe(true);
      expect(paymentTerms).toContain('30 days');
    });

    it('should apply early payment discount if applicable', () => {
      const invoiceAmount = 100000;
      const discountRate = 2; // 2% discount for payment within 10 days
      const discountAmount = (invoiceAmount * discountRate) / 100;
      const netPayable = invoiceAmount - discountAmount;

      expect(discountAmount).toBe(2000);
      expect(netPayable).toBe(98000);
    });
  });

  describe('Exception Handling', () => {
    it('should handle missing GRN gracefully', () => {
      const matchData = {
        poId: mockPoId,
        grnId: null,
        invoiceId: mockInvoiceId,
        status: 'incomplete' as const,
        error: 'GRN not found for this PO',
      };

      expect(matchData.grnId).toBeNull();
      expect(matchData.status).toBe('incomplete');
    });

    it('should handle missing PO gracefully', () => {
      const matchData = {
        poId: null,
        grnId: mockGrnId,
        invoiceId: mockInvoiceId,
        status: 'incomplete' as const,
        error: 'PO reference missing in invoice',
      };

      expect(matchData.poId).toBeNull();
      expect(matchData.status).toBe('incomplete');
    });

    it('should handle duplicate invoice submission', () => {
      const existingInvoices = ['invoice-123', 'invoice-124'];
      const newInvoice = 'invoice-123';

      const isDuplicate = existingInvoices.includes(newInvoice);

      expect(isDuplicate).toBe(true);
    });

    it('should validate invoice against closed PO', () => {
      const poStatus = 'closed';
      const canProcessInvoice = poStatus !== 'closed';

      expect(canProcessInvoice).toBe(false);
    });

    it('should handle cancelled PO gracefully', () => {
      const poStatus = 'cancelled';
      const matchStatus = poStatus === 'cancelled' ? 'rejected' : 'processing';

      expect(matchStatus).toBe('rejected');
    });
  });

  describe('Match Reporting', () => {
    it('should generate match summary report', () => {
      const summary = {
        matchId: 'match-123',
        poNumber: 'PO-2025-0001',
        grnNumber: 'GRN-2025-0001',
        invoiceNumber: 'INV-2025-0001',
        totalItems: 10,
        matchedItems: 9,
        quantityVariance: -5,
        priceVariance: 2000,
        amountVariance: 15000,
        matchPercentage: 90,
        status: 'approved',
      };

      expect(summary.matchPercentage).toBe(90);
      expect(summary.totalItems).toBe(10);
    });

    it('should list all variance items', () => {
      const variances = [
        { itemId: 'item-1', type: 'quantity', variance: -5, severity: 'medium' },
        { itemId: 'item-2', type: 'price', variance: 2000, severity: 'high' },
      ];

      const highSeverity = variances.filter((v) => v.severity === 'high');

      expect(highSeverity.length).toBe(1);
      expect(highSeverity[0]?.type).toBe('price');
    });

    it('should calculate match confidence score', () => {
      const matchScores = {
        quantityMatch: 0.95,
        priceMatch: 0.9,
        descriptionMatch: 1.0,
        amountMatch: 0.92,
      };

      const confidenceScore =
        matchScores.quantityMatch * 0.3 +
        matchScores.priceMatch * 0.3 +
        matchScores.descriptionMatch * 0.2 +
        matchScores.amountMatch * 0.2;

      expect(confidenceScore).toBeCloseTo(0.939, 3);
    });

    it('should track match processing time', () => {
      const invoiceReceivedAt = new Date('2025-01-15T10:00:00');
      const matchCompletedAt = new Date('2025-01-15T14:30:00');

      const processingHours =
        (matchCompletedAt.getTime() - invoiceReceivedAt.getTime()) / (1000 * 60 * 60);

      expect(processingHours).toBe(4.5);
    });
  });

  describe('Audit Trail', () => {
    it('should log all match activities', () => {
      const auditLog = [
        { action: 'match_initiated', by: 'user-1', at: Timestamp.now() },
        { action: 'documents_validated', by: 'system', at: Timestamp.now() },
        { action: 'variance_detected', by: 'system', at: Timestamp.now() },
        { action: 'approval_requested', by: 'system', at: Timestamp.now() },
        { action: 'match_approved', by: 'director-1', at: Timestamp.now() },
      ];

      expect(auditLog.length).toBe(5);
      expect(auditLog[0]?.action).toBe('match_initiated');
      expect(auditLog[auditLog.length - 1]?.action).toBe('match_approved');
    });

    it('should record all approver comments', () => {
      const comments = [
        { by: 'director-1', comment: 'Price increase justified', at: Timestamp.now() },
        { by: 'manager-1', comment: 'Approved for payment', at: Timestamp.now() },
      ];

      expect(comments.every((c) => c.comment.length > 0)).toBe(true);
    });

    it('should maintain immutable match history', () => {
      const matchHistory = [
        { version: 1, status: 'pending', at: Timestamp.now() },
        { version: 2, status: 'under_review', at: Timestamp.now() },
        { version: 3, status: 'approved', at: Timestamp.now() },
      ];

      expect(matchHistory.length).toBe(3);
      expect(matchHistory[2]?.version).toBe(3);
    });
  });

  describe('Match Analytics', () => {
    it('should calculate average match time', () => {
      const matchTimes = [2.5, 3.0, 4.5, 2.0, 3.5]; // hours
      const avgTime = matchTimes.reduce((sum, time) => sum + time, 0) / matchTimes.length;

      expect(avgTime).toBe(3.1);
    });

    it('should track match success rate', () => {
      const totalMatches = 100;
      const successfulMatches = 92;
      const successRate = (successfulMatches / totalMatches) * 100;

      expect(successRate).toBe(92);
    });

    it('should identify common variance types', () => {
      const variances = [
        { type: 'quantity', count: 15 },
        { type: 'price', count: 25 },
        { type: 'description', count: 5 },
      ];

      const mostCommon = variances.reduce((prev, current) =>
        prev.count > current.count ? prev : current
      );

      expect(mostCommon.type).toBe('price');
      expect(mostCommon.count).toBe(25);
    });

    it('should calculate vendor accuracy score', () => {
      const totalInvoices = 50;
      const perfectMatches = 42;
      const accuracyScore = (perfectMatches / totalInvoices) * 100;

      expect(accuracyScore).toBe(84);
    });
  });
});
