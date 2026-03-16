# MED-TVC Reference Projects — As-Built Design Data

> **Purpose**: Structured reference data extracted from 3 real MED-TVC projects for
> validation of the MED Plant Calculator. All data sourced from as-built datasheets.

---

## 1. CAMPICHE (Chile) — 100 T/h Net, 4-Effect MED-TVC

### 1.1 Project Overview

| Parameter             | Value                                                     |
| --------------------- | --------------------------------------------------------- |
| **Project**           | Campiche 240MW Coal Fired Power Project                   |
| **Owner**             | Empresa Eléctrica Campiche S.A.                           |
| **EPC**               | POSCO E&C                                                 |
| **Process Designer**  | SWS (Saline Water Specialists), Job 11-886                |
| **Location**          | Campiche, Chile                                           |
| **Plant Type**        | MED-TVC (4-effect, parallel feed)                         |
| **Net Production**    | 100,000 kg/h (100 T/h = 2,400 T/d)                        |
| **GOR**               | 7.9                                                       |
| **Number of Effects** | 4                                                         |
| **TBT**               | 53.3°C (estimated from Effect 1 vapour temp 52.6°C + BPE) |
| **BBT**               | 40.2°C (estimated from Effect 4 vapour temp 40°C + BPE)   |
| **Seawater Inlet**    | 12–21°C                                                   |
| **Brine TDS**         | 61,688 ppm                                                |

### 1.2 Utility Requirements

| Utility                                  | Flow Rate    | Operating Pressure | Operating Temperature |
| ---------------------------------------- | ------------ | ------------------ | --------------------- |
| Medium Pressure Steam (TVC motive → DSH) | 345 kg/h     | 14 bar             | 260°C                 |
| Low Pressure Steam (TVC motive)          | 12,500 kg/h  | 3.5 bar            | 160°C                 |
| Seawater                                 | 550,000 kg/h | Atm                | 12–21°C               |
| Instrument Air                           | 50 Nm³/h     | 5.5–8 bar          | 50°C                  |

### 1.3 Chemical Consumption

| Chemical                      | Consumption                 |
| ----------------------------- | --------------------------- |
| Antiscale (Belgard EV2050)    | 193 kg / 10 days            |
| Antifoam (Belite M8)          | 6.5 kg / 10 days            |
| Formic Acid 85%               | 15,000 kg per acid cleaning |
| Detergent (Vecom Detergent 8) | 25 kg per acid cleaning     |
| Inhibitor (Vecom Inhibitor 2) | 25 kg per acid cleaning     |

### 1.4 Thermocompressor (TVC)

