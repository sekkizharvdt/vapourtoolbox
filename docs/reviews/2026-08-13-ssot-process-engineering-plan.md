# SSOT as the Process Engineering Workspace — Workflow & Plan

**Date:** 2026-08-13
**Status:** ACCEPTED to start building, 2026-08-13. Part 2 reviewed and agreed, with two values
still to supply (§2.1 biogas pipe material, §2.7 design velocity basis). Team review moves from
one gate up front to **a checkpoint at the end of each slice** — see Part 4.
**Raised by:** team meeting request — "can this be made available?"
**Scope:** `apps/web/src/lib/ssot/`, `packages/types/src/ssot.ts`, `apps/web/src/lib/thermal/`, `apps/web/src/lib/documents/`

---

## What this document is for

The team asked whether the SSOT module can take a project whose basic design was done by
someone else, hold its process data, size the equipment from it, and produce the valve list,
instrument list and equipment datasheets as controlled documents.

The answer is yes. This document says **how the work would actually be done, step by step**,
and asks the team to accept that workflow before any code is written. Part 1 is the workflow.
Part 2 is the list of things the team has to agree. Part 3 is the build plan, and only becomes
real once Part 2 is signed.

Nothing here is built yet. Two of the six stages exist today in some form; the rest do not.

---

# Part 1 — The workflow

## Where it starts

A project exists in the toolbox. Someone hands us a basic design package from another
engineering house: a heat and material balance, a stream table, an equipment list, maybe a
P&ID. It has pressures, temperatures, flow rates and densities. Some of the fluids are ones we
model (sea water, steam, condensate); some are not (digester gas in a biogas plant, flue gas
off a thermal oxidiser, pyrolysis vapour).

Today that package has nowhere to go. The SSOT registers can only be filled by hand, one
record at a time, or generated from **our own** MED designer and flash chamber calculator. As of
today exactly one project out of eleven has any SSOT data at all, and no project anywhere has a
single instrument, valve or pipe-table row.

## Stage 1 — Set up the project's process basis

**Who:** process engineer, once per project.

Select the project on `/ssot`. Set the area code used in line numbers, seed the pipe table
(one click — 19 standard sizes already ship as a default), and pick which fluid services this
project uses from the master fluid list.

The fluid choice is what makes the rest work: it decides the line-tag prefix, the line-number
fluid code, which pipe materials are offered, and whether the toolbox can compute
thermophysical properties or has to be told them.

_Exists today:_ project selection, area code, pipe table seeding.
_New:_ the extended fluid list and per-project fluid selection.

## Stage 2 — Bring the process data in

**Who:** process engineer.

Three routes in, and they coexist on the same registers:

| Route                                                      | Status     | Used when                         |
| ---------------------------------------------------------- | ---------- | --------------------------------- |
| Generate from our MED designer or flash chamber calculator | **Exists** | We did the basic design           |
| Import a stream/equipment/line table from a spreadsheet    | **New**    | Someone else did the basic design |
| Type records in by hand                                    | **Exists** | Corrections, one-offs, additions  |

The import reuses the machinery the generators already use: it **shows exactly what will be
created, updated, left alone and orphaned before writing anything**, and it never overwrites a
record a person edited by hand. That promise already exists in code and is the reason the
generator is still usable after a design revision.

**The part that is new in kind, not just in code:** every property gets a basis.

- `COMPUTED` — we derived it (sea water via Sharqawy, steam via IAPWS-IF97, air/NCG via our
  own correlations)
- `SUPPLIED` — it came from the client's basic design, with the source document recorded
- `ASSUMED` — nobody calculated it and no document supports it; it is somebody's working number

So a biogas stream can carry a client-supplied density, a client-supplied Cp and an assumed
viscosity, and the datasheet that comes out at the end can say so. This matters because a
number we computed and a number we were handed carry completely different weight when a
vendor queries it, and today the register cannot tell them apart.

