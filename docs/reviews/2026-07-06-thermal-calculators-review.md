# Thermal Calculators — Full Suite Review

**Date:** 2026-07-06
**Scope:** All ~30 calculator routes under `apps/web/src/app/thermal/` and the ~32k-line calculation library in `apps/web/src/lib/thermal/`, reviewed from the basic property tools to the MED/MVC/TVC designers, plus the shared save/load infrastructure.
**Method:** Six parallel read-only review agents (basic properties, hydraulics, component sizing, tube bundles, MED/MVC/TVC, cross-cutting infra) + full test-suite run. All cited findings were verified against the actual code (several numerically).

**Test baseline: 32 suites, 1,144 tests, all passing** (Jest, `apps/web`).

**Status (updated 2026-07-13):** REMEDIATED — H1–H5, the condenser pairs, the quick wins, the medium batch, and one external anchor per calculator (all within 0.6% of hand-computed references) landed in the Phase-5 thermal commit. Remaining from this review: heat-duty/heat-transfer dead-client retirement (live panels import their exports) and the Track-F feature adds. Test baseline now ~1,217 thermal tests including the BARC per-effect golden snapshot.

---

## 1. What works

### The thermodynamic core is genuinely good

- **MED engine** (`lib/thermal/med/`): steam-in→distillate-out paradigm with GOR as a _result_, correct BPE handling (brine boils at `T+BPE`, vapor released at pure-water Tsat then degraded by NEA/demister/duct losses), NCG and carrier-steam tracking, preheater vapor diversion, robust capped-iteration convergence that warns instead of hanging, and per-effect energy/mass-balance closure checks. **Validated against three real plants in tests**: BARC MED-TVC (GOR 9.61, Ra 0.935 ±15%), IIT Madras (GOR 3.51 ±5%), condenser U pinned to the BARC 1700–1900 W/m²K band.
- **Γ_min = 0.03 kg/(m·s) gold standard is enforced** in `equipmentSizing.ts:200` with a 1.5× design target, used consistently across engine, sizing, and tests.
- **TVC** uses the GEA empirical entrainment curves (from the WET Excel program) validated in-code against BARC and Adani; **MVC** is textbook-correct (entropy bisection → isentropic efficiency → shaft/electrical power).
- **Tube-bundle geometry** (`tubeBundleGeometry.ts`): pitch/stagger/OTL/vapour-lane/exclusion math all verified correct, tested against the BARC as-built tube sheet (2380 mm shell, 1410 tubes).
- **Iterative HX design**: under-relaxed fixed-point on U, correct Dittus-Boelter / Nusselt / Kern / Mostinski correlations, heat-duty cross-checks with 10% mismatch warnings.

### Best-in-class individual calculators

- **NPSHa / suction system designer** — strongest in the suite: correct worst-case (dirty strainer) governing logic, thorough validation, reducer K referenced to the correct velocity, 909 lines of real closed-form tests.
- **NCG properties** — Weiss (1970) verified, Wilke/Wassiljewa mixture models correct, exemplary extrapolation flagging (UI chips + `[EXTRAPOLATED]` in Excel export).
- **Thermal expansion** — correct ASM mean-coefficient handling (the subtle part most tools get wrong), best test assertions in the hydraulics group.
- **Desuperheating** — exact energy balance on real IAPWS-IF97 properties, exemplary validation.
- **Chemical dosing** — exact core math, best test file in the component group (33 hand-computed `toBeCloseTo`).
- **GOR calculator** — best input validation in the suite; excellent UI (live Tsat helper, SVG temperature profile, loss budget).

### Infrastructure is largely rule-compliant

- `savedCalculationService.ts`: composite index present (rule 2), owner-scoped security rules at `firestore.rules:1589-1602` (rule 4), client-side soft-delete filter (rule 3), Timestamp conversion (rule 14).
- **Zero rule 30/30b violations** anywhere under `app/thermal/` — flash-chamber is the canonical exemplar and practices what it preaches.
- Every client computes via live `useMemo` from input state — the "stale results after input change" bug class doesn't exist in this suite.
- 24 calculators wire the shared Save/Load dialogs; 18 of 19 per-calculator dialog files are 1-line re-exports (good rule-32 hygiene).
- Calculator index: all 27 listed links resolve — no dead links.

---

## 2. What does not work

