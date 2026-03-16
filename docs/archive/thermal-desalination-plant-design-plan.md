# Thermal Desalination Plant Design — Comprehensive Implementation Plan

> **Goal**: Build a complete MED/MED-TVC plant design tool that takes the engineer from
> thermodynamic inputs all the way to cost of water, replacing the current Excel program
> (Case 6.xlsx) and exceeding it with automation, validation, and configuration comparison.

## Reference: Current Excel Program (Case 6.xlsx)

The Excel program is a 22-sheet MED design tool authored by SEK. It covers:

| Sheet                      | Purpose                                                                        |
| -------------------------- | ------------------------------------------------------------------------------ |
| Overall Project            | Master inputs (capacity, GOR, steam, seawater, tentative design parameters)    |
| Effect Performance         | Effect-by-effect tube-side & shell-side H&M balance with preheater integration |
| Summary Effects            | Production totals, spray water flows, manifold sizing                          |
| Exchange Surf.             | Evaporator heat exchange surface calculations                                  |
| Preheaters                 | Preheater sizing (HTC, LMTD, surface, tube selection)                          |
| 1. Interface               | Summary datasheet — all effects + heat exchangers in one view                  |
| Edit PFD                   | Plant flow diagram with all stream data                                        |
| Evaporator Data Sheet      | Equipment datasheet for evaporator                                             |
| Final Cond Data Sheet      | Equipment datasheet for final condenser                                        |
| Wetting factor             | Falling film wetting rate verification                                         |
| Demisters                  | Demister sizing per effect                                                     |
| NCG                        | Non-condensable gas load estimation                                            |
| Vacuum                     | Vacuum system sizing                                                           |
| I A Condenser              | Inter-stage / auxiliary condenser                                              |
| Siphons                    | Brine & distillate siphon sizing between effects                               |
| Desuperheating Requirement | Spray water for superheated steam                                              |
| Manpower Costs             | O&M staffing cost model                                                        |
| Cost of Water              | Levelised cost per m³ (CAPEX + OPEX)                                           |
| Life Cycle Costs           | 25-year NPV with inflation & depreciation                                      |

