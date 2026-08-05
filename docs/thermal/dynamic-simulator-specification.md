# MED Dynamic Simulator — Specification

**Status:** Draft for review
**Date:** 2026-07-29
**Owner:** Sekkizhar
**Related:** `docs/thermal/thermal-calculator-architecture.md`, SSOT registers (`apps/web/src/lib/ssot/`)

---

## 1. Purpose

A dynamic (time-domain) simulator for MED desalination plants, to study behaviour that
steady-state calculators cannot describe: startup, shutdown, load changes, and the
response of control loops during those transients.

Every calculator in Vapour Toolbox answers _"what does the plant do once it has
settled?"_. This answers _"what does it do over the next two hours?"_.

### 1.1 What it is for

Defensible from day one, before any plant data exists:

- Developing and rehearsing startup and shutdown sequences
- Operator training
- Checking control philosophy and interlocks — does the level loop stay stable on a ramp?
- Sizing transient-driven equipment (vacuum pull-down time, thermal expansion during ramp,
  siphon seal establishment)
- Relative comparisons — "does 8 effects start slower than 6?"

### 1.2 What it is _not_ for, until calibrated

- Contractual startup-time or ramp-rate guarantees
- Root-causing a real plant upset
- Absolute performance prediction

### 1.3 Terminology

This is a **dynamic simulator**, not a digital twin. A twin is fed live plant data; no
such feed exists or is planned. The distinction matters because it sets expectations
about what the results mean.

---

## 2. Architecture decisions

### 2.1 Delivery model — a library first, with a GUI in a later phase

**Decision: build a local Python library driven by scripts and notebooks. A GUI is
planned and required, but deliberately deferred — see the phases below.**

The reason for deferring is sequencing, not principle. While the model's shape is still
changing, every hour spent on an interface is an hour not spent on whether the physics is
correct, and the interface would be rebuilt anyway. A GUI is justified as soon as someone
other than the author needs to use it — which is a firm requirement (§2.1.2), not a
hypothetical.

#### 2.1.1 What using it looks like in phase 1

Not a text-based or menu-driven program. **Code in, graphs out.**

```python
from medsim import FlashChamber, simulate

fc = FlashChamber(volume=8.2, holdup=2.1, pressure=100)
result = simulate(fc, scenario="cold_start.yaml", duration=7200)
result.plot(["level", "vapour_rate", "pressure"])
```

Three working modes:

- **Scripts** — repeatable, version-controlled runs. Where the validation tests live.
- **Jupyter / Marimo notebook** — day-to-day work: code cells with plots inline, notes
  between. Effectively an interactive interface that costs nothing to build.
- **Marimo with reactive widgets** — sliders that recompute the plots as they move, in a
  few lines. Close to a GUI for exploratory work, still just a file you run.

#### 2.1.2 Requirement: external expert review

Initial testing is by the author, but **the model must be reviewable by outside domain
experts who will not install Python or edit scripts.** Their input is a design goal, not
an afterthought — an unreviewed simulator is a simulator no one should trust.

Two distinct things experts need, and they are not the same:

1. **To judge the assumptions.** What was lumped, what was neglected, what is calibrated
   versus assumed, and how it was validated. This is what a good reviewer will challenge
   first, and it needs no interactivity at all.
2. **To explore behaviour.** Change an operating condition or a parameter and see what
   happens. This needs a real interface.

#### 2.1.3 Interface phases

| Phase | Interface                                             | Users            | Trigger                                      |
| ----- | ----------------------------------------------------- | ---------------- | -------------------------------------------- |
| 1     | Scripts + notebook                                    | Author           | Now                                          |
| 2     | **Run report** — self-contained HTML/PDF per scenario | Expert reviewers | First external review                        |
| 3     | **Hosted app** (Streamlit or Marimo)                  | Expert reviewers | Reviewers need to vary parameters themselves |
| 4     | **Results published into Vapour Toolbox**             | Engineering team | Simulation becomes routine project work      |

**Phase 2 is the one to plan for first.** A run report — assumptions, parameter values,
plots, steady-state validation results, and stated limitations, in one self-contained
file — gets useful expert critique with no infrastructure at all. Most review feedback
is about assumptions, not slider positions.

**Phase 3 is where hosting becomes justified.** The objection to cloud in phase 1 is that
it solves problems a single-user tool does not have. Once reviewers need to run scenarios
themselves, the requirement is genuinely multi-user and hosting is the right answer.
Streamlit or Marimo, deployed as a small container or on Streamlit Community Cloud.

**Phase 4** puts simulation results next to the plant model they came from, in the tool
that already has the users and the auth. Preferred over building a second standalone
application at any point.

#### 2.1.4 Design constraint this imposes now

Because a GUI is coming, the library must keep the model and solver strictly separate
from any presentation, **from the first commit**:

- A run must be **fully described by serialisable inputs** — plant model, scenario and
  parameter set — with no state hidden in a notebook cell.
- A result must be a **serialisable object** (trajectory plus metadata), not a
  side-effect of a plotting call. Formats are fixed in §6.1.2; the metadata that makes a
  result self-explaining later is listed in §6.1.1.
- Plotting and reporting consume that result object; they are never the only way to get
  at the numbers.

This costs nothing today and means every later interface — report, hosted app, Vapour
Toolbox — consumes the same artifacts instead of forcing a rewrite.

**Explicitly rejected at every phase:** a native desktop application. It carries
packaging, updates and per-platform support that a browser-delivered interface does not,
for no benefit to any of the users identified above.

### 2.2 Seawater properties — implement from the source paper

Vapour Toolbox already implements the **MIT correlations** (Sharqawy, Lienhard & Zubair,
_Desalination and Water Treatment_ 16:354–380, 2010) in
`packages/constants/src/thermal/seawaterTables.ts`, valid over **0–180 °C** and
**0–120,000 ppm** — comfortably covering MED brine conditions.

