/**
 * Tests for vendor suggestion by category (feedback A9uW3WWI).
 */

import {
  matchVendorsByCategory,
  describeMatch,
  type CategoryMatchVendor,
} from './vendorCategoryMatch';

const vendors: CategoryMatchVendor[] = [
  { id: 'v1', name: 'Pump Solutions Pvt Ltd', vendorCategories: ['Bought Out Items'] },
  { id: 'v2', name: 'ABC Steel Suppliers', vendorCategories: ['Raw Materials'] },
  { id: 'v3', name: 'Delta Labs', vendorCategories: ['Lab Testing'] },
  {
    id: 'v4',
    name: 'Generic Traders',
    vendorCategories: ['Bought Out Items'],
    servicesOffered: ['Instruments & Valves'],
  },
  { id: 'v5', name: 'Uncategorised Vendor' },
];

describe('matchVendorsByCategory', () => {
  it('narrows bought-out lines to bought-out vendors', () => {
    const result = matchVendorsByCategory(vendors, [
      { itemType: 'BOUGHT_OUT', description: 'Gear Pump' },
    ]);

    const ids = result.map((r) => r.vendorId);
    expect(ids).toContain('v1');
    expect(ids).toContain('v4');
    expect(ids).not.toContain('v2'); // raw materials
    expect(ids).not.toContain('v3'); // lab testing
  });

  it('ranks a name/services term hit above a bare category hit', () => {
    // "Pump Solutions" matches the term as well as the category, so it leads.
    const result = matchVendorsByCategory(vendors, [
      { itemType: 'BOUGHT_OUT', description: 'Gear Pump for cooling loop' },
    ]);

    expect(result[0]?.vendorId).toBe('v1');
    expect(result[0]?.matchedTerms).toContain('pump');
  });

  it('matches services offered, not just the vendor name', () => {
    const result = matchVendorsByCategory(vendors, [
      { itemType: 'BOUGHT_OUT', description: 'Safety valves 2 inch' },
    ]);

    const v4 = result.find((r) => r.vendorId === 'v4');
    expect(v4?.matchedTerms).toContain('valves');
  });

  it('routes material lines to raw-material vendors', () => {
    const result = matchVendorsByCategory(vendors, [
      { itemType: 'MATERIAL', description: 'SS 316L plate' },
    ]);

    expect(result.map((r) => r.vendorId)).toContain('v2');
  });

  it('offers every service category for a service line', () => {
    const result = matchVendorsByCategory(vendors, [
      { itemType: 'SERVICE', description: 'ASTM D6866 testing' },
    ]);

    expect(result.map((r) => r.vendorId)).toContain('v3');
  });

  it('never suggests inactive or deleted vendors', () => {
    const result = matchVendorsByCategory(
      [
        { id: 'x', name: 'Gone', vendorCategories: ['Bought Out Items'], isDeleted: true },
        { id: 'y', name: 'Dormant', vendorCategories: ['Bought Out Items'], isActive: false },
      ],
      [{ itemType: 'BOUGHT_OUT', description: 'Pump' }]
    );

    expect(result).toHaveLength(0);
  });

  it('returns nothing when the item type is unknown and nothing matches', () => {
    // The caller falls back to the full vendor list rather than showing empty.
    expect(matchVendorsByCategory(vendors, [{ itemType: undefined, description: 'zzzz' }])).toEqual(
      []
    );
  });

  it('ignores generic words so every vendor is not matched', () => {
    const result = matchVendorsByCategory(vendors, [
      { itemType: undefined, description: 'material required for the item' },
    ]);

    expect(result).toHaveLength(0);
  });

  it('explains why a vendor was suggested', () => {
    const [top] = matchVendorsByCategory(vendors, [
      { itemType: 'BOUGHT_OUT', description: 'Gear Pump' },
    ]);

    expect(describeMatch(top!)).toContain('Bought Out Items');
    expect(describeMatch(top!)).toContain('pump');
  });
});
