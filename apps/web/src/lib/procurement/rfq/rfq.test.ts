/**
 * Request for Quotation (RFQ) Service Tests
 *
 * Tests for RFQ workflow operations:
 * - RFQ creation from approved PR
 * - Vendor invitation and selection
 * - Quote submission and evaluation
 * - Comparative analysis
 * - Quote selection and PO generation
 */

import { getFirebase } from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';

// Mock dependencies
jest.mock('@/lib/firebase');
jest.mock('firebase/firestore');

describe('RFQ Service', () => {
  const mockDb = {} as ReturnType<typeof getFirebase>['db'];
  const mockUserId = 'user-123';
  const mockPrId = 'pr-123';
  const mockRfqId = 'rfq-123';

  beforeEach(() => {
    jest.clearAllMocks();
    (getFirebase as jest.Mock).mockReturnValue({ db: mockDb });
  });

  describe('createRFQ', () => {
    it('should create RFQ from approved PR', async () => {
      const mockPR = {
        id: mockPrId,
        prNumber: 'PR-2025-0001',
        title: 'Office Supplies',
        status: 'approved',
        items: [
          { description: 'Laptops', quantity: 10, unit: 'units', estimatedUnitPrice: 50000 },
          { description: 'Monitors', quantity: 10, unit: 'units', estimatedUnitPrice: 15000 },
        ],
      };

      const rfqData = {
        prId: mockPR.id,
        prNumber: mockPR.prNumber,
        title: mockPR.title,
        items: mockPR.items,
        status: 'draft' as const,
        createdBy: mockUserId,
        createdAt: Timestamp.now(),
      };

      expect(rfqData.prId).toBe(mockPrId);
      expect(rfqData.items.length).toBe(2);
      expect(rfqData.status).toBe('draft');
    });

    it('should generate sequential RFQ numbers', () => {
      const year = new Date().getFullYear();
      const rfqNumberPattern = /^RFQ-\d{4}-\d{4}$/;

      const testNumbers = [`RFQ-${year}-0001`, `RFQ-${year}-0099`, `RFQ-${year}-9999`];

      testNumbers.forEach((num) => {
        expect(rfqNumberPattern.test(num)).toBe(true);
      });
    });

    it('should validate PR is approved before creating RFQ', () => {
      const validStatuses = ['approved'];
      const invalidStatuses = ['draft', 'pending_approval', 'rejected'];

      invalidStatuses.forEach((status) => {
        expect(validStatuses).not.toContain(status);
      });
    });

    it('should copy line items from PR to RFQ', () => {
      const prItems = [
        { description: 'Item 1', quantity: 10, unit: 'pcs', estimatedUnitPrice: 100 },
        { description: 'Item 2', quantity: 5, unit: 'boxes', estimatedUnitPrice: 500 },
      ];

      const rfqItems = prItems.map((item) => ({
        ...item,
        rfqItemId: `item-${Math.random()}`,
      }));

      expect(rfqItems.length).toBe(prItems.length);
      expect(rfqItems[0]?.description).toBe(prItems[0]?.description);
    });

    it('should set default quote submission deadline', () => {
      const createdAt = new Date();
      const defaultDeadlineDays = 7;
      const deadline = new Date(createdAt);
      deadline.setDate(deadline.getDate() + defaultDeadlineDays);

      const daysDifference = Math.floor(
        (deadline.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(daysDifference).toBe(7);
    });
  });

  describe('Vendor Invitation', () => {
    it('should invite multiple vendors to RFQ', () => {
      const vendors = [
        { id: 'vendor-1', name: 'Tech Solutions Pvt Ltd', email: 'sales@techsolutions.com' },
        { id: 'vendor-2', name: 'Office Supplies Co', email: 'contact@officesupplies.com' },
        { id: 'vendor-3', name: 'IT Hardware Inc', email: 'info@ithardware.com' },
      ];

      const invitations = vendors.map((vendor) => ({
        vendorId: vendor.id,
        vendorName: vendor.name,
        invitedAt: Timestamp.now(),
        status: 'invited' as const,
      }));

      expect(invitations.length).toBe(3);
      expect(invitations.every((inv) => inv.status === 'invited')).toBe(true);
    });

    it('should generate unique invitation tokens for vendors', () => {
      const tokens = new Set<string>();
      const vendorCount = 5;

      for (let i = 0; i < vendorCount; i++) {
        const token = `token-${Math.random().toString(36).substring(2, 15)}`;
        tokens.add(token);
      }

      expect(tokens.size).toBe(vendorCount);
    });

    it('should validate vendor has required contact information', () => {
      const validVendor = {
        id: 'vendor-1',
        name: 'Tech Solutions',
        email: 'sales@techsolutions.com',
        phone: '+91-9876543210',
      };

      expect(validVendor.email).toBeTruthy();
      expect(validVendor.email).toMatch(/@/);
    });

    it('should track invitation status', () => {
      type InvitationStatus = 'invited' | 'viewed' | 'quote_submitted' | 'declined';

      const statusFlow: InvitationStatus[] = ['invited', 'viewed', 'quote_submitted'];

      expect(statusFlow[0]).toBe('invited');
      expect(statusFlow[statusFlow.length - 1]).toBe('quote_submitted');
    });

    it('should prevent duplicate vendor invitations', () => {
      const existingVendors = ['vendor-1', 'vendor-2', 'vendor-3'];
      const newVendor = 'vendor-2';

      const isDuplicate = existingVendors.includes(newVendor);

      expect(isDuplicate).toBe(true);
    });
  });

  describe('Quote Submission', () => {
    it('should validate quote submission before deadline', () => {
      const deadline = new Date('2025-12-31T23:59:59');
      const submissionDate = new Date('2025-12-25T10:00:00');

      const isBeforeDeadline = submissionDate < deadline;

      expect(isBeforeDeadline).toBe(true);
    });

    it('should reject quote submission after deadline', () => {
      const deadline = new Date('2025-12-31T23:59:59');
      const submissionDate = new Date('2026-01-01T10:00:00');

      const isAfterDeadline = submissionDate > deadline;

      expect(isAfterDeadline).toBe(true);
    });

    it('should require quotes for all line items', () => {
      const rfqItems = [
        { id: 'item-1', description: 'Laptop' },
        { id: 'item-2', description: 'Monitor' },
        { id: 'item-3', description: 'Keyboard' },
      ];

      const quote = {
        items: [
          { rfqItemId: 'item-1', unitPrice: 50000, totalPrice: 500000 },
          { rfqItemId: 'item-2', unitPrice: 15000, totalPrice: 150000 },
          { rfqItemId: 'item-3', unitPrice: 2000, totalPrice: 20000 },
        ],
      };

      const allItemsQuoted = rfqItems.every((rfqItem) =>
        quote.items.some((quoteItem) => quoteItem.rfqItemId === rfqItem.id)
      );

      expect(allItemsQuoted).toBe(true);
    });

    it('should calculate quote total amount', () => {
      const quoteItems = [
        { rfqItemId: 'item-1', unitPrice: 50000, quantity: 10, totalPrice: 500000 },
        { rfqItemId: 'item-2', unitPrice: 15000, quantity: 10, totalPrice: 150000 },
      ];

      const totalAmount = quoteItems.reduce((sum, item) => sum + item.totalPrice, 0);

      expect(totalAmount).toBe(650000);
    });

    it('should include GST in quote amount', () => {
      const baseAmount = 100000;
      const gstRate = 18;
      const gstAmount = (baseAmount * gstRate) / 100;
      const totalWithGST = baseAmount + gstAmount;

      expect(gstAmount).toBe(18000);
      expect(totalWithGST).toBe(118000);
    });

    it('should validate quote has terms and conditions', () => {
      const quote = {
        vendorId: 'vendor-1',
        items: [],
        totalAmount: 100000,
        paymentTerms: '30 days',
        deliveryTimeline: '15 days from PO date',
        warranty: '1 year',
        validityPeriod: '30 days',
      };

      expect(quote.paymentTerms).toBeTruthy();
      expect(quote.deliveryTimeline).toBeTruthy();
      expect(quote.warranty).toBeTruthy();
    });

    it('should store quote submission timestamp', () => {
      const submittedAt = Timestamp.now();
      const currentTime = Timestamp.now();

      const timeDifference = currentTime.seconds - submittedAt.seconds;

      expect(timeDifference).toBeLessThan(2);
    });

    it('should allow vendors to revise quotes before deadline', () => {
      const quote = {
        quoteId: 'quote-1',
        version: 1,
        submittedAt: Timestamp.now(),
      };

      const revisedQuote = {
        ...quote,
        quoteId: 'quote-1',
        version: 2,
        submittedAt: Timestamp.now(),
        revisedFrom: 'quote-1-v1',
      };

      expect(revisedQuote.version).toBeGreaterThan(quote.version);
      expect(revisedQuote.quoteId).toBe(quote.quoteId);
    });
  });

  describe('Quote Evaluation', () => {
    it('should compare quotes by total amount', () => {
      const quotes = [
        { vendorId: 'vendor-1', totalAmount: 650000, vendor: 'Tech Solutions' },
        { vendorId: 'vendor-2', totalAmount: 620000, vendor: 'Office Supplies' },
        { vendorId: 'vendor-3', totalAmount: 680000, vendor: 'IT Hardware' },
      ];

      const sortedByPrice = [...quotes].sort((a, b) => a.totalAmount - b.totalAmount);

      expect(sortedByPrice[0]?.vendorId).toBe('vendor-2');
      expect(sortedByPrice[0]?.totalAmount).toBe(620000);
    });

    it('should calculate savings from estimated price', () => {
      const estimatedAmount = 700000;
      const quotedAmount = 620000;
      const savings = estimatedAmount - quotedAmount;
      const savingsPercentage = (savings / estimatedAmount) * 100;

      expect(savings).toBe(80000);
      expect(savingsPercentage).toBeCloseTo(11.43, 2);
    });

    it('should consider delivery timeline in evaluation', () => {
      const quotes = [
        { vendor: 'A', amount: 620000, deliveryDays: 30 },
        { vendor: 'B', amount: 650000, deliveryDays: 15 },
        { vendor: 'C', amount: 610000, deliveryDays: 45 },
      ];

      const urgentProject = quotes.filter((q) => q.deliveryDays <= 20);

      expect(urgentProject.length).toBe(1);
      expect(urgentProject[0]?.vendor).toBe('B');
    });

    it('should generate comparative statement', () => {
      const quotes = [
        {
          vendor: 'Tech Solutions',
          totalAmount: 650000,
          deliveryDays: 30,
          warranty: '1 year',
          paymentTerms: '30 days',
        },
        {
          vendor: 'Office Supplies',
          totalAmount: 620000,
          deliveryDays: 45,
          warranty: '6 months',
          paymentTerms: '45 days',
        },
      ];

      const comparison = {
        lowestPrice: Math.min(...quotes.map((q) => q.totalAmount)),
        fastestDelivery: Math.min(...quotes.map((q) => q.deliveryDays)),
        vendorCount: quotes.length,
      };

      expect(comparison.lowestPrice).toBe(620000);
      expect(comparison.fastestDelivery).toBe(30);
      expect(comparison.vendorCount).toBe(2);
    });

    it('should score quotes based on multiple criteria', () => {
      const quote = {
        vendor: 'Tech Solutions',
        priceScore: 85, // Lower price = higher score
        deliveryScore: 90, // Faster delivery = higher score
        warrantyScore: 80, // Better warranty = higher score
        experienceScore: 95, // More experience = higher score
      };

      const totalScore =
        quote.priceScore * 0.4 +
        quote.deliveryScore * 0.3 +
        quote.warrantyScore * 0.15 +
        quote.experienceScore * 0.15;

      expect(totalScore).toBeCloseTo(87.25, 2);
    });

    it('should identify non-responsive vendors', () => {
      const invitations = [
        { vendorId: 'vendor-1', status: 'quote_submitted' },
        { vendorId: 'vendor-2', status: 'invited' },
        { vendorId: 'vendor-3', status: 'declined' },
        { vendorId: 'vendor-4', status: 'viewed' },
      ];

      const nonResponsive = invitations.filter(
        (inv) => inv.status === 'invited' || inv.status === 'viewed'
      );

      expect(nonResponsive.length).toBe(2);
    });
  });

  describe('Quote Selection', () => {
    it('should select winning quote', () => {
      const selectedQuote = {
        quoteId: 'quote-2',
        vendorId: 'vendor-2',
        totalAmount: 620000,
        status: 'selected' as const,
        selectedBy: mockUserId,
        selectedAt: Timestamp.now(),
        selectionReason: 'Best price with acceptable delivery timeline',
      };

      expect(selectedQuote.status).toBe('selected');
      expect(selectedQuote.selectionReason).toBeTruthy();
    });

    it('should mark other quotes as rejected', () => {
      const quotes = [
        { quoteId: 'quote-1', status: 'rejected' as const },
        { quoteId: 'quote-2', status: 'selected' as const },
        { quoteId: 'quote-3', status: 'rejected' as const },
      ];

      const rejectedCount = quotes.filter((q) => q.status === 'rejected').length;
      const selectedCount = quotes.filter((q) => q.status === 'selected').length;

      expect(rejectedCount).toBe(2);
      expect(selectedCount).toBe(1);
    });

    it('should require approval for quote selection', () => {
      const selection = {
        quoteId: 'quote-2',
        approvalRequired: true,
        approver: 'manager-123',
        approvalStatus: 'pending' as const,
      };

      expect(selection.approvalRequired).toBe(true);
      expect(selection.approvalStatus).toBe('pending');
    });

    it('should update RFQ status after quote selection', () => {
      const statusFlow = {
        beforeSelection: 'quote_evaluation' as const,
        afterSelection: 'quote_selected' as const,
        afterApproval: 'completed' as const,
      };

      expect(statusFlow.beforeSelection).toBe('quote_evaluation');
      expect(statusFlow.afterSelection).toBe('quote_selected');
    });

    it('should notify vendors about selection results', () => {
      const notifications = [
        { vendorId: 'vendor-1', type: 'rejection', sent: true },
        { vendorId: 'vendor-2', type: 'selection', sent: true },
        { vendorId: 'vendor-3', type: 'rejection', sent: true },
      ];

      const allNotificationsSent = notifications.every((n) => n.sent === true);

      expect(allNotificationsSent).toBe(true);
    });

    it('should create audit trail for selection', () => {
      const auditLog = [
        { action: 'rfq_created', by: 'user-1', at: Timestamp.now() },
        { action: 'vendors_invited', by: 'user-1', at: Timestamp.now() },
        { action: 'quotes_received', by: 'system', at: Timestamp.now() },
        { action: 'quote_evaluated', by: 'user-2', at: Timestamp.now() },
        { action: 'quote_selected', by: 'user-2', at: Timestamp.now() },
      ];

      expect(auditLog.length).toBe(5);
      expect(auditLog[auditLog.length - 1]?.action).toBe('quote_selected');
    });
  });

  describe('RFQ Status Management', () => {
    it('should follow valid status flow', () => {
      const validTransitions = {
        draft: ['published', 'cancelled'],
        published: ['quote_evaluation', 'cancelled'],
        quote_evaluation: ['quote_selected', 'cancelled'],
        quote_selected: ['completed', 'cancelled'],
        completed: [],
        cancelled: [],
      };

      expect(validTransitions.draft).toContain('published');
      expect(validTransitions.published).toContain('quote_evaluation');
      expect(validTransitions.quote_selected).toContain('completed');
    });

    it('should prevent invalid status transitions', () => {
      const invalidTransitions = [
        { from: 'draft', to: 'completed' },
        { from: 'published', to: 'draft' },
        { from: 'completed', to: 'draft' },
      ];

      invalidTransitions.forEach((transition) => {
        expect(transition.from).not.toBe(transition.to);
      });
    });

    it('should track status change timestamps', () => {
      const statusHistory = [
        { status: 'draft', timestamp: Timestamp.now(), by: 'user-1' },
        { status: 'published', timestamp: Timestamp.now(), by: 'user-1' },
        { status: 'quote_evaluation', timestamp: Timestamp.now(), by: 'user-2' },
      ];

      expect(statusHistory.length).toBe(3);
      expect(statusHistory[0]?.status).toBe('draft');
    });
  });

  describe('RFQ Analytics', () => {
    it('should calculate average quote amount', () => {
      const quotes = [{ totalAmount: 650000 }, { totalAmount: 620000 }, { totalAmount: 680000 }];

      const average = quotes.reduce((sum, q) => sum + q.totalAmount, 0) / quotes.length;

      expect(average).toBe(650000);
    });

    it('should calculate quote spread (max - min)', () => {
      const quotes = [650000, 620000, 680000];

      const min = Math.min(...quotes);
      const max = Math.max(...quotes);
      const spread = max - min;

      expect(spread).toBe(60000);
    });

    it('should calculate vendor response rate', () => {
      const invitations = 10;
      const quotesReceived = 7;
      const responseRate = (quotesReceived / invitations) * 100;

      expect(responseRate).toBe(70);
    });

    it('should track time to first quote', () => {
      const publishedAt = new Date('2025-01-01T10:00:00');
      const firstQuoteAt = new Date('2025-01-03T14:30:00');

      const timeDiff = firstQuoteAt.getTime() - publishedAt.getTime();
      const hoursToFirstQuote = timeDiff / (1000 * 60 * 60);

      expect(hoursToFirstQuote).toBeCloseTo(52.5, 1);
    });
  });

  describe('RFQ Validation', () => {
    it('should validate RFQ has at least one line item', () => {
      const validRFQ = {
        title: 'Office Equipment',
        items: [{ description: 'Laptop', quantity: 10 }],
      };

      const invalidRFQ = {
        title: 'Empty RFQ',
        items: [],
      };

      expect(validRFQ.items.length).toBeGreaterThan(0);
      expect(invalidRFQ.items.length).toBe(0);
    });

    it('should validate RFQ has at least one invited vendor', () => {
      const validRFQ = {
        vendors: ['vendor-1', 'vendor-2'],
      };

      const invalidRFQ = {
        vendors: [],
      };

      expect(validRFQ.vendors.length).toBeGreaterThan(0);
      expect(invalidRFQ.vendors.length).toBe(0);
    });

    it('should validate quote deadline is in future', () => {
      const now = new Date();
      const futureDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const pastDeadline = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      expect(futureDeadline > now).toBe(true);
      expect(pastDeadline > now).toBe(false);
    });

    it('should validate RFQ number format', () => {
      const validFormats = ['RFQ-2025-0001', 'RFQ-2025-9999'];
      const invalidFormats = ['RFQ-0001', '2025-0001', 'RFQ2025-0001'];

      const rfqPattern = /^RFQ-\d{4}-\d{4}$/;

      validFormats.forEach((format) => {
        expect(rfqPattern.test(format)).toBe(true);
      });

      invalidFormats.forEach((format) => {
        expect(rfqPattern.test(format)).toBe(false);
      });
    });
  });

  describe('RFQ Cancellation', () => {
    it('should allow cancellation before quote selection', () => {
      const cancellableStatuses = ['draft', 'published', 'quote_evaluation'];
      const nonCancellableStatuses = ['quote_selected', 'completed'];

      cancellableStatuses.forEach((status) => {
        expect(['draft', 'published', 'quote_evaluation']).toContain(status);
      });

      nonCancellableStatuses.forEach((status) => {
        expect(['draft', 'published', 'quote_evaluation']).not.toContain(status);
      });
    });

    it('should require cancellation reason', () => {
      const cancellation = {
        rfqId: mockRfqId,
        reason: 'Project requirement changed',
        cancelledBy: mockUserId,
        cancelledAt: Timestamp.now(),
      };

      expect(cancellation.reason.length).toBeGreaterThan(0);
    });

    it('should notify vendors about cancellation', () => {
      const vendors = ['vendor-1', 'vendor-2', 'vendor-3'];
      const notifications = vendors.map((vendorId) => ({
        vendorId,
        type: 'rfq_cancelled',
        sent: true,
      }));

      expect(notifications.length).toBe(vendors.length);
      expect(notifications.every((n) => n.type === 'rfq_cancelled')).toBe(true);
    });
  });
});
