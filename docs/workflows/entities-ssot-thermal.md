# Entities, SSOT & Thermal Calculators — User Workflows

> Generated 2026-07-03 from code inspection (routes, services, Cloud Functions). Part of the [module workflow docs](README.md).

This document describes the end-user workflows for three modules of the Vapour Toolbox app. It is grounded in the route and service code cited by repo-relative path. Physics/equation internals are intentionally out of scope; the focus is what each screen does and the click-path a user follows.

---

## 1. Entities (Counterparty Master)

**Purpose.** A single master of business counterparties — vendors, customers, partners, suppliers — with contacts, addresses, tax IDs, bank details, credit terms and opening balances. Other modules (procurement POs, accounting transactions, projects) reference an entity by ID and denormalize its name/email/GSTIN.

**Where it lives**

- Route/list page: `apps/web/src/app/entities/page.tsx`
- Route gate: `apps/web/src/app/entities/layout.tsx` (requires `canViewEntities`)
- Dialogs: `apps/web/src/components/entities/{CreateEntityDialog,EditEntityDialog,ViewEntityDialog,ArchiveEntityDialog,UnarchiveEntityDialog,ContactsManager,BankDetailsManager}.tsx`
- Read/query service: `apps/web/src/lib/entities/businessEntityService.ts`
- Create Cloud Function: `functions/src/entities/createEntity.ts`
- Rename/side-effect sync: `functions/src/denormalizationSync.ts`

### Overview of the list screen

`entities/page.tsx` shows stat cards (Total, Active, Archived, Vendors, Customers), a filter bar (search; Status active/archived/all; Role Vendor/Customer/Partner/Supplier; Vendor Category; Vendor Sub-Category which only appears when category = "Bought Out Items"), and a paginated, sortable table. Rows show name, role chips, contact person, billing state, opening balance (coloured by DR/CR), and status. Data is loaded live via `useFirestoreQuery`; when a Role filter is set the query uses a server-side `array-contains` on `roles`, otherwise all entities ordered by `createdAt desc`. Soft-deleted (`isDeleted === true`) rows are filtered client-side.

### Permissions per action (entities)

| Action                       | Gate (from `@vapour/constants`)                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| View module / list           | `canViewEntities` (layout + page guard)                                                   |
| Create entity ("New Entity") | `canCreateEntities`                                                                       |
| Edit entity                  | `canCreateEntities` **and** entity not archived                                           |
| Archive entity               | `canCreateEntities` **and** entity not archived                                           |
| Unarchive entity             | `canCreateEntities` **and** entity archived                                               |
| View Ledger action           | `canViewAccounting`                                                                       |
| Create (server enforcement)  | `CREATE_ENTITIES_BIT` via `requirePermission` in the callable (`createEntity.ts` line 33) |

Note: The list uses `EDIT`/archive gating tied to `hasCreatePermission` (there is no separate "edit entities" bit in the UI). Server-side, only `createEntity` is a callable; **edits are written directly to Firestore from the client** (`EditEntityDialog` uses `updateDoc`, line 416), so edit authorization relies on Firestore security rules rather than a callable.

### How to create a vendor or customer

1. Click **New Entity** (visible only with `canCreateEntities`). Opens `CreateEntityDialog`.
2. **Basic Information** — enter Entity Name (required), optional Legal Name, and select one or more **Entity Roles** (`VENDOR`, `CUSTOMER`, `PARTNER` — from the `ENTITY_ROLES` list in `CreateEntityDialog.tsx` line 49). Roles are multi-select chips.
3. **Contact Persons** — at least one contact is required (validated at `handleCreate`, line 131). Managed by `ContactsManager` (see "manage contacts" below). The primary contact's name/email/phone are copied to the top-level `contactPerson`/`email`/`phone` fields for backward compatibility.
4. **Address & Tax** — optional billing address (uses `StateSelector` for Indian states), PAN and GSTIN. PAN/GSTIN are validated live via `validatePAN`/`validateGSTIN` from `@vapour/validation`; invalid values block submit.
5. **Shipping Address** — optional; "Same as billing" checkbox copies billing.
6. **Bank Details** — optional, one or more via `BankDetailsManager`.
7. **Credit Terms & Opening Balance** — optional credit days, credit limit (INR); opening balance amount plus a DR/CR toggle (default CR). Helper text: "DR = They owe us (advance given) | CR = We owe them (advance received)".
8. **Vendor Categorization** — this section only renders when `VENDOR` is among the selected roles (line 703). Pick Vendor Categories (Raw Materials, Bought Out Items, Fabrication, Lab Testing, etc.), free-text Services Offered (comma-separated), and — only if "Bought Out Items" is chosen — a Bought Out Sub-Category.
9. Click **Create Entity**. The dialog first runs a **client-side duplicate check** (`checkEntityDuplicates` on email + PAN/GSTIN) and, if clean, calls the `createEntity` Cloud Function.

