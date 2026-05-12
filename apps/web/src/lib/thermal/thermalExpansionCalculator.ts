/**
 * Thermal Expansion Calculator
 *
 * Computes free linear thermal expansion (ΔL) and, optionally, the thermal
 * stress that would develop in a fully restrained component, for the engineering
 * materials commonly used in thermal desalination equipment.
 *
 *   Free expansion:   ΔL = L₀ × α_eff × (T_op − T_install)
 *   Thermal strain:   ε  = α_eff × (T_op − T_install)
 *   Restrained stress (compressive on heating, tensile on cooling):
 *                     σ  = E(T_op) × ε
 *
 * α_eff is derived from tabulated mean coefficients (ASM Handbook convention):
 *   α_mean(T)  ≡ mean α from 20 °C to T
 *   δ/L (20 → T) = α_mean(T) × (T − 20)
 *   ΔL/L₀ (T_install → T_op) = α_mean(T_op)·(T_op−20) − α_mean(T_install)·(T_install−20)
 *   α_eff = (ΔL/L₀) / (T_op − T_install)
 *
 * Reference: Perry's Chemical Engineers' Handbook §28; ASM Handbook Vol. 1 & 2.
 */

import {
  getMaterialThermalProperties,
  getMeanExpansionCoefficient,
  getYoungsModulus,
  getYieldStrength,
} from '@vapour/constants';

// ============================================================================
// Types
// ============================================================================

export type ConstraintMode = 'free' | 'restrained';

export interface ThermalExpansionInput {
  /** Material key — see MATERIAL_THERMAL_KEYS */
  materialKey: string;
  /** Initial length at installation temperature, in mm */
  length: number;
  /** Installation / reference temperature in °C (commonly 20 °C ambient) */
  installationTemperature: number;
  /** Operating temperature in °C */
  operatingTemperature: number;
  /**
   * Constraint mode:
   *   - 'free'       → component free to expand; ΔL is reported, σ_thermal = 0.
   *   - 'restrained' → component fully axially restrained; ΔL = 0 in reality,
   *                    the calculator reports the thermal stress that would
   *                    develop and compares it against the yield strength.
   */
  constraintMode: ConstraintMode;
}

export interface ThermalExpansionResult {
  /** Display label of the selected material */
  materialLabel: string;
  /** Temperature difference T_op − T_install, in °C */
  deltaT: number;
  /** Mean α (10⁻⁶/°C) from 20 °C → T_install */
  alphaMeanInstallation: number;
  /** Mean α (10⁻⁶/°C) from 20 °C → T_op */
  alphaMeanOperating: number;
  /**
   * Effective α (10⁻⁶/°C) between T_install and T_op. Use this when reporting
   * "the expansion coefficient used" — it correctly accounts for the
   * non-linearity of α(T) when T_install ≠ 20 °C.
   */
  alphaEffective: number;
  /** Young's modulus E at T_op, in GPa */
  EOperating: number;
  /**
   * Free thermal expansion in mm.
   * Positive ⇒ elongation (heating). Negative ⇒ contraction (cooling).
   * Reported even in restrained mode, because designers usually need both
   * the would-be ΔL (sizing of expansion joints) and the would-be stress.
   */
  deltaL: number;
  /** Thermal strain in mm/m (= microstrain × 1e-3) */
  thermalStrain_mmPerM: number;
  /** Thermal strain in percent (ε × 100) */
  thermalStrainPct: number;
  /**
   * Thermal stress under full axial restraint, in MPa.
   * Sign convention: positive ⇒ compressive (heating restrained component).
   * Always populated (in 'free' mode it tells the user what the stress
   * *would* be if they restrained the component).
   */
  thermalStress: number;
  /** Yield strength at T_op (MPa). null if not tabulated for this material. */
  yieldStrength: number | null;
  /** σ_thermal / σ_yield (dimensionless). null if yield strength unavailable. */
  yieldUtilisation: number | null;
  /** Warnings (T outside table range, yield exceeded, etc.) */
  warnings: string[];
}

// ============================================================================
// Calculator
// ============================================================================

/**
 * Calculate thermal expansion and restrained-stress for a single material.
 *
 * @throws Error on invalid inputs (unknown material, non-positive length, etc.)
 */
