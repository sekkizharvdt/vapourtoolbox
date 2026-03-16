# Modules

## Module Status

| Module      | Status     | Route                  | Key Collections                                                         | Tests |
| ----------- | ---------- | ---------------------- | ----------------------------------------------------------------------- | ----- |
| Accounting  | Production | `/accounting/*`        | transactions, accounts, bankReconciliations, fixedAssets                | 42    |
| Procurement | Production | `/procurement/*`       | purchaseRequests, rfqs, purchaseOrders, goodsReceipts, packingLists     | 21    |
| Thermal     | Production | `/thermal/*`           | (client-side calculators only)                                          | 27    |
| Projects    | Production | `/projects/*`          | projects, projectCharters, transmittals, masterDocuments                | 6     |
| HR          | Production | `/hr/*`                | hrLeaveRequests, hrTravelExpenses, hrLeaveTypes, hrHolidays             | 7     |
| Documents   | Production | `/documents/*`         | documents, companyDocuments, folders, documentTemplates                 | 6     |
| Admin       | Production | `/admin/*`, `/users/*` | users, entities, auditLogs, emailConfig, backups                        | 6     |
| Proposals   | Production | `/proposals/*`         | proposals, enquiries                                                    | 4     |
| Materials   | Production | `/materials/*`         | materials, pipes, plates, fittings, flanges, pumps, valves, instruments | 3     |
| Flow        | Production | `/flow/*`              | manualTasks, meetingMinutes                                             | 0     |
| Estimation  | Production | `/estimation/*`        | boms                                                                    | -     |

## Module Structure

Each module follows this pattern:

```
apps/web/src/
├── app/{module}/           # Pages
│   ├── page.tsx            # Landing page (ModuleLandingPage with sections)
│   ├── {sub-page}/         # Sub-pages
│   │   ├── page.tsx
│   │   └── new/page.tsx
│   └── [id]/               # Detail views
│       ├── page.tsx         # generateStaticParams + dynamic import
│       └── *Client.tsx      # Client component (usePathname for ID extraction)
│
├── lib/{module}/           # Service layer
│   ├── index.ts            # Barrel exports
│   ├── *Service.ts         # CRUD operations + requirePermission() checks
│   ├── *Helpers.ts         # Pure functions
│   ├── hooks/              # React Query hooks
│   └── __tests__/          # Unit tests
│
└── components/{module}/    # Module-specific components
```

## Accounting Module

**Routes**: `/accounting/transactions`, `/accounting/chart-of-accounts`, `/accounting/reconciliation`, `/accounting/reports`, `/accounting/entity-ledger`, `/accounting/fixed-assets`, `/accounting/payment-planning`, `/accounting/data-health`

**Transaction Types** (9): CUSTOMER_INVOICE, CUSTOMER_PAYMENT, VENDOR_BILL, VENDOR_PAYMENT, JOURNAL_ENTRY, BANK_TRANSFER, EXPENSE_CLAIM, DIRECT_PAYMENT, DIRECT_RECEIPT

**Features**:

- Multi-currency with daily exchange rates and INR base amount
- Double-entry bookkeeping with GL drill-down
- Bank reconciliation with auto-matching
- Fixed asset registry with depreciation engine (SLM/WDV)
- Payment planning with cash flow forecasting
- Entity ledger with opening balance support
- Soft delete + trash page
- TDS rate categories
- GST summary report
- Data Health dashboard
- Tally-style Enter-key navigation (useTallyKeyboard hook)
- Excel/CSV export on all list pages
- Stale payments tracker

**Key Files**: `lib/accounting/transactionService.ts`, `lib/accounting/fixedAssets/`, `lib/accounting/paymentPlanning/`, `lib/accounting/bankReconciliationService.ts`

## Procurement Module

**Routes**: `/procurement/purchase-requests`, `/procurement/rfqs`, `/procurement/pos`, `/procurement/goods-receipts`, `/procurement/three-way-match`, `/procurement/packing-lists`

**Workflow**:

```
Purchase Request → RFQ → Offers → Purchase Order → Goods Receipt → Three-Way Match
                                     ↓
                              Packing Lists, Work Completion Certificates
```

**Features**:

- Full procurement lifecycle with state machines
- RFQ with PO_PROCESSED status tracking
- Offer parsing via Document AI and Claude AI
- Commercial terms comparison
- CSV/PDF export on all list pages
- Send to Accounting workflow (replaces GRN Create Bill)

**Key Files**: `lib/procurement/purchaseRequest/`, `lib/procurement/rfq/`, `lib/procurement/offer/`, `lib/procurement/purchaseOrderService.ts`

## Thermal Module

**Routes**: `/thermal/*` (40+ calculator pages)

**Features**:

- MED/MED-TVC plant design (heat & mass balance, equipment sizing)
- Reference projects with as-built data (Campiche, etc.)
- Heat transfer: heat duty, HTC, heat exchanger sizing, falling film evaporator
- TVC, MVC, desuperheating calculators
- Pump sizing, siphon sizing, suction system designer
- Spray nozzle selection from CAT75HYD catalogue
- Vacuum breaker sizing, LRVP sizing, NCG properties
- Strainer sizing with batch mode
- Steam tables, pipe sizing, chemical dosing
- PDF reports, save/load, batch mode, Excel export for most calculators

**Key Files**: `app/thermal/` (all client-side, no Firestore)

## Flow Module

**Routes**: `/flow/tasks`, `/flow/inbox`, `/flow/team`, `/flow/meetings`

**Features**:

- Task management with list and create dialog
- Inbox with filter chips
- Team Board showing active tasks per member
- Meeting Minutes with two-step creation and batch finalization

**Key Files**: `lib/flow/manualTaskService.ts`, `lib/flow/meetingService.ts`

## HR Module

**Routes**: `/hr/leaves`, `/hr/travel-expenses`, `/hr/on-duty`, `/hr/comp-off`, `/hr/holidays`

**Features**:

- Leave request workflow (Submit → Approve/Reject)
- Travel expense reports with receipt OCR (Document AI)
- Holiday working override with automatic comp-off granting
- On-duty request system
- Leave balance tracking

**Key Files**: `lib/hr/leaves/`, `lib/hr/travelExpenses/`

## Documents Module

**Routes**: `/documents/*`

**Features**:

- Master Document List with state machine, filters, CRUD
- Transmittals with regenerate, delete, flat ZIP download
- Document templates
- Workflow automation and approvals

## Proposals Module

**Routes**: `/proposals/*`

**Features**:

- Tabbed detail page (replaced wizard)
- Bid/no-bid decision workflow
- Unified EPC scope matrix with discipline categories
- BOM linking, pricing, and generation sub-modules
- Cloning, templates, bulk import, BOM cost refresh
- PDF generation in proposal preview

## Admin Module

**Routes**: `/admin/*`, `/users/*`

**Features**:

- User management with permission presets
- Entity (vendor/customer) management
- Email Management hub (per-event recipients, schedule, delivery logs)
- Scheduled backups with manual trigger and history
- Company settings
- Audit logs

## Adding a New Module

1. Create route in `apps/web/src/app/{module}/`
2. Create service layer in `apps/web/src/lib/{module}/`
3. Add Firestore collection in `packages/firebase/src/collections.ts`
4. Add security rules in `firestore.rules`
5. Add types in `packages/types/src/`
6. Register module in `packages/constants/src/modules.ts`
7. Add `requirePermission()` checks to all service write operations
8. Define status transitions in `lib/workflow/stateMachines.ts`
9. Add composite indexes to `firestore.indexes.json` for every `where()` + `orderBy()` combo
