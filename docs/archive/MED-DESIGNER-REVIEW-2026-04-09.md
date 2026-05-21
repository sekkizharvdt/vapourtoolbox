# MED Designer — Process Engineer + Software Tester Review

**Date:** 2026-04-09
**Scope:** Complete workflow audit of the MED thermal desalination plant designer
**Method:** First-principles review of every input, computation, and output

---

## 1. Executive Summary

The MED Designer has been through ~25 reactive patches. This document audits the entire
pipeline from a **process design engineer's** perspective (is the thermodynamics correct?)
and a **software tester's** perspective (is every input validated, every output consistent?).

**Overall assessment:** The core thermodynamics are sound (Sharqawy BPE, Chun-Seban HTC,
Nusselt condensation, enthalpy-based vapor production). However, there are **7 concrete
issues** that affect design accuracy, ranging from a minor formula error to a significant
circular dependency in equipment sizing.

---

## 2. Correct Engineering Workflow

A process engineer designing an MED plant follows this sequence:

```
1. PROCESS DEFINITION
   Given: Steam supply (flow, temperature), seawater conditions, site constraints
   Choose: Number of effects, preheater strategy, TVC if available

2. HEAT & MASS BALANCE
   Compute: Per-effect temperatures, vapor production, brine cascade, GOR
   Validate: Energy balance closes, salinity limits respected, positive driving force

3. EQUIPMENT SIZING
   Compute: Tube count, length, shell diameter per effect
   Validate: Wetting rate adequate, area margin positive, shell is man-entry (>1800mm)

4. AUXILIARY EQUIPMENT
   Size: Condenser, preheaters, spray nozzles, siphons, pumps, vacuum, dosing
   Validate: Nozzle coverage matches bundle width, pump TDH adequate

5. OPERATING ENVELOPE
   Check: Turndown to 30% load — wetting, siphon seals, condenser capacity
   Validate: Minimum stable load identified

6. PROCUREMENT
   Generate: BOM, instrument schedule, valve schedule, cost estimate
   Validate: All materials priced, weights reasonable
```

**The current 4-step wizard maps correctly to this sequence.** The step structure is sound.
No redesign of the wizard steps is needed.

---

## 3. Thermodynamic Audit — Issues Found

### Issue T1: Brine Outlet Salinity Formula (Minor, ~1% error)

**File:** `effectModel.ts` lines 368-371
**Current:** `avgBrineSalinity = (blendedSalinity + blendedSalinity * CF) / 2`
**Problem:** This averages inlet and an approximated outlet salinity, but the concentration
factor is already an approximation. The correct formula derives outlet salinity from mass balance.
**Correct:** `outletSalinity = blendedSalinity * totalInletMass / (totalInletMass - vaporProduced)`
**Impact:** <1% error in outlet brine enthalpy. Low priority but easy fix.

### Issue T2: Energy Balance Error Not Flagged (Safety)

**File:** `effectModel.ts` line 661
**Current:** Energy balance error is computed and returned but never checked against a threshold.
**Problem:** A large error (>0.5%) would indicate a model bug but goes undetected.
**Fix:** Add warning if `energyBalanceError > 0.5%` per effect in the engine's warning array.

### Issue T3: Distillate Flash Cap at 5% (Conservative)

**File:** `effectModel.ts` line 217
**Current:** `flashFraction = Math.min(0.05, Cp*dT/L)`
**Problem:** The 5% cap is arbitrary. For large temperature drops (e.g., E1 condensate at
65°C entering E6 at 45°C), actual flash can reach 3-4%. The cap is rarely hit in practice
but should be documented or validated against real plant data.
**Impact:** Negligible for normal operation. Document and leave.

### Issue T4: Convergence Only Checks Distillate (Adequate)