export function calculateThermalExpansion(input: ThermalExpansionInput): ThermalExpansionResult {
  const { materialKey, length, installationTemperature, operatingTemperature, constraintMode } =
    input;

  if (!Number.isFinite(length) || length <= 0) {
    throw new Error('Length must be a positive number (mm)');
  }
  if (!Number.isFinite(installationTemperature)) {
    throw new Error('Installation temperature must be a finite number (°C)');
  }
  if (!Number.isFinite(operatingTemperature)) {
    throw new Error('Operating temperature must be a finite number (°C)');
  }
  if (constraintMode !== 'free' && constraintMode !== 'restrained') {
    throw new Error(`Invalid constraint mode: ${constraintMode}`);
  }

  const material = getMaterialThermalProperties(materialKey);
  const warnings: string[] = [];

  // Warn if either temperature is outside the tabulated range.
  const { min: Tmin, max: Tmax } = material.validRange;
  if (installationTemperature < Tmin || installationTemperature > Tmax) {
    warnings.push(
      `Installation temperature (${installationTemperature} °C) is outside the tabulated range ${Tmin}–${Tmax} °C for ${material.label}. Properties extrapolated by clamping.`
    );
  }
  if (operatingTemperature < Tmin || operatingTemperature > Tmax) {
    warnings.push(
      `Operating temperature (${operatingTemperature} °C) is outside the tabulated range ${Tmin}–${Tmax} °C for ${material.label}. Properties extrapolated by clamping.`
    );
  }

  // α_mean values (10⁻⁶/°C) from 20 °C
  const alphaInstall = getMeanExpansionCoefficient(materialKey, installationTemperature);
  const alphaOp = getMeanExpansionCoefficient(materialKey, operatingTemperature);

  // Total expansion δ/L (dimensionless, not yet × 10⁻⁶) from 20 °C reference
  const Tref = material.referenceTemperature; // 20 °C
  const epsFromRefAtInstall = alphaInstall * 1e-6 * (installationTemperature - Tref);
  const epsFromRefAtOp = alphaOp * 1e-6 * (operatingTemperature - Tref);
  const epsilonThermal = epsFromRefAtOp - epsFromRefAtInstall; // dimensionless

  const deltaT = operatingTemperature - installationTemperature;

  // Effective α over the range (10⁻⁶/°C). Guard against ΔT = 0.
  const alphaEffective = Math.abs(deltaT) < 1e-9 ? alphaOp : (epsilonThermal / deltaT) * 1e6;

  // Free expansion (mm)
  const deltaL_free = length * epsilonThermal;

  // Young's modulus at operating T (GPa → MPa = ×1000)
  const E_GPa = getYoungsModulus(materialKey, operatingTemperature);
  const E_MPa = E_GPa * 1e3;

  // Thermal stress under full restraint (MPa). σ = E × ε.
  // Sign: heating + restrained → compressive stress (reported as positive).
  const thermalStress = E_MPa * epsilonThermal;

  // Yield strength at T_op
  const yieldStrength = getYieldStrength(materialKey, operatingTemperature);
  const yieldUtilisation =
    yieldStrength !== null && yieldStrength > 0 ? Math.abs(thermalStress) / yieldStrength : null;

  if (yieldUtilisation !== null && yieldUtilisation >= 1) {
    warnings.push(
      `Restrained thermal stress (${Math.abs(thermalStress).toFixed(0)} MPa) exceeds yield strength at ${operatingTemperature} °C (${yieldStrength!.toFixed(0)} MPa). Plastic deformation expected — an expansion joint or flexible support is required.`
    );
  } else if (yieldUtilisation !== null && yieldUtilisation >= 0.7) {
    warnings.push(
      `Restrained thermal stress utilises ${(yieldUtilisation * 100).toFixed(0)}% of yield. Verify supports and consider an expansion device.`
    );
  }

  return {
    materialLabel: material.label,
    deltaT,
    alphaMeanInstallation: alphaInstall,
    alphaMeanOperating: alphaOp,
    alphaEffective,
    EOperating: E_GPa,
    deltaL: deltaL_free,
    thermalStrain_mmPerM: epsilonThermal * 1e3,
    thermalStrainPct: epsilonThermal * 100,
    thermalStress,
    yieldStrength,
    yieldUtilisation,
    warnings,
  };
}
