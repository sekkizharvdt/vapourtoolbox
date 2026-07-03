# Vapour Toolbox — Module Map

Orientation file for AI coding sessions. Read via `/orient` instead of re-exploring the repo.
Keep this file current: when you add/move a module, service, or route, update the relevant line.

Last verified: 2026-07-03

## Monorepo layout

- `apps/web` — Next.js app (static export, `output: 'export'`)
- `packages/*` — shared workspace packages (pnpm)
- `functions/` — Cloud Functions (SEPARATE npm lockfile, not pnpm)
- `firestore.rules`, `firestore.indexes.json`, `storage.rules` — repo root
- `scripts/audit/` — CLAUDE.md rule-audit scripts run by the pre-commit hook

## Packages

| Package                            | Purpose                     | Key files                                                                                                                                                       |
| ---------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@vapour/constants`                | Shared enums/constants      | `src/permissions.ts` (PERMISSION_FLAGS, hasPermission), `src/labels.ts`, `src/fields.ts` (cross-boundary field names), `src/statuses.ts`, `src/transactions.ts` |
| `@vapour/types`                    | Domain types                | `src/accounting.ts`, `src/transaction.ts`, `src/procurement/`, `src/proposal.ts`, `src/bom.ts`, `src/entity.ts`                                                 |
| `@vapour/firebase`                 | Firebase wrappers           | `src/collections.ts` (canonical COLLECTIONS name map — always use, never string literals), `src/client.ts`, `src/admin.ts`                                      |
| `@vapour/validation`               | Zod schemas, sanitization   | `src/schemas/`, `src/sanitize.ts`                                                                                                                               |
| `@vapour/functions`                | Shared cloud-function logic | `src/accounting.ts`, `src/entities.ts`, `src/projects.ts`                                                                                                       |
| `@vapour/ui`                       | Shared React UI kit         | `src/components`, `src/layouts`, `src/theme`                                                                                                                    |
| `@vapour/utils` / `@vapour/logger` | logger, generic utils       | `logger.ts`                                                                                                                                                     |
| `@vapour/agent-tools`              | Agent tool framework        | `src/defineTool.ts`, `src/executeTool.ts`                                                                                                                       |

## Web modules (`apps/web/src/lib/`)

| Module                                                        | What it does                                                             | Main services                                                                                                                                                               | Collections                                                                                                      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `accounting`                                                  | Double-entry GL engine                                                   | `transactionService.ts`, `paymentBatchService.ts`, `fiscalYearService.ts`, `fixedAssetService.ts`, `recurringTransactionService.ts`, `gstCalculator.ts`, `tdsCalculator.ts` | transactions, accounts, accountingPeriods, fiscalYears, costCentres, fixedAssets, counters                       |
| `procurement`                                                 | PR→RFQ→PO→GR→3-way-match                                                 | `purchaseOrderService.ts`, `purchaseOrder/workflow.ts`, `goodsReceiptService.ts`, `threeWayMatchService.ts`, `amendment/crud.ts`, `generateProcurementNumber.ts`            | purchaseOrders, purchaseRequests, rfqs, goodsReceipts, packingLists, threeWayMatches, workCompletionCertificates |
| `vendorQuotes`                                                | Vendor quote intake/comparison                                           | `vendorQuoteService.ts`, `vendorQuoteWorkflow.ts`                                                                                                                           | vendorQuotes, offerComparisons                                                                                   |
| `proposals`                                                   | Proposal drafting → project conversion                                   | `proposalService.ts`, `approvalWorkflow.ts`, `projectConversion.ts`, `pricingBlocks.ts`, `proposalPDF.ts`                                                                   | proposals, enquiries                                                                                             |
| `projects`                                                    | Charter/budget/doc requirements                                          | `projectService.ts`, `budgetCalculationService.ts`, `charterValidationService.ts`                                                                                           | projects, project_milestones                                                                                     |
| `documents`                                                   | Engineering doc control                                                  | `masterDocumentService.ts`, `transmittalService.ts`, `submissionService.ts`, `crsService.ts`                                                                                | masterDocuments, transmittals, documentSubmissions (project subcollections)                                      |
| `bom` / `boughtOut` / `materials`                             | BOM calc; bought-out catalog; material master                            | `bomService.ts`, `bomCalculations.ts`; `boughtOutService.ts`; `materialService.ts`, `pricing.ts`, `stock.ts`                                                                | boms; components; materials, materialPrices, stockMovements                                                      |
| `entities`                                                    | Counterparty (vendor/customer) master                                    | `businessEntityService.ts`                                                                                                                                                  | entities, entity_contacts                                                                                        |
| `thermal`                                                     | Desal engineering calculators (pure compute)                             | `medDesigner.ts`, `heatExchangerSizing.ts`, `fallingFilmCalculator.ts`, many `*Calculator.ts`                                                                               | savedCalculations                                                                                                |
| `ssot`                                                        | P&ID single-source-of-truth                                              | `lineService.ts`, `streamService.ts`, `equipmentService.ts`                                                                                                                 | lines, streams, equipment, instruments, valves                                                                   |
| `hr`                                                          | Employees/leaves/holidays/travel                                         | `employees/`, `leaves/`, `onDuty/`, `travelExpenses/`                                                                                                                       | users, hrLeaveRequests, hrHolidays, hrTravelExpenses                                                             |
| `tasks`                                                       | Tasks/threads/meetings/mentions                                          | `manualTaskService.ts`, `threadService.ts`, `meetingService.ts`                                                                                                             | tasks, taskThreads, taskNotifications, meetings                                                                  |
| `workflow`                                                    | Shared state machines                                                    | `stateMachines.ts` (ALL state machines live here — rule 8/17)                                                                                                               | —                                                                                                                |
| `auth`                                                        | Authorization guards                                                     | `authorizationService.ts` (`requirePermission`, `preventSelfApproval`, `requireApprover`)                                                                                   | —                                                                                                                |
| `audit`                                                       | Audit logging                                                            | `clientAuditService.ts` (`logAuditEvent`), barrel `index.ts`                                                                                                                | auditLogs                                                                                                        |
| `agent`                                                       | AI agent runtime/HITL                                                    | `agentRunService.ts`, `toolRuntime.ts`, `hitl.ts`                                                                                                                           | agentRuns, agentTasks, agentMemory                                                                               |
| `enquiry` / `services` / `companyDocuments` / `notifications` | Enquiry intake; service-rate catalog; company docs; in-app notifications | `enquiryService.ts`; `services/crud.ts`; `companyDocumentService.ts`; `notificationService.ts`                                                                              | enquiries; services; companyDocuments; notifications                                                             |

## Routes (`apps/web/src/app/`)

- `/accounting` — transactions, journal-entries, bills, invoices, payments, payment-batches, chart-of-accounts, reports, data-health, trash
- `/procurement` — pos, rfqs, quotes, purchase-requests, goods-receipts, packing-lists, amendments, three-way-match, work-completion
- `/proposals`, `/projects`, `/documents`, `/estimation` (BOM editor), `/bought-out`, `/materials`, `/ssot`, `/services`
- `/thermal` — `(protected)/` calculators
- `/hr` — employees, leaves, holidays, on-duty, travel-expenses
- `/flow` — inbox, meetings, tasks, team
- `/admin` — activity, agent-runs, audit-logs, users, feedback, settings; `/super-admin`; `/dashboard`; `/entities`; `/feedback`

## Cloud Functions (`functions/src/`)

- `accountBalances.ts` — `onTransactionWrite` (GL balance increments), `recalculateAccountBalances`
- `procurementProjectSync.ts`, `procurementPaymentStatus.ts`, `projectFinancials.ts` — status/financial roll-up sync
- `denormalizationSync.ts` — keeps denormalized names in sync
- `vendorQuoteCounters.ts`, `bom.ts`, `projects.ts`, `charterApproval.ts`, `documentRequirements.ts`
- Parsing (Document AI): `offerParsing/`, `enquiryParsing/`, `receiptParsing/`, `documentParsing/`
- `email/` (triggers + scheduled overdue check), `backup/scheduledBackup.ts`, `hr/leaveBalanceReset.ts`, `agentTaskExpiry.ts`
- Callables: `entities/createEntity`, `transmittals.getTransmittalDownloadUrl`, `aiHelp`

## Canonical exemplars (copy these patterns)

| Pattern                                                         | File                                                                        |
| --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Dialog with edit-mode prop sync (`useEffect` on `[open, item]`) | `apps/web/src/components/projects/EditProjectDialog.tsx`                    |
| Service with `requirePermission` + `runTransaction`             | `apps/web/src/lib/accounting/transactionService.ts`                         |
| State machines                                                  | `apps/web/src/lib/workflow/stateMachines.ts`                                |
| Pathname-based `[id]` extraction (rule 30, static export)       | `apps/web/src/app/estimation/[id]/BOMEditorClient.tsx`                      |
| URL-state sync without navigation (rule 30b)                    | `apps/web/src/app/thermal/(protected)/flash-chamber/FlashChamberClient.tsx` |
| List page with filters + pagination                             | `apps/web/src/app/accounting/transactions/page.tsx`                         |
| Shared formatters (currency/date)                               | `apps/web/src/lib/utils/formatters.ts`                                      |
| Audit logging                                                   | `apps/web/src/lib/audit/clientAuditService.ts` (`logAuditEvent`)            |
| Collection name constants                                       | `packages/firebase/src/collections.ts` (`COLLECTIONS`)                      |
