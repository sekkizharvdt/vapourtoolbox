# Documents, Estimation/BOM, Materials & Catalogs — User Workflows

> Generated 2026-07-03 from code inspection (routes, services, state machines, Cloud Functions). Part of the [module workflow docs](README.md).

## 1. Overview & how the sub-modules connect

The engineering-data area of Vapour Toolbox is five loosely-coupled catalogs/registers that feed each other:

| Sub-module                                                                     | Primary route(s)                                                                                                                                                                | Core service(s)   | Firestore location                                                                                                                                                 |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Document control (master documents, revisions, submissions, transmittals, CRS) | `/projects/[id]/documents` (register + transmittals + templates tabs); `/documents/[id]` (single master-document detail); `/documents` (generic `DocumentRecord` file registry) | `lib/documents/*` | `projects/{projectId}/masterDocuments`, `…/documentSubmissions`, `…/transmittals`, `…/commentResolutionSheets`, `…/documentNumberingConfig`, top-level `documents` |
| Estimation / BOM                                                               | `/estimation`, `/estimation/new`, `/estimation/[id]` (editor)                                                                                                                   | `lib/bom/*`       | `boms`, `boms/{id}/items`                                                                                                                                          |
| Materials master                                                               | `/materials/**`                                                                                                                                                                 | `lib/materials/*` | `materials`, `materialPrices`, `stockMovements`                                                                                                                    |
| Bought-out catalog                                                             | `/bought-out/**`                                                                                                                                                                | `lib/boughtOut/*` | bought-out items collection (see `specCode.ts` `BOUGHT_OUT_COLLECTION`)                                                                                            |
| Services rate catalog                                                          | `/services`, `/services/catalog`, `/services/new`, `/services/[id]`                                                                                                             | `lib/services/*`  | `services`                                                                                                                                                         |

**Connective tissue (all grounded in code):**

- **Project document requirements → master documents → submissions → transmittals.** A project's `documentRequirements[]` array is auto-linked to uploaded files by the Cloud Function `onDocumentUploaded` (`functions/src/documentRequirements.ts`). Separately, engineering deliverables are tracked as `masterDocuments` under a project; each gets file **submissions** (revisions); batches of submitted documents are packaged into **transmittals**; the client returns feedback as a **CRS**.
- **Materials & bought-out items → BOMs → estimation.** BOM items reference either a `materialId`+`shapeId` (fabricated `SHAPE`) or a `materialId` (`BOUGHT_OUT`). `lib/bom/bomCalculations.ts` reads `materials/{id}.currentPrice` and the shape calculator to compute weight/cost. Services from the services catalog attach to BOM items and are costed by `lib/services/serviceCalculations.ts`.
- **Procurement → materials pricing (reverse feed).** `recordProcurementPrices()` (`lib/materials/pricing.ts`) writes vendor-quote/PO prices back into `materialPrices`, keeping BOM cost inputs current.
- **BOM → proposal/enquiry (traceability only).** A BOM stores `proposalId`/`enquiryId` (see `createBOM` in `lib/bom/bomService.ts`); `/estimation/new` pre-fills these from query params.

> ⚠ **Known gap — BOM → purchase-request handoff.** No code links BOMs or BOM items to purchase requests. Grep of `lib/procurement`, `app/procurement`, `lib/bom`, and `app/estimation` for `bomId`/`fromBOM`/`sourceBOM`/`createPurchaseRequest` finds nothing. BOMs only carry proposal/enquiry linkage. Treat any "push BOM items to a PR" flow as unimplemented.

---

## 2. Step-by-step "How to…" guides

### 2.1 Document control

All engineering-document workflows are reached from **`/projects/[id]/documents`** (`DocumentsPageClient.tsx` → tabs: _Master Document List_, _Transmittals_, _Templates_). The single-document detail screen is **`/documents/[id]?projectId=…`** (`app/documents/[id]/DocumentDetailClient.tsx`, tabs: Overview / Revisions / Comments / Supply List / Work List / Document Links).

#### How to register a master document