**Decision: implement the Python properties directly from the published paper, not by
transcribing the TypeScript.**

The reasoning matters. If Python is ported from TypeScript, the two agreeing proves
nothing — any transcription error already in the TypeScript is faithfully reproduced. If
Python is written independently from the paper, agreement between the two is a genuine
verification of both.

**But independent implementation is not sufficient on its own.** Both implementations are
transcriptions of the _same_ paper, so their error modes are correlated: a misread of an
ambiguous equation, or a typo in the published paper, reproduces faithfully in both and
they will agree on a wrong answer.

The verification hierarchy is therefore ordered, and the order is not optional:

| Rank | Reference                                                  | Status                                               |
| ---- | ---------------------------------------------------------- | ---------------------------------------------------- |
| 1    | Tabulated values published in the paper itself             | **Primary — required**                               |
| 2    | MIT reference MATLAB / EES output (`web.mit.edu/seawater`) | Primary — required where the paper tabulates nothing |
| 3    | Vapour Toolbox TypeScript output                           | Secondary cross-check                                |

Rank 3 alone is another codebase's current output, which CLAUDE.md rule 4 explicitly
forbids as a sole reference. It is retained because a disagreement between the two
implementations is still informative — it just cannot be the thing that establishes
correctness.

#### 2.2.1 Properties required, and the one that carries the most risk

Density, specific heat, enthalpy, thermal conductivity, dynamic viscosity, and
**boiling point elevation**.

**BPE is the highest-risk property in this project.** It sets the vapour temperature in
every flash and every effect, so an error propagates into the temperature profile of the
entire train. It is also the property most likely to differ between implementations at the
**0.1 °C** gate tolerance in §7.2 — the correlations for it are the least standardised of
the set, and Vapour Toolbox's own implementation notes that it follows Sharqawy Eq. 36
fitted to Bromley's data, which is one choice among several in the literature.

BPE therefore gets a tighter fixture tolerance than the other properties, and any
disagreement between implementations is investigated rather than averaged.

**Water and steam properties are not implemented at all.** Use `CoolProp`, which provides
IAPWS-IF97 directly — the same standard Vapour Toolbox implements.

### 2.3 Model fidelity — quasi-steady **steam**, non-condensables as a state

MED transients span a wide range of timescales. The distinction that matters is **not**
liquid versus vapour — it is between the two vapour components, which behave completely
differently:

| Component                  | Timescale     | Treatment                                |
| -------------------------- | ------------- | ---------------------------------------- |
| **Steam** (condensable)    | milliseconds  | **Quasi-steady** — no accumulation state |
| **Non-condensables (NCG)** | minutes–hours | **A state** — inventory is integrated    |

**Decision:**

1. **Steam is quasi-steady.** Its partial pressure is the saturation pressure at the
   liquid surface temperature, corrected for boiling point elevation. Steam generated and
   steam removed balance instantaneously; no steam mass state is carried.
2. **NCG mass in each vapour space is a state.** `d(m_ncg)/dt = leak_in − removed_by_ejector`.
3. **Total pressure is then explicit**, not implicit:
   `P_total = P_sat(T_liquid, salinity) + P_ncg(m_ncg, V_vapour, T_ncg)`, with
   `V_vapour = V_total − V_liquid` and `V_liquid` from the liquid mass and density states.

**The NCG is thermally slaved to the liquid surface: `T_ncg = T_liquid_surface`.** No NCG
energy state is carried. The justification is that the gas sits over a large liquid
surface and has a heat capacity three orders of magnitude smaller than the liquid it is in
contact with, so it equilibrates far faster than the minutes-scale processes that remove
it.

**What this gives up:** expansion cooling during a rapid pump-down, and the period at cold
start where the gas would lag the liquid as the liquid heats. Both are small at the
extraction rates a real ejector or LRVP achieves. If a scenario ever pumps down fast enough
for gas temperature to matter, the fix is to carry `u_ncg` as a state — not to add an
inner solve.

**This is an ODE system, not a DAE.** Every quantity is either integrated or computed
explicitly from integrated quantities. There is **no algebraic loop and no Newton solve
inside the derivative function** — which is deliberate, because an inner solve introduces
non-convergence mid-run and makes the outer integrator's error control only as meaningful
as the inner tolerance.

> **Rule:** if a future component appears to need an implicit relation, the default
> resolution is to promote the unknown to a state, not to add an inner solve. If an inner
> solve is genuinely unavoidable, its method and tolerance must be recorded in this
> specification and in the run's parameter set (§6.1).

**Why the distinction matters.** An earlier draft said simply "the vapour space is
quasi-steady", which reads as "no gas inventory states at all". That would make vacuum
pull-down unmodellable — pull-down time _is_ the integration of NCG inventory against
ejector capacity, so with no accumulation term there is no pull-down time and rung 3
(§8) would be excluded by a decision made five sections earlier.

**What this gives up:** sub-second steam-side transients — a sudden vacuum break, an
instantaneous duct pressure wave. Those are out of scope. (`vacuumBreakerCalculator` in
Vapour Toolbox already handles the vacuum-break case with proper time-stepping.)

If these modes later prove necessary, that is the trigger to reconsider Modelica —
a decision to make with evidence, not in advance.

#### 2.3.1 Stiffness and step size

The retained states span roughly two orders of magnitude in timescale — NCG inventory in
minutes, metal thermal mass in tens of minutes. **That is not, on its own, stiff.**
Stiffness usually bites several orders further apart, and §2.3 has just removed the fast
steam modes that would have caused it.