**Server behaviour on create (`createEntity.ts`):**

- Requires auth + `CREATE_ENTITIES_BIT`; enforces a write rate limit.
- Sanitizes name (trim, collapse whitespace, 200-char cap) and computes `nameNormalized` (lowercase) for case-insensitive search/dedupe.
- Rejects duplicates: same `nameNormalized`, same GSTIN, or same PAN among non-deleted entities → `already-exists` error.
- Generates a sequential human code `ENT-001`, `ENT-002`… via a transaction on `counters/entities`.
- Writes the doc with `isActive`, `isDeleted:false`, audit fields, and writes an `ENTITY_CREATED` audit log.

⚠ **Known gap:** The Create dialog exposes only `VENDOR/CUSTOMER/PARTNER`, but the list's Role filter also offers `SUPPLIER` (`entities/page.tsx` line 342). A `SUPPLIER` filter will never match entities created through this dialog.

⚠ **Known gap:** Duplicate name/GSTIN/PAN are enforced server-side, but the dialog's pre-check only looks at email + PAN + GSTIN, not name — a duplicate _name_ is only caught after the callable runs (surfaced as an error).

### How to manage contacts (`ContactsManager.tsx`)

Contacts are edited inline within the Create/Edit dialogs (not persisted independently):

1. Click **Add Contact**, fill Name (required), Designation, Email, Phone, Mobile, Notes, then **Add Contact**.
2. The **first** contact added is automatically flagged `isPrimary` (line 85).
3. Use the star icon on any non-primary contact to **Set as Primary** (exclusive — only one primary).
4. Edit (pencil) loads the contact into an inline form; Delete (trash) removes it. Deleting the primary auto-promotes the first remaining contact to primary (line 124).
5. Contact IDs are generated locally as `temp-<uuid8>` until saved.

### How to view / edit / archive an entity

- **View Details** (eye icon) opens `ViewEntityDialog`; it offers inline Edit/Archive buttons (gated by `canEdit`/`canArchive`).
- **Edit** (`EditEntityDialog`) writes changes directly with `updateDoc`. Changing the name/email/GSTIN here triggers the denormalization sync described below.
- **Archive / Unarchive** toggle `isArchived`; archived entities drop out of the "Active" filter and cannot be edited until unarchived. (Archive is a soft state distinct from `isDeleted` soft-delete.)

### How to view an entity ledger

From a table row's action menu choose **View Ledger** (shown only with `canViewAccounting`). This navigates to `/accounting/reports/entity-ledger?entityId=<id>` (`entities/page.tsx` line 522). The ledger report itself lives under `apps/web/src/app/accounting/reports/entity-ledger/` (components: `EntityInfoCard`, `FinancialSummaryCards`, `TransactionsTable`, `AgingAnalysis`) — it is an accounting-module screen reached from the entity master, not part of the entities route tree.

### Entity status / lifecycle

| State field         | Meaning                                                      | Set by                                                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isActive` (bool)   | Whether entity is usable in dropdowns/selectors              | Create (default true); edit                                                                                                                                                                                     |
| `isArchived` (bool) | Hidden from active list; edit disabled                       | Archive / Unarchive dialogs                                                                                                                                                                                     |
| `isDeleted` (bool)  | Soft-delete; filtered out everywhere client- and server-side | Not exposed in this UI directly; `createEntity` sets `false`. `checkEntityCascadeDelete` in the service checks references (transactions, projects as client, purchase orders) before any hard delete is allowed |

### Automatic behaviour: name/email/GSTIN denormalization sync

`functions/src/denormalizationSync.ts` → `onEntityNameChange` (Firestore `onDocumentUpdated('entities/{entityId}')`). When an entity's `name`, `email`, or `gstin` changes, it fan-out-updates denormalized copies, only overwriting a stored value when it still equals the _old_ value (so intentionally-diverged values are preserved). Batched in chunks of 400.

| Change  | Collections & fields updated                                                                                                                                                |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`  | `purchaseOrders.vendorName`, `goodsReceipts.vendorName`, `packingLists.vendorName`, `offers.vendorName`, `workCompletionCertificates.vendorName`, `transactions.entityName` |
| `email` | `purchaseOrders.vendorEmail`, `packingLists.vendorEmail`                                                                                                                    |
| `gstin` | `purchaseOrders.vendorGSTIN`                                                                                                                                                |