1. Open the project's **Master Document List** tab (`app/projects/[id]/documents/components/MasterDocumentListTab.tsx`).
2. (First time) Click **Setup numbering** → `NumberingSetupDialog` → `initializeProjectNumbering` / `initializeWithStandardDisciplines` (`lib/documents/documentNumberingService.ts`). This creates `projects/{id}/documentNumberingConfig/config` with `separator:'-'`, `sequenceDigits:3`, and per-discipline counters. Standard disciplines (`STANDARD_DISCIPLINE_CODES`, codes `00`–`10`) can be seeded.
3. Click **New Document** → `CreateDocumentDialog` → `createMasterDocument(data)` (`lib/documents/masterDocumentService.ts`). Document numbers are allocated via `generateDocumentNumber(projectId, projectCode, disciplineCode, subCode?)` — a Firestore transaction increments the discipline (or `discipline-subcode`) counter and formats `PROJECT-DISCIPLINE-[SUBCODE-]NNN` (e.g. `PRJ-001-01-005` or `PRJ-001-01-A-001`).
4. Bulk alternative: **Import register** → `DocumentRegisterUploadDialog` → `bulkCreateMasterDocuments()` (batched writes of 500; each row initialized `status:'DRAFT'`, `currentRevision:'R0'`). Duplicate numbers are pre-checked with `checkDuplicateDocumentNumbers()`.

New master documents start at `status: DRAFT`, `currentRevision: 'R0'`, `visibility: 'INTERNAL_ONLY'`, with empty predecessors/successors/inputFiles and zeroed comment/submission counters.

#### How to add a revision / record a submission

1. Open the master document (`/documents/[id]`) → **Revisions** tab (`app/documents/components/DocumentRevisions.tsx`, `SubmitRevisionDialog.tsx`).
2. Choose the revision label, attach one or more files (marking one **primary**, `SubmissionFileType` = PDF/NATIVE/etc.), set client visibility, optionally pick a reviewer.
3. Submit → `submitDocument(db, storage, request)` (`lib/documents/submissionService.ts`), which:
   - Uploads each file to `projects/{projectId}/documents/{docNumber}/{revision}/{fileType}/{ts}_{name}` (with `FileUploadTracker` rollback on failure).
   - Creates a `DocumentRecord` in top-level `documents` for the primary file (`module:'PROJECTS'`, `status:'ACTIVE'`).
   - Allocates the next `submissionNumber` via `getNextSubmissionNumber()` and creates a `documentSubmissions` doc (`clientStatus:'PENDING'`, `crtGenerated:false`, `files[]`).
   - Updates the master document: `currentRevision`, `submissionCount`, `lastSubmissionId/Date`, and **sets `status:'SUBMITTED'`**.
   - If a reviewer was chosen, fires a `DOCUMENT_INTERNAL_REVIEW` task notification (failures are swallowed).

`submitDocumentLegacy()` wraps a single file into the multi-file request for backward compatibility.

#### How to create and issue a transmittal (and download zip/PDF)

1. Project **Transmittals** tab (`app/projects/[id]/documents/components/TransmittalsTab.tsx`) → **Generate Transmittal** → `GenerateTransmittalDialog` (steps: `DocumentSelectionStep` → `TransmittalDetailsStep` → `PreviewStep`).
2. Select documents, set client/recipient, subject, purpose of issue, delivery method, cover notes.
3. Create → `createTransmittal(db, data)` (`lib/documents/transmittalService.ts`). The transmittal number `TR-NNN` is allocated **atomically** via a `runTransaction` against `counters/transmittal-{projectId}` (seeded once from `getMaxTransmittalSequence()` for legacy data). New transmittals are `status:'DRAFT'`.
4. **Generate files (client path, the one wired in the UI):** `GenerateTransmittalDialog`/`TransmittalsList` call `generateTransmittalPdf()` (`transmittalPdfService.ts`, `@react-pdf/renderer` cover sheet) and `downloadTransmittalZip()` (`transmittalZipService.ts`, JSZip). The ZIP filters member files by delivery method (`HARD_COPY`=PDFs, `SOFT_COPY`=native CAD/office extensions, `BOTH`=all) and includes the cover sheet. Then `updateTransmittalStatus(…, 'GENERATED')`.
5. `updateTransmittalFiles()` (when persisting server-generated URLs) also calls `markTransmittalDocumentsAsSubmitted()` — every included master document whose state machine allows it is transitioned to `SUBMITTED` (batched).
6. **Download later:** `TransmittalsList.tsx` (`handleDownloadPdf`/`handleDownloadZip`) calls the callable **`getTransmittalDownloadUrl`** (`functions/src/transmittals.ts`), which returns a 1-hour signed URL. Security: the callable rejects anything not matching `^projects/{p}/transmittals/{t}/*.(pdf|zip)$` and blocks `..` traversal.
7. **Acknowledge:** `acknowledgeTransmittal()` sets `status:'ACKNOWLEDGED'` + acknowledger/notes.

