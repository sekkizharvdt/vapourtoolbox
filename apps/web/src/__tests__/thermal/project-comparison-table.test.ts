/**
 * Project Comparison Table — Campiche & CADAFE As-Built Validation
 *
 * Runs each calculator with as-built project data and prints a formatted
 * comparison table: Project | Calculator | Parameter | As-Built | Calculated | Δ%
 *
 * Data sources:
 * - Campiche: 100 T/h, 4-effect MED-TVC, Chile (as-built datasheets)
 * - CADAFE I: 2×104.2 T/h, 6-effect MED-TVC, Venezuela (as-built datasheets)
 */

import {
  calculateTVC,
  calculateDesuperheating,
  calculateLMTD,
  calculateSensibleHeat,
  calculateLatentHeat,
  calculateDemisterSizing,
  calculateTubeBundleGeometry,
  calculateSingleTube,
  getFluidProperties,
  getSaturationProperties,
} from '@/lib/thermal';

// ── Helpers ──────────────────────────────────────────────────────────────

interface Row {
  project: string;
  calculator: string;
  parameter: string;
  projectValue: number;
  calculated: number;
  unit: string;
}

function delta(calc: number, ref: number): string {
  if (ref === 0) return calc === 0 ? '0.0%' : '∞';
  const pct = ((calc - ref) / ref) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function fmtNum(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

const rows: Row[] = [];

// ============================================================================
// CAMPICHE — 100 T/h, 4-effect MED-TVC, Chile
// ============================================================================
// Source: As-built datasheets (Croll-Reynolds TVC, SWS evaporator/condenser)

// ── TVC ──────────────────────────────────────────────────────────────────
// Motive: 12,500 kg/h @ 4.5 bar abs (160°C)
// Suction: 0.072 bar abs (39.5°C), entrained 12,904 kg/h
// Discharge: 0.172 bar abs, 25,404 kg/h
const tvcCamp = calculateTVC({
  motivePressure: 4.5,
  suctionPressure: 0.072,
  dischargePressure: 0.172,
  motiveFlow: 12.5, // T/h
});
rows.push({
  project: 'Campiche',
  calculator: 'TVC',
  parameter: 'Entrainment Ratio',
  projectValue: 1.032,
  calculated: tvcCamp.entrainmentRatio,
  unit: '—',
});
rows.push({
  project: 'Campiche',
  calculator: 'TVC',
  parameter: 'Compression Ratio',
  projectValue: 2.39,
  calculated: tvcCamp.compressionRatio,
  unit: '—',
});
rows.push({
  project: 'Campiche',
  calculator: 'TVC',
  parameter: 'Entrained Flow',
  projectValue: 12.904, // T/h
  calculated: tvcCamp.entrainmentRatio * 12.5,
  unit: 'T/h',
});

// ── Desuperheating ────────────────────────────────────────────────────────
// Campiche DSH: TVC discharge 93.6°C → desuperheated to 60.1°C
// Spray: 680 kg/h distillate at 39.5°C
// Our calculator: constant-pressure desuperheating from 93.6°C → 60.1°C at 0.172 bar
// Tsat @ 0.172 bar ≈ 57°C, so target 60.1°C is valid (above sat)
const dshCamp = calculateDesuperheating({
  steamPressure: 0.172,
  steamTemperature: 93.6,
  targetTemperature: 60.1,
  sprayWaterTemperature: 39.5,
  steamFlow: 25.404, // T/h (TVC discharge)
});
rows.push({
  project: 'Campiche',
  calculator: 'Desuperheating',
  parameter: 'Spray Water Flow',
  projectValue: 0.680, // T/h (680 kg/h)
  calculated: dshCamp.sprayWaterFlow,
  unit: 'T/h',
});

// ── FC Heat Duty (Sensible — SW side) ────────────────────────────────────
// SW: 489,421 kg/h, 21°C → 36°C, Duty: 8,131 kW
const shCamp = calculateSensibleHeat({
  fluidType: 'SEAWATER',
  salinity: 35000,
  massFlowRate: 489.421, // T/h
  inletTemperature: 21.0,
  outletTemperature: 36.0,
});
rows.push({
  project: 'Campiche',
  calculator: 'Sensible Heat',
  parameter: 'FC SW Duty',
  projectValue: 8131,
  calculated: shCamp.heatDuty,
  unit: 'kW',
});

// ── FC Latent Heat (Vapour side) ──────────────────────────────────────────
// Verify our hfg at 43.7°C and the implied condensing rate.
// Reference: Duty = 8,131 kW, hfg at 43.7°C ≈ 2,397 kJ/kg (steam tables)
// → condensing rate = 8131 / (2397/3.6) = 12.21 T/h
// Our calculator: 1 T/h @ 43.7°C → get hfg, then check condensing rate
const lh1Th = calculateLatentHeat({
  massFlowRate: 1.0,
  temperature: 43.7,
  process: 'CONDENSATION',
});
const ourHfg = lh1Th.heatDuty * 3.6; // kJ/kg (duty in kW for 1 T/h → × 3.6)
const refHfg = 2397; // kJ/kg from steam tables at 43.7°C
rows.push({
  project: 'Campiche',
  calculator: 'Latent Heat',
  parameter: 'hfg @ 43.7°C',
  projectValue: refHfg,
  calculated: ourHfg,
  unit: 'kJ/kg',
});
// Implied condensing rate from 8,131 kW
const ourCondensingRate = 8131 / lh1Th.heatDuty; // T/h
const refCondensingRate = 8131 / (refHfg / 3.6); // T/h
rows.push({
  project: 'Campiche',
  calculator: 'Latent Heat',
  parameter: 'FC Condensing Rate',
  projectValue: refCondensingRate,
  calculated: ourCondensingRate,
  unit: 'T/h',
});

// ── FC LMTD ──────────────────────────────────────────────────────────────
// Campiche FC: 1-shell, 4-tube-pass condenser. Datasheet LMTD = 9.01°C
// For pure condensation (R=0), F-factor = 1.0 (correctly — no multi-pass
// penalty for isothermal hot side). The datasheet's lower LMTD likely
// accounts for subcooling zone, NCG accumulation, or uses a different
// condensing temperature than the saturation value we've assumed (43.7°C).
const lmtdCamp = calculateLMTD({
  hotInlet: 43.7,
  hotOutlet: 43.7,
  coldInlet: 21.0,
  coldOutlet: 36.0,
  flowArrangement: 'SHELL_AND_TUBE',
  shellPasses: 1,
  tubePasses: 4,
});
rows.push({
  project: 'Campiche',
  calculator: 'LMTD',
  parameter: 'FC Corrected LMTD',
  projectValue: 9.01,
  calculated: lmtdCamp.correctedLMTD,
  unit: '°C',
});

// ── Preheater Heat Duties ─────────────────────────────────────────────────
// PH Effect 2: SW 133,333 kg/h, 43.9→48.2°C, Duty 643.2 kW
const shPH2 = calculateSensibleHeat({
  fluidType: 'SEAWATER',
  salinity: 35000,
  massFlowRate: 133.333,
  inletTemperature: 43.9,
  outletTemperature: 48.2,
});
rows.push({
  project: 'Campiche',
  calculator: 'Sensible Heat',
  parameter: 'PH2 Duty',
  projectValue: 643.2,
  calculated: shPH2.heatDuty,
  unit: 'kW',
});

// PH Effect 3: SW 200,000 kg/h, 39.5→43.9°C, Duty 964.4 kW
const shPH3 = calculateSensibleHeat({
  fluidType: 'SEAWATER',
  salinity: 35000,
  massFlowRate: 200.0,
  inletTemperature: 39.5,
  outletTemperature: 43.9,
});
rows.push({
  project: 'Campiche',
  calculator: 'Sensible Heat',
  parameter: 'PH3 Duty',
  projectValue: 964.4,
  calculated: shPH3.heatDuty,
  unit: 'kW',
});

// PH Effect 4: SW 266,667 kg/h, 36.0→39.5°C, Duty 1034.1 kW
const shPH4 = calculateSensibleHeat({
  fluidType: 'SEAWATER',
  salinity: 35000,
  massFlowRate: 266.667,
  inletTemperature: 36.0,
  outletTemperature: 39.5,
});
rows.push({
  project: 'Campiche',
  calculator: 'Sensible Heat',
  parameter: 'PH4 Duty',
  projectValue: 1034.1,
  calculated: shPH4.heatDuty,
  unit: 'kW',
});

// ── Preheater LMTDs ──────────────────────────────────────────────────────
// PH2: vapour 52.6°C (constant), SW 43.9→48.2°C, LMTD 6.28°C
const lmtdPH2 = calculateLMTD({
  hotInlet: 52.6,
  hotOutlet: 52.6,
  coldInlet: 43.9,
  coldOutlet: 48.2,
  flowArrangement: 'COUNTER',
});
rows.push({
  project: 'Campiche',
  calculator: 'LMTD',
  parameter: 'PH2 LMTD',
  projectValue: 6.28,
  calculated: lmtdPH2.lmtd,
  unit: '°C',
});

// PH3: vapour 48.2°C, SW 39.5→43.9°C, LMTD 6.28°C
const lmtdPH3 = calculateLMTD({
  hotInlet: 48.2,
  hotOutlet: 48.2,
  coldInlet: 39.5,
  coldOutlet: 43.9,
  flowArrangement: 'COUNTER',
});
rows.push({
  project: 'Campiche',
  calculator: 'LMTD',
  parameter: 'PH3 LMTD',
  projectValue: 6.28,
  calculated: lmtdPH3.lmtd,
  unit: '°C',
});

// PH4: vapour 43.9°C, SW 36.0→39.5°C, LMTD 5.93°C
const lmtdPH4 = calculateLMTD({
  hotInlet: 43.9,
  hotOutlet: 43.9,
  coldInlet: 36.0,
  coldOutlet: 39.5,
  flowArrangement: 'COUNTER',
});
rows.push({
  project: 'Campiche',
  calculator: 'LMTD',
  parameter: 'PH4 LMTD',
  projectValue: 5.93,
  calculated: lmtdPH4.lmtd,
  unit: '°C',
});

// ── Demister ──────────────────────────────────────────────────────────────
// Average vapour per effect: ~25 T/h = 6.94 kg/s
// Demister velocity: 6.92 m/s (Effect 1), required area: 8.48 m²
// Vapour density at ~52.6°C (Effect 1): use saturation props
const satCamp1 = getSaturationProperties(52.6);
const demCamp = calculateDemisterSizing({
  vaporMassFlow: 26000 / 3600, // 26 T/h Effect 1 = 7.22 kg/s
  vaporDensity: satCamp1?.vaporDensity ?? 0.093,
  liquidDensity: satCamp1?.density ?? 987,
  demisterType: 'wire_mesh',
  orientation: 'horizontal',
  designMargin: 0.80,
  geometry: 'rectangular',
});
rows.push({
  project: 'Campiche',
  calculator: 'Demister',
  parameter: 'Required Area (Eff 1)',
  projectValue: 8.48,
  calculated: demCamp.requiredArea,
  unit: 'm²',
});

// ── Bundle Geometry ──────────────────────────────────────────────────────
// Campiche: shell OD 3,320mm, thk ~12mm → ID ≈ 3,296mm
// Lateral bundle, 33.4mm pitch, 3,100 tubes/effect (with vapour lanes)
const bgCamp = calculateTubeBundleGeometry({
  shape: 'half_circle_left',
  shellID: 3296,
  tubeOD: 25.4,
  pitch: 33.4,
  tubeHoleDiameter: 28.4,
  edgeClearance: 4.6,
});
rows.push({
  project: 'Campiche',
  calculator: 'Bundle Geometry',
  parameter: 'Tube Count (no vapour lanes)',
  projectValue: 3100,
  calculated: bgCamp.totalTubes,
  unit: 'tubes',
});

// ── Fluid Properties (Campiche conditions) ───────────────────────────────
const swCamp = getFluidProperties('SEAWATER', 21, 35000);
rows.push({
  project: 'Campiche',
  calculator: 'Fluid Props',
  parameter: 'SW Density @ 21°C',
  projectValue: 1025, // typical reference
  calculated: swCamp.density,
  unit: 'kg/m³',
});

// ============================================================================
// CADAFE I — 2×104.2 T/h, 6-effect MED-TVC, Venezuela
// ============================================================================

// ── TVC ──────────────────────────────────────────────────────────────────
// Motive: 9,470 kg/h @ 9.5 bar abs (180°C)
// Suction: 0.134 bar abs (51.9°C), entrained 12,382 kg/h
// Discharge: 0.270 bar abs (91°C), 21,852 kg/h
const tvcCAD = calculateTVC({
  motivePressure: 9.5,
  suctionPressure: 0.134,
  dischargePressure: 0.270,
  motiveFlow: 9.47, // T/h
});
rows.push({
  project: 'CADAFE',
  calculator: 'TVC',
  parameter: 'Entrainment Ratio',
  projectValue: 1.307,
  calculated: tvcCAD.entrainmentRatio,
  unit: '—',
});
rows.push({
  project: 'CADAFE',
  calculator: 'TVC',
  parameter: 'Compression Ratio',
  projectValue: 2.01,
  calculated: tvcCAD.compressionRatio,
  unit: '—',
});
rows.push({
  project: 'CADAFE',
  calculator: 'TVC',
  parameter: 'Entrained Flow',
  projectValue: 12.382, // T/h
  calculated: tvcCAD.entrainmentRatio * 9.47,
  unit: 'T/h',
});
rows.push({
  project: 'CADAFE',
  calculator: 'TVC',
  parameter: 'Discharge Flow',
  projectValue: 21.852, // T/h
  calculated: tvcCAD.entrainmentRatio * 9.47 + 9.47,
  unit: 'T/h',
});

// ── Desuperheating ────────────────────────────────────────────────────────
// CADAFE: TVC discharge 91°C @ 0.270 bar, Tsat@0.270 bar ≈ 67°C
// Desuperheated with 598 kg/h spray water
// Outlet: 22,450 kg/h
const dshCAD = calculateDesuperheating({
  steamPressure: 0.270,
  steamTemperature: 91.0,
  targetTemperature: 68.0, // just above Tsat ≈ 67°C
  sprayWaterTemperature: 40.0,
  steamFlow: 21.852, // T/h (TVC discharge)
});
rows.push({
  project: 'CADAFE',
  calculator: 'Desuperheating',
  parameter: 'Spray Water Flow',
  projectValue: 0.598, // T/h
  calculated: dshCAD.sprayWaterFlow,
  unit: 'T/h',
});

// ── FC Heat Duty (SW side) ───────────────────────────────────────────────
// CADAFE: SW 380 m³/h, 29.5°C → 41.3°C, salinity 38,000 ppm
const shCAD = calculateSensibleHeat({
  fluidType: 'SEAWATER',
  salinity: 38000,
  massFlowRate: 380, // T/h (≈ m³/h × ~1.025)
  inletTemperature: 29.5,
  outletTemperature: 41.3,
});
rows.push({
  project: 'CADAFE',
  calculator: 'Sensible Heat',
  parameter: 'FC SW Duty',
  projectValue: 4900, // estimated from datasheet
  calculated: shCAD.heatDuty,
  unit: 'kW',
});

// ── Preheater Duties ─────────────────────────────────────────────────────
// PH Effect 4: SW 234,400 kg/h, 43.6→48.3°C
const shPH4CAD = calculateSensibleHeat({
  fluidType: 'SEAWATER',
  salinity: 38000,
  massFlowRate: 234.4,
  inletTemperature: 43.6,
  outletTemperature: 48.3,
});
rows.push({
  project: 'CADAFE',
  calculator: 'Sensible Heat',
  parameter: 'PH4 Duty',
  projectValue: 1100, // estimated: 234,400 × 4.0 × 4.7 / 3600
  calculated: shPH4CAD.heatDuty,
  unit: 'kW',
});

// PH Effect 2: SW 117,200 kg/h, 48.3→54.2°C
const shPH2CAD = calculateSensibleHeat({
  fluidType: 'SEAWATER',
  salinity: 38000,
  massFlowRate: 117.2,
  inletTemperature: 48.3,
  outletTemperature: 54.2,
});
rows.push({
  project: 'CADAFE',
  calculator: 'Sensible Heat',
  parameter: 'PH2 Duty',
  projectValue: 720, // estimated
  calculated: shPH2CAD.heatDuty,
  unit: 'kW',
});

// ── Bundle Geometry: Large Shell (Effects 1-4) ───────────────────────────
// 3,500mm ID, 19.05mm tubes, 26mm triangular pitch, 5,143 tubes/effect
const bgCADlarge = calculateTubeBundleGeometry({
  shape: 'half_circle_left',
  shellID: 3500,
  tubeOD: 19.05,
  pitch: 26,
  edgeClearance: 4.6,
});
rows.push({
  project: 'CADAFE',
  calculator: 'Bundle Geometry',
  parameter: 'Large Shell Tubes (no lanes)',
  projectValue: 5143,
  calculated: bgCADlarge.totalTubes,
  unit: 'tubes',
});

// ── Bundle Geometry: Small Shell (Effects 5-6) ───────────────────────────
// 2,100mm ID (or 2,600mm — spec shows two diameters), 2,653 tubes
const bgCADsmall = calculateTubeBundleGeometry({
  shape: 'half_circle_left',
  shellID: 2100,
  tubeOD: 19.05,
  pitch: 26,
  edgeClearance: 4.6,
});
rows.push({
  project: 'CADAFE',
  calculator: 'Bundle Geometry',
  parameter: 'Small Shell Tubes (no lanes)',
  projectValue: 2653,
  calculated: bgCADsmall.totalTubes,
  unit: 'tubes',
});

// ── Fluid Properties (CADAFE conditions) ─────────────────────────────────
const swCAD = getFluidProperties('SEAWATER', 29.5, 38000);
rows.push({
  project: 'CADAFE',
  calculator: 'Fluid Props',
  parameter: 'SW Density @ 29.5°C, 38k ppm',
  projectValue: 1025, // typical reference
  calculated: swCAD.density,
  unit: 'kg/m³',
});

// Brine at max salinity 61,688 ppm (Campiche)
const brineCamp = getFluidProperties('SEAWATER', 40, 61688);
rows.push({
  project: 'Campiche',
  calculator: 'Fluid Props',
  parameter: 'Brine Density @ 40°C, 61.7k ppm',
  projectValue: 1040, // typical reference
  calculated: brineCamp.density,
  unit: 'kg/m³',
});

// ============================================================================
// BARC — 240 m³/day (10 T/h), 6-effect MED-TVC, India
// ============================================================================
// Source: As-built datasheets (G.B. Engineering, Job 1122406, Nov 2014)

// ── Sensible Heat: FC SW ─────────────────────────────────────────────────
// FC: SW 80 m³/h ≈ 82 T/h, 30→37°C, 594 tubes, 6 passes
// FC receives: last-effect vapour (607 kg/h) + distillate (11,010 kg/h @ 44.4°C)
// which flashes as it enters the 0.08 bar abs FC shell.
// Total FC duty = SW sensible heat = 80 m³/h × ΔT7°C × Cp
const shBARCfc = calculateSensibleHeat({
  fluidType: 'SEAWATER',
  salinity: 35000,
  massFlowRate: 82, // T/h (80 m³/h × ~1.024)
  inletTemperature: 30,
  outletTemperature: 37,
});
// Cross-check: back-calculate vapour condensing rate from the sensible duty
// At 42°C, hfg ≈ 2397 kJ/kg → condensing flow = duty / hfg
const barcFcCondRate = shBARCfc.heatDuty / (2397 / 3.6); // T/h
rows.push({
  project: 'BARC',
  calculator: 'Sensible Heat',
  parameter: 'FC SW Duty (80 m³/h, 30→37°C)',
  projectValue: 639, // from PFD: 80 m³/h confirmed
  calculated: shBARCfc.heatDuty,
  unit: 'kW',
});
rows.push({
  project: 'BARC',
  calculator: 'Latent Heat',
  parameter: 'FC Vapour Condensed (back-calc)',
  projectValue: 0.96, // ~960 kg/h (607 vapour + flash from 11,010 distillate)
  calculated: barcFcCondRate,
  unit: 'T/h',
});

// ── FC Latent Heat ────────────────────────────────────────────────────────
// hfg at 42°C
const lh1ThBARC = calculateLatentHeat({
  massFlowRate: 1.0,
  temperature: 42.0,
  process: 'CONDENSATION',
});
const barcHfg = lh1ThBARC.heatDuty * 3.6; // kJ/kg
rows.push({
  project: 'BARC',
  calculator: 'Latent Heat',
  parameter: 'hfg @ 42°C',
  projectValue: 2397, // steam tables reference
  calculated: barcHfg,
  unit: 'kJ/kg',
});

// ── FC LMTD ──────────────────────────────────────────────────────────────
// Vapour condensing at 42°C, SW 30→37°C, 6-pass
const lmtdBARCfc = calculateLMTD({
  hotInlet: 42.0,
  hotOutlet: 42.0,
  coldInlet: 30.0,
  coldOutlet: 37.0,
  flowArrangement: 'SHELL_AND_TUBE',
  shellPasses: 1,
  tubePasses: 6,
});
rows.push({
  project: 'BARC',
  calculator: 'LMTD',
  parameter: 'FC LMTD',
  projectValue: 8.00, // LMTD = (12-5)/ln(12/5) = 7/0.875 = 8.00°C (pure counterflow)
  calculated: lmtdBARCfc.correctedLMTD,
  unit: '°C',
});

// ── Preheater LMTDs ──────────────────────────────────────────────────────
// PH-1: vapour 44.4°C (constant), SW 40.5→42.3°C
const lmtdPH1 = calculateLMTD({
  hotInlet: 44.4,
  hotOutlet: 44.4,
  coldInlet: 40.5,
  coldOutlet: 42.3,
  flowArrangement: 'COUNTER',
});
rows.push({
  project: 'BARC',
  calculator: 'LMTD',
  parameter: 'PH-1 LMTD',
  projectValue: 2.91, // LMTD = (3.9-2.1)/ln(3.9/2.1) = 1.8/0.619 = 2.91°C
  calculated: lmtdPH1.lmtd,
  unit: '°C',
});

// PH-2: vapour 47.7°C, SW 42.3→44.7°C
const lmtdPH2BARC = calculateLMTD({
  hotInlet: 47.7,
  hotOutlet: 47.7,
  coldInlet: 42.3,
  coldOutlet: 44.7,
  flowArrangement: 'COUNTER',
});
rows.push({
  project: 'BARC',
  calculator: 'LMTD',
  parameter: 'PH-2 LMTD',
  projectValue: 4.08, // LMTD = (5.4-3.0)/ln(5.4/3.0) = 2.4/0.588 = 4.08°C
  calculated: lmtdPH2BARC.lmtd,
  unit: '°C',
});

// PH-3: vapour 51.1°C, SW 44.7→47.4°C
const lmtdPH3BARC = calculateLMTD({
  hotInlet: 51.1,
  hotOutlet: 51.1,
  coldInlet: 44.7,
  coldOutlet: 47.4,
  flowArrangement: 'COUNTER',
});
rows.push({
  project: 'BARC',
  calculator: 'LMTD',
  parameter: 'PH-3 LMTD',
  projectValue: 4.92, // LMTD = (6.4-3.7)/ln(6.4/3.7) = 2.7/0.549 = 4.92°C
  calculated: lmtdPH3BARC.lmtd,
  unit: '°C',
});

// PH-4: vapour 54.4°C, SW 47.4→50.5°C
const lmtdPH4BARC = calculateLMTD({
  hotInlet: 54.4,
  hotOutlet: 54.4,
  coldInlet: 47.4,
  coldOutlet: 50.5,
  flowArrangement: 'COUNTER',
});
rows.push({
  project: 'BARC',
  calculator: 'LMTD',
  parameter: 'PH-4 LMTD',
  projectValue: 5.30, // LMTD = (7.0-3.9)/ln(7.0/3.9) = 3.1/0.585 = 5.30°C
  calculated: lmtdPH4BARC.lmtd,
  unit: '°C',
});

// ── Demister ──────────────────────────────────────────────────────────────
// PFD vapour per effect: 1563,1608,1724,1724,1437,607 kg/h
// Average (excl last): (1563+1608+1724+1724+1437)/5 ≈ 1,611 kg/h = 0.447 kg/s
// At ~50°C (mid-effect temperature)
const satBARC = getSaturationProperties(50);
const demBARC = calculateDemisterSizing({
  vaporMassFlow: 0.447, // kg/s (average of effects 1-5)
  vaporDensity: satBARC?.vaporDensity ?? 0.083,
  liquidDensity: satBARC?.density ?? 988,
  demisterType: 'wire_mesh',
  orientation: 'horizontal',
  designMargin: 0.80,
  geometry: 'circular',
});
// Available area in 2000mm shell (half occupied by bundle):
// free area ≈ π/4 × 2.0² × 0.5 ≈ 1.57 m²
rows.push({
  project: 'BARC',
  calculator: 'Demister',
  parameter: 'Required Area (avg eff 1-5)',
  projectValue: 0.70, // estimated from shell geometry
  calculated: demBARC.requiredArea,
  unit: 'm²',
});

// ── Bundle Geometry ──────────────────────────────────────────────────────
// Shell OD 2000mm, thk 6mm → ID ≈ 1988mm
// 1,370 tubes/effect, 25.4mm tubes, 33.4mm pitch, grommet fixing
// Lateral bundle layout (visible from GA drawing cross-sections)
const bgBARC = calculateTubeBundleGeometry({
  shape: 'half_circle_left',
  shellID: 1988,
  tubeOD: 25.4,
  pitch: 33.4,
  tubeHoleDiameter: 28.4,
  edgeClearance: 4.6,
});
rows.push({
  project: 'BARC',
  calculator: 'Bundle Geometry',
  parameter: 'Evap Tubes/eff (no lanes)',
  projectValue: 1370,
  calculated: bgBARC.totalTubes,
  unit: 'tubes',
});

// ── Single Tube Analysis ─────────────────────────────────────────────────
// Evaporator: 25.4 × 0.4mm Ti SB338 Gr 2, k=22 W/m·K
// Effect 1: vapour 58.8°C condensing inside, brine spray ~57°C outside
// PFD: vapour to Effect 1 from TVC = 1,563 kg/h → per tube: 1563/3600/1370
// Feed seawater: 265 T/h total, concentration ratio 1.7 → spray ≈ 265/6 ≈ 44.2 T/h per effect
// Per tube spray: 44200/3600/1370 ≈ 0.009 kg/s
const stBARC = calculateSingleTube({
  tubeOD: 25.4,
  wallThickness: 0.4,
  tubeLength: 2.028,
  tubeMaterial: 'Titanium SB 338 Gr 2',
  wallConductivity: 22,
  vapourTemperature: 58.8,
  vapourPressure: 179.5,
  vapourFlowRate: 1563 / 3600 / 1370, // Effect 1 vapour per tube (kg/s)
  sprayFluidType: 'SEAWATER',
  sprayTemperature: 57.0,
  spraySalinity: 35000,
  sprayFlowRate: 44200 / 3600 / 1370, // spray per tube (kg/s)
});
rows.push({
  project: 'BARC',
  calculator: 'Single Tube',
  parameter: 'Evap Overall HTC (Ti 0.4mm)',
  projectValue: 3000, // typical design value for 0.4mm Ti tubes in MED
  calculated: stBARC.overallHTC,
  unit: 'W/m²·K',
});

// ── Fluid Properties ─────────────────────────────────────────────────────
const swBARC = getFluidProperties('SEAWATER', 30, 35000);
rows.push({
  project: 'BARC',
  calculator: 'Fluid Props',
  parameter: 'SW Density @ 30°C',
  projectValue: 1024,
  calculated: swBARC.density,
  unit: 'kg/m³',
});

// Brine at 59,450 ppm, 40°C
const brineBARC = getFluidProperties('SEAWATER', 40, 59450);
rows.push({
  project: 'BARC',
  calculator: 'Fluid Props',
  parameter: 'Brine Density @ 40°C, 59.4k ppm',
  projectValue: 1039,
  calculated: brineBARC.density,
  unit: 'kg/m³',
});

// ============================================================================
// Print Table
// ============================================================================

describe('Project Validation — Campiche, CADAFE & BARC Comparison', () => {
  it('prints the comparison table', () => {
    const header = [
      'Project'.padEnd(10),
      'Calculator'.padEnd(18),
      'Parameter'.padEnd(38),
      'As-Built'.padStart(12),
      'Calculated'.padStart(12),
      'Δ%'.padStart(8),
      'Unit'.padEnd(10),
    ].join(' | ');

    const sep = '-'.repeat(header.length);

    console.log('\n' + sep);
    console.log('  CALCULATOR VALIDATION vs AS-BUILT PROJECT DATA');
    console.log(sep);
    console.log(header);
    console.log(sep);

    let lastProject = '';
    for (const r of rows) {
      if (r.project !== lastProject) {
        if (lastProject) console.log(sep);
        lastProject = r.project;
      }
      const line = [
        r.project.padEnd(10),
        r.calculator.padEnd(18),
        r.parameter.padEnd(38),
        fmtNum(r.projectValue).padStart(12),
        fmtNum(r.calculated).padStart(12),
        delta(r.calculated, r.projectValue).padStart(8),
        r.unit.padEnd(10),
      ].join(' | ');
      console.log(line);
    }

    console.log(sep);

    // Summary statistics
    const deltas = rows.map((r) =>
      r.projectValue !== 0 ? Math.abs((r.calculated - r.projectValue) / r.projectValue) * 100 : 0,
    );
    const within5 = deltas.filter((d) => d <= 5).length;
    const within15 = deltas.filter((d) => d <= 15).length;
    const over30 = deltas.filter((d) => d > 30).length;

    console.log(`  Total: ${rows.length} comparisons across 3 projects`);
    console.log(`  Within ±5%:  ${within5}/${rows.length}`);
    console.log(`  Within ±15%: ${within15}/${rows.length}`);
    console.log(`  Over ±30%:   ${over30}/${rows.length}\n`);

    expect(rows.length).toBeGreaterThan(0);
  });
});