### HIGH severity

| #   | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Location                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| H1  | **Bowman F-factor formula wrong** for R outside ~[0.7, 1.3]: code uses `S = √(R²+1)/(R−1)` inside the log arguments where Bowman-Mueller-Nagle requires `√(R²+1)`. Verified numerically: P=0.5, R=0.5 → code F=0.5 (clamped) vs correct 0.942; P=0.2, R=3 → code 1.0 vs correct 0.935. Shell-and-tube/crossflow areas silently mis-sized up to ~2× (over for R<1, under for R>2). Multi-shell path inherits it. Tests only assert `0.7 ≤ F ≤ 1`, which is why it survived.                                  | `heatDutyCalculator.ts:190-197`                                   |
| H2  | **Falling-film & single-tube minimum wetting rate is ~100× too permissive**: El-Dessouky `0.11(μ²/ρσ)^⅓ ≈ 2.4×10⁻⁴ kg/(m·s)` vs the validated design standard Γ_min = 0.03. The wetting-status chip shows "excellent" at ~1% of the rate the MED designer requires — green-lights under-wetted bundles. Fix by surfacing 0.03 as the governing limit; do **not** touch the MED value.                                                                                                                       | `fallingFilmCalculator.ts:349-366`, `singleTubeCalculator.ts:216` |
| H3  | **Lateral-bundle nozzle exclusion zones are a silent no-op**: zones placed at `cx = +0.3·shellR` (the open side) while a `half_circle_left` bundle only has tubes at x ≤ hole radius — nearest tube ≥ 336 mm away vs max exclusion reach ~151 mm, so `tubesRemovedByExclusions` is always 0 and the results row is hidden when 0, so users never see their Ø175/Ø273 nozzle inputs did nothing. The lib's exclusion math is correct; only placement is wrong (BARC drawing has them inside the tube field). | `LateralBundleClient.tsx:79-96`                                   |
| H4  | **MED wizard save/load drops 8 design-affecting inputs** (rule 22): `bpeSafetyFactor`, `preheaterTempRise(+Map)`, `includeBrineRecirculation`, `antiscalantDose`, `vacuumConfig`, `shellsPerEffect`, `includeTurndown` are live `designMED` inputs but absent from save payload and restore — a reloaded design silently recomputes with defaults; areas, GOR and BOM can differ with no indication.                                                                                                        | `MEDWizardClient.tsx:1251-1275`                                   |
| H5  | **Two finished calculators are undiscoverable**: GOR (1,067-line client, save/load wired) appears nowhere in the index page's `ALL_CALCULATORS` and has zero inbound links; MVC is fully shipped but listed `status: 'coming_soon'`, rendering a disabled button.                                                                                                                                                                                                                                           | `calculators/page.tsx:120-461`, `:294`                            |

### MEDIUM severity — wrong numbers