> ⚠ **Known gap — server-side `generateTransmittal` cloud function.** `functions/src/transmittals.ts` (`gatherDocumentFiles`) reads a `submissions` subcollection and `latestSubmission.documentFileUrl` / `crtFileUrl`. Actual submissions live in `documentSubmissions` with a `files[]` array (no `documentFileUrl`). So the server ZIP path would gather no document files. The working path is the **client-side** generation described above; the server function's ZIP body is effectively cover-sheet-only. Also `transmittalZipService.ts` has a `TODO` that it only handles a single `documentFileUrl` per document (no native+PDF pairs).

#### How to run a CRS (Comment Resolution Sheet)

1. On the master document → **Comments** tab (`DocumentComments.tsx`, `comments/UploadCRSDialog.tsx`, `comments/CRSList.tsx`).
2. Upload the client's CRS file → `uploadCommentResolutionSheet(db, request)` (`lib/documents/crsService.ts`): validates ≤50 MB, uploads to `projects/{p}/documents/{docId}/crs/{ts}_{name}`, creates a `commentResolutionSheets` doc (`status:'PENDING'`, `commentsExtracted:0`), and **auto-transitions the master document to `UNDER_REVIEW`** if the state machine allows (failure is logged, non-fatal).
3. Extract/enter comments; when done, `completeCRS()` sets `status:'COMPLETED'` with `commentsExtracted`, `processedBy/At`, notes. `updateCRSStatus()` handles intermediate states. Related comment services: `commentService.ts`, `commentResolutionService.ts`; export helpers `exportCRT.ts` / `exportMDL.ts`.

---

### 2.2 Estimation / BOM editor

#### How to create a BOM

1. `/estimation` (`app/estimation/page.tsx`) lists BOMs for the tenant (`listBOMs`). Click **New BOM** → `/estimation/new`.
2. Fill name, description, category (`BOMCategory` enum: Heat Exchanger, Pressure Vessel, …), project. Proposal/enquiry/scope context is auto-captured from query params and shown in a banner.
3. Submit → `createBOM(db, input, userId)` (`lib/bom/bomService.ts`). BOM code `EST-YYYY-NNNN` is allocated via a `runTransaction` on `counters/bom-{year}` (UUID fallback on counter failure). New BOMs are `status:'DRAFT'`, `version:1`, with a zeroed `summary` (currency INR). Redirects to the editor.

#### How to edit a BOM (add items) and compute costs

The editor is `/estimation/[id]` (`BOMEditorClient.tsx`; note `page.tsx` is `rule28-exempt` — view and edit are the same screen).

1. **Add Item** → `AddBOMItemDialog` → `addBOMItem(db, bomId, input, userId)`. Item numbers are hierarchical (`generateItemNumber`: root `1,2,3…`; children `1.1,1.2…`, computed from sibling `sortOrder`). An item's `component.type` is `SHAPE` (fabricated) or `BOUGHT_OUT`. `addBOMItem` calls `recalculateBOMSummary` after write.
2. **Calculate Costs** → `calculateAllItemCosts(db, bomId, items, userId)` (`lib/bom/bomCalculations.ts`), which per item:
   - **BOUGHT_OUT** → `calculateBoughtOutItemCost`: weight from `material.weightPerMeter_kg` (baseUnit meter) or `weightPerPiece_kg`; material cost = `material.currentPrice.pricePerUnit` × qty; **no fabrication cost**.
   - **SHAPE** → `calculateItemCost`: fetches the `shapes/{id}` + `materials/{id}`, runs `calculateShape()` for weight, material cost, and fabrication cost.
   - Both then compute **service costs** via `calculateAllServiceCosts(item.services, …)`.
   - Writes `calculatedProperties` + `cost` back to the item.
3. **Generate PDF** → `GeneratePDFDialog`.

