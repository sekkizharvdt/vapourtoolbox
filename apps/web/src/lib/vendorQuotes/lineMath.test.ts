import { computeQuoteLineAmounts } from './lineMath';

describe('computeQuoteLineAmounts', () => {
  it('no discount → amount = qty × unitPrice (backward compatible)', () => {
    const r = computeQuoteLineAmounts({ quantity: 3, unitPrice: 100 });
    expect(r.gross).toBe(300);
    expect(r.discountAmount).toBe(0);
    expect(r.amount).toBe(300);
    expect(r.gstAmount).toBeUndefined();
    expect(r.total).toBe(300);
  });

  it('percentage discount applies before GST', () => {
    const r = computeQuoteLineAmounts({
      quantity: 2,
      unitPrice: 100,
      gstRate: 18,
      discountType: 'PERCENT',
      discountValue: 10,
    });
    expect(r.gross).toBe(200);
    expect(r.discountAmount).toBe(20); // 10% of 200
    expect(r.amount).toBe(180); // 200 - 20
    expect(r.gstAmount).toBe(32.4); // 18% of 180
    expect(r.total).toBe(212.4);
  });

  it('absolute discount applies before GST', () => {
    const r = computeQuoteLineAmounts({
      quantity: 1,
      unitPrice: 1000,
      gstRate: 18,
      discountType: 'ABSOLUTE',
      discountValue: 250,
    });
    expect(r.discountAmount).toBe(250);
    expect(r.amount).toBe(750);
    expect(r.gstAmount).toBe(135); // 18% of 750
    expect(r.total).toBe(885);
  });

  it('defaults to PERCENT when type omitted', () => {
    const r = computeQuoteLineAmounts({ quantity: 1, unitPrice: 100, discountValue: 25 });
    expect(r.discountAmount).toBe(25);
    expect(r.amount).toBe(75);
  });

  it('clamps an over-entered absolute discount to the line value', () => {
    const r = computeQuoteLineAmounts({
      quantity: 1,
      unitPrice: 100,
      discountType: 'ABSOLUTE',
      discountValue: 500,
    });
    expect(r.discountAmount).toBe(100); // not 500
    expect(r.amount).toBe(0); // never negative
  });

  it('rounds discount and GST to paisa at each step', () => {
    const r = computeQuoteLineAmounts({
      quantity: 1,
      unitPrice: 99.99,
      gstRate: 18,
      discountType: 'PERCENT',
      discountValue: 7.5,
    });
    expect(r.discountAmount).toBe(7.5); // 7.5% of 99.99 = 7.49925 → 7.50
    expect(r.amount).toBe(92.49); // 99.99 - 7.50
    expect(r.gstAmount).toBe(16.65); // 18% of 92.49 = 16.6482 → 16.65
    expect(r.total).toBe(109.14);
  });

  it('ignores zero / negative discount values', () => {
    expect(computeQuoteLineAmounts({ quantity: 1, unitPrice: 100, discountValue: 0 }).amount).toBe(
      100
    );
    expect(computeQuoteLineAmounts({ quantity: 1, unitPrice: 100, discountValue: -5 }).amount).toBe(
      100
    );
  });
});
