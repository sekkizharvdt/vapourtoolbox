# Thermal Calculation — Hardcoded Constants Audit

**Date:** 2026-07-20
**Scope:** MED plant design chain and its shared thermal correlations (~29k LOC in `apps/web/src/lib/thermal/`).
**Trigger:** After rebuilding the vacuum-system sizing physics (which had an arbitrary `0.5 + 5·P` capacity ramp, a `Math.max(0.3, …)` clamp, a synthetic LRVP frame table, and hardcoded 15/33 °C references), we swept the rest of the thermal engine for the same bug class.

**How to read this:** Not every hardcoded number is a bug. Standard correlation coefficients (Nusselt, Dittus-Boelter, Kern), fouling factors, and design margins are legitimately constants. This audit flags the ones that are **invented/uncited and distort results**, **fragile (one change from silently breaking)**, **physics-masking clamps**, or **frozen operating assumptions a user should control**. Items are grouped by severity; nothing here has been changed — this is a review artifact for the domain expert to prioritise.

---

## A. Real correctness concerns in the MED designer's actual path

### A1. Chun-Seban shell-side HTC — two implementations disagree ~7× **[HIGHEST IMPACT]**

- **Files:** `med/equipmentSizing.ts:295-298` vs `fallingFilmCalculator.ts:419-430`
- The MED designer's evaporator sizing uses `h = 0.18·Re^0.24·Pr^0.66·filmGroup` — a **turbulent-form** correlation applied at **all** Reynolds numbers. The standalone falling-film calculator uses the **regime-branched** form: laminar `0.822·Re^-0.22` (Re<400), wavy `0.0038·Re^0.4·Pr^0.65`, turbulent `0.0065·…`.
- At the design wetting rate Γ=0.045 → Re≈360 (firmly **laminar**), the two give: `0.219·Re^0.46·Pr^0.66 ≈ 6.8×` — the equipmentSizing HTC is ~7× higher.
- **Effect:** higher HTC → smaller computed area, so the MED designer likely **under-sizes evaporators** vs the physically-correct laminar regime. The 0.18 coefficient is cited only to "WET Excel programs," not literature, and doesn't match Chun-Seban 1971.
- **Needs domain judgment:** if the 0.18 form was tuned to match plant data (BARC/Campiche/CADAFE), the standalone is the outlier; otherwise the sizing path is wrong. **Do not change without confirming which is validated.**

### A2. `?? 15` conductivity fallback — fragile, one annotation from recurrence

- **File:** `med/equipmentSizing.ts:302` (and `:573`): `MED_TUBE_CONDUCTIVITY[tubeMaterial] ?? 15`
- Currently **safe** (all `TubeMaterial` keys present), but `MED_TUBE_CONDUCTIVITY` is typed `Record<string, number>`, not `Record<TubeMaterial, number>` — TS won't catch a renamed/added key. If it ever mismatches, every affected material silently becomes 15 W/(m·K) (matches no real material). This is exactly the tube-material bug just fixed, latent.
- **Fix (no output change):** retype as `Record<TubeMaterial, number>`, drop the `?? 15` (or throw).

### A3. Flash-fraction cap `Math.min(0.05, …)` — invented

- **File:** `med/effectModel.ts:307-310, 328`
- Flash fraction is physically `Cp·ΔT/L`; capping at 5% silently under-counts flash vapour (and downstream cascaded vapour) whenever cascaded distillate/condensate enters more than ~30-40 °C above the effect temperature. Biases per-effect vapour production and GOR. No physical basis for 0.05.

### A4. Tube pitch ratio `1.315` hardcoded