Where the toolbox **can** compute a property it does, and marks it `COMPUTED`. If the engineer
overrides it, the value is protected from every future regeneration and its basis changes to
`SUPPLIED` or `ASSUMED` — the engineer chooses which, and that choice is not optional.

## Stage 3 — Connect it up

**Who:** process engineer.

Every line runs from something to something. That something is either an equipment item or a
**battery limit** — a tie-in point where the plant ends and the client's scope begins.

The register already has `fromEquipmentTag` and `toEquipmentTag` on lines, and `fluidIn` /
`fluidOut` stream lists on equipment. What is missing is the battery-limit endpoint and any
check that the picture closes.

The system then runs a connectivity check and reports:

- streams that are produced but never consumed, or consumed but never produced
- equipment with no inlet or no outlet
- lines whose endpoint tag does not exist
- equipment whose declared inlet/outlet streams disagree with the lines drawn to it

This check is what turns five separate lists into one model. It is cheap to build once battery
limits exist, and it is the step that catches transcription errors from someone else's package
before they reach a datasheet.

## Stage 4 — Size the equipment

**Who:** process engineer, per equipment item.

This is the heart of the request. Two different things happen here, and the register has to
support both — which one applies depends on whether we are designing the equipment or recording
somebody else's.

### 4a. Design mode — size it from the process data

An equipment item in the register knows its class (pump, tank, compressor, heat exchanger,
vessel…) and knows its inlet and outlet streams. From that, the toolbox proposes the right
calculator with the process inputs already filled in from the registers. The engineer supplies
only the judgement inputs — efficiency, margins, residence time, design factors — and the result
is written back.

The toolbox already has thirty-plus validated calculators, and most of what is needed is
there:

| Equipment class                          | Calculator                                                                  | Status             |
| ---------------------------------------- | --------------------------------------------------------------------------- | ------------------ |
| Pump                                     | TDH, hydraulic/brake/motor power, standard motor sizes, NPSHa vs real NPSHr | **Exists**         |
| Heat exchanger                           | Sizing plus iterative design                                                | **Exists**         |
| Flash vessel / holdup drum               | Flash chamber calculator, with geometry and holdup                          | **Exists**         |
| Vacuum system / ejector                  | Vacuum system, TVC                                                          | **Exists**         |
| Vapour compressor (MVC)                  | MVC calculator                                                              | **Exists**         |
| Demister, strainer, spray nozzle, siphon | Dedicated calculators                                                       | **Exists**         |
| Line / pipe                              | Sizing, pressure drop, thermal expansion                                    | **Exists**         |
| **Storage tank**                         | Residence-time vessel sizing                                                | **Does not exist** |
| **Gas compressor / blower**              | Duty, power, discharge temperature for a gas                                | **Does not exist** |

The gap is not the physics. It is that **every calculator today is a standalone page with its
own inputs, and nothing connects an equipment record to one.** Building that bridge — class →
required inputs → calculator → characteristics back onto the record — is the single largest
new piece of this whole request, and the one with the most value.

### 4b. Rating mode — the designer already has the dimensions

Often there is nothing to size. The equipment came from another engineering house, a vendor
drawing, or the designer's own judgement, and what they have is **geometry**: a diameter, a
length or a height depending on orientation, and whatever else is to hand — nozzle sizes,
elevation, design pressure and temperature, material of construction, motor rating.

They should be able to enter that directly, without running a calculator at all. The toolbox
then does two things with it:

- **Derives what follows from the geometry** — gross volume, liquid holdup at a stated level,
  wetted and total wall area, dry metal mass. The pieces exist: a cylinder volume helper, and
  shell / dished-head / tubesheet mass calculations that already produce a component
  breakdown rather than a lump figure.
- **Checks it against the process data instead of replacing it** — residence time implied by
  the holdup and the flow, vapour velocity against the demister loading limit, NPSH available
  from the elevation, heat transfer area against the duty. A supplied dimension gets a verdict,
  not silence.

This is the mode most of this work will run in, because the case the team raised — a basic
design done elsewhere — is exactly it. Design mode is the smaller half.

### 4c. What both modes need