**File:** `medEngine.ts` lines 629-638
**Current:** Loop breaks when net distillate changes <0.1%.
**Problem:** Spray temperatures from preheaters may still be oscillating.
**Mitigation:** Preheater calculation is deterministic (no iteration within it), so spray
temps converge within 2-3 outer iterations. This is adequate.
**Recommendation:** No change needed, but add a secondary convergence check on max spray
temperature change as a diagnostic (warn if spray temps haven't stabilized).

### Issue T5: Temperature Profile is Uniformly Spaced (Design Choice)

**File:** `medEngine.ts` lines 236-263
**Current:** Effect saturation temperatures are equally spaced between steam and last-effect.
**Reality:** Equal temperature spacing doesn't give equal duty per effect because BPE and
thermal losses vary. However, this is the standard approach (El-Dessouky, WET Excel) because:

- The convergence loop adjusts feed flows to match actual distillate
- Non-uniform spacing is an optimization, not a correction
  **Recommendation:** No change. This is industry standard.

---

## 4. Equipment Sizing Audit — Issues Found

### Issue E1: Shell-Side HTC Bootstrap Problem (Significant)

**File:** `equipmentSizing.ts` line 273
**Current:** Chun-Seban falling-film HTC uses a fixed design wetting rate of 0.045 kg/(m·s).
**Problem:** Actual wetting rate depends on tube count, which depends on area, which depends
on HTC — circular dependency. If actual wetting rate is much lower than 0.045, the HTC is
optimistic -> area is undersized -> fewer tubes -> even lower wetting rate.

**Fix:** After initial sizing, recompute HTC with actual wetting rate. If HTC changes >5%,
re-iterate tube count. One iteration is sufficient (the dependency is weak).

```
Step 1: Size with assumed gamma=0.045 -> get tubeCount, nRows
Step 2: Compute actual gamma from spray flow / (2 * L * nRows)
Step 3: Recompute HTC with actual gamma
Step 4: If |HTC_new - HTC_old| / HTC_old > 0.05: resize with HTC_new
```

### Issue E2: Dual Tube-Counting Paths (Inconsistency)

**Files:** `shellGeometry.ts` line 112, `tubeBundleGeometry.ts` lines 318-400
**Current:** Two methods to count tubes in a half-circle bundle:

1. `countLateralTubes()` in shellGeometry.ts — uses circle geometry + 0.85 vapour lane factor
2. `calculateTubeBundleGeometry()` in tubeBundleGeometry.ts — full coordinate-based layout
   with actual vapour lanes, clearances, spray zone

**Problem:** Method 1 runs during equipment sizing (Step 6 of pipeline). Method 2 runs
during bundle refinement (Step 9). They can disagree by 10-15%, meaning the shell ID from
Step 6 may be wrong and bundle refinement has to hunt upward in 50mm increments.

**Fix:** Use the full geometry engine (Method 2) in equipment sizing. Remove the 0.85
heuristic. This means `findMinShellID()` should call `calculateTubeBundleGeometry()`.

### Issue E3: Bundle Width Heuristic in Auxiliary Equipment (Inconsistency)

**File:** `auxiliaryEquipment.ts` line 106
**Current:** `bundleWidthMM = shellID * 0.85` (hardcoded heuristic)
**Problem:** This approximation is used for spray nozzle sizing, but the actual bundle width
is computed later in bundle refinement. The pipeline order is:

```
Step 8: Auxiliary equipment -> spray nozzles sized with 85% heuristic
Step 9: Bundle refinement -> actual bundle width computed
```

**Fix:** Swap steps 8 and 9. Move auxiliary equipment after bundle refinement so spray
nozzles use actual bundle width. The only dependency (spray coverage width for wetting
cutback in refinement) can use a conservative default on first pass.

### Issue E4: Turndown Wetting Rate Approximation (Inaccurate)

**File:** `turndownAnalysis.ts` lines 54-56
**Current:** `approxTubesPerRow = sqrt(totalTubes / 2)` — very crude approximation
**Problem:** Actual tube rows have varying counts. This can be off by 20-30%, giving
false "not feasible" verdicts at part load.
**Fix:** Use `bundleGeometry.numberOfRows` from the design result (already computed in
bundle refinement). If not available, use `nRows` from equipment sizing.

### Issue E5: Condenser Shell ID Rule-of-Thumb (Minor)

**File:** `equipmentSizing.ts` line 582
**Current:** Shell ID = bundle diameter + 20mm
**Problem:** 20mm clearance is very tight for a condenser shell. Standard practice is
50-100mm depending on bundle size.
**Fix:** Use `shellID = bundleDiameter + Math.max(50, bundleDiameter * 0.05)` or similar.

---

## 5. Pipeline Order Audit

### Current pipeline order (designPipeline.ts):

```
1. Preliminary scenarios (lightweight estimates)
2. Resolve defaults
3. GOR configuration matrix
4. Convert to engine inputs
5. Solve H&M balance (medEngine)
6. Equipment sizing
7. Compose designer effect records + apply overrides
8. Auxiliary equipment (spray nozzles, pumps, vacuum, dosing)
9. Bundle geometry refinement
10. Final composition (geometry comparisons, turndown, weight)
```

### Issue: 8 before 9 is wrong

Auxiliary equipment (especially spray nozzles) needs actual bundle width from geometry
refinement. Currently uses 85% heuristic.

### Recommended order:

```
1. Preliminary scenarios
2. Resolve defaults
3. GOR configuration matrix
4. Convert to engine inputs
5. Solve H&M balance
6. Equipment sizing (with HTC iteration — Issue E1)
7. Compose designer effect records + apply overrides
8. Bundle geometry refinement (full geometry engine)
9. Auxiliary equipment (using actual bundle width from step 8)
10. Final composition
```

This swap fixes Issue E3 and makes spray nozzle sizing accurate.

---

## 6. Input Validation Audit (Software Tester)

### Step 1 — Design Inputs

| Input                 | Current Validation | Issue                                               | Fix                          |
| --------------------- | ------------------ | --------------------------------------------------- | ---------------------------- |
| Steam flow            | > 0                | OK                                                  | --                           |
| Steam temp            | > 0                | Missing: must be > last effect temp + total losses  | Add: steamTemp > swTemp + 20 |
| SW inlet temp         | > 0                | Missing: must be < steam temp                       | Add cross-validation         |
| SW salinity           | > 0                | Missing: must be < max brine salinity               | Add cross-validation         |
| Max brine salinity    | > 0                | Missing: must be > SW salinity                      | Add cross-validation         |
| Condenser approach    | > 0                | OK                                                  | --                           |
| Condenser outlet temp | Optional           | Missing: if provided, must be > swTemp + approach   | Add validation               |
| Number of effects     | 2-12               | OK                                                  | --                           |
| Preheater effects     | Checkboxes         | Missing: can't select E1 or last effect             | Add UI constraint            |
| Preheater temp rise   | > 0                | Missing: must be < (preheater vapor temp - SW temp) | Add upper bound              |
| Fouling resistance    | >= 0               | OK                                                  | --                           |
| Design margin         | >= 0               | OK                                                  | --                           |
| TVC motive pressure   | > 0 if TVC         | Missing: must be > steam saturation pressure        | Add validation               |

### Step 2 — Geometry

| Input               | Current Validation | Issue                                | Fix         |
| ------------------- | ------------------ | ------------------------------------ | ----------- |
| Tube count (fixed)  | > 0                | Missing: minimum to achieve wetting  | Add warning |
| Tube length (fixed) | > 0                | Missing: standard lengths (0.6-3.0m) | Add range   |
| Uniform margin      | >= 0               | OK                                   | --          |

---

## 7. Output Consistency Audit (Software Tester)

### Cross-step consistency checks:

| Check                                              | Status | Notes                          |
| -------------------------------------------------- | ------ | ------------------------------ |
| GOR in Step 1 summary = GOR in Step 3              | OK     | Same designResult              |
| Tube count in Step 2 = tube count in BOM           | OK     | BOM reads from designResult    |
| Shell ID in Step 2 = shell ID in BOM               | OK     | After bundle refinement        |
| Condenser area in Step 3 = condenser in BOM        | OK     | Same source                    |
| Total distillate in mass balance = total in BOM    | OK     | Same source                    |
| Preheater count in Step 1 = preheaters in Step 3   | OK     | Same designResult              |
| Wetting rate in Step 2 = wetting check in turndown | ISSUE  | Turndown uses sqrt approx (E4) |
| Spray nozzle coverage = bundle width               | ISSUE  | 85% heuristic (E3)             |

### Missing outputs (not shown to user):

| Output                          | Where Expected      | Status       |
| ------------------------------- | ------------------- | ------------ |
| Per-effect energy balance error | Step 2 or warnings  | NOT SHOWN    |
| NCG generation per effect       | Step 3 or auxiliary | NOT SHOWN    |
| Pump NPSH check                 | Step 3 auxiliary    | NOT COMPUTED |

---

## 8. What Does NOT Need Changing

These are confirmed correct by the audit:

- **BPE correlation** (Sharqawy et al. 2010) -- validated
- **NEA interpolation** (0.2-0.5C hot to cold) -- correct
- **Falling-film HTC** (Chun-Seban) -- industry standard
- **Nusselt condensation** -- correct for horizontal tubes
- **Dittus-Boelter tube-side** -- standard turbulent correlation
- **Energy balance framework** (boundary streams, no double-counting) -- correct
- **TVC integration** (motive + entrained to discharge) -- correct
- **Preheater chain** (series piping, descending effect order) -- correct
- **Per-effect spray temperature** with 2C approach cap -- correct
- **Wetting rate formula** (gamma = m/2LN) -- VGB standard
- **Temperature profile** (uniform spacing) -- industry standard
- **Carrier steam loss** (1%) -- reasonable approximation
- **Flash zone merged into spray pool** -- consistent with WET Excel
- **Wizard step structure** (4 steps) -- maps correctly to engineering workflow
- **BOM generation** -- complete with vacuum, dosing, nozzles, piping
- **Cost estimation** -- correctly async from Firestore materials DB

---

## 9. Prioritized Fix List

### Priority 1 — Affects Design Accuracy (implement now)

1. **E1: HTC iteration** — Add one re-iteration of shell-side HTC with actual wetting rate
   after initial tube sizing. File: `equipmentSizing.ts`

2. **E2: Unify tube counting** — Replace `countLateralTubes()` heuristic with
   `calculateTubeBundleGeometry()` in equipment sizing. Files: `equipmentSizing.ts`,
   `shellGeometry.ts`

3. **E3: Swap pipeline steps 8<->9** — Move auxiliary equipment after bundle refinement so
   spray nozzles use actual bundle width. File: `designPipeline.ts`

4. **E4: Fix turndown wetting** — Use actual `numberOfRows` from bundle geometry, not
   `sqrt(N/2)` approximation. File: `turndownAnalysis.ts`

### Priority 2 — Safety and Diagnostics (implement now)

5. **T2: Energy balance warning** — Add per-effect energy balance check; warn if >0.5%.
   File: `medEngine.ts`

6. **Input validation** — Add cross-validation between steam temp, SW temp, salinity limits,
   and preheater temp rise bounds. File: `Step1Inputs.tsx`

### Priority 3 — Minor Improvements (implement if time permits)

7. **T1: Brine salinity formula** — Replace approximate formula with mass-balance-derived
   outlet salinity. File: `effectModel.ts`

8. **E5: Condenser shell clearance** — Increase from 20mm to 50mm minimum.
   File: `equipmentSizing.ts`

9. **Spray temp convergence diagnostic** — Add secondary convergence check on spray
   temperature change. File: `medEngine.ts`

---

## 10. Implementation Plan

```
Phase A: Pipeline fixes (Issues E1, E2, E3, E4)
  - Swap steps 8<->9 in designPipeline.ts
  - Add HTC re-iteration in equipmentSizing.ts
  - Replace countLateralTubes heuristic with full geometry engine
  - Fix turndown wetting to use actual row count

Phase B: Safety and validation (Issues T2, input validation)
  - Add energy balance warning threshold
  - Add Step 1 cross-validation rules

Phase C: Minor improvements (Issues T1, E5, spray convergence)
  - Fix brine salinity formula
  - Increase condenser shell clearance
  - Add spray temp convergence diagnostic

Verification:
  - Type-check passes
  - All 1,199 thermal tests pass
  - Manual validation against BARC reference data
```