⚠ **Known gap:** The trigger reads `before.gstin`/`after.gstin` (top-level fields), but the create/edit flow stores GSTIN under `taxIdentifiers.gstin` (`createEntity.ts` line 116). Unless a top-level `gstin` mirror exists, the GSTIN branch of the sync will not fire on a GSTIN edit. (The same file also contains `onUserNameChange`, `onProjectNameChange`, and `onEquipmentNameChange` for user/project/SSOT-equipment renames.)

---

## 2. SSOT — Process Data (P&ID Single Source of Truth)

**Purpose.** Per-project master of process-engineering data used to build P&IDs and datasheets: **Streams** (INPUT_DATA), **Equipment**, **Lines** (list of lines with pipe sizing), **Instruments**, **Valves**, and a **Pipe Table** lookup. Data is stored in project sub-collections and edited in a tabbed UI.

**Where it lives**

- Page: `apps/web/src/app/ssot/page.tsx`; gate: `apps/web/src/app/ssot/layout.tsx` (`canViewThermalDesal` — SSOT shares the Thermal Desal permission)
- Tabs: `apps/web/src/app/ssot/components/{StreamsTab,EquipmentTab,LinesTab,InstrumentsTab,ValvesTab,PipeTableTab,StreamFormDialog}.tsx`
- Services: `apps/web/src/lib/ssot/{streamService,equipmentService,lineService,instrumentService,valveService,pipeTableService}.ts`
- Derived-property calculators: `apps/web/src/lib/ssot/{streamCalculations,lineCalculations}.ts`
- Write authorization: `apps/web/src/lib/ssot/ssotAuth.ts`
- Types: `packages/types/src/ssot.ts`

### Overview

`ssot/page.tsx` first loads the projects the user may access (`getProjectsForUser`, scoped by tenant/permissions), auto-selects the first, and shows a **Select Project** dropdown. Once a project is chosen, six tabs appear (Streams, Equipment, Lines, Instruments, Valves, Pipe Table), each rendered with the selected `projectId` and current `userId`. There is an **Export Excel** button that is a placeholder — it only toasts "Excel export coming soon" (⚠ **Known gap**, `page.tsx` line 117).

Each tab subscribes in real time to its sub-collection (e.g. `subscribeToStreams`) and provides a table with Add / Edit (pencil) / Delete (trash, with a `ConfirmDialog`) — the canonical pattern seen in `StreamsTab.tsx`.

### Permissions & write authorization (`ssotAuth.ts`)

- Module view: `canViewThermalDesal` (`PERMISSION_FLAGS_2.VIEW_THERMAL_DESAL`).
- Writes are checked by `validateSSOTWriteAccess(userId, projectId, accessCheck)`:
  - **PE-14** requires `PERMISSION_FLAGS_2.MANAGE_SSOT`.
  - **PE-18** requires the user to be assigned to the target project.
- ⚠ **Known gap / defence-in-depth note:** `accessCheck` is _optional_; when the tab components call `createStream/updateLine/…` they pass `projectId` and `userId` but the tab code does not construct an `accessCheck`, so these client-side checks are effectively skipped and authorization is deferred to Firestore rules (see the `rule5-exempt` comments throughout the services). All writes are direct Firestore client writes — there is no SSOT Cloud Function.

### The five record types and how they link

Links are **tag-string references** (not Firestore doc refs), matching how the source engineering spreadsheets are keyed (`packages/types/src/ssot.ts`):