So the solver choice is **not** justified by an assertion about stiffness. `Radau` is a
safe default because an implicit method costs little at this problem size and tolerates
the discrete restarts in §6.5. **Measure rather than assert:** run rung 1 with `LSODA`,
which auto-switches between non-stiff and stiff methods and reports which it used. If it
never switches, `RK45` is adequate and cheaper. Record the finding in the lessons log.

**`solve_ivp` is adaptive** — the solver chooses its own step size, and there is no
"1-second step". Output at 1-second spacing is requested through `t_eval`, which
interpolates the dense solution and does not constrain the integration. Any estimate of
"number of steps" for a run is therefore meaningless as a cost model; measure wall-clock
instead.

---

## 3. Technology stack

| Layer        | Choice                              | Note                                                                                                                                       |
| ------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Language     | Python 3.12+                        |                                                                                                                                            |
| Environment  | `uv`                                | Python version, venv and lockfile in one tool                                                                                              |
| Integrator   | `scipy.solve_ivp` — `Radau` default | Stiffness is **measured, not assumed** (§2.3.1): profile with `LSODA` first. Escalate to CasADi + SUNDIALS only if scipy proves inadequate |
| Water/steam  | `CoolProp`                          | IAPWS-IF97. Version pinned and recorded in results (§6.1.1)                                                                                |
| Seawater     | Own module                          | MIT correlations, §2.2                                                                                                                     |
| Schema       | `pydantic`                          | Typed plant-model import with validation                                                                                                   |
| Data         | `numpy`, `pandas`                   |                                                                                                                                            |
| Trajectories | `pyarrow` (Parquet)                 | Result serialisation, §2.1.4                                                                                                               |
| Plots        | `matplotlib`                        | `plotly` from phase 2 (§2.1.3)                                                                                                             |
| Tests        | `pytest`                            |                                                                                                                                            |
| Lint/format  | `ruff`                              |                                                                                                                                            |

**Deliberately absent:** a units library (`pint`). Units are carried in field and variable
names instead (`temperature_c`, `flow_kg_s`) — the same convention Vapour Toolbox uses.
Scenario files follow the same rule, so no unit parsing is required anywhere (§6.2).

Separate git repository, **named `vapour-dynamics`** — different language and lifecycle
from Vapour Toolbox, and the app is explicitly not to carry this work.

### 3.1 Layout

```
src/medsim/
  properties/
    seawater.py        # MIT correlations, from the paper
    steam.py           # thin CoolProp wrapper
  models/
    base.py            # Component protocol
    flash_chamber.py
    vacuum.py
    condenser.py
    effect.py
  plant.py             # assembles components into one ODE system
  solve.py             # solve_ivp wrapper, event handling
  plantmodel.py        # pydantic schema for the SSOT export
  scenario.py          # operating scenario / action schedule
tests/
  fixtures/            # JSON exported from Vapour Toolbox
```

---

## 4. Inputs

Three categories, by origin.

### 4.1 Plant definition — from the Vapour Toolbox SSOT export

Generated from a completed MED design via
`apps/web/src/lib/ssot/medDesignGenerator.ts` and exported as a single typed document.

**Equipment** (per item):

| Field                           | Unit | Status               |
| ------------------------------- | ---- | -------------------- |
| `equipmentTag`, `equipmentType` | —    | available            |
| `shellIDmm`, `shellLengthMM`    | mm   | available            |
| `grossVolumeM3`                 | m³   | available            |
| `heatTransferAreaM2`            | m²   | available            |
| `metalMassKg`                   | kg   | available            |
| `liquidHoldupM3`                | m³   | **blank — see §4.4** |
| `elevationM`                    | m    | **blank — see §4.4** |

**Topology** — each equipment record carries `fluidIn[]` and `fluidOut[]` as stream tags.
The connectivity graph is derived from these; no separate topology input is needed.

**Streams** (per stream tag) — the design operating point:
flow (kg/s), pressure (mbar a), temperature (°C), salinity (ppm), density, enthalpy.

Used for two things: initial conditions for a run starting at design load, and the
steady-state target the dynamic model must reproduce (§7.2).

**Lines** — DN, selected ID, from/to equipment tags. For hydraulic resistance and vapour
duct pressure drop.

#### 4.1.1 Rungs 1–4 do not need SSOT

The single-vessel rungs are driven directly from the **flash chamber calculator's own
inputs and results**, delivered as fixtures (§7.1). No SSOT integration is required until
rung 5, when whole-plant assembly begins.

This matters for sequencing: the only Vapour Toolbox work blocking a start is the fixture
export.

#### 4.1.2 The flash chamber is not yet an SSOT source

`calculateFlashChamber` is currently a **standalone calculator with no SSOT integration** —
nothing writes a flash vessel into a project's equipment register, even though the
register's own worked examples are flash vessels (`LTFV`, `HTFV`).

Worth noting because the flash chamber calculator is, on this specific measure, **ahead of
the MED designer**: it already computes the two fields blank on every generated MED
equipment record.

| Simulator field    | MED designer      | Flash chamber calculator                                                         |
| ------------------ | ----------------- | -------------------------------------------------------------------------------- |
| gross volume       | ✓ `grossVolumeM3` | ✓ `chamberSizing.totalVolume`                                                    |
| **liquid holdup**  | ✗ blank           | ✓ **`chamberSizing.liquidHoldupVolume`**                                         |
| **elevations**     | ✗ blank           | ✓ **full set in `elevations`** (BTL, operating level, TTL, FFL, pump centreline) |
| heat transfer area | ✓                 | n/a                                                                              |
| metal mass         | ✓ `metalMassKg`   | ✗ — takes no shell thickness or material input                                   |

Two consequences:

1. **Flash chamber → SSOT generation is a genuine gap**, needed by rung 5 and justified as
   an engineering deliverable independently (§11).
