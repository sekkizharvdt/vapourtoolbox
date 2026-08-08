# Dynamic Simulator Bridge — Next Stage Plan

**Date:** 2026-08-07
**Status:** PLAN — not started. Phase 0's two claim questions are **answered**; the specification refresh is still outstanding and still blocks phases 2–4.
**Supersedes as the active plan:** [2026-08-05 handoff](2026-08-05-simulator-bridge-handoff.md) (still the cold-start doc; items 5 and 6 there are unchanged and folded in below)
**Scope:** `apps/web/src/lib/ssot/`, `apps/web/src/lib/thermal/`, `packages/types/src/ssot.ts`, `docs/thermal/`

---

## Why this plan exists

The simulator session reported its status on 2026-08-07: **rungs 0–5 complete** (0, 1, 2, 3, 4, 4b, 5), 804 tests, specification at **r25**, its CLAUDE.md at **r16**. It named its next constraint as the **control definition** — rung 6 is level control, and loops, tuning, setpoints, ramps, interlocks, trips and sequence steps exist in no register.

That is a Vapour Toolbox deliverable, so the binding constraint has moved to this side. This plan says what to build, in what order, and what has to be decided first.

---

## Phase 0 — Refresh the context. Everything else is guesswork until this is done.

**This repo holds specification r2 (2026-07-29). They are on r25. Our simulator CLAUDE.md is r2; theirs is r16.**

Confirmable from their own citations, not just the version numbers: they cite **§8.5.4** for the shared flash-chamber/MED pressure boundary, and our r2's §8 contains only §8.0 and §8.1. Their §4.2 and §4.5 references _do_ match ours, so the early sections are stable and the rung ladder (0–8 with 4b) is unchanged — the drift is concentrated in the later sections, which is exactly where rungs 5–8 are specified.

Two concrete harms:

1. The handoff doc's "Read this first" table states r2 is current and instructs _"if the two ever disagree, r2 wins."_ That is now false and would send a cold-starting session to a nine-day-old document.
2. **§11 "Work required in Vapour Toolbox" — the table this whole plan is derived from — is r2's.** It may have been restructured entirely by r25.

**Actions**

- [ ] Obtain specification r25 and simulator CLAUDE.md r16; commit as `-r25` / `-r16` alongside the existing copies
- [ ] Fix the "Read this first" table and the "r2 wins" instruction in the handoff doc
- [ ] Re-read §11 (or its r25 equivalent) and correct phases 2–4 below against it
- [x] ~~Ask which rungs were gated against which fixture versions~~ — answered, see below

**Fixtures sent 2026-08-07:** `flash-chamber-cases.json` v9 and `metal-properties.json` v1. So the simulator now has real specific heats — half of the `M·c` its wall model needs. The other half, `M`, is Phase 1a below.

⚠ v9 went across with the stale `generatedBy` path still in it (see Phase 1). Relay a correction or send a fixed v10; the field is what a consumer reads to ask how the numbers were produced.

Still outstanding in this phase: the r25 / r16 documents.

### The two claim questions — asked and answered 2026-08-07

Asking first was worth it, though not for the reason predicted. The worry was that rungs 4/4b/5 rested on assumed inputs; the answer is that **the gates do not, and the time constants do** — a narrower and more useful finding than the one that was looked for. One concern is closed outright, the other moved to a different rung.

**Claim 1 — rung 4 metal properties. Confirmed assumed, but the gate is unaffected.** Their declared test inputs are 5,000 kg, 490 J/(kg·K), UA 4083 W/K, no source, labelled as such. Rung 4's gate asserts the steady state is identical to rung 3's, and that holds for **any** positive mass, cp and conductance: with no path to ambient, the wall's only steady state is thermal equilibrium with the contents, so its coupling term vanishes identically. It verifies to 1e-6 with any inputs. **Nothing rung 4 established is offset.**