- **Partial records are normal, not an error state.** A tag and a class are the only things
  required. Everything else is entered as and when it is known, whatever the source, and a
  field nobody has supplied stays blank rather than being invented. Nothing in this stage may
  demand a full input set before it will store what the designer does have.
- **Orientation has to be added to the data model.** Equipment today carries a shell inside
  diameter and a tangent-to-tangent length with **no vertical/horizontal flag**, and there is
  no orientation concept anywhere in the codebase. Without it, "length or height" is ambiguous,
  and level-to-holdup cannot be computed at all: the partial-fill volume of a horizontal
  cylinder is a completely different formula from a vertical one. Neither exists yet.
- **Geometry carries a basis, exactly as stream properties do** — a diameter we calculated and
  a diameter the client's drawing states are not the same claim, and the datasheet has to be
  able to say which it is printing.

Results are stored twice, deliberately: a datasheet-relevant summary on the equipment record
so a datasheet reads from one document, and the full inputs and results in a project-scoped
calculation so the number can be traced back and re-run. (Saved calculations today are scoped
to a user, hold only inputs and never results, and have no project or equipment link — that
gets extended, not duplicated.) In rating mode the stored calculation is the **check**, so the
verdict is traceable too.

## Stage 5 — Valves and instruments

**Who:** process engineer, then reviewed.

Neither register is populated by any generator today, because the instrumentation convention
that would drive it has never been written down. This stage is as much a decision as a build.

A valve or instrument attaches to a **line** or to an **equipment item** — a level transmitter
on a tank, a pressure gauge on a pump discharge. Only the line attachment exists in the data
model today.

The system proposes a schedule from templates: what points a pump gets, what a tank gets, what
a vessel under vacuum gets, what isolation and non-return arrangement a line in a given service
gets. The engineer reviews, edits and accepts — the proposal is never written silently. Every
accepted record is marked as template-generated, so a later template change can refresh what
nobody has touched by hand.

Half of the vocabulary already exists: the instrument accessory generator already knows the
standard accessory build-up for TT, PT, FT, LT and LS points down to manifolds, glands,
ferrules and I/O channel counts, and already produces an I/O summary. It was written for BOM
purposes. It gets extended and reused, not copied.

## Stage 6 — Issue the deliverables

**Who:** process engineer issues; project manager controls.

The registers produce documents, and those documents land in the project's **master document
list** where they are numbered, revision-controlled, assigned and transmitted like any other
engineering deliverable:

- Stream list / heat and material balance
- Line list
- Equipment list
- **Equipment datasheet** — one per item, with process conditions, sized characteristics, and
  the basis of every number on it
- **Valve list**
- **Instrument list**, with the I/O schedule

The document infrastructure exists and does not need inventing: sixteen PDF documents already
ship, including list-style ones, the master document list already understands
`documentType: 'Datasheet'`, discipline codes, revisions and transmittals, and documents can be
created programmatically today.

What needs deciding is the revision rule — when a register changes and a datasheet is
regenerated, does it supersede the issued revision or create a new one. Proposal in Part 2.

---

# Part 2 — What the team is asked to accept

These are the decisions that cannot be made from the code. Nothing gets built until they are
settled, because each one is expensive to change afterwards.

## 2.1 The fluid list

Fluids stay a **fixed list in the code** (agreed approach — type-safe, no registry UI), which
means **adding a fluid later is a code change and a deploy.** So the list needs to be right at
the meeting, not discovered project by project.

Currently supported — six, all desalination:

| Fluid            | Tag prefix | Line code | Properties            |
| ---------------- | ---------- | --------- | --------------------- |
| Sea water        | SW         | SW        | Computed (Sharqawy)   |
| Brine water      | B          | B         | Computed (Sharqawy)   |
| Distillate water | D          | D         | Computed              |
| Steam            | S          | S         | Computed (IAPWS-IF97) |
| NCG              | NCG        | NCG       | Computed (dry air)    |
| Feed water       | F          | F         | Computed              |