- **Files:** `med/medEngine.ts:767, 804, 1010`; `med/equipmentSizing.ts:325` (comment "33.4/25.4")
- A frozen design choice (pitch/OD = 1.315, derived from one specific 1" tube) applied to any OD. Feeds shell diameter → demister/duct velocity → ΔP → temperature losses → GOR, and row count → recirculation. The user can already set OD/wall/length/material but **not** pitch. Disagrees with `ROGNONI_REFERENCE.pitchRatio = 1.3` and the standalone falling-film calc (which takes `pitchRatio` as an input). Should be a user input.

### A5. Frozen properties / geometry guesses that bias sizing by a constant

- `med/medEngine.ts:799, 1106` — `rhoL = 998` frozen liquid density in the Souders-Brown ratio (feeds demister velocity → ΔT → GOR) and the m³/day conversion; should track effect temperature (958-998 over the band).
- `med/equipmentSizing.ts:529, 682, 761` — condenser/preheater tube-rows hardcoded `?? 10` / `10` / `6` feeding the Kern factor `N^(-1/6)`; a fixed ~32% (N=10) HTC knockdown that does **not** track the actual bundle geometry the evaporator path derives.
- `med/equipmentSizing.ts:683, 762` — `ncgDegradation: 0.15` (condenser) / `0.05` (preheater): flat multipliers on shell-side HTC, not tied to any NCG-load calc (semi-cited to BARC/Campiche in `heatTransfer.ts:429`).
- `med/effectModel.ts:307` `TARGET_WETTING_RATE`/medEngine.ts:993 `0.045` = "1.5× the 0.03 minimum" — the round `1.5×0.03` chain sizes the reported recirculation flow; uncited.

---

## B. Frozen operating assumptions in the aux / vacuum wrappers (same class as the vacuum thread)

**File:** `med/auxiliaryEquipment.ts`. These feed vacuum motive steam, pump power, and utility totals; none are user-controllable.

- `:474` — `motivePressureBar: 8` — **every** MED plant sized for 8-bar motive steam, including solar/waste-heat/LRVP plants with **no steam**. Highest priority in this group.
- `:458-459` — `heiReductionFactor = 0.15` scaling HEI air-leakage → NCG load → motive steam. Generalised from **one** validation point (BARC 135.6 m³ → 0.875 kg/h); a plant with more flanged joints would be under-sized.
- `:462` — `suctionPressureMbar: lastEffectPressureMbar - 2` — hardcoded 2 mbar vent-line ΔP.
- `:353` — `?? 0.07` fallback suction pressure (70 mbar) on the brine pump — `??`-on-a-physical-quantity, silently substitutes if last-effect pressure missing.
- `:344, 362` — distillate/recirc pump suction pressures hardcoded (`0.08`/`0.06` step at 40 °C; `0.1`).
- `:372-373, 333-358` — pump friction ΔP (0.3/0.5 bar) and static heads (5/3/3/3 m), discharge pressures (2.0/1.5 bar) frozen for all services regardless of layout.
- `:426` — `solutionDensityKgL: 1.05` (Belgard EV 2050) hardcoded; wrong antiscalant → wrong chemical volume/storage/line sizing.
- `:513` — `ventFlowTh = vapourFlowTh * 0.02` (2% vent) — **inconsistent** with the 1.5% used in `gorCalculator.ts:427` (see E).
- `:64-71, 117-120, 171-212` — demister `designMargin: 0.8`, spray nozzle pressure/height, siphon salinity/safety/velocity — frozen design assumptions.

---

## C. Grounded clamps that mask silently (should warn, not necessarily change)

- `med/effectModel.ts` (many lines) — seawater-property salinity capped at `120000` ppm (Sharqawy 2010 validity ceiling — correct to cap), but the engine only **warns** at 60 g/L. High-recovery designs freeze BPE/enthalpy/density past 120 g/L with no result-level flag.
- `ncgCalculator.ts:290` — Weiss dissolved-gas temp clamped to `0-80 °C` (Weiss valid only to 36 °C; 36-80 silently extrapolated, >80 hard-clamped). Warm intake/deaerator can exceed this, silently flooring dissolved-gas content → vacuum motive steam.
- `heatTransfer.ts:557`, `equipmentSizing.ts:263` — ΔT floors `Math.max(…, 1)` / `Math.max(…, 0.5)` on condensation ΔT; since h ∝ ΔT^-0.25, flooring ΔT caps h. The 1 °C floor is arbitrary and overrides real sub-1 °C approaches. (The 0.1/0.05 floors inside the Nusselt/Chato helpers are legitimate div-by-zero guards.)
- `equipmentSizing.ts:396`, `heatTransfer.ts:552` — vapour density floored at `0.02 kg/m³`; negligible in Nusselt but under-sizes the demister at deep vacuum where real ρ_v < 0.02.

---

## D. Standalone GOR calculator — hand-wavy, but NOT in the MED designer path

**File:** `gorCalculator.ts`. This is the standalone "Performance Ratio / GOR" **screening** card (its own reference says "Screening Estimate"). It does **not** feed the MED designer (which uses the real `medEngine` solver). Lower priority, but should not be trusted for final numbers:

- `:403, 406` — `GOR = N·(ΔT_eff/ΔT_total)·0.95`; the `HEAT_LOSS_FACTOR = 0.95` flat multiplier and the "thermal efficiency = ΔT fraction" model are invented, not the cited El-Dessouky method.
- `:414-418` — MED-TVC boost `GOR × (1 + Ra)` can **double** GOR (Ra≈1); a hand-wave.
- `:427-428` — `netGOR = GOR − (1 − 0.015)`; the 1.5% vent loss is an uncited round number.
- `:200, 229-232` — NEA `0.2 + 0.3×fraction` linear ramp, invented endpoints.

## E. Cross-implementation inconsistencies (duplicate sources of truth that can drift)

- **Chun-Seban** (A1) — the big one.
- Titanium conductivity **21** (`medConstants.ts:21`, MED path) vs **22** (`fallingFilmCalculator.ts:55`, standalone) — duplicate material tables disagree.
- Vent fraction **2%** (`auxiliaryEquipment.ts:513`) vs **1.5%** (`gorCalculator.ts:427`) — two invented numbers for the same physical quantity.
- `tvcCalculator.ts:126-132` — nozzle/mixing/diffuser efficiencies (0.92/0.85/0.78) are **dead inputs**: advertised in the API and the header formula, stored and returned, but the actual entrainment ratio comes only from the GEA correlation (`:214-218, 357`). A user tuning "mixing efficiency" changes nothing. Also `:222` clamps compression ratio to [1.5, 4.0] silently (physics-masking clamp on the correlation input).

---

## Suggested order if/when we act

1. **A2 + E (titanium, vent%)** — zero output change, pure hardening/consistency; prevents recurrence of the just-fixed tube-material bug.
2. **B (aux hardcodes)** — especially `motivePressureBar` for steam-free plants; continues the vacuum thread.
3. **A3, A4, A5** — invented constants that bias MED sizing; each needs a value decision.
4. **A1 (Chun-Seban)** — highest impact, but **blocked on** confirming which correlation is validated against plant data.
5. **C** — add warnings to the grounded clamps.
6. **D** — either add prominent "screening only" caveats to the GOR card or rebuild it against the real method.

## What was checked and is clean (no action)

Standard, correctly-cited correlations: Nusselt condensation `0.943`/`0.725`, Chato `0.555`, Kern `0.36·Re^0.55·Pr^(1/3)`, Mostinski, Dittus-Boelter `0.023·Re^0.8·Pr^0.4`, the `N^(-1/6)` Kern bundle factor, `AREA_DESIGN_MARGIN = 0.15`, `GRAVITY`, the `wettingConstants.ts` single-source-of-truth (0.03 minimum validated against plant data, El-Dessouky theoretical min correctly quarantined as informational), and the NCG molar masses / gas constant / Weiss solubility coefficients.
