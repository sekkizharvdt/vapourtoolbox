# Procurement Module

Core procurement workflow management for the Vapour Toolbox application.

## Overview

The procurement module handles the complete procurement lifecycle:

1. **Purchase Requests (PR)** - Initial request for materials/services
2. **Request for Quotation (RFQ)** - Sending enquiries to vendors
3. **Offers** - Vendor responses and offer evaluation
4. **Purchase Orders (PO)** - Approved orders to vendors
5. **Amendments** - Changes to existing POs
6. **Goods Receipts (GR)** - Recording delivered goods
7. **Packing Lists** - Tracking shipment contents
8. **Work Completion** - Service completion certificates
9. **Three-Way Match** - PO/GR/Invoice reconciliation

## Directory Structure

```
procurement/
├── index.ts                    # Main barrel export
├── accountingIntegration.ts    # GL entry generation for procurement
│
├── amendment/                  # PO amendment workflow
│   ├── crud.ts
│   └── workflow.ts
│
├── offer/                      # Vendor offer management
│   ├── crud.ts
│   ├── evaluation.ts
│   ├── workflow.ts
│   └── hooks/
│
├── purchaseOrder/              # PO management
│   ├── crud.ts
│   └── workflow.ts
│
├── purchaseRequest/            # PR management
│   ├── crud.ts
│   ├── utils.ts
│   └── workflow.ts
│
├── rfq/                        # RFQ management
│   ├── crud.ts
│   └── hooks/
│
├── threeWayMatch/              # 3-way matching
│   └── ...
│
├── *Service.ts                 # CRUD and Firebase operations
└── *Helpers.ts                 # Pure utility functions
```

## Naming Conventions

- **`*Service.ts`** - CRUD operations, Firebase interactions, business logic
- **`*Helpers.ts`** - Pure utility functions (display, formatting, validation)

## Key Services

### Purchase Request Service

```typescript
import { createPurchaseRequest, getPRById, submitPRForApproval } from '@/lib/procurement';
```

### RFQ Service

```typescript
import { createRFQ, issueRFQ, getRFQById } from '@/lib/procurement';
```

### Offer Service

```typescript
import { createOffer, evaluateOffers, selectWinningOffer } from '@/lib/procurement';
```

### Purchase Order Service

```typescript
import { createPOFromOffer, approvePO, issuePO } from '@/lib/procurement';
```

## Workflow States

### Purchase Request

`DRAFT` → `PENDING_APPROVAL` → `APPROVED` / `REJECTED`

### RFQ

`DRAFT` → `ISSUED` → `OFFERS_RECEIVED` → `UNDER_EVALUATION` → `COMPLETED` / `CANCELLED`

### Purchase Order

`DRAFT` → `PENDING_APPROVAL` → `APPROVED` → `ISSUED` → `PARTIALLY_RECEIVED` → `COMPLETED` / `CANCELLED`

### Goods Receipt

`DRAFT` → `SUBMITTED` → `APPROVED` / `REJECTED`

## Document Numbering

All documents follow the format: `TYPE/YYYY/MM/XXXX`

- PR: `PR/2025/01/0001`
- RFQ: `RFQ/2025/01/0001`
- PO: `PO/2025/01/0001`
- GR: `GR/2025/01/0001`

## Testing

Each service has corresponding test files:

- Unit tests: `*Service.test.ts`, `*Helpers.test.ts`
- Integration tests: `__integration__/`

```bash
pnpm --filter @vapour/web test src/lib/procurement
```

## Related Modules

- `@/lib/accounting` - GL entries and financial integration
- `@/lib/documents` - Document attachments
- `@/lib/entities` - Vendor management