**Addition, decided 2026-08-13 — one fluid, not a list:**

| Fluid                 | Prefix | Line code | Properties           |
| --------------------- | ------ | --------- | -------------------- |
| Biogas / digester gas | BG     | BG        | Supplied — see below |

A longer set was proposed and **deliberately cut**: cooling water, service water, instrument
air, nitrogen, flue gas, pyrolysis gas, pyrolysis oil, fuel oil, chemical dosing solution and
thermic fluid. None is needed today. They are recorded here so the same list is not
re-proposed as though it were new — the answer was "not required", not "not considered".

This is a fair trade against the fixed-list decision. Each future fluid is a small code change
and a deploy: one entry with its prefix, line code, pipe material rule and property source.
That is cheap when fluids arrive one at a time, which is what this decision assumes. It is only
expensive if a project ever needs six at once.

Two consequences the team should know about:

1. **Biogas properties can be computed — from a composition, not from a temperature.** See
   §2.6. This corrects an earlier reading of this plan that said they could not: the gas-mixture
   machinery already exists in the NCG calculator and is more reusable than it first appeared.
   What the fluid needs is a composition input; what it cannot do is produce properties from
   temperature and pressure alone, the way sea water and steam do.
2. **One pipe material rule is needed: what is a biogas line made of?** Each fluid maps to an
   allowed pipe material set that drives the line number and then procurement. Wet biogas
   carries H₂S, so this is a real materials decision rather than a default — and §2.6 turns it
   into a calculated H₂S partial pressure rather than a judgement call.

## 2.2 Tag prefixes must not collide

A defect found while scoping this, which the new fluids would make much worse:

Fluid type is currently guessed from the tag prefix by testing `SW`, then `B`, then `D`,
then `S`, then `NCG`, then `FW` in that order, **and silently defaulting to sea water when
nothing matches.** The one fluid being added collides immediately: a biogas stream tagged
`BG1` starts with `B`, so it would be classified as **brine** and handed seawater correlations
— a gas silently given the properties of a concentrated salt solution. Cutting the fluid list
to biogas alone does not avoid this; biogas is the collision.

There is a live instance of this already: the MED generator emits feed streams as `F1`, `FH`,
`FSH`, but the matcher tests for `FW` — so a hand-entered feed stream falls through to the
default and is silently classified as sea water.

**Accepted as part of this work:** longest-prefix matching, and no silent default — an
unrecognised tag asks the engineer to pick the fluid rather than guessing. This is a
prerequisite to adding any fluid, not an optional cleanup.

## 2.3 The basis vocabulary

Three values, on every property, everywhere: **COMPUTED / SUPPLIED / ASSUMED**, with an
optional source reference (the client document number, or the reason for the assumption).

"Everywhere" includes **equipment characteristics, not just stream properties** — a vessel
diameter taken off a client drawing, a wall thickness nobody has calculated, and a holdup we
derived from geometry are three different kinds of number, and a datasheet that prints them
identically is making a claim it cannot support. This repo has already been bitten by exactly
that: a vessel wall thickness of 6 mm is an unsourced working assumption, no external-pressure
buckling check exists to justify it, and every mass derived from it inherits the assumption.

The team is being asked to accept that **an engineer overriding a computed value must state
which of the two it is.** Not being able to skip that is the point — an assumed number that
reads as a design value is the failure mode this is meant to prevent, and it is one this
codebase has already been bitten by.

## 2.4 Equipment classes in scope

Proposed for the first release: pump, heat exchanger, flash vessel / drum, storage tank,
compressor / blower, ejector / vacuum system, demister, strainer, filter, dosing skid,
battery-limit tie-in.

Explicitly **out** unless the team says otherwise: agitators, rotating equipment beyond pumps
and compressors, fired equipment, packaged skids treated as a single box, and electrical
equipment.

## 2.5 The deliverable set and its revision rule

Deliverables as listed in Stage 6. Proposed revision rule, for acceptance:

- A generated document is created in the master document list at **R0, status DRAFT**.
- Regenerating while still DRAFT **replaces** the file — no revision bump.
- Once a document has been **SUBMITTED**, regeneration creates the **next revision** (R1, R2…)
  rather than overwriting, so an issued document is never silently changed.
- The generated document records which registers and which register state it came from.

## 2.6 How biogas properties are actually obtained

An earlier draft of this plan said the toolbox could not compute gas mixture properties and
that every biogas number would be carried as supplied. **That was wrong, and worth correcting
before the meeting rather than after it** — most of the machinery already exists.

### What is already in the repo

The NCG calculator is a two-component gas mixture model. It carries **Wilke's mixing rule** for
viscosity, the **Wassiljewa/Mason–Saxena** rule for thermal conductivity using the same
interaction parameters, Sutherland viscosity, ideal-gas mixing with mole/mass fraction
conversion, and — importantly — a **wet mode that saturates the gas with water** from the steam
tables. That last piece is exactly the digester problem: gas off a digester leaves saturated.

It is hard-wired to one binary system, dry air plus water vapour. The mixing rules are the
non-trivial part and they are done.

### What is missing

- **Component property data for CH₄, CO₂ and H₂S** — molar mass, Cp(T), viscosity(T),
  conductivity(T), heating value. These are tabulated constants (Shomate / NASA polynomials,
  Sutherland or Chapman–Enskog parameters), not research.
- **Generalising the mixing rules from binary to n-component.** The standard Wilke form is a
  double sum over components; the binary case in the repo is that sum written out.

### What becomes computable, given a composition

With mole fractions of CH₄, CO₂, H₂S, N₂ and O₂ plus temperature and pressure:

| Quantity                      | Method                                                                  | Expected accuracy                                                               |
| ----------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Molar mass                    | Σ yᵢMᵢ                                                                  | Exact                                                                           |
| Water content when saturated  | Steam-table saturation at gas temperature — already implemented for air | Exact to the steam tables                                                       |
| Density                       | Ideal gas, ρ = PM/RT                                                    | <1% at digester pressure; add a compressibility factor if the gas is compressed |
| Cp, Cv, isentropic exponent k | Mole-weighted component Cp; k feeds compressor discharge temperature    | ~1%                                                                             |
| Viscosity                     | Component Sutherland + Wilke                                            | 2–3%                                                                            |
| Thermal conductivity          | Component + Wassiljewa                                                  | ~5%                                                                             |
| LHV / HHV, Wobbe index        | Mole-weighted component heating values                                  | Exact to the constants                                                          |
| H₂S partial pressure          | y(H₂S) × P                                                              | Exact                                                                           |

Saturation is not a detail: a dry 60/40 CH₄/CO₂ biogas is about 27.6 g/mol, and the same gas
saturated at 38 °C is about 26.9 g/mol — a 2–3% density shift that lands straight in the line
size.

The H₂S partial pressure row is the one that pays for the rest. Sour-service materials
selection is judged on H₂S partial pressure in the presence of free water, so §2.1's open
question — what is a biogas line made of — stops being a judgement call and becomes a number
the register can compute and a rule the toolbox can apply.

### What stays out of reach

High-pressure real-gas behaviour (upgrading or bottling, where a proper equation of state is
needed rather than a compressibility correction), trace-species dew points, siloxanes, and
anything predicting corrosion **rate** rather than flagging sour service.

### The consequence for the workflow

**The input changes from "give me the density" to "give me the composition."** Where a
composition is available — a lab analysis, or the client's basic design — the toolbox computes
the properties and marks them `COMPUTED`, with the source reference naming the analysis the
composition came from. Where only a bare density figure is available, it is stored `SUPPLIED`
exactly as planned.

Note the honest reading of a computed property here: it is computed from a **supplied**
composition, so it is no better than that analysis. Rather than adding a fourth basis value,
the source reference on a `COMPUTED` property must name the composition it rests on.

## 2.7 Gas lines are not liquid lines