2. **The MED designer should derive holdup the way the flash chamber already does** — from
   operating level and shell geometry. The problem is solved once already; it needs
   applying to the other generator rather than inventing.

Metal mass is the one field the flash chamber cannot supply, since the calculator takes no
shell thickness or material of construction.

### 4.2 Supplied separately — not in the export

These have no register in Vapour Toolbox yet and are supplied as configuration files in
the simulator repo until they do.

**Control definition** _(the largest gap)_

- Loops: measurement → controller → manipulated variable, with tuning
- Setpoints and their ramps
- Interlocks and trips
- Startup and shutdown sequence steps, with entry/exit conditions

Startup and shutdown are mostly a control-sequence story. Without this the simulator can
only be driven by hand-scripted actions.

**Valve and actuator data**

- Flow coefficient (Cv) and inherent characteristic
- Stroke time
- Fail position (fail-open / fail-closed)

**Boundary conditions**

- Seawater temperature and salinity
- Steam supply pressure, temperature and availability
- Atmospheric pressure
- Ambient temperature (for heat loss)
- **Vapour-space discharge** — the downstream pressure the steam leaves against, and the
  extraction capacity available. Required from rung 2, where the steam side closes but the
  condenser does not exist until rung 5. Without it rung 2 has nowhere to send steam and no
  closure. From rung 5 the condenser supplies it and this boundary is retired.

**Operating scenario** — the sequence of actions to simulate: what is started, when, and
what setpoint changes are applied.

### 4.3 Calibration parameters

A deliberately small vector, kept strictly separate from the physics so that calibration
is fitting ~10 scalars rather than editing equations:

| Parameter                                           | Why it matters                         |
| --------------------------------------------------- | -------------------------------------- |
| HTC multiplier — evaporator / condenser / preheater | Fouling and correlation error          |
| Liquid holdup per vessel (prior from §4.4)          | Level and concentration time constants |
| **Metal thermal mass multiplier**                   | Usually dominates startup duration     |
| Ambient heat loss coefficient                       |                                        |
| **NCG in-leakage rate**                             | Dominates vacuum pull-down             |
| Valve stroke times / actuator lag                   |                                        |
| Siphon seal establishment threshold                 |                                        |
| Vapour duct ΔP coefficient                          |                                        |

### 4.4 Inputs that require an engineering decision

**Liquid holdup is both a hand-entered input and a calibration parameter** — the entered
value is the prior, and §4.3 fits it against measured level and concentration response
once commissioning data exists. That is not a contradiction: an entered value that is
never revisited would be an assumption masquerading as data.

**`liquidHoldupM3` is the one number the design cannot produce.** It follows from the
operating level, which is a control setpoint, not a design output.

Mitigation: Vapour Toolbox should compute volume-per-mm-of-level from the shell geometry,
so the user enters an operating level and holdup is derived. That reduces the hand entry
to one number per vessel.

`elevationM` is likewise typed once per vessel.

### 4.5 Calibration data — future

From plant commissioning, not yet available:

- Process trends at **1 Hz** (or 5 s) through startup and shutdown windows. Minute
  averaging destroys the transients.
- **The actuation log** — pump starts, valve strokes, ejector cut-in, operator setpoint
  changes, with timestamps. _Without this the trend is nearly useless: a trajectory
  cannot be reproduced if what was done to the plant is unknown._ This is the single most
  commonly omitted item.
- Ideally one clean cold startup, one hot restart, one controlled shutdown.

---

## 5. Model architecture

### 5.1 State representation

Each component owns a named slice of one global state vector.

```python
class Component(Protocol):
    state_names: list[str]           # e.g. ["M_liq", "U_liq", "M_salt"]
    def derivatives(self, t, state, inlets) -> dict[str, float]: ...
```

`Plant` concatenates every component's states into a flat array, holds the index map, and
`Plant.rhs(t, y)` dispatches to each component and reassembles the derivative vector.
Components communicate only through explicit stream connections.

This is roughly 150 lines of framework — enough that adding a condenser does not disturb
the flash chamber, and not so much that it becomes a home-made Modelica.

### 5.2 Retained states

Per vessel:

| State                            | Symbol    | Introduced at |
| -------------------------------- | --------- | ------------- |
| Liquid mass                      | `m_liq`   | rung 1        |
| Liquid internal energy           | `u_liq`   | rung 1        |
| Salt mass                        | `m_salt`  | rung 1        |
| **NCG mass in the vapour space** | `m_ncg`   | rung 3        |
| Metal temperature                | `t_metal` | rung 4        |

**Total pressure is not a state.** It is computed explicitly from `m_ncg`, the vapour
volume and the liquid surface temperature (§2.3). Steam carries no mass state.

#### 5.2.1 Degenerate states — empty and near-empty vessels

**This is the most common way a dynamic process model dies**, and it will be hit during
cold start and blowdown, which are the primary use cases.

Intensive properties are recovered as `u_liq / m_liq` and `m_salt / m_liq`. As `m_liq → 0`
both diverge, and once `m_liq` goes negative — which an adaptive integrator will happily
do while probing a step — every downstream property call is meaningless or raises.

Required handling:

1. **A terminal event on `m_liq` reaching a small positive floor** (`m_min`, of order the
   mass in a few millimetres of level). The run stops there and the vessel enters the dry
   state defined below.

**The dry state does not change the shape of the state vector.** §5.1 builds a fixed
global vector with a fixed index map, and mid-run resizing is not supported. Instead:
`m_liq`, `u_liq` and `m_salt` are held at their floor values and their derivatives forced
to zero, while every other component continues to integrate normally. The vessel is marked
dry in the component's own configuration, which is part of the restart state, not the
integrated vector.

