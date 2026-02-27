/**
 * Chemical Dosing Calculator
 *
 * Calculates chemical dosing rates for thermal desalination plants.
 * Supports the two chemicals used by Vapour Desal:
 *   1. Antiscalant — Belgard EV 2050 (scale inhibitor)
 *   2. Anti-foam   — Belite M8 (for oily feed water)
 */

export type ChemicalType = 'antiscalant' | 'antifoam';

export interface ChemicalProduct {
  id: ChemicalType;
  productName: string;
  manufacturer: string;
  purpose: string;
  typicalDoseMin: number; // mg/L
  typicalDoseMax: number; // mg/L
  defaultDensity: number; // kg/L
  notes: string;
}

export const CHEMICAL_PRODUCTS: Record<ChemicalType, ChemicalProduct> = {
  antiscalant: {
    id: 'antiscalant',
    productName: 'Belgard EV 2050',
    manufacturer: 'Chemtreat / Nouryon',
    purpose: 'Scale inhibitor for CaCO₃, CaSO₄, Mg(OH)₂',
    typicalDoseMin: 1.0,
    typicalDoseMax: 4.0,
    defaultDensity: 1.1,
    notes: 'Dosed into feed seawater upstream of the first effect. Continuous dosing.',
  },
  antifoam: {
    id: 'antifoam',
    productName: 'Belite M8',
    manufacturer: 'Suez / Veolia',
    purpose: 'Anti-foam agent for oily feed water',
    typicalDoseMin: 0.05,
    typicalDoseMax: 0.5,
    defaultDensity: 1.0,
    notes: 'Used when feed contains traces of hydrocarbons or surfactants. Intermittent dosing.',
  },
};

// ── Input / Output types ──────────────────────────────────────────────────────

export interface DosingInput {
  /** Feed seawater flow rate (m³/h) */
  feedFlowM3h: number;
  /** Chemical dose (mg/L = ppm by mass) */
  doseMgL: number;
  /** Solution density (kg/L) */
  solutionDensityKgL: number;
  /** Number of days storage required (optional — for tank sizing) */
  storageDays?: number;
}

export interface DosingResult {
  /** Chemical solution flow rate (L/h) */
  chemicalFlowLh: number;
  /** Chemical solution flow rate (mL/min) — useful for dosing pump selection */
  chemicalFlowMlMin: number;
  /** Actual dose in treated stream (mg/L) — confirmation */
  doseConfirmMgL: number;
  /** Active chemical mass flow rate (g/h) */
  activeChemicalGh: number;
  /** Daily chemical consumption (kg/day) */
  dailyConsumptionKg: number;
  /** Monthly chemical consumption (kg/month, 30.4 days) */
  monthlyConsumptionKg: number;
  /** Annual chemical consumption (kg/year) */
  annualConsumptionKg: number;
  /** Storage tank volume (m³) — only if storageDays provided */
  storageTankM3?: number;
}

// ── Calculation ───────────────────────────────────────────────────────────────

export function calculateDosing(input: DosingInput): DosingResult {
  const { feedFlowM3h, doseMgL, solutionDensityKgL, storageDays } = input;

  if (feedFlowM3h <= 0) throw new Error('Feed flow must be positive');
  if (doseMgL < 0) throw new Error('Dose must be non-negative');
  if (solutionDensityKgL <= 0) throw new Error('Solution density must be positive');

  // Active chemical mass flow (g/h) = feed [m³/h] × dose [mg/L] × 1000 [L/m³] × 1/1000 [g/mg]
  //   = feed [m³/h] × dose [mg/L]  (direct, since 1 mg/L × 1000 L/m³ / 1000 mg/g = 1 g/m³)
  const activeChemicalGh = feedFlowM3h * doseMgL; // g/h

  // Chemical solution flow (L/h) = active mass (g/h) / density (kg/L) / 1000 (g/kg)
  const chemicalFlowLh = activeChemicalGh / (solutionDensityKgL * 1000);

  const chemicalFlowMlMin = (chemicalFlowLh / 60) * 1000;

  // Mass consumption (kg/day)
  const chemicalMassFlowKgh = chemicalFlowLh * solutionDensityKgL;
  const dailyConsumptionKg = chemicalMassFlowKgh * 24;
  const monthlyConsumptionKg = dailyConsumptionKg * 30.4;
  const annualConsumptionKg = dailyConsumptionKg * 365;

  // Storage tank (m³)
  let storageTankM3: number | undefined;
  if (storageDays !== undefined && storageDays > 0) {
    storageTankM3 = (dailyConsumptionKg * storageDays) / (solutionDensityKgL * 1000);
  }

  return {
    chemicalFlowLh,
    chemicalFlowMlMin,
    doseConfirmMgL: doseMgL, // exact by construction; provide as confirmation
    activeChemicalGh,
    dailyConsumptionKg,
    monthlyConsumptionKg,
    annualConsumptionKg,
    storageTankM3,
  };
}