A second defect, found while checking the above. Line sizing falls back to a single constant,
`DEFAULT_DESIGN_VELOCITY = 1.5` m/s, commented in the code as _"typical for liquid process
lines"_. It is used whenever a line does not carry its own design velocity.

Biogas mains run at roughly 5–15 m/s at low pressure, and are usually sized on pressure drop
per unit length rather than on velocity at all, because a blower has very little head to spend.
Size a biogas line at 1.5 m/s and it comes out several sizes too large.

Combined with §2.2 this compounds: a hand-entered biogas line today would be given **seawater
density and a liquid design velocity** — two independent errors pointing the same way, neither
of which announces itself.

**Needs deciding:** the design velocity for biogas service, and whether gas lines are sized on
velocity or on allowable pressure drop. Whichever it is, the design velocity has to become a
per-fluid value rather than one constant.

## 2.8 Who may do what

Unchanged from today, stated so it is on the record: writing SSOT data needs the
`MANAGE_SSOT` permission **and** assignment to that project; deleting an SSOT record is
super-admin only; issuing documents follows the existing master document list controls.

---

# Part 3 — Build plan

Only starts once Part 2 is accepted. Phases are ordered by dependency; sizes are relative, and
what makes each one big is stated rather than guessed at in days.

### Phase 1 — Fluid list and property basis _(size: M — foundation, everything depends on it)_

- Add **biogas** per §2.1 — prefix, line code, pipe material rule, property source. One fluid,
  not a list. The per-fluid structure still has to be right, because the next fluid arrives as
  a one-line addition to it.
- **Biogas property model per §2.6:** component data for CH₄, CO₂, H₂S, N₂, O₂; generalise the
  NCG calculator's Wilke and Wassiljewa mixing rules from binary to n-component; a composition
  input on gas streams; water saturation reusing what the NCG wet mode already does. Extend
  that calculator — do not write a second gas mixture model beside it (rule 32).
- **Per-fluid design velocity per §2.7**, replacing the single liquid-biased constant.
- Longest-prefix tag matching, no silent default (§2.2).
- Add per-property basis to streams, written on create and restored on edit.
- Migrate existing data: 36 streams in one project, all computed — a one-shot backfill marking
  them `COMPUTED`. No legacy-compatibility branches (there is no legacy data to speak of).
- Update the stream form so basis is visible and settable.

### Phase 2 — Import someone else's basic design _(size: M)_

- A defined spreadsheet template for streams, equipment and lines, plus paste-in.
- Reuse the existing plan-preview-then-write path so an import shows creates / updates /
  skips / orphans before touching anything.
- Imported values are marked `SUPPLIED` with their source document recorded.
- Closes the Excel round trip in the same phase: the "Export Excel" button on `/ssot` is
  currently a stub that shows "coming soon".

### Phase 3 — Connectivity and validation _(size: S–M)_

- Battery-limit endpoints as first-class nodes alongside equipment.
- Connectivity check and its report (Stage 3).

### Phase 4 — The equipment sizing bridge _(size: L — the big one)_

- **Rating mode first** (4b), because it is the mode the team's actual case needs: orientation
  on the equipment record, direct entry of supplied geometry, derived volume / holdup / area /
  metal mass, and the level-to-holdup helper for both vertical and horizontal cylinders — which
  does not exist for either today.
- Basis on equipment characteristics, alongside the stream-property basis from phase 1.
- **Design mode** (4a): equipment class → required inputs → calculator → characteristics back
  on the record.
- The process checks that give a supplied dimension a verdict — residence time, vapour
  velocity, NPSH available, area against duty.
- Extend saved calculations with a project link, an equipment link and stored results, so the
  full basis is traceable and re-runnable. Extend the existing one, do not build a second
  calculation store.
- Two new calculators: **storage tank sizing** and **gas compressor / blower**.
- Per-class datasheet field sets, tolerant of partial data.

### Phase 5 — Valves and instruments _(size: L, and half of it is convention not code)_

- Valve and instrument attachment to equipment as well as lines.
- Instrumentation templates per equipment class and per line service; propose-review-accept,
  never silent.