**Conservation must account for the residual.** `m_min` and the salt it carries are still
in the system. A dry transition that drops them looks exactly like a leak to the §7.3
check, so the closure test carries the floored inventory explicitly rather than
subtracting it. 2. **Guard intensive-property recovery**: below `m_min`, hold the last valid intensive
values rather than dividing. 3. **Never clamp silently.** A clamp that hides a vessel emptying converts a modelling
error into a plausible trajectory. Clamping is logged as an event and appears in the
result (§6.6). 4. **Conservation checks (§7.3) must span the dry transition**, or a vessel emptying
becomes a way to lose mass without noticing.

The same applies to a vessel going liquid-full: the vapour volume goes to zero and the NCG
partial pressure diverges. Mirror the treatment.

#### 5.2.2 Level is derived, not a state

Level comes from liquid volume through the vessel's geometry. For a **horizontal
cylinder** the relation is a circular segment, and `dV/dh → 0` at both the bottom and the
top — so `dh/dV → ∞` there, and level becomes hypersensitive to small volume changes near
empty and near full.

Consequences:

- Each component exposes a defined `level_from_volume` map, and its inverse, as an
  explicit function — the same map the Vapour Toolbox level→holdup helper needs (§11), so
  it should be written once and shared in shape if not in code.
- **Prefer events on mass or volume rather than level** where the physical trigger allows
  it. Level-based events near the vessel extremes are ill-conditioned for root-finding —
  see §6.6.

### 5.3 Sequencing principle

**Order development by structural commitment, not component simplicity.** Anything that
changes the shape of the state vector goes early; anything additive goes later.

The consequence: **the NCG inventory must become a state early** (rung 3). Building
several components with total pressure imposed as a boundary condition and adding the
vacuum system last would require restructuring everything, because pressure moves from a
prescribed input to a quantity computed from an integrated inventory.

Note this is a statement about _gas inventory_, not about pressure itself — pressure never
becomes a state (§2.3).

---

## 6. Scenarios and events

How the model is driven. A scenario is what turns a set of equations into a run you can
look at — "start from cold, pull vacuum over twenty minutes, start the recirculation pump
at ten minutes, open blowdown when the level reaches high".

### 6.1 A run is fully described by three artifacts

```
plant model  +  parameter set  +  scenario   →   run
```

The **parameter set has two parts**, and both belong to the answer:

| Part          | Contents                                                                                           |
| ------------- | -------------------------------------------------------------------------------------------------- |
| **Physical**  | The calibration vector of §4.3 — HTC multipliers, holdup, metal mass, NCG in-leakage, stroke times |
| **Numerical** | `method`, `rtol`, `atol`, `max_step`, event tolerance                                              |

No exceptions, and no hidden state in a notebook cell. This is the §2.1.4 constraint
applied concretely: it is what makes a run reproducible six months later, what lets the
validation suite re-run every case automatically, and what lets a later interface (report,
hosted app, Vapour Toolbox) drive the model without touching its internals.

**Numerical settings are not an implementation detail.** They change the trajectory, and
§7.3 asserts conservation "within integrator tolerance" — which makes the tolerance part of
the answer. Keeping them in the parameter set rather than as loose function arguments is
what makes a run reproducible from files alone.

#### 6.1.1 Result metadata

A result file must record enough to explain itself when opened later without the repo:

- `medsim` version and git commit
- Plant model, parameter set and scenario **schema versions**
- **`CoolProp` version** — its IF97 backend output can change between releases, so a
  trajectory computed on one version is not guaranteed reproducible on another
- Seawater property module version
- Solver settings actually used, and the solver's reported status
- Every event that fired, with time and the change applied (§6.6)

`uv.lock` pins the development environment; it does not travel with a result file that
someone opens in two years.

#### 6.1.2 Serialisation format

- **Trajectory** — Parquet (`pyarrow`). Columnar, typed, compresses well, and reads
  directly into `pandas` or any of the later interfaces.
- **Metadata, scenario, parameters** — JSON alongside it.

Chosen over netCDF because the data is a flat time series with named columns, not a
multi-dimensional gridded field, and Parquet has the lighter dependency.

### 6.2 What a scenario contains

**Boundary conditions**, which may vary with time — seawater temperature and salinity,
steam supply pressure and availability, ambient temperature, atmospheric pressure.

**Actions**, with two trigger types:

| Trigger         | Example                               | Represents                |
| --------------- | ------------------------------------- | ------------------------- |
| **Time-based**  | "at t = 600 s, start the recirc pump" | An operator step          |
| **State-based** | "when level > 1.2 m, open blowdown"   | An interlock or auto step |

**Units are carried in key names, never in values.** `temperature_c: 30`, not
`temperature: 30 degC`. This keeps the scenario consistent with the naming rule applied
everywhere else, and means the loader is plain YAML with no unit-parsing dependency.

```yaml
initial_condition: cold_flooded # see §6.8

boundary:
  seawater_temperature_c: 30
  seawater_salinity_ppm: 35000

actions:
  - at_s: 0
    do: ramp_pressure # rung 1–2: prescribed. From rung 3 the vacuum system sets this.
    to_mbar: 100
    over_s: 1200

  - at_s: 600
    do: start_pump
    id: P-RECIRC
    ramp_s: 5

  # Prefer mass/volume triggers over level near the vessel extremes — §5.2.2, §6.6
  - when: liquid_volume_m3 > 1.85
    do: open_valve
    id: BV-BLOWDOWN
    stroke_s: 8
```

### 6.3 Interlocks belong to the plant, not the scenario

A state-based action in a scenario is a one-off for that run. A genuine **interlock** is
always armed, on every run, and belongs to the control definition (§4.2) alongside the
loops and setpoints.

Keeping them apart matters: it means you cannot accidentally write a scenario that
"forgets" a trip, and it means the interlock set is reviewable as a thing in its own
right — which is exactly what a controls reviewer will ask to see.