| Parameter                           | Value                                                      |
| ----------------------------------- | ---------------------------------------------------------- |
| **Manufacturer**                    | Croll-Reynolds                                             |
| **Tag**                             | 43GDC26BN001                                               |
| **Material**                        | AISI 316L                                                  |
| **Motive Steam Pressure**           | 4.5 bar abs                                                |
| **Motive Steam Temperature**        | 160°C                                                      |
| **Motive Steam Flow**               | 12,500 kg/h                                                |
| **Suction Pressure**                | 0.072 bar abs                                              |
| **Suction Temperature**             | 39.5°C                                                     |
| **Suction Flow (entrained vapour)** | 12,904 kg/h                                                |
| **Discharge Pressure**              | 0.172 bar abs (design 0.200)                               |
| **Discharge Temperature**           | 93.6°C (before DSH)                                        |
| **Discharge Flow**                  | 25,404 kg/h                                                |
| **Entrainment Ratio**               | 1.032 (12,904/12,500)                                      |
| **Compression Ratio**               | 2.39 (0.172/0.072)                                         |
| **Desuperheating**                  | 680 kg/h distillate at 4.5 bar / 39.5°C → 60.1°C outlet    |
| **Dimensions**                      | Dm=254mm (10"), Ds=1067mm (42"), Dd=1067mm (42"), L=8204mm |
| **Weight**                          | ~1.6 ton                                                   |

### 1.5 Evaporator

| Parameter                 | Value                                            |
| ------------------------- | ------------------------------------------------ |
| **Tag**                   | 43GDG22AC001                                     |
| **Type**                  | Shell & Tube, Horizontal Cylindrical             |
| **Number of Effects**     | 4                                                |
| **Heat Transfer Area**    | 4 × 1,459 m² = 5,836 m² total                    |
| **Tubes per Effect**      | 3,100                                            |
| **Tube OD × Thk**         | 25.4 × 1.2 mm (alloy) + 25.4 × 0.5 mm (titanium) |
| **Tube Length**           | 5,900 mm                                         |
| **Tube Pitch**            | 33.4 mm (triangular)                             |
| **Tube Fixing**           | Grommet fixed                                    |
| **Vessel OD**             | 3,320 mm                                         |
| **Vessel Wall Thickness** | 10 mm                                            |
| **Tangent Length**        | 28,590 mm                                        |
| **Shell Material**        | SA 240 UNS S32304 (duplex stainless)             |
| **Design Pressure**       | 0.49 bar & Full Vacuum (shell) / 8 bar FV (tube) |
| **Design Temperature**    | 98°C (shell) / 80°C (tube)                       |
| **Fouling Factor**        | 0.00022 m²·°C/W                                  |
| **Weight (empty)**        | ~68 ton                                          |
| **Weight (operating)**    | ~167 ton                                         |
| **Weight (flooded)**      | ~316 ton                                         |

### 1.6 Final Condenser

| Parameter          | Value                                   |
| ------------------ | --------------------------------------- |
| **Tag**            | 43GDG13AC001                            |
| **Type**           | One shell, 4-pass, divided water box    |
| **Design Surface** | 454.6 m² (calculated 433.4 m²)          |
| **Heat Duty**      | 8,131 kW                                |
| **LMTD**           | 9.01°C                                  |
| **HTC**            | 2,082.4 W/m²·K                          |
| **Tubes**          | 250 tubes/pass × 4 passes = 1,000 tubes |
| **Tube OD × Thk**  | 19.05 × 0.5 mm, SB338 Gr.2 (titanium)   |
| **Tube Length**    | 7,700 mm                                |
| **Tube Pitch**     | 24.04 mm                                |
| **Shell Material** | SA 240 UNS S32304                       |
| **SW Flow**        | 489,421 kg/h                            |
| **SW In/Out Temp** | 21°C / 36°C                             |
| **Vapour In**      | 113,351 kg/h at 43.7°C                  |
| **SW Velocity**    | 2.27 m/s                                |
| **Shell Fouling**  | 0.0001 m²·°C/W                          |
| **Tube Fouling**   | 0.00018 m²·°C/W                         |
| **Dimensions**     | ø1.6 × 9.68 m                           |
| **Weight**         | ~10 ton                                 |

### 1.7 Preheaters

| Parameter                   | 2nd Cell PH     | 3rd Cell PH     | 4th Cell PH     |
| --------------------------- | --------------- | --------------- | --------------- |
| **Tag**                     | 43GDJ22AC003    | 43GDJ22AC002    | 43GDJ22AC001    |
| **Type**                    | 1-shell, 2-pass | 1-shell, 2-pass | 1-shell, 2-pass |
| **Design Surface (m²)**     | 62.48           | 104.13          | 124.96          |
| **Calculated Surface (m²)** | 47.66           | 75.01           | 83.89           |
| **Overdesign**              | 31%             | 39%             | 49%             |
| **Tubes/Pass**              | 180             | 150             | 180             |
| **Tube OD × Thk (mm)**      | 19.05 × 0.5     | 19.05 × 0.5     | 19.05 × 0.5     |
| **Tube Material**           | SB338 Gr2 (Ti)  | SB338 Gr2 (Ti)  | SB338 Gr2 (Ti)  |
| **Tube Length (mm)**        | 5,900           | 5,900           | 5,900           |
| **Tube Pitch (mm)**         | 26              | 26              | 26              |
| **Shell ID (mm)**           | 570 × 6         | 680 × 6         | 680 × 6         |
| **Passes**                  | 2               | 2               | 2               |
| **Vapour Flow (kg/h)**      | 975             | 1,455.9         | 1,572.3         |
| **Vapour Temp In (°C)**     | 52.6            | 48.2            | 43.9            |
| **SW Flow (kg/h)**          | 133,333         | 200,000         | 266,667         |
| **SW Temp In → Out (°C)**   | 43.9 → 48.2     | 39.5 → 43.9     | 36.0 → 39.5     |
| **Heat Duty (kW)**          | 643.2           | 964.4           | 1,034.1         |
| **HTC (W/m²·K)**            | 2,150.5         | 2,048.5         | 2,079.3         |
| **LMTD (°C)**               | 6.28            | 6.28            | 5.93            |
| **Shell Fouling**           | 0.0001          | 0.0001          | 0.0001          |
| **Tube Fouling**            | 0.00018         | 0.00018         | 0.00018         |
| **SW Velocity (m/s)**       | 1.58            | 1.76            | 1.79            |
| **ΔP Shell (bar)**          | 0.002           | 0.002           | 0.002           |
| **ΔP Tube (bar)**           | 0.256           | 0.68            | 0.329           |
| **Weight Empty (ton)**      | 1.85            | 2.48            | 2.58            |

**Key observation**: Preheaters are arranged in series on the seawater side — SW flows through 4th → 3rd → 2nd Cell PH, progressively heated from 36°C to 48.2°C before entering the evaporator. Each preheater uses vapour from its corresponding effect.

**Seawater split**: Total 550,000 kg/h intake, 489,421 kg/h through final condenser. The remaining ~60,000 kg/h is rejected. The 4th cell PH handles 266,667 kg/h (roughly half the condenser flow), then splits: 200,000 through 3rd, 133,333 through 2nd. This shows a decreasing SW flow pattern through the preheater chain as some SW is diverted to feed.

### 1.8 Intercondenser & Aftercondenser

| Parameter                      | Intercondenser | Aftercondenser                      |
| ------------------------------ | -------------- | ----------------------------------- |
| **Tag**                        | 43GDJ22AC004   | 43GDJ22AC005                        |
| **Design Surface (m²)**        | 7.18           | 3.59                                |
| **Calculated Surface (m²)**    | 2.34           | 0.89                                |
| **Tube OD × Thk**              | 19.05 × 0.5 mm | 19.05 × 0.5 mm                      |
| **Tube Material**              | SB338 Gr2 (Ti) | SB338 Gr2 (Ti, tubesheets SAF 2205) |
| **Length (mm)**                | 3,100          | 1,600                               |
| **Tubes/Pass**                 | 40             | 40                                  |
| **Shell ID (mm)**              | 400 × 5        | 400 × 5                             |
| **Shell Vapour In (kg/h)**     | 192            | 198                                 |
| **Shell Temp In → Out (°C)**   | 175 → 66       | 187 → 103                           |
| **Shell Pressure (bar a)**     | 0.261          | 1.127                               |
| **Tube SW Flow (kg/h)**        | 66,667         | 66,667                              |
| **Tube SW Temp In → Out (°C)** | 48.2 → 49.4    | 49.4 → 50.7                         |
| **Heat Duty (kW)**             | 87.4           | 98.7                                |
| **HTC (W/m²·K)**               | 2,170.6        | 2,096.2                             |
| **LMTD (°C)**                  | 17.2           | 52.95                               |

### 1.9 Demisters

| Parameter                 | Value                                              |
| ------------------------- | -------------------------------------------------- |
| **Manufacturer**          | Costacurta                                         |
| **Type**                  | Wire Mesh, Rectangular, Horizontal                 |
| **Material**              | SS AISI 316                                        |
| **Hollow Ratio**          | > 98%                                              |
| **Pads per Effect**       | 26                                                 |
| **Pad Dimensions**        | L=840mm × W=470mm × H=110mm                        |
| **Required Area**         | 8.48 m² per effect (all 4 effects)                 |
| **Separation Efficiency** | > 99.9%                                            |
| **Min Droplet**           | 5–300 μm                                           |
| **Pressure Drop**         | ~1 mbar                                            |
| **Demisted Purity**       | 2 μS/cm expected, 4 μS/cm guaranteed (effects 1–2) |

**Approach velocity per effect:**

| Effect | Vapour Flow (t/h) | Vapour Temp (°C) | Approach Velocity (m/s) |
| ------ | ----------------- | ---------------- | ----------------------- |
| 1      | 26.0              | 52.6             | 6.92                    |
| 2      | 25.3              | 48.2             | 7.58                    |
| 3      | 24.6              | 43.9             | 8.32                    |
| 4      | 24.4              | 40.0             | 26.39                   |

**Note**: Effect 4 approach velocity is anomalously high (26.39 m/s) due to the very low pressure / high specific volume at 40°C. This is the effect whose vapour is entrained by the TVC.

### 1.10 Vacuum Ejectors

| Parameter                      | 1st Stage                 | 2nd Stage                 | Hogging                 |
| ------------------------------ | ------------------------- | ------------------------- | ----------------------- |
| **Tag**                        | 43GDC21BN002              | 43GDC21BN003              | 43GDC21BN001            |
| **Manufacturer**               | Croll Reynolds            | Croll Reynolds            | Croll Reynolds          |
| **Type**                       | Steam Jet #4Y             | Steam Jet #102(L)         | #102                    |
| **Motive Steam**               | 15 bar, 260°C, 142.5 kg/h | 15 bar, 260°C, 199.5 kg/h | 15 bar, 260°C, 122 kg/h |
| **Suction Pressure (bar a)**   | 0.072                     | 0.261                     | ATM ÷ 0.25              |
| **Suction Flow**               | Air 34.7 + Vap 52.5 kg/h  | Air 34.7 + Vap 29.4 kg/h  | 125 kg/h                |
| **Suction Temp (°C)**          | 33.3                      | 54.1                      | Ambient                 |
| **Discharge Pressure (bar a)** | 0.261                     | 1.127                     | ATM (after silencer)    |
| **Discharge Flow (kg/h)**      | 229.7                     | 263.6                     | 247                     |
| **Discharge Temp (°C)**        | 120                       | 150                       | 150                     |
| **Dimensions Dm (mm)**         | 26.7                      | 60.3                      | 26.4                    |
| **Dimensions Ds (mm)**         | 114.3                     | 33.4                      | 60.3                    |
| **Dimensions Dd (mm)**         | 11.3                      | 33.4                      | 60.3                    |
| **Length (mm)**                | 1,082                     | 724                       | 648                     |
| **Weight (kg)**                | ~50                       | 35                        | 30                      |
| **Evacuation Volume**          | —                         | —                         | 300 m³                  |
| **Evacuation Time**            | —                         | —                         | 3 hours                 |

**Silencer**: OD 219mm × THK 8.18mm × L 838mm, Carbon Steel, 15 kg

### 1.11 Equipment List Summary (Pumps & Auxiliaries)

| Equipment               | Tag              | Motor (kW) | Flow     | Head   |
| ----------------------- | ---------------- | ---------- | -------- | ------ |
| Product Water Pump      | 43GDG13AP001/002 | 37         | 120 m³/h | 51.5 m |
| Brine Blowdown Pump     | 43GDA23AP001/002 | 30         | 170 m³/h | 36.5 m |
| Sea Water Transfer Pump | 43GDA22P001/002  | 160        | 550 m³/h | 60 m   |
| Sump Pump               | 43GDA28AP001/002 | 2.2        | 10 m³/h  | 15 mH  |
| SW Self-Cleaning Filter | 43GDB22AT001     | 0.25       | 550 m³/h | —      |

All pumps: 2 × 100% (1 operating + 1 standby)

### 1.12 Derived Performance Data

These values are calculated from the as-built datasheets for validation:

| Parameter                      | Value         | How Derived                      |
| ------------------------------ | ------------- | -------------------------------- |
| **Total Evaporator Area**      | 5,836 m²      | 4 × 1,459                        |
| **Area per Effect**            | 1,459 m²      | Datasheet                        |
| **Specific Area**              | 58.4 m²/(T/h) | 5,836/100                        |
| **GOR**                        | 7.9           | Datasheet                        |
| **TVC Entrainment Ratio**      | 1.032         | 12,904/12,500                    |
| **TVC Compression Ratio**      | 2.39          | 0.172/0.072                      |
| **Condenser Heat Load**        | 8,131 kW      | Datasheet                        |
| **Total Preheater Duty**       | 2,641.7 kW    | 643.2 + 964.4 + 1,034.1          |
| **SW ΔT (Condenser)**          | 15°C          | 36 - 21                          |
| **SW ΔT (Preheater Chain)**    | 12.2°C        | 48.2 - 36                        |
| **Motive Steam Consumption**   | 12,500 kg/h   | Utility list                     |
| **MP Steam (ejectors)**        | 345 kg/h      | Utility list (separate from TVC) |
| **Total Installed Pump Power** | ~459 kW       | 2×37 + 2×30 + 2×160 + 2×2.2      |

---

## 2. CADAFE I (Venezuela) — 2 × 104.2 T/h, 6-Effect MED-TVC

> **Data extracted using `antiword` from `.doc` files.**
> Sources: JS-249-G001 MED Datasheet, JR-249-Y001 Basic Process Report, JS-249-M018 Thermocompressor.

### 2.1 Project Overview

| Parameter                     | Value                                          |
| ----------------------------- | ---------------------------------------------- |
| **Project**                   | CADAFE Plantacentro Desalination, Venezuela    |
| **Process Designer**          | SWS (Saline Water Specialists)                 |
| **Plant Type**                | MED-TVC (6-effect, 2 identical units)          |
| **Design Total Capacity**     | 104,170 kg/h (104.2 T/h) per unit              |
| **Design Net Capacity**       | 94,700 kg/h (94.7 T/h) per unit                |
| **Number of Effects**         | 6 (split: 4 in large shell + 2 in small shell) |
| **Number of Shells**          | 2 per unit                                     |
| **GOR**                       | 10 (net distillate / steam to TVC)             |
| **TBT**                       | 63°C (max 67°C any condition)                  |
| **BBT**                       | 45.4°C                                         |
| **Seawater Design Temp**      | 29.5°C (max 32°C)                              |
| **Seawater TDS**              | 38,000 ppm (predicted)                         |
| **Seawater Flow**             | max 380 m³/h at 32°C                           |
| **Max SW Discharge Temp**     | 45°C                                           |
| **Min Continuous Production** | 50%                                            |
| **Distillate Purity**         | TDS < 2 ppm                                    |
| **Plant Dimensions**          | L=33,700 × W=18,000 × H=9,000 mm               |

### 2.2 Thermocompressor (TVC)

| Parameter                    | Value                                         |
| ---------------------------- | --------------------------------------------- |
| **Manufacturer**             | Korting Hannover AG                           |
| **Tags**                     | 10-CD-001 / 20-CD-001 (2 units)               |
| **Type**                     | Single-stage vacuum steam ejector             |
| **Nozzle**                   | Fixed                                         |
| **Motive Steam Pressure**    | 9.5 bar abs (design), max 11 bar              |
| **Motive Steam Temperature** | 180°C (design), max 190°C, mech. design 200°C |
| **Motive Steam Saturation**  | 177.6°C                                       |
| **Motive Steam Superheat**   | 2.4°C                                         |
| **Motive Steam Flow**        | 9,470 kg/h (from MED datasheet)               |
| **Suction Pressure**         | 0.134 bar abs                                 |
| **Suction Temperature**      | 51.9°C (sat 51.6°C, 0.3°C superheat)          |
| **Suction Flow**             | 12,382 kg/h                                   |
| **Discharge Pressure**       | 0.270 bar abs                                 |
| **Discharge Temperature**    | 91°C (sat 66.7°C, 24.3°C superheat)           |
| **Discharge Flow**           | 21,852 kg/h                                   |
| **Entrainment Ratio**        | 1.307 (12,382/9,470)                          |
| **Compression Ratio**        | 2.01 (0.270/0.134)                            |
| **Dimensions**               | Dm=8", Ds=36", Dd=36"                         |
| **Motive Connection**        | 8" ANSI 150#RF WN                             |
| **Suction/Discharge**        | 36" B.W.                                      |
| **Material**                 | 316L SS (all components)                      |

### 2.3 Desuperheater

| Parameter              | Value                          |
| ---------------------- | ------------------------------ |
| **Manufacturer**       | SWS                            |
| **Steam Outlet Flow**  | 22,450 kg/h                    |
| **Spray Water Flow**   | 598 kg/h                       |
| **Design Pressure**    | Full Vacuum                    |
| **Design Temperature** | 100°C                          |
| **Material**           | 316L SS body and spray nozzles |

### 2.4 Evaporator

| Parameter                        | Effects 1–4 (Large Shell)          | Effects 5–6 (Small Shell) |
| -------------------------------- | ---------------------------------- | ------------------------- |
| **Vessel ID (mm)**               | 3,500 / 3,300                      | 2,100 / 2,600             |
| **Cylindrical Length (mm)**      | 30,700                             | 21,900                    |
| **Overall Length (mm)**          | 32,500                             | 23,500                    |
| **Shell Thickness (mm)**         | 12                                 | 12                        |
| **Divider Thickness (mm)**       | 8                                  | 8                         |
| **Shell Material**               | C.S. + epoxy (int/ext 250μ)        | C.S. + epoxy              |
| **Exchange Surface/Effect (m²)** | 1,850 (first 4)                    | 950 (last 2)              |
| **Tubes/Effect**                 | 5,143                              | 2,653                     |
| **Tube OD (mm)**                 | 19.05 (Al) + 19.05 (Ti top 3 rows) | Same                      |
| **Tube Thk**                     | Al 1.2mm, Ti 0.4mm                 | Same                      |
| **Tube Length**                  | 6,040 mm                           | 6,040 mm                  |
| **Tube Pitch**                   | 26 mm triangular (1:1.36)          | 26 mm triangular          |
| **Ti Tubes/Effect**              | 181 (first 3 rows)                 | 128 (first 3 rows)        |
| **Al Tubes/Effect**              | 4,962                              | 2,525                     |
| **Tube Fixing**                  | Rubber grommets                    | Rubber grommets           |
| **Tubesheet Material**           | 316L SS, rectangular, central      | Same                      |
| **Tubesheet (1st 4)**            | W=1,580 × H=1,925 mm               | W=1,151 × H=1,386 mm      |
| **Demisters**                    | Wire mesh 316L, 20 pads/effect     | Wire mesh 316L            |
| **Demister Area/Effect**         | ~10 m² (lateral)                   | ~5.7 m² (coldest)         |
| **Baffles**                      | 4/bundle, EPDM, 15mm thick         | Same                      |
| **Weight Empty**                 | 130,900 kg (whole unit)            | Included                  |
| **Weight Full**                  | 565,000 kg                         | Included                  |
| **Weight Operating**             | ~155,000 kg                        | Included                  |

**Vapour duct (Effect 4→5)**: 800mm diameter, ~60 m/s at 130 mbar, 9.3 T/h vapour flow.

**Total tubes per unit**: 980 Ti + 24,898 Al = 25,878 tubes total

### 2.5 Final Condenser

| Parameter            | Value                                                                            |
| -------------------- | -------------------------------------------------------------------------------- |
| **Exchange Surface** | 380 m² (from process report); 413 m² (from MED datasheet)                        |
| **Seawater Flow**    | 360 m³/h (process report); 480,000 kg/h (datasheet)                              |
| **SW Inlet Temp**    | 29.5°C                                                                           |
| **SW Outlet Temp**   | 41.3°C (datasheet); 42°C (process report)                                        |
| **Tube Velocity**    | 1.76 m/s (datasheet); 15 m/s — _likely error, probably 1.5 m/s_ (process report) |
| **Arrangement**      | 4 passes                                                                         |
| **Tubes/Pass**       | 256                                                                              |
| **Total Tubes**      | 1,024 (process report); 1,160 (datasheet)                                        |
| **Tube OD × Thk**    | 19.05 × 0.4mm (Ti), 0.5mm (datasheet)                                            |
| **Tube Material**    | Ti B338 Gr.2                                                                     |
| **Tube Length**      | 6,040 mm                                                                         |
| **Shell OD**         | 1,300 / 2,100 mm                                                                 |
| **Shell Material**   | C.S. + epoxy (int. ebonite-lined waterboxes)                                     |
| **Tubesheets**       | 316L SS                                                                          |
| **Fouling Factor**   | 0.22 m²·°C/kW = 0.00022 m²·°C/W                                                  |

### 2.6 Preheaters

| Parameter                   | PH Effect 4  | PH Effect 2  |
| --------------------------- | ------------ | ------------ |
| **Type**                    | BXM          | BXM          |
| **Shell Diameter (mm)**     | 590          | 470          |
| **Cylindrical Length (mm)** | 6,600        | 6,600        |
| **Tubes**                   | 160          | 90           |
| **Passes**                  | 1            | 1            |
| **Tube Length (mm)**        | 6,040        | 6,040        |
| **Tube OD (mm)**            | 19.05        | 19.05        |
| **Tube Material**           | Ti B338 Gr.2 | Ti B338 Gr.2 |
| **Shell Material**          | 316L SS      | 316L SS      |
| **Exchange Surface (m²)**   | 56.5         | 31.8         |
| **SW Flow (kg/h)**          | 234,400      | 117,200      |
| **Vapour Flow (kg/h)**      | 1,824        | 1,183        |
| **SW Temp In → Out (°C)**   | 43.6 → 48.3  | 48.3 → 54.2  |
| **Vapour Temp (°C)**        | 54.8         | 61.6         |
| **SW Velocity (m/s)**       | 1.6          | 1.6          |

**Note**: Only 2 preheaters (on effects 2 and 4). Campiche has 3 (effects 2, 3, 4).

### 2.7 Vacuum System

| Parameter                | Value                                                    |
| ------------------------ | -------------------------------------------------------- |
| **Type**                 | 2-stage steam ejector                                    |
| **NCG Load**             | 35 kg/h design (32 + 10% margin)                         |
| **NCG Breakdown**        | O₂ 1.8 + N₂ 4.2 + CO₂ 20 + Air leakage 6 = 32 kg/h       |
| **1st Stage Motive**     | 390 kg/h at 9 bar                                        |
| **1st Stage Suction**    | 106 mbar (sat 47°C), total 357 kg/h                      |
| **1st Stage Discharge**  | 320 mbar (CR=3)                                          |
| **Intercondenser**       | 10 m², 157 tubes × 18mm OD × 1.5m, SW 230 T/h, 45→46.5°C |
| **2nd Stage Motive**     | 200 kg/h at 9 bar                                        |
| **2nd Stage Suction**    | 77 kg/h at 320 mbar                                      |
| **2nd Stage Discharge**  | Atmospheric (CR=3)                                       |
| **Aftercondenser**       | 2 m², SW 46.5→47°C                                       |
| **Total Motive Steam**   | 850 kg/h (MED datasheet); 590 kg/h (process report calc) |
| **Hogging Ejector**      | 1,250 kg/h steam, 210 min to vacuum                      |
| **Inter+After Combined** | Single shell, tubes 1.5+0.5=2m total length              |

### 2.8 Pumps

| Equipment             | Flow (kg/h)           | Head (mWC) | Motor (kW) | Material |
| --------------------- | --------------------- | ---------- | ---------- | -------- |
| Brine Extraction      | 200,000 (max 230,000) | 25         | 35         | 316L SS  |
| Distillate Extraction | 70,000 (max 80,000)   | 65         | 35         | 316L SS  |
| Remineralization      | 40,000 (max 44,000)   | 55         | 11         | 316L SS  |
| Antiscalant Dosing    | 7.5 l/h               | 4.5 bar    | 0.25       | PVC      |
| Antifoam Dosing       | 7.5 l/h               | 4.5 bar    | 0.25       | PVC      |
| Acid Cleaning         | 50,000 kg/h           | 35 mWC     | 11         | PP       |

All major pumps: 2 × 100% (1 operating + 1 standby). Voltage: 415V / 60Hz.

### 2.9 Chemical Dosing

| Chemical      | Type        | Consumption                     |
| ------------- | ----------- | ------------------------------- |
| Antiscalant   | NALCO 72990 | 37.8 kg/day (diluted 25% vol)   |
| Antifoam      | NALCO 131-S | 10.8 kg/day (diluted 10% vol)   |
| Acid Cleaning | HCl 4%      | 200 litres per cleaning, 1/year |

### 2.10 Derived Performance Data

| Parameter                   | Value                                  | Source         |
| --------------------------- | -------------------------------------- | -------------- |
| **Total Evaporator Area**   | 4×1,850 + 2×950 = 9,300 m²             | Process report |
| **Specific Area**           | 89.3 m²/(T/h)                          | 9,300/104.2    |
| **GOR**                     | 10                                     | Datasheet      |
| **TVC Entrainment Ratio**   | 1.307                                  | 12,382/9,470   |
| **TVC Compression Ratio**   | 2.01                                   | 0.270/0.134    |
| **SW ΔT (Condenser)**       | 11.8°C                                 | 41.3 - 29.5    |
| **SW ΔT (Preheater Chain)** | 10.6°C                                 | 54.2 - 43.6    |
| **Motive Steam**            | 9,470 kg/h (TVC) + 850 kg/h (ejectors) | Datasheet      |
| **Distillate Split**        | ≥40 T/h pure + 64.2 T/h mix            | Process report |

### 2.11 Remaining Documents (Not Yet Extracted)

| Document    | Title                                        | Format | Notes                      |
| ----------- | -------------------------------------------- | ------ | -------------------------- |
| JS-249-M003 | Condensers A&B detailed spec                 | .doc   | Detailed condenser HX calc |
| JS-249-M006 | Preheaters detailed spec                     | .doc   | Detailed preheater HX calc |
| JS-249-Y001 | Desalination Plant Description (3 revisions) | .doc   | Process flow details       |
| JL-249-M001 | Equipment List                               | .xls   | Complete equipment summary |
| JD-249-Y001 | P&IDs                                        | .dwg   | Not readable               |

---

## 3. MORON (Venezuela) — Document Inventory

> **Note**: MORON documents are engineering construction drawings in PDF format.
> They contain detailed mechanical/fabrication data but require visual extraction
> from technical drawings rather than text tables.

### 3.1 Project Overview

| Parameter            | Value                                       |
| -------------------- | ------------------------------------------- |
| **Project**          | MORON Desalination Plant (Figueras Project) |
| **Process Designer** | SWS (Saline Water Specialists)              |
| **Document System**  | CCFM-F-30-230 series                        |
| **Document Status**  | AS BUILT                                    |

### 3.2 Evaporator Design Data (from GP-1017 drawing)

Extracted from the evaporator general arrangement drawing title block:

| Parameter                    | Value                                             |
| ---------------------------- | ------------------------------------------------- |
| **Drawing**                  | CCFM-F-30-230-EQ-GP-1017 Rev.7                    |
| **Title**                    | Evaporator Construction DWG — General Arrangement |
| **Design Code**              | ASME VIII Div.1 (2007 Edition)                    |
| **Design Pressure (Shell)**  | 0.49 bar / Full Vacuum                            |
| **Operating Pressure**       | 0.14 bar (0.16 bar in MAWP)                       |
| **Design Temperature**       | 66.5°C / 53.5°C (in/out)                          |
| **Corrosion Allowance**      | Shell 0, Heads 0                                  |
| **Joint Efficiency**         | 0.7 (shell), 0.7 (heads)                          |
| **Physical State**           | Gas/Liquid                                        |
| **Product Weight**           | 53,000 kg                                         |
| **Fluid Group**              | PED 67/23 III                                     |
| **Shell Material**           | SA 240 UNS S32304                                 |
| **Tubes Material**           | SA 240 UNS S32304a                                |
| **Tubesheets**               | SA 240 UNS S32304                                 |
| **Post Weld Heat Treatment** | No                                                |
| **Insulation Thickness**     | 60 mm (120mm)                                     |

### 3.3 Document Parts Overview

| Part | Content                                          | Files   | Relevance                        |
| ---- | ------------------------------------------------ | ------- | -------------------------------- |
| A    | Equipment GP sheets (evaporator, material lists) | 11 PDFs | **HIGH** — equipment design data |
| B    | Equipment GPs (continued)                        | 10 PDFs | **HIGH** — additional equipment  |
| C    | Structural supports (desalination areas)         | 7 PDFs  | LOW                              |
| D    | Piping layouts & details                         | 18 PDFs | MEDIUM                           |
| E    | General piping layouts (additional elevations)   | 5 PDFs  | MEDIUM                           |
| F    | Instrumentation & electrical                     | 5 PDFs  | LOW                              |
| G    | Instrumentation & electrical (continued)         | 11 PDFs | LOW                              |
| H    | Structural assembly details                      | 17 PDFs | LOW                              |

---

## 4. Root-Level Reference Files

| File                  | Content                                                                           | Relevance                                                                   |
| --------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `Case 6.xlsx`         | SWS/SEK 22-sheet MED design Excel (8-effect, GOR=6, 5 T/h)                        | **CRITICAL** — primary validation target, already documented in design plan |
| `CAT75HYD_METRIC.pdf` | Spraying Systems Co. Industrial Hydraulic Spray Products catalog (metric edition) | LOW — spray nozzle selection reference for evaporator distribution          |
| `Scope example.pdf`   | Project scope/deliverables template for MED-TVC desalination project              | LOW — lists typical engineering deliverables                                |

---

## 5. Cross-Project Comparison

### 5.1 Key Design Parameters Across Projects

| Parameter                   | Campiche                     | CADAFE                                | MORON               |
| --------------------------- | ---------------------------- | ------------------------------------- | ------------------- |
| **Capacity (T/h net)**      | 100                          | 94.7                                  | TBD                 |
| **Effects**                 | 4                            | 6 (4+2 split shell)                   | TBD                 |
| **GOR**                     | 7.9                          | 10                                    | TBD                 |
| **TBT (°C)**                | ~53.3                        | 63 (max 67)                           | ~66.5 (design temp) |
| **BBT (°C)**                | ~40.2                        | 45.4                                  | TBD                 |
| **SW Inlet (°C)**           | 12–21                        | 29.5 (max 32)                         | TBD                 |
| **Shell Material**          | SA 240 UNS S32304 (duplex)   | C.S. + epoxy                          | SA 240 UNS S32304   |
| **Tube Material (Evap)**    | Alloy 25.4×1.2 + Ti 25.4×0.5 | Al 5052 1.2mm + Ti 0.4mm (top 3 rows) | SA 240 UNS S32304a  |
| **Evap Tube OD (mm)**       | 25.4                         | 19.05                                 | TBD                 |
| **Tube Material (Cond/PH)** | SB338 Gr2 (Ti)               | Ti B338 Gr.2                          | TBD                 |
| **TVC Manufacturer**        | Croll-Reynolds               | Korting Hannover                      | TBD                 |
| **TVC Motive Steam**        | 12,500 kg/h at 4.5 bar       | 9,470 kg/h at 9.5 bar                 | TBD                 |
| **TVC Entrainment Ratio**   | 1.032                        | 1.307                                 | TBD                 |
| **TVC Compression Ratio**   | 2.39                         | 2.01                                  | TBD                 |
| **Design Pressure**         | 0.49 bar & FV                | Full Vacuum                           | 0.49 bar & FV       |
| **Tube Pitch (Evap, mm)**   | 33.4                         | 26                                    | TBD                 |
| **Area/Effect (m²)**        | 1,459                        | 1,850 (eff 1–4) / 950 (eff 5–6)       | TBD                 |
| **Total Area (m²)**         | 5,836                        | 9,300                                 | TBD                 |
| **Specific Area (m²/T/h)**  | 58.4                         | 89.3                                  | TBD                 |
| **Condenser Area (m²)**     | 454.6                        | 380–413                               | TBD                 |

### 5.2 Common Design Patterns

From the Campiche data, several patterns emerge that should be validated and implemented in the calculator:

1. **Preheater chain**: SW flows through preheaters in reverse effect order (4th → 3rd → 2nd), each using vapour from its corresponding effect. Progressive SW flow reduction as feed is diverted.

2. **Tube materials**: Titanium (SB338 Gr2) dominates for condenser, preheaters, and intercondensers. Evaporator uses dual materials (alloy upper rows, titanium lower rows).

3. **Fouling factors**: Consistent values across equipment:
   - Shell side (condensation): 0.0001 m²·°C/W
   - Tube side (seawater): 0.00018 m²·°C/W
   - Evaporator: 0.00022 m²·°C/W (higher due to scaling)

4. **Design pressure**: Universal 0.49 bar & Full Vacuum for shell side, 8–10.4 bar for tube side (seawater at pump shutoff).

5. **Overdesign margins**: Preheaters show 31–49% overdesign (calculated vs installed area). This is standard practice for desalination to account for fouling over cleaning cycles.

6. **Vacuum system**: 2-stage ejector train with intercondenser between stages. Motive steam at 15 bar / 260°C (separate from TVC motive).

7. **TVC operating regime**: Entrainment ratio ~1.0, compression ratio ~2.4. Discharge desuperheated with distillate spray.

---

## 6. Validation Targets for MED Calculator

### 6.1 Campiche Case (Primary Validation)

The calculator should reproduce these values when configured for a 4-effect MED-TVC:

| Parameter              | Target       | Tolerance |
| ---------------------- | ------------ | --------- |
| Net production         | 100 T/h      | ±5%       |
| GOR                    | 7.9          | ±5%       |
| TVC motive steam       | 12,500 kg/h  | ±5%       |
| TVC entrainment ratio  | 1.032        | ±10%      |
| TVC discharge pressure | 0.172 bar    | ±10%      |
| SW intake              | 550,000 kg/h | ±10%      |
| Condenser heat duty    | 8,131 kW     | ±10%      |
| Condenser LMTD         | 9.01°C       | ±15%      |
| Condenser HTC          | 2,082 W/m²·K | ±15%      |
| Total preheater duty   | 2,642 kW     | ±10%      |
| Effect 1 vapour        | 26 T/h       | ±10%      |
| Effect 4 vapour        | 24.4 T/h     | ±10%      |
| Demister area/effect   | 8.48 m²      | ±15%      |
| Evaporator area/effect | 1,459 m²     | ±15%      |

### 6.2 Effect-wise Vapour Production

| Effect | Vapour (T/h) | Temp (°C) | Demister Velocity (m/s) |
| ------ | ------------ | --------- | ----------------------- |
| 1      | 26.0         | 52.6      | 6.92                    |
| 2      | 25.3         | 48.2      | 7.58                    |
| 3      | 24.6         | 43.9      | 8.32                    |
| 4      | 24.4         | 40.0      | 26.39                   |

### 6.3 Preheater Performance

| Preheater | Duty (kW) | HTC (W/m²·K) | LMTD (°C) | Calc. Area (m²) |
| --------- | --------- | ------------ | --------- | --------------- |
| 2nd Cell  | 643.2     | 2,150.5      | 6.28      | 47.66           |
| 3rd Cell  | 964.4     | 2,048.5      | 6.28      | 75.01           |
| 4th Cell  | 1,034.1   | 2,079.3      | 5.93      | 83.89           |

---

## 7. Data Gaps & Next Steps

### 7.1 Missing Data

1. **Effect-wise H&M balance**: The Campiche datasheets give vapour flows per effect (from demister sheet) but not the complete H&M balance (brine flows, feed flows, distillate accumulation per effect). This must come from the operating manual or be back-calculated.

2. **CADAFE complete data**: All `.doc` files need manual extraction. This project may have different capacity, number of effects, and design parameters — valuable for cross-validation.

3. **MORON complete data**: Equipment GP drawings need visual extraction. Parts A & B contain equipment specifications.

4. **India projects**: User mentioned 3 more projects designed on the same basis, working well in India, whose documents can be provided next.

### 7.2 Recommended Next Steps

1. **Extract Case 6.xlsx** data programmatically (if possible) for detailed effect-by-effect validation
2. **Request CADAFE data** in more accessible format (PDF exports from Word)
3. **Back-calculate Campiche H&M balance** from the equipment datasheets
4. **Add India project data** when provided
5. **Build validation test suite** with all project data as test fixtures
