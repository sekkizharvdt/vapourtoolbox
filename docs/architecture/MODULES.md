# Modules

## Module Status

| Module      | Status     | Route                  | Key Collections                                       |
| ----------- | ---------- | ---------------------- | ----------------------------------------------------- |
| Procurement | Production | `/procurement/*`       | purchaseRequests, rfqs, purchaseOrders, goodsReceipts |
| Accounting  | Production | `/accounting/*`        | transactions, accounts, bankReconciliations           |
| Projects    | Production | `/projects/*`          | projects, projectCharters                             |
| Materials   | Production | `/materials/*`         | materials, pipes, plates, fittings, flanges           |
| Documents   | Production | `/documents/*`         | documents, companyDocuments, folders                  |
| Proposals   | Production | `/proposals/*`         | proposals, enquiries                                  |
| Estimation  | Production | `/estimation/*`        | boms                                                  |
| HR          | Beta       | `/hr/*`                | hrLeaveRequests, hrTravelExpenses, hrLeaveTypes       |
| Thermal     | Alpha      | `/thermal/*`           | (client-side only)                                    |
| Admin       | Production | `/admin/*`, `/users/*` | users, entities                                       |

## Module Structure

Each module follows this pattern:

```
apps/web/src/
├── app/{module}/           # Pages
│   ├── page.tsx            # List view
│   ├── new/page.tsx        # Create form
│   └── [id]/               # Detail views
│       ├── page.tsx
│       └── *Client.tsx
│
├── lib/{module}/           # Service layer
│   ├── index.ts            # Barrel exports
│   ├── *Service.ts         # CRUD operations
│   ├── *Helpers.ts         # Pure functions
│   └── hooks/              # React Query hooks
│
└── components/{module}/    # Module-specific components
```

## Procurement Module

**Routes**: `/procurement/purchase-requests`, `/procurement/rfqs`, `/procurement/pos`, `/procurement/goods-receipts`, `/procurement/three-way-match`

**Workflow**:

```
Purchase Request → RFQ → Offers → Purchase Order → Goods Receipt → Three-Way Match
```

**Key Files**:

- `lib/procurement/purchaseRequest/`
- `lib/procurement/rfq/`
- `lib/procurement/offer/`
- `lib/procurement/purchaseOrderService.ts`
- `lib/procurement/goodsReceiptService.ts`

## Accounting Module

**Routes**: `/accounting/transactions`, `/accounting/chart-of-accounts`, `/accounting/reconciliation`, `/accounting/reports`

**Features**:

- Multi-currency with daily exchange rates
- Double-entry bookkeeping enforcement
- Bank reconciliation with auto-matching
- GL entry generation from procurement

**Key Files**:

- `lib/accounting/transactionService.ts`
- `lib/accounting/bankReconciliationService.ts`
- `lib/accounting/glEntryGenerator.ts`

## HR Module

**Routes**: `/hr/leaves`, `/hr/travel-expenses`

**Status**: Beta - Active development

**Features**:

- Leave request workflow (Submit → Approve/Reject)
- Travel expense reports with receipts
- Leave balance tracking

**Key Files**:

- `lib/hr/leaves/`
- `lib/hr/travelExpenses/`

## Adding a New Module

1. Create route in `apps/web/src/app/{module}/`
2. Create service layer in `apps/web/src/lib/{module}/`
3. Add Firestore collection in `packages/firebase/src/collections.ts`
4. Add security rules in `firestore.rules`
5. Add types in `packages/types/src/`
6. Register module in `packages/constants/src/modules.ts`