- **Pressure-drop client hand-rolls water viscosity** (`PressureDropClient.tsx:48-51`), off −43% at 0°C to +166% at 100°C vs reference; `getSeawaterViscosity(0, T)` is already imported in the same file. One-line fix (also rule 32).
- **Siphon sizing: non-Sch-40 schedules are cosmetic.** Auto-select path falls back to Sch 40 dims (`siphonSizingCalculator.ts:531-538` → `pipeService.ts:810`), and even the override path recomputes friction on Sch 40 area (`:576-586`) — velocity and dP use different pipe IDs (~10–20% dP error for 6" Sch 80).
- **"Schedule 40" static table uses STD walls for NPS ≥ 12"** (`pipeService.ts:396-455`): true Sch 40 walls are 10.31–17.48 mm, not 9.53. Flow area overstated up to ~5.6% at 24" — exactly the MED brine/distillate line range. Feeds pressure-drop, siphon, suction, strainer.
- **CIP neat-acid quantity overstated by the neat-acid density factor** (+22% formic, +24% citric, +16% HCl), propagating into per-clean/annual/tank sizing. `chemicalDosingCalculator.ts:631-638`.
- **SEAWATER falls into the steam branch (Cp = 2.0) when salinity is undefined or 0** (`heatDutyCalculator.ts:270`) — 2× duty error for lib callers; UI masks it with a default.
- **In-tube condensation uses the external-tube Nusselt constant 0.725** instead of Chato 0.555, paired with full ΔT instead of film ΔT — two partially-cancelling errors in both `singleTubeCalculator.ts:284-289` and `fallingFilmCalculator.ts:433-443`. Falling-film laminar branch `0.821·Re^(−1/3)` also doesn't match the cited Chun-Seban form (`:409-417`).
- **Iterative HX condenser: wall-temp anchored at the wrong end** (`iterativeHXDesign.ts:667-674`, film ΔT overestimated ~2–3×, HTC low ~20–30%) **and no Kern N^(−1/6) bundle correction applied** (single-tube Nusselt used directly, HTC high 40–85% for 20–40 rows). The two partially cancel — fix together and re-baseline against the BARC 1800–1900 W/m²K figure.
- **Circular "design check" in falling-film and single-tube**: `requiredArea = Q/(U·ΔT)` where `Q = U·A·ΔT`, so excess area is always exactly 0 and "design area" is always 1.15× installed — the UI panel displays a meaningless number. `fallingFilmCalculator.ts:526-534`, `singleTubeCalculator.ts:395-399`. (Flash-chamber's `isBalanced` check is similarly tautological, low severity.)
- **heatExchangerSizing shell-selection fallthrough is dead code** (`heatExchangerSizing.ts:319-332`): bundles > 1524 mm return a raw non-standard shell ID with no "custom fabrication" warning, contrary to the code's intent.
- **LSI applied beyond its validity** (fouling-scaling): LSI is valid to ~4–10 g/L TDS; concentrated brine needs Stiff–Davis (S&DSI), which isn't implemented. Directional at best for 45–90 g/L.
- **Vacuum-system ejector entrainment is an ad-hoc heuristic** (±50% plausible motive-steam error vs HEI curves) with a silent Ra=0.2 fallback when enthalpy differences go non-positive; no motive>discharge validation. `vacuumSystemCalculator.ts:356-402`.
- **Dittus-Boelter applied with no laminar guard** in both heat-transfer page and the iterative design loop — laminar inputs silently get turbulent HTCs (several × high). `heatTransfer.ts:248-257`, `iterativeHXDesign.ts:218-236`.
- **Spray-nozzle flow silently extrapolates** beyond the catalogue pressure band (angles clamp, flows don't). `sprayNozzleCalculator.ts:2040-2047`.
- **Two conflicting Souders-Brown K tables** for the same physics: flash-chamber (`flashChamberCalculator.ts:62-66`) vs demister (`demisterCalculator.ts`) — inconsistent allowable velocities for a user sizing both (rule 32).

### MEDIUM severity — dead features, dead code, silent gaps

- **Vacuum-breaker has a Load button but no Save dialog** — nothing ever writes `VACUUM_BREAKER` saves; Load always shows an empty list. `VacuumBreakerClient.tsx:263-266`.
- **MED engine's `nea`/`demisterLoss`/`ductLoss` inputs are dead** — declared, passed by the pipeline, editable in the wizard UI, and never read by the engine (it computes its own). User edits to these knobs don't change the balance they think they're tuning. `medEngine.ts:84-89`, `MEDWizardClient.tsx:69-71`.
- **TVC suction-temperature branch is dead during iteration** (`effects` reset to `[]` before the check, `medEngine.ts:355/381-384`, `:839/855-857`) — reported TVC numbers are computed at a slightly different suction condition than the cascade used (~0.5–1°C, few % on Ra).
- **`MEDDesignerClient.tsx` (1,759 lines) is an unrouted parallel designer UI** — `med-designer/page.tsx` renders the wizard only. Classic rule-32 liability; delete after confirming no imports.
- **MED wizard swallows engine errors** (rule 27): `catch { return null }` around `designMED` and `generateMEDBOM` — user sees an empty placeholder instead of "No temperature driving force". `MEDWizardClient.tsx:225-227, 267-269`. (med-plant does it right.)
- **~1,400 lines of dead code**: `heat-duty/HeatDutyClient.tsx` and `heat-transfer/HeatTransferClient.tsx` — both routes are now redirects to heat-exchanger; only their `components/` subfolders are still imported.
- **`saveCalculation` doesn't strip `undefined`** (rule 12): raw state objects go straight into `addDoc`; any `undefined` field makes the save throw. One recursive strip in the service fixes all 24 call sites. `savedCalculationService.ts:36-43`.
- **Shared Save/Load dialogs default `calculatorType='SIPHON_SIZING'`** — any caller forgetting the prop silently saves into the siphon bucket. ncg-properties carries a full duplicated dialog pair relying on a changed default (rule 32); heat-transfer and desuperheating import theirs from `../siphon-sizing/components/`.
- **Motor selection silently caps at 1000 kW** (`pumpSizing.ts:132-140`) — a 1.2 MW requirement reports "1000 kW" with no warning.
- **heat-duty save/report round-trip loses `shellPasses`/`tubePasses`** (rule 22) — a saved 2-shell case reloads as 1 shell with a different corrected LMTD. `HeatDutyClient.tsx:445-493`. (`tubePasses` is additionally never used by the calc at all.)
- **GOR calculator's `tvcCompressionRatio` input is collected, saved, restored — and never used** (`gorCalculator.ts:77`). Its core GOR estimate is also a heuristic (`N × η × 0.95`, TVC boost applied to the full base) — treat as ±15–20% screening, not design.
- **`instrumentAccessoryGenerator.ts` has zero tests** while feeding procurement BOM quantities.
- **Central/custom bundle: rectangle never validated against the shell**; `BundleDiagram` draws a fictitious Ø2000 shell around rectangles and renders "Shell ID: mm". Lateral-bundle has six dead inputs presented as functional (spray flow/pressure, tube material/wall, …) and the lib's tested wetting features (`maxTubeFieldWidth`, spray-clearance derivation) are unreachable from any UI.
- **MED recirculation modeling question** (needs a domain decision): recirc is excluded from the H&M balance but labeled as sourced from the _last_ effect (coldest, max salinity) — the "near-equilibrium" justification only holds for per-effect recirc from an effect's own sump. `medEngine.ts:462, 918, 987-1024`.

### LOW severity (selection)

- Seawater-properties page: `parseFloat(...) || 0` computes confidently at 0°C when the field is cleared (dead `isNaN` guard).
- "m H₂O" labels on heads that are actually meters-of-fluid (pressure-drop, siphon, Excel exports) — ~9% for brine.
- Soft-deleted saves are unrecoverable and invisible (not in Trash, no restore/purge); repeated saves always `addDoc` (no overwrite) with no `limit()` on list.
- MED BOM: shell/tube-sheet thickness hardcoded 8 mm ignoring user overrides; dished-head count wrong for `shellsPerEffect > 1`; desuperheater spray water mass not routed into Effect 1; carrier steam (1%/effect) leaves the model unrecovered.
- MVC/TVC bisection bounds and K-clamps are silent at extremes; MVC result reports a suction temp 0.5°C off what was used.
- Wizard/plant clients run the full pipeline synchronously in `useMemo` on every keystroke — noticeable stall on 10–12-effect TVC configs.
- Rule 34 backlog suite-wide: no `PageHeader`/`useToast`/`LoadingState` anywhere in thermal (consistent house style: `CalculatorBreadcrumb` + h4); LoadCalculationDialog deletes without `useConfirmDialog`; scattered raw `.toLocaleString()`.
- Rule 35: `saveCalculation`/`listCalculations` not wrapped in `retryOnStaleToken` (low-stakes single writes).

### Test-quality caveat (why bugs H1/H2 survived a green suite)

1,144 passing tests, but most calculator tests are **self-consistent, not validating**: they mock the property layer (`jest.mock('@vapour/constants')`) and/or recompute expected values with the same formulas as the code. Only the MED engine (BARC/IIT Madras), tube-bundle (BARC tube sheet), NCG (Weiss), fluid properties (NIST), thermal expansion (ASM), and chemical dosing assert genuine external reference values. Heat-duty's F-factor tests assert only `0.7 ≤ F ≤ 1`; MVC has no absolute kWh/ton validation; vacuum-breaker's compressible-flow formulas have no pinned flux value.

---

## 3. What to add

### Quick wins (hours)

1. **Index-page fixes**: add the GOR entry, flip MVC to `available` — two lines that unlock two finished calculators.
2. **One-line viscosity fix** in PressureDropClient (`getSeawaterViscosity(0, T)`).
3. **Undefined-strip in `saveCalculation`** — fixes the whole class for 24 callers.
4. **Make `calculatorType` required** on the shared dialogs (delete the `SIPHON_SIZING` default); consolidate the ncg-properties copies and the `../siphon-sizing/` imports.
5. **Add warnings**: motor > 1000 kW, Re < 10 000 on Dittus-Boelter, spray-nozzle pressure out of catalogue band, vacuum-system motive ≤ discharge, vacuum-breaker 24 h cap hit.

### Correctness (the real fix list)

6. **Fix the Bowman F-factor** (H1) and add F-chart reference tests.
7. **Surface Γ_min = 0.03 as the governing wetting limit** in falling-film and single-tube (H2), showing the correlation value alongside.
8. **Flip the lateral-bundle exclusion-zone placement** (H3) and draw lanes/exclusions in `BundleDiagram` so geometry errors are visible.
9. **Complete the MED wizard save/load round-trip** (H4) + a test diffing save-payload keys against the `designMED` memo dependency list.
10. **Fix the paired condenser errors together**: iterativeHXDesign wall-temp anchor + bundle correction (re-baseline vs BARC); Chato 0.555 + film-ΔT iteration in single-tube/falling-film.
11. **Thread real schedule dims through siphon/pressure-drop**; correct or relabel the ≥12" "Sch 40" walls; extend Sch 10/80 tables to 24".
12. **Fix the CIP density factor**, the circular design checks, and the shell-size fallthrough.
13. **Wire or remove dead inputs**: MED NEA/demister/duct knobs, GOR `tvcCompressionRatio`, lateral-bundle spray/material fields, `velocityHead`.
14. **One external anchor test per calculator** (Crane example for pressure drop, GPSA demister case, El-Dessouky falling-film worked example, IAPWS-unmocked MVC kWh/ton, choked-flux pin for vacuum breaker) — the highest-leverage test investment; also a golden-case MED regression snapshot (per-effect temps/flows/areas, not just GOR).

### Feature additions (by value)

15. **`useSavedCalculation(calculatorType)` hook / `CalculationToolbar`** — collapses the 24× save/load boilerplate, gives one place for toast-on-save, undefined-stripping, overwrite-instead-of-duplicate, and retryOnStaleToken.
16. **"My Calculations" page** — one cross-type list (needs one new index: `userId + createdAt`), deep-linking into calculators via `?load=<id>`; doubles as the missing Trash/restore surface.
17. **Save/load for the bundle designers and thermal-expansion** (the bundle layouts are exactly what users want to recall) + vacuum-breaker's missing Save button.
18. **Cross-calculator pipelines**: pipe-sizing → pressure-drop → pump-sizing/NPSHa handoff; MED designer → falling-film → bundle designer; reference-projects deep links ("open these TVC conditions in the TVC calculator").
19. **Physics upgrades**: S&DSI for brine scaling (highest-value physics change in component group), CO₂/bicarbonate term in NCG, HEI/El-Dessouky ejector curves in vacuum-system, siphon crest-cavitation check, laminar Nu fallback, bundle-row/NCG correction option on the heat-transfer page.
20. **Surface `turndownAnalysis`/`gorAnalysis` in the MED wizard report step** — the engine is fast enough to sweep; the modules already exist.
21. **Debounce (300 ms) or web-worker the MED wizard/plant compute.**
22. **Consolidate PDF-report scaffolding** (~14 per-route copies) into a shared report shell; tube-position CSV/DXF export from the bundle table (feeds drilling drawings directly).
23. **Retire dead code**: `MEDDesignerClient.tsx`, `HeatDutyClient.tsx`, `HeatTransferClient.tsx`; move still-used `components/` out of redirect-only folders.

---

## Bottom line

The suite is in better shape than its size suggests: the hard parts (MED cascade, TVC entrainment, bundle geometry, NPSHa) are correct and in several cases validated against real plant data, the infrastructure follows the repo rules, and there is no stale-state bug class thanks to the live-`useMemo` house pattern. The genuine defects cluster at the edges: one wrong textbook formula (F-factor), one dangerously permissive threshold (wetting rate), silent no-ops (exclusion zones, dead MED knobs, Sch 10/80), lossy save/load round-trips, and two finished calculators nobody can find. The deepest structural weakness is test philosophy — green ≠ validated when tests mock the physics and re-derive expectations from the code under test; one external anchor case per calculator would have caught most of the high-severity findings here.