| Type                             | Sub-collection key field            | Links via                                                                                                      |
| -------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Stream (`ProcessStream`)         | `lineTag` (e.g. SW1, D19, S13)      | The canonical fluid record. `fluidType` is inferred from the tag prefix (SW=sea water, D=distillate, S=steam…) |
| Equipment (`ProcessEquipment`)   | `equipmentTag` (e.g. LTFV, MED-E1)  | `fluidIn[]` / `fluidOut[]` arrays hold **stream lineTags** → equipment connects to streams                     |
| Line (`ProcessLine`)             | `lineNumber` (e.g. 200-40-SS-SW-01) | `inputDataTag` references a Stream's `lineTag` → a line draws its flow/density from a stream                   |
| Instrument (`ProcessInstrument`) | `tagNo` (e.g. PIT-101)              | `lineNo` references a line number; `instrumentValveNo` references a valve tag                                  |
| Valve (`ProcessValve`)           | `valveTag` (e.g. IV-101, BFV-101)   | `lineNumber` references a line                                                                                 |
| Pipe Table (`PipeSize`)          | ID range → NB size                  | Lookup table used when sizing lines (map calculated ID to a standard pipe size)                                |

### How to create a stream

1. In the **Streams** tab click **Add** → `StreamFormDialog`.
2. Enter `lineTag`, description, flow rate, pressure, temperature, TDS, fluid type, etc.
3. Save calls `createStream(projectId, input, userId)` (`streamService.ts`). The service:
   - Validates write access (PE-14/PE-18 if `accessCheck` supplied).
   - **PE-9** validates the project still exists (`validateProjectExists`) before writing.
   - **Enriches** the input via `enrichStreamInput` — auto-computing derived properties (density, enthalpy, kg/hr from kg/s, bar from mbar) from fluid type + operating conditions.
   - Writes with `createdAt/createdBy/updatedAt/updatedBy`.
4. Editing recomputes derived properties only when a key input (temperature, pressure, flow, TDS, fluid type) changed (`updateStream`, `needsRecalc`). A bulk `createStreamsInBulk` exists for Excel import.

### How to create a line (with automatic pipe sizing)

1. In **Lines**, Add a line: enter `lineNumber`, fluid, `inputDataTag` (the stream it draws from), `flowRateKgS`, `density`, `designVelocity`, and a `selectedID`.
2. `createLine` calls `enrichLineInput` (`lineCalculations.ts`) which computes `calculatedID` (from V = Q/A at the design velocity) and `actualVelocity` (recomputed from the selected pipe ID). `updateLine` re-enriches when flow/density/design velocity/selectedID change.
3. The intended flow is: read the stream's flow/density → compute required ID → pick a standard NB from the **Pipe Table** → store `selectedID` → get the true `actualVelocity`.

### How to create equipment, instruments, valves

Same Add/Edit/Delete pattern (`EquipmentTab`, `InstrumentsTab`, `ValvesTab` + their services). Equipment additionally records `fluidIn[]`/`fluidOut[]` as lists of stream tags to wire the P&ID connectivity. Instruments and valves carry full datasheet columns (operating min/nor/max for pressure, temperature, flow, TDS; materials of construction; signal/IO type; model no.; remarks) as enumerated in `ssot.ts`. Instrument types and valve types are constrained by the `INSTRUMENT_TYPES` / `VALVE_TYPES` constant lists.

### Automatic behaviour

- **Real-time tabs:** all tabs use `onSnapshot` subscriptions, so edits by one user appear live for others viewing the same project.
- **Derived-property recalculation:** streams and lines recompute derived engineering values on create and on relevant edits (see above).
- **Equipment rename sync:** `onEquipmentNameChange` in `denormalizationSync.ts` propagates `equipmentName`/`equipmentTag` changes (for `projects/{projectId}/equipment/{equipmentId}`) into `documents` and `purchaseRequestItems` (`equipmentName`, `equipmentCode`). Note this fires on the **project SSOT equipment** path, which is a different equipment collection from the SSOT tab's `SSOT_COLLECTIONS.EQUIPMENT(projectId)`.

⚠ **Known gap:** There is no delete-safety/cascade check for SSOT records — deleting a stream that is referenced by a line's `inputDataTag` or an equipment's `fluidIn/Out` leaves a dangling tag reference (references are string tags with no integrity enforcement).

---

## 3. Thermal — Desalination Engineering Calculators