#### Key calculations

- **Per-item service costs** (`serviceCalculations.ts`) — methods: `PERCENTAGE_OF_MATERIAL`, `PERCENTAGE_OF_TOTAL` (material+fabrication), `FIXED_AMOUNT`, `PER_UNIT`, `CUSTOM_FORMULA` (safe recursive-descent parser; variables `materialCost`, `fabricationCost`, `quantity`, `total`; functions `min/max/abs/round/ceil/floor`; no `new Function`). Per-service rate can be overridden per item (`rateOverride`).
- **BOM summary** (`recalculateBOMSummary`) — sums item weights and material/fabrication/service costs → `totalDirectCost`. Then applies the tenant's active cost configuration (`getActiveCostConfiguration`, `lib/bom/costConfig.ts`) **sequentially**:
  1. Overhead = base × `overhead.ratePercent` (base per `applicableTo`: MATERIAL/FABRICATION/SERVICE/ALL).
  2. Contingency = (direct + overhead) × `contingency.ratePercent`.
  3. Profit = (direct + overhead + contingency) × `profit.ratePercent`.
  - `totalCost` = subtotal + profit. Rates validated 0–100 and results validated finite/non-negative (BP-12). With no cost config, `totalCost = totalDirectCost`.
- **Server aggregation:** Cloud Function `onBOMItemWrite` (`functions/src/bom.ts`) fires on any `boms/{bomId}/items/{itemId}` write and applies **delta `FieldValue.increment`** to `boms/{bomId}.summary` (weight, material/fabrication/service/direct/total cost, item count). This runs in addition to the client-side `recalculateBOMSummary`; note it does not re-derive overhead/contingency/profit (it increments the base totals only).

#### Push BOM items to purchase requests

