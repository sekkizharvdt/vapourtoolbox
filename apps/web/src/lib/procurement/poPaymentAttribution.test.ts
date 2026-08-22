import {
  assertSingleMilestoneAttribution,
  MilestoneAttributionError,
  milestoneOptions,
} from './poPaymentAttribution';
import type { PaymentAllocation, PurchaseOrder } from '@vapour/types';

const alloc = (allocatedAmount: number): PaymentAllocation => ({
  invoiceId: 'bill-1',
  invoiceNumber: 'BILL-1',
  originalAmount: 1000,
  allocatedAmount,
  remainingAmount: 1000 - allocatedAmount,
});

describe('assertSingleMilestoneAttribution', () => {
  it('allows a payment allocated to bills with no direct tag', () => {
    expect(() => assertSingleMilestoneAttribution({ billAllocations: [alloc(500)] })).not.toThrow();
  });

  it('allows a direct payment tagged to a milestone with no allocations', () => {
    // The 15 live unallocated advances.
    expect(() =>
      assertSingleMilestoneAttribution({
        billAllocations: [],
        purchaseOrderId: 'po-1',
        milestoneId: 'milestone-1',
      })
    ).not.toThrow();
  });

  it('refuses a payment that is both allocated and tagged', () => {
    expect(() =>
      assertSingleMilestoneAttribution({
        billAllocations: [alloc(500)],
        purchaseOrderId: 'po-1',
        milestoneId: 'milestone-1',
      })
    ).toThrow(MilestoneAttributionError);
  });

  it('ignores zero-value allocations — they settle nothing', () => {
    // The vendor payment dialog keeps a row per outstanding bill, most at 0.
    expect(() =>
      assertSingleMilestoneAttribution({
        billAllocations: [alloc(0)],
        purchaseOrderId: 'po-1',
        milestoneId: 'milestone-1',
      })
    ).not.toThrow();
  });

  it('refuses on a PO tag alone, not just a milestone tag', () => {
    expect(() =>
      assertSingleMilestoneAttribution({
        billAllocations: [alloc(100)],
        purchaseOrderId: 'po-1',
      })
    ).toThrow(MilestoneAttributionError);
  });

  it('does not use isAdvance as the test', () => {
    // VPAY-2627-0067 is isAdvance AND allocated; the flag means "advance
    // against the PO" to users and "unapplied" to the code, so allocations are
    // the only reliable signal.
    expect(() =>
      assertSingleMilestoneAttribution({ billAllocations: [alloc(145800)] })
    ).not.toThrow();
  });
});

describe('milestoneOptions', () => {
  const po: Pick<PurchaseOrder, 'commercialTerms'> = {
    commercialTerms: {
      paymentSchedule: [
        {
          id: 'm1',
          serialNumber: 1,
          paymentType: 'Advance',
          percentage: 20,
          deliverables: '',
          amount: 54000,
        },
        {
          id: 'm2',
          serialNumber: 2,
          paymentType: 'Before Dispatch',
          percentage: 50,
          deliverables: '',
          carriesTax: true,
          amount: 165375,
        },
      ],
    },
  } as unknown as Pick<PurchaseOrder, 'commercialTerms'>;

  it('labels each milestone with its serial, type and percentage', () => {
    const options = milestoneOptions(po);
    expect(options[0]?.label).toBe('1. Advance (20%)');
    expect(options[1]?.label).toBe('2. Before Dispatch (50%)');
  });

  it('carries the priced amount and tax flag through', () => {
    const options = milestoneOptions(po);
    expect(options[1]?.amount).toBe(165375);
    expect(options[1]?.carriesTax).toBe(true);
    expect(options[0]?.carriesTax).toBe(false);
  });

  it('returns nothing for a PO with no structured schedule', () => {
    expect(milestoneOptions({} as Pick<PurchaseOrder, 'commercialTerms'>)).toEqual([]);
  });
});