- Extend the valve register with Cv, fail position and stroke time. **This overlaps an
  existing plan** — see the note below.
- Extend and reuse the instrument accessory generator rather than writing a second one.

### Phase 6 — Deliverables into document control _(size: M)_

- Stream list, line list, equipment list, equipment datasheet, valve list, instrument list,
  I/O list as PDFs, following the existing PDF patterns.
- Registration into the master document list with the §2.5 revision rule.

### Overlap with existing work — must be sequenced together

`docs/reviews/2026-08-07-simulator-bridge-next-stage-plan.md` already owns the valve register
extension (Cv, fail position, stroke time — already decided there) and a new control narrative
register, driven by the external dynamic simulator's needs. **Phase 5 here and Phase 2 there
touch the same register for different reasons.** They should be planned as one change, not two.
The simulator work also wants elevations and holdup on MED equipment, which Phase 4 here would
naturally produce.

---

# Part 4 — Checkpoints

The team needs review time at each step, so the work is cut into slices that each end at a
checkpoint. A checkpoint is **not a status meeting**. It is something working that the team can
try, plus a decision that unblocks the next slice.

Three rules make them worth holding:

1. **Every checkpoint is demonstrable on a real project**, not described in a document. If a
   slice cannot be shown working, it is not a checkpoint, it is a progress report.
2. **Every checkpoint names what the team is asked to check** — specifically enough that they
   can prove it wrong in a few minutes. "Does this look right" is not a review.
3. **Slices are ordered so the cheapest-to-reverse comes first.** The two live defects go first
   precisely because they are small, verifiable by anyone, and cost nothing to redo.

| #       | Slice                                         | What is demonstrated                                                                                                        | What the team checks                                                                                                                                     | Review effort               |
| ------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| **CP0** | This plan                                     | —                                                                                                                           | Part 2 decisions; supply the two open values                                                                                                             | Done                        |
| **CP1** | Fluid handling correctness                    | Biogas as a fluid; tag matching; per-fluid design velocity                                                                  | Enter a stream tagged `BG1` — confirm it is biogas, not brine, and that the offered design velocity is a gas velocity, not 1.5 m/s                       | 15 min                      |
| **CP2** | Biogas property model                         | Composition in, properties out                                                                                              | **Compare computed density, Cp and viscosity against the client's own basic design figures.** This is the checkpoint that can be falsified with a number | 1 hr, needs a real analysis |
| **CP3** | Import                                        | The biogas project's stream table imported                                                                                  | Preview shows creates/updates/skips before writing; hand edits survive a re-import; the round trip loses nothing                                         | 1 hr                        |
| **CP4** | Connectivity                                  | The check report on that project                                                                                            | Are the reported gaps real, or noise? A check that cries wolf gets ignored                                                                               | 30 min                      |
| **CP5** | Rating mode                                   | Vessel D + L + orientation in; volume, holdup, area, mass, and verdicts out                                                 | Do the derived numbers match your own spreadsheet for a vessel you already know?                                                                         | 1 hr                        |
| **CP6** | Design mode + tank and compressor calculators | Sizing an item from its inlet/outlet streams                                                                                | Spot-check against a sizing done by hand                                                                                                                 | 1–2 hr                      |
| **CP7** | **Instrumentation convention — on paper**     | A written convention: what points a pump gets, a tank, a vessel under vacuum; isolation and non-return rules; tag numbering | Agree it **before** it is built. Wrong templates are the most expensive thing here to undo                                                               | Half a day, real review     |
| **CP8** | Valve and instrument registers                | Proposed schedules from those templates, reviewed and accepted per item                                                     | Does the proposal match what you would have specified by hand?                                                                                           | 2 hr                        |
| **CP9** | Deliverables                                  | Valve list, instrument list and a datasheet issued into the master document list                                            | Format fit to send a vendor; revision behaviour on regeneration                                                                                          | 2 hr                        |

### CP1 — built 2026-08-13, awaiting review

**How to check it, in about fifteen minutes:**

