# Vapour Toolbox - User Manuals

Welcome to the Vapour Toolbox user documentation. These manuals provide comprehensive guidance for using each module of the application.

## Table of Contents

| Manual                                                      | Description                                                      |
| ----------------------------------------------------------- | ---------------------------------------------------------------- |
| [01 - Procurement](./01-PROCUREMENT.md)                     | Purchase requests, RFQs, POs, goods receipts, three-way matching |
| [02 - Accounting](./02-ACCOUNTING.md)                       | Chart of accounts, invoices, bills, payments, GST/TDS compliance |
| [03 - Projects & Proposals](./03-PROJECTS-AND-PROPOSALS.md) | Enquiries, proposals, project management, charters               |
| [04 - Materials & BOM](./04-MATERIALS-AND-BOM.md)           | Engineering materials database, bought-out items, estimation     |
| [05 - Documents](./05-DOCUMENTS.md)                         | Master document list, transmittals, document control             |
| [06 - Administration](./06-ADMINISTRATION.md)               | Company settings, entities, users, permissions                   |

## Quick Start Guide

### First Time Setup

1. **Company Settings** - Configure your company profile, tax IDs, and banking details
2. **User Accounts** - Set up users and assign appropriate roles
3. **Entities** - Add your vendors and customers
4. **Projects** - Create your first project

### Common Workflows

#### Procurement Cycle

```
Purchase Request → Engineering Approval → RFQ → Vendor Quotes → PO → Goods Receipt → Three-Way Match → Payment
```

#### Proposal to Project

```
Customer Enquiry → Create Proposal → Internal Approval → Submit to Client → Client Accepts → Create Project
```

#### Document Control

```
Create Document → Assign to Team → Complete Work → Internal Review → Submit to Client → Client Review → Acceptance
```

## Module Overview

### Procurement Module

End-to-end procurement management from purchase requisitions through payment processing. Includes:

- Purchase Requests with approval workflow
- RFQ management and vendor quotation comparison
- Purchase Order creation and tracking
- Goods Receipt and quality verification
- Work Completion Certificates for services
- PO Amendments
- Three-Way Matching for payment control

### Accounting Module

Complete financial management with Indian tax compliance:

- Chart of Accounts (hierarchical)
- Journal Entries (double-entry)
- Customer Invoices and Vendor Bills
- Payments and Receipts
- Bank Reconciliation
- Multi-currency support
- GST (GSTR-1, GSTR-3B) and TDS compliance
- Financial Reports (Balance Sheet, P&L, Cash Flow)

### Projects & Proposals Module

Business development and project execution:

- Customer Enquiry tracking
- Proposal creation with approval workflow
- Project creation from accepted proposals
- Project Charter documentation
- Team management

### Materials & BOM Module

Engineering materials database and estimation:

- Materials Database (Plates, Pipes, Fittings, Flanges)
- Bought-Out Items (Pumps, Valves, Instruments, Electrical)
- Bill of Materials creation
- Cost estimation

### Documents Module

Document management and control:

- Master Document List
- Document workflow (creation through client acceptance)
- Transmittal management
- Client visibility control
- Comment tracking and resolution

### Administration Module

System configuration and user management:

- Company Settings
- Business Entities (Vendors, Customers)
- User Management with approval workflow
- Role-based Permissions
- Task Notifications

## Status Color Legend

Throughout the application, statuses are color-coded:

| Color  | Meaning                            |
| ------ | ---------------------------------- |
| Gray   | Draft, Not Started, Inactive       |
| Blue   | In Progress, Issued, Active        |
| Yellow | Pending, Awaiting Action           |
| Orange | Partial, Under Review              |
| Green  | Approved, Completed, Active        |
| Red    | Rejected, Overdue, Urgent          |
| Purple | Special Status (RFQ Created, etc.) |

## Permission Requirements

Access to modules and features depends on assigned permissions:

| Module      | View Permission     | Create Permission                | Approve Permission     |
| ----------- | ------------------- | -------------------------------- | ---------------------- |
| Procurement | (Basic access)      | CREATE_PR, CREATE_RFQ, CREATE_PO | APPROVE_PR, APPROVE_PO |
| Accounting  | VIEW_REPORTS        | CREATE_TRANSACTIONS              | APPROVE_TRANSACTIONS   |
| Projects    | (Basic access)      | CREATE_PROJECTS                  | ASSIGN_PROJECTS        |
| Proposals   | (Basic access)      | CREATE_ESTIMATES                 | APPROVE_ESTIMATES      |
| Documents   | VIEW\_\*\_DOCUMENTS | MANAGE_MASTER_DOCUMENT_LIST      | APPROVE_DOCUMENTS      |

## Screenshot Placeholders

These manuals contain placeholder markers for screenshots:

```
[Screenshot: Description of the screenshot]
```

To add screenshots:

1. Capture the relevant screen from the application
2. Save with descriptive filename (e.g., `pr-list-page.png`)
3. Replace placeholder with markdown image: `![Description](./images/pr-list-page.png)`
4. Create an `images` folder in `docs/user-manuals/` for screenshots

## Feedback

If you find errors or have suggestions for improving these manuals, please report issues at:
https://github.com/sekkizharvdt/vapourtoolbox/issues

---

_Vapour Toolbox User Documentation_
_Version: 1.0_
_Last Updated: November 2024_