**Purpose.** A large suite of standalone thermal/hydraulic design calculators for MED/MED-TVC/MSF desalination plants, plus a Flash Chamber designer and a Reference Projects library. Most calculators follow a live **inputs → (reactive) calculate → results → optionally Save / Load / export PDF** loop, with per-user saved calculations.

**Where it lives**

- Module landing: `apps/web/src/app/thermal/(protected)/page.tsx`
- Calculators hub: `apps/web/src/app/thermal/calculators/page.tsx`
- One folder per calculator under `apps/web/src/app/thermal/calculators/<name>/`
- Flash Chamber designer: `apps/web/src/app/thermal/(protected)/flash-chamber/`
- Reference Projects: `apps/web/src/app/thermal/(protected)/reference-projects/`
- Save/load service: `apps/web/src/lib/thermal/savedCalculationService.ts`
- Calculation engines: `apps/web/src/lib/thermal/**` (per-calculator `*Calculator.ts`, plus `med/**` for the MED designer pipeline)
- Gate: shares `canViewThermalDesal` (Thermal Desal module permission)

### Overview / navigation

The **landing page** (`(protected)/page.tsx`) highlights Flash Chamber, Reference Projects (and "coming soon" Condenser/Ejector), with a highlight card linking to the **Thermal Calculators hub**. The hub (`calculators/page.tsx`) is a searchable, categorised directory with card/list view toggle and a localStorage-backed "Recently Used" strip (`thermal-calculators-recent`, max 5). Calculators are tagged `available` or `coming_soon` and grouped into six categories. Only MVC is `coming_soon`.

### One-line purpose per calculator (from the route/hub definitions)

**Plant Design**

- **MED Plant Designer** (`med-designer`): Design a complete MED plant from 4 inputs — auto-sizes effects, bundles, condenser, preheaters, brine recirculation and compares compact-to-high-GOR options with weight estimates.
- **MED Process Calculator** (`med-plant`): Heat & mass balance for MED — steam in vs GOR/distillate out, per-effect enthalpy balance, equipment sizing, wetting rate, recirculation; supports TVC and preheaters.

**Compression & Ejectors**

- **Thermo Vapour Compressor / TVC** (`tvc`): Entrainment ratio, flows and performance for steam ejectors in MED-TVC.
- **Mechanical Vapour Compressor / MVC** (`mvc`): Shaft power, discharge conditions and specific energy for isentropic vapour compression. ⚠ Marked **coming soon** in the hub.

**Heat Exchange & Thermal**

- **Heat Exchanger Calculator** (`heat-exchanger`): Unified quick heat-duty (sensible/latent/LMTD), detailed HTC analysis, and full iterative exchanger sizing in one tool.
- **Falling Film Evaporator** (`falling-film`): Design horizontal-tube falling-film evaporators — wetting rate, HTCs, tube bundle layout for MED.
- **Single Tube Analysis** (`single-tube`): One horizontal tube — vapour condensing inside, spray evaporating outside; film thickness, HTCs, heat & mass balance.
- **Custom Tube Bundle** (`custom-bundle`): Custom bundle by boundary shape/pitch/tube spec → tube count and surface area.
- **Lateral Tube Bundle** (`lateral-bundle`): Half-shell lateral bundle with vapour-escape lanes, nozzle exclusions, spray nozzle integration.
- **Central Tube Bundle** (`central-bundle`): Rectangular bundle centred in a cylindrical shell with seawater/brine spray distribution.
- **Desuperheating** (`desuperheating`): Spray-water flow needed to desuperheat steam to a target temperature by energy balance.
- **Thermal Expansion** (`thermal-expansion`): Free ΔL and restrained thermal stress for CS/SS304/Al 5052/Ti Gr 2 using temperature-dependent α(T), E(T).
- **Fouling & Scaling Prediction** (`fouling-scaling`): CaSO₄/CaCO₃ scaling tendency vs temperature; max TBT and recommended fouling resistances.

**Fluid Systems & Equipment**