### 6.4 Nothing is instantaneous

Actuators have dynamics, and modelling them as step changes is both physically wrong and
numerically unhelpful.

- **Valves** stroke over 5–15 s. Valve position is a state (or a scheduled ramp) and flow
  is computed from position via Cv and the characteristic. This is why stroke time and Cv
  are required inputs (§4.2).
- **Pumps** reach speed in a second or two. Model as a ramp over spin-up. The true
  hydraulic transient is faster than this model resolves (§2.3) and is not represented.
- **Setpoint changes** are ramps unless there is a specific reason to step them.

A step change makes a startup look unrealistically abrupt and forces the integrator to
take tiny steps across the discontinuity for no physical reason.

### 6.5 Discrete changes must stop and restart the integrator

**This is the single most important implementation detail in this section.**

The intuitive approach — testing a condition inside the derivative function:

```python
def rhs(t, y):
    if level(y) > 1.2:        # WRONG
        flow = OPEN_FLOW
```

breaks the solver. The derivative becomes discontinuous partway through a step, so the
integrator's error control either rejects steps repeatedly and crawls, or silently
integrates across the jump and produces a wrong answer.

The correct structure uses `solve_ivp`'s event mechanism:

1. Express each condition as a scalar function crossing zero (`level - 1.2`).
2. Mark it `terminal=True`.
3. The solver locates the crossing precisely and stops.
4. Apply the discrete change to the configuration.
5. Restart integration from that state.

A run is therefore **a sequence of continuous segments joined at events**, not one
continuous solve. Segments are concatenated into a single trajectory on output.

Non-terminal events are also useful for pure observation — recording when a threshold was
crossed without interrupting the solve.

**Build this loop at rung 1**, even though rung 1 has no events. Retrofitting it later
means restructuring the solve path and every caller.

### 6.6 Event ordering, conditioning and edge cases

- Two events crossing within one step: process in the order the solver reports them,
  re-checking conditions after each, since applying one may falsify another.
- An event whose condition is already true at the restart point must not re-fire
  immediately — arm events only on a crossing, not on level.
- Every fired event is recorded in the result with its time and the change applied. That
  log is what makes a trajectory explicable rather than mysterious.
- Clamps and floors (§5.2.1) are recorded as events too. A silent clamp turns a modelling
  error into a plausible trajectory.

**Conditioning.** An event function should be well scaled and monotone near its root.
Level-based events in a horizontal cylinder are neither near the vessel extremes: `dh/dV`
diverges as the vessel approaches empty or full (§5.2.2), so the event function changes
extremely rapidly for a small change in state and the root-finder's bracketing degrades.

Where the physical trigger permits, **express the event in mass or volume** and report
level as a derived quantity. Where a level trigger is genuinely required — an operator
setpoint really is a level — keep it, but do not place level triggers within the top or
bottom 10% of the vessel without checking that the event resolves cleanly.

### 6.7 Live intervention — deferred

Pausing a running simulation to change something by hand (the operator-training mode) is
**not in version one**. It requires an interruptible solve loop, and it breaks the §6.1
guarantee that a run is reproducible from files.

If it is built later, every intervention must be logged with its timestamp so that a
session can be replayed as a scenario. This is the same lesson as the commissioning
actuation log (§4.5): a trajectory you cannot reproduce is a trajectory you cannot learn
from.

Scripted scenarios cover procedure development, control checking, and every expert-review
use case identified in §2.1.2.

### 6.8 Initial conditions

A scenario names an initial condition; the named conditions are defined here, and each
must produce a **complete and physically consistent** state vector.

