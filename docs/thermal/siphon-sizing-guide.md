# Siphon Sizing Calculator — User Guide

This guide covers the Siphon Sizing Calculator for inter-effect siphon pipes in MED (Multi-Effect Distillation) thermal desalination plants. The calculator determines pipe size, minimum U-bend height, pressure drop, flash vapor, and holdup volume.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Single Siphon Mode](#2-single-siphon-mode)
3. [Input Parameters](#3-input-parameters)
4. [Results](#4-results)
5. [Siphon Diagram](#5-siphon-diagram)
6. [Batch Mode (All Effects)](#6-batch-mode-all-effects)
7. [Excel Export](#7-excel-export)
8. [PDF Report](#8-pdf-report)
9. [Save & Load Calculations](#9-save--load-calculations)
10. [Calculation Methodology](#10-calculation-methodology)
11. [Troubleshooting & Warnings](#11-troubleshooting--warnings)

---

## 1. Overview

**Path:** Thermal → Calculators → Siphon Sizing

A siphon pipe transfers fluid between two effects at different pressures in an MED plant. The calculator sizes the pipe and determines the minimum height of the U-bend needed to overcome the pressure difference between effects, accounting for friction losses, fittings, and a safety margin.

**Two operating modes:**

- **Single Siphon Mode** — Size one siphon between two effects
- **Batch Mode** — Size all siphons across an entire MED train in one go

---

## 2. Single Siphon Mode

**Path:** Thermal → Calculators → Siphon Sizing

The main page has two panels:

| Left Panel       | Right Panel              |
| ---------------- | ------------------------ |
| Input Parameters | Siphon Diagram + Results |

Enter your operating conditions on the left. Results update automatically when all required inputs are valid.

---

## 3. Input Parameters

### 3.1 Effect Pressures

| Field                          | Default | Notes                            |
| ------------------------------ | ------- | -------------------------------- |
| **Pressure Unit**              | mbar(a) | Options: mbar(a), bar(a), kPa(a) |
| **Upstream Effect Pressure**   | 300     | Higher pressure effect (P1)      |
| **Downstream Effect Pressure** | 250     | Lower pressure effect (P2)       |

A read-only **Pressure Difference** is displayed below, showing the delta in both mbar and bar. This only appears when upstream pressure exceeds downstream pressure.

### 3.2 Fluid Properties

| Field          | Default    | Notes                                                   |
| -------------- | ---------- | ------------------------------------------------------- |
| **Fluid Type** | Seawater   | Options: Seawater, Brine, Distillate                    |
| **Salinity**   | 35,000 ppm | Only shown for Seawater or Brine (range: 0–120,000 ppm) |

Two read-only values are derived automatically:

- **Saturation Temperature** — Calculated from upstream pressure
- **Density** — Based on fluid type, salinity, and saturation temperature

### 3.3 Flow & Velocity

| Field               | Default      | Notes                                      |
| ------------------- | ------------ | ------------------------------------------ |
| **Mass Flow Rate**  | 100 ton/hr   | Flow through the siphon                    |
| **Target Velocity** | 1.0 m/s      | Recommended range: 0.05–1.0 m/s            |
| **Pipe Schedule**   | Sch 40 (Std) | Options: Sch 10, Sch 40 (Std), Sch 80 (XS) |

The calculator selects the pipe size that best matches the target velocity from the available sizes in the chosen schedule.

**Velocity guidelines:**

- Below 0.05 m/s — risk of settling and blockages
- Above 1.0 m/s — risk of erosion and noise

### 3.4 Custom Pipe (Plate-Formed)

If the required pipe exceeds 24" (the largest standard size), the calculator prompts you to enter custom dimensions:

| Field              | Unit | Description                             |
| ------------------ | ---- | --------------------------------------- |
| **Pipe ID**        | mm   | Inner diameter of the plate-formed pipe |
| **Wall Thickness** | mm   | Wall thickness                          |

This typically occurs with very high flow rates or very low target velocities.

### 3.5 Pipe Geometry

| Field                   | Default  | Notes                                                   |
| ----------------------- | -------- | ------------------------------------------------------- |
| **Elbow Configuration** | 2 Elbows | See below                                               |
| **Horizontal Distance** | 3 m      | Distance between upstream and downstream nozzle centres |
| **Offset Distance**     | 1.5 m    | Only shown for 3 or 4 elbow configs                     |

**Elbow configurations:**

| Config                         | When to use                                                              |
| ------------------------------ | ------------------------------------------------------------------------ |
| **2 Elbows (Same Plane)**      | Simple U-pipe — nozzles are directly opposite in the same vertical plane |
| **3 Elbows (Different Plane)** | Nozzles are offset laterally — pipe must route through a different plane |
| **4 Elbows (Routing Around)**  | Pipe must route around an adjacent siphon or obstruction                 |

The elbow count affects both friction losses and total pipe length.

### 3.6 Safety Factor

| Field             | Default | Notes                                               |
| ----------------- | ------- | --------------------------------------------------- |
| **Safety Factor** | 20%     | Applied to the sum of static head + friction losses |

The minimum recommended value is 20%. A warning is shown if set lower. The safety margin ensures the siphon operates reliably under transient conditions and measurement uncertainty.

---

## 4. Results

Results appear on the right side once all inputs are valid.

### 4.1 Primary Result Card

The top card displays:

- **Pipe Size** — e.g. `8" Sch 40` or `Custom ID 650 mm`
- **Velocity Status** — colour-coded chip: green (OK), yellow (LOW), red (HIGH)
- **Pipe Dimensions** — Nominal diameter (DN), inner diameter, outer diameter, and wall thickness

### 4.2 Key Metrics

| Metric                  | Description                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------- |
| **Velocity**            | Actual fluid velocity in the selected pipe (m/s)                                      |
| **Min. Siphon Height**  | Total required U-bend depth below the nozzles (m) — this is the primary design output |
| **Flash Vapor**         | Percentage of fluid that flashes to steam at the downstream pressure                  |
| **Total Pressure Drop** | Friction-based pressure drop through the siphon (mbar)                                |
| **Holdup Volume**       | Internal volume of liquid held in the siphon pipe (litres, or m3 if > 1,000 L)        |

### 4.3 Siphon Height Breakdown

A table showing how the minimum height is built up:

| Component                 | Description                                                     |
| ------------------------- | --------------------------------------------------------------- |
| Static Head               | Height needed to overcome the pressure difference: ΔP / (ρ × g) |
| Friction Losses           | Height equivalent of pipe and fitting friction                  |
| Safety Margin             | Percentage of (static + friction) per the chosen safety factor  |
| **Minimum Siphon Height** | Sum of all three components                                     |

### 4.4 Pressure Drop Details

- **Reynolds Number** and **Flow Regime** (laminar or turbulent)
- **Friction Factor** (Darcy-Weisbach)
- Itemised pressure drop for each fitting:
  - Straight pipe
  - Entrance (sharp-edged, K = 0.5)
  - 90-degree elbows (K = 0.9 each)
  - Exit (K = 1.0)
  - **Total** in both metres of water head and mbar

### 4.5 Flash Vapor

**If flash occurs:** Shows downstream saturation temperature, vapor flow rate, and liquid flow after flashing.

**If no flash:** An info message confirms the fluid remains subcooled.

> **Tip:** If flash exceeds 5%, the calculator warns that subcooling may be needed. High flash fractions can cause two-phase flow issues in the siphon.

### 4.6 Geometry & Fluid Properties Summary

A quick-reference grid showing: number of elbows, total pipe length, fluid temperature, density, viscosity, and boiling point elevation (for seawater/brine).

---

## 5. Siphon Diagram

An interactive SVG diagram is rendered above the results, showing:

- **Two effect vessels** with labelled temperatures
- **The siphon pipe** in the chosen elbow configuration (2, 3, or 4 elbows)
- **Water fill level** in the upstream leg (proportional to static head)
- **Dimension annotations:**
  - Minimum siphon height (right side, coloured)
  - Static head (left side, dashed)
  - Horizontal distance (bottom)
- **Pipe label** with size and schedule (e.g. `8" Sch 40 (DN200)`)
- **Flow direction arrows**

For the 4-elbow configuration, a dashed line indicates the adjacent siphon being routed around.

---

## 6. Batch Mode (All Effects)

**Path:** Thermal → Calculators → Siphon Sizing → Batch Mode

Use batch mode to size all siphons across an entire MED train at once.

### 6.1 Layout

| Left Panel (1/3 width) | Right Panel (2/3 width)            |
| ---------------------- | ---------------------------------- |
| Common Parameters      | Effect Input Table + Results Table |

### 6.2 Common Parameters

Shared inputs applied to every siphon: pressure unit, fluid type, salinity, target velocity, pipe schedule, elbow configuration, distances, and safety factor. These are the same fields as single mode.

### 6.3 Effect Input Table

Define your MED train by entering effects top-to-bottom:

| Column           | Description                                                               |
| ---------------- | ------------------------------------------------------------------------- |
| **Effect**       | Auto-numbered: E1, E2, E3, ...                                            |
| **Pressure**     | Operating pressure of each effect (in selected unit)                      |
| **Flow to Next** | Mass flow from this effect to the next (ton/hr). Last effect has no flow. |

The table starts with 5 default effects (400, 350, 300, 250, 200 mbar). You can:

- **Add effects** using the "Add Effect" button
- **Remove effects** using the delete icon on each row (minimum 2 effects)

### 6.4 Batch Results Table

The calculator automatically sizes every siphon between consecutive effects:

| Column         | Description                     |
| -------------- | ------------------------------- |
| **Siphon**     | S-1, S-2, ...                   |
| **From → To**  | E1 → E2, E2 → E3, ...           |
| **Pipe Size**  | Selected pipe for this siphon   |
| **Min Height** | Required U-bend depth (m)       |
| **Velocity**   | Actual velocity (m/s)           |
| **Status**     | OK, HIGH, or LOW (colour-coded) |
| **Flash (%)**  | Flash vapor fraction            |
| **ΔP**         | Friction pressure drop (mbar)   |
| **Holdup**     | Internal pipe volume (L)        |

A **Totals** row at the bottom sums the height, flash, pressure drop, and holdup across all siphons.

### 6.5 Switching Modes

- From single mode: click **"Batch Mode (All Effects)"** link at the top
- From batch mode: click **"Single Siphon Mode"** link at the top

---

## 7. Excel Export

Click the **Excel** button (table icon) in the results section to download a spreadsheet.

### Single Mode

File: `Siphon_Sizing.xlsx` with two sheets:

| Sheet        | Contents                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------- |
| **Summary**  | Input parameters, key results (pipe size, height, velocity, flash)                                         |
| **Detailed** | Full pipe specifications, height breakdown, itemised pressure drops, flash vapor details, fluid properties |

### Batch Mode

File: `Batch_Siphon_Sizing.xlsx` with a summary of common parameters and a results table covering all siphons.

---

## 8. PDF Report

Click the **PDF Report** button to generate a formal engineering report.

### Report Dialog

| Field               | Default    | Required |
| ------------------- | ---------- | -------- |
| **Document Number** | SIPHON-001 | Yes      |
| **Revision**        | 0          | No       |
| **Project Name**    | (empty)    | No       |
| **Notes**           | (empty)    | No       |

A summary preview is shown before generating: pipe size, minimum height, and velocity status.

### Report Contents

The generated PDF includes:

1. **Header** — Company logo (if configured), document number, revision, and project name
2. **Siphon Diagram** — The same SVG diagram rendered as an image
3. **Input Parameters** — All operating conditions in a formatted table
4. **Pipe Selection** — Selected pipe dimensions and schedule
5. **Height Breakdown** — Static head, friction, safety margin
6. **Pressure Drop Details** — Itemised friction losses for every fitting
7. **Flash Vapor** — Downstream conditions and vapor flow (if applicable)
8. **Fluid Properties** — Temperature, density, viscosity, BPE
9. **Warnings** — Any velocity or flash warnings
10. **Footer** — Generation timestamp

The file is saved as `{DocumentNumber}_Rev{Revision}.pdf`.

---

## 9. Save & Load Calculations

### Saving

1. Run a calculation with valid results
2. Click the **Save** button
3. Enter a descriptive name (e.g. "MED Unit 1 — S-101/102")
4. Click **Save**

All input values are stored. Saved calculations are personal — only you can see yours.

### Loading

1. Click the **Load Saved** button in the page header
2. Browse your saved calculations (shown with name and date)
3. Click a calculation to restore all its inputs
4. The calculator re-runs with the loaded values

### Deleting

Click the delete icon next to any saved calculation in the load dialog. The item is soft-deleted and no longer appears in your list.

---

## 10. Calculation Methodology

### 10.1 Pipe Sizing

The calculator converts mass flow (ton/hr) to volumetric flow (m3/s) using fluid density, then selects the pipe size from the chosen schedule where the actual velocity best matches the target. Standard ASME B36.10 pipe sizes from 1/2" to 48" are available. If the required size exceeds 24", custom pipe dimensions are requested.

### 10.2 Pressure Drop (Darcy-Weisbach)

1. **Reynolds number:** Re = (ρ × v × D) / μ
2. **Friction factor:** 64/Re for laminar flow; Colebrook-White equation for turbulent flow (pipe roughness = 0.046 mm for carbon steel)
3. **Pipe friction loss:** f × (L/D) × (v2/2g)
4. **Fitting losses:** K × (v2/2g) for each fitting
5. **Total:** Sum of pipe + all fitting losses

### 10.3 Siphon Height (Iterative)

The minimum siphon height is solved iteratively because the pipe length depends on the height, and friction depends on the pipe length:

1. Estimate initial height from static head alone
2. Calculate total pipe length (horizontal + offset + 2 × height)
3. Calculate friction losses for this pipe length
4. New height = static head + friction + safety margin
5. Repeat until height converges (tolerance < 0.01 m)

**Minimum Siphon Height = Static Head + Friction Head + Safety Margin**

Where:

- Static Head = ΔP / (ρ × g)
- Safety Margin = (Static Head + Friction Head) × Safety Factor %

### 10.4 Flash Vapor

When fluid enters the lower-pressure downstream effect, it may partially flash to steam:

1. Calculate saturation temperature at downstream pressure
2. If inlet temperature > downstream saturation temperature → flash occurs
3. Flash fraction = (inlet enthalpy − liquid enthalpy at downstream) / (latent heat of vaporization)
4. Vapor and liquid flow rates are calculated from the flash fraction

### 10.5 Fluid Properties

| Fluid            | Source                                                                         |
| ---------------- | ------------------------------------------------------------------------------ |
| Seawater / Brine | Sharqawy et al. correlations (salinity-dependent density, viscosity, enthalpy) |
| Distillate       | IAPWS-IF97 pure water properties                                               |

Boiling Point Elevation (BPE) is applied for seawater and brine, raising the actual boiling point above pure water.

---

## 11. Troubleshooting & Warnings

### Velocity Warnings

| Warning                   | Cause                      | Action                                   |
| ------------------------- | -------------------------- | ---------------------------------------- |
| **HIGH velocity** (red)   | Actual velocity > 1.0 m/s  | Increase pipe size or reduce flow rate   |
| **LOW velocity** (yellow) | Actual velocity < 0.05 m/s | Decrease pipe size or increase flow rate |

### Flash Vapor Warning

| Warning    | Cause                               | Action                                                            |
| ---------- | ----------------------------------- | ----------------------------------------------------------------- |
| Flash > 5% | Large pressure drop between effects | Consider subcooling the fluid, or accept two-phase flow in design |

### Safety Factor Warning

| Warning             | Cause                                  | Action                                                               |
| ------------------- | -------------------------------------- | -------------------------------------------------------------------- |
| Safety factor < 20% | User reduced below recommended minimum | Increase to at least 20% unless specific design justification exists |

### Common Issues

| Issue                         | Solution                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| No results appear             | Ensure upstream pressure is greater than downstream pressure and all fields have valid numbers |
| "Pipe exceeds standard range" | Enter custom pipe dimensions in the plate-formed pipe section                                  |
| Batch mode shows errors       | Check that pressures decrease from E1 → E2 → E3 etc., and all flow rates are provided          |
| Saved calculation not loading | Ensure you are logged in with the same account that saved it                                   |

---

_Last updated: February 2026_