- **Pipe Sizing** (`pipe-sizing`): Size pipe from flow + velocity limits, or compute velocity for a given size.
- **Pressure Drop** (`pressure-drop`): Straight-pipe + fittings pressure drop via Darcy-Weisbach.
- **Pump Sizing** (`pump-sizing`): Total differential head, hydraulic/brake power, motor sizing for centrifugal pumps.
- **Suction System Designer / NPSHa** (`npsha`): Pump suction systems for vacuum vessels — pipe sizing, fittings, friction, holdup, NPSHa check.
- **Siphon Sizing** (`siphon-sizing`, plus `/batch`): Inter-effect siphon pipes — min U-bend height, pressure drop, flash vapour.
- **Demister Sizing** (`demister`): Demister pads/mist eliminators via Souders-Brown.
- **Strainer Sizing** (`strainer-sizing`, plus `/batch`): Y-type/bucket strainers — mesh selection and clean/50%-clogged pressure drop.

**Plant Auxiliaries**

- **Vacuum System Design** (`vacuum-system`): Size LRVPs and steam-ejector trains against NCG load and leakage.
- **Vacuum Breaker Sizing** (`vacuum-breaker`): Size vacuum-breaker valves via compressible flow (HEI/ISO 9300).
- **Chemical Dosing** (`chemical-dosing`): Dosing rates, daily consumption, storage-tank sizing for antiscalant/anti-foam.
- **Spray Nozzle Selection** (`spray-nozzle`): Select nozzles from the Spraying Systems catalogue for desuperheating/distribution.

**Properties & Lookups**

- **Steam Tables** (`steam-tables`): Saturation properties by T or P (P_sat, T_sat, enthalpy, density, specific volume; IAPWS-IF97).
- **Seawater Properties** (`seawater-properties`): Seawater density, Cp, enthalpy, BPE, viscosity.
- **NCG Properties** (`ncg-properties`): Properties of NCG + water-vapour mixtures — density, enthalpy, Cp, viscosity, conductivity, partial pressures.

**Additional routes present but not on the hub grid**

- **GOR** (`gor`): Gain Output Ratio calculator (has Save/Load, `GOR` calculator type). ⚠ Present as a route + client but not listed in the hub's `ALL_CALCULATORS`.
- **Heat Transfer** (`heat-transfer`) and **Heat Duty** (`heat-duty`): standalone clients that exist as routes; the hub now points users to the unified **Heat Exchanger** tool instead. ⚠ Possible legacy/duplicate surfaces.
- **Flash Chamber** (`(protected)/flash-chamber`): reached from the thermal landing page, not the calculators hub (see below).

### How to run a typical calculator (canonical pattern)

Example: Pipe Sizing (`pipe-sizing/PipeSizingClient.tsx`), representative of most clients.

1. Open the calculator from the hub (this also records it in "Recently Used").
2. Choose a mode if offered (e.g. size-by-flow vs velocity-for-size) and enter inputs (flow rate + unit, fluid type, temperature, salinity/density, target/min/max velocity, selected NPS…).
3. **Results compute reactively** — clients use `useMemo`/derived state, so there is usually no explicit "Calculate" button; results update as you type. (Some clients do use an explicit calculate action.)
4. Action buttons at the bottom: **Save**, **Load Saved**, **Reset**, and often **PDF/Report**.

### How to save and reload a calculation

Save/Load is per-user and per-calculator-type via `savedCalculationService.ts` (collection `savedCalculations`, no tenant/entity scope):

1. Click **Save** → `SaveCalculationDialog` (e.g. `calculators/components/SaveCalculationDialog.tsx`). Enter a name and confirm. It calls `saveCalculation(db, user.uid, calculatorType, name, inputs)` which `addDoc`s `{userId, calculatorType, name, inputs, createdAt, updatedAt}`.
2. Click **Load Saved** → `LoadCalculationDialog`. It calls `listCalculations(db, user.uid, calculatorType)` — querying by `userId` + `calculatorType`, ordered by `createdAt desc`, filtering out `isDeleted` client-side. Selecting an item calls `onLoad(calc.inputs)`, which the client applies back to its input state.
3. Delete (trash icon in the load list) → `deleteCalculation` performs a **soft delete** (`updateDoc {isDeleted:true}`); Firestore rules enforce that only the owner can update.