1. `/ssot` → a project → Streams → Add. Type a line tag of `BG1`. The fluid must come up as
   **BIOGAS**, not brine.
2. Density and enthalpy become **enterable fields** for biogas, with a note saying they follow
   from the gas composition. Try to save without them — it refuses rather than inventing a
   number.
3. Type a tag of `XYZ1`. The fluid must **not** change on its own. Previously anything
   unrecognised silently became sea water.
4. Type `F1`. It must come up as **FEED WATER** — this is the live case where the MED
   generator's own feed tags were being classified as sea water.
5. Lines → Add. Set Fluid to `BIOGAS`. The design velocity offered must be **10 m/s**, labelled
   as the default for that service. Set it to sea water and it must go back to 1.5 m/s. Type
   your own value and it must stop following the fluid.

**Two further defects were found while building this and are fixed in the same slice.** Neither
was in the plan, and both are the same failure as the ones already listed — a fabricated number
that looks like a measurement:

- The stream dialog wrote **`density || 1000`** — water's density — whenever the calculated
  density was blank. On a biogas stream that would have silently stored 1000 kg/m³ against a
  real value near 1.15, roughly three orders of magnitude out, with nothing on screen to show it.
- The lines tab did the same thing, `density || 1000`, and density is what sets the pipe size.

Both now require the value instead of substituting one. A third, smaller cleanup: the lines tab
carried its own copy of the pipe-sizing arithmetic, which now calls the shared functions so the
on-screen preview and the stored value cannot drift.

**Still open, and blocking nothing in CP1:** the biogas pipe material (§2.1) and the gas design
velocity basis (§2.7). Biogas pipe material ships as 316L alone — a single conservative option
that cannot be mis-picked — and the gas velocities are marked in code as assumed, pending your
answer.

**CP7 is the odd one out and deliberately so.** It is the only checkpoint reviewed as a document
rather than as working software, because instrumentation templates are convention, not
calculation — and building them first and reviewing after is how you end up with two hundred
records nobody agrees with.

**Rejection cost.** CP1 through CP4 are cheap to reverse — they touch how data comes in, and the
data set is tiny. CP5 and CP6 are moderate. CP7 is cheap on paper and expensive after CP8. CP9 is
cosmetic to revise. The order above is chosen so the irreversible decisions are the ones reviewed
in writing first.

**Open process question:** what happens when a checkpoint cannot be reviewed promptly — does the
next slice wait, or proceed at risk and accept possible rework? Worth deciding once, now, rather
than case by case under time pressure.

## Non-goals

Stated so the scope does not drift in the meeting:

- Not a P&ID drawing tool. The registers describe the plant; they do not draw it.
- Not a process simulator. Streams are held as given or computed point by point; nothing
  solves a flowsheet or balances it.
- No gas mixture property model. Supplied numbers, carried honestly.
- No automatic vendor selection or costing from datasheets in this scope.

## Open questions for the meeting

1. What is a biogas line made of? That is now the only outstanding item in §2.1 — the fluid
   itself is decided.
2. Do datasheets need to follow a client-specific template, or is one house format enough for
   the first release?
3. Tag numbering convention for valves and instruments — is there an existing company standard
   to follow, or is it being set here?
4. Which project is the first real test case? Narippaiyur is the only one with SSOT data, and
   it is ours rather than a third party's — a project with someone else's basic design would
   exercise Phase 2 properly.
5. For rating mode (4b): what does the designer typically have in hand per equipment class?
   Diameter plus length or height is assumed here; the question is what else arrives with it as
   a matter of course — nozzle schedule, design pressure and temperature, MOC, motor rating,
   vendor reference — so the entry form asks for the right things rather than everything.
6. Holdup needs a liquid level, and a level needs a datum. Is normal liquid level quoted from
   the bottom tangent line, the vessel bottom, or the centreline for horizontal vessels? One
   convention, stated once, or every derived holdup is quietly incomparable.

---

**Author:** Claude (AI-assisted session record)
**Date:** 2026-08-13