| Name           | Definition                                                                                                                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cold_flooded` | Vessel at ambient temperature, liquid at the normal operating level, salinity at feed salinity, metal at ambient. **`P_ncg = P_atm − P_sat(T_liq, salinity)`**, so total pressure comes out at atmospheric |
| `cold_empty`   | As above but liquid mass at `m_min` (§5.2.1) — the dry state, used for fill sequences                                                                                                                      |
| `hot_standby`  | Vacuum held, liquid at operating level and saturation temperature, no feed or product flow                                                                                                                 |
| `design_point` | Every state set from the SSOT design-point streams (§4.1)                                                                                                                                                  |

> **Note the NCG partial pressure.** Setting `P_ncg = P_atm` would give
> `P_total = P_atm + P_sat(T_liq)` ≈ 1055 mbar at 30 °C — not atmospheric, so the vessel
> would start slightly pressurised. The air partial pressure is what remains after the
> vapour takes its share. Every cold start begins here, so the error would be present in
> every startup run.

**Consistency is a requirement, not an aspiration.** Because §2.3 keeps the system a pure
ODE with no algebraic loop, a consistent initial state is _constructed directly_ — set
`m_liq`, `m_salt` and `t_metal`, derive `u_liq` from temperature and composition, derive
`m_ncg` from the specified partial pressure and vapour volume. There is no initialisation
solve.

This is a concrete benefit of the §2.3 decision worth stating: had any quantity been left
algebraic, every initial condition would have required its own consistent-initialisation
solve before the run could start, with its own convergence failure modes.

Each named condition is asserted in tests to satisfy the conservation checks (§7.3) at
`t = 0` before any integration occurs.

---

## 7. Validation

### 7.1 Property verification

The highest-risk silent-error step in the project: a subtly wrong correlation produces
plausible results forever.

Verification is layered, in the order set out in §2.2, and the order matters:

1. **Against values tabulated in the source paper** — the primary reference. This is the
   only check that is independent of any implementation.
2. **Against MIT reference MATLAB/EES output** where the paper tabulates nothing.
3. **Against a grid exported from `@vapour/constants`** — temperature × salinity for
   seawater, saturation states for steam — as a secondary cross-check.

Layer 3 alone would violate CLAUDE.md rule 4, which forbids asserting against another
codebase's current output. It earns its place as a cross-check, not as the thing that
establishes correctness: because both implementations transcribe the same paper, they can
agree on a misread equation. Layers 1 and 2 are what break that correlation.

**Boiling point elevation carries the tightest tolerance** (§2.2.1) — it sets vapour
temperature everywhere and is the property most likely to miss the 0.1 °C gate in §7.2.
A BPE disagreement between implementations is investigated, never averaged or split.

### 7.2 Steady-state gates — the core of the validation strategy

**The dynamic model, run to equilibrium, must reproduce the corresponding Vapour Toolbox
steady-state calculator.** Automated as a test at every rung.

| Rung          | Reference               | Compared quantities                                                            |
| ------------- | ----------------------- | ------------------------------------------------------------------------------ |
| Flash chamber | `calculateFlashChamber` | `heatMassBalance`: inlet / vapor / brine flow, temperature, pressure, enthalpy |
| Condenser     | `heatExchangerSizing`   | duty, outlet temperatures, LMTD                                                |
| One effect    | `medEngine` per-effect  | vapour and brine flow, temperatures, brine salinity                            |
| Full train    | `designMED`             | GOR, total distillate, per-effect profile                                      |

Tolerance: 0.5% relative on flows and duties; 0.1 °C on temperatures.

This is an unusually strong position. Most dynamic simulators have nothing to check
against until commissioning. Here every rung has a validated reference available today,
with no plant data. It makes the honest description **"validated at steady state;
unvalidated only in its transients"** — and it means commissioning data only has to
confirm the time constants, not the physics.

#### 7.2.1 Gates for rungs with no external reference

Not every rung adds a component that Vapour Toolbox can independently check. Those rungs
are **not ungated** — they use the invariant that makes them safe:

| Rung                      | Gate                                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2 — vapour balance        | Conservation (§7.3), plus the **round-trip check** below                                                                                                           |
| 3 — NCG inventory         | Pull-down curve against `vacuumSystemCalculator`, two parts, below                                                                                                 |
| 4 — metal thermal mass    | **The steady state is identical to rung 3**, with ambient heat loss disabled                                                                                       |
| 4b — ambient heat loss    | Energy closure including the loss term; equilibrium moves by no more than the loss/duty ratio                                                                      |
| 6 — pumps + level control | Level returns to setpoint after a ±10% feed **ramp** with no sustained oscillation and no offset beyond the controller deadband; equilibrium unchanged from rung 5 |

**The general rule: a rung that adds dynamics but no new equilibrium physics must leave the
steady state exactly where it was.** That converts "it looked reasonable" into a pass/fail
assertion, and it makes CLAUDE.md rule 12 enforceable at every rung rather than four.

**Rung 4 splits, because heat loss breaks that rule.** Thermal mass stores energy without
consuming it, so it may change the path and must not change the destination. Ambient heat
loss is different — it leaves through the shell, i.e. through the very metal temperature
rung 4 introduces, and it genuinely moves the equilibrium. Bundling the two would make a
correct model fail its own gate. Rung 4 therefore adds thermal mass with heat loss
disabled; rung 4b enables loss and is gated on energy closure and a bounded, signed shift
in equilibrium.

**Rung 2's round-trip check, stated precisely** — otherwise it is circular, because rung 1
prescribes the pressure that rung 2 computes:

1. Run **rung 2** to equilibrium. Record the computed total pressure `P*`.
2. Run **rung 1** with pressure prescribed at exactly `P*`.
3. Assert every state agrees within the §7.2 tolerances.

The test is written in that order. Prescribing rung 1's original pressure and expecting
rung 2 to reproduce it is the wrong way round, and would fail for a correct model.

**Rung 3 is gated against a dynamic reference, not a steady-state one.**
`vacuumSystemCalculator` computes an evacuation curve — `evacuationSteps` and
`evacuationTimeMinutes` — by integrating `V·dP/dt = −S(P)·P` from atmospheric to operating
pressure with a pressure-dependent capacity and **no in-leakage term**. Two parts follow:

| Part | Setup                     | Assertion                                                                                                                                                    |
| ---- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| a    | `leak_in = 0`, no liquid  | The model's pull-down curve matches `evacuationSteps`. Same ODE, so agreement should be tight — and it is analytically checkable independently               |
| b    | `leak_in > 0` (HEI table) | Pressure asymptotes to `P*` where the in-leakage mass rate equals the capacity mass rate at `P*`, derived from the same capacity curve and HEI leakage table |

Part (a) is the strong check: it is the same equation the reference solves, so a mismatch
is a defect rather than a modelling-choice difference. Part (b) exercises the term rung 3
exists to add.

This replaces an earlier gate that asked `vacuumSystemCalculator` for a steady-state
pressure at `leak_in = ejector_capacity`. **It does not compute that** — it takes suction
pressure as an _input_ and sizes equipment against HEI leakage. The evacuation curve is
what it actually produces, and it is the better reference because it is transient.

### 7.3 Conservation checks

Every run asserts closure on total mass, salt and energy over the trajectory, within the
integrator tolerance recorded in the run's parameter set (§6.1). Cheap, and catches whole
classes of sign and units errors.

Must hold **across discrete events and dry transitions** (§5.2.1), not only within
continuous segments — a vessel emptying is otherwise a way to lose mass unnoticed.

---

## 8. Development ladder

Each rung is a working, tested increment.

| #   | Rung                                     | New capability                        | Gate               |
| --- | ---------------------------------------- | ------------------------------------- | ------------------ |
| 0   | Properties + fixtures                    | seawater, steam, test harness         | §7.1               |
| 1   | Flash chamber, total pressure prescribed | mass / energy / salt states           | §7.2 flash chamber |
| 2   | Vapour balance, pressure computed        | steam side closes; dry-state handling | §7.2.1 rung 2      |
| 3   | **NCG inventory becomes a state**        | vacuum pull-down is modellable        | §7.2.1 rung 3      |
| 4   | Metal thermal mass                       | dominant startup time constant        | §7.2.1 rung 4      |
| 4b  | Ambient heat loss                        | equilibrium shifts; energy closes     | §7.2.1 rung 4b     |
| 5   | Condenser                                | two-sided HX, closed vacuum loop      | §7.2 condenser     |
| 6   | Pumps + level control                    | first control loop                    | §7.2.1 rung 6      |
| 7   | One MED effect                           | falling film, tube-side condensation  | §7.2 effect        |
| 8   | Chain of effects                         | full train                            | §7.2 full train    |

**Rung 3 is where vacuum pull-down becomes answerable** — a real engineering question,
independent of everything above it. Note it requires rung 3 specifically, not rung 2:
pull-down time is the integration of NCG inventory against ejector capacity, so it needs
the NCG state (§2.3). Rung 2 closes the steam side but has no gas inventory to deplete.

### 8.0 First external review point

**Rung 3 is the earliest rung worth putting in front of an expert.** Vacuum pull-down
with non-condensables is a self-contained, recognisable engineering result: a reviewer can
judge whether the in-leakage assumption, the ejector capacity and the resulting pull-down
time are credible, without needing the rest of the plant to exist.

That makes rung 3 the trigger for the **phase 2 run report** (§2.1.3). Building the report
generator there — rather than after rung 8 — means expert feedback arrives while the model
structure can still cheaply absorb it.

The report must state, for every run: the assumptions and what was neglected, the
parameter values used, which are calibrated versus assumed, the steady-state gate results
(§7.2), and the known limitations. A reviewer's first question will be _"how do you know
this is right?"_ — §7.2 is the answer, so it belongs in the document, not in a
conversation.

### 8.1 First milestone (rung 1)

- Flash chamber, three states, pressure imposed
- Runs to equilibrium from a cold start
- Vapour rate, outlet temperature and outlet salinity within 0.5% of the Vapour Toolbox
  answer across the fixture grid
- One plot: level and vapour rate responding to a **ramped** ±10% change in feed flow over
  60 s — a step would contradict §6.4, which forbids instantaneous actuator changes

Proves the architecture, the property implementation and the validation loop at once.

---

## 9. Calibration plan

Once commissioning data exists:

1. Load the trend and the actuation log; replay the actions as the scenario input.
2. Fit the §4.3 parameter vector by least squares against measured trajectories
   (`scipy.optimize.least_squares`; CasADi if gradient-based fitting is needed).
3. Hold out one transient not used in fitting; report error on it.
4. Record the fitted values per plant — they are plant-specific, not universal.

Calibration adjusts time constants and transport coefficients only. If the physics needs
changing to fit, that is a model-structure problem, not a calibration problem, and should
be treated as such.

---

## 10. Out of scope

- Live plant data / true digital twin
- Sub-second vapour dynamics (see §2.3)
- CFD or any spatially distributed model — all vessels are lumped
- Optimisation of design (that is the separate parametric-study work in Vapour Toolbox)
- A native desktop application — rejected at every phase (§2.1.3)

**Deferred, not out of scope:** a GUI. It is a firm requirement driven by external expert
review, staged across phases 2–4 in §2.1.3. Version one is phase 1 only.

---

## 11. Work required in Vapour Toolbox

The simulator depends on these; they are engineering deliverables in their own right and
justified independently.

| Item                                                     | Status      | Needed by   |
| -------------------------------------------------------- | ----------- | ----------- |
| Streams / equipment / lines generation from a MED design | **done**    | rung 5      |
| Fixture export (properties + flash chamber H&M)          | not started | **rung 0**  |
| **Flash chamber → SSOT generation** (§4.1.2)             | not started | rung 5      |
| Pumps, vacuum, dosing in the equipment register          | not started | rung 5      |
| Level → holdup helper, elevations on MED equipment       | not started | rung 5      |
| Plant-model export (typed document)                      | not started | rung 5      |
| Control narrative register                               | not started | rung 6      |
| Instruments and valves (Cv, stroke, fail position)       | not started | rung 6      |
| Commissioning data-capture spec                          | not started | calibration |

The **fixture export** is the only item blocking a start — rungs 1–4 need no SSOT at all
(§4.1.1). The **commissioning data-capture spec** is the only item with an external
deadline: it must be in place before a plant commissions, or that opportunity is lost
until the project after next.

Two of these are closely related and should be done together. `calculateFlashChamber`
already produces liquid holdup and a full elevation set (§4.1.2); the MED designer
produces neither. Building **flash chamber → SSOT** and the **level → holdup helper** in
one pass means the holdup derivation is written once and applied to both generators,
rather than solved twice.

---

## 12. Open questions

1. ~~Repository name~~ — **closed: `vapour-dynamics`** (§3). Hosting for the Python repo
   still to confirm.
2. Instrumentation tag convention — needed before instruments and valves can be generated.
3. Which project supplies the first calibration dataset, and when does it commission?
4. Does any delivered plant have historical startup trends _with_ an actuation log?
5. **Who are the expert reviewers**, and what is their background — process/thermal
   design, plant operations, or control systems? This determines what the phase 2 run
   report needs to contain, since each will challenge different assumptions.
6. Do reviewers need to run scenarios themselves (phase 3), or is reviewing prepared runs
   sufficient? Phase 3 is materially more work and should not be built on assumption.
7. Will reviewers be under NDA, or does the report need to avoid project-identifying and
   commercially sensitive detail?