**Key limitation**: The Excel uses manual iteration ("digit in green box by tentatives until
the kW in yellow boxes are equal"). Our tool will automate this convergence.

---

## Existing Capabilities (Already Built)

These calculators/libraries already exist and will be consumed by the plant designer:

| Capability                     | File                                          | Status                                             |
| ------------------------------ | --------------------------------------------- | -------------------------------------------------- |
| Steam tables (IAPWS-IF97)      | `@vapour/constants` steamTables               | Complete                                           |
| Seawater properties (Sharqawy) | `@vapour/constants` seawaterTables            | Complete                                           |
| BPE correlation                | `@vapour/constants` seawaterTables            | Complete                                           |
| NCG properties                 | `ncgCalculator.ts`                            | Complete                                           |
| TVC ejector                    | `tvcCalculator.ts`                            | Complete — entrainment ratio, discharge conditions |
| MVC compressor                 | `mvcCalculator.ts`                            | Complete — power, discharge conditions             |
| Siphon sizing                  | `siphonSizingCalculator.ts`                   | Complete — pipe selection, flash fraction          |
| Demister sizing                | `demisterCalculator.ts`                       | Complete — Souders-Brown, carryover                |
| Vacuum system                  | `vacuumSystemCalculator.ts`                   | Complete — ejector trains, LRVP                    |
| Desuperheating                 | `desuperheatingCalculator.ts`                 | Complete — spray water flow                        |
| Heat duty & LMTD               | `heatDutyCalculator.ts`                       | Complete                                           |
| HTC correlations               | `heatTransfer.ts`                             | Complete — Nusselt, Kern, etc.                     |
| HX sizing                      | `heatExchangerSizing.ts`                      | Complete — tube count, shell ID                    |
| Falling film evaporator        | `fallingFilmCalculator.ts`                    | Complete — wetting rate                            |
| Fouling & scaling              | `foulingScalingCalculator.ts`                 | Complete — CaSO₄, CaCO₃                            |
| Pipe sizing & pressure drop    | `pipeService.ts`, `pressureDropCalculator.ts` | Complete                                           |
| Pump sizing                    | `pumpSizing.ts`                               | Complete — TDH, power                              |
| Spray nozzle selection         | `sprayNozzleCalculator.ts`                    | Complete                                           |
| Chemical dosing                | `chemicalDosingCalculator.ts`                 | Complete                                           |
| Suction system (NPSHa)         | `suctionSystemCalculator.ts`                  | Complete                                           |
| Flash chamber design           | `flashChamberCalculator.ts`                   | Complete                                           |
| Vacuum breaker                 | `vacuumBreakerCalculator.ts`                  | Complete                                           |
| GOR estimator                  | `gorCalculator.ts`                            | To be superseded by this work                      |
| PDF report framework           | `@/lib/pdf/reportComponents.tsx`              | Complete                                           |
| Saved calculations             | `savedCalculationService.ts`                  | Complete                                           |

---

## Architecture Decision

### Location: Start in Calculators → Graduate to Design Module

```
Phase 1–4:  /thermal/calculators/med-plant/     (calculator pattern)
Phase 5+:   /thermal/(protected)/med-plant/      (design module pattern)
```

**Why calculators first:**

- Faster iteration without Firestore project integration overhead
- Uses existing save/load pattern (user-scoped)
- Can be used standalone for quick studies and proposals
- Graduate to design module once the calculation engine is mature and validated

### Engine Architecture

```
packages/constants/src/thermal/
  ├── steamTables.ts          (existing)
  ├── seawaterTables.ts       (existing)
  └── medConstants.ts         (NEW — shared constants, material properties, cost defaults)

apps/web/src/lib/thermal/
  ├── med/
  │   ├── medSolver.ts              (NEW — core iterative H&M balance solver)
  │   ├── effectModel.ts            (NEW — single-effect thermodynamic model)
  │   ├── preheaterModel.ts         (NEW — preheater integration model)
  │   ├── finalCondenserModel.ts    (NEW — final condenser model)
  │   ├── tvcIntegration.ts         (NEW — TVC coupling to MED effects)
  │   ├── equipmentSizing.ts        (NEW — evaporator, condenser, preheater sizing)
  │   ├── auxiliarySizing.ts        (NEW — consumes existing siphon, demister, vacuum, etc.)
  │   ├── pipingManifolds.ts        (NEW — spray manifold, brine/distillate headers)
  │   ├── electricalLoads.ts        (NEW — pump powers, instrument loads, total kW)
  │   ├── costModel.ts              (NEW — CAPEX estimation, OPEX, cost of water, LCC)
  │   └── datasheetGenerator.ts     (NEW — equipment datasheets as structured data)
  └── ... (existing calculators)

apps/web/src/app/thermal/calculators/med-plant/
  ├── page.tsx
  ├── MEDPlantClient.tsx            (main orchestrator)
  ├── components/
  │   ├── inputs/                   (step-by-step input panels)
  │   ├── results/                  (tabbed result views)
  │   └── diagrams/                 (PFD, Sankey, elevation)
  └── reports/
      ├── MEDPlantReportPDF.tsx     (comprehensive PDF)
      └── DatasheetPDF.tsx          (per-equipment datasheets)
```

---

## Phase 1: Core Thermodynamic Engine (Days 1–3)

> **Goal**: Effect-by-effect heat & mass balance solver for MED (parallel feed) that
> converges automatically — replacing the manual iteration in the Excel.

### 1.1 Types & Constants

**File**: `packages/types/src/thermal.ts` (extend existing)

```
MEDPlantConfiguration
  ├── plantType: 'MED' | 'MED_TVC'
  ├── numberOfEffects: number (2–16)
  ├── numberOfPreheaters: number
  ├── preheaterPositions: { effectNumber: number, vaporFlow: number }[]

MEDPlantInputs
  ├── configuration: MEDPlantConfiguration
  ├── capacity: { value: number, unit: 'T/h' | 'T/d' | 'm³/h' | 'm³/d' }
  ├── gorTarget: number (designer's target — solver iterates to match)
  ├── steam: { pressure: number, temperature: number, isSuperheated: boolean }
  ├── seawater: { inletTemp: number, dischargeTemp: number, salinity: number,
  │               calciumPpm: number, bicarbonatePpm: number }
  ├── design: {
  │     topBrineTemp: number,
  │     brineConcentrationFactor: number,
  │     approachTempFinalCondenser: number,
  │     recycledBrineFlow: number,   // for wetting
  │     condensateExtraction: 'FINAL_CONDENSER' | 'FIRST_EFFECT',
  │     foulingFactor: number        // m²·°C/W
  │   }
  ├── tubes: {
  │     evaporator: { od: number, thickness: number, length: number, material: TubeMaterial }
  │     condenser: { od: number, thickness: number, length: number, material: TubeMaterial }
  │     preheater: { od: number, thickness: number, length: number, material: TubeMaterial }
  │   }

EffectResult
  ├── effectNumber: number
  ├── temperature: number          // effect operating temp (°C)
  ├── pressure: number             // effect operating pressure (bar abs)
  ├── bpe: number                  // boiling point elevation (°C)
  ├── nea: number                  // non-equilibrium allowance (°C)
  ├── deltaTPressureDrop: number   // temperature loss from demister/duct ΔP
  ├── effectiveDeltaT: number      // working ΔT for heat transfer
  ├── streams: {
  │     vaporIn: Stream            // steam/vapor entering tube side
  │     sprayWaterIn: Stream       // feed sprayed on shell side
  │     brineIn: Stream            // brine from previous effect (parallel: none)
  │     distillateIn: Stream       // distillate from previous effects (cascade)
  │     condensateIn: Stream       // condensate from previous effects
  │     vaporOut: Stream           // vapor produced → next effect
  │     vaporToPreheater: Stream   // vapor diverted to preheater (if any)
  │     brineOut: Stream           // concentrated brine out
  │     distillateOut: Stream      // accumulated distillate
  │     condensateOut: Stream      // accumulated condensate
  │   }
  ├── heatTransferred: number      // kW
  ├── massBalance: number          // kg/hr (should be ≈ 0)

Stream
  ├── fluid: 'STEAM' | 'VAPOR' | 'BRINE' | 'SEAWATER' | 'DISTILLATE' | 'CONDENSATE' | 'VENT'
  ├── flow: number                 // kg/hr
  ├── temperature: number          // °C
  ├── pressure: number             // bar abs
  ├── enthalpy: number             // kJ/kg
  ├── salinity: number             // ppm (0 for pure water streams)
  ├── energy: number               // kW

MEDPlantResult
  ├── inputs: MEDPlantInputs
  ├── effects: EffectResult[]
  ├── finalCondenser: FinalCondenserResult
  ├── preheaters: PreheaterResult[]
  ├── overallBalance: OverallHMBalance
  ├── performance: {
  │     gor: number,
  │     specificThermalEnergy: number,    // kJ/kg
  │     specificThermalEnergy_kWh: number, // kWh/m³
  │     thermalEfficiency: number,
  │     overdesign: number,               // fraction (e.g. 0.187 = 18.7%)
  │     grossProduction: number,          // T/h (effects only)
  │     netProduction: number,            // T/h (effects + condenser)
  │   }
  ├── warnings: string[]
  ├── converged: boolean
  ├── iterations: number
```

### 1.2 Single-Effect Thermodynamic Model

**File**: `apps/web/src/lib/thermal/med/effectModel.ts`

Core function: `calculateEffect(effectNumber, inputs, previousEffects, preheaterConfig)`

For each effect, solve the energy & mass balance:

- **Inputs**: Vapor (from previous effect or steam), spray water, distillate & condensate (cascade)
- **Losses**: BPE (from seawater tables), NEA (empirical ~0.2–0.5°C), demister ΔP → ΔT
- **Energy balance**: Heat from condensing vapor = heat to evaporate spray water + heat to raise spray water + heat to raise brine
- **Mass balance**: Total in = Total out (verify to < 0.1% tolerance)
- **Outputs**: All exit streams with flows, temperatures, enthalpies

The Excel iterates manually. We will:

1. Start with an initial guess (equal ΔT distribution)
2. Solve effect-by-effect forward
3. Check overall energy balance
4. Adjust steam flow until capacity target is met (bisection or Newton-Raphson)

### 1.3 Preheater Integration Model

**File**: `apps/web/src/lib/thermal/med/preheaterModel.ts`

The Excel allows preheaters on any effect (effects 2, 4, 6 in Case 6). Each preheater:

- **Diverts** a specified vapor flow from an effect to heat incoming seawater
- **Reduces** vapor available to the next effect (reduces distillate)
- **Increases** feed water temperature (improves thermal efficiency)

The preheater model calculates:

- Heat exchanged (LMTD × U × A)
- Seawater outlet temperature
- Condensate produced
- Required surface area

### 1.4 Final Condenser Model

**File**: `apps/web/src/lib/thermal/med/finalCondenserModel.ts`

The final condenser:

- Condenses residual vapor from the last effect
- Produces additional distillate
- Heats seawater from ambient to feed temperature
- Determines total seawater intake (cooling water ratio)

### 1.5 MED Solver (Iterative Convergence)

**File**: `apps/web/src/lib/thermal/med/medSolver.ts`

Master function: `solveMEDPlant(inputs: MEDPlantInputs): MEDPlantResult`

```
Algorithm:
1. Calculate temperature profile:
   - Total ΔT = TBT - T_last_effect
   - Working ΔT per effect = (Total ΔT / N) - BPE_avg - NEA_avg - ΔT_demister
   - Initial vapor/temperature distribution (equal spacing)

2. Outer loop: Iterate on steam flow to match capacity target
   - Initial guess: steam_flow = capacity / GOR_target

3. Inner loop: Effect-by-effect forward solve
   - For each effect 1..N:
     a. Get inlet streams (vapor from previous, spray water, brine cascade)
     b. If preheater on this effect: solve preheater first, reduce available vapor
     c. Solve effect energy balance → vapor produced, brine out
     d. Accumulate distillate, condensate

4. Solve final condenser:
   - Vapor from last effect → distillate
   - Seawater heating → determine cooling water flow

5. Check convergence:
   - |net_production - target_capacity| < tolerance (0.1%)
   - Mass balance per effect < tolerance
   - Energy balance overall < tolerance

6. If not converged: adjust steam flow and repeat from step 3
   - Use secant method for fast convergence (typically 5–10 iterations)

7. Calculate performance metrics: GOR, STE, overdesign
```

### 1.6 UI — Basic Input/Output (Calculator Pattern)

**File**: `apps/web/src/app/thermal/calculators/med-plant/MEDPlantClient.tsx`

Phase 1 UI is functional, not polished:

- **Input panels** (collapsible sections):
  - Plant Configuration (type, # effects)
  - Capacity & Performance Target (capacity, GOR target)
  - Steam Conditions (pressure, temperature)
  - Seawater Conditions (temps, salinity, chemistry)
  - Design Parameters (TBT, concentration factor, approach temp)
- **Results display**:
  - Key metrics card (GOR, STE, production, overdesign %)
  - Effect-by-effect H&M balance table (matching Excel "Interface" sheet layout)
  - Final condenser balance
  - Overall plant balance (In vs Out totals)
  - Mass balance verification per effect
  - Warnings panel

### Deliverables — Phase 1

- [x] Types in `packages/types/src/thermal.ts`
- [x] Constants in `packages/constants/src/thermal/medConstants.ts`
- [x] `effectModel.ts` — single effect solver
- [x] `preheaterModel.ts` — preheater integration
- [x] `finalCondenserModel.ts` — final condenser
- [x] `medSolver.ts` — iterative plant solver
- [x] `MEDPlantClient.tsx` + input/output components
- [x] Validate against Case 6.xlsx (8-effect MED, GOR=6, 5 T/h)
- [x] Save/load integration

### Validation Targets (from Case 6.xlsx)

| Metric             | Excel Value | Tolerance |
| ------------------ | ----------- | --------- |
| Net Production     | 5.0 T/h     | ±2%       |
| GOR                | 6.0         | ±5%       |
| Steam flow         | 833 kg/h    | ±5%       |
| Seawater intake    | 86.8 T/h    | ±5%       |
| Brine salinity     | 52,500 ppm  | exact     |
| Top Brine Temp     | 55.1°C      | ±0.5°C    |
| Effect 1 vapor out | 745 kg/h    | ±5%       |
| Effect 8 vapor out | 735 kg/h    | ±5%       |
| Overdesign         | 18.7%       | ±3%       |

---

## Phase 2: MED-TVC & Desuperheating (Days 4–5)

> **Goal**: Add TVC integration and desuperheating auto-calculation.

### 2.1 TVC Integration

**File**: `apps/web/src/lib/thermal/med/tvcIntegration.ts`

MED-TVC modifies the plant:

- Motive steam (higher pressure, typically 2–10 bar) drives the TVC ejector
- TVC entrains vapor from a selected effect (typically last or intermediate)
- Discharge vapor feeds effect 1 at higher pressure than the entrained vapor
- Result: higher GOR (8–16) for same number of effects

Integration with existing `tvcCalculator.ts`:

- Call TVC calculator to get entrainment ratio, discharge conditions
- Feed TVC discharge as "steam" to effect 1
- Subtract entrained vapor from the source effect's output
- Re-solve the plant balance

New inputs:

- Motive steam pressure & temperature
- Entrained vapor source (effect number)
- TVC component efficiencies (or use defaults)

### 2.2 Desuperheating Integration

If inlet steam is superheated, integrate `desuperheatingCalculator.ts`:

- Calculate spray water required to desuperheat to saturation
- Add desuperheated condensate to the plant balance
- Match Excel "Desuperheating Requirement" sheet

### Deliverables — Phase 2

- [x] `tvcIntegration.ts` — TVC coupling
- [x] Desuperheating auto-calculation (integrated into TVC flow)
- [x] UI: Configuration selector (MED / MED-TVC)
- [x] UI: TVC parameter inputs (motive steam, entrainment source)
- [x] Tests: 6 MED-TVC tests passing
- [ ] Validate MED-TVC against known benchmarks (El-Dessouky data)

---

## Phase 3: Equipment Sizing (Days 6–8)

> **Goal**: Size all major equipment from the H&M balance — evaporator tubes,
> final condenser, preheaters, demisters.

### 3.1 Evaporator Sizing

**File**: `apps/web/src/lib/thermal/med/equipmentSizing.ts`

Per effect:

- **Heat transfer area**: A = Q / (U × ΔT_effective)
  - U from falling film HTC (shell side) + condensation HTC (tube side) + fouling + tube wall
  - Consume existing `heatTransfer.ts` for HTC correlations
  - Consume existing `fallingFilmCalculator.ts` for shell-side coefficient
- **Tube count**: N_tubes = A / (π × d_o × L_tube)
- **Shell diameter**: From tube count + pitch + layout pattern
  - Triangular pitch: 1.3 × d_o standard
  - Bundle diameter from VDI/TEMA correlations
- **Tube material options**: Titanium, Al-Brass, Cu-Ni, Al-Alloy (with conductivity lookup)

### 3.2 Final Condenser Sizing

Same approach but:

- Shell side: vapor condensation (last effect conditions)
- Tube side: seawater flowing through (forced convection HTC)
- Multi-pass layout (typically 4 passes as in Excel)
- Tube count, shell diameter, nozzle sizing

### 3.3 Preheater Sizing

Per preheater:

- LMTD from vapor/seawater temperatures
- U from condensation (shell) + forced convection (tube) + fouling
- Surface area, tube count, shell diameter
- Match Excel "Preheaters" sheet calculations

### 3.4 Demister Sizing Per Effect

Consume existing `demisterCalculator.ts` for each effect:

- Vapor flow & density at effect conditions
- Wire mesh or vane type selection
- Required demister area → confirms shell diameter is adequate
- Pressure drop → feeds back to ΔT_demister in solver

### 3.5 Wetting Rate Verification

Consume existing `fallingFilmCalculator.ts` per effect:

- Feed spray flow per tube
- Minimum wetting rate check (Γ ≥ Γ_min)
- If insufficient: flag warning, suggest increasing recycled brine flow

### Deliverables — Phase 3

- [x] `equipmentSizing.ts` — evaporator, condenser, preheater sizing
- [x] Per-effect sizing results (area, tube count, shell diameter, bundle diameter)
- [x] Wetting rate verification per effect
- [x] Demister sizing per effect (Souders-Brown)
- [x] UI: Equipment sizing results table (matching Excel "Exchange Surf." sheet)
- [x] UI: Tube specification inputs (material, OD, thickness, length)
- [x] Dr. Rognoni reference comparisons — computed vs. fixed assumptions side-by-side
- [x] Expandable Accordion UI for Rognoni comparison (evaporator + condenser)
- [x] `equipmentSizing.test.ts` — 21 tests (evaporators, condenser, Rognoni comparisons, totals)
- [ ] Validate surface areas against Case 6 (1,447 m² per effect, 8 effects)

---

## Phase 4: Auxiliary Systems (Days 9–11)

> **Goal**: Size all auxiliary equipment — siphons, vacuum, NCG, piping manifolds,
> pumps — consuming the existing standalone calculators.

### 4.1 Siphon Sizing (Brine + Distillate)

**File**: `apps/web/src/lib/thermal/med/auxiliarySizing.ts`

Consume existing `siphonSizingCalculator.ts` for each inter-effect transfer:

- Brine siphons: Effect 1→2, 2→3, ..., N→brine pump
- Distillate siphons: Effect 1→2, 2→3, ..., N→final condenser or distillate pump
- Pipe size, depth, velocity, flash fraction

Match Excel "Siphons" sheet — brine siphons (rows 57–65) and distillate siphons (rows 68–76).

### 4.2 Vacuum System Sizing

Consume existing `vacuumSystemCalculator.ts`:

- Calculate NCG load from all effects (using `ncgCalculator.ts`)
- NCG from seawater deaeration + air leakage
- Size ejector train (typically 2-stage for MED)
- Inter-condenser duty
- Vent gas flow from each effect → total to vacuum system

### 4.3 Piping Manifolds

**File**: `apps/web/src/lib/thermal/med/pipingManifolds.ts`

- Spray water manifold: progressive diameter reduction as flow splits to effects
- Brine collection header: progressive diameter increase
- Distillate collection header: progressive diameter increase
- Pipe size selection from standard DN sizes (using `pipeService.ts`)
- Velocity check at each section

Match Excel "Summary Effects" sheet manifold sizing section.

### 4.4 Pump Sizing

Consume existing `pumpSizing.ts` for each pump:

- **Seawater pump**: Total intake flow, pressure from intake to final condenser + distribution
- **Brine pump**: Final brine flow, from last effect vacuum to atmospheric discharge
- **Distillate pump**: Total distillate flow, from condenser vacuum to storage
- **Brine recirculation pump**: Recycled brine for wetting (if applicable)
- **Chemical dosing pumps**: From `chemicalDosingCalculator.ts`

Each pump: TDH, hydraulic power, brake power, motor power (kW).

### 4.5 Nozzle Sizing

For each vessel (evaporator effects, final condenser):

- Inlet nozzle (spray water)
- Vapor inlet / outlet
- Brine outlet
- Distillate outlet
- Vent connection

Use `pipeService.ts` for standard pipe selection based on velocity limits.

### Deliverables — Phase 4

- [ ] `auxiliarySizing.ts` — siphons, vacuum, NCG integration
- [ ] `pipingManifolds.ts` — spray, brine, distillate headers
- [ ] Pump sizing for all plant pumps
- [ ] Nozzle schedule for all vessels
- [ ] UI: Auxiliary systems results (siphon table, pump schedule, nozzle schedule)
- [ ] UI: Vacuum system summary
- [ ] Validate siphon depths and pipe sizes against Case 6

---

## Phase 5: Datasheets & PFD (Days 12–14)

> **Goal**: Generate engineering datasheets for all major equipment and a
> process flow diagram with all stream data.

### 5.1 Evaporator Datasheet

**File**: `apps/web/src/lib/thermal/med/datasheetGenerator.ts`

Structured data matching standard format:

- Shell: diameter, length, thickness, material, design pressure/temperature
- Tubes: material (upper rows/lower rows), OD, thickness, length, count, pitch
- Tube sheets: thickness, material
- Water boxes: length, thickness
- Internals: demisters (type, area), spray system
- Operating conditions: per-effect temperatures, pressures, flows
- Design conditions: pressure, temperature, corrosion allowance

Match Excel "Evaporator Data Sheet" format.

### 5.2 Final Condenser Datasheet

Similar structure:

- Shell (kettle type): larger diameter, smaller water box diameter
- Tubes: material, geometry, multi-pass arrangement
- Nozzles: seawater in/out, vapor in, distillate in/out, vent
- Operating conditions

Match Excel "Final Cond Data Sheet" format.

### 5.3 Preheater Datasheets

One per preheater:

- Shell & tube geometry
- Operating conditions (vapor side, seawater side)

### 5.4 Process Flow Diagram (Interactive)

React SVG component showing:

- All effects with connecting streams
- Preheaters positioned correctly
- Final condenser
- TVC (if MED-TVC)
- Stream data on hover (flow, temperature, pressure, enthalpy)
- Color-coded streams (vapor=red, brine=brown, distillate=blue, seawater=green)

Match Excel "Edit PFD" sheet concept but interactive.

### 5.5 PDF Reports

Using existing `@/lib/pdf/reportComponents.tsx` framework:

**Comprehensive Design Report:**

1. Cover page (project data, revision, prepared/checked/approved)
2. Design basis (all inputs)
3. Overall H&M balance table
4. Effect-by-effect H&M balance (the "Interface" sheet equivalent)
5. Performance summary (GOR, STE, overdesign)
6. Equipment sizing summary
7. Auxiliary systems summary
8. PFD (static version for PDF)

**Equipment Datasheets** (separate PDFs):

- Evaporator datasheet
- Final condenser datasheet
- Preheater datasheets (one per)

### Deliverables — Phase 5

- [ ] `datasheetGenerator.ts` — structured datasheet data
- [ ] Evaporator datasheet PDF
- [ ] Final condenser datasheet PDF
- [ ] Preheater datasheet PDF
- [ ] Interactive PFD component (SVG)
- [ ] Comprehensive design report PDF
- [ ] UI: Tabbed results view (H&M Balance | Equipment | Auxiliaries | PFD | Datasheets)

---

## Phase 6: Costing & Economics (Days 15–17)

> **Goal**: CAPEX estimation, OPEX model, levelised cost of water, and
> life cycle cost analysis — completing the Excel's economic sheets.

### 6.1 CAPEX Estimation

**File**: `apps/web/src/lib/thermal/med/costModel.ts`

Equipment cost estimation (parametric):

- **Evaporator**: f(surface_area, material, # effects)
  - Base cost per m² of heat transfer surface (material-dependent)
  - Shell/structure cost scaling with diameter
- **Final condenser**: f(surface_area, material, # passes)
- **Preheaters**: f(surface_area, material)
- **Pumps**: f(flow, TDH, material)
- **Vacuum system**: f(NCG_load, # stages)
- **Piping & valves**: percentage of equipment cost (typically 15–25%)
- **Instrumentation & controls**: percentage (10–15%)
- **Civil & structural**: percentage (15–20%)
- **Electrical**: percentage (8–12%)
- **Installation & commissioning**: percentage (10–15%)
- **Engineering & supervision**: percentage (5–10%)
- **Contingency**: percentage (10–15%)

Cost inputs should be configurable (INR, USD, EUR) with exchange rate.

### 6.2 OPEX Model

Annual operating costs:

- **Electricity**: Total pump power × operating hours × electricity rate (Rs/kWh)
- **Steam**: Steam flow × operating hours × steam cost (Rs/ton)
- **Chemicals**: From `chemicalDosingCalculator.ts` outputs × chemical prices
  - Antiscalant, anti-foam, NaOH, HCl, cleaning chemicals
- **Manpower**: Configurable staffing model
  - Operators, maintenance, supervision
  - With contingency and overhead
- **Maintenance & spares**: Percentage of CAPEX (typically 2–3%)
- **Membrane replacement**: N/A for thermal (but include tube replacement reserve)

### 6.3 Cost of Water

```
Levelised Cost = (Annual Fixed Costs + Annual OPEX) / Annual Production

Annual Fixed Costs:
  - Depreciation: CAPEX × depreciation_rate
  - Interest: Outstanding_balance × interest_rate
  - Insurance: CAPEX × insurance_rate

Annual Production = Capacity × PLF × 8760 hours

Unit: Rs/m³ (or $/m³)
```

Match Excel "Cost of Water" sheet structure.

### 6.4 Life Cycle Cost Analysis

25-year (configurable) NPV analysis:

- Year-by-year cash flows
- CAPEX depreciation schedule (straight-line or declining balance)
- OPEX escalation with inflation rate
- Manpower cost escalation
- Discount rate for NPV
- Levelised cost per m³ averaged over plant life

Match Excel "Life Cycle Costs" sheet structure.

### 6.5 Sensitivity Analysis

Automated parametric study showing cost of water sensitivity to:

- GOR (±20%)
- Steam cost (±50%)
- Electricity cost (±50%)
- CAPEX (±20%)
- PLF (±15%)
- Interest rate (±5 percentage points)

Visualised as tornado chart or spider diagram.

### Deliverables — Phase 6

- [ ] `costModel.ts` — CAPEX, OPEX, cost of water, LCC
- [ ] CAPEX breakdown table
- [ ] OPEX breakdown table
- [ ] Cost of water summary
- [ ] Life cycle cost table (25-year)
- [ ] Sensitivity analysis charts
- [ ] PDF: Economic analysis section in design report
- [ ] UI: Economics tab with interactive inputs (rates, PLF, inflation)

---

## Phase 7: Scaling Analysis & Optimization (Days 18–19)

> **Goal**: Integrate fouling/scaling prediction to validate design parameters
> and add automated optimization to find optimal configurations.

### 7.1 Scaling Risk Assessment

Consume existing `foulingScalingCalculator.ts` per effect:

- CaSO₄ saturation index at each effect's temperature & concentration
- CaCO₃ saturation index
- Mg(OH)₂ risk (if pH > 8.5)
- Maximum safe TBT recommendation
- Antiscalant dosing requirement

This validates the designer's TBT and concentration factor choices.

### 7.2 Design Optimization

Automated search for optimal design parameters:

- **Objective**: Minimize cost of water (or maximize GOR, or minimize CAPEX)
- **Variables**: Number of effects, TBT, concentration factor, preheater positions
- **Constraints**: Scaling limits, minimum wetting rate, approach temperatures

Approach: Grid search over discrete variables (# effects) with continuous
optimization within each (TBT, concentration factor using golden section or similar).

### 7.3 Configuration Comparison

Side-by-side comparison table:

- MED vs MED-TVC for same capacity
- Different number of effects
- Different TBT ranges
- Cost of water comparison

### Deliverables — Phase 7

- [ ] Scaling risk assessment per effect in results
- [ ] Maximum safe TBT recommendation
- [ ] Basic optimization (grid search over key parameters)
- [ ] Configuration comparison mode (side-by-side)
- [ ] UI: Scaling risk indicators (green/yellow/red per effect)
- [ ] UI: Optimization panel with objective/constraints

---

## Phase 8: Graduate to Design Module (Days 20–23)

> **Goal**: Move from calculator to full design module with project integration,
> versioning, and multi-user collaboration.

### 8.1 Firestore Integration

- Save designs to project subcollection: `projects/{id}/medPlants/{designId}`
- Version history (each save creates a new revision)
- Design status workflow: DRAFT → IN_REVIEW → APPROVED → AS_BUILT
- Link to project procurement (generate BOM from equipment list)

### 8.2 Design Module UI

Move to `/thermal/(protected)/med-plant/`:

- Multi-step wizard for initial setup
- Real-time recalculation (debounced) as inputs change
- Tabbed results: H&M Balance | Equipment | Auxiliaries | PFD | Datasheets | Economics
- Revision comparison (diff between two design versions)
- Export: Full design package (PDF report + datasheets + data as JSON)

### 8.3 Bill of Materials

Generate BOM from design:

- Equipment list with specifications
- Piping materials (by size, schedule, material)
- Valve list
- Instrument list
- Estimated weights

### Deliverables — Phase 8

- [ ] Firestore collection schema and security rules
- [ ] Design CRUD service with versioning
- [ ] Design module layout and navigation
- [ ] BOM generation
- [ ] Status workflow (state machine)
- [ ] Revision comparison

---

## Phase 9: Advanced Configurations (Future)

> **Scope for later**: Advanced MED configurations and integrations.

- MED-MVC — mechanical vapor compression integration (using existing `mvcCalculator.ts`)
- Multiple-body evaporators (split shells)
- Dual-purpose (power + water) integration

---

## Cross-Cutting Concerns

### Testing Strategy

- **Unit tests**: Each model function (effectModel, preheaterModel, etc.) with known inputs/outputs
- **Integration test**: Full plant solve against Case 6.xlsx values (regression test)
- **Property tests**: Mass balance closes for any valid input combination
- **Benchmark tests**: Compare against published MED performance data (El-Dessouky & Ettouney Table 6.1)

### What to Do with the Existing GOR Calculator

- **Keep it** as a quick estimator (5-second answer vs full design)
- Update its description: "Quick GOR Estimate" vs the new "MED Plant Design"
- Link from GOR calculator: "Need a full design? → MED Plant Designer"
- The GOR calculator remains useful for early-stage feasibility when you don't need equipment sizing

### Performance Considerations

- The iterative solver should converge in < 1 second for 16 effects
- Use `useMemo` with debounced inputs (300ms) for live recalculation
- Equipment sizing can be computed lazily (only when that tab is viewed)
- PDF generation is async (Web Worker if needed for large reports)

### Unit System

- Internal calculations: SI (kg, m, °C, bar, kJ, kW, W/m²K)
- Display: Configurable (SI / Imperial) — but SI primary for thermal desal
- Currency: INR primary, USD/EUR configurable

---

## Summary Timeline

| Phase | Description                          | Days | Depends On    |
| ----- | ------------------------------------ | ---- | ------------- |
| 1     | Core thermodynamic engine + basic UI | 3    | —             |
| 2     | MED-TVC, desuperheating              | 2    | Phase 1       |
| 3     | Equipment sizing                     | 3    | Phase 1       |
| 4     | Auxiliary systems                    | 3    | Phase 1, 3    |
| 5     | Datasheets, PFD, reports             | 3    | Phase 3, 4    |
| 6     | Costing & economics                  | 3    | Phase 4       |
| 7     | Scaling analysis & optimization      | 2    | Phase 1, 3, 6 |
| 8     | Graduate to design module            | 4    | Phase 5, 6    |
| 9     | Advanced configurations (future)     | TBD  | Phase 8       |

**Critical path**: Phase 1 → 3 → 4 → 5 → 8
**Parallel track**: Phase 2 can run alongside Phase 3; Phase 6 alongside Phase 5

**Total estimated effort**: 23 working days (Phases 1–8), excluding Phase 9.

---

## Key Design Principles

1. **The solver is the heart** — get Phase 1 right and validated before moving forward.
   Every subsequent phase consumes the solver's output.

2. **Consume, don't duplicate** — every existing calculator (siphon, demister, vacuum, HX, pump, etc.)
   is called as a library function, not re-implemented.

3. **Match the Excel first, then exceed it** — validate every phase against Case 6.xlsx
   before adding capabilities the Excel doesn't have.

4. **Automate what the Excel makes manual** — the "digit by tentatives" iteration,
   preheater optimization, scaling checks, cost sensitivity.

5. **Progressive disclosure** — the basic H&M balance is useful on its own. Equipment sizing
   adds value. Costing completes the picture. Each phase delivers standalone value.

---

## Commit History

| Commit     | Description                                                              | Phase |
| ---------- | ------------------------------------------------------------------------ | ----- |
| `534fd3a5` | feat(thermal): add MED plant heat & mass balance calculator (Phase 1)    | 1     |
| `7022c251` | feat(thermal): add MED-TVC integration, remove forward feed and MSF      | 2     |
| `4d571a99` | feat(thermal): add MED equipment sizing (Phase 3)                        | 3     |
| `033865b0` | feat(thermal): add Dr. Rognoni reference comparisons to equipment sizing | 3     |