What **is** offset is every **time constant** quoted — 565 → 2,155 s, 4,195 s at double capacity, the 4 s condensate mode at rung 5. Those are properties of a configuration, not gate results, and they are **ungated**. Their §8.4.3 conclusion was deliberately restated as a _ratio_ (the wall dominates only above ~8× holdup) precisely so it survives whatever `metalMassKg` turns out to be; the settling figures cannot be given that treatment.

→ **This is the real exposure, and it lands on rung 6, not rung 5.** Level control is tuned against time constants. Tuning against an unverified wall produces a controller matched to a plant whose thermal inertia nobody has measured. See Decision 5.

**Claim 2 — rung 4b insulation. Assumed, and rung 5 rests on none of it. CLOSED.** They assumed `UA_ambient = 300 W/K` at 25 °C ambient, no source. But rung 4b's gate is **self-consistency, not prediction**: it checks the equilibrium moves to where an independent three-balance solve puts it, using the same declared coefficients and none of the model's machinery, which holds for any `UA_ambient`. It establishes that the model's equilibrium is the balance's equilibrium — it says nothing about the plant's, and with an assumed coefficient it cannot.

And rung 5 uses neither: `Condenser.shell` defaults to `None`, and no rung 5 test or script constructs a `ShellThermalMass` or an ambient path. They checked rather than recalled. **The rung 5 exposure this plan worried about does not exist.**

---

## What `/check-duplicates` found — this changes the shape of the work

r2's §11 lists _"Instruments and valves (Cv, stroke, fail position) — not started"_. **That is wrong, and building from it would have created a parallel register.**

| Concept                                                    | Reality in this repo                                                                                                                                                               |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Instruments register                                       | **Exists.** `ProcessInstrument` (33 columns), `instrumentService.ts` + tests, `InstrumentsTab.tsx`, `instruments` security rules                                                   |
| Valves register                                            | **Exists.** `ProcessValve` (33 columns), `valveService.ts` + tests, `ValvesTab.tsx`, `valves` security rules                                                                       |
| Valve **Cv** and **fail position**                         | Declared on `ValveSpecs` in `packages/types/src/boughtOut.ts` — but **dead: never read or written anywhere**, and the data is not available (confirmed 2026-08-07). See Decision 1 |
| Valve **stroke time**                                      | Nowhere                                                                                                                                                                            |
| Control narrative / loops / setpoints / interlocks / trips | **Nowhere.** No `setpoint`, `deadband`, `controlLoop`, `interlock` or trip concept in types or lib                                                                                 |
| Commissioning data-capture spec                            | Nowhere                                                                                                                                                                            |
| Plant-model export (typed document)                        | Nowhere. `ssotSync` writes registers; nothing exports a plant model                                                                                                                |

So the work is **not** "build instruments and valves registers". It is:

1. **Add the missing dynamic fields to the existing registers**, not new ones — Cv, fail position and stroke time onto `ProcessValve` (Decision 1, now settled).
2. **Build the one genuinely new thing:** the control narrative register.
3. **Clean up the dead declarations** so the same quantity does not have two homes.

---

## Phase 1 — Close out what is already in flight

Re-ordered 2026-08-07: metal mass moved to the front. It stopped being a BOM tidy-up when their answer identified the wall time constant as rung 6's real exposure.

### 1a. Vessel metal mass — this is what unblocks rung 6, not just the BOM

Their `metalMassKg = 5000` is a placeholder. Turning it into a real number needs **M·c**:

- **`c` is done and undelivered** — `metal-properties.json` v1 carries specific heat for all ten grades. Send it.
- **`M` does not exist for the flash chamber.** The capability register lists both wall thickness and metal mass as **ABSENT** for that vessel: _"No shell in the model at all"_, _"No weight estimate exists for this vessel"_. The flash chamber is the vessel their rungs 1–5 are built on.

So the highest-value item in this plan is one nobody had listed:

- [ ] **Flash chamber shell mass from geometry.** Diameter and total height are already computed; combined with `ASSUMED_VESSEL_WALL_THICKNESS_MM = 6` and `ASSUMED_VESSEL_MATERIAL = 'ss_316l'` this gives a shell mass directly. ⚠ It inherits the 6 mm **assumption** and must ship labelled `ASSUMED`, exactly as the fixture does — a mass derived from an assumed thickness is an assumed mass, and publishing it as computed would be the "guard published as physics" failure. Also fills the `flashChamberGenerator` warning that currently says metal mass is blank because there is no geometric basis for one.