> ⚠ **Known gap** — no implementation exists (see §1). There is no button, service, or Cloud Function that converts a BOM/BOM item into a purchase request. (The project charter's procurement items are the actual path into PRs — see the [proposals & projects doc](enquiries-proposals-projects.md).)

---

### 2.3 Materials master

#### How to add a material

`/materials/new` → `createMaterial(db, data, userId, {auditContext?})` (`lib/materials/crud.ts`).

- Material code auto-generated when not supplied: mapped categories (plates/pipes/flanges/fittings) → `{form}-{material}-{grade}` (e.g. `PL-SS-304`); unmapped categories → `{prefix}-{grade}`. On collision, flat-doc categories suffix `-001/-002…`; variant-model categories (plates) **throw** (add a thickness variant instead — see `variantUtils.ts`).
- Defaults: `priceHistory:[]`, `isActive:true`, `trackInventory:false`. `MATERIAL_CREATED` audit event logged when an audit context is passed. `updateMaterial`/`deleteMaterial` (soft delete `isActive:false`) log `MATERIAL_UPDATED`/`MATERIAL_DELETED`.
- Category-specific list pages exist under `/materials/{pipes,plates,flanges,fittings,valves,pumps,…}` and `/materials/needs-review`.

#### How to add a material price

`addMaterialPrice(db, price, userId, tenantId)` (`lib/materials/pricing.ts`) writes to `materialPrices` (with required `tenantId` for rules). `isActive`/`isForecast` are derived from `effectiveDate` vs now. If the new price is active **and newer** than the material's existing `currentPrice.effectiveDate`, it updates `materials/{id}.currentPrice` + `lastPriceUpdate`. `getMaterialPriceHistory` / `getCurrentPrice` read back. Procurement writes prices here automatically via `recordProcurementPrices()` (budgetary=forecast from quotes, confirmed=from POs; fire-and-forget, never blocks procurement).

#### How to record a stock movement

`updateMaterialStock(db, materialId, movement, userId)` (`lib/materials/stock.ts`). Requires `material.trackInventory === true` (else throws). Movement types `INCREASE_PURCHASE`, `INCREASE_PRODUCTION`, `ADJUSTMENT` **add** `abs(qty)`; all others **subtract**. Negative stock is rejected. Writes a `stockMovements` record and updates `materials/{id}.currentStock`. History via `getStockMovementHistory` (newest first).

---

### 2.4 Bought-out items catalog

`/bought-out`, `/bought-out/new`, `/bought-out/[id]` (`BoughtOutDetailClient.tsx`, `components/SpecificationForm.tsx`).

- **Add:** `createBoughtOutItem(db, input, userId)` (`lib/boughtOut/boughtOutService.ts`). Item code `BO-YYYY-NNNN` (`generateBoughtOutItemCode`, query-max, ⚠ not transactional — potential race under concurrency). A deterministic **spec code** is built when the structured spec is complete: `VALVE`→`buildValveSpecCode`, `PUMP`→`buildPumpSpecCode`, `INSTRUMENT`→`nextInstrumentSpecCode` (`specCode.ts`); other categories get none. `needsReview` flags AI-parser-created rows.
- **Dedup / AI parity:** `findOrCreateBoughtOutBySpec()` matches an existing item by `specCode` before creating — the same find-or-create scheme the AI quote parser uses, so manual and parsed entries don't duplicate.
- **Edit:** `updateBoughtOutItem()` recomputes `specCode` when category/specs change; pricing rebuilt field-by-field to avoid `undefined`.
- **Delete:** `deleteBoughtOutItem()` soft-deletes (`isActive:false`) and **enforces `PERMISSION_FLAGS.EDIT_ENTITIES`** via `requirePermission` (the one place in these modules with a hard client-side gate).
- **List/review:** `listBoughtOutItems` (tenant-scoped; `needsReviewOnly` filtered client-side); pricing helpers in `pricing.ts`.

---

### 2.5 Services rate catalog

`/services`, `/services/catalog`, `/services/new`, `/services/[id]`, `/services/[id]/edit`.

- **Add:** `createService(db, data, userId, tenantId)` (`lib/services/crud.ts`). Rejects duplicate `serviceCode`; auto-generates `SVC-{PREFIX}-{NNN}` where prefix maps from `ServiceCategory` (ENGINEERING→ENG, FABRICATION→FAB, INSPECTION→INS, TESTING→TST, TRANSPORTATION→TRN, ERECTION→ERC, COMMISSIONING→COM, CONSULTING→CON, CALIBRATION→CAL, MAINTENANCE→MNT, TRAINING→TRG, OTHER→OTH). Defaults `isActive:true`. Requires `tenantId` for rules.
  - ⚠ Minor: the sequence is `count(category)+1`, so codes can collide after a soft-delete/restore; not counter-backed.
- **Edit/list/soft-delete/restore:** `updateService`, `listServices` (active-only unless `includeInactive`, ordered by name), `deleteService` (`isActive:false`), `restoreService`.
- Each service defines a `calculationMethod` + rate consumed by BOM item costing (see §2.2 key calculations, `serviceCalculations.ts`); applicability is validated by `canApplyServiceToItem` (category/itemType/componentType filters).

---

## 3. Status / lifecycle tables

### Master document (`masterDocumentStateMachine`, `lib/workflow/stateMachines.ts`)

| From         | Allowed to                      |
| ------------ | ------------------------------- |
| DRAFT        | IN_PROGRESS, ON_HOLD, CANCELLED |
| IN_PROGRESS  | SUBMITTED, ON_HOLD, CANCELLED   |
| SUBMITTED    | UNDER_REVIEW, IN_PROGRESS       |
| UNDER_REVIEW | APPROVED, IN_PROGRESS, ON_HOLD  |
| APPROVED     | ACCEPTED, UNDER_REVIEW          |
| ACCEPTED     | — (terminal)                    |
| ON_HOLD      | DRAFT, IN_PROGRESS, CANCELLED   |
| CANCELLED    | — (terminal)                    |

Gated transitions: `UNDER_REVIEW→APPROVED` and `APPROVED→ACCEPTED` require `MANAGE_DOCUMENTS`. `updateDocumentStatus()` validates every transition via `requireValidTransition`, stamps `actualStartDate` on first IN_PROGRESS and `actualCompletionDate` on ACCEPTED. Auto-transitions: CRS upload → `UNDER_REVIEW`; transmittal file generation → included docs → `SUBMITTED` (only when the machine permits).

### Transmittal status (`DocumentTransmittal.status`; no formal state machine)

| Status       | Meaning / trigger                                                           |
| ------------ | --------------------------------------------------------------------------- |
| DRAFT        | `createTransmittal`                                                         |
| GENERATED    | after PDF/ZIP produced (`updateTransmittalStatus`/`updateTransmittalFiles`) |
| SENT         | `updateTransmittalStatus('SENT')` (stamps `sentAt`)                         |
| ACKNOWLEDGED | `acknowledgeTransmittal`                                                    |

### CRS status (`CommentResolutionSheet.status`)

PENDING → (processing) → COMPLETED, via `updateCRSStatus` / `completeCRS`. Upload sets PENDING.

### BOM status (`BOMStatus`, `packages/types/src/bom.ts`)

`DRAFT | UNDER_REVIEW | APPROVED | RELEASED | ARCHIVED`. Created as DRAFT. UI colors in `BOMEditorClient.tsx`. Delete is only enabled while `status === 'DRAFT'` (`app/estimation/page.tsx`). ⚠ No state-machine enforces BOM transitions and there is no UI action that advances status beyond DRAFT (no submit/approve button in the editor) — the later statuses are effectively unused.

### Materials / bought-out / services

Boolean lifecycle only: `isActive` (soft delete). Material prices carry `isActive`/`isForecast` derived from `effectiveDate`.

---

## 4. Automatic behaviours & permissions

**Automatic numbering / counters**

- Master document numbers: transactional per-discipline (and per sub-code) counters in `documentNumberingConfig/config` (`generateDocumentNumber`).
- Transmittal `TR-NNN`: transactional `counters/transmittal-{projectId}` (`createTransmittal`).
- BOM `EST-YYYY-NNNN`: transactional `counters/bom-{year}` with UUID fallback (`generateBOMCode`).
- BOM item numbers: hierarchical from sibling `sortOrder` (`generateItemNumber`).
- Submission numbers: `max+1` per master document (`getNextSubmissionNumber`, not counter-backed).
- Material codes: derived `{form}-{material}-{grade}` with collision suffixing; bought-out `BO-YYYY-NNNN` (query-max, ⚠ racy); service `SVC-{PREFIX}-{NNN}` (⚠ count-based).

**Cloud Function triggers / side effects**

- `onDocumentUploaded` (`documentRequirements.ts`): on `documents/{id}` create, transactionally links the file to the first matching `NOT_SUBMITTED` project `documentRequirement` (category match) and sets it `SUBMITTED`.
- `onBOMItemWrite` (`bom.ts`): delta-increments `boms/{id}.summary` on every item create/update/delete.
- `generateTransmittal` / `getTransmittalDownloadUrl` (`transmittals.ts`): server PDF+ZIP to Storage (⚠ document-file gathering path is stale — see §2.1) and 1-hour signed download URLs with strict path allow-listing.
- Submission side effects: creates a `DocumentRecord`, updates master doc revision/counters/status, optional reviewer task notification, with storage-file rollback on failure.

**Permissions (per action).** With the exception of bought-out delete, these modules **defer authorization to `firestore.rules`** — the services carry `rule5-exempt` comments stating client-side `requirePermission` is intentionally omitted (static-export build can't make client gates load-bearing). Permission flags in play:

| Action                                      | Enforced by                    | Flag                                                |
| ------------------------------------------- | ------------------------------ | --------------------------------------------------- |
| Master doc APPROVE / ACCEPT transitions     | state machine + rules          | `MANAGE_DOCUMENTS`                                  |
| Master doc create/update, transmittals, CRS | firestore.rules                | doc VIEW/MANAGE + project scope (per code comments) |
| BOM create/update/item writes               | firestore.rules                | `MANAGE_ESTIMATION`                                 |
| Material / material-price / stock writes    | firestore.rules                | material collection permission (rule5-exempt)       |
| Bought-out create/update                    | firestore.rules                | `MANAGE_ENTITIES` / `MANAGE_PROCUREMENT`            |
| **Bought-out delete**                       | **client `requirePermission`** | **`EDIT_ENTITIES`**                                 |
| Service create/update/delete                | firestore.rules                | services collection permission                      |
| Transmittal download callable               | Cloud Function                 | authenticated + path allow-list                     |

Client-side gating that does exist is coarse UI-only: `MasterDocumentListTab` uses `hasManageAccess` to show/hide setup+create buttons; `app/documents/page.tsx` computes `isAdmin` from `MANAGE_USERS`; the estimation list only enables **Delete** for DRAFT BOMs.
