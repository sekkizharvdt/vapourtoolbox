/**
 * Linkage description + the category→itemType mapping the service relies on.
 *
 * These two pin the field split (docs/reviews/2026-08-10-new-pr-form-plan.md):
 * `raisedFor` decides which id pair on the document is live, and a line's
 * `itemType` is derived from the PR's category rather than asked per row.
 */

import type { PurchaseRequest } from '@vapour/types';
import { catalogKindToItemType } from '@vapour/types';
import { describeLinkage } from './linkage';

function pr(overrides: Partial<PurchaseRequest>): PurchaseRequest {
  return {
    id: 'pr-1',
    number: 'PR/2026/0001',
    raisedFor: 'PROJECT',
    category: 'RAW_MATERIAL',
    isBudgetary: false,
    title: 'Test',
    description: 'Test',
    itemCount: 1,
    isBulkUpload: false,
    status: 'DRAFT',
    submittedBy: 'u1',
    submittedByName: 'User',
    createdAt: null as never,
    updatedAt: null as never,
    createdBy: 'u1',
    updatedBy: 'u1',
    ...overrides,
  };
}

describe('describeLinkage', () => {
  it('reads the project name for a project request', () => {
    expect(
      describeLinkage(pr({ raisedFor: 'PROJECT', projectName: 'SP 40', projectId: 'p1' }))
    ).toBe('SP 40');
  });

  it('reads the proposal number for a proposal request', () => {
    expect(
      describeLinkage(
        pr({ raisedFor: 'PROPOSAL', proposalNumber: 'PROP-2026-0002', proposalId: 'prop1' })
      )
    ).toBe('PROP-2026-0002');
  });

  it('reads the cost centre code for an internal request', () => {
    expect(
      describeLinkage(
        pr({ raisedFor: 'INTERNAL', costCentreCode: 'CC-ADMIN', costCentreId: 'cc1' })
      )
    ).toBe('CC-ADMIN');
  });

  it('ignores a stale pair that does not match raisedFor', () => {
    // A request switched from project to internal keeps no project name; if a
    // stale one survived a bad write, the internal branch must still win.
    expect(
      describeLinkage(
        pr({ raisedFor: 'INTERNAL', projectName: 'SP 40', costCentreCode: 'CC-ADMIN' })
      )
    ).toBe('CC-ADMIN');
  });

  it('falls back to a dash when the expected pair is missing', () => {
    expect(describeLinkage(pr({ raisedFor: 'PROPOSAL' }))).toBe('-');
  });
});

describe('category → itemType', () => {
  it('maps every category onto the persisted line vocabulary', () => {
    // PurchaseRequestCategory is structurally CatalogKind, so the existing
    // converter is the mapping — there is no second helper to drift from.
    expect(catalogKindToItemType('RAW_MATERIAL')).toBe('MATERIAL');
    expect(catalogKindToItemType('BOUGHT_OUT')).toBe('BOUGHT_OUT');
    expect(catalogKindToItemType('SERVICE')).toBe('SERVICE');
  });
});
