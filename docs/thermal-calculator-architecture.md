# Thermal Calculator Architecture — Work To Be Done

## Completed

### MED Process Calculator (`medEngine.ts`)

- Steam flow in, GOR out (correct paradigm)
- Per-effect tube/shell side H&M balance with NCG tracking
- Preheaters individually sized with different LMTDs
- Preheater condensate routing to downstream effects
- TVC support (Thermo Vapor Compressor)
- Equipment sizing integrated (evaporators, condenser, preheaters)
- Shared `sizeCondensingHX()` for condenser and preheaters
- HTC improvements: Kern bundle correction, NCG degradation, actual velocity refinement
- Validated against IIT Madras PFD at 1.4% GOR accuracy
- Live at `/thermal/calculators/med-plant`

### Property Tables

- Steam tables (IAPWS-IF97): saturation, enthalpies, densities, specific volume
- Seawater tables (Sharqawy 2010): density, viscosity, Cp, conductivity, enthalpy, BPE
- Pure water transport: viscosity and thermal conductivity (IAPWS 2008/2012)
- All temperature-dependent — no hardcoded approximations remaining

### Individual Calculators (23 total, all tested)

- All validated, all have UI pages, save/load where applicable
- 1,190 tests across 36 suites

---

## Work To Be Done

### 1. Wetting Rate → Recirculation Feedback Loop

**Priority:** High
**Effort:** Small

The engine sizes equipment and computes wetting rate per effect, but doesn't automatically determine the recirculation flow needed when wetting is inadequate. The loop:

- H&M balance → equipment sizing → tube count → wetting rate
- If wetting rate < minimum → calculate recirc flow from last effect brine
- Re-run H&M with recirc (spray composition changes slightly)
- Converge (typically 1-2 iterations, wetting rate has <1% effect on GOR)

### 2. Migrate MED Designer to New Engine

**Priority:** High
**Effort:** Large

The MED Designer wizard (`/thermal/calculators/med-designer`) still uses the old pipeline (`designPipeline.ts` → `medSolver.ts`) which targets capacity and iterates steam flow — the wrong paradigm. It should use `calculateMED()` from `medEngine.ts`.

**What needs to change:**

- `MEDWizardClient.tsx` — replace `designMED()` calls with `calculateMED()`
- The GOR configuration table needs to call `calculateMED()` for each effect/preheater combination
- Step 2 (Geometry) needs to consume equipment sizing from the engine result
- Step 3 (Detailed Design) needs the new result format
- Step 4 (Review & Export) — BOM, PDF reports need result format mapping
- `medBOMGenerator.ts` — needs to accept the new result format

**What can be preserved:**

- Shell geometry functions (`shellGeometry.ts`)
- Auxiliary equipment (`auxiliaryEquipment.ts`)
- Weight/cost estimation (`weightEstimation.ts`)
- Turndown analysis (`turndownAnalysis.ts`)
- PDF report components (with data mapping)

### 3. Remove Dead Code

**Priority:** Low (after #2)
**Effort:** Small

Once the designer is migrated:

- Delete `medSolver.ts` (old capacity-targeting solver)
- Delete `designPipeline.ts` (old pipeline orchestrator)
- Delete `inputAdapter.ts` and `resultAdapter.ts` (old type bridges)
- Delete `/thermal/calculators/gor/` directory (GOR calculator page — already removed from landing)
- Slim `medDesigner.ts` further or delete entirely
- Remove `gorAnalysis.ts` if the new engine's GOR is computed directly

### 4. MED Designer → Process Calculator Consolidation

**Priority:** Medium (after #2)
**Effort:** Medium

After the designer uses the new engine, consider whether two separate pages are needed:

- **Process Calculator** — H&M balance + equipment sizing (current `/med-plant`)
- **MED Designer** — adds geometry selection, BOM, auxiliary equipment, weight, PDF reports

These could be the same page with progressive disclosure — start with process thermodynamics, expand to full design. Or keep them separate with the designer consuming the process calculator's engine.

### 5. Tube Spec Inputs in Process Calculator UI

**Priority:** Low
**Effort:** Small

The process calculator uses default tube specs (Ti 25.4mm evaporator, Ti 17mm condenser). Adding UI inputs for tube OD, wall thickness, length, and material would let users customise the equipment sizing without needing the full designer.
