/**
 * Procurement Query Keys
 *
 * Centralized query key factories for procurement-related queries.
 * Follows TanStack Query best practices for query key management.
 *
 * @see https://tanstack.com/query/latest/docs/react/guides/query-keys
 */

export interface ProcurementFilters {
  status?: string;
  projectId?: string;
  vendorId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Purchase Request query keys
 */
export const purchaseRequestKeys = {
  all: ['purchaseRequests'] as const,
  lists: () => [...purchaseRequestKeys.all, 'list'] as const,
  list: (filters?: ProcurementFilters) => [...purchaseRequestKeys.lists(), filters ?? {}] as const,
  details: () => [...purchaseRequestKeys.all, 'detail'] as const,
  detail: (id: string) => [...purchaseRequestKeys.details(), id] as const,
  items: (prId: string) => [...purchaseRequestKeys.all, 'items', prId] as const,
};

/**
 * RFQ (Request for Quotation) query keys
 */
export const rfqKeys = {
  all: ['rfqs'] as const,
  lists: () => [...rfqKeys.all, 'list'] as const,
  list: (filters?: ProcurementFilters) => [...rfqKeys.lists(), filters ?? {}] as const,
  details: () => [...rfqKeys.all, 'detail'] as const,
  detail: (id: string) => [...rfqKeys.details(), id] as const,
  items: (rfqId: string) => [...rfqKeys.all, 'items', rfqId] as const,
  offers: (rfqId: string) => [...rfqKeys.all, 'offers', rfqId] as const,
};

/**
 * Purchase Order query keys
 */
export const purchaseOrderKeys = {
  all: ['purchaseOrders'] as const,
  lists: () => [...purchaseOrderKeys.all, 'list'] as const,
  list: (filters?: ProcurementFilters) => [...purchaseOrderKeys.lists(), filters ?? {}] as const,
  details: () => [...purchaseOrderKeys.all, 'detail'] as const,
  detail: (id: string) => [...purchaseOrderKeys.details(), id] as const,
  items: (poId: string) => [...purchaseOrderKeys.all, 'items', poId] as const,
  receipts: (poId: string) => [...purchaseOrderKeys.all, 'receipts', poId] as const,
};

/**
 * Offer/Quote query keys
 */
export const offerKeys = {
  all: ['offers'] as const,
  lists: () => [...offerKeys.all, 'list'] as const,
  list: (filters?: { rfqId?: string; vendorId?: string }) =>
    [...offerKeys.lists(), filters ?? {}] as const,
  details: () => [...offerKeys.all, 'detail'] as const,
  detail: (id: string) => [...offerKeys.details(), id] as const,
  byRfq: (rfqId: string) => [...offerKeys.all, 'byRfq', rfqId] as const,
  byVendor: (vendorId: string) => [...offerKeys.all, 'byVendor', vendorId] as const,
};

/**
 * Goods Receipt query keys
 */
export const goodsReceiptKeys = {
  all: ['goodsReceipts'] as const,
  lists: () => [...goodsReceiptKeys.all, 'list'] as const,
  list: (filters?: ProcurementFilters) => [...goodsReceiptKeys.lists(), filters ?? {}] as const,
  details: () => [...goodsReceiptKeys.all, 'detail'] as const,
  detail: (id: string) => [...goodsReceiptKeys.details(), id] as const,
  byPO: (poId: string) => [...goodsReceiptKeys.all, 'byPO', poId] as const,
};

/**
 * Three-Way Match query keys
 */
export const threeWayMatchKeys = {
  all: ['threeWayMatch'] as const,
  lists: () => [...threeWayMatchKeys.all, 'list'] as const,
  list: (filters?: { status?: string }) => [...threeWayMatchKeys.lists(), filters ?? {}] as const,
  details: () => [...threeWayMatchKeys.all, 'detail'] as const,
  detail: (id: string) => [...threeWayMatchKeys.details(), id] as const,
  discrepancies: (matchId: string) => [...threeWayMatchKeys.all, 'discrepancies', matchId] as const,
};