The `calculatorType` is a fixed union in `packages/types/src/thermal.ts` (line 506): `SIPHON_SIZING`, `SIPHON_SIZING_BATCH`, `FLASH_CHAMBER`, `DESUPERHEATING`, `TVC`, `HEAT_TRANSFER`, `NCG_PROPERTIES`, `SPRAY_NOZZLE`, `SPRAY_NOZZLE_LAYOUT`, `VACUUM_SYSTEM`, `HEAT_DUTY`, `HEAT_EXCHANGER`, `CHEMICAL_DOSING`, `DEMISTER`, `MVC`, `NPSHA`, `PIPE_SIZING`, `PRESSURE_DROP`, `PUMP_SIZING`, `FOULING_SCALING`, `FALLING_FILM`, `GOR`, `VACUUM_BREAKER`, `MED_PLANT`, `STRAINER_SIZING`, `STRAINER_SIZING_BATCH`, `SINGLE_TUBE`, `MED_DESIGNER`.

**Which calculators wire Save/Load:** most do (each has a local `components/{Save,Load}CalculationDialog.tsx`): chemical-dosing, demister, falling-film, fouling-scaling, gor, heat-duty, heat-exchanger, med-designer (wizard), mvc, ncg-properties, npsha, pipe-sizing, pressure-drop, pump-sizing, single-tube, siphon-sizing (+batch), spray-nozzle, strainer-sizing (+batch), vacuum-system.

⚠ **Known gap / partial:** Some clients (e.g. `desuperheating`, `tvc`, `vacuum-breaker`, `heat-transfer`, `med-plant`) have result components but **no Save/Load dialog** wired, so their inputs cannot be persisted even though a matching `calculatorType` exists (e.g. `DESUPERHEATING`, `TVC`). `SPRAY_NOZZLE_LAYOUT` is a defined type with no obvious dedicated save UI.

### MED Plant Designer — wizard workflow

`med-designer/` uses a stepper (`MEDWizardClient.tsx`, `WizardStepper`, `Step1Inputs`, `Step2Geometry`). The user enters ~4 top-level inputs, the engine (`lib/thermal/med/**` — `designPipeline`, `medEngine`, `effectModel`, `equipmentSizing`, cost/weight estimation, `resultAdapter`) generates one or more design options (compact → high-GOR), and the results feed rich outputs: general arrangement, process flow diagram, plot plan, auxiliary equipment sections, and several PDF reports (`MEDDesignerReportPDF`, `MEDBriefReportPDF`, `MEDVerificationReportPDF`) via `GenerateReportDialog`. Save/Load uses the `MED_DESIGNER` type through its own dialogs.

### Flash Chamber designer — workflow

`(protected)/flash-chamber/FlashChamberClient.tsx` with component sections: `InputSection` → `HeatMassBalance`, `ChamberSizing`, `NozzleSizing`, `NPSHaCalculation`, `ElevationDiagram`, and a `FlashChamberDatasheet` produced via `GenerateDatasheetDialog`. Workflow: enter flash conditions → view heat/mass balance and chamber/nozzle sizing and NPSHa → generate a datasheet. It has its own `FLASH_CHAMBER` saved-calculation type.

### Reference Projects

`(protected)/reference-projects/` backed by `lib/thermal/referenceProjects.ts` — a read-only library of as-built MED-TVC project data (Campiche, CADAFE, MORON) for engineering reference/validation. No save/compute loop; it is reference data.

### Permissions (thermal)

All thermal routes sit behind the Thermal Desal module permission (`canViewThermalDesal`, same bit SSOT uses). Saved-calculation writes carry `rule5-exempt` comments: client-side permission gating is intentionally deferred and enforced by `firestore.rules` (ownership by `userId`), which is acceptable because the app is a static export where client gates can't be load-bearing.

---

## Cross-cutting notes & flagged gaps (summary)

- **Entities edits bypass the callable** — only creation goes through `createEntity`; edit/archive/delete are direct client Firestore writes relying on security rules.
- **GSTIN denormalization mismatch** — sync reads top-level `gstin` while data is stored under `taxIdentifiers.gstin`.
- **SSOT write access checks are optional and not populated by the tabs** — real enforcement is via Firestore rules; no SSOT Cloud Functions exist.
- **SSOT Excel export is a stub** ("coming soon" toast).
- **SSOT references are string tags** with no referential-integrity/cascade protection.
- **Thermal Save/Load coverage is uneven** — several calculators with defined `calculatorType`s lack a wired Save/Load dialog; MVC is "coming soon"; `gor`, `heat-transfer`, `heat-duty` exist as routes outside the hub grid.