- [ ] **Item 5 (handoff) — condenser/preheater metal mass from geometry.** Replace `area × 50 kg/m²` (condenser) and `× 60` (preheaters) with a geometric calculation. Tube layout, count, dimensions and material are all already in the model. ⚠ **Moves BOM and cost numbers — show the deltas before committing.** Fix the preheater sizing/selection split in the same change, and only in the change that first publishes preheater heat transfer. Same family as 1a; do them together so the derivation is written once.

### 1b. The rest

- [ ] **Item 6 (handoff) — methodology rules into a new CLAUDE.md section** (home already decided). Six rules recorded in the handoff doc, plus a seventh from 2026-08-07: _a judgement that is genuinely case dependent should be presented, not defaulted_ — the NPSH margin ruling.
- [ ] **Stale `generatedBy` in `flash-chamber-cases.json`** — points at `scripts/thermal/generate-flash-chamber-fixtures.ts`, a path that does not exist. Real generator is `apps/web/src/lib/thermal/__generators__/flashChamberFixtures.gen.ts`. Bumps the fixture, so batch it.
- [ ] **`"fixtures:metal-properties"` script** in root `package.json` — deferred because another session held that file.
- [ ] **Generate the two holdup drums** — brine and distillate, each with its own equipment tag. No new code; the calculator, the NPSHr check and the tag-settable SSOT dialog all shipped this session.

**Then send what Phase 1 bumps.** v9 and `metal-properties.json` v1 already went across on 2026-08-07; the next send carries the `generatedBy` correction and any fixture the metal-mass work changes.

---

## Phase 2 — The control definition (the rung 6 blocker)

⚠ **Re-scope against r25 before building.** What follows is derived from r2 plus the simulator's 2026-08-07 report.

Rung 6's gate, as they state it: _"level returns to setpoint after a ±10% feed ramp with no sustained oscillation and no offset beyond the deadband."_ That needs a controller, and a controller needs tuning — which is an **engineering decision, not a design output**. Same category as liquid holdup, but larger and with no prior.

### 2a. Control narrative register — new

The only genuinely new register. Minimum per loop, to satisfy the gate above:

- loop tag, controlled variable, manipulated variable (the valve or VFD tag)
- setpoint and engineering range; deadband
- action (direct/reverse), controller type (P / PI / PID)
- tuning: gain, integral time, derivative time — **each tagged with whether it is a design value, a working assumption, or commissioned**
- output limits, ramp rates
- interlocks and trips: trigger condition, action, reset

### 2b. Extend the existing valve register — do not create a second one

- **stroke time** (open→closed, seconds) — genuinely absent
- **Cv** and **fail position** — resolve Decision 1 first
- link from control loop → valve tag

### 2c. Instrument register

Already carries `signalPLC`, `ioType`, `instRange` — enough for an I/O list. Check against r25 whether the simulator needs anything more (measurement lag / filter time constants would be the obvious dynamic additions).

**Every tuning number must carry its provenance.** A gain that reads as a design value when it was somebody's guess is the exact failure this collaboration keeps finding — a wrong time constant moves a transient, not an equilibrium, and every steady-state gate passes it.

---

## Phase 3 — Plant-model export

r2 lists a **typed plant-model document** as a rung-5 Toolbox deliverable, and it does not exist — `ssotSync` writes registers, nothing exports a model. The simulator has nonetheless cleared rung 5, so establish what it consumed instead before building this. It may have been superseded in r25.

Also still open from r2's §11 and unrelated to the above:

- pumps, vacuum and dosing in the equipment register (currently reported as warnings by `medDesignGenerator`, not generated)
- level → holdup helper and elevations for **MED** equipment (the flash chamber has both; MED has neither)

---

## Phase 4 — Commissioning data-capture spec

**The only item with an external deadline.** r2 §11: _"it must be in place before a plant commissions, or that opportunity is lost until the project after next."_

The simulator's own report says the model is uncalibrated and stays that way until commissioning data exists — §4.5 wants 1 Hz trends through startup plus the actuation log. The honest description of the model today is _"validated at steady state, unvalidated in its transients"_: every gate so far confirms where the model lands, nothing confirms how long it takes to get there.

This is a specification, not code. It is small, and it expires.

---

## Decisions needed before building

1. ~~**Where does a valve's Cv live?**~~ **DECIDED 2026-08-07 — `ProcessValve` carries its own columns.**

   The `catalogRef` reading was rejected on evidence: `ValveSpecs.cv` and `ValveSpecs.failPosition` are **declared and never read or written anywhere** in the app — `ValveSpecs` is consumed only by `buildValveSpecCode`, which touches `valveType`, `endConnection` and `operation`. And the Cv data is not available to populate them. A reference to an empty field is not reuse.

   So add to `ProcessValve`: `cv`, `failPosition`, `strokeTimeS`. Per project, per tag, which is also the right granularity — Cv is a property of the valve that was actually installed on that line, not of a catalogue model.

   ⚠ **Sub-decision — settled 2026-08-07: delete the dead `cv` / `failPosition` from `ValveSpecs`.** Zero code paths, so it is safe. Confirmed from the simulator side as well: their §4.3 lists valve **stroke time as a calibration parameter**, and stroke time is genuinely per-tag rather than per-model — a catalogue reference would have given one number for valves that stroke differently. Their note on the cleanup: _"two homes for one quantity is how the `metalMassKg` and duplex-density problems both started."_

2. **Who supplies the tuning values?** They are engineering decisions with no prior. Either they are entered per project and marked as assumptions until commissioning, or the register ships with no tuning at all and the simulator's gate stays out of reach. There is no third option where the toolbox invents them.
3. **Phase order.** Phase 1 is unblocked and small; Phase 2 is blocked on Phase 0. Recommendation: run Phase 1 while Phase 0's document exchange is in flight.
4. **Insulation specification** — they have assumed `UA_ambient = 300 W/K` at 25 °C with no source. Rung 4b's gate does not depend on it and rung 5 does not use it, so nothing is currently wrong — but any ambient-loss number that is meant to describe the plant needs a real insulation spec, and this side has never supplied one. Lower priority than it looked before their answer.

5. **Rung 6 scheduling — does control tuning wait for a real wall mass, or proceed provisionally?** ⚠ **New, and the sharpest decision in this plan.** Their own framing: rung 6 either waits for the metal fixture, or declares its tuning provisional and re-derives it later. Both are defensible; drifting into the second by default is not.

   The wait is shorter than it looks. `c` is already published and merely undelivered; `M` for the flash chamber is Phase 1a, which is a shell-area calculation off geometry that already exists. **Recommendation: do Phase 1a first and let rung 6 wait for it** — it is days, not weeks, and it avoids a controller tuned to a 5,000 kg placeholder.

   If it proceeds provisionally instead, the tuning must be **tagged provisional in the control narrative register from the first write**, not annotated afterwards. A gain that reads as a design value when it was fitted against a placeholder is precisely the class of defect this collaboration keeps finding.

---

## What shipped 2026-08-07 (context for the above)

| Commit     | What                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------- |
| `5f120622` | Flash chamber SSOT dialog reachable; dialog made source-agnostic, equipment tag settable |
| `f44408dc` | Preflight query-check no longer passes silently on `(protected)` paths                   |
| `c3ac88a2` | One NPSHa balance shared by both calculators; suction friction an explicit input         |
| `9f036168` | NPSHa checked against a real pump NPSHr; verdict at LG-L                                 |
| `6ff71f5f` | `metal-properties.json` v1 published                                                     |
| `462ffdbf` | NPSH margin decision presented rather than made                                          |

---

**Author:** Claude (AI-assisted session record)
**Date:** 2026-08-07
